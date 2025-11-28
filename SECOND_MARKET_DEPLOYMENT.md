# Second Market Deployment Summary

## ✅ Deployment Successful

A second market has been successfully created on **Base Sepolia** testnet.

---

## Market Details

### Market 1 (ExampleMarket)

- **Address**: `0x49b81D81B371F2a87D5af443B0E9ed6EBe0A2660`
- **Market ID**: `1`
- **Risk Class**: `MEDIUM` (1)
- **Locked Exposure**: `0` (no exposure allocated yet)

### Market 2 (SecondMarket) - NEW ✨

- **Address**: `0x7AF0976e2103AF9FFA1BC0EA4A5ABC134175722E`
- **Market ID**: `2`
- **Risk Class**: `MEDIUM` (1)
- **Locked Exposure**: `200200688004` wei (~200.2 gwei)
- **Initial AMM State**: `qYes = 0, qNo = 0`

---

## Shared Infrastructure

Both markets share the same infrastructure:

| Component              | Address                                      | Purpose                            |
| ---------------------- | -------------------------------------------- | ---------------------------------- |
| **SoothVault**         | `0xbc7b155057Bb78BB8bF9c9F9Fa6bFCc931aEAF38` | Shared liquidity vault             |
| **SoothRiskManager**   | `0x1aF3cB8B270Db3e71fC979543c32B87709EA191f` | Risk parameters (bGlobal, bMarket) |
| **SoothBalancedAMM**   | `0x8629b9ca457F4088ec8346FAED61DA858FDB498d` | AMM pricing algorithm              |
| **SoothSettlement**    | `0xaa3Ffae62A8Af00d08Ac395e9551776b0A01E492` | Settlement & claims                |
| **SoothMarketFactory** | `0x42CBCAF89C380a55Ef1B2ADe6a32eE9590dD63e1` | Market creation factory            |
| **MockERC20**          | `0x58F35BE6A5e3D2be4C3575853043322B02FEeD84` | Collateral token (mUSDC)           |

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
Market 2 Locked Exposure: 200,200,688,004 wei (~0.0002 ETH)
Total Locked Exposure: 200,200,688,004 wei
```

---

## How to Interact with the Second Market

### Using Cast (CLI)

```bash
# Get market ID
cast call 0x7AF0976e2103AF9FFA1BC0EA4A5ABC134175722E "marketId()(uint256)" --rpc-url https://sepolia.base.org

# Get AMM state
cast call 0x7AF0976e2103AF9FFA1BC0EA4A5ABC134175722E "ammState()(int256,int256)" --rpc-url https://sepolia.base.org

# Get b parameter for this market
cast call 0x1aF3cB8B270Db3e71fC979543c32B87709EA191f "getBForMarket(uint256)(uint256)" 2 --rpc-url https://sepolia.base.org
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
const amm = new ethers.Contract(deployments.SoothBalancedAMM, ammABI, provider);
const price = await amm.price({ qYes, qNo }, 0, bMarket);
```

---

## Updated deployments.json

The `deployments.json` file has been updated to include the second market:

```json
{
  "MockERC20": "0x58F35BE6A5e3D2be4C3575853043322B02FEeD84",
  "SoothVault": "0xbc7b155057Bb78BB8bF9c9F9Fa6bFCc931aEAF38",
  "SoothRiskManager": "0x1aF3cB8B270Db3e71fC979543c32B87709EA191f",
  "SoothBalancedAMM": "0x8629b9ca457F4088ec8346FAED61DA858FDB498d",
  "SoothLMSRReal": "0x50293aD4e42593A8b081960c991c198729E81192",
  "SoothAdjudicatorRegistry": "0x12A38bc9E3bD2359265cE70451777eDe2fd875A3",
  "SoothSettlement": "0xaa3Ffae62A8Af00d08Ac395e9551776b0A01E492",
  "SoothMarketFactory": "0x42CBCAF89C380a55Ef1B2ADe6a32eE9590dD63e1",
  "ExampleMarket": "0x49b81D81B371F2a87D5af443B0E9ed6EBe0A2660",
  "SecondMarket": "0x7AF0976e2103AF9FFA1BC0EA4A5ABC134175722E"
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
