# Project Status

## Current Focus
- **V10.8 All Testnets Deployed (2026-01-12)** — Base Sepolia, Monad, and Arc Testnet all running V10.8 with expanded event coverage.
- **Mobile UI Polish (2026-01-12)** — Fixed Pro page header vertical text bug and orders list overflow on mobile viewports.
- **UI Rules Consolidation** — Global UI skill created, frontend-dev simplified to creative philosophy.

## Recent Changes (Last 5 Sessions)
- **2026-01-12** — **Mobile UI Polish**: Fixed Pro page header vertical text bug (market question displayed one char per line on mobile). Fixed orders list Cancel button cutoff with horizontal scroll wrapper (`min-w-[480px]`). Applied same fix to Spot Sells section.
- **2026-01-12** — **UI Rules Consolidation**: Created global `~/.claude/skills/ui-rules/SKILL.md` with technical constraints (z-index scale, min text size, safe-area insets). Simplified `frontend-dev.md` to creative philosophy only. Added deep ocean bubble animation to Launchpad, aria-labels to icon buttons, text-balance/text-pretty to headings/paragraphs.
- **2026-01-12** — **Arc V10.8 Deployment + Full Sync**: Deployed V10.8 to Arc Testnet using stable RPC (`rpc.testnet.arc.network`). Synced addresses to indexer (`ponder.config.ts`), CLI (`config.ts`), README, and frontend. All 3 testnets now on V10.8.
- **2026-01-12** — **Trade/Pro Category & Title Fixes**: Fixed category filter switching bug (stale market display), aligned categories with Launchpad (`crypto, sports, cultures, others`), fixed truncated market titles by using `TruthMarket.question` instead of `LaunchpadEngine.markets.name` (contract truncates to 50 chars).
- **2026-01-12** — **V10.8 Redeploy (Base + Monad)**: Deployed fresh core contracts; updated frontend `deployments.json` and indexer start blocks.
- **2026-01-12** — **Event Coverage Expansion**: Added new events across TickBookVault, AMMEngine, LaunchpadEngine, and TickBookPoolManager to support comprehensive indexing.
- **2026-01-12** — **Portfolio Indexer Integration**: Added indexer schema + API endpoints; frontend hooks now prefer indexer with RPC fallback.
- **2026-01-12** — **PR #39 Integration**: Adopted DecimalMath refactor across contracts-core.
- **2026-01-11** — **RPC Endpoint Fixes**: Fixed Monad and Arc RPC endpoints across frontend and CLI configs.
- **2026-01-09** — **Frontend Indexer Sync Indicator**: Added `useIndexerStatus` hook polling Ponder `/status` endpoint. Footer shows green dot + block height when synced, red when offline.
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
- **Indexing Reset** — Reset indexer DB and reindex with new Arc addresses (start block 21,290,000).
- **Mobile Testing with Data** — Pro page mobile fixes need testing with actual market data (indexer was offline during development).
- **Market Order Semantics** — Decide/implement true sweep behavior (shares- or budget-based) before re-enabling FE Market.
- **Contract Verification** — Verify V10.8 contracts on Basescan/Monadexplorer/Arcscan.

## Known Issues
- **Arc Testnet Event Polling** — 400 Bad Request on high-frequency `useWatchContractEvent` (Mitigated by disabling on ID 5042002).
- **Recent Trades Empty** — Indexer `/trades` endpoint returns `[]` (no `MarketOrderExecuted` events indexed yet on Base Sepolia).
- **⚠️ Market Order Semantics (V10)** — Current implementation uses full-range order + overlap-based crossing; it is not a guaranteed book sweep.

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

### Base Sepolia (chainId: 84532) — V10.8
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0x9d17f81207fc377bbd8a73b27ad38eeb23be4388` |
| **Collateralizer** | `0xd7a7d7829776456527198cfd0da1e6c4dae70817` |
| **AMMEngine** | `0x67118b2ff01bbadce643c87d86f7228bb2f846b8` |
| **TickBookVault** | `0xad72ba21563237ebdfbe310c052f87acb7cab0f2` |
| **LaunchpadEngine** | `0x06b0316239559ec7dd8d5299726d7ec6bb3b3d2d` |
| **MockUSDC** | `0xe35ff7794ca0f3ec55937e3806560684fdcdb74d` |

**Note:** V10.8 redeploy (2026-01-12). Added event coverage for indexer.

### Arc Testnet (chainId: 5042002) — V10.8
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0x3520983370eef2d1e417154bbeddf57f0dd5823f` |
| **Collateralizer** | `0xe9a9b730062f76f35133ad662f36d2f0db97764e` |
| **AMMEngine** | `0xc3c92b8eb4185657be969848ba14e481752d8d01` |
| **TickBookVault** | `0x751f57c504cb7311f52ccc4953e3658d2322c274` |
| **LaunchpadEngine** | `0x137ad07970322fb72c1e4d7758976b2237e3fe36` |
| **MockUSDC** | `0x2231f76e847cfdc3f1dee2197f97de2edf57fe5e` |

**Note:** V10.8 redeploy (2026-01-12). Switched to `rpc.testnet.arc.network` (drpc endpoint unstable).

### Monad Testnet (chainId: 10143) — V10.8
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0xd4090b703e171bca15dce1cce2da4c8e14ff44c1` |
| **Collateralizer** | `0x75a373de062a25178366e8fecb588547bfdfb589` |
| **AMMEngine** | `0xaa314e2370587f80b25b217ae97358e8be46d143` |
| **TickBookVault** | `0x656c7092038334a66928644df2bec755f85c32c8` |
| **LaunchpadEngine** | `0xa93305a91705b095ddeb3c82f7988b1acdf1f012` |
| **MockUSDC** | `0x374af5c5d64245a7c779c8d92f9e3c1058fb1315` |

**Note:** V10.8 redeploy (2026-01-12). Added event coverage for indexer.


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
