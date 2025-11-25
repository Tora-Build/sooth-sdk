// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SoothLMSR
/// @notice Two-outcome linearized bonding curve (safe, overflow-free).
///         This is a simplified curve: price = 0.5 + (q0 - q1)/(2 * b), clamped to [0,1].
///         It integrates cost over the price segment to prevent free round-trips while
///         avoiding the overflow risk of exp/ln implementations on-chain.
library SoothLMSR {
    struct State {
        int256 q0;
        int256 q1;
        uint256 b;
    }

    /// @dev Calculate the cost (positive) or payout (negative) for a trade.
    /// Uses the integral of the linear price curve between start and end positions.
    function calcCost(
        State memory s,
        int256 delta,
        uint8 outcomeIndex
    ) internal pure returns (int256) {
        require(outcomeIndex < 2, "bad outcome");
        require(s.b > 0, "bad b");

        int256 q0 = s.q0;
        int256 q1 = s.q1;
        if (outcomeIndex == 0) {
            q0 += delta;
        } else {
            q1 += delta;
        }

        int256 diffBefore = s.q0 - s.q1;
        int256 diffAfter = q0 - q1;

        int256 pStart = _priceFromDiff(diffBefore, s.b);
        int256 pEnd = _priceFromDiff(diffAfter, s.b);

        // Trapezoidal area between start/end prices times delta.
        // cost = (pStart + pEnd) / 2 * delta
        return ((pStart + pEnd) * delta) / 2 / int256(1e18);
    }

    function prices(State memory s) internal pure returns (uint256 p0, uint256 p1) {
        require(s.b > 0, "bad b");
        int256 diff = s.q0 - s.q1;
        int256 p0Int = _priceFromDiff(diff, s.b);
        if (p0Int < 0) p0 = 0;
        else if (p0Int > int256(1e18)) p0 = 1e18;
        else p0 = uint256(p0Int);
        p1 = 1e18 - p0;
    }

    function _priceFromDiff(int256 diff, uint256 b) private pure returns (int256) {
        // price = 0.5 + diff / (2 * b)
        int256 scaled = (diff * int256(1e18)) / int256(b);
        int256 p = int256(5e17) + scaled / 2;
        if (p < 0) return 0;
        if (p > int256(1e18)) return int256(1e18);
        return p;
    }
}
