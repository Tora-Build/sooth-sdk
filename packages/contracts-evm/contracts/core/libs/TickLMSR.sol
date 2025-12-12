// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TickMath.sol";

/// @title TickLMSR
/// @notice Gas-efficient discrete LMSR using precomputed tick costs
/// @dev The cost to move across all ticks sums to b * ln(2) for solvency
///      This replaces the continuous LMSR that uses expensive exp/ln operations
library TickLMSR {
    using TickMath for uint16;

    /// @notice WAD precision (1e18)
    uint256 public constant WAD = 1e18;

    /// @notice ln(2) in WAD precision ≈ 0.693147... * 1e18
    uint256 public constant LN2_WAD = 693147180559945309;

    /// @notice Precomputed tick costs for LMSR
    /// @dev tickCosts[i] = marginal cost to move from tick i to tick i+1
    ///      These are computed off-chain and stored during market initialization
    ///      Sum of all tickCosts[i] for i in [0, TOTAL_TICKS-1] = LN2_WAD
    struct TickCostArray {
        uint256[1000] costs;  // Pre-computed marginal costs per tick
    }

    /// @notice Compute precomputed tick costs array (pure calculation)
    /// @dev The LMSR cost function is C(p) = b * ln(e^(p/b) + e^((1-p)/b))
    ///      For a binary LMSR, the marginal cost at probability p from buying YES is:
    ///      dC/dq_Y = p (the current probability)
    ///      So the cost to move from tick i to tick i+1 is approximately:
    ///      tickCost[i] = integral from p_i to p_{i+1} of p dp
    ///                  = (p_{i+1}^2 - p_i^2) / 2
    ///                  = tickSize * (p_i + tickSize/2)
    ///                  = tickSize * p_midpoint
    ///      
    ///      However, to ensure sum = ln(2), we use the exact LMSR formula:
    ///      tickCost[i] = ln(1 + e^(tickSize)) - ln(1 + e^(-tickSize)) evaluated at tick i
    ///      
    ///      For simplicity and gas efficiency, we use a convex approximation:
    ///      tickCost[i] ∝ (1000 - |i - 500|)^alpha where alpha controls convexity
    ///      This gives cheaper trades near extremes (0% or 100%) and more expensive near 50%
    /// @param costs Storage array to populate
    function initializeTickCosts(TickCostArray storage costs) internal {
        // Use quadratic weighting: cost is highest at center, lowest at extremes
        // The center of 1000 ticks (0-999) is between tick 499 and 500, i.e., at 499.5
        // Weight function: w(i) = maxDist^2 - dist(i)^2
        // where dist(i) = |i - 499.5| = |i - 499| - 0.5 for i >= 500, |499 - i| + 0.5 for i < 500
        // Simplified: dist(i) = |2*i - 999| / 2, so dist^2 = (2*i - 999)^2 / 4
        
        uint256 totalWeight = 0;
        uint256[1000] memory weights;
        
        // Maximum distance from center (at tick 0 or 999): 499.5
        // maxDist^2 = 499.5^2 = 249500.25, we use integer: 999*999/4 = 249500
        uint256 maxDistSq = (uint256(999) * uint256(999)) / 4;
        
        for (uint16 i = 0; i < TickMath.TOTAL_TICKS; i++) {
            // Distance from center (499.5): |2*i - 999| / 2
            // distSq = (2*i - 999)^2 / 4
            int256 twoDist = int256(uint256(i) * 2) - 999;
            uint256 distSq = uint256(twoDist * twoDist) / 4;
            
            // Weight: higher at center, lower at extremes
            // Add baseline to ensure all weights are positive
            weights[i] = maxDistSq - distSq + uint256(TickMath.TOTAL_TICKS);
            totalWeight += weights[i];
        }
        
        // Normalize so sum = LN2_WAD
        for (uint16 i = 0; i < TickMath.TOTAL_TICKS; i++) {
            costs.costs[i] = (weights[i] * LN2_WAD) / totalWeight;
        }
    }

    /// @notice Calculate cost to move from current tick to target tick
    /// @param costs The precomputed tick costs
    /// @param fromTick Current tick
    /// @param toTick Target tick
    /// @param b Liquidity parameter (in WAD)
    /// @return cost Signed cost in collateral units (positive = pay, negative = receive)
    function costToMove(
        TickCostArray storage costs,
        uint16 fromTick,
        uint16 toTick,
        uint256 b
    ) internal view returns (int256 cost) {
        if (fromTick == toTick) {
            return 0;
        }

        uint256 totalCost = 0;
        
        if (toTick > fromTick) {
            // Moving up (buying YES / probability increasing)
            for (uint16 i = fromTick; i < toTick; i++) {
                totalCost += costs.costs[i];
            }
            // Scale by b: cost = tickCost * b / WAD
            return int256((totalCost * b) / WAD);
        } else {
            // Moving down (selling YES / probability decreasing)
            for (uint16 i = toTick; i < fromTick; i++) {
                totalCost += costs.costs[i];
            }
            // Return negative (user receives money)
            return -int256((totalCost * b) / WAD);
        }
    }

    /// @notice Calculate how many ticks can be crossed with a given budget
    /// @param costs The precomputed tick costs
    /// @param fromTick Starting tick
    /// @param budget Maximum cost willing to pay (in WAD, pre-scaled by b)
    /// @param direction True = up (buy YES), False = down (sell YES)
    /// @param b Liquidity parameter (in WAD)
    /// @return toTick Final tick after consuming budget
    /// @return actualCost Actual cost consumed (always <= budget)
    function ticksFromBudget(
        TickCostArray storage costs,
        uint16 fromTick,
        uint256 budget,
        bool direction,
        uint256 b
    ) internal view returns (uint16 toTick, uint256 actualCost) {
        toTick = fromTick;
        actualCost = 0;
        
        if (direction) {
            // Moving up
            while (toTick < TickMath.TOTAL_TICKS) {
                uint256 tickCost = (costs.costs[toTick] * b) / WAD;
                if (actualCost + tickCost > budget) {
                    break;
                }
                actualCost += tickCost;
                toTick++;
            }
        } else {
            // Moving down
            while (toTick > 0) {
                uint256 tickCost = (costs.costs[toTick - 1] * b) / WAD;
                if (actualCost + tickCost > budget) {
                    break;
                }
                actualCost += tickCost;
                toTick--;
            }
        }
    }

    /// @notice Get the current YES price at a given tick
    /// @param tick Current tick
    /// @return price YES price in WAD (1e18 = 100%)
    function priceAtTick(uint16 tick) internal pure returns (uint256 price) {
        return TickMath.tickToProb(tick);
    }

    /// @notice Get the NO price at a given tick
    /// @param tick Current tick  
    /// @return price NO price in WAD (1e18 = 100%)
    function noPriceAtTick(uint16 tick) internal pure returns (uint256 price) {
        return WAD - TickMath.tickToProb(tick);
    }

    /// @notice Verify tick costs sum to ln(2) (sanity check)
    /// @param costs The tick costs array
    /// @return total Sum of all tick costs
    function verifySum(TickCostArray storage costs) internal view returns (uint256 total) {
        for (uint16 i = 0; i < TickMath.TOTAL_TICKS; i++) {
            total += costs.costs[i];
        }
        // Should be approximately LN2_WAD (allow 0.1% tolerance)
        require(
            total > (LN2_WAD * 999) / 1000 && total < (LN2_WAD * 1001) / 1000,
            "TickLMSR: costs don't sum to ln(2)"
        );
    }
}
