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
        uint256 liquidity;      // shares provided (WAD)
        uint256 filledShares;   // shares filled so far
        uint256 proceedsWad;    // USDC proceeds from fills
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

    // Global cumulative fill tracking (like Uniswap V3 feeGrowthGlobal)
    // Per market, per outcome: cumulative fills in WAD
    mapping(bytes32 => mapping(uint8 => uint256)) private _cumulativeFills;
    // Per market, per outcome: cumulative proceeds (USDC paid by takers) in WAD
    mapping(bytes32 => mapping(uint8 => uint256)) private _cumulativeProceeds;
    // Per market, per outcome: total liquidity across all active orders
    mapping(bytes32 => mapping(uint8 => uint256)) private _totalLiquidity;
    // Per order: snapshot of cumulative fills at order creation
    mapping(bytes32 => mapping(uint256 => uint256)) private _orderFillsSnapshot;
    // Per order: snapshot of cumulative proceeds at order creation
    mapping(bytes32 => mapping(uint256 => uint256)) private _orderProceedsSnapshot;

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
        uint256 collateralReserved
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
        uint16 endTick
    );
    event TickCrossed(bytes32 indexed marketKey, uint16 tick, int128 liquidityDelta);
    event FillsClaimed(
        address indexed owner,
        bytes32 indexed marketKey,
        uint256 indexed orderId,
        uint256 filledShares,
        uint256 proceedsWad
    );

    // ============================================
    // Constructor
    // ============================================

    constructor(address _vault) {
        require(_vault != address(0), "TickBookV2: zero vault");
        vault = ITickBookVault(_vault);
    }

    // ============================================
    // Market Registration
    // ============================================

    function registerMarket(
        address market,
        address yesToken,
        address noToken
    ) external returns (bytes32 marketKey) {
        require(market != address(0), "TickBookV2: zero market");
        require(yesToken != address(0), "TickBookV2: zero yes token");
        require(noToken != address(0), "TickBookV2: zero no token");

        marketKey = keccak256(abi.encodePacked(market, yesToken, noToken));
        require(!_markets[marketKey].isActive, "TickBookV2: already registered");

        _markets[marketKey] = Market({
            truthMarket: market,
            yesToken: yesToken,
            noToken: noToken,
            isActive: true
        });

        // Initialize at 50% (tick 500)
        _state[marketKey] = MarketState({
            currentTick: 500,
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
     * @param marketKey The market identifier
     * @param outcome 0 = selling NO (maker gets YES on fill), 1 = selling YES (maker gets NO on fill)
     * @param tickLower Lower tick bound (inclusive)
     * @param tickUpper Upper tick bound (inclusive)
     * @param liquidity Total shares to provide across the range
     */
    function placeRangeOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 liquidity
    ) external returns (uint256 orderId) {
        Market memory m = _markets[marketKey];
        require(m.isActive, "TickBookV2: not active");
        require(ITruthMarket(m.truthMarket).isLive(), "TickBookV2: not live");
        require(outcome <= 1, "TickBookV2: invalid outcome");
        require(liquidity > 0, "TickBookV2: zero liquidity");
        require(tickLower >= MIN_TICK && tickUpper <= MAX_TICK, "TickBookV2: tick out of range");
        require(tickLower <= tickUpper, "TickBookV2: invalid range");

        orderId = ++_nextOrderId;

        // Store order (ONE SSTORE)
        _orders[marketKey][orderId] = RangeOrder({
            owner: msg.sender,
            outcome: outcome,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
            filledShares: 0,
            proceedsWad: 0,
            active: true
        });
        _userOrders[marketKey][msg.sender].push(orderId);

        // Snapshot cumulative fills for lazy attribution
        _orderFillsSnapshot[marketKey][orderId] = _cumulativeFills[marketKey][outcome];
        _orderProceedsSnapshot[marketKey][orderId] = _cumulativeProceeds[marketKey][outcome];
        
        // Track total liquidity for pro-rata calculations
        _totalLiquidity[marketKey][outcome] += liquidity;

        // Update tick boundaries (TWO SSTORES)
        _ticks[marketKey][outcome][tickLower].liquidityNet += int128(uint128(liquidity));
        _ticks[marketKey][outcome][tickLower].liquidityGross += uint128(liquidity);

        _ticks[marketKey][outcome][tickUpper + 1].liquidityNet -= int128(uint128(liquidity));
        _ticks[marketKey][outcome][tickUpper + 1].liquidityGross += uint128(liquidity);

        // Update bitmaps
        _bitmaps[marketKey][outcome].setBit(tickLower);
        if (tickUpper + 1 <= MAX_TICK) {
            _bitmaps[marketKey][outcome].setBit(tickUpper + 1);
        }

        // Update active liquidity if current tick is within range
        MarketState storage state = _state[marketKey];
        if (state.currentTick >= tickLower && state.currentTick <= tickUpper) {
            if (outcome == 0) {
                state.activeLiquidityNo += uint128(liquidity);
            } else {
                state.activeLiquidityYes += uint128(liquidity);
            }
        }

        // Calculate collateral and move directly to market backing
        // This ensures the market is fully collateralized from order placement
        uint256 collateral = _calculateCollateral(outcome, tickLower, tickUpper, liquidity);
        vault.spendAvailableToMarket(msg.sender, m.truthMarket, collateral);

        emit RangeOrderPlaced(msg.sender, marketKey, orderId, outcome, tickLower, tickUpper, liquidity, collateral);
    }

    /**
     * @notice Cancel a range order
     * @param marketKey The market identifier
     * @param orderId The order to cancel
     */
    function cancelOrder(bytes32 marketKey, uint256 orderId) external returns (uint256 collateralReleased, uint256 proceedsClaimed) {
        RangeOrder storage order = _orders[marketKey][orderId];
        require(order.active, "TickBookV2: not active");
        require(order.owner == msg.sender, "TickBookV2: not owner");

        uint256 unfilledLiquidity = order.liquidity - order.filledShares;

        // Update tick boundaries
        _ticks[marketKey][order.outcome][order.tickLower].liquidityNet -= int128(uint128(unfilledLiquidity));
        _ticks[marketKey][order.outcome][order.tickLower].liquidityGross -= uint128(unfilledLiquidity);

        _ticks[marketKey][order.outcome][order.tickUpper + 1].liquidityNet += int128(uint128(unfilledLiquidity));
        _ticks[marketKey][order.outcome][order.tickUpper + 1].liquidityGross -= uint128(unfilledLiquidity);

        // Clear bitmaps if no more liquidity at boundaries
        if (_ticks[marketKey][order.outcome][order.tickLower].liquidityGross == 0) {
            _bitmaps[marketKey][order.outcome].clearBit(order.tickLower);
        }
        if (_ticks[marketKey][order.outcome][order.tickUpper + 1].liquidityGross == 0) {
            _bitmaps[marketKey][order.outcome].clearBit(order.tickUpper + 1);
        }

        // Update active liquidity if current tick is within range
        MarketState storage state = _state[marketKey];
        if (state.currentTick >= order.tickLower && state.currentTick <= order.tickUpper) {
            if (order.outcome == 0) {
                state.activeLiquidityNo -= uint128(unfilledLiquidity);
            } else {
                state.activeLiquidityYes -= uint128(unfilledLiquidity);
            }
        }

        // Calculate collateral to release (for unfilled portion only)
        collateralReleased = _calculateCollateral(order.outcome, order.tickLower, order.tickUpper, unfilledLiquidity);
        
        // Calculate fills and proceeds since order creation
        uint256 globalFills = _cumulativeFills[marketKey][order.outcome];
        uint256 globalProceeds = _cumulativeProceeds[marketKey][order.outcome];
        uint256 totalLiq = _totalLiquidity[marketKey][order.outcome];
        
        if (totalLiq > 0) {
            uint256 fillDelta = globalFills - _orderFillsSnapshot[marketKey][orderId];
            uint256 proceedsDelta = globalProceeds - _orderProceedsSnapshot[marketKey][orderId];
            
            // Pro-rata share of fills and proceeds
            order.filledShares = (fillDelta * order.liquidity) / totalLiq;
            order.proceedsWad = (proceedsDelta * order.liquidity) / totalLiq;
        }
        
        proceedsClaimed = order.proceedsWad;
        
        // Decrement total liquidity
        _totalLiquidity[marketKey][order.outcome] -= unfilledLiquidity;

        // Mark inactive
        order.active = false;

        // Refund unfilled collateral from market back to user
        if (collateralReleased > 0) {
            vault.refundMarketToAvailable(_markets[marketKey].truthMarket, msg.sender, collateralReleased);
        }
        
        // Credit outcome shares for filled portion
        if (order.filledShares > 0) {
            uint8 makerGetsOutcome = order.outcome == 0 ? 1 : 0; // opposite of what they sold
            vault.creditOutcome(_markets[marketKey].truthMarket, msg.sender, makerGetsOutcome, order.filledShares);
        }

        emit RangeOrderCancelled(msg.sender, marketKey, orderId, unfilledLiquidity, collateralReleased, proceedsClaimed);
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
        RangeOrder storage order = _orders[marketKey][orderId];
        require(order.active, "TickBookV2: not active");
        require(order.owner == msg.sender, "TickBookV2: not owner");

        // Calculate fills and proceeds since last snapshot
        uint256 globalFills = _cumulativeFills[marketKey][order.outcome];
        uint256 globalProceeds = _cumulativeProceeds[marketKey][order.outcome];
        uint256 totalLiq = _totalLiquidity[marketKey][order.outcome];
        
        if (totalLiq > 0) {
            uint256 fillDelta = globalFills - _orderFillsSnapshot[marketKey][orderId];
            uint256 proceedsDelta = globalProceeds - _orderProceedsSnapshot[marketKey][orderId];
            
            // Pro-rata share
            filledShares = (fillDelta * order.liquidity) / totalLiq;
            proceedsWad = (proceedsDelta * order.liquidity) / totalLiq;
        }

        // Update snapshots to current
        _orderFillsSnapshot[marketKey][orderId] = globalFills;
        _orderProceedsSnapshot[marketKey][orderId] = globalProceeds;
        
        // Update order state
        order.filledShares += filledShares;
        order.proceedsWad += proceedsWad;
        
        // Credit outcome shares for fills
        if (filledShares > 0) {
            uint8 makerGetsOutcome = order.outcome == 0 ? 1 : 0;
            vault.creditOutcome(_markets[marketKey].truthMarket, msg.sender, makerGetsOutcome, filledShares);
        }

        emit FillsClaimed(msg.sender, marketKey, orderId, filledShares, proceedsWad);
    }

    // ============================================
    // Market Orders (Taker)
    // ============================================

    /**
     * @notice Execute a market order (buy YES or NO)
     * @param marketKey The market identifier
     * @param outcome 1 = buy YES (consumes NO liquidity), 0 = buy NO (consumes YES liquidity)
     * @param shares Number of shares to buy
     * @param maxCost Maximum USDC to spend (slippage protection)
     */
    function executeMarketOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint256 maxCost
    ) external returns (uint256 sharesFilled, uint256 totalCost) {
        Market memory m = _markets[marketKey];
        require(m.isActive, "TickBookV2: not active");
        require(ITruthMarket(m.truthMarket).isLive(), "TickBookV2: not live");
        require(outcome <= 1, "TickBookV2: invalid outcome");
        require(shares > 0, "TickBookV2: zero shares");

        MarketState storage state = _state[marketKey];
        uint16 startTick = state.currentTick;
        uint256 remaining = shares;

        // Opposite outcome provides liquidity
        uint8 makerOutcome = outcome == 1 ? 0 : 1;

        if (outcome == 1) {
            // Buy YES: consume NO liquidity, price moves UP
            (sharesFilled, totalCost) = _fillUp(marketKey, m.truthMarket, state, remaining, makerOutcome);
        } else {
            // Buy NO: consume YES liquidity, price moves DOWN
            (sharesFilled, totalCost) = _fillDown(marketKey, m.truthMarket, state, remaining, makerOutcome);
        }

        require(sharesFilled > 0, "TickBookV2: no liquidity");
        require(totalCost <= maxCost, "TickBookV2: slippage exceeded");

        // Update cumulative fills and proceeds for maker attribution
        _cumulativeFills[marketKey][makerOutcome] += sharesFilled;
        _cumulativeProceeds[marketKey][makerOutcome] += totalCost;

        // Taker pays
        vault.spendAvailableToMarket(msg.sender, m.truthMarket, totalCost);
        
        // Taker receives shares
        vault.creditOutcome(m.truthMarket, msg.sender, outcome, sharesFilled);

        emit MarketOrderExecuted(msg.sender, marketKey, outcome, shares, sharesFilled, totalCost, startTick, state.currentTick);
    }

    /**
     * @dev Fill shares moving price UP (buying YES, consuming NO liquidity)
     */
    function _fillUp(
        bytes32 marketKey,
        address market,
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
            uint16 nextBoundary = _bitmaps[marketKey][makerOutcome].findNextUp(tick);
            if (nextBoundary > MAX_TICK) nextBoundary = MAX_TICK;

            // Calculate max shares fillable before hitting boundary
            // Linear model: shares = liquidity * ticksMoved / 1000 (scaled to WAD)
            uint256 ticksToNext = uint256(nextBoundary - tick);
            uint256 maxSharesInSegment = (uint256(activeLiq) * ticksToNext * WAD) / 1000;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;

            // Calculate tick movement for this fill
            // ticksMoved = fillNow * 1000 / (activeLiq * WAD)
            uint256 ticksMoved = (fillNow * 1000) / (uint256(activeLiq) * WAD / WAD);
            if (ticksMoved == 0 && fillNow > 0) ticksMoved = 1; // minimum 1 tick

            // Calculate cost (linear: average price * shares)
            uint256 priceStart = TickMath.tickToProbability(tick);
            uint256 priceEnd = TickMath.tickToProbability(tick + uint16(ticksMoved));
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentCost = (avgPrice * fillNow) / WAD;

            filled += fillNow;
            cost += segmentCost;
            remaining -= fillNow;

            // Move tick
            tick += uint16(ticksMoved);

            // Check if we crossed a boundary
            if (tick >= nextBoundary && nextBoundary <= MAX_TICK) {
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
        address market,
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
            uint16 nextBoundary = _bitmaps[marketKey][makerOutcome].findNextDown(tick);
            if (nextBoundary == 0 || nextBoundary > MAX_TICK) nextBoundary = MIN_TICK;

            // Calculate max shares fillable before hitting boundary
            uint256 ticksToNext = uint256(tick - nextBoundary);
            uint256 maxSharesInSegment = (uint256(activeLiq) * ticksToNext * WAD) / 1000;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;

            // Calculate tick movement
            uint256 ticksMoved = (fillNow * 1000) / (uint256(activeLiq) * WAD / WAD);
            if (ticksMoved == 0 && fillNow > 0) ticksMoved = 1;

            // Calculate cost (for NO: cost = (1 - price) * shares)
            uint256 priceStart = WAD - TickMath.tickToProbability(tick);
            uint256 priceEnd = WAD - TickMath.tickToProbability(tick - uint16(ticksMoved));
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentCost = (avgPrice * fillNow) / WAD;

            filled += fillNow;
            cost += segmentCost;
            remaining -= fillNow;

            // Move tick down
            tick -= uint16(ticksMoved);

            // Check if we crossed a boundary
            if (tick <= nextBoundary && nextBoundary >= MIN_TICK) {
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

    function getUserOrders(bytes32 marketKey, address user) external view returns (uint256[] memory) {
        return _userOrders[marketKey][user];
    }

    function getTickInfo(bytes32 marketKey, uint8 outcome, uint16 tick) external view returns (TickInfo memory) {
        return _ticks[marketKey][outcome][tick];
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

            uint16 nextBoundary = _bitmaps[marketKey][makerOutcome].findNextUp(tick);
            if (nextBoundary > MAX_TICK) nextBoundary = MAX_TICK;

            uint256 ticksToNext = uint256(nextBoundary - tick);
            uint256 maxSharesInSegment = (uint256(activeLiq) * ticksToNext * WAD) / 1000;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;
            uint256 ticksMoved = (fillNow * 1000) / (uint256(activeLiq) * WAD / WAD);
            if (ticksMoved == 0 && fillNow > 0) ticksMoved = 1;

            uint256 priceStart = TickMath.tickToProbability(tick);
            uint256 priceEnd = TickMath.tickToProbability(tick + uint16(ticksMoved));
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentCost = (avgPrice * fillNow) / WAD;

            filled += fillNow;
            cost += segmentCost;
            remaining -= fillNow;
            tick += uint16(ticksMoved);

            if (tick >= nextBoundary && nextBoundary <= MAX_TICK) {
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

            uint16 nextBoundary = _bitmaps[marketKey][makerOutcome].findNextDown(tick);
            if (nextBoundary == 0 || nextBoundary > MAX_TICK) nextBoundary = MIN_TICK;

            uint256 ticksToNext = uint256(tick - nextBoundary);
            uint256 maxSharesInSegment = (uint256(activeLiq) * ticksToNext * WAD) / 1000;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;
            uint256 ticksMoved = (fillNow * 1000) / (uint256(activeLiq) * WAD / WAD);
            if (ticksMoved == 0 && fillNow > 0) ticksMoved = 1;

            uint256 priceStart = WAD - TickMath.tickToProbability(tick);
            uint256 priceEnd = WAD - TickMath.tickToProbability(tick - uint16(ticksMoved));
            uint256 avgPrice = (priceStart + priceEnd) / 2;
            uint256 segmentCost = (avgPrice * fillNow) / WAD;

            filled += fillNow;
            cost += segmentCost;
            remaining -= fillNow;
            tick -= uint16(ticksMoved);

            if (tick <= nextBoundary && nextBoundary >= MIN_TICK) {
                activeLiq = uint128(int128(activeLiq) - _ticks[marketKey][makerOutcome][nextBoundary + 1].liquidityNet);
            }
        }

        finalTick = tick;
    }

    // ============================================
    // Internal Helpers
    // ============================================

    /**
     * @dev Calculate collateral required for a range order
     * Uses midpoint of range as average price for simplicity
     */
    function _calculateCollateral(
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 liquidity
    ) internal pure returns (uint256) {
        // Average probability in the range
        uint256 avgTick = (uint256(tickLower) + uint256(tickUpper)) / 2;
        uint256 avgProbability = TickMath.tickToProbability(uint16(avgTick));

        if (outcome == 0) {
            // Selling NO: collateral = (1 - P) * shares
            return ((WAD - avgProbability) * liquidity) / WAD;
        } else {
            // Selling YES: collateral = P * shares
            return (avgProbability * liquidity) / WAD;
        }
    }
}

