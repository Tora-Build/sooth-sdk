// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITickBookVault} from "./interfaces/ITickBookVault.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {TickBitmap} from "./libraries/TickBitmap.sol";
import {TickMath} from "./libraries/TickMath.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TickBookPoolManager V10
 * @notice Singleton manager for prediction market orderbooks with (tick, user) primary indexing
 * @dev V10 Changes from V9.9.6:
 *      - PRIMARY INDEX: (marketKey, outcome, tick, user) instead of orderId
 *      - SINGLE-TICK ONLY: No range orders in core (use RangeOrderHelper peripheral)
 *      - PER-TICK ACCUMULATORS: Fill growth tracked per tick, not globally per outcome
 *      - SIMPLIFIED ENUMERATION: _userTicks[] array instead of _userOrders[]
 *      - POSITION MERGING: Adding shares to existing tick merges (pro-rata dilution)
 *
 *      Order Types via tick parameter:
 *      - Market order: tick=0 (walk book, fill everything possible)
 *      - Limit order: tick=1..999 (single tick)
 */
contract TickBookPoolManagerV10 is ReentrancyGuard, Ownable {
    using TickBitmap for TickBitmap.Bitmap;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint16 private constant MIN_TICK = 1;
    uint16 private constant MAX_TICK = TickMath.MAX_TICK; // 999
    uint256 private constant Q128 = 2 ** 128;
    uint128 private constant MAX_SHARES = type(uint128).max;
    uint24 private constant MAX_FEE_BPS = 1000; // 10% max fee

    // ============================================
    // Custom Errors
    // ============================================

    error ZeroAddress();
    error MarketNotActive();
    error MarketNotLive();
    error DuplicateMarket();
    error InvalidOutcome();
    error ZeroAmount();
    error InvalidTick();
    error NotOwner();
    error UnauthorizedRegistrar();
    error PositionNotActive();
    error NoLiquidity();
    error SlippageExceeded();
    error SharesOverflow();
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

    /// @notice Position at a specific (tick, user) coordinate
    struct Position {
        uint128 shares;                    // Total shares at this tick
        uint128 collateralDepositedWad;    // Locked collateral
        uint128 filledShares;              // Already claimed fills
        uint128 collateralUsedWad;         // Collateral consumed by fills
        uint256 fillGrowthLastX128;        // Snapshot of tick's fill accumulator
        uint256 collateralGrowthLastX128;  // Snapshot of tick's collateral accumulator
    }

    /// @notice Per-tick aggregate state
    struct TickState {
        uint128 totalShares;               // Sum of all positions at this tick
        uint256 fillGrowthX128;            // Cumulative fills per share (Q128)
        uint256 collateralGrowthX128;      // Cumulative collateral used per share (Q128)
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

    // Markets
    mapping(bytes32 => Market) private _markets;

    // Primary position storage: (market, outcome, tick, user) -> Position
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => mapping(address => Position)))) private _positions;

    // Per-tick aggregates: (market, outcome, tick) -> TickState
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => TickState))) private _tickStates;

    // User tick enumeration: (market, outcome, user) -> tick[]
    mapping(bytes32 => mapping(uint8 => mapping(address => uint16[]))) private _userTicks;

    // Tick bitmap for discovery
    mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _bitmaps;

    // Access control
    address public registrar;
    address public feeRecipient;

    // Fees
    uint24 public takerFeeBps = 10;  // 0.1% default
    uint24 public makerFeeBps = 0;   // No maker fee by default

    // ============================================
    // Events
    // ============================================

    event MarketRegistered(bytes32 indexed marketKey, address market, address yesToken, address noToken);
    event RegistrarChanged(address indexed oldRegistrar, address indexed newRegistrar);
    event FeeRecipientChanged(address indexed newFeeRecipient);
    event FeesUpdated(uint24 takerFee, uint24 makerFee);

    event OrderPlaced(
        address indexed owner,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint16 tick,
        uint256 shares,
        uint256 filledShares,
        uint256 filledCost,
        uint256 restingShares
    );

    event OrderCancelled(
        address indexed owner,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint16 tick,
        uint256 sharesRemoved,
        uint256 collateralReleased
    );

    event FillsClaimed(
        address indexed owner,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint16 tick,
        uint256 filledShares,
        uint256 collateralUsedWad
    );

    event MarketOrderExecuted(
        address indexed taker,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint256 sharesFilled,
        uint256 totalCost
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

        emit MarketRegistered(marketKey, key.truthMarket, key.yesToken, key.noToken);
    }

    /// @notice Legacy signature for compatibility
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

        emit MarketRegistered(marketKey, market, yesToken, noToken);
    }

    // ============================================
    // Unified Order Placement
    // ============================================

    /**
     * @notice Place an order - unified API for limit and market orders
     * @dev Order type determined by tick:
     *      - tick=0: Market order (walk book, fill everything possible)
     *      - tick=1..999: Limit order at that tick
     *
     *      If position exists at tick, shares are ADDED with pro-rata fill dilution.
     *
     * @param marketKey The market identifier
     * @param outcome 0 = NO, 1 = YES
     * @param shares Total shares to place
     * @param tick Price tick (0 for market order, 1-999 for limit)
     * @param maxCost Maximum cost willing to pay (slippage protection)
     * @return filledShares Shares filled immediately
     * @return filledCost Cost of immediately filled shares
     * @return restingShares Shares remaining as resting order
     */
    function placeOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint16 tick,
        uint256 maxCost
    ) external nonReentrant returns (
        uint256 filledShares,
        uint256 filledCost,
        uint256 restingShares
    ) {
        Market memory m = _markets[marketKey];
        if (!m.isActive) revert MarketNotActive();
        if (!ITruthMarket(m.truthMarket).isLive()) revert MarketNotLive();
        if (outcome > 1) revert InvalidOutcome();
        if (shares == 0) revert ZeroAmount();

        if (tick == 0) {
            // Market order: walk the book
            return _executeMarketOrder(marketKey, m, outcome, shares, maxCost);
        }

        // Limit order at specific tick
        if (tick > MAX_TICK) revert InvalidTick();
        return _placeLimitOrder(marketKey, m, outcome, shares, tick, maxCost);
    }

    /**
     * @notice Execute market order by walking the book tick-by-tick
     */
    function _executeMarketOrder(
        bytes32 marketKey,
        Market memory m,
        uint8 outcome,
        uint256 shares,
        uint256 maxCost
    ) internal returns (uint256 filledShares, uint256 filledCost, uint256 restingShares) {
        uint8 opposite = outcome == 0 ? 1 : 0;

        // Direction: YES buyer walks UP (finds cheapest NO sellers)
        //            NO buyer walks DOWN (finds cheapest YES sellers)
        bool isUp = (outcome == 1);

        uint256 remaining = shares;
        uint16 tick = isUp ? MIN_TICK : MAX_TICK;

        while (remaining > 0) {
            // Find next tick with liquidity
            if (isUp) {
                tick = _bitmaps[marketKey][opposite].findNextUp(tick > MIN_TICK ? tick - 1 : 0);
                if (tick > MAX_TICK) break;
            } else {
                tick = _bitmaps[marketKey][opposite].findNextDown(tick < MAX_TICK ? tick + 1 : MAX_TICK + 1);
                if (tick == 0 || tick > MAX_TICK) break;
            }

            TickState storage tickState = _tickStates[marketKey][opposite][tick];
            uint128 availableAtTick = tickState.totalShares;
            if (availableAtTick == 0) {
                tick = isUp ? tick + 1 : tick - 1;
                continue;
            }

            // Calculate how much we can fill at this tick
            uint256 fillAtTick = remaining < availableAtTick ? remaining : availableAtTick;

            // Calculate cost for this tick
            // YES buyer pays YES price, NO buyer pays NO price
            uint256 tickPrice = TickMath.tickToProbability(tick);
            uint256 costAtTick;
            if (outcome == 1) {
                // Buying YES from NO sellers: pay (1 - NO_price) = YES implied price
                costAtTick = ((WAD - tickPrice) * fillAtTick) / WAD;
            } else {
                // Buying NO from YES sellers: pay (1 - YES_price) = NO implied price
                costAtTick = ((WAD - tickPrice) * fillAtTick) / WAD;
            }

            // Check slippage
            if (filledCost + costAtTick > maxCost) {
                // Partial fill up to maxCost
                uint256 remainingBudget = maxCost - filledCost;
                uint256 pricePerShare = outcome == 1 ? (WAD - tickPrice) : (WAD - tickPrice);
                fillAtTick = (remainingBudget * WAD) / pricePerShare;
                if (fillAtTick == 0) break;
                costAtTick = (pricePerShare * fillAtTick) / WAD;
            }

            // Update per-tick accumulators for makers
            if (tickState.totalShares > 0) {
                tickState.fillGrowthX128 += (fillAtTick * Q128) / tickState.totalShares;
                tickState.collateralGrowthX128 += (costAtTick * Q128) / tickState.totalShares;
            }

            // Reduce tick liquidity
            tickState.totalShares -= uint128(fillAtTick);

            // Clear bitmap if tick is now empty
            if (tickState.totalShares == 0) {
                _bitmaps[marketKey][opposite].clearBit(tick);
            }

            filledShares += fillAtTick;
            filledCost += costAtTick;
            remaining -= fillAtTick;

            // Move to next tick
            tick = isUp ? tick + 1 : tick - 1;
        }

        if (filledShares == 0) revert NoLiquidity();

        // Transfer payment and credit shares
        vault.spendAvailableToMarket(msg.sender, m.truthMarket, filledCost);
        vault.creditOutcome(m.truthMarket, msg.sender, outcome, filledShares);

        restingShares = shares - filledShares;

        emit MarketOrderExecuted(msg.sender, marketKey, outcome, filledShares, filledCost);
    }

    /**
     * @notice Place a limit order at a specific tick
     */
    function _placeLimitOrder(
        bytes32 marketKey,
        Market memory m,
        uint8 outcome,
        uint256 shares,
        uint16 tick,
        uint256 maxCost
    ) internal returns (uint256 filledShares, uint256 filledCost, uint256 restingShares) {
        if (shares > MAX_SHARES) revert SharesOverflow();

        // Calculate collateral required
        uint256 collateral = _calculateCollateral(outcome, tick, shares);
        if (collateral > maxCost) revert SlippageExceeded();

        // Try crossing with opposite liquidity first
        (filledShares, filledCost) = _tryCrossAtTick(marketKey, m, outcome, tick, shares);
        restingShares = shares - filledShares;

        // If shares remain, add to position
        if (restingShares > 0) {
            Position storage pos = _positions[marketKey][outcome][tick][msg.sender];
            TickState storage tickState = _tickStates[marketKey][outcome][tick];

            // If new position at this tick, add to user's tick list
            if (pos.shares == 0) {
                _addUserTick(marketKey, outcome, msg.sender, tick);
                // Initialize accumulator snapshots
                pos.fillGrowthLastX128 = tickState.fillGrowthX128;
                pos.collateralGrowthLastX128 = tickState.collateralGrowthX128;
            } else {
                // Existing position - claim pending fills first (pro-rata dilution)
                _claimPositionFills(marketKey, m, outcome, tick, msg.sender);
            }

            // Calculate collateral for resting shares
            uint256 restingCollateral = _calculateCollateral(outcome, tick, restingShares);

            // Add shares to position
            pos.shares += uint128(restingShares);
            pos.collateralDepositedWad += uint128(restingCollateral);

            // Update tick aggregate
            bool wasEmpty = tickState.totalShares == 0;
            tickState.totalShares += uint128(restingShares);

            // Set bitmap if tick was empty
            if (wasEmpty) {
                _bitmaps[marketKey][outcome].setBit(tick);
            }
        }

        // Transfer collateral (for both filled and resting)
        uint256 totalCollateral = filledCost + (restingShares > 0 ? _calculateCollateral(outcome, tick, restingShares) : 0);
        vault.spendAvailableToMarket(msg.sender, m.truthMarket, totalCollateral);

        // Credit immediately filled shares
        if (filledShares > 0) {
            vault.creditOutcome(m.truthMarket, msg.sender, outcome, filledShares);
        }

        emit OrderPlaced(msg.sender, marketKey, outcome, tick, shares, filledShares, filledCost, restingShares);
    }

    /**
     * @notice Try crossing at a specific tick with opposite liquidity
     */
    function _tryCrossAtTick(
        bytes32 marketKey,
        Market memory m,
        uint8 outcome,
        uint16 tick,
        uint256 shares
    ) internal returns (uint256 crossedShares, uint256 crossedCost) {
        uint8 opposite = outcome == 0 ? 1 : 0;

        // Find crossable opposite tick
        // YES at Y crosses with NO at N when Y + N >= 1000
        // For YES order at tick Y: find NO ticks N where N >= 1000 - Y
        // For NO order at tick N: find YES ticks Y where Y >= 1000 - N

        uint16 minCrossableTick = tick <= 999 ? 1000 - tick : 1;
        if (minCrossableTick > MAX_TICK) return (0, 0);

        // Find best opposite tick (highest for crossing)
        uint16 oppTick;
        if (outcome == 1) {
            // YES order: find highest NO tick >= minCrossableTick
            oppTick = _bitmaps[marketKey][opposite].findNextDown(MAX_TICK + 1);
        } else {
            // NO order: find highest YES tick >= minCrossableTick
            oppTick = _bitmaps[marketKey][opposite].findNextDown(MAX_TICK + 1);
        }

        if (oppTick == 0 || oppTick > MAX_TICK) return (0, 0);
        if (tick + oppTick < 1000) return (0, 0); // No crossing possible

        TickState storage oppTickState = _tickStates[marketKey][opposite][oppTick];
        uint128 oppAvailable = oppTickState.totalShares;
        if (oppAvailable == 0) return (0, 0);

        // Calculate crossing amount
        crossedShares = shares < oppAvailable ? shares : oppAvailable;

        // Calculate cross price (midpoint)
        uint256 myPrice = TickMath.tickToProbability(tick);
        uint256 oppPrice = WAD - TickMath.tickToProbability(oppTick);
        uint256 crossPrice = (myPrice + oppPrice) / 2;
        crossedCost = (crossPrice * crossedShares) / WAD;

        // Update opposite tick accumulators
        if (oppTickState.totalShares > 0) {
            uint256 oppCost = ((WAD - crossPrice) * crossedShares) / WAD;
            oppTickState.fillGrowthX128 += (crossedShares * Q128) / oppTickState.totalShares;
            oppTickState.collateralGrowthX128 += (oppCost * Q128) / oppTickState.totalShares;
        }

        // Reduce opposite tick liquidity
        oppTickState.totalShares -= uint128(crossedShares);
        if (oppTickState.totalShares == 0) {
            _bitmaps[marketKey][opposite].clearBit(oppTick);
        }

        // Credit opposite outcome to maker (opposite of what taker gets)
        // Taker gets `outcome`, makers get `opposite`
        // But actually: makers already have `opposite` position, they receive the fill
    }

    // ============================================
    // Cancel Order
    // ============================================

    /**
     * @notice Cancel position at a specific tick
     */
    function cancelOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tick
    ) external nonReentrant returns (uint256 collateralReleased) {
        Position storage pos = _positions[marketKey][outcome][tick][msg.sender];
        if (pos.shares == 0) revert PositionNotActive();

        Market memory m = _markets[marketKey];

        // Claim any pending fills first
        _claimPositionFills(marketKey, m, outcome, tick, msg.sender);

        uint256 sharesRemoved = pos.shares;

        // Calculate collateral to release
        collateralReleased = pos.collateralDepositedWad > pos.collateralUsedWad
            ? pos.collateralDepositedWad - pos.collateralUsedWad
            : 0;

        // Update tick aggregate
        TickState storage tickState = _tickStates[marketKey][outcome][tick];
        tickState.totalShares -= pos.shares;

        // Clear bitmap if tick is now empty
        if (tickState.totalShares == 0) {
            _bitmaps[marketKey][outcome].clearBit(tick);
        }

        // Remove from user's tick list
        _removeUserTick(marketKey, outcome, msg.sender, tick);

        // Clear position
        delete _positions[marketKey][outcome][tick][msg.sender];

        // Release collateral
        if (collateralReleased > 0) {
            vault.refundMarketToAvailable(m.truthMarket, msg.sender, collateralReleased);
        }

        emit OrderCancelled(msg.sender, marketKey, outcome, tick, sharesRemoved, collateralReleased);
    }

    // ============================================
    // Claims
    // ============================================

    /**
     * @notice Claim fills from a specific position
     */
    function claimFills(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tick
    ) external returns (uint256 filledShares, uint256 collateralUsedWad) {
        Market memory m = _markets[marketKey];
        return _claimPositionFills(marketKey, m, outcome, tick, msg.sender);
    }

    /**
     * @notice Claim fills from all user positions in a market
     */
    function claimAllFills(bytes32 marketKey)
        external
        returns (uint256 totalFilledShares, uint256 totalCollateralUsed)
    {
        Market memory m = _markets[marketKey];

        // Claim from both outcomes
        for (uint8 outcome = 0; outcome <= 1; outcome++) {
            uint16[] storage ticks = _userTicks[marketKey][outcome][msg.sender];
            for (uint256 i = 0; i < ticks.length; i++) {
                (uint256 filled, uint256 used) = _claimPositionFills(marketKey, m, outcome, ticks[i], msg.sender);
                totalFilledShares += filled;
                totalCollateralUsed += used;
            }
        }
    }

    /**
     * @notice Internal: claim fills for a position
     */
    function _claimPositionFills(
        bytes32 marketKey,
        Market memory m,
        uint8 outcome,
        uint16 tick,
        address user
    ) internal returns (uint256 filledShares, uint256 collateralUsedWad) {
        Position storage pos = _positions[marketKey][outcome][tick][user];
        if (pos.shares == 0) return (0, 0);

        TickState storage tickState = _tickStates[marketKey][outcome][tick];

        // Calculate fills since last snapshot
        uint256 currentFillGrowth = tickState.fillGrowthX128;
        uint256 lastFillGrowth = pos.fillGrowthLastX128;

        if (currentFillGrowth > lastFillGrowth) {
            uint256 deltaGrowth = currentFillGrowth - lastFillGrowth;
            filledShares = (deltaGrowth * pos.shares) / Q128;

            // Cap at remaining unfilled shares
            uint256 maxFillable = pos.shares - pos.filledShares;
            if (filledShares > maxFillable) {
                filledShares = maxFillable;
            }

            pos.fillGrowthLastX128 = currentFillGrowth;
        }

        // Calculate collateral used
        uint256 currentCollateralGrowth = tickState.collateralGrowthX128;
        uint256 lastCollateralGrowth = pos.collateralGrowthLastX128;

        if (currentCollateralGrowth > lastCollateralGrowth) {
            uint256 deltaGrowth = currentCollateralGrowth - lastCollateralGrowth;
            collateralUsedWad = (deltaGrowth * pos.shares) / Q128;

            pos.collateralGrowthLastX128 = currentCollateralGrowth;
        }

        // Update position
        if (filledShares > 0) {
            pos.filledShares += uint128(filledShares);
            // Credit opposite outcome tokens (maker receives opposite of their position)
            uint8 receivedOutcome = outcome == 0 ? 1 : 0;
            vault.creditOutcome(m.truthMarket, user, receivedOutcome, filledShares);
        }

        if (collateralUsedWad > 0) {
            pos.collateralUsedWad += uint128(collateralUsedWad);
        }

        // Auto-complete if fully filled
        if (pos.filledShares >= pos.shares) {
            // Release remaining collateral
            uint256 refund = pos.collateralDepositedWad > pos.collateralUsedWad
                ? pos.collateralDepositedWad - pos.collateralUsedWad
                : 0;

            // Update tick state
            tickState.totalShares -= pos.shares;
            if (tickState.totalShares == 0) {
                _bitmaps[marketKey][outcome].clearBit(tick);
            }

            // Remove from user's tick list
            _removeUserTick(marketKey, outcome, user, tick);

            // Clear position
            delete _positions[marketKey][outcome][tick][user];

            // Release collateral
            if (refund > 0) {
                vault.refundMarketToAvailable(m.truthMarket, user, refund);
            }
        }

        if (filledShares > 0 || collateralUsedWad > 0) {
            emit FillsClaimed(user, marketKey, outcome, tick, filledShares, collateralUsedWad);
        }
    }

    // ============================================
    // User Tick Enumeration
    // ============================================

    function _addUserTick(bytes32 marketKey, uint8 outcome, address user, uint16 tick) internal {
        uint16[] storage ticks = _userTicks[marketKey][outcome][user];
        // Check if already present
        for (uint256 i = 0; i < ticks.length; i++) {
            if (ticks[i] == tick) return;
        }
        ticks.push(tick);
    }

    function _removeUserTick(bytes32 marketKey, uint8 outcome, address user, uint16 tick) internal {
        uint16[] storage ticks = _userTicks[marketKey][outcome][user];
        for (uint256 i = 0; i < ticks.length; i++) {
            if (ticks[i] == tick) {
                // Swap with last and pop
                ticks[i] = ticks[ticks.length - 1];
                ticks.pop();
                return;
            }
        }
    }

    // ============================================
    // Internal Helpers
    // ============================================

    function _getPoolKey(PoolKey calldata key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key.truthMarket, key.yesToken, key.noToken));
    }

    /**
     * @notice Calculate collateral required for an order
     * @dev YES order: collateral = shares * (1 - tick/1000) [pays if NO wins]
     *      NO order: collateral = shares * tick/1000 [pays if YES wins]
     */
    function _calculateCollateral(
        uint8 outcome,
        uint16 tick,
        uint256 shares
    ) internal pure returns (uint256) {
        uint256 prob = TickMath.tickToProbability(tick);
        if (outcome == 1) {
            // YES: risk is if NO wins, pay (1 - prob) per share
            return ((WAD - prob) * shares) / WAD;
        } else {
            // NO: risk is if YES wins, pay prob per share
            return (prob * shares) / WAD;
        }
    }

    // ============================================
    // View Functions
    // ============================================

    function getMarket(bytes32 marketKey) external view returns (Market memory) {
        return _markets[marketKey];
    }

    function getPosition(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tick,
        address user
    ) external view returns (Position memory) {
        return _positions[marketKey][outcome][tick][user];
    }

    function getTickState(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tick
    ) external view returns (TickState memory) {
        return _tickStates[marketKey][outcome][tick];
    }

    function getUserTicks(
        bytes32 marketKey,
        uint8 outcome,
        address user
    ) external view returns (uint16[] memory) {
        return _userTicks[marketKey][outcome][user];
    }

    /**
     * @notice Get pending fills for a position (view only)
     */
    function getPendingFills(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tick,
        address user
    ) external view returns (uint256 pendingShares, uint256 pendingCollateralUsed) {
        Position storage pos = _positions[marketKey][outcome][tick][user];
        if (pos.shares == 0) return (0, 0);

        TickState storage tickState = _tickStates[marketKey][outcome][tick];

        if (tickState.fillGrowthX128 > pos.fillGrowthLastX128) {
            uint256 delta = tickState.fillGrowthX128 - pos.fillGrowthLastX128;
            pendingShares = (delta * pos.shares) / Q128;
            uint256 maxFillable = pos.shares - pos.filledShares;
            if (pendingShares > maxFillable) pendingShares = maxFillable;
        }

        if (tickState.collateralGrowthX128 > pos.collateralGrowthLastX128) {
            uint256 delta = tickState.collateralGrowthX128 - pos.collateralGrowthLastX128;
            pendingCollateralUsed = (delta * pos.shares) / Q128;
        }
    }

    /**
     * @notice Get total liquidity at a tick
     */
    function getLiquidityAtTick(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tick
    ) external view returns (uint128) {
        return _tickStates[marketKey][outcome][tick].totalShares;
    }

    /**
     * @notice Find best bid/ask tick for an outcome
     */
    function getBestTick(
        bytes32 marketKey,
        uint8 outcome,
        bool isBid
    ) external view returns (uint16) {
        if (isBid) {
            return _bitmaps[marketKey][outcome].findNextDown(MAX_TICK + 1);
        } else {
            return _bitmaps[marketKey][outcome].findNextUp(0);
        }
    }
}
