// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITickBookVault} from "./interfaces/ITickBookVault.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {TickBitmap} from "./libraries/TickBitmap.sol";
import {TickMath} from "./libraries/TickMath.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TickBookPoolManager V9.9.4 (Lean)
 * @notice Singleton manager for prediction market orderbooks
 * @dev V9.9.4 Changes:
 *      - REMOVED: Hook system (ITickBookHooks) - replaced with simple fee storage
 *      - REMOVED: Flash accounting (TransientDelta, lock/settle/take)
 *      - REMOVED: batchPlaceOrders
 *      - FIXED: TOB-1 (pro-rata attribution now uses oppLiqInOverlap)
 *      - FIXED: TOB-2 (fees capped at MAX_FEE_BPS)
 */
contract TickBookPoolManagerV994 is ReentrancyGuard, Ownable {
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
     * @dev hook parameter is ignored in V9.9.4
     */
    function registerMarket(
        address market,
        address yesToken,
        address noToken,
        uint256 /* initialProbabilityWad */,
        address /* hook - IGNORED in V9.9.4 */
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
    // Range Orders (Hooks Removed)
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

        emit RangeOrderCancelled(msg.sender, marketKey, orderId, collateralReleased);
    }

    // ============================================
    // Market Orders (Simple Fees)
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

        vault.spendAvailableToMarket(msg.sender, m.truthMarket, maxCost);

        MarketState storage state = _state[marketKey];
        uint16 startTick = state.currentTick;
        uint8 makerOutcome = outcome == 1 ? 0 : 1;
        bool isUp = outcome == 1;

        (sharesFilled, totalCost) = _fill(marketKey, state, shares, makerOutcome, isUp);

        // Apply simple taker fee (replaces hook system)
        uint256 feeAmount = (totalCost * uint256(takerFeeBps)) / 10000;
        totalCost += feeAmount;

        if (sharesFilled == 0) revert NoLiquidity();
        if (totalCost > maxCost) revert SlippageExceeded();

        if (sharesFilled > 0) {
            uint256 totalLiq = _totalLiquidity[marketKey][makerOutcome];
            if (totalLiq > 0) {
                _fillGrowthGlobalX128[marketKey][makerOutcome] += (sharesFilled * Q128) / totalLiq;

                uint256 makerCollateralUsed = sharesFilled > totalCost ? (sharesFilled - totalCost) : 0;
                _collateralUsedGrowthGlobalX128[marketKey][makerOutcome] += (makerCollateralUsed * Q128) / totalLiq;
            }
            vault.creditOutcome(m.truthMarket, msg.sender, outcome, sharesFilled);
        }

        if (maxCost > totalCost) {
            refunded = maxCost - totalCost;
            vault.refundMarketToAvailable(m.truthMarket, msg.sender, refunded);
        }

        // Transfer fee to recipient
        if (feeAmount > 0 && feeRecipient != address(0)) {
            vault.transferFee(m.truthMarket, feeRecipient, feeAmount);
        }

        emit MarketOrderExecuted(msg.sender, marketKey, outcome, shares, sharesFilled, totalCost, startTick, state.currentTick, refunded);
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
            order.filledShares += uint128(filledShares);
            vault.creditOutcome(m.truthMarket, owner, order.outcome, filledShares);
        }

        if (collateralUsedWad > 0) {
            order.collateralUsedWad += uint128(collateralUsedWad);
        }

        emit FillsClaimed(owner, marketKey, orderId, filledShares, collateralUsedWad);
    }

    // ============================================
    // Internal Helpers
    // ============================================

    function _getPoolKey(PoolKey calldata key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key.truthMarket, key.yesToken, key.noToken));
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
                    uint16 absoluteLowest = _bitmaps[marketKey][makerOutcome].findNextUp(0);
                    if (absoluteLowest < tick && absoluteLowest <= MAX_TICK) {
                        nextTick = absoluteLowest;
                    }
                } else {
                    nextTick = _bitmaps[marketKey][makerOutcome].findNextDown(tick);
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
                    : -_ticks[marketKey][makerOutcome][tick].liquidityNet;
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
     * @dev V9.9.4 FIX (TOB-1): Uses oppLiqInOverlap as denominator for attribution
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

        if (newOrder.outcome == 1) {
            uint16 lowestSell = _bitmaps[marketKey][0].findNextUp(0);
            if (lowestSell > MAX_TICK) return (0, 0, 0);
            if (lowestSell > newOrder.tickUpper) return (0, 0, 0);

            overlapLow = lowestSell > newOrder.tickLower ? lowestSell : newOrder.tickLower;
            overlapHigh = newOrder.tickUpper;
            crossTick = overlapHigh;
        } else {
            uint16 highestBuy = _bitmaps[marketKey][1].findNextDown(MAX_TICK + 1);
            if (highestBuy > MAX_TICK) return (0, 0, 0);
            if (highestBuy < newOrder.tickLower) return (0, 0, 0);

            overlapLow = newOrder.tickLower;
            overlapHigh = highestBuy < newOrder.tickUpper ? highestBuy : newOrder.tickUpper;
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

        // V9.9.4 FIX: Mark fully filled orders as inactive and remove liquidity
        if (newOrder.filledShares >= newOrder.sharesTotal) {
            _updateTickBoundaries(marketKey, newOrder.outcome, newOrder.tickLower, newOrder.tickUpper, -int128(newOrder.liquidity), false);
            _totalLiquidity[marketKey][newOrder.outcome] -= newOrder.sharesTotal;
            newOrder.active = false;
        }

        // V9.9.4 FIX (TOB-1): Use oppLiqInOverlap as denominator instead of oppTotalLiq
        if (oppLiqInOverlap > 0) {
            _fillGrowthGlobalX128[marketKey][opposite] += (crossedShares * Q128) / oppLiqInOverlap;
            _collateralUsedGrowthGlobalX128[marketKey][opposite] += (oppositeCost * Q128) / oppLiqInOverlap;
        }

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
