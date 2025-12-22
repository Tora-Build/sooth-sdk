# ✅ RESOLVED: Market Pricing Bug

**Date Resolved:** 2025-11-29  
**Status:** FIXED & DEPLOYED

---

## Problem

Markets were selling shares for **~1000x cheaper** than intended due to initializing with `ammState=(0,0)`, causing LMSR pricing formula breakdown.

**Evidence:**

- TX `0x8facba...`: 10 shares cost 0.00385 USDC instead of ~5 USDC
- SecondMarket: `ammState=(10,0)` showing buggy initialization
- ExampleMarket: `ammState=(0,0)` completely uninitialized

---

## Solution Implemented

Markets now initialize with **balanced quantities** (1000 shares per side) creating proper 50/50 starting price.

### Changes Made

1. **`SoothMarket.sol`**: Added `initialQuantity` parameter to `initialize()`
2. **`SoothMarketFactory.sol`**: Passes 1000 shares per side when creating markets
3. **Tests**: Updated and added pricing verification tests

### Test Results

✅ **All 14 tests pass**  
✅ **New test `testFirstTradePricing()`** verifies 1 share costs 0.4-0.6 USDC (not 0.00385)  
✅ **New test `testMarketInitializesWithBalancedQuantities()`** verifies (1000, 1000) initialization

---

## Deployment Status

**Redeployment Complete** ✅

New addresses (Base Sepolia):

- **ExampleMarket**: `0x3DC2e293f7245f1Faf7e87f01da8C95853Ba3b9B`
- **SecondMarket**: `0x635D6B13c47b3018d4312826C3864228F1C5ecF1`

### Verification

✅ **Initialization Verified**: Both markets have `ammState=(1000e18, 1000e18)`
✅ **Pricing Verified**: First trade will cost ~0.5 USDC per share

---

## Related Issues

- ✅ **Decimals normalization**: Already fixed separately (see `DECIMALS_NORMALIZATION_SOLVED.md`)
- ✅ **Slippage protection**: Fixed in earlier update (algebraic check)

---

**This critical bug is completely resolved. Markets are live and pricing correctly.**
