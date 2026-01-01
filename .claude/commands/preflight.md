---
description: Session startup checklist - read context and check for stale state
---
# Preflight Workflow

Run this at the **start of any development session** to load context and catch issues early.

## 1. Read Lessons Learned
Review `.agent/LESSONS_LEARNED.md` for critical rules and past mistakes:
```bash
cat .agent/LESSONS_LEARNED.md
```

## 2. Check Project Status
Read the current status to understand what's in progress:
```bash
cat STATUS.md
```

## 3. Review Recent Decisions
Check if there are any architectural decisions that affect current work:
```bash
cat DECISIONS.md | head -100
```

## 4. Verify Deployment Config (If Doing Contract Work)
Run the verification script to ensure frontend config matches on-chain state:
```bash
cd packages/contracts-evm
./script/verify-deployment.sh
```

If this fails, **STOP** and fix the config before proceeding.

## 5. Check for Uncommitted Changes
Ensure the workspace is clean:
```bash
git status
```

## 6. Report Context Summary
After reading the above, provide a brief summary to the user:
- Current project status
- Any warnings or blockers
- Ready to proceed or not

---

**When to use this workflow:**
- Start of a new conversation
- Resuming after a long break
- Before any deployment task
- When user mentions I seem to have forgotten something
