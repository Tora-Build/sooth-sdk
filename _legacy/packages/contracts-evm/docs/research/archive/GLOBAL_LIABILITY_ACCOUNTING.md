# Global Liability Accounting (Honest Floor)

## Context
In prediction market AMMs like LMSR, the pool (the LP) is always the counterparty to every trade. This means the pool is effectively "short" the outcome tokens held by users. If a user holds 1,000 YES shares, the pool must pay $1,000 to that user if YES wins. 

In earlier versions (V6.1.3 and below), LP token valuation was based on "Gross Assets" (the total USDC in the contract). This was misleading because it ignored the outstanding "debt" (the potential payouts to winning traders). This led to an **Exchange Rate Paradox** where the LP price would look very high until settlement, at which point it would crash as winners claimed their USDC.

## The Solution: Isolated AMM Accounting (Pure LP Ledger)
Introduced in **V6.1.9**, the protocol enforces **Liability Isolation**. LPs are counterparties ONLY to the AMM. Orderbook tokens and Direct Splits are self-collateralized and neutral to LP equity.

### 1. The Pure AMM Formula
The "Net Assets" owned by the LPs are derived purely from the AMM's internal ledger, ignoring Orderbook collateral:

\[ \text{LP Equity} = \text{Initial Seed} + \text{Fees} + (\text{Current Cost} - \text{Initial Cost}) - \text{AMM Max Liability} \]

Where:
*   **Initial Seed**: Creator's deposit (\(b \times \ln(2)\)).
*   **Fees**: Cumulative trading spreads captured by the AMM.
*   **Current Cost**: The LMSR cost \(C(q)\) based on virtual inventory.
*   **AMM Max Liability**: \(\max(q_{\text{YES}}, q_{\text{NO}})\).

### 2. Why Liability is NOT Shared
Sooth uses a hybrid model with both an AMM and a Limit Orderbook. 
*   **AMM Liability**: Uncollateralized debt where the LP is the short counterparty. This is the only risk the LPs actually "own."
*   **Orderbook Liability**: Fully collateralized by users at mint time (1 YES + 1 NO = 1 USDC). This cash sits in the vault as **Reserved Collateral** and does not contribute to LP upside or floor.

By isolating these ledgers, the LP exchange rate remains stable through Orderbook volume spikes or massive Direct Splits, which would otherwise "dilute" the apparent floor if treated as a single hybrid pool.

### 3. Implementation Logic
While the `LaunchpadMarket.sol` contract uses a global `totalNetAssets()` view for high-level solvency checks, the **LP Dashboard** and **ExRate** logic utilize the Pure AMM Ledger to provide an accurate representation of LP wealth.

```typescript
// Frontend Implementation (MarketDetail.tsx)
const ammCash = initialSeed + fees + (currentCost - initialCost);
const lpFloor = ammCash - Math.max(qYes, qNo);
const lpCeiling = ammCash - Math.min(qYes, qNo);
```

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
