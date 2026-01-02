// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITickBookVault} from "./interfaces/ITickBookVault.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {TickBitmap} from "./libraries/TickBitmap.sol";
import {TickMath} from "./libraries/TickMath.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TickBookPoolManager V9.9.6
 * @notice Singleton manager for prediction market orderbooks
 * @dev V9.9.6 Changes:
 *      - UNIFIED: Single `placeOrder()` replaces `placeRangeOrder()` and `executeMarketOrder()`
 *      - ADDED: Auto-claim existing orders before placing new ones
 *      - TERMINOLOGY: Removed maker/taker language (now resting/crossing orders)
 *
 *      Order Types via Tick Range:
 *      - Market order: tickLower=1, tickUpper=999 (fill everything available)
 *      - Limit order: tickLower=X, tickUpper=X (single tick)
 *      - Range order: tickLower < tickUpper (spread liquidity)
 *      - Market with floor: tickLower=floor, tickUpper=999 (fill down to floor, rest at floor)
 *
 *      V9.9.5 Base (inherited):
 *      - `liquidityRemoved` flag for idempotent order cleanup
 *      - Cap filledShares at sharesTotal to prevent accumulator drift
 *      - Auto-complete orders when fully filled
 */
contract TickBookPoolManagerV996 is ReentrancyGuard, Ownable {
    using TickBitmap for TickBitmap.Bitmap;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint16 private constant MIN_TICK = 1;
    uint16 private constant MAX_TICK = TickMath.MAX_TICK; // 999
    uint256 private constant Q128 = 2 ** 128;
    uint128 private constant MAX_LIQUIDITY = type(uint128).max;
    uint24 private constant MAX_FEE_BPS = 1000; // 10% max fee (TOB-2 fix)

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
    error FeeTooHigh();

    // ============================================
    // Types
    // ============================================

    struct Market {
        address truthMarket;
        address yesToken;
        address noToken;
        bool isActive;
    }

    struct RangeOrder {
        address owner;
        uint8 outcome;
        uint16 tickLower;
        uint16 tickUpper;
        bool active;
        bool liquidityRemoved;  // V9.9.5: Track if tick liquidity has been cleaned up
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
    }

    // ============================================
    // Storage
    // ============================================

    ITickBookVault public immutable vault;

    // Markets (singleton pattern)
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

    // V9.9.6-fix9: Pooled refunds for completed orders (O(1) claim)
    mapping(address => mapping(bytes32 => uint256)) private _pendingRefunds;

    // Access control
    address public registrar;
    address public feeRecipient;

    // Simple fee storage (replaces hook system)
    uint24 public takerFeeBps = 10;  // 0.1% default
    uint24 public makerFeeBps = 0;   // No maker fee by default

    // ============================================
    // Events
    // ============================================

    event MarketRegistered(bytes32 indexed marketKey, address market, address yesToken, address noToken);
    event RegistrarChanged(address indexed oldRegistrar, address indexed newRegistrar);
    event FeeRecipientChanged(address indexed newFeeRecipient);
    event FeesUpdated(uint24 takerFee, uint24 makerFee);

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

    // V9.9.6-fix9: Pooled refunds event
    event PooledRefundsClaimed(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 refund
    );

    // V9.9.6: Unified order events
    event OrderPlaced(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed orderId,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 shares,
        uint256 filledShares,
        uint256 filledCost,
        uint256 restingShares
    );

    event AutoClaimExecuted(
        address indexed user,
        bytes32 indexed marketKey,
        uint256 ordersClaimed,
        uint256 totalShares,
        uint256 totalCollateralUsed
    );

    // ============================================
    // Modifiers
    // ============================================

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

    // ============================================
    // Admin Functions
    // ============================================

    function setRegistrar(address _registrar) external onlyOwner {
        address old = registrar;
        registrar = _registrar;
        emit RegistrarChanged(old, _registrar);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
        emit FeeRecipientChanged(_feeRecipient);
    }

    function setFees(uint24 _takerFee, uint24 _makerFee) external onlyOwner {
        if (_takerFee > MAX_FEE_BPS) revert FeeTooHigh();
        if (_makerFee > MAX_FEE_BPS) revert FeeTooHigh();
        takerFeeBps = _takerFee;
        makerFeeBps = _makerFee;
        emit FeesUpdated(_takerFee, _makerFee);
    }

    // ============================================
    // Market Registration
    // ============================================

    function registerMarket(
        PoolKey calldata key,
        uint256 /* initialProbabilityWad */
    ) external onlyRegistrar returns (bytes32 marketKey) {
        if (key.truthMarket == address(0)) revert ZeroAddress();
        if (key.yesToken == address(0)) revert ZeroAddress();
        if (key.noToken == address(0)) revert ZeroAddress();

        marketKey = _getPoolKey(key);
        if (_markets[marketKey].isActive) revert DuplicateMarket();

        _markets[marketKey] = Market({
            truthMarket: key.truthMarket,
            yesToken: key.yesToken,
            noToken: key.noToken,
            isActive: true
        });

        _state[marketKey] = MarketState({
            currentTick: MIN_TICK,
            activeLiquidityNo: 0,
            activeLiquidityYes: 0
        });

        emit MarketRegistered(marketKey, key.truthMarket, key.yesToken, key.noToken);
    }

    /**
     * @notice Legacy signature for ITickBook compatibility
     * @dev hook parameter is ignored in V9.9.5 (no hooks)
     */
    function registerMarket(
        address market,
        address yesToken,
        address noToken,
        uint256 /* initialProbabilityWad */,
        address /* hook - IGNORED */
    ) external onlyRegistrar returns (bytes32 marketKey) {
        if (market == address(0)) revert ZeroAddress();
        if (yesToken == address(0)) revert ZeroAddress();
        if (noToken == address(0)) revert ZeroAddress();

        marketKey = keccak256(abi.encode(market, yesToken, noToken));
        if (_markets[marketKey].isActive) revert DuplicateMarket();

        _markets[marketKey] = Market({
            truthMarket: market,
            yesToken: yesToken,
            noToken: noToken,
            isActive: true
        });

        _state[marketKey] = MarketState({
            currentTick: MIN_TICK,
            activeLiquidityNo: 0,
            activeLiquidityYes: 0
        });

        emit MarketRegistered(marketKey, market, yesToken, noToken);
    }

    // ============================================
    // Unified Order Placement (V9.9.6)
    // ============================================

    /**
     * @notice Place an order - unified API for limit, market, and range orders
     * @dev Order type is determined by tick range:
     *      - Market order: tickLower=1, tickUpper=999 (fill everything)
     *      - Limit order: tickLower=X, tickUpper=X (single tick)
     *      - Range order: tickLower < tickUpper (spread liquidity)
     *      - Market with floor: tickLower=floor, tickUpper=999 (fill down to floor)
     *
     *      Auto-claims all user's existing orders before placing new one.
     *
     * @param marketKey The market identifier
     * @param outcome 0 = NO, 1 = YES
     * @param shares Total shares to place
     * @param tickLower Lower tick bound (1-999)
     * @param tickUpper Upper tick bound (1-999)
     * @param maxCost Maximum cost willing to pay (slippage protection)
     * @return orderId The created order ID
     * @return filledShares Shares filled immediately via crossing
     * @return filledCost Cost of immediately filled shares
     * @return restingShares Shares remaining as resting order
     */
    function placeOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 maxCost
    ) external nonReentrant returns (
        uint256 orderId,
        uint256 filledShares,
        uint256 filledCost,
        uint256 restingShares
    ) {
        Market memory m = _markets[marketKey];
        if (!m.isActive) revert MarketNotActive();
        if (!ITruthMarket(m.truthMarket).isLive()) revert MarketNotLive();
        if (outcome > 1) revert InvalidOutcome();
        if (shares == 0) revert ZeroAmount();
        if (tickLower < MIN_TICK || tickUpper > MAX_TICK) revert InvalidTickRange();
        if (tickLower > tickUpper) revert InvalidTickRange();

        // V9.9.6-fix9: Auto-claim ONLY 100% filled orders (max 5 for gas safety)
        // Partial fills are NOT claimed automatically - user must call claimFills()
        _autoClaimUserOrders(marketKey, msg.sender);

        // V9.9.6-fix9: Also auto-release pooled refunds to available balance
        uint256 pooled = _pendingRefunds[msg.sender][marketKey];
        if (pooled > 0) {
            _pendingRefunds[msg.sender][marketKey] = 0;
            vault.refundMarketToAvailable(m.truthMarket, msg.sender, pooled);
        }

        orderId = ++_nextOrderId;

        uint256 ticksInRange = uint256(tickUpper) - uint256(tickLower) + 1;
        uint256 density = shares / ticksInRange;
        if (density == 0) revert ZeroDensity();
        if (density > MAX_LIQUIDITY) revert LiquidityOverflow();
        if (shares > MAX_LIQUIDITY) revert LiquidityOverflow();

        uint256 collateral = _calculateCollateral(outcome, tickLower, tickUpper, shares);
        if (collateral > MAX_LIQUIDITY) revert LiquidityOverflow();
        if (collateral > maxCost) revert SlippageExceeded();

        _orders[marketKey][orderId] = RangeOrder({
            owner: msg.sender,
            outcome: outcome,
            tickLower: tickLower,
            tickUpper: tickUpper,
            active: true,
            liquidityRemoved: false,
            sharesTotal: uint128(shares),
            liquidity: uint128(density),
            collateralDepositedWad: uint128(collateral),
            filledShares: 0,
            collateralUsedWad: 0
        });
        _userOrders[marketKey][msg.sender].push(orderId);

        _fillGrowthLastX128[marketKey][orderId] = _fillGrowthGlobalX128[marketKey][outcome];
        _collateralUsedGrowthLastX128[marketKey][orderId] = _collateralUsedGrowthGlobalX128[marketKey][outcome];

        _totalLiquidity[marketKey][outcome] += shares;
        _updateTickBoundaries(marketKey, outcome, tickLower, tickUpper, int128(uint128(density)), true);
        _updateActiveLiquidity(marketKey, outcome, tickLower, tickUpper, uint128(density), true);

        vault.spendAvailableToMarket(msg.sender, m.truthMarket, collateral);

        // Try crossing with opposite orders
        uint256 crossingCost;
        (filledShares, filledCost, crossingCost) = _tryCross(marketKey, orderId);

        restingShares = shares - filledShares;

        emit OrderPlaced(
            msg.sender, marketKey, orderId, outcome, tickLower, tickUpper,
            shares, filledShares, filledCost, restingShares
        );
    }

    /**
     * @notice Auto-claim all user's active orders in a market
     * @dev Called automatically before placing a new order
     * @param marketKey The market identifier
     * @param user The user address
     * @return totalClaimedShares Total shares claimed across all orders
     * @return totalCollateralUsed Total collateral used across all orders
     */
    function _autoClaimUserOrders(bytes32 marketKey, address user)
        internal
        returns (uint256 totalClaimedShares, uint256 totalCollateralUsed)
    {
        uint256[] storage orderIds = _userOrders[marketKey][user];
        if (orderIds.length == 0) return (0, 0);
        
        uint256 ordersProcessed = 0;
        uint256 maxProcess = 10; // V9.9.6-fix9i: Always process up to 10, regardless of array size

        // Iterate backwards to handle removals safely
        uint256 i = orderIds.length;
        while (i > 0 && ordersProcessed < maxProcess) {
            unchecked { --i; }
            uint256 orderId = orderIds[i];
            RangeOrder storage order = _orders[marketKey][orderId];
            
            if (!order.active) {
                ordersProcessed++; // Count towards limit even if skipped
                continue;
            }
            
            // V9.9.6-fix9: Only auto-claim if order is 100% filled
            // Check pending fills to see if order is complete
            (uint256 pendingFills, ) = _getPendingFillsInternal(marketKey, orderId);
            uint256 totalFilled = order.filledShares + pendingFills;
            
            if (totalFilled >= order.sharesTotal) {
                // Order is 100% filled - claim and complete it
                (uint256 filled, uint256 used) = _claimInternal(marketKey, orderId);
                totalClaimedShares += filled;
                totalCollateralUsed += used;
            }
            ordersProcessed++; // Always increment to bound iterations
        }

        if (ordersProcessed > 0) {
            emit AutoClaimExecuted(user, marketKey, ordersProcessed, totalClaimedShares, totalCollateralUsed);
        }
    }

    function cancelOrder(bytes32 marketKey, uint256 orderId) external nonReentrant returns (uint256 collateralReleased) {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (!order.active) revert OrderNotActive();
        if (order.owner != msg.sender) revert NotOwner();

        Market memory m = _markets[marketKey];

        _claimInternal(marketKey, orderId);

        // V9.9.5: Only remove tick liquidity if not already removed
        if (!order.liquidityRemoved) {
            _updateTickBoundaries(marketKey, order.outcome, order.tickLower, order.tickUpper, -int128(order.liquidity), false);
            _updateActiveLiquidity(marketKey, order.outcome, order.tickLower, order.tickUpper, order.liquidity, false);
            _safeSubTotalLiquidity(marketKey, order.outcome, order.sharesTotal);
            order.liquidityRemoved = true;
        }

        collateralReleased = order.collateralDepositedWad > order.collateralUsedWad
            ? uint256(order.collateralDepositedWad - order.collateralUsedWad)
            : 0;

        order.active = false;
        _removeFromUserOrders(marketKey, msg.sender, orderId);

        if (collateralReleased > 0) {
            vault.refundMarketToAvailable(m.truthMarket, msg.sender, collateralReleased);
        }

        emit RangeOrderCancelled(msg.sender, marketKey, orderId, collateralReleased);
    }

    // ============================================
    // Claims
    // ============================================

    function claimFills(bytes32 marketKey, uint256 orderId)
        external
        returns (uint256 filledShares, uint256 collateralUsedWad)
    {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (order.owner != msg.sender) revert NotOwner();
        return _claimInternal(marketKey, orderId);
    }

    function claimFillsFor(bytes32 marketKey, uint256 orderId)
        external
        returns (uint256 filledShares, uint256 collateralUsedWad)
    {
        return _claimInternal(marketKey, orderId);
    }

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

    /**
     * @notice Claim pooled refunds from completed orders (O(1) gas)
     * @dev V9.9.6-fix9: Refunds are automatically pooled when orders complete
     * @param marketKey The market key
     * @return refund Amount of USDC released back to available balance
     */
    function claimPooledRefunds(bytes32 marketKey) external returns (uint256 refund) {
        refund = _pendingRefunds[msg.sender][marketKey];
        if (refund > 0) {
            _pendingRefunds[msg.sender][marketKey] = 0;
            Market memory m = _markets[marketKey];
            vault.refundMarketToAvailable(m.truthMarket, msg.sender, refund);
            emit PooledRefundsClaimed(msg.sender, marketKey, refund);
        }
    }

    /**
     * @notice View pending pooled refunds
     * @param user User address
     * @param marketKey The market key  
     * @return Pending refund amount
     */
    function getPendingRefunds(address user, bytes32 marketKey) external view returns (uint256) {
        return _pendingRefunds[user][marketKey];
    }

    function _claimInternal(bytes32 marketKey, uint256 orderId)
        internal
        returns (uint256 filledShares, uint256 collateralUsedWad)
    {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (!order.active) revert OrderNotActive();

        address owner = order.owner;
        Market memory m = _markets[marketKey];

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
            // V9.9.5: Cap filledShares to prevent precision overflow from accumulator math
            uint256 maxFillable = order.sharesTotal > order.filledShares
                ? order.sharesTotal - order.filledShares
                : 0;
            if (filledShares > maxFillable) {
                filledShares = maxFillable;
            }

            if (filledShares > 0) {
                order.filledShares += uint128(filledShares);
                vault.creditOutcome(m.truthMarket, owner, order.outcome, filledShares);
            }
        }

        if (collateralUsedWad > 0) {
            order.collateralUsedWad += uint128(collateralUsedWad);
        }

        // V9.9.5: Auto-complete orders when fully filled
        // V9.9.6-fix9: Pool refund immediately on completion
        if (order.filledShares >= order.sharesTotal && !order.liquidityRemoved) {
            _updateTickBoundaries(marketKey, order.outcome, order.tickLower, order.tickUpper, -int128(order.liquidity), false);
            _updateActiveLiquidity(marketKey, order.outcome, order.tickLower, order.tickUpper, order.liquidity, false);
            _safeSubTotalLiquidity(marketKey, order.outcome, order.sharesTotal);
            order.liquidityRemoved = true;
            order.active = false;
            _removeFromUserOrders(marketKey, owner, orderId);
            // Pool the refund (deposited - used)
            uint256 refund = order.collateralDepositedWad > order.collateralUsedWad 
                ? order.collateralDepositedWad - order.collateralUsedWad : 0;
            if (refund > 0) {
                _pendingRefunds[owner][marketKey] += refund;
            }
        }

        emit FillsClaimed(owner, marketKey, orderId, filledShares, collateralUsedWad);
    }

    // ============================================
    // Internal Helpers
    // ============================================

    /**
     * @notice Remove an order ID from user's order array (swap-and-pop for O(1))
     * @dev Called when order becomes inactive to keep _userOrders compact
     */
    function _removeFromUserOrders(bytes32 marketKey, address user, uint256 orderId) internal {
        uint256[] storage orderIds = _userOrders[marketKey][user];
        uint256 len = orderIds.length;
        for (uint256 i = 0; i < len; ) {
            if (orderIds[i] == orderId) {
                // Swap with last element and pop
                orderIds[i] = orderIds[len - 1];
                orderIds.pop();
                return;
            }
            unchecked { ++i; }
        }
    }

    function _getPoolKey(PoolKey calldata key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key.truthMarket, key.yesToken, key.noToken));
    }

    function _fill(
        bytes32 marketKey,
        MarketState storage state,
        uint256 sharesToFill,
        uint8 crossedOutcome,
        bool isUp
    ) internal returns (uint256 filled, uint256 cost) {
        uint256 remaining = sharesToFill;
        uint16 tick = state.currentTick;
        uint128 activeLiq = isUp ? state.activeLiquidityNo : state.activeLiquidityYes;

        while (remaining > 0) {
            if (activeLiq == 0) {
                uint16 nextTick;
                if (isUp) {
                    nextTick = _bitmaps[marketKey][crossedOutcome].findNextUp(tick);
                    uint16 absoluteLowest = _bitmaps[marketKey][crossedOutcome].findNextUp(0);
                    if (absoluteLowest < tick && absoluteLowest <= MAX_TICK) {
                        nextTick = absoluteLowest;
                    }
                } else {
                    nextTick = _bitmaps[marketKey][crossedOutcome].findNextDown(tick);
                    uint16 absoluteHighest = _bitmaps[marketKey][crossedOutcome].findNextDown(MAX_TICK + 1);
                    if (absoluteHighest > tick && absoluteHighest <= MAX_TICK) {
                        nextTick = absoluteHighest;
                    }
                }

                if (isUp && nextTick > MAX_TICK) break;
                if (!isUp && (nextTick == 0 || nextTick > MAX_TICK)) break;

                tick = nextTick;
                int128 delta = isUp
                    ? _ticks[marketKey][crossedOutcome][tick].liquidityNet
                    : -_ticks[marketKey][crossedOutcome][tick].liquidityNet;
                activeLiq = _safeAddLiquidity(activeLiq, delta);
                emit TickCrossed(marketKey, tick, delta);
                continue;
            }

            uint16 searchFrom = isUp
                ? (tick == MAX_TICK ? MAX_TICK : tick + 1)
                : (tick == MIN_TICK ? MIN_TICK : tick - 1);
            uint16 nextBoundary = isUp
                ? _bitmaps[marketKey][crossedOutcome].findNextUp(searchFrom)
                : _bitmaps[marketKey][crossedOutcome].findNextDown(searchFrom);

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
                    delta = _ticks[marketKey][crossedOutcome][nextBoundary].liquidityNet;
                    activeLiq = _safeAddLiquidity(activeLiq, delta);
                } else if (!isUp && nextBoundary >= MIN_TICK) {
                    delta = _ticks[marketKey][crossedOutcome][nextBoundary + 1].liquidityNet;
                    activeLiq = _safeAddLiquidity(activeLiq, -delta);
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

    /**
     * @dev Safely add signed delta to unsigned liquidity, clamping to 0 on underflow
     */
    function _safeAddLiquidity(uint128 liq, int128 delta) internal pure returns (uint128) {
        if (delta >= 0) {
            return liq + uint128(delta);
        } else {
            uint128 absDelta = uint128(-delta);
            return liq >= absDelta ? liq - absDelta : 0;
        }
    }

    /**
     * @dev Safely subtract from unsigned liquidity, clamping to 0 on underflow
     * @notice V9.9.6 FIX: Used in _updateActiveLiquidity() and _tryCross()
     */
    function _safeSubLiquidity(uint128 liq, uint128 delta) internal pure returns (uint128) {
        return liq >= delta ? liq - delta : 0;
    }

    /**
     * @dev Safely subtract from _totalLiquidity, clamping to 0 on underflow
     * @notice V9.9.6-fix8: Prevents underflow when orders are removed during crossing
     */
    function _safeSubTotalLiquidity(bytes32 marketKey, uint8 outcome, uint256 delta) internal {
        uint256 current = _totalLiquidity[marketKey][outcome];
        _totalLiquidity[marketKey][outcome] = current >= delta ? current - delta : 0;
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
                    state.activeLiquidityNo = _safeSubLiquidity(state.activeLiquidityNo, liquidityDelta);
                }
            } else {
                if (isAdd) {
                    state.activeLiquidityYes += liquidityDelta;
                } else {
                    state.activeLiquidityYes = _safeSubLiquidity(state.activeLiquidityYes, liquidityDelta);
                }
            }
        }
    }

    /**
     * @notice Try to cross a new order against existing opposite liquidity
     * @dev V9.9.5: Added liquidityRemoved guard for idempotent cleanup
     */
    function _tryCross(
        bytes32 marketKey,
        uint256 newOrderId
    ) internal returns (uint256 crossedShares, uint256 newOrderCost, uint256 oppositeCost) {
        RangeOrder storage newOrder = _orders[marketKey][newOrderId];
        Market memory m = _markets[marketKey];
        MarketState storage state = _state[marketKey];

        uint8 opposite = newOrder.outcome == 0 ? 1 : 0;

        uint256 oppTotalLiq = _totalLiquidity[marketKey][opposite];
        if (oppTotalLiq == 0) return (0, 0, 0);

        uint16 overlapLow;
        uint16 overlapHigh;
        uint16 crossTick;

        // V9.9.6-fix8: Crossing logic - find CHEAPEST counterparty for maximum crossing
        // YES at tick Y = buyer pays Y% for YES  
        // NO at tick N = buyer pays N% for NO = seller accepts (100-N)% for YES
        // Crossing happens when YES buyer price >= YES seller price:
        //   Y% >= (100-N)%  =>  Y + N >= 1000 (using tick scale where 1000 = 100%)
        //
        // KEY INSIGHT: 
        // - For YES orders: find HIGHEST NO tick (cheapest seller, lowest asking price)
        // - For NO orders: find LOWEST YES tick (cheapest buyer for NO = highest YES price)
        // This ensures we cross with the best available prices first.
        
        if (newOrder.outcome == 1) {
            // Placing YES order - find HIGHEST NO tick (cheapest YES seller)
            // Higher NO tick = lower seller asking price = better for buyer
            uint16 highestSell = _bitmaps[marketKey][0].findNextDown(MAX_TICK + 1);
            if (highestSell > MAX_TICK) return (0, 0, 0);
            
            // NO at tick N implies seller wants (1000-N)% for YES
            // Higher N = lower seller price = more likely to cross
            // Crossing when: Y >= 1000-N, i.e., Y + N >= 1000
            // For cheapest seller at highestSell: Y >= 1000-highestSell
            uint16 cheapestSellerPrice = 1000 - highestSell;  // Lowest price any seller will accept
            
            // No crossing if even the cheapest seller wants more than our max
            if (cheapestSellerPrice > newOrder.tickUpper) return (0, 0, 0);
            
            // Overlap: from our tickLower (or cheapest seller price) up to our tickUpper
            overlapLow = cheapestSellerPrice > newOrder.tickLower ? cheapestSellerPrice : newOrder.tickLower;
            overlapHigh = newOrder.tickUpper;
            crossTick = overlapHigh;
        } else {
            // Placing NO order - find LOWEST YES tick (highest YES buyer price = best for NO seller)
            // Lower YES tick = buyer pays less = but still the HIGHEST bidder in the book
            // Wait - for NO seller, we want highest YES buyer (who pays the most)
            uint16 highestBuy = _bitmaps[marketKey][1].findNextDown(MAX_TICK + 1);
            if (highestBuy > MAX_TICK) return (0, 0, 0);
            
            // Our NO order at [tickLower, tickUpper] implies selling YES at prices from
            // (1000-tickUpper)% to (1000-tickLower)%
            // Crossing happens when YES buyer (at tick Y) pays >= our asking price
            // Best YES buyer is at highestBuy
            uint16 ourLowestAsk = 1000 - newOrder.tickUpper;  // Our cheapest selling price
            
            // No crossing if best buyer won't pay our minimum
            if (highestBuy < ourLowestAsk) return (0, 0, 0);
            
            // Overlap in YES price space:
            uint16 ourHighestAsk = 1000 - newOrder.tickLower;
            overlapLow = ourLowestAsk > 0 ? ourLowestAsk : 1;
            overlapHigh = highestBuy < ourHighestAsk ? highestBuy : ourHighestAsk;
            crossTick = overlapLow;
        }

        uint256 overlapTicks = uint256(overlapHigh) - uint256(overlapLow) + 1;
        uint256 newOrderSharesInOverlap = uint256(newOrder.liquidity) * overlapTicks;

        uint256 oppLiqInOverlap = _getOverlappingLiquidity(marketKey, opposite, overlapLow, overlapHigh);

        crossedShares = newOrderSharesInOverlap < oppLiqInOverlap ? newOrderSharesInOverlap : oppLiqInOverlap;
        if (crossedShares == 0) return (0, 0, 0);

        uint256 priceLow = TickMath.tickToProbability(overlapLow);
        uint256 priceHigh = TickMath.tickToProbability(overlapHigh);
        uint256 avgPrice = (priceLow + priceHigh) / 2;

        uint256 yesCost = (avgPrice * crossedShares) / WAD;
        uint256 noCost = crossedShares - yesCost;

        if (newOrder.outcome == 0) {
            newOrderCost = noCost;
            oppositeCost = yesCost;
        } else {
            newOrderCost = yesCost;
            oppositeCost = noCost;
        }

        vault.creditOutcome(m.truthMarket, newOrder.owner, newOrder.outcome, crossedShares);
        newOrder.filledShares += uint128(crossedShares);
        newOrder.collateralUsedWad += uint128(newOrderCost);

        // V9.9.5: Mark fully filled orders as inactive and remove liquidity (with guard)
        // V9.9.6-fix9: Pool refund immediately on completion
        if (newOrder.filledShares >= newOrder.sharesTotal && !newOrder.liquidityRemoved) {
            _updateTickBoundaries(marketKey, newOrder.outcome, newOrder.tickLower, newOrder.tickUpper, -int128(newOrder.liquidity), false);
            _updateActiveLiquidity(marketKey, newOrder.outcome, newOrder.tickLower, newOrder.tickUpper, newOrder.liquidity, false);
            _safeSubTotalLiquidity(marketKey, newOrder.outcome, newOrder.sharesTotal);
            newOrder.liquidityRemoved = true;
            newOrder.active = false;
            // Pool the refund (deposited - used)
            uint256 refund = newOrder.collateralDepositedWad > newOrder.collateralUsedWad 
                ? newOrder.collateralDepositedWad - newOrder.collateralUsedWad : 0;
            if (refund > 0) {
                _pendingRefunds[newOrder.owner][marketKey] += refund;
            }
        }

        // TOB-1 FIX: Use oppLiqInOverlap as denominator instead of oppTotalLiq
        if (oppLiqInOverlap > 0) {
            _fillGrowthGlobalX128[marketKey][opposite] += (crossedShares * Q128) / oppLiqInOverlap;
            _collateralUsedGrowthGlobalX128[marketKey][opposite] += (oppositeCost * Q128) / oppLiqInOverlap;
        }

        uint128 oppActiveLiq = opposite == 0 ? state.activeLiquidityNo : state.activeLiquidityYes;
        uint128 activeFilled = crossedShares < uint256(oppActiveLiq) ? uint128(crossedShares) : oppActiveLiq;
        if (opposite == 0) {
            state.activeLiquidityNo = _safeSubLiquidity(state.activeLiquidityNo, activeFilled);
        } else {
            state.activeLiquidityYes = _safeSubLiquidity(state.activeLiquidityYes, activeFilled);
        }

        uint128 newActiveLiq = newOrder.outcome == 0 ? state.activeLiquidityNo : state.activeLiquidityYes;
        uint128 newFilled = crossedShares < uint256(newActiveLiq) ? uint128(crossedShares) : newActiveLiq;
        if (newOrder.outcome == 0) {
            state.activeLiquidityNo = _safeSubLiquidity(state.activeLiquidityNo, newFilled);
        } else {
            state.activeLiquidityYes = _safeSubLiquidity(state.activeLiquidityYes, newFilled);
        }

        state.currentTick = crossTick;

        emit OrdersCrossed(marketKey, newOrderId, newOrder.outcome, crossedShares, newOrderCost, oppositeCost, crossTick);
    }

    function _getOverlappingLiquidity(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLow,
        uint16 tickHigh
    ) internal view returns (uint256) {
        MarketState memory s = _state[marketKey];
        uint128 activeLiq = outcome == 0 ? s.activeLiquidityNo : s.activeLiquidityYes;

        uint256 totalLiq = _totalLiquidity[marketKey][outcome];
        if (activeLiq > 0) {
            uint256 rangeLiq = uint256(activeLiq) * (uint256(tickHigh) - uint256(tickLow) + 1);
            return rangeLiq > totalLiq ? totalLiq : rangeLiq;
        }

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
        bool isActive
    ) {
        Market memory m = _markets[marketKey];
        return (m.truthMarket, m.yesToken, m.noToken, m.isActive);
    }

    function getPendingFills(bytes32 marketKey, uint256 orderId)
        external
        view
        returns (uint256 pendingShares, uint256 pendingCollateralUsed)
    {
        return _getPendingFillsInternal(marketKey, orderId);
    }

    function _getPendingFillsInternal(bytes32 marketKey, uint256 orderId)
        internal
        view
        returns (uint256 pendingShares, uint256 pendingCollateralUsed)
    {
        RangeOrder memory order = _orders[marketKey][orderId];
        if (!order.active) return (0, 0);

        uint8 out = order.outcome;
        // Note: Don't early-return on totalLiq==0 - pending fills can still exist in accumulator

        uint256 globalFillGrowth = _fillGrowthGlobalX128[marketKey][out];
        uint256 lastFillGrowth = _fillGrowthLastX128[marketKey][orderId];
        if (globalFillGrowth > lastFillGrowth) {
            uint256 delta = globalFillGrowth - lastFillGrowth;
            pendingShares = (delta * order.sharesTotal) / Q128;

            // V9.9.5: Cap pending shares to prevent showing >100% filled
            uint256 maxFillable = order.sharesTotal > order.filledShares
                ? order.sharesTotal - order.filledShares
                : 0;
            if (pendingShares > maxFillable) {
                pendingShares = maxFillable;
            }
        }

        uint256 globalUsedGrowth = _collateralUsedGrowthGlobalX128[marketKey][out];
        uint256 lastUsedGrowth = _collateralUsedGrowthLastX128[marketKey][orderId];
        if (globalUsedGrowth > lastUsedGrowth) {
            uint256 delta = globalUsedGrowth - lastUsedGrowth;
            pendingCollateralUsed = (delta * order.sharesTotal) / Q128;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // V9.9.6-fix4: All Orders Enumeration (for frontend liquidity map)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get the next order ID (for enumeration bounds)
    function getNextOrderId() external view returns (uint256) {
        return _nextOrderId;
    }

    /// @notice Get all active order IDs for a market
    /// @dev Iterates through all order IDs - O(n) where n is total orders created
    /// @param marketKey The market to query
    /// @return orderIds Array of active order IDs
    function getAllMarketOrders(bytes32 marketKey) external view returns (uint256[] memory) {
        uint256 maxId = _nextOrderId;
        
        // Count active orders first (needed to size the array)
        uint256 count = 0;
        for (uint256 i = 1; i < maxId; ) {
            if (_orders[marketKey][i].active) {
                unchecked { ++count; }
            }
            unchecked { ++i; }
        }
        
        // Collect order IDs
        uint256[] memory orderIds = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i < maxId; ) {
            if (_orders[marketKey][i].active) {
                orderIds[idx] = i;
                unchecked { ++idx; }
            }
            unchecked { ++i; }
        }
        return orderIds;
    }
}
