# Agent Roles & Rules Guide

Quick reference for when to use which workflow or rule.

---

## 🔧 Rule Types

| Type | Location | Scope |
|------|----------|-------|
| **Global Rules** | IDE Settings | All projects, all sessions |
| **Workspace Rules** | `.claude/commands/*.md` (source) | This project only, on invoke |
| **Symlinks** | `.agent/workflows/`, `.cursor/commands/` | Point to `.claude/commands/` |

---

## 🎭 Workflow Quick Reference

| Workflow | When to Use |
|----------|-------------|
| `/preflight` | Session start, resuming after break, when agent seems forgetful |
| `/coordinator` | After major changes, end of session, status sync |
| `/sop` | Adding/editing workflows, recording lessons, proposing rules |
| `/deploy` | Before/during contract deployment (V8 legacy - update pending) |
| `/deploy-sync` | After `forge script --broadcast` |
| `/dev` | Start frontend dev server |
| `/evm-dev` | Solidity development |
| `/frontend-dev` | React/TypeScript work + UI/UX design |
| `/fullstack-dev` | Mixed contract + frontend work |
| `/auditor` | Code review, bug hunting |
| `/researcher` | Documentation, design exploration |
| `/qa` | Test strategy, coverage, quality assurance |
| `/librarian` | Repo maintenance, dead code removal, documentation, and version bumping |
| `/visualize` | Generate mermaid diagrams for code visualization |

---

## 📋 Decision Matrix

| Situation | Action |
|-----------|--------|
| Starting new chat | `/preflight` |
| Agent made a mistake | Add to `LESSONS_LEARNED.md` |
| Deploying contracts | `/deploy` → `/deploy-sync` |
| Updating project status | `/coordinator` |
| Writing Solidity | `/evm-dev` |
| Writing React / UI polish | `/frontend-dev` |
| Start dev server | `/dev` |
| End of work session | `/coordinator` |
| Repo cleanup/Docs/Version bump | `/librarian` |
| Visualize code flow | `/visualize` |
| Agent repeating errors | "Read LESSONS_LEARNED.md" |

---

## 🚦 Typical Session Flow

```
1. /preflight          ← Load context
2. [Your work]         ← Use relevant role workflows
3. /deploy-sync        ← If deployed anything
4. /coordinator        ← Sync status docs
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `.agent/LESSONS_LEARNED.md` | Persistent agent memory |
| `.agent/PROTECTED_ITEMS.md` | **User-owned items - DO NOT MODIFY without confirmation** |
| `.agent/GUIDE.md` | This file |
| `STATUS.md` | Current project state |
| `CHANGELOG.md` | Change history |
| `DECISIONS.md` | Architecture decisions |

---

## 🛠️ Development Standards

- **No UI Masking**: Never patch the UI to hide or "clean up" underlying protocol/math errors (e.g., capping a >100% fill). Masking makes root causes harder to find.
- **Contract Integrity**: Before patching contracts, verify changes don't conflict with recent architectural decisions (e.g., V9.9 sweep matching) or the core design (e.g., Global Pro-Rata distribution).
- **Proactive Root Cause Analysis**: If you see an anomaly (like a >100% fill), find the leak in the engine before applying "band-aid" caps in code.
- **File Naming & Versioning**:
   - **Canonical Names Only**: Use `Market.sol`, `App.tsx`, `deployments.json`.
   - **NO Version Numbers**: `MarketV10.tsx` or `ContractV2.sol` is **STRICTLY FORBIDDEN**.
   - **Single Active Source**: Archive old files (`/archive/`) or rely on Git. Never keep parallel `V1` and `V2` files active.

---

## 💡 Tips

- **Global rules** = automatic, always enforced
- **Workflows** = manual, invoke with `/name`
- Add mistakes to `LESSONS_LEARNED.md` immediately
- Invoke `/coordinator` before long breaks
- Bump `deployments.json` version after changes
