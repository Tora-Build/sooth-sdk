# V9 TickBook Integration Specification

**Version**: 1.0.0  
**Last Updated**: 2025-12-29  
**Status**: Accepted

---

## Technical Overview

The V9 singleton `TickBookPoolManager` uses **Uniswap V4-style hooks and flash accounting**. The frontend interacts with it through concentrated liquidity range orders.

---

## Data Retrieval (O(1) State)

### 1. Market State
Call `PoolManager.getMarketState(marketKey)`.
- **tick**: Current price tick (1-999).
- **activeLiqNo**: Liquidity on the NO side in the current tick.
- **activeLiqYes**: Liquidity on the YES side in the current tick.
- **probability**: Current price as WAD.

### 2. Boundary Discovery
Use `findNextActiveTick(marketKey, currentTick, isUp, outcome)` to discover the next price point with depth. This is used to build the Orderbook Ladder.

### 3. User State
- **Fills**: `PoolManager.getPendingFills(marketKey, orderId)` to show unclaimed shares/collateral.
- **Vault**: `TickBookVault.availableUsdcWad(user)` and `TickBookVault.reservedUsdcWad(user)`.

---

## Transaction Flows

### 1. Placing Range Orders
```bash
poolManager.placeRangeOrder(
    marketKey,
    outcome,
    tickLower,
    tickUpper,
    sharesPerTickWad
)
```
- **Collateral**: Automatically pulled from `vault.availableUsdcWad`.
- **Refetch**: Update `availableUsdcWad` and `reservedUsdcWad` after placement.

### 2. Execute Market Order
```bash
poolManager.executeMarketOrder(
    marketKey,
    outcome,
    sharesWad,
    maxCostWad
)
```
- **Slippage**: `maxCostWad` is calculated as `simulatedCost * (1 + slippage%)`.
- **Refunds**: Singleton handles refunds for unused slippage buffer.

### 3. Claiming Fills
```bash
poolManager.batchClaimFills(
    marketKey,
    orderIds
)
```
- Converts maker fills into `vault` balance (Usdc or Shares).

---

## Design Requirements

1. **Ladder Performance**: Virtualized list for the 1,000 tick ladder.
2. **Real-time Price**: Updates price bar and "New Global Price" indicator instantly on trade.
3. **Fee Transparency**: Display `DynamicFeeHook` breakdown (Base + Premium - Discount).
4. **Outcome Semantics**: `YES=1, NO=0` consistently across all panels.

---
