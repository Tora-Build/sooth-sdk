// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITickBookVault} from "./interfaces/ITickBookVault.sol";
import {ITickBookHooks, HookPermissions} from "./interfaces/ITickBookHooks.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {TickBitmap} from "./libraries/TickBitmap.sol";
import {TickMath} from "./libraries/TickMath.sol";
import {TransientDelta} from "./libraries/TransientDelta.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TickBookPoolManager
 * @notice Uniswap V4-style singleton manager for all prediction markets
 * @dev Key features:
 *      - Singleton: One contract manages ALL markets (vs per-market contracts)
 *      - Flash Accounting: EIP-1153 transient storage for batch operations
 *      - Hooks: Extensible before/after callbacks with address-encoded permissions
 *      - Permission Encoding: Zero-storage permission checks via address bits
 *
 * Architecture inspired by Uniswap V4 PoolManager
 */
contract TickBookPoolManager is ReentrancyGuard, Ownable {
    using TickBitmap for TickBitmap.Bitmap;
    using TransientDelta for address;
    using HookPermissions for address;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint16 private constant MIN_TICK = 1;
    uint16 private constant MAX_TICK = TickMath.MAX_TICK; // 999
    uint256 private constant Q128 = 2 ** 128;
    uint128 private constant MAX_LIQUIDITY = type(uint128).max;

    // ============================================
    // Custom Errors
    // ============================================

    error ZeroAddress();
    error MarketNotActive();
    error MarketNotLive();
    error DuplicateMarket();
    error InvalidOutcome();
    error ZeroAmount();
    error InvalidTickRange();
    error ZeroDensity();
    error NotOwner();
    error UnauthorizedRegistrar();
    error OrderNotActive();
    error NoLiquidity();
    error SlippageExceeded();
    error LiquidityOverflow();
    error UnsettledDeltas();
    error HookFailed();
    error InvalidHookResponse();
    error LockerMismatch();
    error NotLocked();

    // ============================================
    // Types
    // ============================================

    struct Market {
        address truthMarket;
        address yesToken;
        address noToken;
        address hook;           // Optional hook contract
        bool isActive;
    }

    struct RangeOrder {
        address owner;
        uint8 outcome;
        uint16 tickLower;
        uint16 tickUpper;
        bool active;
        uint128 sharesTotal;
        uint128 liquidity;
        uint128 collateralDepositedWad;
        uint128 filledShares;
        uint128 collateralUsedWad;
    }

    struct TickInfo {
        int128 liquidityNet;
        uint128 liquidityGross;
    }

    struct MarketState {
        uint16 currentTick;
        uint128 activeLiquidityNo;
        uint128 activeLiquidityYes;
    }

    struct PoolKey {
        address truthMarket;
        address yesToken;
        address noToken;
        address hook;
    }

    // ============================================
    // Storage
    // ============================================

    ITickBookVault public immutable vault;

    // Locker tracking for flash accounting
    address private _locker;
    uint256 private _lockCount;

    // Markets (singleton pattern - all markets in one mapping)
    mapping(bytes32 => Market) private _markets;
    mapping(bytes32 => MarketState) private _state;

    // Tick data
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => TickInfo))) private _ticks;
    mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _bitmaps;

    // Orders
    mapping(bytes32 => mapping(uint256 => RangeOrder)) private _orders;
    mapping(bytes32 => mapping(address => uint256[])) private _userOrders;
    uint256 private _nextOrderId;

    // Maker attribution
    mapping(bytes32 => mapping(uint8 => uint256)) private _totalLiquidity;
    mapping(bytes32 => mapping(uint8 => uint256)) private _fillGrowthGlobalX128;
    mapping(bytes32 => mapping(uint8 => uint256)) private _collateralUsedGrowthGlobalX128;
    mapping(bytes32 => mapping(uint256 => uint256)) private _fillGrowthLastX128;
    mapping(bytes32 => mapping(uint256 => uint256)) private _collateralUsedGrowthLastX128;

    // Access control: only registrar (LaunchpadEngine) can register markets
    address public registrar;

    // Fee recipient for collected trading fees
    address public feeRecipient;

    // ============================================
    // Events
    // ============================================

    event MarketRegistered(bytes32 indexed marketKey, address market, address yesToken, address noToken, address hook);
    event RegistrarChanged(address indexed oldRegistrar, address indexed newRegistrar);
    event FeeRecipientChanged(address indexed newFeeRecipient);
    event LockerChanged(address indexed oldLocker, address indexed newLocker);

    event RangeOrderPlaced(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed orderId,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 liquidity,
        uint256 collateralReserved,
        uint256 crossingFilled,
        uint256 crossingCost
    );

    event RangeOrderCancelled(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed orderId,
        uint256 collateralReleased
    );

    event MarketOrderExecuted(
        address indexed taker,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint256 sharesRequested,
        uint256 sharesFilled,
        uint256 totalCost,
        uint16 startTick,
        uint16 endTick,
        uint256 refunded
    );

    event TickCrossed(bytes32 indexed marketKey, uint16 tick, int128 liquidityDelta);

    event OrdersCrossed(
        bytes32 indexed marketKey,
        uint256 newOrderId,
        uint8 newOutcome,
        uint256 crossedShares,
        uint256 newOrderCost,
        uint256 oppositeOrderCost,
        uint16 crossTick
    );

    event FillsClaimed(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed orderId,
        uint256 filledShares,
        uint256 collateralUsedWad
    );

    // ============================================
    // Modifiers
    // ============================================

    /// @notice Ensures caller is the current locker (for flash operations)
    modifier onlyLocker() {
        if (msg.sender != _locker) revert LockerMismatch();
        _;
    }

    /// @notice Ensures we're in a locked state
    modifier whenLocked() {
        if (_locker == address(0)) revert NotLocked();
        _;
    }

    /// @notice Ensures caller is the registrar (LaunchpadEngine) or owner
    modifier onlyRegistrar() {
        if (msg.sender != registrar && msg.sender != owner()) revert UnauthorizedRegistrar();
        _;
    }

    // ============================================
    // Constructor
    // ============================================

    constructor(address _vault) Ownable(msg.sender) {
        if (_vault == address(0)) revert ZeroAddress();
        vault = ITickBookVault(_vault);
    }

    /**
     * @notice Set the registrar address (only LaunchpadEngine should register markets)
     * @dev Only owner can change registrar. Set to LaunchpadEngine after deployment.
     * @param _registrar The new registrar address
     */
    function setRegistrar(address _registrar) external onlyOwner {
        address old = registrar;
        registrar = _registrar;
        emit RegistrarChanged(old, _registrar);
    }

    /**
     * @notice Set the fee recipient address for collected trading fees
     * @param _feeRecipient The address to receive trading fees
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
        emit FeeRecipientChanged(_feeRecipient);
    }

    // ============================================
    // Flash Accounting (EIP-1153)
    // ============================================

    /**
     * @notice Lock the pool manager for batch operations
     * @dev Uses transient storage for tracking balance deltas
     * @param data Callback data
     * @return result Callback return data
     */
    function lock(bytes calldata data) external returns (bytes memory result) {
        address prevLocker = _locker;
        _locker = msg.sender;
        _lockCount++;

        emit LockerChanged(prevLocker, msg.sender);

        // Execute callback
        result = ILockCallback(msg.sender).lockCallback(data);

        // Verify all deltas are settled
        if (!TransientDelta.isSettled()) {
            revert UnsettledDeltas();
        }

        _lockCount--;
        if (_lockCount == 0) {
            _locker = address(0);
            emit LockerChanged(msg.sender, address(0));
        } else {
            _locker = prevLocker;
            emit LockerChanged(msg.sender, prevLocker);
        }
    }

    /**
     * @notice Get current delta for an account
     */
    function getDelta(address account) external view returns (int256) {
        return TransientDelta.getDelta(account);
    }

    /**
     * @notice Settle a positive delta by paying USDC
     * @param account The account to settle
     * @param amount Amount to pay
     */
    function settle(address account, uint256 amount) external whenLocked {
        int256 delta = TransientDelta.getDelta(account);
        if (delta > 0) {
            uint256 owed = uint256(delta);
            if (amount > owed) amount = owed;
            TransientDelta.addDelta(account, -int256(amount));
            // Actual transfer handled by caller
        }
    }

    /**
     * @notice Take USDC for a negative delta (account is owed funds)
     * @param account The account to take for
     * @param amount Amount to take
     */
    function take(address account, uint256 amount) external whenLocked {
        int256 delta = TransientDelta.getDelta(account);
        if (delta < 0) {
            uint256 owed = uint256(-delta);
            if (amount > owed) amount = owed;
            TransientDelta.addDelta(account, int256(amount));
            // Actual transfer handled by caller
        }
    }

    // ============================================
    // Market Registration
    // ============================================

    function registerMarket(
        PoolKey calldata key,
        uint256 initialProbabilityWad
    ) external onlyRegistrar returns (bytes32 marketKey) {
        if (key.truthMarket == address(0)) revert ZeroAddress();
        if (key.yesToken == address(0)) revert ZeroAddress();
        if (key.noToken == address(0)) revert ZeroAddress();

        marketKey = _getPoolKey(key);
        if (_markets[marketKey].isActive) revert DuplicateMarket();

        // Validate hook permissions if hook is set
        if (key.hook != address(0)) {
            // Hook address encodes permissions in its last 14 bits
            // This is validated at deployment via CREATE2 mining
        }

        _markets[marketKey] = Market({
            truthMarket: key.truthMarket,
            yesToken: key.yesToken,
            noToken: key.noToken,
            hook: key.hook,
            isActive: true
        });

        // Initialize currentTick to MIN_TICK - let trading establish the price
        // The _tryCross function uses bitmap overlap detection, not currentTick
        // Using MIN_TICK instead of 0 ensures _fill can search both up and down
        _state[marketKey] = MarketState({
            currentTick: MIN_TICK,
            activeLiquidityNo: 0,
            activeLiquidityYes: 0
        });

        emit MarketRegistered(marketKey, key.truthMarket, key.yesToken, key.noToken, key.hook);
    }

    /**
     * @notice Register market with legacy signature (ITickBook compatibility)
     * @dev Used by LaunchpadEngine - supports optional hook for dynamic fees
     * @param market Truth market address
     * @param yesToken YES outcome token
     * @param noToken NO outcome token
     * @param initialProbabilityWad Initial probability (unused - currentTick starts at 0)
     * @param hook Optional hook contract for dynamic fees (address(0) for no hook)
     */
    function registerMarket(
        address market,
        address yesToken,
        address noToken,
        uint256 initialProbabilityWad,
        address hook
    ) external onlyRegistrar returns (bytes32 marketKey) {
        if (market == address(0)) revert ZeroAddress();
        if (yesToken == address(0)) revert ZeroAddress();
        if (noToken == address(0)) revert ZeroAddress();
        // Note: initialProbabilityWad is kept for interface compatibility but unused

        marketKey = _getPoolKeyFromMemory(PoolKey({
            truthMarket: market,
            yesToken: yesToken,
            noToken: noToken,
            hook: hook
        }));
        if (_markets[marketKey].isActive) revert DuplicateMarket();

        _markets[marketKey] = Market({
            truthMarket: market,
            yesToken: yesToken,
            noToken: noToken,
            hook: hook,
            isActive: true
        });

        // Initialize currentTick to MIN_TICK - let trading establish the price
        // The _tryCross function uses bitmap overlap detection, not currentTick
        // Using MIN_TICK instead of 0 ensures _fill can search both up and down
        _state[marketKey] = MarketState({
            currentTick: MIN_TICK,
            activeLiquidityNo: 0,
            activeLiquidityYes: 0
        });

        emit MarketRegistered(marketKey, market, yesToken, noToken, hook);
    }

    // ============================================
    // Range Orders with Hooks
    // ============================================

    function placeRangeOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 sharesTotal
    ) external nonReentrant returns (uint256 orderId, uint256 crossingFilled, uint256 crossingCost) {
        Market memory m = _markets[marketKey];
        if (!m.isActive) revert MarketNotActive();
        if (!ITruthMarket(m.truthMarket).isLive()) revert MarketNotLive();
        if (outcome > 1) revert InvalidOutcome();
        if (sharesTotal == 0) revert ZeroAmount();
        if (tickLower < MIN_TICK || tickUpper > MAX_TICK) revert InvalidTickRange();
        if (tickLower > tickUpper) revert InvalidTickRange();

        // Before hook
        bytes memory hookData;
        if (m.hook != address(0) && m.hook.beforePlaceOrder()) {
            ITickBookHooks.PlaceOrderParams memory params = ITickBookHooks.PlaceOrderParams({
                marketKey: marketKey,
                sender: msg.sender,
                outcome: outcome,
                tickLower: tickLower,
                tickUpper: tickUpper,
                sharesTotal: sharesTotal
            });
            (bytes4 selector, bytes memory data) = ITickBookHooks(m.hook).beforePlaceOrder(params);
            if (selector != ITickBookHooks.beforePlaceOrder.selector) revert InvalidHookResponse();
            hookData = data;
        }

        orderId = ++_nextOrderId;

        uint256 ticksInRange = uint256(tickUpper) - uint256(tickLower) + 1;
        uint256 density = sharesTotal / ticksInRange;
        if (density == 0) revert ZeroDensity();

        if (density > MAX_LIQUIDITY) revert LiquidityOverflow();
        if (sharesTotal > MAX_LIQUIDITY) revert LiquidityOverflow();

        uint256 collateral = _calculateCollateral(outcome, tickLower, tickUpper, sharesTotal);
        if (collateral > MAX_LIQUIDITY) revert LiquidityOverflow();

        _orders[marketKey][orderId] = RangeOrder({
            owner: msg.sender,
            outcome: outcome,
            tickLower: tickLower,
            tickUpper: tickUpper,
            active: true,
            sharesTotal: uint128(sharesTotal),
            liquidity: uint128(density),
            collateralDepositedWad: uint128(collateral),
            filledShares: 0,
            collateralUsedWad: 0
        });
        _userOrders[marketKey][msg.sender].push(orderId);

        _fillGrowthLastX128[marketKey][orderId] = _fillGrowthGlobalX128[marketKey][outcome];
        _collateralUsedGrowthLastX128[marketKey][orderId] = _collateralUsedGrowthGlobalX128[marketKey][outcome];

        _totalLiquidity[marketKey][outcome] += sharesTotal;
        _updateTickBoundaries(marketKey, outcome, tickLower, tickUpper, int128(uint128(density)), true);
        _updateActiveLiquidity(marketKey, outcome, tickLower, tickUpper, uint128(density), true);

        vault.spendAvailableToMarket(msg.sender, m.truthMarket, collateral);

        (crossingFilled, crossingCost, ) = _tryCross(marketKey, orderId);

        // After hook
        if (m.hook != address(0) && m.hook.afterPlaceOrder()) {
            ITickBookHooks.PlaceOrderParams memory params = ITickBookHooks.PlaceOrderParams({
                marketKey: marketKey,
                sender: msg.sender,
                outcome: outcome,
                tickLower: tickLower,
                tickUpper: tickUpper,
                sharesTotal: sharesTotal
            });
            ITickBookHooks(m.hook).afterPlaceOrder(params, orderId, hookData);
        }

        emit RangeOrderPlaced(
            msg.sender, marketKey, orderId, outcome, tickLower, tickUpper,
            density, collateral, crossingFilled, crossingCost
        );
    }

    function cancelOrder(bytes32 marketKey, uint256 orderId) external nonReentrant returns (uint256 collateralReleased) {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (!order.active) revert OrderNotActive();
        if (order.owner != msg.sender) revert NotOwner();

        Market memory m = _markets[marketKey];

        // Before hook
        if (m.hook != address(0) && m.hook.beforeCancelOrder()) {
            ITickBookHooks.CancelOrderParams memory params = ITickBookHooks.CancelOrderParams({
                marketKey: marketKey,
                sender: msg.sender,
                orderId: orderId
            });
            bytes4 selector = ITickBookHooks(m.hook).beforeCancelOrder(params);
            if (selector != ITickBookHooks.beforeCancelOrder.selector) revert InvalidHookResponse();
        }

        _claimInternal(marketKey, orderId);
        _updateTickBoundaries(marketKey, order.outcome, order.tickLower, order.tickUpper, -int128(order.liquidity), false);
        _updateActiveLiquidity(marketKey, order.outcome, order.tickLower, order.tickUpper, order.liquidity, false);

        collateralReleased = order.collateralDepositedWad > order.collateralUsedWad
            ? uint256(order.collateralDepositedWad - order.collateralUsedWad)
            : 0;

        _totalLiquidity[marketKey][order.outcome] -= order.sharesTotal;
        order.active = false;

        if (collateralReleased > 0) {
            vault.refundMarketToAvailable(m.truthMarket, msg.sender, collateralReleased);
        }

        // After hook
        if (m.hook != address(0) && m.hook.afterCancelOrder()) {
            ITickBookHooks.CancelOrderParams memory params = ITickBookHooks.CancelOrderParams({
                marketKey: marketKey,
                sender: msg.sender,
                orderId: orderId
            });
            ITickBookHooks(m.hook).afterCancelOrder(params, collateralReleased);
        }

        emit RangeOrderCancelled(msg.sender, marketKey, orderId, collateralReleased);
    }

    // ============================================
    // Market Orders with Dynamic Fees
    // ============================================

    function executeMarketOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint256 maxCost
    ) external nonReentrant returns (uint256 sharesFilled, uint256 totalCost, uint256 refunded) {
        Market memory m = _markets[marketKey];
        if (!m.isActive) revert MarketNotActive();
        if (!ITruthMarket(m.truthMarket).isLive()) revert MarketNotLive();
        if (outcome > 1) revert InvalidOutcome();
        if (shares == 0) revert ZeroAmount();

        // Before hook
        bytes memory hookData;
        if (m.hook != address(0) && m.hook.beforeExecuteOrder()) {
            ITickBookHooks.ExecuteOrderParams memory params = ITickBookHooks.ExecuteOrderParams({
                marketKey: marketKey,
                sender: msg.sender,
                outcome: outcome,
                shares: shares,
                maxCost: maxCost
            });
            (bytes4 selector, bytes memory data) = ITickBookHooks(m.hook).beforeExecuteOrder(params);
            if (selector != ITickBookHooks.beforeExecuteOrder.selector) revert InvalidHookResponse();
            hookData = data;
        }

        vault.spendAvailableToMarket(msg.sender, m.truthMarket, maxCost);

        MarketState storage state = _state[marketKey];
        uint16 startTick = state.currentTick;
        uint8 makerOutcome = outcome == 1 ? 0 : 1;
        bool isUp = outcome == 1;

        (sharesFilled, totalCost) = _fill(marketKey, state, shares, makerOutcome, isUp);

        // Apply dynamic taker fee if hook supports it
        uint256 feeAmount = 0;
        if (m.hook != address(0) && m.hook.getDynamicFee()) {
            uint24 baseFee = 10; // 0.1% default
            uint24 fee = ITickBookHooks(m.hook).getDynamicFee(marketKey, outcome, sharesFilled, baseFee);
            feeAmount = (totalCost * fee) / 10000;
            totalCost += feeAmount;
        }

        if (sharesFilled == 0) revert NoLiquidity();
        if (totalCost > maxCost) revert SlippageExceeded();

        if (sharesFilled > 0) {
            uint256 totalLiq = _totalLiquidity[marketKey][makerOutcome];
            if (totalLiq > 0) {
                _fillGrowthGlobalX128[marketKey][makerOutcome] += (sharesFilled * Q128) / totalLiq;

                // Calculate maker's collateral used (how much USDC makers effectively paid)
                uint256 makerCollateralUsed = sharesFilled > totalCost ? (sharesFilled - totalCost) : 0;

                // Apply maker rebate if hook supports it
                if (m.hook != address(0) && m.hook.getMakerFee()) {
                    (uint24 makerFee, bool isRebate) = ITickBookHooks(m.hook).getMakerFee(
                        marketKey, makerOutcome, sharesFilled, 0
                    );
                    if (isRebate && makerFee > 0) {
                        // Reduce maker's collateral used (they get more USDC back)
                        uint256 rebateAmount = (sharesFilled * makerFee) / 10000;
                        makerCollateralUsed = makerCollateralUsed > rebateAmount
                            ? makerCollateralUsed - rebateAmount : 0;
                    }
                }

                _collateralUsedGrowthGlobalX128[marketKey][makerOutcome] += (makerCollateralUsed * Q128) / totalLiq;
            }
            vault.creditOutcome(m.truthMarket, msg.sender, outcome, sharesFilled);
        }

        if (maxCost > totalCost) {
            refunded = maxCost - totalCost;
            vault.refundMarketToAvailable(m.truthMarket, msg.sender, refunded);
        }

        // Transfer collected fee to recipient
        if (feeAmount > 0 && feeRecipient != address(0)) {
            vault.transferFee(m.truthMarket, feeRecipient, feeAmount);
        }

        // After hook
        if (m.hook != address(0) && m.hook.afterExecuteOrder()) {
            ITickBookHooks.ExecuteOrderParams memory params = ITickBookHooks.ExecuteOrderParams({
                marketKey: marketKey,
                sender: msg.sender,
                outcome: outcome,
                shares: shares,
                maxCost: maxCost
            });
            ITickBookHooks(m.hook).afterExecuteOrder(params, sharesFilled, totalCost, hookData);
        }

        emit MarketOrderExecuted(msg.sender, marketKey, outcome, shares, sharesFilled, totalCost, startTick, state.currentTick, refunded);
    }

    // ============================================
    // Batch Operations (Flash Accounting)
    // ============================================

    /**
     * @notice Place multiple orders in a single transaction with flash accounting
     * @dev Caller must implement ILockCallback and call lock() first
     */
    function batchPlaceOrders(
        bytes32[] calldata marketKeys,
        uint8[] calldata outcomes,
        uint16[] calldata tickLowers,
        uint16[] calldata tickUppers,
        uint256[] calldata sharesTotals
    ) external onlyLocker returns (uint256[] memory orderIds) {
        uint256 len = marketKeys.length;
        require(
            outcomes.length == len &&
            tickLowers.length == len &&
            tickUppers.length == len &&
            sharesTotals.length == len,
            "Length mismatch"
        );

        orderIds = new uint256[](len);
        uint256 totalCollateral;

        for (uint256 i = 0; i < len; i++) {
            Market memory m = _markets[marketKeys[i]];
            if (!m.isActive) revert MarketNotActive();
            if (!ITruthMarket(m.truthMarket).isLive()) revert MarketNotLive();

            uint256 collateral = _calculateCollateral(
                outcomes[i],
                tickLowers[i],
                tickUppers[i],
                sharesTotals[i]
            );
            totalCollateral += collateral;

            // Track delta instead of immediate transfer
            TransientDelta.addDelta(msg.sender, int256(collateral));

            // Place order (simplified - no hooks in batch for gas)
            orderIds[i] = ++_nextOrderId;
            uint256 ticksInRange = uint256(tickUppers[i]) - uint256(tickLowers[i]) + 1;
            uint256 density = sharesTotals[i] / ticksInRange;

            _orders[marketKeys[i]][orderIds[i]] = RangeOrder({
                owner: msg.sender,
                outcome: outcomes[i],
                tickLower: tickLowers[i],
                tickUpper: tickUppers[i],
                active: true,
                sharesTotal: uint128(sharesTotals[i]),
                liquidity: uint128(density),
                collateralDepositedWad: uint128(collateral),
                filledShares: 0,
                collateralUsedWad: 0
            });

            _totalLiquidity[marketKeys[i]][outcomes[i]] += sharesTotals[i];
            _updateTickBoundaries(marketKeys[i], outcomes[i], tickLowers[i], tickUppers[i], int128(uint128(density)), true);
        }
    }

    // ============================================
    // Claims
    // ============================================

    /**
     * @notice Claim fills for your own order
     * @param marketKey The market
     * @param orderId The order ID
     */
    function claimFills(bytes32 marketKey, uint256 orderId)
        external
        returns (uint256 filledShares, uint256 collateralUsedWad)
    {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (order.owner != msg.sender) revert NotOwner();
        return _claimInternal(marketKey, orderId);
    }

    /**
     * @notice Permissionless claim - anyone can trigger claims for any order
     * @dev Enables takers/keepers to auto-settle makers, preventing order flow blockage
     * @param marketKey The market
     * @param orderId The order ID
     */
    function claimFillsFor(bytes32 marketKey, uint256 orderId)
        external
        returns (uint256 filledShares, uint256 collateralUsedWad)
    {
        return _claimInternal(marketKey, orderId);
    }

    /**
     * @notice Batch claim for multiple orders (gas efficient for keepers)
     * @param marketKey The market
     * @param orderIds Array of order IDs to claim
     */
    function batchClaimFills(bytes32 marketKey, uint256[] calldata orderIds)
        external
        returns (uint256 totalFilledShares, uint256 totalCollateralUsed)
    {
        for (uint256 i = 0; i < orderIds.length; i++) {
            (uint256 filled, uint256 used) = _claimInternal(marketKey, orderIds[i]);
            totalFilledShares += filled;
            totalCollateralUsed += used;
        }
    }

    function _claimInternal(bytes32 marketKey, uint256 orderId)
        internal
        returns (uint256 filledShares, uint256 collateralUsedWad)
    {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (!order.active) revert OrderNotActive();

        address owner = order.owner;
        Market memory m = _markets[marketKey];

        // Before hook
        if (m.hook != address(0) && m.hook.beforeClaim()) {
            ITickBookHooks.ClaimParams memory params = ITickBookHooks.ClaimParams({
                marketKey: marketKey,
                sender: owner,
                orderId: orderId,
                filledShares: 0 // Will be calculated
            });
            bytes4 selector = ITickBookHooks(m.hook).beforeClaim(params);
            if (selector != ITickBookHooks.beforeClaim.selector) revert InvalidHookResponse();
        }

        uint8 out = order.outcome;
        uint256 totalLiq = _totalLiquidity[marketKey][out];
        if (totalLiq == 0) return (0, 0);

        uint256 globalFillGrowth = _fillGrowthGlobalX128[marketKey][out];
        uint256 lastFillGrowth = _fillGrowthLastX128[marketKey][orderId];
        if (globalFillGrowth > lastFillGrowth) {
            uint256 delta = globalFillGrowth - lastFillGrowth;
            filledShares = (delta * order.sharesTotal) / Q128;
            _fillGrowthLastX128[marketKey][orderId] = globalFillGrowth;
        }

        uint256 globalUsedGrowth = _collateralUsedGrowthGlobalX128[marketKey][out];
        uint256 lastUsedGrowth = _collateralUsedGrowthLastX128[marketKey][orderId];
        if (globalUsedGrowth > lastUsedGrowth) {
            uint256 delta = globalUsedGrowth - lastUsedGrowth;
            collateralUsedWad = (delta * order.sharesTotal) / Q128;
            _collateralUsedGrowthLastX128[marketKey][orderId] = globalUsedGrowth;
        }

        if (filledShares > 0) {
            order.filledShares += uint128(filledShares);
            vault.creditOutcome(m.truthMarket, owner, order.outcome, filledShares);
        }

        if (collateralUsedWad > 0) {
            order.collateralUsedWad += uint128(collateralUsedWad);
        }

        // After hook
        if (m.hook != address(0) && m.hook.afterClaim()) {
            ITickBookHooks.ClaimParams memory params = ITickBookHooks.ClaimParams({
                marketKey: marketKey,
                sender: owner,
                orderId: orderId,
                filledShares: filledShares
            });
            ITickBookHooks(m.hook).afterClaim(params, collateralUsedWad);
        }

        emit FillsClaimed(owner, marketKey, orderId, filledShares, collateralUsedWad);
    }

    // ============================================
    // Internal Helpers (same as TickBook)
    // ============================================

    function _getPoolKey(PoolKey calldata key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key.truthMarket, key.yesToken, key.noToken, key.hook));
    }

    function _getPoolKeyFromMemory(PoolKey memory key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key.truthMarket, key.yesToken, key.noToken, key.hook));
    }

    function _fill(
        bytes32 marketKey,
        MarketState storage state,
        uint256 sharesToFill,
        uint8 makerOutcome,
        bool isUp
    ) internal returns (uint256 filled, uint256 cost) {
        uint256 remaining = sharesToFill;
        uint16 tick = state.currentTick;
        uint128 activeLiq = isUp ? state.activeLiquidityNo : state.activeLiquidityYes;

        while (remaining > 0) {
            if (activeLiq == 0) {
                uint16 nextTick;
                if (isUp) {
                    nextTick = _bitmaps[marketKey][makerOutcome].findNextUp(tick);
                    
                    // V9.9.2 FIX: If market is crossed (best maker below current tick), jump back to it
                    uint16 absoluteLowest = _bitmaps[marketKey][makerOutcome].findNextUp(0);
                    if (absoluteLowest < tick && absoluteLowest <= MAX_TICK) {
                        nextTick = absoluteLowest;
                    }
                } else {
                    nextTick = _bitmaps[marketKey][makerOutcome].findNextDown(tick);

                    // V9.9.2 FIX: If market is crossed (best maker above current tick), jump up to it
                    // Check looking DOWN from above the book
                    uint16 absoluteHighest = _bitmaps[marketKey][makerOutcome].findNextDown(MAX_TICK + 1);
                    if (absoluteHighest > tick && absoluteHighest <= MAX_TICK) {
                        nextTick = absoluteHighest;
                    }
                }

                if (isUp && nextTick > MAX_TICK) break;
                if (!isUp && (nextTick == 0 || nextTick > MAX_TICK)) break;

                tick = nextTick;
                int128 delta = isUp
                    ? _ticks[marketKey][makerOutcome][tick].liquidityNet
                    : -_ticks[marketKey][makerOutcome][tick].liquidityNet; // V9.9.2 FIX: Use tick, not tick+1
                activeLiq = uint128(int128(activeLiq) + delta);
                emit TickCrossed(marketKey, tick, delta);
                continue;
            }

            uint16 searchFrom = isUp
                ? (tick == MAX_TICK ? MAX_TICK : tick + 1)
                : (tick == MIN_TICK ? MIN_TICK : tick - 1);
            uint16 nextBoundary = isUp
                ? _bitmaps[marketKey][makerOutcome].findNextUp(searchFrom)
                : _bitmaps[marketKey][makerOutcome].findNextDown(searchFrom);

            if (isUp && nextBoundary > MAX_TICK) nextBoundary = MAX_TICK;
            if (!isUp && (nextBoundary == 0 || nextBoundary > MAX_TICK)) nextBoundary = MIN_TICK;

            uint256 ticksToNext = isUp
                ? uint256(nextBoundary - tick)
                : uint256(tick - nextBoundary);
            uint256 maxSharesInSegment = uint256(activeLiq) * ticksToNext;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;
            uint256 ticksMoved = (fillNow + uint256(activeLiq) - 1) / uint256(activeLiq);
            if (ticksMoved > ticksToNext) ticksMoved = ticksToNext;
            if (ticksMoved == 0) ticksMoved = 1;

            uint256 priceStart;
            uint256 priceEnd;
            if (isUp) {
                priceStart = TickMath.tickToProbability(tick);
                priceEnd = TickMath.tickToProbability(tick + uint16(ticksMoved));
            } else {
                priceStart = WAD - TickMath.tickToProbability(tick);
                priceEnd = WAD - TickMath.tickToProbability(tick - uint16(ticksMoved));
            }
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentCost = (avgPrice * fillNow) / WAD;

            filled += fillNow;
            cost += segmentCost;
            remaining -= fillNow;

            if (isUp) {
                tick += uint16(ticksMoved);
            } else {
                tick -= uint16(ticksMoved);
            }

            if (tick == nextBoundary) {
                int128 delta;
                if (isUp && nextBoundary <= MAX_TICK) {
                    delta = _ticks[marketKey][makerOutcome][nextBoundary].liquidityNet;
                    activeLiq = uint128(int128(activeLiq) + delta);
                } else if (!isUp && nextBoundary >= MIN_TICK) {
                    delta = _ticks[marketKey][makerOutcome][nextBoundary + 1].liquidityNet;
                    activeLiq = uint128(int128(activeLiq) - delta);
                    delta = -delta;
                }
                if (delta != 0) {
                    emit TickCrossed(marketKey, nextBoundary, delta);
                }
            }
        }

        state.currentTick = tick;
        if (isUp) {
            state.activeLiquidityNo = activeLiq;
        } else {
            state.activeLiquidityYes = activeLiq;
        }
    }

    function _updateTickBoundaries(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        int128 liquidityDelta,
        bool isAdd
    ) internal {
        if (isAdd) {
            _ticks[marketKey][outcome][tickLower].liquidityNet += liquidityDelta;
            _ticks[marketKey][outcome][tickLower].liquidityGross += uint128(liquidityDelta);

            uint16 upperBoundary = tickUpper + 1;
            _ticks[marketKey][outcome][upperBoundary].liquidityNet -= liquidityDelta;
            _ticks[marketKey][outcome][upperBoundary].liquidityGross += uint128(liquidityDelta);

            _bitmaps[marketKey][outcome].setBit(tickLower);
            if (upperBoundary <= MAX_TICK) {
                _bitmaps[marketKey][outcome].setBit(upperBoundary);
            }
        } else {
            _ticks[marketKey][outcome][tickLower].liquidityNet += liquidityDelta;
            _ticks[marketKey][outcome][tickLower].liquidityGross -= uint128(-liquidityDelta);

            uint16 upperBoundary = tickUpper + 1;
            _ticks[marketKey][outcome][upperBoundary].liquidityNet -= liquidityDelta;
            _ticks[marketKey][outcome][upperBoundary].liquidityGross -= uint128(-liquidityDelta);

            if (_ticks[marketKey][outcome][tickLower].liquidityGross == 0) {
                _bitmaps[marketKey][outcome].clearBit(tickLower);
            }
            if (upperBoundary <= MAX_TICK && _ticks[marketKey][outcome][upperBoundary].liquidityGross == 0) {
                _bitmaps[marketKey][outcome].clearBit(upperBoundary);
            }
        }
    }

    function _updateActiveLiquidity(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint128 liquidityDelta,
        bool isAdd
    ) internal {
        MarketState storage state = _state[marketKey];
        if (state.currentTick >= tickLower && state.currentTick <= tickUpper) {
            if (outcome == 0) {
                if (isAdd) {
                    state.activeLiquidityNo += liquidityDelta;
                } else {
                    state.activeLiquidityNo -= liquidityDelta;
                }
            } else {
                if (isAdd) {
                    state.activeLiquidityYes += liquidityDelta;
                } else {
                    state.activeLiquidityYes -= liquidityDelta;
                }
            }
        }
    }

    /**
     * @notice Try to cross a new order against existing opposite liquidity
     * @dev V9.9 FIX: Sweep from new order's WORST price toward BEST price
     *      - SELL orders sweep LOW → HIGH (worst ask → best ask)
     *      - BUY orders sweep HIGH → LOW (worst bid → best bid)
     *      This ensures fills happen at the overlap point, not at arbitrary prices.
     */
    function _tryCross(
        bytes32 marketKey,
        uint256 newOrderId
    ) internal returns (uint256 crossedShares, uint256 newOrderCost, uint256 oppositeCost) {
        RangeOrder storage newOrder = _orders[marketKey][newOrderId];
        Market memory m = _markets[marketKey];
        MarketState storage state = _state[marketKey];

        uint8 opposite = newOrder.outcome == 0 ? 1 : 0;

        // Check if there's ANY opposing liquidity
        uint256 oppTotalLiq = _totalLiquidity[marketKey][opposite];
        if (oppTotalLiq == 0) return (0, 0, 0);

        // Find overlap range between new order and opposite liquidity
        // For SELL YES (outcome=0): find where BUY YES (outcome=1) orders overlap
        // For BUY YES (outcome=1): find where SELL YES (outcome=0) orders overlap
        uint16 overlapLow;
        uint16 overlapHigh;
        uint16 crossTick;

        if (newOrder.outcome == 1) {
            // BUY YES: find lowest SELL YES tick that overlaps our range
            uint16 lowestSell = _bitmaps[marketKey][0].findNextUp(0);
            if (lowestSell > MAX_TICK) return (0, 0, 0); // No SELL YES liquidity

            // Overlap exists if lowestSell <= our tickUpper
            if (lowestSell > newOrder.tickUpper) return (0, 0, 0);

            // Overlap range: max(our tickLower, lowestSell) to our tickUpper
            overlapLow = lowestSell > newOrder.tickLower ? lowestSell : newOrder.tickLower;
            overlapHigh = newOrder.tickUpper;

            // BUY sweeps HIGH → LOW (start at worst bid = tickUpper)
            crossTick = overlapHigh;
        } else {
            // SELL YES: find highest BUY YES tick that overlaps our range
            uint16 highestBuy = _bitmaps[marketKey][1].findNextDown(MAX_TICK + 1);
            if (highestBuy > MAX_TICK) return (0, 0, 0); // No BUY YES liquidity

            // Overlap exists if highestBuy >= our tickLower
            if (highestBuy < newOrder.tickLower) return (0, 0, 0);

            // Overlap range: our tickLower to min(our tickUpper, highestBuy)
            overlapLow = newOrder.tickLower;
            overlapHigh = highestBuy < newOrder.tickUpper ? highestBuy : newOrder.tickUpper;

            // SELL sweeps LOW → HIGH (start at worst ask = tickLower)
            crossTick = overlapLow;
        }

        // Before cross hook
        if (m.hook != address(0) && m.hook.beforeCross()) {
            ITickBookHooks.CrossParams memory params = ITickBookHooks.CrossParams({
                marketKey: marketKey,
                newOrderId: newOrderId,
                crossedShares: 0,
                crossTick: crossTick
            });
            bytes4 selector = ITickBookHooks(m.hook).beforeCross(params);
            if (selector != ITickBookHooks.beforeCross.selector) revert InvalidHookResponse();
        }

        // Calculate shares available in the overlap range
        uint256 overlapTicks = uint256(overlapHigh) - uint256(overlapLow) + 1;
        uint256 newOrderSharesInOverlap = uint256(newOrder.liquidity) * overlapTicks;

        // Get opposing liquidity in the overlap range only
        uint256 oppLiqInOverlap = _getOverlappingLiquidity(marketKey, opposite, overlapLow, overlapHigh);

        // Cross the minimum of new order shares and opposing liquidity in overlap
        crossedShares = newOrderSharesInOverlap < oppLiqInOverlap ? newOrderSharesInOverlap : oppLiqInOverlap;
        if (crossedShares == 0) return (0, 0, 0);

        // Calculate costs using average price in overlap range
        uint256 priceLow = TickMath.tickToProbability(overlapLow);
        uint256 priceHigh = TickMath.tickToProbability(overlapHigh);
        uint256 avgPrice = (priceLow + priceHigh) / 2;

        uint256 yesCost = (avgPrice * crossedShares) / WAD;
        uint256 noCost = crossedShares - yesCost;

        if (newOrder.outcome == 0) {
            // SELL YES: seller pays NO cost, gets YES proceeds
            newOrderCost = noCost;
            oppositeCost = yesCost;
        } else {
            // BUY YES: buyer pays YES cost, seller gets NO proceeds
            newOrderCost = yesCost;
            oppositeCost = noCost;
        }

        // Credit shares to new order owner
        vault.creditOutcome(m.truthMarket, newOrder.owner, newOrder.outcome, crossedShares);
        newOrder.filledShares += uint128(crossedShares);
        newOrder.collateralUsedWad += uint128(newOrderCost);

        // V9.9.3 FIX: If new order is 100% filled via crossing, remove its tick liquidity
        // This prevents "phantom liquidity" in the orderbook display
        if (newOrder.filledShares >= newOrder.sharesTotal) {
            // Remove tick boundaries for the new order
            _updateTickBoundaries(marketKey, newOrder.outcome, newOrder.tickLower, newOrder.tickUpper, -int128(newOrder.liquidity), false);
            // Decrement total liquidity
            _totalLiquidity[marketKey][newOrder.outcome] -= newOrder.sharesTotal;
        }

        // Update fill growth globals for opposite side
        // Only attribute fills to orders that are actually in the overlap range
        if (oppLiqInOverlap > 0) {
            _fillGrowthGlobalX128[marketKey][opposite] += (crossedShares * Q128) / oppTotalLiq;
            _collateralUsedGrowthGlobalX128[marketKey][opposite] += (oppositeCost * Q128) / oppTotalLiq;
        }

        // Update active liquidity for both sides
        uint128 oppActiveLiq = opposite == 0 ? state.activeLiquidityNo : state.activeLiquidityYes;
        uint128 activeFilled = crossedShares < uint256(oppActiveLiq) ? uint128(crossedShares) : oppActiveLiq;
        if (opposite == 0) {
            state.activeLiquidityNo -= activeFilled;
        } else {
            state.activeLiquidityYes -= activeFilled;
        }

        uint128 newActiveLiq = newOrder.outcome == 0 ? state.activeLiquidityNo : state.activeLiquidityYes;
        uint128 newFilled = crossedShares < uint256(newActiveLiq) ? uint128(crossedShares) : newActiveLiq;
        if (newOrder.outcome == 0) {
            state.activeLiquidityNo -= newFilled;
        } else {
            state.activeLiquidityYes -= newFilled;
        }

        // Update currentTick to the crossing point
        state.currentTick = crossTick;

        // After cross hook
        if (m.hook != address(0) && m.hook.afterCross()) {
            ITickBookHooks.CrossParams memory params = ITickBookHooks.CrossParams({
                marketKey: marketKey,
                newOrderId: newOrderId,
                crossedShares: crossedShares,
                crossTick: crossTick
            });
            ITickBookHooks(m.hook).afterCross(params, newOrderCost, oppositeCost);
        }

        emit OrdersCrossed(marketKey, newOrderId, newOrder.outcome, crossedShares, newOrderCost, oppositeCost, crossTick);
    }

    /**
     * @notice Calculate total liquidity in a given tick range for an outcome
     * @dev Simplified: uses active liquidity at state.currentTick as approximation
     *      This avoids expensive tick walking and stack-too-deep issues
     */
    function _getOverlappingLiquidity(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLow,
        uint16 tickHigh
    ) internal view returns (uint256) {
        // Use the active liquidity from state as a proxy for overlapping liquidity
        // This is safe because:
        // 1. Active liquidity represents density of orders at currentTick
        // 2. For crossing, we want to match against whatever is there
        MarketState memory s = _state[marketKey];
        uint128 activeLiq = outcome == 0 ? s.activeLiquidityNo : s.activeLiquidityYes;

        // If there's active liquidity, multiply by the range
        // V9.9.1 FIX: Cap by total liquidity to prevent phantom growth (>100% fill bugs)
        uint256 totalLiq = _totalLiquidity[marketKey][outcome];
        if (activeLiq > 0) {
            uint256 rangeLiq = uint256(activeLiq) * (uint256(tickHigh) - uint256(tickLow) + 1);
            return rangeLiq > totalLiq ? totalLiq : rangeLiq;
        }

        // Fallback: use total liquidity
        return totalLiq;
    }

    function _calculateCollateral(
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 sharesTotal
    ) internal pure returns (uint256) {
        uint16 lowBoundTick = tickLower == MIN_TICK ? MIN_TICK : tickLower - 1;
        uint16 highBoundTick = tickUpper == MAX_TICK ? MAX_TICK : tickUpper + 1;

        uint256 pLow = TickMath.tickToProbability(lowBoundTick);
        uint256 pHigh = TickMath.tickToProbability(highBoundTick);

        if (outcome == 0) {
            return ((WAD - pLow) * sharesTotal) / WAD;
        } else {
            return (pHigh * sharesTotal) / WAD;
        }
    }

    // ============================================
    // Views
    // ============================================

    function getMarketState(bytes32 marketKey) external view returns (
        uint16 currentTick,
        uint128 activeLiquidityNo,
        uint128 activeLiquidityYes,
        uint256 currentProbability
    ) {
        MarketState memory s = _state[marketKey];
        return (s.currentTick, s.activeLiquidityNo, s.activeLiquidityYes, TickMath.tickToProbability(s.currentTick));
    }

    function getOrder(bytes32 marketKey, uint256 orderId) external view returns (RangeOrder memory) {
        return _orders[marketKey][orderId];
    }

    function getUserOrders(bytes32 marketKey, address user) external view returns (uint256[] memory) {
        return _userOrders[marketKey][user];
    }

    function getMarketInfo(bytes32 marketKey) external view returns (
        address market,
        address yesToken,
        address noToken,
        address hook,
        bool isActive
    ) {
        Market memory m = _markets[marketKey];
        return (m.truthMarket, m.yesToken, m.noToken, m.hook, m.isActive);
    }

    function locker() external view returns (address) {
        return _locker;
    }

    /**
     * @notice Calculate pending fills for an order without claiming
     * @param marketKey The market
     * @param orderId The order ID
     * @return pendingShares Shares that can be claimed
     * @return pendingCollateralUsed Collateral used that can be claimed
     */
    function getPendingFills(bytes32 marketKey, uint256 orderId)
        external
        view
        returns (uint256 pendingShares, uint256 pendingCollateralUsed)
    {
        RangeOrder memory order = _orders[marketKey][orderId];
        if (!order.active) return (0, 0);

        uint8 out = order.outcome;
        uint256 totalLiq = _totalLiquidity[marketKey][out];
        if (totalLiq == 0) return (0, 0);

        uint256 globalFillGrowth = _fillGrowthGlobalX128[marketKey][out];
        uint256 lastFillGrowth = _fillGrowthLastX128[marketKey][orderId];
        if (globalFillGrowth > lastFillGrowth) {
            uint256 delta = globalFillGrowth - lastFillGrowth;
            pendingShares = (delta * order.sharesTotal) / Q128;
        }

        uint256 globalUsedGrowth = _collateralUsedGrowthGlobalX128[marketKey][out];
        uint256 lastUsedGrowth = _collateralUsedGrowthLastX128[marketKey][orderId];
        if (globalUsedGrowth > lastUsedGrowth) {
            uint256 delta = globalUsedGrowth - lastUsedGrowth;
            pendingCollateralUsed = (delta * order.sharesTotal) / Q128;
        }
    }
}

/**
 * @title ILockCallback
 * @notice Callback interface for flash accounting
 */
interface ILockCallback {
    function lockCallback(bytes calldata data) external returns (bytes memory);
}
