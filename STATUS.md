# Project Status

> Last Updated: 2026-01-01 (Package Split + V9.9.5 LEAN)

- **✅ PACKAGE SPLIT COMPLETE** — `contracts-evm` split into `contracts-core` + `contracts-testing`
- **✅ V9.9.5 LEAN DEPLOYED** — Fill overflow fixes + hook removal live on Base Sepolia
- **✅ FE SYNCED** — Deployment configs updated
- **✅ TESTS PASSING** — 119/119 tests pass in contracts-testing
- **✅ DEPLOYMENT WORKFLOW** — Clean 2-step deployment scripts created

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
- [ ] **Deploy V9.9.5 to Monad** — When RPC stabilizes
- [ ] **Test New Deployment Workflow** — Verify 1_DeployCore + 2_CreateMarket on fresh deployment

### Medium Priority
- [ ] **Autoclaim Integration** — Call `batchClaimFills` before new orders
- [ ] **Contract Verification** — Verify on Basescan

*Last updated: 2026-01-01*
