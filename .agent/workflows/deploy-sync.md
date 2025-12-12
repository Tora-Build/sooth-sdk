---
description: How to sync contract deployments to the frontend and verify consistency.
---
# Sync Deployments Workflow

Use this workflow after any contract deployment (forge script) to ensure the frontend is using the correct addresses.

## 1. Update Canonical Source
If `packages/contracts-evm/deployments.json` is stale, ensure it is updated first (or copy from the successful deployment broadcast).

## 1.5. Verify On-Chain State (MANDATORY)
Run the verification script to catch config errors BEFORE frontend testing:
```bash
cd packages/contracts-evm
./script/verify-deployment.sh
```
This checks:
- All addresses have code on-chain
- TraderVault.asset() matches USDC
- Markets are linked to the correct Vault
- Vault.isMarket() returns true for all markets

**Do NOT proceed if this script fails.**

## 2. Run Sync Script
Execute the sync script to copy the canonical deployment file to all documentation locations:
```bash
./sync-deployments.sh
```

## 3. Verify Frontend Config
The frontend source of truth is `apps/web/src/config/deployments.json`.
Check that it matches the deployment output.
```bash
cd apps/web
npm run validate-config
```

## 4. Update Markets Configuration
Check `apps/web/src/config/markets.json`. If it contains hardcoded addresses (for featured markets), UPDATE THEM MANUALLY.
- `contractAddress`
- `outcomeTokenAddress`

## 5. Update Status Documentation
Update `packages/contracts-evm/docs/technical/frontend-integration/DEPLOYMENT_STATUS.md` with:
- Date of deployment
- Git commit or Version Tag
- Verification status
