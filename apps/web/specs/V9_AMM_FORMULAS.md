# V9 AMM Accounting & Formulas

**Version**: 9.1.0
**Last Updated**: 2025-12-29
**Status**: Current

---

## Overview

V9 inherits the LMSR (Logarithmic Market Scoring Rule) accounting from V8, with updates for the Singleton `TickBookPoolManager` architecture and **sell-side fee deduction**.

---

## 1. Core State Variables

| Symbol | Definition | Precision | Source |
| :--- | :--- | :--- | :--- |
| $q_{yes}$ | YES outcome shares outstanding | 18 decimals (WAD) | `AMMEngine.getMarketState` |
| $q_{no}$ | NO outcome shares outstanding | 18 decimals (WAD) | `AMMEngine.getMarketState` |
| $b_{base}$ | Initial liquidity depth parameter | 18 decimals (WAD) | `LaunchpadEngine.markets.bBase` |
| $b_{current}$ | Current liquidity depth (grows with fees) | 18 decimals (WAD) | `LaunchpadEngine.markets.bCurrent` |
| $S$ | Initial creator deposit (Seed) | USDC Decimals | `LaunchpadEngine.markets.creatorDeposit` |
| $F$ | Accumulated trading fees | USDC Decimals | `LaunchpadEngine.markets.feesAccrued` |
| $Y$ | Accumulated LP yield (post-grad) | USDC Decimals | `LaunchpadEngine.markets.lpYieldPool` |
| $L$ | Total LP tokens in circulation | 18 decimals (WAD) | `LaunchpadEngine.markets.totalLPSupply` |

---

## 2. LMSR Cost Function

The cost to reach a state $(q_{yes}, q_{no})$ with liquidity parameter $b$ is:

$$C(q_{yes}, q_{no}, b) = b \cdot \ln(e^{q_{yes}/b} + e^{q_{no}/b})$$

### Numerical Stability (Log-Sum-Exp)
For stable computation, use:

$$C = b \cdot \left( \max\left(\frac{q_{yes}}{b}, \frac{q_{no}}{b}\right) + \ln\left(1 + e^{-|q_{yes}/b - q_{no}/b|}\right) \right)$$

### Initial Cost (Seed)
At market creation with balanced state $(0, 0)$:

$$C(0, 0, b) = b \cdot \ln(2) \approx 0.693 \cdot b$$

The creator deposits this amount as the **Seed**.

---

## 3. Financial Formulas

### A. Swap P&L (LMSR Cost Deviation)

The AMM's profit/loss from trading activity:

$$\text{Swap P\&L} = C(q_{yes}, q_{no}, b_{current}) - C(0, 0, b_{current})$$

- **Positive P&L**: Traders have paid more than fair value (house wins)
- **Negative P&L**: Traders have received below-cost fills (house loses)

### B. Cash Basis (Gross Assets)

Reconciles all USDC inflows and trading performance:

$$\text{Gross Cash} = S + F + Y + \text{Swap P\&L}$$

| Component | Description |
| :--- | :--- |
| $S$ | Creator deposit (bBase × ln(2)) |
| $F$ | Trading fees collected |
| $Y$ | LP yield pool (post-graduation) |
| P&L | LMSR cost deviation |

### C. Liability (Worst-Case Payout)

Maximum amount the AMM must pay if all traders hold the winning outcome:

$$\text{Liability} = \max(q_{yes}, q_{no})$$

### D. Equity Floor (Honest Floor Model)

The guaranteed minimum value of the LP pool:

$$\text{Floor} = \max(0, \text{Gross Cash} - \text{Liability})$$

If Gross < Liability, the market is **underwater** (Floor = 0).

### E. Equity Ceiling (Best-Case LP Value)

The maximum LP value if the less-held outcome wins:

$$\text{Ceiling} = \text{Gross Cash} - \min(q_{yes}, q_{no})$$

### F. Valuation (Exchange Rate)

The real-time price of 1 LP token in USDC:

$$\text{Floor Rate} = \frac{\text{Floor}}{\text{LP Supply}}$$

$$\text{Ceiling Rate} = \frac{\text{Ceiling}}{\text{LP Supply}}$$

### G. Liquidity Anchor

The mathematical relationship ensuring LP supply is proportional to market depth:

$$b \cdot \ln(2) \approx \text{LP Supply}$$

At creation: `LP Supply = Seed (in WAD) = bBase × 0.693`

---

## 4. Fee Mechanics (V9.1)

### Pre-Graduation (5% default)

- **BUY**: `actualCost = baseCost + fee` (user pays extra)
- **SELL**: `netProceeds = baseCost - fee` (fee deducted from proceeds)
- 100% of fees → bBase growth + LP minting to trader

### Post-Graduation (1% default)

- Same fee calculation pattern (buy adds, sell deducts)
- Fee split: 50% bBase growth, 30% LP yield, 20% protocol

### V9.1 Sell-Side Fee Deduction

In V9.1, sell fees are deducted from the gross proceeds before the user receives payment:

```
User Sells 100 shares → baseCost = $50
Fee (5%) = $2.50
Net Proceeds = $47.50 (user receives)
```

---

## 5. Graduation Mechanics

A market "graduates" when trading fees reach a threshold:

$$\text{Threshold} = b_{base} \cdot \ln(2) \cdot \text{Multiplier}$$

$$\text{Progress} = \frac{F}{\text{Threshold}} \times 100\%$$

| Multiplier | Meaning |
| :--- | :--- |
| 1× | Graduate at LP break-even (fees = creator deposit) |
| 2× | Graduate when fees = 2× creator deposit |

**Default**: `graduationMultiplier = 1` (break-even graduation)

---

## 6. LP Token Dynamics

### Minting

**At Creation**:
```
lpTokens = bBase × ln(2)  // 1:1 with deposit in WAD
```

**Pre-Graduation (fee-based)**:
```
lpTokens = fee (in WAD)   // Minted to trader, not creator
```

### Redemption

LP redemption uses the Floor value:

$$\text{USDC Amount} = \frac{\text{Floor} \times \text{LP Amount}}{\text{Total LP Supply}}$$

---

## 7. Constants

```solidity
uint256 constant WAD = 1e18;
uint256 constant LN2_WAD = 693147180559945309;     // ln(2) in WAD
uint256 constant LN2_INV_WAD = 1442695040888963407; // 1/ln(2) in WAD
uint256 constant BPS_DENOMINATOR = 10000;
```

---

## 8. Formula Summary Table

| # | Formula | Display | Calculation |
| :--- | :--- | :--- | :--- |
| 1 | **Cash Basis** | `MaxLoss + Yield + P&L = Cash` | `(b × ln(2)) + lpYieldPool + (C_current - C_initial)` |
| 2 | **Equity Floor** | `Cash - Liability = Floor` | `max(0, Cash - max(qYes, qNo))` |
| 3 | **Valuation** | `Floor / Supply = Rate` | `Floor / L` |
| 4 | **TVL** | `Cash + Locked = TVL` | `Cash + AMMEngine.balanceOf(USDC)` |
| 5 | **Liquidity Anchor** | `b × ln(2) ≈ Supply` | `b × 0.693 ≈ L` |

### TVL Components
- **Cash** = MaxLoss + Yield + Unrealized P&L
  - MaxLoss = `bCurrent × ln(2)` (LMSR max loss capacity)
  - Yield = `lpYieldPool` (accumulated LP yield post-graduation)
  - P&L = LMSR cost deviation from initial state
- **Locked** = `USDC.balanceOf(AMMEngine)` (total spendable proceeds across all users)

---

## 9. V8 → V9 Migration Notes

| Aspect | V8 | V9 |
| :--- | :--- | :--- |
| TickBook | Per-market contract | Singleton `TickBookPoolManager` |
| Market ID | Address only | `marketKey` (hash of `PoolKey`) |
| Fee on Sell | Added to cost | **Deducted from proceeds** |
| Flash Accounting | N/A | Transient storage via `TransientDelta` |
| Batch Operations | Not supported | Multi-market fills in one tx |

---

## 10. Frontend Implementation

### Hook: `useMarketStatsMath`

```typescript
interface MarketStats {
    seed: bigint;           // Creator deposit
    fees: bigint;           // Fees accrued
    pnl: bigint;            // Swap P&L (unrealized)
    gross: bigint;          // Seed + Fees + P&L
    lpYieldPool: bigint;    // LP yield pool (post-grad)
    maxLoss: bigint;        // bCurrent × ln(2)
    cash: bigint;           // MaxLoss + Yield + P&L
    lockedProceeds: bigint; // AMMEngine USDC balance (spendable proceeds)
    tvl: bigint;            // Cash + Locked
    liability: bigint;      // max(qYes, qNo)
    floor: bigint;          // Gross - Liability
    ceilingEquity: bigint;  // Gross - min(qYes, qNo)
    supply: bigint;         // LP tokens
    floorRate: number;      // Floor / Supply
    ceilingRate: number;    // Ceiling / Supply
    b: bigint;              // Current liquidity
    bBase: bigint;          // Initial liquidity
}
```

### UI Display (MarketStats Component)

```
🏦 Cash Basis:     MaxLoss + Yield + P&L = Cash
⚖️ Equity Floor:   Cash - Liability = Floor
📈 Valuation:      Floor / Supply = Rate
📦 TVL:            Cash + Locked = TVL
⚓ Liquidity Anchor: b × 0.693 ≈ Supply
```
