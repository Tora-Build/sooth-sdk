# Unified Orderbook v3 Design Proposal

**Status:** ✅ Implemented  
**Date:** 2025-12-04  
**Authors:** Design Discussion

> **Implementation:** See `contracts/v3/` for SoothTraderVaultV3 and SoothMarketV3.  
> **Roadmap:** See [V3_ROADMAP.md](./V3_ROADMAP.md) for yield and time-lock modules.

---

## Executive Summary

Refactor the orderbook from a **collateral-locked synthetic short model** to a **unified mirrored orderbook** where every order is a simple buy of one side, and matching creates complete YES+NO token sets.

**Key Insight:** In binary markets, `Sell YES @ P` ≡ `Buy NO @ (1-P)`. Exploiting this duality eliminates collateral complexity entirely.

---

## Current Design (v2) Problems

### 1. Collateral Complexity

```solidity
// Current: Maker "sells" YES without owning it
placeOrder(YES, 0.60, 100);
// → Locks (1-0.60) × 100 = 40 USDC as "collateral"
// → Requires lock/unlock/release logic
```

### 2. One-Sided Orderbook

- Only SELL limit orders supported
- No BUY limit orders ("Buy YES if price drops to 0.40")
- Makers can only take short positions

### 3. Confusing UX

- "Selling" decreases balance (counterintuitive)
- Users don't understand collateral mechanics
- Short positions feel like second-class citizens

---

## Proposed Design (v3): Unified Mirrored Orderbook

### Core Principle

Every order is a **BUY order** for one side. The system stores all orders normalized to YES price.

| User Intent     | Stored As        | Matching                          |
| --------------- | ---------------- | --------------------------------- |
| Buy YES @ 0.60  | `yesPrice: 0.60` | Matches against `yesPrice ≤ 0.60` |
| Buy NO @ 0.40   | `yesPrice: 0.60` | Same order, different view        |
| Sell YES @ 0.60 | `yesPrice: 0.60` | Equivalent to Buy NO @ 0.40       |
| Sell NO @ 0.35  | `yesPrice: 0.65` | Equivalent to Buy YES @ 0.65      |

### Order Structure

```solidity
struct Order {
    uint256 id;
    address maker;
    uint256 yesPrice;   // Always normalized to YES price (0-1e18)
    uint256 amount;     // Number of shares
    uint256 timestamp;
    bool isBuySide;     // true = wants YES, false = wants NO
}
```

### Single Sorted Orderbook

```
           YES View                    NO View (Mirrored)
    ┌─────────────────────┐      ┌─────────────────────┐
    │ ASK: Sell YES @ 0.62│  ←→  │ BID: Buy NO @ 0.38  │
    │ ASK: Sell YES @ 0.60│  ←→  │ BID: Buy NO @ 0.40  │
    ├─────────────────────┤      ├─────────────────────┤
    │ BID: Buy YES @ 0.58 │  ←→  │ ASK: Sell NO @ 0.42│
    │ BID: Buy YES @ 0.55 │  ←→  │ ASK: Sell NO @ 0.45│
    └─────────────────────┘      └─────────────────────┘

    Same data, two views!
```

---

## Money Flow: Complete Set Model

### When Orders Match

```
Alice: Buy NO @ 0.40 (stored as yesPrice=0.60, isBuySide=false)
Bob:   Buy YES @ 0.60 (stored as yesPrice=0.60, isBuySide=true)

MATCH at yesPrice = 0.60:
┌──────────────────────────────────────────────────────────┐
│  Bob pays:    0.60 × 100 = 60 USDC  → Vault             │
│  Alice pays:  0.40 × 100 = 40 USDC  → Vault             │
│  ─────────────────────────────────────────────          │
│  Total:       1.00 × 100 = 100 USDC in Vault            │
│                                                          │
│  Bob receives:   100 YES tokens                          │
│  Alice receives: 100 NO tokens                           │
│                                                          │
│  At settlement: Winner redeems 1.00 per token           │
│                 Loser's tokens worth 0                  │
└──────────────────────────────────────────────────────────┘
```

### Key Property: Always Fully Funded

- Every matched pair deposits exactly 1.00 USDC per share
- Vault always has exact funds for settlement
- No collateral lock/unlock needed

---

## Implementation Sketch

### Order Placement

```solidity
function placeOrder(
    uint8 outcome,      // 0 = YES, 1 = NO
    uint256 price,      // Price for that outcome
    uint256 amount
) external returns (uint256 orderId) {
    require(price > 0 && price < 1e18, "Invalid price");

    // User pays upfront (no collateral concept)
    uint256 cost = price * amount / 1e18;
    traderVault.debit(msg.sender, cost);

    // Normalize to YES price
    uint256 yesPrice = (outcome == 0) ? price : (1e18 - price);
    bool isBuySide = (outcome == 0);

    orderId = nextOrderId++;
    orders[orderId] = Order({
        id: orderId,
        maker: msg.sender,
        yesPrice: yesPrice,
        amount: amount,
        timestamp: block.timestamp,
        isBuySide: isBuySide
    });

    _insertOrder(orderId, yesPrice, isBuySide);
    emit OrderPlaced(orderId, msg.sender, outcome, price, amount);
}
```

### Order Matching

```solidity
function _tryMatch(uint256 orderId) internal {
    Order storage order = orders[orderId];

    // Find opposite side orders that cross
    uint256 matchId = order.isBuySide
        ? _findBestAsk(order.yesPrice)   // YES buyer matches against asks
        : _findBestBid(order.yesPrice);  // NO buyer matches against bids

    while (matchId != 0 && order.amount > 0) {
        Order storage match = orders[matchId];
        uint256 fill = min(order.amount, match.amount);

        // Mint tokens (money already in vault)
        if (order.isBuySide) {
            yesBalance[order.maker] += fill;
            noBalance[match.maker] += fill;
        } else {
            noBalance[order.maker] += fill;
            yesBalance[match.maker] += fill;
        }

        order.amount -= fill;
        match.amount -= fill;

        emit OrderMatched(orderId, matchId, fill, order.yesPrice);

        if (match.amount == 0) {
            _removeOrder(matchId);
        }

        matchId = order.isBuySide
            ? _findBestAsk(order.yesPrice)
            : _findBestBid(order.yesPrice);
    }
}
```

### Order Cancellation

```solidity
function cancelOrder(uint256 orderId) external {
    Order storage order = orders[orderId];
    require(order.maker == msg.sender, "Not maker");
    require(order.amount > 0, "Already filled");

    // Refund remaining cost
    uint256 price = order.isBuySide
        ? order.yesPrice
        : (1e18 - order.yesPrice);
    uint256 refund = price * order.amount / 1e18;

    traderVault.credit(msg.sender, refund);
    _removeOrder(orderId);
    delete orders[orderId];

    emit OrderCancelled(orderId);
}
```

---

## Comparison: v2 vs v3

| Aspect          | v2 (Current)             | v3 (Proposed)            |
| --------------- | ------------------------ | ------------------------ |
| Order types     | SELL only                | BUY + SELL (unified)     |
| Collateral      | Lock (1-price)           | None — pay upfront       |
| Money flow      | Complex lock/unlock      | Simple debit/credit      |
| Data structure  | Two orderbooks (YES/NO)  | One orderbook, two views |
| UX              | "Sell" decreases balance | "Buy NO" is intuitive    |
| Short positions | Via collateral           | First-class (Buy NO)     |
| Code complexity | ~100 lines lock logic    | Removed                  |

---

## Migration Path

### Phase 1: Dual Mode (Optional)

- Keep v2 for existing orders
- Add v3 for new orders
- Gradual migration

### Phase 2: Full v3

- Migrate all remaining v2 orders
- Remove collateral logic
- Simplify TraderVault

---

## Frontend Impact

### UI Changes

- "Sell YES" button → internally calls `placeOrder(NO, 1-price, amount)`
- Orderbook display shows both sides derived from same data
- Remove collateral display/calculation

### Simpler Hooks

```typescript
// Old
const cost = (1 - price) * amount; // Collateral calculation
await lockCollateral(cost);

// New
const cost = price * amount; // Just what you pay
await placeOrder(outcome, price, amount);
```

---

## Open Questions

1. **Price improvement:** When orders cross (`buyPrice > askPrice`), who gets the surplus?

   - Option A: Maker gets improvement
   - Option B: Taker gets improvement
   - Option C: Split

2. **Partial fills:** How to handle remaining unfilled order amounts?

   - Current: Stays in orderbook
   - Alternative: Return to user (market orders only)

3. **AMM integration:** How does unified orderbook interact with LMSR?
   - Unified ladder still applies
   - AMM is fallback after orderbook exhausted

---

## Conclusion

The unified mirrored orderbook is a **significant simplification** that:

- Eliminates collateral complexity
- Provides full 2-sided orderbook functionality
- Makes short positions first-class citizens
- Improves UX with intuitive "Buy YES/NO" mental model

Recommended for v3 implementation.
