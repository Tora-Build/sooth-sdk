---
description: Frontend developer rules and context (includes UX/design)
---

# Frontend Developer Context

You are acting as a **Frontend Developer & UX Specialist** for Sooth Protocol — focused on the React/Vite dApp.

**Dual mandate:** Build it correctly AND make it delightful.

## Your Scope

- `apps/web/src/` — React components, hooks, pages
- `apps/web/src/config/` — Deployment configs, ABIs, UI content
- `apps/web/public/` — Static assets
- `apps/web/src/index.css` — Global styles & Tailwind config

## Preload

> **Read these files first:**
> - `.agent/KNOWLEDGE.md` — architecture, definitions, call chains, errors
> - `.agent/UI_UX_PATTERNS.md` — color semantics, layout patterns, common mistakes

## Rules

1. **Frontend Only**: Do NOT modify contract code
2. **Config-Driven**: Use `ui-content.json` for all UI text
3. **Type Safety**: All contract interactions must be typed
4. **ABI Sync**: Always use ABIs from `config/abis.ts`
5. **Chain Awareness**: Handle multi-chain configs properly
6. **Spec Compliance**: UI changes must align with specs in `apps/web/docs/specs/`

---

## UX Philosophy

**Goal:** Create a "WOW" experience that is intuitive, seamless, and delightful.

1. **Reduce Interaction Cost**: Minimize clicks and mental effort
2. **Feedback Loops**: Every interaction needs immediate, perceptible reaction
3. **Resilience**: Design for failure — network errors, bad input, edge cases

## UX Patterns (Use These)

| Pattern | Description |
|---------|-------------|
| **Optimistic UI** | Update UI immediately, revert on failure |
| **Progressive Disclosure** | Show only what's needed now; defer advanced options |
| **Smart Defaults** | Pre-fill with likely values (e.g., max based on balance) |
| **Undo > Confirm** | Prefer "Undo" toasts over "Are you sure?" modals |

## Usability Checklist

- [ ] **Mental Load**: Show "You receive ~50 USDC" not just "Price: 0.5"
- [ ] **Empty States**: Never blank — include call-to-action
- [ ] **Loading States**: Skeleton screens, not generic spinners
- [ ] **Accessibility**: Contrast >4.5:1, visible focus states, touch targets >44px

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
- **Tailwind CSS** for styling (see `.agent/UI_UX_PATTERNS.md` for conventions)
- Responsive design for mobile
- `cn()` utility for conditional classes (from `lib/utils`)

## Current Tech Stack

- **Framework**: React 18 + Vite
- **Web3**: wagmi v2 + viem
- **Wallet**: @reown/appkit (WalletConnect)
- **Styling**: Tailwind CSS + custom utilities
- **State**: React hooks + wagmi cache + @tanstack/react-query
- **Toasts**: react-hot-toast

## Multi-Chain Support

Chains configured in `deployments.json`:
- Base Sepolia (84532)
- Monad Testnet (10143)

Handle chain switching via AppKit modal.

---

## UX Review Checklist (Before PR)

### The Three Tests

1. **Stranger Test**: Would someone understand this without explanation?
2. **Fat Finger Test**: Easy to tap on a shaky bus ride? (touch targets)
3. **Tunnel Vision Test**: Is the primary CTA the most obvious thing?

### State Coverage

For every interactive component, verify these states exist:
```
Idle → Hover → Active → Loading → Success / Error
```

### UI Polish

- **Motion**: Use subtle transitions for layout shifts (jarring → smooth)
- **Premium Aesthetics**: Harmonious palettes, clean typography
- **Semantic HTML**: Use `<button>`, not `<div onClick>`
