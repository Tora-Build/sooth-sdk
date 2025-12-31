# Project Status

> Last Updated: 2025-12-31 (V9.9.5 Ready)

- **🔧 V9.9.5 READY** — Contract fixes for fill overflow and order lifecycle
- **✅ FE SYNCED** — Deployment configs synced from v9-*.json source of truth
- **✅ TESTS PASSING** — 40/40 TickBook tests pass

## 🆕 V9.9.5 Changes (Pending Deployment)

### Bug Fixes
- **Fill Overflow**: Q128 accumulator math could cause `filledShares > sharesTotal` (~0.1% drift)
- **Phantom Orders**: Fully-filled orders remained "active" with dust liquidity
- **Double Subtraction Risk**: Multiple cleanup paths could double-subtract liquidity

### Solution
- Added `liquidityRemoved` flag to `RangeOrder` struct for idempotent cleanup
- Cap `filledShares` at `sharesTotal` in `claimFills()`
- Auto-complete orders when fully filled (removes tick liquidity, sets `active=false`)
- All three cleanup paths (crossing, claimFills, cancel) now check flag before removing

### Frontend Fixes
- Cap displayed fill at total in Pro.tsx (UI safeguard)
- Created `sync-v9-deployments.js` script for config synchronization

---

## Current Deployments

### Base Sepolia (chainId: 84532)
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0xbc0e25537871f6f0e13d130a3e23278c8b85228d` |
| **Collateralizer** | `0x38e517f3c4038c4d0a82366c20fccd866e1b425e` |
| **AMMEngine** | `0x5585b0cd8e4bef7c8593feee5bf70d58cf0e6e95` |
| **TickBookVault** | `0xa9635bed172fdd0cb83320e29b245522d059fad4` |
| **LaunchpadEngine** | `0x50ca13818849f268589511a809564ede77c453f6` |
| **MockUSDC** | `0x0c31bbb6da82ba97fbafbe3425ee8757a4d724e3` |

### Monad Testnet (chainId: 10143)
| Contract | Address |
|----------|---------|
| **TickBookPoolManager** | `0xd209a3db4bb3a65da69001313e75f3309888e52f` |
| **Collateralizer** | `0xc620770047e6710d2539bc6aa46de9be458207a7` |

---

## Pending Work

### High Priority
- [ ] **Deploy V9.9.5** — New TickBookPoolManager with fill overflow fix
- [ ] **Re-register Markets** — Markets need re-registration after PoolManager upgrade

### Medium Priority
- [ ] **Monitor Monad** — Deploy V9.9.5 to Monad when RPC stabilizes
- [ ] **Autoclaim Integration** — Call `batchClaimFills` before new orders

*Last updated: 2025-12-31*
