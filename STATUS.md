# Project Status

> Last Updated: 2025-12-20 (MegaETH Chain-Aware Stability)

## Current Focus
- **Cross-Chain Consistency** — Resolved cross-chain RPC state leakage and fixed multi-chain hook routing ✅
- **MegaETH Frontier Stability** — Optimized for high-throughput RPC behavior and addressed IP rate limiting ✅
- **UI/UX Stabilization** — Resolved flickering, scrolling jank, and redundant renders ✅
- **Finalizing Visual Identity** — Unified "Layered Architecture" motif for dapp, socials, and mediakit ✅
- **Codebase Cleanliness** — Purged legacy V4/V5 debt and unlinked hooks/components ✅

## Recent Changes

### ✅ Multi-Chain Stability & MegaETH Fixes (2025-12-20)
- **🌍 Chain-Aware Hooks**:
  - **Fixed Cross-Chain Call Leaks**: Updated all core hooks (`useLaunchpadTradeQuote`, `useOrderbook`, `useOrderbookTrade`, etc.) to explicitly use the `selectedChainId`. This prevents markets on MegaETH from trying to call Base RPCs, which was causing `0x` zero-data returns and IP rate limiting.
  - **Selected Chain Persistence**: Integrated `useChainStore` across the protocol layer to ensure the dApp state always matches the network the user is viewing, regardless of wallet connection.
- **⚡ MegaETH RPC Optimizations**:
  - **Resource Unavailable Handling**: Added specific error detection for MegaETH's "Requested resource not available" RPC error (often caused by nonce/timing under high load). The UI now suggests a brief wait rather than a hard crash.
  - **Nonce Guarding**: Switched to `publicClient.getChainId()` checks during simulation to ensure the wallet is properly aligned before broadcasting high-throughput transactions.
- **🐛 Orderbook Refinements**:
  - **Duplicate Order Support**: Removed the artificial restriction on identical price orders. The orderbook now correctly supports FIFO queuing for multiple orders at the same price level.
  - **TypeScript Safety**: Fixed type mismatches in `useOrderbookTrade` where addresses were being treated as raw strings, causing compilation warnings.
- **🚀 Markets Page Restoration**: Fixed a `ReferenceError` in `useLaunchpadMarkets` that was crashing the main market grid during chain transitions.

### ✅ Visual Polish & OB Balance Fix (2025-12-20)
- **⚡ Performance & Anti-Flicker**:
  - **Fixed Full-Page Flickering**: Stabilized `body` background with `background-attachment: fixed` and simplified radial gradients.
  - **GPU Layer Promotion**: Added `will-change: transform` to sticky sidebars to isolate them during high-frequency scrolling.
  - **Paint Containment**: Implemented `contain: paint` on `.glass-card` elements to skip redundant layout/paint calculations.
  - **Render Consolidation**: Propagated prefetched `market` objects from `MarketDetail` to sub-components (`MarketCard`, `AmmTradingPanel`) to eliminate redundant RPC calls and re-render flashes.
  - **Aggressive Throttling**: Increased hook `refetchIntervals` to 10s–60s to reduce background state updates that were interrupting the UI thread.
- **🎨 UI Unification**:
  - **Header & Navbar**: Unified the "Launch App" button style across Landing and About pages (removed redundant shadows, standardized icons).
  - **Hero CTAs**: Standardized "Launch App" and "About" buttons with consistent hover states and typography.
  - **Terms Alignment**: Standardized terminology (e.g., "Modular Market", "Dual DEX Engine") and removed branding inconsistencies.
- **🐛 Orderbook Balance Fix**:
  - **Resolved "0 Balance" Bug**: Fixed a critical issue in `useOrderbookTrade` and `useTraderVault` where vault balances were not being detected due to ABI return-type mismatches and async race conditions in `refetchBalance()`.
  - **Decimal Normalization**: Fixed a precision bug in `useOrderbookTrade` where 6-decimal USDC vault balances were being compared against 18-decimal WAD costs, causing false "Insufficient balance" errors.
  - **Robustness**: Switched to explicit `availableBalance()` and `pendingBalance()` calls to bypass struct-to-object parsing inconsistencies in Viem.

### ✅ MegaETH Frontier Net Integration (2025-12-20)
- **Full V6.1.8 Deployment**: Deployed the complete protocol stack to MegaETH Mainnet (Chain 4326).
  - Infrastructure: MockUSDC, FeeController, LiquidityVault, TraderVaultV4, ProtocolConfig.
  - Launchpad: Factory, Market/Token Implementations + 2 Demo Markets.
- **Frontend Chain Support**: Integrated Chain 4326 into `chains.ts`, `wagmi.ts`, and `deployments.json`.
- **Standalone Faucet**: Created `/faucet` page for minting test mUSDC and navigating Frontier gas requirements.
- **Landing Page Redesign**: Modular branding overhaul with MegaETH performance highlights and blueprint aesthetics.

### ✅ Alpha Codebase Purge & Stabilization (2025-12-20)
- **🗑️ Dead Code Removal**: Deleted over 30 unused files, including legacy interfaces (`TraderTerminal.tsx`, `OperatorConsole.tsx`) and purged redundant hooks.
- **⚡ Performance Optimization**: Removed flickering scanline overlays and excessive re-renders by de-coupling activity listeners from global refresh keys.
- **🌑 Visual Stability**: Switched to static loading blocks instead of pulsing skeletons to prevent page flashing.
- **📚 Documentation Archiving**: Moved legacy V4 and V5 technical guides/research to `docs_archive/` to prevent developer confusion.

### ✅ Safe Parity Minting & V6.1.8 Deployment (2025-12-20)
- **Fixed Fair Minting Explosion**:
  - Implemented **Parity Floor Protection**: LP tokens for fees are now minted at `max(Current ExRate, 1.0)`.
  - Prevents the "division-by-near-zero" feedback loop that caused trillion-LP explosions in thin pools.
- **UI Metrics Alignment**:
  - Fixed LP Supply and Leaderboard formatting to show WAD decimals (human readable).
  - Split **Price (Net)** and **Fee** in the trading panel to clearly distinguish the $1.00 base cap.

### ✅ MarketDetail Market Info Fix (2025-12-17)
- **Bug Fix**: Fixed market info disappearing in `MarketDetail.tsx`
  - Added fallback fetching: if market not found in `useLaunchpadMarkets()` list, fetch name/symbol directly from outcome token contract.

## Active Deployments

### MegaETH Mainnet (Chain 4326) - Frontier Net ✅
|| Contract | Address |
|---|----------|---------|
|| MockUSDC | `0x58f35be6a5e3d2be4c3575853043322b02feed84` |
|| FeeController | `0x3c06e44bd4d09328a4c374174b8e325c0c674b6e` |
|| LiquidityVault | `0x1af3cb8b270db3e71fc979543c32b87709ea191f` |
|| TraderVaultV4 | `0x8629b9ca457f4088ec8346faed61da858fdb498d` |
|| **LaunchpadFactory (V6)** | `0xaa3ffae62a8af00d08ac395e9551776b0a01e492` |
|| **ProtocolConfig** | `0xbe566c267a0d350e1d647ccb621cc657fa3a1d50` |
|| Market 1 (Alien Life) | `0x13D233B5D83A24a3090780738E4AC82Be3305cee` |
|| Market 2 (BTC TWAP) | `0xc5DF627fa7d51d75B3EF179c156AceF9801B927E` |

### Base Sepolia (Chain 84532) - V6.1.8 Safe Parity ✅
|| Contract | Address |
|---|----------|---------|
|| MockUSDC | `0x4Dc928Cc772c178fdDba395F8549b0Ebd8B30587` |
|| LiquidityVault | `0xb85B11d5480a40955a907CF8a8d03a1319231637` |
|| TraderVaultV4 | `0x587dFaF63e4286A7a91b157A3f40d55D0c3D3048` |
|| FeeController | `0xDaa0D770bbD2eC79585078a602a5Ce31D341Fe03` |
|| **LaunchpadFactory (V6)** | `0x0Edd298Ce0A1D7E97f1837C4a1Be058e88A21af7` |
|| Market 1 (Alien Life) | `0x6972A5a6Ca36bD59A86088B031DEE8a2972E6A6F` |
|| Market 2 (BTC 7-day TWAP) | `0xaF551Ab033E1CC7F423EB29d60E65d8725711a7C` |

### BNB Testnet (Chain 97) - V4.6 (Lock-on-Sell) - HIDDEN 🙈
- Official status: Hidden from dApp to focus on V6 Launchpad deployments.

## Pending/Blocked
- [x] **V6 Tests**: Run full test suite (`LaunchpadV6.t.sol` - ✅ 24/24 passing)
- [ ] **Mobile Optimization**: Verify MegaETH frontend layouts on smaller devices.
- [ ] **Security**: Rotate deployment keys (exposed in session history).
- [ ] **QA next**: Fuzz tests for LMSR edge cases (large trades, extreme prices).
- [ ] **Stress Test**: High-frequency orderbook stacking on MegaETH.

## Session Summary (2025-12-20)
**MegaETH Chain-Aware Stability** — Resolved cross-chain RPC leakage by making all hooks explicitly chain-aware, fixed MegaETH-specific "resource unavailable" errors through improved simulation logic, and restored orderbook flexibility by allowing multiple orders at the same price.

## Deployment Notes
- **MegaETH RPC**: Use viem `deployContract` with `gas: 999999999n` to bypass intrinsic gas errors.
- **Foundry**: `prb-math` must be present in `lib/` for compilation.
