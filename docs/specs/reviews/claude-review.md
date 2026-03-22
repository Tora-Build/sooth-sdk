# Spec Review — Cross-File Consistency Audit

> Reviewer: Claude Opus 4.6
> Date: 2026-03-08
> Files reviewed: `SPEC-INDEX.md`, `LAYER1-CORE-PROTOCOL.md`, `LAYER2_ADJUDICATOR_SPEC.md`, `LAYER3-CREATOR.md`

---

## P0 — Must Resolve Before Implementation

### 1. Creator deposit refund on graduation — direct contradiction

- **LAYER1** §3.6 `notifyGraduation` (line 334): "Refunds creator deposit: transfers `creatorDeposit` in base token **back to creator**"
- **LAYER3** §6 (line 415): "LP tokens are the creator's **only claim** on the AMM — there is **no separate deposit refund**"

One says the creator gets their deposit back at graduation; the other says LP tokens are the only claim. These are mutually exclusive economics.

**Decision needed:** Does the creator get their deposit refunded at graduation (and LP tokens are a bonus), or are LP tokens the sole recovery mechanism?

---

### 2. Graduation mechanism: `graduationMultiplier` vs `graduationBps`

- **LAYER1** §3.4 and §5.5: Uses `graduationMultiplier` (operator-set, instance-wide)
  - Formula: `threshold = bBase × ln(2) × graduationMultiplier`
- **LAYER3** §3 and §7: Uses `graduationBps` (creator-set, per-market)
  - Formula: `threshold = creatorDeposit × graduationBps / 10000`
- **SPEC-INDEX** glossary (line 95): Uses `graduationMultiplier` (matching LAYER1)

These are fundamentally different designs. LAYER1 makes graduation speed an operator parameter; LAYER3 makes it a per-market creator parameter. The `createMarket()` signature in LAYER3 includes `_graduationBps` but LAYER1's does not.

**Decision needed:** Who controls graduation speed — operator (multiplier) or creator (BPS)? Update all three specs to match.

---

### 3. RESOLVING→RESOLVED transition: `accept()` vs `verifyAttestation()`

- **LAYER1** §7.4 (line 747): TruthMarket has `accept()` for RESOLVING → RESOLVED
- **LAYER2** §3 and §7: Uses `verifyAttestation()` for RESOLVING → RESOLVED

These are different function names on TruthMarket for the same state transition. LAYER2 is more recent (March 6 vs Feb 27) and has more detailed semantics (ZK proof verification, attestation checking).

**Decision needed:** Is the TruthMarket function called `accept()` or `verifyAttestation()`? LAYER2's `verifyAttestation(bytes calldata attestation)` is more expressive but LAYER1's `accept()` is simpler for adjudicators that skip attestation.

---

## P1 — Should Fix Before Sharing Specs

### 4. SPEC-INDEX lifecycle diagram uses old state names

SPEC-INDEX lifecycle diagram (lines 230–253) uses `SETTLING` and `FINALIZED`, but LAYER1 §7.3 (lines 727–732) explicitly renames these:

| V12 (old) | New (LAYER1) | SPEC-INDEX uses |
|---|---|---|
| SETTLING | RESOLVING | SETTLING ← wrong |
| SETTLED | RESOLVED | — |
| FINALIZED | SETTLED | FINALIZED ← wrong |

**Fix:** Update SPEC-INDEX lifecycle diagram to use RESOLVING/RESOLVED/SETTLED. Also update the function names in the diagram (`adjudicator.settle()` → `adjudicator.resolve()`, `finalize()` → `settle()`).

---

### 5. LP token transfer lock — contradictory rules

- **LAYER3** §6 (line 429): "LP tokens are **locked during bonding** (cannot redeem, cannot transfer)"
- **LAYER1** §9 (lines 863–865): "Transfer Lock: Active when `TruthMarket(market).isSettled()`" and "Transfers allowed before settlement"

| Spec | During Bonding | After Graduation | After Settlement |
|---|---|---|---|
| LAYER3 | Locked | Transferable | Redeemable |
| LAYER1 | Transferable | Transferable | Locked (no transfer) |

These are opposite lock semantics. LAYER3 locks early and unlocks at graduation; LAYER1 locks late at settlement.

**Fix:** Decide and align. LAYER3's model (lock during bonding, unlock at graduation) makes more economic sense — prevents creators draining liquidity before the market proves itself.

---

### 6. Dismiss behavior: SETTLED vs DISMISSED

- **LAYER3** §9 (line 627): dismiss → "TruthMarket state → **SETTLED**" with INVALID outcome
- **LAYER1** §7.2 (line 677): `DISMISSED` is a **separate enum value** in MarketState
- **LAYER1** §7.3 (lines 721–722): DISMISSED is its own terminal state, distinct from SETTLED

If dismiss leads to DISMISSED (not SETTLED), then `settlePosition()` / `redeemLP()` which check `isSettled()` won't work after dismiss. LAYER3 assumes traders can redeem after dismiss, which requires either:
- (a) Dismiss → SETTLED (LAYER3's model), or
- (b) Redemption functions also check `isDismissed()` (LAYER1's model with extra logic)

**Fix:** Pick one model. If DISMISSED is a separate state, all redemption functions need to accept it.

---

### 7. `createMarket()` parameter mismatch

**LAYER3** signature (lines 114–123):
```solidity
createMarket(question, startTime, deadline, adjudicator, bBase,
             initialProbabilityWad, graduationBps)
```

**LAYER1** signature (lines 292–298): only `question, startTime, deadline, adjudicator, bBase` — no `initialProbabilityWad`, no `graduationBps`.

**Fix:** Add `initialProbabilityWad` and `graduationBps` (or `graduationMultiplier`) to LAYER1's createMarket, or remove from LAYER3. This is blocked by P0 #2 (graduation mechanism decision).

---

### 8. LAYER2 references removed contracts

LAYER2 still mentions `Collateralizer` in three places despite all other specs agreeing it's removed:

- §1 table (line 36): Lists `Collateralizer` as a Layer 1 contract
- §2 architecture diagram (line 122): Shows `Collateralizer` as an execution venue
- §7 (line 575): "Opens `Collateralizer.redeem()` for winning token holders"

**Fix:** Remove all Collateralizer references from LAYER2. Replace line 575 with matching engine / AMMEngine settlement references.

---

### 9. `redeemLP` settlement requirement contradiction

- **LAYER3** §11 (line 727): "Currently does not enforce a settlement requirement (LP holders can exit at any time at the floor value)"
- **LAYER1** §3.6 (line 322): `redeemLP` "Requires: `TruthMarket(market).isSettled()`"

**Fix:** Align. If LAYER1 is canonical, update LAYER3 to remove the "any time" claim.

---

## P2 — Cleanup

### 10. File naming inconsistency

Actual filenames mix conventions:
- `LAYER1-CORE-PROTOCOL.md` (hyphens)
- `LAYER2_ADJUDICATOR_SPEC.md` (underscores + `_SPEC` suffix)
- `LAYER3-CREATOR.md` (hyphens, no `_SPEC` suffix)

SPEC-INDEX cross-reference table references `LAYER2-ADJUDICATOR.md` (hyphens, no `_SPEC`), which doesn't match the actual file.

**Fix:** Standardize. Suggest: `LAYER1-CORE-PROTOCOL.md`, `LAYER2-ADJUDICATOR.md`, `LAYER3-CREATOR.md`, `TRADING-ENGINE.md`.

---

### 11. `increaseBBase()` exists in LAYER3 but not LAYER1

LAYER3 §2 (lines 74–87) describes `increaseBBase(market, amount)` with detailed behavior (transfers base token, increases bBase, mints LP tokens to creator). LAYER1's LaunchpadEngine §3.6 doesn't list this function.

**Fix:** Add `increaseBBase` to LAYER1 §3.6 function list, or remove from LAYER3.

---

### 12. LAYER2 version mismatch

Header (line 6): "Version: 0.2.0"
Footer (line 935): "Version: 0.1.0"

**Fix:** Align to 0.2.0.

---

### 13. SPEC-INDEX post-grad fee text

SPEC-INDEX line 275: "0.5/0.1% AMM/OB fee" — these values don't match any other spec. All others say `postGradFeeBps = 100` (1%).

**Fix:** Update to "1% post-grad fee (default)" or clarify if AMM and OB have different rates.

---

### 14. SPEC-INDEX Solc version vs AGENTS.md

- SPEC-INDEX (line 20): `0.8.33, via_ir = false, 200-run optimizer`
- AGENTS.md: `0.8.30, via_ir = true, 1 run`

**Fix:** SPEC-INDEX is presumably the V12+ target. Note this is a deliberate change or reconcile.

---

### 15. SPEC-INDEX fee flow text says "Dynamic post-grad"

Line 288: "Fee percentages (5% pre-grad, Dynamic post-grad)" — unclear what "Dynamic" means. The default is 1% and it's operator-configurable, not dynamic per-trade.

**Fix:** Change to "configurable post-grad (default 1%)".

---

### 16. LAYER3 `settlePosition()` after dismiss

LAYER3 §8 (line 591): traders "Settle as INVALID via `settlePosition()`" after dismiss. If dismiss sets TruthMarket to DISMISSED (per LAYER1), `settlePosition()` may not work since it checks `isSettled()`. Blocked by P1 #6.

---

## Summary

| Priority | Count | Status |
|---|---|---|
| P0 (must resolve) | 3 | Design decisions needed |
| P1 (fix before sharing) | 6 | Spec alignment needed |
| P2 (cleanup) | 7 | Editorial / consistency |

The three P0 items are **design disagreements**, not typos — they need explicit decisions before either spec can be considered authoritative. The P1 items are contradictions that can be resolved once P0 decisions are made.
