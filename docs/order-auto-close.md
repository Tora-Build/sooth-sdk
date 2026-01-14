# Order Auto-Claim & Auto-Close Behavior

## Overview

The TickBookPoolManager contract has built-in mechanisms to automatically claim fills and close fully-filled orders, reducing the need for manual user intervention.

## Auto-Close Triggers

### 1. On New Order Placement (Primary Mechanism)

Every time a user places a new order via `placeOrder()`, the contract automatically:

```solidity
// Line 462-463 in TickBookPoolManager.sol
// Auto-claim ONLY 100% filled orders (max 20 for gas safety)
_autoClaimUserOrders(marketKey, msg.sender);
```

**What happens:**
- Scans up to **20** of the user's existing orders in that market
- For each order with `unfilled < DUST_THRESHOLD` (< 1000 wei, essentially 100% filled)
- **Auto-claims the fills** AND **auto-closes the order**

**Gas Safety:** Limited to 20 orders per transaction to prevent gas exhaustion.

### 2. On Manual Claim (`claimFills`)

When a user calls `claimFills()`:

```solidity
// Line 700-722 in TickBookPoolManager.sol
uint256 unfilled = order.sharesTotal > order.filledShares ? order.sharesTotal - order.filledShares : 0;
bool shouldRemoveLiquidity = unfilled < DUST_THRESHOLD;

if (shouldRemoveLiquidity) {
    _closeRangeOrder(marketKey, orderId);  // Auto-close!
}
```

**Result:** If the order is 100% filled after claiming, it's automatically closed.

### 3. On Cancel (`cancelOrder`)

The `cancelOrder()` function internally calls `_claimInternal()` first:

```solidity
// Line 583 in TickBookPoolManager.sol
function _cancelInternal(...) {
    _claimInternal(marketKey, orderId);  // Claims fills first!
    // ... then closes and returns unused collateral
}
```

**Result:** For a 100% filled order, `cancelOrder()` and `claimFills()` are functionally equivalent.

### 4. Claiming Refunds (`claimPooledRefunds`)

**Does NOT trigger auto-claim/auto-close.** This function only:
- Retrieves pooled refund collateral
- Transfers to user's available balance
- Has no effect on order status

```solidity
function claimPooledRefunds(bytes32 marketKey) external nonReentrant returns (uint256 refund) {
    refund = _pendingRefunds[msg.sender][marketKey];
    // Just transfers refund - no order processing
}
```

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DUST_THRESHOLD` | 1000 wei | Orders with < 1000 wei unfilled are considered "100% filled" |
| Max auto-process | 20 orders | Maximum orders processed per `placeOrder` call |

## UI Implications

### Button Display Logic

| Order State | Buttons Shown | Rationale |
|-------------|---------------|-----------|
| Partially filled (< 100%) | Claim + Cancel | User may want to claim fills OR cancel remaining |
| Fully filled (100%) | Claim only | Cancel is redundant - Claim auto-closes |
| No pending fills | Claim (disabled) + Cancel | Nothing to claim yet |

### Toast Messages

- **Claim on 100% filled:** "Fills claimed! Order closed automatically."
- **Cancel on partial fill:** "Order cancelled! Unused collateral returned."

## User Flow Examples

### Scenario 1: Active Trader
1. User places order #1 → gets 100% filled by counterparty
2. User places order #2 → **auto-claims order #1** during this tx
3. Order #1 disappears from active orders list

### Scenario 2: Inactive Trader
1. User places order #1 → gets 100% filled by counterparty
2. User does NOT place more orders
3. Order #1 **remains visible** at 100% filled until user manually clicks "Claim"

### Scenario 3: Many Orders
1. User places 500 orders rapidly
2. Each new order auto-claims up to 20 fully-filled previous orders
3. After all orders placed, ~400 were auto-claimed during the process
4. ~100 recent orders remain (not yet processed by a subsequent `placeOrder`)

## Events Emitted

| Event | When |
|-------|------|
| `FillsClaimed(owner, marketKey, orderId, filledShares, collateralUsed)` | Fills claimed (manual or auto) |
| `RangeOrderClosed(owner, marketKey, orderId)` | Order closed |
| `AutoClaimExecuted(user, marketKey, ordersProcessed, totalClaimed, totalCollateralUsed)` | Auto-claim batch completed |
| `RangeOrderCancelled(owner, marketKey, orderId, collateralReleased)` | Order cancelled |

## Related Files

- **Contract:** `packages/contracts-core/src/TickBookPoolManager.sol`
- **Frontend:** `apps/web/src/pages/Pro.tsx` (order management UI)
- **Hooks:** `apps/web/src/hooks/useUserOrdersDirect.ts` (order fetching)
