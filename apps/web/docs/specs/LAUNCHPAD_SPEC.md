# Launchpad V6.1.8 Frontend Specification

## 1. Overview
The **Sooth Launchpad V6** introduces a permissionless market creation flow inspired by "pump.fun", allowing any user to deploy a prediction market. These markets start with a bonding curve liquidity model (accruing fees to liquidity) and "graduate" to post-graduation phase upon reaching a liquidity threshold. All markets are Launchpad markets—there are no separate "standard markets" (see ADR-016).

**V6.1.8 Key Features**:
- **Pre-Graduation Locking**: All sell proceeds are locked (24h) during pre-graduation phase
- **Reinvestment**: Locked proceeds can be used to buy shares via `useLockedProceeds()`
- **2-Contract Architecture**: Market implements `ISoothLiquidityVault` itself (market is its own vault)
- **Direct AMM Trading**: Users call `market.swap()` directly (no TraderVault for AMM)
- **Honest Floor Accounting**: LP ExRate based on `totalNetAssets()` (cash - locked - liability)
- **Safe Parity Minting**: LP tokens minted at `max(Current ExRate, 1.0)` to prevent dilution
- **Price Cap Guardrail**: AMM enforces max $1.00 per share (LMSR precision protection)
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

#### Trading (V6.1.8 Direct Swap)
- **AMM Trading**: Uses `market.swap()` directly (NOT via TraderVault)
  - Users approve USDC to `LaunchpadMarket` contract directly
  - Call `market.swap(deltaShares, maxCost)` for buys
  - Call `market.swap(-deltaShares, -minProceeds)` for sells
  - Returns ERC1155 OutcomeToken shares to user
- **Quote Display (Price Net + Fee)**:
  - **Price (Net)**: Base cost per share from LMSR (capped at $1.00)
  - **Fee**: Separate line showing fee amount and percentage
  - **Total Cost**: Sum of net cost + fee + slippage buffer
- **Fees**: Display correct fee tier.
  - Pre-grad: 5% (LP Fee → grows liquidity depth).
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

## 2.5 LP Economics (V6.1.8 Honest Floor)

### Floor Equity Model
LP token value is based on **guaranteed floor equity**, not raw TVL:

```
Floor Equity = Gross Cash - Locked Proceeds - Max(qYES, qNO)
```

| Component | Source | Description |
|-----------|--------|-------------|
| **Gross Cash** | `market.totalAssets()` | Total USDC in vault |
| **Locked Proceeds** | `market.totalLockedProceeds()` | Locked sell proceeds (24h) |
| **Market Liability** | `max(totalSupply(0), totalSupply(1))` | Worst-case payout |

### LP ExRate Calculation
```
LP ExRate = Floor Equity / LP Supply
```
- Displayed as a multiplier (e.g., `1.7171x`)
- Represents guaranteed floor value per LP token
- Stable through settlement (no "paper profits")

### Fair Minting (Anti-Dilution)
When traders pay fees, they receive LP tokens at the **current floor price**:

```solidity
// If ExRate >= 1.0 (healthy pool):
lpToMint = (fee * supply) / preFeeAssets

// If ExRate < 1.0 (underwater pool):
lpToMint = fee  // 1:1 parity fallback
```

### Market Detail Metrics

| Metric | Label | Calculation |
|--------|-------|-------------|
| **TVL (Floor Equity)** | Main headline | `totalNetAssets()` |
| **Gross Assets** | Vault Breakdown | `totalAssets()` |
| **Market Liability** | Vault Breakdown | `max(qYES, qNO)` (red) |
| **LP Supply** | Stats card | `market.totalSupply()` (LP tokens) |
| **LP ExRate** | Stats card | `Floor Equity / LP Supply` (displayed as Xx) |
| **Max Loss** | Stats card | `b × ln(2)` ≈ `b × 0.693` |
| **Protected Equity** | LP Leaderboard | `Your LP × ExRate` |

### LP Payout Simulation

| Scenario | Calculation |
|----------|-------------|
| **If YES Wins** | `Gross Cash - Locked - qYES` |
| **If NO Wins** | `Gross Cash - Locked - qNO` |
| **Expected** | `P(YES) × PayoutYES + P(NO) × PayoutNO` |

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
    feesAccrued: bigint;         // Track accumulated fees (18 decimals)
    totalAssets: bigint;         // Gross USDC in vault (6 decimals)
    totalNetAssets: bigint;      // V6.1.8: Floor Equity (6 decimals)
    totalLockedProceeds: bigint; // V6: Total locked proceeds (6 decimals)
    totalSupply: bigint;         // LP token supply (18 decimals)
    totalCreatorDeposit: bigint; // Creator's initial deposit (6 decimals)
    // Outcome Token Supplies (for liability calculation)
    qYes: number;                // Total YES shares outstanding
    qNo: number;                 // Total NO shares outstanding
    // V6 Locking
    lockedProceeds: bigint;      // User's locked proceeds
    nextUnlockTime: number | null;
    useLockedProceeds: (amount: bigint) => Promise<void>;
    claimUnlocked: () => Promise<void>;
    // LP Value
    userLpBalance: bigint;       // User's LP token balance
    userLpValue: bigint;         // User's Protected Equity (floor value)
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

### 3.4 useLaunchpadSwap Hook (V6.1.8)
```typescript
function useLaunchpadSwap(marketAddress: `0x${string}`) {
  return {
    // Approval
    allowance: bigint;
    needsApproval: boolean;
    isApproving: boolean;
    approve: (amount?: bigint) => Promise<boolean>; // Checks existing allowance first
    
    // Trading
    swap: (deltaShares: number, isBuy: boolean, maxCost: bigint) => Promise<void>;
    isPending: boolean;
    
    // Locked Proceeds
    claimUnlocked: () => Promise<void>;
    
    // Refetch
    refetchAllowance: () => void;
  };
}
```

### 3.5 useLPHolders Hook (V6.1.8)
```typescript
function useLPHolders(marketAddress: `0x${string}`) {
  return {
    holders: {
      address: `0x${string}`;
      balance: bigint;           // LP token balance (18 decimals)
      isCreator: boolean;
    }[];
    totalSupply: bigint;
    isLoading: boolean;
  };
}
```

### 3.6 ABIs
Located in `apps/web/src/config/abis.ts`:
- `LAUNCHPAD_FACTORY_ABI` - V6: Includes `protocolConfig()` view
- `LAUNCHPAD_MARKET_ABI` - V6.1.8: Includes:
  - `swap(int128, int256)` - Direct AMM trading
  - `totalNetAssets()` - Floor Equity
  - `totalAssets()` - Gross USDC
  - `totalSupply()` - LP token supply
  - `lockedProceeds()`, `totalLockedProceeds()`, `claimUnlocked()`
- `OUTCOME_TOKEN_ABI` - V6.1.8: Includes `totalSupply(uint256)` for liability tracking
- `PROTOCOL_CONFIG_ABI` - V6: For guardian and liquidation fee configuration

### 3.7 V6.1.8 Architecture Changes
- **Market as Vault**: Market implements `ISoothLiquidityVault` itself
  - `market.lpVault()` returns `address(0)` (no separate contract)
  - `market.totalAssets()` returns `_asset.balanceOf(address(market))`
- **Direct Swap**: Users call `market.swap()` directly (TraderVault only for Orderbook)
  - Approve USDC to market contract, not TraderVault
  - 2 transactions max: Approve + Swap
- **Honest Accounting**: `totalNetAssets()` returns Floor Equity
  - Formula: `Cash - Locked - Max(qYES, qNO)`
  - Used for LP ExRate and redemption value
- **Safe Parity Minting**: LP rewards capped at 1:1 when pool is thin
  - Prevents trillion-LP explosions from precision gaps
- **Price Cap Guardrail**: `require(cost <= shares)` in `swap()`
  - Prevents LMSR from charging >$1.00 per share
- **Global Liability Tracking**: OutcomeToken extends `ERC1155Supply`
  - `outcomeToken.totalSupply(0)` = Total YES shares (AMM + Orderbook)
  - `outcomeToken.totalSupply(1)` = Total NO shares
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

## 5. V6.1.8 UI Components

### 5.1 Market Stats Card (MarketInfoCard)

| Section | Contents |
|---------|----------|
| **Vault Breakdown** | Creator Preseed, Fees Collected, AMM Floor Delta |
| **TVL (Floor Equity)** | Headline metric with breakdown (Gross - Liability) |
| **Stats Grid** | Depth (b), LP Supply, LP ExRate, Max Loss |
| **Outstanding Shares** | qYES, qNO with color coding |
| **LP Payout Simulation** | If YES Wins, If NO Wins, Expected |

### 5.2 LP Holders Card (LPLeaderboardCard)

| Element | Description |
|---------|-------------|
| **Holder List** | Address, Balance (formatted), Share % |
| **You Badge** | Highlights connected user's position |
| **Creator Badge** | Marks the market creator |
| **Protected Equity** | User's floor-adjusted LP value |
| **Help Panel** | Explains LP tokens, earning, valuation, redemption |

### 5.3 Trading Panel (AmmTradingPanel)

| Section | Elements |
|---------|----------|
| **Mode Toggle** | Buy / Sell |
| **Outcome Toggle** | YES / NO with probability display |
| **Shares Input** | +/- buttons, quick amounts (10, 50, 100, 500) |
| **Quote Summary** | Price (Net), Fee (%), Total Cost |
| **Slippage Selector** | 0.1%, 0.5%, 1%, 2% |
| **Execute Button** | "Buy YES/NO" or "Sell YES/NO" |

### 5.4 Quote Summary Display (V6.1.8)

| Label | Calculation | Notes |
|-------|-------------|-------|
| **Price (Net)** | `(totalCost - fee) / shares` | Base LMSR cost |
| **Fee** | `totalCost × feeRate` | 5% pre-grad, 1% post-grad |
| **Total Cost** | `netCost + fee + slippage` | Final amount |

### 5.5 Locked Proceeds Display
- **Trading Account Card**: Show locked proceeds balance
- **Market Detail Page**: Display total locked proceeds for market
- **Buy Flow**: Toggle to "Use Locked Proceeds" when user has locked balance
- **Countdown Timer**: Show time until next unlock

### 5.6 Reinvestment Flow
1. User initiates buy
2. Check if `lockedProceeds > 0`
3. If yes, show toggle: "Use Locked Proceeds ($X.XX available)"
4. When enabled, calculate: `useAmount = min(lockedProceeds, tradeCost)`
5. Call `useLockedProceeds(user, useAmount)` before trade
6. Remaining cost from available balance

### 5.7 Claim Unlocked Flow
1. Check `nextUnlockTime <= block.timestamp`
2. Show "Claim Unlocked Proceeds" button
3. Display available amount
4. Call `market.claimUnlocked()` directly

---

## 6. Files (V6.1.8)

| File | Purpose |
|------|---------|
| `pages/MarketDetail.tsx` | Full market page with stats, trading, LP leaderboard |
| `components/features/market/AmmTradingPanel.tsx` | Unified trading UI component |
| `components/features/market/LPLeaderboardCard.tsx` | LP holders display |
| `hooks/v5/useLaunchpadMarket.ts` | Market data fetching (includes `totalNetAssets`) |
| `hooks/v5/useLaunchpadSwap.ts` | Direct swap execution with approval management |
| `hooks/v5/useLPHolders.ts` | LP holder discovery via event logs |
| `hooks/v5/useLaunchpadTradeQuote.ts` | Quote calculation with fee split |

---

*Last updated: 2025-12-20 (V6.1.8 Safe Parity Minting)*
