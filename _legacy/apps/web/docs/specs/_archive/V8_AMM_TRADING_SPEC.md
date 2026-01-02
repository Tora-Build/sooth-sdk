# V8 AMM Trading Terminal Specification

**Version**: 1.1.0  
**Last Updated**: 2025-12-23  
**Status**: Draft

---

## Overview

The AMM Trading Terminal provides a **simple, instant trading experience** for casual users who want to trade prediction market outcomes without managing orderbook complexity. It uses LMSR (Logarithmic Market Scoring Rule) for continuous pricing, powered by the **LaunchpadEngine** with creator economics.

### Target Users
- **Casual traders** - Quick buy/sell without orderbook knowledge
- **Mobile users** - Simple, fast interface
- **Price takers** - Accept current market price
- **Small trades** - Typically < $1,000

### Key Differentiators vs Orderbook
- ✅ Instant execution (no matching required)
- ✅ Always available liquidity (creator-funded)
- ✅ Simple UX (no limit orders)
- ✅ Dynamic fees (5% pre-graduation, 1% post-graduation)
- ⚠️ 24-hour sell lock (prevents informed trading)
- ⚠️ Non-transferable positions (ledger-based)
- ⚠️ Higher slippage on large trades

---

## Page Structure

### Route
`/markets/:marketId/amm`

### Layout
```
┌─────────────────────────────────────────────┐
│  Market Header (shared component)           │
│  • Title, deadline, status                  │
│  • Current probability                      │
│  • Navigation: AMM | Orderbook | Info       │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  AMM Stats Card                             │
│  • Liquidity, Volume, Positions             │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  Trading Panel                              │
│  • Buy/Sell tabs                            │
│  • Amount input                             │
│  • Quote display                            │
│  • Execute button                           │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  My Position Card                           │
│  • Current shares                           │
│  • Locked proceeds                          │
│  • Claim button                             │
└─────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. AMM Stats Card

**Component**: `AMMStatsCard.tsx`

#### Labels & Metrics

| Label | Formula | Data Source | Format |
|-------|---------|-------------|--------|
| **Liquidity (b)** | `market.bBase` | `LaunchpadEngine.getBBase(market)` | `$X.XXk` |
| **YES Quantity** | `market.qYes` | `AMMEngine.getMarketState(market).qYes` | `X,XXX` (WAD → shares) |
| **NO Quantity** | `market.qNo` | `AMMEngine.getMarketState(market).qNo` | `X,XXX` (WAD → shares) |
| **Current Price** | `market.price` | `AMMEngine.getMarketState(market).price` | `XX.X%` (WAD → %) |
| **Total Positions** | `qYes + qNo` | Calculated | `X,XXX` |
| **Current Fee** | `market.currentFee` | `LaunchpadEngine.getCurrentFee(market)` | `X.X%` |
| **Graduation Status** | `market.isGraduated` | `LaunchpadEngine.isGraduated(market)` | Badge |

#### Graduation Badge

**Display**:
- **Pre-Graduation**: 🟡 "Pre-Grad (5% fee)" - Yellow badge
- **Post-Graduation**: 🟢 "Graduated (1% fee)" - Green badge

#### Visual Design
- **Card Style**: Glass morphism with subtle gradient
- **Layout**: 2x3 grid on desktop, stack on mobile
- **Colors**: 
  - Liquidity: Cyan accent
  - YES: Green
  - NO: Red
  - Price: Purple gradient
  - Fee: Orange (pre-grad), Green (post-grad)

---

### 2. Trading Panel

**Component**: `AMMTradingPanel.tsx`

#### Tab Structure
- **Buy Tab**: Purchase YES shares
- **Sell Tab**: Sell YES shares (24h lock applies)

#### Buy Tab

**Inputs**:
| Field | Type | Validation | Placeholder |
|-------|------|------------|-------------|
| **Amount** | Number | `> 0`, `<= balance` | "Enter USDC amount" |

**Quote Display** (Real-time):
```
You Pay:        $XXX.XX USDC
You Receive:    ~XXX YES shares
Fee:            $X.XX (X.X%)  ← Dynamic fee
Price Impact:   +X.XX%
New Probability: XX.X% → XX.X%
```

**Formulas**:
- `quote = LaunchpadEngine.getPositionQuote(market, +amount)`
- `shares = quote.shares`
- `fee = quote.fee`
- `feeRate = LaunchpadEngine.getCurrentFee(market)` (5% pre-grad, 1% post-grad)
- `priceImpact = ((newPrice - oldPrice) / oldPrice) * 100`
- `newProbability = quote.newPrice`

**Button States**:
- Disabled: "Connect Wallet" (not connected)
- Disabled: "Insufficient Balance" (amount > balance)
- Disabled: "Market Not Live" (!isLive)
- Enabled: "Buy XXX YES for $XXX"

#### Sell Tab

**Inputs**:
| Field | Type | Validation | Placeholder |
|-------|------|------------|-------------|
| **Shares** | Number | `> 0`, `<= position.shares` | "Enter shares to sell" |

**Quote Display**:
```
You Sell:       XXX YES shares
You Receive:    ~$XXX.XX USDC (locked 24h)
Price Impact:   -X.XX%
New Probability: XX.X% → XX.X%
```

**Lock Warning** (Prominent):
```
⚠️ Sell Lock Active
Proceeds will be locked for 24 hours to prevent informed trading.
You can claim after: [Countdown Timer]
```

**Formulas**:
- `proceeds = AMMEngine.getPositionQuote(market, -shares).cost`
- `lockExpiry = block.timestamp + 24 hours`

**Button States**:
- Disabled: "No Position" (shares == 0)
- Disabled: "Market Not Live" (!isLive)
- Enabled: "Sell XXX YES for $XXX (Locked)"

#### Transaction Flow

**Buy Flow**:
1. User enters amount
2. Approve USDC (if needed)
3. Call `LaunchpadEngine.tradePositions(market, +deltaShares, maxCost)`
4. Show success toast with shares received
5. Refresh position

**Sell Flow**:
1. User enters shares
2. Call `LaunchpadEngine.tradePositions(market, -deltaShares, maxCost)`
3. Show lock warning toast
4. Refresh position and locked proceeds

---

### 3. My Position Card

**Component**: `AMMPositionCard.tsx`

#### Display Sections

**Active Position**:
```
┌─────────────────────────────────────┐
│ My Position                         │
├─────────────────────────────────────┤
│ YES Shares:     XXX                 │
│ Entry Price:    XX.X%               │
│ Current Price:  XX.X%               │
│ Unrealized PnL: +$XX.XX (+XX%)     │
└─────────────────────────────────────┘
```

**Formulas**:
- `shares = position.shares` (from `AMMEngine.getPosition(market, user)`)
- `entryPrice = position.entryPrice` (tracked client-side or calculated)
- `currentPrice = market.price`
- `unrealizedPnL = (currentPrice - entryPrice) * shares`

**Locked Proceeds**:
```
┌─────────────────────────────────────┐
│ Locked Proceeds                     │
├─────────────────────────────────────┤
│ Amount:         $XXX.XX             │
│ Unlock Time:    XX:XX:XX            │
│ [Claim Button - Disabled]           │
└─────────────────────────────────────┘
```

**Data Source**:
- `lockedProceeds = position.lockedProceeds`
- `lockExpiry = position.lockExpiry`
- Enable claim button when `block.timestamp >= lockExpiry`

**Claim Button**:
- Disabled: "Locked (XX:XX:XX remaining)"
- Enabled: "Claim $XXX.XX"
- Action: `AMMEngine.claimUnlocked(market)`

---

### 4. Settlement Display

**Component**: `AMMSettlementCard.tsx`

**When**: `market.isSettled() == true`

**Display**:
```
┌─────────────────────────────────────┐
│ Market Settled                      │
├─────────────────────────────────────┤
│ Outcome:        YES ✓               │
│ Your Shares:    XXX YES             │
│ Payout:         $XXX.XX             │
│ [Claim Payout Button]               │
└─────────────────────────────────────┘
```

**Formulas**:
- `outcome = TruthMarket.winningOutcome()`
- `payout = position.shares * redemptionValue`
- `redemptionValue = TruthMarket.getRedemptionValue(outcome)`

**Button**:
- Label: "Claim $XXX.XX Payout"
- Action: `AMMEngine.settlePosition(market)`

---

## Hooks Specification

### `useAMMMarket(marketAddress)`

**Returns**:
```typescript
{
  bBase: bigint;           // WAD (from LaunchpadEngine)
  qYes: bigint;            // WAD
  qNo: bigint;             // WAD
  price: bigint;           // WAD (0-1e18)
  currentFee: number;      // BPS (500 or 100)
  isGraduated: boolean;
  isLive: boolean;
  isSettled: boolean;
  isLoading: boolean;
  error: Error | null;
}
```

**Data Sources**:
- `LaunchpadEngine.getBBase(market)`
- `LaunchpadEngine.getCurrentFee(market)`
- `LaunchpadEngine.isGraduated(market)`
- `AMMEngine.getMarketState(market)` → `(qYes, qNo, price)`
- `TruthMarket.isLive()`
- `TruthMarket.isSettled()`

### `useAMMPosition(marketAddress, userAddress)`

**Returns**:
```typescript
{
  shares: bigint;              // Signed int (+ for YES, - for NO)
  lockedProceeds: bigint;      // WAD
  lockExpiry: bigint;          // Unix timestamp
  canClaim: boolean;           // block.timestamp >= lockExpiry
  isLoading: boolean;
  error: Error | null;
}
```

**Data Source**:
- `AMMEngine.getPosition(market, user)` → `(shares, lockedProceeds, lockExpiry)`

### `useAMMQuote(marketAddress, deltaShares)`

**Returns**:
```typescript
{
  cost: bigint;           // WAD (USDC amount including fee)
  fee: bigint;            // WAD (fee amount)
  feeRate: number;        // BPS (500 or 100)
  netCost: bigint;        // WAD (cost - fee)
  newPrice: bigint;       // WAD (new probability)
  priceImpact: number;    // Percentage
  isLoading: boolean;
  error: Error | null;
}
```

**Data Source**:
- `LaunchpadEngine.getPositionQuote(market, deltaShares)` → `(cost, fee, newPrice)`
- `LaunchpadEngine.getCurrentFee(market)` → `feeRate`

---

## User Flows

### Flow 1: First-Time Buy

1. User connects wallet
2. Navigates to `/markets/:id/amm`
3. Sees current probability and liquidity
4. Enters buy amount (e.g., $100)
5. Sees quote: "~XXX YES shares, XX.X% → XX.X%"
6. Clicks "Approve USDC" (if needed)
7. Clicks "Buy XXX YES for $100"
8. Transaction confirms
9. Position card updates with new shares
10. Success toast: "Bought XXX YES shares"

### Flow 2: Selling with Lock

1. User has existing position (XXX YES)
2. Enters sell amount (e.g., 50 shares)
3. Sees quote: "~$XX USDC (locked 24h)"
4. Sees lock warning with countdown
5. Clicks "Sell 50 YES for $XX (Locked)"
6. Transaction confirms
7. Position updates (shares reduced)
8. Locked proceeds card appears with countdown
9. Warning toast: "Proceeds locked for 24h"

### Flow 3: Claiming Unlocked Proceeds

1. User has locked proceeds past expiry
2. Locked proceeds card shows "Claim" button enabled
3. Clicks "Claim $XXX.XX"
4. Transaction confirms
5. USDC transferred to wallet
6. Locked proceeds card disappears
7. Success toast: "Claimed $XXX.XX"

### Flow 4: Settlement Claim

1. Market settles (YES wins)
2. User sees settlement card
3. Position card shows: "XXX YES shares → $XXX payout"
4. Clicks "Claim $XXX.XX Payout"
5. Transaction confirms
6. USDC transferred to wallet
7. Position cleared
8. Success toast: "Claimed settlement payout"

---

## Error Handling

### Contract Errors

| Error | User Message | Action |
|-------|--------------|--------|
| `AMMEngine: not live` | "Market is not active for trading" | Disable trading |
| `AMMEngine: cost too high` | "Price moved unfavorably. Try again." | Suggest retry |
| `AMMEngine: insufficient shares` | "You don't have enough shares to sell" | Show max |
| `AMMEngine: still locked` | "Proceeds are still locked. Try again in XX:XX" | Show countdown |

### Network Errors

| Error | User Message | Action |
|-------|--------------|--------|
| User rejected | "Transaction cancelled" | Allow retry |
| Insufficient gas | "Insufficient gas. Add ETH to wallet." | Show gas estimate |
| RPC timeout | "Network slow. Please retry." | Retry button |

---

## Mobile Considerations

### Responsive Breakpoints
- **Desktop**: > 768px (side-by-side layout)
- **Mobile**: <= 768px (stacked layout)

### Mobile Optimizations
- Larger touch targets (min 44px)
- Simplified quote display (fewer decimals)
- Bottom sheet for trading panel
- Sticky "Trade" button at bottom

---

## Accessibility

- **ARIA labels** on all interactive elements
- **Keyboard navigation** for all actions
- **Screen reader** announcements for quote updates
- **High contrast** mode support
- **Focus indicators** on all inputs

---

## Performance

### Optimization Strategies
- **Debounce** quote requests (300ms)
- **Cache** market data (5s TTL)
- **Optimistic updates** for position display
- **Lazy load** chart component
- **Prefetch** approval state

### Target Metrics
- **Time to Interactive**: < 2s
- **Quote Update**: < 500ms
- **Transaction Confirm**: < 30s (network dependent)

---

## Testing Checklist

### Unit Tests
- [ ] Quote calculation accuracy
- [ ] Price impact calculation
- [ ] Lock expiry countdown
- [ ] Settlement payout calculation

### Integration Tests
- [ ] Buy flow (approve + trade)
- [ ] Sell flow (lock proceeds)
- [ ] Claim flow (unlock + transfer)
- [ ] Settlement flow (claim payout)

### E2E Tests
- [ ] Full user journey (buy → sell → claim)
- [ ] Multi-market trading
- [ ] Chain switching
- [ ] Wallet disconnection handling

---

**Last Updated**: 2025-12-23  
**Next Review**: Before V8 frontend implementation
