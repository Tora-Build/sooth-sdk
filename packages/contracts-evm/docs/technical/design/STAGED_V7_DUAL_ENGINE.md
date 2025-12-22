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

- Updated tests to reflect Stage 1 semantics (no creator refund, no direct swap, adjudicator settlement).
- Legacy `Launchpad.t.sol` was archived and converted to a non-test contract.

---

## Stage 2 (Implemented)

### Goals

1. Enforce **Adjudicator allowlisting** and allow **per-market adjudicator selection** at creation time.
2. Restore **Guardian controls** with correct fee routing (`liquidate`, `forceGraduate`).
3. Add **settlement-root scaffolding** for Brevis-style retroactive settlement.
4. Reintroduce a **safe “direct trade” UX** without AMM/OB contamination.

### Delivered changes

- **Adjudicator registry + per-market selection**
  - Added `SoothAdjudicatorRegistry` (allowlist + metadata).
  - `LaunchpadFactory` now stores `defaultAdjudicator` and `adjudicatorRegistry`.
  - `createMarket(..., marketAdjudicator)` supports per-market adjudicator (0 = default) and enforces allowlist.

- **Guardian liquidation/force-graduate**
  - `LaunchpadMarket.liquidate()` is Guardian-only, post-expiry, routes a protocol fee to `factory.treasury()`.
  - `LaunchpadMarket.forceGraduate()` is Guardian-only, pre-expiry, sets `isGraduated = true`.

- **Settlement root sink (scaffolding)**
  - Added `SoothSettlementRootSink`: stores a Merkle root per (market, batchId) and verifies claims (event-only).
  - Submitters: market adjudicator or an authorized prover.

- **Safe one-call AMM trade**
  - Added `SoothTraderVaultV4.depositAndTradeAMM(...)` which pulls funds and executes `tradeAMM` in one call.
  - This replaces the old “direct swap” UX without touching ERC1155 outcome tokens.

### Tests

- Updated all Launchpad test suites and deploy scripts to the new factory signatures.
- Added:
  - `SettlementRootSinkTest` (submit root + claim verification)
  - `DirectAmmTradeTest` (deposit+trade in one call)

---

## Stage 3 (Implemented)

### Goals

1. Add concrete **Adjudicator classes** (manual + optimistic) under a shared interface.
2. Turn settlement roots into **real payout wiring** (credit/debit Trading Account + move USDC to/from the market vault).

### Delivered changes

- **Adjudicator classes**
  - Added `SoothManualAdjudicator` (owner resolves).
  - Added `SoothOptimisticAdjudicator` (propose + dispute window + finalize; simplified dispute flag).

- **Settlement root payout wiring**
  - Added `SoothTraderVaultV4.claimSettlementRoot(...)`:
    - Verifies the Merkle proof against `SoothSettlementRootSink`.
    - For positive PnL: pulls USDC from the market vault via `sendFunds` and credits `accounts[user].available`.
    - For negative PnL: debits `accounts[user].available`, pushes USDC to the market vault, and calls `receiveFunds`.

### Tests

- Added `AdjudicatorFlowsTest` (manual + optimistic resolution).
- Extended `SettlementRootSinkTest` with a payout-path test through `TraderVault`.

---

## Stage 4 (Implemented)

### Goals

1. Harden settlement-root payouts against malicious sink contracts.
2. Add a minimal Brevis-style adjudicator stub with gateway-authenticated callbacks.

### Delivered changes

- **Settlement sink allowlist**
  - Added `SoothTraderVaultV4.setSettlementSink(sink, enabled)` (owner-only).
  - `claimSettlementRoot` now requires `isSettlementSink[sink] == true`.

- **Brevis adjudicator stub**
  - Added `SoothBrevisAdjudicator`:
    - `brevisResolveMarket(...)` (only gateway) → calls market `finalizeResolution`.
    - `brevisSubmitSettlementRoot(...)` (only gateway) → submits root to `SoothSettlementRootSink`.

### Tests

- Extended `SettlementRootSinkTest` with sink allowlist revert test.
- Added `BrevisAdjudicatorStubTest`.

- Re-introduce Guardian liquidation/force-graduate with correct fee routing and race-free accounting.
- Introduce formal `IAdjudicator` interface and registry enforcement at market creation.
- Add retroactive settlement root plumbing (SettlementSink/Merkle claims) per Brevis docs.

