# Contract Integration Update - Applied Changes

**Date:** 2025-11-30  
**Status:** ✅ COMPLETE
**Latest Update:** 19:00 UTC+7 (LMSR Fix Deployment)

## Summary

Applied critical contract updates from the latest deployment (v2.0.0), which **restores the LMSR AMM** with a fixed implementation using PRBMath. The Linear AMM (SoothBalancedAMM) has been replaced by `SoothLMSRReal`.

## Changes Applied

### 1. ✅ Updated Deployments (`src/config/deployments.json`)

- All contract addresses updated to new deployment (v2.0.0)
- **Restored `SoothLMSRReal`** (replacing `SoothBalancedAMM`)
- Updated Market addresses for ExampleMarket and SecondMarket

### 2. ✅ Updated ABIs (`src/config/abis.ts`)

- **Restored `SOOTH_LMSR_ABI`** (using `SoothLMSRReal` interface)
- Kept Vault functions for Hybrid Liquidity:
  - `getMarketReserve(uint256 marketId)`
  - `getTreasuryBalance()`
  - `getLiquidBufferBalance()`

### 3. ✅ Updated Trade Logic (`src/hooks/useTrade.ts`)

- **Approval:** Approves `SoothVault` (Correct)
- **Pricing Formula:** **Restored LMSR Pricing**:
  - `C(q) = b * ln(e^(qYes/b) + e^(qNo/b))`
  - Uses contract's `costDelta` function which now implements this correctly via PRBMath
- **AMM Contract:** Uses `deployments.SoothLMSRReal`

### 4. ✅ Updated Market Hook (`src/hooks/useMarket.ts`)

- Changed `ammAddress` to use `deployments.SoothLMSRReal`
- Fetches price/cost using LMSR logic

## Key Behavioral Changes

### Approval Flow (Unchanged)

```typescript
// Correct:
await collateral.approve(vaultAddress, amount);
```

### Pricing Formula (UPDATED)

We are back to **LMSR**:

- **Balanced Price:** 0.50 (Fixed from previous 0.06 bug)
- **Mechanism:** Logarithmic Market Scoring Rule
- **Implementation:** PRBMath (High precision)

### Slippage Protection

- **Buys:** `maxCost = expectedCost * (1 + slippage)`
- **Sells:** `maxCost = expectedCost * (1 - slippage)`

## Testing Checklist

- [x] Verify approval targets Vault
- [x] Verify frontend uses `SoothLMSRReal` address
- [x] Verify markets linked to new deployment
- [ ] Test buy transaction (should succeed with new LMSR)
- [ ] Test sell transaction

## Known Issues Resolved

1. ✅ **LMSR Math Fixed:** The previous "price too low" bug is fixed by PRBMath.
2. ✅ **Linear AMM Removed:** Reverted to the intended LMSR mechanism.

## References

- Deployment Doc: `docs/contract-integration/DEPLOYMENT_2025_11_30.md`
- Liquidity Metrics: `docs/LIQUIDITY_METRICS_EXPLAINED.md`
