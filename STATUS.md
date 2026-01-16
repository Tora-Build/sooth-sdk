# Project Status

## Current Focus
- **V10.8.2 Contract Optimization (2026-01-16)** — Removed redundant `buyFromSpotSell` function. V10 unified crossing handles spot fills automatically via `placeOrder`.
- **Indexer Event Enhancement (2026-01-16)** — Added `symbol` to `MarketCreated` event so indexer can capture market token names. Added `LaunchpadEngine:MarketCreated` and `MarketGraduated` handlers.
- **Trade/Pro UI Cleanup (2026-01-16)** — Moved fee info to status badge, removed graduated view from GraduationProgress, moved market header into Pro left panel.
- **Geek Mode CLI (2026-01-16)** — Added browser-based CLI (`/geek`) with WebTerminal, local wallet (auto-sign), simulate command with streaming output, and full SDK integration.
- **V10.8.1 All Testnets Deployed (2026-01-13)** — Base Sepolia, Monad, Arc, and MegaETH Testnet all running V10.8.1.

## Recent Changes (Last 5 Sessions)
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
- **Indexing Reset** — Reset indexer DB and reindex with new V10.8.2 addresses (Base: 36389936, Monad: 6513951, Arc: 21946905).
- **IPFS Market Metadata** — Currently storing market metadata (name, category) in browser localStorage. Lost on browser clear or cross-device. Need to store on IPFS and emit CID in contract event for persistence.
- **Mobile Testing with Data** — Pro page mobile fixes need testing with actual market data (indexer was offline during development).
- **Market Order Semantics** — Decide/implement true sweep behavior (shares- or budget-based) before re-enabling FE Market.
- **Contract Verification** — Verify V10.8.2 contracts on Basescan/Monadexplorer/Arcscan.
- **MegaETH V10.8.2** — MegaETH has 5000 byte DA size limit; Collateralizer contract exceeds this. Requires contract size optimization or alternative deployment strategy.

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

### Base Sepolia (chainId: 84532) — V10.8.2
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0x096105c2052d10d8d637b7f2f8af88b10396fe5e` |
| **Collateralizer** | `0xf48510b2a9489469ac73446d1fb18195ddcd81c9` |
| **AMMEngine** | `0x37718d2eaccfbabd0b07929a900d8cf60db57680` |
| **TickBookVault** | `0xa2df334de3feb81a32bed868687ffbf9a0b218ab` |
| **LaunchpadEngine** | `0x29225a42fbd93726424112f8f3eb043698c535c7` |
| **MockUSDC** | `0x2bb5f27f2f674a80cb5f0fb920d8cd0a9b0b53d6` |

**Note:** V10.8.2 (2026-01-16). Removed `buyFromSpotSell`, added `symbol` to MarketCreated event.

### Arc Testnet (chainId: 5042002) — V10.8.2
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0x4af0dc87a6b2a1764ecd8ea6f705e7ab3515ec9c` |
| **Collateralizer** | `0xf720f8de1f8c2ac572b3b9636607d1cf7f9cadee` |
| **AMMEngine** | `0x9b8280640361171c94e2f7d221a245df3030f5d3` |
| **TickBookVault** | `0x9afc2ab14b9e1e1c01f05b5dcc9c583039fe7cb4` |
| **LaunchpadEngine** | `0xebac310b73a4d9198cd7c688174a03370000f660` |
| **MockUSDC** | `0xf91116cd23698183943f9d75828e374dbf1f4f7c` |

**Note:** V10.8.2 (2026-01-16). Removed `buyFromSpotSell`, added `symbol` to MarketCreated event.

### Monad Testnet (chainId: 10143) — V10.8.2
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0x767e0260fce8cdb6fd06aa4d997c0b86c780a73d` |
| **Collateralizer** | `0x5867e37122b5be1afda83628fa873a856c035220` |
| **AMMEngine** | `0x85e29adb6591857aab50e6f20276981f31917b9c` |
| **TickBookVault** | `0x6bcff6cd4edca4d4b0cd6bcbf47de5ad134328ba` |
| **LaunchpadEngine** | `0xbd280f20ca24d9daecc8fc8756e7408ff095880d` |
| **MockUSDC** | `0xca1d02199aeb37eb74fc01799847d74d6c6f4bd1` |

**Note:** V10.8.2 (2026-01-16). Removed `buyFromSpotSell`, added `symbol` to MarketCreated event.

### MegaETH Testnet (chainId: 6343) — V10.8.1
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0xb243697c5f642cd7e75e14f0f3cf224583641120` |
| **Collateralizer** | `0xebb9f8bf365ba595ab70a2eef6099c29804a553b` |
| **AMMEngine** | `0x2a1e74f74221b544d20d903fbf042e265e065703` |
| **TickBookVault** | `0x125d547d5916b9e7d9c0bb312fbdaf127865fe1b` |
| **LaunchpadEngine** | `0xc29ed9513c421bcc208388b7cc098fad0f338ba7` |
| **MockUSDC** | `0x6b9923ffa94ef9339a3a07afcf204294fcb9a749` |

**Note:** V10.8.1 (2026-01-14). MegaETH has DA size limit preventing V10.8.2 deployment.


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

*Last updated: 2026-01-12 (Mobile UI polish + UI rules consolidation)*
