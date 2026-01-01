# V9.9.6-fix2: User Orders Array Cleanup

**Date**: 2026-01-02
**Status**: Implemented (Pending Deployment)
**Contract**: `TickBookPoolManagerV996.sol`

---

## Problem

The `_autoClaimUserOrders()` function iterates through ALL orders in `_userOrders[marketKey][user]`, but only processes active ones. Inactive orders (cancelled or fully filled) were never removed from the array, causing:

1. **Gas bloat**: Each `placeOrder()` call must iterate through all historical orders
2. **Linear gas growth**: O(n) where n = total orders ever placed, not just active ones
3. **Out of gas failures**: After ~27 orders, `placeOrder()` exceeds 2M gas limit

### Symptoms
```
✓ Order 27: RNG #53 NO [37.8%-46.9%] 196.00 (filled: 196.00, resting: 0.00)
✗ Order 28 failed: out of gas
✗ Order 29 failed: out of gas
✗ Order 30 failed: out of gas
Stopping early after 3 consecutive contract failures
```

### Root Cause
```solidity
function _autoClaimUserOrders(bytes32 marketKey, address user) internal {
    uint256[] storage orderIds = _userOrders[marketKey][user];
    uint256 len = orderIds.length;  // ← Includes ALL orders (active + inactive)

    for (uint256 i = 0; i < len; ) {
        RangeOrder storage order = _orders[marketKey][orderIds[i]];
        if (order.active) {  // ← Only processes active, but loops through all
            // ... claim logic
        }
        unchecked { ++i; }
    }
}
```

---

## Solution

### 1. Added `_removeFromUserOrders` Helper

Swap-and-pop pattern for O(1) removal:

```solidity
function _removeFromUserOrders(bytes32 marketKey, address user, uint256 orderId) internal {
    uint256[] storage orderIds = _userOrders[marketKey][user];
    uint256 len = orderIds.length;
    for (uint256 i = 0; i < len; ) {
        if (orderIds[i] == orderId) {
            // Swap with last element and pop
            orderIds[i] = orderIds[len - 1];
            orderIds.pop();
            return;
        }
        unchecked { ++i; }
    }
}
```

### 2. Called Cleanup When Orders Become Inactive

**In `cancelOrder()`:**
```solidity
order.active = false;
_removeFromUserOrders(marketKey, msg.sender, orderId);  // ← Added
```

**In `_claimInternal()` (auto-complete fully filled orders):**
```solidity
if (order.filledShares >= order.sharesTotal && !order.liquidityRemoved) {
    // ... cleanup logic
    order.active = false;
    _removeFromUserOrders(marketKey, owner, orderId);  // ← Added
}
```

---

## Result

- `_userOrders[marketKey][user]` now contains **only active orders**
- `_autoClaimUserOrders()` is O(active orders), not O(all orders ever)
- Gas usage stays bounded regardless of order history
- All 138 tests pass

---

## Gas Impact

| Scenario | Before | After |
|----------|--------|-------|
| 10 orders placed, 5 filled | Loop: 10 | Loop: 5 |
| 100 orders placed, 90 filled | Loop: 100 | Loop: 10 |
| 1000 orders placed, 950 filled | Loop: 1000 (OOG) | Loop: 50 |

---

## Deployment Required

This fix requires redeployment of `TickBookPoolManagerV996` to both testnets:
- Base Sepolia (chainId: 84532)
- Monad Testnet (chainId: 10143)

---

## Related

- **V9.9.6-fix1**: Active liquidity underflow fix (`_safeSubLiquidity`)
- **ADR-066**: Unified Order API
- **LESSONS_LEARNED.md**: Entry #24
