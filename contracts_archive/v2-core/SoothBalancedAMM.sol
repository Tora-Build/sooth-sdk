// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Simple LMSR-like linear AMM used for development & testing.
/// @dev This is NOT a mathematically correct LMSR implementation.
///      It approximates price as:
///          pYes ≈ 0.5 + (qYes - qNo) / (2 * b)
///      and integrates cost as average(price_before, price_after) * delta.
///      For production, swap this for a true LMSR implementation (see SoothLMSRReal).
contract SoothBalancedAMM is ISoothAMM {
    uint256 internal constant ONE = 1e18;

    function _priceYes(State memory s, uint256 b) internal pure returns (uint256) {
        // pY = 0.5 + (qYes - qNo) / (2 * b)
        int256 num = (s.qYes - s.qNo);
        int256 denom = int256(2 * b);
        int256 frac = denom == 0 ? int256(0) : (num * int256(ONE)) / denom;
        int256 half = int256(ONE) / 2;
        int256 p = half + frac;

        if (p < int256(ONE / 100)) p = int256(ONE / 100);              // floor 0.01
        if (p > int256(ONE - ONE / 100)) p = int256(ONE - ONE / 100);  // cap 0.99
        return uint256(p);
    }

    function costDelta(
        State memory s,
        uint8 outcomeIndex,
        int256 deltaShares,
        uint256 b
    ) external pure override returns (int256 cost, State memory newState) {
        require(outcomeIndex < 2, "AMM: bad outcome");
        require(deltaShares != 0, "AMM: zero delta");

        uint256 pBefore = _priceYes(s, b);

        State memory s2 = s;
        if (outcomeIndex == 0) {
            s2.qYes += deltaShares;
        } else {
            s2.qNo += deltaShares;
        }

        uint256 pAfter = _priceYes(s2, b);
        uint256 pAvg = (pBefore + pAfter) / 2;

        int256 signedPrice = int256(pAvg);
        cost = (signedPrice * deltaShares) / int256(ONE);
        newState = s2;
    }

    function price(
        State memory s,
        uint8 outcomeIndex,
        uint256 b
    ) external pure override returns (uint256 priceWad) {
        uint256 pYes = _priceYes(s, b);
        if (outcomeIndex == 0) {
            return pYes;
        } else {
            return ONE - pYes;
        }
    }
}
