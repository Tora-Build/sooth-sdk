// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITickBookVault} from "./interfaces/ITickBookVault.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {TickBitmap} from "./libraries/TickBitmap.sol";
import {TickMath} from "./libraries/TickMath.sol";

/**
 * @title TickBook
 * @notice Continuous range orderbook with Uniswap V3-style liquidity tracking
 * @dev Optimizations:
 *      - Custom errors instead of require strings (~500 bytes saved)
 *      - Packed structs (7 slots -> 4 slots per order)
 *      - Consolidated fill logic with direction parameter (~2KB saved)
 *      - Spot sell functionality extracted to TickBookSpotSell (~5KB saved)
 *      - Security hardening (overflow checks, improved validation)
 */
contract TickBook {
    using TickBitmap for TickBitmap.Bitmap;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint16 private constant MIN_TICK = 1;
    uint16 private constant MAX_TICK = TickMath.MAX_TICK; // 999
    uint256 private constant Q128 = 2 ** 128;
    uint128 private constant MAX_LIQUIDITY = type(uint128).max;

    // ============================================
    // Custom Errors (saves ~30 bytes each vs require strings)
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
    error OrderNotActive();
    error NoLiquidity();
    error SlippageExceeded();
    error LiquidityOverflow();

    // ============================================
    // Types (Packed for gas efficiency)
    // ============================================

    struct Market {
        address truthMarket;    // 20 bytes
        address yesToken;       // 20 bytes
        address noToken;        // 20 bytes
        bool isActive;          // 1 byte
    }

    /// @dev Packed from 7 slots to 4 slots
    struct RangeOrder {
        // Slot 0: 26 bytes used
        address owner;              // 20 bytes
        uint8 outcome;              // 1 byte
        uint16 tickLower;           // 2 bytes
        uint16 tickUpper;           // 2 bytes
        bool active;                // 1 byte
        // Slot 1: 32 bytes
        uint128 sharesTotal;        // 16 bytes
        uint128 liquidity;          // 16 bytes (per-tick density)
        // Slot 2: 32 bytes
        uint128 collateralDepositedWad; // 16 bytes
        uint128 filledShares;       // 16 bytes
        // Slot 3: 16 bytes used (could pack more if needed)
        uint128 collateralUsedWad;  // 16 bytes
    }

    struct TickInfo {
        int128 liquidityNet;    // net liquidity change when crossing UP
        uint128 liquidityGross; // total liquidity referencing this tick
    }

    struct MarketState {
        uint16 currentTick;
        uint128 activeLiquidityNo;
        uint128 activeLiquidityYes;
    }

    // ============================================
    // Storage
    // ============================================

    ITickBookVault public immutable vault;

    mapping(bytes32 => Market) private _markets;
    mapping(bytes32 => MarketState) private _state;

    // Tick boundary tracking (per market, per outcome)
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => TickInfo))) private _ticks;
    mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _bitmaps;

    // Range orders
    mapping(bytes32 => mapping(uint256 => RangeOrder)) private _orders;
    mapping(bytes32 => mapping(address => uint256[])) private _userOrders;
    uint256 private _nextOrderId;

    // Churn-safe maker attribution (Q128.128)
    mapping(bytes32 => mapping(uint8 => uint256)) private _totalLiquidity;
    mapping(bytes32 => mapping(uint8 => uint256)) private _fillGrowthGlobalX128;
    mapping(bytes32 => mapping(uint8 => uint256)) private _collateralUsedGrowthGlobalX128;
    mapping(bytes32 => mapping(uint256 => uint256)) private _fillGrowthLastX128;
    mapping(bytes32 => mapping(uint256 => uint256)) private _collateralUsedGrowthLastX128;

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
    // Constructor
    // ============================================

    constructor(address _vault) {
        if (_vault == address(0)) revert ZeroAddress();
        vault = ITickBookVault(_vault);
    }

    // ============================================
    // Market Registration
    // ============================================

    function registerMarket(
        address market,
        address yesToken,
        address noToken,
        uint256 initialProbabilityWad
    ) external returns (bytes32 marketKey) {
        if (market == address(0)) revert ZeroAddress();
        if (yesToken == address(0)) revert ZeroAddress();
        if (noToken == address(0)) revert ZeroAddress();

        marketKey = keccak256(abi.encodePacked(market, yesToken, noToken));
        if (_markets[marketKey].isActive) revert DuplicateMarket();

        _markets[marketKey] = Market({
            truthMarket: market,
            yesToken: yesToken,
            noToken: noToken,
            isActive: true
        });

        uint16 initialTick = TickMath.probabilityToTick(initialProbabilityWad);
        if (initialTick < MIN_TICK) initialTick = MIN_TICK;
        if (initialTick > MAX_TICK) initialTick = MAX_TICK;

        _state[marketKey] = MarketState({
            currentTick: initialTick,
            activeLiquidityNo: 0,
            activeLiquidityYes: 0
        });

        emit MarketRegistered(marketKey, market, yesToken, noToken);
    }

    // ============================================
    // Range Orders
    // ============================================

    function placeRangeOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 sharesTotal
    ) external returns (uint256 orderId, uint256 crossingFilled, uint256 crossingCost) {
        Market memory m = _markets[marketKey];
        if (!m.isActive) revert MarketNotActive();
        if (!ITruthMarket(m.truthMarket).isLive()) revert MarketNotLive();
        if (outcome > 1) revert InvalidOutcome();
        if (sharesTotal == 0) revert ZeroAmount();
        if (tickLower < MIN_TICK || tickUpper > MAX_TICK) revert InvalidTickRange();
        if (tickLower > tickUpper) revert InvalidTickRange();

        orderId = ++_nextOrderId;

        uint256 ticksInRange = uint256(tickUpper) - uint256(tickLower) + 1;
        uint256 density = sharesTotal / ticksInRange;
        if (density == 0) revert ZeroDensity();

        // Security: check for overflow before casting
        if (density > MAX_LIQUIDITY) revert LiquidityOverflow();
        if (sharesTotal > MAX_LIQUIDITY) revert LiquidityOverflow();

        uint256 collateral = _calculateCollateral(outcome, tickLower, tickUpper, sharesTotal);
        if (collateral > MAX_LIQUIDITY) revert LiquidityOverflow();

        // Store order (packed struct)
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

        // Snapshot growth for churn-safe attribution
        _fillGrowthLastX128[marketKey][orderId] = _fillGrowthGlobalX128[marketKey][outcome];
        _collateralUsedGrowthLastX128[marketKey][orderId] = _collateralUsedGrowthGlobalX128[marketKey][outcome];

        // Track total liquidity
        _totalLiquidity[marketKey][outcome] += sharesTotal;

        // Update tick boundaries
        _updateTickBoundaries(marketKey, outcome, tickLower, tickUpper, int128(uint128(density)), true);

        // Update active liquidity if current tick is within range
        _updateActiveLiquidity(marketKey, outcome, tickLower, tickUpper, uint128(density), true);

        // Move maker collateral into market
        vault.spendAvailableToMarket(msg.sender, m.truthMarket, collateral);

        // Attempt crossing
        (crossingFilled, crossingCost, ) = _tryCross(marketKey, orderId);

        emit RangeOrderPlaced(
            msg.sender, marketKey, orderId, outcome, tickLower, tickUpper,
            density, collateral, crossingFilled, crossingCost
        );
    }

    function cancelOrder(bytes32 marketKey, uint256 orderId) external returns (uint256 collateralReleased) {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (!order.active) revert OrderNotActive();
        if (order.owner != msg.sender) revert NotOwner();

        // Realize pending fills
        _claimInternal(marketKey, orderId, msg.sender);

        // Update tick boundaries (remove liquidity)
        _updateTickBoundaries(marketKey, order.outcome, order.tickLower, order.tickUpper, -int128(order.liquidity), false);

        // Update active liquidity
        _updateActiveLiquidity(marketKey, order.outcome, order.tickLower, order.tickUpper, order.liquidity, false);

        // Calculate refund
        collateralReleased = order.collateralDepositedWad > order.collateralUsedWad
            ? uint256(order.collateralDepositedWad - order.collateralUsedWad)
            : 0;

        // Decrement total liquidity
        _totalLiquidity[marketKey][order.outcome] -= order.sharesTotal;

        order.active = false;

        if (collateralReleased > 0) {
            vault.refundMarketToAvailable(_markets[marketKey].truthMarket, msg.sender, collateralReleased);
        }

        emit RangeOrderCancelled(msg.sender, marketKey, orderId, collateralReleased);
    }

    function claimFills(bytes32 marketKey, uint256 orderId)
        external
        returns (uint256 filledShares, uint256 collateralUsedWad)
    {
        return _claimInternal(marketKey, orderId, msg.sender);
    }

    function _claimInternal(bytes32 marketKey, uint256 orderId, address owner)
        internal
        returns (uint256 filledShares, uint256 collateralUsedWad)
    {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (!order.active) revert OrderNotActive();
        if (order.owner != owner) revert NotOwner();

        uint8 out = order.outcome;
        uint256 totalLiq = _totalLiquidity[marketKey][out];
        if (totalLiq == 0) return (0, 0);

        // Shares earned since last claim
        uint256 globalFillGrowth = _fillGrowthGlobalX128[marketKey][out];
        uint256 lastFillGrowth = _fillGrowthLastX128[marketKey][orderId];
        if (globalFillGrowth > lastFillGrowth) {
            uint256 delta = globalFillGrowth - lastFillGrowth;
            filledShares = (delta * order.sharesTotal) / Q128;
            _fillGrowthLastX128[marketKey][orderId] = globalFillGrowth;
        }

        // Collateral used since last claim
        uint256 globalUsedGrowth = _collateralUsedGrowthGlobalX128[marketKey][out];
        uint256 lastUsedGrowth = _collateralUsedGrowthLastX128[marketKey][orderId];
        if (globalUsedGrowth > lastUsedGrowth) {
            uint256 delta = globalUsedGrowth - lastUsedGrowth;
            collateralUsedWad = (delta * order.sharesTotal) / Q128;
            _collateralUsedGrowthLastX128[marketKey][orderId] = globalUsedGrowth;
        }

        if (filledShares > 0) {
            order.filledShares += uint128(filledShares);
            vault.creditOutcome(_markets[marketKey].truthMarket, owner, order.outcome, filledShares);
        }

        if (collateralUsedWad > 0) {
            order.collateralUsedWad += uint128(collateralUsedWad);
        }

        emit FillsClaimed(owner, marketKey, orderId, filledShares, collateralUsedWad);
    }

    // ============================================
    // Market Orders
    // ============================================

    function executeMarketOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint256 maxCost
    ) external returns (uint256 sharesFilled, uint256 totalCost, uint256 refunded) {
        Market memory m = _markets[marketKey];
        if (!m.isActive) revert MarketNotActive();
        if (!ITruthMarket(m.truthMarket).isLive()) revert MarketNotLive();
        if (outcome > 1) revert InvalidOutcome();
        if (shares == 0) revert ZeroAmount();

        vault.spendAvailableToMarket(msg.sender, m.truthMarket, maxCost);

        MarketState storage state = _state[marketKey];
        uint16 startTick = state.currentTick;
        uint8 makerOutcome = outcome == 1 ? 0 : 1;
        bool isUp = outcome == 1;

        (sharesFilled, totalCost) = _fill(marketKey, state, shares, makerOutcome, isUp);

        if (sharesFilled == 0) revert NoLiquidity();
        if (totalCost > maxCost) revert SlippageExceeded();

        // Update maker attribution
        if (sharesFilled > 0) {
            uint256 totalLiq = _totalLiquidity[marketKey][makerOutcome];
            if (totalLiq > 0) {
                _fillGrowthGlobalX128[marketKey][makerOutcome] += (sharesFilled * Q128) / totalLiq;
                uint256 makerCollateralUsed = sharesFilled > totalCost ? (sharesFilled - totalCost) : 0;
                _collateralUsedGrowthGlobalX128[marketKey][makerOutcome] += (makerCollateralUsed * Q128) / totalLiq;
            }
            vault.creditOutcome(m.truthMarket, msg.sender, outcome, sharesFilled);
        }

        // Refund unused collateral
        if (maxCost > totalCost) {
            refunded = maxCost - totalCost;
            vault.refundMarketToAvailable(m.truthMarket, msg.sender, refunded);
        }

        emit MarketOrderExecuted(msg.sender, marketKey, outcome, shares, sharesFilled, totalCost, startTick, state.currentTick, refunded);
    }

    // ============================================
    // Consolidated Fill Logic (saves ~2KB)
    // ============================================

    /**
     * @dev Unified fill function with direction parameter
     * @param isUp true = price moves up (buy YES), false = price moves down (buy NO)
     */
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
            // Boundary check
            if (isUp && tick >= MAX_TICK) break;
            if (!isUp && tick <= MIN_TICK) break;

            if (activeLiq == 0) {
                // Find next tick with liquidity
                uint16 nextTick = isUp
                    ? _bitmaps[marketKey][makerOutcome].findNextUp(tick)
                    : _bitmaps[marketKey][makerOutcome].findNextDown(tick);

                if (isUp && nextTick > MAX_TICK) break;
                if (!isUp && (nextTick == 0 || nextTick > MAX_TICK)) break;

                tick = nextTick;
                int128 delta = isUp
                    ? _ticks[marketKey][makerOutcome][tick].liquidityNet
                    : -_ticks[marketKey][makerOutcome][tick + 1].liquidityNet;
                activeLiq = uint128(int128(activeLiq) + delta);
                emit TickCrossed(marketKey, tick, delta);
                continue;
            }

            // Find next boundary
            uint16 searchFrom = isUp
                ? (tick == MAX_TICK ? MAX_TICK : tick + 1)
                : (tick == MIN_TICK ? MIN_TICK : tick - 1);
            uint16 nextBoundary = isUp
                ? _bitmaps[marketKey][makerOutcome].findNextUp(searchFrom)
                : _bitmaps[marketKey][makerOutcome].findNextDown(searchFrom);

            if (isUp && nextBoundary > MAX_TICK) nextBoundary = MAX_TICK;
            if (!isUp && (nextBoundary == 0 || nextBoundary > MAX_TICK)) nextBoundary = MIN_TICK;

            // Calculate segment
            uint256 ticksToNext = isUp
                ? uint256(nextBoundary - tick)
                : uint256(tick - nextBoundary);
            uint256 maxSharesInSegment = uint256(activeLiq) * ticksToNext;

            uint256 fillNow = remaining < maxSharesInSegment ? remaining : maxSharesInSegment;
            uint256 ticksMoved = (fillNow + uint256(activeLiq) - 1) / uint256(activeLiq);
            if (ticksMoved > ticksToNext) ticksMoved = ticksToNext;
            if (ticksMoved == 0) ticksMoved = 1;

            // Calculate cost
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

            // Move tick
            if (isUp) {
                tick += uint16(ticksMoved);
            } else {
                tick -= uint16(ticksMoved);
            }

            // Check boundary crossing
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

    // ============================================
    // Internal Helpers
    // ============================================

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
            _ticks[marketKey][outcome][tickLower].liquidityNet += liquidityDelta; // negative delta
            _ticks[marketKey][outcome][tickLower].liquidityGross -= uint128(-liquidityDelta);

            uint16 upperBoundary = tickUpper + 1;
            _ticks[marketKey][outcome][upperBoundary].liquidityNet -= liquidityDelta; // subtracting negative = adding
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

    function _tryCross(
        bytes32 marketKey,
        uint256 newOrderId
    ) internal returns (uint256 crossedShares, uint256 newOrderCost, uint256 oppositeCost) {
        RangeOrder storage newOrder = _orders[marketKey][newOrderId];
        Market memory m = _markets[marketKey];
        MarketState storage state = _state[marketKey];

        if (state.currentTick < newOrder.tickLower || state.currentTick > newOrder.tickUpper) {
            return (0, 0, 0);
        }

        uint8 opposite = newOrder.outcome == 0 ? 1 : 0;
        uint128 oppActiveLiq = opposite == 0 ? state.activeLiquidityNo : state.activeLiquidityYes;
        if (oppActiveLiq == 0) {
            return (0, 0, 0);
        }

        uint256 newOrderRange = uint256(newOrder.tickUpper) - uint256(newOrder.tickLower) + 1;
        uint256 newOrderTotal = uint256(newOrder.liquidity) * newOrderRange;
        uint256 oppTotalLiq = _totalLiquidity[marketKey][opposite];

        crossedShares = newOrderTotal < oppTotalLiq ? newOrderTotal : oppTotalLiq;
        if (crossedShares == 0) return (0, 0, 0);

        uint256 currentPrice = TickMath.tickToProbability(state.currentTick);
        uint256 yesCost = (currentPrice * crossedShares) / WAD;
        uint256 noCost = crossedShares - yesCost;

        if (newOrder.outcome == 0) {
            newOrderCost = noCost;
            oppositeCost = yesCost;
        } else {
            newOrderCost = yesCost;
            oppositeCost = noCost;
        }

        // Execute cross
        vault.creditOutcome(m.truthMarket, newOrder.owner, newOrder.outcome, crossedShares);
        newOrder.filledShares += uint128(crossedShares);
        newOrder.collateralUsedWad += uint128(newOrderCost);

        if (oppTotalLiq > 0) {
            _fillGrowthGlobalX128[marketKey][opposite] += (crossedShares * Q128) / oppTotalLiq;
            _collateralUsedGrowthGlobalX128[marketKey][opposite] += (oppositeCost * Q128) / oppTotalLiq;
        }

        // Reduce active liquidity
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

        emit OrdersCrossed(marketKey, newOrderId, newOrder.outcome, crossedShares, newOrderCost, oppositeCost, state.currentTick);
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

    function getPendingFills(bytes32 marketKey, uint256 orderId)
        external
        view
        returns (uint256 pendingShares, uint256 pendingCollateral)
    {
        RangeOrder storage order = _orders[marketKey][orderId];
        if (!order.active) return (0, 0);

        uint8 out = order.outcome;

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
            pendingCollateral = (delta * order.sharesTotal) / Q128;
        }
    }

    function getUserOrders(bytes32 marketKey, address user) external view returns (uint256[] memory) {
        return _userOrders[marketKey][user];
    }

    function getTickInfo(bytes32 marketKey, uint8 outcome, uint16 tick) external view returns (TickInfo memory) {
        return _ticks[marketKey][outcome][tick];
    }

    function findNextActiveTick(
        bytes32 marketKey,
        uint16 startTick,
        bool isUp,
        uint8 outcome
    ) external view returns (uint16 nextTick) {
        if (outcome > 1) revert InvalidOutcome();
        if (startTick > MAX_TICK) startTick = MAX_TICK;
        nextTick = isUp
            ? _bitmaps[marketKey][outcome].findNextUp(startTick)
            : _bitmaps[marketKey][outcome].findNextDown(startTick);
        if (nextTick > MAX_TICK) return 0;
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
     * @notice Get a quote for a market order (view only)
     */
    function getQuote(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares
    ) external view returns (uint256 sharesFillable, uint256 estimatedCost, uint16 finalTick) {
        MarketState memory state = _state[marketKey];
        uint8 makerOutcome = outcome == 1 ? 0 : 1;
        bool isUp = outcome == 1;

        return _quote(marketKey, state, shares, makerOutcome, isUp);
    }

    function _quote(
        bytes32 marketKey,
        MarketState memory state,
        uint256 sharesToFill,
        uint8 makerOutcome,
        bool isUp
    ) internal view returns (uint256 filled, uint256 cost, uint16 finalTick) {
        uint256 remaining = sharesToFill;
        uint16 tick = state.currentTick;
        uint128 activeLiq = isUp ? state.activeLiquidityNo : state.activeLiquidityYes;

        while (remaining > 0) {
            if (isUp && tick >= MAX_TICK) break;
            if (!isUp && tick <= MIN_TICK) break;

            if (activeLiq == 0) {
                uint16 nextTick = isUp
                    ? _bitmaps[marketKey][makerOutcome].findNextUp(tick)
                    : _bitmaps[marketKey][makerOutcome].findNextDown(tick);

                if (isUp && nextTick > MAX_TICK) break;
                if (!isUp && (nextTick == 0 || nextTick > MAX_TICK)) break;

                tick = nextTick;
                int128 delta = isUp
                    ? _ticks[marketKey][makerOutcome][tick].liquidityNet
                    : -_ticks[marketKey][makerOutcome][tick + 1].liquidityNet;
                activeLiq = uint128(int128(activeLiq) + delta);
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
                if (isUp && nextBoundary <= MAX_TICK) {
                    activeLiq = uint128(int128(activeLiq) + _ticks[marketKey][makerOutcome][nextBoundary].liquidityNet);
                } else if (!isUp && nextBoundary >= MIN_TICK) {
                    activeLiq = uint128(int128(activeLiq) - _ticks[marketKey][makerOutcome][nextBoundary + 1].liquidityNet);
                }
            }
        }

        finalTick = tick;
    }
}
