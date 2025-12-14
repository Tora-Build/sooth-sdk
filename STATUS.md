# Project Status

> Last Updated: 2025-12-14

## Current Focus
- **V4.6 Multi-Chain** — 3 testnets now live: Base Sepolia, BNB, MegaETH ✅
- **Lock-on-Sell Implementation** — Branch `codex/review-and-implement-lock-mechanism` ready (not pushed)
- **Terminology Update** — "Infinite-End" → "Open-End" across all UI
- **Base Sepolia Markets** — Redeployed markets and synced frontend configs ✅

## Recent Changes

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
| Market 1 (Alien) | `0xd2A266c2081C0f2c7c86b5541B9e9b255dde91F9` |
| OutcomeToken 1 | `0xBf2866f71A082446DA6919C92C477d9D1608E4B7` |
| Market 2 (BTC) | `0x3423223043A6815547c0E83ec5c4aE1AeCb0eE02` |
| OutcomeToken 2 | `0xe2A82254C7B831F87e659d3dc3D4dbe2B7De977f` |

### BNB Testnet (Chain 97) - V4.6 (Lock-on-Sell)
| Contract | Address |
|----------|---------|
| MockUSDC | `0x89BA3FEe2FB764Ec297DC91bb874aa5bF88F204c` |
| GovernorVault | `0xEB33E2f815306D936d4bDD2b33b2b68C16b62Fa0` |
| TraderVaultV4 | `0x05818C4028ff5c273B45B3c55131Af2Bd9D12322` |
| FeeController | `0x3152A8cd6CA0C64675C73486B06203a9D8226448` |
| Market 1 (Alien) | `0x347a74a7025C42BE608F3Bdc0B150D4AD6eb4674` |
| OutcomeToken 1 | `0xC69003eEc9B262dd9d5911d4d00133BC73d5f70d` |
| Market 2 (BTC) | `0xD222b33742cA522fa2Ec8198197F3a05ef896B40` |
| OutcomeToken 2 | `0x1A7B20B43455CA6f861a574EcD8F9E5c9cE4e3a3` |

### MegaETH Testnet (Chain 6343) - V4.5 🆕
| Contract | Address |
|----------|---------|
| MockUSDC | `0x493da6e5c9de67ab50b2fb08d14865614189b5c2` |
| GovernorVault | `0xdb0063ce93e445ff7a8916f6f5a093f80833494f` |
| TraderVaultV4 | `0xdc980ac16626211a7c472a94a163440eb68c5bfc` |
| Market 1 (Alien) | `0x89ba3fee2fb764ec297dc91bb874aa5bf88f204c` |
| Market 2 (BTC) | `0xeb33e2f815306d936d4bdd2b33b2b68c16b62fa0` |

## Pending/Blocked
- [ ] Monad testnet deployment (awaiting funds)
- [ ] MegaETH frontend verification on mobile
- [ ] Lock-on-Sell branch: review and push/merge (currently local)
- [ ] Commit + push today's deployment/config sync + frontend fixes
- [ ] Optional: `forge clean` in `packages/contracts-evm` (stale artifact warnings)

## Branch Status
| Branch | Status | Description |
|--------|--------|-------------|
| `main` | Active | V4.5 with Lock-on-Buy |
| `codex/review-and-implement-lock-mechanism` | Local (2 commits ahead) | V4.6 Lock-on-Sell |

## Deployment Notes
- **MegaETH RPC quirk**: `forge script` fails with "intrinsic gas too low"
- **Solution**: Use viem `deployContract` with `gas: 999999999n`
- **Script**: `apps/web/scripts/deploy-megaeth.ts`
- **Foundry dependency**: `prb-math` must be installed in `packages/contracts-evm/lib/` for deploy scripts to compile (`SoothMarketV4` imports `prb-math/sd59x18/*`).
