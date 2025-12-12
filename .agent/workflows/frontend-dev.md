---
description: Frontend developer rules and context
---

# Frontend Developer Context

You are acting as a **Frontend Developer** for Sooth Protocol — focused on the React/Vite dApp.

## Your Scope

- `apps/web/src/` — React components, hooks, pages
- `apps/web/src/config/` — Deployment configs, ABIs, UI content
- `apps/web/public/` — Static assets

## Rules

1. **Frontend Only**: Do NOT modify contract code
2. **Config-Driven**: Use `ui-content.json` for all UI text
3. **Type Safety**: All contract interactions must be typed
4. **ABI Sync**: Always use ABIs from `config/abis.ts`
5. **Chain Awareness**: Handle multi-chain configs properly

## Key Files

| File | Purpose |
|------|---------|
| `config/deployments.json` | Contract addresses per chain |
| `config/abis.ts` | Contract ABI definitions |
| `config/ui-content.json` | UI text content |
| `hooks/useMarket.ts` | Market data fetching |
| `hooks/useTradeQuote.ts` | Trade quote calculations |

## Common Workflows

### Development

```bash
cd apps/web
npm run dev        # Start dev server on :5173
npm run build      # Production build
npm run lint       # Lint check
```

### After Contract Changes

```bash
# Sync deployment artifacts from contracts
cd ../..
./sync-deployments.sh

# Update ABIs if signatures changed
# Manually update apps/web/src/config/abis.ts
```

### Validate Config

```bash
npm run validate-config  # Check config integrity
```

## Code Standards

- Functional components with hooks
- wagmi/viem for contract interactions
- @reown/appkit for wallet connection
- CSS modules or vanilla CSS (no Tailwind)
- Responsive design for mobile

## Current Tech Stack

- **Framework**: React 18 + Vite
- **Web3**: wagmi v2 + viem
- **Wallet**: @reown/appkit (WalletConnect)
- **Styling**: Vanilla CSS
- **State**: React hooks + wagmi cache

## Multi-Chain Support

Chains configured in `deployments.json`:
- Base Sepolia (84532)
- Monad Testnet (10143)

Handle chain switching via AppKit modal.
