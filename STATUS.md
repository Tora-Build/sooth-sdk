# Project Status

> Last Updated: 2025-12-21 (V6.2.0 Atomic Functions & MegaETH Deployment)

## Current Focus
- **V6.2.0 Atomic Split/Merge** — Added `splitAndDeposit` and `mergeFromVault` to TraderVaultV4 for 1-click inventory management ✅
- **Base Sepolia Fresh Deploy** — Complete V6.2.0 stack with atomic functions deployed and verified ✅
- **MegaETH Deployment Attempt** — Partial success; documented gas model challenges ⚠️
- **Inventory Management UI** — Moved Merge/Split to Market Detail page with balance display ✅
- **Order ID 0 Fix** — Fixed orderbook hook to correctly handle Order ID 0 as valid order ✅

## Recent Changes

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

### Base Sepolia (Chain 84532) - V6.2.0 Atomic Split/Merge ✅
| Contract | Address |
|----------|---------|
| MockUSDC | `0xAb052EB6964A0E1D46b968f8Cb654EAa0aB9ada3` |
| LiquidityVault | `0xe240E696d2fb9F915A3d0D14E8Ba7A49AEbD5f2B` |
| TraderVaultV4 | `0x343F3cAD9236c3D7e323b2eAeCDdCF34c4f26265` |
| FeeController | `0x6AB3a4E196509d4d73fCf2550378de7568a43A66` |
| **LaunchpadFactory (V6)** | `0xE968C6DaC998158cF9D4a650c7b313bfFbE412aA` |
| Market 1 (Alien Life) | `0x2D0b0d2F7807B51b3eAAd19B5a180D88700FC1ab` |
| Market 2 (BTC TWAP) | `0x2C5cbce97497d6Ec13E601e7a8954FaBB7285657` |

## Pending/Blocked
- [ ] **Mobile Optimization**: Finalize MegaETH frontend responsive layouts.
- [ ] **Stress Test**: High-frequency orderbook stacking on MegaETH.
- [ ] **QA next**: Fuzz tests for LMSR edge cases (large trades, extreme prices).

## Session Summary (2025-12-21)
**V6.2.0 Atomic Inventory Management** — Added atomic `splitAndDeposit` and `mergeFromVault` functions to TraderVaultV4, reducing multi-step transactions to single clicks. Deployed fresh V6.2.0 stack to Base Sepolia. Attempted MegaETH Frontier deployment but encountered gas model limitations; documented learnings and retained V6.1.8 deployment. Fixed Order ID 0 bug in orderbook display and unified UI button heights across portfolio/market pages.
