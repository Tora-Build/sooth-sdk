# Project Status

> Last Updated: 2026-01-01 (V9.9.6 Unified Order API + FE Integration Prep)

- **✅ V9.9.6 COMPLETE** — Unified `placeOrder()` API replaces `placeRangeOrder()` + `executeMarketOrder()`
- **✅ FE HOOKS READY** — `usePlaceOrder` hook with helpers (marketOrder, limitOrder, rangeOrder, marketWithFloor)
- **✅ AUTO-CLAIM** — `_autoClaimUserOrders()` claims pending fills before placing new order
- **✅ TESTS PASSING** — 130/130 tests pass (11 new V9.9.6 tests)
- **✅ INTERACTIVE CLI** — Full market lifecycle from CLI (create, graduate, orderbook)
- **✅ PACKAGE SPLIT COMPLETE** — `contracts-evm` split into `contracts-core` + `contracts-testing`

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
- **New ABI**: `V996_ABIS.TickBookPoolManager` for V9.9.6 contracts
- **Utilities**: `orderUtils.percentToTick()`, `orderUtils.parseShares()`, etc.

### Files Added
- `packages/contracts-core/src/TickBookPoolManagerV996.sol`
- `packages/contracts-testing/test/v9/UnifiedOrderSystem.t.sol`
- `apps/web/src/hooks/usePlaceOrder.ts`
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

### Base Sepolia (chainId: 84532) — V9.9.5 LEAN
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0x4EA452bc10880ab0bE3673C2dE076C9d3351b516` (LEAN - no hooks) |
| **Collateralizer** | `0x1C146C1e79c6C20afdb90eDb13D0eAa11C412557` |
| **AMMEngine** | `0x76Dc341A2635439Afb503bFE57316ebcb7580B3C` |
| **TickBookVault** | `0x8EDc4d249F373Acaa9a4523BA234eEDb9e6E6ab2` |
| **LaunchpadEngine** | `0x4Ec2FD4c6a8584976c1e032624574E9ecba28D11` |
| **MockUSDC** | `0x0c31bbb6da82ba97fbafbe3425ee8757a4d724e3` |

**Test Markets:**
- **ALIEN** (UN Confirms Alien Life): `0xfc43d6Be9B988a0b06DCb6F14b6741D353ADE5e1`
- **BTC100K** (BTC TWAP >= $100k): `0x45FdB4e8b8E38cD9b8B587B4334af71986c2Af78`

### Monad Testnet (chainId: 10143) — V9.9.4 (Pending V9.9.5 Upgrade)
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0xd209a3db4bb3a65da69001313e75f3309888e52f` |
| **Collateralizer** | `0xc620770047e6710d2539bc6aa46de9be458207a7` |

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
├── test/                # All V9 tests (119 passing)
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

## Pending Work

### High Priority
- [ ] **Deploy V9.9.6 to Base Sepolia** — New unified order API ready
- [ ] **Update Pro.tsx** — Replace `executeMarketOrder`/`placeRangeOrder` with `placeOrder`
- [ ] **Deploy V9.9.5 to Monad** — When RPC stabilizes

### Medium Priority
- [x] ~~**Autoclaim Integration**~~ — Now built into `placeOrder()` via `_autoClaimUserOrders()`
- [ ] **Contract Verification** — Verify on Basescan
- [ ] **Test New Deployment Workflow** — Verify 1_DeployCore + 2_CreateMarket on fresh deployment

### Interactive CLI Next Steps
- [ ] **Test graduate command** — Verify full graduation flow works end-to-end
- [ ] **Custom market template** — Allow user to specify question/name/symbol
- [ ] **Scenario library** — Add more YAML scenarios for automated testing

*Last updated: 2026-01-01*
