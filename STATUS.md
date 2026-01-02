# Project Status

> Last Updated: 2026-01-02 (V9.9.6-fix6 Crossing Logic Fix)

- **✅ V9.9.6-fix6 DEPLOYED** — Fixed crossing logic for YES/NO price inversion (`YES_tick + NO_tick >= 1000`)
- **✅ V9.9.6-fix4 DEPLOYED** — Added `getAllMarketOrders()` for reliable order enumeration + array iteration fix
- **✅ V9.9.6-fix3 DEPLOYED** — Fixed array iteration in `_autoClaimUserOrders()` (iterate backwards)
- **✅ V9.9.6-fix2 DEPLOYED** — User orders array cleanup with swap-and-pop removal
- **✅ V9.9.6-fix1 DEPLOYED** — Active liquidity underflow fixed with `_safeSubLiquidity()` helper
- **✅ PRO PAGE ORDERBOOK** — Now shows ALL orders via `getAllMarketOrders()` contract call
- **✅ CLI DEPOSIT FIX** — Fixed MockUSDC decimal conversion (18 decimals, not 6)
- **✅ V9.9.6 COMPLETE** — Unified `placeOrder()` API replaces `placeRangeOrder()` + `executeMarketOrder()`
- **✅ FE HOOKS READY** — `usePlaceOrder` hook with helpers (marketOrder, limitOrder, rangeOrder, marketWithFloor)
- **✅ AUTO-CLAIM** — `_autoClaimUserOrders()` claims pending fills before placing new order
- **✅ TESTS PASSING** — 138/138 tests pass
- **✅ INTERACTIVE CLI** — Full market lifecycle from CLI (create, graduate, orderbook)
- **✅ PACKAGE SPLIT COMPLETE** — `contracts-evm` split into `contracts-core` + `contracts-testing`
- **✅ ON-CHAIN MARKET DISCOVERY** — `getMarkets()` + `useOnChainMarkets` hook
- **✅ UI INTEGRATION** — Pro and Trade pages now use dynamic on-chain discovery and the Unified Order API.

## V9.9.6 Bug Fixes Summary (2026-01-02)

| Fix | Issue | Solution |
|-----|-------|----------|
| **fix1** | Active liquidity underflow during tick crossing | Added `_safeSubLiquidity()` helper |
| **fix2** | Gas bloat from inactive orders in `_userOrders` | Swap-and-pop removal via `_removeFromUserOrders()` |
| **fix3** | Array index out of bounds in `_autoClaimUserOrders` | Iterate backwards for safe removal during iteration |
| **fix4** | Liquidity map not showing all orders (RPC limits) | Added `getAllMarketOrders()` view function |
| **fix6** | Orders not crossing when they should | Fixed price inversion: `YES_tick + NO_tick >= 1000` |

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

### Base Sepolia (chainId: 84532) — V9.9.6-fix6
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0xb4a77Ab4fDEC30700995D3346fC1a162279A0566` |
| **Collateralizer** | `0xf3Fc386c0a91008d7f146ECf0A1561bc07838Ac7` |
| **AMMEngine** | `0xa63de337ff85dD91AcDA67bB34b14eD92cDd9147` |
| **TickBookVault** | `0xc0e3838F3F7711cAb4B743E4835fBE0Ee7F3E0BA` |
| **LaunchpadEngine** | `0xB570328998765BF38ea763dba0297a4c4280f96d` |
| **MockUSDC** | `0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3` |

**Note:** Fresh deployment with all bug fixes. No markets created yet.

### Monad Testnet (chainId: 10143) — V9.9.6-fix6
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0x98fD568E84FB0f45d3c2Ed98814FFCd63264aB8a` |
| **Collateralizer** | `0xC17ed89b96ED8c207e7466B4ff5A440814bb0DDD` |
| **AMMEngine** | `0x3c8fE010E362e7C204135a90feBF5b68B9352c0d` |
| **TickBookVault** | `0xdDD1DD7E2C12Fc66983D6a38E133203a6f663a6A` |
| **LaunchpadEngine** | `0x9331b4aB6e6CCCCc6Be5aB396764ce2a6a8Ee796` |
| **MockUSDC** | `0x7192f46FA78e7d1b5BB6BA687D15d0b6A0802dA3` |

**Note:** Fresh deployment with all bug fixes. No markets created yet.

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
