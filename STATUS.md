# Project Status

> Last Updated: 2025-12-12 12:24 UTC+7

## Current Focus
- **V4.5 Live** — All critical bugs fixed, UI polish phase.
- **LP Dashboard Polish** — Completed: terminology, formula alignment, dynamic solvency factor.
- **UI Specs System** — New documentation governance for frontend changes.

## Recent Changes (2025-12-12)

### ✅ LP Dashboard Polish
1. **VaultStats.tsx**: Removed confusing Vault Type A/B/C/D, simplified to "Governor Vault"
2. **VaultMarkets.tsx**: 
   - Dynamic solvency factor using `price(0)` from each market
   - Fetching `bBase()` for correct base liquidity display
   - Fixed market reserves precision from 6 to 18 decimals
3. **LiquidityModelInfo.tsx**: Text and formulas aligned with KNOWLEDGE.md
4. **useVault.ts**: Now fetches `totalLockedExposure` from contract
5. **useProtocolStats.ts**: Fixed locked calculation (was hardcoded 85%)

### ✅ Bug Fixes
1. **AmmMarketCard.tsx**: Removed duplicate `<h3>` element (title appearing twice)
2. **SettlementSimulator.tsx**: Fixed `MO_MARKET_ABI` hoisting bug, changed `q()` to `price()`

### ✅ New UI Specs System
- Created `apps/web/docs/specs/` folder with:
  - `LP_DASHBOARD_SPEC.md`
  - `TRADING_TERMINAL_SPEC.md`
  - `OPERATOR_CONSOLE_SPEC.md`
  - `ACTIVITY_LOG_SPEC.md`

### ✅ SOP Update
- Updated `.agent/workflows/frontend-dev.md` with mandatory spec check-in/check-out
- Recorded in `.agent/LESSONS_LEARNED.md`

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
- [ ] Visual verification of LP Dashboard polish
- [ ] Monad testnet deployment (awaiting funds)

## Next Steps
- Continue UI polish on Operator Console if needed
- Test portfolio page with active positions

## Previous Session Summary (2025-12-11)
- V4.4 deployed with 6 critical WAD overflow bug fixes
- Frontend `useActivePositions` and `LimitOrderForm` fixes
- Added `executeHybridSell` to frontend hooks
