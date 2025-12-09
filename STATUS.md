# Project Status

> Last Updated: 2025-12-09 18:05 UTC+7

## Current Focus

- ✅ **V4 Contracts Deployed**: Continuous LMSR (qYes/qNo) live on Base Sepolia
- ✅ **Audit Complete**: All 85 tests pass, codebase cleaned, frontend audited
- 🔄 **Pending**: dApp UI testing, limit order verification

## Recent Changes (Last 5 Sessions)

| Date       | Area     | Change Summary                                  |
|------------|----------|------------------------------------------------|
| 2025-12-09 | Protocol | **Continuous LMSR** - ticks removed (ADR-005)  |
| 2025-12-09 | Audit    | Full codebase + frontend audit                 |
| 2025-12-09 | Docs     | Created `CHANGELOG.md`, updated ADRs           |
| 2025-12-09 | Deploy   | Deployed V4 markets with qYes/qNo              |
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
| UN Confirms Alien Life | `0xbF669983b1054809cF6860B5Afe192b03b0bea73` |
| BTC >= $100k | `0xD5C8b0FaA0CD924D9805577c77B50aC3493d04a1` |

## Audit Findings (2025-12-09)

### Fixed This Session
- [x] Created `CHANGELOG.md` — living changelog
- [x] Updated ADR-004 status — now Accepted (batch approach deployed)
- [x] Archived stale deploy scripts to `script_archive/`
- [x] Archived stale `ABI_GUIDE.md` to `docs/.../Archive/`

### Deferred (Cannot Archive — Active Dependencies)
- `SoothMarket.sol` — Used by V3 tests and `SoothRouter.sol`
- `SoothTraderVaultV4.sol` — Used by `V4Integration.t.sol`
- `ISoothMarket.sol` — Used by `SoothTraderVault.sol`, `SoothRouter.sol`

### Info (Low Priority)
- [ ] Lint warnings in `SoothLMSRReal.sol` (3 unsafe typecast)
- [ ] TODO in `AMMTradePanel.tsx` — cost estimate placeholder
- [ ] 75+ markdown files — some potentially stale

## Next Steps

- [ ] Test trades in dApp UI
- [ ] Test Limit Orders
- [ ] Monitor for any UI/contract interaction issues
- [ ] Future: Refactor `SoothTraderVault` to use only V4 interface

## Key Files

- Contracts: `packages/contracts-evm/contracts/`
- Frontend: `apps/web/src/`
- Deployments: `apps/web/src/config/v4-addresses.ts`
- Changelog: `CHANGELOG.md`
- Decisions: `DECISIONS.md`

