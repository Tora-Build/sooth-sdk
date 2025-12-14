# Launchpad V5 Frontend Specification

## 1. Overview
The **Sooth Launchpad V5** introduces a permissionless market creation flow inspired by "pump.fun", allowing any user to deploy a prediction market. These markets start with a bonding curve liquidity model (accruing fees to liquidity) and "graduate" to standard markets upon reaching a liquidity threshold.

## 2. Core Flows

### 2.1 Market Creation
**Actor**: Any User
**Contract**: `LaunchpadFactory`

#### UI Components
- **Create Market Page**: Form to input market details.
  - `Name` (string)
  - `Symbol` (string, e.g. "YES-TRUMP")
  - `Description` (string)
  - `Liquidity Tier` (Select: $100, $1k, $10k, $100k)
  - `End Type` (Radio: Fixed Deadline vs Open Ended)
  - `Duration` (timestring, relevant if Fixed Deadline)

#### Interactions
1. **Approve USDC**: User must approve Factory to spend `tierDeposit`.
2. **Create Market**: Call `factory.createMarket(...)`.
   - **Params**:
     - `name`, `symbol`, `description`
     - `liquidityTierIndex` (0-3)
     - `isOpenEnd` (bool)
     - `durationSeconds` (uint40)
   - **Events**: Listen for `MarketCreated(market, creator, lpVault, ...)` to redirect user to the new market page.
- [x] Debug Network Fee/Creation Error
- [x] Fix USDC Approval UX
- [x] Fix ABI mismatch
- [x] Fix Circular Dependency in Contract
- [x] Implement Dynamic Market Indexing
    - [x] Create `useLaunchpadMarkets` hook
    - [x] Create/Update Market List UI
- [x] Refactor Hardcoded Tier Deposits
- [x] End-to-End Verification

#### Data Requirements
- `factory.tierDeposits(index)`: Fetch required USDC for selected tier.
- `factory.tierBValues(index)`: (Optional) Display initial liquidity depth.

---

### 2.2 Launchpad Market Page
**Contract**: `LaunchpadMarket` (Use `LaunchpadMarket` ABI)

#### Header / Status
Display specialized badges based on state:
- **"Launchpad Phase"**: When `!isGraduated` and `isLive`.
- **"Graduated"**: When `isGraduated`.
- **"Expired / Failed"**: When `!isLive` and `!isGraduated` (Refund mode).

#### Bonding Curve Progress
- **Progress Bar**: Show progress towards graduation.
  - **Current**: `market.bBase()` (Note: `b()` includes unrealized PnL, `bBase()` is the strict liquidity base).
  - **Target**: `market.graduationThreshold()`.
  - **Percentage**: `(bBase / threshold) * 100`.

#### Trading
- Uses standard **V4 Logic** (`market.tradeAMM`).
- **Fees**: Display correct fee tier.
  - Pre-grad: 5% (LP Fee).
  - Post-grad: 1% (Standard).
- **Note**: `LaunchpadMarket` inherits `SoothMarketV4`, so the standard `useMarket` hook works for basic data (prices, qYes/qNo). Use `isGraduated` to toggle Launchpad-specific UI.

---

### 2.3 Graduation & Expiry

#### Graduation (Success)
- **Trigger**: When bonding curve fills (`bBase >= threshold`).
- **Action**: Any user can call `market.graduate()`.
- **UI**: If threshold met but `!isGraduated`, show "Graduate Market" button (gamified moment).

#### Expiry (Failure)
- **Condition**: `block.timestamp > market.deadline()` AND `!isGraduated`.
- **Action**:
  - `market.expire()`: Sets market to not live.
  - `creator.claimRefund()`: Creator reclaims deposit + fees.
- **UI**:
  - Show "Market Expired" warning.
  - If User == Creator, show "Claim Refund" button.
  - Traders: Can redeem LP tokens? (Note: Current implementation limits refund to Creator. Traders should sell positions before expiry if possible, or protocol needs `redeem` path for traders. *Audit Note: Check if traders hold LP tokens or just Outcome tokens. Outcome tokens become worthless if expired? Or redeemable for portion of LPVault? Current contract refunds Creator 100%. Traders should treat pre-grad markets as high risk of expiry.*)

---

## 3. Data Integration

### 3.1 Factory Hook (`useLaunchpadFactory`)
```typescript
interface LaunchpadConfig {
  tierDeposits: BigInt[];
  tierBValues: BigInt[];
}

function useLaunchpadFactory() {
  // Read config
  // Write createMarket
}
```

### 3.2 Market Hook Extensions (`useMarket`)
Extend existing hook or creating `useLaunchpadMarket(address)`:
- `isGraduated`: bool
- `liquidityTier`: int
- `deadline`: unixtime
- `bBase`: BigInt
- `graduationThreshold`: BigInt
- `creator`: address

### 3.3 ABIs
Ensure `LaunchpadFactory.json` and `LaunchpadMarket.json` are exported to `apps/web/src/config/abis.ts`.

## 4. Design Guidelines
- **Pump.fun Aesthetic**: High energy, clear progress bars, "King of the Hill" style leaderboards for graduating markets.
- **Risk Warnings**: Clearly label Launchpad markets vs Standard markets. "This market has not graduated yet."

