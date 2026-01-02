# Liquidity Metrics Explained (Legacy Governor Vault)

**Last Updated:** 2025-11-30  
**Audience:** Users, LPs, and Developers  
**Purpose:** Understanding the Hybrid Liquidity Model and key vault metrics

> ⚠️ **Note for V6 Launchpad Markets**: Launchpad markets use an **Isolated Ledger Model**.
> See [LAUNCHPAD_SPEC.md](./specs/LAUNCHPAD_SPEC.md) Section 2.5 for the V6 formulas.
> Key differences:
> - **Pure AMM Accounting**: LP value is derived purely from AMM state variables.
> - **Liability Isolation**: LP liability is NOT shared with Orderbook/Direct Splits.
> - **Floor Equity**: `AMM_Cash - max(qYes, qNo)`
> - **LP ExRate Range**: Displayed as `(Floor ExRate - Ceiling ExRate)`

---

## Overview

The Sooth Protocol uses a **Hybrid Liquidity Model** where market liquidity depth grows dynamically based on trading activity and market performance. This document explains the key metrics and their relationships.

---

## Core Metrics

### 1. **Liquidity (b)** - Market Depth Parameter

**What it is:**

- The liquidity depth parameter for a specific market
- Determines how much the price moves for a given trade size
- Higher `b` = Lower slippage

**Formula:**

```
b = Base Liquidity + (Market Reserve × Reserve Multiplier)
```

**Components:**

- **Base Liquidity**: Global vault allocation (risk-adjusted per market class)
- **Market Reserve**: Net profit/loss accumulated by this market from trading spreads and settlements
- **Reserve Multiplier**: Currently `1.00x` (100% conversion)

**Example:**

```
Market A (MEDIUM risk):
  Base Liquidity: 14,000 USDC
  Market Reserve: +274 USDC (profitable)
  Reserve Multiplier: 1.00x

  b = 14,000 + (274 × 1.00) = 14,274 USDC
```

---

### 2. **Market Reserve** - Accumulated Spread & PnL

**What it is:**

- The cumulative profit or loss for a specific market
- Increases when traders pay the bid-ask spread
- Changes when the market settles (can be positive or negative)

**How it grows:**

```
Market Reserve = Σ(Trading Spreads) + Settlement PnL
```

**Key Points:**

- **Not a "fee"**: There's no explicit fee percentage. The reserve grows from the natural spread in the AMM pricing.
- **Can be negative**: If the market settles against the AMM's position, the reserve decreases.
- **Boosts liquidity**: Positive reserves automatically increase the market's `b` parameter.

---

### 3. **Solvency Factor** - Capital Efficiency Ratio

**What it is:**

- The ratio of locked capital to liquidity depth
- Indicates how efficiently capital is being used

**Formula:**

```
Solvency Factor = Max Loss / b
```

**Typical Values:**

- **~0.693** for balanced markets (50/50 probability)
- **Lower** when market is imbalanced (e.g., 80/20)
- Derived from the LMSR cost function: `ln(2) ≈ 0.693`

**Why it changes:**

- As traders buy one outcome, the AMM's exposure profile shifts
- The vault's worst-case payout changes relative to `b`

---

### 4. **Max Loss (Locked)** - Worst-Case Payout

**What it is:**

- The maximum amount the vault could lose if the market resolves against its position
- Capital "locked" to guarantee solvency

**Formula:**

```
Max Loss ≈ b × Solvency Factor
```

**For balanced markets:**

```
Max Loss ≈ b × 0.693
```

**Example:**

```
Market with b = 14,274 USDC
Solvency Factor = 0.6802
Max Loss = 14,274 × 0.6802 = 9,710 USDC
```

---

### 5. **Idle Liquidity** - Available Capital

**What it is:**

- Capital in the vault not currently locked for any market
- Available to support new markets or increased positions

**Formula:**

```
Idle Liquidity = TVL - Σ(All Max Loss)
```

**Example:**

```
TVL: 286,814 USDC
Total Locked (all markets): 20,000 USDC
Idle Liquidity: 266,814 USDC
```

---

## The Complete System

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  1. Trading Activity                            │
│     ↓                                           │
│  2. Market Reserve grows (spread capture)       │
│     ↓                                           │
│  3. Liquidity (b) increases automatically       │
│     ↓                                           │
│  4. Max Loss adjusts (b × Solvency Factor)      │
│     ↓                                           │
│  5. More liquidity attracts more trading        │
│     ↓                                           │
│  (Flywheel Effect)                              │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Mathematical Relationships

### Primary Equations

1. **Liquidity Depth:**

   ```
   b = Base + (Reserve × Multiplier)
   ```

2. **Locked Capital:**

   ```
   Max Loss = b × Solvency Factor
   ```

   Where `Solvency Factor ≈ 0.693` for balanced markets

3. **Available Capital:**
   ```
   Idle = TVL - Σ(Max Loss for all markets)
   ```

### Derived Relationships

- **Reserve → b**: Direct linear relationship (1:1 with 1.00x multiplier)
- **b → Max Loss**: Proportional via Solvency Factor (~0.693)
- **Max Loss → Idle**: Inverse relationship (more locked = less idle)

---

## Practical Implications

### For Traders

1. **Higher `b` = Better prices**: Markets with more liquidity have less slippage
2. **Popular markets get deeper**: Trading volume increases `b` over time
3. **No explicit fees**: You pay the spread, not a separate fee

### For LPs

1. **Share price grows with reserves**: Positive market reserves increase vault value
2. **Diversification matters**: Multiple markets spread risk
3. **Idle liquidity is opportunity**: Unused capital can back new markets

### For Market Creators

1. **Initial `b` from base allocation**: New markets start with base liquidity
2. **Growth through volume**: Successful markets earn their own liquidity boost
3. **Risk class affects base**: Higher risk = higher base allocation

---

## Monitoring Metrics

### Vault Level

- **TVL**: Total capital deposited
- **Share Price**: Value per LP token (includes all reserves)
- **Share Growth**: Percentage increase in share price
- **Idle Liquidity**: Capital available for new markets

### Market Level

- **Liquidity (b)**: Current depth parameter
- **Market Reserve**: Accumulated spread/PnL
- **Solvency Factor**: Efficiency ratio (Locked / b)
- **Max Loss**: Capital locked for this market

---

## Common Questions

### Q: Why isn't Max Loss exactly 0.693 × b?

**A:** The 0.693 factor is only exact for a perfectly balanced market (50/50). As the market price shifts, the AMM's exposure profile changes, affecting the solvency factor.

### Q: Can Market Reserve be negative?

**A:** Yes. If the market settles against the AMM's position, the reserve can go negative. This reduces the market's `b` parameter.

### Q: What happens to reserves when I withdraw as an LP?

**A:** You receive your proportional share of the entire vault, including all market reserves. Reserves are owned by LPs collectively.

### Q: Is there a trading fee?

**A:** There's no explicit percentage fee. The "cost" of trading is the bid-ask spread inherent in the AMM pricing. This spread is captured as Market Reserve.

---

## References

- [Hybrid Liquidity Model Documentation](./LIQUIDITY_AND_AMM_UPDATE_2025_11_30.md)
- [Contract Interfaces](./CONTRACT_INTERFACES.md)
- [LMSR Pricing Mechanism](https://en.wikipedia.org/wiki/Logarithmic_market_scoring_rule)

---

**Version:** 1.0  
**Status:** ✅ Reflects current deployment on Base Sepolia
