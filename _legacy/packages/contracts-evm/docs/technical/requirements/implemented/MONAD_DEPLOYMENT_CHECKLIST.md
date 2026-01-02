# Monad Deployment Checklist

## Pre-Deployment ☐

### Environment Setup

- [ ] Monad testnet RPC URL verified and accessible
- [ ] Private key configured in `.env`
- [ ] Deployer wallet has testnet MON tokens
- [ ] `foundry.toml` updated with `monad_testnet` endpoint
- [ ] All dependencies installed (`forge install`)

### Testing

- [ ] All tests pass (`forge test`)
- [ ] Contracts compile without errors (`forge build`)
- [ ] Gas estimates reviewed
- [ ] Deployment script dry-run completed

### Documentation Review

- [ ] Read `MONAD_DEPLOYMENT_PLAN.md`
- [ ] Read `MONAD_DEPLOYMENT_GUIDE.md`
- [ ] Understand 5 market configurations
- [ ] Understand risk class system

## Deployment ☑

### Execute Deployment

- [x] Run `./deploy-monad.sh` or forge script
- [x] Monitor deployment logs for errors
- [x] Verify all 7 core contracts deployed
- [x] Verify all 5 markets created
- [x] Confirm vault initialized with 500k liquidity

### Verify Outputs

- [x] `deployments-monad.json` generated
- [x] `markets-monad.json` generated
- [x] All contract addresses are valid
- [x] All market IDs are sequential (1-5)
- [x] bMarket values match expected ranges

## Post-Deployment ☐

### Contract Verification

- [ ] Verify MockERC20 on explorer
- [ ] Verify SoothVault on explorer
- [ ] Verify SoothRiskManager on explorer
- [ ] Verify SoothLMSRReal on explorer
- [ ] Verify SoothAdjudicatorRegistry on explorer
- [ ] Verify SoothSettlement on explorer
- [ ] Verify SoothMarketFactory on explorer

### Functional Testing

#### Vault Operations

- [ ] Test LP deposit
- [ ] Test LP withdrawal
- [ ] Verify totalAssets calculation
- [ ] Verify locked exposure tracking
- [ ] Check ERC20 share token functions

#### Market 1: BTC Price (UMA, LOW)

- [ ] Execute buy YES trade
- [ ] Execute buy NO trade
- [ ] Execute sell YES trade
- [ ] Execute sell NO trade
- [ ] Verify slippage protection works
- [ ] Check bMarket = ~43k mUSDC

#### Market 2: ETH Gas (Chainlink, LOW)

- [ ] Execute buy YES trade
- [ ] Execute buy NO trade
- [ ] Execute sell YES trade
- [ ] Execute sell NO trade
- [ ] Verify slippage protection works
- [ ] Check bMarket = ~43k mUSDC

#### Market 3: Monad Launch (Tellor, MEDIUM)

- [ ] Execute buy YES trade
- [ ] Execute buy NO trade
- [ ] Execute sell YES trade
- [ ] Execute sell NO trade
- [ ] Verify slippage protection works
- [ ] Check bMarket = ~72k mUSDC

#### Market 4: Sooth TVL (Multisig, HIGH)

- [ ] Execute buy YES trade
- [ ] Execute buy NO trade
- [ ] Execute sell YES trade
- [ ] Execute sell NO trade
- [ ] Verify slippage protection works
- [ ] Check bMarket = ~101k mUSDC

#### Market 5: Monad Top 10 (Governance, CRITICAL)

- [ ] Execute buy YES trade
- [ ] Execute buy NO trade
- [ ] Execute sell YES trade
- [ ] Execute sell NO trade
- [ ] Verify slippage protection works
- [ ] Check bMarket = ~130k mUSDC

#### Risk Manager

- [ ] Verify bGlobal calculation
- [ ] Test updateGlobalB() function
- [ ] Verify risk class multipliers apply correctly
- [ ] Test setMarketRiskClass() authorization
- [ ] Check reserve boost calculation

#### Settlement (Mock Testing)

- [ ] Test settlement flow (if possible)
- [ ] Verify PnL application
- [ ] Check exposure release
- [ ] Verify market reserves update

### Frontend Integration

- [ ] Copy `deployments-monad.json` to frontend
- [ ] Copy `markets-monad.json` to frontend
- [ ] Add Monad network to frontend config
- [ ] Test wallet connection to Monad
- [ ] Verify all markets display correctly
- [ ] Test trading UI on all 5 markets
- [ ] Test LP dashboard functionality

### Documentation

- [ ] Create `MONAD_DEPLOYMENT_SUMMARY.md`
- [ ] Document actual deployment addresses
- [ ] Document actual bMarket values
- [ ] Document any deployment issues encountered
- [ ] Update main README with Monad info
- [ ] Add Monad to supported networks list

### Monitoring Setup

- [ ] Set up block explorer bookmarks
- [ ] Monitor vault totalAssets
- [ ] Monitor market reserves
- [ ] Track trading volume per market
- [ ] Monitor gas costs

## Validation ☐

### Security Checks

- [ ] Verify all authorization relationships
- [ ] Check vault can't be drained
- [ ] Verify markets can't exceed exposure limits
- [ ] Test unauthorized access reverts
- [ ] Verify slippage protection prevents exploits

### Economic Checks

- [ ] Verify 1:1 LP share conversion
- [ ] Check market reserves don't affect LP value
- [ ] Verify exposure allocation works correctly
- [ ] Test liquidity buffer calculations
- [ ] Verify bGlobal updates correctly

### Edge Cases

- [ ] Test trading with 0 liquidity (should fail)
- [ ] Test withdrawal exceeding available buffer (should fail)
- [ ] Test selling more shares than owned (should fail)
- [ ] Test extreme slippage scenarios
- [ ] Test market creation when buffer exhausted

## Completion ☐

### Final Review

- [ ] All contracts deployed and verified
- [ ] All 5 markets functional
- [ ] Frontend integrated and tested
- [ ] Documentation complete
- [ ] No critical issues outstanding

### Handoff

- [ ] Share deployment summary with team
- [ ] Update project status
- [ ] Archive deployment logs
- [ ] Document lessons learned
- [ ] Plan for mainnet deployment (future)

---

## Quick Commands Reference

### Check Deployer Balance

```bash
cast balance $(cast wallet address --private-key $PRIVATE_KEY) --rpc-url $MONAD_RPC_URL
```

### Deploy

```bash
./deploy-monad.sh
```

### Verify Contract

```bash
forge verify-contract <ADDRESS> <CONTRACT_NAME> --chain-id 10143 --rpc-url monad_testnet
```

### Check Vault Status

```bash
cast call <VAULT_ADDRESS> "totalAssets()" --rpc-url monad_testnet
```

### Check Market bParam

```bash
cast call <RISK_MANAGER_ADDRESS> "getBForMarket(uint256)" <MARKET_ID> --rpc-url monad_testnet
```

### Execute Trade

```bash
cast send <MARKET_ADDRESS> "trade(uint8,int256,int256)" 0 <SHARES> <MAX_COST> --rpc-url monad_testnet --private-key $PRIVATE_KEY
```

---

**Date Started:** **\*\***\_**\*\***

**Date Completed:** **\*\***\_**\*\***

**Deployed By:** **\*\***\_**\*\***

**Notes:**
