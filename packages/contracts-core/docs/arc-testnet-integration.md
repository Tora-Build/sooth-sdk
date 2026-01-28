# Arc Testnet Integration

## Overview

Arc is a Circle-backed EVM chain with **native USDC as the gas token**. Sub-second finality (~350ms), 3,000+ TPS with 20 validators.

## Network Details

| Property | Value |
|----------|-------|
| **Chain ID** | `5042002` |
| **Network Name** | Arc Testnet |
| **Native Currency** | USDC (gas token) |
| **RPC Endpoint** | https://rpc.testnet.arc.network |
| **Block Explorer** | https://testnet.arcscan.app |
| **Faucet** | https://faucet.circle.com |

## Gas Configuration

Arc uses USDC for gas fees, targeting ~$0.01 per transaction.

## Key Contract Addresses

| Contract | Address |
|----------|---------|
| **USDC** | `0x3600000000000000000000000000000000000000` |
| **EURC** | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| **Multicall3** | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| **CREATE2** | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

## Deployment Considerations

### Using Native USDC vs MockUSDC

Arc has native USDC at a predefined address. For deployment:

1. **Option A (Recommended for testnet showcase)**: Use native USDC
   - Address: `0x3600000000000000000000000000000000000000`
   - Decimals: 6 (standard USDC)
   - Get test USDC from Circle faucet

2. **Option B (Full control)**: Deploy MockUSDC
   - Same as other testnets
   - Unlimited minting for testing

### Deployment Script Usage

```bash
# Deploy to Arc Testnet
cd packages/contracts-core
bun run script/deploy-multichain.ts --chains=arcTestnet

# Or using Foundry directly
forge script script/1_DeployCore.s.sol \
  --rpc-url arcTestnet \
  --broadcast \
  --profile arc

# Verify contracts
forge verify-contract <ADDRESS> <CONTRACT> \
  --verifier blockscout \
  --verifier-url https://testnet.arcscan.app/api \
  --chain-id 5041490
```

## Files Modified

| File | Changes |
|------|---------|
| `packages/contracts-core/script/chainConfigs.ts` | Added `arcTestnet` chain + config |
| `packages/contracts-core/foundry.toml` | Added `arcTestnet` RPC + `[profile.arc]` |
| `packages/contracts-core/deployments/v9-arcTestnet.json` | Deployment template |
| `apps/web/src/lib/chains.ts` | Added Arc chain definitions |
| `apps/web/src/lib/wagmi.ts` | Added Arc transport config |
| `apps/web/src/hooks/useDeployments.ts` | Added Arc to CHAIN_ID_MAP |

## Next Steps

1. **Get testnet ETH**: Fund deployer wallet from faucet
2. **Get testnet USDC**: Use Circle faucet at https://faucet.circle.com
3. **Deploy contracts**: Use multichain script or Foundry directly
4. **Sync frontend**: Run `/deploy-sync` workflow after deployment
5. **Verify contracts**: Use Arcscan verification

## Monitoring

- **Gas Tracker**: https://testnet.arcscan.app/gas-tracker
- **Block Explorer**: https://testnet.arcscan.app

## References

- [Arc Docs - Connect to Arc](https://docs.arc.network/arc/references/connect-to-arc)
- [Arc Docs - Contract Addresses](https://docs.arc.network/arc/references/contract-addresses)
- [Arc Docs - Gas and Fees](https://docs.arc.network/arc/references/gas-and-fees)
- [Circle Faucet](https://faucet.circle.com)
