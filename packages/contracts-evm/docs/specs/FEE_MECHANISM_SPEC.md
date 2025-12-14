# Fee Mechanism & Dynamic Liquidity Spec

**Status:** Implemented (V4.6)
**Last Updated:** 2025-12-12
**Architecture:** Continuous LMSR + Dynamic Liquidity Boost

---

## Overview

The Sooth Protocol V4 fee system creates a self-reinforcing liquidity loop.
Unlike standard AMMs, Sooth uses **Total Market Balance** (Collateral + Fees + PnL) to dynamically boost the liquidity parameter `b`.

**Key Behavior:**
- **Fees Compound Liquidity**: AMM fees increase the market's reserve.
- **Open Interest Boosts Liquidity**: Active positions (collateral held in the vault) *also* boost `b` temporarily. This means liquidity deepens when trading activity is high.
- **Governor Control**: Parameters are set globally but applied per market.

---

## The Dynamic `b` Formula

The depth of the AMM (`b`) determines slippage. Larger `b` = Lower Slippage.

```solidity
function b() public view returns (uint256) {
    // 1. Get Total Market Reserve (Held in GovernorVault)
    // IMPORTANT: This includes Fees + Net PnL + ACTIVE COLLATERAL
    int256 totalMarketBalance = governorVault.getMarketReserve(marketId);
    
    // 2. Apply Verification/Safety check
    // If balance is negative (insolvent), floor at small value
    
    // 3. Calculate Boost
    // b = bBase + (TotalBalance * reserveFactor)
    // Example: Factor 10% (1000 bps)
    // If Market has 100k USDC (Fees + User Collateral), b increases by 10k.
    // This creates "Deep Liquidity" during high volume/OI periods.
}
```

### Why this matters
- **High Activity = Low Slippage**: When users buy heavily (increasing Open Interest), the collateral backing those positions increases the vault balance. This boosts `b`, making subsequent trades cheaper.
- **Exit Contraction**: When users sell/redeem, funds leave the vault. `b` contracts.
- **Permanent Growth**: Retained Fees (which never leave) provide a permanent floor for `b` growth.

---

## Fee Types

### 1. LMSR (AMM) Fees
- **Rate**: Default `0.5%` (50 bps)
- **Applied**: Added to cost of every AMM trade.
- **Flow**: `TraderVault` collects fee -> Sends to `GovernorVault`.
- **Accounting**: Increases `marketReserves[id]`.

### 2. Orderbook Fees
- **Rate**: Default `0%` (Disabled)
- **Status**: Can be enabled via `SoothFeeController`.
- **Flow**: TBD (likely split between LPs and Treasury).

---

## Implementation Details

### `SoothMarketV4.sol`
- Calculates cost/fees.
- Queries `GovernorVault` for `b` logic.
- Tracks a local `reserve` variable for *Accumulated Fees Only* (internal accounting, currently unused for pricing).

### `SoothGovernorVault.sol`
- Holds all funds.
- Tracks `marketReserves[id]`.
- **Crucial**: `marketReserves` is modified by:
    1.  `receiveFunds` (Buy/Mint): Increases reserve.
    2.  `lockProceeds` (Sell): Decreases reserve (funds move to Lock bucket).
    3.  `payMarket` (Redeem/Settlement): Decreases reserve.

---

## Migration Notes (V3 -> V4)
- **Removed**: Static `increaseB()` calls.
- **Added**: `reserveFactorBps` in Governor config.
- **Changed**: Liquidity is now a function of TVL (Total Value Locked), not just historical fees.
