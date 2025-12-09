---
description: How to deploy contracts to testnet
---

# Deploy Workflow

Deploy Sooth Protocol contracts to testnet.

## Prerequisites

- Foundry installed (`forge`, `cast`)
- Private key in `.env` or environment
- RPC URL for target network
- Sufficient native token for gas

## Environment Setup

```bash
cd packages/contracts-evm

# Set environment variables
export PRIVATE_KEY="0x..."
export RPC_URL="https://sepolia.base.org"  # or other network
```

## Deployment Commands

### Dry Run (Simulation)

```bash
// turbo
forge script script/DeployV4Markets.s.sol \
  --rpc-url $RPC_URL \
  -vvv
```

### Broadcast (Live Deployment)

```bash
forge script script/DeployV4Markets.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  -vvv
```

### Verify Contracts (Etherscan)

```bash
forge verify-contract <ADDRESS> SoothMarketV4 \
  --rpc-url $RPC_URL \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

## Post-Deployment

### 1. Verify Deployment

```bash
// turbo
cast code <CONTRACT_ADDRESS> --rpc-url $RPC_URL
# Should return bytecode, not 0x
```

### 2. Sync to Frontend

```bash
// turbo
cd ../..
./sync-deployments.sh
```

### 3. Update STATUS.md

Record the deployment in project status.

## Network Configs

| Network | Chain ID | RPC |
|---------|----------|-----|
| Base Sepolia | 84532 | https://sepolia.base.org |
| Monad Testnet | 10143 | https://testnet-rpc.monad.xyz |

## Troubleshooting

### Out of Gas

- Check `block.gaslimit` on target chain
- Consider lazy initialization patterns
- May need chain with higher gas limit

### Nonce Issues

```bash
cast nonce <ADDRESS> --rpc-url $RPC_URL
```

### Transaction Stuck

```bash
# Speed up with higher gas
forge script ... --gas-price 2gwei
```

## Current Blocker

⚠️ **V4 Deployment Blocked**: `initializeTickCosts()` exceeds gas limit on Base Sepolia. See `DECISIONS.md` ADR-004 for options.
