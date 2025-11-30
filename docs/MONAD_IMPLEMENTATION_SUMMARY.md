# Monad Testnet Deployment - Implementation Summary

**Date:** November 30, 2025  
**Status:** ✅ Ready for Deployment  
**Chain:** Monad Testnet (Chain ID: 10143)

## Overview

Complete implementation of Sooth Protocol deployment to Monad Testnet with 5 attestation-type markets representing different risk profiles and adjudicator mechanisms.

## What Was Created

### 1. Deployment Script

**File:** `script/DeployMonad.s.sol`

A comprehensive deployment script that:

- Deploys all 7 core protocol contracts
- Registers 5 different adjudicator types
- Creates 5 markets with varying risk classes
- Initializes vault with 500k mUSDC liquidity
- Configures all authorization relationships
- Exports deployment data to JSON files

**Key Features:**

- Automated market creation with risk class assignment
- Comprehensive logging and status reporting
- JSON artifact generation for frontend integration
- Built-in validation and verification

### 2. Configuration Files

#### `foundry.toml` (Updated)

Added Monad testnet RPC endpoint:

```toml
[rpc_endpoints]
base_sepolia = "${RPC_URL}"
monad_testnet = "${MONAD_RPC_URL}"
```

#### `.env.example` (Updated)

Added Monad RPC URL configuration:

```bash
MONAD_RPC_URL=https://testnet.monad.xyz
```

### 3. Deployment Automation

#### `deploy-monad.sh`

Bash script with:

- Pre-flight checks (balance, RPC connectivity)
- Automated deployment execution
- Frontend sync capability
- Error handling and status reporting

**Usage:**

```bash
./deploy-monad.sh
```

### 4. Documentation

#### `docs/MONAD_DEPLOYMENT_PLAN.md`

Comprehensive deployment plan covering:

- Network configuration
- Pre-deployment checklist
- Deployment architecture
- 5 market type specifications
- Post-deployment tasks
- Risk mitigation strategies
- Success metrics
- Timeline estimates

#### `docs/MONAD_DEPLOYMENT_GUIDE.md`

Step-by-step deployment guide with:

- Quick start instructions
- Configuration details
- Deployment options
- Testing procedures
- Frontend integration steps
- Troubleshooting guide
- Network information
- Security considerations

#### `docs/MONAD_DEPLOYMENT_CHECKLIST.md`

Detailed checklist covering:

- Pre-deployment setup
- Deployment execution
- Post-deployment verification
- Functional testing for all 5 markets
- Frontend integration
- Documentation requirements
- Quick command reference

## Market Configuration

### Market 1: BTC Price Market

- **Adjudicator:** UMA Optimistic Oracle
- **Risk Class:** LOW (0.6x multiplier)
- **Expected bMarket:** ~43,269 mUSDC
- **Use Case:** Objective price data verification
- **Question:** "Will BTC price exceed $100k by Dec 31?"

### Market 2: ETH Gas Market

- **Adjudicator:** Chainlink Functions
- **Risk Class:** LOW (0.6x multiplier)
- **Expected bMarket:** ~43,269 mUSDC
- **Use Case:** API-based gas price verification
- **Question:** "Will ETH gas exceed 100 gwei average?"

### Market 3: Monad Launch Market

- **Adjudicator:** Tellor Oracle
- **Risk Class:** MEDIUM (1.0x multiplier)
- **Expected bMarket:** ~72,115 mUSDC
- **Use Case:** Community-reported milestone
- **Question:** "Will Monad mainnet launch in Q1 2026?"

### Market 4: Sooth TVL Market

- **Adjudicator:** Multisig Committee (3-of-5)
- **Risk Class:** HIGH (1.4x multiplier)
- **Expected bMarket:** ~100,961 mUSDC
- **Use Case:** Subjective protocol metric
- **Question:** "Will Sooth Protocol TVL exceed $10M?"

### Market 5: Monad Top 10 Market

- **Adjudicator:** Governance Vote
- **Risk Class:** CRITICAL (1.8x multiplier)
- **Expected bMarket:** ~129,807 mUSDC
- **Use Case:** Highly subjective competitive ranking
- **Question:** "Will Monad become top 10 L1 by TVL?"

## Technical Specifications

### Initial Configuration

- **Mock USDC Supply:** 10,000,000 tokens (18 decimals)
- **Vault Initial Deposit:** 500,000 mUSDC
- **Treasury (T):** 500,000 mUSDC
- **Liquid Buffer (B):** 500,000 mUSDC
- **Max Concurrent Markets (K):** 10
- **Expected bGlobal:** ~72,115 mUSDC

### Risk Multipliers

- **LOW:** 0.6x → ~43k mUSDC liquidity
- **MEDIUM:** 1.0x → ~72k mUSDC liquidity
- **HIGH:** 1.4x → ~101k mUSDC liquidity
- **CRITICAL:** 1.8x → ~130k mUSDC liquidity

### Adjudicator Registry

All 5 adjudicator types registered with:

- Unique class IDs (1-5)
- Mock external contract addresses (testnet)
- Configuration parameters
- Enabled status

## Deployment Outputs

### Generated Files

1. **`deployments-monad.json`** - Contract addresses and network info
2. **`markets-monad.json`** - Market configurations and metadata

### Frontend Integration

Both files can be automatically synced to frontend if `FRONTEND_PATH` is configured in `.env`.

## Build Status

✅ **All contracts compile successfully**

- Solidity version: 0.8.30
- Optimizer: Enabled (200 runs)
- Via IR: Enabled
- No compilation errors

⚠️ **Lint warnings present** (non-blocking):

- ERC20 unchecked transfers (by design)
- Unsafe typecasts (validated as safe)

## Next Steps

### Before Deployment

1. ✅ Verify Monad testnet RPC URL is correct
2. ✅ Obtain testnet MON tokens for gas
3. ✅ Configure `.env` with private key and RPC URL
4. ✅ Test RPC connectivity

### Deployment

1. Run `./deploy-monad.sh`
2. Monitor deployment logs
3. Verify all contracts deployed successfully
4. Confirm JSON artifacts generated

### Post-Deployment

1. Verify contracts on Monad explorer (if available)
2. Test trading on all 5 markets
3. Integrate with frontend
4. Document actual deployment addresses
5. Create deployment summary report

## Risk Considerations

### Testnet Deployment

- ⚠️ This is a **testnet deployment only**
- All tokens are worthless testnet tokens
- Adjudicators are mock implementations
- Not audited for production use

### Operational Risks

- RPC reliability may vary
- Gas costs on Monad may differ from estimates
- Block explorer may not be available immediately
- Faucet availability uncertain

## Success Criteria

Deployment is successful when:

- ✅ All 7 core contracts deployed
- ✅ All 5 markets created and initialized
- ✅ Vault has 500k liquidity
- ✅ All authorizations configured
- ✅ bMarket values within expected ranges
- ✅ Test trades execute successfully
- ✅ Frontend integration complete

## Timeline

**Estimated Time to Deploy:** 30 minutes  
**Estimated Time to Verify:** 2-3 hours  
**Estimated Time to Integrate:** 1-2 hours

**Total:** ~4-6 hours from start to fully functional

## Support Resources

- **Deployment Plan:** `docs/MONAD_DEPLOYMENT_PLAN.md`
- **Deployment Guide:** `docs/MONAD_DEPLOYMENT_GUIDE.md`
- **Deployment Checklist:** `docs/MONAD_DEPLOYMENT_CHECKLIST.md`
- **Main README:** `README.md`

## Notes

- Monad is EVM-compatible, so no contract modifications needed
- Parallel execution may affect gas costs
- Monitor actual vs. expected behavior
- Document any Monad-specific quirks discovered

---

**Implementation Status:** ✅ Complete  
**Ready for Deployment:** ✅ Yes  
**Blockers:** None  
**Dependencies:** Monad testnet access + MON tokens
