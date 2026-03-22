# Canonical Spec Review — Code-Validated

> **Scope**: SPEC-INDEX.md, LAYER1-CORE-PROTOCOL.md, LAYER2_ADJUDICATOR_SPEC.md, LAYER3-CREATOR.md, TRADING-ENGINE.md
> **Date**: 2026-03-08
> **Sources**: Merged from Amp, Claude, Codex, and OpenCode reviews. Gemini findings extracted as Appendix B.
> **Validation**: Every finding cross-checked against the V12 Solidity code on `main`.

---

## How to Read This Document

Each finding has a **Code Reality** annotation:

- `CODE: Layer 1 ✓` — Layer 1 matches current code
- `CODE: Layer 3 ✓` — Layer 3 matches current code
- `CODE: Neither` — both specs describe planned (unimplemented) behavior
- `CODE: N/A` — finding is about spec text only, no code equivalent
- `DECISION` — a genuine design choice that must be made regardless of current code

---

## D — Design Decisions (Must Resolve First)

These are not typos or stale text. They are genuine architectural forks where the specs propose mutually exclusive designs. Current code implements one path, but the specs may intentionally propose a different path. The protocol designer must decide.

### D1. Graduation mechanism: who controls graduation speed?

| | Layer 1 / SPEC-INDEX | Layer 3 | Current Code |
|---|---|---|---|
| **Parameter** | `graduationMultiplier` | `graduationBps` | `graduationMultiplier` |
| **Set by** | Operator (instance-wide) | Creator (per-market) | Operator (`onlyOwner`) |
| **Formula** | `feesAccrued >= bBase × ln(2) × multiplier` | `creatorDeposit × graduationBps / 10000` | `(bBase * LN2_WAD * multiplier) / WAD` |
| **Input** | `feesAccrued` (cumulative fees) | `creatorDeposit` (initial deposit) | `state.bBase` + `feesAccrued` |
| **Range** | 1–1,000,000 (per spec) | BPS (per spec) | 1–10 (`setGraduationMultiplier`) |
| **In `createMarket` sig?** | No | Yes (`_graduationBps` param) | No |

`CODE: Layer 1 ✓` — but Layer 3's design is a valid proposal to give creators control.

**Decision**: Operator-controlled (current) or creator-controlled (proposed)?
*Sources: Amp #2, Claude #2, Codex #1, OpenCode N4*

---

### D2. Creator deposit: refunded at graduation or retained as floor value?

| | Layer 1 | Layer 3 | Current Code |
|---|---|---|---|
| **On graduation** | Refunds `creatorDeposit` back to creator | LP tokens are creator's **only claim** — no separate refund | **Not refunded.** Stays as floor value component |
| **Floor calc** | — | `totalCash = creatorDeposit + feesAccrued + lpYieldPool` | Same as Layer 3 (LaunchpadEngine:606) |

`CODE: Layer 3 ✓`

**Decision**: Keep current model (deposit as floor value) or switch to refund-on-graduation?
*Sources: Claude #1, Codex #3*

---

### D3. Resolution lifecycle: direct settle or multi-step?

| | Layer 1 | Layer 2 | Current Code |
|---|---|---|---|
| **Function** | `accept()` for RESOLVING→RESOLVED | `verifyAttestation()` for RESOLVING→RESOLVED | `settle(outcome, tStar)` — single call |
| **States** | LIVE→RESOLVING→RESOLVED→SETTLED | LIVE→RESOLVING→RESOLVED→SETTLED | `LIVE→SETTLING→SETTLED→FINALIZED` |
| **Args** | `accept()` takes no args | `verifyAttestation(bytes attestation)` | `settle(uint8 outcome, uint64 _tStar)` |

`CODE: Neither` — code uses a simpler single-step model with different state names.

**Decision**: Keep current direct `settle()`, or move to the multi-step resolve→verify→settle pipeline?
*Sources: Amp #1, Claude #3*

---

## P0 — Critical Contradictions

These findings represent real inconsistencies between specs that would cause implementation bugs regardless of which design direction is chosen.

### 1. `createMarket()` signature — all three versions disagree

| Source | Parameters |
|---|---|
| **Layer 1 §3.6** | `question, startTime, deadline, adjudicator, bBase` (5 params) |
| **Layer 3 §3** | `question, startTime, deadline, adjudicator, bBase, initialProbabilityWad, graduationBps` (7 params) |
| **Current code** | `question, startTime, deadline, adjudicator, guardian, initialLiquidity, adjudicatorAgentId, adjudicatorMinValidators` (8 params) |

None of the three match. The code has `guardian`, `adjudicatorAgentId`, and `adjudicatorMinValidators` which appear in neither spec. Both specs reference `bBase` which the code calls `initialLiquidity`.

`CODE: Neither spec is correct`

**Fix**: Update both specs to match the target signature. If D1 adds `graduationBps`, include it. Blocked by D1.
*Sources: Amp #3, Claude #7, Codex #1*

---

### 2. Trial cost tracking location

| Source | Location |
|---|---|
| **Layer 1 §3.5** | "Trial cost tracking moved to AMMEngine" |
| **Layer 1 §4.2** | AMMEngine tracks `totalLockedCost` and `userLockedCost` |
| **TRADING-ENGINE §9** | "Trial cost tracking is in **LaunchpadEngine**, not AMMEngine. The AMMEngine is unaware of trial periods." |
| **Current code** | `userLockedCost` and `totalLockedCost` are on **LaunchpadEngine** (lines 79, 86) |

`CODE: TRADING-ENGINE ✓`

Layer 1 claims the tracking "moved to AMMEngine" — but the code has it on LaunchpadEngine, matching TRADING-ENGINE. Layer 1 §3.5 and §4.2 describe a planned migration that hasn't happened.

**Fix**: Update Layer 1 §3.5 and §4.2 to reflect current location (LaunchpadEngine), or label as `[PLANNED]`.
*Source: OpenCode N1*

---

### 3. DISMISSED state vs SETTLED — neither spec matches code

| Source | What dismiss does |
|---|---|
| **Layer 1 §7.3** | Sets TruthMarket to `DISMISSED` (separate enum value) |
| **Layer 3 §9** | Sets TruthMarket to `SETTLED` with outcome=INVALID |
| **Current code** | Sets `trial.isDismissed = true` on **LaunchpadEngine**. TruthMarket state is **unchanged** (stays LIVE). |

`CODE: Neither`

In code, dismiss is a LaunchpadEngine-level flag, not a TruthMarket state transition. This means `isSettled()` returns false after dismiss, and any redemption functions gated on `isSettled()` would fail.

**Fix**: Align all specs to one model. If dismiss should enable redemptions, either: (a) have dismiss call `settle(INVALID)` on TruthMarket, or (b) have redemption functions also check `isDismissed()`.
*Sources: Amp #17, Claude #6*

---

### 4. LP token transfer lock — opposite semantics

| Phase | Layer 3 | Layer 1 | Current Code |
|---|---|---|---|
| During bonding | **Locked** (no transfer) | Transferable | No lock logic found |
| After graduation | Transferable | Transferable | No lock logic found |
| After settlement | Redeemable | **Locked** (no transfer) | No lock logic found |

`CODE: Neither` — no transfer lock logic exists in `LaunchpadLPToken.sol`.

Both specs describe lock mechanisms, but with opposite timing. The code has none at all.

**Fix**: Decide when LP tokens should be locked and implement. Layer 3's model (lock during bonding) makes more economic sense — prevents creators from draining liquidity before the market proves itself.
*Sources: Amp #14, Claude #5*

---

### 5. `redeemLP` settlement gate

| Source | Guard |
|---|---|
| **Layer 1 §3.6** | Requires `TruthMarket(market).isSettled()` |
| **Layer 3 §11** | "Does not enforce a settlement requirement (LP holders can exit at any time at the floor value)" |
| **Current code** | Only checks `lpToken.balanceOf(msg.sender) >= lpAmount` — **no settlement gate** |

`CODE: Layer 3 ✓`

**Fix**: Update Layer 1 to remove the `isSettled()` requirement, or add it to code if intended.
*Sources: Amp #15, Claude #9, Codex #2*

---

### 6. `settle()` function signature on TruthMarket

| Source | Signature |
|---|---|
| **SPEC-INDEX** glossary | `settle(outcome, tStar)` |
| **Layer 1 §7.4** | `settle()` — no args (outcome set at `resolve()` time) |
| **Current code** | `settle(uint8 outcome, uint64 _tStar)` — with args |

`CODE: SPEC-INDEX ✓`

SPEC-INDEX is correct. Layer 1's no-args version is the planned future design where `resolve()` stores the outcome and `settle()` just finalizes.

**Fix**: Update Layer 1 to match current signature, or label the no-args version as `[PLANNED]`.
*Sources: Amp #10, #11*

---

### 7. MatchingEngine: contract vs interface vs nonexistent

| Source | What it says |
|---|---|
| **Layer 1 §6** | "`MatchingEngine` is a **contract**" that sits between SoothBook/CLOB and the protocol |
| **Layer 1 §2** | Lists MatchingEngine as a contract with `IMatchingEngine` interface |
| **SPEC-INDEX** | `IMatchingEngine` = unified interface; SoothBook "implements IMatchingEngine" |
| **TRADING-ENGINE §2** | Shows `MatchingEngine Contract` as a concrete deployment |
| **Current code** | **Neither exists.** SoothBook is standalone (`ISoothBook`). No `IMatchingEngine`. No `MatchingEngine` contract. |

`CODE: Neither`

**Fix**: All specs reference an abstraction that hasn't been built. Either label as `[PLANNED]` or remove until implemented.
*Source: OpenCode N2*

---

## P1 — Stale References (Spec Text vs Code)

These findings are about spec text that references things that don't match reality. Each has a clear fix.

### 8. SPEC-INDEX state machine uses "old" names — but those are the current code

SPEC-INDEX shows `SETTLING→SETTLED→FINALIZED`. Layer 1 says these were renamed to `RESOLVING→RESOLVED→SETTLED`.

`CODE: SPEC-INDEX ✓` — The code enum is `{LIVE, SETTLING, SETTLED, FINALIZED}`.

**Fix**: Do NOT update SPEC-INDEX to Layer 1's names — SPEC-INDEX is correct for current code. Instead, label Layer 1's names as `[PLANNED]`.
*Sources: Amp #6, Claude #4, Codex #5*

---

### 9. SPEC-INDEX references ProtocolConfig — which still exists in code

SPEC-INDEX lists `ProtocolConfig` in the glossary, Instance definition, key contracts table, and architecture diagram. Layer 1 says it's removed.

`CODE: SPEC-INDEX ✓` — `ProtocolConfig.sol` exists and is deployed.

**Fix**: Do NOT remove ProtocolConfig from SPEC-INDEX. Update Layer 1 to reflect that removal is `[PLANNED]`, not completed.
*Sources: Amp #5, Codex #5, OpenCode N5*

---

### 10. Layer 2 references Collateralizer — which still exists in code

Layer 2 mentions `Collateralizer` in three places (§1 table, §2 diagram, §7 settlement). Other specs say it's removed.

`CODE: Layer 2 is accidentally correct` — `Collateralizer.sol` exists, is deployed, and handles split/merge/redeem.

**Fix**: The references are currently accurate. When Collateralizer is actually removed from code, sweep all specs.
*Sources: Amp #8/#9, Claude #8, Codex #4, OpenCode N3/N6*

---

### 11. TRADING-ENGINE §6 CLOB table references Collateralizer

CLOB tradeoff table (line 818): "users interact with Collateralizer directly."

`CODE: Currently correct` — but if specs intend to document the planned architecture, this should be removed.

**Fix**: Remove if describing planned state; keep if describing current state. Depends on spec labeling decision.
*Source: OpenCode N3*

---

### 12. SPEC-INDEX post-graduation fee text

SPEC-INDEX (line 275): "0.5/0.1% AMM/OB fee" — doesn't match Layer 1 §5.3 which says `postGradFeeBps = 100` (1%).

`CODE: N/A` — FeeRouter doesn't exist yet; fee logic is inside LaunchpadEngine with a 5% pre-graduation fee.

**Fix**: Update SPEC-INDEX to "1% post-grad fee (default)" or "configurable post-grad (default 1%)".
*Sources: Amp #7, Claude #13, #15*

---

### 13. `increaseBBase()` missing from Layer 1

Layer 3 §2 describes `increaseBBase(market, amount)` with detailed behavior. Layer 1's LaunchpadEngine §3.6 function list doesn't include it.

`CODE: Exists` — LaunchpadEngine:624, creator-only, nonReentrant.

**Fix**: Add `increaseBBase` to Layer 1 §3.6 function reference.
*Source: Claude #11*

---

### 14. `settlePosition()` location unclear

Layer 1 §14.3 mentions `settlePosition(market, user)` alongside `matchingEngine.redeem()`. Layer 3 §9 references it after dismiss. TRADING-ENGINE §8 distinguishes trade vs position settlement without specifying the contract.

`CODE: AMMEngine` — `settlePosition(address market)` is on AMMEngine:582.

**Fix**: Add `settlePosition()` to the correct contract's function reference in all specs.
*Source: OpenCode N7*

---

### 15. `claimRefund` location

Layer 1 §3.6 says `claimRefund` is "moved to AMMEngine." SPEC-INDEX Role Matrix shows it on LaunchpadEngine.

`CODE: LaunchpadEngine` — `claimRefund(address market)` is at LaunchpadEngine:489.

**Fix**: Update Layer 1 §3.6 to reflect LaunchpadEngine location. Update SPEC-INDEX if needed.
*Source: Amp #13*

---

### 16. `notifyGraduation()` doesn't exist

Layer 1 describes `notifyGraduation(market)` as a callback from FeeRouter to LaunchpadEngine.

`CODE: Does not exist` — Graduation is automatic inside `_distributeFee()` (LaunchpadEngine:536).

**Fix**: Label as `[PLANNED]` or describe the current automatic graduation mechanism.
*Sources: meta-review code validation*

---

## P2 — Cleanup

### 17. Layer 2 version header mismatch

Header (line 6): "Version: 0.2.0" / Footer (line 935): "Version: 0.1.0"

**Fix**: Align to 0.2.0.
*Sources: Amp #18, Claude #12, Codex #7*

---

### 18. File naming inconsistency

- `LAYER1-CORE-PROTOCOL.md` (hyphens)
- `LAYER2_ADJUDICATOR_SPEC.md` (underscores + `_SPEC`)
- `LAYER3-CREATOR.md` (hyphens, no `_SPEC`)

SPEC-INDEX references `LAYER2-ADJUDICATOR.md` (hyphens, no `_SPEC`) — doesn't match actual filename.

**Fix**: Standardize to hyphens without `_SPEC`: `LAYER2-ADJUDICATOR.md`.
*Sources: Claude #10, Codex #6*

---

### 19. Solc version / optimizer mismatch

| Source | Solc | via_ir | Optimizer |
|---|---|---|---|
| SPEC-INDEX | 0.8.33 | false | 200 runs |
| AGENTS.md | 0.8.30 | true | 1 run |
| Layer 2 §11 examples | ^0.8.33 | — | — |

`CODE: AGENTS.md ✓` — current build uses 0.8.30 with via_ir=true.

**Fix**: SPEC-INDEX describes the V12+ target. Add a note: "Current build: 0.8.30. Target: 0.8.33."
*Sources: Amp #4, Claude #14, Codex #8*

---

### 20. Missing INTEGRATION.md

SPEC-INDEX (line 41) references `INTEGRATION.md` as a spec file. It doesn't exist in `docs/specs/`.

**Fix**: Create it or remove the reference.
*Source: Amp #19*

---

### 21. Veto lifecycle (consistent but worth documenting)

All specs agree: veto goes `RESOLVED → LIVE`. The adjudicator must re-resolve from scratch. This is consistent but the re-resolution path isn't documented.

`CODE: N/A` — code has `settle()` not `resolve()`, so the veto→re-resolve flow doesn't apply to current code.

**Fix**: No contradiction. Add a note about the re-resolution path in the planned lifecycle.
*Source: Amp #16*

---

### 22. `settlePosition()` after dismiss may be blocked

If dismiss doesn't set TruthMarket to SETTLED (see finding #3), then `settlePosition()` may fail if it checks `isSettled()`.

`CODE: settlePosition` on AMMEngine does not gate on `isSettled()`. In code this is not an issue — but if specs add a settlement gate, it would break the dismiss→redeem flow.

**Fix**: Blocked by finding #3 (dismiss state decision).
*Source: Claude #16*

---

## Summary

| Priority | Count | Status |
|---|---|---|
| **D** — Design decisions | 3 | Protocol designer must choose. Blocks P0 fixes. |
| **P0** — Critical contradictions | 7 | Fix after D decisions are made |
| **P1** — Stale references | 9 | Many are "accidentally correct" for current code |
| **P2** — Cleanup | 6 | Easy wins, no dependencies |
| **Total** | **25** | |

### Resolution order

```
1. D1–D3: Design decisions (graduation, deposit, resolution lifecycle)
       ↓ unblocks
2. P0-1: createMarket signature (depends on D1)
   P0-2: Trial cost tracking location
   P0-3: DISMISSED state model (depends on D3)
   P0-4: LP token lock timing
   P0-5: redeemLP settlement gate
   P0-6: settle() signature (depends on D3)
   P0-7: MatchingEngine identity
       ↓ unblocks
3. P1-8 through P1-16: Stale reference sweep
       ↓ then
4. P2-17 through P2-22: Cleanup pass
```

### The root cause

The specs mix **current-state documentation** with **future-state design** in the same documents without labeling which is which. This is why:

- SPEC-INDEX appears "outdated" but actually matches current code in key areas
- Layer 1 appears "authoritative" but describes unbuilt features (FeeRouter, MatchingEngine, RESOLVING/RESOLVED states)
- Reviewers treat contradictions as "which spec is right?" when the answer is often "one describes now, the other describes later"

**Recommended first action**: Add a `[CURRENT]` / `[PLANNED]` label to every section of every spec. This alone would eliminate ~60% of the findings in this review.

---

## Appendix A: Source Attribution

Every finding traces back to its original reviewer(s):

| ID | Finding | Amp | Claude | Codex | OpenCode | Code Check |
|---|---|---|---|---|---|---|
| D1 | Graduation mechanism | #2 | #2 | #1 | N4 | Layer 1 ✓ |
| D2 | Creator deposit refund | — | #1 | #3 | — | Layer 3 ✓ |
| D3 | Resolution lifecycle | #1 | #3 | — | — | Neither |
| P0-1 | createMarket sig | #3 | #7 | #1 | — | Neither |
| P0-2 | Trial cost tracking | #12 | — | — | N1 | TRADING-ENGINE ✓ |
| P0-3 | DISMISSED state | #17 | #6 | — | — | Neither |
| P0-4 | LP token lock | #14 | #5 | — | — | Neither |
| P0-5 | redeemLP gate | #15 | #9 | #2 | — | Layer 3 ✓ |
| P0-6 | settle() signature | #10 | — | — | — | SPEC-INDEX ✓ |
| P0-7 | MatchingEngine | — | — | — | N2 | Neither |
| P1-8 | State machine names | #6 | #4 | #5 | — | SPEC-INDEX ✓ |
| P1-9 | ProtocolConfig refs | #5 | — | #5 | N5 | SPEC-INDEX ✓ |
| P1-10 | Collateralizer refs | #8,#9 | #8 | #4 | N6 | Layer 2 ✓ |
| P1-11 | TRADING-ENGINE Collat | — | — | — | N3 | Current ✓ |
| P1-12 | Post-grad fee text | #7 | #13,#15 | — | — | N/A |
| P1-13 | increaseBBase missing | — | #11 | — | — | Exists ✓ |
| P1-14 | settlePosition location | — | — | — | N7 | AMMEngine ✓ |
| P1-15 | claimRefund location | #13 | — | — | — | LaunchpadEngine ✓ |
| P1-16 | notifyGraduation | — | — | — | — | Does not exist |
| P2-17 | L2 version header | #18 | #12 | #7 | — | N/A |
| P2-18 | File naming | — | #10 | #6 | — | N/A |
| P2-19 | Solc version | #4 | #14 | #8 | — | AGENTS.md ✓ |
| P2-20 | Missing INTEGRATION.md | #19 | — | — | — | N/A |
| P2-21 | Veto lifecycle | #16 | — | — | — | N/A |
| P2-22 | settlePosition + dismiss | — | #16 | — | — | Not gated ✓ |

---

## Appendix B: Architectural Strengths (from Gemini review)

Gemini's review found zero contradictions but identified design qualities worth preserving:

- **CREATE3 via CreateX**: Cross-chain address parity is essential for multi-chain liquidity. Layer 1's deployment spec using deterministic addresses is well-designed.
- **Logit-based initial odds**: Layer 3's mathematically sound approach to seed markets with custom starting probabilities without artificial virtual trades.
- **Tick-based orderbook**: SoothBook's O(1) bitmap discovery across 1000 probability ticks is gas-efficient.
- **Per-adjudicator guardians**: Moving guardians from global ProtocolConfig to AdjudicatorBase (Layer 2) is a modularity win.
- **EIP-712 signed CLOB orders**: Off-chain matching with on-chain payout verification is a critical security property.
- **System invariants**: Layer 1's explicit invariant list ("bBase must always grow") should be enforced programmatically via `forge` invariant tests.

*These observations are valid regardless of the contradictions identified above. The architecture has strong foundations — the specs just need alignment.*
