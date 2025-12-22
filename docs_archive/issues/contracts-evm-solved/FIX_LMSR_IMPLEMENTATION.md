# Research Task: Fix SoothLMSRReal Implementation

**Status:** Fixed (PRBMath-backed log-sum-exp)  
**Priority:** Low (BalancedAMM still preferred for prod)  
**Category:** Research & Optimization

---

## Problem (Resolved)

`SoothLMSRReal` used a 3-term Taylor approximation for `ln(1+u)` inside `_logSumExp2`, which broke at balanced states (u≈1) and produced ~20% error (e.g., price ≈0.06 instead of 0.50 when qYes=qNo).

## Fix Implemented

- **Library swap:** Integrated PRBMath SD59x18 for `exp`/`ln` and implemented a proper log-sum-exp.
- **Stable calculations:** `_logSumExp2` now uses `ln(exp(a) + exp(b))` with the `max-shift` trick; no more Taylor approximation.
- **Bounds:** Inputs to `exp` are clamped to PRBMath’s safe range (reverts with `"LMSR: exp overflow"` if q/b is too large).
- **Tests:** Added `test/SoothLMSRReal.t.sol`:
  - Balanced price ~0.5 for both outcomes
  - Price moves correctly with imbalance
  - Buy-then-sell round trip nets ~0

## Current Behavior

- Balanced state (qYes=qNo) prices at ~0.5 as expected.
- Pricing and cost remain symmetric and stable for typical ranges (q/b within PRBMath `exp` bounds).
- LMSR is still more expensive than the linear AMM; BalancedAMM remains the production default.

## TODO / Follow-ups

- Benchmark gas vs BalancedAMM.
- Add fuzz tests for wider q/b ranges and ensure no unexpected `exp` overflow reverts.
- Consider exposing clearer error messaging or pre-checks in higher layers to avoid user-facing reverts when q/b is extreme.
