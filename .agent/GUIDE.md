# Agent Roles & Rules Guide

Quick reference for when to use which workflow or rule.

---

## 🔧 Rule Types

| Type | Location | Scope |
|------|----------|-------|
| **Global Rules** | IDE Settings | All projects, all sessions |
| **Workspace Rules** | `.agent/workflows/*.md` | This project only, on invoke |

---

## 🎭 Workflow Quick Reference

| Workflow | When to Use |
|----------|-------------|
| `/preflight` | Session start, resuming after break, when agent seems forgetful |
| `/coordinator` | After major changes, end of session, status sync |
| `/deploy` | Before/during contract deployment |
| `/deploy-sync` | After `forge script --broadcast` |
| `/evm-dev` | Solidity development |
| `/frontend-dev` | React/TypeScript work |
| `/fullstack-dev` | Mixed contract + frontend work |
| `/auditor` | Code review, bug hunting |
| `/researcher` | Documentation, design exploration |
| `/designer` | UI/UX design |

---

## 📋 Decision Matrix

| Situation | Action |
|-----------|--------|
| Starting new chat | `/preflight` |
| Agent made a mistake | Add to `LESSONS_LEARNED.md` |
| Deploying contracts | `/deploy` → `/deploy-sync` |
| Updating project status | `/coordinator` |
| Writing Solidity | `/evm-dev` |
| Writing React | `/frontend-dev` |
| End of work session | `/coordinator` |
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
| `.agent/GUIDE.md` | This file |
| `STATUS.md` | Current project state |
| `CHANGELOG.md` | Change history |
| `DECISIONS.md` | Architecture decisions |

---

## 💡 Tips

- **Global rules** = automatic, always enforced
- **Workflows** = manual, invoke with `/name`
- Add mistakes to `LESSONS_LEARNED.md` immediately
- Invoke `/coordinator` before long breaks
- Bump `deployments.json` version after changes
