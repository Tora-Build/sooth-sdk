# Pro Page V12 Specification

> SoothBook orderbook trading terminal for graduated prediction markets.

## Overview

The Pro page is a trading terminal for **graduated markets** on the SoothBook orderbook. It provides limit order placement, position management, and liquidity visualization. Only markets that have graduated from the Launchpad (AMM stage) appear here.

**Key principle:** The Pro page maps to SoothBook's 4 atomic actions + cancel + redeem. No features exist that don't correspond to an on-chain action.

## SoothBook Contract Reference

### Atomic Actions

| Action | Signature | What It Does |
|--------|-----------|--------------|
| **Buy YES** | `buyYes(marketKey, tick, amount, escrow=false, maxCost)` | Place limit buy for YES shares at tick price. Pays USDC. |
| **Buy NO** | `buyNo(marketKey, tick, amount, escrow=false, maxCost)` | Place limit buy for NO shares at tick price. Pays USDC. |
| **Sell YES** | `buyNo(marketKey, tick, amount, escrow=true, 0)` | Burn YES tokens as collateral. When matched, auto-merges → USDC. |
| **Sell NO** | `buyYes(marketKey, tick, amount, escrow=true, 0)` | Burn NO tokens as collateral. When matched, auto-merges → USDC. |
| **Mint** | `mint(marketKey, amount)` | Deposit USDC → receive equal YES + NO tokens. |
| **Merge** | `merge(marketKey, amount)` | Burn equal YES + NO tokens → receive USDC. |

### Additional Actions

| Action | Signature | What It Does |
|--------|-----------|--------------|
| **Cancel** | `cancel(marketKey, side, tick)` | Cancel caller's oldest resting order at tick. Refunds USDC (normal) or re-mints tokens (escrow). |
| **Redeem** | `redeem(marketKey)` | Post-resolution: burn winning tokens for USDC. (YES wins=1 USDC, NO wins=1 USDC, INVALID=0.5 each) |

### Matching Rule

Orders auto-match when `bestYesTick + bestNoTick ≥ 1000`. Surplus goes to taker (price improvement). Maker fills at exact requested price. FIFO within each tick.

### Tick System

- 999 ticks: 1–999 (0.1% to 99.9% granularity)
- Price = tick / 1000
- Tick 600 = 60.0¢, Tick 400 = 40.0¢
- **Single tick per order only.** No range orders.

## User Actions on Pro Page

### 1. Buy YES (Limit)
- **UI:** Select YES → Buy → set price (single tick) → set amount → execute
- **Contract:** `buyYes(marketKey, tick, amount, false, maxCost)`
- **Collateral:** USDC from wallet (needs SoothBook approval)
- **Price input:** Single tick selector, 0.1¢ to 99.9¢

### 2. Buy NO (Limit)
- **UI:** Select NO → Buy → set price (single tick) → set amount → execute
- **Contract:** `buyNo(marketKey, tick, amount, false, maxCost)`
- **Collateral:** USDC from wallet

### 3. Sell YES
- **UI:** Select YES → Sell → set price (single tick) → set amount → execute
- **Contract:** `buyNo(marketKey, tick, amount, true, 0)`
- **Collateral:** Burns user's YES tokens
- **Requirement:** User must hold sufficient YES tokens
- **UX note:** Show "Escrow sell — burns your YES tokens" info badge

### 4. Sell NO
- **UI:** Select NO → Sell → set price (single tick) → set amount → execute
- **Contract:** `buyYes(marketKey, tick, amount, true, 0)`
- **Collateral:** Burns user's NO tokens
- **Requirement:** User must hold sufficient NO tokens

### 5. Mint (Complete Set)
- **UI:** Dedicated Mint/Merge section below or beside the trade panel
- **Contract:** `mint(marketKey, amount)`
- **Collateral:** USDC from wallet
- **Result:** User receives equal YES + NO tokens
- **Use case:** Market making, arbitrage, creating inventory for selling

### 6. Merge (Complete Set)
- **UI:** Same Mint/Merge section
- **Contract:** `merge(marketKey, amount)`
- **Collateral:** Burns equal YES + NO tokens
- **Result:** User receives USDC
- **Requirement:** User must hold equal amounts of YES and NO

### 7. Cancel Order
- **UI:** Cancel button on each order row in the orders panel
- **Contract:** `cancel(marketKey, side, tick)`
- **Note:** Cancels the oldest order at that tick. If user has multiple orders at same tick, must cancel sequentially.

### 8. Redeem (Post-Resolution)
- **UI:** Shown in the settlement card when market is settled/finalized
- **Contract:** `redeem(marketKey)`
- **Condition:** Only available after market resolution

## Page Layout

### Market List View (no market selected)
```
┌──────────────────────────────────────────────────┐
│ Pro Trading on SoothBook                    [🔍] │
│ [All] [Crypto] [Sports] [Cultures] [Others]     │
│ [All] [Live] [Settled] [Finalized]              │
├──────────────────────────────────────────────────┤
│ ◀ [Market Chip] [Market Chip] [Market Chip]  ▶  │
├──────────────────────────────────────────────────┤
│        Embedded Trading Terminal                  │
└──────────────────────────────────────────────────┘
```

### Trading Terminal (market selected)
```
┌──────────────────────────────────────────────────┐
│ [←] Market Question              [📊] [🔄]      │
├────────────────────────┬─────────────────────────┤
│                        │  Wallet Balance Card     │
│  [Market Detail Card]  │  ┌───────────────────┐  │
│                        │  │ USDC: $XXX         │  │
│                        │  │ YES: XXX  NO: XXX  │  │
│  ┌──────────────────┐  │  │ [Approve] if needed│  │
│  │  Liquidity Map    │  │  └───────────────────┘  │
│  │  (depth chart)    │  │                         │
│  │  AMM ─── Book ──  │  │  Trading Panel          │
│  └──────────────────┘  │  ┌───────────────────┐  │
│                        │  │ [YES] [NO]         │  │
│  ┌──────────────────┐  │  │ [Buy] [Sell]       │  │
│  │  User Orders      │  │  │ [Limit]           │  │
│  │  Panel            │  │  │                   │  │
│  │  (cancel, view)   │  │  │ Price: [XX.X]¢    │  │
│  └──────────────────┘  │  │ Amount: [XXXX]     │  │
│                        │  │                   │  │
│                        │  │ [Execute Order]    │  │
│                        │  └───────────────────┘  │
│                        │                         │
│                        │  Mint / Merge Panel      │
│                        │  ┌───────────────────┐  │
│                        │  │ [Mint] [Merge]     │  │
│                        │  │ Amount: [XXXX]     │  │
│                        │  │ [Execute]          │  │
│                        │  └───────────────────┘  │
├────────────────────────┴─────────────────────────┤
```

### Settlement View (settled/finalized market)
Same as current — settlement card with redeem button. Keep as-is.

## UI Components

### 1. Wallet Balance Card (replaces Vault Card)

V12 has no vault. Users trade directly from wallet.

**Shows:**
- Wallet USDC balance
- YES token balance (ERC20)
- NO token balance (ERC20)
- Approve button (if SoothBook not approved for USDC)

**Does NOT show:**
- Vault deposit/withdraw (no vault in V12)
- "In Orders" / "Reserved" fields (V12 doesn't track this client-side)
- Deposit/Sync/Refresh buttons (no vault operations)

### 2. Trading Panel

**Outcome selector:** YES / NO tabs (keep current)

**Action selector:** Buy / Sell toggle (keep current)

**Order type:** Limit only. Remove the Limit/Market toggle entirely.

**Price input:** Single price only.
- One numeric input: `[XX.X]¢` with 0.1¢ step
- One slider handle (not two — no range)
- Tick display: "Tick 450" below slider
- Remove: Range toggle button, second price input, "± Range" button, dual slider handles

**Amount input:** Shares (keep current)

**Order summary:**
- Price: XX.X¢
- Amount: XXXX shares
- Est. Cost (buy): $XX.XX
- Est. Return (sell): $XX.XX
- Available: USDC balance (buy) or YES/NO token balance (sell)

**Sell mode info:**
- For sells, show: "Escrow sell — burns your [YES/NO] tokens. Matched orders auto-merge to USDC."
- Remove: Spot/Hybrid/Short sell type indicators
- Remove: "Range too wide for spot" warning
- Remove: Short sell / spot sell distinction

**Execute button:** Same styling, text changes:
- "Buy YES with $XX.XX" / "Buy NO with $XX.XX"
- "Sell YES for ~$XX.XX" / "Sell NO for ~$XX.XX"
- No "TickBook Not Initialized" text — use "SoothBook Not Active" instead

### 3. Mint/Merge Panel (NEW)

Small collapsible card below the trading panel:

**Mint tab:**
- Amount input (USDC)
- Preview: "Deposit X USDC → receive X YES + X NO tokens"
- Execute button

**Merge tab:**
- Amount input (shares)
- Max: min(yesBalance, noBalance)
- Preview: "Burn X YES + X NO → receive X USDC"
- Execute button

### 4. Liquidity Map (keep, minor fixes)

The bitmap depth chart is correct for V12. Keep as-is with:
- Fix comment: "TickBook" → "SoothBook" in JSDoc
- The AMM price indicator line (grey) and SoothBook price indicator line (cyan) are correct
- Bucket visualization is correct
- Tooltip showing buy/sell depth is correct

### 5. User Orders Panel (clean up)

**Tab structure:** Remove the "Range" / "Spot" tab toggle. Replace with single "Orders" view that shows all active orders.

The "Spot" tab currently shows feed events — keep this data but rename:
- Tab 1: "Orders" (active resting orders)
- Tab 2: "History" (on-chain feed events)

**Order row columns:** ID, Side, Price, Size, Fill%, Action
- Remove: "Claim" button from each row (V12 auto-delivers fills)
- Remove: "Claim (0)" batch button from header
- Keep: "Cancel" button per row
- Keep: "Cancel (N)" batch button in header

**Filter dropdown:**
- Remove: "Claimable" filter option (no concept in V12)
- Keep: "All", "Open", "Filled"

**Position display:** Keep the YES/NO position cards showing token balances.

## Features REMOVED from V11

| # | V11 Feature | Reason | Action |
|---|-------------|--------|--------|
| 1 | Vault Card (deposit/withdraw USDC) | V12 has no vault. Direct wallet trading. | Replace with Wallet Balance Card |
| 2 | Range Orders (price mode toggle, dual slider, multi-tick) | V12 = single tick per order only | Remove range UI, keep single price input |
| 3 | Spot/Hybrid/Short sell type indicators | V12 = escrow flag only, no sell types | Remove sell type display, show escrow info |
| 4 | Market Orders toggle | V12 = limit orders only | Remove Market/Limit toggle |
| 5 | `MARKET_ORDER_ENABLED` flag | Dead code | Remove constant and all references |
| 6 | `useFloorPrice` flag | Always false, dead code | Remove |
| 7 | `MAX_SPOT_RANGE` / `spotRangeExceedsLimit` | V11 gas optimization, irrelevant in V12 | Remove |
| 8 | `RangeOrder` interface (multi-tick model) | V12 orders are single-tick | Simplify to single-tick order model |
| 9 | `vaultInput` state + deposit/withdraw handlers | No vault in V12 | Remove |
| 10 | Claim buttons (per-order and batch) | V12 auto-delivers fills | Remove |
| 11 | "Spot" tab in UserOrdersPanel | No spot sell concept | Rename to "History" |
| 12 | "Range" tab label | Misleading | Rename to "Orders" |
| 13 | Claimable filter option | No concept in V12 | Remove from dropdown |
| 14 | "TickBook" references in code/comments | Rebranding to SoothBook | Rename all |

## Features ADDED for V12

| # | Feature | Where | Contract Call |
|---|---------|-------|---------------|
| 1 | Wallet Balance Card (USDC + YES + NO balances) | Right column, above trading panel | Read-only ERC20.balanceOf |
| 2 | Escrow sell info badge | Trading panel, sell mode | Display only |
| 3 | Mint/Merge panel | Right column, below trading panel | `mint()` / `merge()` |
| 4 | Single-tick-only price input | Trading panel | N/A (UI-only simplification) |

## Existing V12 Hooks (use these, don't create new ones)

| Hook | Returns | Used For |
|------|---------|----------|
| `useSoothBookMarket(address, key)` | marketState, prices, backing | Market data |
| `useOrderbook(marketId)` | bids, asks, userYesShares, userNoShares | Orderbook + positions |
| `useOrderbookTrade(marketId)` | placeOrder, cancelOrder, redeem, mint, merge, availableBalance | Trading actions |
| `useSoothBookFeed(address, key)` | feed events | Order history |
| `useSoothBookMarkets(chainId)` | all SoothBook markets | Market discovery |
| `useTokenBalances(addresses)` | ERC20 balances | Wallet USDC |
| `useDeployments()` | contract addresses | Config |

## Implementation Checklist

### Pro.tsx (~1,599 lines → target ~1,200 lines)
- [ ] Remove `RangeOrder` interface — replace with V12-native single-tick model
- [ ] Remove `MARKET_ORDER_ENABLED`, `useFloorPrice`, `MAX_SPOT_RANGE` constants
- [ ] Remove `OrderType` type (only 'limit' exists)
- [ ] Remove `priceMode` state ('single' | 'range') — always single
- [ ] Remove `priceHigh` state — only `priceLow` needed (rename to `price`)
- [ ] Remove `vaultInput` state and deposit/withdraw handlers
- [ ] Remove slider dual-handle drag logic (isLowDragging, isHighDragging, handlePointerMove, handlePointerUp)
- [ ] Simplify slider to single handle
- [ ] Remove `sellType` memo (spot/hybrid/short) — replace with escrow check
- [ ] Remove `spotRangeExceedsLimit` logic
- [ ] Remove range order loop in `handleTrade` — single placeOrder call only
- [ ] Remove Limit/Market toggle from UI
- [ ] Remove range toggle button ("± Range" / "Single")
- [ ] Remove second price input field
- [ ] Remove sell type info boxes (spot/hybrid/short messages)
- [ ] Add escrow sell info badge when selling
- [ ] Replace Vault Card with Wallet Balance Card (USDC + YES + NO token balances)
- [ ] Add Mint/Merge panel below trading panel
- [ ] Rename "TickBook Not Initialized" → "SoothBook Not Active"
- [ ] Remove `vaultReserved` / "In Orders" display
- [ ] Fix vault memo to just show wallet balance + token balances
- [ ] Remove `numTicks`, `avgPrice` calculations (single tick = no averaging)
- [ ] Simplify `estimatedValue` to single-tick calculation

### UserOrdersPanel.tsx (~425 lines → target ~350 lines)
- [ ] Rename "Range" tab to "Orders"
- [ ] Rename "Spot" tab to "History"
- [ ] Remove `OrdersGroup` "spot" concept — rename to 'orders' | 'history'
- [ ] Remove disabled "Claim (0)" batch button
- [ ] Remove disabled "Claim" button from each order row
- [ ] Remove "Claimable" filter option
- [ ] Remove `claimableFilterOrders` and `filledOrders` empty arrays
- [ ] Clean up empty spot sell state text

### LiquidityMap.tsx (~330 lines — minimal changes)
- [ ] Fix JSDoc: "TickBook" → "SoothBook"
- [ ] Fix comment on line 187–188: "TickBook Price Indicator" → "SoothBook Price Indicator"

## Non-Goals (Explicitly Out of Scope)

- Batch order placement (not supported by V12 contract)
- Charting / price history graphs
- Portfolio P&L calculations
- Advanced order types (stop-loss, IOC, FOK)
- Mobile-optimized layout
- Dark/light theme toggle

## Testing Plan

1. **TypeScript:** `tsc --noEmit` must pass with 0 errors
2. **Visual:** Page loads at `/pro`, renders V11-style layout
3. **Console:** 0 errors in browser console
4. **Functional (when markets are live):**
   - Buy YES at tick → order appears in orders panel
   - Buy NO at tick → order appears
   - Sell YES (escrow) → burns YES tokens
   - Cancel order → order removed
   - Mint → YES + NO balances increase
   - Merge → YES + NO balances decrease, USDC increases
