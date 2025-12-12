# MegaETH Testnet Research

**Date:** 2025-12-06
**Status:** Research Phase

## Network Details

- **Name:** MegaETH Testnet
- **Chain ID:** `6343`
- **Currency Symbol:** `ETH`

### RPC Endpoints

- **Primary:** `https://timothy.megaeth.com/rpc`
- **Alternative:** `https://carrot.megaeth.com/rpc`

### Block Explorers

- **Blockscout:** `https://megaeth-testnet-v2.blockscout.com`
- **Performance Dashboard:** `https://uptime.megaeth.com`

## Bridging & Faucets

- **Bridge:** No dedicated testnet-to-mainnet bridge (testnet is isolated).
- **Cross-Chain:** Compatible with standard EVM tools.
- **Faucets:** [Official Faucet](https://docs.megaeth.com/faucet)

## Integration Notes

- **EVM Compatibility:** Fully EVM compatible. Standard `wagmi` / `viem` / `ethers` setup should work.
- **Performance:** High throughput, low latency. Ideal for high-frequency trading or orderbook updates.

## Action Items

1.  Add network configuration to `apps/web/src/config/deployments.json`.
2.  Add network configuration to `foundry.toml` (if deploying from here).
3.  Acquire testnet ETH for deployment.
