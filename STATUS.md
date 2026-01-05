# Project Status

## Current Focus
- **V10.0.1 DEPLOYED** — Pro-rata fill accumulator bug fixed and deployed to both testnets.
- **Frontend Updated** — All deployment addresses synced for V10.0.1.
- **Fresh Deployments** — Both testnets have new contract addresses; markets need to be created.

## Recent Changes (Last 5 Sessions)
- **2026-01-05** — **V10.0.1 Deployed**: Full redeployment to Base Sepolia and Monad Testnet with pro-rata accumulator fix. All 10 V10 forge tests pass.
- **2026-01-05** — **V9.9.8-fix: Pro-rata Accumulator Bug**: Fixed fill growth denominator using `oppTotalLiq` instead of `oppLiqInOverlap`. Prevents orders showing 99% filled when only small crossings occurred.
- **2026-01-05** — **Frontend Fixes**: Fixed hybrid sell (now splits spot + short correctly), fixed `calculateMaxCost` for range orders (uses correct bounds per outcome), removed failing publicnode RPC.
- **2026-01-05** — **CLI Enhancements**: Added `claimspotsell`, `hybridsell` commands. Added spot/hybrid sell to simulate. Increased batch claim limit to 50.
- **2026-01-05** — **V10 Audit & Cleanup**: Removed historical `TickBookPoolManagerV996.sol` and legacy V9 tests. Renamed CLI variables (`keyV996` → `keyV10`) for consistency.
- **2026-01-05** — V10 Unified Crossing: Created `TickBookPoolManagerV10.sol` with dual-collateral architecture. Spot fills first, then range. See ADR-073.
- **2026-01-05** — V9.9.8 Bug Fixes: Fixed `cancelSpotSell` double-credit vulnerability (proceeds zeroed before credit), indexer tick liquidity on cancel, MarketRegistered ABI mismatch.
- **2026-01-05** — V9.9.7 Spot Sell: Added `placeSpotSell`, `cancelSpotSell`, `buyFromSpotSell` to contract. Frontend Pro.tsx updated to use spot sell for users with existing shares.
- **2026-01-04** — Pro Page Order Management: Simplified order actions (Cancel/Claim), always use RPC for fill tracking, added `batchCancelOrders` to contract.

## Pending/Blocked
- **Create Test Markets** — Fresh V10.0.1 deployments need new markets created via CLI.
- **Basescan Verification** — Contract verification on Base Sepolia.
- **Test Suite Cleanup** — V9 tests reference removed `ILockCallback` interface (hook system removed in V9.9.4).
- **Arc Testnet RPC** — Deployment failed due to RPC chain ID issue.

## Known Issues
- ~~**429 Rate Limiting** — Pro page flooding RPC with parallel metadata requests (Fixed via batching + conditional indexer fallback).~~
- **Arc Testnet Event Polling** — 400 Bad Request on high-frequency `useWatchContractEvent` (Mitigated by disabling on ID 10143).
- **Recent Trades Empty** — Indexer `/trades` endpoint returns `[]` (no `MarketOrderExecuted` events indexed yet on Base Sepolia).
- **⚠️ Fractured Liquidity (V9.9.8)** — Spot Sells are NOT crossed by standard `placeOrder()`. Buyers must explicitly call `buyFromSpotSell()`. Frontend routing required. See ADR-072. **Fix planned: V10 unified crossing.**

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
- `apps/web/src/config/abis/TickBookPoolManagerV996.json`

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

### Base Sepolia (chainId: 84532) — V10.0.1
| Contract | Address |
|----------|---------|
| **TickBookPoolManager (V10)** | `0x62391e82b1ea1b93e2107dc2873627d6466c0ec0` |
| **Collateralizer** | `0x86aee68ce1107e9e549a6ba3cb1e77d7a9084839` |
| **AMMEngine** | `0xd16397ebdc46956f7e4fccb2e84b7f82457f4101` |
| **TickBookVault** | `0x4cf56f234427c358cf21b64e3d3bbf4512e8f028` |
| **LaunchpadEngine** | `0x82093ae9a10c2b37aa022bcf332750af50aacd6c` |
| **MockUSDC** | `0x2082a7e45ae216656b13c834fcde2ac00a869055` |

**Note:** V10.0.1 deployment (2026-01-05). **Pro-rata accumulator fix** — uses `oppTotalLiq` as denominator.

### Monad Testnet (chainId: 10143) — V10.0.1
| Contract | Address |
|----------|---------|
| **TickBookPoolManager (V10)** | `0x83fec84e171b71649f06103cdbe4af3fd2e49722` |
| **Collateralizer** | `0xd8729aab3ec111877c013d04b77781f5a33c5246` |
| **AMMEngine** | `0x03eb09e3ed8b2e0f959797f94ff023b384bd0434` |
| **TickBookVault** | `0x171c806394ba71d4e0e142750b2c866f1e44f3b8` |
| **LaunchpadEngine** | `0xa9250a287d5c8c106a4c6776ae2a55d6554f737d` |
| **MockUSDC** | `0xbebab685d544fcb1b74757b8a533ce917de08c4a` |

**Note:** V10.0.1 deployment (2026-01-05). **Pro-rata accumulator fix** — uses `oppTotalLiq` as denominator.


---

## Package Structure (2026-01-01)

### contracts-core (Audit Scope)
```
packages/contracts-core/
├── src/                 # Core contracts (audit scope)
├── script/              # 1_DeployCore, deploy-multichain, verify
├── deployments/         # v9-baseSepolia.json, v9-monadTestnet.json
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

## Recent Improvements (2026-01-01)

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

**Fix**: Changed formula from `volumeNeeded * 4 / (3 * numTrades)` to `volumeNeeded * 8 / (3 * numTrades)` to account for:
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
- [ ] **Redeploy V9.9.6-fix2** — User orders cleanup fix needs deployment to both testnets
- [ ] **Create test markets** — Fresh deployment needs new markets

### High Priority
- [x] ~~**Pro Page Orderbook**~~ — Now shows all orders via `useAllOrdersDirect` hook
- [ ] **Test graduate command** — Verify trade size calculation works (currently ~70% progress on 4 trades)

### Medium Priority
- [x] ~~**CLI Deposit Bug**~~ — Fixed MockUSDC decimal conversion in simulate command
- [x] ~~**Autoclaim Integration**~~ — Now built into `placeOrder()` via `_autoClaimUserOrders()`
- [x] ~~**BPS Bug Fixes**~~ — Fixed in markets list and graduate command
- [x] ~~**Collateralizer Error**~~ — Pre-graduation markets now handled gracefully
- [ ] **Contract Verification** — Verify on Basescan
- [ ] **Integrate useOnChainMarkets** — Replace static config in market pages

### Interactive CLI Next Steps
- [ ] **Tune graduate trade sizes** — Current formula gets ~70% progress; may need more iterations
- [ ] **Custom market template** — Allow user to specify question/name/symbol
- [ ] **Scenario library** — Add more YAML scenarios for automated testing

### Known Issues
- Graduate command with 4 trades reaches ~70% progress instead of 100% (LMSR price impact varies)
- Both testnets have empty markets array (fresh deployment)

---

## Critical Bug Fix (2026-01-01)

### V9.9.6 Active Liquidity Underflow

**Symptom**: First several trades succeed, then one fails with "arithmetic underflow or overflow", and ALL subsequent trades fail.

**Root Cause**: In `_fill()` function, lines 613, 664, 667 had unsafe type casts:
```solidity
// BEFORE (buggy)
activeLiq = uint128(int128(activeLiq) + delta);
```

When crossing tick boundaries, `delta` (from `liquidityNet`) could be negative. If `|delta| > activeLiq`, the result becomes negative, and casting to `uint128` causes panic.

**Fix**: Added `_safeAddLiquidity()` helper that clamps to 0:
```solidity
function _safeAddLiquidity(uint128 liq, int128 delta) internal pure returns (uint128) {
    if (delta >= 0) {
        return liq + uint128(delta);
    } else {
        uint128 absDelta = uint128(-delta);
        return liq >= absDelta ? liq - absDelta : 0;
    }
}
```

**Files Changed**:
- `packages/contracts-core/src/TickBookPoolManagerV996.sol`:
  - Added `_safeSubLiquidity()` helper (lines 695-703)
  - Fixed `_updateActiveLiquidity()` (lines 755, 761)
  - Fixed `_tryCross()` (lines 851, 853, 859, 861)
  - Original `_safeAddLiquidity()` fix for `_fill()` (lines 613, 664, 667)

**Regression Tests Added**:
- `packages/contracts-testing/test/v9/ActiveLiquidityUnderflow.t.sol` (8 tests)

**Action Required**: Redeploy TickBookPoolManager to both testnets.

*Last updated: 2026-01-02*
