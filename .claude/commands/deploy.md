# Deploy Workflow - V9.9.6

Deploy Sooth Protocol V9.9.6 contracts to testnet.

## Prerequisites

- Foundry installed (`forge`, `cast`)
- Private key in `.env` or environment
- RPC URL for target network
- Sufficient native token for gas
- USDC for test market initialization (~700 USDC)

## Environment Setup

```bash
cd packages/contracts-core

# Required environment variables in .env:
# PRIVATE_KEY=0x...
# BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
# BASESCAN_API_KEY=...  # Optional, for verification
```

## V9.9.6 Deployment Commands

### Step 1: Dry Run (Simulation)

Test deployment without broadcasting:

```bash
forge script script/1_DeployCoreV996.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  -vvv
```

**Expected**: Script runs successfully, shows gas estimates

### Step 2: Deploy Core Contracts

Deploy V9.9.6 core infrastructure:

```bash
forge script script/1_DeployCoreV996.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvv
```

**Deploys**:
- Collateralizer
- AMMEngine
- TickBookVault
- TickBookPoolManager (V9.9.6)
- LaunchpadEngine

**Output**: Contract addresses in console.

### Step 3: Update Deployment Artifacts

Manually update the deployment JSON for the target network:
`packages/contracts-core/deployments/v9-{network}.json`

### Step 4: Sync to Frontend

```bash
# From repo root
./sync-deployments.sh
```

## Post-Deployment (MANDATORY)

### 1. Verify Deployment

Check that contracts are live and linked:

```bash
./script/verify-deployment.sh
```

### 2. Update markets.json (If needed)

If deploying a fresh test market, use the interactive CLI:

```bash
cd ../contracts-testing
bun run script/interactive/interactive-test.ts --chain=baseSepolia
# > createmarket ALIEN 1000
```

## Troubleshooting

### "UnauthorizedRegistrar"

**Cause**: TickBookPoolManager's registrar role was not set correctly to LaunchpadEngine.

**Solution**: The deploy script handles this automatically, but you can verify with:
```bash
cast call $TICKBOOK "registrar()" --rpc-url $RPC
```

### "USDC: insufficient allowance"

**Cause**: Attempting to graduate a market or add liquidity without approving USDC.

**Solution**: Approve LaunchpadEngine to spend your USDC.

## Success Criteria

Deployment is successful when:
- ✅ All 5 core contracts deployed and verified
- ✅ `verify-deployment.sh` passes
- ✅ `./sync-deployments.sh` updates frontend
- ✅ Test trade executes successfully via `usePlaceOrder` hook

