# Changelog

All notable changes to Sooth Protocol will be documented in this file.

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
