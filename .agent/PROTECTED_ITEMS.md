# User-Protected Items Registry

> **RULE FOR ALL AGENTS**: Items listed here require **user confirmation before modifying**. 
> You MAY propose changes — just **ASK FIRST** before applying them.

## Purpose

This registry tracks files, configurations, and settings where the user wants to review proposed changes before they're applied. Agents should:

1. ✅ **Propose changes** when relevant (don't avoid or ignore)
2. ✅ **Explain the rationale** for the proposed change
3. ✅ **Wait for confirmation** before modifying
4. ❌ **Never auto-apply** changes to protected items

---

## Protected Files

### RPC Endpoints (Private Infrastructure)

| File | Protected Section | Reason |
|------|------------------|--------|
| `apps/web/src/lib/chains.ts` | QuickNode RPC URLs | User's private node infrastructure |
| `packages/contracts-evm/script/chainConfigs.ts` | Private RPC endpoints | User's private node infrastructure |

**Specifically protected URLs:**
```
https://blue-stylish-friday.monad-testnet.quiknode.pro/e8b690b8d333c538f85bab9c93a2a3b512a4cb9a/
```

---

## How Agents Should Handle Protected Items

### When a change conflicts with a protected item:

```
AGENT: I recommend changing [PROTECTED_ITEM] because [REASON].

Proposed change:
- Before: [current value]
- After: [proposed value]

This is a protected item. Shall I proceed?
```

### Do NOT:
- Silently skip changes that would improve the codebase
- Ignore conflicts without mentioning them
- Auto-apply changes without confirmation

---

## Adding New Protected Items

Tell the agent:
```
Add [file/config/URL] to the protected items registry
```

---

## Change Log

| Date | Item | Action |
|------|------|--------|
| 2025-12-30 | QuickNode Monad RPC | Added - confirm before modifying |

---

*Last updated: 2025-12-30*
