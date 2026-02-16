# Pro.tsx Findings — V12 Migration Review

> **Status**: Findings only. DO NOT EDIT Pro.tsx — user is redesigning with another agent.
> **Date**: 2026-02-16
> **File**: `apps/web/src/pages/Pro.tsx` (1078 lines)

## Summary

Pro.tsx was rebuilt this session with working SoothBook integration. It correctly implements:
- On-chain graduated market discovery via `useOnChainMarkets`
- SoothBook orderbook depth visualization (tick-based multicall)
- Polymarket-style YES/NO tabs + Buy/Sell toggle
- Trade execution via `writeContractAsync` (buyYes/buyNo/mint/merge/redeem)
- USDC approval flow
- Activity feed from on-chain events (OrderPlaced/OrderFilled/OrderCancelled)

## Findings for Future Improvement

### 1. Extract reusable hooks (HIGH PRIORITY)

All orderbook/trade logic is inline. Should be extracted so other components (Portfolio, UserOrdersPanel) can reuse:

| Logic Block | Lines | Suggested Hook |
|-------------|-------|----------------|
| `refreshBook()` — multicall orderbook depth | 383-449 | `useSoothBookOrderbook(soothBookAddress, marketKey)` |
| `exec()` — generic SoothBook tx wrapper | 525-577 | `useSoothBookTrade(soothBookAddress, marketKey)` |
| `refreshFeed()` — event log fetching | 451-523 | `useSoothBookFeed(soothBookAddress, marketKey)` |
| Balance reads (USDC, YES, NO, allowance) | 333-365 | `useSoothBookBalances(soothBookAddress, marketKey, userAddress)` |
| `tradeConfig` — outcome/mode → fn mapping | 318-329 | Part of `useSoothBookTrade` |

### 2. Missing: User Orders Panel

The page shows a general activity feed but lacks a **user's open orders** panel. In V11, `UserOrdersPanel.tsx` (781 lines) showed:
- User's pending limit orders per market
- Cancel buttons per order
- Fill status

SoothBook doesn't expose individual orders by user (only aggregated at tick level). To show user orders:
- Track order placements via events: `OrderPlaced(marketKey, side, tick, maker, amount, escrow)`
- Filter by `maker === user`
- Cross-reference with `OrderFilled` and `OrderCancelled` events to compute remaining

### 3. Hardcoded chain ID

Line 30: `const BASE_SEPOLIA = 84532;` — should come from deployment config or be configurable for multi-chain.

### 4. Market metadata in localStorage

Line 199: `localStorage.getItem('market_meta_...')` — fragile. Should come from:
- Indexer (Ponder) which could store market metadata
- Or on-chain event data from `MarketCreated` event args

### 5. No position P&L tracking

The Positions card (lines 962-1007) shows raw token balances but no:
- Cost basis (average entry price)
- Unrealized P&L
- Position value at current implied price

This requires tracking historical fill events per user.

### 6. `as never` type assertions

Lines 554-562 in `exec()` use `as never` for the generic contract call pattern. Not ideal but necessary for the generic `functionName` approach. Could be replaced with explicit per-function wrappers.

### 7. Price input UX

Price is entered in cents (0-100) and mapped to ticks (0-999) via `tick = Math.round(price * 10)`. The 0.1 cent precision is correct but the UX could be clearer:
- Consider a slider or visual tick selector
- Show the equivalent probability percentage

### 8. No escrow token balance check for sells

When selling (escrow=true), the user needs YES tokens (for Sell YES → buyNo with escrow) or NO tokens (for Sell NO → buyYes with escrow). The UI doesn't validate that the user has sufficient tokens before submitting.

### 9. Max cost defaults to 0

Line 311: `const maxCostAmt = parseAmt(maxCostInput, 6) ?? 0n;` — when maxCost is 0, SoothBook may interpret this as "no max cost" or reject the order. The UI should clarify the default behavior.

## Hooks That Pro.tsx Should Eventually Use

Once extracted, Pro.tsx should import from shared hooks instead of inline logic:
- `useOrderbook` → replaces inline `refreshBook`
- `useOrderbookTrade` → replaces inline `exec` + `tradeConfig`
- A new `useSoothBookFeed` → replaces inline `refreshFeed`
- `useTraderVault` or a new `useSoothBookBalances` → replaces inline balance reads

This deduplication is blocked until the hooks are properly rewritten for SoothBook (Phase 1a/1b work).
