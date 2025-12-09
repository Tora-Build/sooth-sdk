// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TickMath
/// @notice Pure utility library for tick ↔ probability conversions
/// @dev Tick 0 = probability 0 (0%), Tick 1000 = probability 1e18 (100%)
///      Each tick represents 10 bps (0.1%) probability increment
library TickMath {
    /// @notice Total number of ticks in the probability space [0, 1]
    uint16 public constant TOTAL_TICKS = 1000;
    
    /// @notice Probability precision (1e18 = 100%)
    uint256 public constant PROB_PRECISION = 1e18;
    
    /// @notice Tick size in probability units (1e18 / 1000 = 1e15 = 0.1%)
    uint256 public constant TICK_SIZE = PROB_PRECISION / TOTAL_TICKS;

    /// @notice Convert tick index to probability
    /// @param tick Tick index [0, TOTAL_TICKS]
    /// @return prob Probability in WAD (1e18 precision)
    function tickToProb(uint16 tick) internal pure returns (uint256 prob) {
        require(tick <= TOTAL_TICKS, "TickMath: tick out of range");
        // Linear mapping: tick * (1e18 / TOTAL_TICKS)
        return uint256(tick) * TICK_SIZE;
    }

    /// @notice Convert probability to tick index (rounds down)
    /// @param prob Probability in WAD (1e18 precision)
    /// @return tick Tick index [0, TOTAL_TICKS]
    function probToTick(uint256 prob) internal pure returns (uint16 tick) {
        require(prob <= PROB_PRECISION, "TickMath: prob out of range");
        // Round down: prob / TICK_SIZE
        return uint16(prob / TICK_SIZE);
    }

    /// @notice Convert probability to nearest tick (rounds to nearest)
    /// @param prob Probability in WAD (1e18 precision)
    /// @return tick Tick index [0, TOTAL_TICKS]
    function probToTickRound(uint256 prob) internal pure returns (uint16 tick) {
        require(prob <= PROB_PRECISION, "TickMath: prob out of range");
        // Round to nearest: (prob + TICK_SIZE/2) / TICK_SIZE
        uint256 rounded = (prob + TICK_SIZE / 2) / TICK_SIZE;
        // Clamp to max tick
        if (rounded > TOTAL_TICKS) {
            return TOTAL_TICKS;
        }
        return uint16(rounded);
    }

    /// @notice Get the next tick above (toward higher probability)
    /// @param tick Current tick
    /// @return nextTick Next tick, clamped to TOTAL_TICKS
    function nextTickUp(uint16 tick) internal pure returns (uint16 nextTick) {
        if (tick >= TOTAL_TICKS) {
            return TOTAL_TICKS;
        }
        return tick + 1;
    }

    /// @notice Get the next tick below (toward lower probability)
    /// @param tick Current tick
    /// @return nextTick Next tick, clamped to 0
    function nextTickDown(uint16 tick) internal pure returns (uint16 nextTick) {
        if (tick == 0) {
            return 0;
        }
        return tick - 1;
    }

    /// @notice Check if two ticks are adjacent
    /// @param tickA First tick
    /// @param tickB Second tick
    /// @return True if |tickA - tickB| == 1
    function isAdjacent(uint16 tickA, uint16 tickB) internal pure returns (bool) {
        if (tickA > tickB) {
            return tickA - tickB == 1;
        }
        return tickB - tickA == 1;
    }

    /// @notice Calculate number of ticks between two ticks
    /// @param fromTick Starting tick
    /// @param toTick Ending tick
    /// @return distance Absolute distance in ticks
    function tickDistance(uint16 fromTick, uint16 toTick) internal pure returns (uint16 distance) {
        if (fromTick > toTick) {
            return fromTick - toTick;
        }
        return toTick - fromTick;
    }

    /// @notice Get the midpoint tick (tick 500 = 50% probability)
    /// @return Midpoint tick index
    function midTick() internal pure returns (uint16) {
        return TOTAL_TICKS / 2;
    }
}
