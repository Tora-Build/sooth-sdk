# Project Status

> **Codebase Version**: V12.0 (SoothBook) + V11.1 (TickBook)  
> **Active Testing**: Base Sepolia  
> **Last Updated**: 2026-02-15

## V12 SoothBook (Implemented)

V12 introduces **SoothBook** — a radically simplified standalone orderbook (602 lines vs V10's 2710). No vault, no growth accumulators, ERC20 outcome tokens, FIFO matching.

| Feature | Description | Status |
|---------|-------------|--------|
| 4 atomic actions | `buyYes`, `buyNo`, `mint`, `merge` | ✅ Deployed |
| Auto-match engine | `yesTick + noTick >= 1000` auto-mints complete set | ✅ Deployed |
| FIFO matching | Array-based with head pointer | ✅ Deployed |
| ERC20 outcome tokens | OutcomeToken with minter role | ✅ Deployed |
| Tick bitmap | O(1) tick discovery via TickBitmap library | ✅ Deployed |
| Market resolution | `resolveMarket` (onlyOwner) + `redeem` | ✅ Deployed |

**Tests**: 45 passing (unit tests in `SoothBook.t.sol`)

### V12 Stack

| Layer | Status | Details |
|-------|--------|---------|
| Contracts | ✅ Deployed | SoothBook + OutcomeToken + TickBitmap on Base Sepolia |
| CLI | ✅ Wired | 11 commands (`buyyes`, `buyno`, `sbmint`, `sbmerge`, `sbcancel`, `sbredeem`, `sbresolve`, `sbstate`, `sbbook`, `sbpositions`, `sbcreatemarket`) |
| SDK | ✅ Built | Browser SDK with 11 commands in `apps/web/src/lib/sdk/commands/soothbook.ts` |
| Indexer | ✅ Configured | 8 event handlers, 4 schema tables, 5 REST endpoints at `/v12/*` |
| Frontend | ✅ Integrated | `useSoothBookMarket` hook, V12Workbench at `/pro` reads from deployments.json |

### V12 Deployment (Base Sepolia)

| Contract | Address |
|----------|---------|
| SoothBook | `0xBcD904bcCF4BA8ec257F348a837B594bD162c5B7` |
| MockUSDC | `0x4c69Be122CE5A3C19e5239F5724898A2Cb837c38` |

3 test markets deployed with seeded liquidity on Market 1.

---

## V11 Features (Implemented)

| Feature | Contract | Status |
|---------|----------|--------|
| Trial Period (7 days) | `LaunchpadEngine` | ✅ Implemented |
| ERC20 LP Token | `LaunchpadLPToken` | ✅ Implemented |
| Validated Adjudicator | `ValidatedAdjudicator` | ✅ Implemented |
| Protocol Config (guardian + pause) | `ProtocolConfig` | ✅ Implemented |
| Adjudicator-only finalize | `TruthMarket` | ✅ Implemented |

**Tests**: 266 passing (unit, integration, invariant, fuzz)

## Current Focus
- **V12 SoothBook Full Stack (2026-02-15)** — Complete V12 integration across all layers: fresh Base Sepolia deployment, 45 unit tests, CLI (11 commands), browser SDK (11 commands), Ponder indexer (8 event handlers), frontend hook (`useSoothBookMarket`) + V12Workbench at `/pro`. All builds pass.
- **Sooth Lite PWA Polish (2026-02-08)** — Mobile-first PWA for Monad hackathon. TikTok-style vertical snap-scroll feed. Completed: UI cleanup, faucet integration, background images, branding updates, decimal precision fixes, **RPC 429 error elimination**. Testing on Monad Testnet.

## Recent Changes (Last 5 Sessions)
- **2026-02-15** — **V12 SoothBook Full Stack**: Deployed SoothBook V12 to Base Sepolia (contract `0xBcD904...`). Created 3 test markets with seeded liquidity. Built full integration: CLI with 11 `sb*` commands wired into REPL, browser SDK with 11 commands, Ponder indexer with 8 event handlers + 4 tables + 5 REST endpoints, `useSoothBookMarket` hook, V12Workbench refactored to use `deployments.json` and shared ABIs. 45 unit tests passing. All builds clean.
- **2026-02-08** — **RPC 429 Error Elimination**: Comprehensive RPC call reduction in Sooth Lite. Indexer now computes `yesProbability` locally from reserves (removed 67s/event RPC calls). Added `yesReserves`/`noReserves` fields to schema. Frontend `usePositions` refactored to use indexer endpoints. `useAMMQuote` optimized to only query when user types input. Added `useIndexerHealth` hook and status indicator. Fixed TradeModal accessibility (Drawer.Title). Result: Zero 429 errors.
- **2026-02-04** — **Mobile WalletConnect Debugging**: Added WalletConnect/AppKit storage cleanup path, safe JSON parsing, dev client reinstall, Metro polyfills for Node18 (`URL.canParse`, `toReversed`), and AppKit event/log instrumentation. Added manual storage reset in Login screen. Still seeing LINKING_ERROR on mobile deep link and connect state not updating.
- **2026-01-30** — **Mobile Trading App Complete**: Built full-featured Expo mobile app (7 tasks, 3,019 lines, 7 commits). Features: Privy social login (email/Google/Apple), Stories-style market discovery with swipeable cards, AMM + TickBook trading with approval flow, portfolio with redemption, haptic feedback, skeleton loaders, transaction overlays, smart error messages. Extended `@sooth/sdk-core` with ABIs and contract functions. All TypeScript strict mode, zero compilation errors. Documentation in `.sisyphus/mobile-app-COMPLETE.md`.
- **2026-01-27** — **Finalized Markets UI Audit**: Fixed AMMSettlementCard mock data (users can now see positions and claim payouts), fixed LPHolders null return (LP Leaderboard now visible on finalized markets), verified stage detection logic (correct, issue is data-level), improved UI for Trade and Pro pages (prominent status badges, clear CTAs, better visual hierarchy), decided to KEEP UserOrdersPanel in Pro finalized view (users need to cancel orders to retrieve collateral). All changes verified with passing builds. Documentation complete in `.sisyphus/notepads/finalized-markets-ui-audit/`.
- **2026-01-26** — **V11.1 fresh deployment to Base Sepolia, single-chain focus**
- **2026-01-25** — **Trial Period Tests**: Updated TrialPeriodFlow + TrialPeriodInvariants to warp past the trial period before dismissal and align expectations with the on-chain rule. Full `forge test` passing again.
- **2026-01-24** — **Frontend Stage Filtering**: Added comprehensive stage filtering to Trade and Pro pages. Now properly distinguishes 5 stages: `bonding`, `graduated`, `settled`, `finalized`, `dismissed`. Key changes:
  - `useOnChainMarkets.ts`: Reads `isFinalized` from TruthMarket for each market
  - `useTruthMarketDirect.ts`: Added `isFinalized` to market data
  - `AMMSettlementCard.tsx`: Shows different UI for settled (amber, "Veto Period Active") vs finalized (emerald, claim button enabled)
  - `DismissedMarketPanel.tsx`: New component for V11 trial period refund claims
  - `Trade.tsx` / `Pro.tsx`: Stage filter dropdown with counts per stage
  - Pro page excludes settled/finalized/dismissed markets (only tradeable markets)
- **2026-01-24** — **CLI Checksum Complete Fix**: Added `vaultMarketCollateral` (TickBookVault) and `lpYieldPool` (LaunchpadEngine) tracking to `checksum` command. Previous -1.27 USDC discrepancy was due to missing tracking of these contract-held funds. Checksum now shows "Potential Stuck USDC" section when `vaultMarketCollateral > 0` or `lpYieldPool > 0`. The `market-lifecycle-multi-actor` scenario now passes with exact 0.00 USDC balance.
- **2026-01-23** — **CLI Zero-Sum P&L Fix**: Added AMM position tracking to `snapshot` and `checksum` commands. Previously missing `AMMEngine.getPosition()` data caused -71.24 USDC discrepancy after `market-lifecycle-multi-actor` scenario. Now tracks `ammYes`/`ammNo` per actor and includes in total value calculations.
- **2026-01-22** — **CLI Multi-Actor Automation**: Added `market-lifecycle-multi-actor` scenario, `--scenario` auto-run flag, scenario failure enforcement, `setmarket created` flow, keeper `claimspotsellfor` command, and actor role mapping (alice/bob/charlie/david/ellen). Updated README help strings.
- **2026-01-21** — **Protocol Guardian + Pause Wiring**: Added `ProtocolConfig` (guardian list + pause), shifted guardian checks to protocol-level, adjudicator-only finalize, Launchpad auto-register with per-market adjudicator config, and updated frontend + scripts to new `createMarket` signature. Ported `validate-spot-crossing.ts` to V11 flow (launchpad → graduation → TickBook).
- **2026-01-21** — **TickBookPoolManager Size + Crossing Fix**: Removed `placeOrderWithPermit`, `placeOrderWithAgent`, and `clearDustLiquidity` from TickBookPoolManager to stay under EVM code size. Fixed spot-sell crossing iteration to avoid OOB when multiple sells share ticks; updated ABIs.
- **2026-01-21** — **V11 Architecture Decisions**: Added ADR-082 (adjudicator trust: permissionless choice, off-chain registry, protocol-level guardian, adjudicator-only finalize, tStar deferred with finalize hook, auto-register via Launchpad) and ADR-083 (canonical filenames: rename `LaunchpadEngineV11.sol` → `LaunchpadEngine.sol`, move `test/v11/` to feature paths). Updated CLI actor testing tool plan with Protocol Owner actor, Action Purpose table, and guardian/pause flows.
- **2026-01-20** — **V11 Implementation**: Implemented ERC-8004 Trustless Agents interfaces and Trial Period mechanics. Created `IERC8004.sol` (Identity, Reputation, Validation registries), `LaunchpadLPToken.sol` (ERC20 with settlement-locked transfers), `ValidatedAdjudicator.sol` (TEE attestation-based settlement), `LaunchpadEngineV11.sol` (trial period + adjudicator readiness). TickBook permit/agent order functions later deferred for code size. All 132 V11 tests pass.
- **2026-01-20** — **V11 Policy Alignment**: Disabled agent-gated markets and Launchpad fee discounts; `tradeWithAgent` deferred/removed to reduce code size. TickBook keeps agent attribution hooks only. Batched `forge test` runs passed.
- **2026-01-18** — **Code Quality Sprint**: Created production-safe logger utility (`apps/web/src/lib/logger.ts`) with namespaced loggers (trade, order, claim, market, etc.) that only logs in development. Replaced all 69 console.log/warn/error statements across 13 frontend files. Fixed `any` types in `useMarketStore.ts`. Added `ErrorBoundary` component. Enhanced `types.ts` with comprehensive protocol types. Added `MarketInitialized` event to `AMMEngine.sol`. Added unchecked arithmetic to `TickBookPoolManager.sol` batch operations (saves ~100-500 gas per batch). Removed dead code (`useLaunchpadMarketLegacy.ts`). All 90 contract tests pass, frontend builds.
- **2026-01-16** — **Indexer Stability Fixes**: Diagnosed "PGlite is closed" errors caused by corrupted WASM database under multi-chain load. Fixed MegaETH RPC URL (`timothy` → `carrot.megaeth.com`). Added `RangeOrderPlaced` handler for V10.8.1 backward compatibility. Added missing ABI events (TickBookVault, AMMEngine). Migrated local dev to PostgreSQL.
- **2026-01-16** — **Trade/Pro UI Polish**: Fixed market chip cards - now show 2 lines for long questions, smaller font (`text-xs`), fixed width (`w-[320px]`/`w-[280px]`).
- **2026-01-16** — **CLI V10.8.3 Compatibility Fix**: Fixed internal CLI and web SDK to work with V10.8.3 contracts. Updated inline ABIs (removed name/symbol from MarketState). CLI now fetches market names from `TruthMarket.question()`. Unified two-line market display format. Removed debug messages and auto-select market feature.
- **2026-01-16** — **V10.8.3 Symbol Simplification**: Removed `symbol` param from `createMarket()`, `name`/`symbol` from `MarketState` struct. Symbol now auto-derived from market address (first 4 bytes). Deployed to all 4 testnets. Updated frontend ABIs, SDK, CLI, and indexer.
- **2026-01-16** — **V10.8.2 Contract Optimization**: Removed `buyFromSpotSell()` function from TickBookPoolManager. V10 unified crossing already handles spot fills automatically (spot-first priority via `placeOrder`). Removed CLI `buyspotsell` command and ABI entries.
- **2026-01-16** — **Indexer Event Enhancement**: Added `symbol` field to `LaunchpadEngine.MarketCreated` event. Added `LaunchpadEngine:MarketCreated` and `LaunchpadEngine:MarketGraduated` handlers to indexer. Market symbols now captured in `launchpad_market` table.
- **2026-01-16** — **Trade/Pro UI Cleanup**: Removed "Bonding Fee: 5%" badge from GraduationProgress (returns null for graduated markets). Added fee info to MarketDetailHeader status badge (`Graduated · 1% Fee` or `Bonding · 5% Fee`). Moved market header card into Pro left panel only. Updated LiquidityMap stats.
- **2026-01-16** — **SDK Streaming Progress**: Added progress callbacks to `createmarket`, `graduate`, `registermarket` commands. Geek page shows streaming step updates (`[1/4] Checking USDC...`).
- **2026-01-16** — **Geek Mode CLI**: Added `/geek` page with browser-based CLI. Features: WebTerminal with streaming output, local wallet (create/enable/disable/clear), simulate command with detailed order output (like internal CLI), market persistence. Created `@sooth/sdk-core` shared package unifying utilities between internal CLI and web SDK.
- **2026-01-15** — **Pro UI Refinement**: Removed the Split/Merge panel from `Pro.tsx`. The feature was creating confusion because the generated ERC20 tokens cannot be traded on the Vault-based orderbook (no bridge exists). The panel code remains in the codebase (`SplitMergePanel.tsx`) with integer formatting fixes applied for future use.
- **2026-01-14** — **MegaETH Graduation Gas Fix**: Fixed graduation tx failures on MegaETH. MegaETH's multidimensional gas model charges 10k storage gas/byte for code deposit. Deploying 2 OutcomeTokens (~4.4KB) requires ~44M storage gas. Updated CLI and frontend to use 60M gas for graduation trades on MegaETH. Also switched to official MegaETH RPC (`carrot.megaeth.com/rpc`).
- **2026-01-14** — **MegaETH Stability Fixes**: Debugged and resolved market creation reverts on MegaETH. Root cause was a 28M gas requirement (vs 2.5M cap) and local clock drift. Updated CLI to use block timestamp for deadlines and enabled AMM trading in CLI.
- **2026-01-13** — **Portfolio Market Name Fix**: Fixed bug where Portfolio page displayed "MARKET 0X9F7F2A" instead of actual market question. Root cause: when indexer was ready, code used placeholder names. Fix: always use RPC data for market names (LaunchpadEngine.markets() returns full question).
- **2026-01-13** — **Indexer Schema Update**: Added `name` and `symbol` fields to `launchpadMarket` table. Handler initializes to null; future work to populate via TruthMarket factory pattern or contract event change.
- **2026-01-13** — **Interactive CLI RPC Fallback**: `createmarket`/wallet balance reads now retry `readContract` across fallback Monad RPC endpoints when a node returns empty call data (viem: `returned no data ("0x")`).
- **2026-01-13** — **Indexer Arc Backfill Reliability**: Set Arc `ethGetLogsBlockRange` to `10` to support Alchemy free tier (avoids `eth_getLogs` 10-block range 400s).
- **2026-01-12** — **Mobile UI Polish**: Fixed Pro page header vertical text bug (market question displayed one char per line on mobile). Fixed orders list Cancel button cutoff with horizontal scroll wrapper (`min-w-[480px]`). Applied same fix to Spot Sells section.
- **2026-01-12** — **UI Rules Consolidation**: Created global `~/.claude/skills/ui-rules/SKILL.md` with technical constraints (z-index scale, min text size, safe-area insets). Simplified `frontend-dev.md` to creative philosophy only. Added deep ocean bubble animation to Launchpad, aria-labels to icon buttons, text-balance/text-pretty to headings/paragraphs.
- **2026-01-12** — **Arc V10.8 Deployment + Full Sync**: Deployed V10.8 to Arc Testnet using stable RPC (`rpc.testnet.arc.network`). Synced addresses to indexer (`ponder.config.ts`), CLI (`config.ts`), README, and frontend. All 3 testnets now on V10.8.
- **2026-01-12** — **Trade/Pro Category & Title Fixes**: Fixed category filter switching bug (stale market display), aligned categories with Launchpad (`crypto, sports, cultures, others`), fixed truncated market titles by using `TruthMarket.question` instead of `LaunchpadEngine.markets.name` (contract truncates to 50 chars).
- **2026-01-12** — **V10.8 Redeploy (Base + Monad)**: Deployed fresh core contracts; updated frontend `deployments.json` and indexer start blocks.
- **2026-01-09** — **Deployment Scripts Enhanced**: Added root `.env` loading to `deploy-multichain.ts` and `create-alien-markets.ts`. Created `validate-v10.7-fix.ts` for on-chain testing.
- **2026-01-09** — **LiquidityMap Color Fix**: Fixed bucket side overwrite bug where last-processed order determined color. Now tracks YES/NO liquidity separately per bucket and uses dominant side for coloring. Added RPC fallback for spot sells.
- **2026-01-07** — **Launchpad Two-Column Layout**: Complete refactor with sticky form (left), contextual info (right), P\u0026L Simulator in drawer, mobile Create/Learn tab selector.
- **2026-01-07** — **V10.6 Arc Testnet Deploy**: Completed V10.6 deployment to Arc Testnet. All 3 chains now on V10.6.
- **2026-01-07** — **V10.6 Dust Order Fix**: Orders with <1000 wei unfilled now stay `active=true` (visible) instead of disappearing. Liquidity removed from book but order remains claimable.
- **2026-01-06** — **V10.4 Spot Fill Optimization (RFC-001)**: Merged tick-indexed spot fills for O(overlap) gas complexity. Added 50-tick range cap (`MAX_SPOT_RANGE`). See ADR-075.
- **2026-01-05** — **V10.0.1 Deployed**: Full redeployment to Base Sepolia and Monad Testnet with pro-rata accumulator fix. All 10 V10 forge tests pass.
- **2026-01-05** — **V9.9.8-fix: Pro-rata Accumulator Bug**: Fixed fill growth denominator using `oppTotalLiq` instead of `oppLiqInOverlap`. Prevents orders showing 99% filled when only small crossings occurred.
- **2026-01-05** — **Frontend Fixes**: Fixed hybrid sell (now splits spot + short correctly), fixed `calculateMaxCost` for range orders (uses correct bounds per outcome), removed failing publicnode RPC.
- **2026-01-05** — **CLI Enhancements**: Added `claimspotsell`, `hybridsell` commands. Added spot/hybrid sell to simulate. Increased batch claim limit to 50.
- **2026-01-05** — **Repo Hygiene**: Librarian cleanup executed. Enforced canonical filenames (`TickBookPoolManager.json`, `baseSepolia.json`). Removed versioned ABI keys, unified around `ABIS`.
- **2026-01-05** — **V10 Audit & Cleanup**: Removed historical `TickBookPoolManagerV996.sol` and legacy V9 tests. Renamed CLI variables (`keyV996` → `keyV10`) for consistency.
- **2026-01-05** — V10 Unified Crossing: Created `TickBookPoolManagerV10.sol` with dual-collateral architecture. Spot fills first, then range. See ADR-073.
- **2026-01-05** — V9.9.8 Bug Fixes: Fixed `cancelSpotSell` double-credit vulnerability (proceeds zeroed before credit), indexer tick liquidity on cancel, MarketRegistered ABI mismatch.
- **2026-01-05** — V9.9.7 Spot Sell: Added `placeSpotSell`, `cancelSpotSell`, `buyFromSpotSell` to contract. Frontend Pro.tsx updated to use spot sell for users with existing shares.
- **2026-01-04** — Pro Page Order Management: Simplified order actions (Cancel/Claim), always use RPC for fill tracking, added `batchCancelOrders` to contract.

- **2026-01-06** — **Monad Testnet Stable**: Fixed `simulate` CLI crash, configured 2M gas limit, and successfully created test markets ("UN Confirms Alien Life").
- **2026-01-06** — **Frontend V10 Integrated**: Updated addresses and ABIs for V10.3.0 deployment.
- **2026-01-06** — **Graduate Command Verified**: Validated fee accumulation and graduation logic on V10.
- **2026-01-06** — **Pro Market Order Disabled**: Removed Market toggle / floor UI from Pro terminal pending contract-level market sweep semantics.
- **2026-01-06** — **Tick 999 Boundary Fix**: Adjusted tick boundary bookkeeping to make overlap discovery aware of liquidity that reaches MAX_TICK.

## Pending/Blocked
- **ADR-083 Refactor** — Rename `LaunchpadEngineV11.sol` → `LaunchpadEngine.sol`, move `test/v11/` to feature-based paths per canonical filename policy.
- **claimSpotSellProceedsFor** — Add permissionless spot sell claim for keeper parity (see cli-actor-testing-tool.md).
- **IPFS Market Metadata** — Currently storing market metadata (name, category) in browser localStorage. Lost on browser clear or cross-device. Need to store on IPFS and emit CID in contract event for persistence.
- **Mobile Testing with Data** — Pro page mobile fixes need testing with actual market data (indexer was offline during development).
- **Market Order Semantics** — Decide/implement true sweep behavior (shares- or budget-based) before re-enabling FE Market.

## Recently Completed
- ✅ **Deploy Indexer Fixes to Render** — Pushed to `render` branch: MegaETH RPC fix (`carrot.megaeth.com/rpc`), RangeOrderPlaced handler, all event handlers verified.
- ✅ **Address Sync** — Fixed `baseSepolia.json` with correct V10.8.3 addresses. All config files now consistent (indexer, frontend, keeper, contracts-core).

## Known Issues
- **Mobile Wallet Connect** — AppKit reports CONNECT_SUCCESS but `useAccount` stays disconnected; LINKING_ERROR on mobile wallet deep links (Base/Coinbase). Uniswap wallet opens but app doesn’t return to authenticated state.
- **Monad RPC Empty eth_call** — Some Monad testnet RPC endpoints intermittently return empty data (`0x`) for view calls; the interactive CLI now retries across fallback RPCs for critical reads.
- **Arc Testnet Event Polling** — 400 Bad Request on high-frequency `useWatchContractEvent` (Mitigated by disabling on ID 5042002).
- **Arc Alchemy Free Tier getLogs Limit** — Alchemy free tier caps `eth_getLogs` queries to a 10-block range; Ponder must chunk Arc backfills accordingly (or use a different RPC plan/endpoint).
- **Recent Trades Empty** — Indexer `/trades` endpoint returns `[]` (no `MarketOrderExecuted` events indexed yet on Base Sepolia).
- **⚠️ Market Order Semantics (V10)** — Current implementation uses full-range order + overlap-based crossing; it is not a guaranteed book sweep.
- **Isolated ERC20 Tokens** — The `Collateralizer` (Split/Merge) produces ERC20 tokens, but the `TickBookVault` (Pro Trading) uses internal shares. There is no deposit/withdraw bridge, so Split/Merge tokens cannot be traded on the Pro orderbook.

## V9.9.6 Bug Fixes Summary (2026-01-02)

| Fix | Issue | Solution | Status |
|-----|-------|----------|--------|
| **fix1** | Active liquidity underflow during tick crossing | `_safeSubLiquidity()` helper | ✅ Deployed |
| **fix2** | Inactive orders causing O(n) gas growth | Swap-and-pop removal via `_removeFromUserOrders()` | ✅ Deployed |
| **fix3** | Array index out of bounds during removal | Backwards iteration in `_autoClaimUserOrders()` | ✅ Deployed |
| **fix4** | RPC limits blocking order enumeration | `getAllMarketOrders()` view function | ✅ Deployed |
| **fix6** | Orders not crossing (raw tick vs effective price) | `YES_tick + NO_tick >= 1000` formula | ✅ Deployed |
| **fix7** | Overlap calculation inverted | Corrected to `[sellerPrice, tickUpper]` | ✅ Deployed |
| **fix8** | Bitmap finds expensive seller + underflow | `findNextDown` + `_safeSubTotalLiquidity()` | ✅ Deployed |
| **fix9d** | O(n) autoclaim + manual USDC claim | Auto-claim 100% filled only + auto-release pool | ✅ Deployed |

**Retrospective**: See `packages/contracts-core/docs/V996-crossing-logic-retrospective.md`

## V9.9.6 Unified Order API (2026-01-01)

### API Changes
- **UNIFIED**: Single `placeOrder()` replaces separate `placeRangeOrder()` and `executeMarketOrder()`
- **ORDER TYPES**: Determined by tick range:
  - Market order: `tickLower=1, tickUpper=999`
  - Limit order: `tickLower=X, tickUpper=X`
  - Range order: `tickLower < tickUpper`
  - Market with floor: `tickLower=floor, tickUpper=999`
- **AUTO-CLAIM**: Claims all user's pending fills before placing new order
- **TERMINOLOGY**: Removed maker/taker language (now resting/crossing orders)

### Frontend Integration
- **New Hook**: `usePlaceOrder(marketKey)` with helper functions:
  - `marketOrder(outcome, shares, maxCost)` — fill everything
  - `limitOrder(outcome, shares, priceCents, maxCost)` — single tick
  - `rangeOrder(outcome, shares, priceLow, priceHigh, maxCost)` — spread
  - `marketWithFloor(outcome, shares, floorCents, maxCost)` — fill then rest
- **Market Discovery**: `useOnChainMarkets` hook enables dynamic listing without static config dependency.
- **Account Model**: Integrated spendable proceeds into buying power for better capital efficiency.

### Files Added
- `packages/contracts-core/src/TickBookPoolManagerV996.sol`
- `packages/contracts-testing/test/v9/UnifiedOrderSystem.t.sol`
- `apps/web/src/hooks/usePlaceOrder.ts`
- `apps/web/src/hooks/useOnChainMarkets.ts`
- `apps/web/src/config/abis/TickBookPoolManager.json`

---

## V9.9.5 LEAN Changes (Deployed 2025-12-31)

### Bug Fixes
- **Fill Overflow**: Q128 accumulator math could cause `filledShares > sharesTotal` (~0.1% drift)
- **Phantom Orders**: Fully-filled orders remained "active" with dust liquidity
- **Double Subtraction Risk**: Multiple cleanup paths could double-subtract liquidity

### Solution
- Added `liquidityRemoved` flag to `RangeOrder` struct for idempotent cleanup
- Cap `filledShares` at `sharesTotal` in `claimFills()`
- Auto-complete orders when fully filled (removes tick liquidity, sets `active=false`)
- All three cleanup paths (crossing, claimFills, cancel) now check flag before removing

---

## Current Deployments

### Base Sepolia (chainId: 84532) — V11.1 (Active Testing)
| Contract | Address |
|----------|---------|
| **LaunchpadEngine** | `0x3cfa2113c919c916e8334d245b157de937e76836` |
| **TickBookPoolManager** | `0x61ddf4716a181658e2fa9efd98b93c634ac49cdd` |
| **TickBookVault** | `0x667c100f8f5667177fce0e9566ffe1403fc7c6f7` |
| **AMMEngine** | `0x1399d385d2861eb046d83ededb7f4ea3aaca2ef5` |
| **Collateralizer** | `0x4deae2f0a39b84f57a28f07762e8b47085ed38de` |
| **ProtocolConfig** | `0x4c76089b2ad28b2fc9c4d7a1c06eeb13d0336fc0` |
| **MockUSDC** | `0xb4f46ed670ed6c4cf422ea61e06961d64a753e9d` |

> **Note:** V11.1 focuses on Base Sepolia for testing. Monad, MegaETH, and Arc deployments remain at V10.9 but are disabled in tooling.

### Arc Testnet (chainId: 5042002) — V10.9
| Contract | Address |
|----------|---------|
| **LaunchpadEngine** | `0x625b4b2997232380126f0aecd84867086f89b27e` |
| **TickBookPoolManager** | `0x8ba9751284d77ed59f46ea877577e6430bc30209` |
| **TickBookVault** | `0x1695ac9983f457e446d8f903d7c4061fbc7907f8` |
| **AMMEngine** | `0x0f0dd0be87f6ab153e732039469fe64353b95dbb` |
| **Collateralizer** | `0x0313af9c18e3c954f42b771a6d301fbbc6ad60a5` |
| **MockUSDC** | `0x805825e6af09178ea699a32a8d6cc5ca3637df80` |

### Monad Testnet (chainId: 10143) — V11.1
| Contract | Address |
|----------|---------|
| **LaunchpadEngine** | `0x744724aa5b389644f31dfcfbb67786b581602084` |
| **TickBookPoolManager** | `0xcc8fbc38af3510c9b28941298b5bdd481a7698b4` |
| **TickBookVault** | `0x93c9ee74896f1f7854a35003d92c9e7b54c0f296` |
| **AMMEngine** | `0x67147bc54df45ce43cb88b735043c496047596a7` |
| **Collateralizer** | `0x57992a707c285971a22dffc3106118331b5e632f` |
| **ProtocolConfig** | `0x6784f9b2e3a629c94cc05b441b6fdec4a6890830` |
| **MockUSDC** | `0x3b2f5a6e16cb5d5cf277f8718a9add3af0b1222a` |

### MegaETH Testnet (chainId: 6343) — V10.9
| Contract | Address |
|----------|---------|
| **LaunchpadEngine** | `0xa2b2653124cb98b4d83a8a314e5e0bef2621832f` |
| **TickBookPoolManager** | `0xf52a8e9f5defcc6fe0e66b523d29ad7cfc3af530` |
| **TickBookVault** | `0x5b9a8b49d5616326bd61ac57b429cbf84e8cc756` |
| **AMMEngine** | `0x61470420cc117e9460aae3bdc6cdf77c443ac09c` |
| **Collateralizer** | `0xe928d0cf62a98f2e24e65978ae487f562749305a` |
| **MockUSDC** | `0x57bda4319c306a68054f25017183030752f97d63` |


---

## Package Structure (2026-01-01)

### contracts-core (Audit Scope)
```
packages/contracts-core/
├── src/                 # Core contracts (audit scope)
├── script/              # 1_DeployCore, deploy-multichain, verify
├── deployments/         # baseSepolia.json, monadTestnet.json
├── abi/                 # Generated ABIs
└── lib/                 # Dependencies
```

### contracts-testing (Partner + QA)
```
packages/contracts-testing/
├── test/                # V10 tests only (legacy V9 removed)
├── script/
│   ├── markets/         # Market creation & init scripts
│   ├── deploy/          # Version-specific deploy scripts
│   └── benchmark/       # hft-benchmark.ts
├── mocks/               # MockUSDC
├── core -> ../contracts-core/src  # Symlink
└── lib -> ../contracts-core/lib   # Symlink
```

### Commands
```bash
# Build core (audit scope)
cd packages/contracts-core && forge build

# Run tests
cd packages/contracts-testing && forge test

# Deploy
pnpm deploy:contracts  # → contracts-core

# Benchmark
pnpm benchmark  # → contracts-testing
```

---

## Recent Improvements (2026-01-06)

### V10 Unified Crossing (ADR-073)
- **Unified Liquidity**: `placeOrder` now natively crosses both Spot Sells and Range Orders.
- **Spot Priority**: Takers automatically get the best price (Spot > Range).
- **Verified**: Regression tests (`UnifiedCrossing.t.sol`) confirm correct priority and settlement.

### Interactive CLI (contracts-testing)
New REPL for on-chain testing without external scripts:
```bash
bun run script/interactive/interactive-test.ts --chain=baseSepolia
```

**Commands added:**
- `createmarket <template> [liquidity]` — Deploy TruthMarket + init in LaunchpadEngine
- `graduate [tradeSize] [numTrades]` — Execute trades to accumulate fees until graduation
- `marketstatus` — Show comprehensive status (TruthMarket, AMM, Collateralizer, TickBook)
- `simulate` — Place limit orders + execute market orders for orderbook testing
- `setmarket <address>` — Fetch token info from chain (supports pre-graduation markets)
- `markets` / `m` — Show current market selection

**Key feature:** Everything works from CLI — TruthMarket bytecode embedded, no forge scripts needed.

### Package Split (ADR-065)
- Split `contracts-evm` into `contracts-core` (audit) + `contracts-testing` (QA/partners)
- Deleted outdated V4/V5/V8 artifacts (broadcast logs, old deployment configs)
- Updated sync scripts to point to `contracts-core/deployments/`
- Tests use `@core/` remapping to import from core package

### Deployment Workflow
**STEP 1**: [1_DeployCore.s.sol](packages/contracts-core/script/1_DeployCore.s.sol)
- Deploys 5 core contracts (Collateralizer, AMMEngine, TickBookVault, PoolManager, LaunchpadEngine)
- Links components (vault→poolManager, ammEngine→launchpad router)

**STEP 2**: [2_CreateMarket.s.sol](packages/contracts-testing/script/markets/2_CreateMarket.s.sol)
- Market creation workflow in correct order (deploy → activate → register → initialize)

---

## Interactive CLI Bug Fixes (2026-01-01)

### Basis Points (BPS) Fixes
**Issue**: `getGraduationProgress` returns progress in basis points (10000 = 100%), but CLI was treating it as percentage.

**Fixed files**:
- `commands/state.ts`: Markets list now displays correct % (was showing "ready!" at 6.9%)
- `commands/market.ts`: Graduate command checks `>= 10000n` not `>= 100n`
- `commands/market.ts`: Progress display divides by 100 for correct %

### Graduate Trade Size Calculation
**Issue**: Trades weren't generating enough fees because:
1. `tradeSize` is in shares, but fees are charged on COST (USDC)
2. SELL trades are half the size of BUY trades
3. With LMSR at ~50% price, cost ≈ 0.5 × shares

**Fix**: Changed formula from `volumeNeeded * 8 / (3 * numTrades)` to account for:
- BUY cost ≈ shares × 0.5
- SELL cost ≈ (shares/2) × 0.5

### Frontend Collateralizer Fix
**Issue**: Pre-graduation markets threw "Collateralizer: not registered" error

**Fix**: `useCollateralizerDirect.ts` now wraps read in try-catch, returns fallback with `isRegistered: false` for pre-graduation markets.

---

## On-Chain Market Discovery (2026-01-01)

Added on-chain market enumeration to replace static `markets.json` config.

### Contract Changes
- `LaunchpadEngine.sol`: Added `address[] public allMarkets` storage
- `LaunchpadEngine.sol`: Added `getMarkets()` and `getMarketCount()` view functions
- `ILaunchpadEngine.sol`: Updated interface with new functions
- `createMarket()` now pushes to `allMarkets` array

### Frontend Changes
- Updated `LaunchpadEngine.json` ABI
- New hook: `useOnChainMarkets.ts`
  - `useOnChainMarkets()` — Returns all markets with metadata
  - `useOnChainMarketCount()` — Lightweight count-only query

### Integration Status
- **Ready**: Contract + hook complete, build passes
- **Pending**: Wire hook into market list pages (Trade, Portfolio, Pro)
- **Decision**: Keep `markets.json` for UI metadata (descriptions, categories, images)

---

## Pending Work

### Critical (Blocking)
- [x] **Create test markets** — V10.3.0 markets created on Monad & Base Sepolia.
- [x] **Frontend Integration** — Connected V10 contracts to web app.

### High Priority
- [x] **Verify Graduate Command** — Validated on V10 markets.
- [ ] **Contract Verification** — Verify V10 contracts on Basescan

### Medium Priority
- [ ] **Integrate useOnChainMarkets** — Replace static config in market pages
- [ ] **Documentation** — Update developer guides for V10 changes

### Interactive CLI Next Steps
- [ ] **Tune graduate trade sizes** — Current formula gets ~70% progress; may need more iterations
- [ ] **Custom market template** — Allow user to specify question/name/symbol
- [ ] **Scenario library** — Add more YAML scenarios for automated testing

### Known Issues
- Graduate command with 4 trades reaches ~70% progress instead of 100% (LMSR price impact varies)

---

## Critical Bug Fix (2026-01-01)

### V9.9.6 Active Liquidity Underflow (RESOLVED in V10)

**Symptom**: First several trades succeed, then one fails with "arithmetic underflow or overflow", and ALL subsequent trades fail.

**Root Cause**: In `_fill()` function, unsafe type casts when `|delta| > activeLiq`.

**Fix**: Added `_safeAddLiquidity()` helper that clamps to 0.

**Status**: **RESOLVED**. Included in V10.3.0.

*Last updated: 2026-02-15 (V12.0 SoothBook full stack integration)*
