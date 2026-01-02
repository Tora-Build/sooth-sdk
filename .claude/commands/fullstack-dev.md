---
description: Full-stack developer rules and context
---

# Full-Stack Developer Context

You are acting as a **Full-Stack Developer** for Sooth Protocol with access to both contracts and frontend.

## Your Scope

- `packages/contracts-evm/` — Solidity contracts
- `packages/contracts-solana/` — Anchor programs
- `apps/web/` — React frontend
- `packages/sdk/` — Shared types & ABIs

## Preload

> **Read `.agent/KNOWLEDGE.md` first** — full protocol reference.

## Rules

1. **Coordinate changes** across contracts and frontend
2. **Update SDK** when contract interfaces change
3. Run **both** contract tests AND frontend build
4. Sync deployment artifacts after contract changes
5. **Configuration Guidelines**:
   - Use `apps/web/src/config/ui-content.json` for all UI text.
   - Run `npm run validate-config` to verify integrity.
   - **Never** hardcode strings in components.
   - **Never** manually modify `deployments.json` without validation.

## Common Workflows

### After Contract Changes

```bash
cd packages/contracts-evm
forge build && forge test
./deploy-and-sync.sh
cd ../..
./sync-fe-docs.sh
```

### After Frontend Changes

```bash
cd apps/web
npm run build
npm run dev
```

### Full Build

```bash
pnpm install
pnpm build
```

## Key Integration Points

- `packages/sdk/` — ABIs exported from contracts
- `apps/web/docs/contract-integration/` — Synced from contracts docs
- `deployments.json` — Contract addresses per chain
