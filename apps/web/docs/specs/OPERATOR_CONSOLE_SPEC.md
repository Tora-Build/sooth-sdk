# Operator Console UI Specification

> Reference document for Operator Console terminology, labels, and calculations.
> Aligned with `.agent/KNOWLEDGE.md` as the canonical source of truth.
> **V7 integration note**: Operator actions are split across **Adjudicators** (Truth) and **Guardians** (lifecycle safety).

---

## 1. Component Structure

```
OperatorConsole (page)
├── AdjudicatorConsole
│   └── MarketRow (per market)
├── GuardianConsole
│   └── GuardianRow (per market)
├── SettlementRootsConsole (optional)
│   └── RootRow (per market/batch)
└── SettlementSimulator (optional)
    └── Market rows with high-level settlement state
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
| **Adjudicator** | `operator.adjudicator` |
| **Actions** | `operator.resolve` |

### MarketRow

| Element | Condition | Display |
|---------|-----------|---------|
| **Question** | Always | `market.question` |
| **ID** | Always | `ID: {market.id}` |
| **Status Badge** | Always | trading / settled / expired |
| **Adjudicator Address** | Always | `market.adjudicator` (link to explorer) |
| **Adjudicator Class** | Always | Read `IAdjudicator.adjudicatorClass()` when possible (Manual / Optimistic / Brevis / Unknown) |
| **Manual: Resolve** | `class === 'manual' && !isSettled` | Outcome selector + `tStar` input → calls `SoothManualAdjudicator.resolve(market, outcome, tStar)` (owner-only) |
| **Optimistic: Propose** | `class === 'optimistic' && !isSettled` | Outcome + `tStar` → calls `SoothOptimisticAdjudicator.propose(market, outcome, tStar)` with bond |
| **Optimistic: Dispute** | `class === 'optimistic' && hasActiveProposal` | Calls `SoothOptimisticAdjudicator.dispute(market)` (owner-only) |
| **Optimistic: Finalize** | `class === 'optimistic' && windowElapsed && !isSettled` | Calls `SoothOptimisticAdjudicator.finalize(market)` |
| **Brevis** | `class === 'brevis'` | Read-only: settlement is gateway-driven (`brevisGateway`) |
| **Winner Display** | `isSettled` | "Winner: YES/NO • T*: {tStar}" |

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
| **Force Graduate** | `!isGraduated && isLive` | Calls `LaunchpadMarket.forceGraduate()` (guardian-only) |
| **Liquidate** | `!isGraduated && !isLive` | Calls `LaunchpadMarket.liquidate()` (guardian-only; routes fee to `factory.treasury()`) |

---

## 4. SettlementSimulator (Optional)

### Header

| Element | Translation Key | Text |
|---------|----------------|------|
| **Title** | `simulator.title` | "Settlement Simulator" |
| **Description** | `simulator.description` | - |

### Table Columns

| Column | Translation Key | Data |
|--------|----------------|------|
| **Markets** | `stats.markets` | Market name |
| **Current YES** | `simulator.currentYes` | `price(0) * 100%` (WAD) |
| **Adjudicator** | `operator.adjudicator` | `market.adjudicator()` |
| **T*** | `operator.tStar` | `market.tStar()` |
| **Floor (WAD)** | `simulator.floor` | `market.totalNetAssets()` |

### Calculations

```typescript
// Real mode: from contract (WAD)
const priceYesWad = market.price(0);
const floorWad = market.totalNetAssets();
```

---

## 5. Data Sources

| Data | Hook | Contract Function |
|------|------|-------------------|
| Market List | `useMarketStore` | - |
| Market Status | `useReadContracts` | `isLive()`, `isSettled()`, `winningOutcome()`, `tStar()`, `adjudicator()` |
| Settlement (Manual/Optimistic) | `useWriteContract` | `SoothManualAdjudicator.resolve(...)` / `SoothOptimisticAdjudicator.propose/dispute/finalize(...)` |
| Guardian | `useWriteContract` | `LaunchpadMarket.forceGraduate()` / `LaunchpadMarket.liquidate()` |
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

*Last updated: 2025-12-22 (V7 adjudicators + guardian lifecycle actions)*
