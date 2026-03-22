# Cross-Spec Consistency Review

> **Scope**: SPEC-INDEX.md, LAYER1-CORE-PROTOCOL.md, LAYER2_ADJUDICATOR_SPEC.md, LAYER3-CREATOR.md
> **Date**: 2026-03-08
> **Reviewer**: Amp

---

## 🔴 Critical Contradictions

### 1. Resolution lifecycle mismatch: Layer 1 has `accept()`, Layer 2 doesn't

- **Layer 1 §7.4** defines `accept()` as a TruthMarket function: `RESOLVING → RESOLVED`
- **Layer 1 §14.1** shows: `resolve() → accept() → settle()`
- **Layer 2 §3** defines `verifyAttestation()` for `RESOLVING → RESOLVED` — no `accept()` anywhere
- Layer 2 §7 state machine shows `verifyAttestation()` for that transition
- **Which is canonical?** Layer 1 and Layer 2 disagree on the function that moves `RESOLVING → RESOLVED`.

### 2. Graduation formula conflict

- **SPEC-INDEX glossary (bBase)**: `graduationThreshold = bBase × ln(2) × graduationMultiplier`
- **Layer 1 §3.4**: configurable `graduationMultiplier` (1–1,000,000)
- **Layer 1 §5.5**: `feesAccrued >= bBase * LN2_WAD / WAD * graduationMultiplier`
- **Layer 3 §3** and **§7**: `graduationThreshold = creatorDeposit * graduationBps / 10000`
- **Layer 3 §3** introduces `_graduationBps` as a per-market creator parameter
- Layer 1 has `graduationMultiplier` (operator-set), Layer 3 has `graduationBps` (creator-set). These are **different mechanisms**. Which one is the actual graduation formula?

### 3. `createMarket()` signature mismatch

- **Layer 1 §3.6**: `createMarket(question, startTime, deadline, adjudicator, bBase)` — 5 params, no `initialProbabilityWad`, no `graduationBps`
- **Layer 3 §3**: `createMarket(question, startTime, deadline, adjudicator, bBase, initialProbabilityWad, graduationBps)` — 7 params
- Layer 1 is missing 2 parameters that Layer 3 documents.

### 4. Solc version / optimizer config

- **SPEC-INDEX Quick Reference**: `0.8.33`, `via_ir = false`, 200-run optimizer
- **AGENTS.md**: `0.8.30`, `via_ir = true`, 1 run
- **Layer 2 §11 code examples**: `pragma solidity ^0.8.33`

---

## 🟠 Stale V12 References (Not Updated)

### 5. SPEC-INDEX still references removed contracts

- **Glossary → Guardian**: "Address in `ProtocolConfig` with emergency pause authority" — but ProtocolConfig is removed per Layer 1 §1. Guardian is now per-adjudicator in AdjudicatorBase (Layer 2).
- **Glossary → Instance**: Lists `ProtocolConfig` as part of the stack
- **Key Contracts table**: Lists `ProtocolConfig` as `src/ProtocolConfig.sol` — "Guardian roles, global pause"
- **Key Contracts table**: Lists `TruthMarket` states as `LIVE→SETTLING→SETTLED→FINALIZED` — old names
- **Architecture diagram**: Shows `ProtocolConfig (guardian, global pause)` in Layer 1

### 6. SPEC-INDEX state machine uses old names

- Shows `SETTLING`, `SETTLED`, `FINALIZED` — should be `RESOLVING`, `RESOLVED`, `SETTLED`
- Shows `REFUNDED` as a terminal state — not defined in Layer 1's TruthMarket states
- Uses `adjudicator.settle()` directly — Layer 1 uses a 3-step process

### 7. SPEC-INDEX fee flow uses wrong post-grad fee

- Shows `0.5/0.1% AMM/OB fee` post-graduation
- Layer 1 §5.3 says `postGradFeeBps = 100` (1%)

### 8. Layer 2 §7 references Collateralizer

- "Opens `Collateralizer.redeem()` for winning token holders" — Collateralizer is removed

### 9. Layer 2 architecture diagram (§2) lists Collateralizer

- Shows `Collateralizer` in the Layer 1 box alongside AMMEngine and SoothBook

### 10. SPEC-INDEX Adjudicator glossary

- Says adjudicator calls `TruthMarket.settle(outcome, tStar)` — but Layer 1 §7.4 shows `settle()` takes no args (outcome set at `resolve()` time)

### 11. SPEC-INDEX Role Permission Matrix

- Row `settle(outcome, tStar) on TruthMarket` — should just be `settle()` per Layer 1
- Row references `redeem() via matching engine settlement` but uses `post-finalized` — should be `post-settled`

---

## 🟡 Ambiguities & Gaps

### 12. Trial cost tracking location contradicts itself within Layer 1

- **Layer 1 §3.5** says: "Trial cost tracking moved to AMMEngine"
- **Layer 1 §4.2** confirms AMMEngine tracks `totalLockedCost` and `userLockedCost`
- **Layer 3 §8** references trial cost tracking without specifying which contract
- Narrative in §3.5: "AMMEngine already handles balance tracking. It increments `totalLockedCost`… and LaunchpadEngine reads it for refund claims."

### 13. `claimRefund` location

- **Layer 1 §3.6**: `claimRefund` marked as "moved to AMMEngine"
- **SPEC-INDEX Role Matrix**: Shows `claimRefund()` from LaunchpadEngine
- **Layer 3 §9**: Shows dismiss → "Traders: settlePosition() → 50% payout" but also references Layer 1's `claimRefund` — unclear if refund and settle are the same or different paths

### 14. LP token transfer lock direction is backwards

- **Layer 1 §9**: "Transfer-locked after market settlement" — but the whole point is LP tokens are locked DURING bonding and UNLOCKED at graduation
- **Layer 3 §7** says LP tokens are locked during bonding and unlock at graduation
- **Layer 1 §9** says transfers lock AFTER settlement
- These are opposite.

### 15. `redeemLP` settlement requirement inconsistent

- **Layer 1 §3.6**: `redeemLP` requires `TruthMarket(market).isSettled()` — terminal state
- **Layer 3 §11**: "Currently does not enforce a settlement requirement (LP holders can exit at any time at the floor value)"

### 16. Veto target state

- **Layer 1 §7.3 diagram**: veto goes `RESOLVED → LIVE` ✓
- **Layer 1 §7.5 code**: veto requires `state == RESOLVED`, sets `state = LIVE` ✓
- **Layer 2 §7 state machine**: shows veto from `RESOLVED → LIVE` ✓
- Consistent — but worth noting: a vetoed market goes LIVE→RESOLVING→RESOLVED→(veto)→LIVE. The adjudicator must re-resolve from scratch.

### 17. `dismiss()` state: DISMISSED vs SETTLED

- **Layer 1 §7.3** shows DISMISSED as a **separate state** from SETTLED — `dismiss()` sets `state = DISMISSED`
- **Layer 1 §7.4** lists `dismiss()` on TruthMarket, called by LaunchpadEngine
- **Layer 3 §9** says dismiss "Settles market as INVALID (outcome = 2) → TruthMarket state → SETTLED"
- **Contradiction**: Is the dismissed state `DISMISSED` or `SETTLED`? Layer 1 defines DISMISSED as its own enum value, but Layer 3 says it goes to SETTLED.

### 18. Layer 2 version header mismatch

- Top of file: `Version: 0.2.0`
- Bottom of file: `Version: 0.1.0`

### 19. Missing INTEGRATION.md

- SPEC-INDEX references `INTEGRATION.md` as a spec file but it doesn't exist in `docs/specs/`

---

## 📋 Summary

| Priority | Count | Action |
|----------|-------|--------|
| 🔴 Critical contradictions | 4 | Must resolve before implementation — graduation formula, resolution lifecycle, createMarket sig, solc version |
| 🟠 Stale V12 references | 7 | SPEC-INDEX needs a full pass to remove ProtocolConfig, old state names, Collateralizer refs |
| 🟡 Ambiguities | 8 | Clarify dismiss state, LP lock direction, redeemLP requirement, trial cost location |

**Biggest risk**: Someone implementing from SPEC-INDEX alone would build the wrong thing — it still reflects the V12 architecture in key places (ProtocolConfig, state names, Collateralizer, fee numbers, graduation formula).
