# Project Status

> Last Updated: 2025-12-21 (V6.2.6 UI Polish Session)

## Current Focus
- **V6.2.6 UI Polish** — Markets page cleanup, formula visibility, metrics bug fixes. ✅
- **V6.2.5 Pure Trading Account Model** — Abandoned wallet-held token support to focus strictly on custodial inventory management. ✅
- **V6.2.4 Pure WAD Architecture** — Standardized 100% of accounting views to 18 decimals to fix trillion-dollar scaling bugs. ✅

## Recent Changes

### ✅ V6.2.6 UI Polish Session (2025-12-21)
- **🐛 Bug Fixes**:
  - Fixed `totalLockedProceeds` decimal bug in MarketCard (was `/1e18`, now `/1e6` for USDC)
  - Fixed JSX syntax error in MarketDetail.tsx (extra `</div>` tag)
- **🎨 UI Improvements**:
  - Formula hints now always visible (removed hover-only behavior)
  - Removed "System Online" and "Mainnet Assets" status badges from Portfolio
  - Removed Hero Stats Bar from Markets page (was showing placeholder data)
  - Added badge counts to filter tabs: `All (2)`, `Bonding (1)`, `Graduated (1)`
  - TrendingLeaderboard: 3 horizontal cards instead of vertical list, removed placeholder volume
  - Improved tooltip hints for MarketCard metrics (Liquidity Depth, Floor Equity, Locked Proceeds)
- **⚙️ Config Changes**:
  - Deployment script deadline changed from 90 days → 5 days

### ✅ V6.2.5 Pure Vault Architecture (2025-12-21)
- **🧹 Token Support Abandoned**:
  - Deleted `OrderbookTokensCard.tsx`. On-chain ERC1155 tokens are no longer displayed or managed by the current dApp version.
  - Removed all "wallet-aware" logic from hooks and the trade form. The dApp now treats the Trading Account (Vault) as the sole source of truth for inventory.
- **🔄 Inventory Management Hub**:
  - Restored Merge and Split actions, strictly restricted to custodial shares.
  - Added a global management hub to the **Trading Account** card in the Portfolio.
- **⚡ Performance & Scalability**:
  - **Frontend LMSR Prices**: Derivatives prices instantly from quantities, eliminating high-latency on-chain price calls.
  - **Mega-Batch Discovery**: Consolidated market status and metadata fetching into a single RPC request per session.
  - **Hook Pruning**: Stopped background polling for wallet token balances to save bandwidth.

### ✅ V6.2.0 Atomic Inventory Functions (2025-12-21)
- **🔗 Contract Upgrades**:
  - Added `splitAndDeposit(market, amount)` to TraderVaultV4: Split USDC→YES+NO in 1 tx (was 3)
  - Added `mergeFromVault(market, amount)` to TraderVaultV4: Merge vault shares→USDC in 1 tx (was 3)
  - Modified `debitSplitProceeds` to skip self-debit when vault calls split internally
- **🎯 UI Improvements**:
  - Moved Merge/Split from Portfolio to Market Detail's "Inventory Management" section
  - Added balance display (USDC, YES, NO) to Inventory Management card
  - Unified button heights across Deposit/Withdraw/Merge/Split to match AMM buttons
  - Renamed "In Orders" → "Reserved" with tooltip explaining on-chain collateral
- **🐛 Bug Fixes**:
  - Fixed Order ID 0 not displaying in orderbook (was treated as sentinel instead of valid order)
  - Removed overly restrictive client-side `isOutcomeToken` check that blocked valid operations

### ⚠️ MegaETH Deployment Challenges (2025-12-21)
- **Partial Deployment**:
  - ✅ MockUSDC: `0x493DA6e5C9de67Ab50B2fb08d14865614189b5c2`
  - ✅ FeeController: `0xDB0063Ce93e445Ff7a8916f6F5A093f80833494f`
  - ❌ LiquidityVault: Constructor reverts (67M gas used, status=0)
- **Root Causes**:
  - MegaETH RPC has 10M gas estimation limit (blocks multi-contract deploys)
  - Intrinsic gas is 60,000 (vs Ethereum's 21,000)
  - Storage-heavy contracts may fail due to multidimensional gas model
- **Decision**: Keep existing V6.1.8 deployment on MegaETH Frontier

### ✅ Portfolio Architecture & UI Overhaul (2025-12-20)
- **🏗️ Domain Separation**:
  - Split the Portfolio page into two primary columns: **Trading Account** (Orderbook/Vault) and **Wallet Portfolio** (AMM/On-chain tokens).
  - Added distinct color-coded backgrounds (Indigo for Custodial, Emerald for Direct) and domain-specific badges.
- **🧩 Reusable UI Components**:
  - Created `PortfolioCard.tsx`: A standardized container for all portfolio data with support for variants (`indigo`, `emerald`, `default`), header badges, and contextual actions.
  - **Dynamic Length Management**: Implemented automatic folding/unfolding for long lists of positions or orders, saving vertical space.
  - **Stale-While-Revalidate**: Refined loading states to prevent page flickering during background data refreshes.
- **🎨 Visual Identity & UX**:
  - **User-Friendly Naming**: Renamed technical terms (e.g., "Custodial Positions" → "Trading Positions", "Direct Escrow" → "Pending Unlocks").
  - **Logo Unification**: Standardized the logo style across Navbar, Landing, and About pages; removed the "protocol" subtitle for a cleaner look.
  - **Header Cleanup**: Removed redundant back buttons and unified "Launch App" CTAs.
  - **Audit & Purge**: Removed dozens of unused imports and dead variables across the core portfolio components.

### ✅ Multi-Chain Stability & MegaETH Fixes (2025-12-20)
- **🌍 Chain-Aware Hooks**:
  - **Fixed Cross-Chain Call Leaks**: Updated core hooks to explicitly use `selectedChainId`.
  - **Selected Chain Persistence**: Integrated `useChainStore` across the protocol layer.
- **⚡ MegaETH RPC Optimizations**:
  - **Resource Unavailable Handling**: Added specific error detection for MegaETH RPC errors.
  - **Nonce Guarding**: Switched to `publicClient.getChainId()` checks during simulation.

### ✅ Alpha Codebase Purge & Stabilization (2025-12-20)
- **🗑️ Dead Code Removal**: Deleted over 30 unused files and legacy interfaces.
- **⚡ Performance Optimization**: Throttled `refetchIntervals` (15s–30s) and increased `staleTime` to eliminate background re-render flashes.

## Active Deployments

### MegaETH Mainnet (Chain 4326) - Frontier Net ✅
| Contract | Address |
|----------|---------|
| MockUSDC | `0x58f35be6a5e3d2be4c3575853043322b02feed84` |
| FeeController | `0x3c06e44bd4d09328a4c374174b8e325c0c674b6e` |
| LiquidityVault | `0x1af3cb8b270db3e71fc979543c32b87709ea191f` |
| TraderVaultV4 | `0x8629b9ca457f4088ec8346faed61da858fdb498d` |
| **LaunchpadFactory (V6)** | `0xaa3ffae62a8af00d08ac395e9551776b0a01e492` |
| Market 1 (Alien Life) | `0x13D233B5D83A24a3090780738E4AC82Be3305cee` |
| Market 2 (BTC TWAP) | `0xc5DF627fa7d51d75B3EF179c156AceF9801B927E` |

### Base Sepolia (Chain 84532) - V6.2.3 Quoter ✅
| Contract | Address |
|----------|---------|
| MockUSDC | `0x8dD2ABE2a78BB70F8E0fFE363BbFdc6022aA00Cd` |
| LiquidityVault | `0xDE5639BC20a0de20a0bEF2EdDE36b9C5DE79CEfB` |
| TraderVaultV4 | `0x1364d5CCc14251C73823e0291EF57e9EA4b9E673` |
| FeeController | `0x3D20145Ec9b15b2AC27292459aB2FaCb3921aCA9` |
| **LaunchpadFactory (V6)** | `0xDF4Fca6dfA27eAcf1A73a6603A0C7aFA3e1A9a8a` |
| **LaunchpadQuoter** | `0x862Acd130411060Eb0A1B4cf9212f0D863774200` |
| Market 1 (Alien Life) | `0x582c652Bcc324c5EFCeF3a53DCe30856d0df77c7` |
| Market 2 (BTC TWAP) | `0x50b66378764D9837F87d6b5C6d15728B8cF91693` |

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

## Session Summary (2025-12-21 Evening)
**V6.2.6 UI Polish Session** — Fixed critical MarketCard bug where `totalLockedProceeds` displayed `$0` due to wrong decimal division (`/1e18` instead of `/1e6`). Cleaned up Markets page by removing the placeholder Hero Stats Bar and adding badge counts to filter tabs. Redesigned TrendingLeaderboard as 3 horizontal cards instead of a vertical list. Made formula hints always visible in MarketDetail. Removed unnecessary status indicators from Portfolio. Updated deployment script deadlines to 5 days for faster testing cycles.
