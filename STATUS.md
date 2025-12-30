# Project Status

> Last Updated: 2025-12-30 18:05 (V9 Monad Testnet Deployment)

- **✅ MONAD TESTNET V9 DEPLOYED** — Fresh Singleton (PoolManager/Vault) architecture
- **✅ GRADUATION SUCCESS** — BTC100K graduated via 5M gas tradePositions
- **✅ V9 SINGLETON SYNC** — Aligned Monad Testnet with Base Sepolia architecture
- **✅ V9.6.0 CONSOLIDATION** — Unified multichain script for parallel Singleton deployments

## 🆕 V9 Monad Testnet Deployment (2025-12-30)

### Deployment Summary
- **Date**: 2025-12-30T18:00:00+07:00
- **Network**: Monad Testnet (Chain ID: 10143)
- **Deployer**: `0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F`

### V9 Deployed Addresses (Monad Testnet)
| Contract | Address |
|----------|---------|
| **MockUSDC** | `0x7192f46fa78e7d1b5bb6ba687d15d0b6a0802da3` |
| **Collateralizer** | `0xc620770047e6710d2539bc6aa46de9be458207a7` |
| **AMMEngine** | `0xc83a0fad313d9174ebdb6201c5d115e5773e4d80` |
| **TickBookVault** | `0x7996195bf20d84b51e28ba8f44f6fc85a4cf59b7` |
| **TickBookPoolManager** | `0xd209a3db4bb3a65da69001313e75f3309888e52f` |
| **LaunchpadEngine** | `0xfc439a4bd763900cc544154e74258721f4a2bbbb` |
| **ALIEN Market** | `0x2bf18f49f45aca269d2d5926930721f45ce3ab82` |
| **BTC100K Market** | `0xfbbf90f4f36c18b2baae752bafb44c3cb98239a7` |

---

## Session Work (2025-12-30 ~17:00 - 18:05)

### Completed This Session
1. **✅ Monad Graduation Investigation** — Identified `OutOfGas` was due to "zombie" `TickBook` address (no code).
2. **✅ V9 Multichain Script Upgrade** — Rewrote `deploy-multichain.ts` to support V9 Singleton stack.
3. **✅ Monad Testnet Migration** — Redeployed full V9 stack to Monad with linked Vault/Manager.
4. **✅ Graduation Gas Solved** — Successfully graduated BTC market with **5,000,000 gas limit** for graduation TX.
5. **✅ Frontend Synchronization** — Updated `deployments.json` and `markets.json` with fresh V9 state.

---

## Test Suites
| Suite | Tests | Coverage |
|-------|-------|----------|
| TickBookPoolManager.t.sol | 22 | Core ops |
| TickBookVaultSettlement.t.sol | 13 | Redemption |
| V9Fuzz.t.sol | 10 | Edge cases |
| V9Invariants.t.sol | 4 | Solvency/state |
| TruthMarketLifecycle.t.sol | 32 | Full lifecycle |
| HookCallbacks.t.sol | 18 | Hook system |
| **Total** | **99+** | ✅ All passing |

---

## Pending Work (Next Session)
- [x] **Sync Frontend Deployments** — Updated `apps/web/src/config/deployments.json` and `markets.json`.
- [ ] **Verify singleton logic** — Confirm limit orders work on Monad with the new `PoolManager`.
- [ ] **HFT Benchmark** — Run `npx ts-node script/hft-benchmark.ts` on V9 Monad.

## Known Issues
- Previous "V8" markets on Monad are now deprecated/orphaned.
- MockUSDC decimals unified to 18 across all testnets for consistent LMSR math.

---

*Last updated: 2025-12-30 18:05 (V9.6.0)*
