# V8 Operator Console Specification

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Draft

---

## Overview

The Operator Console provides market creators with tools to manage their market's economic lifecycle, from initialization through settlement. It integrates with the **LaunchpadEngine** for creator economics and **TruthMarket** for lifecycle management.

### Target Users
- **Market Creators** - Initialize and manage their markets
- **Adjudicators** - Settle market outcomes
- **Guardians** - Emergency veto power

### Key Features
- ✅ Market initialization with creator deposit
- ✅ Real-time LP position tracking
- ✅ Fee earnings dashboard
- ✅ Graduation progress monitoring
- ✅ Settlement controls (adjudicator)
- ✅ Emergency veto (guardian)
- ✅ Post-settlement withdrawal

---

## Page Structure

### Route
`/markets/:marketId/operator`

### Access Control
**Show page only if:**
- `connectedAddress == market.creator` OR
- `connectedAddress == market.adjudicator` OR
- `connectedAddress == market.guardian`

**Otherwise**: Redirect to `/markets/:marketId/amm` or show "Access Denied"

### Layout
```
┌─────────────────────────────────────────────┐
│  Market Header (shared component)           │
│  Navigation: AMM | Orderbook | Info | ⚙️    │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  Role Badge                                 │
│  • "You are: Creator" / "Adjudicator" etc.  │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  Initialization Panel (if not initialized)  │
│  • Liquidity parameter selection            │
│  • Deposit calculation                      │
│  • Initialize button                        │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  Creator Dashboard (if initialized)         │
│  • LP position value                        │
│  • Fees earned                              │
│  • Graduation progress                      │
│  • Risk metrics                             │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  Settlement Panel (adjudicator only)        │
│  • Outcome selection                        │
│  • T* input                                 │
│  • Settle button                            │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  Guardian Panel (guardian only)             │
│  • Veto button                              │
│  • Finalize button                          │
└─────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Role Badge

**Component**: `OperatorRoleBadge.tsx`

**Display**:
```
┌─────────────────────────────────────┐
│ 🔑 Your Role: Creator               │
│ You can initialize and manage this  │
│ market's liquidity.                 │
└─────────────────────────────────────┘
```

**Variants**:
- **Creator**: Purple badge, "Initialize and manage liquidity"
- **Adjudicator**: Blue badge, "Settle market outcome"
- **Guardian**: Red badge, "Emergency veto power"

**Data Source**:
- `TruthMarket.creator()`
- `TruthMarket.adjudicator()`
- `TruthMarket.guardian()`

---

### 2. Initialization Panel

**Component**: `MarketInitializationPanel.tsx`

**Visibility**: Only if `!launchpadEngine.isInitialized(market) && connectedAddress == creator`

#### Liquidity Tier Selection

**Display**:
```
┌─────────────────────────────────────────────┐
│ Initialize Market Liquidity                 │
├─────────────────────────────────────────────┤
│ Select Liquidity Tier:                      │
│                                             │
│ ○ Starter ($100)                            │
│   • Deposit: $69.31                         │
│   • Max Loss: $69.31                        │
│   • Best for: Small, experimental markets   │
│                                             │
│ ● Standard ($1,000) ← Recommended           │
│   • Deposit: $693.15                        │
│   • Max Loss: $693.15                       │
│   • Best for: Most markets                  │
│                                             │
│ ○ Premium ($10,000)                         │
│   • Deposit: $6,931.47                      │
│   • Max Loss: $6,931.47                     │
│   • Best for: High-volume markets           │
│                                             │
│ ○ Enterprise ($100,000)                     │
│   • Deposit: $69,314.72                     │
│   • Max Loss: $69,314.72                    │
│   • Best for: Institutional markets         │
└─────────────────────────────────────────────┘
```

**Formulas**:
- `deposit = b × ln(2)` where `ln(2) ≈ 0.693147`
- `maxLoss = deposit` (worst case: all traders on one side)

#### Deposit Summary

**Display**:
```
┌─────────────────────────────────────────────┐
│ Deposit Summary                             │
├─────────────────────────────────────────────┤
│ Liquidity Parameter (b):  $1,000.00         │
│ Required Deposit:         $693.15           │
│ Liquidity Leverage:       1.44x             │
│                                             │
│ Your Risk:                                  │
│ • Max Loss:               $693.15           │
│ • Occurs if:              All traders pick  │
│                           same outcome      │
│                                             │
│ Your Potential Earnings:                    │
│ • Pre-Graduation Fee:     5.0%              │
│ • Post-Graduation Fee:    1.0%              │
│ • LP Share:               30% of fees       │
│                                             │
│ Graduation Target:                          │
│ • Fee Threshold:          $1,386.29         │
│                           (2× bBase)        │
└─────────────────────────────────────────────┘
```

**Data Sources**:
- Governance parameters from `LaunchpadEngine`:
  - `preGradFeeBps` (default: 500 = 5%)
  - `postGradFeeBps` (default: 100 = 1%)
  - `lpYieldShareBps` (default: 3000 = 30%)
  - `graduationMultiplier` (default: 2)

#### Action Buttons

**States**:
```
[Approve USDC] [Initialize Market]
     ↓ (after approval)
[Initialize Market]
     ↓ (after initialization)
[View Dashboard] (redirect to dashboard section)
```

**Transaction Flow**:
1. User selects tier
2. Clicks "Approve USDC"
3. Approves `deposit` amount to `LaunchpadEngine`
4. Clicks "Initialize Market"
5. Calls `LaunchpadEngine.initializeMarket(market, b)`
6. Success toast: "Market initialized with $X liquidity"
7. Panel hides, dashboard appears

---

### 3. Creator Dashboard

**Component**: `CreatorDashboard.tsx`

**Visibility**: Only if `launchpadEngine.isInitialized(market) && connectedAddress == creator`

#### LP Position Card

**Display**:
```
┌─────────────────────────────────────────────┐
│ Your LP Position                            │
├─────────────────────────────────────────────┤
│ LP Tokens:          1,000.00                │
│ Total Supply:       1,234.56                │
│ Your Share:         81.0%                   │
│                                             │
│ Position Value:                             │
│ • Honest Floor:     $712.45                 │
│ • Optimistic:       $745.23                 │
│ • Initial Deposit:  $693.15                 │
│                                             │
│ Unrealized PnL:     +$19.30 (+2.8%)        │
└─────────────────────────────────────────────┘
```

**Formulas**:
- `lpTokens = LaunchpadEngine.balanceOf(creator, market)`
- `totalSupply = LaunchpadEngine.totalSupply(market)`
- `share = (lpTokens / totalSupply) × 100`
- `honestFloor = LaunchpadEngine.getHonestFloor(market)`
- `optimistic = LaunchpadEngine.getOptimisticValue(market)`
- `pnl = honestFloor - initialDeposit`

**Data Sources**:
- `LaunchpadEngine.balanceOf(user, market)`
- `LaunchpadEngine.totalSupply(market)`
- `LaunchpadEngine.getHonestFloor(market)`
- `LaunchpadEngine.getCreatorDeposit(market)`

#### Fees Earned Card

**Display**:
```
┌─────────────────────────────────────────────┐
│ Fees Earned                                 │
├─────────────────────────────────────────────┤
│ Total Fees Collected:   $123.45             │
│ Your Share (81%):       $100.00             │
│                                             │
│ Breakdown:                                  │
│ • Pre-Graduation:       $95.00 (5% fee)    │
│ • Post-Graduation:      $5.00 (1% fee)     │
│                                             │
│ Fee Distribution:                           │
│ • To bBase Growth:      $61.73 (50%)       │
│ • To LP Yield:          $37.04 (30%)       │
│ • To Protocol:          $24.68 (20%)       │
└─────────────────────────────────────────────┘
```

**Formulas**:
- `totalFees = LaunchpadEngine.getTotalFeesCollected(market)`
- `yourShare = totalFees × (lpTokens / totalSupply)`
- Split based on governance parameters

**Data Source**:
- `LaunchpadEngine.getTotalFeesCollected(market)`

#### Graduation Progress Card

**Display**:
```
┌─────────────────────────────────────────────┐
│ Graduation Progress                         │
├─────────────────────────────────────────────┤
│ Status: Pre-Graduation 🟡                   │
│                                             │
│ Progress: ████████░░░░░░░░ 45%             │
│                                             │
│ Fees Collected:     $623.45                 │
│ Graduation Target:  $1,386.29 (2× bBase)   │
│ Remaining:          $762.84                 │
│                                             │
│ Current Fee Rate:   5.0% (Pre-Grad)        │
│ After Graduation:   1.0%                    │
│                                             │
│ Estimated Time:     ~3.2 days               │
│ (Based on current volume)                   │
└─────────────────────────────────────────────┘
```

**Formulas**:
- `progress = (feesCollected / graduationTarget) × 100`
- `graduationTarget = bBase × graduationMultiplier`
- `remaining = graduationTarget - feesCollected`
- `estimatedTime = remaining / avgDailyFees`

**Visual**:
- Progress bar: Green when > 75%, Yellow when 25-75%, Red when < 25%
- Animated when fees increase

#### Risk Metrics Card

**Display**:
```
┌─────────────────────────────────────────────┐
│ Risk Metrics                                │
├─────────────────────────────────────────────┤
│ Max Loss Exposure:      $693.15             │
│ Current Exposure:       $512.34             │
│ Safety Buffer:          $180.81 (26%)      │
│                                             │
│ Market Imbalance:                           │
│ • YES Quantity:         234 shares          │
│ • NO Quantity:          178 shares          │
│ • Imbalance:            56 shares (24%)    │
│                                             │
│ Risk Level: 🟢 Low                          │
└─────────────────────────────────────────────┘
```

**Formulas**:
- `currentExposure = max(qYes, qNo)`
- `safetyBuffer = maxLoss - currentExposure`
- `imbalance = abs(qYes - qNo) / (qYes + qNo)`

**Risk Levels**:
- 🟢 Low: `safetyBuffer > 50%`
- 🟡 Medium: `safetyBuffer 20-50%`
- 🔴 High: `safetyBuffer < 20%`

---

### 4. Settlement Panel

**Component**: `SettlementPanel.tsx`

**Visibility**: Only if `connectedAddress == adjudicator && !market.isSettled()`

**Display**:
```
┌─────────────────────────────────────────────┐
│ Settle Market                               │
├─────────────────────────────────────────────┤
│ Select Outcome:                             │
│ ○ YES  ○ NO  ○ INVALID                     │
│                                             │
│ T* (Retroactive Truth-Time): [Optional]    │
│ [Date/Time Picker]                          │
│                                             │
│ ⚠️ WARNING                                  │
│ This action is irreversible unless vetoed   │
│ by the guardian. Ensure outcome is correct. │
│                                             │
│ Settlement Impact Preview:                  │
│ • YES holders:  Receive $1.00 per token    │
│ • NO holders:   Receive $0.00 per token    │
│ • Total payout: $1,234.56                   │
│                                             │
│ [Settle Market]                             │
└─────────────────────────────────────────────┘
```

**Transaction**:
```typescript
await truthMarket.settle(outcome, tStar);
```

**Confirmation Dialog**:
```
Are you sure you want to settle this market?

Outcome: YES
T*: None

This action cannot be undone except by guardian veto.

[Cancel] [Confirm Settlement]
```

---

### 5. Guardian Panel

**Component**: `GuardianPanel.tsx`

**Visibility**: Only if `connectedAddress == guardian`

#### Veto Panel (if settled but not finalized)

**Display**:
```
┌─────────────────────────────────────────────┐
│ Guardian Controls                           │
├─────────────────────────────────────────────┤
│ Current Settlement:                         │
│ • Outcome:      YES                         │
│ • Settled by:   0x1234...5678              │
│ • Settled at:   2025-12-23 10:30 UTC       │
│ • T*:           None                        │
│                                             │
│ ⚠️ EMERGENCY VETO                           │
│ Only use if settlement is provably incorrect│
│                                             │
│ [Veto Settlement]                           │
└─────────────────────────────────────────────┘
```

**Transaction**:
```typescript
await truthMarket.veto();
```

**Confirmation Dialog**:
```
⚠️ EMERGENCY VETO

Are you absolutely sure the settlement is incorrect?

This will revert the market to SETTLING state and
allow the adjudicator to re-settle.

[Cancel] [Confirm Veto]
```

#### Finalize Panel (if settled)

**Display**:
```
┌─────────────────────────────────────────────┐
│ Finalize Settlement                         │
├─────────────────────────────────────────────┤
│ Current Settlement: YES                     │
│ Time since settlement: 7 days               │
│                                             │
│ ℹ️ Finalization makes settlement permanent  │
│ and prevents any future veto.               │
│                                             │
│ [Finalize Settlement]                       │
└─────────────────────────────────────────────┘
```

**Transaction**:
```typescript
await truthMarket.finalize();
```

---

### 6. Withdrawal Panel

**Component**: `WithdrawalPanel.tsx`

**Visibility**: Only if `market.isSettled() && connectedAddress == creator`

**Display**:
```
┌─────────────────────────────────────────────┐
│ Withdraw LP Position                        │
├─────────────────────────────────────────────┤
│ Market Settled: YES                         │
│                                             │
│ Your LP Position:                           │
│ • LP Tokens:        1,000.00                │
│ • Final Value:      $712.45                 │
│ • Initial Deposit:  $693.15                 │
│ • Profit:           +$19.30 (+2.8%)        │
│                                             │
│ Available to Withdraw: $712.45              │
│                                             │
│ [Withdraw All]                              │
└─────────────────────────────────────────────┘
```

**Transaction**:
```typescript
await launchpadEngine.redeemLP(market, lpTokens);
```

**Success Toast**:
```
✓ Withdrawal successful!
Received $712.45 USDC
```

---

## Hooks Specification

### `useLaunchpadMarket(marketAddress)`

**Returns**:
```typescript
{
  isInitialized: boolean;
  bBase: bigint;              // WAD
  creatorDeposit: bigint;     // WAD
  totalFeesCollected: bigint; // WAD
  isGraduated: boolean;
  graduationTarget: bigint;   // WAD
  currentFeeRate: number;     // BPS
  isLoading: boolean;
  error: Error | null;
}
```

**Data Sources**:
- `LaunchpadEngine.isInitialized(market)`
- `LaunchpadEngine.getBBase(market)`
- `LaunchpadEngine.getCreatorDeposit(market)`
- `LaunchpadEngine.getTotalFeesCollected(market)`
- `LaunchpadEngine.isGraduated(market)`

### `useCreatorPosition(marketAddress, userAddress)`

**Returns**:
```typescript
{
  lpTokens: bigint;
  totalSupply: bigint;
  share: number;              // Percentage
  honestFloor: bigint;        // WAD
  optimisticValue: bigint;    // WAD
  unrealizedPnL: bigint;      // WAD (can be negative)
  isLoading: boolean;
  error: Error | null;
}
```

**Data Sources**:
- `LaunchpadEngine.balanceOf(user, market)`
- `LaunchpadEngine.totalSupply(market)`
- `LaunchpadEngine.getHonestFloor(market)`

### `useGovernanceParams()`

**Returns**:
```typescript
{
  preGradFeeBps: number;
  postGradFeeBps: number;
  bBaseShareBps: number;
  lpYieldShareBps: number;
  protocolShareBps: number;
  graduationMultiplier: number;
  isLoading: boolean;
  error: Error | null;
}
```

**Data Source**:
- `LaunchpadEngine.preGradFeeBps()` etc.

---

## User Flows

### Flow 1: Market Initialization

1. Creator deploys `TruthMarket`
2. Navigates to `/markets/:id/operator`
3. Sees "Initialize Market" panel
4. Selects liquidity tier (e.g., Standard $1,000)
5. Reviews deposit summary ($693.15)
6. Clicks "Approve USDC"
7. Approves $693.15 to LaunchpadEngine
8. Clicks "Initialize Market"
9. Transaction confirms
10. Dashboard appears showing LP position
11. Success toast: "Market initialized!"

### Flow 2: Monitoring Progress

1. Creator visits operator console
2. Sees dashboard with:
   - LP position value
   - Fees earned
   - Graduation progress (45%)
   - Risk metrics
3. Checks daily to monitor progress
4. Celebrates when graduation reached!

### Flow 3: Settlement (Adjudicator)

1. Adjudicator visits `/markets/:id/operator`
2. Sees settlement panel
3. Selects outcome (YES)
4. Optionally sets T*
5. Reviews impact preview
6. Clicks "Settle Market"
7. Confirms in dialog
8. Transaction confirms
9. Market state changes to SETTLED
10. Success toast: "Market settled as YES"

### Flow 4: Emergency Veto (Guardian)

1. Guardian notices incorrect settlement
2. Visits `/markets/:id/operator`
3. Sees current settlement details
4. Clicks "Veto Settlement"
5. Confirms in warning dialog
6. Transaction confirms
7. Market reverts to SETTLING
8. Adjudicator can re-settle
9. Success toast: "Settlement vetoed"

### Flow 5: LP Withdrawal

1. Market settles
2. Creator visits operator console
3. Sees withdrawal panel
4. Reviews final value ($712.45)
5. Sees profit (+$19.30)
6. Clicks "Withdraw All"
7. Transaction confirms
8. USDC transferred to wallet
9. Success toast: "Withdrawal successful!"

---

## Error Handling

### Contract Errors

| Error | User Message | Action |
|-------|--------------|--------|
| `LaunchpadEngine: already initialized` | "Market already initialized" | Hide init panel |
| `LaunchpadEngine: insufficient deposit` | "Insufficient USDC balance" | Show balance |
| `TruthMarket: not adjudicator` | "Only adjudicator can settle" | Hide panel |
| `TruthMarket: not guardian` | "Only guardian can veto" | Hide panel |
| `TruthMarket: not settled` | "Market not yet settled" | Disable withdrawal |

---

## Mobile Considerations

### Responsive Layout
- **Desktop**: Full dashboard with all cards
- **Tablet**: Stacked cards
- **Mobile**: Accordion-style cards (collapse/expand)

### Mobile Optimizations
- Simplified metrics (fewer decimals)
- Larger touch targets for buttons
- Bottom sheet for confirmation dialogs
- Sticky action buttons

---

## Accessibility

- **ARIA labels** on all controls
- **Keyboard navigation** for all actions
- **Screen reader** announcements for state changes
- **High contrast** mode for risk indicators
- **Focus indicators** on all interactive elements

---

## Testing Checklist

### Unit Tests
- [ ] Deposit calculation accuracy
- [ ] LP value calculation
- [ ] Graduation progress calculation
- [ ] Risk metrics calculation

### Integration Tests
- [ ] Initialization flow
- [ ] Settlement flow
- [ ] Veto flow
- [ ] Withdrawal flow

### E2E Tests
- [ ] Full creator journey (init → monitor → withdraw)
- [ ] Adjudicator settlement
- [ ] Guardian veto
- [ ] Multi-role interactions

---

**Last Updated**: 2025-12-23  
**Next Review**: Before V8 frontend implementation
