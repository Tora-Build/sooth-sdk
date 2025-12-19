# Frontend UI Specifications

> Canonical reference documents for UI components, terminology, labels, and calculations.
> All specs align with `.agent/KNOWLEDGE.md` as the source of truth.

---

## Available Specs

| Spec | Description | Last Updated |
|------|-------------|--------------|
| [LAUNCHPAD_SPEC.md](./LAUNCHPAD_SPEC.md) | **V6.1.8** Launchpad markets, LP economics, direct swap, floor equity | 2025-12-20 |
| [MARKETS_PAGE_SPEC.md](./MARKETS_PAGE_SPEC.md) | Markets list, MarketCard, trending leaderboard | 2025-12-20 |
| [TRADING_TERMINAL_SPEC.md](./TRADING_TERMINAL_SPEC.md) | Trading cards, orderbook, V6.1.8 quote display | 2025-12-20 |
| [LP_DASHBOARD_SPEC.md](./LP_DASHBOARD_SPEC.md) | Governor Vault LP Dashboard (legacy markets) | 2025-12-12 |
| [OPERATOR_CONSOLE_SPEC.md](./OPERATOR_CONSOLE_SPEC.md) | Adjudicator, Guardian, Settlement Simulator | 2025-12-12 |
| [ACTIVITY_LOG_SPEC.md](./ACTIVITY_LOG_SPEC.md) | Activity tracking and filtering | 2025-12-12 |

---

## Purpose

These specifications serve as:
1. **Developer Reference** — Quick lookup for labels, formulas, and data sources
2. **Design Consistency** — Ensure UI text matches canonical terminology
3. **Debugging Aid** — Trace displayed values back to contract calls
4. **Onboarding** — Help new developers understand component structure

---

## Structure

Each spec follows this format:

1. **Component Structure** — Visual hierarchy
2. **Element Tables** — Labels, variables, formulas
3. **Calculation Reference** — Key math with code snippets
4. **Data Sources** — Contract functions and hooks
5. **Files** — Relevant source files
6. **Translation Keys** — i18n key mappings

---

## Related Files

- `.agent/KNOWLEDGE.md` — Canonical protocol knowledge base
- `apps/web/src/config/ui-content.json` — Translation strings
- `apps/web/src/hooks/` — Data fetching hooks

---

*Specs folder created: 2025-12-12*
*Last updated: 2025-12-20 (V6.1.8 Safe Parity Minting)*
