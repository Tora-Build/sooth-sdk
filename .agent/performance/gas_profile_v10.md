# Performance Analysis: V10 Unified Crossing Gas Costs

**Date:** 2026-01-05
**Version:** V10.0.1
**Chain:** Base Sepolia (Representative of Monad Testnet logic)

## 1. Context
With the introduction of **Unified Crossing** in V10 (ADR-073), the order execution logic became significantly more robust but computationally heavier. This analysis documents the gas profile of V10 operations to validate their suitability for high-throughput chains like Monad.

## 2. Gas Profile Data
Data collected via `contracts-testing` interactive simulation (Run ID: `1767625207841`).

| Order Type | Scenario | Avg Gas Used | Verdict |
| :--- | :--- | :--- | :--- |
| **Market Order** | Partial Fill (Match against Resting) | **370k - 450k** | ✅ Acceptable |
| **Range Order** | Complex Match (Multiple ticks/orders) | **450k - 550k** | ✅ Acceptable |
| **Range Order** | No Match (Maker Only) | **~390k** | ✅ Efficient |
| **Spot Sell** | Standard Spot Sell | **~300k** | ✅ Efficient |
| **Hybrid Sell** | Implicit Spot + Short | **~1.2M - 1.5M** | ⚠️ Expected High |
| **Graduation** | Full Market Settlement | **~1.5M - 2.0M** | ⚠️ Expected High |

## 3. Analysis

### Why is V10 Heavier?
V10 introduces a "Multi-Phase Crossing" loop that upgrades correctness at the cost of gas:
1.  **Spot Phase**: Loads `_spotBitmaps` and iterates ticks to perform user-to-user matches (0-slippage recycling).
2.  **Range Phase**: If demand remains, iterates ticks again to match against Pool liquidity (minting/burning).

In V9, only Phase 2 existed. The addition of Phase 1 adds a constant overhead of **~50k-80k gas** per order for bitmap lookups and state checks, which is a necessary price for solving "Fractured Liquidity".

### Monad Suitability
The target environment (Monad) supports high compute budgets (10M+ gas limits) and high throughput.
*   **Safety Margin**: We have increased the CLI simulation gas limit to **5,000,000** to accommodate outlier cases (e.g., complex Hybrid Sells) without `OutOfGas` errors.
*   **Efficiency**: An average of ~450k gas for a dual-collateral orderbook match is highly efficient compared to on-chain competitors (e.g., complex perp DEXs often use 600k-900k).

## 4. Conclusion
The V10 gas profile is **approved for production**. The increased cost is directly correlated with the architectural guarantee of "Unified Crossing," ensuring users always get the best price across both liquidity pools.

## 5. Action Items
-   [x] Increase interactive CLI gas defaults to 5M (Completed in `market.ts`).
-   [ ] Monitor Mainnet Monad gas *price* to ensure economic viability (future task).
