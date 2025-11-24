// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SoothLMSR - simplified LMSR library
/// @notice NOTE: This uses a simplified approximation for demo/testing only.
///         Replace with a robust fixed-point implementation before mainnet.
library SoothLMSR {
    struct State {
        int256 q0;
        int256 q1;
        uint256 b;
    }

    function calcCost(
        State memory s,
        int256 delta,
        uint8 outcomeIndex
    ) internal pure returns (int256) {
        require(outcomeIndex < 2, "SoothLMSR: bad outcome");
        // This is a placeholder linearized approximation: cost = price * delta
        // Replace with proper LMSR cost function in production.
        (uint256 p0, /*p1*/) = prices(s);
        uint256 price = outcomeIndex == 0 ? p0 : (1e18 - p0);
        int256 signedPrice = int256(price);
        return (signedPrice * delta) / int256(1e18);
    }

    function prices(State memory s) internal pure returns (uint256 p0, uint256 p1) {
        // Placeholder: sigmoid-like based on q0-q1
        int256 diff = s.q0 - s.q1;
        if (diff >= 0) {
            uint256 x = uint256(diff) + 1;
            if (x > 1e18) x = 1e18;
            p0 = 5e17 + x / 2;
        } else {
            uint256 x = uint256(-diff) + 1;
            if (x > 1e18) x = 1e18;
            p0 = 5e17 - x / 2;
        }
        if (p0 > 1e18) p0 = 1e18;
        p1 = 1e18 - p0;
    }
}
