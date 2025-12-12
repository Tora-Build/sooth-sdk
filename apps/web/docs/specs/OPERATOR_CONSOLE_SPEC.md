# Operator Console UI Specification

> Reference document for Operator Console terminology, labels, and calculations.
> Aligned with `.agent/KNOWLEDGE.md` as the canonical source of truth.

---

## 1. Component Structure

```
OperatorConsole (page)
├── AdjudicatorConsole
│   └── MarketRow (per market)
├── GuardianConsole
│   └── GuardianRow (per market)
└── SettlementSimulator
    └── Market rows with PnL simulations
```

---

## 2. AdjudicatorConsole

### Header

| Element | Translation Key | Text |
|---------|----------------|------|
| **Title** | `operator.title` | "Adjudicator Console" |
| **Description** | `operator.description` | - |

### Table Columns

| Column | Translation Key |
|--------|----------------|
| **Markets** | `stats.markets` |
| **Market Status** | `trading.marketStatus` |
| **Resolve** | `operator.resolve` |

### MarketRow

| Element | Condition | Display |
|---------|-----------|---------|
| **Question** | Always | `market.question` |
| **ID** | Always | `ID: {market.id}` |
| **Status Badge** | Always | trading / settled / cooldown |
| **YES Button** | `status === 'settling'` | Calls `adjudicate('YES')` |
| **NO Button** | `status === 'settling'` | Calls `adjudicate('NO')` |
| **PnL Root Input** | `status === 'clearing'` | Text input for proof |
| **Upload Button** | `status === 'clearing'` | Calls `uploadPnL(pnlRoot)` |
| **Winner Display** | `status === 'settled'` | "Winner: YES/NO" |
| **No Actions** | Otherwise | "No actions available" |

---

## 3. GuardianConsole

### Header

| Element | Translation Key | Text |
|---------|----------------|------|
| **Title** | `operator.guardian` | "Guardian Console" |
| **Description** | `operator.description` | - |

### Table Columns

| Column | Translation Key |
|--------|----------------|
| **Markets** | `stats.markets` |
| **Market Status** | `trading.marketStatus` |
| **Actions** | `operator.emergencyPause` |

### GuardianRow

| Element | Condition | Action |
|---------|-----------|--------|
| **Resume Button** | `status === 'paused'` | Calls `unpauseMarket()` |
| **Emergency Pause** | `status !== 'paused'` | Calls `pauseMarket()` |
| **Settle (YES)** | Always | Calls `forceSettle('YES')` |
| **Settle (NO)** | Always | Calls `forceSettle('NO')` |

---

## 4. SettlementSimulator

### Header

| Element | Translation Key | Text |
|---------|----------------|------|
| **Title** | `simulator.title` | "Settlement Simulator" |
| **Description** | `simulator.description` | - |

### Table Columns

| Column | Translation Key | Data |
|--------|----------------|------|
| **Markets** | `stats.markets` | Market name |
| **Current YES** | `simulator.currentYes` | `priceYes * 100`% |
| **Market Reserves** | `trading.marketReserves` | `b * 0.1` (approx) |
| **Shares YES** | `simulator.sharesYes` | User YES shares |
| **Shares NO** | `simulator.sharesNo` | User NO shares |
| **Payout (YES wins)** | `simulator.payoutYes` | `userSharesYes` |
| **LP PnL (YES wins)** | `simulator.pnlYes` | `reserve - payoutYes` |
| **Payout (NO wins)** | `simulator.payoutNo` | `userSharesNo` |
| **LP PnL (NO wins)** | `simulator.pnlNo` | `reserve - payoutNo` |

### Calculations

```typescript
// Demo mode: from local state
const priceYes = Math.exp(qYes/b) / (Math.exp(qYes/b) + Math.exp(qNo/b));

// Real mode: from contract
const priceYes = market.price(0); // 18 decimals

// LP PnL calculation
const lpPnL = marketReserve - payout;
```

---

## 5. Data Sources

| Data | Hook | Contract Function |
|------|------|-------------------|
| Market List | `useMarketStore` | - |
| Market Status | `useReadContracts` | `isLive()`, `isSettled()` |
| Settlement | `useSettlement` | `adjudicate()`, `uploadPnL()` |
| Guardian | `useGuardian` | `pauseMarket()`, `unpauseMarket()`, `forceSettle()` |
| Prices | `useReadContracts` | `price(0)`, `price(1)` |
| Liquidity | `useReadContracts` | `b()` |

---

## 6. Files

| File | Purpose |
|------|---------|
| `OperatorConsole.tsx` | Main container component |
| `operator/AdjudicatorConsole.tsx` | Market settlement UI |
| `operator/GuardianConsole.tsx` | Emergency controls UI |
| `operator/SettlementSimulator.tsx` | PnL simulation table |

---

## 7. Translation Keys

| Key | English Text |
|-----|--------------|
| `operator.title` | "Adjudicator Console" |
| `operator.guardian` | "Guardian Console" |
| `operator.description` | Description text |
| `operator.resolve` | "Resolve" |
| `operator.upload` | "Upload" |
| `operator.winner` | "Winner" |
| `operator.noActions` | "No actions available" |
| `operator.resume` | "Resume" |
| `operator.emergencyPause` | "Emergency Pause" |
| `operator.settleMarket` | "Settle Market" |
| `simulator.title` | "Settlement Simulator" |
| `simulator.description` | Description text |
| `simulator.currentYes` | "Current YES" |
| `simulator.sharesYes` | "Shares YES" |
| `simulator.sharesNo` | "Shares NO" |
| `simulator.payoutYes` | "Payout (YES)" |
| `simulator.payoutNo` | "Payout (NO)" |
| `simulator.pnlYes` | "LP PnL (YES)" |
| `simulator.pnlNo` | "LP PnL (NO)" |

---

*Last updated: 2025-12-12*
