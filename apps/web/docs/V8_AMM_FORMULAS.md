# V8 AMM Accounting & Formulas

This document defines the canonical financial logic for the Sooth V8.1 AMM (Logarithmic Market Scoring Rule).

## 1. Core State Variables

| Symbol | Definition | Precision | Source |
| :--- | :--- | :--- | :--- |
| $q_{yes}$ | YES outcome shares outstanding | 18 decimals (WAD) | `AMMEngine.getMarketState` |
| $q_{no}$ | NO outcome shares outstanding | 18 decimals (WAD) | `AMMEngine.getMarketState` |
| $b$ | Liquidity depth parameter | 18 decimals (WAD) | `LaunchpadEngine.markets.bCurrent` |
| $S$ | Initial creator deposit (Seed) | USDC Decimals | `LaunchpadEngine.markets.creatorDeposit` |
| $F$ | Accumulated trading fees | USDC Decimals | `LaunchpadEngine.markets.feesAccrued` |
| $Y$ | Accumulated LP yield (post-grad) | USDC Decimals | `LaunchpadEngine.markets.lpYieldPool` |
| $L$ | Total LP tokens in circulation | 18 decimals (WAD) | `LaunchpadEngine.markets.totalLPSupply` |

---

## 2. LMSR Cost Function

The cost to reach a state $(q_{yes}, q_{no})$ is defined as:

\[ C(q_{yes}, q_{no}) = b \cdot \ln(e^{q_{yes}/b} + e^{q_{no}/b}) \]

**Initial Cost (Seed)**:
\[ C(0, 0) = b_{base} \cdot \ln(2) \approx S \]

---

## 3. Financial Formulas

### A. Cash Basis (Gross Assets)
Reconciles all USDC inflows and trading performance within the AMM isolated ledger.

\[ \text{Swap P\&L} = C(q_{yes}, q_{no}) - S \]
\[ \text{Gross Cash} = S + F + Y + \text{Swap P\&L} \]

### B. Equity Floor (Honest Floor Model)
The guaranteed minimum value of the pool, assuming the "House" loses the current liability.

\[ \text{Liability} = \max(q_{yes}, q_{no}) \]
\[ \text{Floor} = \max(0, \text{Gross Cash} - \text{Liability}) \]

### C. Valuation (ExRate)
The real-time price of 1 LP token in USDC terms.

\[ \text{Rate} = \frac{\text{Floor}}{\text{Supply}} \]

### D. Liquidity Anchor
The mathematical relationship ensuring LP supply remains proportional to market depth.

\[ b \cdot \ln(2) \approx \text{LP Supply} \]

---

## 4. Graduation Mechanics

A market "graduates" when trading volume (and thus fees) reaches a threshold proportional to the initial depth.

\[ \text{Threshold} = b_{base} \cdot \text{Multiplier} \]
\[ \text{Progress} = \frac{F}{\text{Threshold}} \]

*Default Multiplier is 2.0x (200% of initial depth).*

