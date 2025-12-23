# V8 Frontend Specifications

**Version**: 1.1.0  
**Last Updated**: 2025-12-23  
**Status**: Ready for Implementation

---

## Overview

This directory contains comprehensive specifications for the V8 frontend implementation with **LaunchpadEngine** creator economics. Each spec is designed to be a complete reference for developers implementing that feature.

---

## 📚 Specification Index

### 🏗️ **Architecture**

**[V8_FRONTEND_ARCHITECTURE.md](./V8_FRONTEND_ARCHITECTURE.md)**
- Page routing structure
- Shared components
- State management (Zustand + Wagmi)
- Contract integration patterns (LaunchpadEngine + AMMEngine + TickBook)
- Styling architecture
- Testing strategy
- Deployment process

**Read this first** to understand the overall system design.

---

### 📊 **Trading Terminals**

#### **[V8_AMM_TRADING_SPEC.md](./V8_AMM_TRADING_SPEC.md)**

**Target Users**: Casual traders, mobile users, price takers

**Key Features**:
- Instant execution (LMSR pricing via LaunchpadEngine)
- Creator-funded liquidity
- Dynamic fees (5% pre-graduation, 1% post-graduation)
- 24-hour sell lock
- Non-transferable positions
- Real-time quotes with fee breakdown

**Components**:
- `AMMStatsCard` - Liquidity, graduation status, dynamic fees
- `AMMTradingPanel` - Buy/sell interface
- `AMMPositionCard` - User position display
- `AMMSettlementCard` - Post-settlement claims

**Hooks**:
- `useAMMMarket` - Market state + graduation status
- `useAMMPosition` - User position
- `useAMMQuote` - Trade quotes with dynamic fees

---

#### **[V8_ORDERBOOK_TRADING_SPEC.md](./V8_ORDERBOOK_TRADING_SPEC.md)**

**Target Users**: Professional traders, liquidity providers, large trades

**Key Features**:
- Precise price control (limit orders)
- 10,000-tick orderbook
- Transferable ERC20 tokens
- No sell locks
- LP fee earning (0.2%)
- Multi-tick swap execution

**Components**:
- `OrderbookLadder` - Tick ladder display
- `DepthChart` - Liquidity visualization
- `LimitOrderForm` - Limit order placement
- `MarketOrderForm` - Instant execution
- `LiquidityPanel` - LP provision
- `OrderbookPositionsCard` - Orders, tokens, LP positions

**Hooks**:
- `useOrderbook` - Orderbook state
- `useOrderbookQuote` - Swap quotes
- `useUserLiquidity` - LP positions

---

### ⚙️ **Operator Console**

#### **[V8_OPERATOR_CONSOLE_SPEC.md](./V8_OPERATOR_CONSOLE_SPEC.md)**

**Target Users**: Market creators, adjudicators, guardians

**Key Features**:
- Market initialization with creator deposit
- Real-time LP position tracking
- Fee earnings dashboard
- Graduation progress monitoring
- Settlement controls (adjudicator)
- Emergency veto (guardian)
- Post-settlement withdrawal

**Components**:
- `MarketInitializationPanel` - Liquidity tier selection, deposit
- `CreatorDashboard` - LP position, fees, graduation progress
- `SettlementPanel` - Adjudicator controls
- `GuardianPanel` - Veto and finalize
- `WithdrawalPanel` - LP redemption

**Hooks**:
- `useLaunchpadMarket` - Initialization status, graduation
- `useCreatorPosition` - LP tokens, value, PnL
- `useGovernanceParams` - Fee rates, graduation threshold

---

## 🎯 Design Principles

### 1. **Domain Separation**

AMM, Orderbook, and Operator Console are **completely separate** experiences:

| Aspect | AMM | Orderbook | Operator |
|--------|-----|-----------|----------|
| **Page** | `/markets/:id/amm` | `/markets/:id/orderbook` | `/markets/:id/operator` |
| **Users** | Casual, mobile | Professional | Creator, adjudicator |
| **Execution** | Instant | Limit orders | Management |
| **Tokens** | Non-transferable | ERC20 | LP tokens |
| **Complexity** | Simple | Advanced | Admin |

**Why?** Different user profiles require different UIs. Mixing them creates confusion.

### 2. **LaunchpadEngine Integration**

All AMM trading goes through **LaunchpadEngine**, not directly to AMMEngine:

```typescript
// ✅ Correct
await launchpadEngine.tradePositions(market, deltaShares, maxCost);

// ❌ Wrong (bypasses creator economics)
await ammEngine.tradePositions(market, deltaShares, maxCost);
```

**Why?** LaunchpadEngine handles:
- Creator deposit tracking
- LP token minting
- Fee collection and distribution
- Graduation mechanics

### 3. **Spec-Driven Development**

**Before coding**:
1. Read the relevant spec
2. Understand data sources and formulas
3. Note component structure

**While coding**:
1. Follow spec exactly (labels, formulas, flows)
2. If you deviate, document why

**After coding**:
1. Verify against spec
2. Update spec if needed
3. Add "Last updated" note

### 4. **Type Safety**

All contract interactions must be typed:

```typescript
// ✅ Good
const { data } = useReadContract({
  address: launchpadEngineAddress,
  abi: ABIS.LaunchpadEngine,
  functionName: 'getBBase',
  args: [marketAddress],
});

// ❌ Bad
const data = await provider.call({...}); // Untyped
```

---

## 📋 Implementation Workflow

### Phase 1: Foundation (Week 1)
- [ ] Set up V8 routing structure
- [ ] Create shared components (MarketHeader, etc.)
- [ ] Implement contract hooks (useLaunchpadMarket, useAMMMarket, useOrderbook)
- [ ] Set up state management
- [ ] Configure ABIs and deployments

### Phase 2: AMM Terminal (Week 2)
- [ ] Implement AMMStatsCard (with graduation badge)
- [ ] Implement AMMTradingPanel (with dynamic fees)
- [ ] Implement AMMPositionCard
- [ ] Implement settlement flow
- [ ] Test full AMM user journey

### Phase 3: Operator Console (Week 3)
- [ ] Implement MarketInitializationPanel
- [ ] Implement CreatorDashboard (LP position, fees, graduation)
- [ ] Implement SettlementPanel (adjudicator)
- [ ] Implement GuardianPanel (veto/finalize)
- [ ] Implement WithdrawalPanel
- [ ] Test full operator journey

### Phase 4: Orderbook Terminal (Week 4-5)
- [ ] Implement OrderbookLadder
- [ ] Implement DepthChart
- [ ] Implement LimitOrderForm
- [ ] Implement MarketOrderForm
- [ ] Implement LiquidityPanel
- [ ] Implement OrderbookPositionsCard
- [ ] Test full Orderbook user journey

### Phase 5: Integration (Week 6)
- [ ] Portfolio page (cross-market positions)
- [ ] Market list page
- [ ] Mobile responsive design
- [ ] Error handling and edge cases
- [ ] Performance optimization

### Phase 6: Polish (Week 7)
- [ ] E2E testing
- [ ] Accessibility audit
- [ ] Documentation
- [ ] Deployment

**Total**: ~7 weeks for complete V8 frontend

---

## 🔑 Key Contracts

### LaunchpadEngine (Creator Economics)
- `initializeMarket(market, b)` - Creator deposits USDC
- `tradePositions(market, deltaShares, maxCost)` - Trading with fees
- `getBBase(market)` - Get liquidity parameter
- `getCurrentFee(market)` - Get current fee rate (BPS)
- `isGraduated(market)` - Check graduation status
- `balanceOf(user, market)` - Get LP tokens
- `redeemLP(market, amount)` - Withdraw LP position

### AMMEngine (Pure Trading Logic)
- `getMarketState(market)` - Get qYes, qNo, price
- `getPosition(market, user)` - Get user position
- `claimUnlocked(market)` - Claim unlocked proceeds

### TickBook (Orderbook)
- `swap(marketKey, isBuy, amount, limitTick)` - Market order
- `addLiquidity(marketKey, tick, amount)` - Limit order / LP
- `removeLiquidity(marketKey, tick, amount)` - Cancel order / withdraw LP

### TruthMarket (Lifecycle)
- `isLive()` - Check if trading active
- `isSettled()` - Check if settled
- `settle(outcome, tStar)` - Adjudicator settlement
- `veto()` - Guardian veto
- `finalize()` - Make settlement permanent

---

## 📁 File Structure

```
apps/web/docs/specs/
├── README.md                          # This file
├── V8_FRONTEND_ARCHITECTURE.md        # Master architecture
├── V8_AMM_TRADING_SPEC.md            # AMM terminal spec
├── V8_ORDERBOOK_TRADING_SPEC.md      # Orderbook terminal spec
├── V8_OPERATOR_CONSOLE_SPEC.md       # Operator console spec
└── archive/                           # Old V7 specs
    ├── ACTIVITY_LOG_SPEC.md
    ├── LAUNCHPAD_SPEC.md
    ├── LP_DASHBOARD_SPEC.md
    ├── OPERATOR_CONSOLE_SPEC.md
    └── TRADING_TERMINAL_SPEC.md
```

---

## 🚀 Quick Start

1. **Read Architecture**: Start with `V8_FRONTEND_ARCHITECTURE.md`
2. **Choose Feature**: Pick AMM, Orderbook, or Operator Console
3. **Read Spec**: Study the relevant spec thoroughly
4. **Implement**: Follow spec exactly
5. **Test**: Verify against spec
6. **Update**: Document any deviations

---

## ⚠️ Important Notes

### LaunchpadEngine vs AMMEngine
- **Always use LaunchpadEngine** for trading (includes creator economics)
- **Only use AMMEngine** for read-only state queries (qYes, qNo, price)

### Dynamic Fees
- **Pre-Graduation**: 5% (default, governance-controlled)
- **Post-Graduation**: 1% (default, governance-controlled)
- **Always fetch current fee** via `LaunchpadEngine.getCurrentFee(market)`

### Access Control
- **Operator Console**: Only show to creator/adjudicator/guardian
- **Use role detection**: Check `connectedAddress == market.creator` etc.

---

## 📞 Questions?

**Architecture**: See `V8_FRONTEND_ARCHITECTURE.md`  
**AMM Trading**: See `V8_AMM_TRADING_SPEC.md`  
**Orderbook Trading**: See `V8_ORDERBOOK_TRADING_SPEC.md`  
**Operator Console**: See `V8_OPERATOR_CONSOLE_SPEC.md`

**Still stuck?** Check `.agent/KNOWLEDGE.md` or ask in Discord.

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2025-12-23 | Added LaunchpadEngine integration, Operator Console |
| 1.0.0 | 2025-12-23 | Initial V8 specs created |

---

**Ready to build V8 with creator economics!** 🚀


### 🏗️ Architecture

**[V8_FRONTEND_ARCHITECTURE.md](./V8_FRONTEND_ARCHITECTURE.md)**
- Page routing structure
- Shared components
- State management (Zustand + Wagmi)
- Contract integration patterns
- Styling architecture
- Testing strategy
- Deployment process

**Read this first** to understand the overall system design.

---

### 📊 Trading Terminals

#### **[V8_AMM_TRADING_SPEC.md](./V8_AMM_TRADING_SPEC.md)**

**Target Users**: Casual traders, mobile users, price takers

**Key Features**:
- Instant execution (LMSR pricing)
- Simple buy/sell interface
- 24-hour sell lock
- Non-transferable positions
- Real-time quotes

**Components**:
- `AMMStatsCard` - Liquidity and market stats
- `AMMTradingPanel` - Buy/sell interface
- `AMMPositionCard` - User position display
- `AMMSettlementCard` - Post-settlement claims

**Hooks**:
- `useAMMMarket` - Market state
- `useAMMPosition` - User position
- `useAMMQuote` - Trade quotes

---

#### **[V8_ORDERBOOK_TRADING_SPEC.md](./V8_ORDERBOOK_TRADING_SPEC.md)**

**Target Users**: Professional traders, liquidity providers, large trades

**Key Features**:
- Precise price control (limit orders)
- 10,000-tick orderbook
- Transferable ERC20 tokens
- No sell locks
- LP fee earning (0.2%)

**Components**:
- `OrderbookLadder` - Tick ladder display
- `DepthChart` - Liquidity visualization
- `LimitOrderForm` - Limit order placement
- `MarketOrderForm` - Instant execution
- `LiquidityPanel` - LP provision
- `OrderbookPositionsCard` - Orders, tokens, LP positions

**Hooks**:
- `useOrderbook` - Orderbook state
- `useOrderbookQuote` - Swap quotes
- `useUserLiquidity` - LP positions

---

## Design Principles

### 1. **Domain Separation**

AMM and Orderbook are **completely separate** trading experiences:

| Aspect | AMM | Orderbook |
|--------|-----|-----------|
| **Page** | `/markets/:id/amm` | `/markets/:id/orderbook` |
| **Users** | Casual, mobile | Professional, desktop |
| **Execution** | Instant | Limit orders |
| **Tokens** | Non-transferable | ERC20 (transferable) |
| **Locks** | 24h sell lock | No locks |
| **Complexity** | Simple | Advanced |

**Why?** Different user profiles require different UIs. Mixing them creates confusion.

### 2. **Spec-Driven Development**

**Before coding**:
1. Read the relevant spec
2. Understand data sources and formulas
3. Note component structure

**While coding**:
1. Follow spec exactly (labels, formulas, flows)
2. If you deviate, document why

**After coding**:
1. Verify against spec
2. Update spec if needed
3. Add "Last updated" note

### 3. **Type Safety**

All contract interactions must be typed:

```typescript
// ✅ Good
const { data } = useReadContract({
  address: marketAddress,
  abi: ABIS.AMMEngine,
  functionName: 'getLiquidity',
  args: [marketAddress],
});

// ❌ Bad
const data = await provider.call({...}); // Untyped
```

### 4. **Chain Awareness**

Always pass `chainId` explicitly:

```typescript
// ✅ Good
const { selectedChainId } = useAppStore();
useReadContract({
  chainId: selectedChainId,
  // ...
});

// ❌ Bad
useReadContract({
  // chainId missing - uses wallet's chain
});
```

---

## Implementation Workflow

### Phase 1: Foundation (Week 1)
- [ ] Set up V8 routing structure
- [ ] Create shared components (MarketHeader, etc.)
- [ ] Implement contract hooks (useAMMMarket, useOrderbook)
- [ ] Set up state management
- [ ] Configure ABIs and deployments

### Phase 2: AMM Terminal (Week 2)
- [ ] Implement AMMStatsCard
- [ ] Implement AMMTradingPanel (Buy/Sell tabs)
- [ ] Implement AMMPositionCard
- [ ] Implement settlement flow
- [ ] Test full AMM user journey

### Phase 3: Orderbook Terminal (Week 3-4)
- [ ] Implement OrderbookLadder
- [ ] Implement DepthChart
- [ ] Implement LimitOrderForm
- [ ] Implement MarketOrderForm
- [ ] Implement LiquidityPanel
- [ ] Implement OrderbookPositionsCard
- [ ] Test full Orderbook user journey

### Phase 4: Integration (Week 5)
- [ ] Portfolio page (cross-market positions)
- [ ] Market list page
- [ ] Mobile responsive design
- [ ] Error handling and edge cases
- [ ] Performance optimization

### Phase 5: Polish (Week 6)
- [ ] E2E testing
- [ ] Accessibility audit
- [ ] Documentation
- [ ] Deployment

---

## Quick Reference

### Contract Addresses

See `apps/web/src/config/deployments.json`

### ABIs

See `apps/web/src/config/abis.ts`

### Design System

See `apps/web/src/styles/design-system.css`

### Component Library

See `apps/web/src/components/`

---

## Questions?

**Architecture**: See `V8_FRONTEND_ARCHITECTURE.md`  
**AMM Trading**: See `V8_AMM_TRADING_SPEC.md`  
**Orderbook Trading**: See `V8_ORDERBOOK_TRADING_SPEC.md`

**Still stuck?** Check `.agent/KNOWLEDGE.md` or ask in Discord.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-23 | Initial V8 specs created |

---

**Ready to build V8!** 🚀
