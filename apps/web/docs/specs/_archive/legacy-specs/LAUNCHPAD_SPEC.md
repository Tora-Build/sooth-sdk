# Launchpad Frontend Specification (V7 Dual-Engine + Adjudicator Settlement)

## 1. Overview
The **Sooth Launchpad (V6+ / staged V7)** introduces a permissionless market creation flow inspired by "pump.fun", allowing any user to deploy a prediction market. These markets start with a bonding curve liquidity model (accruing fees to liquidity) and "graduate" to post-graduation phase upon reaching a liquidity threshold. All markets are Launchpad markets—there are no separate "standard markets" (see ADR-016).

**V7 doctrine (must always hold)**:
- **Dual-engine separation**
  - **AMM (LMSR)**: updates `qYes/qNo`; trades create internal AMM positions only.
  - **Orderbook (OB)**: produces fully-collateralized complete-set tokens; OB fills must not mutate LMSR state.
- **No direct swap**: `LaunchpadMarket.swap()` is intentionally disabled (reverts).
- **Adjudicator-only settlement**: market resolution is only via `finalizeResolution(outcome, tStar)` called by `market.adjudicator()`.
- **No creator-only refunds**: expiry/failure redemption uses pro-rata LP redemption (`redeemLP`).

**Current Key Features**:
- **Pre-Graduation Locking**: All sell proceeds are locked (24h) during pre-graduation phase
- **Reinvestment**: Locked proceeds can be used to buy shares via `useLockedProceeds()`
- **2-Contract Architecture**: Market implements `ISoothLiquidityVault` itself (market is its own vault)
- **AMM Trading via TraderVault**: Users trade AMM via `SoothTraderVaultV4` (no direct `market.swap()`)
- **Dual-Engine Boundary**: AMM positions are internal; orderbook uses ERC1155 outcome tokens
- **Honest Floor Accounting**: LP ExRate based on `totalNetAssets()` (cash - locked - liability)
- **Safe Parity Minting**: LP tokens minted at `max(Current ExRate, 1.0)` to prevent dilution
- **Guardian Role**: Protocol-managed guardian for liquidation and forced graduation
- **Adjudicator Settlement**: Markets finalize via `finalizeResolution(outcome, T*)`

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
2. **Create Market**: Call `factory.createMarket(..., marketAdjudicator)`.
   - **V7**: `marketAdjudicator` is an address. `address(0)` uses the factory default. Non-zero must be allowlisted by `factory.adjudicatorRegistry()`.
   - Returns `(market, address(0))` (no separate lpVault - market is its own vault)
   - **Events**: Listen for `MarketCreated(market, creator, lpVault, ...)` to redirect user to the new market page.

#### Data Requirements
- Prefer view helpers:
  - `factory.getRequiredDeposit(tierIndex)` (asset decimals; typically USDC=6)
  - `factory.getLiquidityB(tierIndex)` (WAD 18)
- Adjudicator config:
  - `factory.defaultAdjudicator()`
  - `factory.adjudicatorRegistry()`

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

#### Trading (AMM via TraderVault)
- **AMM Trading**: Uses `SoothTraderVaultV4.tradeAMM(...)` (or `depositAndTradeAMM(...)`)
  - Users approve USDC to `TraderVault` (not `LaunchpadMarket`)
  - `market.swap()` is disabled (reverts) to preserve AMM/Orderbook separation
  - AMM trades update **internal AMM positions** (no ERC1155 mint/burn)
- **Orderbook Trading**: Uses `TraderVault` order functions and ERC1155 `OutcomeToken`
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
- **Stage 1 UX**: Once the market ends (`!isLive`), show “Claim Locked (Market End)” which calls:
  - `market.claimLockedOnMarketEnd(maxSteps)` (bypasses the timer; claims in batches)
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
  - **LP redemption/refunds**: LP holders redeem pro-rata via `redeemLP(...)` (creator is just an LP)
- **UI**:
  - Show "Market Expired" warning.
  - Show "Redeem LP" action for LP holders.

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

## 2.5 LP Economics (V6.1.9 Pure AMM Accounting)

### Isolated Ledger Model
LP token value is based on a **Pure AMM Ledger**, derived entirely from AMM state variables. This enforces the principle that **Liability is not shared** between the AMM and the Orderbook.

#### 1. AMM Cash Bucket
The theoretical cash owned by LPs is calculated as:
```
AMM_Cash = Initial_Seed + Fees + (Current_LMSR_Cost - Initial_LMSR_Cost)
```
- **Initial_Seed**: Creator's deposit (`b * ln(2)`).
- **Fees**: Cumulative spreads captured by the AMM.
- **Cost Delta**: The net cash flow from trader swaps.

#### 2. Isolated Floor & Ceiling
```
LP Floor = AMM_Cash - Max(qYES, qNO)
LP Ceiling = AMM_Cash - Min(qYES, qNO)
```
- **Max Liability**: The maximum payout the AMM must make at settlement.
- **Self-Collateralization**: Orderbook tokens are ignored in this ledger because they are fully backed by their own user deposits.

### LP ExRate Calculation
```
LP ExRate = Pure Floor / LP Supply
```
- Displayed as a multiplier (e.g., `1.717x`)
- Represents guaranteed floor value per LP token.
- Stable through Orderbook volume spikes.

### Fair Minting (Anti-Dilution)
When traders pay fees, they receive LP tokens at the **current floor price**:

```solidity
// If ExRate >= 1.0 (healthy pool):
lpToMint = (fee * supply) / preFeeAssets

// If ExRate < 1.0 (underwater pool):
lpToMint = fee  // 1:1 parity fallback
```

### Market Detail Metrics

| Metric | Label | Calculation | Notes |
|--------|-------|-------------|-------|
| **TVL (Floor Equity)** | Main headline | `Isolated Floor` | Derived from AMM state |
| **AMM Ledger** | Stats Breakdown | `AMM_Cash` | Theoretical cash position |
| **AMM Liability** | Stats Breakdown | `Max(qYES, qNO)` | LP's isolated debt |
| **LP Supply** | Stats Grid | `totalSupply()` | LP tokens in existence |
| **LP ExRate** | Stats Grid | `Floor / Supply` | Range: (Floor - Ceiling) |
| **Max Loss** | Stats Grid | `b * ln(2)` | AMM solvency limit |

### LP Payout Simulation

| Scenario | Calculation | Description |
|----------|-------------|-------------|
| **If YES Wins** | `AMM_Cash - qYES` | Residual cash if YES wins |
| **If NO Wins** | `AMM_Cash - qNO` | Residual cash if NO wins |
| **Expected** | `P(YES) * PayoutYES + P(NO) * PayoutNO` | Probability-weighted payout |

---

## 3. Data Integration

### 3.1 useLaunchpadFactory Hook
```typescript
function useLaunchpadFactory() {
  return {
    tierDeposits: bigint[];      // 4 tiers
    tierBValues: bigint[];       // 4 tiers
    defaultAdjudicator: `0x${string}`;
    adjudicatorRegistry: `0x${string}`;
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
    // Settlement (V7)
    adjudicator: `0x${string}`;
    tStar: number;

    // AMM accounting (WAD 18)
    feesAccruedWad: bigint;
    ammAssetsWad: bigint;
    pureCeilingAssetsWad: bigint;
    totalNetAssetsWad: bigint;  // Honest Floor (WAD)
    totalSupplyWad: bigint;     // LP supply (WAD)

    // Asset-decimal views (e.g. USDC=6)
    assetDecimals: number;
    decimalsScale: bigint;      // 10^(18-assetDecimals)
    totalAssets: bigint;        // cash balance (asset decimals)
    totalLockedProceeds: bigint;// asset decimals
    totalCreatorDeposit: bigint;// asset decimals
    // Outcome Token Supplies (for liability calculation)
    qYes: number;                // Total YES shares outstanding
    qNo: number;                 // Total NO shares outstanding
    // V6 Locking
    lockedProceeds: bigint;      // User's locked proceeds (asset decimals)
    nextUnlockTime: number | null;
    useLockedProceeds: (amount: bigint) => Promise<void>;
    claimUnlocked: () => Promise<void>;
    claimLockedOnMarketEnd: (maxSteps: bigint) => Promise<void>;
    // LP Value
    userLpBalance: bigint;       // User's LP token balance
    userLpValue: bigint;         // User's Protected Equity (floor value)
    // Actions
    graduate: () => void;
    expire: () => void;
    redeemLP: (amountWad: bigint) => void;
    previewRedeemLP: (amountWad: bigint) => Promise<bigint>; // returns asset decimals
  };
}
```

### 3.2.0 Decimal Conventions (Do not mix)

- **WAD (18)**: prices, AMM shares, `ammAssets()`, `totalNetAssets()`, `pureCeilingAssets()`, LP supply/balances.
- **Asset decimals** (e.g. USDC=6): `totalAssets()`, all lock amounts, and transfers in `redeemLP()` / `claimLockedOnMarketEnd()`.
- **Scale**: `decimalsScale = 10^(18 - assetDecimals)`
  - Convert WAD → asset: `asset = wad / decimalsScale`
  - Convert asset → WAD: `wad = asset * decimalsScale`

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

### 3.4 AMM Trade Hook (TraderVault)
```typescript
function useAmmTrade(marketAddress: `0x${string}`) {
  return {
    // Approval (USDC -> TraderVault)
    needsApproval: boolean;
    approve: (amount?: bigint) => Promise<boolean>;

    // Trading (signed shares; slippage via maxCost/minProceeds)
    tradeAMM: (outcome: 0 | 1, deltaSharesWad: bigint, maxCostOrMinProceeds: bigint) => Promise<void>;
    depositAndTradeAMM?: (outcome: 0 | 1, deltaSharesWad: bigint, maxCostOrMinProceeds: bigint, depositAmount: bigint) => Promise<void>;
    isPending: boolean;
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
- `LAUNCHPAD_FACTORY_ABI` - V7: `createMarket(..., marketAdjudicator)` + `defaultAdjudicator()` + `adjudicatorRegistry()`
- `LAUNCHPAD_MARKET_ABI` - Launchpad market views + LP vault interface
  - `ammAssets()` / `totalNetAssets()` / `pureCeilingAssets()` - AMM ledger in WAD
  - `totalAssets()` - cash balance (asset decimals)
  - `totalSupply()` - LP token supply
  - `lockedProceeds()`, `totalLockedProceeds()`, `claimLockedOnMarketEnd()`, `decimalsScale()`
- `TRADER_VAULT_ABI` - AMM + Orderbook entrypoint (includes `tradeAMM` / `depositAndTradeAMM`, and Stage 3 settlement root claims)
- `OUTCOME_TOKEN_ABI` - V6.1.8: Includes `totalSupply(uint256)` for liability tracking
- `PROTOCOL_CONFIG_ABI` - V6: For guardian and liquidation fee configuration

### 3.7 Architecture Notes
- **Market as Vault**: Market implements `ISoothLiquidityVault` itself
  - `market.lpVault()` returns `address(0)` (no separate contract)
  - `market.totalAssets()` returns `_asset.balanceOf(address(market))`
- **No Direct Swap**: `market.swap()` is disabled to preserve the AMM/Orderbook boundary
  - Approve USDC to `TraderVault`
  - AMM trades go through `TraderVault` and update internal AMM positions (no ERC1155 mint/burn)
- **Honest AMM Accounting (WAD)**:
  - `ammAssets()` returns pure AMM ledger in WAD.
  - `totalNetAssets()` returns the **Honest Floor** in WAD: `ammAssets - max(qYes, qNo)` (virtual liability).
  - `totalAssets()` / lock amounts remain in asset-decimals and are used for actual transfers (e.g., `redeemLP`).
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
4. Call `TraderVault.claimUnlocked(market)` (the market’s `claimUnlocked(user, recipient)` is authorized for TraderVault, not direct EOAs)

---

## 6. Files (V6.1.8)

| File | Purpose |
|------|---------|
| `pages/MarketDetail.tsx` | Full market page with stats, trading, LP leaderboard |
| `components/features/market/AmmTradingPanel.tsx` | Unified trading UI component |
| `components/features/market/LPLeaderboardCard.tsx` | LP holders display |
| `hooks/v5/useLaunchpadMarket.ts` | Market data fetching (includes `totalNetAssets`) |
| `hooks/v5/useLaunchpadSwap.ts` | **Do not use** in V7 (direct `market.swap()` is disabled) |
| `hooks/v5/useLPHolders.ts` | LP holder discovery via event logs |
| `hooks/v5/useLaunchpadTradeQuote.ts` | Quote calculation with fee split |

---

*Last updated: 2025-12-22 (V7 staged integration: adjudicator registry, safe direct trade, market-end lock claiming, settlement-root claim surfaces)*
