# V7 Implementation Plan (Dual-Engine + Adjudicators + Settlement Roots)

> Scope: **`packages/contracts-evm/` + `apps/web/` + `packages/sdk/`**
>
> Alpha policy: **breaking changes allowed**. Prefer the newest source of truth and update all dependents.
>
> Canonical design reference: `packages/contracts-evm/docs/technical/design/STAGED_V7_DUAL_ENGINE.md`

---

## Current State (as of 2025-12-22)

### Implemented in contracts (staged V7)
- **Stage 1**: Adjudicator-only settlement entrypoint + **direct swap disabled** + creator refund removed + market-end lock claiming (`claimLockedOnMarketEnd`).
- **Stage 2**: Adjudicator allowlisting (registry) + Guardian lifecycle actions + settlement-root scaffolding + safe “direct trade” (`TraderVault.depositAndTradeAMM`).
- **Stage 3**: Concrete adjudicators (manual + optimistic) + settlement-root payouts wired through `TraderVault.claimSettlementRoot`.
- **Stage 4**: Settlement sink allowlist (`TraderVault.setSettlementSink`) + Brevis adjudicator stub.

### QA status (contracts)
- V7-stage test suites exist and pass:
  - `DirectAmmTradeTest`
  - `SettlementRootSinkTest`
  - `AdjudicatorFlowsTest`
  - `BrevisAdjudicatorStubTest`

### Deployed status (canonical configs)
- Canonical `apps/web/src/config/deployments.json` is **V6.2.6** and does **not** list V7-specific system contracts (registry/sinks/adjudicators).
- Conclusion: **V7-stage contracts are QA’ed in repo but not yet deployed in the canonical config.**

---

## V7 Goal (user-facing)

- **Trading**: AMM trading via `TraderVault.tradeAMM` and safe wallet UX via `TraderVault.depositAndTradeAMM`.
- **Orderbook**: complete-set orderbook does not mutate LMSR ledger.
- **Locking**: lock-on-sell proceeds with:
  - normal timer-based claim while live (`TraderVault.claimUnlocked(marketVault)`)
  - market-end escape hatch (`LaunchpadMarket.claimLockedOnMarketEnd(maxSteps)`).
- **Settlement**:
  - resolution via market’s **Adjudicator contract** (`finalizeResolution(outcome, tStar)`).
  - optional retroactive settlement roots:
    - root published to `SoothSettlementRootSink`
    - user claims PnL via `TraderVault.claimSettlementRoot(...)`.

---

## Workstreams

### A) Contracts: final polish + deployment readiness
**Deliverables**
- Confirm the following are present in deploy scripts and have clear outputs:
  - `SoothAdjudicatorRegistry`
  - at least one adjudicator instance (`SoothManualAdjudicator`, optionally `SoothOptimisticAdjudicator`)
  - `SoothSettlementRootSink`
  - `SoothTraderVaultV4` configured with:
    - `setLaunchpadFactory(factory)`
    - `setSettlementSink(sink, true)`
  - `LaunchpadFactory` configured with:
    - `defaultAdjudicator`
    - `adjudicatorRegistry`
- Ensure all critical on-chain invariants are validated post-deploy:
  - factory markets are recognized by vault (`isMarket(...)` path works)
  - adjudicator allowlist enforcement works
  - direct swap reverts
  - `depositAndTradeAMM` works end-to-end
  - settlement root claim path works end-to-end on a test market

**QA**
- Run full unit suite:
  - `forge test -vvv`
- Add/extend scenario tests if missing:
  - market-end lock claiming path (`claimLockedOnMarketEnd`)
  - negative PnL claim path (`claimSettlementRoot` debits user)
  - decimals-scale divisibility enforcement in `claimSettlementRoot`

---

### B) Deployments: canonical config + deploy-sync
**Deliverables**
- Deploy V7-stage system contracts to target chains (Base Sepolia, MegaETH Frontier, etc.).
- Update **canonical** config:
  - `apps/web/src/config/deployments.json`
  - (if needed) `apps/web/src/config/markets.json`
  - **bump `version`**
- Run the sync flow:
  - `packages/contracts-evm/script/verify-deployment.sh`
  - `./sync-deployments.sh`

**Definition of Done**
- `deployments.json` includes addresses for:
  - registry, sink, adjudicators (at least default)
  - factory/quoter/vault contracts
  - markets + outcome tokens
- Verification script passes on each deployed chain.

---

### C) Frontend integration (apps/web)
**Deliverables**
- **Config & ABI alignment**
  - Ensure `apps/web/src/config/abis.ts` includes any V7 additions that the UI will call directly:
    - `LaunchpadFactory.createMarket(..., marketAdjudicator)` + `defaultAdjudicator()` + `adjudicatorRegistry()`
    - `TraderVault.depositAndTradeAMM`
    - `TraderVault.settlement root claim` flow if exposed in UI
    - `LaunchpadMarket.claimLockedOnMarketEnd`
- **Hooks**
  - Add/upgrade hooks to surface:
    - `market.adjudicator()` and `market.tStar()`
    - decimals split correctly:
      - WAD for AMM views (`ammAssets`, `totalNetAssets`, quoter outputs)
      - asset decimals for locks/transfers (`totalAssets`, `lockedProceeds`, `redeemLP` transfers)
    - settlement root claim status:
      - root existence `sink.roots(market,batchId)`
      - claimed status (`TraderVault.settlementClaimed(market,batchId,user)` or sink’s claimed mapping depending on UX)
- **UI**
  - Trading Terminal:
    - route “one-click trade” to `depositAndTradeAMM` when balance insufficient
    - show lock-on-sell proceeds + market-end claim button
  - Operator Console:
    - expose adjudicator actions depending on class (manual/optimistic/brevis)
    - expose guardian actions (`forceGraduate`, `liquidate`)
  - Activity Log:
    - add V7 event taxonomy (trade/orderbook/lock/settlement_root/admin)

**QA**
- `pnpm -C apps/web build`
- (Optional) Playwright: run minimal smoke on MarketDetail trade + claim flows

---

### D) SDK update (packages/sdk)
**Deliverables**
- Export updated contract clients/types for V7:
  - factory createMarket with adjudicator
  - TraderVault depositAndTrade + claimSettlementRoot
  - market settlement fields (adjudicator + tStar)
- Keep SDK aligned with canonical config + ABIs.

**QA**
- `pnpm -C packages/sdk build` (or equivalent)

---

## Rollout Sequence (recommended)

1. **Deploy system contracts** (registry, adjudicators, sink, vault) on target chain.
2. **Deploy factory + market implementations**, create at least one test market.
3. **Post-deploy wiring**:
   - allowlist sink in vault
   - set factory in vault
   - register adjudicator(s) in registry
4. **Verify** (`verify-deployment.sh`) + update canonical deployment configs + bump version + `sync-deployments.sh`.
5. **Frontend build + smoke test** on the deployed chain(s).

---

## Risk Checklist (don’t skip)

- **Decimals**:
  - AMM values are **WAD**; lock & transfer values are **asset decimals**.
  - Settlement roots: `pnlWad` must be divisible by `decimalsScale`.
- **Caching**:
  - bump `deployments.json.version` to avoid stale addresses in localStorage.
- **Authorization**:
  - ensure adjudicator allowlisting is enforced at market creation.
  - ensure sink allowlist is enabled in TraderVault before exposing claim UI.
- **Swap contamination**:
  - confirm `LaunchpadMarket.swap()` still reverts; frontend must not call it.

---

## Definition of Done (V7 “ready”)

- Contracts: `forge test` green, including V7-stage suites.
- Deployments: canonical `apps/web/src/config/deployments.json` updated with V7 contracts + version bumped; verification passes.
- Frontend: `apps/web` builds; users can:
  - trade via `tradeAMM` and `depositAndTradeAMM`
  - see and claim locked proceeds (timer-based + market-end path)
  - see adjudicator + tStar on settled markets
  - (if enabled) claim settlement root PnL through TraderVault


