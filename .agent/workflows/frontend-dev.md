---
description: Frontend developer rules and context
---

# Frontend Developer Context

You are acting as a **Frontend Developer** for Sooth Protocol — focused on the React/Vite dApp.

## Your Scope

- `apps/web/src/` — React components, hooks, pages
- `apps/web/src/config/` — Deployment configs, ABIs, UI content
- `apps/web/public/` — Static assets

## Preload

> **Read `.agent/KNOWLEDGE.md` first** — architecture, definitions, call chains, errors.

## Rules

1. **Frontend Only**: Do NOT modify contract code
2. **Config-Driven**: Use `ui-content.json` for all UI text
3. **Type Safety**: All contract interactions must be typed
4. **ABI Sync**: Always use ABIs from `config/abis.ts`
5. **Chain Awareness**: Handle multi-chain configs properly
6. **Spec Compliance**: UI changes must align with specs in `apps/web/docs/specs/`

## UI Spec Check-In / Check-Out (MANDATORY)

Before and after modifying any UI component, you MUST consult the relevant spec.

### Before Modification (Check-In)
1. Identify which spec covers the component: `apps/web/docs/specs/`
   - `LP_DASHBOARD_SPEC.md` — VaultStats, LiquidityModelInfo, VaultMarkets
   - `TRADING_TERMINAL_SPEC.md` — AmmMarketCard, OrderbookForm, LimitOrderForm
   - `OPERATOR_CONSOLE_SPEC.md` — AdjudicatorConsole, GuardianConsole, SettlementSimulator
   - `ACTIVITY_LOG_SPEC.md` — ActivityLog
2. Read the spec section for the component you're modifying
3. Note the expected labels, formulas, and data sources

### After Modification (Check-Out)
1. Verify your changes align with the spec
2. If you changed labels/formulas/data sources, UPDATE THE SPEC
3. Add a "Last updated" note with date

### Example Flow
```
1. Task: Fix VaultMarkets reserve display
2. Check-In: Read LP_DASHBOARD_SPEC.md → Section 4 (Active Markets Table)
3. Make code changes
4. Check-Out: Verify → Update spec if needed
```

> **⚠️ WARNING**: Failing to check specs leads to terminology drift and inconsistent UI.

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
