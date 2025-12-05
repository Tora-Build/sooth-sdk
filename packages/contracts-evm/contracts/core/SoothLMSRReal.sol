// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISoothAMM} from "./SoothInterfaces.sol";
import {wrap} from "prb-math/sd59x18/Casting.sol";
import {exp, ln} from "prb-math/sd59x18/Math.sol";
import {uEXP_MAX_INPUT, uUNIT} from "prb-math/sd59x18/Constants.sol";

/// @notice LMSR implementation using stable log-sum-exp backed by PRBMath.
/// @dev Prices and costs are calculated with 59.18 fixed-point math. This implementation
///      avoids the broken Taylor approximation used previously and works for balanced
///      and imbalanced states as long as q/b stays within PRBMath's supported exp range.
contract SoothLMSRReal is ISoothAMM {
    int256 internal constant ONE = 1e18;

    /// @dev ln(exp(a) + exp(b)) using the log-sum-exp trick.
    function _logSumExp2(int256 a, int256 b) internal pure returns (int256) {
        int256 m = a > b ? a : b;
        // exp() will revert if input > uEXP_MAX_INPUT, enforce bounds explicitly
        int256 aShifted = a - m;
        int256 bShifted = b - m;
        require(aShifted <= uEXP_MAX_INPUT && bShifted <= uEXP_MAX_INPUT, "LMSR: exp overflow");

        int256 eA = exp(wrap(aShifted)).unwrap();
        int256 eB = exp(wrap(bShifted)).unwrap();

        // Sum is in 59.18 form because both operands are.
        int256 sum = eA + eB;
        require(sum > 0, "LMSR: exp underflow");
        return ln(wrap(sum)).unwrap() + m;
    }

    /// @dev LMSR cost function C(q) = b * ln( exp(qY/b) + exp(qN/b) ).
    function _cost(int256 qYes, int256 qNo, uint256 b) internal pure returns (int256) {
        require(b > 0, "LMSR: b = 0");
        int256 bWad = int256(b);

        int256 a = (qYes * ONE) / bWad;
        int256 c = (qNo * ONE) / bWad;

        int256 lse = _logSumExp2(a, c); // WAD
        return (bWad * lse) / ONE;
    }

    function costDelta(
        State memory s,
        uint8 outcomeIndex,
        int256 deltaShares,
        uint256 b
    ) external pure override returns (int256 cost, State memory newState) {
        require(outcomeIndex < 2, "LMSR: bad outcome");
        require(deltaShares != 0, "LMSR: zero delta");

        int256 qY = s.qYes;
        int256 qN = s.qNo;

        int256 oldCost = _cost(qY, qN, b);

        if (outcomeIndex == 0) {
            qY += deltaShares;
        } else {
            qN += deltaShares;
        }

        int256 newCost = _cost(qY, qN, b);

        cost = newCost - oldCost;
        newState = State({qYes: qY, qNo: qN});
    }

    function price(
        State memory s,
        uint8 outcomeIndex,
        uint256 b
    ) external pure override returns (uint256 priceWad) {
        require(outcomeIndex < 2, "LMSR: bad outcome");
        require(b > 0, "LMSR: b = 0");

        int256 bWad = int256(b);
        int256 a = (s.qYes * ONE) / bWad;
        int256 c = (s.qNo * ONE) / bWad;

        require(a <= uEXP_MAX_INPUT && c <= uEXP_MAX_INPUT, "LMSR: exp overflow");

        int256 eY = exp(wrap(a)).unwrap();
        int256 eN = exp(wrap(c)).unwrap();

        int256 denom = eY + eN;
        require(denom > 0, "LMSR: denom");

        int256 pYes = (eY * uUNIT) / denom;

        if (outcomeIndex == 0) {
            return uint256(pYes);
        } else {
            return uint256(uUNIT - pYes);
        }
    }
}
