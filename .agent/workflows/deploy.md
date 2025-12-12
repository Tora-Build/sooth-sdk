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

## Post-Deployment (MANDATORY - DO NOT SKIP)

> ⚠️ **Read `.agent/LESSONS_LEARNED.md` before deploying!**
> Past mistakes: DeployFreshV4 had broken constructor args, caused zombie contracts.

### 1. Run Verification Script

```bash
// turbo
cd packages/contracts-evm
./script/verify-deployment.sh
```

**If this fails, STOP and fix before proceeding.**

This validates:
- All addresses have code on-chain
- TraderVault.asset() matches USDC
- Markets are linked to correct Vault
- Vault.isMarket() returns true

### 2. Update Frontend Config

```bash
# Update deployments.json with new addresses
# UPDATE the "version" field to trigger browser cache refresh!
```

### 3. Run Sync Script

```bash
// turbo
cd ../..
./sync-deployments.sh
```

### 4. Update STATUS.md

Record the deployment in project status.

### 5. Notify User to Hard Refresh


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
