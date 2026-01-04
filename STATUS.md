# Project Status

## Current Focus
- **Indexer Integration Complete** — Ponder indexer fully integrated with frontend, serving orders/orderbook/trades via REST API.
- **RPC Rate Limiting Solved** — Added batching and conditional fallback to eliminate 429 errors.

## Recent Changes (Last 5 Sessions)
- **2026-01-04** — Indexer Frontend Integration: Fixed conditional RPC fallback, added indexed orders for LiquidityMap, filtered inactive orders from API.
- **2026-01-04** — RPC Optimization: Added HTTP batching to Base Sepolia transport, fixed 429 rate limiting.
- **2026-01-04** — V9.9.6-fix9l Recovery: Restored correct TickBookPoolManager with unified `placeOrder()` API + `getAllMarketOrders()`. Redeployed to Base Sepolia.
- **2026-01-04** — Ponder Indexer: Full indexer setup with per-chain readiness, REST API endpoints for orders/orderbook/trades.
- **2026-01-03** — Launchpad Redesign Complete: Single-page UI, earnings simulator, and Brevis registry.

## Pending/Blocked
- **Basescan Verification** — Contract verification for V9.9.6-fix9 series on Base Sepolia.
- **Monad/Arc Liquidity** — Creating fresh test markets on new deployments.

## Known Issues
- ~~**429 Rate Limiting** — Pro page flooding RPC with parallel metadata requests (Fixed via batching + conditional indexer fallback).~~
- **Arc Testnet Event Polling** — 400 Bad Request on high-frequency `useWatchContractEvent` (Mitigated by disabling on ID 10143).
- **Recent Trades Empty** — Indexer `/trades` endpoint returns `[]` (no `MarketOrderExecuted` events indexed yet on Base Sepolia).

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

### Base Sepolia (chainId: 84532) — V9.9.6-fix9l
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0xa613fe3F71fCa0913964E8f9c8b4e3f0320fC060` |
| **Collateralizer** | `0xE1976fDF7fDe2a2F933a7860326Ed12121358e79` |
| **AMMEngine** | `0xf50A729Df4078812edffe9355b73ABF916973629` |
| **TickBookVault** | `0x6109B9C9FdD88842da3b49E7cb3DE04F21E083dc` |
| **LaunchpadEngine** | `0x3530A1e0519E6e81b5a41074bf253E56757fefF6` |
| **MockUSDC** | `0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3` |

**Note:** V9.9.6-fix9l deployment (2026-01-04). Includes `getAllMarketOrders()`, unified `placeOrder()` API, auto-claim, stress-tested.

### Monad Testnet (chainId: 10143) — V9.9.6-fix9d
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0xd4ff5b639b05c581a93d3e925656f58c269440f4` |
| **Collateralizer** | `0x8850a38d4ff466e8bdd3de1825694b81df5c2b53` |
| **AMMEngine** | `0x54b51215d6e70def99c68f84e11f9b6245d92b15` |
| **TickBookVault** | `0xa31fd66ad0c593364bb579bfeb1bb61b73e56de3` |
| **LaunchpadEngine** | `0x044dfcbf8b16fee5e8b4f39bf3c26adff1ae6159` |
| **MockUSDC** | `0x7192f46FA78e7d1b5BB6BA687D15d0b6A0802dA3` |

**Note:** Fresh fix9d deployment. No markets created yet.


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
├── test/                # All V9 tests (138 passing)
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
