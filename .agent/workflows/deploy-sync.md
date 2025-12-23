---
description: How to sync V8 contract deployments to the frontend and verify consistency.
---
# Sync Deployments Workflow - V8

Use this workflow after any V8 contract deployment to ensure the frontend is using the correct addresses.

## Prerequisites

- V8 contracts deployed successfully
- `deployments/v8-latest.json` exists
- Frontend config structure ready

## 1. Verify Deployment Output

Check that deployment artifacts exist:

```bash
cd packages/contracts-evm

# Check core deployment
cat deployments/v8-latest.json

# Check test market (if deployed)
cat deployments/test-market-latest.json
```

**Expected**: JSON files with all contract addresses

## 2. Verify On-Chain State (MANDATORY)

Verify contracts are live and properly initialized:

```bash
// turbo
cd packages/contracts-evm

# Set environment
source .env

# Verify core contracts
echo "Checking LaunchpadEngine..."
cast call $LAUNCHPAD_ENGINE "owner()" --rpc-url $BASE_SEPOLIA_RPC_URL

echo "Checking Collateralizer..."
cast call $COLLATERALIZER "usdc()" --rpc-url $BASE_SEPOLIA_RPC_URL

echo "Checking AMMEngine..."
cast call $AMM_ENGINE "usdc()" --rpc-url $BASE_SEPOLIA_RPC_URL

# If test market deployed, verify it
if [ -n "$MARKET" ]; then
  echo "Checking TruthMarket..."
  cast call $MARKET "isLive()" --rpc-url $BASE_SEPOLIA_RPC_URL
  
  echo "Checking LaunchpadEngine initialization..."
  cast call $LAUNCHPAD_ENGINE "isInitialized(address)" $MARKET --rpc-url $BASE_SEPOLIA_RPC_URL
fi
```

**Expected**: All calls return valid data (not `0x`)

**Do NOT proceed if any check fails.**

## 3. Update Frontend Config

Manually update `apps/web/src/config/deployments.json`:

```json
{
  "version": "8.0.0",
  "lastUpdated": "2025-12-23T20:00:00Z",
  "networks": {
    "84532": {
      "name": "Base Sepolia",
      "rpcUrl": "https://sepolia.base.org",
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

**Important**: 
- Update `"version"` to trigger browser cache refresh
- Update `"lastUpdated"` timestamp
- Copy addresses from `deployments/v8-latest.json`

## 4. Update Markets Configuration (If Test Market Deployed)

Update `apps/web/src/config/markets.json`:

```json
{
  "version": "8.0.0",
  "markets": [
    {
      "chainId": 84532,
      "address": "0x...",
      "question": "Will ETH > $5000 by EOY 2025?",
      "deadline": 1735689600,
      "creator": "0x...",
      "isActive": true
    }
  ]
}
```

**Copy from**: `deployments/test-market-latest.json`

## 5. Run Sync Script (Optional)

If you have a sync script, run it:

```bash
// turbo
cd ../..
./sync-deployments.sh
```

**Note**: This may need updating for V8 structure

## 6. Verify Frontend Config

Check that frontend can load the config:

```bash
cd apps/web

# Start dev server
npm run dev

# In browser, check console for:
# - No "Contract not found" errors
# - Correct addresses loaded
# - Markets list populated
```

## 7. Test Contract Reads

Verify frontend can read from deployed contracts:

```bash
# Open browser dev tools
# Navigate to market page
# Check Network tab for successful contract calls:
# - LaunchpadEngine.getBBase()
# - LaunchpadEngine.isGraduated()
# - TruthMarket.isLive()
# - Collateralizer.getMarketTokens()
```

**Expected**: All contract calls return valid data

## 8. Update ABIs (If Contracts Changed)

If you modified V8 contracts, update ABIs:

```bash
cd packages/contracts-evm

# Generate ABIs
forge build

# Copy to frontend
cp out/LaunchpadEngine.sol/LaunchpadEngine.json ../apps/web/src/config/abis/
cp out/AMMEngine.sol/AMMEngine.json ../apps/web/src/config/abis/
cp out/TickBook.sol/TickBook.json ../apps/web/src/config/abis/
cp out/Collateralizer.sol/Collateralizer.json ../apps/web/src/config/abis/
cp out/TruthMarket.sol/TruthMarket.json ../apps/web/src/config/abis/
```

**Or** update `apps/web/src/config/abis.ts` manually

## 9. Update Documentation

Update project documentation:

### STATUS.md
```markdown
## V8 Deployment

- **Date**: 2025-12-23
- **Network**: Base Sepolia (84532)
- **Contracts**:
  - LaunchpadEngine: 0x...
  - Collateralizer: 0x...
  - AMMEngine: 0x...
  - TickBook: 0x...
  - OutcomeToken: 0x...
- **Test Market**: 0x... (if deployed)
- **Status**: ✅ Verified
```

### CHANGELOG.md
```markdown
## [8.0.0] - 2025-12-23

### Deployed
- V8 core contracts to Base Sepolia
- LaunchpadEngine with creator economics
- Test market: "Will ETH > $5000 by EOY 2025?"

### Changed
- Removed TraderVaultLite (direct USDC transfers)
- Added LaunchpadEngine for creator deposits
- Updated frontend config for V8
```

## 10. Notify Team

After successful sync:

1. **Commit changes**:
   ```bash
   git add apps/web/src/config/deployments.json
   git add apps/web/src/config/markets.json
   git commit -m "feat: deploy V8 contracts to Base Sepolia"
   git push
   ```

2. **Notify users** to hard refresh:
   - Chrome/Edge: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Firefox: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)

3. **Update Discord/Slack** with deployment details

## Troubleshooting

### Frontend shows "Contract not found"

**Solution**: 
1. Check `deployments.json` has correct addresses
2. Verify `chainId` matches (84532 for Base Sepolia)
3. Hard refresh browser

### Contract calls return `0x`

**Solution**:
1. Verify contracts deployed to correct network
2. Check RPC URL is correct
3. Verify addresses on block explorer

### "Version mismatch" errors

**Solution**:
1. Update `version` field in `deployments.json`
2. Hard refresh browser to clear cache

### Markets not showing

**Solution**:
1. Check `markets.json` has correct market addresses
2. Verify `chainId` matches selected network
3. Check market `isActive: true`

## V8-Specific Checks

### LaunchpadEngine
```bash
# Check initialized
cast call $LAUNCHPAD_ENGINE "isInitialized(address)" $MARKET --rpc-url $RPC_URL

# Check bBase
cast call $LAUNCHPAD_ENGINE "getBBase(address)" $MARKET --rpc-url $RPC_URL

# Check graduated
cast call $LAUNCHPAD_ENGINE "isGraduated(address)" $MARKET --rpc-url $RPC_URL
```

### TruthMarket
```bash
# Check live
cast call $MARKET "isLive()" --rpc-url $RPC_URL

# Check creator
cast call $MARKET "creator()" --rpc-url $RPC_URL

# Check adjudicator
cast call $MARKET "adjudicator()" --rpc-url $RPC_URL
```

### Collateralizer
```bash
# Check market tokens
cast call $COLLATERALIZER "getMarketTokens(address)" $MARKET --rpc-url $RPC_URL
```

## Success Criteria

Deployment sync is successful when:
- ✅ All on-chain verification checks pass
- ✅ Frontend config updated with V8 addresses
- ✅ Markets config updated (if applicable)
- ✅ Frontend loads without errors
- ✅ Contract reads work in browser
- ✅ Test trade executes successfully
- ✅ Documentation updated
- ✅ Team notified

## Quick Reference

**Verify deployment**:
```bash
cd packages/contracts-evm
source .env
cast call $LAUNCHPAD_ENGINE "owner()" --rpc-url $BASE_SEPOLIA_RPC_URL
```

**Update frontend**:
```bash
# Edit apps/web/src/config/deployments.json
# Update version and addresses
```

**Test frontend**:
```bash
cd apps/web
npm run dev
# Open browser, test market page
```

---

**V8 deployment sync complete!** ✅
