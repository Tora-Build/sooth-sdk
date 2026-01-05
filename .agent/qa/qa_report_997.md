# QA Report: Spot Sell Implementation (Issue #997)

## Executive Summary
**Result**: ⚠️ **PARTIAL SUCCESS / INTEGRATION RISK**
"Spot Sell" functions (`placeSpotSell`, `cancelSpotSell`, `buyFromSpotSell`) are implemented and functional in the contract. However, the standard `placeOrder` function (used for all regular Buy/Short actions) does **not** cross against Spot Sells. This results in **fractured liquidity**: users placing standard Buy orders will not match against Spot Sell orders.

## Test Results

### 1. Functional Verification (`SpotSellRepro.t.sol`)
| Test Case | Result | Notes |
|---|---|---|
| `test_PlaceSpotSell_Works` | ✅ PASS | Shares are correctly locked, order created. |
| `test_BuyFromSpotSell_ExplicitlyWorks` | ✅ PASS | Taker can explicitly buy from a spot sell ID. |
| `test_FracturedLiquidity...` | ⚠️ CONFIRMED | Standard `placeOrder` (Buy) resulted in **0 filled shares** despite valid Spot Sell liquidity existing at the price. |

## Critical Findings

### 1. Fractured Liquidity
The `TickBookPoolManagerV996.sol` crossing logic (`_tryCross`) only iterates over:
-   `RangeOrder` liquidity (Short Sells / Market Makers)
-   `TickBitmap` (for jumping between ticks)

It does **not** check `_spotSellLiquidity` or iterate `_spotSellOrders`.
**Impact**:
-   Spot Sellers will place orders that never get filled by organic market traffic.
-   Buyers will pay higher prices (crossing against Range Orders) even if cheaper Spot Sells exist.
-   **Mitigation**: Frontend must aggregate liquidity manually or specific "Buy from Spot" UI is required (which is poor UX).

### 2. Implementation Completeness
The implementation in V9.9.7 appears to be an "add-on" rather than a core integration.
-   `placeSpotSell` exists.
-   `placeOrder` remains unchanged from V9.9.6 logic.

## Recommendations
1.  **Frontend Mitigation (Immediate)**: If you keep Spot Sell enabled, the "Buy" UI in `Pro.tsx` **must** check for Spot Sells and route the transaction to `buyFromSpotSell` if a matching spot order exists. Standard `placeOrder` will not work.
2.  **Contract Fix (Long Term)**: Update `_tryCross` in V10 to include `_spotSellLiquidity` in the crossing algorithm, ensuring unified liquidity.

## Artifacts
-   Reproduction Test: `packages/contracts-testing/test/v9/SpotSellRepro.t.sol`
