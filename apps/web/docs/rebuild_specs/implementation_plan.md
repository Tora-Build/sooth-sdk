# Implementation Plan: Sooth dApp Rebuild

**Status:** In Progress (Phase 1)  
**Last Updated:** 2025-11-30  
**Baseline Version:** 1.0

---

## Goal Description

Rebuild the Sooth Protocol dApp from scratch to achieve a premium, production-ready user experience. The new dApp will fix existing UI patches, integrate the latest protocol changes (LMSR-only, Slippage Protection), and provide a unified, role-based interface.

## User Review Required

> [!IMPORTANT]  
> **Protocol Changes**: This rebuild assumes the **LMSR-only** architecture and **Slippage Protection** are deployed.  
> **Tech Stack**: We will use **Vite + React + TypeScript** with **Tailwind CSS** and **Shadcn/UI** for a premium look and feel.

---

## Progress Summary

### ✅ Phase 0: Foundation & UI Polish (COMPLETED)

- [x] Initialize Vite project with Tailwind & Shadcn
- [x] Configure Wagmi/RainbowKit for Base Sepolia
- [x] Port ABIs and Configs (`markets.json`, `deployments.json`)
- [x] **Navbar**: Glass effect with backdrop blur
- [x] **Mode Separation**: Real/Demo toggle with proper filtering
- [x] **Trade Quote Preview**: Real-time LMSR cost calculation
- [x] **Slippage UI**: Adjustable tolerance (0.1%, 0.5%, 1%, 2%)
- [x] **Portfolio Summary**: Wallet & Vault balances, Active Positions display
- [x] **Market Cards**: Implied probability display, adjudicator info

### 🟡 Phase 1: Core Trading Features (IN PROGRESS)

#### ✅ Completed:

- [x] **LP Dashboard**: VaultStats, LiquidityForm components
- [x] **useVault Hook**: Deposit/Withdraw with approval flow
- [x] **Vault Diagnostics**: `maxDeposit` check, asset validation
- [x] **Position Tracking**: Active YES/NO positions in Portfolio

#### 🔴 Blockers Identified:

- **Vault Deposits Blocked**: `SoothVault.maxDeposit()` returns `0`
  - **Impact**: Users cannot deposit liquidity
  - **Status**: Contract-level issue, documented in `docs/issues/VAULT_DEPOSIT_ISSUE.md`
  - **Action Required**: Protocol team needs to initialize vault or set deposit limit

#### 🚧 Next Priority:

- [ ] **Sell Functionality** (CRITICAL - enables trading loop)
  - [ ] Update `useTrade` to support negative `deltaShares`
  - [ ] Add Sell UI to MarketCard (Buy/Sell toggle)
  - [ ] Implement sell slippage protection
  - [ ] Add sell transactions to ActivityLog

---

## Roadmap Baseline

### Phase 2: Settlement & Operations (NOT STARTED)

**Priority 3: Settlement Flow**

- [ ] Review and fix `SettlementAdmin.tsx`
- [ ] Implement settlement claim UI for traders
- [ ] Add ZK proof verification interface
- [ ] Build settlement batch processing UI

**Priority 4: Guardian Functions**

- [ ] Debug `useGuardian` hook for real mode
- [ ] Add guardian controls to Operator Console
- [ ] Implement cooldown trigger UI
- [ ] Add guardian event monitoring

### Phase 3: Polish & Enhancement (NOT STARTED)

**Priority 5: Position Management**

- [ ] Add claim settled positions functionality
- [ ] Show PnL calculations
- [ ] Add position history
- [ ] Implement position export

**Priority 6: UX Improvements**

- [x] ~~Resolve flashing issues~~ ✅ DONE
- [ ] Add comprehensive error handling
- [ ] Improve loading states
- [ ] Add transaction confirmation modals
- [x] Implement toast notifications ✅ DONE

---

## Architecture & Tech Stack

### Directory Structure

```
src/
├── components/
│   ├── ui/              # Shadcn primitives (Button, Card, etc.)
│   ├── layout/          # Navbar, Footer
│   ├── features/        # TraderTerminal, LPDashboard, OperatorConsole
│   │   ├── trader/      # MarketCard, TradeForm
│   │   ├── liquidity/   # VaultStats, LiquidityForm
│   │   └── operator/    # AdjudicatorConsole, GuardianControls
│   └── shared/          # ConnectButton, StatusBadge
├── hooks/               # useMarket, useTrade, useVault, useTradeQuote
├── config/              # ABIs, deployments.json, markets.json
├── store/               # useMarketStore (Zustand)
├── pages/               # DApp, About
└── App.tsx              # Routing & Layout
```

### Smart Contract Integration (Hooks)

- [x] **`useMarket`**: LMSR pricing with `SoothLMSRReal`
- [x] **`useTrade`**: Buy with `maxCost` slippage protection
- [ ] **`useTrade`**: Sell with `minCost` slippage protection (TODO)
- [x] **`useVault`**: Deposit/Withdraw with ERC4626 standard
- [x] **`useTradeQuote`**: Real-time cost/impact calculation
- [ ] **`useSettlement`**: Adjudication and claiming logic (TODO)
- [ ] **`useGuardian`**: Emergency controls (TODO)

---

## Verification Plan

### Automated Tests

- `npm run test` (Unit tests for utils/hooks) - **TODO**

### Manual Verification Checklist

#### Trading

- [x] Buy YES shares with 0.5% slippage
- [x] Verify transaction success and balance update
- [x] Check Portfolio shows active positions
- [ ] Sell YES shares (TODO - blocked by missing sell feature)
- [ ] Verify slippage protection rejects high-impact trades

#### Liquidity Provision

- [x] Connect wallet in Real Mode
- [x] Check Vault stats (TVL, Share Price, APY)
- [ ] Deposit USDC (BLOCKED - `maxDeposit = 0`)
- [ ] Withdraw LP tokens (BLOCKED - no deposits possible)
- [x] Verify Demo Mode works (simulated deposits/withdrawals)

#### Settlement

- [ ] As Adjudicator: Resolve market
- [ ] As Prover: Upload root
- [ ] As Trader: Claim winnings from settled positions

---

## Known Issues

### Critical

1. **Vault Deposits Blocked** (`maxDeposit = 0`)
   - **File**: `docs/issues/VAULT_DEPOSIT_ISSUE.md`
   - **Owner**: Protocol Team
   - **ETA**: TBD

### High Priority

2. **No Sell Functionality**
   - **Impact**: Users cannot exit positions
   - **Owner**: Frontend Team
   - **ETA**: Next sprint

### Medium Priority

3. **Settlement Flow Not Implemented**
   - **Impact**: Cannot resolve markets or claim winnings
   - **Owner**: Frontend Team
   - **ETA**: Phase 2

---

## Success Metrics

- [x] Users can buy shares in Real Mode ✅
- [ ] Users can sell shares in Real Mode (TODO)
- [ ] LPs can deposit/withdraw (BLOCKED by contract)
- [ ] Adjudicators can resolve markets (TODO)
- [ ] Traders can claim settled positions (TODO)
- [x] UI is premium and responsive ✅
- [x] Mode separation works correctly ✅
- [x] Slippage protection prevents bad trades ✅

---

**Next Action**: Implement Sell Functionality (Priority 1, Phase 1)
