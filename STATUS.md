# Project Status

> Last Updated: 2025-12-15 (Session 5 - V5 Launchpad QA)

## Current Focus
- **V5 Launchpad QA** — Comprehensive test suite complete ✅
- **Deployment Verification** — Base Sepolia + BNB Testnet verified ✅
- **V5 Frontend Overhaul** — Major UI improvements for Launchpad markets ⏳ IN PROGRESS
- **TraderVault Integration** — Resolving whitelisting permission blocker ⏳

## Recent Changes

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

### ✅ Multi-Chain Fresh Market Deployment (2025-12-14 Session 2)
- Deployed **fresh V4 markets** to both **Base Sepolia** and **BNB Testnet** via chain-aware `DeployV4Markets.s.sol`
- Script now dynamically resolves infrastructure addresses based on `block.chainid`
- Updated `apps/web/src/config/deployments.json` → version `4.10`
- Updated `apps/web/src/config/markets.json` with new contract + outcome token addresses
- Ran `sync-deployments.sh` to propagate to all packages
- Verified both deployments using `verify-deployment.sh` — **ALL CHECKS PASSED** ✅

### ✅ Base Sepolia V4.6 Markets Redeploy + Frontend Sync (2025-12-14)
- Deployed **new Base Sepolia markets** via `packages/contracts-evm/script/DeployV4Markets.s.sol` (broadcast success)
- Updated `apps/web/src/config/deployments.json` → bumped version and refreshed Base Sepolia market + outcome token addresses
- Updated `apps/web/src/config/markets.json` to match
- Fixed `packages/contracts-evm/script/verify-deployment.sh` to be **cwd-independent** and re-verified on-chain ✅
- Updated `sync-deployments.sh` to sync from **web config** as canonical, then synced to:
  - `packages/contracts-evm/deployments.json`
  - `packages/sooth-dapp/src/config/deployments.json`
- Frontend audit fixes:
  - `ProtocolAddresses` now displays per-chain **Market + OutcomeToken** addresses
  - `apps/web/src/hooks/v4/useAMMTrade.ts` now uses `tradeAMM` (not `executeAMMTrade`)
  - V4 lock warning copy updated to Lock-on-Sell semantics

### ✅ QA Test Expansion (2025-12-14)
- Added **Invariant Test Harness** (actor-based):
  - `packages/contracts-evm/test/invariants/VaultInvariants.t.sol`
  - `packages/contracts-evm/test/actors/TraderActor.sol`
- Added **Multi-Role Scenarios** (Traders + LPs):
  - `packages/contracts-evm/test/scenarios/MultiRoleScenarios.t.sol`
  - `packages/contracts-evm/test/actors/LPActor.sol`
- Added **Settlement Scenarios** (post-settlement constraints + merge + claim):
  - `packages/contracts-evm/test/scenarios/SettlementScenarios.t.sol`
- Added **Adversarial Scenarios** (access-control + slippage + invalid-input probes):
  - `packages/contracts-evm/test/scenarios/AdversarialScenarios.t.sol`

### ✅ BNB Testnet V4.6 Deploy + Frontend V4 Multi-Chain Fix (2025-12-14)
- Deployed **V4.6 infra + 2 markets** to **BNB testnet (chain 97)** via `packages/contracts-evm/script/DeployMultiChainV4.s.sol`
  - Broadcast required `--legacy --with-gas-price 1gwei` due to BNB min gas tip
- Updated `apps/web/src/config/deployments.json` (**version `4.9`**) + `apps/web/src/config/markets.json` with new BNB addresses
- Verification tooling:
  - `packages/contracts-evm/script/verify-deployment.sh` now supports `NETWORK=bnbTestnet` (not just Base Sepolia)
- Frontend V4 page (`V4MarketPage`) and `apps/web/src/hooks/v4/*` now respect active wallet chain (BNB works)

### ✅ Lock-on-Sell UI (2025-12-12)
- Implemented "Locked Proceeds" card in `TradingAccountCard`
- Added "Claim" modal with countdown timer
- Fixed Lock-on-Buy logic removal in Trading Terminal
- Updated ABIs to support `lockedBalance` and `nextUnlock`

### ✅ Lock-on-Sell Branch (Local Only)
- Reviewed and fixed `codex/review-and-implement-lock-mechanism` branch
- Fixed accounting bug: `lockProceeds()` was incorrectly decreasing `totalAssets`
- Option A implemented: funds stay in GovernorVault until claimed
- Fixed 4 test files: CustodialVault, HybridSell, OrderbookShort, GranularityTest
- Test results: 20/22 passing (2 fork tests require network)
- 2 local commits ready, not pushed

### ✅ MegaETH Testnet Deployment
- Full V4.5 infrastructure + 2 markets deployed to MegaETH Testnet (Chain 6343)
- Created `apps/web/scripts/deploy-megaeth.ts` (viem-based with `gas: 999999999n`)
- Forge scripts failed due to RPC "intrinsic gas too low" error
- Solution: Use viem `deployContract` with explicit high gas limit

### ✅ BNB Testnet Deployment
- Full V4.5 infrastructure + 2 markets deployed (Chain 97)
- Created `DeployMultiChainV4.s.sol` for multi-chain deployments

### ✅ Frontend Updates
- Landing page: Added MegaETH badge (green dot)
- About page: "Infinite-End" → "Open-End" terminology
- KNOWLEDGE.md: Updated with all 3 testnet deployment addresses
- Fixed mobile zoom (disabled pinch-to-zoom)
- Fixed first-tx page reload bug in `useDeployments.ts`

## Active Deployments

### Base Sepolia (Chain 84532) - V4.6 (Lock-on-Sell)
| Contract | Address |
|----------|---------|
| MockUSDC | `0x53d34066A316AE1699d434753B70593A6D59Fec1` |
| GovernorVault | `0x2A2DfA1B3B3F4db798b759d07064Bb800BD10fB1` |
| TraderVaultV4 | `0xa8aDE73124B3256F98f510F6A9E7C1e3Aa71d20B` |
| FeeController | `0x1a646107e7E88aa01Fadff3145Af08156679198e` |
| Market 1 (Alien) | `0x93AF286C7112dBeCB1e99B67c9E17427dD2ADec8` |
| OutcomeToken 1 | `0x0359d69Fc421a68b6Ee818F84EA7575f5073E21c` |
| Market 2 (BTC) | `0xaF3638175C66bA5B4aEd255A1d266504D3df31a3` |
| OutcomeToken 2 | `0x9D84d61C9e6eb38bd4227F0Dd3b9Bd8ac13F792A` |

### BNB Testnet (Chain 97) - V4.6 (Lock-on-Sell)
| Contract | Address |
|----------|---------|
| MockUSDC | `0x89BA3FEe2FB764Ec297DC91bb874aa5bF88F204c` |
| GovernorVault | `0xEB33E2f815306D936d4bDD2b33b2b68C16b62Fa0` |
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
| GovernorVault | `0xdb0063ce93e445ff7a8916f6f5a093f80833494f` |
| TraderVaultV4 | `0xdc980ac16626211a7c472a94a163440eb68c5bfc` |
| Market 1 | `0x99CB8c0e3da2604518b8210589edcaB50Cc6f769` |
| Market 2 | `0x94D02d846a04A751e9e4f93A6684a30e043444Da` |
| LaunchpadFactory | `0x844C46bDfC2994e2CC7C559d2Ab8F340E54522fD` |
| LaunchpadMarketImpl | `0x5A77630Fd17F72Fe6f6fAF1dA8ceab8CFb8213C3` |
| LaunchpadOutcomeTokenImpl | `0xf2b16B964F0e413EB7c89129aacDf3D7de8096f0` |

## Pending/Blocked
- [ ] **Launchpad V5**: Deploy to testnet (contracts ready, 17 tests passing)
- [ ] **V5 Frontend**: Commit frontend overhaul changes (Session 4 - uncommitted)
- [ ] Monad testnet deployment (awaiting funds)
- [ ] MegaETH frontend verification on mobile
- [ ] Commit + push worktree changes (new market addresses, config v4.10)
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
