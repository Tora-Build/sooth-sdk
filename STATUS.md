# Project Status

> Last Updated: 2025-12-30 (V9.4.0 Fresh Deployment)

- **✅ V9.4.0 DEPLOYED** — Fresh deployment with TickBook registrar access control
- **✅ REGISTRAR ACCESS CONTROL** — Only LaunchpadEngine (or owner) can register markets in TickBook
- **✅ FRONTEND GRADUATION GUARD** — Non-graduated markets show "Pro Trading Locked" screen
- **✅ V9.1.0 SELL-SIDE FEES** — Implemented proper sell-side fee deduction
- **✅ V9.0 QA COMPLETE** — 99 tests passing with 83% TickBookPoolManager coverage
- **🔧 GRADUATION GAS FIX** — Frontend now uses 2M gas for trades >50% graduation progress
- **🔧 USER ORDERS FIX** — Added getUserOrders() to contract + event fallback in frontend

## 🆕 V9.4.0 Fresh Deployment (2025-12-30)

### Deployment Summary
- **Date**: 2025-12-30T00:22:47+07:00
- **Network**: Base Sepolia (Chain ID: 84532)
- **Gas Used**: ~16.8M gas (~0.00002 ETH)
- **Deployer**: `0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F`

### V9.4.0 Deployed Addresses (Base Sepolia)
| Contract | Address |
|----------|---------|
| **MockUSDC** | `0x856FbEebD91Db28e3b4550e7602142Cfab683796` |
| **Collateralizer** | `0xec9dce70520656250E92Fd0e11cF2b52C0E82F99` |
| **AMMEngine** | `0x0C7D8A35D15D8f471acF3C6d5d18983033C73660` |
| **TickBookVault** | `0x9733E1641DEEF3cC810F8635697288C36a8ff966` |
| **TickBookPoolManager** | `0x36beA8f418B32387e88E44510d09944b681b8E67` |
| **DynamicFeeHook** | `0x5930f5F266F57DE3929dA4E674341B0b069E703c` |
| **LaunchpadEngine** | `0xD44eF417a6124031DB529B14AB279A36Caeb4338` |
| **ALIEN Market** | `0x83cf7A6fE826788D04F7210E0F16a15A606FBB02` |
| **BTC100K Market** | `0x268b5b48C824598f8DE0E60fDB2d041CFBEDBCF2` |

### Flow Summary
1. Markets created via `LaunchpadEngine.createMarket()` → trade on AMM
2. Fees accumulate → graduation threshold reached
3. `LaunchpadEngine` atomically registers market in `Collateralizer` + `TickBook`
4. Pro Terminal unlocks for graduated markets

---

## Active Deployment (Base Sepolia) — V9.4.0 🔵
| Contract | Address | Status |
|----------|---------|--------|
| MockUSDC | `0x856FbEebD91Db28e3b4550e7602142Cfab683796` | ✅ OK |
| Collateralizer | `0xec9dce70520656250E92Fd0e11cF2b52C0E82F99` | ✅ V9.4 |
| AMMEngine | `0x0C7D8A35D15D8f471acF3C6d5d18983033C73660` | ✅ V9.4 |
| TickBookVault | `0x9733E1641DEEF3cC810F8635697288C36a8ff966` | ✅ V9.4 |
| TickBookPoolManager | `0x36beA8f418B32387e88E44510d09944b681b8E67` | ✅ V9.4 + Registrar |
| DynamicFeeHook | `0x5930f5F266F57DE3929dA4E674341B0b069E703c` | ✅ V9.4 |
| LaunchpadEngine | `0xD44eF417a6124031DB529B14AB279A36Caeb4338` | ✅ V9.4 (Registrar) |

### Base Sepolia V9.4 Markets
| Market | Address | Graduated | TickBook |
|--------|---------|-----------|----------|
| UN Confirms Alien Life (ALIEN) | `0x83cf7A6fE826788D04F7210E0F16a15A606FBB02` | ❌ Not yet | ❌ Pending |
| BTC TWAP >= $100k (BTC100K) | `0x268b5b48C824598f8DE0E60fDB2d041CFBEDBCF2` | ❌ Not yet | ❌ Pending |

---

## Pending Work (Next Session)
- [ ] **Redeploy TickBookPoolManager** — Add getUserOrders() function to deployed contract
- [ ] **Verify contracts on Basescan** — For transparency
- [ ] **Add more DynamicFeeHook tests** — Increase coverage from 30% to 80%+
- [ ] **Test hybrid sell flow in UI** — Validate spot/short/hybrid sell modes

## Completed This Session (2025-12-30)
- ✅ **Graduation Gas Fix** — Frontend uses 2M gas for trades >50% progress (was 80%, caused OOG)
- ✅ **Category Count Fix** — Trade page now shows correct per-category market counts
- ✅ **LP Value Display Fix** — "No active liquidity" only shows when user has no LP balance
- ✅ **User Orders Detection** — Added getUserOrders() to contract + event log fallback in frontend
- ✅ **LESSONS_LEARNED.md Updated** — Documented graduation gas fix with 50% threshold rationale

## Completed Previous Session (2025-12-29)
- ✅ **TickBook Registrar Access Control** — Contract-level graduation lock
- ✅ **Fresh V9.3.0 Deployment** — All core contracts + 2 markets
- ✅ **Frontend Graduation Guard Fix** — Removed `isTickBookLoading` dependency
- ✅ **Markets.json Token Fix** — Added missing yesToken/noToken (for previous deployment)
- ✅ **35 TickBook Tests Passing** — All tests pass with registrar changes

---

## Recent Changes

### ✅ V9.3 Registrar Access Control (2025-12-29)
- **Contract Change**: `TickBookPoolManager.registerMarket()` now requires `onlyRegistrar` modifier
- **Access Control**: Only LaunchpadEngine (set as registrar) or owner can register markets
- **Frontend Fix**: Graduation check no longer waits for TickBook loading (tokens don't exist until graduation)
- **Flow**: Markets must graduate via AMM trading before appearing in TickBook/Pro Terminal

### ✅ V9.2 TickBook Initialization Fix (2025-12-29)
- **Frontend Fix**: Hardened address normalization in `useTickBookDirect` hook
- **Market Key**: Correct market key calculation with all 4 fields (market, yesToken, noToken, hook)

### ✅ V9.1 Sell-Side Fee Fix (2025-12-29)
- **Contract Fix**: Sells now correctly deduct fees from proceeds before locking
- **API Change**: `IAMMEngine.tradePositionsFor()` now accepts `fee` parameter
- **Tests**: 12 new tests covering sell-side fee scenarios

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

## Short-Term Dev Plan (Alpha Sprint)

### 🎯 Priority 1: Graduate Markets
| Task | Description | Effort |
|------|-------------|--------|
| **Trade on AMM** | Generate fees to trigger graduation threshold | S |
| **Verify Graduation Flow** | Confirm TickBook registration happens atomically | S |
| **Test Pro Terminal** | Verify orders work after graduation | M |

### 🛡️ Priority 2: Contract Verification
| Task | Description | Effort |
|------|-------------|--------|
| **Verify on Basescan** | All V9.3 contracts | M |
| **Update ABIs** | Sync to frontend/SDK if needed | S |

### 📱 Priority 3: UI Polish
| Task | Description | Effort |
|------|-------------|--------|
| **Graduation Progress** | Show progress in Pro "Locked" screen | S |
| **Mobile Responsive** | Trading panel mobile layout | M |

---

*Last updated: 2025-12-30 (V9.4.0)*
