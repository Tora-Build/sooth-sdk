Sync deployment artifacts after contract deployment.

**Steps**:
1. Run `./script/verify-deployment.sh` to validate on-chain state
2. Update `apps/web/src/config/deployments.json`
3. Update `apps/web/src/config/markets.json` if needed
4. Bump `version` field to trigger frontend cache refresh
5. Run `./sync-deployments.sh`
