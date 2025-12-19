# Global Liability Accounting (Honest Floor)

## Context
In prediction market AMMs like LMSR, the pool (the LP) is always the counterparty to every trade. This means the pool is effectively "short" the outcome tokens held by users. If a user holds 1,000 YES shares, the pool must pay $1,000 to that user if YES wins. 

In earlier versions (V6.1.3 and below), LP token valuation was based on "Gross Assets" (the total USDC in the contract). This was misleading because it ignored the outstanding "debt" (the potential payouts to winning traders). This led to an **Exchange Rate Paradox** where the LP price would look very high until settlement, at which point it would crash as winners claimed their USDC.

## The Solution: Global Liability Tracking
Introduced in **V6.1.6**, Global Liability Tracking implements "Honest Accounting" for LP tokens. The value of an LP token now reflects its **Guaranteed Floor Equity**.

### 1. The Formula
The "Net Assets" of the pool are calculated as:

\[ \text{Net Assets} = \text{Total Cash} - \text{Locked Proceeds} - \text{Maximum Potential Payout} \]

Where:
*   **Total Cash**: Current USDC balance of the market contract.
*   **Locked Proceeds**: USDC owed to users who have sold shares but are waiting for the 24h cooldown.
*   **Maximum Potential Payout**: \(\max(\text{Total YES Supply}, \text{Total NO Supply})\).

### 2. Unified AMM + Orderbook Scope
Sooth uses a hybrid model with both an AMM and a Limit Orderbook. Traditional accounting often only tracks AMM inventory. Global Liability Tracking utilizes `ERC1155Supply` to track the **Global Total Supply** of outcome tokens.

This ensures that whether a share was minted via a swap or matched on the orderbook, the LP exchange rate accounts for it. The LPs are protected from "paper profit" inflation regardless of how users acquire their positions.

### 3. Non-Dilutive Fair Rewards
To maintain this floor, fees are handled differently:
*   **No Dilution**: When traders earn LP rewards (the "cashback" model), tokens are minted at the **Current Floor Price** instead of 1:1.
*   **Floor Growth**: Trade fees that are not distributed as rewards stay in the pool, directly increasing the "Net Assets" and thus raising the exchange rate for all existing holders (similar to Uniswap V2).

## Implementation Details
The core logic resides in `LaunchpadMarket.sol`:

```solidity
function totalNetAssets() public view returns (uint256) {
    uint256 gross = totalAssets();
    uint256 locked = totalLockedProceeds;
    
    // Global Liability: The worst-case payout across BOTH AMM and Orderbook
    uint256 qYes_ = outcomeToken.totalSupply(0);
    uint256 qNo_ = outcomeToken.totalSupply(1);
    uint256 liability = qYes_ > qNo_ ? qYes_ : qNo_;
    
    // Scale liability to asset decimals (e.g. 18 -> 6)
    uint256 scale = 10 ** (18 - IERC20Metadata(address(_asset)).decimals());
    uint256 liabilityAsset = (liability + scale - 1) / scale; 
    
    uint256 totalDebt = locked + liabilityAsset;
    return gross > totalDebt ? gross - totalDebt : 0;
}
```

## Benefits
1.  **Stable Valuation**: LPs see a smooth, upward-trending exchange rate based on realized fees and closed risk, rather than volatile "paper" values.
2.  **No Settlement Shock**: Because the liability is already "priced in," the LP token value will not crash when the market expires.
3.  **Trustless Transparency**: Users can verify at any time that the pool has enough USDC to pay every single winner and still honor the LP exchange rate.
