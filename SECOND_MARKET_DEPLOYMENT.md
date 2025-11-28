# Second Market Deployment Summary

## ✅ Deployment Successful

A second market has been successfully created on **Base Sepolia** testnet.

---

## Market Details

### Market 1 (ExampleMarket)

- **Address**: `0xa6e17775Ab48DB1912CEc4BD4671D95A64527D76`
- **Market ID**: `1`
- **Risk Class**: `MEDIUM` (1)
- **Locked Exposure**: `0` (no exposure allocated yet)

### Market 2 (SecondMarket) - NEW ✨

- **Address**: `0x4F60778d600A9329FeFef294A81812e75EdB4f17`
- **Market ID**: `2`
- **Risk Class**: `MEDIUM` (1)
- **Locked Exposure**: `0` (no exposure allocated yet)
- **Initial AMM State**: `qYes = 0, qNo = 0`

---

## Shared Infrastructure

Both markets share the same infrastructure:

| Component              | Address                                      | Purpose                            |
| ---------------------- | -------------------------------------------- | ---------------------------------- |
| **SoothVault**         | `0x98169FFFDf249b1196e4e8095f673379f3D06694` | Shared liquidity vault             |
| **SoothRiskManager**   | `0xae2aea85f34c6daB95403163bc2E457e82744196` | Risk parameters (bGlobal, bMarket) |
| **SoothLMSRReal**      | `0xE73E78C4F93C79593c4E09b6d096D668BA45852F` | AMM pricing algorithm              |
| **SoothSettlement**    | `0xb7069f379138cFf592EA372f2EAeF80a4f484F21` | Settlement & claims                |
| **SoothMarketFactory** | `0x3014DB85baA8906Ab0f0562014f947995EaA0f15` | Market creation factory            |
| **MockERC20**          | `0x7894EB3C85e03B6009E74a1331e08dC6E0199652` | Collateral token (mUSDC)           |

---

## Risk Class Configuration

Both markets are in the **MEDIUM** risk class:

- **Multiplier**: 10000 bps (1.0x)
- **Formula**: `bMarket = bGlobal × 1.0`

This means both markets will have the **same `b` parameter** for pricing, calculated from the shared vault's liquidity.

---

## Vault Status

The **SoothVault** now manages liquidity for **2 markets**:

```
Market 1 Locked Exposure: 0 wei
Market 2 Locked Exposure: 0 wei
Total Locked Exposure: 0 wei
```

---

## How to Interact with the Second Market

### Using Cast (CLI)

```bash
# Get market ID
cast call 0x4F60778d600A9329FeFef294A81812e75EdB4f17 "marketId()(uint256)" --rpc-url https://sepolia.base.org

# Get AMM state
cast call 0x4F60778d600A9329FeFef294A81812e75EdB4f17 "ammState()(int256,int256)" --rpc-url https://sepolia.base.org

# Get b parameter for this market
cast call 0xae2aea85f34c6daB95403163bc2E457e82744196 "getBForMarket(uint256)(uint256)" 2 --rpc-url https://sepolia.base.org
```

### Using TypeScript/ethers.js

```typescript
import deployments from "./deployments.json";

// Connect to second market
const secondMarket = new ethers.Contract(
  deployments.SecondMarket,
  marketABI,
  provider
);

// Get market details
const marketId = await secondMarket.marketId(); // Returns: 2
const [qYes, qNo] = await secondMarket.ammState();

// Get b parameter
const riskManager = new ethers.Contract(
  deployments.SoothRiskManager,
  riskManagerABI,
  provider
);
const bMarket = await riskManager.getBForMarket(marketId);

// Calculate price
const amm = new ethers.Contract(deployments.SoothLMSRReal, ammABI, provider);
const price = await amm.price({ qYes, qNo }, 0, bMarket);
```

---

## Updated deployments.json

The `deployments.json` file has been updated to include the second market:

```json
{
  "MockERC20": "0x7894EB3C85e03B6009E74a1331e08dC6E0199652",
  "SoothVault": "0x98169FFFDf249b1196e4e8095f673379f3D06694",
  "SoothRiskManager": "0xae2aea85f34c6daB95403163bc2E457e82744196",
  "SoothLMSRReal": "0xE73E78C4F93C79593c4E09b6d096D668BA45852F",
  "SoothAdjudicatorRegistry": "0xC69003eEc9B262dd9d5911d4d00133BC73d5f70d",
  "SoothSettlement": "0xb7069f379138cFf592EA372f2EAeF80a4f484F21",
  "SoothMarketFactory": "0x3014DB85baA8906Ab0f0562014f947995EaA0f15",
  "ExampleMarket": "0xa6e17775Ab48DB1912CEc4BD4671D95A64527D76",
  "SecondMarket": "0x4F60778d600A9329FeFef294A81812e75EdB4f17"
}
```

---

## Next Steps

1. **Update bGlobal**: After creating new markets, update the global b parameter:

   ```bash
   cast send 0x1aF3cB8B270Db3e71fC979543c32B87709EA191f "updateGlobalB()" --rpc-url https://sepolia.base.org --private-key $PRIVATE_KEY
   ```

2. **Monitor Vault Utilization**: Check how much liquidity is locked across both markets:

   ```bash
   cast call 0xbc7b155057Bb78BB8bF9c9F9Fa6bFCc931aEAF38 "totalLockedExposure()(uint256)" --rpc-url https://sepolia.base.org
   ```

3. **Frontend Integration**: Update your frontend to track both markets using the `MarketCreated` events or the updated `deployments.json`.

---

## Transaction Details

- **Network**: Base Sepolia (Chain ID: 84532)
- **Transaction Hash**: Check `broadcast/CreateSecondMarket.s.sol/84532/run-latest.json`
- **Gas Used**: ~1,026,162 gas
- **Total Cost**: ~0.00000197 ETH

---

## Script Used

The deployment was performed using:

```bash
forge script script/CreateSecondMarket.s.sol:CreateSecondMarket --rpc-url https://sepolia.base.org --broadcast
```

The script is available at: `script/CreateSecondMarket.s.sol`
