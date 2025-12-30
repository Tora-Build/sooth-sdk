# Issue Summary: Graduation Price Sync & Fee Logic - Dec 29, 2025

## 1. TickBook Initial Price Discrepancy (0.5 vs AMM Price)
**Issue:**  
Newly graduated markets on TickBook were initializing at `0.5` probability (50%), regardless of the actual AMM trading price (e.g., ~16.8%).

**Root Cause:**  
The `DeployV9Full.s.sol` deployment script was pre-registering markets with a hardcoded `initialProb = 500e15` (50%). When `LaunchpadEngine` later attempted to graduate the market and register it with the *correct* AMM price, it encountered a `DuplicateMarket` error (caught and ignored), leaving the initial 50% price intact.

**Fix:**  
- Removed the manual market registration block from `DeployV9Full.s.sol`.
- `LaunchpadEngine` will now exclusively handle TickBook registration during the graduation transaction, ensuring the initial Tickbook price matches the live AMM price.

## 2. Frontend Fee Display Mismatch (5% vs 1%)
**Issue:**  
Markets that were effectively graduated (fees > threshold) were still showing the Pre-Graduation fee rate (5%) in the UI, and the "Pro Trading Locked" screen persisted.

**Root Cause:**  
The frontend `useLaunchpadMarketDirect` hook relying on the `isGraduated` boolean from the `markets` mapping, which appeared stale/false via RPC even when the market was graduated.

**Fix:**  
- Updated `useLaunchpadMarketDirect.ts`.
- Implemented "Effective Graduation" check: `isEffective = isGraduated || (feesAccrued >= threshold)`.
- If effective, the frontend now correctly returns `postGradFeeBps` (1%) and unlocks the Pro UI.

## 3. Sell Fee Implementation (AMM Engine Architecture)
**Issue:**  
Trading fees were not being correctly applied to Sell transactions on the AMM. The previous `AMMEngine` architecture locked 100% of sell proceeds for the user, giving the `LaunchpadEngine` no mechanism to deduct/collect the generated fee.

**Root Cause:**  
`AMMEngine.tradePositionsFor` calculated proceeds internally and credited the full amount to the user's locked balance.

**Fix:**  
- **IAMMEngine / AMMEngine:** Updated `tradePositionsFor` signature to accept a `uint256 fee` parameter.
- **AMMEngine Logic:** For Sells, if `fee > 0`, the engine now deducts the fee from the user's proceeds and transfers the fee amount (in USDC) to the `payer` (Router/Launchpad).
- **LaunchpadEngine:** Updated `tradePositions` to calculate the fee (based on graduated status) for Sells and pass it to the AMM Engine.
- **Event Emission:** Updated `PositionTraded` events to reflect the Net Proceeds received by the user on sells.

## Action Required
1. **Redeploy Contracts:** A full redeployment of `AMMEngine` and `LaunchpadEngine` is required for the fee logic and price sync fixes to take effect.
2. **Refresh Client:** Hard refresh the web application to load the updated fee calculation logic.
