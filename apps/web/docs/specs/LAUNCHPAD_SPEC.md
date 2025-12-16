# Launchpad V5 Frontend Specification

## 1. Overview
The **Sooth Launchpad V5** introduces a permissionless market creation flow inspired by "pump.fun", allowing any user to deploy a prediction market. These markets start with a bonding curve liquidity model (accruing fees to liquidity) and "graduate" to standard markets upon reaching a liquidity threshold.


> **See also**: [MARKETS_PAGE_SPEC.md](./MARKETS_PAGE_SPEC.md) for Markets list and MarketCard inline trading.

## 2. Liquidity Model (Dual Venue)
The V5 Launchpad uses a **Dual Venue** model.
1. **Bonding Phase**: Only the **AMM** is active. Users trade "virtual shares" (internal accounting). Fees are high (5%) to grow liquidity.
2. **Graduation**:
   - The **AMM** remains active but lowers fees (1%). It acts as a permanent market maker.
   - The **Orderbook** is activated. Users can trade **ERC1155 OutcomeTokens**.
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
- **Orderbook**: Available for graduated markets only.

---

### 2.3 Graduation & Expiry

#### Graduation (Success)
- **Trigger**: When bonding curve fills (`bBase >= threshold`).
- **Action**: Any user can call `market.graduate()`.
- **UI**: If threshold met but `!isGraduated`, show "🎓 Graduate Market" button.

#### Expiry (Failure)
- **Condition**: `block.timestamp > market.deadline()` AND `!isGraduated`.
- **Action**:
  - `market.expire()`: Sets market to not live.
  - `creator.claimRefund()`: Creator reclaims deposit + fees.
- **UI**:
  - Show "Market Expired" warning.
  - If User == Creator, show "Claim Refund" button.

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
    feesAccrued: bigint;         // NEW: Track accumulated fees
    graduate: () => void;
    expire: () => void;
    claimRefund: () => void;
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
- `LAUNCHPAD_FACTORY_ABI`
- `LAUNCHPAD_MARKET_ABI`

---

## 4. Design Guidelines
- **Pump.fun Aesthetic**: High energy, clear progress bars, trending leaderboard.
- **Risk Warnings**: Clearly label Launchpad markets vs Standard. "This market has not graduated yet."
- **Gamification**: Celebrate graduation with visual feedback.

---

*Last updated: 2025-12-15*
