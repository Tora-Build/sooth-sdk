# CLI Actor Testing Tool — Planning Document

**Status**: Planning
**Date**: 2026-01-21
**Branch**: v11

---

## Overview

Extend the CLI into a comprehensive testing tool that simulates the full market lifecycle with distinct actor types. Replace the generic "trader" with specialized actors that map to real protocol roles.

---

## Actor Definitions

| Actor | Contract(s) | Actions | Notes |
|-------|-------------|---------|-------|
| **Creator** | LaunchpadEngine | `createMarket`, `dismissMarket` | Only creator can dismiss during trial |
| **AMM Trader** | LaunchpadEngine | `tradePositions` | Bonding + post-graduation AMM |
| **TickBook Trader** | TickBookPoolManager | `placeOrder`, `placeSpotSell`, `cancelOrder`, `cancelSpotSell` | Post-graduation orderbook |
| **Adjudicator** | TruthMarket | `settle` | Resolves market outcome |
| **Guardian** | TruthMarket | `veto`, `finalize` | Veto bad settlements, finalize good ones |
| **Keeper** | TickBookPoolManager | `claimFillsFor`, `claimSpotSellProceedsFor` (new), maintenance | Permissionless claims for others |
| **Arbitrager** | Both | Trade both venues | Exploits AMM↔TickBook price gaps |

### Removed Actors
- ~~General Trader~~ → split into AMM Trader + TickBook Trader
- ~~LP Redeemer~~ → user behavior (self-claim via `redeemLP`)
- ~~Refund Claimer~~ → user behavior (self-claim via `claimRefund`)

---

## Market Lifecycle Phases

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. CREATION                                                             │
│    Actor: Creator                                                       │
│    Actions: createMarket(question, deadline, adjudicator, guardian,     │
│             initialLiquidity, trialDuration)                            │
│    State: Market deployed, trial period starts                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. TRIAL PERIOD (V11)                                                   │
│    Actors: Creator, AMM Traders                                         │
│    Actions:                                                             │
│      - Creator: dismissMarket() → abort if no traction                  │
│      - Traders: tradePositions() → costs tracked in lockedCost[]        │
│    Exit conditions:                                                     │
│      - Trial ends (block.timestamp > trialEndTime) → proceed to bonding │
│      - Creator dismisses → users can claimRefund()                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. BONDING PHASE                                                        │
│    Actors: AMM Traders                                                  │
│    Actions: tradePositions() with 5% fee                                │
│    State: Fees accumulate toward graduation threshold                   │
│    Exit: feesAccrued >= graduationThreshold                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. GRADUATION                                                           │
│    Trigger: Automatic when threshold met during trade                   │
│    Actions:                                                             │
│      - Deploy YES/NO ERC20 outcome tokens                               │
│      - Register market in TickBook                                      │
│    State: isGraduated = true                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. ACTIVE TRADING                                                       │
│    Actors: AMM Traders, TickBook Traders, Arbitragers, Keeper           │
│    Actions:                                                             │
│      - AMM: tradePositions() with 1% fee                                │
│      - TickBook: placeOrder(), placeSpotSell(), cancelOrder()           │
│      - Arbitrager: exploit price gaps between venues                    │
│      - Keeper: claimFillsFor(), maintenance                             │
│    State: Both venues active until settlement                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. SETTLEMENT                                                           │
│    Actors: Adjudicator, Guardian                                        │
│    Actions:                                                             │
│      - Adjudicator: settle(outcome, tStar) → SETTLED state              │
│      - Guardian: veto() → revert to SETTLING (optional)                 │
│      - Guardian/Adjudicator: finalize() → FINALIZED state               │
│    State: Trading halted, outcome locked                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. REDEMPTION                                                           │
│    Actors: All users (self-service)                                     │
│    Actions:                                                             │
│      - Traders: redeem() winning tokens for USDC                        │
│      - LPs: redeemLP() for share of pool                                │
│    State: Market complete                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Keeper vs Arbitrager Separation

### Keeper (Maintenance Bot)
- **Purpose**: Protocol health, UX improvement
- **Profit**: None (public good) or small tips
- **Actions**:
  - `claimFillsFor()` — credit filled shares to users
  - `claimSpotSellProceedsFor()` — credit spot sell proceeds (proposed)
  - Cancel dust orders
  - Clear stale liquidity

### Arbitrager (Profit-Seeking)
- **Purpose**: Price efficiency across venues
- **Profit**: Spread between AMM and TickBook prices
- **Actions**:
  - Buy cheap on AMM, sell expensive on TickBook (or vice versa)
  - Cross-market arbitrage (future)

---

## Claim Interface Gap & Fix

### Current State

| Type | Self-claim | Permissionless (For Others) |
|------|------------|----------------------------|
| Range Order | `claimFills()` | `claimFillsFor()` ✅ |
| Spot Sell | `claimSpotSellProceeds()` | ❌ **Missing** |

### How `claimFillsFor` Works

When orders cross, fills are recorded in **global accumulators** (not immediately credited):

```
Order placed → Crossing → Fill in accumulator → Claim needed → Shares credited
```

`claimFillsFor` is permissionless because:
- It only **credits** shares the owner already earned
- No harm possible — purely beneficial to owner
- Enables keepers to batch-claim for offline users

### Proposed Fix: Add `claimSpotSellProceedsFor`

```solidity
function claimSpotSellProceedsFor(bytes32 marketKey, uint256 sellId)
    external
    nonReentrant
    returns (uint256 proceeds)
{
    SpotSellOrder storage order = _spotSellOrders[marketKey][sellId];

    proceeds = order.proceedsWad;
    order.proceedsWad = 0;

    if (proceeds > 0) {
        vault.creditUsdcAvailable(order.owner, proceeds);  // owner, not caller
    }

    if (order.sharesFilled >= order.sharesTotal) {
        order.active = false;
        _removeFromUserSpotSells(marketKey, order.owner, sellId);
    }
}
```

**Rationale**: Mirrors `claimFillsFor` pattern, minimal change, enables keeper support.

---

## Guardian Role Clarification

### Current Implementation

| Function | Who Can Call | Contract |
|----------|--------------|----------|
| `dismissMarket()` | **Creator only** | LaunchpadEngineV11 |
| `veto()` | Guardian | TruthMarket |
| `finalize()` | Guardian or Adjudicator | TruthMarket |

### Open Question

Should guardian also be able to dismiss markets during trial period?

| Option | Dismiss Authority | Use Case |
|--------|-------------------|----------|
| Current | Creator only | Creator protection (abort failed launch) |
| Extended | Creator OR Guardian | External oversight (guardian can kill spam) |

**Decision**: TBD

---

## CLI Command Structure (Draft)

```bash
# Actor-based commands
cli actor create <question> --liquidity <amount> [--trial <duration>]
cli actor dismiss <market>

cli actor amm-trade <market> <YES|NO> <shares> [--max-cost <amount>]

cli actor ob-order <market> <YES|NO> <shares> --ticks <low>-<high>
cli actor ob-spot-sell <market> <YES|NO> <shares> --ticks <low>-<high>
cli actor ob-cancel <market> --order <id>

cli actor settle <market> <YES|NO|INVALID>
cli actor veto <market>
cli actor finalize <market>

cli actor keeper claim-all <market>
cli actor keeper maintenance <market>

cli actor arb <market> [--min-spread <bps>]

# Scenario commands (orchestrate multiple actors)
cli scenario full-lifecycle --traders <n> --duration <time>
cli scenario graduation --target-fees <amount>
cli scenario settlement --outcome <YES|NO>
cli scenario dismissal --trade-count <n>
```

---

## Implementation Tasks

### Phase 1: Contract Changes
- [ ] Add `claimSpotSellProceedsFor` to TickBookPoolManager
- [ ] (Optional) Add `batchClaimSpotSellProceedsFor` for gas efficiency
- [ ] Decision: Guardian dismiss authority?

### Phase 2: CLI Actor Framework
- [ ] Define Actor base interface
- [ ] Implement Creator actor
- [ ] Implement AMM Trader actor
- [ ] Implement TickBook Trader actor
- [ ] Implement Adjudicator actor
- [ ] Implement Guardian actor
- [ ] Implement Keeper actor
- [ ] Implement Arbitrager actor

### Phase 3: Scenarios
- [ ] Full lifecycle scenario
- [ ] Graduation scenario
- [ ] Settlement scenario
- [ ] Dismissal scenario
- [ ] Arbitrage scenario

### Phase 4: Testing & Docs
- [ ] Integration tests for each actor
- [ ] Scenario tests
- [ ] CLI documentation

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `packages/contracts-core/src/TickBookPoolManager.sol` | Add `claimSpotSellProceedsFor` |
| `packages/contracts-testing/script/interactive/actors/` | New directory for actor classes |
| `packages/contracts-testing/script/interactive/actors/Creator.ts` | New |
| `packages/contracts-testing/script/interactive/actors/AmmTrader.ts` | New |
| `packages/contracts-testing/script/interactive/actors/TickBookTrader.ts` | New |
| `packages/contracts-testing/script/interactive/actors/Adjudicator.ts` | New |
| `packages/contracts-testing/script/interactive/actors/Guardian.ts` | New |
| `packages/contracts-testing/script/interactive/actors/Keeper.ts` | Refactor from existing |
| `packages/contracts-testing/script/interactive/actors/Arbitrager.ts` | Refactor from existing |
| `packages/contracts-testing/script/interactive/scenarios/` | New directory |

---

## References

- V11 Test Plan: `.agent/plans/v11-market-lifecycle-testing.md`
- ERC-8004 Integration: `.agent/plans/erc8004-sooth-integration-v11.md`
- Existing CLI: `packages/contracts-testing/script/interactive/`

---

*Last updated: 2026-01-21*
