# V9.8 Frontend Integration Spec

## Overview

V9.8 fixes the `_tryCross` bitmap overlap detection bug that prevented range orders from crossing immediately on newly graduated markets. This document describes the frontend integration requirements.

## Contract Changes Summary

| Component | Change | FE Impact |
|-----------|--------|-----------|
| `TickBookPoolManager.registerMarket` | `currentTick` initialized to `MIN_TICK` (1) instead of `initialProbabilityWad` | **Book Price shows "N/A" until first crossing** |
| `TickBookPoolManager._tryCross` | Uses bitmap overlap detection instead of `currentTick` range check | Orders cross correctly now |
| `placeRangeOrder` return values | Returns `(orderId, crossingFilled, crossingCost)` | **Must handle `crossingFilled > 0`** |

## FE Changes Implemented

### Book Price "N/A" Display

In `Pro.tsx`, when `currentTick <= 1`, the Book Price displays "N/A" instead of a misleading 0.1%:

```typescript
// V9.8: currentTick is initialized to MIN_TICK (1) until first crossing occurs.
// If currentTick <= 1, there's been no trading - show "N/A" for Book Price.
const isBookPriceValid = tickBook?.currentTick !== undefined && tickBook.currentTick > 1;
const tickBookProb = isBookPriceValid ? rawBookProb : null; // null means N/A
```

This affects 3 display locations:
- Header "Book Price" badge
- Embedded header "Book Price" badge  
- Liquidity Map center probability


## Key Integration Points

### 1. Order Crossing on Placement

When a user places an order that overlaps with existing opposite liquidity, the order may **immediately cross** and return filled shares.

```typescript
// useTickBookDirect.ts - placeRangeOrder
const { orderId, crossingFilled, crossingCost } = await poolManager.placeRangeOrder(
  marketKey,
  outcome,
  tickLower,
  tickUpper,
  sharesTotal
);

// NEW: Handle immediate crossing
if (crossingFilled > 0n) {
  // Order was partially or fully filled on placement
  toast.success(`Order placed and ${formatShares(crossingFilled)} shares filled immediately!`);
  
  // Refresh user orders + balances
  await refetchUserOrders();
  await refetchBalances();
}
```

### 2. UI Feedback for Crossing

The `SimpleTradingPanel` or Pro Terminal should show feedback when an order crosses:

```tsx
// After successful placeRangeOrder transaction
const handleOrderPlaced = (result: PlaceOrderResult) => {
  if (result.crossingFilled > 0n) {
    // Show filled notification
    showNotification({
      type: 'success',
      title: 'Order Crossed!',
      message: `${formatShares(result.crossingFilled)} shares filled at ${formatPrice(result.crossingCost / result.crossingFilled)}`
    });
  } else {
    // Order resting in book
    showNotification({
      type: 'info',
      title: 'Order Placed',
      message: 'Your order is now resting in the book'
    });
  }
};
```

### 3. Liquidity Map Updates

After a crossing, both the new order and existing orders may have fills. The `LiquidityMap` component should refresh:

```typescript
// After placeRangeOrder with crossing
queryClient.invalidateQueries(['liquidity-map', marketKey]);
queryClient.invalidateQueries(['user-orders', marketKey]);
queryClient.invalidateQueries(['pending-fills', marketKey]);
```

### 4. getPendingFills Integration (Existing)

No changes needed — the existing `getPendingFills` integration from V9.5.0 correctly displays pending fills from both market orders and crossed limit orders.

## ABI Updates

The `TickBookPoolManager` ABI should already have `placeRangeOrder` with the correct return signature:

```json
{
  "name": "placeRangeOrder",
  "inputs": [
    { "name": "marketKey", "type": "bytes32" },
    { "name": "outcome", "type": "uint8" },
    { "name": "tickLower", "type": "uint16" },
    { "name": "tickUpper", "type": "uint16" },
    { "name": "sharesTotal", "type": "uint256" }
  ],
  "outputs": [
    { "name": "orderId", "type": "uint256" },
    { "name": "crossingFilled", "type": "uint256" },
    { "name": "crossingCost", "type": "uint256" }
  ]
}
```

## Test Scenarios

### Scenario 1: Order Crosses on Fresh Market

1. User A places BUY YES order at ticks [450, 550]
2. User B places SELL YES order at overlapping ticks [500, 600]
3. **Expected**: User B's `placeRangeOrder` returns `crossingFilled > 0`
4. **Verify**: Both users have fills (User A via `getPendingFills`, User B via `crossingFilled`)

### Scenario 2: Non-Crossing Order

1. User A places BUY YES order at ticks [100, 200]
2. User B places SELL YES order at ticks [300, 400]
3. **Expected**: User B's `placeRangeOrder` returns `crossingFilled = 0`
4. **Verify**: Both orders are resting, no fills

### Scenario 3: Full Order Cross

1. User A places BUY YES order at ticks [400, 500] for 1000 shares
2. User B places SELL YES order at SAME ticks [400, 500] for 500 shares
3. **Expected**: User B's order fully crossed, `crossingFilled = 500 shares`
4. **Verify**: User A has 500 pending fills, User B got 500 shares immediately

## Deployment Addresses (V9.8.0)

### Base Sepolia (Chain ID: 84532)

| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0xd43ec02ae53845f419c9da27d2b0c8a45a37082b` |
| **TickBookVault** | `0x281f3ba425471d0f70633d065306931dafebd1cd` |
| **LaunchpadEngine** | `0xd90ca9882584cf11317d954516da436e0daf8c2f` |
| **Collateralizer** | `0x1b24519b790e2659b8e2b0ff7e5a1f37e033899a` |
| **AMMEngine** | `0x94f09a617541c2e3672262956d560022fd0274a7` |
| **MockUSDC** | `0xc848c6af50de6dae6fabf08b6efc73f9548bd2c6` |
| **DynamicFeeHook** | `0x2ec991014cd2fb8d9e39abb777f4c523c6719635` |

### Markets (Base Sepolia)

| Market | Address | Status |
|--------|---------|--------|
| **ALIEN** | `0x0660afbe97869abe13520e68ba15869d9945a710` | Pre-Grad |
| **BTC100K** | `0x317abbf2c34518f099967bb251d54158ceadc003` | 🎓 Graduated |

## Verification Steps

1. **Build Frontend**: `cd apps/web && npm run build`
2. **Run Dev Server**: `npm run dev`
3. **Test on BTC100K Market** (graduated): Place overlapping limit orders and verify crossing
4. **Check Console**: No errors about missing functions or invalid addresses

## Related Documentation

- [TRYCROSS_BITMAP_OVERLAP.md](../../packages/contracts-evm/docs/research/V9/TRYCROSS_BITMAP_OVERLAP.md) — Technical details of the fix
- [ADR-057](../../DECISIONS.md) — Architectural decision record
- [CHANGELOG.md](../../CHANGELOG.md) — V9.8.0 release notes
