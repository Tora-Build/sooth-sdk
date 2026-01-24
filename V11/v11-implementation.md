# V11 Implementation Plan

**Status**: In Progress
**Branch**: v11-implementation
**Date**: 2026-01-22

---

## Overview

Three-phase implementation of V11 features based on ADR-082, ADR-083, and CLI actor planning.

---

## Phase 1: ADR-083 Canonical Filenames (PRIORITY 1)

Remove versioned filenames per repo rules.

### Tasks

- [ ] 1.1 Rename `LaunchpadEngineV11.sol` → `LaunchpadEngine.sol`
- [ ] 1.2 Update imports in all test files
- [ ] 1.3 Move `test/v11/` tests to canonical paths:
  - `test/v11/unit/LaunchpadEngineV11.t.sol` → `test/unit/LaunchpadEngine.t.sol`
  - `test/v11/unit/ValidatedAdjudicator.t.sol` → `test/unit/ValidatedAdjudicator.t.sol`
  - `test/v11/unit/LaunchpadLPToken.t.sol` → `test/unit/LaunchpadLPToken.t.sol`
  - `test/v11/invariants/V11Invariants.t.sol` → `test/invariants/TrialPeriodInvariants.t.sol`
- [ ] 1.4 Rename `V11TestBase.sol` → `TrialPeriodTestBase.sol`
- [ ] 1.5 Update foundry.toml if needed
- [ ] 1.6 Run tests to verify nothing broke

### Files Changed
```
packages/contracts-core/src/
├── LaunchpadEngineV11.sol → LaunchpadEngine.sol

packages/contracts-testing/test/
├── v11/                    → DELETE after moving
├── unit/
│   ├── LaunchpadEngine.t.sol (renamed from V11)
│   ├── ValidatedAdjudicator.t.sol
│   └── LaunchpadLPToken.t.sol
├── invariants/
│   └── TrialPeriodInvariants.t.sol
└── base/
    └── TrialPeriodTestBase.sol
```

---

## Phase 2: Contract Changes

### 2.1 Add `claimSpotSellProceedsFor` to TickBookPoolManager

- [ ] 2.1.1 Add function to `TickBookPoolManager.sol`
- [ ] 2.1.2 Add interface to `ITickBookPoolManager.sol` (if exists)
- [ ] 2.1.3 Add unit tests
- [ ] 2.1.4 Update keeper scripts to use new function

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
        vault.creditUsdcAvailable(order.owner, proceeds);
    }

    if (order.sharesFilled >= order.sharesTotal) {
        order.active = false;
        _removeFromUserSpotSells(marketKey, order.owner, sellId);
    }
}
```

### 2.2 (Optional) ProtocolConfig Contract

Defer unless needed for CLI actor testing.

---

## Phase 3: CLI Actor Framework

### 3.1 Base Infrastructure

- [ ] 3.1.1 Create `actors/` directory
- [ ] 3.1.2 Define `Actor` base interface
- [ ] 3.1.3 Define `ActorContext` with chain/wallet info

### 3.2 Actor Implementations

| Actor | File | Priority |
|-------|------|----------|
| Creator | `actors/Creator.ts` | P1 |
| AMM Trader | `actors/AmmTrader.ts` | P1 |
| TickBook Trader | `actors/TickBookTrader.ts` | P1 |
| Adjudicator | `actors/Adjudicator.ts` | P1 |
| Guardian | `actors/Guardian.ts` | P2 |
| Keeper | `actors/Keeper.ts` | P1 (refactor) |
| Arbitrager | `actors/Arbitrager.ts` | P2 (refactor) |
| Protocol Owner | `actors/ProtocolOwner.ts` | P3 |

### 3.3 Scenarios

- [ ] 3.3.1 Full lifecycle scenario
- [ ] 3.3.2 Graduation scenario
- [ ] 3.3.3 Settlement scenario
- [ ] 3.3.4 Dismissal scenario

---

## Execution Order

1. **Phase 1** - ADR-083 first (blocks other work due to import paths)
2. **Phase 2.1** - claimSpotSellProceedsFor (enables keeper work)
3. **Phase 3.1-3.2** - Actor framework (core actors)
4. **Phase 3.3** - Scenarios

---

## Verification

```bash
# After each phase
cd packages/contracts-testing && forge test -vvv

# Specific suites
forge test --match-path 'test/unit/LaunchpadEngine.t.sol' -vvv
forge test --match-path 'test/invariants/*.t.sol' -vvv
```

---

*Last updated: 2026-01-22*
