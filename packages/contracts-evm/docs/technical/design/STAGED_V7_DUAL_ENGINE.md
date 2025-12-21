## Staged V7: Dual DEX Engine + Adjudicator Settlement

This document is the **working plan** for the staged smart contract redesign.
It is intentionally implementation-forward: each stage ends with code, tests, and verification.

### Canonical doctrine (must always hold)

- **Dual DEX Engine**:
  - **Orderbook (OB)**: produces **fully-collateralized** complete sets. OB fills must not mutate LMSR state.
  - **AMM (LMSR)**: is the **price anchor + safety net**. Only AMM fills update `qYes/qNo`.
- **No ledger contamination**:
  - OB collateral is **not** LP equity.
  - LP equity is derived from the **pure AMM ledger** (seed + fees + LMSR delta, minus max virtual liability).
- **Adjudicator is the Truth interface**:
  - Settlement must come from a **contract adjudicator** with unified behavior across classes (A/B/C/D).
  - Settlement includes the **truth time \(T^*\)** for Open-End markets and retroactive-finality settlement modes.

---

## Stage 1 (Implemented)

### Goals

1. **Adjudicator-gated settlement entrypoint** (removes creator/operator settlement authority).
2. **Preserve AMM/OB boundary** by disabling direct swap that mints/burns outcome tokens while updating LMSR.
3. **Unify failure refund semantics**: remove creator-only refund and use pro-rata LP redemption (`redeemLP`).
4. **Remove “trapped locks after market end”** by allowing immediate lock claiming after expiry/settlement.

### Delivered changes

- **Settlement moved to Adjudicator**:
  - `SoothMarketBase` now stores `adjudicator` as an `address`.
  - New entrypoint: `finalizeResolution(uint8 outcome, uint64 tStar)` gated by `onlyAdjudicator`.
  - `ISoothMarketV4.initialize` now takes `_adjudicator: address` (breaking change).
  - `ISoothMarketV4` exposes `adjudicator()` and `tStar()`.

- **Direct swap disabled**:
  - `LaunchpadMarket.swap()` now reverts. It previously mixed:
    - LMSR state updates (`qYes/qNo`)
    - mint/burn of collateralized outcome tokens
  - This violated the dual-engine separation.

- **Creator refund removed**:
  - `claimCreatorRefund()` now reverts.
  - Refunds after `expire()` happen via `redeemLP()` (pro-rata LP redemption).

- **Immediate lock claiming after market end**:
  - New: `claimLockedOnMarketEnd(maxSteps)` lets a user claim their locked proceeds once the market is no longer live.

### Tests

- Updated `LaunchpadV6.t.sol` to reflect Stage 1:
  - liquidation/force-graduate are deferred
  - refunds use `redeemLP`
- Legacy `Launchpad.t.sol` was archived and converted to a non-test contract.

### Known follow-ups for Stage 2

- Re-introduce Guardian liquidation/force-graduate with correct fee routing and race-free accounting.
- Introduce formal `IAdjudicator` interface and registry enforcement at market creation.
- Add retroactive settlement root plumbing (SettlementSink/Merkle claims) per Brevis docs.

