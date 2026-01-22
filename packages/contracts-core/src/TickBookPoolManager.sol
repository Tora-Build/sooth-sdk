// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITickBookVault} from "./interfaces/ITickBookVault.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {IIdentityRegistry, IReputationRegistry} from "./interfaces/IERC8004.sol";
import {IProtocolConfig} from "./interfaces/IProtocolConfig.sol";
import {TickBitmap} from "./libraries/TickBitmap.sol";
import {TickMath} from "./libraries/TickMath.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TickBookPoolManager V10
 * @notice Singleton manager for prediction market orderbooks with unified crossing architecture
 * @dev V10 Changes:
 *      - UNIFIED TICK LIQUIDITY: Single struct holds range + spot liquidity
 *      - UNIFIED CROSSING: `_crossUnified()` fills spot liquidity first (recycle), then range (mint)
 *      - SPOT BITMAPS: Separate bitmap tracks spot liquidity for efficient traversal
 *
 *      Inherited from V9.9.6/7:
 *      - UNIFIED: Single `placeOrder()` for limit, market, and range orders
 *      - AUTO-CLAIM: Claims user's pending fills before placing new order
 *      - SPOT SELL: Sell existing shares via `placeSpotSell`, `cancelSpotSell`
 *      - BATCH CANCEL: Gas-efficient multi-order cancellation
 */
contract TickBookPoolManager is ReentrancyGuard, Ownable {
    using TickBitmap for TickBitmap.Bitmap;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint16 private constant MIN_TICK = 1;
    uint16 private constant MAX_TICK = TickMath.MAX_TICK; // 999
    uint256 private constant Q128 = 2 ** 128;
    uint128 private constant MAX_LIQUIDITY = type(uint128).max;
    uint24 private constant MAX_FEE_BPS = 1000; // 10% max fee
    
    /// @dev RFC-001: Maximum tick range for spot sell orders (gas optimization)
    uint16 private constant MAX_SPOT_RANGE = 50;
    
    /// @dev Dust threshold for auto-closing nearly-filled orders (1000 wei = 1e-15 shares)
    uint256 private constant DUST_THRESHOLD = 1000;

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
    error InsufficientShares();
    error SpotSellNotActive();
    error SpotRangeTooWide();
    error AgentNotRegistered();
    error NotAgentWallet();

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
        bool liquidityRemoved;
        uint128 sharesTotal;
        uint128 liquidity;
        uint128 collateralDepositedWad;
        uint128 filledShares;
        uint128 collateralUsedWad;
    }

    /// @dev V10: Unified tick liquidity - combines range and spot in one struct
    struct TickLiquidity {
        int128 rangeLiquidityNet;     // Range order net liquidity (for crossing)
        uint128 rangeLiquidityGross;  // Range order gross liquidity (for bitmap cleanup)
        uint128 spotLiquidity;        // Spot sell liquidity at this tick
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

    struct SpotSellOrder {
        address owner;
        uint8 outcome;
        uint16 tickLower;
        uint16 tickUpper;
        bool active;
        uint128 sharesTotal;
        uint128 sharesFilled;
        uint128 proceedsWad;
    }

    /// @dev V10: Internal struct for unified crossing results
    struct CrossingResult {
        uint256 totalFilled;
        uint256 spotFilled;
        uint256 rangeFilled;
        uint256 newOrderCost;
        uint256 spotCost;
        uint256 rangeCost;
        uint16 crossTick;
    }

    // ============================================
    // Storage
    // ============================================

    ITickBookVault public immutable vault;
    IProtocolConfig public immutable protocolConfig;

    // Markets (singleton pattern)
    mapping(bytes32 => Market) private _markets;
    mapping(bytes32 => MarketState) private _state;

    /// @dev V10: Unified tick liquidity storage (replaces _ticks + _spotSellLiquidity)
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => TickLiquidity))) private _tickLiquidity;
    
    /// @dev Range order bitmaps (existing)
    mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _bitmaps;
    
    /// @dev V10: Separate bitmap for spot liquidity
    mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _spotBitmaps;

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

    // Pooled refunds for completed orders (O(1) claim)
    mapping(address => mapping(bytes32 => uint256)) private _pendingRefunds;

    // Spot Sell Orders
    mapping(bytes32 => mapping(uint256 => SpotSellOrder)) private _spotSellOrders;
    mapping(bytes32 => mapping(address => uint256[])) private _userSpotSells;
    uint256 private _nextSpotSellId;
    
    /// @dev RFC-001: Tick-indexed spot sell IDs for O(overlap) fill instead of O(N)
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint256[]))) private _spotSellIdsAtTick;

    // Access control
    address public registrar;
    address public feeRecipient;

    // Simple fee storage
    uint24 public takerFeeBps = 10;  // 0.1% default
    uint24 public makerFeeBps = 0;   // No maker fee by default

    // ============================================
    // V11: ERC-8004 Agent Integration
    // ============================================

    /// @notice ERC-8004 Identity Registry (optional)
    IIdentityRegistry public identityRegistry;

    /// @notice ERC-8004 Reputation Registry (optional)
    IReputationRegistry public reputationRegistry;

    /// @notice Reputation score thresholds for fee discounts
    uint8[] public reputationThresholds;
    uint16[] public reputationDiscountBps;

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

    event RangeOrderClosed(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed orderId
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

    /// @dev V10: Enhanced crossing event with source breakdown
    event UnifiedCrossing(
        bytes32 indexed marketKey,
        uint256 indexed newOrderId,
        uint8 newOutcome,
        uint256 spotFilled,
        uint256 rangeFilled,
        uint256 spotCost,
        uint256 rangeCost,
        uint16 crossTick
    );

    event FillsClaimed(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed orderId,
        uint256 filledShares,
        uint256 collateralUsedWad
    );

    event PooledRefundsClaimed(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 refund
    );

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

    event SpotSellPlaced(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed sellId,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 shares
    );

    event SpotSellCancelled(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed sellId,
        uint256 sharesReturned
    );

    event SpotSellFilled(
        bytes32 indexed marketKey,
        uint256 indexed sellId,
        uint256 sharesFilled,
        uint256 proceeds
    );

    event SpotSellClosed(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed sellId
    );

    event UserOrderRemoved(bytes32 indexed marketKey, address indexed user, uint256 orderId);
    event UserSpotSellRemoved(bytes32 indexed marketKey, address indexed user, uint256 sellId);
    event SpotSellIdRemovedAtTick(bytes32 indexed marketKey, uint8 outcome, uint16 tick, uint256 sellId);
    event TotalLiquidityReduced(bytes32 indexed marketKey, uint8 outcome, uint256 previousTotal, uint256 newTotal);
    event ActiveLiquidityUpdated(bytes32 indexed marketKey, uint8 outcome, uint128 previousActive, uint128 newActive);
    event PendingRefundsCleared(address indexed user, bytes32 indexed marketKey, uint256 amount);

    // V11 Events
    event AgentOrderPlaced(
        address indexed wallet,
        bytes32 indexed marketKey,
        uint256 indexed orderId,
        uint256 agentId,
        uint8 outcome,
        uint256 shares,
        uint256 filledShares
    );
    event ReputationRegistriesSet(address identityRegistry, address reputationRegistry);

    // ============================================
    // Modifiers
    // ============================================

    modifier onlyRegistrar() {
        _onlyRegistrar();
        _;
    }

    function _onlyRegistrar() internal view {
        if (msg.sender != registrar && msg.sender != owner()) revert UnauthorizedRegistrar();
    }

    // ============================================
    // Constructor
    // ============================================

    constructor(address _vault, address _protocolConfig) Ownable(msg.sender) {
        if (_vault == address(0)) revert ZeroAddress();
        if (_protocolConfig == address(0)) revert ZeroAddress();
        vault = ITickBookVault(_vault);
        protocolConfig = IProtocolConfig(_protocolConfig);
    }

    modifier whenNotPaused() {
        require(!protocolConfig.isPaused(), "TickBook: paused");
        _;
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

    function clearDustLiquidity(
        bytes32 marketKey,
        uint8 outcome,
        uint16[] calldata ticks
    ) external onlyOwner {
        for (uint256 i = 0; i < ticks.length; ) {
            uint16 t = ticks[i];
            TickLiquidity storage tick = _tickLiquidity[marketKey][outcome][t];
            tick.spotLiquidity = 0;
            _spotBitmaps[marketKey][outcome].clearBit(t);
            unchecked { ++i; }
        }
    }

    /**
     * @notice Set ERC-8004 registries for agent integration
     * @param _identityRegistry Identity registry address (or address(0) to disable)
     * @param _reputationRegistry Reputation registry address (or address(0) to disable)
     */
    function setReputationRegistries(
        address _identityRegistry,
        address _reputationRegistry
    ) external onlyOwner {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        reputationRegistry = IReputationRegistry(_reputationRegistry);
        emit ReputationRegistriesSet(_identityRegistry, _reputationRegistry);
    }

    /**
     * @notice Set reputation-based fee discounts (reserved for future TickBook fees)
     * @param thresholds Reputation score thresholds (ascending order)
     * @param discountBps Discount in basis points for each threshold
     */
    function setReputationDiscounts(
        uint8[] calldata thresholds,
        uint16[] calldata discountBps
    ) external onlyOwner {
        require(thresholds.length == discountBps.length, "length mismatch");
        reputationThresholds = thresholds;
        reputationDiscountBps = discountBps;
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
    // Unified Order Placement (V10)
    // ============================================

    /**
     * @notice Place an order - unified API for limit, market, and range orders
     * @dev V10: Uses `_crossUnified()` which fills spot liquidity FIRST, then range
     *
     *      Order type is determined by tick range:
     *      - Market order: tickLower=1, tickUpper=999 (fill everything)
     *      - Limit order: tickLower=X, tickUpper=X (single tick)
     *      - Range order: tickLower < tickUpper (spread liquidity)
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
    ) external nonReentrant whenNotPaused returns (
        uint256 orderId,
        uint256 filledShares,
        uint256 filledCost,
        uint256 restingShares
    ) {
        return _placeOrderInternal(marketKey, outcome, shares, tickLower, tickUpper, maxCost, msg.sender, 0);
    }

    /**
     * @notice Place an order with EIP-2612 permit for gasless approval
     * @dev V11: Allows users to sign approval off-chain
     * @param marketKey The market identifier
     * @param outcome 0 = NO, 1 = YES
     * @param shares Total shares to place
     * @param tickLower Lower tick bound
     * @param tickUpper Upper tick bound
     * @param maxCost Maximum cost willing to pay
     * @param permitDeadline Permit signature deadline
     * @param v Permit signature v
     * @param r Permit signature r
     * @param s Permit signature s
     */
    function placeOrderWithPermit(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 maxCost,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused returns (
        uint256 orderId,
        uint256 filledShares,
        uint256 filledCost,
        uint256 restingShares
    ) {
        // Execute permit on vault's USDC
        IERC20Permit(address(vault.usdc())).permit(msg.sender, address(vault), maxCost, permitDeadline, v, r, s);

        // Forward to regular placeOrder
        return _placeOrderInternal(marketKey, outcome, shares, tickLower, tickUpper, maxCost, msg.sender, 0);
    }

    /**
     * @notice Place an order with agent attribution
     * @dev V11: For ERC-8004 registered agents (discounts reserved for future fees)
     * @param marketKey The market identifier
     * @param outcome 0 = NO, 1 = YES
     * @param shares Total shares to place
     * @param tickLower Lower tick bound
     * @param tickUpper Upper tick bound
     * @param maxCost Maximum cost willing to pay
     * @param agentId The ERC-8004 agent ID
     */
    function placeOrderWithAgent(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 maxCost,
        uint256 agentId
    ) external nonReentrant whenNotPaused returns (
        uint256 orderId,
        uint256 filledShares,
        uint256 filledCost,
        uint256 restingShares
    ) {
        // Verify agent ownership
        if (address(identityRegistry) == address(0)) revert AgentNotRegistered();
        address agentWallet = identityRegistry.getAgentWallet(agentId);
        if (agentWallet != msg.sender) revert NotAgentWallet();

        return _placeOrderInternal(marketKey, outcome, shares, tickLower, tickUpper, maxCost, msg.sender, agentId);
    }

    /**
     * @dev Internal order placement logic (shared by placeOrder, placeOrderWithPermit, placeOrderWithAgent)
     */
    function _placeOrderInternal(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 maxCost,
        address trader,
        uint256 agentId
    ) internal returns (
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

        // Auto-claim ONLY 100% filled orders (max 20 for gas safety)
        _autoClaimUserOrders(marketKey, trader);

        // Also auto-release pooled refunds to available balance
        uint256 pooled = _pendingRefunds[trader][marketKey];
        if (pooled > 0) {
            _pendingRefunds[trader][marketKey] = 0;
            vault.refundMarketToAvailable(m.truthMarket, trader, pooled);
            emit PendingRefundsCleared(trader, marketKey, pooled);
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
            owner: trader,
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
        _userOrders[marketKey][trader].push(orderId);

        _fillGrowthLastX128[marketKey][orderId] = _fillGrowthGlobalX128[marketKey][outcome];
        _collateralUsedGrowthLastX128[marketKey][orderId] = _collateralUsedGrowthGlobalX128[marketKey][outcome];

        _totalLiquidity[marketKey][outcome] += shares;
        _updateTickBoundaries(marketKey, outcome, tickLower, tickUpper, int128(uint128(density)), true);
        _updateActiveLiquidity(marketKey, outcome, tickLower, tickUpper, uint128(density), true);

        vault.spendAvailableToMarket(trader, m.truthMarket, collateral);

        // Emit appropriate event
        if (agentId > 0) {
            emit AgentOrderPlaced(trader, marketKey, orderId, agentId, outcome, shares, 0);
        }
        emit OrderPlaced(
            trader, marketKey, orderId, outcome, tickLower, tickUpper,
            shares, 0, 0, shares
        );

        // V10: Try unified crossing (spot first, then range)
        CrossingResult memory result = _crossUnified(marketKey, orderId);
        filledShares = result.totalFilled;
        filledCost = result.newOrderCost;
        restingShares = shares - filledShares;
    }

    function _autoClaimUserOrders(bytes32 marketKey, address user)
        internal
        returns (uint256 totalClaimedShares, uint256 totalCollateralUsed)
    {
        uint256[] storage orderIds = _userOrders[marketKey][user];
        if (orderIds.length == 0) return (0, 0);
        
        uint256 ordersProcessed = 0;
        uint256 maxProcess = 20;

        uint256 i = orderIds.length;
        while (i > 0 && ordersProcessed < maxProcess) {
            unchecked { --i; }
            uint256 orderId = orderIds[i];
            RangeOrder storage order = _orders[marketKey][orderId];
            
            if (!order.active) {
                ordersProcessed++;
                continue;
            }
            
            (uint256 pendingShares, ) = _getPendingFillsInternal(marketKey, orderId);

            uint256 totalFilled = uint256(order.filledShares) + pendingShares;
            uint256 capped = totalFilled > uint256(order.sharesTotal) ? uint256(order.sharesTotal) : totalFilled;
            uint256 unfilled = uint256(order.sharesTotal) > capped ? uint256(order.sharesTotal) - capped : 0;

            if (unfilled < DUST_THRESHOLD) {
                (uint256 filled, uint256 used) = _claimInternal(marketKey, orderId);
                totalClaimedShares += filled;
                totalCollateralUsed += used;
            }
            ordersProcessed++;
        }

        if (totalClaimedShares > 0) {
            emit AutoClaimExecuted(user, marketKey, ordersProcessed, totalClaimedShares, totalCollateralUsed);
        }
    }

    function cancelOrder(bytes32 marketKey, uint256 orderId) external nonReentrant returns (uint256 collateralReleased) {
        return _cancelInternal(marketKey, orderId);
    }

    function batchCancelOrders(bytes32 marketKey, uint256[] calldata orderIds)
        external
        nonReentrant
        returns (uint256 totalCollateralReleased)
    {
        for (uint256 i = 0; i < orderIds.length;) {
            totalCollateralReleased += _cancelInternal(marketKey, orderIds[i]);
            unchecked { ++i; }
        }
    }

    function _cancelInternal(bytes32 marketKey, uint256 orderId) internal returns (uint256 collateralReleased) {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (!order.active) revert OrderNotActive();
        if (order.owner != msg.sender) revert NotOwner();

        Market memory m = _markets[marketKey];

        _claimInternal(marketKey, orderId);

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
        nonReentrant
        returns (uint256 filledShares, uint256 collateralUsedWad)
    {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (order.owner != msg.sender) revert NotOwner();
        return _claimInternal(marketKey, orderId);
    }

    function claimFillsFor(bytes32 marketKey, uint256 orderId)
        external
        nonReentrant
        returns (uint256 filledShares, uint256 collateralUsedWad)
    {
        return _claimInternal(marketKey, orderId);
    }

    function batchClaimFills(bytes32 marketKey, uint256[] calldata orderIds)
        external
        nonReentrant
        returns (uint256 totalFilledShares, uint256 totalCollateralUsed)
    {
        for (uint256 i = 0; i < orderIds.length;) {
            (uint256 filled, uint256 used) = _claimInternal(marketKey, orderIds[i]);
            totalFilledShares += filled;
            totalCollateralUsed += used;
            unchecked { ++i; }
        }
    }

    function claimPooledRefunds(bytes32 marketKey) external nonReentrant returns (uint256 refund) {
        refund = _pendingRefunds[msg.sender][marketKey];
        if (refund > 0) {
            _pendingRefunds[msg.sender][marketKey] = 0;
            Market memory m = _markets[marketKey];
            vault.refundMarketToAvailable(m.truthMarket, msg.sender, refund);
            emit PooledRefundsClaimed(msg.sender, marketKey, refund);
        }
    }

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

        uint256 unfilled = order.sharesTotal > order.filledShares ? order.sharesTotal - order.filledShares : 0;
        bool shouldRemoveLiquidity = unfilled < DUST_THRESHOLD;

        if (shouldRemoveLiquidity && !order.liquidityRemoved) {
            _updateTickBoundaries(marketKey, order.outcome, order.tickLower, order.tickUpper, -int128(order.liquidity), false);
            _updateActiveLiquidity(marketKey, order.outcome, order.tickLower, order.tickUpper, order.liquidity, false);
            _safeSubTotalLiquidity(marketKey, order.outcome, order.sharesTotal);
            order.liquidityRemoved = true;

            uint256 refund = order.collateralDepositedWad > order.collateralUsedWad
                ? order.collateralDepositedWad - order.collateralUsedWad
                : 0;

            if (refund > 0) {
                order.collateralDepositedWad = order.collateralUsedWad;
                vault.refundMarketToAvailable(m.truthMarket, owner, refund);
            }
        }

        emit FillsClaimed(owner, marketKey, orderId, filledShares, collateralUsedWad);

        if (shouldRemoveLiquidity) {
            _closeRangeOrder(marketKey, orderId);
        }
    }

    // ============================================
    // Spot Sell Orders
    // ============================================

    /**
     * @notice Place a spot sell order - sell shares you already own
     * @dev V10: Uses unified tick liquidity storage
     * @param marketKey The market identifier
     * @param outcome Which token to sell (0=NO, 1=YES)
     * @param shares Amount of shares to sell
     * @param tickLower Lower tick bound (ask price range start)
     * @param tickUpper Upper tick bound (ask price range end)
     * @return sellId The created spot sell order ID
     */
    function placeSpotSell(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint16 tickLower,
        uint16 tickUpper
    ) external nonReentrant whenNotPaused returns (uint256 sellId) {
        Market memory m = _markets[marketKey];
        if (!m.isActive) revert MarketNotActive();
        if (!ITruthMarket(m.truthMarket).isLive()) revert MarketNotLive();
        if (outcome > 1) revert InvalidOutcome();
        if (shares == 0) revert ZeroAmount();
        if (tickLower < MIN_TICK || tickUpper > MAX_TICK) revert InvalidTickRange();
        if (tickLower > tickUpper) revert InvalidTickRange();
        if (shares > MAX_LIQUIDITY) revert LiquidityOverflow();
        
        // RFC-001: Enforce max spot sell range to bound placement gas costs
        if (tickUpper - tickLower + 1 > MAX_SPOT_RANGE) revert SpotRangeTooWide();

        // Lock the shares in the vault (will revert if insufficient)
        vault.lockOutcome(m.truthMarket, msg.sender, outcome, shares);

        sellId = ++_nextSpotSellId;

        uint256 ticksInRange = uint256(tickUpper) - uint256(tickLower) + 1;
        uint128 density = uint128(shares / ticksInRange);

        _spotSellOrders[marketKey][sellId] = SpotSellOrder({
            owner: msg.sender,
            outcome: outcome,
            tickLower: tickLower,
            tickUpper: tickUpper,
            active: true,
            sharesTotal: uint128(shares),
            sharesFilled: 0,
            proceedsWad: 0
        });
        _userSpotSells[marketKey][msg.sender].push(sellId);

        // V10: Add spot liquidity to unified tick storage + spot bitmap
        // RFC-001: Also index sellId at each tick for O(overlap) fill
        for (uint16 t = tickLower; t <= tickUpper; t++) {
            _tickLiquidity[marketKey][outcome][t].spotLiquidity += density;
            _spotSellIdsAtTick[marketKey][outcome][t].push(sellId);  // RFC-001
            // Set spot bitmap bit if this is first liquidity at tick
            if (_tickLiquidity[marketKey][outcome][t].spotLiquidity == density) {
                _spotBitmaps[marketKey][outcome].setBit(t);
            }
        }

        emit SpotSellPlaced(msg.sender, marketKey, sellId, outcome, tickLower, tickUpper, shares);
    }

    function cancelSpotSell(bytes32 marketKey, uint256 sellId)
        external
        nonReentrant
        returns (uint256 sharesReturned)
    {
        SpotSellOrder storage order = _spotSellOrders[marketKey][sellId];
        if (!order.active) revert SpotSellNotActive();
        if (order.owner != msg.sender) revert NotOwner();

        Market memory m = _markets[marketKey];

        sharesReturned = order.sharesTotal - order.sharesFilled;

        // V10.9: Calculate density from UNFILLED shares only (fixes dust bug)
        // The original placement distributed (sharesTotal / ticksInRange) per tick.
        // Each fill reduced by (fillAmount / ticksInRange). On cancel, we remove
        // liquidity proportional to the remaining unfilled shares.
        uint256 ticksInRange = uint256(order.tickUpper) - uint256(order.tickLower) + 1;
        uint256 unfilledShares = order.sharesTotal - order.sharesFilled;
        uint128 density = uint128(unfilledShares / ticksInRange);
        for (uint16 t = order.tickLower; t <= order.tickUpper; t++) {
            TickLiquidity storage tick = _tickLiquidity[marketKey][order.outcome][t];
            if (tick.spotLiquidity >= density) {
                tick.spotLiquidity -= density;
            } else {
                tick.spotLiquidity = 0;
            }
            if (tick.spotLiquidity == 0) {
                _spotBitmaps[marketKey][order.outcome].clearBit(t);
            }
            _removeFromSpotSellIdsAtTick(marketKey, order.outcome, t, sellId);
        }

        order.active = false;
        _removeFromUserSpotSells(marketKey, msg.sender, sellId);

        if (sharesReturned > 0) {
            vault.unlockOutcome(m.truthMarket, msg.sender, order.outcome, sharesReturned);
        }

        uint256 proceeds = order.proceedsWad;
        order.proceedsWad = 0;
        if (proceeds > 0) {
            vault.creditUsdcAvailable(msg.sender, proceeds);
        }

        emit SpotSellCancelled(msg.sender, marketKey, sellId, sharesReturned);
    }

    function claimSpotSellProceeds(bytes32 marketKey, uint256 sellId)
        external
        nonReentrant
        returns (uint256 proceeds)
    {
        SpotSellOrder storage order = _spotSellOrders[marketKey][sellId];
        if (order.owner != msg.sender) revert NotOwner();

        proceeds = order.proceedsWad;
        order.proceedsWad = 0;

        if (proceeds > 0) {
            vault.creditUsdcAvailable(msg.sender, proceeds);
        }

        if (order.sharesFilled >= order.sharesTotal) {
            order.active = false;
            _removeFromUserSpotSells(marketKey, msg.sender, sellId);
        }
    }

    /// @notice Permissionless claim of spot sell proceeds (for keeper bots)
    /// @dev Credits proceeds to order.owner, not msg.sender
    /// @param marketKey The market key
    /// @param sellId The spot sell order ID
    /// @return proceeds Amount of USDC credited to owner
    function claimSpotSellProceedsFor(bytes32 marketKey, uint256 sellId)
        external
        nonReentrant
        returns (uint256 proceeds)
    {
        SpotSellOrder storage order = _spotSellOrders[marketKey][sellId];
        address owner = order.owner;

        proceeds = order.proceedsWad;
        order.proceedsWad = 0;

        if (proceeds > 0) {
            vault.creditUsdcAvailable(owner, proceeds);
        }

        if (order.sharesFilled >= order.sharesTotal) {
            order.active = false;
            _removeFromUserSpotSells(marketKey, owner, sellId);
        }
    }

    /// @notice Batch claim spot sell proceeds (for keeper bots)
    /// @param marketKey The market key
    /// @param sellIds Array of spot sell order IDs
    /// @return totalProceeds Total USDC credited across all orders
    function batchClaimSpotSellProceedsFor(bytes32 marketKey, uint256[] calldata sellIds)
        external
        nonReentrant
        returns (uint256 totalProceeds)
    {
        for (uint256 i = 0; i < sellIds.length;) {
            SpotSellOrder storage order = _spotSellOrders[marketKey][sellIds[i]];
            address owner = order.owner;

            uint256 proceeds = order.proceedsWad;
            order.proceedsWad = 0;

            if (proceeds > 0) {
                vault.creditUsdcAvailable(owner, proceeds);
                totalProceeds += proceeds;
            }

            if (order.sharesFilled >= order.sharesTotal) {
                order.active = false;
                _removeFromUserSpotSells(marketKey, owner, sellIds[i]);
            }

            unchecked { ++i; }
        }
    }

    function getSpotSellOrder(bytes32 marketKey, uint256 sellId)
        external
        view
        returns (SpotSellOrder memory)
    {
        return _spotSellOrders[marketKey][sellId];
    }

    function getUserSpotSells(bytes32 marketKey, address user)
        external
        view
        returns (uint256[] memory)
    {
        return _userSpotSells[marketKey][user];
    }

    /// @dev V10: Get spot sell liquidity at a tick from unified storage
    function getSpotSellLiquidity(bytes32 marketKey, uint8 outcome, uint16 tick)
        external
        view
        returns (uint128)
    {
        return _tickLiquidity[marketKey][outcome][tick].spotLiquidity;
    }



    function _removeFromUserSpotSells(bytes32 marketKey, address user, uint256 sellId) internal {
        bool removed = _removeFromArray(_userSpotSells[marketKey][user], sellId);
        if (removed) {
            emit UserSpotSellRemoved(marketKey, user, sellId);
        }
    }

    function _removeFromSpotSellIdsAtTick(bytes32 marketKey, uint8 outcome, uint16 tick, uint256 sellId) internal {
        bool removed = _removeFromArray(_spotSellIdsAtTick[marketKey][outcome][tick], sellId);
        if (removed) {
            emit SpotSellIdRemovedAtTick(marketKey, outcome, tick, sellId);
        }
    }

    /// @dev RFC-001: Remove sellId from all ticks in its range
    function _removeSpotSellFromAllTicks(bytes32 marketKey, uint8 outcome, uint16 tickLower, uint16 tickUpper, uint256 sellId) internal {
        for (uint16 t = tickLower; t <= tickUpper; t++) {
            _removeFromSpotSellIdsAtTick(marketKey, outcome, t, sellId);
        }
    }

    // ============================================
    // Internal Helpers
    // ============================================

    /// @dev Generic swap-and-pop removal from uint256 array (O(n) search, O(1) removal)
    function _removeFromArray(uint256[] storage arr, uint256 value) internal returns (bool removed) {
        uint256 len = arr.length;
        for (uint256 i = 0; i < len; ) {
            if (arr[i] == value) {
                arr[i] = arr[len - 1];
                arr.pop();
                return true;
            }
            unchecked { ++i; }
        }
        return false;
    }

    function _removeFromUserOrders(bytes32 marketKey, address user, uint256 orderId) internal {
        bool removed = _removeFromArray(_userOrders[marketKey][user], orderId);
        if (removed) {
            emit UserOrderRemoved(marketKey, user, orderId);
        }
    }

    function _freezeRangeOrderGrowth(bytes32 marketKey, uint256 orderId, uint8 outcome) internal {
        _fillGrowthLastX128[marketKey][orderId] = _fillGrowthGlobalX128[marketKey][outcome];
        _collateralUsedGrowthLastX128[marketKey][orderId] = _collateralUsedGrowthGlobalX128[marketKey][outcome];
    }

    function _closeRangeOrder(bytes32 marketKey, uint256 orderId) internal {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (!order.active) return;

        address owner = order.owner;
        uint8 outcome = order.outcome;

        order.active = false;
        _removeFromUserOrders(marketKey, owner, orderId);
        _freezeRangeOrderGrowth(marketKey, orderId, outcome);

        emit RangeOrderClosed(owner, marketKey, orderId);
    }

    function _getPoolKey(PoolKey calldata key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key.truthMarket, key.yesToken, key.noToken));
    }

    function _safeAddLiquidity(uint128 liq, int128 delta) internal pure returns (uint128) {
        if (delta >= 0) {
            return liq + uint128(delta);
        } else {
            uint128 absDelta = uint128(-delta);
            return liq >= absDelta ? liq - absDelta : 0;
        }
    }

    function _safeSubLiquidity(uint128 liq, uint128 delta) internal pure returns (uint128) {
        return liq >= delta ? liq - delta : 0;
    }

    function _safeSubTotalLiquidity(bytes32 marketKey, uint8 outcome, uint256 delta) internal {
        uint256 current = _totalLiquidity[marketKey][outcome];
        uint256 newTotal = current >= delta ? current - delta : 0;
        _totalLiquidity[marketKey][outcome] = newTotal;
        emit TotalLiquidityReduced(marketKey, outcome, current, newTotal);
    }

    /// @dev Safely subtract from active liquidity for a given outcome
    function _safeSubActiveLiquidity(bytes32 marketKey, MarketState storage state, uint8 outcome, uint128 delta) internal {
        if (outcome == 0) {
            uint128 previous = state.activeLiquidityNo;
            uint128 nextValue = _safeSubLiquidity(previous, delta);
            state.activeLiquidityNo = nextValue;
            emit ActiveLiquidityUpdated(marketKey, outcome, previous, nextValue);
        } else {
            uint128 previous = state.activeLiquidityYes;
            uint128 nextValue = _safeSubLiquidity(previous, delta);
            state.activeLiquidityYes = nextValue;
            emit ActiveLiquidityUpdated(marketKey, outcome, previous, nextValue);
        }
    }

    /// @dev Get active liquidity for a given outcome
    function _getActiveLiquidity(MarketState storage state, uint8 outcome) internal view returns (uint128) {
        return outcome == 0 ? state.activeLiquidityNo : state.activeLiquidityYes;
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
            _tickLiquidity[marketKey][outcome][tickLower].rangeLiquidityNet += liquidityDelta;
            _tickLiquidity[marketKey][outcome][tickLower].rangeLiquidityGross += uint128(liquidityDelta);

            uint16 upperBoundary = tickUpper + 1;
            _tickLiquidity[marketKey][outcome][upperBoundary].rangeLiquidityNet -= liquidityDelta;
            _tickLiquidity[marketKey][outcome][upperBoundary].rangeLiquidityGross += uint128(liquidityDelta);

            _bitmaps[marketKey][outcome].setBit(tickLower);
            if (upperBoundary <= MAX_TICK) {
                _bitmaps[marketKey][outcome].setBit(upperBoundary);
            } else if (tickUpper == MAX_TICK && tickLower < MAX_TICK) {
                // MAX_TICK edge: upper boundary (tickUpper + 1) is out of bitmap range.
                // Track a sentinel boundary at MAX_TICK so overlap discovery can still "see" liquidity
                // that extends to the top tick.
                _tickLiquidity[marketKey][outcome][MAX_TICK].rangeLiquidityGross += uint128(liquidityDelta);
                _bitmaps[marketKey][outcome].setBit(MAX_TICK);
            }
        } else {
            _tickLiquidity[marketKey][outcome][tickLower].rangeLiquidityNet += liquidityDelta;
            _tickLiquidity[marketKey][outcome][tickLower].rangeLiquidityGross -= uint128(-liquidityDelta);

            uint16 upperBoundary = tickUpper + 1;
            _tickLiquidity[marketKey][outcome][upperBoundary].rangeLiquidityNet -= liquidityDelta;
            _tickLiquidity[marketKey][outcome][upperBoundary].rangeLiquidityGross -= uint128(-liquidityDelta);

            if (_tickLiquidity[marketKey][outcome][tickLower].rangeLiquidityGross == 0) {
                _bitmaps[marketKey][outcome].clearBit(tickLower);
            }
            if (upperBoundary <= MAX_TICK && _tickLiquidity[marketKey][outcome][upperBoundary].rangeLiquidityGross == 0) {
                _bitmaps[marketKey][outcome].clearBit(upperBoundary);
            } else if (tickUpper == MAX_TICK && tickLower < MAX_TICK) {
                _tickLiquidity[marketKey][outcome][MAX_TICK].rangeLiquidityGross -= uint128(-liquidityDelta);
                if (_tickLiquidity[marketKey][outcome][MAX_TICK].rangeLiquidityGross == 0) {
                    _bitmaps[marketKey][outcome].clearBit(MAX_TICK);
                }
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
            if (isAdd) {
                if (outcome == 0) {
                    uint128 previous = state.activeLiquidityNo;
                    uint128 nextValue = previous + liquidityDelta;
                    state.activeLiquidityNo = nextValue;
                    emit ActiveLiquidityUpdated(marketKey, outcome, previous, nextValue);
                } else {
                    uint128 previous = state.activeLiquidityYes;
                    uint128 nextValue = previous + liquidityDelta;
                    state.activeLiquidityYes = nextValue;
                    emit ActiveLiquidityUpdated(marketKey, outcome, previous, nextValue);
                }
            } else {
                _safeSubActiveLiquidity(marketKey, state, outcome, liquidityDelta);
            }
        }
    }

    // ============================================
    // V10: Unified Crossing Logic
    // ============================================

    /**
     * @notice V10: Unified crossing - fills spot liquidity FIRST, then range
     * @dev Traverses ticks checking BOTH range and spot liquidity:
     *      1. Fills spot liquidity FIRST (recycles existing tokens - no minting)
     *      2. Then fills range liquidity (mints synthetic tokens)
     *      3. Branches settlement by source type
     *
     * @param marketKey The market identifier
     * @param newOrderId The new order attempting to cross
     * @return result Crossing result with spot/range breakdown
     */
    function _crossUnified(
        bytes32 marketKey,
        uint256 newOrderId
    ) internal returns (CrossingResult memory result) {
        RangeOrder storage newOrder = _orders[marketKey][newOrderId];
        Market memory m = _markets[marketKey];
        MarketState storage state = _state[marketKey];

        uint8 opposite = newOrder.outcome == 0 ? 1 : 0;

        // Check if there's any liquidity to cross against
        // Range liquidity is from opposite outcome, spot liquidity is from same outcome
        uint256 oppTotalLiq = _totalLiquidity[marketKey][opposite];
        bool hasSpotLiq = _hasSpotLiquidity(marketKey, newOrder.outcome, newOrder.tickLower, newOrder.tickUpper);
        
        if (oppTotalLiq == 0 && !hasSpotLiq) return result;

        // Calculate overlap range
        (uint16 overlapLow, uint16 overlapHigh, bool hasOverlap) = _calculateOverlap(
            marketKey, newOrder.outcome, newOrder.tickLower, newOrder.tickUpper
        );
        if (!hasOverlap) return result;

        uint256 overlapTicks = uint256(overlapHigh) - uint256(overlapLow) + 1;
        uint256 newOrderSharesInOverlap = uint256(newOrder.liquidity) * overlapTicks;

        // Calculate average price for cost computation
        uint256 priceLow = TickMath.tickToProbability(overlapLow);
        uint256 priceHigh = TickMath.tickToProbability(overlapHigh);
        uint256 avgPrice = (priceLow + priceHigh) / 2;

        // PHASE 1: Fill spot liquidity FIRST (recycle existing tokens)
        // Note: For spot sells, we want the SAME outcome as buyer (buyer wants YES, needs YES spot sells)
        // V10.5: Pass buyer's FULL tick range for spot fills, not just the overlap
        // Spot sells should be filled at ANY price the buyer is willing to accept
        // The overlap range is only relevant for range-vs-range crossing
        uint16 buyerYesLow;
        uint16 buyerYesHigh;
        if (newOrder.outcome == 1) {
            // YES buyer: their ticks are already in YES space
            buyerYesLow = newOrder.tickLower;
            buyerYesHigh = newOrder.tickUpper;
        } else {
            // NO buyer: convert their NO ticks to YES-equivalent for consistent interface
            // NO tick 1-500 means willing to pay 0.1%-50% for NO = accepting 50%-99.9% YES
            buyerYesLow = MAX_TICK + 1 - newOrder.tickUpper;  // 1000 - 500 = 500
            buyerYesHigh = MAX_TICK + 1 - newOrder.tickLower; // 1000 - 1 = 999
        }
        
        result.spotFilled = _fillSpotLiquidity(
            marketKey, m, newOrder.owner, newOrder.outcome, newOrder.outcome, buyerYesLow, buyerYesHigh, newOrderSharesInOverlap
        );
        
        if (result.spotFilled > 0) {
            result.spotCost = _calculateCostForOutcome(newOrder.outcome, result.spotFilled, avgPrice);
        }

        uint256 remainingToFill = newOrderSharesInOverlap - result.spotFilled;

        // PHASE 2: Fill range liquidity (mint synthetic tokens)
        if (remainingToFill > 0) {
            uint256 oppLiqInOverlap = _getOverlappingLiquidity(marketKey, opposite, overlapLow, overlapHigh);
            result.rangeFilled = remainingToFill < oppLiqInOverlap ? remainingToFill : oppLiqInOverlap;
            
            if (result.rangeFilled > 0) {
                result.rangeCost = _calculateCostForOutcome(newOrder.outcome, result.rangeFilled, avgPrice);
                
                // Credit minted shares to new order owner
                vault.creditOutcome(m.truthMarket, newOrder.owner, newOrder.outcome, result.rangeFilled);
                
                // V9.9.8-fix: Use oppTotalLiq as denominator for correct pro-rata distribution
                // Using oppLiqInOverlap caused over-crediting when overlap was small subset of total liquidity
                if (oppTotalLiq > 0) {
                    uint256 oppositeCost = _calculateCostForOutcome(opposite, result.rangeFilled, avgPrice);
                    _fillGrowthGlobalX128[marketKey][opposite] += (result.rangeFilled * Q128) / oppTotalLiq;
                    _collateralUsedGrowthGlobalX128[marketKey][opposite] += (oppositeCost * Q128) / oppTotalLiq;
                }
            }
        }

        // Compute totals
        result.totalFilled = result.spotFilled + result.rangeFilled;
        result.newOrderCost = result.spotCost + result.rangeCost;

        if (result.totalFilled == 0) return result;

        // Update new order state
        newOrder.filledShares += uint128(result.totalFilled);
        newOrder.collateralUsedWad += uint128(result.newOrderCost);

        // Check if new order is effectively filled (dust or 100%)
        uint256 newUnfilled = newOrder.sharesTotal > newOrder.filledShares ? newOrder.sharesTotal - newOrder.filledShares : 0;
        bool shouldRemoveLiquidity = newUnfilled < DUST_THRESHOLD;

        if (shouldRemoveLiquidity && !newOrder.liquidityRemoved) {
            _updateTickBoundaries(marketKey, newOrder.outcome, newOrder.tickLower, newOrder.tickUpper, -int128(newOrder.liquidity), false);
            _updateActiveLiquidity(marketKey, newOrder.outcome, newOrder.tickLower, newOrder.tickUpper, newOrder.liquidity, false);
            _safeSubTotalLiquidity(marketKey, newOrder.outcome, newOrder.sharesTotal);
            newOrder.liquidityRemoved = true;

            uint256 refund = newOrder.collateralDepositedWad > newOrder.collateralUsedWad
                ? newOrder.collateralDepositedWad - newOrder.collateralUsedWad
                : 0;

            if (refund > 0) {
                newOrder.collateralDepositedWad = newOrder.collateralUsedWad;
                _pendingRefunds[newOrder.owner][marketKey] += refund;
            }
        }

        if (shouldRemoveLiquidity) {
            _closeRangeOrder(marketKey, newOrderId);
        }

        // Update active liquidity for opposite side
        uint128 oppActiveLiq = _getActiveLiquidity(state, opposite);
        uint128 activeFilled = result.rangeFilled < uint256(oppActiveLiq) ? uint128(result.rangeFilled) : oppActiveLiq;
        _safeSubActiveLiquidity(marketKey, state, opposite, activeFilled);

        // Update active liquidity for new order side
        uint128 newActiveLiq = _getActiveLiquidity(state, newOrder.outcome);
        uint128 newFilled = result.totalFilled < uint256(newActiveLiq) ? uint128(result.totalFilled) : newActiveLiq;
        _safeSubActiveLiquidity(marketKey, state, newOrder.outcome, newFilled);

        // Update cross tick
        result.crossTick = newOrder.outcome == 1 ? overlapHigh : overlapLow;
        state.currentTick = result.crossTick;

        emit UnifiedCrossing(
            marketKey, newOrderId, newOrder.outcome,
            result.spotFilled, result.rangeFilled,
            result.spotCost, result.rangeCost,
            result.crossTick
        );

        emit OrdersCrossed(
            marketKey, newOrderId, newOrder.outcome,
            result.totalFilled, result.newOrderCost,
            result.totalFilled - result.newOrderCost, // approximate opposite cost
            result.crossTick
        );
    }

    /**
     * @notice Check if there's any spot liquidity in the given tick range
     */
    function _hasSpotLiquidity(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper
    ) internal view returns (bool) {
        // Use spot bitmap to efficiently check
        // Use tickLower - 1 because findNextUp search is exclusive
        uint16 nextSpot = _spotBitmaps[marketKey][outcome].findNextUp(tickLower - 1);
        return nextSpot <= tickUpper;
    }

    /**
     * @notice Calculate the overlap range between new order and opposite liquidity
     */
    function _calculateOverlap(
        bytes32 marketKey,
        uint8 newOutcome,
        uint16 tickLower,
        uint16 tickUpper
    ) internal view returns (uint16 overlapLow, uint16 overlapHigh, bool hasOverlap) {
        if (newOutcome == 1) {
            // Placing YES order - find liquidity to cross against:
            // 1. NO range orders (at high NO ticks = low YES asking price)
            // 2. YES spot sells (direct YES share sellers)
            uint16 highestNoRange = _bitmaps[marketKey][0].findNextDown(MAX_TICK + 1);
            uint16 lowestYesSpot = _spotBitmaps[marketKey][1].findNextUp(0);
            
            // For NO range: higher NO tick = seller accepts lower YES price
            // For YES spot: LOWER tick = lower asking price = cheaper for buyer
            uint16 cheapestFromRange = highestNoRange <= MAX_TICK ? 1000 - highestNoRange : MAX_TICK + 1;
            uint16 cheapestFromSpot = lowestYesSpot <= MAX_TICK ? lowestYesSpot : MAX_TICK + 1;
            
            uint16 cheapestSellerPrice = cheapestFromRange < cheapestFromSpot ? cheapestFromRange : cheapestFromSpot;
            if (cheapestSellerPrice > MAX_TICK || cheapestSellerPrice > tickUpper) return (0, 0, false);
            
            overlapLow = cheapestSellerPrice > tickLower ? cheapestSellerPrice : tickLower;
            overlapHigh = tickUpper;
            hasOverlap = true;
        } else {
            // Placing NO order - find liquidity to cross against:
            // 1. YES range orders (buyers bidding for YES)
            // 2. NO spot sells (direct NO share sellers)
            uint16 highestYesRange = _bitmaps[marketKey][1].findNextDown(MAX_TICK + 1);
            uint16 highestNoSpot = _spotBitmaps[marketKey][0].findNextDown(MAX_TICK + 1);
            
            // For YES range: tick IS the bid price
            // For NO spot: higher NO tick = seller accepts lower NO price (higher YES equiv)
            uint16 bestFromRange = highestYesRange <= MAX_TICK ? highestYesRange : 0;
            uint16 bestFromSpot = highestNoSpot <= MAX_TICK ? 1000 - highestNoSpot : 0;
            
            uint16 bestBuy = bestFromRange > bestFromSpot ? bestFromRange : bestFromSpot;
            if (bestBuy == 0) return (0, 0, false);
            
            uint16 ourLowestAsk = 1000 - tickUpper;
            if (bestBuy < ourLowestAsk) return (0, 0, false);
            
            uint16 ourHighestAsk = 1000 - tickLower;
            overlapLow = ourLowestAsk > 0 ? ourLowestAsk : 1;
            overlapHigh = bestBuy < ourHighestAsk ? bestBuy : ourHighestAsk;
            hasOverlap = true;
        }
    }

    /**
     * @notice Fill spot liquidity in the overlap range
     * @dev RFC-001: Tick-indexed iteration for O(overlap × ordersPerTick) instead of O(N)
     *      Each order is processed exactly once at max(order.tickLower, overlapLow)
     */
    function _fillSpotLiquidity(
        bytes32 marketKey,
        Market memory m,
        address buyer,
        uint8, /* buyerOutcome */
        uint8 sellerOutcome,
        uint16 overlapLow,
        uint16 overlapHigh,
        uint256 maxToFill
    ) internal returns (uint256 filled) {
        uint256 remaining = maxToFill;
        
        // V10.4: Convert overlap range to native tick space for seller outcome
        // overlapLow/overlapHigh are in YES-equivalent tick space from _calculateOverlap
        // For NO spot sells (sellerOutcome == 0), we need to convert to NO-native ticks
        // YES tick Y corresponds to NO tick (1000 - Y)
        uint16 iterLow = overlapLow;
        uint16 iterHigh = overlapHigh;
        
        if (sellerOutcome == 0) {
            // NO spot sells: convert YES-equivalent to NO-native ticks
            // If YES overlap is [500, 999], NO native range is [1, 500]
            iterLow = overlapHigh <= MAX_TICK ? MAX_TICK + 1 - overlapHigh : MIN_TICK;
            iterHigh = overlapLow >= MIN_TICK ? MAX_TICK + 1 - overlapLow : MAX_TICK;
            // Ensure iterLow <= iterHigh after conversion
            if (iterLow > iterHigh) {
                (iterLow, iterHigh) = (iterHigh, iterLow);
            }
        }
        
        // RFC-001: Iterate through ticks in overlap range instead of all historical IDs
        for (uint16 t = iterLow; t <= iterHigh && remaining > 0; t++) {
            uint256[] storage sellIdsAtTick = _spotSellIdsAtTick[marketKey][sellerOutcome][t];
            uint256 len = sellIdsAtTick.length;
            if (len == 0) continue;

            // Snapshot IDs to avoid storage mutation (swap/pop) during iteration.
            uint256[] memory sellIds = new uint256[](len);
            for (uint256 j = 0; j < len; ) {
                sellIds[j] = sellIdsAtTick[j];
                unchecked { ++j; }
            }

            for (uint256 i = 0; i < len && remaining > 0;) {
                uint256 sellId = sellIds[i];
                SpotSellOrder storage spotOrder = _spotSellOrders[marketKey][sellId];
                unchecked { ++i; }
                
                if (!spotOrder.active) continue;
                
                // RFC-001: Process each order exactly once at its "canonical" tick
                // The canonical tick is max(tickLower, iterLow) - the first tick where
                // this order becomes relevant to this fill operation (in native tick space)
                uint16 canonicalTick = spotOrder.tickLower > iterLow ? spotOrder.tickLower : iterLow;
                if (t != canonicalTick) continue;
                
                uint256 available = spotOrder.sharesTotal - spotOrder.sharesFilled;
                if (available == 0) continue;
                
                uint256 toFill = remaining < available ? remaining : available;
                
                // Calculate cost at spot order's price
                uint256 spotPriceLow = TickMath.tickToProbability(spotOrder.tickLower);
                uint256 spotPriceHigh = TickMath.tickToProbability(spotOrder.tickUpper);
                uint256 spotAvgPrice = (spotPriceLow + spotPriceHigh) / 2;
                uint256 cost = (spotAvgPrice * toFill) / WAD;
                
                // Transfer locked shares from seller to buyer
                vault.transferLockedOutcome(m.truthMarket, spotOrder.owner, buyer, sellerOutcome, toFill);
                
                // Update spot order state
                spotOrder.sharesFilled += uint128(toFill);
                spotOrder.proceedsWad += uint128(cost);
                
                // Reduce spot liquidity in ticks
                uint256 ticksInRange = uint256(spotOrder.tickUpper) - uint256(spotOrder.tickLower) + 1;
                uint128 densityReduction = uint128(toFill / ticksInRange);
                for (uint16 tickIter = spotOrder.tickLower; tickIter <= spotOrder.tickUpper; tickIter++) {
                    TickLiquidity storage tick = _tickLiquidity[marketKey][sellerOutcome][tickIter];
                    if (tick.spotLiquidity >= densityReduction) {
                        tick.spotLiquidity -= densityReduction;
                    } else {
                        tick.spotLiquidity = 0;
                    }
                    if (tick.spotLiquidity == 0) {
                        _spotBitmaps[marketKey][sellerOutcome].clearBit(tickIter);
                    }
                }
                
                // Auto-complete spot order if fully filled
                if (spotOrder.sharesFilled >= spotOrder.sharesTotal) {
                    spotOrder.active = false;
                    _removeFromUserSpotSells(marketKey, spotOrder.owner, sellId);
                    _removeSpotSellFromAllTicks(marketKey, sellerOutcome, spotOrder.tickLower, spotOrder.tickUpper, sellId);
                    if (spotOrder.proceedsWad > 0) {
                        vault.creditUsdcAvailable(spotOrder.owner, spotOrder.proceedsWad);
                        spotOrder.proceedsWad = 0;
                    }
                    emit SpotSellClosed(spotOrder.owner, marketKey, sellId);
                }
                
                emit SpotSellFilled(marketKey, sellId, toFill, cost);
                
                filled += toFill;
                remaining -= toFill;
            }
        }
    }

    /**
     * @notice Calculate cost based on outcome and price
     */
    function _calculateCostForOutcome(
        uint8 outcome,
        uint256 shares,
        uint256 avgPrice
    ) internal pure returns (uint256) {
        if (outcome == 1) {
            // YES buyer pays avgPrice per share
            return (avgPrice * shares) / WAD;
        } else {
            // NO buyer pays (1 - avgPrice) per share
            return ((WAD - avgPrice) * shares) / WAD;
        }
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

        uint256 globalFillGrowth = _fillGrowthGlobalX128[marketKey][out];
        uint256 lastFillGrowth = _fillGrowthLastX128[marketKey][orderId];
        if (globalFillGrowth > lastFillGrowth) {
            uint256 delta = globalFillGrowth - lastFillGrowth;
            pendingShares = (delta * order.sharesTotal) / Q128;

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

    /// @dev V10: Get unified tick liquidity (range + spot)
    function getTickLiquidity(bytes32 marketKey, uint8 outcome, uint16 tick)
        external
        view
        returns (int128 rangeLiquidityNet, uint128 rangeLiquidityGross, uint128 spotLiquidity)
    {
        TickLiquidity memory t = _tickLiquidity[marketKey][outcome][tick];
        return (t.rangeLiquidityNet, t.rangeLiquidityGross, t.spotLiquidity);
    }

    function getNextOrderId() external view returns (uint256) {
        return _nextOrderId;
    }

    function getNextSpotSellId() external view returns (uint256) {
        return _nextSpotSellId;
    }

    function getAllMarketOrders(bytes32 marketKey) external view returns (uint256[] memory) {
        uint256 maxId = _nextOrderId;
        
        uint256 count = 0;
        for (uint256 i = 1; i < maxId; ) {
            if (_orders[marketKey][i].active) {
                unchecked { ++count; }
            }
            unchecked { ++i; }
        }
        
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

    function getAllMarketSpotSells(bytes32 marketKey) external view returns (uint256[] memory) {
        uint256 maxId = _nextSpotSellId;
        
        uint256 count = 0;
        for (uint256 i = 1; i < maxId; ) {
            if (_spotSellOrders[marketKey][i].active) {
                unchecked { ++count; }
            }
            unchecked { ++i; }
        }
        
        uint256[] memory sellIds = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i < maxId; ) {
            if (_spotSellOrders[marketKey][i].active) {
                sellIds[idx] = i;
                unchecked { ++idx; }
            }
            unchecked { ++i; }
        }
        return sellIds;
    }
}
