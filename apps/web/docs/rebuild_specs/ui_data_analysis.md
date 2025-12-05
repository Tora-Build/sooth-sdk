# UI Data Analysis & Extraction

This document analyzes the existing dApp's data display and user interactions, categorizing them by actor stories and providing recommendations for the rebuild.

## 1. The Trader (Alice)

**Current View**: `TraderTerminal.tsx`

### Existing Data & Features

| Data Point            | Description                            | Recommendation | Notes                                                               |
| :-------------------- | :------------------------------------- | :------------- | :------------------------------------------------------------------ |
| **Market Selector**   | Dropdown to switch markets.            | **Keep**       | Essential. Consider a better "Market List" page for discovery.      |
| **Market Metadata**   | Name, Question, Adjudicator Label.     | **Keep**       | Core context.                                                       |
| **Status Badge**      | Trading, Cooldown, Settled, etc.       | **Keep**       | Critical for knowing if trading is allowed.                         |
| **Prices**            | YES/NO prices (e.g., 0.55 USDC).       | **Keep**       | The most important data.                                            |
| **Implied Prob**      | Probability derived from price.        | **Keep**       | Good secondary metric for intuition.                                |
| **Risk Params**       | `b`, `k`, Risk Class.                  | **Hide**       | Move to "Advanced Details" or tooltip. Too technical for main view. |
| **User Position**     | YES/NO shares, Notional Value.         | **Keep**       | Users need to see what they own.                                    |
| **Trade Interface**   | Amount Input, Buy/Sell Buttons.        | **Keep**       | Core functionality.                                                 |
| **Slippage Settings** | Input for max slippage % (e.g., 0.5%). | **Add**        | **New Requirement**: Protocol now enforces `maxCost`.               |
| **Claim Interface**   | _Currently in SettlementAdmin_         | **Move Here**  | Traders claim their own winnings. This belongs in the Trader view.  |

### Missing / To Add

- **Price Chart**: Visual history of price movements.
- **Trade History**: List of user's past trades.
- **Portfolio View**: Aggregate view of positions across _all_ markets.

---

## 2. The Liquidity Provider (Bob)

**Current View**: `LPDashboard.tsx`

### Existing Data & Features

| Data Point         | Description                         | Recommendation | Notes                             |
| :----------------- | :---------------------------------- | :------------- | :-------------------------------- |
| **Pool Selector**  | Dropdown to switch pools.           | **Keep**       |                                   |
| **Pool Metadata**  | Token, Adjudicator Type.            | **Keep**       |                                   |
| **User Balance**   | LP Tokens held by user.             | **Keep**       |                                   |
| **TVL**            | Total Value Locked in pool.         | **Keep**       | Standard DeFi metric.             |
| **Utilization**    | Locked Exposure / TVL.              | **Keep**       | Good health metric.               |
| **APY**            | Indicative Annual Percentage Yield. | **Keep**       | The main incentive for LPs.       |
| **Active Markets** | List of markets using this pool.    | **Keep**       | Shows where the money is at risk. |
| **Actions**        | Deposit / Withdraw.                 | **Keep**       | Core functionality.               |

### Missing / To Add

- **Historical APY**: Chart showing yield over time.
- **My Earnings**: Estimated profit since deposit.

---

## 3. The Adjudicator (Carol) & Guardian (Dave)

**Current Views**: `AdjudicatorConsole.tsx`, `SettlementAdmin.tsx`

### Existing Data & Features

| Data Point          | Description                   | Recommendation | Notes                 |
| :------------------ | :---------------------------- | :------------- | :-------------------- |
| **Market Status**   | Current lifecycle state.      | **Keep**       |                       |
| **Settlement Info** | Winning Outcome, Truth Time.  | **Keep**       |                       |
| **Admin Actions**   | Begin Cooldown, Clear Market. | **Keep**       | Guardian functions.   |
| **Adjudication**    | Finalize Outcome (YES/NO).    | **Keep**       | Adjudicator function. |
| **PnL Upload**      | Upload Merkle Root.           | **Keep**       | Prover function.      |

### Rebuild Strategy

- **Consolidate**: These views are currently fragmented. Create a unified **"Admin Dashboard"** or **"Operator Console"**.
- **Role-Based Access**: Use tabs or sections to separate "Guardian Actions" (Pause/Clear) from "Adjudicator Actions" (Resolve) and "Prover Actions" (Upload).
- **Remove User Claims**: As noted above, the "Claim Settlement" input in `SettlementAdmin` should be moved to the Trader's view. Admins don't claim for users; users claim for themselves.

## 4. Summary of Changes

1.  **Move Claims**: Shift the claiming UI from the Admin view to the Trader Terminal (or a new "Portfolio" page).
2.  **Simplify Trader UI**: Hide technical risk parameters (`b`, `k`) by default.
3.  **Unified Admin**: Combine Guardian and Adjudicator tools into a single, role-gated interface.
4.  **Visuals**: Upgrade from the current "card" style to a more premium, cohesive design system (as per "Rebuild" goal).
