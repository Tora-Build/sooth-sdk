# Project Status

> Last Updated: 2025-12-09 18:05 UTC+7

## Current Focus

- ✅ **V4 Contracts Deployed**: Continuous LMSR (qYes/qNo) live on Base Sepolia
- ✅ **Audit Complete**: All 85 tests pass, codebase cleaned, frontend audited
- ✅ **dApp UI Verified**: Pricing math, Fees usage, Transacting, Logic
- ✅ **Clean Code**: Legacy V3 artifacts removed

## Recent Changes (Last 5 Sessions)

| Date       | Area     | Change Summary                                  |
|------------|----------|------------------------------------------------|
| 2025-12-09 | Deploy   | **Redeployed Markets** - Fixed stale tick contracts |
| 2025-12-09 | Protocol | **Continuous LMSR** - ticks removed (ADR-005)  |
| 2025-12-09 | Audit    | Full codebase + frontend audit                 |
| 2025-12-09 | Docs     | Created `CHANGELOG.md`, updated ADRs           |
| 2025-12-08 | Design   | Sooth Protocol V3 architecture finalization    |

## Active Deployments (Base Sepolia - Chain 84532)

### Infrastructure
| Contract | Address |
|----------|---------|
| MockUSDC | `0xa0eEa05Cc350Ac218683815e85Cac4A1a1eF36dd` |
| GovernorVault | `0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f` |
| TraderVault | `0xee91e05f95cBaACD46f58432DF72CB5C451e98E0` |
| FeeController | `0xa367B312Ca1845B7c6076345cB5cd529F935B4FA` |

### Markets (Continuous LMSR)
| Market | Address |
|--------|---------|
| UN Confirms Alien Life | `0x5c8c3621b0606f8b42ab17c3e33057948e587ee7` |
| BTC >= $100k | `0x00da96600863a4f26e8a9cb5ca5524c3d7115403` |

## Audit Findings (2025-12-09)

### Fixed This Session
- [x] **CRITICAL**: Redeployed V4 Markets to fix stale Tick-based contracts
- [x] Updated Frontend Config (`deployments.json`, `v4-addresses.ts`)
- [x] Fixed `useMarket` hook hardcoding `qYes=0`
- [x] Fixed `useTradeQuote` fallback math logic
- [x] Fixed `AMMTradePanel` hardcoded placeholder
- [x] Archived stale deploy scripts to `script_archive/`

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
- [ ] Test Limit Orders
- [ ] Monitor for any UI/contract interaction issues
- [ ] Future: Refactor `SoothTraderVault` to use only V4 interface

## Key Files

- Contracts: `packages/contracts-evm/contracts/`
- Frontend: `apps/web/src/`
- Deployments: `apps/web/src/config/v4-addresses.ts`
- Changelog: `CHANGELOG.md`
- Decisions: `DECISIONS.md`

