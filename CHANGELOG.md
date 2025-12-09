# Changelog

All notable changes to Sooth Protocol will be documented in this file.

## [Unreleased]

### Added
- Continuous LMSR implementation using PRB-Math (`qYes`/`qNo` state)
- `MockUSDC.sol` - Moved to dedicated `contracts/mocks/` folder
- `DeployUtilities.s.sol`, `DeployUtilitiesBatch.s.sol` - Phased deployment scripts
- `STATUS.md`, `DECISIONS.md` - Project coordination artifacts
- Agent workflows in `.agent/workflows/`
- ADR-005: Continuous LMSR decision record

### Changed
- `SoothMarketV4.sol` - Now uses continuous LMSR instead of tick-based pricing
- `ISoothMarketV4.sol` - `initialize()` takes `_initialQYes`/`_initialQNo`, `calculateAMMTradeCost()` returns `newQYes`/`newQNo`
- Price calculation: `exp(qYes/b) / (exp(qYes/b) + exp(qNo/b))`

### Removed
- Tick-based pricing system (`currentTick`, `TickCostRegistry` dependency for new markets)
- Old `DeployV4.s.sol`, `DeployMarket1.s.sol`, `Step2_Initialize.s.sol` (archived)

### Deployed
- **Base Sepolia (2025-12-09)**:
  - GovernorVault: `0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f`
  - TraderVault: `0xee91e05f95cBaACD46f58432DF72CB5C451e98E0`
  - FeeController: `0xa367B312Ca1845B7c6076345cB5cd529F935B4FA`
  - UN Market: `0xbF669983b1054809cF6860B5Afe192b03b0bea73`
  - BTC Market: `0xD5C8b0FaA0CD924D9805577c77B50aC3493d04a1`

---

## [0.3.0] - 2025-12-08

### Added
- Sooth Protocol V3 architecture design
- Unified tick-based AMM design documents

### Changed
- Fund lock mechanism refined (AMM only)
- Orderbook mechanics clarified

---

## [0.2.0] - 2025-12-05

### Removed
- Solana integration (archived to `docs/solana-integration-archive/`)

### Fixed
- Wallet connection stability (Phantom interference)
- EVM-only focus for faster iteration

---

## [0.1.0] - 2025-12-03

### Added
- Singleton Trader Vault architecture (v2.0)
- Initial Base Sepolia deployment
- Frontend dApp with AMM trading UI
