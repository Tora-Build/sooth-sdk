// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Interface skeleton for a real LMSR implementation using 60.18 fixed-point math.
/// @dev This file is intentionally minimal and assumes integration with a library like PRBMathUD60x18.
///      You must add the actual dependency and implementations before enabling it in SoothMarket.
library SoothLMSRReal {
    struct State {
        uint256 q0; // 1e18-scaled
        uint256 q1; // 1e18-scaled
        uint256 b;  // 1e18-scaled liquidity parameter
    }

    /// @notice Placeholder signature for cost computation.
    /// @param s State
    /// @param outcomeIndex 0 or 1
    /// @param deltaShares signed 60.18 amount; positive = buy, negative = sell
    /// @return cost signed 60.18: positive = pay in, negative = receive
    function cost(
        State memory s,
        uint8 outcomeIndex,
        int256 deltaShares
    ) internal pure returns (int256) {
        outcomeIndex; s; deltaShares;
        revert("SoothLMSRReal: not implemented (hook PRBMath-based LMSR here)");
    }

    /// @notice Placeholder signature for outcome price (0 or 1), 60.18 scale.
    function price(State memory s, uint8 outcomeIndex) internal pure returns (uint256) {
        s; outcomeIndex;
        revert("SoothLMSRReal: not implemented (hook PRBMath-based LMSR here)");
    }
}
