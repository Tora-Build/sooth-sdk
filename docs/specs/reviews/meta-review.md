# Meta-Review: Analysis of 5 Spec Reviews

> **Scope**: amp-review.md, claude-review.md, codex-review.md, gemini-review.md, opencode-review.md
> **Date**: 2026-03-08
> **Method**: Cross-validated all 5 reviews against the actual V12 Solidity code on `main`

---

## 1. The Critical Context All 5 Reviews Missed

**The specs are forward-looking design documents, not documentation of existing code.**

The code on `main` is a working V11/V12 implementation. The specs describe a *future* architecture that hasn't been built yet. Every review treats the specs as a closed system and asks "which spec is right?" — but the answer is often available by reading the Solidity.

This single blind spot undermines every review's framing. Most "contradictions" are actually **current behavior vs planned behavior**, mixed into the same documents without labels.

---

## 2. Spec Claims vs Code Reality

| Spec Concept | What Specs Say | What Code Actually Does | Which Spec Matches Code? |
|---|---|---|---|
| **Graduation mechanism** | Layer 1: `graduationMultiplier` (operator-set). Layer 3: `graduationBps` (creator-set) | `graduationMultiplier` only. Operator-set, range 1–10, default 1. No `graduationBps` exists. | **Layer 1** |
| **Graduation formula** | Layer 1: `feesAccrued >= bBase × ln(2) × graduationMultiplier`. Layer 3: `threshold = creatorDeposit × graduationBps / 10000` | `graduationThreshold = (state.bBase * LN2_WAD * uint256(graduationMultiplier)) / WAD` (LaunchpadEngine:531) | **Layer 1** |
| **FeeRouter** | Layer 1: dedicated contract for fee calc, distribution, graduation trigger | **Does not exist.** Fee logic is inside LaunchpadEngine (`_distributeFee`). | **Neither** — FeeRouter is a planned extraction |
| **IMatchingEngine** | SPEC-INDEX: unified interface implemented by SoothBook/CLOB. Layer 1: separate contract | **Does not exist.** SoothBook is standalone with its own interface (`ISoothBook`). | **Neither** — planned abstraction |
| **MatchingEngine contract** | Layer 1 §6: "MatchingEngine is a contract" between venues and protocol | **Does not exist.** | **Neither** |
| **`notifyGraduation()`** | Layer 1: callback from FeeRouter to LaunchpadEngine | **Does not exist.** Graduation is automatic inside `_distributeFee()` when fee threshold is met. | **Neither** |
| **Resolution lifecycle** | Layer 1: `accept()` for RESOLVING→RESOLVED. Layer 2: `verifyAttestation()` | TruthMarket has `settle(outcome, tStar)` directly. No `accept()`, no `verifyAttestation()`. | **Neither** — both describe future designs |
| **State machine names** | SPEC-INDEX: SETTLING/FINALIZED (old). Layer 1: RESOLVING/RESOLVED/SETTLED (new) | Code uses `SETTLING → SETTLED → FINALIZED`. Enum: `{LIVE, SETTLING, SETTLED, FINALIZED}` | **SPEC-INDEX** (the "old" names are the current code) |
| **DISMISSED state** | Layer 1: separate `DISMISSED` enum on TruthMarket. Layer 3: dismiss → SETTLED | No `DISMISSED` on TruthMarket. Dismiss sets `trial.isDismissed = true` on LaunchpadEngine. TruthMarket state unchanged. | **Neither** — dismiss is a LaunchpadEngine-level flag, not a TruthMarket state |
| **Collateralizer** | Specs say removed (Layer 1 §1). Layer 2 still references it. | **Still exists.** `Collateralizer.sol` is active with split/merge/redeem. | **Layer 2 / SPEC-INDEX** (the "stale" references are actually current) |
| **ProtocolConfig** | Specs say removed (Layer 1 §1). SPEC-INDEX still references it. | **Still exists.** `ProtocolConfig.sol` is active with guardian + pause. | **SPEC-INDEX** (the "stale" reference is actually current) |
| **`redeemLP` settlement gate** | Layer 1: requires `isSettled()`. Layer 3: no settlement requirement | Code has **no settlement gate** — only checks LP balance. | **Layer 3** |
| **Creator deposit refund** | Layer 1: refunded at graduation. Layer 3: LP tokens are the only claim | **Not refunded.** Deposit stays as part of floor value: `totalCash = creatorDeposit + feesAccrued + lpYieldPool` | **Layer 3** |
| **`createMarket` signature** | Layer 1: 5 params. Layer 3: 7 params | **8 params**: question, startTime, deadline, adjudicator, guardian, initialLiquidity, adjudicatorAgentId, adjudicatorMinValidators | **Neither** — both specs are wrong |
| **`increaseBBase()`** | Layer 3: exists. Layer 1: not listed | **Exists in code** at LaunchpadEngine:624. Creator-only, nonReentrant. | **Layer 3** |
| **Trial cost tracking** | Layer 1: moved to AMMEngine. TRADING-ENGINE: in LaunchpadEngine | `userLockedCost` and `totalLockedCost` are on **LaunchpadEngine** (lines 79, 86) | **TRADING-ENGINE** |
| **Solc version** | SPEC-INDEX: 0.8.33, via_ir=false. AGENTS.md: 0.8.30, via_ir=true | AGENTS.md reflects the current build config | **AGENTS.md** |

### Summary: which spec is closest to code?

| Spec File | Claims matching code | Claims not matching code | Accuracy |
|---|---|---|---|
| **SPEC-INDEX** | State names, Collateralizer, ProtocolConfig references | FeeRouter, IMatchingEngine, settle signature | ~60% current |
| **LAYER1-CORE-PROTOCOL** | Graduation formula (multiplier) | FeeRouter, accept(), RESOLVING/RESOLVED states, redeemLP gate, deposit refund, createMarket sig | ~30% current |
| **LAYER2_ADJUDICATOR_SPEC** | Collateralizer references (accidentally correct) | verifyAttestation(), RESOLVING/RESOLVED states | ~40% current |
| **LAYER3-CREATOR** | redeemLP behavior, deposit economics, increaseBBase | graduationBps, createMarket sig | ~50% current |
| **TRADING-ENGINE** | Trial cost tracking location | Collateralizer ref, MatchingEngine as contract | ~50% current |

**The irony**: SPEC-INDEX, which every reviewer flagged as the most outdated, is actually the closest to current code in several areas. The "stale" references to ProtocolConfig, Collateralizer, and old state names are the **current reality**.

---

## 3. Review-by-Review Assessment

### Amp — Grade: A-

**19 findings. 4 critical, 7 stale refs, 8 ambiguities.**

| Strength | Detail |
|---|---|
| Most thorough | Highest finding count with precise section/line references |
| Only reviewer to check file existence | Caught missing `INTEGRATION.md` — nobody else did |
| Unique findings | `claimRefund` location ambiguity, SPEC-INDEX Role Permission Matrix errors |
| Clear structure | 🔴/🟠/🟡 priority system is immediately actionable |

| Weakness | Detail |
|---|---|
| No code validation | Treats all spec contradictions as open questions when code answers most |
| Some "stale" findings are wrong | Flagging SPEC-INDEX's ProtocolConfig and state names as stale — but those match current code |

**Most valuable finding**: #1 (resolution lifecycle mismatch) — correctly identifies a fundamental disagreement, though the code answers it differently than either spec.

---

### Claude — Grade: A-

**16 findings. 3 P0, 6 P1, 7 P2.**

| Strength | Detail |
|---|---|
| Best structure | P0/P1/P2 with "Decision needed" / "Fix" actions for every finding |
| Best analysis depth | LP lock comparison table (finding #5) shows exactly what each spec says |
| Only unique finding | `increaseBBase()` gap — correct, and confirmed by code |
| Design-level thinking | Frames P0 items as design decisions, not just text conflicts |

| Weakness | Detail |
|---|---|
| No code validation | Same blind spot as Amp |
| P0 #1 (deposit refund) framing | Presents as open question; code already decided (no refund) |

**Most valuable finding**: #5 (LP token lock table) — the table format makes the contradiction undeniable and easy to resolve.

---

### Codex — Grade: B

**8 findings. 5 High, 3 Medium.**

| Strength | Detail |
|---|---|
| Concise | Every finding is valid. No false positives. |
| Correct recommendation | "Pick one canonical source (Layer 1), align others" is the right call |

| Weakness | Detail |
|---|---|
| Zero unique findings | All 8 overlap with Amp or Claude |
| Too terse | No line references, no fix suggestions, no tables. Not actionable without cross-referencing other reviews |
| No TRADING-ENGINE coverage | Only reviews 4 of 5 spec files |

**Verdict**: Correct but redundant. If Amp and Claude exist, Codex adds nothing.

---

### Gemini — Grade: F

**0 contradictions found. Concludes "ready for implementation."**

| Strength | Detail |
|---|---|
| Identifies architectural intent | CREATE3 mention, logit-based odds, tick bitmap efficiency — valid observations about design quality |
| Positive framing | Highlights what the specs do well (modularity, guardian per-adjudicator) |

| Weakness | Detail |
|---|---|
| Zero contradictions found | The other 4 reviewers collectively found ~35 issues including 7 critical |
| References non-existent concepts | "Dynamic Fee Router" (specs say `FeeRouter`), "shared Matching Engine" (doesn't exist) |
| Hallucinates confidence | "architecturally robust and ready for implementation" — when 3+ design conflicts block implementation |
| Version confusion | Calls it "V12 specification" but the specs don't self-identify as V12 consistently |
| Didn't read closely | §3 "correction" about `graduationBps` being mislabeled as operator-set — but the real issue is `graduationBps` vs `graduationMultiplier`, which Gemini doesn't catch |

**Verdict**: Actively harmful. Provides false confidence. Should be discarded or rewritten.

---

### OpenCode — Grade: A-

**8 new findings. 4 P0, 4 P1. Plus cross-reviewer synthesis.**

| Strength | Detail |
|---|---|
| Only review to include TRADING-ENGINE.md | Found trial cost tracking contradiction (N1) that nobody else caught |
| Cross-reviewer synthesis table | The 13-row consensus matrix is the single most useful artifact across all reviews |
| Correctly calls out Gemini | Frank assessment with specific evidence |
| New structural findings | MatchingEngine identity crisis (N2), graduation input variable confusion (N4) |

| Weakness | Detail |
|---|---|
| No code validation | Same blind spot as everyone else |
| N4 finding is moot | FeeRouter's `feesAccrued` vs LaunchpadEngine's `creatorDeposit` — but FeeRouter doesn't exist, so there's no conflict in code |
| Built on prior reviews | Had advantage of reading 4 other reviews first; some "new" findings are edge extensions |

**Most valuable contribution**: The cross-reviewer synthesis table. Without it, you'd need to manually cross-reference 4 documents.

---

## 4. What No Review Caught

| Gap | Why it matters |
|---|---|
| **Specs mix current and future without labels** | The root cause of most "contradictions." Layer 1 describes a future architecture; SPEC-INDEX partially reflects current code. No spec says which sections are aspirational vs implemented. |
| **`createMarket` has 8 params in code, not 5 or 7** | Every review flags the 5-vs-7 mismatch but the actual signature matches neither spec. |
| **TruthMarket uses `settle(outcome, tStar)` — neither `accept()` nor `verifyAttestation()`** | Both proposed alternatives don't exist. The current function takes arguments, unlike Layer 1's claim of `settle()` with no args. |
| **`dismissMarket` doesn't change TruthMarket state at all** | All reviews debate whether dismiss goes to DISMISSED or SETTLED. In code, it sets a flag on LaunchpadEngine. TruthMarket remains LIVE. |
| **SPEC-INDEX "old" state names are the current code** | 3 reviewers flag SETTLING/FINALIZED as "old/wrong" — but that's what TruthMarket.sol actually uses. |
| **Collateralizer and ProtocolConfig still exist and are deployed** | Reviews treat their removal as fact and flag remaining references as "stale." The references are correct for the current codebase. |

---

## 5. Ranking

| Rank | Review | Unique Value | Use For |
|---|---|---|---|
| 1 | **Amp** | Most findings, file existence checks, precise references | Primary finding list |
| 2 | **Claude** | Best structure, design-level analysis, LP lock table | Decision framing for protocol designer |
| 3 | **OpenCode** | TRADING-ENGINE coverage, cross-review synthesis table | Consolidated view + TRADING-ENGINE gaps |
| 4 | **Codex** | Concise summary, correct recommendation | Quick overview if you only read one (but read Amp instead) |
| 5 | **Gemini** | None | **Discard.** Provides false confidence. |

---

## 6. Recommendations

### For the specs

1. **Label every section** as `[CURRENT]` or `[PLANNED]` — this eliminates 70% of the "contradictions"
2. **Add a "Code Parity" header** to each spec file: "This spec describes [current implementation / target V12+ architecture / mixed]"
3. **SPEC-INDEX is more current than reviewers think** — don't blindly "update" it to match Layer 1. Some Layer 1 claims are aspirational.
4. **Resolve 3 genuine design decisions** that remain open regardless of current/planned labeling:
   - Graduation parameter: operator-set multiplier (current) vs creator-set BPS (proposed)
   - Creator deposit: floor-value component (current) vs refunded at graduation (proposed)
   - Resolution lifecycle: direct `settle()` (current) vs multi-step `resolve→accept→settle` (proposed)

### For the reviews

5. **Merge Amp + Claude** as the canonical finding set — ~90% complementary, ~10% overlap
6. **Attach this meta-review** as context — the code-reality column changes the priority of most findings
7. **Discard Gemini's review** — or rewrite it as "Architectural Strengths" (the only value it provides)
8. **Future reviews should check code** — a 10-minute `grep` session would have resolved half the findings

---

## Appendix: Finding Overlap Matrix

How the 13 consensus findings distribute across reviewers:

```
Finding                              Amp  Claude  Codex  Gemini  OpenCode
─────────────────────────────────────────────────────────────────────────
createMarket sig mismatch             ✅    ✅      ✅      ·       ·
graduationMultiplier vs Bps           ✅    ✅      ~       ~       ·
Creator deposit refund                ·     ✅      ✅      ·       ·
accept() vs verifyAttestation()       ✅    ✅      ·       ·       ·
SPEC-INDEX old state names            ✅    ✅      ✅      ·       ·
Layer 2 Collateralizer refs           ✅    ✅      ✅      ·       ·
redeemLP settlement gate              ✅    ✅      ✅      ·       ·
DISMISSED vs SETTLED                  ✅    ✅      ·       ·       ·
LP token lock direction               ✅    ✅      ·       ·       ·
SPEC-INDEX ProtocolConfig refs        ✅    ·       ✅      ·       ·
Solc version mismatch                 ✅    ✅      ✅      ·       ·
Layer 2 version header                ✅    ✅      ✅      ·       ·
File naming inconsistency             ·     ✅      ✅      ·       ·
─────────────────────────────────────────────────────────────────────────
Total hits                            11    12      8       0       0
Unique findings                       2     1       0       0       4

✅ = found   ~ = partially noted   · = missed
```

**Amp and Claude together cover 13/13 consensus findings.** Adding Codex provides zero marginal coverage. Adding OpenCode provides 4 new findings from TRADING-ENGINE and cross-review synthesis.
