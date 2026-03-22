# Cross-Spec Consistency Review — OpenCode

> **Scope**: SPEC-INDEX.md, LAYER1-CORE-PROTOCOL.md, LAYER2_ADJUDICATOR_SPEC.md, LAYER3-CREATOR.md, TRADING-ENGINE.md
> **Date**: 2026-03-08
> **Reviewer**: OpenCode (Claude Opus 4.6 via OpenCode)
> **Method**: Independent audit + synthesis of Amp, Claude, Codex, and Gemini reviews

---

## Approach

This review has two parts:

1. **New findings** not identified by the other four reviewers
2. **Cross-reviewer synthesis** — where reviewers agree, disagree, or missed each other's findings

---

## 🔴 P0 — Critical (New Findings)

### N1. Trial cost tracking location: TRADING-ENGINE contradicts Layer 1

- **Layer 1 §3.5**: "Trial cost tracking moved to AMMEngine"
- **Layer 1 §4.2**: AMMEngine tracks `totalLockedCost` and `userLockedCost`
- **TRADING-ENGINE §9** (line 924): "Trial cost tracking is in **LaunchpadEngine**, not AMMEngine"
- **TRADING-ENGINE §9** (line 928): "The AMMEngine is unaware of trial periods"

These are mutually exclusive. Layer 1 explicitly moved trial cost tracking to AMMEngine; TRADING-ENGINE explicitly says it's in LaunchpadEngine and AMMEngine is unaware of it. An implementer reading TRADING-ENGINE would put the logic in the wrong contract.

**Decision needed:** Which contract owns trial cost tracking — AMMEngine (Layer 1) or LaunchpadEngine (TRADING-ENGINE)?

---

### N2. MatchingEngine: contract vs interface inconsistency across all specs

The specs oscillate between treating MatchingEngine as a **contract** and as an **interface**, creating confusion about deployment topology:

- **Layer 1 §6** (line 575): "`MatchingEngine` is a **contract**"
- **Layer 1 §2** (line 59): "Defines `IMatchingEngine` interface"
- **SPEC-INDEX** (line 301): "`IMatchingEngine` — Unified settlement **interface** implemented by both onchain and offchain matching engines"
- **SPEC-INDEX** (line 118): Instance includes "**one** matching engine" — implying a single contract
- **TRADING-ENGINE §2**: Shows `MatchingEngine Contract` as a concrete box with SoothBook and CLOB as separate modules feeding into it
- **Layer 1** deployment (line 151): deploys `matchingEngine` as an address alongside `ammEngine`, `feeRouter`

The confusion: Is MatchingEngine a standalone contract that SoothBook and CLOB call into? Or is SoothBook itself an `IMatchingEngine` implementation? Layer 1 says "MatchingEngine is a contract" that sits between venues. SPEC-INDEX says SoothBook "implements `IMatchingEngine`" — making SoothBook the matching engine, not a separate contract.

**Decision needed:** Clarify the deployment topology. Is the matching engine a separate contract (Layer 1 model) or is SoothBook/CLOB the matching engine (SPEC-INDEX model)?

---

### N3. TRADING-ENGINE §6 still references Collateralizer

- **TRADING-ENGINE §6** (line 818), CLOB tradeoff table: "users interact with Collateralizer directly"

All other specs agree Collateralizer is removed. TRADING-ENGINE's CLOB section still assumes it exists as a user-facing contract.

**Fix:** Remove Collateralizer reference from TRADING-ENGINE §6 tradeoff table.

---

### N4. FeeRouter ownership of `feesAccrued` vs Layer 3 graduation formula

- **Layer 1 §5**: `feesAccrued` tracking is on FeeRouter (line 362)
- **Layer 1 §5.5**: Graduation check: `feesAccrued >= bBase * LN2_WAD / WAD * graduationMultiplier`
- **Layer 3 §7**: Graduation check: `threshold = creatorDeposit × graduationBps / 10000`

Beyond the known `graduationMultiplier` vs `graduationBps` conflict (which all reviewers caught), there's a subtler issue: Layer 1's formula references `feesAccrued` (tracked by FeeRouter) while Layer 3's formula references `creatorDeposit` (tracked by LaunchpadEngine). These aren't just different parameters — they're **different inputs from different contracts**. Even after resolving which parameter to use, the spec must clarify which contract's state variable drives the check.

**Decision needed:** Is the graduation threshold based on cumulative fees earned (FeeRouter state) or creator deposit size (LaunchpadEngine state)?

---

## 🟠 P1 — Should Fix (New Findings)

### N5. SPEC-INDEX Instance definition still includes ProtocolConfig

- **SPEC-INDEX** glossary, "Instance" (line 118): "One deployment of the full Sooth Protocol stack (LaunchpadEngine + AMMEngine + FeeRouter + `TruthMarketImpl` + **ProtocolConfig** + one matching engine)"
- **Layer 1 §1**: ProtocolConfig is explicitly listed as removed

The Instance definition — the single most important paragraph for understanding deployment topology — still includes a removed contract.

**Fix:** Remove `ProtocolConfig` from Instance definition. Replace with the actual deployment set per Layer 1.

---

### N6. Layer 2 §1 table still lists Collateralizer as a Layer 1 contract

- **Layer 2 §1** (line 36): "Layer 1 (Settlement) ... TruthMarket, LaunchpadEngine, AMMEngine, FeeRouter, **Collateralizer**, SoothBook"

This is the **scope definition table** — the first thing an adjudicator implementer reads. It names Collateralizer as a current Layer 1 contract alongside FeeRouter.

**Fix:** Remove `Collateralizer` from the Layer 2 §1 scope table.

---

### N7. `settlePosition()` caller and location unclear across specs

- **Layer 1 §14.3** (line 1104): "Matching engine positions: `matchingEngine.redeem(market)` or `settlePosition(market, user)`"
- **Layer 3 §9** (line 627): After dismiss, traders use "settlePosition() → 50% payout"
- **TRADING-ENGINE §8**: Distinguishes "Trade Settlement" from "Position Settlement" but doesn't define which contract exposes `settlePosition()`

Is `settlePosition()` on MatchingEngine, LaunchpadEngine, or TruthMarket? Layer 1 mentions it alongside `matchingEngine.redeem()` suggesting it's a matching engine function. Layer 3 mentions it as a standalone call. No spec provides the full function signature or contract location.

**Fix:** Add `settlePosition()` signature and contract location to Layer 1's function reference table.

---

### N8. Gemini review references concepts that don't exist in the specs

Gemini's review (the most positive of the four) references several concepts not found in any spec:

- **"Dynamic Fee Router"** — specs call it `FeeRouter`, not "Dynamic Fee Router". There is no dynamic fee mechanism described.
- **"shared Matching Engine"** as the recommended implementation anchor — but the specs disagree on whether this is a separate contract or an interface (see N2).
- **"V12 specification"** — the specs don't self-identify as V12. SPEC-INDEX says "V12" in the Quick Reference but Layer 1/2/3 don't use version numbers.
- Calls the transition "V11 to V12" — but the codebase README says "V11.1" and the specs are a forward-looking design, not a specific tagged version.

This suggests Gemini reviewed with pre-existing knowledge rather than strictly from the spec text. Its endorsement ("architecturally robust and ready for implementation") should be weighed against the fact that it missed all contradictions identified by the other three reviewers.

---

## 🟡 P2 — Cross-Reviewer Synthesis

### Consensus findings (all 3+ reviewers agree)

These issues are confirmed by multiple independent reviewers. High confidence they are real:

| # | Finding | Amp | Claude | Codex | Gemini |
|---|---------|-----|--------|-------|--------|
| 1 | `createMarket()` signature mismatch (5 vs 7 params) | ✅ #3 | ✅ #7 | ✅ #1 | ❌ |
| 2 | `graduationMultiplier` vs `graduationBps` conflict | ✅ #2 | ✅ #2 | ✅ (implicit in #1) | ⚠️ §3 note only |
| 3 | Creator deposit refund contradiction | ❌ | ✅ #1 | ✅ #3 | ❌ |
| 4 | `accept()` vs `verifyAttestation()` for RESOLVING→RESOLVED | ✅ #1 | ✅ #3 | ❌ | ❌ |
| 5 | SPEC-INDEX uses old state names (SETTLING/FINALIZED) | ✅ #6 | ✅ #4 | ✅ #5 | ❌ |
| 6 | Layer 2 references Collateralizer (3 places) | ✅ #8,#9 | ✅ #8 | ✅ #4 | ❌ |
| 7 | `redeemLP` settlement requirement contradiction | ✅ #15 | ✅ #9 | ✅ #2 | ❌ |
| 8 | DISMISSED vs SETTLED state after dismiss | ✅ #17 | ✅ #6 | ❌ | ❌ |
| 9 | LP token lock direction (bonding vs settlement) | ✅ #14 | ✅ #5 | ❌ | ❌ |
| 10 | SPEC-INDEX ProtocolConfig references (removed) | ✅ #5 | ❌ (implied) | ✅ #5 | ❌ |
| 11 | Solc version / optimizer config mismatch | ✅ #4 | ✅ #14 | ✅ #8 | ❌ |
| 12 | Layer 2 version header mismatch (0.2.0 vs 0.1.0) | ✅ #18 | ✅ #12 | ✅ #7 | ❌ |
| 13 | File naming inconsistency (hyphens vs underscores) | ❌ | ✅ #10 | ✅ #6 | ❌ |

### Findings unique to one reviewer

| Finding | Reviewer | Why others may have missed it |
|---------|----------|-------------------------------|
| `increaseBBase()` exists in Layer 3 but not Layer 1 | Claude #11 | Requires checking Layer 1 function list exhaustively |
| SPEC-INDEX post-grad fee text ("0.5/0.1%") | Amp #7, Claude #13 | Small numeric detail in a long doc |
| `claimRefund` location ambiguity | Amp #13 | Subtle: requires tracing across SPEC-INDEX Role Matrix + Layer 1 + Layer 3 |
| Missing `INTEGRATION.md` | Amp #19 | Requires checking file existence, not just content |
| `settlePosition()` after dismiss blocked by DISMISSED state | Claude #16 | Requires combining findings #6 and #9 |

### What Gemini got wrong

Gemini's review is an outlier. It identifies zero contradictions and concludes the specs are "ready for implementation." The other three reviewers collectively found **30+ issues** including at least 3 design-level conflicts that would cause implementation failures. Gemini's review should not be treated as evidence of spec readiness.

Specific Gemini claims that are incorrect per the specs:
- "removing the `Collateralizer`... in favor of internal position management" — Layer 2 still references Collateralizer; removal is incomplete
- "Unified Matching Engine" — the specs disagree on whether this is a contract or interface (N2)
- "architecturally robust and ready for implementation" — 3 P0 design conflicts remain unresolved

---

## 📋 Summary

| Priority | Count | Source |
|----------|-------|--------|
| 🔴 P0 — Critical (new) | 4 | N1–N4: trial cost location, MatchingEngine identity, TRADING-ENGINE Collateralizer ref, graduation input variable |
| 🟠 P1 — Should fix (new) | 4 | N5–N8: SPEC-INDEX Instance def, Layer 2 scope table, settlePosition location, Gemini accuracy |
| 🟡 P2 — Confirmed by consensus | 13 | Cross-reviewer validated findings |
| Unique to single reviewer | 5 | Worth verifying but lower confidence |

### Recommended resolution order

1. **Resolve 3 design conflicts first** (graduation mechanism, creator deposit refund, resolution lifecycle) — these block all other fixes
2. **Fix trial cost tracking contradiction** (N1) — this is an implementer trap
3. **Clarify MatchingEngine topology** (N2) — affects deployment scripts and contract interaction
4. **Sweep all Collateralizer references** across Layer 2, TRADING-ENGINE, and SPEC-INDEX
5. **Update SPEC-INDEX** — state names, ProtocolConfig, Instance definition, fee numbers, Role Permission Matrix
6. **Align function signatures** — `createMarket()`, `settle()`, `settlePosition()`, `increaseBBase()`
7. **File naming and version metadata** — low priority but easy wins

### Total unique findings across all 5 reviews

| Reviewer | Findings | Critical | Missed by others |
|----------|----------|----------|-----------------|
| Amp | 19 | 4 | 2 (claimRefund location, INTEGRATION.md missing) |
| Claude | 16 | 3 | 1 (increaseBBase) |
| Codex | 8 | 5 | 0 (all overlap with others) |
| Gemini | 0 contradictions | 0 | N/A (review was non-critical) |
| **OpenCode** | **8 new** | **4** | **4** (trial cost, MatchingEngine identity, graduation input, settlePosition location) |
| **Total unique** | **~35** | **~7** | — |

---

*The specs are a strong foundation but cannot be implemented as-is. The 3 design conflicts (graduation, deposit refund, resolution lifecycle) must be resolved by the protocol designer before any alignment pass can succeed.*
