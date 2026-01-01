# Project Status

> Last Updated: 2026-01-01 (V9.9.5 LEAN + New Deployment Workflow)

- **✅ V9.9.5 LEAN DEPLOYED** — Fill overflow fixes + hook removal live on Base Sepolia
- **✅ FE SYNCED** — Deployment configs updated
- **✅ TESTS PASSING** — 40/40 TickBook tests pass
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

## Recent Improvements (2026-01-01)

### New Deployment Workflow
Created clean separation between core infrastructure and market operations:

**STEP 1**: [1_DeployCore.s.sol](packages/contracts-evm/script/1_DeployCore.s.sol)
- Deploys 5 core contracts (Collateralizer, AMMEngine, TickBookVault, PoolManager, LaunchpadEngine)
- Links components (vault→poolManager, ammEngine→launchpad router)
- Prints clear next steps and environment variable setup

**STEP 2**: [2_CreateMarket.s.sol](packages/contracts-evm/script/2_CreateMarket.s.sol)
- Complete market creation workflow in correct order:
  1. Deploy TruthMarket contract
  2. Activate market
  3. Register with Collateralizer (creates outcome tokens)
  4. Initialize in LaunchpadEngine (creates AMM pool)
- Configurable via constants (QUESTION, NAME, SYMBOL, DEADLINE_DAYS, INITIAL_LIQUIDITY)
- Validates USDC balance requirements
- Outputs formatted JSON for markets.json

**Why**: Previous deployment attempts silently failed because markets weren't registered with Collateralizer before AMM initialization. New workflow ensures correct order.

---

## Pending Work

### High Priority
- [ ] **Oracle → Adjudicator Terminology** — Replace "Oracle" with "adjudicator" across codebase
- [ ] **Deploy V9.9.5 to Monad** — When RPC stabilizes
- [ ] **Test New Deployment Workflow** — Verify 1_DeployCore + 2_CreateMarket on fresh deployment

### Medium Priority
- [ ] **Autoclaim Integration** — Call `batchClaimFills` before new orders
- [ ] **Contract Verification** — Verify on Basescan

*Last updated: 2026-01-01*
