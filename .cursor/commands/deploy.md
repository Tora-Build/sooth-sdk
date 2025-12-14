Deploy Sooth Protocol contracts to testnet.

**Preload**: Read `.agent/LESSONS_LEARNED.md` before deploying!

**Steps**:
1. Dry run: `forge script script/DeployV4Markets.s.sol --rpc-url $RPC_URL -vvv`
2. Broadcast: Add `--broadcast` flag
3. Verify: Run `./script/verify-deployment.sh`
4. Then run `/deploy-sync` to update configs
