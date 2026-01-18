# Project Status

## Current Focus
- **Code Quality Improvements (2026-01-18)** — Production-safe logging utility, TypeScript type safety improvements, error boundaries, contract gas optimization. All changes verified (90 tests pass, frontend builds).
- **CLI/SDK setmarket Unification (2026-01-16)** — Unified output format between internal CLI and web SDK. Both now show `[SYMBOL] Market Name`, Address, and Key consistently. Removed legacy marketKey warnings. SDK now fetches market name from `TruthMarket.question()`.
- **Trade/Pro UI Cleanup (2026-01-16)** — Simplified market headers: removed redundant symbol/probability display, now shows question + bonding progress icon (⚡) or graduated icon (📊). Compact metadata card with status badge, expiry, creator, adjudicator.
- **V10.8.3 ABI Sync (2026-01-16)** — Fixed all frontend hooks and SDK to work with new 10-field MarketState (removed name/symbol). Symbol now derived from market address (first 4 bytes). Question fetched from TruthMarket.question().

## Recent Changes (Last 5 Sessions)
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
- **IPFS Market Metadata** — Currently storing market metadata (name, category) in browser localStorage. Lost on browser clear or cross-device. Need to store on IPFS and emit CID in contract event for persistence.
- **Mobile Testing with Data** — Pro page mobile fixes need testing with actual market data (indexer was offline during development).
- **Market Order Semantics** — Decide/implement true sweep behavior (shares- or budget-based) before re-enabling FE Market.
- **Contract Verification** — Verify V10.8.3 contracts on Basescan/Monadexplorer/Arcscan/MegaETH explorer.

## Recently Completed
- ✅ **Deploy Indexer Fixes to Render** — Pushed to `render` branch: MegaETH RPC fix (`carrot.megaeth.com/rpc`), RangeOrderPlaced handler, all event handlers verified.
- ✅ **Address Sync** — Fixed `baseSepolia.json` with correct V10.8.3 addresses. All config files now consistent (indexer, frontend, keeper, contracts-core).

## Known Issues
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

### Base Sepolia (chainId: 84532) — V10.8.3
| Contract | Address |
|----------|---------|
| **LaunchpadEngine** | `0xdc51a2beb6ed2e65f1ee4cfa87a228b77e697a21` |
| **TickBookPoolManager** | `0x463759fa866e6045c97cb37c25bcd74d23aa9b34` |
| **TickBookVault** | `0x3727d8d586bd37cd716c1bdbc05c6c2c6b8adc5d` |
| **AMMEngine** | `0x95c0a48c38a19dcdd9b8d21b0c304154230b56b9` |
| **Collateralizer** | `0x3aeeedd2e749c6d7bbabafdfd76ad84ad6c414f1` |
| **MockUSDC** | `0x2bba41ddbd9a10b3719c3865029ce5238ec09dac` |

### Arc Testnet (chainId: 5042002) — V10.8.3
| Contract | Address |
|----------|---------|
| **LaunchpadEngine** | `0x7015ea4bdada102969f5d9eb9457e087a559cedc` |
| **TickBookPoolManager** | `0xb4240ac6cc3a082d5819e9410f0eb90209a4a3f3` |
| **TickBookVault** | `0xadd058a6bd2bce6f1fe1cbd3c9e21250c055e242` |
| **AMMEngine** | `0x3c01829ddac95f1f143c04afdcf0c2689aa979f0` |
| **Collateralizer** | `0xed16d73f5879ccf8ca1a16cfda46615fa98ef30c` |
| **MockUSDC** | `0x31a1380bea9b3616956cdc05b2f3fad489803717` |

### Monad Testnet (chainId: 10143) — V10.8.3
| Contract | Address |
|----------|---------|
| **LaunchpadEngine** | `0x9ca66ac4a00e7c380db41a714be470493bc2eee1` |
| **TickBookPoolManager** | `0xaa3daf93c823258fe025b26be90e8a08d2abf84f` |
| **TickBookVault** | `0xb3ea593be1a834650e2955cc8f038921f4571ffa` |
| **AMMEngine** | `0xd18e6e7489d07e38f903e301c19f6a43650a0178` |
| **Collateralizer** | `0x7cbabf4a2dad48f7b5180b54adb8038a42663cb7` |
| **MockUSDC** | `0x28db001c8803ca586b3da0bfd31d8ce676aff0f0` |

### MegaETH Testnet (chainId: 6343) — V10.8.3
| Contract | Address |
|----------|---------|
| **LaunchpadEngine** | `0x2de2f2e6aad4f310dc72acc6f896412ceb4706f3` |
| **TickBookPoolManager** | `0x7f7a84196dc38b054a6f31b2efcd7142860b37c6` |
| **TickBookVault** | `0xb80a06cc6813c03f1b04bc969942740b7483b447` |
| **AMMEngine** | `0xed1ffac79bfe9a13715774d2694a0f55ed392656` |
| **Collateralizer** | `0x86437735e952ec47884e3ff202594d8789943a81` |
| **MockUSDC** | `0x749d2d9937c10e28dd065d1f301ed485f1525f0a` |


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

*Last updated: 2026-01-18 (Code quality sprint: logger, types, error boundaries, gas optimization)*
