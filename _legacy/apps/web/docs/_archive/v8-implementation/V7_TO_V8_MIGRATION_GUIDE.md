# V7 to V8 Frontend Migration Guide

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Purpose**: Maximize reuse of V7 frontend code for V8 implementation

---

## Executive Summary

The V7 frontend has **significant reusable value** (~70-80% can be preserved). This guide identifies what to keep, what to adapt, and what to rebuild for V8.

### Migration Strategy

✅ **KEEP** (70%): UI components, utilities, styling, infrastructure  
🔄 **ADAPT** (20%): Hooks, contract integration, page layouts  
🆕 **NEW** (10%): LaunchpadEngine integration, Operator Console

---

## 📊 Reusability Analysis

### High Reusability (90-100%) ✅

#### **1. UI Components** (`/components/ui/`)
**Status**: ✅ **Keep as-is**

All UI components are contract-agnostic and fully reusable:

| Component | Purpose | V8 Usage |
|-----------|---------|----------|
| `Badge.tsx` | Status indicators | Market status, graduation badges |
| `Button.tsx` | Primary actions | All CTAs |
| `Card.tsx` | Container component | All card layouts |
| `ChainSelector.tsx` | Network switching | Global navigation |
| `Dialog.tsx` | Modals | Confirmations, warnings |
| `Drawer.tsx` | Side panels | Mobile navigation |
| `Input.tsx` | Form inputs | All input fields |
| `Tabs.tsx` | Tab navigation | AMM/Orderbook/Operator tabs |

**Action**: ✅ **No changes needed**

---

#### **2. Layout Components** (`/components/layout/`)
**Status**: ✅ **Keep as-is**

| Component | Purpose | V8 Usage |
|-----------|---------|----------|
| `Navbar.tsx` | Top navigation | Global nav with chain selector |
| `Footer.tsx` | Footer | Site footer |

**Action**: ✅ **No changes needed**

---

#### **3. Utilities** (`/lib/`, `/utils/`)
**Status**: ✅ **Keep as-is**

| File | Purpose | V8 Usage |
|------|---------|----------|
| `chains.ts` | Chain configurations | Multi-chain support |
| `ensureChain.ts` | Chain validation | Transaction safety |
| `utils.ts` | Helper functions | Formatting, validation |
| `wagmi.ts` | Wagmi config | Web3 integration |

**Action**: ✅ **No changes needed**

---

#### **4. Configuration** (`/config/`)
**Status**: 🔄 **Update contract addresses only**

| File | Purpose | V8 Changes |
|------|---------|------------|
| `deployments.json` | Contract addresses | Update to V8 addresses |
| `ui-content.json` | UI text content | Update terminology |
| `abis.ts` | Contract ABIs | Add V8 ABIs |

**Action**: 🔄 **Update addresses and ABIs, keep structure**

---

### Medium Reusability (50-80%) 🔄

#### **5. Feature Components** (`/components/features/`)

##### **Launchpad Components** (80% reusable)

| Component | V7 Purpose | V8 Adaptation |
|-----------|------------|---------------|
| `MarketHeader.tsx` | Market title, status, creator | ✅ **Reuse** - Perfect for V8 |
| `GraduationProgress.tsx` | Bonding progress bar | ✅ **Reuse** - Matches LaunchpadEngine |
| `GuardianActions.tsx` | Guardian controls | ✅ **Reuse** - Same in V8 |
| `LPRedemption.tsx` | LP withdrawal | 🔄 **Adapt** - Update for LaunchpadEngine |
| `LiquidationRefund.tsx` | Failed market refund | 🔄 **Adapt** - Update for V8 TruthMarket |

**Action**: 🔄 **Minor updates to contract calls**

---

##### **Market Components** (60% reusable)

| Component | V7 Purpose | V8 Adaptation |
|-----------|------------|---------------|
| `MarketCard.tsx` | Market list item | 🔄 **Adapt** - Add graduation badge |
| `AmmTradingPanel.tsx` | AMM trading UI | 🔄 **Adapt** - Update for LaunchpadEngine |
| `LPLeaderboardCard.tsx` | LP rankings | ✅ **Reuse** - Same concept |
| `TrendingLeaderboard.tsx` | Top traders | ✅ **Reuse** - Same concept |

**Action**: 🔄 **Update contract integration, keep UI**

---

##### **Operator Components** (70% reusable)

| Component | V7 Purpose | V8 Adaptation |
|-----------|------------|---------------|
| `AdjudicatorConsole.tsx` | Settlement controls | 🔄 **Adapt** - Update for TruthMarket |
| `GuardianConsole.tsx` | Veto controls | 🔄 **Adapt** - Update for TruthMarket |

**Action**: 🔄 **Update contract calls, keep UI structure**

---

##### **Portfolio Components** (90% reusable)

| Component | V7 Purpose | V8 Adaptation |
|-----------|------------|---------------|
| `PortfolioCard.tsx` | Position display | ✅ **Reuse** - Generic wrapper |
| `TradingAccountCard.tsx` | Vault balance | 🔄 **Adapt** - Remove vault (V8 uses direct USDC) |
| `VaultPositionsCard.tsx` | AMM positions | 🔄 **Adapt** - Update for AMMEngine |
| `ActiveOrdersCard.tsx` | Limit orders | ✅ **Reuse** - TickBook same as V7 OB |
| `LPPositionsCard.tsx` | LP stakes | 🔄 **Adapt** - Update for LaunchpadEngine |
| `WalletSummaryCard.tsx` | Token balances | ✅ **Reuse** - ERC20 same |
| `PositionActionsModal.tsx` | Split/merge modal | ✅ **Reuse** - Collateralizer same |

**Action**: 🔄 **Minor contract updates, keep UI**

---

##### **Trader Components** (50% reusable)

| Component | V7 Purpose | V8 Adaptation |
|-----------|------------|---------------|
| `Orderbook.tsx` | Orderbook display | 🔄 **Adapt** - Update for TickBook |
| `OrderbookForm.tsx` | Limit order form | 🔄 **Adapt** - Update for TickBook |
| `LimitOrderForm.tsx` | Order entry | 🔄 **Adapt** - Update for TickBook |
| `MarketFilters.tsx` | Market search/filter | ✅ **Reuse** - Generic |
| `LaunchpadLockedProceeds.tsx` | Locked funds display | ✅ **Reuse** - Same in V8 |
| `PendingUnlocks.tsx` | Unlock countdown | ✅ **Reuse** - Same in V8 |

**Action**: 🔄 **Update contract integration**

---

##### **Activity Components** (100% reusable)

| Component | V7 Purpose | V8 Adaptation |
|-----------|------------|---------------|
| `ActivityLog.tsx` | Transaction history | ✅ **Reuse** - Event-based |
| `ActivityListener.tsx` | Real-time updates | ✅ **Reuse** - Event-based |

**Action**: ✅ **No changes needed**

---

### Low Reusability (0-30%) 🆕

#### **6. Hooks** (`/hooks/`)

Most hooks need updates for V8 contracts, but **structure is reusable**:

| Hook | V7 Purpose | V8 Status |
|------|------------|-----------|
| `useAmmMarket.ts` | AMM state | 🔄 **Adapt** - Add LaunchpadEngine calls |
| `useAmmMarketByAddress.ts` | AMM lookup | 🔄 **Adapt** - Add LaunchpadEngine |
| `useOrderbook.ts` | Orderbook state | 🔄 **Adapt** - Update for TickBook |
| `useOrderbookTrade.ts` | OB trading | 🔄 **Adapt** - Update for TickBook |
| `useTraderVault.ts` | Vault operations | 🆕 **Remove** - No vault in V8 |
| `useLPPositions.ts` | LP stakes | 🔄 **Adapt** - Update for LaunchpadEngine |
| `useLockedFunds.ts` | Locked proceeds | 🔄 **Adapt** - Update for AMMEngine |
| `useActivePositions.ts` | Position tracking | 🔄 **Adapt** - Update contracts |
| `useDeployments.ts` | Contract addresses | ✅ **Reuse** - Same pattern |
| `useContent.ts` | UI content | ✅ **Reuse** - Same pattern |

**New Hooks Needed**:
- `useLaunchpadMarket.ts` - LaunchpadEngine state
- `useCreatorPosition.ts` - LP position tracking
- `useGovernanceParams.ts` - Fee rates, graduation threshold
- `useTruthMarket.ts` - Lifecycle state

**Action**: 🔄 **Reuse hook structure, update contract calls**

---

#### **7. Pages** (`/pages/`)

| Page | V7 Purpose | V8 Status |
|------|------------|-----------|
| `Landing.tsx` | Home page | ✅ **Reuse** - Generic |
| `Markets.tsx` | Market list | ✅ **Reuse** - Generic |
| `MarketDetail.tsx` | Market page | 🔄 **Split** - Create AMM/OB/Operator tabs |
| `Portfolio.tsx` | User positions | 🔄 **Adapt** - Update for V8 contracts |
| `CreateMarket.tsx` | Market creation | 🔄 **Adapt** - Update for V8 flow |
| `OperatorConsole.tsx` | Admin panel | 🔄 **Expand** - Add creator dashboard |
| `About.tsx` | About page | ✅ **Reuse** - Generic |
| `Faucet.tsx` | Testnet faucet | ✅ **Reuse** - Generic |

**Action**: 🔄 **Restructure MarketDetail, adapt others**

---

## 🎯 Migration Roadmap

### Phase 1: Foundation (Week 1)

#### ✅ **Keep As-Is**
1. Copy entire `/components/ui/` → No changes
2. Copy entire `/components/layout/` → No changes
3. Copy entire `/lib/` → No changes
4. Copy entire `/utils/` → No changes
5. Copy `/config/ui-content.json` → Minor text updates

#### 🔄 **Update**
1. Update `/config/deployments.json` with V8 addresses
2. Update `/config/abis.ts` with V8 ABIs
3. Update `/lib/wagmi.ts` if needed

---

### Phase 2: Hooks Migration (Week 2)

#### Strategy: **Copy → Adapt → Test**

For each hook:
1. **Copy** V7 hook structure
2. **Adapt** contract calls to V8
3. **Test** with V8 contracts

**Priority Order**:
1. `useDeployments.ts` ✅ (no changes)
2. `useTruthMarket.ts` 🆕 (new)
3. `useLaunchpadMarket.ts` 🆕 (new, based on V7 `useLaunchpadMarket`)
4. `useAmmMarket.ts` 🔄 (adapt)
5. `useOrderbook.ts` 🔄 (adapt)
6. `useLPPositions.ts` 🔄 (adapt)
7. `useCreatorPosition.ts` 🆕 (new)

**Reuse Pattern**:
```typescript
// V7 Hook Structure (KEEP)
export function useAmmMarket(marketAddress: string) {
  const { selectedChainId } = useAppStore();
  
  const { data, isLoading, error } = useReadContracts({
    contracts: [/* ... */],
    chainId: selectedChainId,
  });
  
  return { /* transformed data */ };
}

// V8 Adaptation (UPDATE contract calls only)
export function useAmmMarket(marketAddress: string) {
  const { selectedChainId } = useAppStore();
  
  const { data, isLoading, error } = useReadContracts({
    contracts: [
      // ✅ Keep structure
      // 🔄 Update addresses and function names
      {
        address: launchpadEngineAddress, // Changed
        abi: ABIS.LaunchpadEngine,        // Changed
        functionName: 'getBBase',          // Changed
        args: [marketAddress],
        chainId: selectedChainId,
      },
    ],
  });
  
  return { /* same structure */ };
}
```

---

### Phase 3: Component Migration (Weeks 3-4)

#### **Launchpad Components** (Week 3)
✅ **Copy directly**:
- `MarketHeader.tsx`
- `GraduationProgress.tsx`
- `GuardianActions.tsx`

🔄 **Adapt contract calls**:
- `LPRedemption.tsx` - Update `redeemLP` call
- `LiquidationRefund.tsx` - Update for TruthMarket

#### **Market Components** (Week 3)
🔄 **Adapt**:
- `MarketCard.tsx` - Add graduation badge
- `AmmTradingPanel.tsx` - Update for LaunchpadEngine

✅ **Copy directly**:
- `LPLeaderboardCard.tsx`
- `TrendingLeaderboard.tsx`

#### **Portfolio Components** (Week 4)
✅ **Copy directly**:
- `PortfolioCard.tsx`
- `WalletSummaryCard.tsx`
- `PositionActionsModal.tsx`
- `ActiveOrdersCard.tsx`

🔄 **Adapt**:
- `VaultPositionsCard.tsx` - Update for AMMEngine
- `LPPositionsCard.tsx` - Update for LaunchpadEngine

🆕 **Remove**:
- `TradingAccountCard.tsx` - No vault in V8

#### **Trader Components** (Week 4)
🔄 **Adapt**:
- `Orderbook.tsx` - Update for TickBook
- `OrderbookForm.tsx` - Update for TickBook
- `LimitOrderForm.tsx` - Update for TickBook

✅ **Copy directly**:
- `MarketFilters.tsx`
- `LaunchpadLockedProceeds.tsx`
- `PendingUnlocks.tsx`

#### **Operator Components** (Week 4)
🔄 **Adapt**:
- `AdjudicatorConsole.tsx` - Update for TruthMarket
- `GuardianConsole.tsx` - Update for TruthMarket

🆕 **New**:
- `CreatorDashboard.tsx` - LP position, fees, graduation
- `MarketInitializationPanel.tsx` - Deposit flow

---

### Phase 4: Pages Migration (Week 5)

#### **Simple Pages** (Copy directly)
✅ **No changes**:
- `Landing.tsx`
- `Markets.tsx`
- `About.tsx`
- `Faucet.tsx`

#### **Complex Pages** (Adapt)

**MarketDetail.tsx** → **Split into 3 pages**:
```
V7: /market/:id (single page)
    ↓
V8: /market/:id/amm        (AMM trading)
    /market/:id/orderbook  (Orderbook trading)
    /market/:id/operator   (Creator/adjudicator)
```

**Reuse from V7 MarketDetail.tsx**:
- ✅ `MarketInfoCard` component → Use in all 3 pages
- ✅ `BondingProgressCard` component → Use in Operator page
- ✅ `AddressRow` component → Use in all 3 pages
- ✅ Layout structure → Adapt for tabs

**Portfolio.tsx**:
🔄 **Adapt**:
- Remove vault balance section
- Update position cards for V8 contracts
- Keep overall layout

**CreateMarket.tsx**:
🔄 **Adapt**:
- Update for TruthMarket deployment
- Add LaunchpadEngine initialization
- Keep form structure

**OperatorConsole.tsx**:
🔄 **Expand**:
- Add creator dashboard
- Add initialization panel
- Keep settlement/veto panels

---

## 📋 Detailed Migration Checklist

### Week 1: Foundation
- [ ] Copy `/components/ui/` (no changes)
- [ ] Copy `/components/layout/` (no changes)
- [ ] Copy `/lib/` (no changes)
- [ ] Copy `/utils/` (no changes)
- [ ] Update `/config/deployments.json`
- [ ] Update `/config/abis.ts`
- [ ] Update `/config/ui-content.json`

### Week 2: Hooks
- [ ] Copy `useDeployments.ts` (no changes)
- [ ] Create `useTruthMarket.ts` (new)
- [ ] Create `useLaunchpadMarket.ts` (adapt from V7)
- [ ] Adapt `useAmmMarket.ts`
- [ ] Adapt `useOrderbook.ts`
- [ ] Adapt `useLPPositions.ts`
- [ ] Create `useCreatorPosition.ts` (new)
- [ ] Create `useGovernanceParams.ts` (new)
- [ ] Adapt `useLockedFunds.ts`
- [ ] Adapt `useActivePositions.ts`

### Week 3: Launchpad & Market Components
- [ ] Copy `MarketHeader.tsx` (no changes)
- [ ] Copy `GraduationProgress.tsx` (no changes)
- [ ] Copy `GuardianActions.tsx` (no changes)
- [ ] Adapt `LPRedemption.tsx`
- [ ] Adapt `LiquidationRefund.tsx`
- [ ] Adapt `MarketCard.tsx`
- [ ] Adapt `AmmTradingPanel.tsx`
- [ ] Copy `LPLeaderboardCard.tsx` (no changes)
- [ ] Copy `TrendingLeaderboard.tsx` (no changes)

### Week 4: Portfolio & Trader Components
- [ ] Copy `PortfolioCard.tsx` (no changes)
- [ ] Copy `WalletSummaryCard.tsx` (no changes)
- [ ] Copy `PositionActionsModal.tsx` (no changes)
- [ ] Copy `ActiveOrdersCard.tsx` (no changes)
- [ ] Adapt `VaultPositionsCard.tsx`
- [ ] Adapt `LPPositionsCard.tsx`
- [ ] Adapt `Orderbook.tsx`
- [ ] Adapt `OrderbookForm.tsx`
- [ ] Adapt `LimitOrderForm.tsx`
- [ ] Copy `MarketFilters.tsx` (no changes)
- [ ] Copy `LaunchpadLockedProceeds.tsx` (no changes)
- [ ] Copy `PendingUnlocks.tsx` (no changes)

### Week 5: Operator & Pages
- [ ] Adapt `AdjudicatorConsole.tsx`
- [ ] Adapt `GuardianConsole.tsx`
- [ ] Create `CreatorDashboard.tsx` (new)
- [ ] Create `MarketInitializationPanel.tsx` (new)
- [ ] Copy `Landing.tsx` (no changes)
- [ ] Copy `Markets.tsx` (no changes)
- [ ] Copy `About.tsx` (no changes)
- [ ] Copy `Faucet.tsx` (no changes)
- [ ] Split `MarketDetail.tsx` → 3 pages
- [ ] Adapt `Portfolio.tsx`
- [ ] Adapt `CreateMarket.tsx`
- [ ] Expand `OperatorConsole.tsx`

---

## 🔑 Key Patterns to Reuse

### 1. **Component Structure**

V7 has excellent component organization:
```
components/
├── ui/           # Generic UI (100% reusable)
├── layout/       # Layout (100% reusable)
└── features/     # Domain components (70% reusable)
    ├── launchpad/
    ├── market/
    ├── operator/
    ├── portfolio/
    └── trader/
```

**V8 Strategy**: ✅ **Keep exact same structure**

---

### 2. **Hook Pattern**

V7 hooks follow excellent patterns:
```typescript
// ✅ Reuse this pattern
export function useMarket(address: string) {
  const { selectedChainId } = useAppStore();
  
  // Batch contract reads
  const { data, isLoading, error } = useReadContracts({
    contracts: [/* ... */],
    chainId: selectedChainId,
  });
  
  // Transform data
  const transformed = useMemo(() => {
    if (!data) return null;
    return {
      // ... transformation
    };
  }, [data]);
  
  return { ...transformed, isLoading, error };
}
```

**V8 Strategy**: ✅ **Keep pattern, update contract calls**

---

### 3. **Card Component Pattern**

V7 uses consistent card structure:
```typescript
// ✅ Reuse this pattern
export function FeatureCard({ title, data, actions }) {
  return (
    <Card>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3>{title}</h3>
          {actions}
        </div>
        
        {/* Content */}
        <div className="space-y-2">
          {data.map(item => (
            <div key={item.id} className="flex justify-between">
              <span>{item.label}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
```

**V8 Strategy**: ✅ **Keep exact same pattern**

---

### 4. **Styling System**

V7 has excellent Tailwind usage:
- Consistent color palette
- Responsive design
- Dark mode support
- Animations

**V8 Strategy**: ✅ **Keep all styles**

---

## 💡 Pro Tips

### 1. **Start with UI Components**
Copy `/components/ui/` first. These are 100% reusable and give you immediate visual consistency.

### 2. **Reuse V7 Layouts**
The V7 page layouts are excellent. Don't reinvent the wheel.

### 3. **Adapt, Don't Rewrite**
For hooks and feature components, **adapt** the V7 code rather than rewriting from scratch. The structure is solid.

### 4. **Keep V7 Styling**
V7 has beautiful, consistent styling. Keep all Tailwind classes and design patterns.

### 5. **Reuse V7 Error Handling**
V7 has good error handling patterns. Copy them.

### 6. **Leverage V7 Mobile Design**
V7 is mobile-responsive. Keep all responsive patterns.

---

## 🎯 Expected Outcomes

### Code Reuse
- **70%** of V7 code directly reusable
- **20%** adaptable with minor changes
- **10%** new code needed

### Time Savings
- **~4 weeks saved** vs building from scratch
- **~7 weeks total** vs ~11 weeks from scratch

### Quality
- ✅ Proven UI components
- ✅ Tested responsive design
- ✅ Consistent styling
- ✅ Solid architecture

---

## 🚀 Quick Start

1. **Copy V7 foundation** (Week 1)
   ```bash
   cp -r v7/src/components/ui v8/src/components/
   cp -r v7/src/components/layout v8/src/components/
   cp -r v7/src/lib v8/src/
   cp -r v7/src/utils v8/src/
   ```

2. **Update configs** (Week 1)
   - Update `deployments.json` with V8 addresses
   - Update `abis.ts` with V8 ABIs

3. **Migrate hooks** (Week 2)
   - Copy hook structure
   - Update contract calls
   - Test with V8 contracts

4. **Migrate components** (Weeks 3-4)
   - Copy reusable components
   - Adapt contract-dependent components
   - Test UI

5. **Migrate pages** (Week 5)
   - Copy simple pages
   - Split/adapt complex pages
   - Test flows

---

**Estimated Total Time**: 5-7 weeks (vs 11 weeks from scratch)  
**Code Reuse**: ~70%  
**Effort Savings**: ~40%

**You've built excellent V7 foundations. Let's leverage them!** 🚀
