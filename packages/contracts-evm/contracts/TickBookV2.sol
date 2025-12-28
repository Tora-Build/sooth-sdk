// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITickBookVault} from "./interfaces/ITickBookVault.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {TickBitmap} from "./libraries/TickBitmap.sol";
import {TickMath} from "./libraries/TickMath.sol";

/**
 * @title TickBookV2
 * @notice Continuous range orderbook with Uniswap V3-style liquidity tracking (ADR-052)
 * @dev Range orders are stored as single entries. Price moves linearly within ranges.
 *      Uses liquidityNet at tick boundaries for O(1) order placement.
 */
contract TickBookV2 {
    using TickBitmap for TickBitmap.Bitmap;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint16 private constant MIN_TICK = 1;
    uint16 private constant MAX_TICK = TickMath.MAX_TICK; // 999

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
        uint8 outcome;          // 0 = selling NO (wants YES on fill), 1 = selling YES (wants NO on fill)
        uint16 tickLower;
        uint16 tickUpper;
        uint256 sharesTotal;    // total shares across the whole range (WAD)
        uint256 liquidity;      // per-tick density (shares per tick, WAD). Used for execution + pro-rata attribution.
        uint256 collateralDepositedWad; // maker collateral deposited into marketCollateralWad at placement (WAD)
        uint256 filledShares;   // maker fill attribution (shares earned, WAD)
        uint256 collateralUsedWad; // maker collateral consumed by fills (WAD)
        bool active;
    }

    struct TickInfo {
        int128 liquidityNet;    // net liquidity change when crossing UP through this tick
        uint128 liquidityGross; // total liquidity referencing this tick as a boundary
    }

    struct MarketState {
        uint16 currentTick;         // current price tick (1-999)
        uint128 activeLiquidityNo;  // total NO liquidity active at current tick
        uint128 activeLiquidityYes; // total YES liquidity active at current tick
    }

    // Spot sell order (selling owned shares for USDC)
    struct SpotSellOrder {
        address owner;
        uint8 outcome;          // Which outcome being sold (0=NO, 1=YES)
        uint16 tickLower;       // Min price willing to accept
        uint16 tickUpper;       // Max price (usually MAX_TICK for sells)
        uint256 sharesTotal;    // Total shares locked for sale
        uint256 liquidity;      // Per-tick density
        uint256 sharesSold;     // Shares sold so far
        uint256 proceedsWad;    // USDC received so far
        bool active;
    }

    // ============================================
    // Storage
    // ============================================

    ITickBookVault public immutable vault;

    mapping(bytes32 => Market) private _markets;
    mapping(bytes32 => MarketState) private _state;

    // Tick boundary tracking (per market, per outcome)
    // outcome 0 = NO orders, outcome 1 = YES orders
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => TickInfo))) private _ticks;
    mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _bitmaps;

    // Range orders
    mapping(bytes32 => mapping(uint256 => RangeOrder)) private _orders;
    mapping(bytes32 => mapping(address => uint256[])) private _userOrders;
    uint256 private _nextOrderId;

    // ============
    // Churn-safe maker attribution (per-liquidity growth, Q128.128)
    // ============

    uint256 private constant Q128 = 2 ** 128;

    // Per market, per makerOutcome: total active liquidity (constant until cancel)
    mapping(bytes32 => mapping(uint8 => uint256)) private _totalLiquidity;

    // Per market, per makerOutcome: cumulative shares earned per unit liquidity (Q128.128)
    mapping(bytes32 => mapping(uint8 => uint256)) private _fillGrowthGlobalX128;

    // Per market, per makerOutcome: cumulative maker-collateral-used per unit liquidity (Q128.128)
    mapping(bytes32 => mapping(uint8 => uint256)) private _collateralUsedGrowthGlobalX128;

    // Per order snapshots (Q128.128)
    mapping(bytes32 => mapping(uint256 => uint256)) private _fillGrowthLastX128;
    mapping(bytes32 => mapping(uint256 => uint256)) private _collateralUsedGrowthLastX128;

    // ============
    // Spot Sell Orders (secondary market - selling owned shares)
    // ============
    
    // Spot sell orders use separate ID space (starting from 1 billion to avoid collision)
    uint256 private constant SPOT_ORDER_ID_OFFSET = 1_000_000_000;
    uint256 private _nextSpotOrderId;
    
    mapping(bytes32 => mapping(uint256 => SpotSellOrder)) private _spotOrders;
    mapping(bytes32 => mapping(address => uint256[])) private _userSpotOrders;
    
    // Spot sell depth tracking (per market, per outcome being sold)
    // spotOutcome 0 = people selling NO, 1 = people selling YES
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint128))) private _spotDepth;
    mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _spotBitmaps;
    
    // Spot order queue per tick (for FIFO matching)
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint256))) private _spotHead;
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint256))) private _spotTail;
    mapping(bytes32 => mapping(uint256 => uint256)) private _spotOrderNext;

    // ============================================
    // Events
    // ============================================

    event MarketRegistered(bytes32 indexed marketKey, address market, address yesToken, address noToken);
    event RangeOrderPlaced(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed orderId,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 liquidity,
        uint256 collateralReserved,
        uint256 crossingFilled,      // Shares filled immediately via crossing
        uint256 crossingCost         // Cost paid for crossing fills
    );
    event RangeOrderCancelled(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed orderId,
        uint256 unfilledLiquidity,
        uint256 collateralReleased,
        uint256 proceedsClaimed
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
        uint256 refunded             // Collateral refunded for unfilled shares
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
    
    // Spot sell events
    event SpotSellOrderPlaced(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed orderId,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 sharesLocked
    );
    event SpotSellOrderCancelled(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed orderId,
        uint256 sharesReturned,
        uint256 proceedsClaimed
    );
    event SpotSellFilled(
        address indexed seller,
        address indexed buyer,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint256 shares,
        uint256 proceeds
    );

    // ============================================
    // Constructor
    // ============================================

    constructor(address _vault) {
        require(_vault != address(0), "!vault");
        vault = ITickBookVault(_vault);
    }

    // ============================================
    // Market Registration
    // ============================================

    /**
     * @notice Register a market for Pro trading
     * @param market The TruthMarket address
     * @param yesToken The YES outcome token address
     * @param noToken The NO outcome token address
     * @param initialProbabilityWad Initial probability from AMM (WAD), used to set starting tick
     */
    function registerMarket(
        address market,
        address yesToken,
        address noToken,
        uint256 initialProbabilityWad
    ) external returns (bytes32 marketKey) {
        require(market != address(0), "!market");
        require(yesToken != address(0), "!yes");
        require(noToken != address(0), "!no");

        marketKey = keccak256(abi.encodePacked(market, yesToken, noToken));
        require(!_markets[marketKey].isActive, "dup");

        _markets[marketKey] = Market({
            truthMarket: market,
            yesToken: yesToken,
            noToken: noToken,
            isActive: true
        });

        // Initialize tick from AMM probability (clamp to valid range)
        uint16 initialTick = TickMath.probabilityToTick(initialProbabilityWad);
        if (initialTick < MIN_TICK) initialTick = MIN_TICK;
        if (initialTick > MAX_TICK) initialTick = MAX_TICK;

        _state[marketKey] = MarketState({
            currentTick: initialTick,
            activeLiquidityNo: 0,
            activeLiquidityYes: 0
        });

        emit MarketRegistered(marketKey, market, yesToken, noToken);
        return marketKey;
    }

    // ============================================
    // Range Orders
    // ============================================

    /**
     * @notice Place a range order (O(1) gas regardless of range width)
     * @dev Supports limit order crossing: if opposite-side liquidity exists at the current tick,
     *      the order will immediately match (cross) by minting a complete set.
     *      Example: BUY YES at 60% + BUY NO at 40% = 100% → mint complete set, each side gets their token.
     * @param marketKey The market identifier
     * @param outcome 0 = maker gets NO on fill, 1 = maker gets YES on fill
     * @param tickLower Lower tick bound (inclusive)
     * @param tickUpper Upper tick bound (inclusive)
     * @param sharesTotal Total shares across the range (WAD)
     * @return orderId The order ID
     * @return crossingFilled Shares filled immediately via crossing (if any)
     * @return crossingCost Collateral consumed for crossing fills
     */
    function placeRangeOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 sharesTotal
    ) external returns (uint256 orderId, uint256 crossingFilled, uint256 crossingCost) {
        Market memory m = _markets[marketKey];
        require(m.isActive, "!active");
        require(ITruthMarket(m.truthMarket).isLive(), "!live");
        require(outcome <= 1, "!out");
        require(sharesTotal > 0, "!amt");
        require(tickLower >= MIN_TICK && tickUpper <= MAX_TICK, "!tick");
        require(tickLower <= tickUpper, "!rng");

        orderId = ++_nextOrderId;

        uint256 ticksInRange = uint256(tickUpper) - uint256(tickLower) + 1;
        uint256 density = sharesTotal / ticksInRange;
        require(density > 0, "!den");

        // Store order (ONE SSTORE)
        uint256 collateral = _calculateCollateral(outcome, tickLower, tickUpper, sharesTotal);
        _orders[marketKey][orderId] = RangeOrder({
            owner: msg.sender,
            outcome: outcome,
            tickLower: tickLower,
            tickUpper: tickUpper,
            sharesTotal: sharesTotal,
            liquidity: density,
            collateralDepositedWad: collateral,
            filledShares: 0,
            collateralUsedWad: 0,
            active: true
        });
        _userOrders[marketKey][msg.sender].push(orderId);

        // Snapshot growth for churn-safe attribution
        _fillGrowthLastX128[marketKey][orderId] = _fillGrowthGlobalX128[marketKey][outcome];
        _collateralUsedGrowthLastX128[marketKey][orderId] = _collateralUsedGrowthGlobalX128[marketKey][outcome];

        // Track total liquidity
        _totalLiquidity[marketKey][outcome] += sharesTotal;

        // Update tick boundaries (TWO SSTORES)
        _ticks[marketKey][outcome][tickLower].liquidityNet += int128(uint128(density));
        _ticks[marketKey][outcome][tickLower].liquidityGross += uint128(density);

        _ticks[marketKey][outcome][tickUpper + 1].liquidityNet -= int128(uint128(density));
        _ticks[marketKey][outcome][tickUpper + 1].liquidityGross += uint128(density);

        // Update bitmaps
        _bitmaps[marketKey][outcome].setBit(tickLower);
        if (tickUpper + 1 <= MAX_TICK) {
            _bitmaps[marketKey][outcome].setBit(tickUpper + 1);
        }

        // Update active liquidity if current tick is within range
        MarketState storage state = _state[marketKey];
        if (state.currentTick >= tickLower && state.currentTick <= tickUpper) {
            if (outcome == 0) {
                state.activeLiquidityNo += uint128(density);
            } else {
                state.activeLiquidityYes += uint128(density);
            }
        }

        // Move maker collateral into market backing at placement time
        vault.spendAvailableToMarket(msg.sender, m.truthMarket, collateral);

        // Attempt to cross with opposite-side liquidity at current tick
        (crossingFilled, crossingCost, ) = _tryCross(marketKey, orderId);

        emit RangeOrderPlaced(msg.sender, marketKey, orderId, outcome, tickLower, tickUpper, density, collateral, crossingFilled, crossingCost);
    }

    /**
     * @notice Cancel a range order
     * @param marketKey The market identifier
     * @param orderId The order to cancel
     */
    function cancelOrder(bytes32 marketKey, uint256 orderId) external returns (uint256 collateralReleased, uint256 proceedsClaimed) {
        RangeOrder storage order = _orders[marketKey][orderId];
        require(order.active, "!active");
        require(order.owner == msg.sender, "!own");

        // Realize any pending fills/collateral usage before cancelling
        _claimInternal(marketKey, orderId, msg.sender);

        // Update tick boundaries (remove full liquidity; fills do NOT reduce liquidity)
        _ticks[marketKey][order.outcome][order.tickLower].liquidityNet -= int128(uint128(order.liquidity));
        _ticks[marketKey][order.outcome][order.tickLower].liquidityGross -= uint128(order.liquidity);

        uint16 upperBoundary = order.tickUpper + 1;
        _ticks[marketKey][order.outcome][upperBoundary].liquidityNet += int128(uint128(order.liquidity));
        _ticks[marketKey][order.outcome][upperBoundary].liquidityGross -= uint128(order.liquidity);

        // Clear bitmaps if no more liquidity at boundaries
        if (_ticks[marketKey][order.outcome][order.tickLower].liquidityGross == 0) {
            _bitmaps[marketKey][order.outcome].clearBit(order.tickLower);
        }
        if (upperBoundary <= MAX_TICK && _ticks[marketKey][order.outcome][upperBoundary].liquidityGross == 0) {
            _bitmaps[marketKey][order.outcome].clearBit(upperBoundary);
        }

        // Update active liquidity if current tick is within range
        MarketState storage state = _state[marketKey];
        if (state.currentTick >= order.tickLower && state.currentTick <= order.tickUpper) {
            if (order.outcome == 0) {
                state.activeLiquidityNo -= uint128(order.liquidity);
            } else {
                state.activeLiquidityYes -= uint128(order.liquidity);
            }
        }

        // Refund remaining unused maker collateral
        // NOTE: collateral is deposited at placement, and consumed over time by fills (tracked via collateralUsedWad).
        collateralReleased = order.collateralDepositedWad > order.collateralUsedWad
            ? (order.collateralDepositedWad - order.collateralUsedWad)
            : 0;

        // Legacy return slot (not used in this model)
        proceedsClaimed = 0;

        // Decrement total liquidity
        _totalLiquidity[marketKey][order.outcome] -= order.sharesTotal;

        // Mark inactive
        order.active = false;

        // Refund unfilled collateral from market back to user
        if (collateralReleased > 0) {
            vault.refundMarketToAvailable(_markets[marketKey].truthMarket, msg.sender, collateralReleased);
        }

        emit RangeOrderCancelled(msg.sender, marketKey, orderId, 0, collateralReleased, proceedsClaimed);
    }

    /**
     * @notice Claim fills from an active order without cancelling
     * @param marketKey The market identifier
     * @param orderId The order to claim from
     * @return filledShares Shares filled since last claim
     * @return proceedsWad USDC proceeds from fills
     */
    function claimFills(bytes32 marketKey, uint256 orderId) 
        external 
        returns (uint256 filledShares, uint256 proceedsWad) 
    {
        (filledShares, proceedsWad) = _claimInternal(marketKey, orderId, msg.sender);
    }

    function _claimInternal(bytes32 marketKey, uint256 orderId, address owner)
        internal
        returns (uint256 filledShares, uint256 collateralUsedWad)
    {
        RangeOrder storage order = _orders[marketKey][orderId];
        require(order.active, "!active");
        require(order.owner == owner, "!own");

        uint8 out = order.outcome;
        uint256 totalLiq = _totalLiquidity[marketKey][out];
        if (totalLiq == 0) {
            return (0, 0);
        }

        // Shares earned since last claim
        uint256 globalFillGrowth = _fillGrowthGlobalX128[marketKey][out];
        uint256 lastFillGrowth = _fillGrowthLastX128[marketKey][orderId];
        if (globalFillGrowth > lastFillGrowth) {
            uint256 delta = globalFillGrowth - lastFillGrowth;
            filledShares = (delta * order.sharesTotal) / Q128;
            _fillGrowthLastX128[marketKey][orderId] = globalFillGrowth;
        }

        // Maker collateral used since last claim
        uint256 globalUsedGrowth = _collateralUsedGrowthGlobalX128[marketKey][out];
        uint256 lastUsedGrowth = _collateralUsedGrowthLastX128[marketKey][orderId];
        if (globalUsedGrowth > lastUsedGrowth) {
            uint256 delta = globalUsedGrowth - lastUsedGrowth;
            collateralUsedWad = (delta * order.sharesTotal) / Q128;
            _collateralUsedGrowthLastX128[marketKey][orderId] = globalUsedGrowth;
        }

        if (filledShares > 0) {
            order.filledShares += filledShares;
            // Maker receives the outcome they provided liquidity for (the opposite side of the taker).
            // Example: taker buys YES -> maker side is NO -> maker receives NO shares.
            vault.creditOutcome(_markets[marketKey].truthMarket, owner, order.outcome, filledShares);
        }

        if (collateralUsedWad > 0) {
            order.collateralUsedWad += collateralUsedWad;
        }

        emit FillsClaimed(owner, marketKey, orderId, filledShares, collateralUsedWad);
    }

    // ============================================
    // Spot Sell Orders (Sell owned shares for USDC)
    // ============================================

    /**
     * @notice Place a spot sell order (sell owned shares)
     * @param marketKey The market identifier
     * @param outcome Which token you're selling (0=NO, 1=YES)
     * @param tickLower Minimum price willing to accept (tick)
     * @param tickUpper Maximum price (usually MAX_TICK)
     * @param sharesTotal Total shares to sell
     * @return orderId The spot order ID
     */
    function placeSpotSellOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 sharesTotal
    ) external returns (uint256 orderId) {
        Market memory m = _markets[marketKey];
        require(m.isActive, "!active");
        require(ITruthMarket(m.truthMarket).isLive(), "!live");
        require(outcome <= 1, "!out");
        require(sharesTotal > 0, "!amt");
        require(tickLower >= MIN_TICK && tickUpper <= MAX_TICK, "!tick");
        require(tickLower <= tickUpper, "!rng");

        orderId = SPOT_ORDER_ID_OFFSET + (++_nextSpotOrderId);

        uint256 ticksInRange = uint256(tickUpper) - uint256(tickLower) + 1;
        uint256 density = sharesTotal / ticksInRange;
        require(density > 0, "!den");

        // Lock user's internal shares
        vault.lockOutcome(m.truthMarket, msg.sender, outcome, sharesTotal);

        // Store order
        _spotOrders[marketKey][orderId] = SpotSellOrder({
            owner: msg.sender,
            outcome: outcome,
            tickLower: tickLower,
            tickUpper: tickUpper,
            sharesTotal: sharesTotal,
            liquidity: density,
            sharesSold: 0,
            proceedsWad: 0,
            active: true
        });
        _userSpotOrders[marketKey][msg.sender].push(orderId);

        // Add to per-tick depth and queue (simplified: add to each tick in range)
        for (uint16 tick = tickLower; tick <= tickUpper; tick++) {
            _spotDepth[marketKey][outcome][tick] += uint128(density);
            _spotBitmaps[marketKey][outcome].setBit(tick);
            
            // Add to FIFO queue
            uint256 tail = _spotTail[marketKey][outcome][tick];
            if (tail == 0) {
                _spotHead[marketKey][outcome][tick] = orderId;
            } else {
                _spotOrderNext[marketKey][tail] = orderId;
            }
            _spotTail[marketKey][outcome][tick] = orderId;
            
            if (tick == tickUpper) break;
        }

        emit SpotSellOrderPlaced(msg.sender, marketKey, orderId, outcome, tickLower, tickUpper, sharesTotal);
    }

    /**
     * @notice Cancel a spot sell order
     * @param marketKey The market identifier
     * @param orderId The spot order ID
     */
    function cancelSpotSellOrder(bytes32 marketKey, uint256 orderId) 
        external 
        returns (uint256 sharesReturned, uint256 proceedsClaimed) 
    {
        require(orderId >= SPOT_ORDER_ID_OFFSET, "!spot");
        SpotSellOrder storage order = _spotOrders[marketKey][orderId];
        require(order.active, "!active");
        require(order.owner == msg.sender, "!own");

        Market memory m = _markets[marketKey];

        // Calculate remaining shares
        sharesReturned = order.sharesTotal - order.sharesSold;
        proceedsClaimed = order.proceedsWad;

        // Remove from depth (simplified: remove full density from each tick)
        for (uint16 tick = order.tickLower; tick <= order.tickUpper; tick++) {
            if (_spotDepth[marketKey][order.outcome][tick] >= uint128(order.liquidity)) {
                _spotDepth[marketKey][order.outcome][tick] -= uint128(order.liquidity);
            }
            if (_spotDepth[marketKey][order.outcome][tick] == 0) {
                _spotBitmaps[marketKey][order.outcome].clearBit(tick);
            }
            if (tick == order.tickUpper) break;
        }

        order.active = false;

        // Return unsold shares to user
        if (sharesReturned > 0) {
            vault.unlockOutcome(m.truthMarket, msg.sender, order.outcome, sharesReturned);
        }

        // Credit any proceeds (already credited during fills, but track for event)
        emit SpotSellOrderCancelled(msg.sender, marketKey, orderId, sharesReturned, proceedsClaimed);
    }

    /**
     * @notice Execute immediate spot sell (sell shares at market price)
     * @dev Matches against existing buy orders (complete-set makers on opposite side)
     * @param marketKey The market identifier
     * @param outcome Which token you're selling (0=NO, 1=YES)
     * @param shares Number of shares to sell
     * @param minProceeds Minimum USDC to receive (slippage protection)
     * @return sharesSold Shares actually sold
     * @return proceeds USDC received
     */
    function executeSpotSell(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint256 minProceeds
    ) external returns (uint256 sharesSold, uint256 proceeds) {
        Market memory m = _markets[marketKey];
        require(m.isActive, "!active");
        require(ITruthMarket(m.truthMarket).isLive(), "!live");
        require(outcome <= 1, "!out");
        require(shares > 0, "!amt");

        // Debit user's internal shares
        vault.lockOutcome(m.truthMarket, msg.sender, outcome, shares);

        MarketState storage state = _state[marketKey];
        uint16 startTick = state.currentTick;

        // Selling YES = consume buy-YES demand = complete-set makers on NO side (outcome=0)
        // Selling NO = consume buy-NO demand = complete-set makers on YES side (outcome=1)
        uint8 makerOutcome = outcome == 1 ? 0 : 1;

        if (outcome == 1) {
            // Selling YES: price moves DOWN as we consume NO-side makers
            (sharesSold, proceeds) = _spotSellDown(marketKey, m.truthMarket, state, shares, makerOutcome, msg.sender);
        } else {
            // Selling NO: price moves UP as we consume YES-side makers
            (sharesSold, proceeds) = _spotSellUp(marketKey, m.truthMarket, state, shares, makerOutcome, msg.sender);
        }

        require(sharesSold > 0, "!buy");
        require(proceeds >= minProceeds, "slip");

        // Return unsold shares
        if (sharesSold < shares) {
            vault.unlockOutcome(m.truthMarket, msg.sender, outcome, shares - sharesSold);
        }

        // The sold shares effectively "burn" (they go to match with maker's new shares)
        // Proceeds are credited to seller from market collateral
        
        emit MarketOrderExecuted(msg.sender, marketKey, outcome, shares, sharesSold, proceeds, startTick, state.currentTick, shares - sharesSold);
    }

    /**
     * @notice Execute hybrid sell (spot sell owned shares + short sell remainder)
     * @dev Automatically splits between spot and short based on available shares
     * @param marketKey The market identifier
     * @param outcome Which token you're selling (0=NO, 1=YES)
     * @param totalShares Total shares to sell
     * @param minProceeds Minimum USDC to receive (for spot portion)
     * @return spotSold Shares sold from owned balance
     * @return shortSold Shares sold via short (= opposite tokens bought)
     * @return proceeds USDC received from spot portion
     * @return shortCost USDC spent on short portion
     */
    function executeHybridSell(
        bytes32 marketKey,
        uint8 outcome,
        uint256 totalShares,
        uint256 minProceeds
    ) external returns (uint256 spotSold, uint256 shortSold, uint256 proceeds, uint256 shortCost) {
        Market memory m = _markets[marketKey];
        require(m.isActive, "!active");
        require(ITruthMarket(m.truthMarket).isLive(), "!live");
        require(outcome <= 1, "!out");
        require(totalShares > 0, "!amt");

        // Get user's current internal balance
        (uint256 yesBalance, uint256 noBalance) = vault.getInternalOutcomes(m.truthMarket, msg.sender);
        uint256 ownedShares = outcome == 1 ? yesBalance : noBalance;

        // Split: spot portion uses owned shares, short portion uses USDC
        uint256 spotPortion = ownedShares < totalShares ? ownedShares : totalShares;
        uint256 shortPortion = totalShares - spotPortion;

        // Execute spot portion
        if (spotPortion > 0) {
            (spotSold, proceeds) = this.executeSpotSell(marketKey, outcome, spotPortion, 0);
            require(proceeds >= minProceeds, "slip");
        }

        // Execute short portion (= buy opposite outcome)
        if (shortPortion > 0) {
            uint8 oppositeOutcome = outcome == 1 ? 0 : 1;
            // Calculate max cost for short (use all available USDC as upper bound)
            uint256 maxShortCost = vault.availableUsdcWad(msg.sender);
            
            (shortSold, shortCost, ) = this.executeMarketOrder(marketKey, oppositeOutcome, shortPortion, maxShortCost);
        }
    }

    /**
     * @dev Spot sell moving price DOWN (selling YES, consuming NO-side makers)
     */
    function _spotSellDown(
        bytes32 marketKey,
        address market,
        MarketState storage state,
        uint256 sharesToSell,
        uint8 makerOutcome,
        address seller
    ) internal returns (uint256 sold, uint256 proceeds) {
        uint256 remaining = sharesToSell;
        uint16 tick = state.currentTick;
        uint128 activeLiq = state.activeLiquidityNo;

        while (remaining > 0 && tick > MIN_TICK) {
            if (activeLiq == 0) {
                uint16 nextTick = _bitmaps[marketKey][makerOutcome].findNextDown(tick);
                if (nextTick == 0 || nextTick > MAX_TICK) break;
                tick = nextTick;
                activeLiq = uint128(int128(activeLiq) - _ticks[marketKey][makerOutcome][tick + 1].liquidityNet);
                continue;
            }

            uint16 searchFrom = tick == MIN_TICK ? MIN_TICK : uint16(tick - 1);
            uint16 nextBoundary = _bitmaps[marketKey][makerOutcome].findNextDown(searchFrom);
            if (nextBoundary == 0 || nextBoundary > MAX_TICK) nextBoundary = MIN_TICK;

            uint256 ticksToNext = uint256(tick - nextBoundary);
            uint256 maxSharesInSegment = uint256(activeLiq) * ticksToNext;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;
            uint256 ticksMoved = (fillNow + uint256(activeLiq) - 1) / uint256(activeLiq);
            if (ticksMoved > ticksToNext) ticksMoved = ticksToNext;
            if (ticksMoved == 0) ticksMoved = 1;

            // For spot sell YES: proceeds = YES price * shares
            uint256 priceStart = TickMath.tickToProbability(tick);
            uint256 priceEnd = TickMath.tickToProbability(tick - uint16(ticksMoved));
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentProceeds = (avgPrice * fillNow) / WAD;

            sold += fillNow;
            proceeds += segmentProceeds;
            remaining -= fillNow;
            tick -= uint16(ticksMoved);

            // Update maker attribution
            uint256 totalLiq = _totalLiquidity[marketKey][makerOutcome];
            if (totalLiq > 0) {
                _fillGrowthGlobalX128[marketKey][makerOutcome] += (fillNow * Q128) / totalLiq;
                uint256 makerCollateralUsed = fillNow > segmentProceeds ? (fillNow - segmentProceeds) : 0;
                _collateralUsedGrowthGlobalX128[marketKey][makerOutcome] += (makerCollateralUsed * Q128) / totalLiq;
            }

            if (tick == nextBoundary && nextBoundary >= MIN_TICK) {
                activeLiq = uint128(int128(activeLiq) - _ticks[marketKey][makerOutcome][nextBoundary + 1].liquidityNet);
            }
        }

        state.currentTick = tick;
        state.activeLiquidityNo = activeLiq;

        // Seller receives proceeds from market collateral
        if (proceeds > 0) {
            vault.refundMarketToAvailable(market, seller, proceeds);
        }
    }

    /**
     * @dev Spot sell moving price UP (selling NO, consuming YES-side makers)
     */
    function _spotSellUp(
        bytes32 marketKey,
        address market,
        MarketState storage state,
        uint256 sharesToSell,
        uint8 makerOutcome,
        address seller
    ) internal returns (uint256 sold, uint256 proceeds) {
        uint256 remaining = sharesToSell;
        uint16 tick = state.currentTick;
        uint128 activeLiq = state.activeLiquidityYes;

        while (remaining > 0 && tick < MAX_TICK) {
            if (activeLiq == 0) {
                uint16 nextTick = _bitmaps[marketKey][makerOutcome].findNextUp(tick);
                if (nextTick > MAX_TICK) break;
                tick = nextTick;
                activeLiq = uint128(int128(activeLiq) + _ticks[marketKey][makerOutcome][tick].liquidityNet);
                continue;
            }

            uint16 searchFrom = tick == MAX_TICK ? MAX_TICK : uint16(tick + 1);
            uint16 nextBoundary = _bitmaps[marketKey][makerOutcome].findNextUp(searchFrom);
            if (nextBoundary > MAX_TICK) nextBoundary = MAX_TICK;

            uint256 ticksToNext = uint256(nextBoundary - tick);
            uint256 maxSharesInSegment = uint256(activeLiq) * ticksToNext;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;
            uint256 ticksMoved = (fillNow + uint256(activeLiq) - 1) / uint256(activeLiq);
            if (ticksMoved > ticksToNext) ticksMoved = ticksToNext;
            if (ticksMoved == 0) ticksMoved = 1;

            // For spot sell NO: proceeds = NO price * shares = (1 - YES price) * shares
            uint256 priceStart = WAD - TickMath.tickToProbability(tick);
            uint256 priceEnd = WAD - TickMath.tickToProbability(tick + uint16(ticksMoved));
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentProceeds = (avgPrice * fillNow) / WAD;

            sold += fillNow;
            proceeds += segmentProceeds;
            remaining -= fillNow;
            tick += uint16(ticksMoved);

            // Update maker attribution
            uint256 totalLiq = _totalLiquidity[marketKey][makerOutcome];
            if (totalLiq > 0) {
                _fillGrowthGlobalX128[marketKey][makerOutcome] += (fillNow * Q128) / totalLiq;
                uint256 makerCollateralUsed = fillNow > segmentProceeds ? (fillNow - segmentProceeds) : 0;
                _collateralUsedGrowthGlobalX128[marketKey][makerOutcome] += (makerCollateralUsed * Q128) / totalLiq;
            }

            if (tick == nextBoundary && nextBoundary <= MAX_TICK) {
                activeLiq = uint128(int128(activeLiq) + _ticks[marketKey][makerOutcome][nextBoundary].liquidityNet);
            }
        }

        state.currentTick = tick;
        state.activeLiquidityYes = activeLiq;

        // Seller receives proceeds from market collateral
        if (proceeds > 0) {
            vault.refundMarketToAvailable(market, seller, proceeds);
        }
    }

    // ============================================
    // Market Orders (Taker - Always Immediate, Never Sits in Book)
    // ============================================

    /**
     * @notice Execute a market order (buy YES or NO)
     * @dev Market orders are always takers. Unfilled portions are refunded, never placed as maker.
     * @param marketKey The market identifier
     * @param outcome 1 = buy YES (consumes NO liquidity), 0 = buy NO (consumes YES liquidity)
     * @param shares Number of shares to buy
     * @param maxCost Maximum USDC to spend (slippage protection)
     * @return sharesFilled Shares actually filled
     * @return totalCost Total cost paid
     * @return refunded Collateral refunded for unfilled shares
     */
    function executeMarketOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint256 maxCost
    ) external returns (uint256 sharesFilled, uint256 totalCost, uint256 refunded) {
        Market memory m = _markets[marketKey];
        require(m.isActive, "!active");
        require(ITruthMarket(m.truthMarket).isLive(), "!live");
        require(outcome <= 1, "!out");
        require(shares > 0, "!amt");

        // Reserve max cost upfront (user already approved this amount)
        vault.spendAvailableToMarket(msg.sender, m.truthMarket, maxCost);

        MarketState storage state = _state[marketKey];
        uint16 startTick = state.currentTick;

        // Opposite outcome provides liquidity
        uint8 makerOutcome = outcome == 1 ? 0 : 1;

        if (outcome == 1) {
            // Buy YES: consume NO liquidity, price moves UP
            (sharesFilled, totalCost) = _fillUp(marketKey, m.truthMarket, state, shares, makerOutcome);
        } else {
            // Buy NO: consume YES liquidity, price moves DOWN
            (sharesFilled, totalCost) = _fillDown(marketKey, m.truthMarket, state, shares, makerOutcome);
        }

        // Require at least some fill (revert if no liquidity at all)
        require(sharesFilled > 0, "!liq");
        require(totalCost <= maxCost, "slip");

        if (sharesFilled > 0) {
        // Churn-safe maker attribution: update per-liquidity growth at trade time
        uint256 totalLiq = _totalLiquidity[marketKey][makerOutcome];
            if (totalLiq > 0) {
                // Maker receives opposite shares equal to sharesFilled
        _fillGrowthGlobalX128[marketKey][makerOutcome] += (sharesFilled * Q128) / totalLiq;

        // Maker collateral used is the complement of taker cost
        uint256 makerCollateralUsed = sharesFilled > totalCost ? (sharesFilled - totalCost) : 0;
        _collateralUsedGrowthGlobalX128[marketKey][makerOutcome] += (makerCollateralUsed * Q128) / totalLiq;
            }
        
        // Taker receives shares
        vault.creditOutcome(m.truthMarket, msg.sender, outcome, sharesFilled);
        }

        // ═══════════════════════════════════════════════════════════════════
        // REFUND: Return unused collateral (market orders never sit in book)
        // ═══════════════════════════════════════════════════════════════════
        
        if (maxCost > totalCost) {
            refunded = maxCost - totalCost;
            vault.refundMarketToAvailable(m.truthMarket, msg.sender, refunded);
        }

        emit MarketOrderExecuted(msg.sender, marketKey, outcome, shares, sharesFilled, totalCost, startTick, state.currentTick, refunded);
    }

    /**
     * @dev Fill shares moving price UP (buying YES, consuming NO liquidity)
     */
    function _fillUp(
        bytes32 marketKey,
        address,
        MarketState storage state,
        uint256 sharesToFill,
        uint8 makerOutcome
    ) internal returns (uint256 filled, uint256 cost) {
        uint256 remaining = sharesToFill;
        uint16 tick = state.currentTick;
        uint128 activeLiq = state.activeLiquidityNo;

        while (remaining > 0 && tick < MAX_TICK) {
            if (activeLiq == 0) {
                // Find next tick with liquidity
                uint16 nextTick = _bitmaps[marketKey][makerOutcome].findNextUp(tick);
                if (nextTick > MAX_TICK) break;

                // Jump to next tick and add liquidity
                tick = nextTick;
                activeLiq = uint128(int128(activeLiq) + _ticks[marketKey][makerOutcome][tick].liquidityNet);
                emit TickCrossed(marketKey, tick, _ticks[marketKey][makerOutcome][tick].liquidityNet);
                continue;
            }

            // Find next boundary tick
            // IMPORTANT: search strictly ABOVE current tick to avoid zero-length segments
            uint16 searchFrom = tick == MAX_TICK ? MAX_TICK : uint16(tick + 1);
            uint16 nextBoundary = _bitmaps[marketKey][makerOutcome].findNextUp(searchFrom);
            if (nextBoundary > MAX_TICK) nextBoundary = MAX_TICK;

        // Calculate max shares fillable before hitting boundary
        // shares (WAD) = liquidityPerTick (WAD) * ticksMoved
            uint256 ticksToNext = uint256(nextBoundary - tick);
        uint256 maxSharesInSegment = uint256(activeLiq) * ticksToNext;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;

            // Calculate tick movement for this fill
        // ticksMoved = ceil(fillNow / liquidityPerTick)
        uint256 ticksMoved = (fillNow + uint256(activeLiq) - 1) / uint256(activeLiq);
            if (ticksMoved > ticksToNext) ticksMoved = ticksToNext;
            if (ticksMoved == 0) ticksMoved = 1;

            // Calculate cost (linear: average price * shares)
            uint256 priceStart = TickMath.tickToProbability(tick);
            uint256 priceEnd = TickMath.tickToProbability(tick + uint16(ticksMoved));
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentCost = (avgPrice * fillNow) / WAD;

            filled += fillNow;
            cost += segmentCost;
            remaining -= fillNow;

            // Move tick (clamped within segment)
            tick += uint16(ticksMoved);

            // Check if we crossed a boundary
            if (tick == nextBoundary && nextBoundary <= MAX_TICK) {
                int128 delta = _ticks[marketKey][makerOutcome][nextBoundary].liquidityNet;
                activeLiq = uint128(int128(activeLiq) + delta);
                emit TickCrossed(marketKey, nextBoundary, delta);
            }
        }

        state.currentTick = tick;
        state.activeLiquidityNo = activeLiq;
    }

    /**
     * @dev Fill shares moving price DOWN (buying NO, consuming YES liquidity)
     */
    function _fillDown(
        bytes32 marketKey,
        address,
        MarketState storage state,
        uint256 sharesToFill,
        uint8 makerOutcome
    ) internal returns (uint256 filled, uint256 cost) {
        uint256 remaining = sharesToFill;
        uint16 tick = state.currentTick;
        uint128 activeLiq = state.activeLiquidityYes;

        while (remaining > 0 && tick > MIN_TICK) {
            if (activeLiq == 0) {
                // Find next tick with liquidity (going down)
                uint16 nextTick = _bitmaps[marketKey][makerOutcome].findNextDown(tick);
                if (nextTick == 0 || nextTick > MAX_TICK) break;

                // Jump to next tick
                tick = nextTick;
                // When moving down, we subtract liquidityNet (reverse of up)
                activeLiq = uint128(int128(activeLiq) - _ticks[marketKey][makerOutcome][tick + 1].liquidityNet);
                emit TickCrossed(marketKey, tick, -_ticks[marketKey][makerOutcome][tick + 1].liquidityNet);
                continue;
            }

            // Find next boundary tick (going down)
            // IMPORTANT: search strictly BELOW current tick to avoid zero-length segments
            uint16 searchFrom = tick == MIN_TICK ? MIN_TICK : uint16(tick - 1);
            uint16 nextBoundary = _bitmaps[marketKey][makerOutcome].findNextDown(searchFrom);
            if (nextBoundary == 0 || nextBoundary > MAX_TICK) nextBoundary = MIN_TICK;

            // Calculate max shares fillable before hitting boundary
            uint256 ticksToNext = uint256(tick - nextBoundary);
        uint256 maxSharesInSegment = uint256(activeLiq) * ticksToNext;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;

        // Calculate tick movement (ceil)
        uint256 ticksMoved = (fillNow + uint256(activeLiq) - 1) / uint256(activeLiq);
            if (ticksMoved > ticksToNext) ticksMoved = ticksToNext;
            if (ticksMoved == 0) ticksMoved = 1;

            // Calculate cost (for NO: cost = (1 - price) * shares)
            uint256 priceStart = WAD - TickMath.tickToProbability(tick);
            uint256 priceEnd = WAD - TickMath.tickToProbability(tick - uint16(ticksMoved));
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentCost = (avgPrice * fillNow) / WAD;

            filled += fillNow;
            cost += segmentCost;
            remaining -= fillNow;

            // Move tick down (clamped)
            tick -= uint16(ticksMoved);

            // Check if we crossed a boundary
            if (tick == nextBoundary && nextBoundary >= MIN_TICK) {
                int128 delta = _ticks[marketKey][makerOutcome][nextBoundary + 1].liquidityNet;
                activeLiq = uint128(int128(activeLiq) - delta);
                emit TickCrossed(marketKey, nextBoundary, -delta);
            }
        }

        state.currentTick = tick;
        state.activeLiquidityYes = activeLiq;
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
        return (
            s.currentTick,
            s.activeLiquidityNo,
            s.activeLiquidityYes,
            TickMath.tickToProbability(s.currentTick)
        );
    }

    function getOrder(bytes32 marketKey, uint256 orderId) external view returns (RangeOrder memory) {
        return _orders[marketKey][orderId];
    }

    /**
     * @notice Get pending fills for an order (not yet claimed)
     * @param marketKey The market identifier
     * @param orderId The order ID
     * @return pendingShares Shares filled but not yet claimed
     * @return pendingCollateral Collateral used but not yet accounted
     */
    function getPendingFills(bytes32 marketKey, uint256 orderId) 
        external 
        view 
        returns (uint256 pendingShares, uint256 pendingCollateral) 
    {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (!order.active) return (0, 0);
        
        uint8 out = order.outcome;
        
        // Calculate pending shares from global growth
        uint256 globalFillGrowth = _fillGrowthGlobalX128[marketKey][out];
        uint256 lastFillGrowth = _fillGrowthLastX128[marketKey][orderId];
        if (globalFillGrowth > lastFillGrowth) {
            uint256 delta = globalFillGrowth - lastFillGrowth;
            pendingShares = (delta * order.sharesTotal) / Q128;
        }
        
        // Calculate pending collateral usage from global growth
        uint256 globalUsedGrowth = _collateralUsedGrowthGlobalX128[marketKey][out];
        uint256 lastUsedGrowth = _collateralUsedGrowthLastX128[marketKey][orderId];
        if (globalUsedGrowth > lastUsedGrowth) {
            uint256 delta = globalUsedGrowth - lastUsedGrowth;
            pendingCollateral = (delta * order.sharesTotal) / Q128;
        }
    }

    function getUserOrders(bytes32 marketKey, address user) external view returns (uint256[] memory) {
        return _userOrders[marketKey][user];
    }

    function getSpotOrder(bytes32 marketKey, uint256 orderId) external view returns (SpotSellOrder memory) {
        return _spotOrders[marketKey][orderId];
    }

    function getUserSpotOrders(bytes32 marketKey, address user) external view returns (uint256[] memory) {
        return _userSpotOrders[marketKey][user];
    }

    function getSpotDepth(bytes32 marketKey, uint8 outcome, uint16 tick) external view returns (uint128) {
        return _spotDepth[marketKey][outcome][tick];
    }

    function getTickInfo(bytes32 marketKey, uint8 outcome, uint16 tick) external view returns (TickInfo memory) {
        return _ticks[marketKey][outcome][tick];
    }

    /**
     * @notice Find the next active tick boundary using the internal bitmap (UI helper)
     * @dev Mirrors ADR-051 `findNextActiveTick` to support frontend discovery.
     * @param marketKey Market key
     * @param startTick Starting tick cursor (inclusive-ish; direction handled by bitmap)
     * @param isUp True to search upward, false to search downward
     * @param outcome Which side bitmap to search (0=NO, 1=YES)
     * @return nextTick Next active boundary tick, or 0 if none found
     */
    function findNextActiveTick(
        bytes32 marketKey,
        uint16 startTick,
        bool isUp,
        uint8 outcome
    ) external view returns (uint16 nextTick) {
        require(outcome <= 1, "!out");
        // Note: uint16 can't be negative, so no MIN_TICK clamp needed
        // We allow startTick=0 so findNextUp can find tick 1
        if (startTick > MAX_TICK) startTick = MAX_TICK;
        nextTick = isUp
            ? _bitmaps[marketKey][outcome].findNextUp(startTick)
            : _bitmaps[marketKey][outcome].findNextDown(startTick);
        if (nextTick > MAX_TICK) return 0;
        return nextTick;
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

    /**
     * @notice Get a quote for a market order (view only, no state changes)
     */
    function getQuote(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares
    ) external view returns (uint256 sharesFillable, uint256 estimatedCost, uint16 finalTick) {
        MarketState memory state = _state[marketKey];
        uint8 makerOutcome = outcome == 1 ? 0 : 1;

        if (outcome == 1) {
            return _quoteUp(marketKey, state, shares, makerOutcome);
        } else {
            return _quoteDown(marketKey, state, shares, makerOutcome);
        }
    }

    /**
     * @notice Get a quote for a spot sell (view only, no state changes)
     * @param marketKey The market identifier
     * @param outcome Which token you're selling (0=NO, 1=YES)
     * @param shares Number of shares to sell
     * @return sharesSellable Shares that can be sold
     * @return estimatedProceeds USDC you would receive
     * @return finalTick Final tick after the sell
     */
    function getSpotSellQuote(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares
    ) external view returns (uint256 sharesSellable, uint256 estimatedProceeds, uint16 finalTick) {
        MarketState memory state = _state[marketKey];
        uint8 makerOutcome = outcome == 1 ? 0 : 1;

        if (outcome == 1) {
            // Selling YES: price moves down
            return _quoteSpotSellDown(marketKey, state, shares, makerOutcome);
        } else {
            // Selling NO: price moves up
            return _quoteSpotSellUp(marketKey, state, shares, makerOutcome);
        }
    }

    function _quoteSpotSellDown(
        bytes32 marketKey,
        MarketState memory state,
        uint256 sharesToSell,
        uint8 makerOutcome
    ) internal view returns (uint256 sold, uint256 proceeds, uint16 finalTick) {
        uint256 remaining = sharesToSell;
        uint16 tick = state.currentTick;
        uint128 activeLiq = state.activeLiquidityNo;

        while (remaining > 0 && tick > MIN_TICK) {
            if (activeLiq == 0) {
                uint16 nextTick = _bitmaps[marketKey][makerOutcome].findNextDown(tick);
                if (nextTick == 0 || nextTick > MAX_TICK) break;
                tick = nextTick;
                activeLiq = uint128(int128(activeLiq) - _ticks[marketKey][makerOutcome][tick + 1].liquidityNet);
                continue;
            }

            uint16 searchFrom = tick == MIN_TICK ? MIN_TICK : uint16(tick - 1);
            uint16 nextBoundary = _bitmaps[marketKey][makerOutcome].findNextDown(searchFrom);
            if (nextBoundary == 0 || nextBoundary > MAX_TICK) nextBoundary = MIN_TICK;

            uint256 ticksToNext = uint256(tick - nextBoundary);
            uint256 maxSharesInSegment = uint256(activeLiq) * ticksToNext;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;
            uint256 ticksMoved = (fillNow + uint256(activeLiq) - 1) / uint256(activeLiq);
            if (ticksMoved > ticksToNext) ticksMoved = ticksToNext;
            if (ticksMoved == 0) ticksMoved = 1;

            uint256 priceStart = TickMath.tickToProbability(tick);
            uint256 priceEnd = TickMath.tickToProbability(tick - uint16(ticksMoved));
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentProceeds = (avgPrice * fillNow) / WAD;

            sold += fillNow;
            proceeds += segmentProceeds;
            remaining -= fillNow;
            tick -= uint16(ticksMoved);

            if (tick == nextBoundary && nextBoundary >= MIN_TICK) {
                activeLiq = uint128(int128(activeLiq) - _ticks[marketKey][makerOutcome][nextBoundary + 1].liquidityNet);
            }
        }

        finalTick = tick;
    }

    function _quoteSpotSellUp(
        bytes32 marketKey,
        MarketState memory state,
        uint256 sharesToSell,
        uint8 makerOutcome
    ) internal view returns (uint256 sold, uint256 proceeds, uint16 finalTick) {
        uint256 remaining = sharesToSell;
        uint16 tick = state.currentTick;
        uint128 activeLiq = state.activeLiquidityYes;

        while (remaining > 0 && tick < MAX_TICK) {
            if (activeLiq == 0) {
                uint16 nextTick = _bitmaps[marketKey][makerOutcome].findNextUp(tick);
                if (nextTick > MAX_TICK) break;
                tick = nextTick;
                activeLiq = uint128(int128(activeLiq) + _ticks[marketKey][makerOutcome][tick].liquidityNet);
                continue;
            }

            uint16 searchFrom = tick == MAX_TICK ? MAX_TICK : uint16(tick + 1);
            uint16 nextBoundary = _bitmaps[marketKey][makerOutcome].findNextUp(searchFrom);
            if (nextBoundary > MAX_TICK) nextBoundary = MAX_TICK;

            uint256 ticksToNext = uint256(nextBoundary - tick);
            uint256 maxSharesInSegment = uint256(activeLiq) * ticksToNext;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;
            uint256 ticksMoved = (fillNow + uint256(activeLiq) - 1) / uint256(activeLiq);
            if (ticksMoved > ticksToNext) ticksMoved = ticksToNext;
            if (ticksMoved == 0) ticksMoved = 1;

            uint256 priceStart = WAD - TickMath.tickToProbability(tick);
            uint256 priceEnd = WAD - TickMath.tickToProbability(tick + uint16(ticksMoved));
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentProceeds = (avgPrice * fillNow) / WAD;

            sold += fillNow;
            proceeds += segmentProceeds;
            remaining -= fillNow;
            tick += uint16(ticksMoved);

            if (tick == nextBoundary && nextBoundary <= MAX_TICK) {
                activeLiq = uint128(int128(activeLiq) + _ticks[marketKey][makerOutcome][nextBoundary].liquidityNet);
            }
        }

        finalTick = tick;
    }

    function _quoteUp(
        bytes32 marketKey,
        MarketState memory state,
        uint256 sharesToFill,
        uint8 makerOutcome
    ) internal view returns (uint256 filled, uint256 cost, uint16 finalTick) {
        uint256 remaining = sharesToFill;
        uint16 tick = state.currentTick;
        uint128 activeLiq = state.activeLiquidityNo;

        while (remaining > 0 && tick < MAX_TICK) {
            if (activeLiq == 0) {
                uint16 nextTick = _bitmaps[marketKey][makerOutcome].findNextUp(tick);
                if (nextTick > MAX_TICK) break;
                tick = nextTick;
                activeLiq = uint128(int128(activeLiq) + _ticks[marketKey][makerOutcome][tick].liquidityNet);
                continue;
            }

            uint16 searchFrom = tick == MAX_TICK ? MAX_TICK : uint16(tick + 1);
            uint16 nextBoundary = _bitmaps[marketKey][makerOutcome].findNextUp(searchFrom);
            if (nextBoundary > MAX_TICK) nextBoundary = MAX_TICK;

            uint256 ticksToNext = uint256(nextBoundary - tick);
            uint256 maxSharesInSegment = uint256(activeLiq) * ticksToNext;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;
            uint256 ticksMoved = (fillNow + uint256(activeLiq) - 1) / uint256(activeLiq);
            if (ticksMoved > ticksToNext) ticksMoved = ticksToNext;
            if (ticksMoved == 0) ticksMoved = 1;

            uint256 priceStart = TickMath.tickToProbability(tick);
            uint256 priceEnd = TickMath.tickToProbability(tick + uint16(ticksMoved));
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentCost = (avgPrice * fillNow) / WAD;

            filled += fillNow;
            cost += segmentCost;
            remaining -= fillNow;
            tick += uint16(ticksMoved);

            if (tick == nextBoundary && nextBoundary <= MAX_TICK) {
                activeLiq = uint128(int128(activeLiq) + _ticks[marketKey][makerOutcome][nextBoundary].liquidityNet);
            }
        }

        finalTick = tick;
    }

    function _quoteDown(
        bytes32 marketKey,
        MarketState memory state,
        uint256 sharesToFill,
        uint8 makerOutcome
    ) internal view returns (uint256 filled, uint256 cost, uint16 finalTick) {
        uint256 remaining = sharesToFill;
        uint16 tick = state.currentTick;
        uint128 activeLiq = state.activeLiquidityYes;

        while (remaining > 0 && tick > MIN_TICK) {
            if (activeLiq == 0) {
                uint16 nextTick = _bitmaps[marketKey][makerOutcome].findNextDown(tick);
                if (nextTick == 0 || nextTick > MAX_TICK) break;
                tick = nextTick;
                activeLiq = uint128(int128(activeLiq) - _ticks[marketKey][makerOutcome][tick + 1].liquidityNet);
                continue;
            }

            uint16 searchFrom = tick == MIN_TICK ? MIN_TICK : uint16(tick - 1);
            uint16 nextBoundary = _bitmaps[marketKey][makerOutcome].findNextDown(searchFrom);
            if (nextBoundary == 0 || nextBoundary > MAX_TICK) nextBoundary = MIN_TICK;

            uint256 ticksToNext = uint256(tick - nextBoundary);
            uint256 maxSharesInSegment = uint256(activeLiq) * ticksToNext;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;
            uint256 ticksMoved = (fillNow + uint256(activeLiq) - 1) / uint256(activeLiq);
            if (ticksMoved > ticksToNext) ticksMoved = ticksToNext;
            if (ticksMoved == 0) ticksMoved = 1;

            uint256 priceStart = WAD - TickMath.tickToProbability(tick);
            uint256 priceEnd = WAD - TickMath.tickToProbability(tick - uint16(ticksMoved));
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentCost = (avgPrice * fillNow) / WAD;

            filled += fillNow;
            cost += segmentCost;
            remaining -= fillNow;
            tick -= uint16(ticksMoved);

            if (tick == nextBoundary && nextBoundary >= MIN_TICK) {
                activeLiq = uint128(int128(activeLiq) - _ticks[marketKey][makerOutcome][nextBoundary + 1].liquidityNet);
            }
        }

        finalTick = tick;
    }

    // ============================================
    // Internal Helpers
    // ============================================

    /**
     * @dev Attempt to cross a newly placed order against opposite-side liquidity
     *      Crossing occurs when YES + NO orders overlap in price ranges.
     *      This version matches the FULL order against all available opposite liquidity
     *      when both sides include the current tick.
     * 
     * @param marketKey The market identifier
     * @param newOrderId The ID of the newly placed order
     * @return crossedShares Amount of shares crossed
     * @return newOrderCost Collateral used from new order
     * @return oppositeCost Collateral used from opposite orders
     */
    function _tryCross(
        bytes32 marketKey,
        uint256 newOrderId
    ) internal returns (uint256 crossedShares, uint256 newOrderCost, uint256 oppositeCost) {
        RangeOrder storage newOrder = _orders[marketKey][newOrderId];
        Market memory m = _markets[marketKey];
        MarketState storage state = _state[marketKey];

        // New order must include current tick to cross
        if (state.currentTick < newOrder.tickLower || state.currentTick > newOrder.tickUpper) {
            return (0, 0, 0); // New order doesn't include current tick
        }

        uint8 opposite = newOrder.outcome == 0 ? 1 : 0;
        
        // Check if there's opposite liquidity active at current tick
        uint128 oppActiveLiq = opposite == 0 ? state.activeLiquidityNo : state.activeLiquidityYes;
        if (oppActiveLiq == 0) {
            return (0, 0, 0); // No opposite liquidity at current tick
        }

        // Calculate new order's TOTAL shares (density * range width)
        uint256 newOrderRange = uint256(newOrder.tickUpper) - uint256(newOrder.tickLower) + 1;
        uint256 newOrderTotal = newOrder.liquidity * newOrderRange;
        
        // Get total opposite-side liquidity
        uint256 oppTotalLiq = _totalLiquidity[marketKey][opposite];
        
        // Cross the minimum of: new order total, opposite total
        crossedShares = newOrderTotal < oppTotalLiq ? newOrderTotal : oppTotalLiq;
        
        if (crossedShares == 0) {
            return (0, 0, 0);
        }

        // Calculate costs at CURRENT tick price (fair mid-market)
        uint256 currentPrice = TickMath.tickToProbability(state.currentTick);
        uint256 yesCost = (currentPrice * crossedShares) / WAD;
        uint256 noCost = crossedShares - yesCost;

        // Assign costs: each side pays for the token they receive
        if (newOrder.outcome == 0) {
            // outcome=0 receives NO tokens → pays NO portion
            newOrderCost = noCost;
            oppositeCost = yesCost;
        } else {
            // outcome=1 receives YES tokens → pays YES portion
            newOrderCost = yesCost;
            oppositeCost = noCost;
        }

        // ═══════════════════════════════════════════════════════════════════
        // Execute the cross: update fill tracking for both sides
        // ═══════════════════════════════════════════════════════════════════

        // 1. Credit tokens to the new order's owner
        vault.creditOutcome(m.truthMarket, newOrder.owner, newOrder.outcome, crossedShares);

        // 2. Update new order's fill tracking
        newOrder.filledShares += crossedShares;
        newOrder.collateralUsedWad += newOrderCost;

        // 3. Update opposite side's global fill growth (pro-rata distribution)
        // NOTE: We do NOT reduce _totalLiquidity because orders remain on the book
        // (they're just "filled"). The total liquidity is used for pro-rata calculations.
        if (oppTotalLiq > 0) {
            _fillGrowthGlobalX128[marketKey][opposite] += (crossedShares * Q128) / oppTotalLiq;
            _collateralUsedGrowthGlobalX128[marketKey][opposite] += (oppositeCost * Q128) / oppTotalLiq;
        }

        // 4. Reduce active liquidity at current tick proportionally
        uint128 activeFilled = uint128(crossedShares < uint256(oppActiveLiq) ? crossedShares : uint256(oppActiveLiq));
        if (opposite == 0) {
            state.activeLiquidityNo -= activeFilled;
        } else {
            state.activeLiquidityYes -= activeFilled;
        }
        
        // Also reduce new order's side active liquidity
        uint128 newActiveLiq = newOrder.outcome == 0 ? state.activeLiquidityNo : state.activeLiquidityYes;
        uint128 newFilled = uint128(crossedShares < uint256(newActiveLiq) ? crossedShares : uint256(newActiveLiq));
        if (newOrder.outcome == 0) {
            state.activeLiquidityNo -= newFilled;
        } else {
            state.activeLiquidityYes -= newFilled;
        }

        emit OrdersCrossed(marketKey, newOrderId, newOrder.outcome, crossedShares, newOrderCost, oppositeCost, state.currentTick);
    }

    /**
     * @dev Calculate collateral required for a range order
     * Uses midpoint of range as average price for simplicity
     */
    function _calculateCollateral(
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 sharesTotal
    ) internal pure returns (uint256) {
        // Collateral must be a SAFE upper bound for maker-side complement collateral usage.
        //
        // Important detail: our boundary bookkeeping uses tickLower as the "enter" boundary and (tickUpper+1)
        // as the "exit" boundary. With the linear segment model, fills can touch the boundary tick on either
        // side, so we conservatively bound against [tickLower-1, tickUpper+1] (clamped).
        uint16 lowBoundTick = tickLower == MIN_TICK ? MIN_TICK : uint16(tickLower - 1);
        uint16 highBoundTick = tickUpper == MAX_TICK ? MAX_TICK : uint16(tickUpper + 1);

        uint256 pLow = TickMath.tickToProbability(lowBoundTick);
        uint256 pHigh = TickMath.tickToProbability(highBoundTick);

        if (outcome == 0) {
            // Selling NO: collateral = (1 - P_low) * totalShares
            return ((WAD - pLow) * sharesTotal) / WAD;
        } else {
            // Selling YES: collateral = P_high * totalShares
            return (pHigh * sharesTotal) / WAD;
        }
    }
}

