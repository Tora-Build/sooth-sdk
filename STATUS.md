# Project Status

## Current Focus
- **V9.9.8 Ready** — Critical bug fixes applied to V9.9.7 spot sell, needs redeployment.
- **Pro Page Order Management Fixed** — Order actions simplified (Cancel/Claim), fill tracking uses RPC-only.
- **No Markets Yet** — Fresh deployment needs markets created via CLI or Launchpad.

## Recent Changes (Last 5 Sessions)
- **2026-01-05** — V9.9.8 Bug Fixes: Fixed `cancelSpotSell` double-credit vulnerability (proceeds zeroed before credit), indexer tick liquidity on cancel, MarketRegistered ABI mismatch.
- **2026-01-05** — V9.9.7 Spot Sell: Added `placeSpotSell`, `cancelSpotSell`, `buyFromSpotSell` to contract. Frontend Pro.tsx updated to use spot sell for users with existing shares.
- **2026-01-04** — Pro Page Order Management: Simplified order actions (Cancel/Claim), always use RPC for fill tracking, added `batchCancelOrders` to contract.
- **2026-01-04** — Indexer Frontend Integration: Fixed conditional RPC fallback, added indexed orders for LiquidityMap, filtered inactive orders from API.
- **2026-01-04** — RPC Optimization: Added HTTP batching to Base Sepolia transport, fixed 429 rate limiting.
- **2026-01-04** — V9.9.6-fix9l Recovery: Restored correct TickBookPoolManager with unified `placeOrder()` API + `getAllMarketOrders()`. Redeployed to Base Sepolia.

## Pending/Blocked
- **Redeploy V9.9.8** — Critical `cancelSpotSell` double-credit fix needs deployment to Base Sepolia and Monad Testnet.
- **Create Test Markets** — Fresh deployment needs markets created via CLI or Launchpad.
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

### Base Sepolia (chainId: 84532) — V9.9.7
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0x32c228f558eca71a1aab8663162b4b4bf87bdd1a` |
| **Collateralizer** | `0x34542cddbfb9294e753f99e2417633f9c4c8a54d` |
| **AMMEngine** | `0xd4311bb4febe5cbaf9d6fe75ce00c448e972f681` |
| **TickBookVault** | `0xb4e467e35767f8efc3bff5117e1631b81beb204d` |
| **LaunchpadEngine** | `0x0539fddb35529d6d8e81355e7fb278bf273595b5` |
| **MockUSDC** | `0xd4832b4738e0b9ac4dc7b4e1f032a903e3051cbc` |

**Note:** V9.9.7 deployment (2026-01-05). Includes spot sell (`placeSpotSell`, `cancelSpotSell`, `buyFromSpotSell`), `batchCancelOrders`, unified `placeOrder()` API.

### Monad Testnet (chainId: 10143) — V9.9.7
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0xc80c8b4c56a62614d9408b805b40580dd9420361` |
| **Collateralizer** | `0xd7c843926622c59a3c85d35d6628caa369262778` |
| **AMMEngine** | `0xb3c313e3973761cd5a7862db494492ecba38871e` |
| **TickBookVault** | `0xea8438f6871a733e35de08b15015b404d6c8b234` |
| **LaunchpadEngine** | `0x07073c1fe986b3321f811f450b9f19703b08feec` |
| **MockUSDC** | `0x6427a20feb8289e325916bd60f5efd191ce3e7a1` |

**Note:** V9.9.7 deployment (2026-01-05). Includes spot sell + batchCancelOrders.


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
