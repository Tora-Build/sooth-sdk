# TickBook Order Matching Behavior Guide

**Version**: V10.7  
**Last Updated**: 2026-01-09  
**Audience**: Traders, Frontend Developers, Integrators

---

## Table of Contents

1. [Overview](#overview)
2. [Maker vs Taker Model](#maker-vs-taker-model)
3. [Order Types](#order-types)
4. [Crossing Behavior Matrix](#crossing-behavior-matrix)
5. [V10.7 Spot Sell Full-Range Search](#v107-spot-sell-full-range-search)
6. [Common Scenarios](#common-scenarios)
7. [Gas Considerations](#gas-considerations)
8. [Edge Cases](#edge-cases)

---

## Overview

TickBook uses a **hybrid orderbook** combining:
- **Range Orders**: Resting liquidity across a tick range
- **Spot Sells**: Pre-owned shares offered at specific prices
- **Unified Crossing**: Single matching engine for both types

**Key Principle**: Crossing only happens when placing **range orders** (takers). Spot sells are **passive liquidity** (makers).

---

## Maker vs Taker Model

### Makers (Passive Liquidity)
Place orders that **wait** on the orderbook to be filled:
- ✅ Spot Sell orders (`placeSpotSell`)
- ✅ Range orders that don't immediately cross
- **Do NOT trigger crossing** when placed
- Filled when takers arrive

### Takers (Active Orders)
Place orders that **actively search** for liquidity:
- ✅ Range orders (`placeOrder`)
- **DO trigger crossing** via `_unifiedCross()`
- Fill against makers immediately if overlap exists

---

## Order Types

### 1. Range Order (Limit Order)
```solidity
placeOrder(marketKey, outcome, shares, tickLower, tickUpper, maxCost)
```

**Behavior**:
1. **First**: Searches for spot sells in range → fills them
2. **Second**: Searches for opposing range orders → crosses them
3. **Third**: Places any unfilled portion on the book

**Example**:
```javascript
// Buy NO at 10-50% for 1000 shares
placeOrder(marketKey, 0, 1000, 100, 500, 5000e18)

// This will:
// 1. Fill any NO spot sells between ticks 100-500
// 2. Cross with YES range orders (converted to NO-equivalent ticks)
// 3. Place remainder on book as resting liquidity
```

### 2. Spot Sell Order
```solidity
placeSpotSell(marketKey, outcome, shares, tickLower, tickUpper)
```

**Behavior**:
1. Locks your existing shares
2. Adds sell order to spot sell storage
3. **Does NOT cross** with existing orders
4. Waits for takers to fill it

**Example**:
```javascript
// Sell 1000 NO shares at 10-11%
placeSpotSell(marketKey, 0, 1000, 100, 110)

// This will:
// 1. Lock 1000 NO shares from your vault balance
// 2. Add to spot sell orderbook
// 3. Wait passively for range orders to fill it
```

### 3. Market Order (Shortcut)
```javascript
// Market buy = Range order at full range (ticks 1-999)
placeOrder(marketKey, outcome, shares, 1, 999, maxCost)
```

**Note**: Market orders are just range orders with maximum tick range. They still use the same crossing logic.

---

## Crossing Behavior Matrix

| Action | Crosses Spot Sells? | Crosses Range Orders? | Becomes Maker? |
|--------|---------------------|----------------------|----------------|
| `placeOrder()` | ✅ YES (V10.7+) | ✅ YES | ✅ YES (if unfilled) |
| `placeSpotSell()` | ❌ NO | ❌ NO | ✅ YES (always) |
| `buyFromSpotSell()` | ✅ YES (direct) | ❌ NO | ❌ NO |

---

## V10.7 Spot Sell Full-Range Search

### The Problem (V10.0-V10.6)

**Before V10.7**, `placeOrder()` only searched for spot sells in a **narrow overlap range**:

```
Scenario:
- Alice places NO spot sell at ticks 100-110 (asking 10-11%)
- Bob places NO buy order at ticks 1-500 (willing to pay up to 50%)

V10.6 Behavior: ❌ NO CROSSING
- Overlap calculation found market-clearing price around tick 430
- Only searched for spot sells near tick 430
- Alice's spot sell at ticks 100-110 was invisible
- Bob's order went to the book unfilled
```

### The Fix (V10.7)

**Now**, `placeOrder()` searches the buyer's **full tick range** for spot sells:

```solidity
// V10.7: Extract buyer's full range
uint16 buyerYesLow, buyerYesHigh;
if (newOrder.outcome == 1) {
    buyerYesLow = newOrder.tickLower;
    buyerYesHigh = newOrder.tickUpper;
} else {
    // Convert NO buyer's range to YES-equivalent
    buyerYesLow = MAX_TICK + 1 - newOrder.tickUpper;
    buyerYesHigh = MAX_TICK + 1 - newOrder.tickLower;
}

// Search this FULL range for spot sells
_fillSpotLiquidity(..., buyerYesLow, buyerYesHigh, ...)
```

**V10.7 Behavior: ✅ CROSSING**
- Searches ticks 1-500 for NO spot sells
- Finds Alice's spot sell at ticks 100-110
- Fills it immediately
- Bob gets his shares, Alice gets paid

### Gas Impact

- **Before**: ~350k gas
- **After**: ~361k gas (+11k, +3.1%)
- **Reason**: Wider tick search range
- **Verdict**: Acceptable tradeoff for correctness

---

## Common Scenarios

### Scenario 1: Spot Sell Doesn't Cross Existing Orders

**Setup**:
```javascript
// Step 1: Alice places NO buy order
placeOrder(marketKey, 0, 5000, 1, 500, 10000e18)
// Order is now on the book waiting

// Step 2: Bob places NO spot sell at better price
placeSpotSell(marketKey, 0, 1000, 100, 110)
```

**Result**:
- ❌ Spot sell does NOT cross with Alice's order
- Bob's spot sell sits on the book (0% filled)
- Alice's order sits on the book (0 filled)

**Why**: Spot sells are passive. They don't trigger crossing.

**To Fill**:
- Alice needs to place a NEW order, OR
- Someone else places a buy order that includes ticks 100-110

---

### Scenario 2: Range Order Crosses Spot Sell (V10.7)

**Setup**:
```javascript
// Step 1: Alice places NO spot sell
placeSpotSell(marketKey, 0, 1000, 100, 110)
// Sitting on book, 0% filled

// Step 2: Bob places NO buy order
placeOrder(marketKey, 0, 5000, 1, 500, 10000e18)
```

**Result**:
- ✅ Bob's order searches ticks 1-500 for spot sells
- ✅ Finds Alice's spot sell at ticks 100-110
- ✅ Fills it (Alice gets ~110 USDC, Bob gets 1000 NO shares)
- Remaining 4000 shares go to book as range order

**Why**: Range orders are takers. They actively cross spot sells in their range.

---

### Scenario 3: Multiple Spot Sells at Different Prices

**Setup**:
```javascript
// Alice: NO spot sell at 10-11%
placeSpotSell(marketKey, 0, 500, 100, 110)

// Bob: NO spot sell at 15-16%  
placeSpotSell(marketKey, 0, 500, 150, 160)

// Carol: NO spot sell at 20-21%
placeSpotSell(marketKey, 0, 500, 200, 210)

// Dave places NO buy order willing to pay up to 30%
placeOrder(marketKey, 0, 2000, 1, 300, 5000e18)
```

**Result**:
- ✅ Dave's order fills ALL three spot sells (total 1500 shares)
- Fills in price priority: Alice (cheapest) → Bob → Carol
- Remaining 500 shares go to book as range order

**Why**: V10.7 searches the full range (ticks 1-300) and finds all spot sells within it.

---

### Scenario 4: Range Order vs Range Order Crossing

**Setup**:
```javascript
// Alice: Sell YES 40-60% (willing to sell YES at 40-60%)
placeOrder(marketKey, 1, 1000, 400, 600, 0)

// Bob: Buy NO 40-60% (willing to buy NO at 40-60%)
// This is the SAME as selling YES at 40-60%!
placeOrder(marketKey, 0, 1000, 400, 600, 10000e18)
```

**Result**:
- ✅ Orders cross (they want the same thing from opposite sides)
- Both get filled based on pro-rata distribution
- This is the "range vs range" crossing from V10 unified logic

---

## Gas Considerations

### Spot Sell Gas Costs

**Placement** (`placeSpotSell`):
- Base: ~100k gas
- +50 gas per tick in range
- **Example**: 50-tick range = ~102.5k gas

**Filling** (`placeOrder` crossing):
- Base: ~250k gas
- +~2k gas per spot sell order found
- +gas for tick-by-tick liquidity distribution
- **Example**: Crossing 3 spot sells = ~256k gas

### Range Order Gas Costs

**Placement** (`placeOrder`):
- V10.7 baseline: ~361k gas (includes spot sell search)
- +gas for each spot sell crossed
- +gas for range-vs-range crossing
- **Example**: Cross 2 spot sells + 1 range order = ~380k gas

### Gas Optimization Tips

1. **Narrow spot sell ranges** → Lower placement cost
2. **Batch claim fills** → Amortize overhead across multiple orders
3. **Cancel unfilled orders** → Free up storage for gas refunds
4. **Use market orders sparingly** → Full range (1-999) is most expensive

---

## Edge Cases

### Edge Case 1: Spot Sell Outside Buy Order Range

**Setup**:
```javascript
// Alice: NO spot sell at 60-65%
placeSpotSell(marketKey, 0, 1000, 600, 650)

// Bob: NO buy order willing to pay up to 50%
placeOrder(marketKey, 0, 5000, 1, 500, 10000e18)
```

**Result**:
- ❌ No crossing
- Alice's spot sell is outside Bob's price tolerance (tick 500 max)
- Bob's order goes to book unfilled

---

### Edge Case 2: Dust Amounts (< 1000 wei)

**V10.6+ Behavior**:
- Orders with < 1000 wei unfilled remain `active=true`
- Liquidity removed from book
- Order stays visible and claimable
- User can still claim dust fills

**Example**:
```javascript
// Order placed for 1000.000000000000000999 shares
// Filled 1000.000000000000000000 shares
// Remaining: 999 wei

// V10.5: Order marked inactive (disappeared)
// V10.6+: Order stays active (user can claim)
```

---

### Edge Case 3: MAX_TICK (999) Boundary

**V10.3+ Fix**:
- Range orders ending at tick 999 now visible in overlap discovery
- Previous versions had off-by-one error at top of book
- Now top-of-book liquidity correctly participates in crossing

---

### Edge Case 4: Zero Crossing Amount

**Setup**:
```javascript
// Tiny spot sell
placeSpotSell(marketKey, 0, 1, 500, 500)

// Large buy order
placeOrder(marketKey, 0, 1000000, 1, 999, MAX_UINT256)
```

**Result**:
- ✅ Spot sell still gets filled
- Even tiny amounts cross if ranges overlap
- No minimum crossing amount (except dust threshold)

---

## Order Lifecycle State Machine

```
Range Order States:
┌─────────┐  placeOrder()   ┌────────┐  claim()    ┌──────────┐
│ NONE    │ ──────────────→ │ ACTIVE │ ──────────→ │ INACTIVE │
└─────────┘                 └────────┘             └──────────┘
                               │  ▲
                cancel()        │  │ cross with
                               │  │ new orders
                               ▼  │
                            ┌─────────┐
                            │ PARTIAL │
                            └─────────┘

Spot Sell States:
┌─────────┐ placeSpotSell() ┌────────┐ claimspotsell() ┌──────────┐
│ NONE    │ ──────────────→ │ ACTIVE │ ──────────────→ │ INACTIVE │
└─────────┘                 └────────┘                 └──────────┘
                               │  ▲
            cancelspotsell()   │  │ placeOrder()
                               │  │ (by others)
                               ▼  │
                            ┌─────────┐
                            │ PARTIAL │
                            └─────────┘
```

---

## API Quick Reference

### Core Functions

```solidity
// Place a range order (taker - actively crosses)
function placeOrder(
    bytes32 marketKey,
    uint8 outcome,        // 0=NO, 1=YES
    uint256 shares,
    uint16 tickLower,     // Min tick (1-999)
    uint16 tickUpper,     // Max tick (1-999)
    uint256 maxCost       // Max USDC to spend
) external returns (
    uint256 orderId,
    uint256 filledShares,
    uint256 filledCost,
    uint256 restingShares
);

// Place a spot sell (maker - waits passively)
function placeSpotSell(
    bytes32 marketKey,
    uint8 outcome,        // 0=NO, 1=YES
    uint256 shares,       // Must own these shares
    uint16 tickLower,     // Min tick (1-999)
    uint16 tickUpper      // Max tick (1-999)
) external returns (uint256 sellId);

// Cancel range order
function cancelOrder(bytes32 marketKey, uint256 orderId) external;

// Cancel spot sell
function cancelSpotSell(bytes32 marketKey, uint256 sellId) external;

// Claim fills on range order
function claimFills(bytes32 marketKey, uint256 orderId) external;

// Claim proceeds on spot sell
function claimSpotSellProceeds(bytes32 marketKey, uint256 sellId) external;
```

### View Functions

```solidity
// Get range order details
function getOrder(bytes32 marketKey, uint256 orderId) 
    external view returns (
        address owner,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        bool active,
        uint128 sharesTotal,
        uint128 sharesFilled,
        uint128 collateralReserved
    );

// Get spot sell details
function getSpotSellOrder(bytes32 marketKey, uint256 sellId)
    external view returns (
        address owner,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        bool active,
        uint128 sharesTotal,
        uint128 sharesFilled,
        uint128 proceedsWad
    );
```

---

## Testing Guide

### Test Case 1: Validate V10.7 Fix

```javascript
// 1. Create market and graduate
createMarket('Test Market', 100e18)
graduate()

// 2. Get NO shares
market buy no 2000

// 3. Place NO spot sell at LOW ticks (good price)
placeSpotSell(marketKey, 0, 1000, 100, 110)
// Should show 0% filled initially

// 4. Place NO buy order at WIDE range
placeOrder(marketKey, 0, 5000, 1, 500, 10000e18)

// 5. Verify spot sell was filled
getSpotSellOrder(marketKey, 1)
// sharesFilled should be > 0 ✅

// If sharesFilled == 0, V10.7 fix is NOT working ❌
```

### Test Case 2: Verify Spot Sell Doesn't Cross Existing Orders

```javascript
// 1. Place buy order FIRST
placeOrder(marketKey, 0, 5000, 1, 500, 10000e18)

// 2. Place spot sell SECOND (within buy range)
placeSpotSell(marketKey, 0, 1000, 100, 110)

// 3. Verify spot sell is 0% filled
getSpotSellOrder(marketKey, 1)
// sharesFilled should be 0 (expected behavior)

// 4. Place ANOTHER buy order
placeOrder(marketKey, 0, 1000, 50, 200, 5000e18)

// 5. NOW spot sell should be filled
getSpotSellOrder(marketKey, 1)
// sharesFilled should be > 0 ✅
```

---

## Frontend Integration Tips

### Displaying Order Status

```typescript
interface OrderDisplay {
  orderId: number;
  type: 'range' | 'spotsell';
  side: 'YES' | 'NO';
  priceRange: string;       // "10.0% - 11.0%"
  total: string;            // "1,000.00 shares"
  filled: string;           // "490.00 shares"
  fillPercent: number;      // 49.0
  status: 'active' | 'partial' | 'filled' | 'cancelled';
}

function getOrderStatus(order): string {
  if (!order.active) return 'cancelled';
  if (order.sharesFilled === 0n) return 'active';
  if (order.sharesFilled === order.sharesTotal) return 'filled';
  return 'partial';
}
```

### Order Placement UX

**Best Practice**: Show expected crossing BEFORE confirming

```typescript
async function previewOrder(params) {
  // 1. Fetch existing spot sells in range
  const spotSells = await getSpotSellsInRange(
    params.marketKey,
    params.outcome,
    params.tickLower,
    params.tickUpper
  );
  
  // 2. Calculate expected fill
  const totalSpotLiquidity = spotSells.reduce(
    (sum, sell) => sum + sell.sharesAvailable, 0n
  );
  
  // 3. Show user
  return {
    requestedShares: params.shares,
    expectedImmediateFill: Math.min(params.shares, totalSpotLiquidity),
    expectedResting: Math.max(0, params.shares - totalSpotLiquidity),
    avgFillPrice: calculateAvgPrice(spotSells),
  };
}
```

### Real-time Updates

**Watch for these events**:

```solidity
// When placing orders
event RangeOrderPlaced(...)
event SpotSellPlaced(...)

// When crossing happens
event OrderCrossed(...)       // Range vs range
event SpotSellFilled(...)     // Spot sell filled by taker

// When claiming
event FillsClaimed(...)
event SpotSellProceedsClaimed(...)
```

---

## Migration Notes

### Upgrading from V10.6 to V10.7

**Contract Changes**:
- Modified `_unifiedCross()` to pass full buyer range to `_fillSpotLiquidity()`
- Gas increase: +11k per order placement
- **NO ABI changes** - fully backward compatible

**Frontend Changes**:
- None required (behavior improvement only)
- Optional: Update gas estimates for `placeOrder`

**Known Issues Fixed**:
- ✅ Spot sells at better prices now found
- ✅ Wider price discovery for takers
- ✅ More efficient price matching

**Breaking Changes**:
- None

---

## Troubleshooting

### "Spot sell not filling"

**Possible Causes**:
1. No takers have placed orders in your price range
2. You placed the spot sell after orders (they won't retroactively cross)
3. Your tick range is outside all buy orders

**Solution**: Wait for new takers, or cancel and use `market sell` instead

### "Order showing 0 filled but spot sells exist"

**Possible Causes**:
1. Spot sells are outside your tick range
2. Spot sells are for opposite outcome
3. Insufficient `maxCost` (order reverted before crossing)

**Solution**: Check tick ranges, increase `maxCost`, verify outcome

### "Insufficient shares" error

**Possible Causes**:
1. Trying to spot sell shares you don't own
2. Shares are locked in other orders
3. Shares are in wallet, not vault

**Solution**: 
- Check vault balance: `vault.getInternalOutcomes(market, user)`
- Cancel other orders to free shares
- Deposit shares to vault first

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| V10.7 | 2026-01-09 | **Spot sell full-range search fix** - search buyer's entire tick range |
| V10.6 | 2026-01-07 | Dust order visibility fix - orders with <1000 wei stay active |
| V10.4 | 2026-01-06 | Spot fill gas optimization (RFC-001) - tick-indexed spot fills |
| V10.0 | 2026-01-05 | Unified crossing architecture - single `placeOrder` API |

---

## Additional Resources

- **Contract Source**: `packages/contracts-core/src/TickBookPoolManager.sol`
- **Tests**: `packages/contracts-testing/test/crossing/SpotSellTickSpace.t.sol`
- **Architecture**: `docs/V10/contracts/03-TickBookPoolManager.md`
- **CHANGELOG**: `CHANGELOG.md`

---

**Questions?** Check `STATUS.md` for current deployment addresses and known issues.
