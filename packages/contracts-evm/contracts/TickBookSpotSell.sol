// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITickBookVault} from "./interfaces/ITickBookVault.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {TickBitmap} from "./libraries/TickBitmap.sol";
import {TickMath} from "./libraries/TickMath.sol";

/**
 * @title TickBookSpotSell
 * @notice Extension contract for spot selling owned shares in TickBook
 * @dev Separated from TickBook to reduce contract size. Uses boundary-based
 *      tracking (O(1) placement) instead of per-tick loops.
 */
contract TickBookSpotSell {
    using TickBitmap for TickBitmap.Bitmap;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint16 private constant MIN_TICK = 1;
    uint16 private constant MAX_TICK = TickMath.MAX_TICK; // 999

    // ============================================
    // Errors
    // ============================================

    error NotActive();
    error NotLive();
    error InvalidOutcome();
    error ZeroAmount();
    error InvalidTickRange();
    error ZeroDensity();
    error NotOwner();
    error NotSpotOrder();
    error NoBuyers();
    error SlippageExceeded();

    // ============================================
    // Types
    // ============================================

    struct Market {
        address truthMarket;
        address yesToken;
        address noToken;
        bool isActive;
    }

    struct MarketState {
        uint16 currentTick;
        uint128 activeLiquidityNo;
        uint128 activeLiquidityYes;
    }

    struct TickInfo {
        int128 liquidityNet;
        uint128 liquidityGross;
    }

    // Spot sell order - packed for gas efficiency
    struct SpotSellOrder {
        address owner;          // 20 bytes
        uint8 outcome;          // 1 byte
        uint16 tickLower;       // 2 bytes
        uint16 tickUpper;       // 2 bytes
        bool active;            // 1 byte (packed in slot 0: 26 bytes)
        uint128 sharesTotal;    // slot 1: 16 bytes
        uint128 liquidity;      // slot 1: 16 bytes (density)
        uint128 sharesSold;     // slot 2: 16 bytes
        uint128 proceedsWad;    // slot 2: 16 bytes
    }

    // ============================================
    // Storage
    // ============================================

    ITickBookVault public immutable vault;
    address public immutable tickBook;

    // Markets (read from TickBook or cached)
    mapping(bytes32 => Market) private _markets;

    // Spot order ID space
    uint256 private constant SPOT_ORDER_ID_OFFSET = 1_000_000_000;
    uint256 private _nextSpotOrderId;

    // Spot sell orders
    mapping(bytes32 => mapping(uint256 => SpotSellOrder)) private _spotOrders;
    mapping(bytes32 => mapping(address => uint256[])) private _userSpotOrders;

    // Boundary-based liquidity tracking (O(1) placement like TickBook range orders)
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => TickInfo))) private _spotTicks;
    mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _spotBitmaps;

    // Total spot liquidity per outcome (for pro-rata if needed)
    mapping(bytes32 => mapping(uint8 => uint256)) private _totalSpotLiquidity;

    // ============================================
    // Events
    // ============================================

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

    event SpotSellExecuted(
        address indexed seller,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint256 sharesSold,
        uint256 proceeds,
        uint16 startTick,
        uint16 endTick
    );

    // ============================================
    // Constructor
    // ============================================

    constructor(address _vault, address _tickBook) {
        if (_vault == address(0)) revert ZeroAmount();
        if (_tickBook == address(0)) revert ZeroAmount();
        vault = ITickBookVault(_vault);
        tickBook = _tickBook;
    }

    // ============================================
    // Market Registration (called by TickBook)
    // ============================================

    function registerMarket(
        bytes32 marketKey,
        address market,
        address yesToken,
        address noToken
    ) external {
        // Only TickBook can register markets
        require(msg.sender == tickBook, "!tb");

        _markets[marketKey] = Market({
            truthMarket: market,
            yesToken: yesToken,
            noToken: noToken,
            isActive: true
        });
    }

    // ============================================
    // Spot Sell Orders (O(1) Placement)
    // ============================================

    /**
     * @notice Place a spot sell order (sell owned shares)
     * @dev Uses boundary-based tracking for O(1) gas regardless of range width
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
        if (!m.isActive) revert NotActive();
        if (!ITruthMarket(m.truthMarket).isLive()) revert NotLive();
        if (outcome > 1) revert InvalidOutcome();
        if (sharesTotal == 0) revert ZeroAmount();
        if (tickLower < MIN_TICK || tickUpper > MAX_TICK) revert InvalidTickRange();
        if (tickLower > tickUpper) revert InvalidTickRange();

        orderId = SPOT_ORDER_ID_OFFSET + (++_nextSpotOrderId);

        uint256 ticksInRange = uint256(tickUpper) - uint256(tickLower) + 1;
        uint256 density = sharesTotal / ticksInRange;
        if (density == 0) revert ZeroDensity();

        // Lock user's internal shares
        vault.lockOutcome(m.truthMarket, msg.sender, outcome, sharesTotal);

        // Store order (packed struct = fewer SSTOREs)
        _spotOrders[marketKey][orderId] = SpotSellOrder({
            owner: msg.sender,
            outcome: outcome,
            tickLower: tickLower,
            tickUpper: tickUpper,
            active: true,
            sharesTotal: uint128(sharesTotal),
            liquidity: uint128(density),
            sharesSold: 0,
            proceedsWad: 0
        });
        _userSpotOrders[marketKey][msg.sender].push(orderId);

        // Update tick boundaries (O(1) - same pattern as TickBook range orders)
        _spotTicks[marketKey][outcome][tickLower].liquidityNet += int128(uint128(density));
        _spotTicks[marketKey][outcome][tickLower].liquidityGross += uint128(density);

        uint16 upperBoundary = tickUpper + 1 <= MAX_TICK ? tickUpper + 1 : MAX_TICK;
        _spotTicks[marketKey][outcome][upperBoundary].liquidityNet -= int128(uint128(density));
        _spotTicks[marketKey][outcome][upperBoundary].liquidityGross += uint128(density);

        // Update bitmaps
        _spotBitmaps[marketKey][outcome].setBit(tickLower);
        if (tickUpper + 1 <= MAX_TICK) {
            _spotBitmaps[marketKey][outcome].setBit(tickUpper + 1);
        }

        // Track total liquidity
        _totalSpotLiquidity[marketKey][outcome] += sharesTotal;

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
        if (orderId < SPOT_ORDER_ID_OFFSET) revert NotSpotOrder();
        SpotSellOrder storage order = _spotOrders[marketKey][orderId];
        if (!order.active) revert NotActive();
        if (order.owner != msg.sender) revert NotOwner();

        Market memory m = _markets[marketKey];

        // Calculate remaining shares
        sharesReturned = uint256(order.sharesTotal) - uint256(order.sharesSold);
        proceedsClaimed = order.proceedsWad;

        // Remove from tick boundaries
        _spotTicks[marketKey][order.outcome][order.tickLower].liquidityNet -= int128(order.liquidity);
        _spotTicks[marketKey][order.outcome][order.tickLower].liquidityGross -= order.liquidity;

        uint16 upperBoundary = order.tickUpper + 1 <= MAX_TICK ? order.tickUpper + 1 : MAX_TICK;
        _spotTicks[marketKey][order.outcome][upperBoundary].liquidityNet += int128(order.liquidity);
        _spotTicks[marketKey][order.outcome][upperBoundary].liquidityGross -= order.liquidity;

        // Clear bitmaps if no more liquidity
        if (_spotTicks[marketKey][order.outcome][order.tickLower].liquidityGross == 0) {
            _spotBitmaps[marketKey][order.outcome].clearBit(order.tickLower);
        }
        if (upperBoundary <= MAX_TICK && _spotTicks[marketKey][order.outcome][upperBoundary].liquidityGross == 0) {
            _spotBitmaps[marketKey][order.outcome].clearBit(upperBoundary);
        }

        // Update total liquidity
        _totalSpotLiquidity[marketKey][order.outcome] -= order.sharesTotal;

        order.active = false;

        // Return unsold shares to user
        if (sharesReturned > 0) {
            vault.unlockOutcome(m.truthMarket, msg.sender, order.outcome, sharesReturned);
        }

        emit SpotSellOrderCancelled(msg.sender, marketKey, orderId, sharesReturned, proceedsClaimed);
    }

    /**
     * @notice Execute immediate spot sell against TickBook liquidity
     * @dev This is called by users who want to sell shares NOW against existing buy orders
     * @param marketKey The market identifier
     * @param outcome Which token you're selling (0=NO, 1=YES)
     * @param shares Number of shares to sell
     * @param minProceeds Minimum USDC to receive (slippage protection)
     * @param currentTick Current tick from TickBook state
     * @param activeLiqNo Active NO liquidity at current tick
     * @param activeLiqYes Active YES liquidity at current tick
     * @return sharesSold Shares actually sold
     * @return proceeds USDC received
     * @return newTick New tick after execution
     */
    function executeSpotSell(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint256 minProceeds,
        uint16 currentTick,
        uint128 activeLiqNo,
        uint128 activeLiqYes
    ) external returns (uint256 sharesSold, uint256 proceeds, uint16 newTick) {
        Market memory m = _markets[marketKey];
        if (!m.isActive) revert NotActive();
        if (!ITruthMarket(m.truthMarket).isLive()) revert NotLive();
        if (outcome > 1) revert InvalidOutcome();
        if (shares == 0) revert ZeroAmount();

        // Only TickBook should call this with state parameters
        require(msg.sender == tickBook, "!tb");

        // Selling YES = consume buy-YES demand = makers on NO side (outcome=0)
        // Selling NO = consume buy-NO demand = makers on YES side (outcome=1)
        uint8 makerOutcome = outcome == 1 ? 0 : 1;

        if (outcome == 1) {
            // Selling YES: price moves DOWN
            (sharesSold, proceeds, newTick) = _spotSellDown(
                marketKey, m.truthMarket, currentTick, activeLiqNo, shares, makerOutcome
            );
        } else {
            // Selling NO: price moves UP
            (sharesSold, proceeds, newTick) = _spotSellUp(
                marketKey, m.truthMarket, currentTick, activeLiqYes, shares, makerOutcome
            );
        }

        if (sharesSold == 0) revert NoBuyers();
        if (proceeds < minProceeds) revert SlippageExceeded();
    }

    // ============================================
    // Internal Fill Logic
    // ============================================

    function _spotSellDown(
        bytes32 marketKey,
        address market,
        uint16 tick,
        uint128 activeLiq,
        uint256 sharesToSell,
        uint8 makerOutcome
    ) internal returns (uint256 sold, uint256 proceeds, uint16 finalTick) {
        uint256 remaining = sharesToSell;

        while (remaining > 0 && tick > MIN_TICK) {
            if (activeLiq == 0) {
                // Use TickBook's bitmap (we don't have access, so this needs delegation)
                // For now, break - the caller (TickBook) handles bitmap traversal
                break;
            }

            uint16 nextBoundary = MIN_TICK; // Simplified - actual implementation delegates to TickBook

            uint256 ticksToNext = uint256(tick - nextBoundary);
            if (ticksToNext == 0) ticksToNext = 1;
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

            // Note: maker attribution updates happen in TickBook
        }

        finalTick = tick;

        // Credit proceeds to seller
        if (proceeds > 0) {
            vault.refundMarketToAvailable(market, tx.origin, proceeds);
        }
    }

    function _spotSellUp(
        bytes32 marketKey,
        address market,
        uint16 tick,
        uint128 activeLiq,
        uint256 sharesToSell,
        uint8 makerOutcome
    ) internal returns (uint256 sold, uint256 proceeds, uint16 finalTick) {
        uint256 remaining = sharesToSell;

        while (remaining > 0 && tick < MAX_TICK) {
            if (activeLiq == 0) {
                break;
            }

            uint16 nextBoundary = MAX_TICK;

            uint256 ticksToNext = uint256(nextBoundary - tick);
            if (ticksToNext == 0) ticksToNext = 1;
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
        }

        finalTick = tick;

        if (proceeds > 0) {
            vault.refundMarketToAvailable(market, tx.origin, proceeds);
        }
    }

    // ============================================
    // Views
    // ============================================

    function getSpotOrder(bytes32 marketKey, uint256 orderId) external view returns (SpotSellOrder memory) {
        return _spotOrders[marketKey][orderId];
    }

    function getUserSpotOrders(bytes32 marketKey, address user) external view returns (uint256[] memory) {
        return _userSpotOrders[marketKey][user];
    }

    function getSpotTickInfo(bytes32 marketKey, uint8 outcome, uint16 tick) external view returns (TickInfo memory) {
        return _spotTicks[marketKey][outcome][tick];
    }

    function getTotalSpotLiquidity(bytes32 marketKey, uint8 outcome) external view returns (uint256) {
        return _totalSpotLiquidity[marketKey][outcome];
    }
}
