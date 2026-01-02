# Monad Testnet Deployment Guide

## Quick Start

### Prerequisites

1. **Monad Testnet MON tokens** - Get from [Monad Faucet](https://faucet.monad.xyz) (URL TBD)
2. **Private key** with testnet MON for gas
3. **RPC access** to Monad Testnet

### Configuration

1. **Copy environment template:**

```bash
cp .env.example .env
```

2. **Edit `.env` with your settings:**

```bash
PRIVATE_KEY=your_private_key_here
MONAD_RPC_URL=https://testnet.monad.xyz
FRONTEND_PATH=../sooth-dapp  # Optional: for auto-sync
```

3. **Verify RPC connectivity:**

```bash
cast chain-id --rpc-url $MONAD_RPC_URL
# Should return: 10143
```

### Deploy

**Option 1: Using the deployment script (recommended)**

```bash
./deploy-monad.sh
```

**Option 2: Using forge directly**

```bash
forge script script/DeployMonad.s.sol:DeployMonad \
    --rpc-url monad_testnet \
    --broadcast \
    --verify \
    -vvvv
```

## What Gets Deployed

### Core Protocol (7 contracts)

1. **MockERC20** - Testnet USDC (18 decimals, 10M initial supply)
2. **SoothVault** - ERC4626 liquidity vault (500k initial deposit)
3. **SoothRiskManager** - Dynamic liquidity parameter calculator
4. **SoothLMSRReal** - LMSR AMM implementation
5. **SoothAdjudicatorRegistry** - Attestation provider registry
6. **SoothSettlement** - Settlement and payout engine
7. **SoothMarketFactory** - Market creation factory

### Markets (5 attestation types)

| #   | Market Name         | Adjudicator           | Risk Class      | bMarket | Description                   |
| --- | ------------------- | --------------------- | --------------- | ------- | ----------------------------- |
| 1   | BTC Price Market    | UMA Optimistic Oracle | LOW (0.6x)      | ~43k    | Will BTC exceed $100k?        |
| 2   | ETH Gas Market      | Chainlink Functions   | LOW (0.6x)      | ~43k    | Will ETH gas exceed 100 gwei? |
| 3   | Monad Launch Market | Tellor Oracle         | MEDIUM (1.0x)   | ~72k    | Will Monad launch in Q1 2026? |
| 4   | Sooth TVL Market    | Multisig Committee    | HIGH (1.4x)     | ~101k   | Will Sooth TVL exceed $10M?   |
| 5   | Monad Top 10 Market | Governance Vote       | CRITICAL (1.8x) | ~130k   | Will Monad become top 10 L1?  |

### Adjudicator Types

#### 1. UMA Optimistic Oracle (LOW RISK)

- **Class ID:** 1
- **Use Case:** Objective, verifiable data
- **Parameters:** `bond=1000, liveness=7200`
- **Example:** Price feeds, on-chain data

#### 2. Chainlink Functions (LOW RISK)

- **Class ID:** 2
- **Use Case:** API-based verification
- **Parameters:** `subscriptionId=123, gasLimit=300000`
- **Example:** External API data, weather, sports scores

#### 3. Tellor Oracle (MEDIUM RISK)

- **Class ID:** 3
- **Use Case:** Community-reported data
- **Parameters:** `disputePeriod=86400, minStake=100`
- **Example:** Subjective but verifiable outcomes

#### 4. Multisig Committee (HIGH RISK)

- **Class ID:** 4
- **Use Case:** Subjective outcomes
- **Parameters:** `threshold=3, signers=5`
- **Example:** Protocol milestones, qualitative assessments

#### 5. Governance Vote (CRITICAL RISK)

- **Class ID:** 5
- **Use Case:** Highly contentious/subjective
- **Parameters:** `votingPeriod=259200, quorum=1000000`
- **Example:** Community sentiment, competitive rankings

## Deployment Artifacts

The protocol is currently deployed on Monad Testnet (Chain ID 10143).

### `deployments-monad.json`

```json
{
  "chainId": 10143,
  "network": "monad-testnet",
  "MockERC20": "0xaaE4610eEB6bF5FCf3775AcA69A5911691556995",
  "SoothVault": "0xBF904AaF2a8e8387032dc900d71663AbC0AB49d7",
  "SoothRiskManager": "0xB9654E9215068137066b0b1b83CA721A6c1e0e35",
  "SoothLMSRReal": "0x9a792f0d93E0b71155dbea9BDed1A43d257e14FA",
  "SoothAdjudicatorRegistry": "0x1830B7083AC106A8B5867e504705151663B06f7E",
  "SoothSettlement": "0xe3BEF13C13803D509baF68655eA5bFefA15928De",
  "SoothMarketFactory": "0xaB4dbaBC3A55F911967f8450C1172CD13C6a636F"
}
```

### `markets-monad.json`

```json
[
  {
    "id": 1,
    "address": "0xb5b3A3aaB0EB6C4718Bb3a956C31D85d4C94cf30",
    "name": "BTC Price Market",
    "description": "Will BTC price exceed $100k by Dec 31?",
    "adjudicator": "UMA Optimistic Oracle",
    "riskClass": 0,
    "bMarket": 43281000000000000000000
  },
  {
    "id": 2,
    "address": "0x058e7f17768990e9256864C4B855f6D5a5d1975D",
    "name": "ETH Gas Market",
    "description": "Will ETH gas exceed 100 gwei average?",
    "adjudicator": "Chainlink Functions",
    "riskClass": 0,
    "bMarket": 43281000000000000000000
  },
  {
    "id": 3,
    "address": "0xF26bB8E030F3d81424E5156a1c181B4a205E19A8",
    "name": "Monad Launch Market",
    "description": "Will Monad mainnet launch in Q1 2026?",
    "adjudicator": "Tellor Oracle",
    "riskClass": 1,
    "bMarket": 72135000000000000000000
  },
  {
    "id": 4,
    "address": "0xdEbB90c6aFb367a4c86fF848f6754a036a86632f",
    "name": "Sooth TVL Market",
    "description": "Will Sooth Protocol TVL exceed $10M?",
    "adjudicator": "Multisig Committee",
    "riskClass": 2,
    "bMarket": 100989000000000000000000
  },
  {
    "id": 5,
    "address": "0x2162e2E857a2897B2E62744257edfBD0C039f2DE",
    "name": "Monad Top 10 Market",
    "description": "Will Monad become top 10 L1 by TVL?",
    "adjudicator": "Governance Vote",
    "riskClass": 3,
    "bMarket": 129843000000000000000000
  }
]
```

## Post-Deployment

### 1. Verify Contracts

```bash
# Verify on Monad explorer (if available)
forge verify-contract <CONTRACT_ADDRESS> <CONTRACT_NAME> \
    --chain-id 10143 \
    --rpc-url monad_testnet
```

### 2. Test Trading

```bash
# Get some mUSDC from the deployed token
cast send <MOCK_ERC20_ADDRESS> "_mint(address,uint256)" \
    <YOUR_ADDRESS> 10000000000000000000000 \
    --rpc-url monad_testnet \
    --private-key $PRIVATE_KEY

# Approve vault
cast send <MOCK_ERC20_ADDRESS> "approve(address,uint256)" \
    <VAULT_ADDRESS> 1000000000000000000000 \
    --rpc-url monad_testnet \
    --private-key $PRIVATE_KEY

# Execute a test trade
cast send <MARKET_ADDRESS> "trade(uint8,int256,int256)" \
    0 100000000000000000000 200000000000000000000 \
    --rpc-url monad_testnet \
    --private-key $PRIVATE_KEY
```

### 3. Frontend Integration

**Update your frontend config:**

```typescript
// src/config/networks.ts
export const MONAD_TESTNET = {
  chainId: 10143,
  name: "Monad Testnet",
  rpcUrl: "https://testnet.monad.xyz",
  blockExplorer: "https://explorer.monad.xyz", // TBD
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
};

// Import deployment addresses
import monadDeployments from "./deployments-monad.json";
import monadMarkets from "./markets-monad.json";
```

### 4. Monitor Deployment

**Check vault status:**

```bash
# Total assets
cast call <VAULT_ADDRESS> "totalAssets()" --rpc-url monad_testnet

# Locked exposure
cast call <VAULT_ADDRESS> "totalLockedExposure()" --rpc-url monad_testnet

# LP balance
cast call <VAULT_ADDRESS> "balanceOfLP(address)" <YOUR_ADDRESS> --rpc-url monad_testnet
```

**Check market state:**

```bash
# Get market AMM state
cast call <MARKET_ADDRESS> "ammState()" --rpc-url monad_testnet

# Get b parameter
cast call <RISK_MANAGER_ADDRESS> "getBForMarket(uint256)" <MARKET_ID> --rpc-url monad_testnet
```

## Troubleshooting

### Issue: "insufficient funds for gas"

**Solution:** Get more testnet MON from the faucet

### Issue: "nonce too low"

**Solution:** Reset your nonce or wait for pending transactions to confirm

### Issue: "execution reverted"

**Solution:** Check the verbose logs (`-vvvv`) for the specific revert reason

### Issue: RPC connection timeout

**Solution:** Verify Monad RPC URL is correct and accessible

## Network Information

- **Chain ID:** 10143
- **Network Name:** Monad Testnet
- **RPC URL:** https://testnet.monad.xyz (verify current URL)
- **Block Explorer:** TBD
- **Faucet:** TBD
- **Native Token:** MON (testnet)

## Risk Parameters

### Global Configuration

- **bGlobal:** ~72,115 mUSDC (based on 500k TVL, K=10)
- **Max Concurrent Markets (K):** 10
- **Treasury (T):** 500,000 mUSDC
- **Liquid Buffer (B):** 500,000 mUSDC

### Risk Class Multipliers

- **LOW:** 0.6x (60% of bGlobal)
- **MEDIUM:** 1.0x (100% of bGlobal)
- **HIGH:** 1.4x (140% of bGlobal)
- **CRITICAL:** 1.8x (180% of bGlobal)

### Expected Market Liquidity

- **LOW markets:** ~43,269 mUSDC
- **MEDIUM markets:** ~72,115 mUSDC
- **HIGH markets:** ~100,961 mUSDC
- **CRITICAL markets:** ~129,807 mUSDC

## Security Considerations

⚠️ **This is a TESTNET deployment**

- All tokens are worthless testnet tokens
- Contracts are not audited for mainnet use
- Adjudicators are mock implementations
- Use for testing and development only

## Support

For issues or questions:

1. Check the [main README](../README.md)
2. Review the [deployment plan](./MONAD_DEPLOYMENT_PLAN.md)
3. Open an issue on GitHub

## License

MIT
