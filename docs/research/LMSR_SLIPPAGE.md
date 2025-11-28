# LMSR Slippage & Price Impact Research

## 1. Overview

In the Sooth Protocol, market pricing is determined by the **Logarithmic Market Scoring Rule (LMSR)** or its linear approximation (`SoothBalancedAMM`).

**Slippage** in this context refers to the difference between the **spot price** (price of the _next_ infinitesimal share) and the **execution price** (average price paid for a batch of shares).

## 2. The Role of `b` (Liquidity Parameter)

The parameter `b` controls the market depth.

- **Higher `b`** = Deeper liquidity = **Lower slippage**.
- **Lower `b`** = Thinner liquidity = **Higher slippage**.

In Sooth, `b` is dynamic and scales with the vault's total liquidity (`bGlobal`).

## 3. Formulas

### A. SoothBalancedAMM (Linear Approximation - Default)

This is the default AMM used in the current alpha.

- **Spot Price**: $p = 0.5 + \frac{q_{yes} - q_{no}}{2b}$
- **Price Impact**: For a trade size of $\delta$:
  $$ \Delta p = \frac{\delta}{2b} $$
- **Execution Price** (Average Price):
  $$ p*{avg} = p*{start} + \frac{\delta}{4b} $$
- **Slippage**:
  $$ Slippage = \frac{\delta}{4b} $$

**Example**:

- $b = 1000$
- Buy $\delta = 100$ shares
- Price moves by $100 / 2000 = 0.05$ (5%)
- Average price paid is $2.5\%$ higher than start price.

### B. SoothLMSRReal (True LMSR)

- **Spot Price**: $p_i = \frac{e^{q_i/b}}{\sum e^{q_j/b}}$
- **Cost Function**: $C(\vec{q}) = b \ln(\sum e^{q_j/b})$
- **Slippage**: Non-linear.
  - For small trades ($\delta \ll b$), it approximates the linear model.
  - For large trades, price impact accelerates exponentially.

## 4. Frontend Implementation Guide

### ⚠️ Important: No On-Chain Slippage Protection

The current `SoothMarket.trade()` function **does not** accept a `maxCost` limit.

- **Risk**: If a large trade happens before yours, your execution price could be much worse than expected.
- **Mitigation**: The frontend **must** estimate slippage and warn users.

### Calculating Price Impact (Frontend)

```typescript
// Constants
const ONE = ethers.parseEther("1");

function calculateSlippage(
  qYes: bigint,
  qNo: bigint,
  b: bigint,
  delta: bigint // positive for buy, negative for sell
) {
  // 1. Get Spot Price
  const pStart = getPrice(qYes, qNo, b);

  // 2. Simulate New State
  const qYesNew = qYes + delta; // assuming YES trade

  // 3. Get New Spot Price
  const pEnd = getPrice(qYesNew, qNo, b);

  // 4. Calculate Impact
  const priceImpact = ((pEnd - pStart) * 100n) / pStart; // Percentage

  return priceImpact;
}
```

### UX Recommendations

1.  **Show "Price Impact"**: Display the % difference between spot price and execution price.
2.  **Warn on High Slippage**: If impact > 2-5%, show a warning color (orange/red).
3.  **Reject Extreme Slippage**: Disable the trade button if impact > 20% (or user configured tolerance) to prevent accidental losses.

## 5. On-Chain Slippage Protection

✅ **Implemented**: The `SoothMarket.trade()` function now supports slippage protection via the `maxCost` parameter.

### Usage

```solidity
function trade(
    uint8 outcomeIndex,
    int256 deltaShares,
    int256 maxCost // Slippage limit
) external;
```

### Frontend Integration

```typescript
// 1. Get current AMM state and b parameter
const [qYes, qNo] = await market.ammState();
const b = await riskManager.getBForMarket(marketId);

// 2. Calculate expected cost
const [expectedCost] = await amm.costDelta(
  { qYes, qNo },
  outcomeIndex,
  deltaShares,
  b
);

// 3. Add slippage tolerance (e.g., 2%)
const slippageTolerance = 2; // 2%
const maxCost =
  deltaShares > 0
    ? (expectedCost * (100n + BigInt(slippageTolerance))) / 100n // Buy: allow higher cost
    : (expectedCost * (100n - BigInt(slippageTolerance))) / 100n; // Sell: allow lower proceeds

// 4. Execute trade with protection
await market.trade(outcomeIndex, deltaShares, maxCost);
```

### Best Practices

1. **Always set maxCost**: Never use `type(int256).max` in production
2. **Reasonable tolerance**: 1-5% is typical for most markets
3. **Show to user**: Display the slippage tolerance in the UI
4. **Handle reverts**: Catch "Market: slippage exceeded" and suggest increasing tolerance

### Error Handling

```typescript
try {
  await market.trade(outcomeIndex, deltaShares, maxCost);
} catch (error) {
  if (error.message.includes("slippage exceeded")) {
    // Show user: "Price moved unfavorably. Try increasing slippage tolerance."
    // Offer to retry with higher tolerance
  }
}
```
