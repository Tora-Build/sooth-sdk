// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Simplified LMSR-like pricing for architecture & testing.
/// @dev This is NOT production-ready LMSR math. Replace with a fixed-point LMSR implementation before mainnet.
library SoothLMSR {
    struct State {
        int256 q0;
        int256 q1;
        uint256 b; // liquidity parameter (not used in this stubbed math)
    }

    /// @notice Approximate cost as price * delta.
    function calcCost(
        State memory s,
        int256 delta,
        uint8 outcomeIndex
    ) internal pure returns (int256) {
        require(outcomeIndex < 2, "bad outcome");
        (uint256 p0, uint256 p1) = prices(s);
        uint256 p = outcomeIndex == 0 ? p0 : p1;
        return (int256(p) * delta) / int256(1e18);
    }

    /// @notice Approximate price from q0-q1 difference.
    function prices(State memory s) internal pure returns (uint256 p0, uint256 p1) {
        int256 diff = s.q0 - s.q1;
        if (diff >= 0) {
            uint256 x = uint256(diff);
            if (x > 5e17) x = 5e17;
            p0 = 5e17 + x;
        } else {
            uint256 x = uint256(-diff);
            if (x > 5e17) x = 5e17;
            p0 = 5e17 - x;
        }
        if (p0 > 1e18) p0 = 1e18;
        p1 = 1e18 - p0;
    }
}
