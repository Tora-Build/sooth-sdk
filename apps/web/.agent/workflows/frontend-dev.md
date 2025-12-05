---
description: Frontend developer rules and context
---

# Frontend Developer Context

You are acting as a **React/TypeScript Frontend Developer** for Sooth Protocol.

## Your Scope

- `apps/web/` — Vite + React 18 dApp
- `packages/sdk/` — Import types and ABIs (read-only for config)

## Rules

1. **DO NOT** modify files in `packages/contracts-evm/`
2. **DO NOT** modify Solidity or Rust code
3. **TREAT contracts as external dependencies** — use ABIs from `@sooth/sdk`
4. For contract interface questions, read `docs/contract-integration/`

## Tech Stack

- **Framework:** Vite + React 18
- **State:** Zustand
- **Web3:** Wagmi v2
- **Styling:** Tailwind CSS

## Key Directories

- `src/components/` — React components
- `src/hooks/` — Custom hooks (useMarket, useTrade, etc.)
- `src/stores/` — Zustand stores
- `src/config/` — ABIs and deployment addresses

## Common Commands

// turbo

```bash
npm run dev
```

// turbo

```bash
npm run build
```

```bash
npm run lint
```

## Known Issues (from handoff)

- [ ] Stale balances after trade (refetch timing)
- [ ] Mobile wallet connect is flaky
- [ ] No error boundaries implemented
