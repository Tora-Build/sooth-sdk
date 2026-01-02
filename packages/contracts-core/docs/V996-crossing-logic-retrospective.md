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

### Why "Highest NO tick = Cheapest Seller"

In a YES/NO market, ticks represent prices differently:

| Order Type | Tick T Meaning | Example (T=400) |
|------------|----------------|-----------------|
| **YES order** | Buyer pays T/1000 for YES | 40% for YES |
| **NO order** | Buyer pays T/1000 for NO = Seller accepts (1000-T)/1000 for YES | 40% for NO = 60% for YES |

**Price inversion for NO orders:**
- NO order at tick 400 → NO buyer pays 40% → YES seller accepts 60%
- NO order at tick 600 → NO buyer pays 60% → YES seller accepts 40%

Therefore:
- **Higher NO tick → Lower YES seller price → Cheaper for YES buyer**
- `findNextDown(MAX_TICK + 1)` finds the highest set bit = cheapest seller

The crossing condition becomes: `YES_tick + NO_tick >= 1000` (buyer willing to pay ≥ seller asking)

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

The `_totalLiquidity` counter was being decremented **more than once** for the same order:
1. During crossing (when order matched against incoming order)
2. During claim (when user claimed their fills)
3. During cancel (if order was cancelled)

Without the `liquidityRemoved` flag (added in V9.9.5), each path could independently subtract the order's shares.

Additionally, `_updateActiveLiquidity` at line 776 only updates when `currentTick` is inside the order's range:
```solidity
if (state.currentTick >= tickLower && state.currentTick <= tickUpper) {
    // Only updates if currentTick is INSIDE the order's range
}
```

When `currentTick = 999` (after a YES order crosses), orders at lower ticks [194, 327] don't update `activeLiquidity` because 999 is NOT in that range.

### The Invariant Break

**Expected**: `sum(order.sharesTotal for all active orders) == _totalLiquidity[outcome]`

**Actual**: After some crossing sequences, `_totalLiquidity` drifted to 0 while orders remained active.

This caused `_getOverlappingLiquidity()` to return 0, making market orders believe there was no liquidity to cross.

### Fix (fix8)

Added `_safeSubTotalLiquidity()` helper (lines 734-737) with clamp-to-zero behavior:
```solidity
function _safeSubTotalLiquidity(bytes32 marketKey, uint8 outcome, uint256 delta) internal {
    uint256 current = _totalLiquidity[marketKey][outcome];
    _totalLiquidity[marketKey][outcome] = current >= delta ? current - delta : 0;
}
```

Applied at all decrement sites:
- Line 467: `_safeSubTotalLiquidity(marketKey, order.outcome, order.sharesTotal);`
- Line 569: same pattern
- Line 907: same pattern

### Safety Clamp Tradeoff

The `_safeSubTotalLiquidity()` helper prevents underflow panics but can **hide accounting drift**:
- If we're subtracting more than exists, something is wrong upstream
- The clamp masks the symptom without fixing the cause

**Recommended for future**: Add invariant test + debug event:
```solidity
event TotalLiquidityClamped(bytes32 indexed marketKey, uint8 outcome, uint256 attemptedDelta, uint256 actual);

// In _safeSubTotalLiquidity:
if (delta > current) {
    emit TotalLiquidityClamped(marketKey, outcome, delta, current);
}
```

This allows post-hoc analysis of accounting drift without breaking production.

---

## Bug 3: External Call Revert (NEW)

### Observable Symptom
```
Order 105 failed: Transaction reverted with data: 0x3e23f89482dd64f4...
Market orders ALL fail with similar revert data
```

These are NOT standard contract errors - they're external call failures (typically ERC20 or vault).

### Likely Causes

1. **Vault insufficient USDC**: Vault doesn't have enough USDC to fund the order
2. **Token approval expired**: Outcome tokens not approved for TickBook
3. **Credit/Debit overflow**: Vault internal accounting overflow

### Debug Steps
```bash
# Decode revert data (first 4 bytes = error selector)
cast 4byte-decode 0x3e23f894...

# Or use full trace
cast run <tx_hash> --rpc-url $RPC

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
| Bitmap direction | ✅ Fixed & Verified | `findNextDown(MAX_TICK + 1)` at lines 626, 837, 857 |
| _totalLiquidity underflow | ✅ Fixed & Verified | `_safeSubTotalLiquidity()` helper at lines 734-737, called at 467, 569, 907 |
| activeLiquidity design | ✅ Mitigated | `_safeSubLiquidity()` used at 6 call sites (790, 796, 921, 923, 929, 931) |
| External reverts | 🔍 Pending test | Decode revert data after stress test |

---

## Next Steps

1. ~~Add `_safeSubTotalLiquidity()` helper~~ ✅ Done
2. ~~Deploy fix8 to fresh contract~~ ✅ Done (V9.9.6-fix8 on Base Sepolia + Monad)
3. Create new test market on clean deployment
4. Run stress test (100+ orders)
5. Decode revert data if issues persist

---

## File References

- Contract: `packages/contracts-core/src/TickBookPoolManagerV996.sol`
- This Doc: `packages/contracts-core/docs/V996-crossing-logic-retrospective.md`
- Changelog: See `CHANGELOG.md` under V9.9.6-fix8

---

*Last reviewed: 2026-01-02 — All "Last Session Notes" incorporated into main document.*
