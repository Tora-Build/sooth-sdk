# Research Report: Documentation Consistency Audit

**Date:** 2025-12-09
**Subject:** V4 Continuous LMSR Consistency Check

## Executive Summary

The protocol has successfully migrated to **V4 SoothMarket** using Continuous LMSR with explicit `qYes`/`qNo` state, replacing the previous Tick-Based system. However, the documentation reflects a mix of V3 (Tick-Based) and V4 concepts, creating potential confusion.

## Findings

### 1. `SoothMarketV4.sol` Implementation
-   **Mechanism**: Continuous LMSR (Analytical Log-Sum-Exp).
-   **State**: `qYes`, `qNo` (int256), `reserve` (int256).
-   **Liquidity (`b`)**: Dynamic. `b = bBase + (reserve * reserveFactor)`.
-   **Status**: correct and effectively implemented.

### 2. `V4_FORMULAS.md` (Partial Staleness)
-   **Status**: ⚠️ **Mixed/Stale**
-   **Correct**: "1. Effective Liquidity", "2. Market Reserve Tracking".
-   **Incorrect/Stale**: Section 4 "Max Loss per Market (Tick-Based Calculation)" and Section 10 "Trade Cost (Tick-Based)" explicitly reference ticks and tick-summation cost functions. These are deprecated.
-   **Action Required**: Remove Tick-based sections. Replace with Continuous LMSR cost formulas: $C(q) = b \ln(e^{qY/b} + e^{qN/b})$.

### 3. `FEE_DESIGN.md`
-   **Status**: ⚠️ **Outdated Context**
-   **Analysis**: The core "Dynamic Liquidity" logic described is still accurate for V4. However, the document references "v3.0" and potentially older contract names (`SoothMarket.sol` instead of `SoothMarketV4.sol`).
-   **Action Required**: Update specific contract references to V4 and mention `qYes`/`qNo` instead of generic AMM terms.

### 4. `LIQUIDITY_DYNAMICS.md`
-   **Status**: ⚠️ **Outdated Context**
-   **Analysis**: Similar to Fee Design, the core logic holds, but the context is V3.
-   **Action Required**: Bump to V4 context.

## Recommendation

Create a **Documentation Upgrade Task** to:
1.  **Refactor `V4_FORMULAS.md`**: Replace Tick math with Continuous LMSR math.
2.  **Update `FEE_DESIGN.md`**: Branding update to V4.
3.  **Archive Stale Docs**: Move any exclusively Tick-based documents to `archive/`.

