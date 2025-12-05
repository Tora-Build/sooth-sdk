# Sooth Protocol Integration Guide

**Date:** 2025-12-04
**Status:** ✅ Live on Base Sepolia

## Overview

This guide covers integration with the Sooth Protocol's current architecture.

---

## 🚨 Key Changes

1.  **Single Entry Point:** You no longer interact with `SoothMarket` directly for trading. **Everything** goes through `SoothTraderVaultV3`.
2.  **No Collateral:** The concept of locking collateral is gone. Users pay USDC upfront for all trades.
3.  **Unified Orderbook:** "Sell YES" orders are automatically converted to "Buy NO" orders on the backend.
4.  **Pending Balances:** Proceeds from selling are locked for 48h (default) before they can be withdrawn.

---

## 📍 Contract Addresses (Base Sepolia)

| Contract          | Address                                      |
| ----------------- | -------------------------------------------- |
| **TraderVaultV3** | `0x8B8c1F0711e5A78F1Fe7ba174eB47eb58880293b` |
| **MarketV3**      | `0x222948d53B75ED5ef06844ABc8B01dEe557E4945` |
| **GovernorVault** | `0x83AFf2901f29821f8Ef4f216256D9f8A6fAFaAb2` |
| **FeeController** | `0x289a936E0947a2bA07D8a3A06116455ddf2c77Ad` |
| **AMM**           | `0x6471F7B77aD9cDc337f76aA2e533EF03Ca8Bcde4` |

---

## 🛠 Integration Steps

### 1. Update ABI

Use the new `SoothTraderVaultV3` ABI. It contains all necessary functions:

- `deposit(amount)`
- `withdraw(amount)`
- `tradeAMM(market, outcome, deltaShares, maxCost)`
- `placeOrder(market, outcome, price, amount)`
- `cancelOrder(market, orderId)`
- `claimUnlocked()`

### 2. Update Balances Hook

Fetch two balances for the user:

```javascript
// Old
const balance = vault.balanceOf(user);

// New
const available = vault.availableBalance(user);
const pending = vault.pendingBalance(user);
const total = vault.totalBalance(user);
```

### 3. Update Trading Logic

**AMM Trade:**

```javascript
// Old: Market.trade(...)
// New: TraderVault.tradeAMM(...)
await traderVault.tradeAMM(
  marketAddress,
  outcomeIndex, // 0=YES, 1=NO
  deltaShares, // + for buy, - for sell
  maxCost // Slippage protection
);
```

**Limit Order:**

```javascript
// Old: Market.placeOrder(...)
// New: TraderVault.placeOrder(...)
await traderVault.placeOrder(
  marketAddress,
  outcomeIndex,
  price, // 1e18
  amount // 1e18
);
```

### 4. Handle "Sell" Logic

- When a user sells, the proceeds go to `pendingBalance`.
- Show a "Pending Unlocks" UI element.
- Call `traderVault.claimUnlocked()` to move funds to available after 48h.

### 5. Remove Collateral Logic

- Delete any code calculating `collateralLocked`.
- Users just need `availableBalance >= cost`.
