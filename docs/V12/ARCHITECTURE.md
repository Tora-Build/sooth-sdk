# Sooth Protocol V12 — Architecture Reference

> **Version**: V12.0 (SoothBook)  
> **Branch**: `v12-4atomic-orderbook`  
> **Last Updated**: 2026-02-20

---

## Overview

V12 replaces TickBook (2,710 LOC, 18+ external functions, separate vault) with **SoothBook** — a 602-line orderbook with 4 atomic actions, ERC20 outcome tokens, and FIFO matching. No vault, no growth accumulators, no deferred claims. Pre-graduation trading uses the AMM (LMSR via AMMEngine); post-graduation trading uses SoothBook exclusively.

---

## Contract Graph

```
                    ┌─────────────────────┐
                    │    TruthMarket       │
                    │  (lifecycle + settle)│
                    └──────────┬──────────┘
                               │ queried by
                    ┌──────────▼──────────┐
                    │  LaunchpadEngine     │
                    │  (creator economics, │
                    │   graduation)        │
                    └──┬──────────────┬───┘
                       │              │
           ┌───────────▼──┐    ┌──────▼──────────┐
           │  AMMEngine   │    │   SoothBook      │
           │  (LMSR, pre- │    │  (orderbook,     │
           │  graduation) │    │   post-grad)     │
           └──────────────┘    └──────┬───────────┘
                                      │
                    ┌─────────────────▼──────────┐
                    │       Collateralizer         │
                    │  (split / merge / redeem)    │
                    └─────────────────────────────┘

                    ┌─────────────────────────────┐
                    │      ProtocolConfig          │
                    │  (guardian + global pause)   │
                    └─────────────────────────────┘
```

**Ownership chain**: LaunchpadEngine is the `owner` of TruthMarket and SoothBook. Only LaunchpadEngine can call `resolveMarket` and `createMarket` on those contracts.

---

## Contract Responsibilities

| Contract | Responsibility | Key Functions |
|----------|---------------|---------------|
| **TruthMarket** | Canonical lifecycle authority. Tracks stage, adjudicator, settlement outcome. | `settle(outcome)`, `finalize()`, `dismiss()`, `getStage()` |
| **LaunchpadEngine** | Creator deposit, fee accumulation, graduation trigger, LP token issuance. | `createMarket()`, `graduate()`, `claimRefund()`, `redeemLP()` |
| **AMMEngine** | LMSR trading for pre-graduation markets. Bonding curve pricing. | `buy()`, `sell()`, `getPrice()`, `getPositions()` |
| **SoothBook** | Post-graduation orderbook. 4 atomic actions, FIFO matching, ERC20 outcome tokens. | `buyYes()`, `buyNo()`, `mint()`, `merge()`, `cancel()`, `redeem()` |
| **Collateralizer** | Token split/merge/redeem operations for graduated markets. | `split()`, `merge()`, `redeem()` |
| **ProtocolConfig** | Guardian address, global pause flag. | `setGuardian()`, `pause()`, `unpause()` |
| **OutcomeToken** | ERC20 YES/NO tokens with minter role. Deployed per market by SoothBook. | `mint()`, `burn()`, `setMinter()` |

---

## Market Lifecycle

```
                    ┌──────────┐
                    │  BONDING  │  ← AMM trading (LMSR)
                    └────┬──────┘
                         │ graduation threshold reached
                         │ (LaunchpadEngine fee accumulator)
                    ┌────▼──────┐
                    │ GRADUATED │  ← SoothBook trading (4 atomics)
                    └────┬──────┘
                         │ adjudicator calls settle(outcome)
                    ┌────▼──────┐
                    │  SETTLED  │  ← outcome set, veto window open
                    └────┬──────┘
                         │ veto window expires, finalize() called
                    ┌────▼──────┐
                    │ FINALIZED │  ← redemptions open
                    └───────────┘

    BONDING ──(within 7-day trial, creator only)──► DISMISSED
```

### Transition Requirements

| Transition | Trigger | Who |
|-----------|---------|-----|
| BONDING → GRADUATED | Fee accumulator hits graduation threshold | LaunchpadEngine (automatic on trade) |
| GRADUATED → SETTLED | Adjudicator calls `settle(outcome)` | ValidatedAdjudicator |
| SETTLED → FINALIZED | Veto window expires, `finalize()` called | Anyone |
| BONDING → DISMISSED | Creator calls `dismiss()` within 7-day trial | Market creator only |

---

## SoothBook Mechanics

### The 4 Atomics

| Action | Signature | Collateral Flow |
|--------|-----------|-----------------|
| `buyYes` | `buyYes(marketKey, tick, amount, escrow, maxCollateral)` | USDC → SoothBook; YES tokens → user on fill |
| `buyNo` | `buyNo(marketKey, tick, amount, escrow, maxCollateral)` | USDC → SoothBook; NO tokens → user on fill |
| `mint` | `mint(marketKey, amount)` | USDC → SoothBook; YES + NO tokens → user |
| `merge` | `merge(marketKey, amount)` | YES + NO tokens burned; USDC → user |

**No sell action.** Selling = buying the opposite side. `buyNo(escrow=true)` burns the user's YES tokens as collateral and auto-merges on fill — equivalent to "sell YES for USDC".

### Auto-Match Engine

When a new order arrives, SoothBook checks:

```
bestYesTick + bestNoTick ≥ 1000
```

If true:
1. Mint a complete YES+NO set from collateral (1 USDC per pair)
2. Distribute YES tokens to the YES buyer, NO tokens to the NO buyer
3. Surplus (price improvement) goes to the **taker** (the order that triggered the match)
4. Maker fills at their exact requested price

**Gas cap**: `MAX_MATCHES_PER_TX = 128` — prevents unbounded gas in a single transaction.

### Tick System

- Range: 1–999 (0.1% granularity)
- Price = `tick / 1000` (e.g. tick 600 = 60.0¢)
- WAD representation: `tick * 1e15`
- **TickBitmap**: O(1) lookup for non-empty tick levels

### Order Matching: FIFO

Orders at each tick level are matched First-In-First-Out. Array-based with a head pointer (avoids costly array shifts on fill).

### Escrow Flag

`buyNo(escrow=true)` — "sell YES":
1. User holds YES tokens
2. Calls `buyNo(escrow=true)` — YES tokens burned as collateral
3. When matched with a `buyYes`, auto-merges the YES+NO pair
4. User receives USDC

`buyYes(escrow=true)` — "sell NO": symmetric.

### Additional Actions

| Action | Purpose |
|--------|---------|
| `cancel(marketKey, side, tick)` | Cancel resting orders at a specific tick |
| `redeem(marketKey)` | After finalization, burn winning tokens for USDC |

---

## Security Invariants

1. **Solvency**: Total USDC held by SoothBook ≥ sum of all resting order collateral + all minted-set collateral at all times.
2. **Ownership**: Only `owner` (LaunchpadEngine) can call `createMarket` on SoothBook and `resolveMarket` on TruthMarket.
3. **Minter exclusivity**: Outcome tokens (YES/NO) can only be minted by SoothBook (enforced via `minter` role on `OutcomeToken`).
4. **Redemption gate**: `redeem()` requires market to be **finalized** (not just settled). Prevents redemption during the veto window.
5. **INVALID resolution**: Each YES and NO token redeems for exactly 0.5 USDC (50/50 split of collateral).
6. **Trial period**: Dismissal only allowed within 7 days of market creation, by the creator only.
7. **Pause**: ProtocolConfig guardian can pause the protocol; all state-changing operations revert when paused.
8. **Max matches**: `MAX_MATCHES_PER_TX = 128` caps gas per transaction, preventing griefing via deep orderbook.
9. **Surplus to taker**: Price improvement always goes to the taker, never retained by the contract.

---

## Integration Points

### Frontend (`apps/web`)

| Layer | How it connects |
|-------|----------------|
| Contract reads | Wagmi v2 + Viem hooks (`useOrderbook`, `useSoothBookMarket`, `useActivePositions`) |
| Contract writes | `useOrderbookTrade` — wraps `buyYes`/`buyNo`/`mint`/`merge`/`cancel`/`redeem` |
| Market data | Ponder indexer REST API (`/orders`, `/fills`, `/portfolio`, etc.) |
| Deployment config | `apps/web/src/config/deployments.json` — single source of truth for addresses |

### Indexer (`packages/indexer`)

- **Framework**: Ponder
- **Event handlers**: 29 total (8 SoothBook + 15 LaunchpadEngine + 6 AMMEngine)
- **Schema tables**: `market`, `order`, `fill`, `mint_merge`, `launchpadMarket`, `ammPosition`, `lpBalance`, `lockEntry`, `vault_position`
- **API endpoints**: `/orders`, `/fills`, `/portfolio`, `/amm-positions`, `/lp-balances`, `/lock-entries`, `/vault-balance`, `/vault-positions`

### CLI (`packages/contracts-testing`)

- **Node.js REPL**: `script/interactive/interactive-test.ts`
- **SoothBook commands**: `buyyes`, `buyno`, `sbmint`, `sbmerge`, `sbcancel`, `sbredeem`, `sbbook`, `sbhistory`, `sbstate`, `sbprice`, `sbsetmarket`
- **Market commands**: `createmarket`, `graduate`, `marketstatus`, `trialstatus`, `dismiss`, `claimrefund`, `lpbalance`, `redeemlp`

### Browser SDK (`apps/web/src/lib/sdk`)

- `SoothSDK.executeCommand()` — parses terminal input, dispatches to command modules
- `SoothSDK.showHelp()` — lists all available commands
- Command modules: `wallet.ts`, `market.ts`, `soothbook.ts`

---

## Deployed Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| MockUSDC | `0x51073241ff403cd900008569714e0c9605f65a79` |
| ProtocolConfig | `0xd19842d2cbcb6146460e6639db1571787620583f` |
| Collateralizer | `0x956e8ad7b35c5270fc737ceddfcd7d894a1e5574` |
| AMMEngine | `0x1d736e5008b775948e0cbd06bbf0074d48a9803a` |
| SoothBook | `0x0eb179c7e79e62bac3ee40d379425e32cb00d22b` |
| LaunchpadEngine | `0xf00fb446d1262d1f4100e6d899cf0c8c298a6e61` |

3 seed markets created via LaunchpadEngine (bonding stage). Block 37890676.

> **Note**: Only Base Sepolia is deployed with V12 SoothBook. Monad Testnet has V12 contracts deployed but unverified markets. MegaETH and Arc remain at older versions and are disabled in tooling.

---

## Test Coverage

| Suite | Count | Location |
|-------|-------|---------|
| SoothBook unit tests | 45 | `packages/contracts-testing/test/unit/SoothBook.t.sol` |
| Protocol tests | 173 | `packages/contracts-testing/test/` |
| **Total** | **218** | |

---

## Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `packages/contracts-core/src/SoothBook.sol` | 602 | Core orderbook contract |
| `packages/contracts-core/src/OutcomeToken.sol` | ~50 | ERC20 outcome token with minter role |
| `packages/contracts-core/src/LaunchpadEngine.sol` | — | Creator economics + graduation |
| `packages/contracts-core/src/AMMEngine.sol` | — | LMSR trading (pre-graduation) |
| `packages/contracts-core/src/Collateralizer.sol` | — | Token split/merge/redeem |
| `packages/contracts-core/src/TruthMarket.sol` | — | Lifecycle + settlement |
| `packages/contracts-core/src/ProtocolConfig.sol` | — | Guardian + pause |
| `packages/contracts-core/src/libraries/TickBitmap.sol` | ~80 | O(1) tick lookup |
| `packages/contracts-core/script/DeploySoothBook.s.sol` | 63 | Deploy script |

---

## Related Documents

- [`docs/V12/SOOTHBOOK.md`](./SOOTHBOOK.md) — Deep dive into SoothBook 4-atomic design
- [`docs/V12/PRO-PAGE-SPEC.md`](./PRO-PAGE-SPEC.md) — Pro trading page specification
- [`STATUS.md`](../../STATUS.md) — Current project state and deployment status
- [`DECISIONS.md`](../../DECISIONS.md) — Architecture decision records (ADRs)
- [`.claude/rules/knowledge.md`](../../.claude/rules/knowledge.md) — Protocol formulas and facts
