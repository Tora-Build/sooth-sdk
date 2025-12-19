# V4 Complete Formula (Continuous LMSR)

## Core Formulas

### 1. Effective Liquidity (`b`)

The liquidity parameter `b` scales dynamically with the market's accrued fees (reserve).

```
b = bBase + (reserveFactorBps / 10000) × unrealizedPnL
```

**Parameters:**
- `bBase` = Base liquidity (governor-controlled, e.g. 10,000e18)
- `reserveFactorBps` = Reserve factor in basis points (default: 1000 = 10%)
- `unrealizedPnL` = Market's `reserve` (net fees collected)

### 2. Market Reserve Tracking

```
reserve = Σ fees_collected
```
*Note: In V4, `reserve` tracks accumulated fees. The AMM is internal to the TraderVault, so "payouts" are handled via net settlements.*

### 3. AMM Pricing (Continuous LMSR)

The system uses the Logarithmic Market Scoring Rule (LMSR) with continuous state variables `qYes` and `qNo`.

**Cost Function:**
$$C(\vec{q}) = b \cdot \ln(e^{q_{Yes}/b} + e^{q_{No}/b})$$

**Spot Price (Probability):**
The price of outcome $i$ (e.g., YES) is the partial derivative of cost with respect to $q_i$:

$$P_{Yes} = \frac{\partial C}{\partial q_{Yes}} = \frac{e^{q_{Yes}/b}}{e^{q_{Yes}/b} + e^{q_{No}/b}}$$

$$P_{No} = \frac{e^{q_{No}/b}}{e^{q_{Yes}/b} + e^{q_{No}/b}}$$

### 4. Trade Cost

To buy $\Delta q$ shares of YES:

1.  Calculate current Cost: $C_{current} = C(q_{Yes}, q_{No})$
2.  Calculate new Cost: $C_{new} = C(q_{Yes} + \Delta q, q_{No})$
3.  **Cost to Trader**:
    $$Cost = C_{new} - C_{current}$$
4.  **Fee**:
    $$Fee = |Cost| \times \frac{Fee_{bps}}{10000}$$

### 5. Max Loss (Worst Case)

The maximum subsidy required by the AMM occurs if the market resolves to an outcome with minimal backing.

$$MaxLoss \approx b \cdot \ln(2)$$

*In signed integer math (SD59x18):*
`maxLoss = b * 0.693147...`

### 6. Solvency Constraint

To ensure the Vault is solvent:

$$TotalAssets \ge \sum_{markets} (MaxLoss_m)$$

The `GovernorVault` ensures that new markets cannot be created if this invariant is violated.

## Constants

```solidity
uint256 constant WAD = 1e18;
uint256 constant MAX_BPS = 10000;
// PRBMath constants used internally
```
