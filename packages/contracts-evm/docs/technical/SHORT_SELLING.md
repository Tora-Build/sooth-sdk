# Collateralized Short Selling

## Overview
Sooth Protocol enables users to **Sell** outcome tokens (e.g., YES) even if they do not currently hold them. This is achieved through a "Virtual Short" mechanism where the protocol treats a "Sell YES" order as a "Buy NO" order, requiring collateral to cover the maximum possible loss.

## Mechanics

### The "Virtual Short" Logic
When a user wants to sell `X` amount of `Outcome A` at `Price P`:
1.  **Protocol Interpretation**: This is mathematically equivalent to buying `Outcome B` (the opposite outcome) at `Price (1 - P)`.
2.  **Collateral Requirement**: The maximizing loss for the user is if `Outcome A` resolves to TRUE (1.0). The user sold at `P`, so they lose `1.0 - P` per share.
3.  **Action**: The protocol debits `(1 - P) * X` USDC from the user and places a Limit Buy Order for `Outcome B` at `1 - P`.

### Example
**User wants to Sell 100 YES at 0.40 USDC.**

*   **Implied Probability**: User believes YES is worth less than 0.40.
*   **Equivalent Bet**: User is betting NO will occur, at a price of 0.60.
*   **Collateral**: `(1.00 - 0.40) * 100 = 60 USDC`.
*   **Market Order**: `Buy 100 NO @ 0.60`.

### Settlement
If the order is matched:
*   **User holds**: 100 NO tokens.
*   **Counterparty holds**: 100 YES tokens.
*   **Total Locked**: 0.60 (Seller) + 0.40 (Buyer) = 1.00 USDC per share.

## Developer Interface

### `SoothTraderVaultV4.placeOrder`

To place a short sell order, use the `placeOrder` function with `isBuy = false`.

```solidity
function placeOrder(
    address market,
    uint8 outcome,     // The outcome you want to SELL (e.g. YES=0)
    uint256 price,     // The price you want to SELL at (e.g. 0.40)
    uint256 amount,    // The amount of shares
    bool isBuy         // Set to FALSE for Sell/Short
) external returns (uint256 orderId);
```

**Note**: The `market`, `outcome`, and `price` parameters should reflect the **Sell** intent. The contract handles the inversion logic internally.

## Hybrid Sell (UI Feature)
The frontend implements a "Hybrid Sell" feature. If a user *owns* YES tokens and wants to Sell them via a Limit Order, the UI will:
1.  Warn the user that this is a "Virtual Short" requiring USDC collateral.
2.  Execute the trade as a Short Sell (Buy NO).
3.  Result: User holds YES (original) + NO (newly bought). This forms a complete set which can be merged/redeemed for 1.00 USDC.
