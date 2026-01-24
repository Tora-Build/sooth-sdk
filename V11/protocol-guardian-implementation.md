# Protocol Guardian + Pause + Adjudicator Auto-Register (Implementation Plan)

**Status**: Draft
**Date**: 2026-01-21
**Branch**: impl-guardian-protocol-config

---

## Goals
- Protocol-level guardian role list (not creator-chosen), owner override.
- Global pause gate for create/trade/deposit; allow claims/withdraw/settle.
- Adjudicator-only finalize.
- Auto-register adjudicator config during market creation (no deployer ops).

## Non-Goals (for now)
- Implement retroactive settlement logic (tStar application); document only.
- Enforce adjudicator registries on-chain (trust signals remain off-chain).

---

## Plan (Phased)

### Phase 1: ProtocolConfig (roles + pause)
1. Add `ProtocolConfig.sol` with:
   - `owner` (Ownable), `guardians` mapping.
   - `pause()` / `unpause()` callable by guardian or owner.
   - `setGuardians(address[] add, address[] remove)` owner-only.
   - `isPaused()` / `isGuardian(address)` views.
2. Add `IProtocolConfig.sol` interface (minimal).

### Phase 2: TruthMarket + Launchpad wiring
3. Update `TruthMarket`:
   - Replace guardian address checks with `ProtocolConfig.isGuardian(msg.sender)`.
   - `finalize()` adjudicator-only.
   - Accept `protocolConfig` in constructor (protocol-level, not creator-chosen).
4. Update `LaunchpadEngineV11`:
   - Store `protocolConfig`.
   - Pass `protocolConfig` into TruthMarket constructor.
   - Remove guardian param from `createMarket` (breaking change) or assert fixed guardian.
   - Gate create/trade with `protocolConfig.isPaused()`.

### Phase 3: Pause gates across venues
5. Gate `TickBookPoolManager.placeOrder/placeSpotSell` when paused.
6. Gate `TickBookVault.depositUsdc` when paused (withdraw/redeem allowed).
7. Gate `AMMEngine.tradePositions` when paused.

### Phase 4: Adjudicator auto-register
8. Add `IAdjudicatorRegistrar` (or extend `IAdjudicator`) with `registerMarket(bytes config)`.
9. Extend `LaunchpadEngineV11.createMarketWithOptions` to accept adjudicator config.
10. Auto-call adjudicator `registerMarket` during market creation if supported.

### Phase 5: Tests + docs
11. Update tests for new constructor/signatures and pause behavior.
12. Add tests for guardian pause + adjudicator-only finalize.
13. Update docs/ABIs.

---

## Risks
- Breaking changes to market creation signatures and deployment scripts.
- Pause logic must avoid trapping funds (claims/withdraws allowed).
- Optional adjudicator config must be backwards compatible.

