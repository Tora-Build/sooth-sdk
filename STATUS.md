# Project Status

> Last Updated: 2025-12-12 15:32 UTC+7

## Current Focus
- **V4.6 Multi-Chain** — 3 testnets now live: Base Sepolia, BNB, MegaETH ✅
- **Terminology Update** — "Infinite-End" → "Open-End" across all UI

## Recent Changes (2025-12-12)

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

### Base Sepolia (Chain 84532) - V4.5
| Contract | Address |
|----------|---------|
| MockUSDC | `0x3E45bf96a8D866D796E168eE77a5fA7507D544F1` |
| GovernorVault | `0xcB0f1305951d4BC6EF266790836aC62604cFA733` |
| TraderVaultV4 | `0x48Efb2434383E87a4a143D2B07BeE73611f5423C` |
| Market 1 (Alien) | `0x99CB8c0e3da2604518b8210589edcaB50Cc6f769` |
| Market 2 (BTC) | `0x94D02d846a04A751e9e4f93A6684a30e043444Da` |

### BNB Testnet (Chain 97) - V4.5
| Contract | Address |
|----------|---------|
| MockUSDC | `0x58F35BE6A5e3D2be4C3575853043322B02FEeD84` |
| GovernorVault | `0x8629b9ca457F4088ec8346FAED61DA858FDB498d` |
| TraderVaultV4 | `0x50293aD4e42593A8b081960c991c198729E81192` |
| Market 1 (Alien) | `0xa852857A15a10692A5cF22cB2B5b707C8dD64cf8` |
| Market 2 (BTC) | `0x7c60001d89D9878B1f7C4180916fCc3ede592e8d` |

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

## Deployment Notes
- **MegaETH RPC quirk**: `forge script` fails with "intrinsic gas too low"
- **Solution**: Use viem `deployContract` with `gas: 999999999n`
- **Script**: `apps/web/scripts/deploy-megaeth.ts`
