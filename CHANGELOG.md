# Changelog

All notable changes to Sooth Protocol will be documented in this file.

## [Unreleased]

### Added
- **Lock-on-Sell Architecture** (branch `codex/review-and-implement-lock-mechanism`):
  - `SoothGovernorVault`: Lock queue with per-user `LockEntry[]`, `lockProceeds()`, `claimUnlocked()`
  - Removed `unlockTime` from AMM positions — shares always unlocked
  - Sell proceeds locked 24h in GovernorVault until claimed
  - ADR-010 documents the design decision (Lock-on-Sell vs Lock-on-Buy)
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

### Changed
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
