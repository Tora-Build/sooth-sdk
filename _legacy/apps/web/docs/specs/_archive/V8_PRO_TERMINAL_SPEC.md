# V8 Pro Terminal (TickBook) Specification

**Version**: 1.0.0  
**Last Updated**: 2025-12-25  
**Status**: Draft

---

## Overview

The **Pro Terminal** is a high-performance trading interface designed for professional traders—market makers, arbitrageurs, and sophisticated users who demand CEX-grade execution on prediction markets. It exposes the full power of Sooth's **10,000-tick Hybrid Concentrated Orderbook (TickBook)**.

### Design Philosophy
- **Monospace Terminal Aesthetic**: Dark theme, high-density information, keyboard-first UX
- **Zero Chrome, Maximum Data**: Every pixel serves a purpose
- **Pro Tools for Pro Traders**: Ranged limit orders, depth heatmaps, tick-level precision

### Target Users
| Actor | Description | Primary Use Case |
|-------|-------------|------------------|
| **Market Maker** | Provides liquidity across price ranges, earns 0.2% taker fees | Ranged limit orders |
| **Arbitrageur** | Exploits price gaps between AMM and TickBook | Market orders with slippage control |
| **PvP Trader** | Pure conviction trading against other traders | Limit orders at specific prices |
| **Large Trader** | Trades >$1,000 with minimal slippage | Deep orderbook execution |

### Key Differentiators vs AMM

| Feature | AMM (Trade Page) | TickBook (Pro Terminal) |
|---------|------------------|-------------------------|
| **Token Type** | Ledger-based positions | ERC20 tokens |
| **Order Types** | Market only | Limit + Market |
| **Sell Lock** | 24h cooldown | None (instant) |
| **Liquidity** | Always available | Depth-dependent |
| **Fee Model** | 5%/1% dynamic | 0.2% fixed taker fee |
| **Slippage** | LMSR curve | Multi-tick sweep |
| **Transfer** | Non-transferable | Fully transferable |

---

## Access Control

### Graduation Gate
The Pro Terminal is **only available for graduated markets**. Markets must:
1. Reach the graduation threshold (defined by creator)
2. Have their TickBook enabled by the protocol

**Pre-Graduation Display**:
```
┌───────────────────────────────────────────────────────┐
│   ⚡ TickBook Restricted                               │
│                                                        │
│   Hyper-orderbook venues are only available for        │
│   graduated markets. This market is still in its       │
│   bonding phase on the AMM.                           │
│                                                        │
│   [Switch to AMM Interface]                           │
└───────────────────────────────────────────────────────┘
```

### Route
`/pro/:marketId?`

If no `marketId` is provided, defaults to the first graduated V8.1 market on the current chain.

---

## Layout Architecture

### 2-Column Layout (Desktop)

The Pro Terminal uses a clean 2-column layout prioritizing usability over information density.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ← Back   Market Name                                      [TickBook Badge] │
│           Market description                                                │
│  [BTC-100K] [ETH-5K] [ALIEN]     ← Market tabs                             │
├──────────────────────────────────┬─────────────────────────────────────────┤
│                                  │                                         │
│  ORDER BOOK                   🔄 │  TRADE                                  │
│  ───────────────────────────────│  ─────────────────────────────────────  │
│  Price    Size       Total      │  Select Outcome                         │
│  ─────────────────────────────  │  [   YES   ] [   NO    ]               │
│  55.50%   1,234     1,234  ▓▓▓  │                                         │
│  55.00%   2,456     3,690  ▓▓   │  Action                                 │
│  54.50%   3,678     7,368  ▓    │  [ Buy ] [ Sell ]                       │
│  ───── Spread: 0.50% ─────      │                                         │
│  54.00%   4,890     4,890  ▓    │  [Limit Order] [Market Order]           │
│  53.50%   5,123    10,013  ▓▓   │                                         │
│  53.00%   6,234    16,247  ▓▓▓  │  Price Range    [Single] [Ranged]       │
│                                  │  [═══════════●═══════════]  Slider     │
│                                  │  Lower: [45.00] %  Upper: [55.00] %    │
│                                  │                                         │
│                                  │  Amount: [___________] tokens          │
│                                  │                                         │
│                                  │  Est. Value: $XX.XX  Fee: $0.XX        │
│                                  │                                         │
│                                  │  [ Place Limit Buy YES ]               │
├──────────────────────────────────┴─────────────────────────────────────────┤
│  MY TOKENS                                                                  │
│  USDC: 1,234    YES: 567    NO: 890                                        │
│  [Split USDC]  [Merge Tokens]                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### Grid Specification
- **2-column CSS Grid** on desktop (`lg:grid-cols-2`)
- **Left Column**: Orderbook Ladder with depth visualization
- **Right Column**: Trading Panel + Token Balances

### Key UI Features

1. **Outcome Selector (YES/NO)**: Toggle between trading YES or NO tokens
2. **Price Mode Toggle**: 
   - **Single**: Point order at exact price
   - **Ranged** (default): Concentrated liquidity across a range
3. **Dual-Slider**: Interactive range slider (滑动操作) with synced input fields
4. **Action Toggle**: Buy/Sell with clear visual states

### Responsive Breakpoints
| Breakpoint | Layout |
|------------|--------|
| Desktop (≥1024px) | 2-column grid |
| Tablet (768-1023px) | Stacked single column |
| Mobile (<768px) | Single column, full-width cards |

---

## Component Specifications

### 1. Market Selector Bar

**Component**: `ProMarketSelector.tsx`  
**Location**: Top utility bar

**Display**:
```
[BTC-100K ●] [ETH-5K] [ALIEN]          NET: Base Sepolia  |  LATENCY: 12ms
```

**Features**:
- **Market Tabs**: Clickable tabs for switching between graduated markets
- **Active Indicator**: Cyan glow on selected market
- **Network Status**: Green dot + chain name
- **Latency Monitor**: Estimated RPC latency

**Data Sources**:
- `marketsConfig.markets.filter(m => m.version === 'v8.1' && m.chainId === chainId)`
- `LaunchpadEngine.isGraduated(market)` for filtering

---

### 2. Inventory Sidebar

**Component**: `ProInventory.tsx`  
**Location**: Left sidebar

**Tabs**:
| Tab | Content |
|-----|---------|
| **INVENTORY** | Token balances + Split/Merge actions |
| **HISTORY** | Trade history (placeholder for now) |

#### Balances Display
```
┌─────────────────────────────┐
│ BALANCES                    │
├─────────────────────────────┤
│ USDC:  1,234                │
│ YES:   567                  │
│ NO:    890                  │
├─────────────────────────────┤
│ [SPLIT ↗]    [MERGE ↘]     │
└─────────────────────────────┘
```

**Data Sources**:
- `USDC.balanceOf(user)` → Display with 6 decimals
- `OutcomeToken(YES).balanceOf(user)` → Display with 18 decimals
- `OutcomeToken(NO).balanceOf(user)` → Display with 18 decimals

#### Split/Merge Actions

**Split Flow**:
1. User enters USDC amount in size input
2. Clicks "SPLIT"
3. Calls `Collateralizer.split(market, amount)`
4. 1 USDC → 1 YES + 1 NO

**Merge Flow**:
1. User enters token amount in size input
2. Clicks "MERGE"
3. Calls `Collateralizer.merge(market, amount)`
4. 1 YES + 1 NO → 1 USDC

#### Market Details
```
┌─────────────────────────────┐
│ DETAILS                     │
├─────────────────────────────┤
│ "Will BTC hit $100k..."     │
│                             │
│ TRUTH FINALITY: RETROACTIVE │
└─────────────────────────────┘
```

---

### 3. Tick Map (High-Fidelity Heatmap)

**Component**: `TickMap.tsx`  
**Location**: Center top

**Purpose**: Visualize the entire 10,000-tick orderbook as a 100×100 pixel grid, where each pixel represents one tick.

**Layout**:
```
TICK MAP (10,000)                        HIGH FIDELITY BITMAP
┌────────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░  │
│ ░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓██████▓▓▓▓▓▓░░░░░░░░░░░░░   │
│ ░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓████████████▓▓▓▓░░░░░░░░░░░░░    │
│                        ▲ current tick                      │
└────────────────────────────────────────────────────────────┘
```

**Visual Encoding**:
| Depth | Color | Opacity |
|-------|-------|---------|
| No liquidity | Slate-900 | 30% |
| Low depth | Cyan-500 | 40% |
| Medium depth | Cyan-400 | 60% |
| High depth | Cyan-300 | 80% |
| Very high | White | 100% |

**Interactions**:
- **Hover**: Show tooltip with tick info (price %, YES depth, NO depth)
- **Click**: Auto-fill price input in execution panel
- **Current Tick Marker**: Bright indicator line

**Data Source**:
- Aggregate `TickBook.getTick(marketKey, tickIndex)` for all active ticks
- Use bitmap optimization for O(1) discovery

---

### 4. Tick Ladder (Orderbook View)

**Component**: `TickLadder.tsx`  
**Location**: Center left

**Purpose**: Vertical price ladder showing nearby bids and asks with depth visualization.

**Layout**:
```
TICK LADDER
┌──────────────────────────────────┐
│ ASKS (Sell Orders)               │
├──────────┬───────────┬───────────┤
│ Price    │ YES Depth │ NO Depth  │
├──────────┼───────────┼───────────┤
│ 55.5%    │ 1,234 ▓▓▓ │     0     │ ← Darkest red
│ 55.0%    │ 2,456 ▓▓  │     0     │
│ 54.5%    │ 3,678 ▓   │     0     │
├──────────┴───────────┴───────────┤
│ ═══ SPREAD: 0.5% (5 ticks) ═══   │
├──────────┬───────────┬───────────┤
│ 54.0%    │     0     │ 4,890 ▓   │
│ 53.5%    │     0     │ 5,123 ▓▓  │
│ 53.0%    │     0     │ 6,234 ▓▓▓ │ ← Darkest green
└──────────┴───────────┴───────────┘
│ BIDS (Buy Orders)                │
```

**Visual Design**:
- **Asks**: Red gradient (rose-600 → rose-900)
- **Bids**: Green gradient (emerald-600 → emerald-900)
- **Spread Bar**: Yellow highlight
- **Depth Bars**: Proportional to max depth

**Interactions**:
- **Click Row**: Auto-fill price input, set trade mode (buy/sell) based on side

**Data Sources**:
- `useTickBookDirect(marketAddress, yesToken, noToken)`
- Returns `{ bids: Tick[], asks: Tick[], currentTick: number }`

**Formulas**:
- `price = tickIndex / 10000` → Display as `XX.XX%`
- Spread = `lowestAsk - highestBid` in ticks

---

### 5. Orderbook Depth Chart

**Component**: `OrderbookDepth.tsx`  
**Location**: Center bottom

**Purpose**: Area chart showing cumulative depth on both sides of the orderbook.

**Layout**:
```
MARKET DEPTH
   ▲ Cumulative Size
   │
   │       ▓▓▓▓
   │     ▓▓▓▓▓▓▓▓              ▓▓▓
   │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
   │ ▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓
   └────────────────────────────────────► Price
          BIDS           ASKS
```

**Visual Design**:
- **Bids (Left)**: Green area fill
- **Asks (Right)**: Red area fill
- **Mid Price**: Vertical dashed line
- **Gradient**: Opacity increases toward mid

**Data Transformation**:
```typescript
// Convert ticks to cumulative depth
bids.reduce((acc, tick) => {
  acc.push({
    price: tick.index / 10000,
    cumulative: (acc[acc.length - 1]?.cumulative ?? 0n) + tick.yesDepth
  });
  return acc;
}, []);
```

---

### 6. Execution Panel

**Component**: `ProExecutionPanel.tsx`  
**Location**: Right panel

#### Trade Mode Toggle
```
┌─────────────────────────────────┐
│ [  BUY YES  ] [  SELL YES  ]   │
└─────────────────────────────────┘
```

**States**:
- **Buy**: Emerald background, glowing shadow
- **Sell**: Rose background, glowing shadow

#### Order Type Toggle
```
┌─────────────────────────────────┐
│ [LIMIT (RANGE)] [ MARKET ]     │
└─────────────────────────────────┘
```

### Limit Order Form

**Inputs**:
| Field | Type | Validation | Placeholder |
|-------|------|------------|-------------|
| **Range Lower** | Number | 0.0001 - 0.9999 | `0.5000` |
| **Range Upper** | Number | Optional, >= Lower | `Leave empty for point order` |
| **Amount** | Number | > 0 | `100.00 SHARES` |

**Display**:
```
Range Lower (Prob)
┌─────────────────────────────────┐
│ 0.5500                          │ TICK #5500
└─────────────────────────────────┘

Range Upper (Optional)
┌─────────────────────────────────┐
│                                 │ Leave empty for point order
└─────────────────────────────────┘

Amount (Shares)
┌─────────────────────────────────┐
│ 100                             │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Estimated Value    Taker Fee   │
│ 55.00 USDC         0.0220      │
└─────────────────────────────────┘

[  PLACE LIMIT BUY  ]
```

**Formulas**:
- `tickLower = Math.round(priceLower * 10000)`
- `tickUpper = priceUpper ? Math.round(priceUpper * 10000) : tickLower`
- `estimatedValue = ((tickLower + tickUpper) / 2 / 10000) * amount`
- `takerFee = estimatedValue * 0.002` (0.2%)

**Transaction**:
```typescript
// 1. Approve tokens (if needed)
await yesToken.approve(tickBook, amount);

// 2. Place ranged limit order
await tickBook.placeLimitOrder(
  marketKey,
  Math.min(tickLower, tickUpper),  // lower bound
  Math.max(tickLower, tickUpper),  // upper bound
  parseUnits(amount, 18)
);
```

### Market Order Form

**Inputs**:
| Field | Type | Validation | Placeholder |
|-------|------|------------|-------------|
| **Amount** | Number | > 0 | `100.00 USDC` |
| **Slippage** | Auto | Tick limit | (Max: 9999 for buy, 0 for sell) |

**Display**:
```
Amount (Dollar Based)
┌─────────────────────────────────┐
│ 100                             │ 100.00 USDC
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Estimated Value    Taker Fee   │
│ 100.00 USDC        0.2000      │
│ Price Impact       Ticks       │
│ +0.45%             3           │
└─────────────────────────────────┘

[  EXECUTE MARKET BUY  ]
```

**Transaction**:
```typescript
const slippageTick = isBuy ? 9999 : 0; // Max slippage for now

await tickBook.executeMarketOrder(
  marketKey,
  isBuy,
  parseUnits(amount, 18),
  slippageTick
);
```

---

### 7. Active Orders Panel

**Component**: `ProActiveOrders.tsx`  
**Location**: Right panel (below execution)

**Display**:
```
ACTIVE ORDERS                    [Clear All]
┌─────────────────────────────────────────┐
│ BUY 0.5500  | 100 SHARES    [⟳] [✕]    │ ← Pending
│ SELL 0.6000 | 50 SHARES     [✕]        │ ← Filled partial
└─────────────────────────────────────────┘
        or
┌─────────────────────────────────────────┐
│     📊 No active limit orders           │
└─────────────────────────────────────────┘
```

**Data Sources**:
- Query user's liquidity positions across ticks
- `TickBook.getUserLiquidity(marketKey, tick, user)` for each active tick

**Actions**:
- **Cancel**: `TickBook.cancelLimitOrder(marketKey, tickLower, tickUpper)`

---

### 8. Keyboard Shortcuts Bar

**Component**: Footer bar  
**Location**: Bottom of screen

**Display**:
```
[B] BUY  [S] SELL  [↑↓] PRICE  [?] SHORTCUTS        V8.1 TICKBOOK TERMINAL
```

**Shortcuts**:
| Key | Action |
|-----|--------|
| `B` | Switch to Buy mode |
| `S` | Switch to Sell mode |
| `↑` | Increase price by 0.001 (0.01 with Shift) |
| `↓` | Decrease price by 0.001 (0.01 with Shift) |
| `Esc` | Clear all inputs |
| `?` | Toggle shortcuts help modal |

---

## Hooks Specification

### `useTickBookDirect(marketAddress, yesToken, noToken)`

**Returns**:
```typescript
{
  tickBook: {
    marketKey: `0x${string}`;
    currentTick: number;           // 0-9999
    probability: number;           // 0-1
    isActive: boolean;
    truthMarket: Address;
    yesToken: Address;
    noToken: Address;
    bids: Array<{
      index: number;
      price: number;               // 0-1
      yesDepth: bigint;            // WAD
      noDepth: bigint;             // WAD
    }>;
    asks: Array<{
      index: number;
      price: number;
      yesDepth: bigint;
      noDepth: bigint;
    }>;
  } | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

**Data Sources**:
- `TickBook.getCurrentTick(marketKey)` → `(tickIndex, probability)`
- `TickBook.getMarketInfo(marketKey)` → `(truthMarket, yesToken, noToken, isActive)`
- `TickBook.findNextActiveTick(marketKey, start, isUp)` → iterate for depth
- `TickBook.getTick(marketKey, tickIndex)` → `(yesDepth, noDepth)`

### `useTokenBalances(tokenAddresses)`

**Returns**:
```typescript
{
  balances: bigint[];              // Array of balances in token decimals
  refetch: () => void;
}
```

**Data Sources**:
- `ERC20.balanceOf(userAddress)` for each token

---

## User Flows

### Flow 1: Place Point Limit Order

1. User navigates to `/pro/:marketId`
2. Sees current orderbook state in Tick Ladder
3. Clicks on tick at 55.0% (row in ladder)
4. Price input auto-fills with `0.5500`
5. Enters amount: `100` shares
6. Sees quote: "Est. 55.00 USDC, Fee: 0.11"
7. Clicks "Place Limit Buy"
8. If tokens need approval, wallet prompts for approval
9. Transaction confirms
10. Order appears in Active Orders panel (optimistic UI)
11. Toast: "Limit order placed at 55.0%"

### Flow 2: Execute Market Order

1. User switches to "MARKET" order type
2. Enters dollar amount: `$100`
3. Sees quote with price impact and ticks crossed
4. Clicks "Execute Market Buy"
5. Transaction sweeps through orderbook ticks
6. Receives YES tokens at weighted average price
7. Balances update in Inventory
8. Toast: "Swapped 100 USDC for ~182 YES"

### Flow 3: Split & Trade

1. User has USDC but no outcome tokens
2. Enters `50` in size input
3. Clicks "SPLIT" in Inventory
4. Receives 50 YES + 50 NO tokens
5. Places limit sell on the NO tokens at 45%
6. Effectively takes a YES position with limit pricing

### Flow 4: Merge After Trade

1. User has 100 YES and 100 NO
2. Wants to exit position cleanly
3. Enters `100` in size input
4. Clicks "MERGE" in Inventory
5. Burns 100 YES + 100 NO
6. Receives 100 USDC back
7. Full position closed

---

## Error Handling

### Contract Errors

| Error | User Message | UI Action |
|-------|--------------|-----------|
| `TickBook: not active` | "Market is not active" | Disable all trading |
| `TickBook: insufficient liquidity` | "Not enough liquidity at this price" | Show depth warning |
| `TickBook: tick out of range` | "Price must be 0.01% - 99.99%" | Highlight invalid input |
| `TickBook: insufficient balance` | "Insufficient token balance" | Show balance in red |

### Network Errors

| Error | User Message | UI Action |
|-------|--------------|-----------|
| User rejected | "Transaction cancelled" | Clear loading state |
| Insufficient gas | "Add ETH for gas" | Show gas estimation |
| RPC timeout | "Network slow, retrying..." | Auto-retry with backoff |

---

## Performance

### Optimization Strategies

1. **Virtual Scrolling**: Tick ladder uses `react-window` for 10,000 ticks
2. **Debounced Inputs**: 300ms debounce on price/amount changes
3. **Cached Queries**: 10s TTL on orderbook data
4. **Bitmap Optimization**: O(1) tick discovery via contract bitmap
5. **WebGL Heatmap**: GPU-accelerated rendering for Tick Map (future)

### Target Metrics

| Metric | Target |
|--------|--------|
| Time to Interactive | < 1.5s |
| Tick Ladder Update | < 100ms |
| Quote Calculation | < 200ms |
| Order Submission | < 500ms (to broadcast) |

---

## Testing Checklist

### Unit Tests
- [ ] Tick ↔ Probability conversion accuracy
- [ ] Cumulative depth calculation
- [ ] Range order tick normalization
- [ ] Keyboard shortcut handlers

### Integration Tests
- [ ] Place point limit order
- [ ] Place ranged limit order
- [ ] Execute market order
- [ ] Split USDC to tokens
- [ ] Merge tokens to USDC
- [ ] Cancel active order

### E2E Tests (Wallet-Connected)
- [ ] Full trading journey (split → limit order → market order → merge)
- [ ] Multi-tick market order sweep
- [ ] Order cancellation and refund
- [ ] Graduation gate enforcement

---

## Content Configuration

All UI text is managed via `ui-content.json` under the `pro` key:

```json
{
  "pro": {
    "restricted": { ... },
    "utility": { ... },
    "tabs": { ... },
    "inventory": { ... },
    "history": { ... },
    "visuals": { ... },
    "execution": { ... },
    "activeOrders": { ... },
    "shortcuts": { ... }
  }
}
```

---

## Future Enhancements

### Phase 2 (Post-Alpha)
- [ ] WebSocket for real-time orderbook updates
- [ ] Trade history tab with transaction log
- [ ] Advanced order types (IOC, FOK, Post-Only)
- [ ] Position P&L tracking

### Phase 3 (Advanced)
- [ ] TradingView charting integration
- [ ] Hotkey customization
- [ ] Multi-market split-screen trading
- [ ] API for programmatic trading (bots)

---

**Last Updated**: 2025-12-25  
**Author**: Sooth Alpha Team  
**Next Review**: Before TickBook launch
