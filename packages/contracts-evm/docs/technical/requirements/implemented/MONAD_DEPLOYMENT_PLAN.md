# Monad Testnet Deployment Plan

## Overview

Deploy the complete Sooth Protocol to Monad Testnet (Chain ID: 10143) with 5 attestation-type markets representing different risk profiles and use cases.

## Network Configuration

### Monad Testnet Details

- **Chain ID:** 10143
- **Network Name:** Monad Testnet
- **RPC URL:** https://testnet.monad.xyz (to be verified)
- **Block Explorer:** TBD
- **Native Token:** MON (testnet)

## Pre-Deployment Checklist

### 1. Environment Setup

- [ ] Add Monad testnet RPC endpoint to `foundry.toml`
- [ ] Update `.env` with Monad-specific configuration
- [ ] Obtain testnet MON tokens for deployment gas
- [ ] Verify deployer wallet has sufficient MON balance
- [ ] Test RPC connectivity

### 2. Contract Preparation

- [ ] Verify all contracts compile with Solidity 0.8.30
- [ ] Run full test suite to ensure contract integrity
- [ ] Review gas optimization settings for Monad's gas model
- [ ] Confirm PRBMath library compatibility

### 3. Deployment Script Creation

- [ ] Create `DeployMonad.s.sol` deployment script
- [ ] Implement 5 attestation market configurations
- [ ] Add Monad-specific deployment parameters
- [ ] Create `deployments-monad.json` output file
- [ ] Create `markets-monad.json` market registry

## Deployment Architecture

### Core Protocol Contracts

1. **MockERC20** - Testnet USDC equivalent (18 decimals)
2. **SoothVault** - ERC4626 vault for liquidity management
3. **SoothRiskManager** - Dynamic liquidity parameter calculator
4. **SoothLMSRReal** - LMSR AMM implementation
5. **SoothAdjudicatorRegistry** - Attestation provider registry
6. **SoothSettlement** - Settlement and payout engine
7. **SoothMarketFactory** - Market creation factory

### Initial Liquidity Configuration

- **Initial Mint:** 10,000,000 mUSDC (10M tokens)
- **Vault Deposit:** 500,000 mUSDC (500k tokens)
- **Treasury (T):** 500,000 mUSDC
- **Liquid Buffer (B):** 500,000 mUSDC
- **Max Concurrent Markets (K):** 10
- **Expected bGlobal:** ~72,115 mUSDC (based on K=10)

## Five Attestation Market Types

### Market 1: UMA Optimistic Oracle (LOW RISK)

- **Adjudicator Type:** UMA Optimistic Oracle
- **Risk Class:** `LOW` (0.6x multiplier)
- **Use Case:** Objective, verifiable data (e.g., "Will BTC price exceed $100k by Dec 31?")
- **Expected bMarket:** ~43,269 mUSDC
- **Initial Quantity:** 1000 shares per side
- **Adjudicator ID:** `keccak256("UMA_OPTIMISTIC")`

### Market 2: Chainlink Functions (LOW RISK)

- **Adjudicator Type:** Chainlink Functions
- **Risk Class:** `LOW` (0.6x multiplier)
- **Use Case:** API-based data verification (e.g., "Will ETH gas exceed 100 gwei average?")
- **Expected bMarket:** ~43,269 mUSDC
- **Initial Quantity:** 1000 shares per side
- **Adjudicator ID:** `keccak256("CHAINLINK_FUNCTIONS")`

### Market 3: Tellor Oracle (MEDIUM RISK)

- **Adjudicator Type:** Tellor Oracle
- **Risk Class:** `MEDIUM` (1.0x multiplier)
- **Use Case:** Community-reported data (e.g., "Will Monad mainnet launch in Q1 2026?")
- **Expected bMarket:** ~72,115 mUSDC
- **Initial Quantity:** 1000 shares per side
- **Adjudicator ID:** `keccak256("TELLOR_ORACLE")`

### Market 4: Multisig Committee (HIGH RISK)

- **Adjudicator Type:** 3-of-5 Multisig
- **Risk Class:** `HIGH` (1.4x multiplier)
- **Use Case:** Subjective outcomes (e.g., "Will Sooth Protocol TVL exceed $10M?")
- **Expected bMarket:** ~100,961 mUSDC
- **Initial Quantity:** 1000 shares per side
- **Adjudicator ID:** `keccak256("MULTISIG_COMMITTEE")`

### Market 5: Governance Vote (CRITICAL RISK)

- **Adjudicator Type:** On-chain Governance
- **Risk Class:** `CRITICAL` (1.8x multiplier)
- **Use Case:** Highly subjective/contentious (e.g., "Will Monad become top 10 L1 by TVL?")
- **Expected bMarket:** ~129,807 mUSDC
- **Initial Quantity:** 1000 shares per side
- **Adjudicator ID:** `keccak256("GOVERNANCE_VOTE")`

## Deployment Script Structure

### Script: `DeployMonad.s.sol`

```solidity
// Key Features:
// 1. Deploy all core contracts
// 2. Register 5 adjudicator types
// 3. Create 5 markets with different risk classes
// 4. Initialize vault with 500k liquidity
// 5. Authorize all necessary contracts
// 6. Export deployments to monad-specific JSON files
// 7. Log comprehensive deployment summary
```

### Output Files

1. **`deployments-monad.json`** - Contract addresses
2. **`markets-monad.json`** - Market configurations and metadata
3. **`monad-deployment-summary.md`** - Human-readable deployment report

## Post-Deployment Tasks

### 1. Verification

- [ ] Verify all contract deployments on Monad explorer
- [ ] Test vault deposit/withdrawal flows
- [ ] Execute test trades on each market
- [ ] Verify bMarket calculations for each risk class
- [ ] Confirm adjudicator registry entries

### 2. Documentation

- [ ] Update README with Monad deployment info
- [ ] Create Monad-specific integration guide
- [ ] Document adjudicator configurations
- [ ] Add Monad testnet to supported networks list

### 3. Frontend Integration

- [ ] Add Monad network to frontend configuration
- [ ] Import `deployments-monad.json` to dApp
- [ ] Import `markets-monad.json` to dApp
- [ ] Test wallet connection to Monad testnet
- [ ] Verify all market interactions work

### 4. Testing & Validation

- [ ] Execute buy trades on all 5 markets
- [ ] Execute sell trades on all 5 markets
- [ ] Test LP deposit/withdrawal
- [ ] Verify slippage protection
- [ ] Test settlement flow (mock adjudication)

## Risk Mitigation

### Deployment Risks

- **Gas Price Volatility:** Monitor Monad gas prices, deploy during low-activity periods
- **RPC Reliability:** Have backup RPC endpoints configured
- **Contract Size:** Verify contracts fit within Monad's size limits
- **Nonce Management:** Use sequential deployment to avoid nonce conflicts

### Operational Risks

- **Liquidity Fragmentation:** Start with conservative 500k deposit
- **Market Risk Calibration:** Monitor actual trading patterns vs. expected
- **Adjudicator Availability:** Ensure all 5 adjudicator types are functional
- **Settlement Delays:** Document expected settlement times per adjudicator

## Success Metrics

### Deployment Success

- ✅ All 7 core contracts deployed successfully
- ✅ All 5 markets created and initialized
- ✅ Vault has 500k liquidity deposited
- ✅ All authorization relationships configured
- ✅ bGlobal and bMarket values within expected ranges

### Functional Success

- ✅ Users can buy/sell on all markets
- ✅ LP deposits/withdrawals work correctly
- ✅ Slippage protection prevents excessive costs
- ✅ Market reserves track correctly
- ✅ Risk multipliers apply correctly per market

## Timeline Estimate

1. **Environment Setup:** 1-2 hours
2. **Script Development:** 2-3 hours
3. **Testing & Validation:** 1-2 hours
4. **Deployment Execution:** 30 minutes
5. **Post-Deployment Verification:** 1-2 hours
6. **Documentation:** 1 hour

**Total Estimated Time:** 6-10 hours

## Next Steps

1. Research Monad testnet RPC endpoints and faucet
2. Create `DeployMonad.s.sol` script
3. Update `foundry.toml` with Monad configuration
4. Test deployment on local fork (if available)
5. Execute deployment to Monad testnet
6. Verify and document results

## Notes

- Monad is EVM-compatible, so existing Solidity contracts should work without modification
- Monad's parallel execution may affect gas costs - monitor actual vs. expected
- Consider Monad-specific optimizations for future iterations
- Document any Monad-specific quirks or differences from Base Sepolia deployment
