# Research Task: Fix SoothLMSRReal Implementation

**Status:** Open  
**Priority:** Low (BalancedAMM works well)  
**Category:** Research & Optimization

---

## Problem

`SoothLMSRReal` attempts to implement true LMSR pricing but has a mathematical flaw in the `_logSumExp2` function that causes incorrect pricing at balanced market states.

### Symptoms

- At balanced markets (e.g., `qYes=1000, qNo=1000`), price should be 0.50 but calculates as ~0.06
- The error is ~8x off from expected value
- Makes markets unusable in production

### Root Cause

The `_logSumExp2` function uses a 3-term Taylor series approximation for `ln(1+u)`:

```solidity
ln(1+u) ≈ u - u²/2 + u³/3
```

This approximation is only valid for small `u` (typically `|u| < 0.5`).

At balanced probabilities:

- `exp(qY/b) ≈ 1` and `exp(qN/b) ≈ 1`
- `t = exp(qY/b) + exp(qN/b) ≈ 2`
- `u = t - 1 = 1`

**When `u = 1`, the approximation breaks down:**

- True value: `ln(2) ≈ 0.693`
- Approximation: `1 - 0.5 + 0.333 = 0.833`
- Error: ~20%

This error propagates through the derivative calculations, causing the final price to be wrong.

---

## Current Workaround

We use `SoothBalancedAMM` instead, which uses a linear approximation:

```solidity
p = 0.5 + (qYes - qNo) / (2 * b)
```

This is stable, predictable, and works correctly for all market states.

---

## Potential Solutions

### Option 1: More Taylor Series Terms

Add more terms to the Taylor expansion to improve accuracy at `u=1`:

```solidity
ln(1+u) ≈ u - u²/2 + u³/3 - u⁴/4 + u⁵/5 - u⁶/6 + ...
```

**Pros:** Simple fix  
**Cons:** Still limited range, more gas cost, convergence issues

### Option 2: Piecewise Approximation

Use different approximations for different ranges of `u`:

- For `|u| < 0.5`: Taylor series
- For `0.5 ≤ u ≤ 1.5`: Different polynomial or rational approximation
- For `u > 1.5`: Another method

**Pros:** Better accuracy across all ranges  
**Cons:** More complex, higher gas cost

### Option 3: Logarithm Library

Use a battle-tested fixed-point math library like:

- [PRBMath](https://github.com/PaulRBerg/prb-math)
- [ABDKMath64x64](https://github.com/abdk-consulting/abdk-libraries-solidity)
- [Solmate FixedPointMathLib](https://github.com/transmissions11/solmate)

**Pros:** Proven correct, optimized  
**Cons:** External dependency, may still have gas overhead

### Option 4: Simplified LMSR

Use a different LMSR approximation that avoids the log-sum-exp calculation entirely.

For example, Gnosis uses a simplified formula in some contexts:

```solidity
cost ≈ b * (ln(shares_after) - ln(shares_before))
```

**Pros:** Simpler, potentially more efficient  
**Cons:** May not be mathematically equivalent to true LMSR

---

## Research Questions

1. **Accuracy vs Gas Trade-off:** How much accuracy do we actually need? Is BalancedAMM "good enough"?

2. **Market Behavior:** Does true LMSR provide meaningful benefits over linear approximation for prediction markets?

3. **Gas Costs:** What's the gas difference between:

   - Current broken LMSR
   - Fixed LMSR with library
   - BalancedAMM

4. **Edge Cases:** Are there market states where BalancedAMM behaves poorly but true LMSR would be better?

---

## Success Criteria

A fixed `SoothLMSRReal` should:

- [ ] Price balanced markets at exactly 0.50
- [ ] Match theoretical LMSR pricing within 0.1% for all states
- [ ] Cost ≤ 150% gas compared to BalancedAMM
- [ ] Pass all existing tests
- [ ] Have new tests covering edge cases (very small/large q, extreme b values)

---

## References

- [LMSR Paper (Hanson 2003)](https://mason.gmu.edu/~rhanson/mktscore.pdf)
- [Gnosis LMSR Implementation](https://github.com/gnosis/conditional-tokens-contracts)
- [Augur's Market Maker](https://github.com/AugurProject/augur-core)
- Current implementation: `contracts/core/SoothLMSRReal.sol`

---

## Notes

- This is **not blocking** for production - BalancedAMM works well
- Consider this a "nice to have" for research/academic interest
- If pursuing, recommend starting with Option 3 (use a library)
- May want to benchmark against real prediction market data to see if true LMSR provides value
