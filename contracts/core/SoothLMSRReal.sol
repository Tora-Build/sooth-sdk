// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Experimental true LMSR implementation.
/// @dev Uses the LMSR cost function
///         C(q) = b * ln( exp(q_yes / b) + exp(q_no / b) )
///      with simple fixed-point approximations for exp and ln(1+u).
///      
///      ⚠️ KNOWN ISSUE: The ln(1+u) approximation breaks down at balanced
///      market states (e.g., qYes=qNo), causing incorrect pricing (~8x off).
///      See docs/research/FIX_LMSR_IMPLEMENTATION.md for details.
///      
///      This is intended for experimentation and is NOT gas-optimized
///      or production-ready. For production, use SoothBalancedAMM.
contract SoothLMSRReal is ISoothAMM {
    int256 internal constant ONE = 1e18;

    /// @dev Approximate exp(x) for x in [-1, 1] (WAD) using 6-term Taylor series.
    function _expWad(int256 x) internal pure returns (int256) {
        require(x >= -ONE && x <= ONE, "LMSR: |x| too large");

        int256 term = ONE;
        int256 sum = ONE;

        // k = 1..6
        for (uint256 k = 1; k <= 6; k++) {
            term = (term * x) / ONE;
            term = term / int256(k);
            sum += term;
        }

        return sum;
    }

    /// @dev ln( exp(a) + exp(b) ), where a,b are WAD and reasonably small.
    ///      Uses log-sum-exp trick and ln(1+u) ≈ u - u^2/2 + u^3/3.
    function _logSumExp2(int256 a, int256 b) internal pure returns (int256) {
        // Require |a|,|b| to be in a range where exp approx is reasonable.
        int256 bound = ONE / 2; // +/-0.5
        require(a >= -bound && a <= bound, "LMSR: a out of range");
        require(b >= -bound && b <= bound, "LMSR: b out of range");

        int256 m = a > b ? a : b;
        int256 ea = _expWad(a - m);
        int256 eb = _expWad(b - m);

        int256 t = ea + eb; // in [1, 2] * 1e18 approximately
        // t = 1 + u
        int256 u = t - ONE; // u in [0, 1] * 1e18

        // ln(1 + u) ≈ u - u^2/2 + u^3/3
        int256 u2 = (u * u) / ONE;
        int256 u3 = (u2 * u) / ONE;

        int256 ln1pu = u - (u2 / 2) + (u3 / 3);

        return m + ln1pu;
    }

    /// @dev LMSR cost function C(q) = b * ln( exp(qY/b) + exp(qN/b) ).
    function _cost(int256 qYes, int256 qNo, uint256 b) internal pure returns (int256) {
        require(b > 0, "LMSR: b = 0");
        int256 bWad = int256(b);

        // scale q / b to WAD
        int256 a = (qYes * ONE) / bWad;
        int256 c = (qNo * ONE) / bWad;

        int256 lse = _logSumExp2(a, c); // WAD
        // C = b * lse / 1e18
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

        int256 bound = ONE / 2;
        require(a >= -bound && a <= bound, "LMSR: a out of range");
        require(c >= -bound && c <= bound, "LMSR: c out of range");

        int256 eY = _expWad(a);
        int256 eN = _expWad(c);

        int256 denom = eY + eN;
        require(denom > 0, "LMSR: denom");

        int256 pYes = (eY * ONE) / denom;

        if (outcomeIndex == 0) {
            return uint256(pYes);
        } else {
            return uint256(ONE - pYes);
        }
    }
}
