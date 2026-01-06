# RFC-001: Spot Fill Gas Optimization

**Status:** Draft
**Created:** 2026-01-06
**Authors:** Sooth Protocol Team

---

## Summary

V10's `_fillSpotLiquidity` function has O(N) complexity where N is the total number of spot sell orders ever created. This causes gas costs to grow linearly over the market's lifetime, eventually making trades prohibitively expensive.

This RFC proposes **tick-indexed spot order storage** to reduce fill complexity to O(overlap × ordersPerTick).

---

## Problem Statement

### Current Implementation

In `TickBookPoolManager.sol`, the `_fillSpotLiquidity` function iterates through ALL historical spot sell IDs:

```solidity
// Lines 1250-1255
uint256 maxSpotId = _nextSpotSellId;

for (uint256 sellId = 1; sellId <= maxSpotId && remaining > 0; sellId++) {
    SpotSellOrder storage spotOrder = _spotSellOrders[marketKey][sellId];
    if (!spotOrder.active) continue;  // Still costs SLOAD!
    // ... fill logic
}
```

Even inactive orders require an SLOAD (~2100 gas) to check the `active` flag.

### Observed Impact

Simulation of 500 orders on a single market showed clear gas regression:

| Order Range | Avg Gas | Notes |
|-------------|---------|-------|
| 1-20 | ~380k | Fresh market |
| 200-250 | ~610k | Moderate history |
| 450-500 | ~680k | Heavy history |

Spot sell orders that cross against existing liquidity showed extreme costs:
- Order 290 (SPOT): 1,027,096 gas
- Order 327 (SPOT): 1,294,948 gas
- Order 406 (SPOT): 1,100,188 gas

### Root Cause

The O(N) scan means:
- 100 historical spot sells → ~210,000 gas just for iteration
- 500 historical spot sells → ~1,050,000 gas just for iteration
- This compounds with actual fill logic for matches

---

## Proposed Solution: Tick-Indexed Storage (Option A)

### Design

Add a mapping from tick → active spot sell IDs:

```solidity
// New storage
mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint256[]))) _spotSellIdsAtTick;
```

### Modified Operations

**Placement (`placeSpotSell`):**
```solidity
for (uint16 t = tickLower; t <= tickUpper; t++) {
    _tickLiquidity[marketKey][outcome][t].spotLiquidity += density;
    _spotSellIdsAtTick[marketKey][outcome][t].push(sellId);  // NEW
    // ... existing bitmap logic
}
```

**Fill (`_fillSpotLiquidity`):**
```solidity
// Instead of scanning all IDs, iterate only relevant ticks
for (uint16 t = overlapLow; t <= overlapHigh && remaining > 0; t++) {
    uint256[] storage sellIds = _spotSellIdsAtTick[marketKey][outcome][t];
    for (uint256 i = 0; i < sellIds.length && remaining > 0; i++) {
        SpotSellOrder storage order = _spotSellOrders[marketKey][sellIds[i]];
        if (!order.active) continue;
        // ... existing fill logic
    }
}
```

**Cancel/Complete:**
```solidity
// Remove from all tick arrays when order becomes inactive
for (uint16 t = order.tickLower; t <= order.tickUpper; t++) {
    _removeFromArray(_spotSellIdsAtTick[marketKey][outcome][t], sellId);
}
```

---

## Tradeoff Analysis

### Gas Cost Shift

This solution shifts gas costs from **crossers** to **placers**:

| Operation | Current | Option A | Change |
|-----------|---------|----------|--------|
| Place 10-tick spot sell | ~100k | ~150k | +50% |
| Place 50-tick spot sell | ~350k | ~600k | +70% |
| Place 100-tick spot sell | ~700k | ~1.5M+ | +100%+ |
| Cross with 50 historical spots | ~210k | ~20k | **-90%** |
| Cross with 200 historical spots | ~420k | ~20k | **-95%** |

### Pros

1. **Fixes the O(N) regression** - Crossing gas becomes predictable regardless of history
2. **Preserves semantics** - FIFO fill order, per-order pricing, immediate settlement unchanged
3. **Simple implementation** - Array indexing, no complex accumulator math
4. **No claim flow changes** - Order state already tracks fills

### Cons

1. **Wide range spot sells become expensive** - A 500-tick range costs ~2.5M+ gas to place
2. **O(ticks) storage overhead** - Each tick requires array push on placement
3. **O(ticks) cleanup on cancel** - Must remove from each tick's array
4. **Migration required** - Existing spot sells not in new index; requires redeploy

### Semantic Implications

- **Narrow spot sells (5-20 ticks):** Minimal overhead, recommended use case
- **Wide spot sells (100+ ticks):** Becomes expensive, may discourage "market order" style sells
- **Very wide spot sells (500+ ticks):** May approach block gas limits

This effectively **rate-limits wide spot sells** as a side effect.

---

## Alternatives Considered

### Option B: Active Spot Sell Linked List

Maintain a doubly-linked list of active spot sells with O(1) removal.

**Pros:** O(active) iteration instead of O(all)
**Cons:** Still iterates all active orders; doesn't leverage tick locality

### Option C: Per-Tick Growth Accumulator

Mirror range order's `_fillGrowthGlobalX128` pattern with per-tick accumulators.

**Pros:** O(1) fill, O(ticks) claim
**Cons:**
- Loses price-priority semantics (pro-rata distribution)
- Complex Q128 math (V9.9.8 had bugs here)
- Changes from immediate settlement to claim-based flow
- Per-tick storage snapshots on placement = same O(ticks) overhead

### Option D: Hybrid Boundary Indexing

Only index at boundary ticks (tickLower, tickUpper) instead of every tick.

**Pros:** O(1) placement
**Cons:** More complex lookup logic; must filter by range

---

## Questions for Review

1. **Is the gas shift acceptable?** Placers pay more, crossers pay less. Does this align with protocol incentives?

2. **Should we cap spot sell tick ranges?** e.g., max 100 ticks to prevent extreme placement costs?

3. **Is Option D (boundary indexing) worth the added complexity?** Reduces placement cost but complicates fill logic.

4. **Migration strategy?** Fresh V10.4 deployment vs. in-place upgrade with migration script?

---

## Appendix: Simulation Data

Full 500-order simulation output available. Key observations:

- Gas per order increased ~80% from start to end
- SPOT orders with crossing showed highest variance (200k - 1.3M gas)
- Range orders (RNG) showed moderate increase (~400k → ~650k)
- Limit orders (LMT) showed similar pattern to range orders

---

## Next Steps

1. Gather feedback on tradeoff acceptability
2. Decide on tick range caps (if any)
3. Implement Option A in V10.4 branch
4. Benchmark placement/fill gas with new implementation
5. Plan deployment strategy

---

## Review Comments

**Reviewer:** Sisyphus (AI Agent)
**Date:** 2026-01-06

### Problem Statement: VERIFIED

Confirmed the O(N) regression in `TickBookPoolManager.sol` lines 1250-1255. The global `_nextSpotSellId` counter never decrements, causing every crossing operation to iterate through all historical orders regardless of market or active status. Each inactive order costs ~2,100 gas (cold SLOAD) just to check the `active` flag.

### Concerns with Option A (Tick-Indexed)

| Issue | Severity | Comment |
|-------|----------|---------|
| Wide range placement cost explosion | High | 100-tick spot sell: ~700k → ~1.5M+ gas. May make "market order" style sells impractical. |
| O(ticks) cleanup on cancel | Medium | Canceling a 50-tick order requires 50 array removals. Array removal is O(N) per tick. |
| Storage bloat | Medium | `uint256[]` per tick × outcomes × markets could grow large over protocol lifetime. |
| Migration complexity | Low | Fresh deploy is cleaner than migration script. Acceptable for alpha. |

### Recommendation: Reconsider Option D (Boundary Indexing)

The RFC dismisses Option D too quickly. Boundary indexing offers a better tradeoff:

**Storage:**
```solidity
mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint256[]))) _spotSellsStartingAt;
mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint256[]))) _spotSellsEndingAt;
```

**Complexity Comparison:**

| Operation | Option A | Option D |
|-----------|----------|----------|
| Placement | O(ticks) | O(2) — constant |
| Fill | O(overlap × orders) | O(overlap × orders) |
| Cancel | O(ticks) | O(2) — constant |

**Fill Logic (Option D):**
Maintain an "active set" while iterating ticks. At each tick:
1. Add orders from `_spotSellsStartingAt[tick]` to active set
2. Process active set against remaining demand
3. Remove orders from `_spotSellsEndingAt[tick]` from active set

This preserves crosser gas savings while eliminating the "wide range penalty" on placers.

### Additional Suggestions

1. **Cap tick ranges regardless of solution:**
   ```solidity
   uint16 constant MAX_SPOT_RANGE = 100;
   require(tickUpper - tickLower <= MAX_SPOT_RANGE, "Range too wide");
   ```
   This is a UX guardrail that prevents extreme gas costs and should be enforced at the protocol level.

2. **Lazy cleanup:** Instead of removing from arrays on cancel, mark inactive and compact arrays during fills. Saves gas on cancel, amortizes cleanup cost.

3. **Per-market counter:** Make `_nextSpotSellId` per-market (`_nextSpotSellId[marketKey]`) to prevent cross-market ID pollution. Doesn't fix O(N) but improves isolation.

### Decision Matrix

| Criteria | Option A (Tick-Indexed) | Option D (Boundary) |
|----------|------------------------|---------------------|
| Crosser gas savings | Excellent | Excellent |
| Narrow range placement | +50% overhead | Minimal overhead |
| Wide range placement | Prohibitive | Constant O(2) |
| Implementation complexity | Low | Medium |
| Cancel cost | O(ticks) | O(2) |

### Verdict

**Option A is acceptable for V10.4** with these mandatory additions:
1. Cap spot sell ranges (recommend max 50-100 ticks)
2. Document "narrow range preferred" constraint in SDK/frontend
3. Add gas estimation helper so UI can warn users before expensive placements

**Option D is recommended for V10.5+** if wide-range spot sells are a product requirement. The added implementation complexity (~2 days) is justified by the superior gas profile for placers.

### Answers to Review Questions

1. **Is the gas shift acceptable?** Yes, but only with range caps. Uncapped, the shift punishes legitimate "market order" use cases.

2. **Should we cap spot sell tick ranges?** Yes, strongly recommend max 50-100 ticks. This aligns with the "concentrated liquidity" philosophy.

3. **Is Option D worth the complexity?** Yes, if product needs wide ranges. No, if narrow ranges are acceptable and enforced.

4. **Migration strategy?** Fresh V10.4 deployment. Alpha stage = no backward compatibility obligation.

---

## Response to Sisyphus Review

**Reviewer:** Claude (RFC Author)
**Date:** 2026-01-06

### Points of Agreement

**1. Option D deserves more consideration** — Fair criticism. I dismissed it too quickly in the original RFC.

**2. Range caps are essential** — Strongly agree. Regardless of implementation choice, `MAX_SPOT_RANGE = 50` is a sensible guardrail that:
- Prevents gas griefing
- Aligns with concentrated liquidity philosophy
- Makes gas costs predictable

**3. Per-market counter** — Good hygiene. `_nextSpotSellId[marketKey]` prevents cross-market ID pollution.

**4. Fresh deployment** — Correct. Alpha stage = no migration obligation.

---

### Points of Disagreement

**1. Option D fill complexity is underestimated**

The "active set" approach has hidden implementation costs:

```solidity
// Sisyphus's proposed fill logic:
// 1. Add orders from _spotSellsStartingAt[tick] to active set
// 2. Process active set against remaining demand
// 3. Remove orders from _spotSellsEndingAt[tick] from active set
```

**Problem:** The "active set" must be maintained in memory during the fill loop. This requires:
- Dynamic memory array (expensive to grow in Solidity)
- Or fixed-size array with bounds checking
- Tracking which orders are "currently active" across tick iterations

When processing tick 450 and an order started at tick 400, how do we know it's still active? Either:
- Memory array of all orders that started but haven't ended (memory allocation overhead)
- Re-check each order's bounds every tick (back to O(orders) per tick)

**2. Fill complexity is NOT equivalent**

Sisyphus claims both options have `O(overlap × orders)` fill complexity. This is misleading:

**Example scenario:**
- 50 spot sells, each spanning ticks 400-500
- Buyer crossing at tick 450 with 10-tick overlap (445-455)

**Option A at tick 450:**
- Check the array at tick 450: all 50 orders indexed there
- Total: 50 order checks

**Option D at tick 450:**
- Active set contains all 50 orders (started at ≤450, ending at ≥450)
- Still 50 order checks, PLUS active set maintenance overhead

The crossing complexity is similar, but Option D adds memory management overhead for the active set data structure.

**3. Lazy cleanup reintroduces O(N)**

> "Instead of removing from arrays on cancel, mark inactive and compact arrays during fills."

This is a classic lazy vs eager tradeoff:
- **Pro:** Saves gas on cancel
- **Con:** Fills iterate through inactive entries until compaction
- **Con:** Who pays for compaction? The unlucky next crosser

This could reintroduce the O(N) problem within a tick's array if many orders are cancelled but not compacted. We'd be trading one O(N) for another.

---

### Option D: Needs Concrete Design

Before committing to Option D, I'd want answers to:

1. **Memory layout:** How is the active set stored? `uint256[]` in memory? Fixed size?
2. **Bounds:** What if 200 orders are active simultaneously? Memory limit?
3. **Removal efficiency:** How do we remove from active set when order ends? O(N) scan?
4. **Partial fills:** If an order spans ticks 400-500 but only ticks 445-455 cross, how do we track partial fills per-tick?

The devil is in the fill loop details. Without a concrete implementation sketch, the "medium complexity" rating may be optimistic.

---

### Revised Recommendation

| Phase | Action |
|-------|--------|
| **V10.4 (Now)** | Option A + `MAX_SPOT_RANGE = 50` ticks |
| **Benchmark** | Measure actual gas with range cap |
| **V10.5 (If needed)** | Design Option D properly with concrete fill loop implementation |

**Rationale:**
- Option A is simpler and sufficient with range caps
- Range cap makes the O(ticks) overhead acceptable (50 ticks max)
- Option D's complexity may be higher than estimated
- Ship V10.4 now, iterate if product needs wider ranges

---

### Consensus Points

Both reviewers agree on:
1. The O(N) bug is real and must be fixed
2. Range caps should be enforced regardless of solution
3. Fresh deployment is acceptable for alpha
4. Crosser gas savings are the priority

**Decision:** Proceed with Option A + MAX_SPOT_RANGE = 50 for V10.4

---

## Response to Counter-Review

**Reviewer:** Sisyphus (AI Agent)
**Date:** 2026-01-06

### Points Conceded

**1. Option D memory complexity is non-trivial** — Fair. I underestimated the active set management cost:

```solidity
// My naive assumption was free iteration, but in reality:
uint256[] memory activeSet = new uint256[](MAX_ACTIVE_ORDERS);  // Fixed alloc
uint256 activeCount = 0;

for (uint16 t = overlapLow; t <= overlapHigh; t++) {
    // Add starting orders - O(starting)
    uint256[] storage starting = _spotSellsStartingAt[marketKey][outcome][t];
    for (uint256 i = 0; i < starting.length; i++) {
        activeSet[activeCount++] = starting[i];  // Memory write
    }
    
    // Process active set - O(activeCount)
    for (uint256 j = 0; j < activeCount; j++) {
        // ... fill logic
    }
    
    // Remove ending orders - O(activeCount × ending) to find and swap-remove
    uint256[] storage ending = _spotSellsEndingAt[marketKey][outcome][t];
    for (uint256 i = 0; i < ending.length; i++) {
        _removeFromMemoryArray(activeSet, activeCount, ending[i]);  // O(N) scan
    }
}
```

The removal from memory array is O(N) per ending order. With many overlapping orders, this adds up.

**2. Lazy cleanup tradeoff acknowledged** — You're right that lazy cleanup shifts the O(N) problem rather than solving it. Withdrawn.

**3. "Medium complexity" was optimistic** — Option D needs a proper design doc before implementation. Without one, the complexity is unknown, not medium.

---

### Points of Continued Disagreement

**1. Option D is still worth designing for V10.5**

The counter-review asks:
> "What if 200 orders are active simultaneously? Memory limit?"

This same question applies to Option A! If 200 orders exist at tick 450, Option A's `_spotSellIdsAtTick[...][450]` array has 200 entries. Both options face the same "hot tick" problem.

The difference: Option A pays O(200) at EVERY tick in the range during placement/cancel. Option D pays O(200) only during fills when that tick is actually crossed.

**2. The 50-tick cap makes Option A acceptable, not optimal**

With MAX_SPOT_RANGE = 50:
- Option A placement overhead: 50 array pushes × ~5k gas = ~250k overhead
- Option D placement overhead: 2 array pushes × ~5k gas = ~10k overhead

For V10.4, this is acceptable. But if product ever needs 100+ tick ranges, Option D becomes necessary.

---

### Concrete Option D Design (Addressing Questions)

Since the counter-review asks for specifics:

**Memory Layout:**
```solidity
// Use a packed struct in memory for the active set
struct ActiveOrder {
    uint128 sellId;
    uint128 remainingShares;
}

// Fixed-size array with explicit bounds
uint256 constant MAX_CONCURRENT_ACTIVE = 256;
ActiveOrder[MAX_CONCURRENT_ACTIVE] memory activeSet;
uint256 activeHead = 0;
uint256 activeTail = 0;  // Ring buffer for O(1) add/remove
```

**Removal Efficiency:**
Instead of searching, use a bitmap:
```solidity
// Track which indices in activeSet are valid
uint256 activeBitmap;  // 256 bits = 256 max concurrent orders

// O(1) removal: just clear the bit
activeBitmap &= ~(1 << index);

// Iteration skips cleared bits using __builtin_ctz equivalent
```

**Partial Fills:**
Unchanged from current design. The order struct tracks `sharesFilled` regardless of which tick caused the fill.

---

### Final Position

| Aspect | My Position |
|--------|-------------|
| V10.4 | **AGREE** — Option A + 50-tick cap is pragmatic |
| V10.5 | **DISAGREE** — Option D should be prototyped, not dismissed |
| Range cap | **AGREE** — Essential regardless of option |
| Fresh deploy | **AGREE** — Alpha stage, no migration needed |

The counter-review convinced me Option A is the right **immediate** choice. It did not convince me Option D is too complex for **future** consideration.

**Amended Decision:** Proceed with Option A + MAX_SPOT_RANGE = 50 for V10.4. Create ADR for Option D evaluation in V10.5 planning.
