# V9 Frontend Architecture Specification

**Version**: 1.0.0  
**Last Updated**: 2025-12-29  
**Status**: Accepted

---

## Overview

The V9 architecture transitions from a per-market `TickBook` model to a **Singleton `TickBookPoolManager`** model. This improves deployment speed, lowers gas for arbitrageurs through batching, and provides a unified hook interface.

---

## Core Components (V9)

### 1. TickBookPoolManager (Singleton)
- **Role**: Manages liquidity, matching, and settlement for ALL markets.
- **Key Functions**:
  - `placeRangeOrder`: Single/multiple range orders.
  - `executeMarketOrder`: Takes liquidity from the book.
  - `claimFills`: Permissionless claim of filled positions.
  - `getMarketState`: O(1) state read (tick, liquidity, price).
- **Accounting**: Uses Flash Accounting (transient storage) via `TransientDelta`.

### 2. TickBookVault (Singleton)
- **Role**: Custoindal ledger for USDC and outcome shares.
- **Key Functions**:
  - `depositUsdc` / `withdrawUsdc`.
  - `redeemResolved`: Redemption after market settlement.
  - `getInternalOutcomes`: O(1) read of user's shares.

### 3. TruthMarket
- **Role**: Simple lifecycle and adjudication contract (1 per market).
- **States**: `CREATED` → `LIVE` → `SETTLING` → `SETTLED` → `FINALIZED`.

---

## Integration Patterns

### 1. Market Identification
Instead of just a market address, the identity is now a `marketKey` (hash of `poolKey`).
```typescript
interface PoolKey {
    truthMarket: address;
    yesToken: address;
    noToken: address;
    hook: address;
}
```

### 2. Flash Accounting
Frontend must handle the "locked" state pattern if interacting with low-level `lock()` manually, but usually, `poolManager.placeRangeOrder` handles it atomically.

### 3. Hook Integration
Support for `DynamicFeeHook` visualization. Displaying current fee parameters (base, volume discount, volatility premium) in the trading panel.

---

## State Management

### 1. Singleton Sync
Since multiple markets share one manager, the manager's address is retrieved from `deployments.json`.

### 2. ABI Updates
Mandatory use of `V9_ABIS.TickBookPoolManager` and `V9_ABIS.TickBookVault`.

---

## UI Components (Updated)

### 1. Orderbook Ladder
- Still use the 1,000 tick grid.
- Fetch active boundaries using `findNextActiveTick`.

### 2. Trading Panel
- **Slippage Protection**: Always pass `maxCost` to market orders.
- **Refunds**: Market orders now refund unused collateral automatically to `vault.availableUsdcWad`.

### 3. Portfolio
- Display "Vault Balance" vs "Wallet Balance".
- Single "Claim Fills" button for all active orders in a market.

---

**Next Steps**: Update `hooks/v8/direct/*` to support V9 logic and transition components to the new architecture.
