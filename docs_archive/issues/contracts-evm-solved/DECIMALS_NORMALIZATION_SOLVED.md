# Collateral Decimals Normalization (SOLVED)

**Status:** ✅ Solved & Implemented  
**Date:** 2025-11-29  
**Implementation:** `SoothVault.sol` (decimalsScale) and `SoothRiskManager.sol` (updateGlobalB)

---

## Resolution Summary

This issue has been resolved by implementing **Solution 2** (Normalize to 18 Decimals).

### Implementation Details

1. **Vault Storage**: `SoothVault` now calculates and stores `decimalsScale = 10^(18 - assetDecimals)` in its constructor.
2. **Risk Calculation**: `SoothRiskManager.updateGlobalB()` uses this scale factor to normalize treasury and buffer values to 18 decimals before performing risk calculations.
3. **Interface**: `IERC20Metadata` was added to `SoothInterfaces.sol` to safely read token decimals.

See `docs/VAULT_REDEPLOYMENT_2025_11_29.md` for full deployment details.

---

# Original Issue Description: Collateral Decimals Normalization (Solution 2)

## Problem

Prices and the `b` parameter currently assume 18‑dec collateral. Supplying a lower‑decimal token (e.g., 6‑dec USDC) shrinks treasury/buffer values by 10^(18 - decimals), making shares artificially cheap and enabling price attacks.

## Approach (Normalize to 18 Decimals)

Introduce a per-deployment `decimalsScale = 10^(18 - assetDecimals)` and use it anywhere raw collateral amounts feed into pricing:

- Scale vault balances before risk calculations: `scaledTreasury = totalAssets * decimalsScale`, `scaledBuffer = (totalAssets - totalLockedExposure) * decimalsScale`.
- Compute `bGlobal` from scaled values so AMM prices reflect the intended dollar units.
- Normalize PnL deltas and settlement flows consistently so transfers still use raw token units but risk math uses scaled units.

## Implementation Sketch

1. Read collateral decimals once: `uint8 assetDecimals = IERC20Metadata(address(asset)).decimals();` and store `decimalsScale` (reverts if `assetDecimals > 18`).
2. In `SoothRiskManager.updateGlobalB()`, use scaled treasury/buffer:
   - `uint256 T = vault.getTreasuryBalance() * decimalsScale;`
   - `uint256 B = vault.getLiquidBufferBalance() * decimalsScale;`
   - proceed with existing `bGlobal` math.
3. Keep vault accounting in native token units; only risk/AMM math uses scaled values.
4. Document the chosen collateral decimals at deployment time; changing tokens with different decimals requires redeploying with a new `decimalsScale`.

## Notes

- This keeps compatibility with any ERC20 decimals while preserving correct pricing.
- If you can constrain collateral choice, an alternative is to hard-require 18‑dec tokens and skip scaling.
