// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITickBookPoolManagerV10} from "../interfaces/ITickBookPoolManagerV10.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title RangeOrderHelper
 * @notice Peripheral contract for placing range orders on TickBookPoolManager V10
 * @dev V10's core only supports single-tick positions. This helper enables range orders
 *      by splitting them into multiple single-tick positions.
 *
 *      Benefits of core/peripheral split:
 *      - Core stays simple and auditable
 *      - Peripheral can evolve without core changes
 *      - Gas: range helper batches calls in single tx
 *      - Frontend can call core directly or use helper
 */
contract RangeOrderHelper {
    // ============================================
    // Errors
    // ============================================

    error InvalidTickRange();
    error ZeroShares();
    error ArrayLengthMismatch();

    // ============================================
    // State
    // ============================================

    ITickBookPoolManagerV10 public immutable tickbook;

    // ============================================
    // Events
    // ============================================

    event RangeOrderPlaced(
        address indexed owner,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 totalShares,
        uint256 totalFilledShares,
        uint256 totalFilledCost
    );

    event RangeCancelled(
        address indexed owner,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 totalCollateralReleased
    );

    event RangeClaimed(
        address indexed owner,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 totalFilledShares,
        uint256 totalCollateralUsed
    );

    // ============================================
    // Constructor
    // ============================================

    constructor(address _tickbook) {
        tickbook = ITickBookPoolManagerV10(_tickbook);
    }

    // ============================================
    // Range Order Placement
    // ============================================

    /**
     * @notice Place liquidity across a tick range
     * @dev Splits totalShares evenly across all ticks in range.
     *      Shares per tick = totalShares / numTicks (remainder goes to last tick)
     *
     * @param marketKey The market identifier
     * @param outcome 0 = NO, 1 = YES
     * @param tickLower Lower tick bound (inclusive)
     * @param tickUpper Upper tick bound (inclusive)
     * @param totalShares Total shares to distribute across range
     * @param maxCost Maximum total cost for all positions
     * @return totalFilledShares Total shares filled immediately via crossing
     * @return totalFilledCost Total cost of immediately filled shares
     * @return totalRestingShares Total shares remaining as resting orders
     */
    function placeRangeOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 totalShares,
        uint256 maxCost
    ) external returns (
        uint256 totalFilledShares,
        uint256 totalFilledCost,
        uint256 totalRestingShares
    ) {
        if (tickLower > tickUpper) revert InvalidTickRange();
        if (tickLower == 0 || tickUpper > 999) revert InvalidTickRange();
        if (totalShares == 0) revert ZeroShares();

        uint256 numTicks = uint256(tickUpper) - uint256(tickLower) + 1;
        uint256 sharesPerTick = totalShares / numTicks;
        uint256 remainder = totalShares % numTicks;

        uint256 costBudget = maxCost;

        for (uint16 tick = tickLower; tick <= tickUpper; tick++) {
            uint256 tickShares = sharesPerTick;
            // Add remainder to last tick
            if (tick == tickUpper) {
                tickShares += remainder;
            }

            if (tickShares == 0) continue;

            (uint256 filled, uint256 cost, uint256 resting) = tickbook.placeOrder(
                marketKey,
                outcome,
                tickShares,
                tick,
                costBudget
            );

            totalFilledShares += filled;
            totalFilledCost += cost;
            totalRestingShares += resting;

            // Reduce budget
            if (cost < costBudget) {
                costBudget -= cost;
            } else {
                costBudget = 0;
            }
        }

        emit RangeOrderPlaced(
            msg.sender,
            marketKey,
            outcome,
            tickLower,
            tickUpper,
            totalShares,
            totalFilledShares,
            totalFilledCost
        );
    }

    /**
     * @notice Place orders at specific ticks (non-uniform distribution)
     * @param marketKey The market identifier
     * @param outcome 0 = NO, 1 = YES
     * @param ticks Array of ticks to place orders at
     * @param sharesPerTick Array of shares for each tick
     * @param maxCostPerTick Array of max cost for each tick
     */
    function placeMultiTickOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint16[] calldata ticks,
        uint256[] calldata sharesPerTick,
        uint256[] calldata maxCostPerTick
    ) external returns (
        uint256 totalFilledShares,
        uint256 totalFilledCost,
        uint256 totalRestingShares
    ) {
        if (ticks.length != sharesPerTick.length) revert ArrayLengthMismatch();
        if (ticks.length != maxCostPerTick.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < ticks.length; i++) {
            if (sharesPerTick[i] == 0) continue;

            (uint256 filled, uint256 cost, uint256 resting) = tickbook.placeOrder(
                marketKey,
                outcome,
                sharesPerTick[i],
                ticks[i],
                maxCostPerTick[i]
            );

            totalFilledShares += filled;
            totalFilledCost += cost;
            totalRestingShares += resting;
        }
    }

    // ============================================
    // Range Cancellation
    // ============================================

    /**
     * @notice Cancel all positions in a tick range
     * @param marketKey The market identifier
     * @param outcome 0 = NO, 1 = YES
     * @param tickLower Lower tick bound (inclusive)
     * @param tickUpper Upper tick bound (inclusive)
     * @return totalCollateralReleased Total collateral returned
     */
    function cancelRange(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper
    ) external returns (uint256 totalCollateralReleased) {
        if (tickLower > tickUpper) revert InvalidTickRange();

        for (uint16 tick = tickLower; tick <= tickUpper; tick++) {
            // Check if user has position at this tick
            ITickBookPoolManagerV10.Position memory pos = tickbook.getPosition(
                marketKey,
                outcome,
                tick,
                msg.sender
            );

            if (pos.shares > 0) {
                uint256 released = tickbook.cancelOrder(marketKey, outcome, tick);
                totalCollateralReleased += released;
            }
        }

        emit RangeCancelled(
            msg.sender,
            marketKey,
            outcome,
            tickLower,
            tickUpper,
            totalCollateralReleased
        );
    }

    /**
     * @notice Cancel positions at specific ticks
     */
    function cancelMultipleTicks(
        bytes32 marketKey,
        uint8 outcome,
        uint16[] calldata ticks
    ) external returns (uint256 totalCollateralReleased) {
        for (uint256 i = 0; i < ticks.length; i++) {
            ITickBookPoolManagerV10.Position memory pos = tickbook.getPosition(
                marketKey,
                outcome,
                ticks[i],
                msg.sender
            );

            if (pos.shares > 0) {
                uint256 released = tickbook.cancelOrder(marketKey, outcome, ticks[i]);
                totalCollateralReleased += released;
            }
        }
    }

    // ============================================
    // Range Claims
    // ============================================

    /**
     * @notice Claim fills from all positions in a tick range
     * @param marketKey The market identifier
     * @param outcome 0 = NO, 1 = YES
     * @param tickLower Lower tick bound (inclusive)
     * @param tickUpper Upper tick bound (inclusive)
     * @return totalFilledShares Total shares claimed
     * @return totalCollateralUsed Total collateral consumed
     */
    function claimRange(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper
    ) external returns (uint256 totalFilledShares, uint256 totalCollateralUsed) {
        if (tickLower > tickUpper) revert InvalidTickRange();

        for (uint16 tick = tickLower; tick <= tickUpper; tick++) {
            ITickBookPoolManagerV10.Position memory pos = tickbook.getPosition(
                marketKey,
                outcome,
                tick,
                msg.sender
            );

            if (pos.shares > 0) {
                (uint256 filled, uint256 used) = tickbook.claimFills(marketKey, outcome, tick);
                totalFilledShares += filled;
                totalCollateralUsed += used;
            }
        }

        emit RangeClaimed(
            msg.sender,
            marketKey,
            outcome,
            tickLower,
            tickUpper,
            totalFilledShares,
            totalCollateralUsed
        );
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice Get total shares across a tick range for a user
     */
    function getRangePosition(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        address user
    ) external view returns (
        uint256 totalShares,
        uint256 totalCollateralDeposited,
        uint256 totalFilledShares,
        uint256 totalCollateralUsed
    ) {
        for (uint16 tick = tickLower; tick <= tickUpper; tick++) {
            ITickBookPoolManagerV10.Position memory pos = tickbook.getPosition(
                marketKey,
                outcome,
                tick,
                user
            );

            totalShares += pos.shares;
            totalCollateralDeposited += pos.collateralDepositedWad;
            totalFilledShares += pos.filledShares;
            totalCollateralUsed += pos.collateralUsedWad;
        }
    }

    /**
     * @notice Get pending fills across a tick range for a user
     */
    function getRangePendingFills(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        address user
    ) external view returns (uint256 totalPendingShares, uint256 totalPendingCollateralUsed) {
        for (uint16 tick = tickLower; tick <= tickUpper; tick++) {
            (uint256 pending, uint256 collateral) = tickbook.getPendingFills(
                marketKey,
                outcome,
                tick,
                user
            );
            totalPendingShares += pending;
            totalPendingCollateralUsed += collateral;
        }
    }

    /**
     * @notice Get total liquidity across a tick range
     */
    function getRangeLiquidity(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper
    ) external view returns (uint256 totalLiquidity) {
        for (uint16 tick = tickLower; tick <= tickUpper; tick++) {
            totalLiquidity += tickbook.getLiquidityAtTick(marketKey, outcome, tick);
        }
    }
}
