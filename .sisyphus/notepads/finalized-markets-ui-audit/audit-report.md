# Component Audit Report: Finalized Markets UI

**Date**: 2026-01-27  
**Scope**: Position and claim components across Portfolio, Trade, and Pro pages  
**Focus**: Finalized market handling and data flow issues

---

## Portfolio Page (`apps/web/src/pages/Portfolio.tsx`)

### AMMPositionRow (lines 31-95)

- **Return conditions**: Returns `null` when:
  - `isLoading` is true (line 56)
  - Both `yesShares === 0n && noShares === 0n` (line 56)
- **Data dependencies**: 
  - `useAMMPositionDirect(market.address)` hook (line 38)
  - Props: `market`, `stage`, `price`, `onValueUpdate`, `onRedeem`
- **Finalized market handling**: 
  - Shows "Redeem Position" button when `stage === 'finalized'` AND has shares (lines 85-92)
  - Correctly displays stage badges for all stages including finalized (lines 63-67)
- **Issues found**: 
  - **NONE** - Component correctly handles finalized markets

### LPPositionRow (lines 97-195)

- **Return conditions**: Returns `null` when:
  - `!lpBalance || lpBalance === 0n` (line 163)
- **Data dependencies**:
  - Props: `market`, `stage`, `lpBalance`, `lpSupply`, `floorValue`, `bCurrent`, `qYes`, `qNo`, `decimals`, `onValueUpdate`, `onRedeem`
  - Value calculation uses LMSR math (lines 110-155)
- **Finalized market handling**:
  - Shows "Redeem LP Tokens" button when `stage === 'finalized'` AND has LP balance (lines 181-188)
  - Correctly displays stage badges (lines 170-174)
- **Issues found**:
  - **NONE** - Component correctly handles finalized markets

### TickBookInternalRow (lines 197-267)

- **Return conditions**: Returns `null` when:
  - `isLoading` is true (line 223)
  - Both `yesInternal === 0n && noInternal === 0n` (line 223)
- **Data dependencies**:
  - `useTickBookVaultDirect(userAddress, market.address)` hook (line 206)
  - Props: `market`, `stage`, `userAddress`, `price`, `onValueUpdate`, `onRedeem`
- **Finalized market handling**:
  - Shows "Redeem Position" button when `stage === 'finalized'` AND has internal shares (lines 252-259)
  - Correctly displays stage badges (lines 229-234)
- **Issues found**:
  - **NONE** - Component correctly handles finalized markets

### LockedSharesRow (lines 269-336)

- **Return conditions**: Returns `null` when:
  - `isLoading` is true (line 286)
  - Both `yesLocked === 0n && noLocked === 0n` (line 286)
- **Data dependencies**:
  - `useTickBookVaultDirect(userAddress, market.address)` hook (line 272)
  - Props: `market`, `stage`, `userAddress`, `price`, `onValueUpdate`, `onRedeem`
- **Finalized market handling**:
  - Shows "Redeem Position" button when `stage === 'finalized'` AND has locked shares (lines 316-323)
  - Correctly displays stage badges (lines 292-297)
- **Issues found**:
  - **NONE** - Component correctly handles finalized markets

### Portfolio Page Summary

The Portfolio page correctly handles finalized markets. All four position row components:
1. Display appropriate stage badges
2. Show redemption buttons when finalized
3. Use proper hooks for data fetching

**Potential Issue**: The stage badge logic in Portfolio.tsx relies on `market.stage` passed from `useOnChainMarkets()`. If the stage is incorrectly computed in the hook, badges will be wrong. This is a **data source issue**, not a component issue.

---

## Trade Page (`apps/web/src/pages/Trade.tsx`)

### AMMSettlementCard (`apps/web/src/components/features/AMMSettlementCard.tsx`)

- **File location**: `apps/web/src/components/features/AMMSettlementCard.tsx`
- **Finalized market handling**:
  - Determines finalized state from `stage` prop OR `truthMarket?.isFinalized` (line 50)
  - Shows different UI for settled vs finalized (veto period vs redemption open)
  - Displays winning outcome correctly (lines 139-154)
- **Issues found**:
  - **CRITICAL (lines 54-57)**: Uses mock position data instead of real user position!
    ```typescript
    const mockPosition = {
      yesShares: 0n,
      noShares: 0n,
    };
    ```
    This means the component NEVER shows user's actual shares or payout.
  - **MEDIUM**: Comment says "in production from AMMEngine.getPosition" but this is not implemented
  - **MEDIUM**: Claim button (line 199) has no `onClick` handler - it's non-functional

### LPHolders (`apps/web/src/components/features/LPHolders.tsx`, line 468 in Trade.tsx)

- **Return conditions**: Returns `null` when:
  - `!launchpad || !stats` (line 80)
- **Data dependencies**:
  - `useLaunchpadMarketDirect(marketAddress)` hook (line 30)
  - `useMarketStatsMath(launchpad, ammState, decimals)` hook (line 75)
  - `useDirectRead` for creator LP balance (lines 34-47)
  - `useDirectRead` for AMM state (lines 59-72)
- **Finalized market handling**:
  - Component does NOT check for finalized state
  - Shows LP leaderboard regardless of market stage
  - Hint text changes based on `isGraduated` but not finalized (lines 153-154)
- **Issues found**:
  - **HIGH**: Component returns `null` if `!launchpad || !stats` (line 80). On finalized markets, if `useMarketStatsMath` returns null/undefined stats, the entire LP Leaderboard disappears.
  - **MEDIUM**: No special handling for finalized markets - shows same UI as live markets
  - **MEDIUM**: LP Yield Pool section (lines 234-269) may show stale data on finalized markets

### DismissedMarketPanel (`apps/web/src/components/features/DismissedMarketPanel.tsx`)

- **When shown**: Only when `launchpad?.isDismissed` is true (line 37)
- **Data dependencies**:
  - `useLaunchpadMarketDirect(address)` hook (lines 18-23)
  - Uses `claimRefund` and `isPending` from the hook
- **Issues found**:
  - **NONE** - Component correctly handles dismissed markets
  - Properly shows refund amount and claim button

### Trade Page Conditional Logic (lines 396-434)

```typescript
{launchpad?.isDismissed ? (
  <DismissedMarketPanel address={...} />
) : (truth?.isSettled === true || truth?.isFinalized === true || selectedMarket?.stage === 'settled' || selectedMarket?.stage === 'finalized') ? (
  <>
    <AMMSettlementCard address={...} stage={selectedMarket?.stage} />
    {/* LP redemption section */}
  </>
) : (
  <SimpleTradingPanel ... />
)}
```

- **Issues found**:
  - **NONE** - Logic correctly prioritizes dismissed > settled/finalized > active

---

## Pro Page (`apps/web/src/pages/Pro.tsx`)

### Finalized View (lines 1082-1228)

- **Layout**: 60/40 grid layout matching Trade page
  - Left column (60%): MarketDetailHeader + Settlement Card
  - Right column (40%): UserOrdersPanel (conditionally)
- **Components shown**:
  - `MarketDetailHeader` with finalized state props (lines 1109-1125)
  - Custom settlement card (not AMMSettlementCard) with redemption UI (lines 1127-1201)
  - `UserOrdersPanel` conditionally (lines 1206-1221)
- **Actions available**:
  - "Redeem Position" button for TickBook positions (lines 1167-1188)
  - Shows YES/NO balances from vault (lines 1147-1163)

### UserOrdersPanel in Finalized View (lines 1206-1221)

- **Currently shown**: YES, but only when `userOrders && userOrders.length > 0 && tickBook?.marketKey`
- **Condition**: 
  ```typescript
  {userOrders && userOrders.length > 0 && tickBook?.marketKey && (
    <UserOrdersPanel ... />
  )}
  ```
- **Should it show?**: 
  - **ANALYSIS**: On finalized markets, users may still have:
    1. Pending fills to claim
    2. Active orders that need cancellation
    3. Spot sells that need cancellation
  - However, the panel shows "Cancel" and "Claim" buttons which may not work on finalized markets
- **Recommendation**: 
  - **KEEP** the panel but with modifications:
    1. Disable "Cancel" buttons on finalized markets (orders auto-cancel on settlement)
    2. Keep "Claim" buttons functional for pending fills
    3. Add messaging that orders are no longer active

### UserOrdersPanel Component (`apps/web/src/components/features/pro/UserOrdersPanel.tsx`)

- **Issues for finalized markets**:
  - **MEDIUM (line 113)**: Filters to `orders.filter((order) => order.active)` - on finalized markets, orders may be marked inactive but still have claimable fills
  - **MEDIUM**: No awareness of market finalization state - shows same UI regardless
  - **LOW**: "Place a limit order to get started" message (line 588) is misleading on finalized markets

---

## Summary of Issues Found

### Critical (P0)
1. **AMMSettlementCard uses mock data** (lines 54-57)
   - User's actual AMM position is never fetched
   - Payout calculation always shows $0
   - Claim button is non-functional

### High (P1)
2. **LPHolders returns null on finalized markets** (line 80)
   - If `useMarketStatsMath` returns null stats, entire component disappears
   - This is the likely cause of "LP Leaderboard broken on finalized Trade page"

### Medium (P2)
3. **AMMSettlementCard claim button has no onClick** (line 199)
   - Button is rendered but does nothing

4. **UserOrdersPanel shows stale UI on finalized markets** (Pro.tsx lines 1206-1221)
   - Cancel buttons may not work
   - No finalized-specific messaging

5. **LPHolders no finalized-specific handling** (LPHolders.tsx)
   - Shows same UI as live markets
   - LP Yield Pool may show stale data

### Low (P3)
6. **UserOrdersPanel misleading empty state** (line 588)
   - "Place a limit order to get started" shown on finalized markets

---

## Recommendations

### 1. Fix AMMSettlementCard (Critical)
```typescript
// Replace mock position with actual hook call
const { data: position } = useAMMPositionDirect(address);
const yesShares = position?.yesShares ?? 0n;
const noShares = position?.noShares ?? 0n;

// Add onClick handler to claim button
<Button onClick={handleClaim} variant="primary" className="w-full">
  <Wallet className="w-4 h-4 mr-2" />
  Claim {formatUSDC(userPayout)} Payout
</Button>
```

### 2. Fix LPHolders null return (High)
```typescript
// Add fallback for finalized markets
if (!launchpad) return null;
if (!stats && !launchpad.isFinalized) return null;

// For finalized markets, show simplified view even without stats
if (launchpad.isFinalized) {
  return <FinalizedLPView launchpad={launchpad} />;
}
```

### 3. Add finalized awareness to UserOrdersPanel (Medium)
```typescript
interface UserOrdersPanelProps {
  // ... existing props
  isFinalized?: boolean;
}

// In component:
{isFinalized && (
  <div className="text-amber-400 text-xs mb-2">
    Market finalized - orders are no longer active
  </div>
)}
```

### 4. Simplify Pro finalized view UserOrdersPanel (Medium)
- Pass `isFinalized={true}` prop
- Disable cancel buttons
- Show only claimable fills
- Update empty state messaging

---

## Data Flow Analysis

### Stage Determination (from `useOnChainMarkets.ts` lines 152-164)
```typescript
if (isDismissed) stage = 'dismissed';
else if (isFinalized) stage = 'finalized';
else if (isSettled) stage = 'settled';
else if (isGraduated) stage = 'live';
else stage = 'bonding';
```

This logic is correct. If users see wrong stage badges, the issue is likely:
1. `isFinalized` not being set correctly from contract
2. Stale data from caching
3. Race condition between settlement and finalization

### Hook Dependencies
- `useTruthMarketDirect`: Provides `isSettled`, `isFinalized`, `winningOutcome`
- `useLaunchpadMarketDirect`: Provides `isGraduated`, `isDismissed`, LP data
- `useAMMPositionDirect`: Provides user's AMM shares (YES/NO)
- `useTickBookVaultDirect`: Provides user's TickBook vault data

All hooks appear to be correctly implemented. Issues are in component consumption of data.

---

## Files Audited

| File | Lines | Components |
|------|-------|------------|
| `apps/web/src/pages/Portfolio.tsx` | 940 | AMMPositionRow, LPPositionRow, TickBookInternalRow, LockedSharesRow |
| `apps/web/src/pages/Trade.tsx` | 490 | Uses AMMSettlementCard, LPHolders, DismissedMarketPanel |
| `apps/web/src/pages/Pro.tsx` | 1805 | ProTradingTerminal finalized view, UserOrdersPanel |
| `apps/web/src/components/features/AMMSettlementCard.tsx` | 224 | AMMSettlementCard |
| `apps/web/src/components/features/LPHolders.tsx` | 297 | LPHolders |
| `apps/web/src/components/features/DismissedMarketPanel.tsx` | 124 | DismissedMarketPanel |
| `apps/web/src/components/features/pro/UserOrdersPanel.tsx` | 782 | UserOrdersPanel |

**Total: 11 components audited across 7 files**
