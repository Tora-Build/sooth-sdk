# Spec Reviews

Cross-spec consistency reviews of the Sooth Protocol V12 specifications. All reviews dated 2026-03-08.

## Start Here

**[canonical-review.md](canonical-review.md)** — The merged, code-validated review. Read this one. It combines findings from all individual reviews, deduplicates them, and annotates each with what the actual Solidity code does.

## Individual Reviews

| File | Reviewer | Findings | Grade | Notes |
|---|---|---|---|---|
| [amp-review.md](amp-review.md) | Amp | 19 | A- | Most thorough. Best line references. |
| [claude-review.md](claude-review.md) | Claude Opus 4.6 | 16 | A- | Best structure. Design-level analysis. |
| [codex-review.md](codex-review.md) | Codex | 8 | B | Correct but redundant with Amp+Claude. |
| [gemini-review.md](gemini-review.md) | Gemini CLI | 0 | F | Found zero contradictions. Architectural strengths extracted into canonical Appendix B. |
| [opencode-review.md](opencode-review.md) | OpenCode | 8 new | A- | Only review covering TRADING-ENGINE.md. Cross-reviewer synthesis. |

## Meta-Analysis

| File | Purpose |
|---|---|
| [meta-review.md](meta-review.md) | Review of the 5 reviews. Validates all findings against actual V12 Solidity code. |
| [canonical-review.md](canonical-review.md) | Final merged output: 3 design decisions, 7 P0, 9 P1, 6 P2 findings with code-reality annotations. |

## Key Insight

The specs mix current-state documentation with future-state design without labels. Most "contradictions" are actually one spec describing what the code does now vs another describing what it should do next. The canonical review annotates every finding with `CODE:` showing which spec matches reality.
