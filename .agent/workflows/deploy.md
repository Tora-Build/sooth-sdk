# Deploy Workflow - V8

Deploy Sooth Protocol V8 contracts to testnet.

## Prerequisites

- Foundry installed (`forge`, `cast`)
- Private key in `.env` or environment
- RPC URL for target network
- Sufficient native token for gas
- USDC for test market initialization (~700 USDC)

## Environment Setup

```bash
cd packages/contracts-evm

# Required environment variables in .env:
# PRIVATE_KEY=0x...
# BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
# USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
# GUARDIAN_ADDRESS=0x...
# DEFAULT_ADJUDICATOR=0x...
# BASESCAN_API_KEY=...  # Optional, for verification
```

## V8 Deployment Commands

### Step 1: Dry Run (Simulation)

Test deployment without broadcasting:

```bash
// turbo
forge script script/DeployV8.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  -vvv
```

**Expected**: Script runs successfully, shows gas estimates

### Step 2: Deploy Core Contracts

Deploy V8 core infrastructure:

```bash
forge script script/DeployV8.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvv
```

**Deploys**:
- OutcomeToken (implementation)
- Collateralizer
- AMMEngine
- TickBook
- LaunchpadEngine

**Output**: `deployments/v8-latest.json`

### Step 3: Update Environment

After core deployment, add to `.env`:

```bash
export LAUNCHPAD_ENGINE=0x...  # From deployment output
export COLLATERALIZER=0x...    # From deployment output
```

### Step 4: Deploy Test Market (Optional)

**⚠️ Requires ~700 USDC in deployer wallet**

```bash
forge script script/DeployTestMarket.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvv
```

**Creates**:
- TruthMarket with 7-day deadline
- Registers with Collateralizer
- Activates market
- Initializes LaunchpadEngine with $1k liquidity

**Output**: `deployments/test-market-latest.json`

## Post-Deployment (MANDATORY - DO NOT SKIP)

### 1. Verify Deployment

Check that contracts are live and initialized:

```bash
// turbo
# Check market is live
cast call $MARKET "isLive()" --rpc-url $BASE_SEPOLIA_RPC_URL

# Check LaunchpadEngine initialized
cast call $LAUNCHPAD_ENGINE "isInitialized(address)" $MARKET --rpc-url $BASE_SEPOLIA_RPC_URL

# Check Collateralizer has market tokens
cast call $COLLATERALIZER "getMarketTokens(address)" $MARKET --rpc-url $BASE_SEPOLIA_RPC_URL
```

**Expected**: All return `true` or valid addresses

### 2. Update Frontend Config

```bash
# Update apps/web/src/config/deployments.json with V8 addresses
# from deployments/v8-latest.json
```

**Important**: Update the `"version"` field to trigger browser cache refresh!

Example:
```json
{
  "version": "8.0.0",
  "networks": {
    "84532": {
      "name": "Base Sepolia",
      "contracts": {
        "LaunchpadEngine": "0x...",
        "Collateralizer": "0x...",
        "AMMEngine": "0x...",
        "TickBook": "0x...",
        "OutcomeToken": "0x..."
      }
    }
  }
}
```

### 3. Run Sync Script

```bash
// turbo
cd ../..
./sync-deployments.sh
```

### 4. Update STATUS.md

Record the V8 deployment in project status:
- Deployment date
- Network (Base Sepolia)
- Contract addresses
- Test market address

### 5. Notify User to Hard Refresh

After updating frontend config, users must hard refresh browser:
- Chrome/Edge: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Firefox: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)

## Network Configs

| Network | Chain ID | RPC | USDC Address |
|---------|----------|-----|--------------|
| Base Sepolia | 84532 | https://sepolia.base.org | 0x036CbD53842c5426634e7929541eC2318f3dCF7e |
| Monad Testnet | 10143 | https://testnet-rpc.monad.xyz | TBD |

## Troubleshooting

### "USDC address required"

**Solution**: Set `USDC_ADDRESS` in `.env`:
```bash
export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e  # Base Sepolia
```

### "Guardian address required"

**Solution**: Set `GUARDIAN_ADDRESS` in `.env` (can be your own address for testing):
```bash
export GUARDIAN_ADDRESS=0x...  # Your address
```

### "Insufficient USDC balance" (Test Market)

**Solution**: Get USDC from faucet or bridge:
- Base Sepolia Faucet: https://faucet.quicknode.com/base/sepolia
- Or bridge from mainnet

### Nonce Issues

```bash
cast nonce <ADDRESS> --rpc-url $BASE_SEPOLIA_RPC_URL
```

### Transaction Stuck

```bash
# Speed up with higher gas
forge script ... --gas-price 2gwei
```

### Verification Failed

**Solution**:
1. Check `BASESCAN_API_KEY` is set
2. Wait 30 seconds after deployment
3. Manually verify on Basescan if needed

## Gas Estimates

| Contract | Deployment Gas | USD (50 gwei, $3k ETH) |
|----------|----------------|------------------------|
| OutcomeToken | ~800k | ~$12 |
| Collateralizer | ~2.5M | ~$37 |
| AMMEngine | ~1.8M | ~$27 |
| TickBook | ~3.2M | ~$48 |
| LaunchpadEngine | ~2.8M | ~$42 |
| TruthMarket | ~1.2M | ~$18 |
| **Total** | **~12.3M** | **~$184** |

**Note**: Base Sepolia is cheap/free for testing

## V8 Architecture

V8 deployment creates this stack:

```
TruthMarket (per market)
    ↓ queries
LaunchpadEngine (creator economics)
    ↓ delegates to
AMMEngine + TickBook (trading venues)
    ↓ uses
Collateralizer + OutcomeToken (token management)
```

## Success Criteria

Deployment is successful when:
- ✅ All 5 core contracts deployed and verified
- ✅ `deployments/v8-latest.json` created
- ✅ Test market created and initialized (if deployed)
- ✅ All verification checks pass
- ✅ Frontend config updated
- ✅ Test trade executes successfully

## Next Steps

After successful deployment:

1. **Test on Frontend**:
   - Start dev server: `cd apps/web && npm run dev`
   - Navigate to market
   - Test AMM trade
   - Test operator console (if you're creator)

2. **Deploy More Markets**:
   - Modify `DeployTestMarket.s.sol` with new questions
   - Run deployment script again

3. **Begin Frontend Development**:
   - Follow `apps/web/docs/V7_TO_V8_MIGRATION_GUIDE.md`
   - Start with Week 1: Foundation

## Differences from V7

V8 deployment is simpler:
- ❌ No TraderVault (removed)
- ❌ No complex vault initialization
- ✅ Direct USDC transfers
- ✅ LaunchpadEngine handles creator economics
- ✅ Cleaner architecture

## Quick Reference

**Core Deployment**:
```bash
forge script script/DeployV8.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify -vvv
```

**Test Market**:
```bash
forge script script/DeployTestMarket.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify -vvv
```

**Verify**:
```bash
cast call $MARKET "isLive()" --rpc-url $BASE_SEPOLIA_RPC_URL
```

---

**V8 is ready to deploy!** 🚀
