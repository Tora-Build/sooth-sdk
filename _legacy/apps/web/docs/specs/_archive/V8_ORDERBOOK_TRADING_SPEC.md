# V8 Orderbook Trading Terminal Specification

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Draft

---

## Overview

The Orderbook Trading Terminal provides a **professional trading experience** for advanced users who want precise price control and deep liquidity. It uses a 10,000-tick continuous linear orderbook with concentrated liquidity.

### Target Users
- **Professional traders** - Price makers, arbitrageurs
- **Large trades** - Typically > $1,000
- **Liquidity providers** - Earn fees from spreads
- **Advanced users** - Understand orderbook mechanics

### Key Differentiators vs AMM
- ✅ Precise price control (limit orders)
- ✅ No slippage on limit orders
- ✅ Transferable ERC20 tokens
- ✅ No sell locks
- ✅ LP fee earning (0.2% taker fee)
- ⚠️ Requires liquidity at desired price
- ⚠️ More complex UX

---

## Page Structure

### Route
`/markets/:marketId/orderbook`

### Layout
```
┌─────────────────────────────────────────────┐
│  Market Header (shared component)           │
│  • Title, deadline, status                  │
│  • Current probability                      │
│  • Navigation: AMM | Orderbook | Info       │
└─────────────────────────────────────────────┘
┌──────────────────┬──────────────────────────┐
│  Orderbook       │  Trading Panel           │
│  • Depth chart   │  • Buy/Sell tabs         │
│  • Tick ladder   │  • Limit order form      │
│  • Spread info   │  • Market order form     │
└──────────────────┴──────────────────────────┘
┌─────────────────────────────────────────────┐
│  My Orders & Positions                      │
│  • Active limit orders                      │
│  • Token balances                           │
│  • LP positions                             │
└─────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Orderbook Display

**Component**: `OrderbookLadder.tsx`

#### Tick Ladder View

**Layout**:
```
┌─────────────────────────────────────┐
│ Asks (Sell Orders)                  │
├──────────┬──────────┬───────────────┤
│ Price    │ Size     │ Total         │
├──────────┼──────────┼───────────────┤
│ 55.5%    │ 1,234    │ 1,234         │ ← Darkest red
│ 55.0%    │ 2,456    │ 3,690         │
│ 54.5%    │ 3,678    │ 7,368         │
├──────────┴──────────┴───────────────┤
│ Spread: 0.5% (5 ticks)              │
├──────────┬──────────┬───────────────┤
│ 54.0%    │ 4,890    │ 4,890         │
│ 53.5%    │ 5,123    │ 10,013        │
│ 53.0%    │ 6,234    │ 16,247        │ ← Darkest green
└──────────┴──────────┴───────────────┘
│ Bids (Buy Orders)                   │
```

**Data Source**:
- Iterate ticks from current tick up/down
- For each tick: `TickBook.getTick(marketKey, tickIndex)`
- Filter ticks with `liquidityYES > 0` or `liquidityNO > 0`

**Formulas**:
- `price = TickMath.tickToProbability(tickIndex)` (WAD → %)
- `size = isBuy ? tick.liquidityYES : tick.liquidityNO`
- `total = cumulative sum of sizes`

**Visual Design**:
- **Gradient Intensity**: Based on size (larger = darker)
- **Asks**: Red gradient (#FF0000 → #330000)
- **Bids**: Green gradient (#00FF00 → #003300)
- **Spread**: Yellow highlight
- **Clickable**: Click tick to auto-fill order form

#### Depth Chart

**Component**: `DepthChart.tsx`

**Chart Type**: Area chart with two series

**Data**:
```typescript
{
  bids: [
    { price: 0.530, cumulative: 16247 },
    { price: 0.535, cumulative: 10013 },
    { price: 0.540, cumulative: 4890 }
  ],
  asks: [
    { price: 0.545, cumulative: 7368 },
    { price: 0.550, cumulative: 3690 },
    { price: 0.555, cumulative: 1234 }
  ]
}
```

**Visual**:
- **X-axis**: Price (probability)
- **Y-axis**: Cumulative size
- **Bids**: Green area (left side)
- **Asks**: Red area (right side)
- **Crosshair**: Show exact price/size on hover

---

### 2. Trading Panel

**Component**: `OrderbookTradingPanel.tsx`

#### Tab Structure
- **Limit Order**: Place order at specific price
- **Market Order**: Execute immediately at best available price

### Limit Order Tab

**Component**: `LimitOrderForm.tsx`

**Inputs**:
| Field | Type | Validation | Placeholder |
|-------|------|------------|-------------|
| **Side** | Radio | Buy/Sell | - |
| **Price** | Number | 0.01% - 99.99% | "Enter price %" |
| **Amount** | Number | > 0 | "Enter token amount" |

**Price Input**:
- **Tick Selector**: Dropdown showing nearby ticks
- **Custom Input**: Allow manual % entry
- **Validation**: Round to nearest tick (0.01% precision)

**Quote Display**:
```
You Provide:    XXX YES tokens
You Receive:    ~$XXX.XX USDC (if filled)
At Price:       XX.X%
Tick:           #XXXX
Fee:            $X.XX (0.2% taker)
```

**Formulas**:
- `tick = TickMath.probabilityToTick(price)`
- `usdcReceived = amount * price`
- `fee = usdcReceived * 0.002`

**Button States**:
- Disabled: "Connect Wallet"
- Disabled: "Insufficient Balance"
- Disabled: "Market Not Live"
- Enabled: "Place Limit Order"

**Transaction**:
```typescript
// 1. Approve tokens
await yesToken.approve(tickBook, amount);

// 2. Add liquidity at tick
await tickBook.addLiquidity(marketKey, tick, amount);
```

### Market Order Tab

**Component**: `MarketOrderForm.tsx`

**Inputs**:
| Field | Type | Validation | Placeholder |
|-------|------|------------|-------------|
| **Side** | Radio | Buy/Sell | - |
| **Amount** | Number | > 0 | "Enter amount" |
| **Limit Tick** | Number | 0-9999 | "Max slippage tick" |

**Quote Display** (Real-time):
```
You Pay:        XXX NO tokens
You Receive:    ~XXX YES tokens
Avg Price:      XX.X%
Price Impact:   +X.XX%
Ticks Crossed:  X
Fee:            XXX tokens (0.2%)
```

**Formulas**:
- `quote = TickBook.getQuote(marketKey, isBuy, amount, limitTick)`
- `avgPrice = quote.amountOut / amount`
- `fee = quote.feeAmount`

**Button States**:
- Disabled: "Insufficient Liquidity"
- Disabled: "Slippage Too High"
- Enabled: "Swap XXX for XXX"

**Transaction**:
```typescript
// 1. Approve input token
await inputToken.approve(tickBook, amount);

// 2. Execute swap
await tickBook.swap(marketKey, isBuy, amount, limitTick);
```

---

### 3. My Orders & Positions

**Component**: `OrderbookPositionsCard.tsx`

#### Active Limit Orders

**Table**:
| Side | Price | Amount | Filled | Action |
|------|-------|--------|--------|--------|
| Buy  | 53.5% | 1,000  | 0%     | [Cancel] |
| Sell | 56.0% | 2,000  | 50%    | [Cancel] |

**Data Source**:
- `TickBook.getUserLiquidity(marketKey, tick, user)` for each tick
- Filter ticks where `liquidity > 0`

**Cancel Action**:
```typescript
await tickBook.removeLiquidity(marketKey, tick, amount);
```

#### Token Balances

**Display**:
```
┌─────────────────────────────────────┐
│ My Tokens                           │
├─────────────────────────────────────┤
│ YES:  XXX tokens ($XXX.XX value)   │
│ NO:   XXX tokens ($XXX.XX value)   │
├─────────────────────────────────────┤
│ [Split USDC] [Merge Tokens]        │
└─────────────────────────────────────┘
```

**Data Source**:
- `OutcomeToken(yesToken).balanceOf(user)`
- `OutcomeToken(noToken).balanceOf(user)`
- Value = `balance * currentPrice`

**Actions**:
- **Split**: `Collateralizer.split(market, usdcAmount)` → 1 USDC = 1 YES + 1 NO
- **Merge**: `Collateralizer.merge(market, tokenAmount)` → 1 YES + 1 NO = 1 USDC

#### LP Positions

**Table**:
| Tick | Price | Liquidity | Fees Earned | Action |
|------|-------|-----------|-------------|--------|
| 5000 | 50.0% | 1,000     | $12.34      | [Remove] |
| 5500 | 55.0% | 2,000     | $45.67      | [Remove] |

**Data Source**:
- Iterate all ticks
- For each: `TickBook.getUserLiquidity(marketKey, tick, user)`
- Fees: `TickBook.getAccruedFees(marketKey, user)` (if implemented)

**Remove Action**:
```typescript
await tickBook.removeLiquidity(marketKey, tick, amount);
```

---

### 4. Liquidity Provision Panel

**Component**: `LiquidityPanel.tsx`

**Purpose**: Allow users to provide concentrated liquidity at specific ticks

**Inputs**:
| Field | Type | Validation | Placeholder |
|-------|------|------------|-------------|
| **Tick** | Number | 0-9999 | "Select tick" |
| **Amount** | Number | > 0 | "Enter amount" |

**Display**:
```
Add Liquidity at Tick #XXXX (XX.X%)

You Provide:
  XXX YES tokens
  XXX NO tokens (equal amounts)

You Receive:
  LP position at XX.X%
  Earn 0.2% fees on trades

[Add Liquidity Button]
```

**Transaction**:
```typescript
// 1. Approve both tokens
await yesToken.approve(tickBook, amount);
await noToken.approve(tickBook, amount);

// 2. Add liquidity
await tickBook.addLiquidity(marketKey, tick, amount);
```

---

## Hooks Specification

### `useOrderbook(marketAddress)`

**Returns**:
```typescript
{
  ticks: Array<{
    tickIndex: number;
    price: number;           // Probability (0-1)
    liquidityYES: bigint;
    liquidityNO: bigint;
  }>;
  currentTick: number;
  spread: number;            // In ticks
  isLoading: boolean;
  error: Error | null;
}
```

**Data Sources**:
- `TickBook.getCurrentTick(marketKey)` → `(tickIndex, probability)`
- `TickBook.findNextActiveTick(marketKey, startTick, isBuy)` → iterate
- `TickBook.getTick(marketKey, tickIndex)` → `(liquidityYES, liquidityNO)`

### `useOrderbookQuote(marketAddress, isBuy, amount, limitTick)`

**Returns**:
```typescript
{
  amountOut: bigint;
  finalTick: number;
  feeAmount: bigint;
  priceImpact: number;
  ticksCrossed: number;
  isLoading: boolean;
  error: Error | null;
}
```

**Data Source**:
- `TickBook.getQuote(marketKey, isBuy, amount, limitTick)`

### `useUserLiquidity(marketAddress, userAddress)`

**Returns**:
```typescript
{
  positions: Array<{
    tick: number;
    price: number;
    liquidity: bigint;
    feesEarned: bigint;
  }>;
  totalLiquidity: bigint;
  totalFees: bigint;
  isLoading: boolean;
  error: Error | null;
}
```

**Data Source**:
- Iterate ticks, call `TickBook.getUserLiquidity(marketKey, tick, user)`
- `TickBook.getAccruedFees(marketKey, user)` (if implemented)

---

## User Flows

### Flow 1: Place Limit Order

1. User navigates to `/markets/:id/orderbook`
2. Sees orderbook ladder with current spread
3. Clicks on tick at desired price (e.g., 54.5%)
4. Trading panel auto-fills price
5. Enters amount (e.g., 1,000 YES)
6. Sees quote: "Receive ~$545 if filled"
7. Clicks "Approve YES" (if needed)
8. Clicks "Place Limit Order"
9. Transaction confirms
10. Order appears in "My Orders" table
11. Success toast: "Limit order placed at 54.5%"

### Flow 2: Execute Market Order

1. User wants immediate execution
2. Switches to "Market Order" tab
3. Selects "Buy YES"
4. Enters amount (e.g., 500 NO tokens)
5. Sets slippage limit (e.g., tick 5500)
6. Sees quote: "~450 YES, avg price 52.5%, 3 ticks crossed"
7. Clicks "Approve NO" (if needed)
8. Clicks "Swap 500 NO for ~450 YES"
9. Transaction confirms
10. Tokens swapped instantly
11. Success toast: "Swapped 500 NO for 452 YES"

### Flow 3: Provide Liquidity

1. User has equal YES and NO tokens
2. Opens "Add Liquidity" panel
3. Selects tick (e.g., 5000 = 50%)
4. Enters amount (e.g., 1,000)
5. Sees: "Provide 1,000 YES + 1,000 NO, earn 0.2% fees"
6. Clicks "Approve YES" and "Approve NO"
7. Clicks "Add Liquidity"
8. Transaction confirms
9. LP position appears in table
10. Success toast: "Liquidity added at 50%"

### Flow 4: Remove Liquidity

1. User has active LP position
2. Sees position in "LP Positions" table
3. Clicks "Remove" on specific tick
4. Confirms removal
5. Transaction confirms
6. Receives YES and NO tokens back (proportional to current ratio)
7. Position removed from table
8. Success toast: "Liquidity removed, received XXX YES + XXX NO"

### Flow 5: Split & Merge

**Split Flow**:
1. User has USDC, wants to trade
2. Clicks "Split USDC" button
3. Enters amount (e.g., $1,000)
4. Clicks "Approve USDC"
5. Clicks "Split"
6. Receives 1,000 YES + 1,000 NO tokens
7. Can now trade on orderbook

**Merge Flow**:
1. User has equal YES and NO tokens
2. Clicks "Merge Tokens" button
3. Enters amount (e.g., 500)
4. Clicks "Approve YES" and "Approve NO"
5. Clicks "Merge"
6. Receives $500 USDC back
7. Tokens burned

---

## Error Handling

### Contract Errors

| Error | User Message | Action |
|-------|--------------|--------|
| `TickBook: not active` | "Market is not active" | Disable trading |
| `TickBook: insufficient liquidity` | "Not enough liquidity at this price" | Suggest different tick |
| `TickBook: tick out of range` | "Price must be between 0.01% and 99.99%" | Show valid range |
| `Collateralizer: insufficient tokens` | "Need equal YES and NO to merge" | Show balances |

---

## Mobile Considerations

### Responsive Layout
- **Desktop**: Side-by-side orderbook + trading panel
- **Tablet**: Stacked, orderbook on top
- **Mobile**: Tabs (Orderbook | Trade | Positions)

### Mobile Optimizations
- Simplified tick ladder (fewer rows)
- Swipeable tabs
- Bottom sheet for order forms
- Larger touch targets for tick selection

---

## Performance

### Optimization Strategies
- **Virtual scrolling** for tick ladder (render only visible)
- **Debounce** quote requests (300ms)
- **WebSocket** for real-time orderbook updates (future)
- **Cache** tick data (10s TTL)
- **Batch** liquidity queries

### Target Metrics
- **Orderbook Load**: < 1s
- **Quote Update**: < 500ms
- **Tick Selection**: < 100ms (instant feel)

---

## Testing Checklist

### Unit Tests
- [ ] Tick to probability conversion
- [ ] Quote calculation accuracy
- [ ] Spread calculation
- [ ] Fee calculation

### Integration Tests
- [ ] Place limit order
- [ ] Execute market order
- [ ] Add/remove liquidity
- [ ] Split/merge tokens

### E2E Tests
- [ ] Full trading cycle (split → trade → merge)
- [ ] LP provision and fee earning
- [ ] Multi-tick market orders
- [ ] Order cancellation

---

**Last Updated**: 2025-12-23  
**Next Review**: Before V8 frontend implementation
