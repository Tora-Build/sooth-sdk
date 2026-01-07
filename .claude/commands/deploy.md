---
description: Deploy Sooth Protocol V10 contracts to testnets
---

# Deploy Workflow - V10

Deploy Sooth Protocol V10 core contracts to testnets using the TypeScript multi-chain deployment script.

## Prerequisites

- Bun installed (`bun --version`)
- Foundry installed (`forge build` to compile contracts)
- Private key in `.env` file
- Sufficient native token for gas on target chains

## Supported Chains

- **Base Sepolia** (chainId: 84532)
- **Monad Testnet** (chainId: 10143)
- **Arc Testnet** (chainId: 5041490)

## Environment Setup

```bash
cd packages/contracts-core

# Required in .env:
# PRIVATE_KEY=0x...
```

## V10 Deployment Commands

### Step 1: Build Contracts

Ensure contracts are compiled:

```bash
forge build
```

### Step 2: Deploy to All Chains

Deploy to all configured chains in parallel:

```bash
bun run script/deploy-multichain.ts
```

### Step 3: Deploy to Specific Chains

Deploy to selected chains only:

```bash
bun run script/deploy-multichain.ts --chains=baseSepolia,monadTestnet
```

**Deploys (V10 Singleton Architecture)**:
- MockUSDC
- Collateralizer
- AMMEngine
- TickBookVault
- TickBookPoolManager
- DynamicFeeHook
- LaunchpadEngine

**Output**: Contract addresses in console and saved to `deployments/{chainName}.json`

### Step 4: Sync to Frontend

```bash
./apps/web/scripts/sync-deployments.sh
```

## Post-Deployment (MANDATORY)

### 1. Verify On-Chain

Check contracts are live:

```bash
source .env
COLLAT=$(jq -r '.contracts.Collateralizer' deployments/baseSepolia.json)
cast call $COLLAT "usdc()" --rpc-url https://sepolia.base.org
```

### 2. Create Markets (If needed)

Use the interactive CLI to create test markets:

```bash
cd ../contracts-testing
bun run script/interactive/interactive-test.ts --chain=baseSepolia
# > createmarket ALIEN 1000
```

Or for Monad:
```bash
pnpm interactive:monad
```

## Chain-Specific Notes

### Monad Testnet
- Uses 10M gas limit for complex contracts
- Min gas price: 100 gwei (script uses 105 gwei)
- Cold access opcodes 4x more expensive

### Arc Testnet
- Min gas price: 160 gwei (script uses 200 gwei)
- Has native USDC at `0x3600000000000000000000000000000000000000`

## Troubleshooting

### "UnauthorizedRegistrar"

**Cause**: TickBookPoolManager's registrar role not set to LaunchpadEngine.

**Solution**: The deploy script handles this automatically. Verify with:
```bash
cast call $TICKBOOK "registrar()" --rpc-url $RPC
```

### "Deployer has zero balance"

**Cause**: Wallet not funded on target chain.

**Solution**: Get testnet tokens from faucets:
- Base Sepolia: https://www.coinbase.com/faucets/base-sepolia-faucet
- Monad: https://faucet.monad.xyz
- Arc: https://faucet.circle.com

### "Artifact not found"

**Cause**: Contracts not compiled.

**Solution**: Run `forge build` first.

## File Structure

```
packages/contracts-core/
  script/
    deploy-multichain.ts    # Main deployment script
    chainConfigs.ts         # Chain configurations
  deployments/
    baseSepolia.json        # Deployment artifact
    monadTestnet.json       # Deployment artifact
    arcTestnet.json         # Deployment artifact
```

## Success Criteria

Deployment is successful when:
- All 7 core contracts deployed per chain
- `deployments/{chainName}.json` created with addresses
- `./apps/web/scripts/sync-deployments.sh` updates frontend
- On-chain verification calls return valid data
- Markets can be created via interactive CLI

