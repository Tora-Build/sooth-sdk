# V3 Migration Guide: Dynamic Liquidity & Unified Orderbook

**Date:** 2025-12-05
**Status:** ✅ Live on Base Sepolia

---

## Executive Summary

Sooth v3 introduces **Dynamic Liquidity** and a **Unified Orderbook**. This changes how liquidity is calculated, how fees work, and how the frontend should connect to markets.

**Key Changes:**

1.  **Dynamic Liquidity:** `b` is no longer static. It grows as trading fees accumulate.
2.  **Unified Orderbook:** Buying "NO" is now just Selling "YES". One orderbook per market.
3.  **Singleton Entry:** All interactions go through `SoothTraderVault`.
4.  **Auto-Compounding:** AMM fees are added to `reserve`, which boosts `b`.

---

## 1. Dynamic Liquidity (`b`)

### **The Logic**

- **Old (v2):** `b` was fixed or manually updated.
- **New (v3):** `b = bBase + (Reserve * ReserveFactor)`.

### **Display Logic (Crucial for UI)**

When displaying "Liquidity" or "locked exposure" in `VaultMarkets.tsx`:

- **If `lockedExposure > 0`:** Display on-chain value.
- **If `lockedExposure == 0`:** The market now has _implicit_ backing via the dynamic formula.
  - **Fallback Display:** `b * 0.693` (Estimated Max Loss).
  - **User Note:** "Implicitly backed by Governor Vault defaults."

---

## 2. Integration Checklist

### 🔧 Configuration Updates

Ensure your local config files match the latest deployment.

- [x] **`deployments.json`**: Updated with fresh Base Sepolia addresses.
- [x] **`markets.json`**: "Example v3 Market" contract address updated.
- [x] **`abis.ts`**: Added `b()` view function and `VaultConfigSet` event.

### 💻 Code Updates

#### **1. Fetching Market Liquidity**

Use the new view function.

```typescript
// OLD
const b = await market.b(); // Static variable

// NEW
const b = await market.b(); // Dynamic view function
// Returns: bBase + (reserve * factor)
```

#### **2. Explaining Fees**

Update tooltips to explain that **AMM Fees (0.5%)** now effectively "buy LP shares" for the protocol using the reserve, permanently deepening liquidity.

#### **3. Orderbook Interaction**

Use the `useOrderbook` hook which should now rely on `bestAsk()` and `bestBid()`.

```typescript
// Fetching "Buy YES" price
const bestAskId = await market.bestAsk();
const askOrder = await market.orders(bestAskId);
const buyYesPrice = askOrder.yesPrice;

// Fetching "Buy NO" price (actually Selling YES)
const bestBidId = await market.bestBid();
const bidOrder = await market.orders(bestBidId);
const buyNoPrice = 1 - bidOrder.yesPrice;
```

---

## 3. Deployment Details

**Network:** Base Sepolia (84532)

| Contract                | Address                                      |
| :---------------------- | :------------------------------------------- |
| **SoothTraderVault**    | `0xd82Ef7bc2aFC25aA0f4B7e13E43bd379e955745e` |
| **SoothMarket**         | `0xbF4a4f771Ff3375b4028abfaDAB0018b41997Fdf` |
| **SoothGovernorVault**  | `0x296682686358E6bAf572118bfCAA6027C349F3d3` |
| **SoothFeeController**  | `0x512076933a55acF5375A54A54b2DDBb996b05E97` |
| **SoothLMSRReal** (AMM) | `0x2fe47234662aE57E714d183c41f2Bd73DE91892F` |

---

## 4. Documentation References

- **[LIQUIDITY_DYNAMICS.md](../../research/LIQUIDITY_DYNAMICS.md)**: Deep dive into the math.
- **[FEE_DESIGN.md](../../research/FEE_DESIGN.md)**: How fees compound.
- **[ORDERBOOK_INTEGRATION.md](./ORDERBOOK_INTEGRATION.md)**: Detailed orderbook steps.
