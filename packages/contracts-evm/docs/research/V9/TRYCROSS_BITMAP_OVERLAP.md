# _tryCross Bitmap-Based Overlap Detection (V9.8)

## Overview

The `_tryCross` function determines if a newly placed range order can immediately match against existing opposing liquidity. This document describes the fix that replaced the flawed `currentTick`-based detection with bitmap-based overlap detection.

## The Problem

### Original Implementation (Broken)

```solidity
// Lines 975-977 - PROBLEMATIC
if (state.currentTick < newOrder.tickLower || state.currentTick > newOrder.tickUpper) {
    return (0, 0, 0);
}
```

**Why this failed:**

1. `currentTick` was initialized from `initialProbabilityWad` when the market was registered (e.g., tick 999 from graduation = ~99.9% probability)
2. `currentTick` only changed when market orders executed (via `_fill`)
3. Before any market orders, overlapping range orders should have matched but didn't because `currentTick` was outside both orders' ranges

**Example Failure Scenario:**
- Market graduates with `currentTick = 999` (99.9% probability)
- User A places BUY YES order at ticks [450, 460] (45-46% probability)
- User B places SELL YES order at ticks [450, 460] (same range)
- Both orders are at the EXACT SAME price and SHOULD cross immediately
- But `_tryCross` returned (0,0,0) because `currentTick (999) > newOrder.tickUpper (460)`

## The Solution

### New Implementation (Fixed)

The fix has two parts:

1. **Initialize `currentTick` to `MIN_TICK` (1)** instead of `initialProbabilityWad`
2. **Use bitmap-based overlap detection** in `_tryCross` instead of relying on `currentTick`

### Bitmap Overlap Detection

```solidity
// Find best opposing liquidity using bitmap
uint16 bestOpposite;
if (newOrder.outcome == 1) {
    // BUY YES: find lowest SELL YES tick (outcome=0 orders)
    bestOpposite = _bitmaps[marketKey][0].findNextUp(0);
    if (bestOpposite > MAX_TICK) return (0, 0, 0); // No SELL YES liquidity
} else {
    // SELL YES: find highest BUY YES tick (outcome=1 orders)
    bestOpposite = _bitmaps[marketKey][1].findNextDown(MAX_TICK + 1);
    if (bestOpposite > MAX_TICK) return (0, 0, 0); // No BUY YES liquidity
}

// Check if new order crosses best opposite
bool crosses;
if (newOrder.outcome == 1) {
    // BUY YES crosses if there's SELL YES at or below our max buy price
    crosses = bestOpposite <= newOrder.tickUpper;
} else {
    // SELL YES crosses if there's BUY YES at or above our min sell price
    crosses = bestOpposite >= newOrder.tickLower;
}
if (!crosses) return (0, 0, 0);
```

## Key Concepts

### Single YES Tickbook Model

There is only ONE tickbook for YES tokens:

| Outcome | Action | Description | UI Display |
|---------|--------|-------------|------------|
| `outcome = 1` | BUY YES | Demand for YES at tick price | "BUY YES" |
| `outcome = 0` | SELL YES | Supply of YES at tick price | "BUY NO" |

- All ticks represent YES probability (0-999 = 0%-99.9%)
- NO is just a **mirrored VIEW**, not a separate order book
- Orders cross when their tick ranges OVERLAP in the same tick space

### Tick Semantics

```
Tick 0   = 0.0% probability (MIN_TICK = 1)
Tick 500 = 50.0% probability
Tick 999 = 99.9% probability (MAX_TICK)
```

### Crossing Condition

Since both BUY YES and SELL YES use the SAME tick space:

- BUY YES at tick 460 = willing to pay 46% for YES
- SELL YES at tick 460 = willing to sell YES at 46%
- These are at the **EXACT SAME PRICE** and should cross immediately

Orders cross when their tick ranges **OVERLAP**:
- BUY YES at [450, 460] crosses SELL YES at [455, 465] because they overlap at [455, 460]

## Implementation Details

### registerMarket Changes

Both `registerMarket` functions now initialize `currentTick` to `MIN_TICK`:

```solidity
// Initialize currentTick to MIN_TICK - let trading establish the price
// The _tryCross function uses bitmap overlap detection, not currentTick
// Using MIN_TICK instead of 0 ensures _fill can search both up and down
_state[marketKey] = MarketState({
    currentTick: MIN_TICK,  // = 1
    activeLiquidityNo: 0,
    activeLiquidityYes: 0
});
```

**Why MIN_TICK (1) instead of 0:**
- The `_fill` function (used by market orders) searches from `currentTick`
- With `currentTick=0`, the check `if (!isUp && tick <= MIN_TICK) break;` would immediately exit
- Using `MIN_TICK` ensures `_fill` can search both upward and downward

### _tryCross Flow

```
1. Check opposing liquidity exists (_totalLiquidity)
   └── If zero, return (0, 0, 0)

2. Find best opposing tick using bitmap
   ├── BUY YES (outcome=1): findNextUp(0) → lowest SELL YES tick
   └── SELL YES (outcome=0): findNextDown(MAX_TICK+1) → highest BUY YES tick

3. Check if ranges overlap
   ├── BUY YES: bestOpposite <= newOrder.tickUpper
   └── SELL YES: bestOpposite >= newOrder.tickLower

4. Calculate crossTick (overlap point)
   ├── BUY YES: max(newOrder.tickLower, bestOpposite)
   └── SELL YES: min(newOrder.tickUpper, bestOpposite)

5. Execute crossing
   ├── Calculate shares and costs
   ├── Credit shares to new order owner
   ├── Update fill growth globals
   └── Update state.currentTick = crossTick

6. Emit OrdersCrossed event
```

### Cross Tick Calculation

The `crossTick` determines the price at which the cross executes:

```solidity
uint16 crossTick;
if (newOrder.outcome == 1) {
    // For BUY YES: cross at max(our tickLower, best SELL YES tick)
    crossTick = bestOpposite > newOrder.tickLower ? bestOpposite : newOrder.tickLower;
} else {
    // For SELL YES: cross at min(our tickUpper, best BUY YES tick)
    crossTick = bestOpposite < newOrder.tickUpper ? bestOpposite : newOrder.tickUpper;
}
```

### Cost Calculation

```solidity
uint256 crossPrice = TickMath.tickToProbability(crossTick);
uint256 yesCost = (crossPrice * crossedShares) / WAD;
uint256 noCost = crossedShares - yesCost;

if (newOrder.outcome == 0) {
    newOrderCost = noCost;
    oppositeCost = yesCost;
} else {
    newOrderCost = yesCost;
    oppositeCost = noCost;
}
```

## Bitmap Functions

### findNextUp(startTick)

Searches upward from `startTick` (exclusive) to find the next tick with liquidity.

```solidity
// Returns first tick > startTick that has liquidity
// Returns MAX_TICK + 1 if none found
uint16 nextTick = _bitmaps[marketKey][outcome].findNextUp(startTick);
```

### findNextDown(startTick)

Searches downward from `startTick` (exclusive) to find the next tick with liquidity.

```solidity
// Returns first tick < startTick that has liquidity
// Returns MAX_TICK + 1 if none found
uint16 nextTick = _bitmaps[marketKey][outcome].findNextDown(startTick);
```

## Edge Cases

| Case | Handling |
|------|----------|
| No opposing liquidity | `oppTotalLiq == 0` check returns early |
| Bitmap search finds nothing | `bestOpposite > MAX_TICK` returns early |
| Non-overlapping ranges | `crosses == false` returns early |
| Zero shares to cross | `crossedShares == 0` returns early |

## State Updates After Crossing

After a successful cross:

1. **New order owner receives shares** via `vault.creditOutcome()`
2. **Fill growth globals updated** for pro-rata distribution to existing makers
3. **Active liquidity decremented** for both sides
4. **currentTick updated** to `crossTick` for future market order fills

```solidity
// UPDATE currentTick to crossTick after crossing
state.currentTick = crossTick;
```

## Comparison: Before vs After

| Aspect | Before (Broken) | After (Fixed) |
|--------|-----------------|---------------|
| Detection method | `currentTick` range check | Bitmap overlap detection |
| `currentTick` init | `initialProbabilityWad` | `MIN_TICK` (1) |
| Can cross before trading? | No | Yes |
| Depends on market order history? | Yes | No |

## Testing

The fix includes updated tests in `TickBookPoolManager.t.sol`:

- `test_Integration_PlaceAndFill` - Verifies crossing between overlapping range orders
- `test_RegisterMarket_InitialTick` - Confirms `currentTick = 1` (MIN_TICK)
- `test_ExecuteMarketOrder` - Market orders with upward search direction
- `test_BatchClaimFills` - Batch claiming after market order fills

## Files Modified

| File | Changes |
|------|---------|
| `TickBookPoolManager.sol` | `registerMarket` init, `_tryCross` rewrite |
| `TickBookPoolManager.t.sol` | Test updates for new behavior |

## Related Documentation

- [TICKBOOK_FEES.md](./TICKBOOK_FEES.md) - Maker/taker fee system
- [TickBitmap.sol](../../contracts/libraries/TickBitmap.sol) - Bitmap implementation
- [TickMath.sol](../../contracts/libraries/TickMath.sol) - Tick/probability conversion

## Changelog

| Version | Date | Change |
|---------|------|--------|
| V9.8 | 2025-12-30 | Replaced `currentTick` check with bitmap overlap detection |
