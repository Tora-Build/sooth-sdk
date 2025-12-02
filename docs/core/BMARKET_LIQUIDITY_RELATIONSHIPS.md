# Understanding bMarket, Virtual Liquidity, LP Tokens, and Vault TVL

## Overview

This document explains the relationships between the key financial metrics in the Sooth Protocol, particularly focusing on how the `b` parameter (bMarket) relates to vault liquidity, LP token amounts, and total value locked (TVL).

---

## 1. Core Components

### 1.1 Vault TVL (Total Value Locked)

The vault holds all collateral tokens deposited by liquidity providers:

```solidity
// SoothVault.sol
uint256 public totalAssets;  // Total TVL in the vault
```

**Key Points:**

- All LP deposits go into a **single shared vault**
- No tokens are transferred to individual markets
- TVL = Sum of all LP deposits - Sum of all LP withdrawals + Settlement PnL

---

### 1.2 LP Token Amount (Vault Shares)

LPs receive **ERC20 share tokens** (svToken) when they deposit:

```solidity
// SoothVault.sol
uint256 public totalSupply;              // Total LP tokens in circulation
mapping(address => uint256) public balanceOf;  // LP token balance per user
```

**Exchange Rate:**

```
1 LP Token (svToken) = 1 Collateral Token (1:1 ratio)
```

This is a **simplified 1:1 exchange rate** for the alpha version. The vault implements ERC4626 standard with:

```solidity
function convertToShares(uint256 assets) external pure returns (uint256) {
    return assets; // 1:1 conversion
}

function convertToAssets(uint256 shares) external pure returns (uint256) {
    return shares; // 1:1 conversion
}
```

**Example:**

- Alice deposits 10,000 USDC → Receives 10,000 svToken
- Bob deposits 5,000 USDC → Receives 5,000 svToken
- Total TVL = 15,000 USDC
- Total LP tokens = 15,000 svToken

---

### 1.3 Virtual Liquidity (Locked Exposure)

Markets don't hold tokens directly. Instead, they **reserve capacity** in the vault:

```solidity
// SoothVault.sol
mapping(uint256 => uint256) public lockedExposure;  // Per-market locked exposure
uint256 public totalLockedExposure;                 // Total locked across all markets
```

**Virtual Liquidity Breakdown:**

- **Treasury Balance (T)**: `totalAssets` - Total TVL
- **Locked Exposure**: `totalLockedExposure` - Reserved for active markets
- **Liquid Buffer (B)**: `totalAssets - totalLockedExposure` - Available for new markets/withdrawals

```solidity
function getTreasuryBalance() external view returns (uint256) {
    return totalAssets;  // T
}

function getLiquidBufferBalance() external view returns (uint256) {
    return totalAssets - totalLockedExposure;  // B
}
```

---

## 2. The bMarket Calculation Chain

### 2.1 Step 1: Calculate Lmax (Maximum Loss per Market)

```solidity
// SoothRiskManager.sol - updateGlobalB()
uint256 T = vault.getTreasuryBalance() * decimalsScale;
uint256 B = vault.getLiquidBufferBalance() * decimalsScale;
uint256 K = globalRisk.maxConcurrentWorstCase;  // Default: 10

uint256 Lmax = (T + B) / K;
```

**What is Lmax?**

- Maximum loss the vault can tolerate per market
- Calculated by dividing total available liquidity by K (max concurrent worst-case scenarios)
- Higher TVL → Higher Lmax → More capacity per market

**Example:**

```
TVL (T) = 100,000 USDC (normalized to 18 decimals)
Locked (L) = 20,000 USDC
Buffer (B) = 80,000 USDC
K = 10

Lmax = (100,000 + 80,000) / 10 = 18,000 USDC per market
```

---

### 2.2 Step 2: Calculate bGlobal

```solidity
// SoothRiskManager.sol - updateGlobalB()
uint256 LN2_INV_BPS = 14427;  // 1/ln(2) ≈ 1.4427 in basis points
uint256 bGlobal = Lmax * LN2_INV_BPS / 1e4;
```

**What is bGlobal?**

- Global liquidity parameter for the LMSR (Logarithmic Market Scoring Rule) AMM
- Derived from Lmax using the formula: `bGlobal ≈ Lmax / ln(2)`
- Controls the **base liquidity depth** across all markets

**Mathematical Relationship:**

```
bGlobal = Lmax × 1.4427
bGlobal ≈ Lmax / 0.693
```

**Example:**

```
Lmax = 18,000 USDC
bGlobal = 18,000 × 1.4427 = 25,968.6 USDC
```

---

### 2.3 Step 3: Calculate bMarket (Per-Market b Parameter)

```solidity
// SoothRiskManager.sol - getBForMarket()
function getBForMarket(uint256 marketId) external view returns (uint256) {
    RiskClass cls = marketRiskClass[marketId];
    RiskClassConfig storage cfg = riskClassConfigs[cls];
    return (globalRisk.bGlobal * cfg.multiplierBps) / 1e4;
}
```

**Risk Class Multipliers:**

```
LOW:      6000 bps (0.6x) → Lower liquidity, higher slippage
MEDIUM:  10000 bps (1.0x) → Standard liquidity
HIGH:    14000 bps (1.4x) → Higher liquidity, lower slippage
CRITICAL: 18000 bps (1.8x) → Highest liquidity
```

**Example:**

```
bGlobal = 25,968.6 USDC
Market Risk Class = MEDIUM (1.0x)

bMarket = 25,968.6 × 10000 / 10000 = 25,968.6 USDC
```

---

## 3. Complete Relationship Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    LP DEPOSITS                              │
│  Alice: 50,000 USDC → 50,000 svToken                       │
│  Bob:   30,000 USDC → 30,000 svToken                       │
│  Carol: 20,000 USDC → 20,000 svToken                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    VAULT STATE                              │
│  totalAssets (TVL):        100,000 USDC                    │
│  totalSupply (LP tokens):  100,000 svToken                 │
│  Exchange Rate:            1:1                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              VIRTUAL LIQUIDITY ALLOCATION                   │
│  Market 1 lockedExposure:  15,000 USDC                     │
│  Market 2 lockedExposure:  10,000 USDC                     │
│  totalLockedExposure:      25,000 USDC                     │
│  getLiquidBufferBalance(): 75,000 USDC                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  LMAX CALCULATION                           │
│  T (Treasury) = 100,000 USDC (normalized to 18 decimals)   │
│  B (Buffer)   = 75,000 USDC                                │
│  K            = 10 (max concurrent worst cases)            │
│                                                             │
│  Lmax = (T + B) / K = (100,000 + 75,000) / 10             │
│  Lmax = 17,500 USDC per market                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                 BGLOBAL CALCULATION                         │
│  bGlobal = Lmax × 1.4427                                   │
│  bGlobal = 17,500 × 1.4427                                 │
│  bGlobal = 25,247.25 USDC (in 18 decimal wei)             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                 BMARKET CALCULATION                         │
│  Market 1 (MEDIUM): bMarket = 25,247.25 × 1.0 = 25,247.25 │
│  Market 2 (HIGH):   bMarket = 25,247.25 × 1.4 = 35,346.15 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    AMM PRICING                              │
│  price = amm.price(state, outcomeIndex, bMarket)          │
│  cost = amm.costDelta(state, outcomeIndex, delta, bMarket)│
│                                                             │
│  Higher bMarket → Lower slippage → Better prices          │
│  Lower bMarket → Higher slippage → Worse prices           │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Exchange Rate Relationships

### 4.1 LP Token ↔ Collateral Exchange Rate

**Current Implementation (1:1 Ratio):**

```
Exchange Rate = totalAssets / totalSupply = 1.0

When depositing:
  shares_received = assets_deposited × 1

When withdrawing:
  assets_received = shares_redeemed × 1
```

**Example:**

```
Vault State:
- totalAssets = 100,000 USDC
- totalSupply = 100,000 svToken
- Exchange Rate = 100,000 / 100,000 = 1.0

Alice deposits 5,000 USDC:
- Shares received = 5,000 × 1.0 = 5,000 svToken
- New totalAssets = 105,000 USDC
- New totalSupply = 105,000 svToken
- Exchange Rate = 105,000 / 105,000 = 1.0 (unchanged)
```

### 4.2 Why 1:1 Exchange Rate?

The current implementation uses a **simplified 1:1 exchange rate** because:

1. **No yield generation**: The vault doesn't earn interest or fees (yet)
2. **Direct PnL application**: Settlement profits/losses directly adjust `totalAssets`
3. **Shared risk model**: All LPs share gains and losses proportionally

**Future Enhancement:**
In a production system, the exchange rate could become dynamic:

```
Exchange Rate = (totalAssets + unrealized_pnl) / totalSupply
```

This would allow:

- LPs joining later to pay a premium if the vault is profitable
- LPs to receive fewer shares if the vault has losses

---

### 4.3 TVL ↔ bMarket Exchange Rate

**The relationship is NOT a direct exchange rate, but a scaling function:**

```
bMarket = f(TVL, lockedExposure, K, riskClass)

Where:
  f(TVL, locked, K, risk) = ((TVL + (TVL - locked)) / K) × 1.4427 × riskMultiplier
```

**Key Insights:**

1. **Linear Scaling with TVL:**

   - If TVL doubles → Lmax doubles → bGlobal doubles → bMarket doubles
   - If TVL halves → bMarket halves

2. **Inverse Scaling with Locked Exposure:**

   - More locked exposure → Lower buffer (B) → Lower Lmax → Lower bMarket
   - Less locked exposure → Higher buffer → Higher bMarket

3. **Inverse Scaling with K:**
   - Higher K → Lower Lmax per market → Lower bMarket
   - Lower K → Higher Lmax per market → Higher bMarket

**Example Scenarios:**

| Scenario  | TVL  | Locked | K   | Lmax  | bGlobal | bMarket (1.0x) |
| --------- | ---- | ------ | --- | ----- | ------- | -------------- |
| Base      | 100k | 25k    | 10  | 17.5k | 25,247  | 25,247         |
| 2x TVL    | 200k | 25k    | 10  | 37.5k | 54,101  | 54,101         |
| High Lock | 100k | 75k    | 10  | 12.5k | 18,034  | 18,034         |
| Low K     | 100k | 25k    | 5   | 35k   | 50,495  | 50,495         |

---

## 5. Decimals Normalization

### 5.1 Why Normalize?

Different tokens have different decimal places:

- USDC: 6 decimals (1 USDC = 1,000,000 units)
- DAI: 18 decimals (1 DAI = 1,000,000,000,000,000,000 units)

Without normalization, pricing would be incorrect.

### 5.2 How It Works

```solidity
// SoothVault.sol - constructor
uint8 assetDecimals = IERC20Metadata(address(_asset)).decimals();
decimalsScale = 10 ** (18 - assetDecimals);
```

**Scaling Examples:**

```
18-decimal token (DAI):
  decimalsScale = 10^(18-18) = 1 (no scaling needed)

6-decimal token (USDC):
  decimalsScale = 10^(18-6) = 10^12 = 1,000,000,000,000
```

### 5.3 Application in bGlobal Calculation

```solidity
// SoothRiskManager.sol - updateGlobalB()
uint256 T_raw = vault.getTreasuryBalance();  // Raw token units
uint256 B_raw = vault.getLiquidBufferBalance();
uint256 scale = vault.decimalsScale();

// Normalize to 18 decimals for pricing
uint256 T = T_raw * scale;
uint256 B = B_raw * scale;

uint256 Lmax = (T + B) / K;
uint256 bGlobal = Lmax * LN2_INV_BPS / 1e4;
```

**Example with 6-decimal USDC:**

```
Raw Values:
- T_raw = 100,000,000,000 (100k USDC in 6 decimals)
- B_raw = 75,000,000,000 (75k USDC in 6 decimals)
- scale = 10^12

Normalized Values:
- T = 100,000,000,000 × 10^12 = 100,000 × 10^18 (18 decimals)
- B = 75,000,000,000 × 10^12 = 75,000 × 10^18 (18 decimals)

Calculation:
- Lmax = (100,000 + 75,000) × 10^18 / 10 = 17,500 × 10^18
- bGlobal = 17,500 × 10^18 × 1.4427 = 25,247.25 × 10^18
```

**Important:** The vault stores values in **raw token units**, but the risk manager uses **normalized 18-decimal values** for all pricing calculations.

---

## 6. Impact on Trading

### 6.1 How bMarket Affects Prices

The LMSR AMM uses bMarket to calculate prices:

```
price_yes = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
```

**Higher bMarket:**

- More liquidity depth
- Lower slippage
- Prices move less per trade
- Better for large trades

**Lower bMarket:**

- Less liquidity depth
- Higher slippage
- Prices move more per trade
- Worse for large trades

### 6.2 Example: Price Impact

```
Market State: qYes = 0, qNo = 0 (balanced)
Trade: Buy 100 YES shares

With bMarket = 50,000:
- Cost ≈ 5,000 USDC
- Price impact ≈ 10%

With bMarket = 25,000:
- Cost ≈ 5,500 USDC
- Price impact ≈ 11%

With bMarket = 10,000:
- Cost ≈ 6,500 USDC
- Price impact ≈ 13%
```

---

## 7. Dynamic Updates

### 7.1 When bGlobal Changes

`bGlobal` should be updated when vault liquidity changes significantly:

```typescript
// After LP deposits
await vault.deposit(amount, receiver);
await riskManager.updateGlobalB();

// After LP withdrawals
await vault.withdraw(amount, receiver, owner);
await riskManager.updateGlobalB();

// After market settlement
await settlement.claimSettlement(...);
await riskManager.updateGlobalB();
```

### 7.2 Monitoring Changes

```typescript
// Listen to bGlobal updates
riskManager.on("GlobalBUpdated", (bGlobal, Lmax, T, B) => {
  console.log(`New bGlobal: ${ethers.formatUnits(bGlobal, 18)}`);
  console.log(`Lmax: ${ethers.formatUnits(Lmax, 18)}`);
  console.log(`Treasury: ${ethers.formatUnits(T, 18)}`);
  console.log(`Buffer: ${ethers.formatUnits(B, 18)}`);
});
```

---

## 8. Summary Table

| Metric                  | Symbol  | Formula                | Meaning                     |
| ----------------------- | ------- | ---------------------- | --------------------------- |
| **Vault TVL**           | T       | `totalAssets`          | Total collateral in vault   |
| **LP Tokens**           | S       | `totalSupply`          | Total share tokens issued   |
| **Exchange Rate**       | R       | `T / S`                | Currently 1:1               |
| **Locked Exposure**     | L       | `totalLockedExposure`  | Reserved for active markets |
| **Liquid Buffer**       | B       | `T - L`                | Available for new markets   |
| **Max Loss per Market** | Lmax    | `(T + B) / K`          | Risk capacity per market    |
| **Global b Parameter**  | bGlobal | `Lmax × 1.4427`        | Base liquidity parameter    |
| **Market b Parameter**  | bMarket | `bGlobal × multiplier` | Market-specific liquidity   |

---

## 9. Key Takeaways

1. **LP tokens have a 1:1 exchange rate** with collateral (simplified for alpha)
2. **TVL directly scales bMarket** - more deposits = higher liquidity = lower slippage
3. **Virtual liquidity** means markets don't hold tokens, they reserve capacity
4. **bMarket controls trading slippage** - higher b = better prices for traders
5. **Decimals normalization** ensures consistent pricing across different tokens
6. **Dynamic updates** keep bMarket in sync with vault liquidity changes

---

## 10. Frontend Integration Checklist

- [ ] Display vault TVL: `vault.totalAssets()`
- [ ] Display user LP balance: `vault.balanceOf(user)`
- [ ] Display exchange rate: `totalAssets / totalSupply` (currently 1.0)
- [ ] Display available liquidity: `vault.getLiquidBufferBalance()`
- [ ] Fetch bMarket for pricing: `riskManager.getBForMarket(marketId)`
- [ ] Update bGlobal after deposits/withdrawals
- [ ] Show utilization: `(totalLockedExposure / totalAssets) × 100%`
- [ ] Monitor `GlobalBUpdated` events for real-time updates

---

**Last Updated:** 2025-11-30
**Version:** Alpha v1.0
