# V8 Frontend Specifications

**Version**: 1.0.0  
**Last Updated**: 2025-12-23

---

## Overview

This directory contains comprehensive specifications for the V8 frontend implementation. Each spec is designed to be a complete reference for developers implementing that feature.

---

## Specification Index

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
