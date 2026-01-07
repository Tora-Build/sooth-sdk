# Project Status

## Current Focus
- **V10.6 DEPLOYED TO ALL CHAINS (2026-01-07)** — Dust order visibility fix complete. All 3 testnets now on V10.6.
- **Market Orders Disabled (FE)** — Current "market" path is a full-range order + `maxCost` and can rest; hidden until sweep semantics are implemented.

## Recent Changes (Last 5 Sessions)
- **2026-01-07** — **V10.6 Arc Testnet Deploy**: Completed V10.6 deployment to Arc Testnet. All 3 chains now on V10.6.
- **2026-01-07** — **V10.6 Dust Order Fix**: Orders with <1000 wei unfilled now stay `active=true` (visible) instead of disappearing. Liquidity removed from book but order remains claimable. Deployed to Base Sepolia + Monad. Indexer updated with new addresses.
- **2026-01-07** — **FE Order Actions UX**: Both Cancel + Claim buttons now always visible with disabled states when not applicable. Unified button positions across all order types.
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
- **Basescan Verification** — Contract verification on Base Sepolia.
- **Market Order Semantics** — Decide/implement true sweep behavior (shares- or budget-based) before re-enabling FE Market.

## Known Issues
- ~~**429 Rate Limiting** — Pro page flooding RPC with parallel metadata requests (Fixed via batching + conditional indexer fallback).~~
- **Arc Testnet Event Polling** — 400 Bad Request on high-frequency `useWatchContractEvent` (Mitigated by disabling on ID 10143).
- **Recent Trades Empty** — Indexer `/trades` endpoint returns `[]` (no `MarketOrderExecuted` events indexed yet on Base Sepolia).
- **⚠️ Market Order Semantics (V10)** — Current implementation uses full-range order + overlap-based crossing; it is not a guaranteed book sweep.
- ~~**Fractured Liquidity (V9.9.8)** — Spot Sells not crossed by `placeOrder()`.~~ **Resolved in V10** via unified crossing (ADR-073).

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

### Base Sepolia (chainId: 84532) — V10.6
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0x1b6c55c70ae4dafdc8cda646af83bb3554dac388` |
| **Collateralizer** | `0x1971f1135bef978393f7e736082844bb907e9545` |
| **AMMEngine** | `0x088c0a1b703ef8380b3ca4e7c51aa1d0f89a1eaf` |
| **TickBookVault** | `0x576020da46e4c2be45d6c722b3670e02fb9bb217` |
| **LaunchpadEngine** | `0xb9663ede9c60d4a173b7ae777d097e86e078bca4` |
| **MockUSDC** | `0x9f5d25d19595e9df513a3172c778174df18bd105` |

**Note:** V10.6 deployment (2026-01-07). Dust order visibility fix.

### Arc Testnet (chainId: 5042002) — V10.6
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0xCb209Aa0E77A68378626e3f1d5136A0A5aa18B68` |
| **Collateralizer** | `0x1D9A2B863c650e04DDdF5893FfbD2f31F87e8C6f` |
| **AMMEngine** | `0xAC8F9866FCB0406856443df4C3D1F065357077dd` |
| **TickBookVault** | `0x536D85d924848776995429C9769b5DA12478819b` |
| **LaunchpadEngine** | `0x63215FA8716417FC805A705a7d7608abF8260598` |
| **MockUSDC** | `0xec165cDc464cD689732a550776a19c960386329c` |

**Note:** V10.6 deployment (2026-01-07). Dust order visibility fix. Arc uses USDC as native gas token.

### Monad Testnet (chainId: 10143) — V10.6
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0xc0768a0be30662cd15e7ff4bd79ae8a110681ae0` |
| **Collateralizer** | `0x06b1a993347e188a923b7e0c85f77ed7d83cced5` |
| **AMMEngine** | `0x01ba0503fdbe582d78e49f135aed1a175c788add` |
| **TickBookVault** | `0x557747e57a465c261a56ddbc7e7df8a331f7e093` |
| **LaunchpadEngine** | `0xbd20f66effc9a0d908283871d546de0b6e3d160e` |
| **MockUSDC** | `0xd9e25839396b7393fb79c620c8ee05bdbdab5789` |

**Note:** V10.6 deployment (2026-01-07). Dust order visibility fix.


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

*Last updated: 2026-01-07*
