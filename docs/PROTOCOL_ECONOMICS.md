# Understanding Sooth Protocol Economics

## The Key Relationships

This document explains how `bMarket`, USDC TVL, LP tokens, vault TVL, and exchange rates all relate in the Sooth Protocol.

---

## 1. The Vault: LP Shares & TVL

### Exchange Rate: **1:1 (Always)**

The `SoothVault` uses a **fixed 1:1 exchange rate** between USDC and LP shares:

```solidity
// From SoothVault.sol
function convertToShares(uint256 assets) external pure returns (uint256) {
    return assets; // 1:1 conversion
}

function convertToAssets(uint256 shares) external pure returns (uint256) {
    return shares; // 1:1 conversion
}
```

**Example:**

- Deposit 100,000 USDC → Receive 100,000 svTokens (LP shares)
- Redeem 50,000 svTokens → Receive 50,000 USDC

### Why 1:1?

Unlike typical AMM vaults (Uniswap, Curve) where share value fluctuates based on trading fees:

- **No trading fees accrue to LPs** in Sooth (fees go to protocol/operators)
- **PnL is socialized** - when traders win, vault loses; when traders lose, vault gains
- **Shares track total vault value** directly

### Vault TVL Components

```
Total Vault TVL = Treasury + Liquid Buffer
                = totalAssets
```

Where:

- **Treasury**: Funds backing active market exposure
- **Liquid Buffer**: Idle funds available for new markets or withdrawals

```
Available for Withdrawal = totalAssets - totalLockedExposure
```

---

## 2. The Risk Manager: Computing `bGlobal`

### Formula

```solidity
// From SoothRiskManager.sol (lines 79-102)
T = vault.getTreasuryBalance() * decimalsScale  // Normalized to 18 decimals
B = vault.getLiquidBufferBalance() * decimalsScale
K = maxConcurrentWorstCase  // Default: 10

Lmax = (T + B) / K
bGlobal = Lmax * 1.4427  // Approximation of Lmax / ln(2)
```

### What This Means

**`bGlobal`** represents the **global liquidity depth** for pricing across all markets.

**Intuition:**

- Higher `bGlobal` → Prices move slower (more liquidity)
- Lower `bGlobal` → Prices move faster (less liquidity)

**Example Calculation:**

```
Vault TVL = 100,000 USDC (18 decimals: 100,000e18)
K = 10 markets

Lmax = 100,000e18 / 10 = 10,000e18
bGlobal = 10,000e18 * 1.4427 ≈ 14,427e18
```

---

## 3. Per-Market `b`: Risk-Adjusted Liquidity

### Formula

```solidity
// From SoothRiskManager.sol (lines 104-108)
bMarket = bGlobal * riskMultiplier / 10000
```

### Risk Class Multipliers

| Risk Class | Multiplier       | Effect on `b`       |
| ---------- | ---------------- | ------------------- |
| LOW        | 60% (6000 bps)   | `b = 0.6 * bGlobal` |
| MEDIUM     | 100% (10000 bps) | `b = 1.0 * bGlobal` |
| HIGH       | 140% (14000 bps) | `b = 1.4 * bGlobal` |
| CRITICAL   | 180% (18000 bps) | `b = 1.8 * bGlobal` |

**Example:**

```
bGlobal = 14,427e18
Market Risk Class = MEDIUM (100%)

bMarket = 14,427e18 * 10000 / 10000 = 14,427e18
```

### Why Risk-Adjust?

- **LOW risk** markets (e.g., "Will sun rise tomorrow?") → Lower `b` → Prices move faster to discourage mispricing
- **HIGH risk** markets (e.g., "Will X happen by Y date?") → Higher `b` → More liquidity depth to handle volatility

---

## 4. How `bMarket` Affects Pricing

### With `SoothBalancedAMM`

```solidity
// From SoothBalancedAMM.sol
price_yes = 0.5 + (qYes - qNo) / (2 * bMarket)
```

**Example:**

```
bMarket = 14,427e18
qYes = 1,100e18
qNo = 1,000e18

price_yes = 0.5 + (100e18) / (2 * 14,427e18)
          = 0.5 + 100 / 28,854
          = 0.5 + 0.00346
          ≈ 0.50346 (50.346%)
```

**Buying 10 shares:**

```
price_before ≈ 0.50346
price_after = 0.5 + (110) / 28,854 ≈ 0.50381

avg_price = (0.50346 + 0.50381) / 2 ≈ 0.50364
cost = 10 * 0.50364 ≈ 5.036 USDC
```

### Key Insight

**Larger `bMarket` → Smaller price impact per share traded**

This is why with `bMarket ≈ 14,427e18`, buying 10 shares only moves the price by ~0.0004 (0.04%).

---

## 5. The Complete Flow: USDC → LP Shares → `b` → Pricing

### Step-by-Step Example

**Initial State:**

```
1. LP deposits 100,000 USDC
   → Receives 100,000 svTokens (1:1)
   → Vault TVL = 100,000 USDC
```

**Risk Manager Calculates `bGlobal`:**

```
2. updateGlobalB() is called
   T + B = 100,000 USDC
   K = 10
   Lmax = 100,000 / 10 = 10,000
   bGlobal = 10,000 * 1.4427 ≈ 14,427 USDC
```

**Market Creation:**

```
3. Create MEDIUM risk market
   bMarket = 14,427 * 100% = 14,427 USDC

   Market initializes with:
   qYes = 1,000
   qNo = 1,000
   price_yes = 0.5 (50%)
```

**Trading:**

```
4. Trader buys 10 YES shares
   Cost ≈ 5 USDC (at ~0.50 per share)

   New state:
   qYes = 1,010
   qNo = 1,000
   price_yes ≈ 0.50173 (50.173%)
```

**Vault Impact:**

```
5. Vault receives 5 USDC from trader
   Vault TVL = 100,005 USDC

   LP shares still = 100,000
   (Share value unchanged at 1:1)
```

---

## 6. Virtual TVL vs Actual TVL

### Actual TVL

```
Actual TVL = vault.totalAssets()
           = Sum of all USDC in the vault
```

### "Virtual TVL" for Pricing

```
Virtual TVL = bGlobal / 1.4427 * K
            = Lmax * K
            = T + B
            = Actual TVL (they're the same!)
```

**There is no separate "virtual TVL"** - the pricing parameter `b` is derived directly from actual vault TVL.

---

## 7. Key Formulas Summary

### Vault

```
LP Shares = USDC Deposited (1:1)
Withdrawable = totalAssets - totalLockedExposure
```

### Risk Manager

```
Lmax = (Treasury + Buffer) / K
bGlobal = Lmax * 1.4427
bMarket = bGlobal * riskMultiplier
```

### Pricing (BalancedAMM)

```
price_yes = 0.5 + (qYes - qNo) / (2 * bMarket)
cost = avg_price * deltaShares
```

---

## 8. Important Notes

### Decimals Normalization

The vault handles tokens with different decimals (e.g., USDC with 6 decimals):

```solidity
decimalsScale = 10^(18 - assetDecimals)

// For USDC (6 decimals):
decimalsScale = 10^12

// When calculating bGlobal:
T = T_raw * decimalsScale  // Convert to 18 decimals for pricing
```

This ensures pricing calculations are always in 18-decimal precision, regardless of the underlying token.

### LP Share Value

Unlike AMMs with trading fees:

- **No impermanent loss** (shares always 1:1)
- **No fee accrual** to LP shares
- **PnL risk** - if traders win big, vault (and thus LPs) lose

### Exchange Rate Stability

The 1:1 exchange rate is maintained because:

1. No fees compound into share value
2. PnL is applied directly to `totalAssets`
3. Shares are minted/burned 1:1 with deposits/withdrawals

---

## 9. Example Scenario: Full Lifecycle

```
Day 1: LP Deposits
- Alice deposits 100,000 USDC
- Receives 100,000 svTokens
- Vault TVL = 100,000 USDC
- bGlobal = 14,427 USDC

Day 2: Market Created
- MEDIUM risk market created
- bMarket = 14,427 USDC
- Initial state: (1000, 1000)

Day 3: Trading Activity
- Bob buys 100 YES shares for ~50 USDC
- Market state: (1100, 1000)
- Vault TVL = 100,050 USDC

Day 4: Market Settles (YES wins)
- Bob's 100 shares worth 100 USDC
- Bob profits: 100 - 50 = 50 USDC
- Vault pays Bob 100 USDC
- Vault TVL = 100,050 - 100 = 99,950 USDC

Day 5: Alice Withdraws
- Alice redeems 100,000 svTokens
- Receives 99,950 USDC (lost 50 USDC to Bob's win)
- Exchange rate still 1:1, but total assets decreased
```

---

## Questions?

- **Q: Why not use dynamic exchange rates like Uniswap?**

  - A: Simpler accounting, no fee compounding, PnL is transparent

- **Q: Can `bGlobal` change?**

  - A: Yes! It updates when vault TVL changes or when `updateGlobalB()` is called

- **Q: What happens if vault runs out of money?**

  - A: Withdrawals are limited to `totalAssets - totalLockedExposure`

- **Q: Why use `K = 10`?**
  - A: Assumes worst case: 10 markets all hit max loss simultaneously
