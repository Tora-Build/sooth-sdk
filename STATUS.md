# Project Status

> Last Updated: 2025-12-10 03:55 UTC+7

## Current Focus
-   **Frontend Integration & Verification**:
    -   Updating specific hooks (`useOrder`, `useTrade`) to use **Integer** amounts for Limit Orders.
    -   Updating `SoothMarket` hooks to use `price(outcome)` instead of ticks.
    -   Verifying full Dual-Venue flow (AMM + Orderbook) on Base Sepolia.

## Recent Changes
-   **2025-12-10 [Protocol]**: **V3 Legacy Code REMOVED**.
    -   Deleted all V3 contracts (`SoothMarket`, `SoothTraderVault`, `SoothLMSRReal`).
    -   Removed `ISoothAMM` and Tick-based logic.
-   **2025-12-10 [Deployment]**: **Fresh V4 Deployment** on Base Sepolia.
    -   Deployed V4 stack with Hybrid Granularity (Integer OB, WAD AMM).
    -   Synced new addresses and ABIs to Frontend.
-   **2025-12-10 [Docs]**: **Documentation Overhaul**.
    -   Updated `ARCHITECTURE.md`, `README.md`, `SHORT_SELLING.md` to V4.
    -   Created `V4_MIGRATION_GUIDE.md` for frontend devs.
-   **2025-12-10 [Fixes]**: **Critical Bug Fixes & UI Polish**.
    -   Fixed `panic: 0x11` (Arithmetic Underflow) in `TraderVault` by increasing Market return precision to WAD.
    -   Redeployed Markets 1 & 2 to apply fixes.
    -   Refined `LimitOrderForm` to be strictly for Limit Orders (Removed confusing "Market" toggle).

## Pending/Blocked
-   **Frontend Code**: Needs updates to match V4 interfaces (Integer granularity).

## Active Deployments (Base Sepolia - Chain 84532)

### Infrastructure
| Contract | Address |
|----------|---------|
| MockUSDC | `0x968a13217cac0710b3c313f133061cac2f95d889` |
| GovernorVault | `0xe02a65ea1bb6ed6a183f0f3d51bc2eaf01c2941d` |
| TraderVaultV4 | `0x53b107a356367b8063e2bf38590c6178934cccb1` |
| FeeController | `0x4e6f9c06a56c734e93ce2275407b51eac6b9e4a0` |
| OutcomeToken | `0xc0a118537f70be3cb535524a4acf0d9b94336da7` |

### Markets (Continuous LMSR)
| Market | Address |
|--------|---------|
| UN Confirms Alien Life | `0x1c95b682b7c2589e9c16b8ee8742e359276ccab3` |
| BTC >= $100k | `0xa4dc5b625fec5f39242f0f16d6d56d5fa847f6c8` |

## Audit Findings (2025-12-09)

### Fixed This Session
- [x] **Feature**: Implemented Collateralized Short Selling (Vault V3 & V4)
- [x] **CRITICAL**: Redeployed V4 Markets to fix stale Tick-based contracts
- [x] Updated Frontend Config (`deployments.json`, `v4-addresses.ts`)
- [x] Fixed `useMarket` hook hardcoding `qYes=0`
- [x] Fixed `useTradeQuote` fallback math logic
- [x] Fixed `AMMTradePanel` hardcoded placeholder
- [x] Archived stale deploy scripts to `script_archive/`
- [x] Fixed `approve` transaction failure (undefined address)
- [x] Fixed `TraderVault` refund math (Panic 0x11)
- [x] Fixed `LimitOrderForm` UI (Removed Market toggle)

### Deferred (Cannot Archive — Active Dependencies)
- `SoothMarket.sol` — Used by V3 tests and `SoothRouter.sol`
- `SoothTraderVaultV4.sol` — Used by `V4Integration.t.sol`
- `ISoothMarket.sol` — Used by `SoothTraderVault.sol`, `SoothRouter.sol`

### Info (Low Priority)
- [ ] Lint warnings in `SoothLMSRReal.sol` (3 unsafe typecast)
- [ ] TODO in `AMMTradePanel.tsx` — cost estimate placeholder
- [ ] 75+ markdown files — some potentially stale

## Next Steps

- [x] Test trades in dApp UI
- [x] Test Limit Orders
- [x] **New Feature**: Hybrid Sell (UI-Only Virtual Short)
- [ ] Monitor for any UI/contract interaction issues
- [ ] Future: Refactor `SoothTraderVault` to use only V4 interface

## Key Files

- Contracts: `packages/contracts-evm/contracts/`
- Frontend: `apps/web/src/`
- Deployments: `apps/web/src/config/v4-addresses.ts`
- Changelog: `CHANGELOG.md`
- Decisions: `DECISIONS.md`

