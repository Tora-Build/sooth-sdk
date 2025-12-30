# TickBook V2: Continuous Range Orders (ADR-052)

**Status**: Draft  
**Date**: 2025-12-28  
**Supersedes**: ADR-051 (discrete tick-per-order model)  
**Inspiration**: Uniswap V3 Concentrated Liquidity

---

## Problem Statement

The current TickBook (ADR-051) stores **one Order struct per tick** in a range:

```solidity
for (uint16 tick = tickLower; tick <= tickUpper; tick++) {
    _orders[marketKey][orderId] = Order({...});  // 201 SSTOREs for 201 ticks
}
```

**Gas Cost**: ~5M gas for a 200-tick range order. Unusable.

---

## Solution: Continuous Range Orders

Store range orders as **single entries**. Price moves **continuously** within ranges as takers trade.

### Core Concept

```
┌──────────────────────────────────────────────────┐
│  Range Order #42                                 │
│  Owner: 0xAlice                                  │
│  Outcome: YES                                    │
│  Range: 40.0% ←────────────────→ 60.0%          │
│  Liquidity: 10,000 shares                        │
│                      ↑                           │
│              Current Price: 47.3%                │
│              (moves as takers trade)             │
└──────────────────────────────────────────────────┘
```

When a taker **buys YES**, they push the price UP within active ranges.  
When a taker **buys NO**, they push the price DOWN within active ranges.

---

## Data Structures

### 1. Range Order (O(1) storage per order)

```solidity
struct RangeOrder {
    address owner;
    uint8 outcome;          // 0 = selling NO (wants YES), 1 = selling YES (wants NO)
    uint16 tickLower;       // lower bound (1-999)
    uint16 tickUpper;       // upper bound (1-999)
    uint256 liquidity;      // shares provided (WAD)
    bool active;
}

// Single mapping for all orders
mapping(bytes32 => mapping(uint256 => RangeOrder)) private _orders;
uint256 private _nextOrderId;
```

### 2. Liquidity Tracking (Uniswap V3-style)

```solidity
// Per-tick boundary tracking
struct TickInfo {
    int128 liquidityNet;    // net liquidity change when crossing this tick
    uint128 liquidityGross; // total liquidity referencing this tick as a boundary
}

mapping(bytes32 => mapping(uint8 => mapping(uint16 => TickInfo))) private _ticks;

// Current state
mapping(bytes32 => uint16) private _currentTick;           // current price tick
mapping(bytes32 => uint128) private _activeLiquidity;      // liquidity at current tick
```

### 3. Bitmap (unchanged)

```solidity
// Bitmap for O(1) tick discovery
mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _bitmaps;
```

---

## Liquidity Mechanics

### Adding Liquidity (placeLimitOrder)

When Alice places: "Sell 1000 NO shares from tick 400 to 600"

```solidity
function placeLimitOrder(
    bytes32 marketKey,
    uint8 outcome,          // 0 = NO (maker gets YES on fill)
    uint16 tickLower,
    uint16 tickUpper,
    uint256 liquidity       // total shares for the range
) external returns (uint256 orderId) {
    // 1. Store ONE order (not per-tick)
    orderId = ++_nextOrderId;
    _orders[marketKey][orderId] = RangeOrder({
        owner: msg.sender,
        outcome: outcome,
        tickLower: tickLower,
        tickUpper: tickUpper,
        liquidity: liquidity,
        active: true
    });

    // 2. Update tick boundaries (2 SSTOREs only)
    _ticks[marketKey][outcome][tickLower].liquidityNet += int128(uint128(liquidity));
    _ticks[marketKey][outcome][tickLower].liquidityGross += uint128(liquidity);
    
    _ticks[marketKey][outcome][tickUpper].liquidityNet -= int128(uint128(liquidity));
    _ticks[marketKey][outcome][tickUpper].liquidityGross += uint128(liquidity);

    // 3. Update bitmap (2 bits)
    _bitmaps[marketKey][outcome].setBit(tickLower);
    _bitmaps[marketKey][outcome].setBit(tickUpper);

    // 4. Reserve collateral (one call)
    uint256 collateral = _calculateRangeCollateral(outcome, tickLower, tickUpper, liquidity);
    vault.reserveUsdc(msg.sender, collateral);
}
```

**Gas**: O(1) — ~100k gas regardless of range width.

### Removing Liquidity (cancelOrder)

```solidity
function cancelOrder(bytes32 marketKey, uint256 orderId) external {
    RangeOrder storage order = _orders[marketKey][orderId];
    require(order.active && order.owner == msg.sender);

    // Reverse the tick boundary updates
    _ticks[marketKey][order.outcome][order.tickLower].liquidityNet -= int128(uint128(order.liquidity));
    _ticks[marketKey][order.outcome][order.tickLower].liquidityGross -= uint128(order.liquidity);
    
    _ticks[marketKey][order.outcome][order.tickUpper].liquidityNet += int128(uint128(order.liquidity));
    _ticks[marketKey][order.outcome][order.tickUpper].liquidityGross -= uint128(order.liquidity);

    // Clear bitmap if no more liquidity
    if (_ticks[marketKey][order.outcome][order.tickLower].liquidityGross == 0) {
        _bitmaps[marketKey][order.outcome].clearBit(order.tickLower);
    }
    if (_ticks[marketKey][order.outcome][order.tickUpper].liquidityGross == 0) {
        _bitmaps[marketKey][order.outcome].clearBit(order.tickUpper);
    }

    // Release collateral
    uint256 collateral = _calculateRangeCollateral(order.outcome, order.tickLower, order.tickUpper, order.liquidity);
    vault.releaseUsdc(msg.sender, collateral);

    order.active = false;
}
```

---

## Trading Mechanics

### Price Movement Model

Within a liquidity range, price moves **linearly** as shares are consumed:

```
Price moves from P₀ to P₁ when filling Δ shares:

  ΔP = Δshares / activeLiquidity

If activeLiquidity = 10,000 and taker buys 100 shares:
  ΔP = 100 / 10,000 = 0.01 = 1% price movement
```

### executeMarketOrder (Buy YES)

```solidity
function executeMarketOrder(
    bytes32 marketKey,
    uint8 outcome,           // 1 = buy YES
    uint256 sharesToBuy,
    uint256 maxCost
) external returns (uint256 sharesFilled, uint256 totalCost) {
    uint16 currentTick = _currentTick[marketKey];
    uint128 activeLiq = _activeLiquidity[marketKey];
    uint256 remaining = sharesToBuy;

    while (remaining > 0) {
        // Find next tick boundary
        uint16 nextTick = _bitmaps[marketKey][0].findNextUp(currentTick);
        if (nextTick > MAX_TICK) break;

        // Calculate shares fillable within this segment
        uint256 ticksInSegment = uint256(nextTick - currentTick);
        uint256 fillableInSegment = uint256(activeLiq) * ticksInSegment * WAD / 1000; // scaled

        uint256 fillNow = remaining < fillableInSegment ? remaining : fillableInSegment;

        // Calculate cost for this segment (average price × shares)
        uint256 priceStart = TickMath.tickToProbability(currentTick);
        uint256 priceEnd = priceStart + (fillNow * WAD / activeLiq);
        uint256 avgPrice = (priceStart + priceEnd) / 2;
        uint256 segmentCost = (avgPrice * fillNow) / WAD;

        totalCost += segmentCost;
        sharesFilled += fillNow;
        remaining -= fillNow;

        // Move price cursor
        if (fillNow == fillableInSegment) {
            // Crossed the tick boundary
            currentTick = nextTick;
            activeLiq = uint128(int128(activeLiq) + _ticks[marketKey][0][nextTick].liquidityNet);
        } else {
            // Partial fill within segment
            uint256 ticksMoved = (fillNow * 1000) / (uint256(activeLiq) * WAD);
            currentTick += uint16(ticksMoved);
        }
    }

    require(totalCost <= maxCost, "TickBook: slippage");
    _currentTick[marketKey] = currentTick;
    _activeLiquidity[marketKey] = activeLiq;

    // Settle via vault
    vault.spendAvailableToMarket(msg.sender, market, totalCost);
    vault.creditOutcome(market, msg.sender, outcome, sharesFilled);
    _settleFilledMakers(marketKey, outcome, sharesFilled, totalCost);
}
```

---

## Maker Settlement (Fill Attribution)

### The Challenge

With continuous ranges, we need to attribute fills to individual makers proportionally.

### Solution: Global Fill Counter + Lazy Claiming

```solidity
// Global cumulative fills per market (like feeGrowthGlobal in Uni V3)
mapping(bytes32 => mapping(uint8 => uint256)) private _cumulativeFills;
mapping(bytes32 => mapping(uint8 => uint256)) private _cumulativeProceeds;

// Per-order snapshot (like feeGrowthInsideLast)
mapping(bytes32 => mapping(uint256 => uint256)) private _orderFillsSnapshot;
mapping(bytes32 => mapping(uint256 => uint256)) private _orderProceedsSnapshot;
```

When maker claims:

```solidity
function claimFills(bytes32 marketKey, uint256 orderId) external {
    RangeOrder storage order = _orders[marketKey][orderId];
    require(order.owner == msg.sender);

    // Calculate fills since last claim
    uint256 globalFills = _cumulativeFills[marketKey][order.outcome];
    uint256 lastSnapshot = _orderFillsSnapshot[marketKey][orderId];
    uint256 newFills = globalFills - lastSnapshot;

    // User's share based on their liquidity proportion
    uint256 userFills = (newFills * order.liquidity) / _totalLiquidity[marketKey][order.outcome];

    // Credit outcome shares
    vault.creditOutcome(market, msg.sender, order.outcome == 0 ? 1 : 0, userFills);

    // Release proportional collateral
    uint256 proceeds = (globalProceeds - lastProceedsSnapshot) * order.liquidity / totalLiq;
    // Proceeds stay in vault as available USDC (already paid by taker)

    _orderFillsSnapshot[marketKey][orderId] = globalFills;
}
```

---

## Collateral Model

### Maker Collateral (at order placement)

For a range [tickLower, tickUpper] with `L` liquidity:

```
If outcome = 0 (selling NO, wants YES):
  Average price = (tickLower + tickUpper) / 2 / 1000
  Collateral = (1 - avgPrice) × L

If outcome = 1 (selling YES, wants NO):
  Average price = (tickLower + tickUpper) / 2 / 1000
  Collateral = avgPrice × L
```

This is an approximation. For exact accounting, we'd integrate over the range.

### Taker Collateral (at execution)

Taker pays the **integral** of price over the shares filled:

```
Cost = ∫ P(s) ds from 0 to sharesFilled

For linear price movement:
Cost = (P_start + P_end) / 2 × sharesFilled
```

---

## Comparison: Old vs New

| Metric | Old (Per-Tick) | New (Continuous Range) |
|--------|----------------|------------------------|
| **placeLimitOrder gas** | O(range width) ~5M | O(1) ~100k |
| **cancelOrder gas** | O(range width) | O(1) |
| **executeMarketOrder gas** | O(ticks crossed) | O(tick boundaries crossed) |
| **Storage per order** | ~200 bytes × ticks | ~100 bytes |
| **Price granularity** | Discrete 0.1% | Continuous |
| **Fill attribution** | FIFO per tick | Pro-rata per range |

---

## Implementation Phases

### Phase 1: Core Contract
- [ ] `RangeOrder` struct with single-entry storage
- [ ] `liquidityNet`/`liquidityGross` tick tracking
- [ ] `placeLimitOrder` with O(1) placement
- [ ] `cancelOrder` with O(1) removal
- [ ] Basic `executeMarketOrder` with tick crossing

### Phase 2: Settlement
- [ ] Cumulative fill tracking
- [ ] `claimFills` for maker settlement
- [ ] Integration with TickBookVault

### Phase 3: Frontend
- [ ] Range order placement UI
- [ ] Depth visualization for continuous liquidity
- [ ] Fill claiming interface

---

## Design Decisions

1. **Price Curve**: **Linear** (simple, low gas, predictable)
2. **Partial Cancels**: No (full cancel only for alpha simplicity)
3. **Active Liquidity**: If price outside all ranges, no fills possible (return to discrete tick behavior at edges)
4. **Multiple Ranges Same Price**: Pro-rata fill attribution based on liquidity share

---

## References

- [Uniswap V3 Whitepaper](https://uniswap.org/whitepaper-v3.pdf)
- [Uniswap V3 Core: Pool.sol](https://github.com/Uniswap/v3-core/blob/main/contracts/UniswapV3Pool.sol)
- ADR-051: TickBook Vault-Native (superseded)

