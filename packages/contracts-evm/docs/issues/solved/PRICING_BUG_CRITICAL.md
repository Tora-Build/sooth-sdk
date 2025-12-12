# 🚨 CRITICAL: Market Pricing Bug

**Date:** 2025-11-29  
**Severity:** CRITICAL  
**Impact:** Markets are essentially giving away free shares

---

## Problem

Markets are selling shares for **1000x cheaper** than they should be.

### Transaction Evidence

**TX:** `0x8facba284052172bd2b28300fa31b2672271eea7da5536eb06b56d661d30ba64`

**What Happened:**

- Bought: **10 YES shares**
- Paid: **0.00385 USDC** (less than half a cent!)
- Should have paid: **~5 USDC** (for a 50/50 market)

**Price per share:** 0.000385 USDC instead of ~0.50 USDC

---

## Root Cause Analysis

### Current Market State

```
Market: SecondMarket (0x7D45C834...)
qYes: 10 (after purchase)
qNo: 0
b: 25,854
```

### The Issue

**Markets are starting at (qYes=0, qNo=0)** which causes extreme mispricing in LMSR.

When a market starts at (0, 0):

1. The first trade gets shares almost for free
2. The LMSR formula breaks down at (0, 0)
3. Subsequent trades will have wildly incorrect pricing

### Expected Behavior

Markets should be **initialized** with balanced quantities, e.g.:

- `qYes` = some positive value (e.g., 100 or 1000)
- `qNo` = same positive value
- This creates a 50/50 starting price

---

## Decimal Mismatch Theory

There might also be a **decimal conversion issue**:

The contract might be expecting 6 decimals (USDC standard) but receiving 18 decimals, causing a **10^12 factor error**.

**Evidence:**

- Expected cost: ~17,926 USDC (from LMSR math)
- Actual cost: 0.00385 USDC
- Ratio: ~4,657,000x cheaper

This doesn't match a simple 10^12 factor, so it's likely the (0,0) initialization issue.

---

## Impact

### For Users

- ✅ Can buy shares for almost nothing
- ❌ Market prices are completely wrong
- ❌ Cannot trust any price signals
- ❌ Arbitrage opportunities are broken

### For LPs

- ❌ Vault is giving away free money
- ❌ Will lose all capital quickly
- ❌ Cannot provide meaningful liquidity

---

## Required Fix

### Option 1: Initialize Markets Properly (Recommended)

Markets need to start with balanced quantities:

```solidity
// In market creation/initialization
qYes = 1000 * 10^18;  // 1000 shares
qNo = 1000 * 10^18;   // 1000 shares
```

This creates a 50/50 starting price and prevents the (0,0) edge case.

### Option 2: Fix Decimal Handling

If there's a decimal mismatch:

1. Check if contract expects 6 decimals but frontend sends 18
2. Verify `parseUnits` is using correct decimals
3. Check MockERC20 decimals vs contract expectations

---

## Immediate Actions

1. **DO NOT enable real trading** until this is fixed
2. **Pause the vault** if possible to prevent LP losses
3. **Redeploy markets** with proper initialization
4. **Test thoroughly** with small amounts first

---

## Testing Needed

After fix, verify:

- [ ] Buy 1 share costs ~0.50 USDC (for 50/50 market)
- [ ] Buy 10 shares costs ~5.0 USDC
- [ ] Prices move correctly with trades
- [ ] No extreme price jumps
- [ ] LP vault doesn't lose money

---

## Files to Check

- Market deployment script (initialization)
- `SoothMarket.sol` constructor
- `SoothLMSRReal.sol` cost calculation
- Frontend `useTrade.ts` decimal handling

---

**This is a show-stopper bug. Markets cannot go live until fixed.**
