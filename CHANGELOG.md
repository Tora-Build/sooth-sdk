# Changelog

All notable changes to Sooth Protocol will be documented in this file.

## [Unreleased]

### Added
- **Lock-on-Sell Architecture** (branch `codex/review-and-implement-lock-mechanism`):
  - `SoothGovernorVault`: Lock queue with per-user `LockEntry[]`, `lockProceeds()`, `claimUnlocked()`
  - Removed `unlockTime` from AMM positions — shares always unlocked
  - Sell proceeds locked 24h in GovernorVault until claimed
  - ADR-010 documents the design decision (Lock-on-Sell vs Lock-on-Buy)
- **Foundry Dependency**: `prb-math` installed under `packages/contracts-evm/lib/prb-math` for `SoothMarketV4` (sd59x18) imports.
- **Deployment Tooling Robustness**:
  - `packages/contracts-evm/script/verify-deployment.sh` now resolves repo paths relative to the script location (works from any cwd).
  - `sync-deployments.sh` now treats `apps/web/src/config/deployments.json` as canonical and syncs to other packages.
- **Claim Modal UI**:
  - Added "Locked Proceeds" card to Trading Account
  - Added Claim Dialog with countdown timer (`nextUnlock`)
  - Updated `useLockedFunds` hook to fetch detailed lock info
- **MegaETH Testnet Deployment**: V4.5 infrastructure + 2 markets (Chain 6343)
  - Used viem script with `gas: 999999999n` (forge script failed with RPC gas issues)
  - Script: `apps/web/scripts/deploy-megaeth.ts`
- **UI Specs System**: `apps/web/docs/specs/` with 4 spec documents
  - `LP_DASHBOARD_SPEC.md`, `TRADING_TERMINAL_SPEC.md`
  - `OPERATOR_CONSOLE_SPEC.md`, `ACTIVITY_LOG_SPEC.md`
- **SOP Rule**: Frontend-dev must check-in/check-out specs before/after UI modifications
- **QA Test Harness (Foundry)**:
  - Invariants: `packages/contracts-evm/test/invariants/VaultInvariants.t.sol`
  - Actors: `packages/contracts-evm/test/actors/TraderActor.sol`, `packages/contracts-evm/test/actors/LPActor.sol`
  - Scenarios:
    - `packages/contracts-evm/test/scenarios/MultiRoleScenarios.t.sol`
    - `packages/contracts-evm/test/scenarios/SettlementScenarios.t.sol`
    - `packages/contracts-evm/test/scenarios/AdversarialScenarios.t.sol`

### Changed
- **Base Sepolia Config (V4.6)**:
  - Bumped `apps/web/src/config/deployments.json` version to `4.9` (cache refresh)
  - Updated Base Sepolia market + outcome token addresses across:
    - `apps/web/src/config/deployments.json`
    - `apps/web/src/config/markets.json`
- **ProtocolAddresses UI**: now lists per-chain **Market + OutcomeToken** addresses from `markets.json` (instead of a single optional `SoothMarket` field).
- **V4 Standalone Page Hooks**:
  - `apps/web/src/hooks/v4/useAMMTrade.ts` now calls `tradeAMM` with signed params (buy = positive, sell = negative).
  - V4 UI is now chain-aware (no hardcoded Base Sepolia addresses) and supports BNB testnet deployments.
  - Orderbook `placeOrder` now passes the required `isBuy` flag (ABI parity with contracts).
- **Landing Page**: Added MegaETH badge (green indicator)
- **About Page**: "Infinite-End" → "Open-End" terminology throughout
- **KNOWLEDGE.md**: Updated with all 3 testnet deployment addresses, precision corrections
- **VaultStats.tsx**: Simplified header to "Governor Vault (Based)", removed Vault Type A/B/C/D
- **VaultMarkets.tsx**: 
  - Dynamic solvency factor from `price(0)` instead of hardcoded 0.693
  - Added `bBase()` fetch for correct base liquidity display
  - Fixed market reserves precision (6 → 18 decimals)
  - Updated column headers: "b_base", "Reserves", "Locked Exposure"
- **LiquidityModelInfo.tsx**: Aligned text and formulas with KNOWLEDGE.md
- **useVault.ts**: Fetches `totalLockedExposure` from GovernorVault contract
- **useProtocolStats.ts**: Fixed locked calculation (was hardcoded 85% estimate)

### Fixed
- **Settlement Hook Safety**: `useSettlement.ts` now guards when `SoothSettlement` isn’t configured for a chain (prevents reads/writes from crashing).
- **Deployments Typing**: `useDeployments.ts` no longer requires optional infra keys that aren’t present in `deployments.json`.
- **ABI Wiring (V4 hooks path)**: `apps/web/src/config/abis/v4-abis.ts` now points at `abis/v4/*` JSON artifacts.
- **Mobile Zoom**: Disabled pinch-to-zoom to prevent fat finger issues
- **First-TX Page Reload**: Removed auto-reload on version mismatch in `useDeployments.ts`
- **AmmMarketCard.tsx**: Removed duplicate `<h3>` (title appearing twice)
- **SettlementSimulator.tsx**: `MO_MARKET_ABI` hoisting bug, changed `q()` to `price()`
- **CRITICAL (C-07)**: `creditMergeProceeds` — Used `onlyMarket` but called by OutcomeToken during merge
  - Added `_isOutcomeToken` mapping and `onlyOutcomeToken` modifier
  - Added `setOutcomeToken()` admin function
  - Fixed hybrid sell transaction failures
- **My Orders Display**: Orders not showing in "My Orders" tab
  - Root cause: Market's `maker` is TraderVault, not user wallet
  - Fix: Lookup real owner via `TraderVault.orderOwners(orderId)`

### Deployed
- **Base Sepolia V4.6 Markets (2025-12-14)**:
  - MockUSDC: `0x53d34066A316AE1699d434753B70593A6D59Fec1`
  - TraderVault: `0xa8aDE73124B3256F98f510F6A9E7C1e3Aa71d20B`
  - GovernorVault: `0x2A2DfA1B3B3F4db798b759d07064Bb800BD10fB1`
  - FeeController: `0x1a646107e7E88aa01Fadff3145Af08156679198e`
  - Market 1 (Alien): `0xd2A266c2081C0f2c7c86b5541B9e9b255dde91F9`
  - OutcomeToken 1: `0xBf2866f71A082446DA6919C92C477d9D1608E4B7`
  - Market 2 (BTC): `0x3423223043A6815547c0E83ec5c4aE1AeCb0eE02`
  - OutcomeToken 2: `0xe2A82254C7B831F87e659d3dc3D4dbe2B7De977f`
- **BNB Testnet V4.6 (2025-12-14)**:
  - MockUSDC: `0x89BA3FEe2FB764Ec297DC91bb874aa5bF88F204c`
  - TraderVault: `0x05818C4028ff5c273B45B3c55131Af2Bd9D12322`
  - GovernorVault: `0xEB33E2f815306D936d4bDD2b33b2b68C16b62Fa0`
  - FeeController: `0x3152A8cd6CA0C64675C73486B06203a9D8226448`
  - Market 1: `0x347a74a7025C42BE608F3Bdc0B150D4AD6eb4674`
  - OutcomeToken 1: `0xC69003eEc9B262dd9d5911d4d00133BC73d5f70d`
  - Market 2: `0xD222b33742cA522fa2Ec8198197F3a05ef896B40`
  - OutcomeToken 2: `0x1A7B20B43455CA6f861a574EcD8F9E5c9cE4e3a3`
- **MegaETH Testnet V4.5 (2025-12-12)**:
  - MockUSDC: `0x493da6e5c9de67ab50b2fb08d14865614189b5c2`
  - TraderVault: `0xdc980ac16626211a7c472a94a163440eb68c5bfc`
  - GovernorVault: `0xdb0063ce93e445ff7a8916f6f5a093f80833494f`
  - Market 1: `0x89ba3fee2fb764ec297dc91bb874aa5bf88f204c`
  - Market 2: `0xeb33e2f815306d936d4bdd2b33b2b68c16b62fa0`
- **BNB Testnet V4.5 (2025-12-12)**:
  - MockUSDC: `0x58F35BE6A5e3D2be4C3575853043322B02FEeD84`
  - TraderVault: `0x50293aD4e42593A8b081960c991c198729E81192`
  - GovernorVault: `0x8629b9ca457F4088ec8346FAED61DA858FDB498d`
- **Base Sepolia V4.5 (2025-12-12)**:
  - MockUSDC: `0x3E45bf96a8D866D796E168eE77a5fA7507D544F1`
  - TraderVault: `0x48Efb2434383E87a4a143D2B07BeE73611f5423C`
  - GovernorVault: `0xcB0f1305951d4BC6EF266790836aC62604cFA733`
  - FeeController: `0xE570Ab7dBbB58241F2cD7E1D3E2dD43196DAee97`
  - Market 1: `0x99CB8c0e3da2604518b8210589edcaB50Cc6f769`
  - Market 2: `0x94D02d846a04A751e9e4f93A6684a30e043444Da`

---

## [0.4.4] - 2025-12-11

### Fixed
- **CRITICAL (C-01)**: `onOrderMatched` — `matchedAmount * 1e18` overflow (matchedAmount already WAD)
- **CRITICAL (C-02)**: `_placeOrder` — `targetPrice * matchedAmount` missing `/1e18`
- **CRITICAL (C-03)**: `redeem()` — `shares * 1e18 / scalar` (shares already WAD)
- **CRITICAL (C-04)**: `_matchBuyOrder` — `matchAmount * matchPrice` missing `/1e18`
- **CRITICAL (C-05)**: `_matchSellOrder` — Same as C-04
- **CRITICAL (C-06)**: `merge()` — `return amount * 1e18` (already WAD)
- **Frontend**: `ammPositions` ABI argument order corrected to `(user, market)`
- **Frontend**: Orderbook share decimals now correctly use WAD (18 decimals)

### Added
- **Security Audit**: Internal audit of all V4 contracts (6 Critical, 2 High, 1 Medium, 2 Low)
- **Verification Tooling**: `verify-deployment.sh` script to validate config vs on-chain state
- **Pre-commit Hook**: `.husky/pre-commit` blocks commits with invalid deployment config
- **Agent Memory Aid**: `.agent/LESSONS_LEARNED.md` for persistent knowledge across sessions

---

## [0.4.0] - 2025-12-10

### Added
- Continuous LMSR implementation using PRB-Math (`qYes`/`qNo` state)

### Changed
- **BREAKING**: `ISoothTraderVault.placeOrder` now requires `bool isBuy` as the 5th argument.
- `SoothTraderVault.sol` (V3/V4): Updates `placeOrder` to assume "Buy Opposite" for shorts.
- `SoothMarketV4.sol` - Now uses continuous LMSR instead of tick-based pricing
- `ISoothMarketV4.sol` - `initialize()` takes `_initialQYes`/`_initialQNo`, `calculateAMMTradeCost()` returns `newQYes`/`newQNo`
- Price calculation: `exp(qYes/b) / (exp(qYes/b) + exp(qNo/b))`
- **Documentation**: Updated `ARCHITECTURE.md`, `README.md`, `SHORT_SELLING.md` to V4 specs.

### Removed
- **V3 Legacy Code**: Deleted `SoothMarket`, `SoothTraderVault`, `SoothLMSRReal` (standalone), `TickCostRegistry`, `ISoothAMM`.
- Tick-based pricing system (`currentTick`, `TickCostRegistry` dependency for new markets)
- Old `DeployV4.s.sol`, `DeployMarket1.s.sol`, `Step2_Initialize.s.sol` (archived)

### Deployed
- **Base Sepolia (2025-12-10)**:
  - MockUSDC: `0x968a13...`
  - GovernorVault: `0xe02a65...`
  - TraderVaultV4: `0x53b107...`
  - FeeController: `0x4e6f9c...`
  - OutcomeToken: `0xc0a118...`
  - Market (V4): `0x465606...`

### Fixed
- **Critical**: Arithmetic Underflow (0x11) in `SoothTraderVaultV4` refund logic.
  - *Fix*: Updated `SoothMarketV4` to return `matchedValue` in WAD precision (avoiding integer truncation).
- **Transaction**: `TraderVault: invalid market` error caused by mislinked contracts.
- **UI**: `LimitOrderForm` crashing with `SyntaxError`.
- **UI**: `approve` failing due to undefined address reference.

### Changed
- **UI**: `LimitOrderForm` is now strictly for Limit Orders. Removed "Market" order toggle to reduce confusion.
- **UI**: "Limit" prefix removed from Order Button text (e.g. "Buy YES" instead of "Limit Buy YES").

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

## [Unreleased]
### Added
-   Research: `SHARE_GRANULARITY_ANALYSIS.md` (Hybrid Integer/Fractional model).
-   Research: `V4_EFFICIENCY_REPORT.md` (Economic simulation).
-   Research: `DYNAMIC_OB_FEES.md` (Design doc).
-   Script: `scripts/research/sim_v4_efficiency.py`.
-   Script: `scripts/research/sim_fee_dynamics.py`.

### Changed
-   Docs: Updated `FEE_DESIGN.md` and `LIQUIDITY_DYNAMICS.md` to reflect V4 Continuous LMSR (Removed V3/Tick references).
-   Docs: Updated `V4_FORMULAS.md` to remove stale tick math.

### Fixed
-   Research: Identified critical bug in `SoothMarketV4` (AMM trades do not mint tokens/track balance).

## [0.1.0] - 2025-12-03

### Added
- Singleton Trader Vault architecture (v2.0)
- Initial Base Sepolia deployment
- Frontend dApp with AMM trading UI
