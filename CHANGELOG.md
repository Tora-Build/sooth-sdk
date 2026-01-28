# Changelog

All notable changes to Sooth Protocol will be documented in this file.

## [Unreleased]

### Fixed
- **AMMSettlementCard Mock Data (2026-01-27)**: Replaced hardcoded `mockPosition = { yesShares: 0n, noShares: 0n }` with real user position data from `useAMMPositionDirect` hook. Users can now see their AMM shares and claim payouts on finalized markets.
- **LPHolders Null Return (2026-01-27)**: Fixed component returning null when stats unavailable on finalized markets. Added `useTruthMarketDirect` to check `isFinalized` status and render LP Leaderboard even without stats. LP Leaderboard now visible on finalized Trade page.

### Changed
- **Trade Page UI (2026-01-27)**: Improved AMMSettlementCard visual hierarchy with prominent status badges (Settled/Finalized), large payout display, clear winning outcome indicator, and full-width claim button with icon.
- **Pro Page UI (2026-01-27)**: Standardized settlement card design matching AMMSettlementCard style. Added grid layout for Winning Outcome + Payout, status badges, and prominent redemption button.
- **UserOrdersPanel Decision (2026-01-27)**: Decided to KEEP UserOrdersPanel in Pro finalized view. Reasoning: Open orders lock user collateral; market finalization does not auto-cancel orders due to gas constraints; users must manually cancel to retrieve funds and claim pending fills.

### Verified
- **Stage Detection (2026-01-27)**: Verified frontend stage detection logic is correct. Priority order `dismissed > finalized > settled > graduated > bonding` working as intended. User-reported "Bonding" badge issue is data/contract-level, not frontend.
- **Portfolio Position Display (2026-01-27)**: Verified all Portfolio components (AMMPositionRow, LPPositionRow, TickBookInternalRow, LockedSharesRow) correctly display positions and redemption buttons on finalized markets. No code changes needed.

## [V11.1] - 2026-01-26

### Deployment
- Fresh V11.1 deployment to Base Sepolia
- Single-chain focus: Monad, MegaETH, Arc temporarily disabled
- Version bump from V11.0

### Changed
- Indexer, CLI, and frontend configs updated for single-chain testing
- All deployment configs updated with new contract addresses

## [V11.0] - 2026-01-25

### Summary
V11 introduces **Trial Period**, **ERC20 LP Tokens**, **Validated Adjudicator**, and **Protocol Config** (guardian + global pause). Deployed to all 4 testnets; active testing on Base Sepolia.

### Fixed
- **Trial Period Tests**: Updated TrialPeriodFlow + TrialPeriodInvariants to dismiss only after the trial period ends, aligning tests with on-chain dismissal rules.
- **Finalization-Gated Redemptions**: Payouts now require market finalization to prevent veto-window insolvency across Collateralizer, AMMEngine, and TickBookVault (V11 lifecycle: SETTLED → FINALIZED).

### Frontend (2026-01-24)
- **Stage Filtering**: Added comprehensive market lifecycle stage filtering to Trade and Pro pages.
  - 5 stages: `bonding`, `graduated`, `settled`, `finalized`, `dismissed`
  - `settled` = adjudicator declared outcome, veto period active
  - `finalized` = veto period ended, users can redeem
  - `dismissed` = V11 trial period failure, users can claim refunds
- **AMMSettlementCard**: Now properly distinguishes settled vs finalized:
  - Settled: Amber styling, "Veto Period Active" badge, claim disabled
  - Finalized: Emerald styling, "Final" badge, claim button enabled
- **DismissedMarketPanel**: New component for V11 trial period refund claims
- **useOnChainMarkets**: Added `isFinalized` read from TruthMarket for each market
- **Pro Page**: Now excludes settled/finalized/dismissed markets (only shows tradeable)

### Fixed (2026-01-24)
- **CLI Checksum Complete Fix**: Added complete USDC tracking to `checksum` command.
  - **Problem**: After AMM fix, checksum still showed -1.27 USDC imbalance in some runs.
  - **Root Cause**: Missing tracking for `vaultMarketCollateral` (TickBookVault) and `lpYieldPool` (LaunchpadEngine).
  - **Fix**: 
    - Added `vaultMarketCollateral` fetch via `TickBookVault.marketCollateralWad(market)`
    - Added `lpYieldPool` to `MarketState` interface
    - Added "Potential Stuck USDC" display section when non-zero
  - **Result**: Both `market-lifecycle-multi-actor` and `trial-period` scenarios now pass with exact 0.00 USDC balance.

- **Scenario Test Report**: Consolidated scenario testing documentation.
  - Renamed `REPORT-2026-01-23.md` to `SCENARIO-TEST-REPORT.md` (living document)
  - Added scenario status table distinguishing V11 vs legacy scenarios
  - Added lessons learned section (6 key learnings)
  - Added maintenance schedule for periodic testing

- **Trial Period Scenario**: Verified V11 dismissal and refund flow.
  - 19 steps, 0 failures, 0.00 USDC checksum
  - Tests: market creation → AMM trading during trial → creator dismissal → trader refunds

### Fixed (2026-01-23)
- **CLI Zero-Sum P&L Verification**: Fixed `checksum` command showing -71.24 USDC imbalance after `market-lifecycle-multi-actor` scenario.
  - **Root Cause**: AMM positions (YES/NO shares from pre-graduation trades via `LaunchpadEngine.tradePositions`) were not being tracked.
  - **Fix**: Added `AMMEngine.getPosition(market, user)` calls to `snapshot` and `checksum` functions in `wallet.ts`.
  - **Changes**:
    - Added `AMMEngineAbi` with `getPosition` function
    - Extended `ActorPositions` interface with `ammYes` and `ammNo` fields
    - Updated `snapshot()` to fetch AMM positions per actor
    - Updated `checksum()` to fetch AMM positions per actor
    - Updated `calculateActorTotalValue()` to include AMM positions in YES/NO totals
    - Updated `printSnapshot()` to display AMM positions in breakdown (`amm:X/Y`)

### Added
- **ProtocolConfig**: New protocol-level guardian list + global pause contract; Launchpad/AMM/TickBook/Vault read pause state.
- **V11 Validation Script**: `validate-spot-crossing.ts` ported to V11 (launchpad create → graduation → TickBook orderbook).
- **CLI Scenario Auto-Run**: `--scenario` flag for non-interactive runs and new `market-lifecycle-multi-actor` scenario (creator/AMM/TickBook/keeper flows).
- **Keeper Claim Command**: `claimspotsellfor` for permissionless spot sell proceeds claim.
- **Actor Roles**: Added `david` (adjudicator) and `ellen` (keeper) with `.env` support.

### Changed
- **Launchpad createMarket**: New signature adds `adjudicatorAgentId`/`adjudicatorMinValidators`; guardian must equal protocol config.
- **TruthMarket finalize**: Adjudicator-only finalize; guardian keeps veto only.
- **Adjudicator auto-register**: `ValidatedAdjudicator.registerMarket` is permissionless and auto-called at market creation with per-market config.
- **Frontend + scripts**: Create-market flows and scripts updated to read `protocolConfig()` and pass new args.
- **Scenario Flow**: `setmarket created` support and scenario now re-selects the created market post-graduation.
- **Actor Defaults**: Roles mapped to creator/amm/tickbook/adjudicator/keeper for multi-actor testing.

### Fixed
- **Scenario Failure Handling**: Scenario mode now fails on command errors instead of always passing.

### V11 Architecture Decisions (2026-01-21)

**ADR-082: Adjudicator Trust & Guardian Role**
- Permissionless adjudicator choice (creators pick any address)
- Adjudicator registries = off-chain trust signals, not protocol-enforced
- Protocol-level guardian (role list), not per-market selection
- Global pause delegated to guardians; owner retains emergency override
- Finalize = adjudicator-only; guardians cannot finalize
- Retroactive settlement (tStar) deferred; finalize is the future hook
- `ValidatedAdjudicator.registerMarket` auto-called by Launchpad during market creation

**ADR-083: Canonical Filenames**
- Rename `LaunchpadEngineV11.sol` → `LaunchpadEngine.sol`
- Move `test/v11/` to feature-based, non-versioned paths
- Use Git history for versioning; no parallel versioned copies

**CLI Actor Testing Tool**
- Planning complete: 8 actors (Creator, AMM Trader, TickBook Trader, Adjudicator, Guardian, Keeper, Arbitrager, Protocol Owner)
- Action Purpose table with 30+ functions and recommendations
- Proposed: `claimSpotSellProceedsFor` for keeper parity
- Added: `ProtocolConfig` contract for guardian role list + global pause

---

### V11 Implementation (2026-01-20)

**Phase 1: Trial Period & LP Tokens**
- **Added**: Trial period system with `lockedCost` and `trialBalance` tracking per user/market
- **Added**: `dismissMarket()` for creators to abort during trial period
- **Added**: `claimRefund()` for users to recover locked costs after dismissal
- **Added**: `LaunchpadLPToken.sol` — ERC20 LP tokens with settlement-locked transfers

**Phase 2: ERC-8004 Trustless Agents**
- **Added**: `IERC8004.sol` interfaces (IIdentityRegistry, IReputationRegistry, IValidationRegistry)
- **Added**: `IAdjudicator.sol` — Standard adjudicator interface with `IValidatedAdjudicator` extension
  - `canSettle(market)` — Check if adjudicator can settle
  - `adjudicatorType()` — Returns adjudicator type ("tee", "manual", "oracle", etc.)
  - `settle(market, outcome, tStar, resolutionData)` — Generic settlement function
- **Added**: `ValidatedAdjudicator.sol` — TEE attestation-based settlement (implements `IValidatedAdjudicator`)
  - Multi-validator support for high-value markets
  - Configurable attestation window and minimum score

**Changed**
- Clarified V11 policy: early settlement allowed pre-expiration; agent-gated markets not planned; agent discounts limited to TickBook; first adjudicator target is ZK/Brevis (multi-validator interface unchanged).
- Launchpad agent gating and fee discounts are disabled in V11; Launchpad agent helpers are deferred until code size allows.

**Deferred/Removed (Code Size)**
- **Deferred**: `placeOrderWithPermit()` removed from TickBookPoolManager to stay under the EVM code size limit; revisit via module or alternate approval flow.
- **Deferred**: `placeOrderWithAgent()` removed from TickBookPoolManager to stay under the EVM code size limit.
- **Removed**: `clearDustLiquidity()` admin helper removed from TickBookPoolManager to stay under code size limit.
- **Removed**: Launchpad `tradeWithAgent()` and `createMarketWithOptions()` helpers removed to reduce code size.
- **Removed**: Launchpad `getTrialStatus()` and `getExitOptions()` view helpers removed; derive via public mappings.

**Files Created**
- `packages/contracts-core/src/interfaces/IERC8004.sol`
- `packages/contracts-core/src/interfaces/IAdjudicator.sol`
- `packages/contracts-core/src/LaunchpadLPToken.sol`
- `packages/contracts-core/src/ValidatedAdjudicator.sol`
- `packages/contracts-core/src/LaunchpadEngine.sol`

**Files Modified**
- `packages/contracts-core/src/TickBookPoolManager.sol` — Removed permit/agent helpers to stay under EVM code size limit
- `packages/contracts-core/src/interfaces/ITruthMarket.sol` — Added `settle()` and `finalize()`
- `packages/contracts-core/src/interfaces/ITickBookVault.sol` — Added `usdc()` function
- `packages/contracts-core/src/interfaces/ILaunchpadEngine.sol` — Added V11 events and functions
- `packages/contracts-core/src/LaunchpadEngine.sol` — Added V11 stub implementations

**Tests**: 237 passing (unit, integration, invariant, fuzz)

### Deployed

**Base Sepolia V11.0** (Active Testing):
- LaunchpadEngine: `0x0ec7c40acbe1b0b1340aa20b9bb141e2d0996826`
- TickBookPoolManager: `0xa2261ad47f5f60048384f66f544d7ec48ddb3ed0`
- TickBookVault: `0xa21f54a6964c0213c610ef55dc1abf88ee63982e`
- AMMEngine: `0x16948479c5d43b59742adae6401645271546366d`
- Collateralizer: `0x113eaa03740480ef36b9def40b2399e27495748c`
- MockUSDC: `0x2db2e129f31b2a659b2c1c07410789b8d3c898b9`

*Other networks remain on V10.9 pending V11 testing completion.*

---

## [V10.10] - 2026-01-20

(V10 archived - see git history for full V10.x changelog)

---

### Keeper Bot & Contract Fix (2026-01-18)

**Contract Bug Fix (V10.8.4)**
- **Fixed**: `_calculateOverlap` in `TickBookPoolManager.sol` line 1263 - changed `findNextDown(MAX_TICK + 1)` to `findNextUp(0)` for YES spot sells.
- **Issue**: Was finding HIGHEST tick (most expensive) instead of LOWEST tick (cheapest) for YES spot sell overlap.
- **Impact**: Spot sells at lower prices were being missed during crossing calculations.
- **Deployed**: V10.8.4 to Base Sepolia with fix.

**Keeper Bot Improvements**
- **Fixed**: Analyzer was using `tickLower` instead of `tickUpper` for buy order max price, missing valid arbitrage opportunities.
- **Added**: `MIN_SAFE_TICK` (10) and `MAX_SAFE_TICK` (990) filters to avoid contract edge cases at tick boundaries.
- **Fixed**: Executor now sells at buyer's `tickUpper` (max price they'll pay) instead of `tickLower`, maximizing profit.
- **Removed**: Unnecessary self-buy restriction - contract allows buying from own spot sells.
- **Improved**: Better error message extraction from contract reverts.
- **Changed**: Sequential execution (one opportunity at a time) to prevent nonce conflicts.
- **Redesigned**: TUI with Monokai theme and simplified text-based layout.

**Deployment**
- Base Sepolia V10.8.4:
  - TickBookPoolManager: `0x78e046dd0857d05b9cde976a171f7e6f86c3ecaa`
  - LaunchpadEngine: `0x8bfb3eec9c0f75f036be3a21a913e9a67226f3f8`
  - TickBookVault: `0x8ac0534cac22417b629f65e3c5ebb94ffa0be159`
  - MockUSDC: `0x502d6e522b43dfff1951acd9e36d2c20d1333edb`

**Files Changed**
- `packages/contracts-core/src/TickBookPoolManager.sol` - Fixed spot sell overlap calculation
- `packages/keeper/src/analyzer.ts` - Fixed tickUpper usage, added safe tick filter
- `packages/keeper/src/executor.ts` - Fixed sell tick, removed self-buy check, better errors
- `packages/keeper/src/index.ts` - Sequential execution
- `packages/keeper/src/dashboard.ts` - Monokai TUI redesign
- `packages/keeper/src/config.ts` - V10.8.4 addresses
- `apps/web/src/config/deployments.json` - V10.8.4 addresses

### Code Quality Sprint Continued (2026-01-18)

**Frontend - Component Extraction**
- **Extracted**: `LiquidityMap.tsx` (397 lines) from `Pro.tsx` — Visual liquidity depth chart for TickBook orderbook showing bid/ask distribution across price ticks with animated pixel blocks.
- **Extracted**: `UserOrdersPanel.tsx` (781 lines) from `Pro.tsx` — Order management panel with claim, cancel, batch operations for range orders and spot sells.
- **New**: Created barrel export at `apps/web/src/components/features/pro/index.ts`.
- **Reduced**: `Pro.tsx` from ~2700 lines to ~1580 lines (~42% reduction).

**Frontend - Build Optimization**
- **Added**: Vite `manualChunks` configuration for better bundle caching:
  - `vendor-react`: react, react-dom, react-router-dom
  - `vendor-web3`: wagmi, viem, @tanstack/react-query
  - `vendor-state`: zustand

**Contracts - Documentation**
- **Updated**: `packages/contracts-core/src/README.md` — Complete rewrite for V10.8.3 architecture (was outdated V8 docs).
  - New architecture diagram (TruthMarket → LaunchpadEngine → AMMEngine/TickBookPoolManager → TickBookVault).
  - Updated contract descriptions, features, and deployment addresses.
  - Test count: 124 tests (was 30).

**Contracts - Testing**
- **New**: `packages/contracts-testing/test/unit/TickBookVault.t.sol` — 34 unit tests covering:
  - Constructor validation
  - USDC deposit/withdraw
  - Reserve/release USDC (onlyTickBook)
  - Spend to market collateral
  - Credit/lock/unlock/transfer outcome shares
  - Fee transfers
  - Redemption (YES wins, NO wins, INVALID)
  - Access control (onlyTickBook modifier)

**Verification**
- ✅ 124 contract tests pass (90 original + 34 new TickBookVault tests)
- ✅ Frontend build passes (6.45s)
- ✅ No TypeScript errors

### Code Quality Sprint (2026-01-18)

**Frontend - Production Logging**
- **New**: Created `apps/web/src/lib/logger.ts` - Production-safe logging utility with namespaced loggers (trade, order, claim, cancel, market, launchpad, ui, wallet, chain, rpc, indexer).
- **Changed**: Replaced all 69 `console.log/warn/error` statements across 13 `.tsx` files with logger utility.
- **Behavior**: Logger only outputs in development mode (`import.meta.env.DEV`). Errors always log (even in production) for debugging.
- **Files Changed**: `Pro.tsx`, `SimpleTradingPanel.tsx`, `ClaimFillsButton.tsx`, `Faucet.tsx`, `Create.tsx`, `MarketDetail.tsx`, `AppLayout.tsx`, `ChainSelector.tsx`, `Orderbook.tsx`, `AdjudicatorConsole.tsx`, `GuardianConsole.tsx`, `LimitOrderForm.tsx`, `AmmTradingPanel.tsx`

**Frontend - Type Safety**
- **Fixed**: `useMarketStore.ts` - Replaced `any` types with proper `RawMarketConfig` interface.
- **Enhanced**: `types.ts` - Added comprehensive protocol types: `OUTCOME`, `TruthMarket`, `RangeOrder`, `SpotSellOrder`, `VaultPosition`, WAD helper types matching Solidity contracts.

**Frontend - Error Handling**
- **New**: Created `apps/web/src/components/ui/ErrorBoundary.tsx` - React error boundary with retry functionality for graceful error recovery.

**Frontend - Cleanup**
- **Removed**: `apps/web/src/hooks/useLaunchpadMarketLegacy.ts` - Dead code, unused legacy hook.

**Contracts - Gas Optimization**
- **Optimized**: `TickBookPoolManager.sol` - Added unchecked arithmetic to batch loop counters (`batchCancelOrders`, `batchClaimFills`, `_fillSpotLiquidity`). Saves ~5-10 gas per iteration, ~100-500 gas per batch call.

**Contracts - Events**
- **Added**: `MarketInitialized(address indexed market, uint256 initialLiquidity)` event to `AMMEngine.sol` and `IAMMEngine.sol` interface.

**Verification**
- ✅ 90 contract tests pass (10 test suites)
- ✅ Frontend build passes (5.66s)
- ✅ No TypeScript errors

### CLI/SDK setmarket Unification (2026-01-16)
- **Unified**: Internal CLI and web SDK `setmarket` command now produce identical output format.
- **Format**: `Market set: [SYMBOL] Market Question...` with `Address:` and `Key:` lines.
- **Pre-graduation**: Shows `Market set (pre-graduation): [SYMBOL] ...` with `Key: (not available pre-graduation)`.
- **Removed**: "Using legacy marketKey (no hook)" warning from both CLI and SDK.
- **Removed**: "TickBook pool not active" warning from both CLI and SDK.
- **Removed**: Verbose YES/NO token output lines from CLI.
- **Fixed**: SDK now fetches market name from `TruthMarket.question()` instead of address-derived symbol only.
- **Fixed**: CLI now shows full market key (removed truncation).
- **Files Changed**: `packages/contracts-testing/script/interactive/interactive-test.ts`, `apps/web/src/lib/sdk/index.ts`

### CLI Private RPC Support (2026-01-16)
- **Added**: `BASE_SEPOLIA_RPC_URL` environment variable support in CLI config.
- **Fixed**: `MEGAETH_TESTNET_RPC_URL` env var name (was incorrectly `MEGAETH_RPC_URL`).
- **Files Changed**: `packages/contracts-testing/script/interactive/config.ts`

### Trade/Pro UI Header Cleanup (2026-01-16)
- **Changed**: Market chips (Trade/Pro) now show question text + status icon only. Removed redundant symbol display, price/probability values.
- **Changed**: Graduated markets show BarChart3 icon (📊), bonding markets show Zap icon (⚡) with progress %.
- **Changed**: MarketDetailHeader simplified to single-row compact format: status badge, expiry date, symbol badge, creator, adjudicator.
- **Changed**: Pro embedded header matches Trade page style - status badge, expiry, addresses in one row.
- **Removed**: Conflicting price displays (AMM % vs Orderbook ¢) from Pro page headers.
- **Removed**: Red "Balance: $0.00" warning from Launchpad deposit slider.

### V10.8.3 Frontend ABI Sync (2026-01-16)
- **Fixed**: All frontend hooks updated to use 10-field MarketState (removed name/symbol at indices 10/11).
- **Fixed**: `useLaunchpadMarket.ts`, `useLaunchpadMarketDirect.ts`, `useOnChainMarkets.ts` - symbol derived from address.
- **Fixed**: `useOnChainMarkets.ts` now fetches question from `TruthMarket.question()` for market names.
- **Fixed**: SDK `lib/sdk/commands/state.ts` and `lib/sdk/index.ts` - removed stale marketState[10]/[11] access.
- **Fixed**: CLI `packages/contracts-testing/script/interactive/config.ts` - updated markets ABI to 10 fields.

### Indexer Reset (2026-01-16)
- **Changed**: Cleared `.ponder/` database to remove stale V10.8.2 indexed data.
- **Changed**: Restarted indexer to begin fresh indexing from V10.8.3 start blocks.

### Indexer Stability & PostgreSQL Migration (2026-01-16)
- **Fixed**: MegaETH RPC URL in `ponder.config.ts` from `timothy.megaeth.com` to `carrot.megaeth.com/rpc`.
- **Fixed**: Added MegaETH polling config (`pollingInterval: 2_000`, `ethGetLogsBlockRange: 500`) to reduce RPC load.
- **Added**: `RangeOrderPlaced` event to `TickBookPoolManager.ts` ABI for backward compatibility with V10.8.1 deployments.
- **Added**: `RangeOrderPlaced` handler in `index.ts` mapping legacy event fields to current schema.
- **Added**: Missing events to ABIs: `PooledRefundsClaimed`, `AutoClaimExecuted` (TickBookPoolManager), `TickBookSet`, `TickBookUpdated`, `FeeCollected` (TickBookVault), `RouterUpdated`, `BalanceUsed`, `WalletPull`, `LiquidityIncreased` (AMMEngine).
- **Changed**: Local development now uses PostgreSQL instead of PGlite. PGlite was corrupting under multi-chain backfill load.
- **Note**: MegaETH `LaunchpadEngine:MarketCreated` events won't be indexed (V10.8.1 lacks `symbol` field, different event signature).

### Trade/Pro UI Polish (2026-01-16)
- **Fixed**: Market chip cards in Trade.tsx - 2 lines for long questions (`line-clamp-2`), smaller font (`text-xs`), fixed width (`w-[320px]`).
- **Fixed**: Market chip cards in Pro.tsx - same treatment (`w-[280px]`), removed `.slice(0, 25)` truncation.

### CLI V10.8.3 Compatibility (2026-01-16)
- **Fixed**: Internal CLI (`packages/contracts-testing/script/interactive/`) inline ABIs updated for V10.8.3 MarketState (removed name/symbol fields).
- **Fixed**: Web SDK (`apps/web/src/lib/sdk/commands/state.ts`) markets command synced with internal CLI format.
- **Changed**: Market names now fetched from `TruthMarket.question()` instead of MarketState struct.
- **Changed**: Two-line market display format: Line 1 = market question, Line 2 = symbol/progress/liquidity/address.
- **Removed**: Debug messages from CLI startup ("Fetching market info...", "Pre-graduation market...").
- **Removed**: Auto-select market feature - users now explicitly run `setmarket 0` or `setmarket <address>`.
- **Fixed**: On-chain market discovery for chains with empty deployment config (e.g., MegaETH).

### V10.8.3 Deployment (2026-01-16)
- **Breaking**: Removed `symbol` parameter from `createMarket()` - now auto-derived from market address (first 4 bytes = 8 hex chars).
- **Breaking**: Removed `name` and `symbol` from `MarketState` struct (10 fields instead of 12).
- **Breaking**: `MarketCreated` event no longer includes `symbol` field.
- **Changed**: `Collateralizer.registerMarket()` now takes only `market` address, derives symbol internally.
- **Added**: `_addressToSymbol()` helper in Collateralizer - converts address to 8-char uppercase hex symbol.
- **Deployed**: V10.8.3 to all 4 testnets:
  - Base Sepolia (84532)
  - Monad Testnet (10143)
  - Arc Testnet (5042002)
  - MegaETH Testnet (6343)
- **Updated**: Frontend ABIs, SDK, CLI, and indexer to match new contract signatures.
- **Fixed**: Stale tests that referenced non-existent `buyFromSpotSell()` function.

### V10.8.2 Deployment (2026-01-16)
- **Deployed**: V10.8.2 to Base Sepolia, Monad Testnet, and Arc Testnet.
- **MegaETH**: Deployment failed due to 5000 byte DA size limit (Collateralizer: 5011 bytes). Remains on V10.8.1.
- **Synced**: Frontend `deployments.json`, indexer `ponder.config.ts` with new addresses and start blocks.

### V10.8.2 Contract Optimization (2026-01-16)
- **Removed**: `buyFromSpotSell()` function from `TickBookPoolManager.sol`. V10 unified crossing already handles spot fills automatically with spot-first priority via `placeOrder`.
- **Removed**: `buyspotsell` CLI command from interactive test REPL.
- **Removed**: `buyFromSpotSell` ABI entries from CLI config and frontend ABI.
- **Rationale**: Function was redundant since V10.4 (RFC-001) where spot fills are crossed automatically during `placeOrder()`.

### Indexer Event Enhancement (2026-01-16)
- **Contract**: Added `symbol` field to `LaunchpadEngine.MarketCreated` event in both interface and implementation.
- **Indexer**: Added `LaunchpadEngine:MarketCreated` handler - creates `launchpadMarket` record with symbol from event.
- **Indexer**: Added `LaunchpadEngine:MarketGraduated` handler - updates `isGraduated` and `graduatedAt` fields.
- **ABI**: Updated `packages/indexer/src/abis/LaunchpadEngine.ts` with new event signature.
- **Note**: Requires contract redeployment for new markets to emit symbol. Existing markets will have null symbol.

### Trade/Pro UI Cleanup (2026-01-16)
- **Removed**: "Bonding Fee: 5%" badge from `GraduationProgress.tsx`. Component now returns `null` for graduated markets.
- **Added**: Fee info to status badge in `MarketDetailHeader.tsx` - shows `Graduated · 1% Fee` or `Bonding · 5% Fee`.
- **Moved**: Market header card into Pro left panel only (was full-width above grid).
- **Updated**: LiquidityMap stats row - Left: `AMM 50.0¢ | DIFF 24.1¢`, Right: `Low 0.1¢ | High 99.9¢ | Liq 6,601`.

### SDK Streaming Progress (2026-01-16)
- **Enhanced**: `createmarket` command now streams progress: `[1/4] Checking USDC...`, `[2/4] Approving...`, etc.
- **Enhanced**: `graduate` command streams each trade step: `[1/8] buy yes 1234.56 ✓`
- **Enhanced**: `registermarket` command streams: `[1/3] Fetching tokens...`, `[2/3] Checking status...`, `[3/3] Registering...`
- **Added**: `onProgress` callback parameter to SDK method signatures.
- **Updated**: Geek page handlers to display streaming progress in terminal.

### Geek Mode CLI (2026-01-16)
- **New Page**: Added `/geek` route with browser-based CLI terminal for power users.
- **WebTerminal**: Custom terminal component with command history, streaming output support, and styled output lines.
- **Local Wallet**: Auto-signing wallet for testnet use. Commands: `lw create`, `lw enable`, `lw disable`, `lw clear`. Key stored in localStorage, never leaves browser.
- **Simulate Command**: Places random orders with detailed output matching internal CLI format (`Order 1: RNG #423 YES [40.0%-55.0%] 87.00 (filled: 12.50, resting: 74.50) (gas: 522318)`). Streams results as each order completes.
- **SDK Integration**: Full access to all SDK commands (balance, mint, deposit, order, cancel, claim, state, book, etc.).
- **Files Added**: `apps/web/src/pages/Geek.tsx`, `apps/web/src/components/features/WebTerminal.tsx`, `apps/web/src/hooks/useLocalWallet.ts`, `apps/web/src/lib/sdk/`

### SDK Core Package (2026-01-16)
- **New Package**: Created `packages/sdk-core` (`@sooth/sdk-core`) with shared utilities for internal CLI and web SDK.
- **Shared Utils**: `formatWad`, `parseWad`, `parseTickRange`, `parseOutcome`, `formatOutcome`, `formatTick`, `shortAddress`, `shortTx`, `computeMarketKey`, `sleep`, `getOrderType`
- **Shared Types**: `OutputLine`, `CommandResult`, `OrderResult`, `Order`, `MarketState`, `Balances`
- **Error Decoding**: `ERROR_SELECTORS`, `PANIC_CODES`, `decodeError`, `isTransientError`, `isContractError`
- **Integration**: Both internal CLI (`packages/contracts-testing`) and web SDK (`apps/web/src/lib/sdk`) now import from `@sooth/sdk-core`

### RPC Security (2026-01-16)
- **Removed API Keys**: Removed hardcoded Alchemy API keys from frontend bundle (`chains.ts`, `wagmi.ts`).
- **Public Fallbacks**: Frontend now uses public RPCs:
  - Base Sepolia: `sepolia.base.org`
  - Monad: `rpc.ankr.com/monad_testnet`
  - Arc: `rpc.blockdaemon.testnet.arc.network` (+ 3 fallbacks)
  - MegaETH: `carrot.megaeth.com/rpc`
- **Private RPCs**: Internal CLI reads from `.env` (`MONAD_TESTNET_RPC_URL`, etc.) - not bundled into frontend.
- **Render Config**: No changes needed - `VITE_*` env vars optional, falls back to public RPCs if unset.

### Pro Page Cleanup (2026-01-15)
- **Removed (Split/Merge Panel)**: Removed `<SplitMergePanel />` from `Pro.tsx`.
  - **Reason**: The panel interacted with `Collateralizer` (ERC20 tokens), but the Pro page trading (`TickBookVault`) uses internal virtual shares.
  - **Issue**: There is no bridge to deposit ERC20 tokens into the Vault, so users could "Split" USDC into tokens but not trade them on the orderbook.
  - **Status**: Codebase retains `SplitMergePanel.tsx` (with integer formatting fixes applied) for potential future AMM integration or bridge implementation.
- **Fixed (Pro Header)**: Restored "Market Key Info" footer in the Pro page header which was missing.
- **Fixed (Formatting)**: Updated `SplitMergePanel.tsx` to force integer display (truncated decimals on input, 0 fraction digits in visualization) before disabling it.
- **Files Changed**: `apps/web/src/pages/Pro.tsx`, `apps/web/src/components/features/SplitMergePanel.tsx`

### MegaETH Graduation Gas Fix (2026-01-14)
- **Root Cause**: MegaETH uses a multidimensional gas model with separate "storage gas" charges. Code deposit costs 10,000 storage gas per byte. Deploying 2 OutcomeToken contracts (~4.4KB total) requires ~44M storage gas alone.
- **Fix (CLI)**: Updated `graduate` command to use 60M gas limit on MegaETH (chain ID 6343). Also uses `sendTransaction` instead of `writeContract` to bypass viem simulation.
- **Fix (Frontend)**: Updated `SimpleTradingPanel.tsx` to use 60M gas for graduation trades on MegaETH, 30M for normal trades.
- **RPC**: Switched MegaETH CLI RPC from Alchemy to official endpoint (`carrot.megaeth.com/rpc`).
- **Graduation Logic**: Re-enabled mid-loop graduation check for all chains with 2s state settling delay on MegaETH.
- **Files Changed**: `packages/contracts-testing/script/interactive/commands/market.ts`, `packages/contracts-testing/script/interactive/config.ts`, `apps/web/src/components/features/SimpleTradingPanel.tsx`

### MegaETH Stability & Market Creation (2026-01-14)
- **Fix (Gas Limit)**: Removed hardcoded 2.5M gas limit in `createmarket` command; MegaETH requires ~28M gas for market deployment.
- **Fix (Clock Drift)**: Updated market creation deadline calculation to use on-chain `block.timestamp` instead of local system time, preventing premature expiration reverts.
- **Enhancement**: Enabled `market buy/sell` in CLI for pre-graduation markets by routing trades to `LaunchpadEngine.tradePositions`.
- **Infrastructure**: Successfully redeployed V10.8.1 core suite to MegaETH Testnet and updated all configuration endpoints.
- **Branch Sync**: Reconciled and merged all stability fixes into the `render` branch, verifying zero changes to core contract Solidity source.
- **Files Changed**: `packages/contracts-testing/script/interactive/commands/market.ts`, `packages/contracts-testing/script/interactive/commands/orderbook.ts`, `packages/contracts-core/script/chainConfigs.ts`, `apps/web/src/config/deployments.json`

### Portfolio Market Name Fix (2026-01-13)
- **Bug Fix**: Portfolio page displayed "MARKET 0X9F7F2A" instead of actual market question on Base Sepolia and Monad.
- **Root Cause**: When indexer was ready (`useIndexer = true`), Portfolio used `indexedMarkets.markets` which lacked the `name` field. Code generated placeholder: `Market ${address.slice(0, 8)}`.
- **Fix**: Always use RPC data (`useOnChainMarkets`) for market names since LaunchpadEngine.markets() returns the full question. Indexer still used for other portfolio data (LP balances, positions, lock entries).
- **Files Changed**: `apps/web/src/pages/Portfolio.tsx`

### Indexer Schema Update (2026-01-13)
- **Schema**: Added `name` (text, nullable) and `symbol` (text, nullable) fields to `launchpad_market` table.
- **Handler**: `LaunchpadEngine:MarketCreated` now sets name/symbol to null initially.
- **Frontend**: Updated `LaunchpadMarketIndexed` interface to include new fields.
- **New**: Created `TruthMarket.ts` ABI with `MarketCreated` event and `question()` view function.
- **Note**: Fields are nullable pending implementation of TruthMarket factory pattern to populate them automatically.
- **Files Changed**: `packages/indexer/ponder.schema.ts`, `packages/indexer/src/portfolio.ts`, `packages/indexer/src/abis/TruthMarket.ts`, `apps/web/src/hooks/indexer/useMarketsIndexed.ts`

### Interactive CLI Reliability (2026-01-13)
- **Fix**: Added RPC fallback retry for `readContract` on Monad when an endpoint returns empty call data (viem: `returned no data ("0x")`) during `createmarket` and balance checks.
- **Files Changed**: `packages/contracts-testing/script/interactive/utils.ts`, `packages/contracts-testing/script/interactive/commands/market.ts`, `packages/contracts-testing/script/interactive/commands/wallet.ts`, `packages/contracts-testing/script/interactive/commands/vault.ts`

### Indexer Reliability (2026-01-13)
- **Fix**: Set Arc `ethGetLogsBlockRange` to `10` to support Alchemy free tier `eth_getLogs` 10-block range limit.
- **Files Changed**: `packages/indexer/ponder.config.ts`

### Mobile UI Polish (2026-01-12)
- **Bug Fix (Pro Header Vertical Text)**: Market question was displaying vertically (one character per line) on mobile viewports due to flex layout squeezing the market info container to near-zero width.
  - **Fix**: Split header into two rows (market info + prices) with vertical stacking (`space-y-3`). Added `overflow-x-auto` for price row.
  - Applied to both embedded and non-embedded Pro page modes.
- **Bug Fix (Orders List Overflow)**: Cancel button was cut off on mobile because table columns exceeded viewport width.
  - **Fix**: Wrapped orders list in `overflow-x-auto` container with `min-w-[480px]` minimum width.
  - Same fix applied to Spot Sells section (`min-w-[400px]`).
- **Files Changed**: `apps/web/src/pages/Pro.tsx`

### UI Rules Consolidation & Frontend Polish (2026-01-12)
- **Global UI Skill**: Created `~/.claude/skills/ui-rules/SKILL.md` with technical UI constraints extracted from frontend-dev workflow.
- **Z-Index Scale**: Added semantic z-index tokens to tailwind config: `dropdown (40)`, `sticky (50)`, `overlay (60)`, `modal (70)`, `popover (80)`, `toast (90)`, `tour (100)`.
- **Safe Area Insets**: Added utility classes `pb-safe`, `pt-safe`, `px-safe`, `py-safe`, `p-safe`, `mb-safe` for notched device support.
- **Typography**: Added `text-balance` to headings (`h1-h6`) and `text-pretty` to paragraphs in base CSS layer.
- **Accessibility**: Added 7 aria-labels to icon-only buttons across Tour, LPHolders, MarketHeader, LimitOrderForm components.
- **Launchpad Animation**: Replaced float-up particles with deep ocean bubble animation (bubble-rise keyframes with wobble motion, gradient bubbles with highlight reflections).
- **Cleanup**: Removed all `text-[9px]`/`text-[10px]` occurrences (minimum is now `text-xs`), removed purple/violet color references, replaced arbitrary z-indices with scale tokens, replaced `min-h-screen` with `min-h-dvh`.
- **Files Changed**: 60+ files across `apps/web/src/`

### Arc V10.8 Deployment + Infrastructure Sync (2026-01-12)
- **Deployment**: V10.8 deployed to Arc Testnet using stable RPC endpoint (`rpc.testnet.arc.network`). DRPC endpoint was returning 404 errors.
- **Contract Addresses**:
  - TickBookPoolManager: `0x3520983370eef2d1e417154bbeddf57f0dd5823f`
  - TickBookVault: `0x751f57c504cb7311f52ccc4953e3658d2322c274`
  - LaunchpadEngine: `0x137ad07970322fb72c1e4d7758976b2237e3fe36`
  - AMMEngine: `0xc3c92b8eb4185657be969848ba14e481752d8d01`
  - Collateralizer: `0xe9a9b730062f76f35133ad662f36d2f0db97764e`
  - MockUSDC: `0x2231f76e847cfdc3f1dee2197f97de2edf57fe5e`
- **Infrastructure Sync**:
  - Updated `packages/indexer/ponder.config.ts` — Arc addresses + start block 21,290,000 + RPC preference
  - Updated `packages/contracts-testing/script/interactive/config.ts` — Arc RPC to stable endpoint
  - Updated `README.md` — Arc contract addresses table
  - Frontend `deployments.json` already updated in earlier session
- **Status**: All 3 testnets now on V10.8 (Base Sepolia, Monad, Arc)

### Trade/Pro Page Category & Title Fixes (2026-01-12)
- **Bug Fix (Category Switching)**: Trade page now resets selected market when switching to a category where the current market doesn't exist. Previously showed stale "Loading Market..." skeleton.
- **Bug Fix (Category Alignment)**: Trade and Pro page categories now match Launchpad: `crypto, sports, cultures, others` (was `crypto, politics, science, sports`).
- **Bug Fix (localStorage Metadata)**: Trade and Pro pages now read market metadata (category, name) from localStorage where Launchpad saves it during market creation.
- **Bug Fix (Truncated Titles)**: Market titles now display full question from `TruthMarket.question` instead of truncated name from `LaunchpadEngine.markets.name` (contract truncates to 50 chars via `_truncateQuestion`).
- **Files Changed**:
  - `apps/web/src/pages/Trade.tsx` — Category reset effect, localStorage reading, full title from TruthMarket
  - `apps/web/src/pages/Pro.tsx` — Added `useTruthMarketDirect`, localStorage reading, aligned categories, full title display

### V10.8 Event Coverage + Portfolio Indexer (2026-01-12)
- **Contracts**: Added new events across TickBookVault, AMMEngine, LaunchpadEngine, TickBookPoolManager for complete indexer visibility.
- **Refactor**: Integrated PR #39 DecimalMath library and centralized WAD/token conversions.
- **Indexer**: Added portfolio schema tables + endpoints; updated ABIs for new events.
- **Frontend**: Added portfolio indexer hooks with RPC fallback; updated deployments for Base Sepolia + Monad.
- **Deployments**: Base Sepolia + Monad redeployed; Arc deploy pending (gas estimation failure).
- **Ops**: Updated Arc deploy RPC to `https://rpc.drpc.testnet.arc.network`.

### RPC Infrastructure & Market Discovery Fixes (2026-01-11)
- **Bug Fix (Frontend ABI)**: Rewrote `abis.ts` `getAbi()` helper to handle both raw ABI arrays (V10.8 format) and Foundry artifact objects (legacy format). Fixed frontend market discovery breaking on new JSON files.
- **Bug Fix (Monad RPC)**: Monad Testnet QuickNode and Foundation RPCs became unreachable. Switched to Ankr (`https://rpc.ankr.com/monad_testnet`) as primary endpoint in `chains.ts` and `wagmi.ts`.
- **Bug Fix (Arc RPC)**: Arc Testnet `rpc.testnet.arc.network` became unreachable. Switched to `rpc.drpc.testnet.arc.network` in frontend and CLI configs.
- **Refactor**: `useLaunchpadMarkets` hook now wraps `useOnChainMarkets` instead of using deprecated `LaunchpadFactory` pattern. Removed legacy factory-based discovery code.
- **Files Changed**:
  - `apps/web/src/config/abis.ts` — Fixed ABI extraction logic
  - `apps/web/src/lib/chains.ts` — Updated Monad RPC to Ankr
  - `apps/web/src/lib/wagmi.ts` — Updated Monad transport to single Ankr endpoint
  - `apps/web/src/hooks/useLaunchpadMarkets.ts` — Refactored to use useOnChainMarkets
  - `apps/web/src/hooks/useOnChainMarkets.ts` — Added error handling and v10 query keys
  - `packages/contracts-testing/script/interactive/config.ts` — Updated Arc RPC to drpc

### V10.8 Deployment & Full-Stack Sync (2026-01-11)
- **Deployment**: Core protocol V10.8 deployed to **Arc Testnet** and **Monad Testnet**.
  - **Arc Testnet**: TickBookPoolManager `0xf17e44c3ebcc7383b3a786a5d48783c2a5220c8e`.
  - **Monad Testnet**: TickBookPoolManager `0x19424e5482ad7b79654706fa60f4e5153d54e3c3`.
- **Frontend Sync**:
  - Updated `deployments.json` for all 3 testnets (Base Sepolia, Arc, Monad).
  - Regenerated contract ABIs in `apps/web/src/config/abis/` from root `out/` artifacts.
  - Updated `useLaunchpadMarket.ts` to handle V10.8's 12-field `markets` mapping, extracting `name` and `symbol` directly from the contract.
- **Indexer Sync**:
  - Pointed `ponder.config.ts` to V10.8 Arc address.
  - Adjusted `startBlock` for Arc (`21,044,000`) to match deployment timestamp for faster indexing.
- **CLI Sync**: Verified interactive CLI `createmarket` and `status` commands against V10.8 contract signatures.

### UI Color System Refactor (2026-01-11)
- **Design System**: Restrained dApp UI to 4 semantic color values inspired by w3.cash minimalism:
  - **Cyan** (`cyan-*`) — Accent, interactive elements, highlights
  - **Emerald** (`emerald-*`) — Success states, YES outcomes
  - **Rose** (`rose-*`) — Danger states, NO outcomes  
  - **Slate** (`slate-*`) — Muted, neutral, warnings, locked states
- **Scope**: Refactored 168 occurrences of amber/indigo/purple/violet to 0 across 65 files
- **Files Changed**: All pages, UI components, feature components, portfolio components, launchpad components
- **Verification**: Build passes with no errors

### Launchpad Background Animation (2026-01-11)
- **New Animation**: Added subtle animated background to Launchpad page
- **Elements**: 
  - Floating particles (12 cyan dots rising upward)
  - Cyan grid overlay with breathing pulse effect
  - 3 glowing orbs (cyan/emerald) with slow pulse animation
- **Performance**: Pure CSS animations with `will-change` for GPU acceleration, `useMemo` for stable particle config
- **CSS Added**: `@keyframes float-up`, `pulse-glow`, `grid-pulse` and `.launchpad-*` classes in `index.css`

### Launchpad UI Polish (2026-01-10)
- **Deposit Slider**: Replaced $100/$1000/$5000 buttons with smooth slider controlling deposit amount.
- **Info Box**: Shows calculated Liquidity (b), Graduation Fee (= deposit at multiplier=1), and Graduation Vol (= fees/0.05).
- **Guardian Defaults**: Guardian selector now defaults to Registry mode with Sooth DAO selected. Custom mode properly clears registry addresses.
- **Chain-Aware Explorer URLs**: Market detail pages now link to correct block explorer based on chain (Base Sepolia → basescan, Monad → monadvision, Arc → arcscan).

### Launchpad Create Flow Simplification (2026-01-10)
- **Breaking Change**: `LaunchpadEngine.createMarket` now deploys `TruthMarket` internally and returns `(market, lpTokens)`.
- **Breaking Change**: Removed `TruthMarket.activate()`; markets start live based on `startTime`.
- **New**: `startTime` added to `TruthMarket` constructor, events, and frontend status logic.
- **Policy**: Enforced minimum $10 USDC creator deposit in Launchpad flows.
- **Frontend**: Launch/Create flows now use approve → create, and decode `MarketCreated` from `TruthMarket`.
- **CLI**: Interactive `createmarket` command updated to decode `MarketCreated` and drop activation.
- **ABI**: Updated `TruthMarket.json` and `LaunchpadEngine.json` to match new signatures.

### V10.7: Spot Sell Full-Range Search Fix (2026-01-09)
- **Critical Bug Fix**: Fixed spot sell crossing to search buyer's **full tick range** instead of narrow overlap range.
- **Issue**: V10.0-V10.6 only searched for spot sells near the market-clearing price. Spot sells at **better prices** (lower ask prices) were completely missed.
- **Example**: Alice's NO spot sell at 10-11% wasn't crossing with Bob's NO buy order willing to pay up to 50%.
- **Root Cause**: `_unifiedCross()` passed a narrow "overlap range" to `_fillSpotLiquidity()`. Overlap calculation only considered the highest liquidity price, not the full buyer's range.
- **Fix**: Modified `_unifiedCross()` to pass buyer's full tick range (converted to seller's native tick space) to `_fillSpotLiquidity()`. Now finds ALL spot sells within buyer's price tolerance.
- **Gas Impact**: +11k gas (~350k → 361k) due to wider tick search. Updated gas benchmark test to reflect new reality.
- **Tests**: Added `SpotSellTickSpace.t.sol` with 6 regression tests (all passing).
- **Deployment**:
  - Monad Testnet (2026-01-09): TickBookPoolManager `0x4e9731f61c4e40e80e997a87a12c8a1dc50ec208`
  - Base Sepolia (2026-01-09): TickBookPoolManager `0x2f3464ca4a50a522786c3e72df94f12b02eec46b`
  - Arc Testnet (2026-01-09): TickBookPoolManager `0x90d250665e49504325a0d370e566be8dc4801cce` ✅
- **Frontend**: 
  - Added indexer sync status indicator to Footer showing current block height and sync status
  - Updated `deployments.json` to V10.7 with all 3 chain addresses
  - Bumped indexer config to V10.7 contract addresses
- **Files Changed**:
  - `packages/contracts-core/src/TickBookPoolManager.sol` — Full-range spot search in `_unifiedCross()`
  - `packages/contracts-testing/test/crossing/SpotSellTickSpace.t.sol` — New test file
  - `packages/contracts-testing/test/integration/OrderSystem.t.sol` — Updated gas benchmark
  - `docs/V10/contracts/03-TickBookPoolManager.md` — Added V10.7 fix documentation
  - `apps/web/src/hooks/useIndexerStatus.ts` — New hook for indexer status
  - `apps/web/src/components/layout/Footer.tsx` — Sync indicator display
  - `apps/web/src/config/deployments.json` — V10.7 addresses (all 3 chains)
  - `packages/indexer/ponder.config.ts` — V10.7 contract addresses
- **Status**: ✅ V10.7 deployed to ALL testnets. On-chain validation pending (use interactive CLI).

### LiquidityMap Color Fix (2026-01-09)
- **Bug Fix**: Fixed bucket side overwrite bug in `LiquidityMap` component where the last-processed order determined the bucket color, causing YES buy orders to incorrectly display as "Sell YES" (red) when a wide-range NO order also covered that price bucket.
- **Solution**: Now tracks `yesLiq` and `noLiq` separately per bucket and determines color based on which liquidity type is dominant.
- **RPC Fallback**: Added RPC fallback for spot sells in `useSpotSellsIndexed.ts` - queries chain directly when indexer unavailable.
- **Cleanup**: Removed debug logging from `useSpotSellsIndexed.ts` and `Pro.tsx`.
- **Files Changed**:
  - `apps/web/src/pages/Pro.tsx` — LiquidityMap bucket tracking refactored
  - `apps/web/src/hooks/indexer/useSpotSellsIndexed.ts` — Added RPC fallback, removed debug logs

### Launchpad UI Overhaul (2026-01-07)
- **Two-Column Layout**: Refactored `Launchpad.tsx` with sticky form (left) + scrollable context (right).
- **P&L Simulator Drawer**: Moved 4-archetype P&L simulator into slide-out drawer (triggered by button).
- **Mobile Tab Selector**: Create/Learn toggle for mobile users (switches between form and context).
- **New Components**:
  - `PnLSimulator.tsx` — Interactive 4-archetype P&L calculator (Creator, Gaming Trader, Arbitrageur, PvP Trader)
  - `TrustSpectrum.tsx` — Visual trust model selector (Trustless → Trust Required)
  - `TraderBenefitsBanner.tsx` — Fee→LP investment explanation
  - `RiskDisclosure.tsx` — Always-visible risk matrix
  - `CreatorEconomicsPanel.tsx` — Deposit/LP/graduation economics
  - `MarketJourneyTimeline.tsx` — Market lifecycle visualization
- **P&L Calculators**: `apps/web/src/lib/pnl-calculators.ts` with functions for all 4 archetypes.
- **Enhanced Registries**: `registries.ts` now includes Brevis adjudicator types with trust levels.
- **Enhanced AddressSelector**: Trust badges and expandable "How it works" details.
- **Fee Terminology Fix**: Changed "bonus" to "investment" for pre-graduation LP tokens.
- **Removed**: Mobile swipe (conflicted with sliders), redundant CreatorEconomicsPanel from context.

### V10.6 Deployed (2026-01-07)
- **Contract Fix**: Dust orders (<1000 wei unfilled) now stay `active=true` instead of being marked inactive. Order remains visible and claimable; only liquidity is removed from orderbook.
- **Deployment**: Fresh V10.6 contracts deployed to all 3 testnets:
  - Base Sepolia: TickBookPoolManager `0x1b6c55c70ae4dafdc8cda646af83bb3554dac388`
  - Monad Testnet: TickBookPoolManager `0xc0768a0be30662cd15e7ff4bd79ae8a110681ae0`
  - Arc Testnet: TickBookPoolManager `0xCb209Aa0E77A68378626e3f1d5136A0A5aa18B68`
- **Frontend**: Version strings updated to V10.6 across Footer, Landing page, and config files.
- **Indexer**: Updated `ponder.config.ts` with V10.6 contract addresses and start blocks.
- **UX**: Order action buttons (Claim/Cancel) now always visible with disabled states when not applicable, providing consistent button positions across all order types.

### V10.3.1 Deployed (2026-01-06)
- **Deployment**: Fresh V10.3.1 contracts deployed to Base Sepolia and Monad Testnet with MAX_TICK boundary fix.
- **Frontend**: Updated `deployments.json` with V10.3.1 addresses. CLI dynamically loads from contracts-core.
- **README**: Updated to reflect V10 architecture and current deployments.

### Pro Terminal + Tick 999 Boundary Fix (2026-01-06)
- **Frontend**: Temporarily disabled Pro "Market" order UI (full-range + `maxCost` is not a true sweep and can leave resting shares).
- **Contracts**: Fixed MAX_TICK (999) boundary visibility by special-casing range orders that end at tick 999 so overlap discovery can still see top-of-book liquidity.

### CLI & Monad Config Fixes (2026-01-06)
- **Monad Gas Config**: Explicitly set `gas_limit = 2000000` in `contracts-testing/foundry.toml` [profile.monad] to prevent OutOfGas.
- **CLI Fixes**:
  - Reduced `simulate` gas limit from 5M to 2M in `market.ts` to match network config.
  - Fixed `simulate` command `Address "0" is invalid` crash (incorrect destructuring of `truthMarket`).
  - Updated `2_CreateMarket.s.sol` to support configurable `USDC` address via env var.

### V10 Critical Fix (2026-01-05)
- **Bug Fix**: `_hasSpotLiquidity` used exclusive search `findNextUp(tick)`, causing `placeOrder` to skip spot liquidity at the exact start tick. Fixed to uses inclusive search `findNextUp(tick - 1)`.
- **Test Recovery**: Restored and migrated variable V9 test suite (79 tests) to V10 structure in `packages/contracts-testing/test/`.
- **Verification**: `test_Unified_PlaceOrderCrossesSpotSell` now passes.

### Repo Hygiene (2026-01-05)
- **Breaking Change**: Renamed deployment files to remove version prefixes (`v9-baseSepolia.json` -> `baseSepolia.json`, etc.).
- **Breaking Change**: Removed legacy ABI exports (`V8_ABIS`, `V9_ABIS`, `V10_ABIS`) from `apps/web/src/config/abis.ts`. Unified all usage to `ABIS`.
- **Cleanup**: Renamed `ActivityListenerV8` to `ActivityListener`.
- **Docs**: Enforced "No Versioned Filenames" policy in `STATUS.md` and `LESSONS_LEARNED.md`.

### V9.9.8-fix: Pro-rata Fill Accumulator Bug (2026-01-05)
- **CRITICAL: Fill Growth Denominator Fix**:
  - **Bug**: `_tryCross()` used `oppLiqInOverlap` as denominator for fill growth calculation
  - **Impact**: When overlap liquidity was small, fill growth became inflated (e.g., 10 shares crossed → 100% fill growth for all orders)
  - **Symptom**: Orders showed 99% filled when only small crossings occurred
  - **Fix**: Changed to use `oppTotalLiq` (total liquidity for that outcome) as denominator
  - **Files**: `TickBookPoolManager.sol`, `TickBookPoolManagerV10.sol`
  - **Status**: Requires redeployment

### Frontend Fixes (2026-01-05)
- **Hybrid Sell Fixed**: Now correctly splits spot sell (owned shares) + short sell (remainder)
  - Before: Tried to spot sell full amount even with partial shares → "insufficient YES" error
  - After: Spot sells only `userHolding`, short sells `amount - userHolding`
- **calculateMaxCost Fixed**: Now uses correct bounds per outcome type
  - YES orders: collateral = `pHigh * shares`
  - NO orders: collateral = `(1 - pLow) * shares`
  - Increased default slippage from 1% to 5%
- **RPC Fix**: Removed failing `base-sepolia-rpc.publicnode.com` from wagmi fallback

### CLI Enhancements (2026-01-05)
- **New Commands**:
  - `claimspotsell <sellId>` — Claim USDC proceeds from filled spot sells
  - `hybridsell <outcome> <tickRange> <totalShares>` — Auto-split spot + short sell
- **Simulate Updates**:
  - Added spot sell (10%) and hybrid sell (5%) to order type distribution
  - Refactored to use unified `executeOrder()` helper for all order types
  - Fixed `getMarketInfo` and `getInternalOutcomes` function names
- **Batch Claim**: Increased `MAX_BATCH_SIZE` from 20 to 50

## [10.0.0] - 2026-01-05

### V10 Deployed to Base Sepolia & Monad Testnet
- **Deployment Complete**: `TickBookPoolManagerV10` live on both testnets
  - Base Sepolia: `0x36abe6344a3756868f6ac26d81f1c7a40d68b0ba`
  - Monad Testnet: `0x0d9cb90f5bb982ed6a96a412a423317580d032ad`
- **Frontend Updated**: All hooks migrated from `V996_ABIS` to `V10_ABIS`
- **CLI Updated**: Interactive CLI config updated with V10 ABI schema
- **Files Changed**:
  - `apps/web/src/config/deployments.json` → V10 addresses
  - `apps/web/src/config/abis.ts` → Added `V10_ABIS` export
  - `apps/web/src/config/abis/TickBookPoolManagerV10.json` → New ABI
  - 8 frontend hooks updated to use `V10_ABIS`
  - `packages/contracts-testing/script/interactive/config.ts` → V10 ABI

### V10 Unified Crossing Architecture (2026-01-05)
- **New Contract**: `TickBookPoolManagerV10.sol` — Unified crossing for dual-collateral orderbook
- **Unified TickLiquidity Struct**:
  - `rangeLiquidityNet` — Range order net liquidity (for crossing)
  - `rangeLiquidityGross` — Range order gross liquidity (for bitmap cleanup)
  - `spotLiquidity` — Spot sell liquidity at this tick (NEW)
- **Separate Spot Bitmaps**: `_spotBitmaps` for efficient spot liquidity traversal
- **`_crossUnified()` Function**:
  - Fills spot liquidity FIRST (recycle existing tokens)
  - Then fills range liquidity (mint synthetic tokens)
  - Branches settlement by source type
- **New Events**:
  - `UnifiedCrossing` — Emits spot/range breakdown for each crossing
- **Tests**: `UnifiedCrossingV10.t.sol` (7 passing, 2 TODO for full auto-crossing)
- **ADR-073**: Documents the V10 unified crossing design
- **Files Added**:
  - `packages/contracts-core/src/TickBookPoolManagerV10.sol`
  - `packages/contracts-testing/test/v10/UnifiedCrossingV10.t.sol`

### V10 Version Consistency Audit (2026-01-05)
- **Removed**: Legacy `TickBookPoolManagerV996.sol` (historical V9).
- **Removed**: `packages/contracts-testing/test/v9` directory (legacy tests).
- **Renamed**: `UnifiedOrderSystem.t.sol` → `UnifiedOrderSystemV9.t.sol` (explicit regression test).
- **Fixed**: `interactive-test.ts` now uses `keyV10` instead of `keyV996`.
- **Fixed**: `Pro.tsx` fully migrated to `V10_ABIS` (removed lingering V996 ABI imports).


### V9.9.8 Critical Bug Fixes (2026-01-05)
- **CRITICAL: cancelSpotSell Double-Credit Fix**:
  - **Bug**: User could claim proceeds twice by calling `cancelSpotSell()` then `claimSpotSellProceeds()` (proceeds not zeroed in cancel)
  - **Fix**: Zero `order.proceedsWad` before crediting in `cancelSpotSell()`
  - **Impact**: Security fix, requires redeployment
- **Indexer: SpotSellCancelled Tick Liquidity Fix**:
  - **Bug**: Subtracting `sharesReturned` instead of original `shares` left phantom liquidity for partially filled orders
  - **Fix**: Always subtract `existingOrder.shares` on cancel
- **ABI: MarketRegistered Mismatch Fix**:
  - **Bug**: Contract has 4 fields (no hook), indexer ABI expected 5 (with hook)
  - **Fix**: Removed `hook` field from indexer ABI, handler now sets `hook: null`
- **Known Limitation: Fractured Liquidity** (ADR-072):
  - Spot Sells are stored separately from Range Orders
  - Standard `placeOrder()` does NOT cross against Spot Sells
  - Buyers must explicitly call `buyFromSpotSell()` or frontend must route
  - **Deferred to V10**: Unified crossing algorithm will integrate all liquidity types
- **Files Changed**:
  - `packages/contracts-core/src/TickBookPoolManager.sol`
  - `packages/contracts-core/src/TickBookPoolManagerV996.sol`
  - `packages/indexer/src/index.ts`
  - `packages/indexer/src/abis/TickBookPoolManager.ts`

### V9.9.7 Spot Sell Implementation (2026-01-05)
- **Contract Changes** (`TickBookPoolManagerV996.sol`):
  - Added `SpotSellOrder` struct for tracking sell orders (locked shares as collateral)
  - Added `placeSpotSell(marketKey, outcome, shares, tickLower, tickUpper)` — Lock existing shares and place resting ask
  - Added `cancelSpotSell(marketKey, sellId)` — Unlock shares back to seller
  - Added `buyFromSpotSell(marketKey, sellId, shares, maxCost)` — Buyer fills against spot sell order
  - Added `claimSpotSellProceeds(marketKey, sellId)` — Claim USDC proceeds from filled orders
  - Added view functions: `getSpotSellOrder`, `getUserSpotSells`, `getSpotSellLiquidity`
  - Added custom errors: `InsufficientShares`, `SpotSellNotActive`
  - Added events: `SpotSellPlaced`, `SpotSellCancelled`, `SpotSellFilled`
- **Frontend Changes**:
  - Added `placeSpotSell` and `cancelSpotSell` to `usePlaceOrder` hook
  - Updated `Pro.tsx` to use spot sell when user has existing shares to sell
  - Removed "spot sell not supported" error messages
- **ABI Updated**: `TickBookPoolManagerV996.json` regenerated with new functions
- **How Spot Sell Works**:
  - User with YES/NO tokens can place a limit sell order at their desired price
  - Tokens are locked in the Vault (`lockOutcome`)
  - When a buyer calls `buyFromSpotSell`, tokens transfer to buyer (`transferLockedOutcome`)
  - Seller receives USDC proceeds immediately (`creditUsdcAvailable`)

### Pro Page Order Management (2026-01-04)
- **Fill Tracking Fix**: `useOrdersIndexed` now always uses RPC (`useUserOrdersDirect`) — indexer cannot accurately track pending fills due to contract's global pro-rata accumulator system.
- **Order Actions Simplified**:
  - Open orders (< 100% filled) → Cancel button (claims pending + releases collateral)
  - Filled orders (100%) → Claim button
  - Removed redundant "Claimable" column and filter tab (now All/Open/Filled)
- **Batch Operations**:
  - Added `batchCancelOrders(marketKey, orderIds[])` to `TickBookPoolManagerV996.sol`
  - Added ABI entry to `TickBookPoolManagerV996.json`
  - Both "Cancel All" and "Claim All" batch buttons with `MAX_BATCH_SIZE = 20`
- **Sell Order Logic**:
  - **Spot Sell disabled** — contract lacks `lockShares`/`transferLockedShares` wiring in PoolManager
  - Users directed to AMM for selling existing tokens
  - **Short Sell works** — places opposite outcome order at inverted price
- **Files Changed**:
  - `apps/web/src/hooks/indexer/useOrdersIndexed.ts`
  - `apps/web/src/pages/Pro.tsx`
  - `apps/web/src/config/abis/TickBookPoolManagerV996.json`
  - `packages/contracts-core/src/TickBookPoolManagerV996.sol`

### Indexer Frontend Integration (2026-01-04)
- **Conditional RPC Fallback**: `useOrdersIndexed` and `useOrderbookIndexed` now only make RPC calls when indexer is unavailable.
- **Indexed Orders for LiquidityMap**: Added `/orders/:chainId/:marketKey` query to `useOrderbookIndexed` for LiquidityMap rendering.
- **Active Orders Only**: Indexer API now filters user orders by `status: "active"`, inactive orders no longer appear in UI.
- **RPC Batching**: Added HTTP batching config to Base Sepolia transport (`batchSize: 100, wait: 50ms`), eliminating 429 errors.
- **Frontend Hooks Updated**:
  - `useOrdersIndexed.ts` — Conditional RPC fallback, active-only filtering
  - `useOrderbookIndexed.ts` — Added indexed orders query, conditional RPC fallback
  - `wagmi.ts` — Added batching to Base Sepolia HTTP transport

### V9.9.6-fix9l Recovery (2026-01-04)
- **Contract Recovery**: Restored correct `TickBookPoolManager` (V9.9.6-fix9l) with:
  - `placeOrder()` unified API (replaces `placeRangeOrder`)
  - `getAllMarketOrders(marketKey)` for reliable order enumeration
  - `getNextOrderId()` for order counter access
  - Auto-claim 100% filled orders before new order placement
- **Fresh Deployment**: Base Sepolia at block ~35,877,100
  - TickBookPoolManager: `0xa613fe3F71fCa0913964E8f9c8b4e3f0320fC060`
  - Collateralizer: `0xE1976fDF7fDe2a2F933a7860326Ed12121358e79`
  - AMMEngine: `0xf50A729Df4078812edffe9355b73ABF916973629`
  - TickBookVault: `0x6109B9C9FdD88842da3b49E7cb3DE04F21E083dc`
  - LaunchpadEngine: `0x3530A1e0519E6e81b5a41074bf253E56757fefF6`
- **CLI Fixes**:
  - Fixed ABI to use `placeOrder` instead of `placeRangeOrder`
  - Fixed argument order: `(marketKey, outcome, shares, tickLower, tickUpper, maxCost)`
  - Removed unnecessary PoolManager USDC allowance check
- **Config Sync**: Updated all deployment configs (CLI, frontend, indexer)

### Ponder Indexer (2026-01-04)
- **New Package**: `packages/indexer` — Ponder-based event indexer for TickBookPoolManager events.
- **Schema**: Indexed tables for `market`, `order`, `fillClaim`, `marketOrder`, `tickLiquidity`.
- **Events**: Handles `MarketRegistered`, `RangeOrderPlaced`, `RangeOrderCancelled`, `FillsClaimed`, `MarketOrderExecuted`.
- **API Endpoints**:
  - `/orders/:chainId/:marketKey` — Active orders for a market
  - `/orders/:chainId/:marketKey/:owner` — User's orders
  - `/orderbook/:chainId/:marketKey` — Pre-aggregated tick liquidity
  - `/trades/:chainId/:marketKey` — Recent market order trades
  - `/markets/:chainId` — Registered markets
- **Multi-Chain**: Supports Base Sepolia (84532), Monad Testnet (10143), Arc Testnet (5042002).
- **Per-Chain Readiness**: Frontend uses `/status` endpoint to check each chain independently.
- **RPC Fallback**: Frontend automatically falls back to RPC if indexer chain not ready.
- **Configuration**:
  - `VITE_USE_INDEXER=true` to enable indexer in frontend
  - `VITE_INDEXER_URL=http://localhost:42069` for indexer URL
  - Symlink `.env` for shared config with root

### Performance & RPC Stability (2026-01-04)
- **Chunked Market Discovery**: `useOnChainMarkets` now fetches metadata in chunks of 5 with small delays, preventing 429 rate limits on page load.
- **Multicall Orderbook**: `useAllOrdersDirect` upgraded from parallel `Promise.all` to chunked `multicall3`, reducing 20+ RPC calls per market to 1-2.
- **Aggressive Caching**: 
  - Metadata hooks (`useCollateralizerDirect`) now use 60s `staleTime`.
  - State hooks (`useAmmMarketDirect`, `useTickBookDirect`) now use 10s `staleTime` / 20s `refetchInterval`.
  - Global `useDirectRead` defaults increased to 5s stale / 15s refetch.
- **Event Listener Throttling**: Disabled `ActivityListenerV8` on Arc Testnet (ID 10143) to prevent "400 Bad Request" errors from excessive event filter polling.
- **Streamlined Pro Page**: Removed redundant legacy hook calls (`useUserOrdersDirect`, `useAllOrdersDirect`) in favor of unified V10 counterparts.

### V9.9.6 Bug Fixes Summary

| Fix | Issue | Solution | Status |
|-----|-------|----------|--------|
| **fix1** | Active liquidity underflow during tick crossing | `_safeSubLiquidity()` helper | ✅ Deployed |
| **fix2** | Inactive orders causing O(n) gas growth | Swap-and-pop removal via `_removeFromUserOrders()` | ✅ Deployed |
| **fix3** | Array index out of bounds during removal | Backwards iteration in `_autoClaimUserOrders()` | ✅ Deployed |
| **fix4** | RPC limits blocking order enumeration | `getAllMarketOrders()` view function | ✅ Deployed |
| **fix5** | *(skipped)* | — | — |
| **fix6** | Orders not crossing (raw tick vs effective price) | `YES_tick + NO_tick >= 1000` formula | ✅ Deployed |
| **fix7** | Fix6 overlap calculation inverted | Corrected to `[sellerPrice, tickUpper]` | ✅ Deployed |
| **fix8** | Bitmap finds expensive seller + underflow | `findNextDown` + `_safeSubTotalLiquidity()` | ✅ Deployed |
| **fix9d** | O(n) autoclaim + manual USDC claim | Auto-claim 100% filled only + auto-release pool | ✅ Deployed |

### User Interface
- **Launchpad Redesign** (2026-01-03):
  - Consolidated multi-step wizard into a single-page scrolling experience (`Launchpad.tsx`).
  - Added Market Category selection (Crypto, Sports, Politics, Custom) with local persistence.
  - Implemented Flexible Expiration (7d, 30d, Custom, Open-End/2100).
  - Added Mock Brevis Adjudicator Registry with Custom Address support/warnings.
  - Added **Earnings Simulator** for creator P&L visualization (5% fee model).
  - Updated routing: `/create` → New Launchpad, `/dashboard` → Old Dashboard.


### Fixed
- **V9.9.6-fix8: Crossing Logic Complete Fix** (2026-01-02):
  
  **Retrospective: Why fix6 and fix7 Didn't Solve Crossing**
  
  After deploying fix6 and fix7, the crossing bug persisted on Base Sepolia:
  - Orders 1-104 placed successfully
  - Orders 105+ reverted with hex errors
  - ALL market orders failed
  - Liquidity map still showed GREEN (bids) to the RIGHT of RED (asks)
  
  **Root Cause Analysis:**
  
  | Fix | What Changed | Why It Still Failed |
  |-----|--------------|---------------------|
  | **fix6** | Crossing condition `Y + N >= 1000` | ✅ Correct, but overlap calculation wrong |
  | **fix7** | Overlap bounds from `[tickLower, seller]` to `[seller, tickUpper]` | Used `findNextUp(0)` → found MOST EXPENSIVE seller |
  
  **The Three Bugs Identified:**
  
  1. **Bitmap Traversal Direction** (Critical)
     - `findNextUp(0)` finds LOWEST NO tick = seller who wants 80% for YES
     - Should use `findNextDown(MAX_TICK+1)` to find HIGHEST NO tick = seller who accepts 40%
     - Example: NO at ticks [200, 400, 600], fix7 found 200 (80% ask), fix8 finds 600 (40% ask)
  
  2. **_totalLiquidity Underflow** (Causes reverts)
     - Three places decrement `_totalLiquidity -= sharesTotal` without bounds check
     - After 100+ orders with crossing, accounting can go negative
     - Added `_safeSubTotalLiquidity()` that clamps to 0
  
  3. **activeLiquidity Tracking** (Design flaw)
     - `activeLiquidity` only updates when `currentTick` is INSIDE order range
     - With `currentTick = 999`, orders at [194, 327] don't add to activeLiquidity
     - Falls back to `totalLiquidity`, but that can be 0 after underflows
  
  **Fix8 Implementation:**
  ```solidity
  // Bug 1 fix: Find CHEAPEST seller (highest NO tick)
  uint16 highestSell = _bitmaps[marketKey][0].findNextDown(MAX_TICK + 1);
  
  // Bug 2 fix: Safe decrement
  function _safeSubTotalLiquidity(bytes32 marketKey, uint8 outcome, uint256 delta) internal {
      uint256 current = _totalLiquidity[marketKey][outcome];
      _totalLiquidity[marketKey][outcome] = current >= delta ? current - delta : 0;
  }
  ```
  
  - **Impact**: Requires contract redeployment
  - **Doc**: `packages/contracts-core/docs/V996-crossing-logic-retrospective.md`

- **V9.9.6-fix7: Crossing Overlap Calculation** (2026-01-02):
  - **Bug**: Fix6's overlap calculation was inverted - calculated `[tickLower, sellerPrice]` instead of `[sellerPrice, tickUpper]`
  - **Symptom**: Crossing happened at wrong price ranges
  - **Fix**: Corrected overlap to `[max(tickLower, 1000-lowestSell), tickUpper]` for YES orders
  - **Impact**: Requires contract redeployment

- **V9.9.6-fix6: Crossing Logic Price Inversion** (2026-01-02):
  - **Bug**: Orders weren't crossing when they should due to comparing raw ticks instead of effective prices
  - **Symptom**: YES at 44% and NO at 58% (seller accepts 42%) should cross but didn't
  - **Root Cause**: Checked `NO_tick > YES_tick` but should check `YES_tick + NO_tick >= 1000`
  - **Fix**: Changed crossing condition to account for price inversion between outcomes
  - **Impact**: Requires contract redeployment

- **V9.9.6-fix4: getAllMarketOrders View Function** (2026-01-02):
  - **Bug**: Frontend couldn't reliably enumerate all orders due to RPC event log limits
  - **Symptom**: Liquidity map showed empty or partial orderbook
  - **Root Cause**: Event-based discovery fails when RPC limits block range
  - **Fix**: Added `getAllMarketOrders(marketKey)` and `getNextOrderId()` view functions
  - **Impact**: Requires contract redeployment

- **V9.9.6-fix3: Array Iteration Bug in _autoClaimUserOrders** (2026-01-02):
  - **Bug**: Forward iteration during swap-and-pop removal skipped elements
  - **Symptom**: "Array index is out of bounds" error during placeOrder
  - **Root Cause**: Loop incremented `i` after removing element, skipping swapped element
  - **Fix**: Changed to backwards iteration (`for (i = len; i > 0; i--)`)
  - **Impact**: Requires contract redeployment

- **V9.9.6-fix2: User Orders Array Cleanup** (2026-01-02):
  - **Bug**: `_autoClaimUserOrders()` iterated through ALL orders in `_userOrders[]` array, but inactive orders were never removed
  - **Symptom**: After ~27 orders, `placeOrder()` exceeds 2M gas limit with "out of gas" errors
  - **Root Cause**: Orders set `active = false` but stayed in array, causing O(n) gas growth
  - **Fix**: Added `_removeFromUserOrders()` helper using swap-and-pop pattern; called when orders are cancelled or fully filled
  - **Impact**: Requires contract redeployment
  - **Doc**: `packages/contracts-core/docs/V996-fix2-userorders-cleanup.md`

- **V9.9.6-fix1: Active Liquidity Underflow** (2026-01-01):
  - **Bug**: `_fill()`, `_updateActiveLiquidity()`, and `_tryCross()` had unsafe type casts that could underflow
  - **Symptom**: First several trades succeed, then one triggers underflow, corrupting `state.activeLiquidityYes/No`, causing ALL subsequent trades to fail
  - **Root Cause**: Tick boundary crossing with negative `liquidityNet` could make `activeLiq + delta < 0`
  - **Fix**: Added `_safeSubLiquidity(uint128 liq, uint128 delta)` helper that clamps result to 0 on underflow
  - **Impact**: Requires contract redeployment

- **CLI Vault Deposit Decimal Bug** (2026-01-02):
  - **Bug**: `simulate` command divided deposit amount by `10^12`, assuming 6-decimal USDC
  - **Symptom**: Deposits showed success but balance remained 0, orders failed with "insufficient available"
  - **Root Cause**: MockUSDC uses 18 decimals (WAD), not 6
  - **Fix**: Removed incorrect decimal conversion in `market.ts`

### Added
- **Pro Page All Orders Hook** (2026-01-02):
  - New `useAllOrdersDirect` hook fetches ALL orders for a market via `getAllMarketOrders()` contract call
  - Falls back to event scanning for older deployments
  - Pro page `LiquidityMap` now shows full orderbook depth from all users
- **V9.9.6 Frontend Integration** (2026-01-01):
  - **Unified Order API**: Migrated `Pro.tsx` and `SimpleTradingPanel.tsx` to use the streamlined `placeOrder` and `tradePositions` APIs.
  - **Account Model**: Wired "Spendable Proceeds" into user buying power for capital efficiency.
  - **Transparency**: Added "Creator Seed" (`b * ln2`) formula display to `MarketStats.tsx`.
- **On-Chain Market Discovery** (2026-01-01):
  - `LaunchpadEngine.getMarkets()` — Returns array of all created market addresses
  - `LaunchpadEngine.getMarketCount()` — Returns total number of markets
  - `address[] public allMarkets` — Storage array tracking all markets
  - `createMarket()` now pushes to `allMarkets` for enumeration
  - **Frontend**: New `useOnChainMarkets` hook for dynamic market discovery
  - **Frontend**: New `useOnChainMarketCount` hook for lightweight count queries
  - Replaces static `markets.json` dependency for market discovery
  - Static config retained for UI metadata (descriptions, categories, images)

### Changed
- Updated `ILaunchpadEngine.sol` interface with `getMarkets()` and `getMarketCount()`
- Updated `LaunchpadEngine.json` ABI in frontend
- Updated chain configurations to focus strictly on Base Sepolia and Monad.

---

## [9.9.5] - 2026-01-01

### Added
- **New Deployment Workflow** (2026-01-01):
  - `script/1_DeployCore.s.sol` - Deploy core infrastructure (5 contracts) with proper linking
  - `script/2_CreateMarket.s.sol` - Complete market creation workflow (Deploy → Activate → Register → Initialize)
  - Clean separation between core contracts and market operations
  - Prevents silent AMM initialization failures from incorrect deployment order

### Changed
- **Terminology Update** (Pending):
  - Replacing "Oracle" with "adjudicator" across frontend and documentation
  - Aligns with contract terminology (TruthMarket uses `adjudicator` role)

## [9.9.5] - 2025-12-31

### Fixed
- **Fill Overflow & Order Lifecycle** (ADR-064):
  - Added `liquidityRemoved` flag to `RangeOrder` struct for idempotent cleanup
  - Cap `filledShares` at `sharesTotal` to prevent Q128 accumulator drift
  - Auto-complete orders when fully filled (removes tick liquidity, sets `active=false`)
  - All cleanup paths (crossing, claimFills, cancel) now check flag before removing liquidity

### Added
- **TickBookPoolManagerV995.sol**: V9.9.5 LEAN implementation (no hooks, based on V9.9.4 architecture)

### Deployment
- Base Sepolia: `0x4EA452bc10880ab0bE3673C2dE076C9d3351b516`

---

## [9.9.4] - 2025-12-31

### Security Fixes
- **TOB-1 (HIGH)**: Fixed pro-rata fill attribution overflow in `_tryCross()`. Changed denominator from `oppTotalLiq` to `oppLiqInOverlap` to prevent >100% fill distribution.
- **TOB-2 (HIGH)**: Added `MAX_FEE_BPS = 1000` (10% cap) to prevent malicious fee extraction via hooks.

### Removed
- **Hook System**: Removed `ITickBookHooks.sol` and all hook callbacks. Replaced with simple `takerFeeBps`/`makerFeeBps` storage variables.
- **Flash Accounting**: Removed `TransientDelta.sol`, `lock()`, `settle()`, `take()` functions.
- **Batch Operations**: Removed `batchPlaceOrders()` - never used by frontend.
- **T* Settlement**: Removed `applyRetroSettlement()` from AMMEngine - was always reverting.

### Added
- **TickBookPoolManagerV994.sol**: New lean contract (884 lines vs 1301 original, 32% reduction).
- **setFees()**: Owner function to set taker/maker fees with 10% cap.
- **Audit Documentation**:
  - `audit/TRAIL_OF_BITS_AUDIT_V9.9.3.md` - Security audit (15 findings)
  - `audit/OG_EFFICIENCY_REVIEW_V9.9.3.md` - Efficiency review
  - `audit/AUDIT_RESPONSE_V9.9.4.md` - Comprehensive response
  - `audit/IMPLEMENTATION_PLAN_V9.9.4.md` - Implementation details
  - `audit/AUDIT_PROMPTS_V9.9.3.md` - Reproducible audit prompts

### Changed
- **Pool Key Hash**: No longer includes hook address (simplified Market struct).
- **ARCHITECTURE.md**: Updated to V9.9.4 with audit references.
- **Test Count**: 106 tests (was 119, reduced due to hook test removal).

### Archived
- `contracts/interfaces/_archived/ITickBookHooks.sol`
- `contracts/libraries/_archived/TransientDelta.sol`

---

## [9.9.3] - 2025-12-31

### Fixed
- **Phantom Liquidity on Crossing Fills** (2025-12-31):
  - **Problem**: Orders 100% filled via crossing still displayed liquidity in the Liquidity Map.
  - **Root Cause**: `_tryCross` credited fills but didn't remove tick boundaries or decrement `_totalLiquidity`.
  - **Solution**: Added tick boundary cleanup in `_tryCross` when `filledShares >= sharesTotal`.

## [9.9.2] - 2025-12-31

### Fixed
- **TickBook: Best-Price Discovery & Boundary Math** (2025-12-31):
  - **Best-Price Jump**: Inside `_fill`, market orders now correctly jump to the best available makers if they are "behind" the current market tick (crossed liquidity). Ensures market orders never fail with `NoLiquidity` if makers exist.
  - **Directional Math**: Fixed boundary crossing logic for downward moves to correctly identify maker range entries.
- **Test Integrity**: Resolved `NoLiquidity` reverts in Fuzz and Settlement test suites.

## [9.9.1] - 2025-12-31

### Fixed
- **Liquidity Capping: Arithmetic Underflow / Double Fill Fix** (2025-12-31):
  - **Problem**: `_fillGrowthGlobalX128` could exceed 100% fill if range liquidity was over-estimated.
  - **Solution**: `_getOverlappingLiquidity` now caps its depth approximation by the actual `_totalLiquidity` in the book. Prevents arithmetic panics on order cancellation.
  - **UI Transparency**: Reverted UI safety capping to ensure raw protocol status is always visible for debugging.

## [9.9.0] - 2025-12-30

### Fixed
- **TickBook Matching: Sweep Worst-to-Best Price** (2025-12-30):
  - **Root Cause**: `_tryCross` was calculating fills using the full order size instead of only the overlapping tick range.
  - **Problem**: Orders could show >100% filled due to incorrect share calculations.
  - **Solution**:
    1. SELL orders now sweep LOW→HIGH (worst ask to best ask)
    2. BUY orders now sweep HIGH→LOW (worst bid to best bid)
    3. Fills only occur within the price overlap range
    4. Added `_getOverlappingLiquidity()` helper for overlap-only matching
  - **PR**: #21

### Added
- **V9.9 Crossing Tests** (2025-12-30):
  - `test_V99_CrossingOnlyInOverlap` — Verifies fills only at overlapping ticks
  - `test_V99_NoCrossingWithoutOverlap` — Non-overlapping orders don't match
  - `test_V99_SellSweepsLowToHigh` — SELL order sweep direction
  - `test_V99_BuySweepsHighToLow` — BUY order sweep direction
  - `test_V99_FillsDoNotExceedOrderSize` — Prevents >100% fill bug

---

## [Unreleased] - 2025-12-30

### Changed
- **Frontend Code Structure Flattening** (2025-12-30):
  - Eliminated all versioned folders (`v5/`, `v8/`, `v9/`) from `apps/web/src/`
  - 47 hooks now at `hooks/` root level (flat)
  - 19 components moved from `features/v8/` to `features/` root
  - 11 ABIs consolidated from `abis/v8/` and `abis/v9/` to `abis/`
  - Pages `Landing.tsx` and `Faucet.tsx` moved from `pages/v8/` to `pages/`
  - 210 legacy files archived to `_legacy/` directory

### Fixed
- **MarketHeader Null Guard** (2025-12-30):
  - `truncate()` function now handles `undefined` address props gracefully

### Added
- **Coding Rule: Forbidden Versioned Folders** (2025-12-30):
  - Added to `.agent/LESSONS_LEARNED.md` to prevent future v1/, v8/, v9/ folder patterns
  - Organize by domain/feature instead of version numbers

### Breaking Changes (Internal)
- `useV8DirectRead` → `useDirectRead`
- `useInvalidateV8Queries` → `useInvalidateQueries`
- `useTickBookVaultV9` → `useTickBookVault`
- All imports from `hooks/v5/`, `hooks/v8/`, `hooks/v9/` must update to `hooks/`

---

## [9.8.0] - 2025-12-30

### Fixed
- **_tryCross Bitmap-Based Overlap Detection** (2025-12-30):
  - **Root Cause**: `_tryCross` used `currentTick` range check which failed when market orders hadn't executed yet.
  - **Problem**: `currentTick` was initialized from `initialProbabilityWad` (e.g., 999). Overlapping range orders at lower ticks couldn't cross because `currentTick (999) > newOrder.tickUpper (460)`.
  - **Solution**: Replaced `currentTick`-based detection with bitmap-based overlap detection using `findNextUp()` / `findNextDown()`.
  - **Additional Fix**: `registerMarket` now initializes `currentTick` to `MIN_TICK` (1) instead of `initialProbabilityWad`.
  - **Documentation**: `packages/contracts-evm/docs/research/V9/TRYCROSS_BITMAP_OVERLAP.md`

### Changed
- **currentTick Initialization** (2025-12-30):
  - Both `registerMarket` overloads now set `currentTick = MIN_TICK` (1).
  - `_tryCross` no longer depends on `currentTick` for overlap detection.
  - Market orders (`_fill`) can still search from `currentTick` in both directions.

---

## [9.6.0] - 2025-12-30

### Fixed
- **Monad Testnet Graduation OutOfGas** (2025-12-30):
  - Root cause 1: "Zombie" `TickBook` address (`0x6e54...`) had no code deployed, causing reverts.
  - Root cause 2: Architecture mismatch (V8 standalone instead of V9 Singleton).
  - Root cause 3: Insufficient gas limit (2M) for V9 graduation complexity on Monad.
  - Solution: Replaced standalone `TickBook` with `TickBookPoolManager` + `TickBookVault` (Singleton), and increased trade gas limit to **5,000,000** for near-graduation trades.

### Added
- **V9 Singleton Multichain Support** (2025-12-30):
  - Updated `deploy-multichain.ts` to deploy the full V9 Singleton stack (`Vault`, `PoolManager`, `DynamicFeeHook`).
  - Added automatic linking of Vault to PoolManager and Engine-as-Registrar permissions.
  - Unified deployment artifact structure to include `TickBookPoolManager` and `TickBookVault`.

### Deployed
- **Monad Testnet V9.6.0** (Fresh migration):
  - **LaunchpadEngine**: `0xfc439a4bd763900cc544154e74258721f4a2bbbb`
  - **TickBookPoolManager**: `0xd209a3db4bb3a65da69001313e75f3309888e52f`
  - **TickBookVault**: `0x7996195bf20d84b51e28ba8f44f6fc85a4cf59b7`
  - **Collateralizer**: `0xc620770047e6710d2539bc6aa46de9be458207a7`
  - **AMMEngine**: `0xc83a0fad313d9174ebdb6201c5d115e5773e4d80`
  - **BTC100K Market**: Graduated successfully post-deploy.

---

## [9.5.0] - 2025-12-30

### Added
- **`getPendingFills()` View Function** (2025-12-30):
  - New view function in `TickBookPoolManager` that calculates pending fills from growth accumulator
  - Returns `(pendingShares, pendingCollateralUsed)` without modifying state
  - Enables frontend to show total fills = `order.filledShares + pendingShares`
  - Critical for proper display of crossed order fills

- **LiquidityMap User Orders Visualization** (2025-12-30):
  - LiquidityMap component now accepts `userOrders` prop
  - When tick data unavailable, visualizes active user orders
  - Shows YES/NO liquidity distribution across price range

### Fixed
- **User Orders Not Showing in Pro Terminal** (2025-12-30):
  - Root cause 1: `getPendingFills` was being called but didn't exist in contract (silent failure)
  - Root cause 2: ABI was missing `getUserOrders` function definition
  - Solution: Added `getPendingFills` view function, regenerated ABI
  
- **Order Fill Display for Crossed Orders** (2025-12-30):
  - Issue: Orders crossed via `_tryCross` showed 0 fills because accumulator wasn't being read
  - Crossed orders use lazy-claim pattern: fills tracked in `_fillGrowthGlobalX128[outcome]`
  - Frontend now calls `getPendingFills` and adds result to `order.filledShares`
  - CLAIM button now appears correctly for crossed orders

### Changed
- **`useUserOrdersDirect` Hook** (2025-12-30):
  - Now calls `getOrder` + `getPendingFills` in parallel for each order
  - Displays total fills including pending accumulator amounts
  - Better logging for debugging order state

### Deployed
- **Base Sepolia V9.5.0** (Fresh deployment):
  - **Collateralizer**: `0xF90d9241398c3f9C76E378739920b84DE5a5eEd0`
  - **AMMEngine**: `0x7b57918F88dD7e0006B40988B9f73B26a27FF292`
  - **TickBookVault**: `0xDF7cc6186d96b13c095dB64D4589fDec07af03f8`
  - **TickBookPoolManager**: `0x432b75E95bD1aE44D6393351B256ecfAf7753556` (with `getPendingFills`)
  - **DynamicFeeHook**: `0xBf1e52AB82DBcbbc302d33aF72A7c7Ebcd87B307`
  - **LaunchpadEngine**: `0xB73eB0E200Afb874606CA2F2D65bc2cdF172674a`
  - **ALIEN Market**: `0x4Cb558160602004D5b6C023Ad469DF0E2585F007`
  - **BTC100K Market**: `0x92B3783948Ec86Bdc8BA824A6AE1303F2B170f68`

### Technical Notes
- **Order Crossing Mechanics Clarified**:
  - When Order A (YES) exists and Order B (NO) is placed with overlapping range, `_tryCross` executes
  - Order B (new) gets immediate `filledShares` credit + tokens via `vault.creditOutcome`
  - Order A (existing) gets fills tracked via `_fillGrowthGlobalX128[outcome]` accumulator
  - Order A maker must call `claimFills()` or frontend shows pending via `getPendingFills()`

---

## [9.4.0] - 2025-12-30 (Superseded)

### Added
- **TickBook Registrar Access Control**: Only LaunchpadEngine (or owner) can register markets in TickBook
  - Added `registrar` storage variable and `setRegistrar(address)` function
  - Added `onlyRegistrar` modifier to both `registerMarket()` overloads
  - Ensures markets can only be added to TickBook after graduation (contract-level lock)

### Fixed
- **Frontend Graduation Guard**: Re-enabled Pro Terminal graduation check
  - Non-graduated markets now show "Pro Trading Locked" screen with graduation progress
  - Previously disabled to allow testing, now enforced for proper UX

### Deployed
- **Base Sepolia V9.3.0** (Fresh deployment):
  - **Collateralizer**: `0x84f9d5B33d2393B26320a70370635008E2cF90A7`
  - **AMMEngine**: `0xC2BF5E82AcB56c0f76F4692f2698293F29934695`
  - **TickBookVault**: `0x86cb494DFb00De52e076Bd7203a8D5d3d0c0D3a5`
  - **TickBookPoolManager**: `0x2ab1751a396EF779ca4Ab0DF5854a4F830D664F3` (with registrar)
  - **DynamicFeeHook**: `0xffA90FE3262f9FDa72A585eFc635caF2c7622CAF`
  - **LaunchpadEngine**: `0xFdEa0f983820f73e97A6a81C38565B48bE7b6c7A`
  - **ALIEN Market**: `0x3FF3E6A3C8829BbB5DfEd440AafF92e608934Dc2`
  - **BTC100K Market**: `0x3Be7CC1529276E1c921A24844FC158514feF0544`

### Notes
- Registrar set to LaunchpadEngine: `0xFdEa0f983820f73e97A6a81C38565B48bE7b6c7A`
- Markets NOT graduated yet - trade on AMM to accumulate fees and trigger graduation

---

## [9.2.0] - 2025-12-29

### Fixed
- **TickBook Initialization & Market Key Robustness** (2025-12-29):
  - Resolved "TickBook Not Initialized" error in Pro Trading Terminal.
  - Hardened address normalization in `useTickBookDirect` hook to handle padded addresses (32-byte words from contract RPC) and missing leading zeros.
  - Removed non-existent `findNextActiveTick` and `getTickInfo` direct RPC calls (V9 currently requires Ponder or Subgraph for orderbook depth; direct reading is limited to market state).
  - Ensured correct token resolution (YES/NO) from Collateralizer before calculating market keys.

### Manual Actions
- **BTC 100k Market Registration**:
  - Manually registered the `BTC 100k` market in the `TickBookPoolManager` singleton on Base Sepolia.
  - This enables Pro Trading functionality for this market before its official Launchpad graduation.
  - Verified on-chain: `isActive` status returned for both ALIEN and BTC 100k using deterministic market keys.


## [9.1.0] - 2025-12-29

### ⚠️ BREAKING CHANGE
- **IAMMEngine.tradePositionsFor signature changed**: Now accepts `fee` parameter (6th argument).

### Fixed
- **Critical Sell-Side Fee Bug** (2025-12-29):
  - Sells now correctly deduct fees from proceeds before locking.
  - Fee is transferred from AMMEngine to LaunchpadEngine (router).
  - Slippage check now correctly uses net proceeds (after fee).
  - Previously: Sells bypassed fees entirely, effectively giving traders 0% sell fees.
  - Now: Sells apply the correct fee rate (5% pre-grad, 1% post-grad).

### Added
- **SellSideFeeIntegration.t.sol** (12 tests):
  - P0: Fee deduction from YES/NO sells, transfer to router, accrual, slippage
  - P1: Pre-grad rate verification, excessive fee protection
  - P2: Sell-then-buy flow, lock queue verification, multiple sells
  - 256-run fuzz test for random sell amounts

### Deployed
- **Base Sepolia V9.1.0**:
  - **AMMEngine**: `0xc30b15912BD5EBC275CBc8CdA88FA881509F3029`
  - **LaunchpadEngine**: `0xEff2d8dF8Fa9dFf67953273Ec6151e250693DEa1`

### Coverage
- 114 tests passing (12 new)
- AMMEngine: 60.50% lines, 61.90% functions
- LaunchpadEngine: 48.09% lines, 41.18% functions

---

## [9.0.1] - 2025-12-29

### Added (V9 QA)
- **Comprehensive V9 Test Suite** — 99 tests passing with 83% core coverage:
  - `TickBookPoolManager.t.sol` — 22 tests for core ops, batching, hooks
  - `V9Fuzz.t.sol` — 10 fuzz tests (tick bounds, slippage, crossing)
  - `V9Invariants.t.sol` — 4 actor-based invariants (vault solvency, no negative balances)
  - `TruthMarketLifecycle.t.sol` — 32 tests (activate, settle, veto, finalize, redemption)
  - `TickBookVaultSettlement.t.sol` — 13 tests (deposit, reserve, redeem, edge cases)
  - `HookCallbacks.t.sol` — 18 tests (DynamicFeeHook, permissions, fuzz)
- **QA Analysis Document** — `test/QA_V9_ANALYSIS.md` documenting test strategy and coverage gaps

### Changed
- **V9 ABIs exported** — Added `V9_ABIS` export in `apps/web/src/config/abis.ts`
- **Frontend config** — Updated `deployments.json` and `markets.json` to V9.0.0

### Coverage
| Contract | Lines | Functions |
|----------|-------|-----------|
| TickBookPoolManager | 83.24% | 89.29% |
| TickBookVault | 44.12% | 60.87% |
| TruthMarket | 100.00% | 100.00% |
| DynamicFeeHook | 30.51% | 12.50% |

---

## [9.0.0] - 2025-12-29

### Deployed
- **V8.12.0 Limit Order Crossing Fix - Base Sepolia**:
  - **Collateralizer**: `0xaB31D6CC191Ccd41b9f834a4Eb2cE84a82922106`
  - **AMMEngine**: `0x8B621BDc1c52981845BF6cfffdCe99fE4DDD4513`
  - **TickBookVault**: `0x44fEbdDc46C785c00a1c84bC13787927c93B014B`
  - **TickBookV2**: `0x22A3B8d12cf5277F27A2d9a03312e643b1996492`
  - **LaunchpadEngine**: `0xb037b3919595Ba56BA88Ba3C4A45e041E0732b70`
  - Market 1 (Alien Life): `0xa4838e6E410570438d8B074e9459082b228A460C`
  - Market 2 (BTC TWAP): `0x8027387f1FD1963513661A0051AdD224244e186E`

### Fixed
- **Critical Limit Order Crossing Bug** (2025-12-29):
  - `_totalLiquidity` was tracking only density (shares per tick) instead of total shares (density × range).
  - This caused overlapping orders to cross only ~0.1% of shares instead of the full order.
  - Fix: Track `sharesTotal` in `_totalLiquidity` and use `order.sharesTotal` in pro-rata fill calculations.
  - Verified: `test_LimitOrderCrossing_OverlappingRanges` now crosses 10,000 shares (was only 10).

### Added (Previous)
- **Monad Testnet Integration**: Added Chain ID `10143` to `deployments.json` and synchronized `markets.json`.
- **Multi-Chain Resilience**: Application now supports Base Sepolia and Monad Testnet simultaneously.

### Fixed (Previous)
- **Critical `useDeployments` Hook Crash**: 
    - Resolved `TypeError: Cannot read properties of undefined` by restoring nested `networks` structure in `deployments.json`.
    - Added defensive null-checks in the hook to prevent runtime white-screens on malformed config.
- **LP/Fee Discrepancy (ADR-054)**:
    - Unified LP token minting to **USD-par** (1:1 with USD contributed).
    - Removed the 1.44x depth-scaling for trader LP tokens ensures fair ownership shares.
- **Base Sepolia Market visibility**: Restored missing Base Sepolia market configurations in `markets.json`.


## [8.11.0] - 2025-12-29

### Deployed
- **V8.11.0 LaunchpadEngine LN2 Fix - Base Sepolia**:
  - **Collateralizer**: `0x51762C3a51E0C53B32e234cc699F91a75AfCc24f`
  - **AMMEngine**: `0x895dD6997f6c0F1Ec0f71C82CA66a437a230efdc`
  - **TickBookVault**: `0xe67dFc6498444B5FdcaB8eD6687AfE5d9bCE08ac`
  - **TickBookV2**: `0x903FD0218F1Aa061340EAf2811478f59b8Dc2260`
  - **LaunchpadEngine**: `0xe0e82228aE890C8BdB33C249BfB60D39CD77eD2c`
  - Market 1 (Alien Life): `0xA2C0Bf2766a4E799bC55fc88d7e4B63dCFC994a7`
  - Market 2 (BTC TWAP): `0xC0154e2Ad8f170B1a07a19726b29D74D62a32deD`

### Fixed
- **LaunchpadEngine `LN2` Undefined Identifier** (2025-12-29):
  - Fixed `getGraduationProgress()` view function using undefined `LN2` instead of `LN2_WAD`.
  - This was a compilation error that prevented building from source.
  - Root cause: inconsistent constant naming after ADR-053 refactor.

## [8.9.1] - 2025-12-28

### Added
- **Rich AMM Accounting UI** (2025-12-28):
  - Completely overhauled `MarketStats.tsx` with a professional "Pure AMM Accounting" design.
  - Implemented 5 clear formula-driven cards: Cash Basis, Equity Floor, Valuation, TVL, and Liquidity Anchor.
  - Synchronized visual styling with `AMMFormulasCard.tsx`.

### Changed
- **"Price" vs "Prob" Terminology Alignment** (2025-12-28):
  - Replaced all instances of "Prob" and "Probability" with **"Price"** across AMM, Pro, and Create views.
  - Simplifies the conceptual model for traders while maintaining mathematical correctness.

### Fixed
- **Pre-Graduation Liquidity Scaling Math (ADR-053)** (2025-12-28):
  - Corrected `LaunchpadEngine.sol` fee distribution math.
  - Fees now increase the liquidity parameter `b` by `Fee * 1/ln(2)` (~1.44x).
  - This ensures a 1:1 relationship between fee accumulation and maximum loss capacity growth.
  - Standardized on `LN2_WAD` and `LN2_INV_WAD` constants across contracts and scripts.

## [8.9.0] - 2025-12-28

### Deployed
- **V8.9.0 Pending Fills + Short Sell Fix - Base Sepolia**:
  - **Collateralizer**: `0x1DAad522554F231FFE2316b5E07614E533820A9B`
  - **AMMEngine**: `0x6F880db15AD0CB89Df65455fdceD756Da45e6aE7`
  - **TickBookVault**: `0xBe45be3082274bCA6e798A6463Db6056Caa1441C`
  - **TickBookV2**: `0x875b354d082FAa992B9Bf2B7BF49d6b4f6736335`
  - **LaunchpadEngine**: `0x082eD8B3B39D7406137d711243ED6499aD71d34D`
  - Market 1 (Alien Life): `0x89632a94ad89F0BdDf0F0A66864b3808DeF9F426`
  - Market 2 (BTC TWAP): `0xD82119AE06157Ab36574dD78313c77Cd1b9F070f`

### Added
- **`getPendingFills()` View Function** (2025-12-28):
  - New view function in TickBookV2 to calculate pending (unclaimed) fills for a given order.
  - Returns `pendingShares` and `pendingCollateral` based on global growth tracking.
  - Frontend now displays total fills = claimed + pending.

### Fixed
- **Short Sell Outcome Mapping** (2025-12-28):
  - "Sell YES" (when user has no YES shares) now correctly routes to buying NO tokens.
  - Fixed `oppositeOutcome = isYes ? 0 : 1` mapping in Pro.tsx for short sell actions.
  - Added to LESSONS_LEARNED.md as critical pattern.

- **Contract Size Limit (EIP-170)** (2025-12-28):
  - TickBookV2 was 144 bytes over the 24,576 byte limit.
  - Shortened all error messages from "TB2: xyz" to "!xyz" format.
  - Saved 278 bytes, now at 24,442 bytes with 134 byte margin.
  - Updated test assertions to expect new error message format.

### Changed
- **Error Message Format** (2025-12-28):
  - All TickBookV2 error messages shortened for contract size:
    - `"TB2: not active"` → `"!active"`
    - `"TB2: not owner"` → `"!own"`
    - `"TB2: slippage exceeded"` → `"slip"`
    - etc.

---

## [Unreleased]

### Breaking Changes
- **TickBook `registerMarket` now requires initial probability** (2025-12-28):
  - `ITickBook.registerMarket()` signature changed: now requires `initialProbabilityWad` (4th param).
  - TickBook/TickBookV2 initializes `currentTick` from AMM probability instead of hardcoded 50%.
  - LaunchpadEngine reads `ammEngine.getMarketState()` at graduation and passes probability to TickBook.
  - **Why**: Previously, TickBook always started at 50% regardless of actual AMM price, creating false arbitrage signals when AMM price differed significantly.

- **TickBookV2 `placeRangeOrder` returns 3 values** (2025-12-28):
  - Now returns `(orderId, crossingFilled, crossingCost)` instead of just `orderId`.
  - `crossingFilled` and `crossingCost` are currently always 0 (see Known Limitations).
  - **Why**: Future-proofing for proper CLOB crossing semantics.

- **TickBookV2 `executeMarketOrder` returns 3 values** (2025-12-28):
  - Now returns `(sharesFilled, totalCost, refunded)` instead of just 2 values.
  - Market orders now reserve `maxCost` upfront and refund unused collateral.
  - **Why**: Proper market order semantics - takers should get refunds for unfilled portions.

### Known Limitations
- **TickBookV2 does not auto-match opposite orders** (2025-12-28):
  - Placing a YES order (outcome=1) and NO order (outcome=0) at overlapping ranges does NOT cross.
  - This is because TickBookV2 uses a **complete-set model** where makers PROVIDE liquidity (backing one half of YES+NO=$1), not a traditional bid/ask CLOB.
  - Both orders sit passively waiting for takers to execute market orders against them.
  - Proper CLOB crossing would require redesigning the fill mechanics to support direct token swaps.
  - **Workaround**: Submit a market order to execute against existing liquidity.

### Deployed
- **V8.5 TickBookV2 (ADR-052) Deployed to Base Sepolia** (2025-12-28):
  - Fresh deployment with TickBookV2 replacing TickBook v1.
  - TickBookV2: `0xEe1029DCDa225cB15E751fDf61F43367456fb1E9` — O(1) gas range order placement.
  - LaunchpadEngine: `0x81763C661A356B35e56D2228Bf448Cd6105B9b10`
  - AMMEngine: `0x08591B79aB7E3AD48D5a267511ce6cB1B2BaF7CE`
  - Collateralizer: `0x90B7A938b75803Db139cf54Ab19204Ae31286961`
  - TickBookVault: `0xF3feC7e00637fad7171867047D4e732cE361FF89`
  - 2 test markets deployed with $1,000 liquidity each.

### Changed
- **AMM Trading Panel Pro-Style Redesign** (2025-12-28):
  - Replaced cluttered YES/bar/NO layout with clean tab-style YES/NO toggle (underline + subtle tint).
  - Added "Current Prob" row showing probability percentages with compact bar.
  - Added "Pool Shares" row displaying qYes/qNo (LMSR virtual shares) for market depth.
  - Buy/Sell toggle now uses contextual colors: emerald (Buy YES), rose (Buy NO), amber (Sell).
  - Pro-styled amount input with larger text, +/- buttons, and refined quote summary.
  - Contextual gradient action buttons matching Pro page styling.
  - Wrapped trading panel in Card component for visual consistency.
  - Fixed AMM/Pro toggle link (was `/v8`, now `/trade`).

- **LP Holders Card Improvements** (2025-12-28):
  - Combined fee mode badge and hint icon into card header (top right).
  - Removed separate "Phase Note" section for cleaner layout.

### Fixed
- **React Hooks Order** (2025-12-28):
  - Fixed "Rendered more hooks than during the previous render" error in `LPHolders.tsx`.
  - Moved `useState` for hint display before early return to satisfy Rules of Hooks.

- **Probability Bar Height** (2025-12-28):
  - Added `h-full` to probability bar segments to ensure equal heights.

- **Percentage Display** (2025-12-28):
  - Added `%` symbols to Current Prob display (YES and NO values).
  - Changed "New Price" label to "YES Prob" or "NO Prob" based on selected outcome.
  - Added `%` to new price values for clarity.

- **Tick Range Expanded** (2025-12-28):
  - `TickBook.MAX_ORDER_TICK` changed from `MAX_TICK - 1` (998) to `MAX_TICK` (999).
  - Valid tick range is now **1–999** (0.1% to 99.9%), was 1–998.
  - Frontend updated to allow 99.9% probability orders.

- **TickBookV2 Continuous Range Orders (Linear)** (2025-12-28):
  - Added `TickBookV2.sol` implementing Uniswap V3-style **range positions stored once** (boundary `liquidityNet/liquidityGross`) with **linear** in-range price movement.
  - Replaced per-tick order storage (O(range width) SSTORE) with boundary updates (O(1) w.r.t. range width).
  - Added pro‑rata maker fill attribution via lazy-claim snapshots (`claimFills`) using cumulative fill/proceeds counters.

### ⚠️ BREAKING CHANGES
- **TickBook API Overhaul (ADR-051)**: Complete refactor of TickBook to vault-native architecture.
  - `TickBook` constructor now takes `address _vault` instead of no arguments.
  - `placeLimitOrder` signature: `(marketKey, outcome, tickLower, tickUpper, sharesPerTick)` — added `outcome` uint8.
  - `executeMarketOrder` signature: `(marketKey, outcome, shares, limitTick)` — `isBuy` bool → `outcome` uint8.
  - `cancelOrder` replaces `cancelLimitOrder` — simplified to `(marketKey, orderId)`.
  - Outcome tokens no longer directly transferred; uses internal vault accounting.
- **Tick Resolution**: 10,000 ticks → 1,000 ticks (0.01% → 0.1% increments).
  - `TickMath.MAX_TICK` = 999 (was 9999).
  - Initial market tick = 500 (was 5000).

- **TickBookVault Interface Expansion (ADR-052)** (2025-12-28):
  - `ITickBookVault` adds `refundMarketToAvailable(market, user, amountWad)` to support refunding unfilled maker collateral from `marketCollateralWad`.
  - `TickBookV2` changes maker collateral flow to be **market-collateralized at placement** via `spendAvailableToMarket(...)` and refunded on cancel via `refundMarketToAvailable(...)`.

### Added
- **TickBookVault Contract (ADR-051)** (2025-12-27):
  - New `TickBookVault.sol` — Global per-chain USDC custody for TickBook.
  - Manages `availableUsdcWad` and `reservedUsdcWad` per user.
  - Tracks internal YES/NO shares per market (`yesInternal`, `noInternal`).
  - Vault-native redemption via `redeemResolved(market)` after settlement.
  - Capital-efficient collateralization: limit orders reserve `P * qty` (YES) or `(1-P) * qty` (NO).
- **TickBook Vault-Native Matching** (2025-12-27):
  - `TickBook` now integrates with `TickBookVault` for all collateral management.
  - Removed direct ERC20 token transfers from TickBook.
  - New vault hooks: `reserveUsdc`, `releaseUsdc`, `spendAvailableToMarket`, `spendReservedToMarket`, `creditOutcome`.
- **Frontend TickBookVault Integration** (2025-12-27):
  - New `useTickBookVaultDirect` hook for reading vault balances.
  - Pro page now shows vault balances (available, reserved, internal YES/NO).
  - Deposit/Withdraw USDC to/from vault in Pro terminal.
  - ABIs updated: `TickBook.abi.json`, `TickBookVault.abi.json`.
- **TickBook Vault-Native Orderbook Plan (Research)** (2025-12-27):
  - Added consolidated design doc: `packages/contracts-evm/docs/research/V8/TICKBOOK_VAULT_NATIVE_PLAN.md`
  - Captures Phase 1: USDC-only Pro UX + internal YES/NO shares display + vault-native matching.

- **TickBookV2 Spec (Research)** (2025-12-28):
  - Added: `packages/contracts-evm/docs/research/V8/TICKBOOK_V2_CONTINUOUS_RANGE.md`
  - Added: `packages/contracts-evm/test/v8/TickBookV2.t.sol` (17 tests)

### Changed
- **Tick Resolution Reduction** (2025-12-27):
  - `TickMath`: `MAX_TICK` 9999 → 999, `NUM_TICKS` 10000 → 1000.
  - `TickBitmap`: Updated for 1000-tick range (10 words × 100 bits).
  - Frontend price calculations updated: `tick / 1000` instead of `tick / 10000`.
- **DeployV8.s.sol**: Now deploys `TickBookVault` before `TickBook`, wires them together.
- **Test Suite Updates**: All TickBook tests refactored for vault-native flow and 1,000 ticks.

### Deployment
- **Base Sepolia V8.4 (ADR-051)** (2025-12-27):
  - MockUSDC: `0x856FbEebD91Db28e3b4550e7602142Cfab683796` (unchanged)
  - Collateralizer: `0x43A6BDdFC1D0C382eD20a0197B4a223A8650831c`
  - AMMEngine: `0x211cbEf79b13C0ed3Ba77A765504eB4419088730`
  - **TickBookVault**: `0x5e712246ce7cF99164421a25C79214B3f6194395` ✨ NEW
  - **TickBook** (vault-native): `0x961654cE125D0FFA8f561d94922256036E44B377` ✨ NEW
  - LaunchpadEngine: `0xd600C85c0cCBf848Ae1853d47492A776ABcFb703`

### Fixed
- **🔴 CRITICAL: AMMEngine Lock Accounting Bug** (2025-12-27):
  - **Discovery**: Invariant test `invariant_LockedNeverExceedsAvailable` caught the bug.
  - **Root Cause**: `_tradePositions()` reduced `_availableBalance` when user bought using proceeds, but did NOT reduce `_lockedBalance` proportionally.
  - **Impact**: `_lockedBalance > _availableBalance` could occur, causing potential underflow in `claimUnlocked()`.
  - **Fix**: Added proportional `_lockedBalance` reduction in `AMMEngine._tradePositions()` (lines 203-217).
  - **Verification**: All 92 tests pass including 256+ run invariant fuzzing.
- **Graduation Revert When Collateralizer Already Registered** (2025-12-27):
  - `LaunchpadEngine` graduation is now **idempotent** if outcome tokens were pre-registered in `Collateralizer`.
  - Uses `Collateralizer.getOutcomeTokens()` when already registered instead of reverting.
  - `TickBook.registerMarket` is now best-effort during graduation (ignores `"TickBook: already registered"`).
  - Added regression test: `test_Graduation_WhenCollateralizerAlreadyRegistered_DoesNotRevert`.

### Added
- **Comprehensive QA Test Suite** (2025-12-27):
  - **AMMSettlement.t.sol** (12 tests): Settlement scenarios for YES/NO/INVALID outcomes
    - `test_SettlePosition_YESWins`, `test_SettlePosition_NOWins`, `test_SettlePosition_INVALIDWins`
    - Multi-user settlement, zero payout handling, revert conditions
    - Fuzz tests: `testFuzz_SettlePosition_RandomYESShares`, `testFuzz_SettlePosition_RandomNOShares`
  - **TickBookEdgeCases.t.sol** (17 tests): Orderbook edge cases
    - Cross-tick market orders, partial fills
    - Extreme tick values (0, 9999, MAX_TICK)
    - View functions, fee collection, revert conditions
  - **V8Invariants.t.sol** (6 invariants): Actor-based invariant fuzzing
    - `invariant_LockedNeverExceedsAvailable` — discovered critical bug
    - `invariant_LPTotalMatchesSum`, `invariant_YesNoSupplySymmetry`
    - `invariant_PricesSumToOne`, `invariant_CollateralizerSolvency`
    - Runs 256+ iterations with multi-actor scenario
  - **TradeFuzz.t.sol** (9 tests): Fuzz testing for trading and math
    - `testFuzz_BuyYES_RandomAmount`, `testFuzz_BuyNO_RandomAmount`
    - `testFuzz_LMSRProbability_Monotonic`, `testFuzz_LMSRProbability_Symmetric`
    - `testFuzz_TickMath_ValidTick`, `testFuzz_TickMath_PriceRange`
  - **LiveV8.t.sol** (6 tests): Fork tests against Base Sepolia
    - Contract code verification, router configuration
    - Fee parameter validation, market creation test
- **ILaunchpadEngine Interface Expansion** (2025-12-27):
  - Added `ammEngine()`, `preGradFeeBps()`, `postGradFeeBps()` getters for test compatibility.

### Changed
- **Test Count**: 74 → 92 tests (24% increase)
- **Base Sepolia config alignment**:
  - Synced `apps/web/src/config/deployments.json` back to the V8.3 Base Sepolia deployment so it matches `apps/web/src/config/markets.json`.

## [8.3.0] - 2025-12-27

### Added
- **Spendable Proceeds for LaunchpadEngine Buys** (2025-12-27):
  - `LaunchpadEngine.tradePositions` now checks user's available balance in `AMMEngine` first.
  - Users only need wallet USDC for the difference (plus fees).
  - Added `AMMEngine.spendBalanceFor(user, amount)` router-only function.
- **Finalized Markets Audit Trail** (2025-12-27):
  - Gov page now shows real contract data for settled markets.
  - Displays outcome, adjudicator, settlement date, and veto status.
  - Fetches `tStar` and `state` from TruthMarket contracts.

### Fixed
- **MAX > Buying Power Bug** (2025-12-27): Fixed transaction failure where MAX button calculated buying power as wallet+spendable, but LaunchpadEngine only pulled from wallet. Now both are aligned.
- **Spendable Proceeds Decimal Display** (2025-12-27): Fixed `/1e6` → `/1e18` for correct display.

### Changed
- **Frontend Buying Power**: Now correctly shows wallet + spendable as total buying power.
- **Balance Summary**: Spendable proceeds shown in green as "+$X".

### Deployment
- **Base Sepolia V8.3**:
  - LaunchpadEngine: `0x1F30742c38c10b28B3960E2B067644A52592bd8f`
  - AMMEngine: `0x8a2E95D54E39F838Fd3Dc1a6f841CF012c22aDC5`
  - Collateralizer: `0x09A7809a33F969B0099A5d19003991592658763f`
  - TickBook: `0x91A2243Fe5e12194539Dcc3AD0BBb23824d9C8Fd`
  - Market 1 (Alien Life): `0xd306eb7ddbAa6394DDBFF54897aFC82A9cf39e08`
  - Market 2 (BTC TWAP): `0xE0d986c827E3398B0f66DeEd0C681f3CD1553fBe`

---

## [8.2.0] - 2025-12-27

### ⚠️ BREAKING CHANGES
- **Dual-Balance Position Model**: `AMMEngine.Position` changed from `int256 shares` to `{ uint256 yesShares; uint256 noShares; }`.
- **Trade Function Signature**: `tradePositions(market, outcome, deltaShares, maxCost)` — now requires `outcome` parameter (0=YES, 1=NO).
- **Position Return Type**: `getPosition(market, user)` now returns `(uint256 yesShares, uint256 noShares)` tuple.

### Added
- **V8.2 Dual-Balance Model** (2025-12-27):
  - Users can now hold both YES and NO positions simultaneously on the same market.
  - Independent tracking eliminates forced netting behavior from V8.1.
  - Aligns AMM position model with TickBook's independent YES/NO orderbook.
- **Direct Position Reads** (2025-12-27):
  - Replaced event-sourced `useLaunchpadPositionDirect` with direct `AMMEngine.getPosition()` calls.
  - Eliminates RPC-heavy 5M-block log scans.
- **New Tests** (2025-12-27):
  - `test_HoldBothYesAndNo`: Verifies users can hold both positions.
  - `test_SellYesIndependently`: Verifies independent sell logic.

### Fixed
- **"Buy NO" Slippage Error** (2025-12-27): Fixed issue where buying NO was internally treated as selling YES, causing `maxCost` to be incorrectly compared against `minProceeds`.
- **LMSRMath Underflow** (2025-12-27): Fixed `calculateProbability()` to use signed difference `int256(qYes) - int256(qNo)` to prevent underflow when `qNo > qYes`.
- **Position Display Issues** (2025-12-27): Fixed hook using wallet chain instead of app's selected chain.

### Deployment
- **Base Sepolia V8.2**:
  - LaunchpadEngine: `0x5B7be7DbfE6035544546F70E4fcAaB5531fBeF15`
  - AMMEngine: `0xC4b7fe6CF6c55aE0212d2c045d6fcd3aac9d1a3f`
  - Collateralizer: `0xdf6aAb7C606B120e9d4BEe83Fcf307Aa03148CD8`
  - TickBook: `0xe0476837584c4bAAbF53e48d2F6cF42f57604CDe`
  - Market 1: `0xF0f854ecdEFa9d28D6B23B63b99aC27bD052ACEe`
  - Market 2: `0x6f4AAC19f115bDcE484D3209C4AA37af05aeBc05`

---

## [8.1.0] - 2025-12-26

### Added
- **UI/UX Design Refresh** (2025-12-26):
  - **New Typography**: Switched to Inter (UI), JetBrains Mono (Numbers/Code), and Space Grotesk (Headings).
  - **Glass-Card System**: Implemented premium dark-glass UI components with consistent depth and glow.
  - **Premium Badges**: High-contrast "PRO" badges for graduated markets with refined styling.
- **V8.1 Portfolio Overhaul** (2025-12-26):
  - **Modular Assets**: Separated Self-Custody (Wallet USDC/LP) from Internal Ledger (AMM Shares).
  - **Value Aggregation**: New row-level reporting pattern for accurate real-time portfolio value summing.
- **Event-Sourced Position Tracking** (2025-12-26):
  - `useLaunchpadPositionDirect`: New hook scanning `PositionTraded` events to track non-custodial balances.
  - **RPC Chunking**: Implemented 100k block scanning strategy for Base Sepolia compatibility.
- **AMM Accounting Documentation** (2025-12-26):
  - Created `V8_AMM_FORMULAS.md` documenting Cash Basis, Equity Floor, and LP Valuation.

### Fixed
- **AMM Position Canonicalization (V8.1)** (2025-12-26):
  - Added an authorized router flow so AMM positions and spendable balances are **attributed to the trader on-chain**.
  - Removed the need for the frontend to scan `LaunchpadEngine.PositionTraded` logs across millions of blocks.
- **AMM Pricing Depth Sync (V8.1)** (2025-12-26):
  - When Launchpad fees increase `bCurrent`, Launchpad now calls `AMMEngine.increaseLiquidity(...)` so AMM quotes match Launchpad economics.
- **Collateralizer 6-decimal Boundary Coverage** (2025-12-26):
  - Added explicit tests validating WAD inputs map to correct **6-decimal USDC transfers** in split/merge/redeem flows.
- **Decimal-Aware USDC Transfer Boundaries (V8.1)** (2025-12-26):
  - Updated `AMMEngine` and `Collateralizer` to convert **WAD (1e18)** ↔ **token decimals** using `IERC20Metadata.decimals()`.
  - Prevents silent under/over-transfers when using **18-decimal MockUSDC** today and **6-decimal USDC** in future deployments.
- **Portfolio LP Balance Read (V8.1)** (2025-12-26):
  - Fixed `Portfolio` multicall to use `LaunchpadEngine.getLPBalance(market, user)` instead of a non-existent `balanceOf`.
- **AMM Sell “Stuck” UX** (2025-12-26):
  - Added sell-side validation (disable when user has insufficient reconstructed shares).
  - Added explicit button states: **Enter Amount / Insufficient Position / Insufficient Balance**.
  - Triggered immediate refetch after confirmed trades (position + market + allowance) to reduce stale UI.
- **Position Tracking Coverage** (2025-12-26):
  - Increased `useLaunchpadPositionDirect` scan window to reduce missed historical trades due to RPC chunk limits.
- **Critical Initialization Fixes** (2025-12-26):
  - **SimpleTradingPanel RefError**: Fixed crash where `approveTxHash` was accessed before declaration.
  - **Portfolio Page Crash**: Fixed missing imports (`useState`, `useEffect`, `useCallback`).
  - **Navbar Build Errors**: Fixed duplicate `NavLink` / `MobileNavLink` declarations.
- **Logic & Precision** (2025-12-26):
  - **Chain Mismatch**: Fixed position reads ignoring the selected network in `SimpleTradingPanel`.
  - **Math Overflow**: Handled contract reverts gracefully in MAX buy binary search.
  - **Dynamic Decimals**: Standardized handling of 18-decimal MockUSDC on Base Sepolia.
- **Input Validation** (2025-12-26):
  - Prevented negative and excessively large quantity/price-range inputs in Trade and Pro views.
- **Broken Social Links**: Fixed placeholder `href="#"` links in footer, landing, and about pages.

### Changed
- **AMM Probability Cards** (2025-12-26):
  - Replaced “$ / share” display with **Issued Shares** for YES/NO (less redundant; better intuition about outstanding supply).
- **Accounting Display Precision** (2025-12-26):
  - `LPHolders` + `MarketStats` now format USD + quantities as **integers** for readability (EXRATE remains fractional).
- **Navigation Consolidation** (2025-12-26):
  - Reordered Navbar: Portfolio (Primary) → Trade → Pro → Launchpad.
  - Consolidated Gov, Faucet, and About into a "More" dropdown.
- **LP Leaderboard Persistence**: Refactored `LPHolders` to always display creator stats, preventing UI flicker.

### Deployment & Protocol Upgrade (2025-12-25)
- **V8.1.5 Full Stack Deployment**: Redeployed the complete protocol stack and initial markets to Base Sepolia.
- **Hybrid Concentrated Orderbook**: Transitioned TickBook to a **Maker/Taker** exchange model.
  - Makers place **Limit Orders** (point or ranged).
  - Takers execute **Market Orders** (dollar-amount based immediate fill).
- **Unified Depth Architecture**: Integrated the unified coordinate system for order depth across 10,000 ticks.
- **ABI Synchronization**: Automated extraction and syncing of all V8.1 contract ABIs to the frontend.

### Frontend & UI/UX (2025-12-25)
- **UI Content Centralization**: Migrated all user-facing text to `apps/web/src/config/ui-content.json` for better maintainability.
- **Actor-Centric Learn Page**: Complete refactor of educational flow based on the Dec 2025 Whitepaper (Creator, Gaming Trader, Arbitrageur, PvP Trader).
- **Venue Branding**: Standardized names across the dApp:
  - **AMM** (Retail Trading)
  - **Pro** (Professional Terminal)
  - **Launchpad** (Market Creation)
- **Multichain Market Filtering**: Implemented real-time market filtering by active `chainId` across all venues.
- **Graduation UI Fix**: Ensured the graduation progress bar correctly stays at 100% for graduated markets.

### QA & Infrastructure (2025-12-25)
- **E2E Test Suite Hardening**:
  - Replaced Synpress with a custom MetaMask fixture for direct extension loading.
  - Hybrid execution: Headless for basic tests, headed but off-screen for wallet/on-chain tests.
  - Fixed Playwright strict mode violations and timing issues after UI text migration.
  - **Result**: 100% pass rate (84/84 tests) verified on production-like configuration.
- **Automated ABI Sync**: Implemented script to verify contract artifacts and sync ABIs to the frontend configuration.

### 🚨 Known Issues
- None currently tracked in `CHANGELOG.md` (see `STATUS.md` for current risks / follow-ups).
  - **Status**: Blocking V8 trading, requires contract redeploy

### QA
- **TickBook Protocol Refactor verified** (2025-12-25):
  - 100% pass rate on `TickBook.t.sol` (Unit tests)
  - 100% pass rate on `V8Integration.t.sol` (Integration tests)
  - Fixed `test_MultipleUsers_Trading` failure by providing broader maker inventory ranges.
- **E2E Testing Infrastructure Hardened** (2025-12-25):
  - Built custom MetaMask fixture (`e2e/fixtures/wallet.fixture.ts`) replacing Synpress
  - Direct extension loading via `chromium.launchPersistentContext()` with MetaMask v11.9.1
  - Hybrid execution: basic tests headless, wallet/onchain tests headed but off-screen
  - Web3Modal dismissal (`Escape` key) to prevent modal-blocking-clicks failures
  - Serial execution (`workers: 1`) for stability
  - All 84 tests passing: 77 basic + 2 wallet + 5 onchain
  - New npm scripts: `test:e2e:basic`, `test:e2e:wallet`, `test:e2e:onchain`
- **E2E Test Suite Complete** (2025-12-25):
  - Fixed 6 failing tests in trade.spec.ts and learn.spec.ts
  - trade.spec.ts:95 - Updated BUY/SELL toggle assertion (rose for SELL, cyan/emerald for BUY)
  - learn.spec.ts - Updated 5 step content matchers to use `getByRole('heading')`
  - gov.spec.ts - Fixed tests to handle wallet-not-connected state
  - All 68 smoke tests passing, 14 wallet tests skipped (require Synpress)
  - Verified legacy routes fully removed from application

### Removed
- **Legacy V8.0 Pages** (2025-12-25):
  - Deleted `/markets`, `/market/:address`, `/portfolio`, `/create-market`, `/operator` routes
  - Deleted corresponding page files: Markets.tsx, MarketDetail.tsx, Portfolio.tsx, CreateMarket.tsx, OperatorConsole.tsx
  - Deleted legacy E2E tests: markets.spec.ts, market-detail.spec.ts, portfolio.spec.ts
  - Updated all internal links to use new role-based paths (/trade, /create, /gov, etc.)

### Added
- **TickBook Protocol V8.1 (Hybrid Orderbook)** (2025-12-25):
  - Transitioned from AMM "Liquidity" model to **Maker/Taker** exchange model.
  - `placeLimitOrder`: Supports point orders and broad range orders.
  - `executeMarketOrder`: Amount-based execution with built-in slippage protection.
  - **Unified Book Architecture**: Symmetrical YES/NO depth map ($L$) across 10,000 ticks.
  - **Pro Terminal Dual-Mode**: High-performance UI for both ranged maker and amount taker orders.
  - Created `TICKBOOK_PROTOCOL_V8.1_SUMMARY.md` technical specification.
- **Actor-Centric Learn Page** (2025-12-25):
  - Complete refactor of educational flow based on Dec 2025 Whitepaper.
  - Interactive steps for Creators, Gaming Traders, and Arbitrageurs.
  - Sandbox mode integrated into the tutorial flow without a global banner.
- **Multichain Market Filtering** (2025-12-25):
  - Automatic filtering of markets by `chainId` on AMM, TickBook, Launchpad, and Gov pages.
  - Uses `useChainId` from wagmi for real-time reactivity.

### Changed
- **UI Venue Renaming** (2025-12-25):
  - **Trade** → **AMM** (Retail AMM Interface)
  - **Pro** → **TickBook** (Professional Orderbook Interface)
  - **Create** → **Launchpad** (Creator Economics Interface)
- **About/Learn Unification** (2025-12-25):
  - Combined legacy "About" and "Learn" into a single `/about` route.
  - Updated Navbar and Landing page "Learn" buttons to point to `/about`.
- **Graduation UX** (2025-12-25):
  - Graduation progress bar now stays visible at 100% for graduated markets.

### Removed
- **Legacy About Page** (2025-12-25):
  - Deleted `apps/web/src/pages/v8/About.tsx`.
- **Sandbox Banner** (2025-12-25):
  - Removed "SANDBOX MODE" warning banner from the top of the Learn page.

### Added
- **AMMFormulasCard Component** (2025-12-24):
  - Displays 5 core AMM accounting formulas ported from V7:
    - 💵 Cash = creatorDeposit + feesAccrued
    - 📊 Max Liability = max(qYes, qNo)
    - 🛡️ Floor = Cash − maxLiability
    - ⚡ LP Value = Floor × (yourLP / totalLP)
    - ⚠️ Underwater warning when Floor ≤ 0
  - Integrated into MarketDetail "Info" tab
- **V8 Trading Panel Integration** (2025-12-24):
  - `SimpleTradingPanel` now uses `useAMMQuoteDirect` for real-time LMSR cost/fee calculation
  - Trade execution via `LaunchpadEngine.tradePositions(market, deltaShares, maxCost)`
  - USDC approval flow with proper allowance checking
  - Price impact warnings for large trades
  - Lock-on-Sell notices for sell orders
  - 1% slippage buffer on maxCost for buy orders
- **V8 Portfolio Page** (2025-12-24):
  - `MarketPositionCard` - Shows user's YES/NO token balances per market
  - `LPPositionCard` - Shows creator LP positions
  - Real-time position values from V8 direct hooks
  - Potential payouts calculation (if YES/NO wins)
  - Links to trade and manage positions
- **useAMMQuoteDirect Hook** (2025-12-24):
  - Real-time LMSR cost calculation using frontend math
  - Fee breakdown (cost, fee, net cost)
  - Price impact percentage
  - New price after trade
  - Formatted display values

### Fixed
- **SimpleTradingPanel Decimal Handling** (2025-12-24):
  - Fixed approval check to correctly compare allowance vs cost in matching decimals
  - Fixed balance check to convert WAD cost to token decimals before comparison
  - Approval amount now uses actual token decimals from contract (not hardcoded 18)
  - Added comprehensive debug logging for USDC decimals, balance, allowance, and quote cost

### Changed
- **Navigation Cleanup** (2025-12-24):
  - Hidden v8-test page from navigation (kept accessible for internal testing)
  - Reordered nav links: Markets → Portfolio → Operator → Faucet → About
- **Repo hygiene (Librarian)**:
  - **Breaking**: removed repo-wide `docs_archive/` in favor of per-package archives:
    - `apps/web/docs/_archive/`
    - `packages/contracts-evm/docs/_archive/`
  - **Breaking**: moved `V7_IMPLEMENTATION_PLAN.md` → `packages/contracts-evm/docs/_archive/v7/`
  - **Build artifacts**: canonical committed static site is now `apps/web/deploy/hostable-site/` (no committed `apps/web/dist/`)
  - **Git ignore policy**: track `pnpm-lock.yaml`; ignore `packages/contracts-evm/broadcast/**` (keep `run-latest.json` only)

## [8.0.0] - 2025-12-23

### Deployed
- **V8 Modular Architecture - Base Sepolia Testnet**:
  - **LaunchpadEngine**: `0x196138C0d39eE18a6EEFbD9f889f455e67774bAe` - Creator economics layer
  - **Collateralizer**: `0x33CEF938B38C0449d9DA786c27168F6F7Dc4FFac` - Token management
  - **AMMEngine**: `0x26728543542297dc17A91D82C0B1605Dc2331537` - Pure trading logic
  - **TickBook**: `0x10dC96D3A82FE35b2FF4571B90D8FE5984c60A87` - Orderbook venue
  - **Market 1** (Alien Life): `0x0b7BfdfE0FAB1b48e4435fE713d78376DAC026fC`
  - **Market 2** (BTC TWAP): `0x122E6afFd70a66183FeBd279C418186F24d9a4e2`

### Added
- **LaunchpadEngine** - Complete creator economics restoration:
  - Creator deposit system (b × ln(2) USDC)
  - LP token system (internal accounting)
  - Fee distribution (5% pre-grad → 1% post-grad, governance-controlled)
  - Graduation mechanics (2× bBase threshold, configurable)
  - Honest Floor LP redemption
  - All parameters governance-controlled
- **V8 Frontend Specifications**:
  - `V8_FRONTEND_ARCHITECTURE.md` - Complete architecture spec
  - `V8_AMM_TRADING_SPEC.md` - AMM trading terminal spec
  - `V8_ORDERBOOK_TRADING_SPEC.md` - Orderbook trading terminal spec
  - `V8_OPERATOR_CONSOLE_SPEC.md` - Creator/adjudicator console spec
  - `V7_TO_V8_MIGRATION_GUIDE.md` - 70% code reuse strategy
- **Deployment Infrastructure**:
  - `script/DeployV8.s.sol` - Core contracts deployment
  - `script/DeployV8Markets.s.sol` - Markets deployment
  - `script/verify-deployment-v8.sh` - Automated verification
  - `docs/V8_DEPLOYMENT_GUIDE.md` - Complete deployment guide
  - `docs/V8_DEPLOYMENT_SUMMARY.md` - Deployment summary

### Changed
- **Architecture**: Complete separation of concerns
  - AMMEngine: Pure LMSR trading logic
  - TickBook: Pure orderbook logic
  - LaunchpadEngine: Creator economics layer (wraps AMMEngine)
  - Collateralizer: Token management (creates tokens dynamically)
  - TruthMarket: Lifecycle management only
- **Creator Economics**: Restored full V6/V7 Launchpad model
  - Governance-controlled fee parameters
  - Configurable graduation mechanics
  - Flexible fee distribution splits
- **Test Coverage**: 47/47 tests passing (100%)

### Removed
- **TraderVaultLite**: Removed in favor of direct USDC transfers
- **OutcomeToken Implementation**: Tokens created dynamically by Collateralizer

## [7.0.0] - 2025-12-22

### Added
- **V7 Dual-Engine Stack**: Full deployment on Base Sepolia.
- **Separated Orderbook & AMM**: Collateralized complete sets (OB) vs. price anchor (AMM).
- **Adjudicator-Gated Settlement**: Unified settlement logic via `SoothAdjudicatorRegistry`.
- **Lock-on-Sell**: Real-time share trading with 24h locked proceeds.
- **TraderVault V4**: Safe `depositAndTradeAMM` path and unified asset accounting.
- **ProtocolConfig & Adjudicators**: Manual, Optimistic, and Brevis-ready adjudicator scaffolding.

### Changed
- **Breaking**: `market.swap()` disabled in favor of `TraderVault.depositAndTradeAMM()`.
- **Breaking**: `market.claimUnlocked()` replaced by `TraderVault.claimUnlocked(market)`.
- **Breaking**: Market creation now requires an explicit `marketAdjudicator`.

## [Unreleased]

### Changed
- **Librarian Cleanup** (2025-12-22):
  - **Deleted** orphaned root-level `lib/` folder (~1,770 duplicate files)
  - **Deleted** empty `archive/` directory
  - **Archived** stale audit docs (`AUDIT_FIXES_SUMMARY.md`, `AUDIT_REPORT.md`) to `docs_archive/`
  - **Moved** research docs (`CREATOR_VAULT_LIFECYCLE_FLOW.md`, `LP_TOKEN_DESIGN_ANALYSIS.md`) to `packages/contracts-evm/docs/research/`
  - **Moved** `MONEY_FLOW_DIAGRAM.md` to `packages/contracts-evm/docs/core/`
  - **Archived** duplicate issues from `apps/web/docs/issues/` and `packages/contracts-evm/docs/issues/solved/` to `docs_archive/issues/`
  - **Updated** `.agent/KNOWLEDGE.md` from V4.6 to V6.2.7 reality
  - **Updated** `README.md` with V6 Launchpad architecture

### Fixed
- **MarketCard Locked Proceeds Bug** (2025-12-21):
  - `totalLockedProceeds` was divided by `1e18` instead of `1e6` (USDC decimals), showing `$0` incorrectly
- **MarketDetail JSX Syntax Error** (2025-12-21):
  - Removed extra `</div>` tag causing "Expected corresponding JSX closing tag for `<Card>`" error

### Changed
- **Contracts (Stage 1 Dual-Engine + Adjudicator Settlement)** (2025-12-21):
  - **BREAKING**: Market settlement is now **Adjudicator-only** via `finalizeResolution(outcome, tStar)` (operator/creator can no longer settle).
  - **BREAKING**: `ISoothMarketV4.initialize` now takes `adjudicator: address` (was `bytes32`).
  - **BREAKING**: Disabled `LaunchpadMarket.swap()` (direct mint/burn + LMSR update path) to preserve AMM/OB separation.
  - Removed creator-only expiry refund (`claimCreatorRefund` now reverts); refunds are via pro-rata `redeemLP()`.
  - Added `claimLockedOnMarketEnd(maxSteps)` to unlock proceeds immediately once the market ends.
- **Contracts (Stage 2 Adjudicator Registry + Guardian + Settlement Roots + Direct Trade)** (2025-12-21):
  - **BREAKING**: `LaunchpadFactory` now requires an `adjudicatorRegistry` and exposes `defaultAdjudicator`.
  - **BREAKING**: `LaunchpadFactory.createMarket` now includes `marketAdjudicator` (0 = use default) and enforces allowlisting.
  - Restored Guardian controls on `LaunchpadMarket`: `liquidate()` (routes liquidation fee to treasury) and `forceGraduate()`.
  - Added `SoothSettlementRootSink` (Merkle root storage + claim verification events; transfer logic deferred).
  - Added `SoothTraderVaultV4.depositAndTradeAMM(...)` for one-call “approve + trade” UX without ERC1155 mint/burn.
 - **Contracts (Stage 3 Adjudicator Classes + Settlement Root Payout Wiring)** (2025-12-21):
  - Added `SoothManualAdjudicator` and `SoothOptimisticAdjudicator` (simple optimistic window).
  - Added `SoothTraderVaultV4.claimSettlementRoot(...)` to apply settlement-root PnL to the Trading Account and move USDC to/from the market vault.
  - Added/updated tests: `AdjudicatorFlowsTest`, extended `SettlementRootSinkTest` payout path.
 - **Contracts (Stage 4 Settlement Sink Hardening + Brevis Stub)** (2025-12-21):
  - Added `SoothTraderVaultV4.setSettlementSink(...)` and enforced allowlisting for `claimSettlementRoot`.
  - Added `SoothBrevisAdjudicator` stub with gateway-authenticated callbacks for resolution + root submission.
  - Added/updated tests: `BrevisAdjudicatorStubTest`, extended `SettlementRootSinkTest` allowlist checks.
- **MegaETH Frontier Fresh Redeploy (BREAKING)** (2025-12-21):
  - Deployed a fresh V6.1.8 stack to MegaETH Frontier (chainId 4326)
  - Updated canonical configs:
    - `apps/web/src/config/deployments.json` (added `megaethFrontier`, bumped version)
    - `apps/web/src/config/markets.json` (added 2 real markets for 4326)
- **Markets Page Cleanup** (2025-12-21):
  - Removed Hero Stats Bar (was showing placeholder "24h Volume: $--")
  - Added badge counts to filter tabs: `All (2)`, `Bonding (1)`, `Graduated (1)`
  - Cleaned up unused imports (`TrendingUp`, `Clock`, `Card`, `useChainStore`)
- **TrendingLeaderboard Redesign** (2025-12-21):
  - Changed from vertical list to 3 horizontal cards (`grid-cols-3`)
  - Removed placeholder volume display
  - Simplified to rank, name, symbol, and "Bonding" badge
- **Formula Visibility** (2025-12-21):
  - AMM Ledger formula hints now always visible (was hover-only)
  - Updated colors for better readability (`slate-500`, `cyan-600/60`, etc.)
- **Portfolio Cleanup** (2025-12-21):
  - Removed "System Online" and "Mainnet Assets" status indicators
- **MarketCard Tooltips** (2025-12-21):
  - Improved tooltip hints for metrics:
    - ⚡ "Liquidity Depth: LMSR parameter controlling price impact"
    - 🛡️ "Floor Equity: Guaranteed minimum LP value (worst-case)"
    - 🔒 "Locked Proceeds: User funds in 24h cooling period"
- **Deployment Script** (2025-12-21):
  - Changed market deadline from `90 days` → `5 days` in `DeployMultiChainV4.s.sol`

### Added
- **Alpha Codebase Purge (2025-12-22)**:
  - **Contracts**: Deleted unreferenced `archive/contracts-evm` duplicate snapshot.
  - **Contracts**: Pruned accidental script duplicates (`* 2.sol`, `verify-deployment 2.sh`) and backup test files.
  - **Contracts**: Removed legacy discrete LMSR math (`TickMath.sol`, `TickLMSR.sol`) and unused interfaces (`ITickCostRegistry.sol`, `ITimeLock.sol`, `IYieldStrategy.sol`).
  - **Contracts**: Deleted redundant `OutcomeToken.sol` and superseded `MarketLPVault_V5.sol`.
  - **Frontend**: Deleted legacy `src/config/solana` and unreferenced V3/early-V4 ABIs.
  - **Frontend**: Removed empty legacy directories (`components/features/operator`, `components/features/launchpad` cleanup, `_archive/v4`).
  - **Frontend**: Cleaned up `abis.ts` by removing 10+ unused legacy ABI exports.
  - **Frontend**: Pruned legacy maintenance scripts (`calc_fee.ts`, `debug-market-state.mjs`).
- **V6.2.5 Pure Trading Account Model** (2025-12-21):
  - **Abandoned Wallet Token Support**: Completely removed all UI and logic for wallet-held ERC1155 tokens in the current dApp version. The dApp now ignores on-chain tokens to focus on the custodial Trading Account.
  - **Inventory Management Hub**: Restored the Merge/Split interface, strictly anchored to the **Trading Account (Vault)** context. Added a dedicated management hub in the Portfolio card.
  - **Hook Optimization**: Updated `useActivePositions` and `useAmmMarketByAddress` to stop fetching ERC1155 balances, reducing RPC overhead.
  - **Frontend LMSR Price Calculation**: Implemented instant price derivation from `qYes`/`qNo`/`b` quantities in the frontend, removing expensive on-chain math calls and improving UI responsiveness.
  - **Mega-Batch Strategy**: Optimized market discovery in `useLaunchpadMarkets` by batching V6 status, graduation state, and outcome tokens into a single request.
- **V6.2.4 Pure WAD Architecture** (2025-12-21):
  - Standardized all AMM accounting views (`ammAssets`, `totalNetAssets`, `cost`, `fee`) to return 18-decimal WAD values.
  - Eliminated scaling mismatches that caused "trillion-dollar" UI display bugs.
  - Updated `LaunchpadQuoter` to return full 18-decimal precision for trade simulations.
- **V6.2.3 Isolated Ledger & Quoter** (2025-12-21):
  - `LaunchpadQuoter.sol`: New standalone quoter contract for simulating trade impact on LP Floor/Ceiling and calculating price impact (BPS).
  - `lpRealizedPnL()`: On-chain view isolating trading performance from initial seed and fees.
  - `isUnderwater()`: Real-time safety signal indicating if the pool floor has hit zero.
  - `convertSharesToFloor()`: Explicit helper for floor-based share valuation.
- **UI Terminology & Precision** (2025-12-21):
  - Standardized **"Floor"** and **"Ceiling"** terminology across Portfolio and Market Detail pages.
  - Standardized LP Exchange Rate as a range (e.g. "0.8x - 1.2x") to reflect guaranteed vs. potential value.
  - Updated `MarketCard` with live graduation progress ring and percentage.
- **Fresh Base Sepolia Deployment (V6.2.3)**:
  - Deployed complete stack with quoter and isolated ledger logic.
  - Updated `deployments.json` (version: `2025-12-21-v6-quoter`).

### Fixed
- **Trillion-Dollar Valuation Bug** (2025-12-21):
  - Fixed a WAD/USDC scale mismatch in `LaunchpadMarket.sol` where `feesAccrued` (18 decimals) was being added directly to assets (6 decimals).
- **Graduation Progress Indicator**:
  - Fixed bug in `MarketCard.tsx` where progress was stuck at 0% due to missing `bBase` props.
- **Protocol-Enforced Liability Isolation**:
  - Moved "Pure AMM Accounting" logic from frontend to smart contracts. LP equity is now derived solely from AMM internal state, guaranteed independent of Orderbook collateral.

### Added
- **V6.2.0 Atomic Inventory Functions** (2025-12-21):
  - `splitAndDeposit(address market, uint256 amount)`: Split USDC into YES+NO shares directly in vault (1 tx instead of 3)
  - `mergeFromVault(address market, uint256 amount)`: Merge vault shares back to USDC (1 tx instead of 3)
  - Modified `debitSplitProceeds` to handle self-calls from vault during atomic split
  - Updated `ISoothTraderVaultV4` interface and frontend ABIs
- **Inventory Management UI** (2025-12-21):
  - Moved Merge/Split from Portfolio to Market Detail page (market-sensitive operations)
  - Added balance display (USDC, YES, NO shares) in Inventory Management card
  - Dynamic button disabling based on available balances
- **Fresh Base Sepolia Deployment** (2025-12-21):
  - Deployed complete V6.2.0 stack with atomic functions
  - Updated `deployments.json` (version: `2025-12-21-v1`)
  - Verified 100% config-to-chain parity

### Fixed
- **Order ID 0 Bug** (2025-12-21):
  - Fixed `useOrderbook` hook incorrectly treating Order ID 0 as end-of-list sentinel
  - Refactored order fetching to use visited ID tracking and explicit termination checks
  - Corrected `orderOwners` ABI call signature (was passing wrong args)
- **UI Consistency** (2025-12-21):
  - Unified button heights for Deposit/Withdraw/Merge/Split to match AMM Buy/Sell (`py-2 text-sm`)
  - Renamed "In Orders" → "Reserved" with tooltip explaining on-chain collateral
  - Removed overly restrictive client-side `isOutcomeToken` authorization check

### Changed
- **MegaETH Deployment Strategy** (2025-12-21):
  - Documented MegaETH's multidimensional gas model (60k intrinsic, 10M estimation limit)
  - Keeping V6.1.8 deployment on MegaETH Frontier (V6.2.0 atomic functions not available there)
  - Added deployment lessons to `LESSONS_LEARNED.md`

### Added
- **Protocol Upgrade: Dynamic Token Authorization** (2025-12-20):
  - Refactored `SoothTraderVaultV4` with a dynamic authorization modifier. The vault now automatically trusts any OutcomeToken proven to belong to a valid market registered in the Factory.
  - Eliminated the manual `setOutcomeToken` admin bottleneck for new market deployments.
  - Updated `DeployFreshV4.s.sol` and `deployments.json` with the new V6.1.9 core infrastructure.
- **Unified Market Sync** (2025-12-20):
  - Synced `markets.json` with the fresh Base Sepolia deployment.
  - Curated a clean "Real Mode" list of live on-chain markets for the Trading Terminal.
  - Verified 100% config-to-chain parity using `verify-deployment.sh`.

### Added
- **Portfolio Domain Architecture** (2025-12-20):
  - Split Portfolio into two distinct visual and logical domains: **Trading Account** (Indigo/Custodial) and **Wallet Portfolio** (Emerald/Direct).
  - Created `PortfolioCard` component with color variants and inset header styling.
  - Added support for "folding" long lists of items in portfolio cards to maintain a compact UI.
  - Added domain-specific background gradients and `CUSTODIAL` / `DIRECT` badges to differentiate custody levels.

### Added
- **Share Splitting & Merging UI** (2025-12-20):
  - Implemented **SPLIT** function: Allows users to convert USDC directly into equal amounts of YES and NO tokens (complete sets).
  - Created `PositionActionsModal`: A standardized modal for Merging and Splitting shares with numeric input and MAX support.
  - Added visual descriptions in the modal to clarify the economic purpose of each action.
  - Added a "Quick Claim" button for settled markets to instantly merge winning shares.

### Fixed
- **Contract Parity**:
  - Added `split()` to `OutcomeToken`, `SoothMarketBase`, and `LaunchpadMarket`.
  - Added `debitSplitProceeds()` to `SoothTraderVaultV4` to handle the USDC cost of splitting.
  - Updated frontend ABIs to reflect new split capabilities.

### Fixed
- **UI Flickering & Stability** (2025-12-20):
  - Standardized `refetchInterval` (30s) and `staleTime` (10s) across core hooks (`useActivePositions`, `useLockedFunds`, `useLPPositions`) to prevent re-render jumps.
  - Fixed `PortfolioCard` slicing logic to work correctly with wrapped children components.
  - Removed "0x" data return errors by forcing chain-awareness in all background polling calls.
- **Visual Branding Inconsistencies** (2025-12-20):
  - Unified logo scale, glow effects, and typography across Navbar, Landing, and About pages.
  - Standardized empty state padding, icons, and font sizes across all portfolio modules.
- **Codebase Cleanliness** (2025-12-20):
  - Removed over 20 unused imports and variables in `TradingAccountCard`, `WalletPositionsCard`, and `Portfolio` main page.
  - Standardized font weights and sizes for high-density data display.

### Changed
- **User-Facing Terminology** (2025-12-20):
  - Renamed "Direct Escrow" → **"Pending Unlocks"**.
  - Renamed "Custodial Positions" → **"Trading Positions"**.
  - Renamed "On-Chain Tokens" → **"Wallet Tokens"**.
  - Renamed "Open Orders" → **"Limit Orders"**.
- **Branding Cleanup**: Removed "protocol" subtitle from the logo text for a cleaner, high-scale look.
- **Header Optimization**: Removed back button from About page and unified "Launch App" button styles.
- **LP Positions Theme**: Changed LP Positions color theme from purple to emerald to align with the "Direct Wallet" domain.

### Added
- **Multi-Chain Hook Stability** (2025-12-20):
  - **🌍 Chain-Aware Logic**: Updated 7 core protocol hooks (`useLaunchpadTradeQuote`, `useOrderbook`, `useOrderbookTrade`, etc.) to be explicitly chain-aware.
  - **Fixed Cross-Chain State Leakage**: Prevented hooks from calling contract addresses on the wrong network by forcing the `chainId` in all Viem/Wagmi read/write operations.
  - **MegaETH RPC Optimizations**: Added custom error handling for MegaETH "resource unavailable" errors, suggesting a retry rather than failing.
  - **Flexible Orderbook Stacking**: Restored the ability to place multiple orders at the same price level, improving orderbook depth.

### Fixed
- **MegaETH Frontier RPC Issues** (2025-12-20):
  - Fixed `0x` zero-data returns caused by wallet/network mismatches during market viewing.
  - Resolved `ReferenceError: selectedChainId` that was crashing the Markets page during chain switching.
- **TypeScript & ABI Consistency** (2025-12-20):
  - Fixed various "string not assignable to 0x${string}" errors in orderbook trade logic.
  - Ensured all background polling uses the currently viewed chain rather than the wallet's active chain.

### Removed
- **Duplicate Price Guard** (2025-12-20): Removed the over-correction that blocked identical price orders after determining it was not a protocol limitation.

- **MegaETH Frontier Net Integration** (2025-12-20):
  - **Dapp Deployment**: Full V6.1.8 protocol stack deployed to MegaETH Mainnet (Frontier Net - Chain 4326).
  - **Protocol Faucet**: New standalone Faucet page (`/faucet`) for minting test mUSDC and ETH gas guidance.
  - **Landing Page Redesign**: Modular "blueprint" motif with MegaETH performance highlights and network badges.
  - **Chain Configuration**: Added `megaethFrontier` to `chains.ts`, `wagmi.ts`, and `deployments.json`.
- **Branding & Media Kit Overhaul** (2025-12-20):
  - **New Visual Identity**: "Layered Architecture" motif representing the vertical protocol stack.
  - **Dapp Assets**: Official `sooth-logo.svg` (high-scale) and `sooth-social-banner.svg`.
  - **Media Kit (`/mediakit`)**:
    - `sooth-logo-layered-light.svg` - High contrast for light themes.
    - `sooth-logo-layered-mono.svg` - Black & white for print/minimal use.
    - `sooth-logo-layered-no-bg.svg` - Transparent variant.
    - `sooth-social-bg-no-text.svg` - Blueprint-style abstract background.
    - `BRAND_GUIDE.md` - Documentation for colors and typography.
- **V6.1.8 Safe Parity LP Minting** (2025-12-20):
  - Implemented **Parity Floor Protection**: LP tokens for fees minted at `max(Current ExRate, 1.0)`
  - Prevents "division-by-near-zero" feedback loop that caused trillion-LP explosions in thin pools
  - Ensures traders always earn minimum of 1 LP per $1 in fees, even if pool floor is zero
  - Added detailed comments to `_handlePostTradeFees` explaining the Safe Parity logic
- **Frontend Specs Overhaul** (2025-12-20):
  - Complete rewrite of `LAUNCHPAD_SPEC.md` for V6.1.8 (Floor Equity, Fair Minting, Direct Swap)
  - New sections: LP Economics (§2.5), useLaunchpadSwap Hook (§3.4), useLPHolders Hook (§3.5)
  - Updated `TRADING_TERMINAL_SPEC.md` with V6.1.8 Quote Summary (Price Net + Fee split)
  - Updated `MARKETS_PAGE_SPEC.md` and `README.md` index
  - Added V6 reference note to `LIQUIDITY_METRICS_EXPLAINED.md`

### Changed
- **SEO & Meta Tags**: Updated `index.html` to use new SVG branding and high-resolution social banners.
- **Favicon Integration**: Removed legacy `favicon.png` in favor of official `sooth-logo.svg`.
- **Trading Panel Quote Display** (2025-12-20):
  - Split "Cost per share" into **"Price (Net)"** and **"Fee"** to clarify $1.00 LMSR price cap
  - Renamed "Max Total" to "Total Cost" for consistency
- **LP Leaderboard Polish** (2025-12-20):
  - Renamed "Your Value" to **"Protected Equity"** to match Floor Equity model
  - Fixed LP Supply and Balance formatting to use `toLocaleString()` with 2 decimal places
  - Added hover tooltip showing full precision LP values
- **Performance & Stability Optimization** (2025-12-20):
  - Removed decorative scanline overlay to eliminate high-frequency flickering.
  - De-coupled `triggerRefresh` from event listeners to prevent excessive re-renders during high chain activity.
  - Switched loading placeholders from pulsing animations to static blocks for better visual stability.
  - Removed all `animate-pulse` classes from production UI (status badges, wallet indicators).

### Deployed
- **MegaETH Frontier Net V6.1.8** (2025-12-20):
  - MockUSDC: `0x58f35be6a5e3d2be4c3575853043322b02feed84`
  - LaunchpadFactory: `0xaa3ffae62a8af00d08ac395e9551776b0a01e492`
  - ProtocolConfig: `0xbe566c267a0d350e1d647ccb621cc657fa3a1d50`
  - Market 1 (Alien Life): `0x13D233B5D83A24a3090780738E4AC82Be3305cee`
  - Market 2 (BTC TWAP): `0xc5DF627fa7d51d75B3EF179c156AceF9801B927E`
- **Base Sepolia V6.1.8** (2025-12-20):
  - MockUSDC: `0x4Dc928Cc772c178fdDba395F8549b0Ebd8B30587`
  - LaunchpadFactory: `0x0Edd298Ce0A1D7E97f1837C4a1Be058e88A21af7`
  - Market 1 (Alien Life): `0x6972A5a6Ca36bD59A86088B031DEE8a2972E6A6F`
  - Market 2 (BTC 7-day TWAP): `0xaF551Ab033E1CC7F423EB29d60E65d8725711a7C`

### Fixed
- **Orderbook Balance Detection & Precision** (2025-12-20):
  - Fixed a critical bug in `useOrderbookTrade` where `availableBalance` was not detected due to struct return-type inconsistencies.
  - Resolved a precision mismatch where 6-decimal USDC vault balances were compared against 18-decimal WAD costs, leading to false "Insufficient balance" errors.
  - Added decimal normalization to `useOrderbookTrade` to ensure all balance comparisons are performed at WAD (18-decimal) precision.
  - Resolved an async race condition in `placeOrder` and `executeTakerOrder` where stale balance state was used instead of refetched data.
  - Switched to explicit `availableBalance()` and `pendingBalance()` calls in `useTraderVault` and `useOrderbookTrade` for better robustness.
- **UI/UX Stabilization & Performance** (2025-12-20):
  - **Scrolling Stability**: Fixed full-page flickering by applying `background-attachment: fixed` to the global body background.
  - **Anti-Flicker Engineering**: Implemented `contain: paint` on `.glass-card` and `will-change: transform` on sticky elements to prevent browser layout thrashing during scroll.
  - **Render Optimization**: Consolidated market data fetching in `MarketDetail.tsx` to prevent cascading re-renders across sub-components.
  - **Hook Throttling**: Increased `refetchInterval` for all market hooks (10s–60s) to reduce background thread congestion.
  - **Animation Purge**: Replaced the dynamic "Bonding Curve" radial glow with a static version to reduce GPU load.
  - **Visual Unification**: Standardized "Launch App" button styles and text across Landing, About, and Navbar components.
- **Logo Merge Conflict**: Resolved `<<<<<<<` markers in `sooth-logo.svg`.
- **LP Supply Explosion in Fair Minting** (2025-12-20):
  - Fixed precision bug where thin pools caused division-by-near-zero in `_handlePostTradeFees`.
  - Implemented Parity Floor Protection (capped at 1:1 reward rate).
- **MarketDetail Market Info Disappearing** (2025-12-17):
  - Fixed bug where market name and symbol would disappear in `MarketDetail.tsx` page
  - Added `outcomeToken` to `useLaunchpadMarket` hook return values
  - Added fallback mechanism: if market not found in markets list, fetch name/symbol directly from outcome token contract
- **V6 Test Suite Failures** (2025-12-20):
  - Updated `MockOutcomeToken` in tests to include `totalSupply(uint256 id)` (required for liability tracking).
  - Fixed `testCreatorReceivesLPTokens` to correctly expect 18-decimal LP tokens.
  - Result: **24/24 tests passing** in `LaunchpadV6.t.sol`. ✅

### Removed
- **Alpha Codebase Purge** (2025-12-20):
  - Deleted over 30 unused files and legacy artifacts to reduce bundle size and complexity.
  - Removed legacy interfaces: `TraderTerminal.tsx`, `LPDashboard.tsx`, `OperatorConsole.tsx`.
  - Removed duplicate component: `TradingAccountCard.tsx`.
  - Removed unused features: `operator/` and `liquidity/` directories.
  - Purged dead hooks: `useProtocolStats`, `useSettlement`, `useTradeQuote`, `useVault`, `useV4Quote`, `useAmmTrade`, `useGuardian`.
- **Documentation Cleanup**:
  - Archived legacy V4 and V5 documentation to `docs_archive/`.
  - Hid BNB Testnet from dApp visibility (official hidden status in `STATUS.md`).

### Added
- **V6 Launchpad Deployment on Base Sepolia** (2025-12-17):
  - Deployed V6 `LaunchpadFactory` with `ProtocolConfig` architecture
  - Factory address: `0x5fe83532e061353ADe5D604DfB4239aE7c8B9d2F`
  - ProtocolConfig: `0x22565a06050a5031a02885263ebb106ec8595a8a`
  - Created 2 new V6 Launchpad markets via factory:
    - Market 1 (Alien Life): `0x69b073721c552eBac6c42e934EA6684d78727c67` (Tier 1: $1k deposit)
    - Market 2 (BTC 7-day TWAP): `0x3A5E80578933aa92644D4ee7192CD744600d6A2f` (Tier 2: $10k deposit)
  - Updated `deployments.json` (version 4.11) and `markets.json` with new addresses
  - Markets verified on-chain: all contracts registered, links correct ✅

### Changed
- **Deployment Script Fix** (2025-12-17):
  - Fixed `DeployV4Markets.s.sol` to use `LaunchpadOutcomeToken` instead of `OutcomeToken`
  - Updated `verify-deployment.sh` to use `SoothLiquidityVault` instead of deprecated `SoothGovernorVault`
  - Script now correctly deploys V6 Launchpad markets via factory
- **Launchpad-Only Architecture Migration** (2025-12-16):
  - **BREAKING**: Removed "standard market" concept — all markets must be created via `LaunchpadFactory`
  - Renamed `SoothMarketV4` → `SoothMarketBase` (base contract that LaunchpadMarket inherits from, NOT a market type)
  - Renamed `governor` → `marketOperator` in `SoothMarketBase` (generic operator role for flexibility)
  - **Clarification**: In Launchpad markets, `marketOperator == creator` (same address, set during initialization)
  - Renamed `ISoothGovernorVault` → `ISoothLiquidityVault` (clarifies purpose)
  - Renamed `SoothGovernorVault` → `SoothLiquidityVault` (global vault for TraderVault's locked proceeds)
  - Renamed abstract `Ownable` → `SoothOwnable` in `SoothInterfaces.sol` (resolved conflict with OpenZeppelin)
  - Created separate `ISoothLiquidityVault.sol` interface file to avoid Ownable import conflicts
  - Updated 11 test files to use `LaunchpadFactory` instead of direct `SoothMarketBase` instantiation
  - Updated 10 deployment scripts to use `LaunchpadFactory` for market creation
  - Clarified `SoothLiquidityVault` role: Only for TraderVault's global locked proceeds tracking, NOT for market liquidity
  - Each Launchpad market is its own vault (implements `ISoothLiquidityVault` directly)
  - Updated all documentation to remove standard market references

### Added
- **V5 Frontend Trading** (2025-12-15 Session 6):
  - `MarketCard.tsx` — Full inline AMM trading on Markets page
    - Buy/Sell toggle, YES/NO outcome selection
    - Amount input with hold-to-increment/decrement
    - Quick amount buttons (10, 50, 100, 500)
    - Cost per share display using `totalCost` for accuracy
    - Slippage options: 0.1%, 0.5%, 1%, 2%
    - Max to sell display (clickable to set max)
    - Fee display in quote summary
    - Probability transition arrows
    - Collapsible trading panel

- **V5 Launchpad QA Suite** (2025-12-15 Session 5):
  - Expanded `test/Launchpad.t.sol` from 2 → 17 tests (all passing, 0 warnings)
  - Graduation tests: `testGraduation`, `testManualGraduate`, `testDoubleGraduateFails`
  - Expiry/refund tests: `testExpiry`, `testExpiryBlocksTrading`, `testCreatorRefund`, `testNonCreatorCannotClaimRefund`, `testCannotExpireGraduatedMarket`
  - LP Vault tests: `testLPVaultRedeem`, `testLPVaultPreviewRedeem`
  - Edge cases: `testInvalidTierIndex`, `testDoubleInitializeFails`, `testOpenEndMarket`, `testAllTiers`
  - Invariant test: `testFeeRateInvariant` (bBase never decreases, fee 5%→1%)
- **Deployment Tooling**: `verify-deployment.sh` now has curl fallback for sandbox environments where `cast` crashes (macOS system-configuration panic)
- **V5 Frontend Overhaul** (2025-12-15):
  - `CreateMarketDrawer` component — drawer-based market creation with 18-decimal USDC fix
  - `GraduationProgress` component — animated progress bar, fee rate display, graduate button
  - `MarketHeader` component — market name, status badges, creator address, deadline countdown
  - Mini progress bar in `LaunchpadMarketCard` showing bonding curve progress
  - `feesAccrued` read added to `useLaunchpadMarket` hook and `LAUNCHPAD_MARKET_ABI`
  - `animate-shimmer` CSS utility class for progress bar animation
- **Launchpad Model Research** — Complete design for V5 permissionless market creation:
  - `LAUNCHPAD_MODEL_RESEARCH.md` — Full architecture and design decisions
  - `LAUNCHPAD_ECONOMICS_V2.md` — Role-by-role economic analysis
  - ADR-014 documents all finalized decisions
  - Key features: per-market liquidity, 1.44x liquidity leverage, graduation race, LP Vault with exchangeRate
- **Launchpad V5 Contracts** (Session 3):
  - `LaunchpadFactory.sol`: Deploys markets via Clones, initializes liquidity tiers
  - `LaunchpadMarket.sol`: Implements graduation logic (2x liquidity target), dynamic fee switch (5% → 1%)
  - `MarketLPVault.sol`: Per-market governor vault compliant with `ISoothGovernorVault`
  - `LaunchpadOutcomeToken.sol`: Cloneable ERC1155 token
  - `test/Launchpad.t.sol`: Comprehensive unit tests for creation, trading, fees, and graduation flows
- **Frontend Specs**: `LAUNCHPAD_SPEC.md` covering market creation and graduation UI flows.
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
- **V5 Frontend Overhaul** (2025-12-15):
  - `LaunchpadMarket.tsx` — Complete page redesign with new header, graduation progress, probability cards
  - `LPDashboard.tsx` — Now uses `CreateMarketDrawer` instead of navigation
  - `TraderTerminal.tsx` — Create Market button opens drawer instead of navigating
  - `useNavigationStore.ts` — Removed `create-market` view type
  - `App.tsx` — Removed create-market view case

### Fixed
- **Orderbook Balance Recognition** (2025-12-15 Session 6): V5 Launchpad markets now work with orderbook UI
  - `useOrderbook.ts` — Detects address-format marketIds, uses `useAmmMarketByAddress`
  - `useOrderbookTrade.ts` — Same fix, updated contract calls to use resolved address
  - `LimitOrderForm.tsx` — Uses correct market hook based on ID format
- **Cost Per Share Calculation** (2025-12-15 Session 6): Fixed jumping/creeping values
  - Added `quote.inputAmount` check to sync displayed data with current input
  - Shows `--` while loading instead of stale market price fallback
  - Uses `totalCost` (includes fee) for accurate per-share calculation
- **Launchpad claimCreatorRefund()** (2025-12-15): `LaunchpadMarket.claimCreatorRefund()` was calling `lpVault.redeem()` which checks `balanceOf(msg.sender)`, but msg.sender was Market, not creator. Fixed to use `sendFunds()` for direct USDC transfer.
- **Compiler Warnings**: Fixed 14 warnings in Launchpad contracts (unused params, view→pure)
- **Fork Test Addresses**: Updated `LiveAmmBuy.t.sol` to use current V4.6 deployment addresses
- **Sell Slippage Calculation**: `useLaunchpadTradeQuote.ts` now correctly calculates `minReceived = (proceeds - fee) * (1 - slippage)` for sell orders
- **USDC Decimals**: `CreateMarketDrawer` uses correct 18 decimals for MockUSDC (was 6)

### Removed
- **Archived V4 Legacy**: Moved to `src/_archive/`:
  - `V4MarketPage.tsx` — Standalone V4 page
  - `CreateLaunchpadMarket.tsx` — Superseded by drawer
  - `LaunchpadTradeForm.tsx` — Trading now inline in cards
  - `/components/v4/*` — All V4-specific components

### Changed
- **Multi-Chain Config (V4.6)**:
  - Bumped `apps/web/src/config/deployments.json` version to `4.10` (cache refresh)
  - Updated Base Sepolia + BNB Testnet market + outcome token addresses across:
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
- **SoothTraderVaultV4**: Updated `tradeAMM` to fetch `governorVault` dynamically from the market contract (`mkt.governorVault()`), allowing per-market liquidity pools (essential for Launchpad).

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
- **Launchpad Factory B-Values**: Fixed slippage error in Launchpad markets by scaling `tierBValues` to WAD (1e18) precision in Factory, matching `SoothMarketV4` LMSR math expectations.

### Deployed
- **Base Sepolia V4.6 Fresh Markets (2025-12-14 Session 2)**:
  - MockUSDC: `0x53d34066A316AE1699d434753B70593A6D59Fec1` (unchanged)
  - TraderVault: `0xa8aDE73124B3256F98f510F6A9E7C1e3Aa71d20B` (unchanged)
  - GovernorVault: `0x2A2DfA1B3B3F4db798b759d07064Bb800BD10fB1` (unchanged)
  - FeeController: `0x1a646107e7E88aa01Fadff3145Af08156679198e` (unchanged)
  - Market 1 (Alien): `0x93AF286C7112dBeCB1e99B67c9E17427dD2ADec8` ✨ NEW
  - OutcomeToken 1: `0x0359d69Fc421a68b6Ee818F84EA7575f5073E21c` ✨ NEW
  - Market 2 (BTC): `0xaF3638175C66bA5B4aEd255A1d266504D3df31a3` ✨ NEW
  - OutcomeToken 2: `0x9D84d61C9e6eb38bd4227F0Dd3b9Bd8ac13F792A` ✨ NEW
- **BNB Testnet V4.6 Fresh Markets (2025-12-14 Session 2)**:
  - MockUSDC: `0x89BA3FEe2FB764Ec297DC91bb874aa5bF88F204c` (unchanged)
  - TraderVault: `0x05818C4028ff5c273B45B3c55131Af2Bd9D12322` (unchanged)
  - GovernorVault: `0xEB33E2f815306D936d4bDD2b33b2b68C16b62Fa0` (unchanged)
  - FeeController: `0x3152A8cd6CA0C64675C73486B06203a9D8226448` (unchanged)
  - Market 1 (Alien): `0x93CD5Cd848af2Af5247Ba132FcAc4B6840531585` ✨ NEW
  - OutcomeToken 1: `0xAf358498666D7b0F8Cd4A02B5194D19CA654756d` ✨ NEW
  - Market 2 (BTC): `0x45419a4f8Fc485aC548F289d1a6279b9010c11ca` ✨ NEW
  - OutcomeToken 2: `0xb68Cf3fB896fd9b3869830473917767C3F6a28cF` ✨ NEW
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
