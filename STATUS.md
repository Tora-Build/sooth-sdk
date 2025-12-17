# Project Status

> Last Updated: 2025-12-17 (V6 Launchpad Deployment on Base Sepolia)

## Current Focus
- **Launchpad-Only Architecture** — Migration complete ✅
- **Naming Refactoring** — All governor/creator confusion resolved ✅
- **V6 Pre-Graduation Locking** — Architecture implemented and deployed ✅
- **V6 Markets on Base Sepolia** — 2 new markets created via V6 LaunchpadFactory ✅

## Recent Changes

### ✅ V6 Launchpad Deployment on Base Sepolia (2025-12-17)
- **Deployed V6 LaunchpadFactory** with ProtocolConfig architecture
  - Factory: `0x5fe83532e061353ADe5D604DfB4239aE7c8B9d2F`
  - ProtocolConfig: `0x22565a06050a5031a02885263ebb106ec8595a8a`
  - LaunchpadMarketImpl: `0xfd4c2a7ba5801122aa2070a7b965e733b4f4ca10`
  - LaunchpadOutcomeToken: `0x6b3f017d58874badb7dd14ce74219ad83335dd54`
- **Created 2 V6 Launchpad Markets**:
  - Market 1 (Alien Life): `0x69b073721c552eBac6c42e934EA6684d78727c67` (Tier 1: $1k)
  - Market 2 (BTC 7-day TWAP): `0x3A5E80578933aa92644D4ee7192CD744600d6A2f` (Tier 2: $10k)
- **Config Updates**:
  - Updated `deployments.json` with new V6 contract addresses (version bumped to 4.11)
  - Added markets to `markets.json` with mode: "real", chainId: 84532
  - Fixed `verify-deployment.sh` to use `SoothLiquidityVault` instead of deprecated `SoothGovernorVault`
  - Synced configs to all packages via `sync-deployments.sh`
- **Deployment Script Fix**: Fixed `DeployV4Markets.s.sol` to use `LaunchpadOutcomeToken` instead of `OutcomeToken`
- **Verification**: All on-chain checks passed ✅ (contracts have code, markets registered, links verified)

## Recent Changes

### ✅ Launchpad-Only Migration Complete (2025-12-16)
- **Architecture Change**: Removed "standard market" concept entirely — all markets must be Launchpad markets
  - All markets created via `LaunchpadFactory` (no direct `SoothMarketBase` instantiation)
  - **Critical**: `SoothMarketBase` is NOT a market type — it's the base contract that `LaunchpadMarket` inherits from
  - `SoothLiquidityVault` now only used for TraderVault's global locked proceeds tracking
  - Each Launchpad market is its own vault (implements `ISoothLiquidityVault` directly)
- **Naming Refactoring**: Resolved governor/creator confusion throughout codebase
  - `SoothMarketV4` → `SoothMarketBase` (base contract that LaunchpadMarket inherits from, NOT a market type)
  - `governor` → `marketOperator` in base contract (generic operator role for flexibility)
  - `governor` → `creator` in Launchpad context (Launchpad-specific ownership)
  - **Important**: In Launchpad markets, `marketOperator == creator` (same address, set during initialization)
  - `ISoothGovernorVault` → `ISoothLiquidityVault` (clarifies purpose)
  - `SoothGovernorVault` → `SoothLiquidityVault` (global vault for locked proceeds)
  - Abstract `Ownable` → `SoothOwnable` (resolved conflict with OpenZeppelin's Ownable)
  - Created separate `ISoothLiquidityVault.sol` to avoid Ownable import conflicts
- **Test Files Converted**: 11 test files updated to use LaunchpadFactory
  - `V4Integration.t.sol`, `OrderbookShort.t.sol`, `GranularityTest.t.sol`, `CustodialVault.t.sol`
  - `ReproducePanic.t.sol`, `HybridSell.t.sol`
  - `scenarios/MultiRoleScenarios.t.sol`, `scenarios/AdversarialScenarios.t.sol`, `scenarios/SettlementScenarios.t.sol`
  - `invariants/VaultInvariants.t.sol`, `actors/TraderActor.sol`
- **Deployment Scripts Converted**: 10 scripts updated
  - `DeployMultiChainV4.s.sol`, `DeployV4Markets.s.sol`, `DeployFreshV4.s.sol` (and duplicate)
  - `RedeployMarketsOnly.s.sol`, `RedeployMarket2.s.sol`
  - `Step1_DeployContracts.s.sol`, `DebugMarketState.s.sol` (and duplicate)
  - `CheckMarket2State.s.sol` (and duplicate)
- **Documentation**: Updated migration guide, naming proposals, and whitepaper
- **Build Status**: ✅ All contracts compile successfully, no remaining standard market references

### ✅ V6 Pre-Graduation Locking (2025-12-15 Session 7) - DEPLOYED
- **Architecture**: V6 pre-graduation locking architecture is merged, implemented, and deployed
  - All sell proceeds locked during pre-graduation (cannot withdraw)
  - Locked proceeds can be reinvested via `useLockedProceeds()`
  - 2-contract architecture: Market implements `ISoothLiquidityVault` (no separate LPVault)
  - Immutable Factory with `ProtocolConfig` for mutable parameters
  - Guardian role for liquidation and `forceGraduate()` powers
- **Implementation Status**: ✅ V6 architecture merged into `LaunchpadMarket.sol` and `LaunchpadFactory.sol`
  - `LaunchpadMarket` implements `ISoothLiquidityVault` and `ERC20` directly
  - `LaunchpadFactory` includes `ProtocolConfig` reference
  - `ProtocolConfig` contract deployed and integrated
  - Pre-graduation locking with `totalLockedProceeds` tracking
  - `useLockedProceeds()` function implemented
- **Deployment Status**: ✅ Deployed on Base Sepolia (2025-12-17)
  - Factory and ProtocolConfig deployed
  - 2 V6 markets created via factory
  - All on-chain verification checks passed
- **Test Suite**: 25 V6 tests written (`LaunchpadV6.t.sol`) - ready to run after fixing test compilation issues
- **Status**: ✅ Architecture merged, implemented, and deployed

### ✅ V5 Frontend Trading (2025-12-15 Session 6)
- **MarketCard Inline Trading**: Full AMM trading experience directly on Markets page
  - Buy/Sell toggle with visual feedback
  - YES/NO outcome selection as clickable probability cards
  - Amount input with hold-to-increment/decrement buttons
  - Quick amount buttons (10, 50, 100, 500)
  - Cost per share display (uses `totalCost` for accuracy)
  - Slippage options: 0.1%, 0.5%, 1%, 2%
  - Max to sell display when in sell mode (clickable to set max)
  - Fee display in quote summary
  - Probability transition arrows (e.g., `50.0% → 55.2%`)
  - Collapsible trading panel
- **Orderbook Balance Fix**: V5 Launchpad markets now recognized by orderbook UI
  - `useOrderbook.ts` — Detects address-format marketIds, uses `useAmmMarketByAddress`
  - `useOrderbookTrade.ts` — Same fix, updated all contract calls to use resolved address
  - `LimitOrderForm.tsx` — Uses correct market hook based on ID format
- **Cost Per Share Fix**: Eliminated jumping/creeping values
  - Added `quote.inputAmount` check to ensure displayed data matches current input
  - Shows `--` while loading instead of falling back to stale market price
  - Uses `totalCost` (includes fee) for accurate per-share calculation

### ✅ V5 Launchpad QA (2025-12-15 Session 5)
- **Test Expansion**: Increased Launchpad tests from 2 → **17 tests** (all passing)
  - Added graduation flow tests (`testGraduation`, `testManualGraduate`, `testDoubleGraduateFails`)
  - Added expiry/refund tests (`testExpiry`, `testExpiryBlocksTrading`, `testCreatorRefund`, `testNonCreatorCannotClaimRefund`)
  - Added LP Vault tests (`testLPVaultRedeem`, `testLPVaultPreviewRedeem`)
  - Added edge case tests (`testInvalidTierIndex`, `testDoubleInitializeFails`, `testOpenEndMarket`, `testAllTiers`)
  - Added invariant test (`testFeeRateInvariant` — bBase never decreases, fee rate 5%→1%)
- **Bug Fixed**: `claimCreatorRefund()` in `LaunchpadMarket.sol` was calling `lpVault.redeem()` with wrong msg.sender
  - Changed to use `sendFunds()` for direct USDC transfer
- **Compiler Warnings Fixed**: Removed 14 warnings across Launchpad contracts
  - `MarketLPVault.sol`: Fixed unused params, changed stubs to `pure`
  - `LaunchpadFactory.sol`: Fixed unused `description` param
- **Deployment Verification**: Both Base Sepolia and BNB Testnet verified on-chain ✅
  - All contracts have code
  - All markets registered in TraderVault
  - All OutcomeTokens registered
  - Market→Vault links correct
- **Tooling**: Fixed `verify-deployment.sh` with curl fallback for sandbox environments (macOS cast crash)
- **Fork Tests**: Updated `LiveAmmBuy.t.sol` with current V4.6 addresses, verified trades execute

### ⏳ V5 Frontend Overhaul (2025-12-15 Session 4) — UNCOMMITTED
- **Launchpad Trading Fix**: Fixed sell slippage calculation in `useLaunchpadTradeQuote.ts` — was not accounting for fees before applying slippage
- **Create Market Drawer**: Converted `CreateLaunchpadMarket` page to `CreateMarketDrawer` component with:
  - Fixed 18-decimal USDC handling
  - Mock adjudicator selection UI (Manual active, Chainlink/UMA coming soon)
  - Integrated into `TraderTerminal` and `LPDashboard`
- **Market Detail Page Redesign**: Rewrote `LaunchpadMarket.tsx` with:
  - New `MarketHeader` component (name, status badges, creator, deadline)
  - New `GraduationProgress` component (animated bar, fee rate, graduate button)
  - YES/NO probability cards
  - Integrated trading panel
- **Cleanup**: Archived deprecated files to `src/_archive/`:
  - `V4MarketPage.tsx`, `CreateLaunchpadMarket.tsx`, `LaunchpadTradeForm.tsx`
  - Entire `/components/v4/` directory
- **Navigation**: Removed dead `create-market` view from navigation store
- **API Updates**: Added `feesAccrued` to `useLaunchpadMarket` hook and ABI
- **Styling**: Added `animate-shimmer` utility class

### ✅ Launchpad Model Research Complete (2025-12-14 Session 3)
- Finalized **Sooth Launchpad** architecture: pump.fun-inspired per-market liquidity model
- All design decisions documented in `LAUNCHPAD_MODEL_RESEARCH.md` and `LAUNCHPAD_ECONOMICS_V2.md`
- Key decisions:
  - Creator deposit: USDC only (no SOOTH bond), `deposit = b × 0.693` (1.44x liquidity leverage)
  - Fixed liquidity tiers: $100, $1k, $10k, $100k
  - Graduation: 2× b in fees, 5-day deadline
  - Fee split (post-grad): 50% liquidity (b growth), 30% LP Vault (exchangeRate), 20% protocol
  - Expiry refund: Creator deposit + LP fees returned if market fails to graduate
  - Early settlement: If truth known before graduation → market fails (refunds, no settlement)
  - Open/Fixed-end: Creator's choice at creation
- Validated LMSR math: `delta_b = fee / 0.693` is always safe (maxLoss = 0.693b guaranteed)
- See ADR-014 in DECISIONS.md

### ✅ Launchpad Implementation (2025-12-14)
- Implemented **Launchpad V5** contract suite:
  - `LaunchpadFactory`: Clone-based cheap deployment, handles creator deposits.
  - `LaunchpadMarket`: Dynamic fee logic (5% -> 1%), graduation threshold (2x B), expiry refunds.
  - `MarketLPVault`: Per-market governor vault for isolated LPs.
  - `LaunchpadOutcomeToken`: Dynamic cloneable ERC1155 token.
- Refactored `SoothTraderVaultV4` to support dynamic GovernorVault lookup.
- Added comprehensive unit tests in `Launchpad.t.sol`.
- **Audit Status**: Cleaned comments, verified interfaces, ready for testnet deployment.
- **QA Status**: ✅ Verified `test/Launchpad.t.sol` (Creation, Funding, Trading, Fee Accrual). Fixed 1e18 scaling issue.
- **Specs**: Created `apps/web/docs/specs/LAUNCHPAD_SPEC.md` for frontend integration.

## Active Deployments

### Base Sepolia (Chain 84532) - V6 Launchpad Markets ✅
| Contract | Address |
|----------|---------|
| MockUSDC | `0x53d34066A316AE1699d434753B70593A6D59Fec1` |
| LiquidityVault | `0x2A2DfA1B3B3F4db798b759d07064Bb800BD10fB1` |
| TraderVaultV4 | `0xa8aDE73124B3256F98f510F6A9E7C1e3Aa71d20B` |
| FeeController | `0x1a646107e7E88aa01Fadff3145Af08156679198e` |
| **LaunchpadFactory (V6)** | `0x5fe83532e061353ADe5D604DfB4239aE7c8B9d2F` |
| **ProtocolConfig** | `0x22565a06050a5031a02885263ebb106ec8595a8a` |
| LaunchpadMarketImpl | `0xfd4c2a7ba5801122aa2070a7b965e733b4f4ca10` |
| LaunchpadOutcomeToken | `0x6b3f017d58874badb7dd14ce74219ad83335dd54` |
| Market 1 (Alien Life) | `0x69b073721c552eBac6c42e934EA6684d78727c67` |
| OutcomeToken 1 | `0x62445F1138CFf4cE29d7e04cf3f54d6D04249BA8` |
| Market 2 (BTC 7-day TWAP) | `0x3A5E80578933aa92644D4ee7192CD744600d6A2f` |
| OutcomeToken 2 | `0x83C0CD98A2744ac3159DCbE69633c76dc09F05F8` |

### BNB Testnet (Chain 97) - V4.6 (Lock-on-Sell)
| Contract | Address |
|----------|---------|
| MockUSDC | `0x89BA3FEe2FB764Ec297DC91bb874aa5bF88F204c` |
| LiquidityVault | `0xEB33E2f815306D936d4bDD2b33b2b68C16b62Fa0` |
| TraderVaultV4 | `0x05818C4028ff5c273B45B3c55131Af2Bd9D12322` |
| FeeController | `0x3152A8cd6CA0C64675C73486B06203a9D8226448` |
| Market 1 (Alien) | `0x93CD5Cd848af2Af5247Ba132FcAc4B6840531585` |
| OutcomeToken 1 | `0xAf358498666D7b0F8Cd4A02B5194D19CA654756d` |
| Market 2 (BTC) | `0x45419a4f8Fc485aC548F289d1a6279b9010c11ca` |
| OutcomeToken 2 | `0xb68Cf3fB896fd9b3869830473917767C3F6a28cF` |

### MegaETH Testnet (Chain 6343) - V4.5 🆕
| Contract | Address |
|----------|---------|
| MockUSDC | `0x493da6e5c9de67ab50b2fb08d14865614189b5c2` |
| LiquidityVault | `0xdb0063ce93e445ff7a8916f6f5a093f80833494f` |
| TraderVaultV4 | `0xdc980ac16626211a7c472a94a163440eb68c5bfc` |
| Market 1 | `0x99CB8c0e3da2604518b8210589edcaB50Cc6f769` |
| Market 2 | `0x94D02d846a04A751e9e4f93A6684a30e043444Da` |
| LaunchpadFactory | `0x844C46bDfC2994e2CC7C559d2Ab8F340E54522fD` |
| LaunchpadMarketImpl | `0x5A77630Fd17F72Fe6f6fAF1dA8ceab8CFb8213C3` |
| LaunchpadOutcomeTokenImpl | `0xf2b16B964F0e413EB7c89129aacDf3D7de8096f0` |

## Pending/Blocked
- [ ] **V6 Tests**: Run full test suite (`LaunchpadV6.t.sol` - compilation issues fixed ✅)
- [ ] **Frontend Integration**: Test V6 markets in UI (create, trade, graduate flows)
- [ ] **V5 Frontend**: Commit frontend overhaul changes (Session 4-6 - uncommitted)
- [ ] Monad testnet deployment (awaiting funds)
- [ ] MegaETH frontend verification on mobile
- [ ] QA next: Fuzz tests for LMSR edge cases (large trades, extreme prices)
- [ ] QA next: E2E happy-path (Synpress) for deposit → trade → claim → withdraw
- [ ] **Security**: Rotate the private key used for deployments (it was exposed in chat)

## Branch Status
| Branch | Status | Description |
|--------|--------|-------------|
| `main` | Active | V4.6 with Lock-on-Sell ✅ |

## Deployment Notes
- **MegaETH RPC quirk**: `forge script` fails with "intrinsic gas too low"
- **Solution**: Use viem `deployContract` with `gas: 999999999n`
- **Script**: `apps/web/scripts/deploy-megaeth.ts`
- **Foundry dependency**: `prb-math` must be installed in `packages/contracts-evm/lib/` for deploy scripts to compile (`SoothMarketV4` imports `prb-math/sd59x18/*`).
