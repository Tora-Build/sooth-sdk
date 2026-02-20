# Multi-Actor Market Lifecycle Test Report

## Overview

End-to-end test demonstrating complete market lifecycle with 5 distinct actor roles, covering creation → trading → graduation → settlement → redemption.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              MARKET LIFECYCLE FLOW                                        │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                           │
│  Phase 1-3      Phase 4-6       Phase 7      Phase 8     Phase 8.5     Phase 9-12        │
│ ┌─────────┐   ┌───────────┐   ┌────────┐   ┌────────┐   ┌─────────┐   ┌───────────┐     │
│ │ CREATE  │──▶│  TRADE    │──▶│TRANSFER│──▶│ SETTLE │──▶│ VERIFY  │──▶│  REDEEM   │     │
│ │  AMM    │   │ SoothBook │   │  LP    │   │        │   │ STOPPED │   │   P&L     │     │
│ │GRADUATE │   │ buyYes/No │   │        │   │        │   │         │   │           │     │
│ └─────────┘   └───────────┘   └────────┘   └────────┘   └─────────┘   └───────────┘     │
│      │              │              │            │             │              │            │
│   Alice          Bob,Charlie    Alice→Ellen   David       Bob (fail)   All Actors       │
│    Bob           Ellen(claim)                              (expect)      checksum        │
│ (graduate)                                                                               │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## Actors

| Actor | Role | Initial USDC | Key Actions |
|-------|------|--------------|-------------|
| **Alice** | Creator | 50,000 | Create market, provide liquidity, transfer LP to Ellen, redeem LP |
| **Bob** | Trader/Maker | 50,000 | AMM trades, graduate market, place NO orders, redeem |
| **Charlie** | Trader/Taker | 50,000 | AMM trades, SoothBook buyYes/buyNo, redeem |
| **David** | Adjudicator | 0 | Settle market as YES |
| **Ellen** | Keeper | 10,000 | Receive LP from Alice, verify invariants, redeem LP |

## Phase Diagram

```
                                    ACTORS
                    ┌─────┬─────┬─────┬─────┬─────┐
                    │Alice│ Bob │Charl│David│Ellen│
                    └──┬──┴──┬──┴──┬──┴──┬──┴──┬──┘
                       │     │     │     │     │
  Phase 1: CREATE      │     │     │     │     │
  ─────────────────────┼─────┼─────┼─────┼─────┼─────
    mint 50k           ●     │     │     │     │
    createmarket       ●─────────────────●     │
    (adj=david)              │     │  (adj)    │
                       │     │     │     │     │
  Phase 2: FUND & AMM  │     │     │     │     │
  ─────────────────────┼─────┼─────┼─────┼─────┼─────
    mint 50k           │     ●     ●     │     │
    deposit 20k        │     ●     ●     │     │
    buy YES (AMM)      │     ●     ●     │     │
                       │     │     │     │     │
  Phase 3: GRADUATE    │     │     │     │     │
  ─────────────────────┼─────┼─────┼─────┼─────┼─────
    graduate (8 steps) │     ●     │     │     │
    ↳ fees → LP pool   │     │     │     │     │
                       │     │     │     │     │
  Phase 4: SOOTHBOOK   │     │     │     │     │
  ─────────────────────┼─────┼─────┼─────┼─────┼─────
    buyNo at tick      │     ●─────┐     │     │
    buyYes at tick     │     │     ●     │     │
    ↳ auto-match       │     ◄─────●     │     │
                       │     │     │     │     │
  Phase 5: MINT/MERGE  │     │     │     │     │
  ─────────────────────┼─────┼─────┼─────┼─────┼─────
    mint YES+NO set    │     │     ●     │     │
    merge YES+NO set   │     │     ●─────────────●
                       │     │     │     │     │
  Phase 6: SETTLE      │     │     │     │     │
  ─────────────────────┼─────┼─────┼─────┼─────┼─────
    settle(YES)        │     │     │     ●     │
                       │     │     │     │     │
  Phase 7: REDEEM      │     │     │     │     │
  ─────────────────────┼─────┼─────┼─────┼─────┼─────
    redeem (outcomes)  │     ●     ●     │     │
    redeemlp (LP)      ●     ●     ●     │     │
                       │     │     │     │     │
  Phase 8: P&L         │     │     │     │     │
  ─────────────────────┼─────┼─────┼─────┼─────┼─────
    pnl 50000          ●     ●     ●     │     │
                       │     │     │     │     │
  Phase 9: VERIFY      │     │     │     │     │
  ─────────────────────┼─────┼─────┼─────┼─────┼─────
    invariants         │     │     │     │     ●
                       │     │     │     │     │
                       ▼     ▼     ▼     ▼     ▼
```

## Fee Flow

```
┌──────────────────────────────────────────────────────────────┐
│                       FEE DISTRIBUTION                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   PRE-GRADUATION (AMM Trades, 5% fee)                         │
│   ┌─────────┐                                                 │
│   │ Bob     │──┐                                              │
│   │ Charlie │──┤                                              │
│   └─────────┘  │      ┌─────────────┐     ┌─────────────┐    │
│                ├─────▶│  LP POOL    │────▶│ LP HOLDERS  │    │
│   Graduation   │      │  (100%)     │     │             │    │
│   ┌─────────┐  │      │             │     │ Alice: 48%  │    │
│   │ Bob     │──┘      │ Pre-grad    │     │ Bob:   51%  │    │
│   │ 8 steps │         │ fees: ~367  │     │ Charlie: 1% │    │
│   └─────────┘         └─────────────┘     └─────────────┘    │
│                                                               │
│   POST-GRADUATION (SoothBook trades, 1% fee)                  │
│   ┌─────────┐         ┌─────────────────────────────────┐    │
│   │ Orders  │────────▶│      Fee Split (1% of volume)   │    │
│   │ Crosses │         │  ┌─────────────┬──────────────┐ │    │
│   └─────────┘         │  │ LP Yield    │ Protocol     │ │    │
│                       │  │ Pool (80%)  │ Treasury(20%)│ │    │
│                       │  └──────┬──────┴───────┬──────┘ │    │
│                       └─────────┼──────────────┼────────┘    │
│                                 ▼              ▼              │
│                          LP Holders      Protocol Owner       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## P&L Report Format

```
┌──────────────────────────────────────────────────────────────┐
│  P&L Summary: {actor}                                         │
│══════════════════════════════════════════════════════════════│
│                                                               │
│  USDC Holdings                                                │
│  ────────────────────────────────────                         │
│  Wallet:           {wallet_usdc} USDC                         │
│  Vault:            {vault_usdc} USDC                          │
│                                                               │
│  Positions (settled: {YES|NO|INVALID})                        │
│  ────────────────────────────────────                         │
│  YES tokens:       {amount} → {value} USDC                    │
│  NO tokens:        {amount} → {value} USDC                    │
│  LP tokens:        {amount} → ~{value} USDC                   │
│                                                               │
│  Fee Distribution                                             │
│  ────────────────────────────────────                         │
│  Pre-grad fees:    {pre_grad_fees} USDC (→ LP Pool)           │
│  Post-grad fees:   {post_grad_fees} USDC                      │
│    → LP Pool:      {lp_yield_pool} USDC (80%)                 │
│    → Protocol:     {protocol_earnings} USDC (20%)             │
│  Pool Total:       {deposit + fees} USDC                      │
│  Your Share:       {user_fee_share} USDC ({pct}% of pool)     │
│                                                               │
│  Summary                                                      │
│  ────────────────────────────────────                         │
│  Liquid USDC:      {wallet + vault} USDC                      │
│  Position Value:   {positions} USDC                           │
│  Total Value:      {total} USDC                               │
│  ────────────────────────────────────                         │
│  Initial:          {initial} USDC                             │
│  P&L:              {+/-}{pnl} USDC ({+/-}{pct}%)              │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Expected Results

### Test Parameters
- **Chain**: Base Sepolia (84532)
- **Initial Liquidity (b)**: 500 USDC
- **Graduation Threshold**: 346.57 USDC in fees
- **Settlement Outcome**: YES

### Actor Final State (Clean Run)

| Actor | Role | Liquid USDC | Positions | Total Value | P&L |
|-------|------|-------------|-----------|-------------|-----|
| Alice | Creator | ~50,000 | 0 (LP redeemed) | ~50,200 | +~200 |
| Bob | Maker | ~50,000 | 0 (all redeemed) | ~50,050 | +~50 |
| Charlie | Taker | ~50,000 | 0 (all redeemed) | ~50,020 | +~20 |
| David | Adjudicator | 0 | 0 | 0 | 0 |
| Ellen | Keeper | 10,000 | 0 | 10,000 | 0 |

> Note: Exact values depend on AMM price movement during graduation trades. 
> Multi-run accumulation will show higher absolute values but similar relative P&L.

### Fee Distribution

| Metric | Value |
|--------|-------|
| Creator Deposit | 346.57 USDC |
| Pre-grad Fees | ~367 USDC (5% AMM trades → LP Pool) |
| Post-grad Fees | varies (1% SoothBook trades) |
| → LP Yield Pool | 80% of post-grad fees |
| → Protocol Treasury | 20% of post-grad fees |
| Pool Total | ~713+ USDC |

### LP Token Distribution

| Holder | LP Tokens | Pool Share | Fee Share |
|--------|-----------|------------|-----------|
| Alice (creator) | 346.57 | ~49% | ~180 USDC |
| Bob (graduation) | 360.85 | ~50% | ~183 USDC |
| Charlie (taker) | 5.98 | ~1% | ~4 USDC |
| **Total** | **713.40** | **100%** | **~367 USDC** |

## Invariant Checks

| Invariant | Description | Status |
|-----------|-------------|--------|
| `soothbook.solvent` | Total collateral backing ≥ outstanding claims | ✅ PASS |
| `orders.noOverflow` | Order amounts consistent across all ticks | ✅ PASS |
| `market.tickValid` | Tick in range 1-999, consistent with probability | ✅ PASS |
| `tokens.balanced` | YES supply == NO supply for each market | ✅ PASS |

## Contract Interactions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CONTRACT CALL FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LaunchpadEngine                                                             │
│  ├── createMarket(question, name, b, deadline, adjudicator)                  │
│  ├── buyOutcome(market, outcome, shares, maxCost) [AMM]                      │
│  ├── sellOutcome(market, outcome, shares, minReturn) [AMM]                   │
│  └── redeemLP(market, lpAmount)                                              │
│                                                                              │
│  SoothBook                                                                   │
│  ├── buyYes(marketKey, tick, amount, escrow, maxCollateral)                  │
│  ├── buyNo(marketKey, tick, amount, escrow, maxCollateral)                   │
│  ├── mint(marketKey, amount)                                                 │
│  ├── merge(marketKey, amount)                                                │
│  ├── cancel(marketKey, side, tick)                                           │
│  └── redeem(marketKey)                                                       │
│                                                                              │
│  Collateralizer                                                              │
│  ├── redeem(market, amount)                                                  │
│  └── getBalances(market, user) [view]                                        │
│                                                                              │
│  TruthMarket                                                                 │
│  ├── settle(outcome) [adjudicator only]                                      │
│  ├── isSettled() [view]                                                      │
│  └── winningOutcome() [view]                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Running the Test

```bash
# From contracts-testing directory
cd packages/contracts-testing

# Run full scenario
bun run script/interactive/interactive-test.ts \
  --chain=baseSepolia \
  --rpc=https://sepolia.base.org \
  --scenario=market-lifecycle-multi-actor

# Expected output:
# Scenario PASSED in ~170s (38 steps, 0 failures)
```

## CLI Commands Used

| Command | Description | Example |
|---------|-------------|---------|
| `mint <amount>` | Mint test USDC | `mint 50000` |
| `approve all` | Approve all contracts | `approve all` |
| `createmarket <template> <liquidity> --adjudicator=<actor>` | Create market | `createmarket alien 500 --adjudicator=david` |
| `setmarket created` | Set context to created market | `setmarket created` |
| `market buy\|sell <outcome> <shares>` | AMM trade | `market buy yes 100` |
| `graduate [steps]` | Graduate via fee trades | `graduate 8` |
| `buyyes <tick> <amount>` | SoothBook: buy YES at tick | `buyyes 600 50` |
| `buyno <tick> <amount>` | SoothBook: buy NO at tick | `buyno 450 50` |
| `sbmint <amount>` | SoothBook: mint YES+NO set | `sbmint 100` |
| `sbmerge <amount>` | SoothBook: burn YES+NO, get USDC | `sbmerge 100` |
| `sbcancel <side> <tick>` | SoothBook: cancel resting orders | `sbcancel yes 600` |
| `sbredeem` | SoothBook: redeem after resolution | `sbredeem` |
| `settle <outcome>` | Settle market | `settle yes` |
| `redeem` | Redeem winning positions | `redeem` |
| `redeemlp <amount\|max>` | Redeem LP tokens | `redeemlp max` |
| `pnl [initial]` | Show P&L summary | `pnl 50000` |
| `invariants` | Run invariant checks | `invariants` |
