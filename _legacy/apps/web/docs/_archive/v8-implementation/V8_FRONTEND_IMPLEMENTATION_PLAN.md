# V8 Frontend Development - Implementation Plan

**Date**: 2025-12-24  
**Status**: Active Development (V8.1)
**Based On**: V7_TO_V8_MIGRATION_GUIDE.md, V8_SPENDABLE_PROCEEDS_FRONTEND_GUIDE.md

---

## 🎯 Overview

This plan outlines the step-by-step implementation of the V8 frontend, leveraging 70% code reuse from V7.

---

## Week 1: Foundation ✅ COMPLETE

### Prerequisites Complete
- ✅ V8 contracts deployed to Base Sepolia
- ✅ `deployments.json` updated with V8 addresses
- ✅ `markets.json` updated with V8 markets
- ✅ All V8 specs finalized

### Tasks

#### 1. Extract V8 ABIs
**Location**: `apps/web/src/config/abis/v8/`

Create ABI files for:
- `LaunchpadEngine.abi.json`
- `Collateralizer.abi.json`
- `AMMEngine.abi.json`
- `TickBook.abi.json`
- `TruthMarket.abi.json`
- `OutcomeToken.abi.json`

**Command**:
```bash
cd packages/contracts-evm
mkdir -p ../../apps/web/src/config/abis/v8

# Extract each ABI
jq '.abi' out/LaunchpadEngine.sol/LaunchpadEngine.json > ../../apps/web/src/config/abis/v8/LaunchpadEngine.abi.json
jq '.abi' out/Collateralizer.sol/Collateralizer.json > ../../apps/web/src/config/abis/v8/Collateralizer.abi.json
jq '.abi' out/AMMEngine.sol/AMMEngine.json > ../../apps/web/src/config/abis/v8/AMMEngine.abi.json
jq '.abi' out/TickBook.sol/TickBook.json > ../../apps/web/src/config/abis/v8/TickBook.abi.json
jq '.abi' out/TruthMarket.sol/TruthMarket.json > ../../apps/web/src/config/abis/v8/TruthMarket.abi.json
jq '.abi' out/OutcomeToken.sol/OutcomeToken.json > ../../apps/web/src/config/abis/v8/OutcomeToken.abi.json
```

#### 2. Update `apps/web/src/config/abis.ts`

Add V8 ABI exports:
```typescript
// V8 ABIs
import LaunchpadEngineABI from './abis/v8/LaunchpadEngine.abi.json';
import CollateralizerABI from './abis/v8/Collateralizer.abi.json';
import AMMEngineABI from './abis/v8/AMMEngine.abi.json';
import TickBookABI from './abis/v8/TickBook.abi.json';
import TruthMarketABI from './abis/v8/TruthMarket.abi.json';
import OutcomeTokenABI from './abis/v8/OutcomeToken.abi.json';

export const V8_ABIS = {
  LaunchpadEngine: LaunchpadEngineABI,
  Collateralizer: CollateralizerABI,
  AMMEngine: AMMEngineABI,
  TickBook: TickBookABI,
  TruthMarket: TruthMarketABI,
  OutcomeToken: OutcomeTokenABI,
} as const;
```

#### 3. Verify Deployments Config

**File**: `apps/web/src/config/deployments.json`

Ensure it has:
```json
{
  "version": "8.0.0",
  "networks": {
    "baseSepolia": {
      "chainId": 84532,
      "contracts": {
        "LaunchpadEngine": "0x196138C0d39eE18a6EEFbD9f889f455e67774bAe",
        "Collateralizer": "0x33CEF938B38C0449d9DA786c27168F6F7Dc4FFac",
        "AMMEngine": "0x26728543542297dc17A91D82C0B1605Dc2331537",
        "TickBook": "0x10dC96D3A82FE35b2FF4571B90D8FE5984c60A87",
        "MockUSDC": "0x8dD2ABE2a78BB70F8E0fFE363BbFdc6022aA00Cd"
      }
    }
  }
}
```

#### 4. Test Dev Server

```bash
cd apps/web
npm run dev
```

Verify:
- ✅ Server starts on port 5173
- ✅ No TypeScript errors
- ✅ Deployments load correctly

---

## Week 2: Core Hooks ✅ COMPLETE

### New Hooks to Create

#### 1. `useTruthMarket.ts`
**Purpose**: Fetch TruthMarket lifecycle state

**Reads**:
- `isLive()` - Market active status
- `isSettled()` - Settlement status
- `winningOutcome()` - Winning outcome (if settled)
- `deadline()` - Market deadline
- `creator()` - Market creator
- `adjudicator()` - Adjudicator address
- `guardian()` - Guardian address

#### 2. `useLaunchpadMarket.ts`
**Purpose**: Fetch LaunchpadEngine state for a market

**Reads**:
- `markets(address)` - Full market state struct
- `getBBase(address)` - Current liquidity parameter
- `isGraduated(address)` - Graduation status
- `lpBalances(address, user)` - User LP balance
- `preGradFeeBps()` - Pre-graduation fee
- `postGradFeeBps()` - Post-graduation fee
- `graduationMultiplier()` - Graduation threshold

#### 3. `useAmmMarket.ts` (Adapt from V7)
**Purpose**: Fetch AMMEngine state

**Reads**:
- `getMarketState(address)` - (qYes, qNo, b)
- `calculateCost(address, deltaShares)` - Trade cost

#### 4. `useCollateralizer.ts`
**Purpose**: Fetch token balances and collateral state

**Reads**:
- `getOutcomeTokens(address)` - (yesToken, noToken)
- `getBalances(address, user)` - (yesBalance, noBalance)
- `getTotalCollateral(address)` - Total collateral

#### 5. `useCreatorPosition.ts`
**Purpose**: Fetch creator's LP position and earnings

**Reads**:
- `lpBalances(market, creator)` - LP tokens
- `markets(market).feesAccrued` - Total fees collected
- `markets(market).lpYieldPool` - Claimable yield

---

## Week 3: Launchpad Components ✅ COMPLETE

### Components to Copy (No Changes)
- ✅ `MarketHeader.tsx`
- ✅ `GraduationProgress.tsx`
- ✅ `GuardianActions.tsx`
- ✅ `LPLeaderboardCard.tsx`
- ✅ `TrendingLeaderboard.tsx`

### Components to Adapt

#### 1. `MarketCard.tsx`
**Changes**:
- Update `useLaunchpadMarket` hook call
- Add graduation badge
- Update liquidity display

#### 2. `AmmTradingPanel.tsx`
**Changes**:
- Update to use `LaunchpadEngine.tradePositions()`
- Update fee display (pre-grad vs post-grad)
- Update quote calculation

#### 3. `LPRedemption.tsx`
**Changes**:
- Update to use `LaunchpadEngine.redeemLP()`
- Update floor calculation display

---

## Week 4: Portfolio & Trader Components ✅ IN PROGRESS

### Components to Copy (No Changes)
- ✅ `PortfolioCard.tsx`
- ✅ `WalletSummaryCard.tsx`
- ✅ `PositionActionsModal.tsx`
- ✅ `ActiveOrdersCard.tsx`
- ✅ `MarketFilters.tsx`
- ✅ `LaunchpadLockedProceeds.tsx`
- ✅ `PendingUnlocks.tsx`

### Components to Adapt

#### 1. `VaultPositionsCard.tsx`
**Changes**:
- Remove vault balance display
- Update to show direct USDC balance
- Update position fetching for AMMEngine

#### 2. `LPPositionsCard.tsx`
**Changes**:
- Update to use `LaunchpadEngine.lpBalances()`
- Update redemption flow

#### 3. `Orderbook.tsx`
**Changes**:
- Update to use `TickBook` contract
- Same UI, different contract calls

#### 4. `OrderbookForm.tsx`
**Changes**:
- Update to use `TickBook.placeOrder()`
- Update balance checks (direct USDC)

---

## Week 5: Pages & Final Integration ✅ IN PROGRESS

### Pages to Copy (No Changes)
- ✅ `Landing.tsx`
- ✅ `Markets.tsx`
- ✅ `About.tsx`
- ✅ `Faucet.tsx`

### Pages to Adapt

#### 1. `MarketDetail.tsx` → Split into 3 Tabs
**New Structure**:
```
/market/:id
  ├── AMM Tab (default)
  ├── Orderbook Tab
  └── Operator Tab (creator/adjudicator only)
```

**Reuse from V7**:
- Market info header
- Tab navigation pattern
- Card layouts

#### 2. `Portfolio.tsx`
**Changes**:
- Remove vault balance section
- Update position cards for V8
- Keep overall layout

#### 3. `OperatorConsole.tsx`
**Changes**:
- Add creator dashboard section
- Add market initialization panel
- Keep settlement/veto panels

---

## Week 6: V8.1 Spendable Proceeds & Refinement ✅ CURRENT

### Features
- **Cross-Market Spendability**: Sell proceeds from one market can be immediately used to buy in another.
- **24h Withdrawal Lock**: Proceeds are locked for 24h before they can be withdrawn to the user's wallet.
- **Improved Precision**: Use of ceiling division (`_wadToUsdcCeil`) to prevent atomic balance errors.

### Tasks

#### 1. Implement Spendable Hooks
- [x] `useAvailableBalance`: Fetch spendable vs locked USDC from AMMEngine.
- [x] `useClaimableAmount`: Fetch proceeds ready for withdrawal.
- [x] `useClaimUnlocked`: Hook to execute the withdrawal transaction.
- [x] `useLockQueue`: Fetch the list of pending unlocks.

#### 2. Update Trading Logic
- [x] Update `SimpleTradingPanel` to display spendable proceeds.
- [x] Align conversion logic with contract (Ceiling Division).
- [x] Update `needsApproval` to check spendable balance first.

#### 3. Refine Portfolio
- [x] Add `ProceedsManagement` dashboard.
- [x] Add `LockQueue` table for transparency.
- [x] Optimize polling intervals for faster UI feedback.

#### 4. Verification & Polish
- [ ] Verify 24h lock behavior on-chain.
- [ ] Test cross-market reinvestment flow.
- [ ] Final UI touch-ups (Lucide-react icons, glassmorphism).

---

## Testing Checklist

### Week 1
- [ ] Dev server starts
- [ ] No TypeScript errors
- [ ] Deployments load
- [ ] ABIs load correctly

### Week 2
- [ ] All hooks return data
- [ ] No RPC errors
- [ ] Data transforms correctly

### Week 3
- [ ] Components render
- [ ] Data displays correctly
- [ ] Graduation badge shows

### Week 4
- [ ] Portfolio loads
- [ ] Positions display
- [ ] Orderbook works

### Week 5
- [ ] All pages load
- [ ] Navigation works
- [ ] Tabs switch correctly

---

## Success Criteria
- ✅ All V8.1 contracts integrated
- ✅ Cross-market spendable proceeds functional
- ✅ All markets display correctly (V8.1 filter active)
- ✅ Trading works (AMM + Orderbook)
- ✅ 24h withdrawal locks visualized and claimable
- ✅ No TypeScript errors
- ✅ Mobile responsive
- ✅ High-precision decimal alignment (USDC Ceil)

---

## Next Action
**Complete Verification & Polish**: 
- Run end-to-end trade tests to verify Spendable Proceeds are consumed before USDC allowance.
- Verify 24h lock expires correctly and claim button activates.
- Final UI sweep for consistent aesthetics.

---

**Estimated Total Time**: 6-8 weeks  
**Current Status**: Refinement Phase (V8.1)
**Blocked By**: None
