# Launchpad V6 Frontend Specification

## 1. Overview
The **Sooth Launchpad V6** introduces a permissionless market creation flow inspired by "pump.fun", allowing any user to deploy a prediction market. These markets start with a bonding curve liquidity model (accruing fees to liquidity) and "graduate" to post-graduation phase upon reaching a liquidity threshold. All markets are Launchpad markets—there are no separate "standard markets" (see ADR-016).

**V6 Key Features**:
- **Pre-Graduation Locking**: All sell proceeds are locked (24h) during pre-graduation phase
- **Reinvestment**: Locked proceeds can be used to buy shares via `useLockedProceeds()`
- **2-Contract Architecture**: Market implements `ISoothLiquidityVault` itself (market is its own vault)
- **Immutable Factory**: Factory with `ProtocolConfig` for mutable parameters
- **Guardian Role**: Protocol-managed guardian for liquidation and forced graduation

> **See also**: [MARKETS_PAGE_SPEC.md](./MARKETS_PAGE_SPEC.md) for Markets list and MarketCard inline trading.

## 2. Liquidity Model (Dual Venue)
The V6 Launchpad uses a **Dual Venue** model.
1. **Bonding Phase (Pre-Graduation)**: Only the **AMM** is active. Users trade "virtual shares" (internal accounting). Fees are high (5%) to grow liquidity.
   - **V6 Locking**: All sell proceeds are locked for 24h (cannot be directly withdrawn)
   - **Reinvestment**: Locked proceeds can be used to buy more shares via `useLockedProceeds()`
   - **Withdrawal Blocked**: Users cannot withdraw if they have locked proceeds
2. **Graduation**:
   - The **AMM** remains active but lowers fees (1%). It acts as a permanent market maker.
   - The **Orderbook** is activated. Users can trade **ERC1155 OutcomeTokens**.
   - **Post-Graduation Locking**: Sell proceeds still locked 24h (same as pre-graduation)
   - **Important**: There is **NO** migration of AMM positions to Orderbook tokens. AMM shares remain in the AMM; Orderbook tokens are minted via user matching.


### 2.1 Market Creation
**Actor**: Any User
**Contract**: `LaunchpadFactory`

#### UI Components
- **Create Market Page** (`/create`): Form to input market details.
  - `Name` (string)
  - `Symbol` (string, e.g. "YES-TRUMP")
  - `Description` (string)
  - `Liquidity Tier` (Select: $100, $1k, $10k, $100k)
  - `End Type` (Radio: Fixed Deadline vs Open Ended)
  - `Duration` (timestring, relevant if Fixed Deadline)

#### Interactions
1. **Approve USDC**: User must approve Factory to spend `tierDeposit`.
2. **Create Market**: Call `factory.createMarket(...)`.
   - **V6**: Returns `(market, address(0))` (no separate lpVault - market is its own vault)
   - **Events**: Listen for `MarketCreated(market, creator, lpVault, ...)` to redirect user to the new market page.

#### Data Requirements
- `factory.tierDeposits(index)`: Fetch required USDC for selected tier.
- `factory.tierBValues(index)`: Display initial liquidity depth.

---

### 2.2 Market Detail Page (`/market/:address`)
**Contract**: `LaunchpadMarket` (Use `LaunchpadMarket` ABI)

#### Header / Status
Display specialized badges based on state:
- **"🔥 Bonding"**: When `!isGraduated` and `isLive`.
- **"🎓 Graduated"**: When `isGraduated`.
- **"⏰ Expired"**: When `!isLive` and `!isGraduated` (Refund mode).

#### Bonding Curve Progress
- **Progress Bar**: Show progress towards graduation.
  - **Current**: `market.bBase()`
  - **Target**: `market.graduationThreshold()`
  - **Percentage**: `(bBase / threshold) * 100`

#### Trading
- Uses standard **V4 Logic** (`tradeAMM` via TraderVault).
- **Fees**: Display correct fee tier.
  - Pre-grad: 5% (LP Fee).
  - Post-grad: 1% (Standard).
- **V6 Locking**: All sell proceeds are locked for 24h
  - Display locked proceeds balance: `market.lockedProceeds(user)`
  - Show unlock countdown for next available proceeds
  - "Use Locked Proceeds" option when buying (calls `useLockedProceeds()`)
  - "Claim Unlocked" button when proceeds are available
- **Orderbook**: Available for post-graduation Launchpad markets only (activated after graduation).

---

### 2.3 Graduation & Expiry

#### Graduation (Success)
- **Trigger**: When bonding curve fills (`bBase >= threshold`).
- **Action**: Any user can call `market.graduate()`.
- **UI**: If threshold met but `!isGraduated`, show "🎓 Graduate Market" button.
- **V6**: Guardian can also call `forceGraduate()` if market is stuck

#### Expiry (Failure)
- **Condition**: `block.timestamp > market.deadline()` AND `!isGraduated`.
- **Action**:
  - `market.expire()`: Sets market to not live.
  - `creator.claimCreatorRefund()`: Creator reclaims deposit + fees.
- **UI**:
  - Show "Market Expired" warning.
  - If User == Creator, show "Claim Refund" button.

### 2.4 V6 Pre-Graduation Locking

#### Locked Proceeds Display
- **User's Locked Balance**: `market.lockedProceeds(user)` (total locked amount)
- **Total Market Locked**: `market.totalLockedProceeds()` (all users)
- **Lock Duration**: 24 hours per sell transaction
- **UI Elements**:
  - Show locked proceeds badge/indicator on market page
  - Display countdown timer for next unlock time
  - Show locked amount in user's trading account

#### Reinvestment (useLockedProceeds)
- **Function**: `market.useLockedProceeds(user, amount)`
- **Purpose**: Use locked proceeds to buy shares without withdrawing first
- **UI Flow**:
  1. User initiates buy order
  2. If user has locked proceeds, show "Use Locked Proceeds" toggle
  3. When enabled, use locked proceeds first, then remaining from available balance
  4. Call `useLockedProceeds()` via TraderVault before executing trade
- **Restrictions**:
  - Can only use locked proceeds within the same market
  - FIFO order (oldest locks used first)

#### Claiming Unlocked Proceeds
- **Function**: `market.claimUnlocked(user, recipient)` (called via TraderVault)
- **Trigger**: When lock time expires (24h after sell)
- **UI**:
  - Show "Claim Unlocked Proceeds" button when available
  - Display unlock countdown timer
  - Show available amount to claim

---

## 3. Data Integration

### 3.1 useLaunchpadFactory Hook
```typescript
function useLaunchpadFactory() {
  return {
    tierDeposits: bigint[];      // 4 tiers
    tierBValues: bigint[];       // 4 tiers
    createMarket: (params) => Promise<void>;
    isCreatePending: boolean;
  };
}
```

### 3.2 useLaunchpadMarket Hook
```typescript
function useLaunchpadMarket(address: `0x${string}`) {
  return {
    isGraduated: boolean;
    graduationThreshold: bigint;
    bBase: bigint;
    deadline: number;
    creator: `0x${string}`;
    isLive: boolean;
    feesAccrued: bigint;         // Track accumulated fees
    totalLockedProceeds: bigint; // V6: Total locked proceeds in market
    // V6 Locking
    lockedProceeds: bigint;      // V6: User's locked proceeds
    nextUnlockTime: number | null; // V6: Next unlock timestamp
    useLockedProceeds: (amount: bigint) => Promise<void>; // V6: Reinvest locked proceeds
    claimUnlocked: () => Promise<void>; // V6: Claim unlocked proceeds
    // Actions
    graduate: () => void;
    expire: () => void;
    claimCreatorRefund: () => void;
  };
}
```

### 3.2.1 useLockedProceeds Hook (V6)
```typescript
function useLockedProceeds(marketAddress: `0x${string}`, userAddress: `0x${string}`) {
  return {
    totalLocked: bigint;         // Total locked proceeds
    availableToClaim: bigint;    // Amount that can be claimed now
    nextUnlockTime: number | null; // Next unlock timestamp
    locks: LockEntry[];          // Array of lock entries with amounts and unlock times
    isLoading: boolean;
    refetch: () => void;
  };
}
```

### 3.3 useLaunchpadMarkets Hook
```typescript
function useLaunchpadMarkets() {
  return {
    markets: LaunchpadMarketData[];
    isLoading: boolean;
    refetch: () => void;
  };
}
```

### 3.4 ABIs
Located in `apps/web/src/config/abis.ts`:
- `LAUNCHPAD_FACTORY_ABI` - V6: Includes `protocolConfig()` view
- `LAUNCHPAD_MARKET_ABI` - V6: Includes `lockedProceeds()`, `totalLockedProceeds()`, `useLockedProceeds()`, `claimUnlocked()`
- `PROTOCOL_CONFIG_ABI` - V6: For guardian and liquidation fee configuration

### 3.5 V6 Architecture Changes
- **Market as Vault**: Market implements `ISoothLiquidityVault` itself
  - `market.lpVault()` returns `address(0)` (no separate contract)
  - `market.totalAssets()` returns `_asset.balanceOf(address(market))`
- **Factory**: Immutable with `ProtocolConfig` reference
  - `factory.protocolConfig()` returns ProtocolConfig address
- **Locking**: All sell proceeds locked during both pre and post-graduation

---

## 4. Design Guidelines
- **Pump.fun Aesthetic**: High energy, clear progress bars, trending leaderboard.
- **Risk Warnings**: Clearly label Launchpad markets vs Standard. "This market has not graduated yet."
- **V6 Locking Warnings**: 
  - "Sell proceeds are locked for 24h"
  - "You can reinvest locked proceeds without waiting"
  - Show clear distinction between locked and available balances
- **Gamification**: Celebrate graduation with visual feedback.

## 5. V6 UI Components

### 5.1 Locked Proceeds Display
- **Trading Account Card**: Show locked proceeds balance
- **Market Detail Page**: Display total locked proceeds for market
- **Buy Flow**: Toggle to "Use Locked Proceeds" when user has locked balance
- **Countdown Timer**: Show time until next unlock

### 5.2 Reinvestment Flow
1. User initiates buy
2. Check if `lockedProceeds > 0`
3. If yes, show toggle: "Use Locked Proceeds ($X.XX available)"
4. When enabled, calculate: `useAmount = min(lockedProceeds, tradeCost)`
5. Call `useLockedProceeds(user, useAmount)` before trade
6. Remaining cost from available balance

### 5.3 Claim Unlocked Flow
1. Check `nextUnlockTime <= block.timestamp`
2. Show "Claim Unlocked Proceeds" button
3. Display available amount
4. Call `claimUnlocked()` via TraderVault

---

*Last updated: 2025-12-17 (V6)*
