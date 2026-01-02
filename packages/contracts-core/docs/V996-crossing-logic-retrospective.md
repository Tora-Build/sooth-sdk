# V9.9.6 Crossing Logic Bug Retrospective

**Date**: 2026-01-02  
**Author**: Antigravity AI  
**Status**: Fix8 Implementation Complete

---

## Executive Summary

After extensive debugging, we identified **THREE distinct bugs** in the crossing logic:

| Component | Bug | Impact |
|-----------|-----|--------|
| **Bitmap Traversal** | `findNextUp(0)` finds most expensive seller, not cheapest | Orders that should cross don't |
| **activeLiquidity** | Only updated when `currentTick` is in order range | `_getOverlappingLiquidity` returns 0 when it shouldn't |
| **External Revert** | Vault insufficient balance or token transfer failure | Transaction reverts after ~100 orders |

---

## Bug 1: Bitmap Traversal Direction (fix6-7)

### Observable Symptom
YES bid at 65% should cross with NO seller at tick 400 (accepts 60%), but doesn't.

### Root Cause
```solidity
// fix7 (WRONG):
uint16 lowestSell = _bitmaps[marketKey][0].findNextUp(0);
```

`findNextUp(0)` finds the **LOWEST** NO tick (most expensive seller). For a YES buyer, we want the **HIGHEST** NO tick (cheapest seller).

### Fix (fix8)
```solidity
// fix8 (CORRECT):
uint16 highestSell = _bitmaps[marketKey][0].findNextDown(MAX_TICK + 1);
```

---

## Bug 2: activeLiquidity Not Tracking (NEW)

### Observable Symptom
```
getMarketState() returns:
- currentTick: 999
- activeLiquidityNo: 0
- activeLiquidityYes: 0
```

But there are **53 active orders**!

### Root Cause

Line 776 in `_updateActiveLiquidity`:
```solidity
if (state.currentTick >= tickLower && state.currentTick <= tickUpper) {
    // Only updates if currentTick is INSIDE the order's range
}
```

When `currentTick = 999` (after first crossing), orders at ticks [194, 327] don't update `activeLiquidity` because 999 is NOT in that range.

### Impact

`_getOverlappingLiquidity()` at line 939+:
```solidity
if (activeLiq > 0) {
    uint256 rangeLiq = uint256(activeLiq) * numTicks;
    return rangeLiq > totalLiq ? totalLiq : rangeLiq;
}
return totalLiq;  // Fallback when activeLiq = 0
```

With `activeLiq = 0`, it falls back to `totalLiq`. BUT if `totalLiq` is also 0 (e.g., after orders cross and are removed), market orders fail.

### Fix (fix8)

The fallback to `totalLiq` handles this, BUT we need to ensure `_totalLiquidity` is not being over-decremented. Check for underflows in:
- Line 467: `_safeSubTotalLiquidity(marketKey, order.outcome, order.sharesTotal);`
- Line 569: same pattern
- Line 907: same pattern

**Add guards** to prevent underflow:
```solidity
if (_totalLiquidity[marketKey][outcome] >= shares) {
    _totalLiquidity[marketKey][outcome] -= shares;
} else {
    _totalLiquidity[marketKey][outcome] = 0; // Clamp to 0
}
```

---

## Bug 3: External Call Revert (NEW)

### Observable Symptom
```
Order 105 failed: Transaction reverted: 0x3e23f89482dd64f4...
Market orders ALL fail with similar hashes
```

These are NOT standard contract errors - they're external call failures.

### Likely Causes

1. **Vault insufficient USDC**: Vault doesn't have enough USDC to fund the order
2. **Token approval expired**: Outcome tokens not approved for TickBook
3. **Credit/Debit overflow**: Vault internal accounting overflow

### Debug Command
```bash
# Check vault balance
cast call $VAULT "getPosition(address,address)" $MARKET $USER --rpc-url $RPC
```

---

## Why Tests Pass But Bugs Exist

1. **Tests use fresh state**: Each test starts with clean `currentTick = MIN_TICK`
2. **Tests don't accumulate state**: After 100+ orders, state accumulates
3. **Tests don't stress vault**: Small amounts that fit in vault balance
4. **Tests use single outcomes**: Not mixing YES and NO orders that cause tick jumps

### Missing Test Cases

```solidity
function test_CrossWithCurrentTickAtMax() public {
    // Force currentTick to 999
    placeOrderAndCross(...);
    assertEq(state.currentTick, 999);
    
    // Now place order at low ticks - should still work
    placeOrderAtTicks(100, 200);
    assertTrue(state.activeLiquidityNo > 0 || totalLiquidity > 0);
}

function test_100OrdersNoRevert() public {
    for (uint i = 0; i < 100; i++) {
        placeRandomOrder();  // Should not revert
    }
}
```

---

## Fix8 Implementation

### Changes Required

1. **Bitmap direction** (DONE): `findNextDown` instead of `findNextUp`

2. **Safe decrement for _totalLiquidity** (NEW):
   - Add `_safeSubTotalLiquidity()` helper
   - Use it everywhere `_totalLiquidity` is decremented

3. **Debug logging** (OPTIONAL):
   - Emit events when crossing fails for debugging

### Code Changes

```solidity
// Add helper function
function _safeSubTotalLiquidity(
    bytes32 marketKey, 
    uint8 outcome, 
    uint256 delta
) internal {
    uint256 current = _totalLiquidity[marketKey][outcome];
    if (delta >= current) {
        _totalLiquidity[marketKey][outcome] = 0;
    } else {
        _totalLiquidity[marketKey][outcome] = current - delta;
    }
}
```

---

## Success Criteria

1. **Liquidity Map**: GREEN on LEFT, RED on RIGHT
2. **100+ orders**: No reverts during stress test
3. **Market orders**: Fill correctly against resting liquidity
4. **Gas**: Under 2M for 100 orders

---

## Current Status

| Bug | Status | Notes |
|-----|--------|-------|
| Bitmap direction | ✅ Fixed in code | `findNextDown(MAX_TICK + 1)` at line 837 (also used elsewhere e.g. line 626/857) |
| _totalLiquidity underflow | ✅ Fixed in code | `_safeSubTotalLiquidity()` at lines 467, 569, 907 |
| activeLiquidity design | ⚠️ Mitigated | Falls back to `totalLiq`, safe with underflow guard |
| External reverts | 🔍 Pending test | Will validate after deployment |

---

## Next Steps

1. ~~Add `_safeSubTotalLiquidity()` helper~~ ✅ Done
2. Deploy fix8 to fresh contract
3. Create new test market on clean deployment
4. Run stress test (100+ orders)
5. Decode revert hash if issues persist

---

## File References

- Contract: `packages/contracts-core/src/TickBookPoolManagerV996.sol`
- This Doc: `packages/contracts-core/docs/V996-crossing-logic-retrospective.md`
- Changelog: See `CHANGELOG.md` under V9.9.6-fix8

---

## Last Session Notes (review)

- **Bug 1 clarity**: add/keep a short reminder of tick→price monotonicity for YES vs NO so the “highest NO tick = cheapest YES seller” reasoning is unambiguous.
- **Bug 2 narrative**: the key invariant break is likely “`totalLiq` drifted to 0 while orders remained active”; framing this as a normal “after orders cross and are removed” scenario makes the failure mode harder to reason about.
- **Safety clamp tradeoff**: clamping `_totalLiquidity` to 0 prevents underflow reverts (good hotfix) but can also hide accounting drift; consider adding invariant tests and/or debug events to detect unexpected drift.
- **Bug 3 wording**: the long hex blobs are typically revert data (often from external ERC20/vault calls), not a “revert hash”; prefer “revert data” and decode via trace tooling when possible.
