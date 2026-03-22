# Canonical Review — Resolution

> **Date**: 2026-03-08
> **Resolved By**: Protocol Designer
> **Input**: canonical-review.md findings + designer decisions
> **Principle**: Specs describe the target architecture, not current code. No `[PLANNED]`/`[CURRENT]` labels — the spec IS the plan.

---

## Guiding Rule

The specs are written as-if already implemented. Code does not need to match the spec right now — we will develop using these specs. There is no need to label sections as `[PLANNED]` or `[CURRENT]`.

When specs conflict, the **latest spec in order** (Trading Engine > Layer 3 > Layer 2 > Layer 1 > SPEC-INDEX) is authoritative, because later specs refine earlier ones.

---

## D — Design Decisions

### D1. Graduation: `graduationBps` operator-set per instance ✅

**Decision**: Operator-controlled via `graduationBps` (replaces `graduationMultiplier`).

- `graduationMultiplier` (integer multiplier) is replaced by `graduationBps` (basis points)
- `graduationBps` is an **operator-set, instance-wide** parameter — NOT per-market, NOT creator-set
- Formula: `graduationThreshold = creatorDeposit * graduationBps / 10000`
- Type: `uint32` (range: `1` to `1000000`)
- Default: `10000` (100% of deposit = break-even: fees = deposit)
- Lower values (e.g. 5000) = graduate faster (50% of deposit in fees). Higher values (e.g. 20000) = graduate slower (200% of deposit in fees)
- Removed from `createMarket()` signature — creators do not control this

**Spec changes**: Update all specs to use `graduationBps` as operator param. Remove from `createMarket` signature.

---

### D2. Creator deposit: retained as floor value ✅

**Decision**: Layer 3 is correct. No separate refund on graduation.

- Creator deposit goes to AMMEngine as initial LMSR liquidity
- Creator receives LP tokens (1:1 with deposit in WAD) — this is their only claim
- No `refundCreatorDeposit()` on graduation
- Creator recovers value by redeeming LP tokens (at floor value + yield) after settlement

**Spec changes**: Remove `notifyGraduation` refund logic from Layer 1 §3.6 and §13.1.

---

### D3. Resolution lifecycle: multi-step ✅

**Decision**: Both Layer 1 and Layer 2 are correct — implement the multi-step pipeline.

```
resolve(outcome, tStar)  → LIVE → RESOLVING
verifyAttestation(bytes)  → RESOLVING → RESOLVED
settle()                  → RESOLVED → SETTLED (terminal)
```

- Layer 2's `verifyAttestation()` calls Layer 1's TruthMarket to transition RESOLVING → RESOLVED
- Layer 1's `settle()` takes no arguments (outcome already set at `resolve()` time)
- Some adjudicators skip RESOLVING by combining resolve + verify in one call
- Guardian veto: RESOLVED → LIVE (clears proposed outcome)

**Spec changes**: Align all specs to this 3-step model. Remove `accept()` naming from Layer 1 (use `verifyAttestation` consistently with Layer 2).

---

## P0 — Critical Contradictions

### P0-1. `createMarket()` signature

**Resolution**: Layer 3 is the target (7 params). Update Layer 1 to match.

```solidity
function createMarket(
    string memory _question,
    uint64 _startTime,
    uint64 _deadline,
    address _adjudicator,
    uint256 _bBase,
    uint256 _initialProbabilityWad,   // 0 = default 50/50
    // graduationBps is operator-set per instance, NOT a createMarket param
) external returns (address market, address lpToken);
```

Current code has a different signature — that's fine, the spec defines the target.

---

### P0-2. Trial cost tracking: LaunchpadEngine ✅

**Resolution**: Trial tracking belongs in **LaunchpadEngine**, not AMMEngine.

**Rationale**: Trial periods are a LaunchpadEngine concept. AMMEngine should be a pure trading engine, unaware of trial periods. The FeeRouter callback pattern allows LaunchpadEngine to track costs without AMMEngine knowing about trials.

**Architecture**:
- LaunchpadEngine tracks `userLockedCost[market][user]` and `totalLockedCost[market]`
- FeeRouter notifies LaunchpadEngine when a trade occurs during trial (via callback)
- `claimRefund(market)` lives on LaunchpadEngine
- AMMEngine is unaware of trials

**Spec changes**: Update Layer 1 §3.5 and §4.2 to reflect LaunchpadEngine as the location. Remove "moved to AMMEngine" language.

---

### P0-3. DISMISSED state — separate from INVALID

**Resolution**: Dismissed ≠ INVALID. Dismissed means "market ended, locked funds refundable."

**Design**:
1. `dismissMarket(market)` sets `isDismissed = true` on LaunchpadEngine
2. LaunchpadEngine calls `TruthMarket.dismiss()` → state = DISMISSED
3. Trading halts (venues check `isLive()` which returns false for DISMISSED)
4. Traders call `claimRefund(market)` on LaunchpadEngine → receives back `userLockedCost`
5. Creator calls `redeemLP(market, amount)` → receives floor value

**Key difference from INVALID settlement**:
- INVALID: 50% payout per share (could be less than what trader paid)
- DISMISSED: Full refund of locked cost (what trader actually paid during trial)

**Solvency considerations**:
- During trial, buys increase AMM balance by baseCost. Fees are reinvested into bBase.
- Sells decrease AMM balance (proceeds can be withdrawn after 24h lock).
- If there are significant sells + withdrawals during trial, the AMM may not hold enough to cover all refunds.
- **Safeguard**: `claimRefund` amount is capped at min(userLockedCost, available_per_user). If AMM can't cover full refunds, distribute pro-rata from available balance.
- In practice, during a 7-day trial most locked proceeds haven't expired yet (24h lock), so the AMM is solvent.

**Spec changes**: Update Layer 1 §7.3 and Layer 3 §9 to use DISMISSED state with refund model (not INVALID settlement).

---

### P0-4. LP token lock — creator only during bonding

**Resolution**: Creator LP locked during bonding. All other LP freely redeemable and transferable until settled.

**Economic analysis**:

*Option A (chosen): Creator-only lock*
- Creator cannot drain AMM during bonding ✅
- Trader LPs are freely redeemable at floor value
- Risk: Traders could redeem LP and reduce AMM depth
- Mitigation: LP tokens from fees are small relative to creator deposit (5% of trades vs 69.3% of bBase). The dilution is bounded.
- Benefit: Traders have an exit path if they lose confidence in the market

*Option B (rejected): Lock all LP during bonding*
- Simpler, no extraction risk
- But traders are trapped — contradicts "trader protection" principle of trial period
- If market looks bad, traders can't exit via LP redemption either

**Chosen**: Option A — creator-only lock. After graduation, all LP freely transferable and redeemable. After settlement (finalized), same — LP redeemable for final payout.

**Spec changes**: Update Layer 1 §9 (LaunchpadLPToken) and Layer 3 §11 to reflect creator-only lock.

---

### P0-5. `redeemLP` — no settlement gate ✅

**Resolution**: Layer 3 / current code is correct. No `isSettled()` requirement.

LP holders can exit at any time at floor value. This is by design — LP tokens represent a pro-rata claim on AMM equity, and that equity has a computable floor value at any point.

**Spec changes**: Remove `isSettled()` requirement from Layer 1 §3.6 `redeemLP`.

---

### P0-6. `settle()` signature — Layer 1 is correct

**Resolution**: Layer 1 is correct. `resolve(outcome, tStar)` stores the outcome, `settle()` just finalizes (no args).

- `resolve(uint8 outcome, uint64 tStar)` — proposes outcome, LIVE → RESOLVING
- `verifyAttestation(bytes attestation)` — proves outcome, RESOLVING → RESOLVED
- `settle()` — finalizes permanently, RESOLVED → SETTLED (no args)

SPEC-INDEX has the old `settle(outcome, tStar)` — this is outdated.

**Spec changes**: Update SPEC-INDEX to remove args from `settle()`. Keep Layer 1 as-is. Align Layer 2 `settle()` to no-args.

---

### P0-7. MatchingEngine — planned, spec as-if implemented ✅

**Resolution**: MatchingEngine is described in specs as-if it exists. No `[PLANNED]` label. The Trading Engine spec is authoritative for this design.

Code doesn't have it yet — that's fine. We build from these specs.

---

## P1 — Stale References

### P1-8. State machine names — Layer 1 is correct

**Resolution**: Layer 1 names (RESOLVING / RESOLVED / SETTLED) are the target. SPEC-INDEX is outdated with old names (SETTLING / SETTLED / FINALIZED).

**Spec changes**: Update SPEC-INDEX state machine diagram to use RESOLVING / RESOLVED / SETTLED.

---

### P1-9. ProtocolConfig — outdated, remove from SPEC-INDEX

**Resolution**: ProtocolConfig is removed in target architecture. Pause is internal to LaunchpadEngine. Guardian is per-adjudicator (Layer 2).

**Spec changes**: Remove ProtocolConfig from SPEC-INDEX glossary, architecture diagram, and key contracts table.

---

### P1-10. Collateralizer — remove from Layer 2

**Resolution**: Collateralizer is removed in target architecture. Layer 2 references are outdated.

**Spec changes**: Remove Collateralizer from Layer 2 §1 table, §2 diagram, and §7 settlement references.

---

### P1-11. CLOB Collateralizer — remove

**Resolution**: No Collateralizer for CLOB. All redemption for CLOB is offchain (matching, settlement batches). No need for a separate collateral contract.

**Spec changes**: Remove Collateralizer reference from Trading Engine §6 CLOB tradeoff table.

---

### P1-12. Post-grad fee text — update SPEC-INDEX

**Resolution**: SPEC-INDEX post-grad fee text is outdated.

**Spec changes**: Update to "1% post-grad fee (default, configurable by operator)" with 50/30/10/10 split.

---

### P1-13. `increaseBBase` — fine as-is

**Resolution**: `increaseBBase` is part of AMMEngine (Layer 1), called by creator through LaunchpadEngine. Layer 3 documents the creator-facing behavior. No conflict — Layer 3 describes the UX, Layer 1 describes the contract.

No spec changes needed.

---

### P1-14. `settlePosition` naming — standardize

**Resolution**: Use `settlePosition` consistently for both venues:
- `AMMEngine.settlePosition(market)` — settles AMM position
- `matchingEngine.settlePosition(marketKey, user)` — settles orderbook position

The Trading Engine §8 already distinguishes "trade settlement" (matching fills) from "position settlement" (after market finalization). This is clear.

Remove `redeem()` as an alias — use `settlePosition` everywhere.

**Spec changes**: Update Layer 1 §14.2 to use `settlePosition` instead of `redeem`. Update SPEC-INDEX role matrix. Update Layer 2 §7 settlement references.

---

### P1-15. `claimRefund` — on LaunchpadEngine

**Resolution**: `claimRefund` belongs on LaunchpadEngine (see P0-2).

**Spec changes**: Update Layer 1 §3.6 to show `claimRefund` on LaunchpadEngine (not AMMEngine). Remove "moved to AMMEngine" language.

---

### P1-16. `notifyGraduation` — doesn't matter

**Resolution**: Whether graduation is via callback (`notifyGraduation`) or automatic (`_distributeFee`), the spec describes the target. Don't label code differences.

No spec changes needed.

---

## P2 — Cleanup

### P2-17. All versions → 0.1.0

**Resolution**: All spec files use version 0.1.0 consistently.

**Spec changes**: Fix Layer 2 header from 0.2.0 → 0.1.0.

---

### P2-18. File naming — standardize with hyphens

**Resolution**: All spec files use hyphens, no `_SPEC` suffix.

**Rename**: `LAYER2_ADJUDICATOR_SPEC.md` → `LAYER2-ADJUDICATOR.md`

Update all internal cross-references.

---

### P2-19. Solc version — 0.8.33 is correct target

**Resolution**: SPEC-INDEX describes the target build config: `0.8.33`, `via_ir = false`, 200 runs. This is correct. AGENTS.md describes the current build (0.8.30) — both are accurate for their context.

No spec changes needed.

---

### P2-20. Missing INTEGRATION.md

**Resolution**: Keep the reference. INTEGRATION.md is planned. No action needed now.

---

### P2-21. Veto lifecycle — veto → LIVE, re-resolution allowed

**Resolution**: Veto does NOT make the market INVALID. It returns the market to LIVE state with the proposed outcome cleared. The adjudicator can then re-resolve — but only if the deadline has not passed.

**How it works now (applied to Layer 1 §7.5 and Layer 2 §8):**

```
RESOLVED → (guardian calls veto()) → LIVE
  ├── Proposed outcome cleared (winningOutcome = 0, tStar = 0)
  ├── If deadline not passed → adjudicator can call resolve() again with same or different outcome
  │   └── Full 3-step pipeline restarts: resolve → verifyAttestation → settle
  ├── If deadline passed (finite) → anyone calls invalidate() → SETTLED with INVALID
  └── If infinite deadline → adjudicator can always re-resolve (no time constraint)
```

Key points:
- Veto is a safety mechanism, not a punishment
- The adjudicator is NOT blocked from re-resolving — only deadline constrains it
- Multiple veto-resolve cycles are possible (no limit on count)
- Each re-resolution restarts the veto window

**Spec changes applied**: Added re-resolution path documentation to Layer 1 §7.5 and Layer 2 §8.

---

### P2-22. `settlePosition` after dismiss — separate path

**Resolution**: DISMISSED and SETTLED are separate states with separate redemption paths.

**How it works now:**

```
SETTLED markets (normal resolution):
  → Traders call AMMEngine.settlePosition(market) or matchingEngine.settlePosition(marketKey, user)
  → Payout based on winningOutcome: YES=1 gets yesShares, NO=0 gets noShares, INVALID=2 gets 50%
  → settlePosition gates on TruthMarket.isSettled() == true

DISMISSED markets (failed trial):
  → Traders call LaunchpadEngine.claimRefund(market)
  → Payout = userLockedCost (what they actually paid during trial)
  → claimRefund gates on isDismissed(market) == true
  → settlePosition is NOT callable (isSettled() returns false for DISMISSED)
  → Creator calls LaunchpadEngine.redeemLP() for residual floor value
```

The two paths never overlap:
- `isSettled()` returns true only for SETTLED state (normal resolution)
- `isDismissed()` returns true only for DISMISSED state (failed trial)
- A market can never be both SETTLED and DISMISSED

**No additional spec changes needed** — this separation was already applied in P0-3.

---

## Summary of Spec Changes Required

### SPEC-INDEX.md
- Remove ProtocolConfig from glossary, diagram, key contracts
- Update state machine to RESOLVING/RESOLVED/SETTLED
- Update `settle()` to no-args
- Update post-grad fee text to "1% (configurable)"
- Update Instance definition (remove ProtocolConfig)
- Update Guardian definition (per-adjudicator, Layer 2)
- Update Creator definition (remove "receives deposit on graduation", LP tokens are only claim)
- Update Adjudicator definition (multi-step resolve)
- Update `claimRefund` to LaunchpadEngine
- Use `settlePosition` instead of `redeem` in role matrix
- Update Graduation definition to use `graduationBps`

### LAYER1-CORE-PROTOCOL.md
- §3.4: Replace `graduationMultiplier` with `graduationBps` as operator-set instance param
- §3.5: Remove "trial cost tracking moved to AMMEngine" — keep on LaunchpadEngine
- §3.6: Update `createMarket` to 6-param signature (no `graduationBps` — operator-set)
- §3.6: Remove `isSettled()` gate from `redeemLP`
- §3.6: Remove "refunds creator deposit" from `notifyGraduation`
- §3.6: Restore `claimRefund` to LaunchpadEngine (remove strikethrough)
- §4.2: Remove trial cost tracking from AMMEngine
- §5.5: Update graduation formula to use `graduationBps`
- §7.3: Align DISMISSED state with refund model
- §7.4: Rename `accept()` to `verifyAttestation(bytes)` for consistency
- §9: Update LP token lock to creator-only during bonding
- §14: Use `settlePosition` everywhere (remove `redeem`)

### LAYER2-ADJUDICATOR.md (rename from LAYER2_ADJUDICATOR_SPEC.md)
- Fix version header to 0.1.0
- Remove Collateralizer references from §1, §2, §7
- Ensure `settle()` is no-args

### LAYER3-CREATOR.md
- Already mostly correct — minor alignment with Layer 1 changes
- §9: Clarify DISMISSED ≠ INVALID, refund model
- §11: Clarify creator-only LP lock

### TRADING-ENGINE.md
- §6: Remove Collateralizer from CLOB table
- §8: Standardize `settlePosition` naming (remove `redeem` alias)
- §9: Confirm trial tracking in LaunchpadEngine

---

> **Version**: 0.1.0 | **Resolution**: Canonical Review | **Date**: 2026-03-08
