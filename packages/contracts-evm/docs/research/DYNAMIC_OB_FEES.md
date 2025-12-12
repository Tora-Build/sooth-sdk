# Research Proposal: AMM-Indexed Dynamic Orderbook Fees

**Status:** Draft
**Author:** Researcher Agent
**Date:** 2025-12-09

## 1. Abstract

We propose a mechanism to tighten the spread between the Sooth Orderbook and the Sooth AMM (Continuous LMSR) by using the AMM's spot price as an **Index Price**. The system will apply dynamic trading fees to Orderbook matches based on their divergence from this Index Price, incentivizing convergence and reducing liquidity fragmentation.

## 2. Motivation

Currently, the Orderbook and AMM operate as separate liquidity islands.
-   **Problem:** Prices can diverge significantly. A user might buy YES at 0.60 on AMM while a Sell order sits at 0.58 on the Orderbook, resulting in suboptimal execution.
-   **Goal:** Create an economic force that pulls Orderbook execution prices toward the AMM "Truth" price.

## 3. The Mechanism

### 3.1 Index Price Definition

The **Index Price** ($P_{index}$) is the instantaneous marginal price of the Market's AMM.

$$P_{index} = P_{AMM}(YES) = \frac{e^{qYes/b}}{e^{qYes/b} + e^{qNo/b}}$$

*Note: This is already available in V4 via `SoothMarketV4.price(0)`.*

### 3.2 Dynamic Fee Formula

We define the Orderbook Fee ($F_{OB}$) as a function of the **Spread Divergence** ($D$) between the matched price ($P_{match}$) and the Index Price ($P_{index}$).

$$D = | P_{match} - P_{index} |$$

The fee function aims to penalize divergence:

$$F_{OB}(D) = F_{base} + (k \cdot D^n)$$

Where:
-   $F_{base}$: Minimum protocol fee (e.g., 5 bps).
-   $k$: Sensitivity multiplier (Slope).
-   $n$: Exponent (Linear vs Quadratic penalty).

#### Simplified Linear Model (Recommended)

To minimize gas costs, we use a linear penalty logic with a "Tolerance Band" ($\epsilon$).

-   If $D \le \epsilon$ (Inside tolerance): **Fee = Base Fee (Low)**
-   If $D > \epsilon$ (diverging): **Fee = Base Fee + (Slope $\times$ Excess Divergence)**

$$F_{total} = F_{base} + \max(0, \alpha \cdot (D - \epsilon))$$

### 3.3 Incentives Analysis

| Actor | Action | Price Impact | Incentive |
| :--- | :--- | :--- | :--- |
| **Maker** | Places Limit Order *close* to AMM | $D \approx 0$ | **Low Fee** (Matches are cheaper for takers, so fill probability $\uparrow$) |
| **Maker** | Places Limit Order *far* from AMM | $D \gg 0$ | **High Fee** (Takers dissuaded, or Maker must discount price further to compensate) |
| **Arbitrageur** | Sees AMM @ 0.60, OB @ 0.55 | $D = 0.05$ | Arb opportunity exists. Dynamic fee eats into arb profit, but if arb aligns prices, subsequent trades are cheaper. |

**Crucially:** This acts as a soft "peg" between the two venues.

## 4. Implementation Design

### 4.1 Gas Considerations
-   Calculating $P_{index}$ (LMSR price) involves `exp` and `ln` math.
-   Doing this *per order match* in `SoothMarketV4` approaches the gas limit if matching multiple orders.
-   **Optimization:** Use the stored `qYes`/`qNo` from the last interaction? No, must be fresh.
-   **Optimization:** Calculate $P_{index}$ **once** at the start of `createOrder` (taker flow) relative to the batch being matched.

### 4.2 Anti-Gaming / Manipulation Risks

**Attack Vector: "AMM Spoofing"**
1.  Attacker wants to fill a large OB order at an off-market price (e.g., cheap YES).
2.  Attacker manipulates AMM price to match their target OB price (e.g. by selling YES to AMM).
3.  AMM Price drops. Index Price matches target. Fee is low.
4.  Attacker executes OB trade.
5.  Attacker reverts AMM trade (if possible, or arbs back).

**Mitigation:**
The cost to manipulate the AMM (Slippage + Fees) usually exceeds the fee savings on the Orderbook, provided AMM liquidity ($b$) is sufficient.
-   *Cost to Move AMM*: $\approx \frac{1}{2} \frac{\Delta q^2}{b}$
-   *Gain from Fee*: $\Delta Fee \times Volume_{OB}$

We must ensure `Slope` ($k$) isn't so high that it encourages manipulation.

## 6. Simulation & Parameter Analysis

**Run Date:** 2025-12-09
**Script:** `scripts/research/sim_fee_dynamics.py`

### 6.1 Recommended Parameters

After simulating various slopes, we recommend the following conservative parameters to start:

-   **Base Fee ($F_{base}$)**: `5 bps` (0.05%)
    -   *Rationale*: Standard fee for "good" market makers. matches or beats standard exchanges.
-   **Tolerance Band ($\epsilon$)**: `0.02` (2% price delta)
    -   *Rationale*: Allows for minor latency variances between AMM block updates and off-chain order placement without penalty.
-   **Slope ($\alpha$)**: `0.5`
    -   *Rationale*: A 0.5 slope means for every 1% excessive divergence, fee increases by 0.5%.
    -   *Example*: 10% divergence = 8% excess -> +4% fee. Total 4.05%.

### 6.2 Gaming Analysis (AMM Spoofing)

We analyzed the cost of an attacker artificially moving the AMM price to lower the fee for a stale Orderbook order.

**Scenario:**
-   True AMM Price: 0.50
-   Stale Orderbook Price: 0.45 (Target)
-   Divergence: 0.05 (5%)

**Without Manipulation:**
-   Fee = 5bps + (0.05 - 0.02) * 0.5 = **155 bps** (1.55%)

**With Manipulation (Attacker moves AMM to 0.45):**
-   New Divergence: 0
-   Fee = **5 bps**
-   **Fee Savings**: 150 bps (1.50%)

**Cost of Manipulation:**
-   To move AMM price by 5% requires trading against the LMSR curve.
-   The "round trip" cost (Slippage + AMM Fees + Price Impact) for a 5% move typically exceeds 1.5%.
-   **Conclusion:** Manipulation is -EV unless the Orderbook trade size is disproportionately larger than the AMM liquidity depth ($b$).

## 7. Gas Estimation

### 7.1 Cost of "Truth"
Calculating the index price ($P_{index}$) is computationally expensive due to:
1.  **External Calls (`b()` calculation)**:
    -   `governorVault.getMarketReserve()`: ~3,000 gas
    -   `governorVault.reserveFactorBps()`: ~3,000 gas
2.  **Math Operations (`price()` calculation)**:
    -   `exp(qYes/b)` + `exp(qNo/b)`: PRBMath fixed-point exponentiation is iterative.
    -   Estimated cost: ~6,000 - 8,000 gas.
    
**Total Overhead per Calculation:** ~12,000 - 15,000 gas.

### 7.2 Optimization Strategy
If we recalculate $P_{index}$ for **every** order match in a batch (e.g., matching 10 orders), we add ~150k gas overhead, which is unacceptable.

**Solution: Snapshot Indexing**
-   The contract should calculate $P_{index}$ **once** at the beginning of the `createOrder` or `matchOrders` transaction.
-   This "Snapshot Price" is used as the reference for all fees in that transaction.
-   **Amortized Cost**: < 1,500 gas per order (for a batch of 10).

## 8. Next Steps

1.  **Solidity Prototype**: Draft a `DynamicFeeController` that implements `getFee(uint256 matchPrice, uint256 ammPrice)`.
