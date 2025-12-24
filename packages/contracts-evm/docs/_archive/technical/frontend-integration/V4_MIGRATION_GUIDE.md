# Sooth V4 Migration Guide (Hybrid Granularity)
**Date:** 2025-12-10

This guide outlines the breaking changes introduced in the final Sooth V4 release, specifically the transition to a **Hybrid Granularity Model**.

---

## 🚨 Critical Breaking Changes

### 1. Orderbook Amounts are now INTEGERS
**Previously:** You sent WAD-scaled amounts (e.g., `10e18`) for shares.
**Now:** You must send **Raw Integers** (e.g., `10`) for shares.

| Parameter | Old (V3 / Early V4) | New (Final V4) |
| :--- | :--- | :--- |
| `amount` (Place Order) | `parseUnits("10", 18)` | `10n` (BigInt) |
| `decimals` | 18 | **0** (Effectively) |

**Code Update Example:**
```typescript
// OLD ❌
traderVault.write.placeOrder([
  marketAddress,
  outcome,
  parseUnits("0.60", 18), // Price (Still WAD)
  parseUnits("100", 18)   // Amount (Was WAD)
])

// NEW ✅
traderVault.write.placeOrder([
  marketAddress,
  outcome,
  parseUnits("0.60", 18), // Price (Still WAD)
  100n                    // Amount (Now Integer)
])
```

> **Note:** `price` remains in WAD (18 decimals). Only `amount` changed.

---

### 2. Market Data: Ticks Removed
**Previously:** You queried `currentTick()` to get probability.
**Now:** `currentTick()` is removed. Use `price(outcome)` directly.

**Code Update:**
```typescript
// OLD ❌
const tick = await market.read.currentTick();
const prob = tick / 1000;

// NEW ✅
const priceWad = await market.read.price([1]); // 1 = YES
const prob = formatUnits(priceWad, 18);
```

---

### 3. Contract Renaming / Addresses
Legacy V3 contracts have been deleted. The frontend should reference the new V4 contracts.
*   **Deployments JSON:** Already updated. Keys are aliased for compatibility:
    *   `SoothTraderVault` -> Points to `SoothTraderVaultV4`
    *   `SoothMarket` -> Points to `SoothMarketV4`
    *   `OutcomeToken` -> **New Contract** (ERC1155)

---

## AMM Interaction (Unchanged)
The AMM continues to operate in **WAD** precision for smooth curves.
*   `tradeAMM` still expects `deltaShares` in WAD (e.g., `10e18`).
*   **Do not confuse** Orderbook `placeOrder` (Integer) with AMM `tradeAMM` (WAD).

## Quick Checklist
- [ ] Update `placeOrder` calls to send integer amounts.
- [ ] Update `price` fetching to use `market.price(outcome)`.
- [ ] Ensure ABI files are synced (run `./deploy-and-sync.sh`).
