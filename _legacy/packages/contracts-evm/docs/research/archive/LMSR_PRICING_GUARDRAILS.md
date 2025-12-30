# LMSR Pricing Guardrails (V6.1.4)

## Overview
Logarithmic Market Scoring Rule (LMSR) AMMs are mathematically guaranteed to keep outcome prices between 0 and 1. However, in smart contract implementations using fixed-point math, numerical instability can occur when the ratio of **Shares Outstanding ($q$)** to **Liquidity Depth ($b$)** becomes extremely high.

This document analyzes the "Math Paradox" where a trade could cost more than its maximum possible payout (> $1.00 per share) and defines the industry-standard guardrails implemented in Sooth V6.1.4.

## The Paradox: Price > $1.00
During the early bonding phase of a market with thin liquidity ($b$), a large trade can push the price curve to its extreme limits. Due to precision loss in exponential and logarithmic operations ($e^{q/b}$ and $\ln(\sum e^{q_i/b})$), the resulting cost basis for a buy order can sometimes exceed $1.00 per share.

### Case Study: Market 1 (Dec 19, 2025)
*   **Initial Depth ($b$)**: 144.26
*   **User Order**: Buy 10,000 YES shares.
*   **Fixed-Point Math Result**: The internal LMSR cost function returned a value that, when scaled, equated to **$2.16 per share**.
*   **Problem**: A share that pays out at most $1.00 should never cost $2.16. This breaks the fundamental economic incentive of the prediction market and allows the AMM to extract irrational value from traders.

## The Solution: Price Cap Guardrail
To ensure the protocol remains "bulletproof" even in thin pools, Sooth V6.1.4 implements a strict cost cap in the `swap()` function.

### Implementation
```solidity
// SAFETY: Price cap guardrail ($1.00 per share max cost basis)
// costAsset (6 decimals) should not exceed absShares (18 decimals) / 1e12
require(costAsset <= (absShares / 1e12) + 1, "Launchpad: price exceeds $1 cap");
```

### Why a `require` vs. a `min/max`?
We chose a `require` revert over a silent cap for the following reasons:
1.  **Transparency**: If a user's trade is so large that it breaks the mathematical stability of the pool, they should be notified that liquidity is insufficient for that trade size.
2.  **Slippage Awareness**: Most traders use a `maxCost` slippage limit. A silent cap might hide the fact that they are getting the "worst possible price" ($1.00).
3.  **Incentive Alignment**: Reverting encourages traders to break large trades into smaller chunks or wait for more liquidity, which leads to better price discovery.

## Industry Comparison

| Project | Approach | Strategy |
|:---|:---|:---|
| **Gnosis** | Revert on Overflow | Math fails before impossible prices are returned. |
| **Augur v1** | Cost Capping | If cost > shares, cost is set to share amount. |
| **Sooth V6.1.4**| **Revert Guardrail** | Explicit check to prevent irrational cost basis. |

## Conclusion
The Price Cap Guardrail ensures that Sooth AMMs remain economically rational at all times. It acknowledges the limitations of fixed-point math in high-inventory scenarios and protects users from "impossible" trade costs.
