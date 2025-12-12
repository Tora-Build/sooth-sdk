# Project Status

> Last Updated: 2025-12-12 00:15 UTC+7

## Current Focus
- **V4.5 Deployed & Verified** — OutcomeToken authorization fix applied.
- **Ready for Testing** — User should hard refresh and mint new USDC.

## Recent Changes (2025-12-12)

### 🔴 Critical Bug Fix: OutcomeToken Authorization
- **Root Cause**: `creditMergeProceeds` used `onlyMarket` modifier but was called by OutcomeToken during merge flow.
- **Fix**: Added `onlyOutcomeToken` modifier and `setOutcomeToken()` admin function.

### ✅ V4.5 Deployment
- **Full redeploy** of all infrastructure + markets to Base Sepolia.
- **Verification passed** — all contracts linked correctly.

## Active Deployments (Base Sepolia - Chain 84532)

### V4.5 Infrastructure (Current)
| Contract | Address |
|----------|---------|
| MockUSDC | `0x3E45bf96a8D866D796E168eE77a5fA7507D544F1` |
| GovernorVault | `0xcB0f1305951d4BC6EF266790836aC62604cFA733` |
| TraderVaultV4 | `0x48Efb2434383E87a4a143D2B07BeE73611f5423C` |
| FeeController | `0xE570Ab7dBbB58241F2cD7E1D3E2dD43196DAee97` |

### V4.5 Markets (Current)
| Market | Address |
|--------|---------|
| UN Confirms Alien Life | `0x99CB8c0e3da2604518b8210589edcaB50Cc6f769` |
| OutcomeToken 1 | `0x6C590f0cd0750043ad46Ec37D2d095De89506cfd` |
| BTC TWAP >= $100k | `0x94D02d846a04A751e9e4f93A6684a30e043444Da` |
| OutcomeToken 2 | `0x7178301FDEe367DC0ad10215c466293f9E7CDc5e` |

## Pending/Blocked
- [ ] User testing of hybrid sell functionality
- [ ] Monad testnet deployment (awaiting funds)

## Previous Session Summary (2025-12-11)
- V4.4 deployed with 6 critical WAD overflow bug fixes
- Frontend `useActivePositions` and `LimitOrderForm` fixes
- Added `executeHybridSell` to frontend hooks
