# Project Status

> Last Updated: 2025-12-22 (V7 Dual-Engine Sprint)

## Current Focus
- **V7 Dual-Engine Integration** — Integrating separated Orderbook/AMM architecture with Adjudicator-gated settlement. ✅
- **V6.2.7 Alpha Repository Cleanup** — Purged duplicates and legacy Solana artifacts. ✅
- **V6.2.6 UI Polish** — Markets page cleanup and metrics bug fixes. ✅

## Recent Changes

### ✅ V7 Dual-Engine Deployment (2025-12-22)
- **🚀 Fresh Stack (Base Sepolia)**:
  - Deployed full V7 infrastructure: `TraderVaultV4`, `LiquidityVault`, `FeeController`, `ProtocolConfig`, `AdjudicatorRegistry`.
  - Deployed 2 test markets: "UN Confirms Alien Life" and "BTC TWAP >= $100k".
  - Verified on-chain linkages and synced `deployments.json` and `markets.json`.
- **🛠️ Protocol Evolution**:
  - **Breaking**: Disabled `market.swap()` in favor of safe `TraderVault.depositAndTradeAMM()`.
  - **Breaking**: Replaced `market.claimUnlocked()` with `TraderVault.claimUnlocked(market)`.
  - **Adjudicator Doctrine**: Markets now settled via `SoothAdjudicatorRegistry` allowlisted contracts (Manual, Optimistic, Brevis).
  - **Lock-on-Sell**: Sellers receive proceeds in a 24h vault lock, while shares remain tradable.

### ✅ V6.2.7 Alpha Repository Cleanup (2025-12-22)
- **🗑️ Purged Artifacts**: 
  - Deleted 120+ files by removing the giant `archive/contracts-evm` duplicate snapshot and root-level `lib/`.
  - Cleaned up `packages/contracts-evm/script` and `test` from accidental duplicates and backups.
  - Removed legacy Solana configuration, dozens of unused V3/V4 ABIs, and legacy maintenance scripts.
  - Pruned dead contract logic: deleted discrete LMSR math libs, redundant `OutcomeToken`, and superseded `MarketLPVault_V5`.
- **🛠️ Maintenance**:
  - Fixed constructor mismatch bugs in 8 contract test files to restore passing `forge test` suite.
  - Pruned empty directories and unused interfaces across the monorepo to improve navigation.

## Active Deployments

### Base Sepolia (Chain 84532) - V7 Dual-Engine ✅
| Contract | Address |
|----------|---------|
| MockUSDC | `0x7B61060a98D541f7C26fbC7e215FF9753c8D2a11` |
| SoothFeeController | `0xf2b1f87fDb1fb7c447B654647F565ad1A03227c4` |
| SoothLiquidityVault | `0xc0413700c172817897C09b14b5643ee7cCFcf34b` |
| **SoothTraderVaultV4** | `0x1C70bD3b70B065ACBb5AA81053D7F1aF8CF23045` |
| ProtocolConfig | `0xEA0f15e3650AEC0c6DF89Fe8C7443EA47CD4bc88` |
| AdjudicatorRegistry | `0x4C52a6277b1B84121b3072C0c92b6Be0b7CC10F1` |
| **LaunchpadFactory (V7)** | `0x2C2AdE29b81a6B47Cdd05CcAf06cF10E30d1318C` |
| Market 1 (Alien Life) | `0xE467bDC870BC1AEa7401Cc0a3C34ABCcA2c3C64D` |
| Market 2 (BTC TWAP) | `0x5DBe9BB350407c604eDDABa86CbB59514F1A6EfD` |

### MegaETH Mainnet (Chain 4326) - Frontier Net ✅
| Contract | Address |
|----------|---------|
| MockUSDC | `0xeb33e2f815306d936d4bdd2b33b2b68c16b62fa0` |
| FeeController | `0x05818c4028ff5c273b45b3c55131af2bd9d12322` |
| LiquidityVault | `0x204760c47d4a009c353e6cf7e2d7c0b497243603` |
| TraderVaultV4 | `0x98169fffdf249b1196e4e8095f673379f3d06694` |
| ProtocolConfig | `0xc69003eec9b262dd9d5911d4d00133bc73d5f70d` |
| LaunchpadMarketImpl | `0xe73e78c4f93c79593c4e09b6d096d668ba45852f` |
| LaunchpadOutcomeTokenImpl | `0xae2aea85f34c6dab95403163bc2e457e82744196` |
| **LaunchpadFactory (V6)** | `0x347a74a7025c42be608f3bdc0b150d4ad6eb4674` |
| Market 1 (Alien Life) | `0x813F5A52d0dBD948e848b656e2415a57c5dE27B3` |
| OutcomeToken 1 | `0x44b866EAA6C7a601000Bb177436ab1E465e55883` |
| Market 2 (BTC TWAP) | `0x8E8895A78bDdFbb2C04C7b382b8a1D773811a4Df` |
| OutcomeToken 2 | `0xf6110471bC21e0958326b312aea1239F2529Ee51` |

## Short-Term Dev Plan (Alpha Sprint)

### 🎯 Priority 1: Trading UX Polish
| Task | Description | Effort |
|------|-------------|--------|
| **Price Impact Display** | Show price impact (BPS) in AmmTradingPanel quote summary | S |
| **Slippage Warning** | Yellow/red indicator when impact > 1% / 5% | S |
| **Trade Confirmation** | Summary modal before executing large trades | M |

### 🛡️ Priority 2: LP Health & Transparency
| Task | Description | Effort |
|------|-------------|--------|
| **Underwater Banner** | Red alert banner when `isUnderwater()` is true | S |
| **Realized P&L Display** | Show `lpRealizedPnL()` in Market Stats card | S |
| **LP ExRate History** | Simple chart showing ExRate over time (optional) | L |

### 📱 Priority 3: Mobile & Responsive
| Task | Description | Effort |
|------|-------------|--------|
| **Trading Panel Mobile** | Stack Buy/Sell vertically, larger touch targets | M |
| **Portfolio Mobile** | Single-column layout for position cards | M |
| **Navigation Mobile** | Collapsible nav drawer or bottom tabs | M |

### 🔬 Priority 4: QA & Stress Testing
| Task | Description | Effort |
|------|-------------|--------|
| **Orderbook Stacking** | Test 50+ orders at same price level on MegaETH | M |
| **LMSR Edge Cases** | Fuzz tests for large trades (>50% of liquidity) | M |
| **Multi-User Simulation** | 10 concurrent traders script | L |

### 🚀 Priority 5: Launch Prep
| Task | Description | Effort |
|------|-------------|--------|
| **Fresh Mainnet Deploy** | Deploy to Base/MegaETH with 5-day deadline markets | M |
| **Faucet Polish** | Auto-detect chain, show correct gas guidance | S |
| **Analytics Events** | Add basic event tracking for trades/deposits | M |

**Effort Key**: S = Small (< 2 hrs), M = Medium (2-6 hrs), L = Large (> 6 hrs)

---

## Blocked/Deferred
- **Next Floor/Ceiling in Swap UI**: Decided against — too technical for traders, doesn't add value.
- **LP ExRate History Chart**: Requires event indexing or subgraph — defer to post-alpha.

## Audit Findings (2025-12-22)

### Fixed This Session
- [x] **ABI Cleanup**: Removed `TRADER_VAULT_V3_ABI`, `SOOTH_TRADER_VAULT_ABI`, and `SOOTH_GOVERNOR_VAULT_ABI` from `abis.ts`.
- [x] **ABI Expansion**: Added missing functions to `LAUNCHPAD_MARKET_ABI` (`claimLockedOnMarketEnd`, `convertToAssets`, `convertToShares`).
- [x] **Contract Consistency**: Verified `LaunchpadMarket` implementation against `ILaunchpadMarket` interface.

### Warnings (Should Fix)
- [ ] **Legacy Test Cleanup**: `Launchpad.t.sol` is a placeholder for legacy tests. Should be moved to an archive folder.
- [ ] **TODO Resolution**: `apps/web/src/hooks/useTraderVault.ts:311` (Extract orderId from event logs).
- [ ] **TODO Resolution**: `apps/web/src/hooks/v5/useLaunchpadTradeQuote.ts:116` (Refine quoter to return next prices).

### Info (Nice to Fix)
- [ ] **Comment Clarification**: Update `SoothTraderVaultV4.sol` to clarify that `UserAccount.pending` is used for Orderbook collateral.

---

## Session Summary (2025-12-22 Evening)
**V6.2.7 Repository Audit & Hygiene** — Performed a full codebase audit. Cleaned up `abis.ts` by removing several legacy ABIs (V3 and early V4) that were no longer used. Expanded the `LAUNCHPAD_MARKET_ABI` to include missing V6 functions for better frontend integration. Verified contract-to-interface consistency for the core and launchpad modules. Identified and documented remaining TODOs and legacy test files for future cleanup.
