# Issue Report: Persistent "Slippage Exceeded" on Sell Transactions

**Date:** 2025-12-06
**Severity:** Critical
**Status:** Open

## Problem Description

Users are unable to execute **Sell** transactions. The transaction reverts with the error:
`TraderVault: slippage exceeded`

Buy transactions appear to be functioning (or at least not reported as failing recently).
The user also reports "orderbook ui shows insufficient usdc", which might be a side effect of balance reading issues or related to the sell failure context.

## Current System State

### 1. Contract Logic (`SoothTraderVault.sol`)

We have patched the `tradeAMM` function to address two prior issues:

1.  **Decimal Scaling:** AMM costs (18 decimals) are scaled down by `gov.decimalsScale()` to match Token decimals (e.g. 6).
2.  **Sell Validation Logic:** The inequality was inverted to correctly check negative cost against negative limit.

```solidity
// Current Implementation in SoothTraderVault.sol
} else if (cost < 0) {
    // User is SELLING
    uint256 grossProceeds = uint256(-cost);
    uint256 netProceeds = grossProceeds > fee ? grossProceeds - fee : 0;

    // Check: -Received <= -Expected (e.g. -100 <= -95)
    require(-int256(netProceeds) <= maxCost, "TraderVault: slippage exceeded");

    // ... transfers ...
}
```

### 2. Frontend Logic (`useTrade.ts`)

We updated the frontend to ensure `maxCost` is sent as a correctly signed negative integer for sells.

```typescript
// useTrade.ts
if (sharesBig > 0n) {
  // Buy Logic
} else {
  // Sell Logic: Willing to receive LESS (e.g. -100 -> -95)
  // maxCost = -(expectedCost * (BPS - slippage - buffer) / BPS)
  maxCost = -((expectedCost * (BPS - slippageFactor - 50n)) / BPS);
}
```

### 3. Fee Logic (`useTradeQuote.ts`)

We fixed the user-facing quote to subtract fees from proceeds, ensuring the "Expected" amount is lower (safer) and matches contract.

```typescript
// useTradeQuote.ts
// Sell: -100 + 0.5 = -99.5 (Net Proceeds)
const totalCost = expectedCost + fee;
```

## Potential Root Causes

Despite these fixes, the revert persists. Potential causes for Protocol Dev execution:

1.  **Decimals Mismatch Confusion:**

    - The `MockUSDC` deployed (`0x3675...`) might be 18 decimals (default in script) while we are testing thinking it's 6, or vice versa.
    - If `decimalsScale` is 1 (18->18), but frontend sends 6-decimal `maxCost` (thinking it's 6), the contract compares `1e18 cost` vs `1e6 limit`.
    - **Sell:** Cost = -1e18. Limit = -1e6. `-1e18 <= -1e6`. This PASSES.
    - **Buy:** Cost = 1e18. Limit = 1e6. `1e18 <= 1e6`. This FAILS.
    - User reports FAIL on SELL.
    - If Token is 6 decimals. Scale is 1e12. `Cost` = 1e6. `Limit` = 1e6. Should work.

2.  **Order of Operations / Rounding:**

    - Solidity: `rawCost / scale`. Loss of precision?
    - If `rawCost` is `-999,999...`, integer division truncates towards zero -> `-0`.
    - Frontend expects `-1`.
    - `-0 <= -1` is FALSE. Revert!
    - **Hypothesis:** If the AMM trade is small or the scale factor is large, `cost` might truncate to 0 or a number significantly different from frontend expectation.

3.  **Governor Vault Fee Config:**
    - If `GovernorVault` has a different `defaultFeeBps` than the hardcoded `0.5%` (50bps) assumed in frontend, calculations will diverge.

## Recommended Actions

1.  **Verify Token Decimals:** Check the `decimals()` on the live `MockUSDC` contract.
2.  **Verify Governor Config:** Read `defaultFeeBps` from the live `SoothGovernorVault`.
3.  **Debug Event Tracing:** We need to emit the calculated `cost`, `netProceeds`, and `maxCost` in the contract before the `require` statement to see the exact values causing the revert. This requires a temporary debug deployment.

## Artifacts

- **Frontend Config:** `apps/web/src/config/deployments.json`
- **Hook:** `apps/web/src/hooks/useTrade.ts`
- **Contract:** `packages/contracts-evm/contracts/core/SoothTraderVault.sol`
