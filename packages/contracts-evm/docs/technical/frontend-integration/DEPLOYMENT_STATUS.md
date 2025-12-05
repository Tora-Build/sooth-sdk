# ✅ Deployment Status

**Last Updated:** 2025-12-04
**Network:** Base Sepolia (Chain ID: 84532)

## ✅ Active Deployment (v3)

| Contract          | Address                                      |
| ----------------- | -------------------------------------------- |
| **TraderVaultV3** | `0x8B8c1F0711e5A78F1Fe7ba174eB47eb58880293b` |
| **MarketV3**      | `0x222948d53B75ED5ef06844ABc8B01dEe557E4945` |
| **GovernorVault** | `0x83AFf2901f29821f8Ef4f216256D9f8A6fAFaAb2` |
| **FeeController** | `0x289a936E0947a2bA07D8a3A06116455ddf2c77Ad` |

> [!NOTE]
> See [V3_MIGRATION_GUIDE.md](./V3_MIGRATION_GUIDE.md) for integration details.

## ⏸️ Monad Testnet (Paused)

**Status:** Deployment paused due to insufficient funds.

**Deployer Address:** `0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F`  
**Required:** ~0.8 MON

Once funded, deployment will resume automatically.

## ⚠️ Legacy Deployment (v2)

**Status:** ✅ **DEPLOYED TO BASE SEPOLIA & MONAD TESTNET**  
**Architecture:** v2.0 (Singleton Trader Vault)

---

## 🎉 v2.0 Singleton Trader Vault is LIVE!

The **v2.0 architecture** with new fee mechanism has been deployed to both networks.

---

## 📦 Contract Addresses

### Base Sepolia (84532)

```json
{
  "MockERC20": "0x0c5677c9f1dDd7927d305da6833BDab24800755F",
  "SoothTraderVault": "0x4BadC7fa7aBC5B25808D7763D08FB8b2D9BFa773",
  "SoothGovernorVault": "0x05a444c96d0D56B59C9ca0d1D3dC2ffF877624b6",
  "SoothFeeController": "0xB24327114210Ab30C1C9972186709798762d59Ad",
  "SoothLMSRReal": "0x1d356E4147e1DDB02a0e0DeDA5B99F9F789c20a2",
  "SoothAdjudicatorRegistry": "0xe62b547afAA2d34370024DC3536268B08D4825A9",
  "SoothSettlement": "0x1D5DB91bDC9F81a8a48513c3401c1db1fbF844AF",
  "SoothMarketFactory": "0x370bF1fB1fBcfb47fC5d02fFB85E4aEB0D92cE90"
}
```

### Monad Testnet (10143)

```json
{
  "MockERC20": "0x4d73eB7E7fBE4667802510579A8B30E17da3c748",
  "SoothTraderVault": "0xf067C23BEE9D3d5c830ca0450A751836c181f566",
  "SoothGovernorVault": "0xDaEE025f833B5408b840588b267ceeC94e049400",
  "SoothFeeController": "0x1888474FF5f2E5B939B335f5e9E1625aA6AbBEA0",
  "SoothLMSRReal": "0xB01b0496309E5945CFdEA962b5627e19Bc50712d",
  "SoothAdjudicatorRegistry": "0xF495702a9111513b7A2F77896021193312ddA851",
  "SoothSettlement": "0x65b72e4d5138AeEdF55459B8f7527505217dcEBc",
  "SoothMarketFactory": "0xc1A50BE14964F7bef7D58CcBeF53B0081fc8F3b7"
}
```

---

## 🚨 Breaking Changes (v1 → v2)

| Change          | v1                 | v2                   |
| --------------- | ------------------ | -------------------- |
| User deposits   | `SoothVault`       | `SoothTraderVault`   |
| LP deposits     | `SoothVault`       | `SoothGovernorVault` |
| Approval target | Vault              | **TraderVault**      |
| Fee controller  | N/A                | `SoothFeeController` |
| Risk manager    | `SoothRiskManager` | **Removed**          |

---

## 🔧 Quick Integration

```javascript
// 1. Update addresses
const TRADER_VAULT = "0x4BadC7fa7aBC5B25808D7763D08FB8b2D9BFa773"; // Base Sepolia

// 2. Approve TraderVault (CRITICAL!)
await usdc.approve(TRADER_VAULT, ethers.MaxUint256);

// 3. Deposit
await traderVault.deposit(amount);

// 4. Trade
await market.trade(outcomeIndex, deltaShares, maxCost);
```

---

## ✅ What's Deployed

- ✅ SoothTraderVault (user fund management)
- ✅ SoothGovernorVault (LP liquidity)
- ✅ SoothFeeController (orderbook + AMM fees)
- ✅ 5 markets per network with varied b and feeLMSR
- ✅ 500,000 mUSDC LP liquidity pre-deposited

---

## 📚 Documentation

- [CONTRACT_INTERFACES.md](./CONTRACT_INTERFACES.md) - ABIs and functions
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [FEE_DESIGN.md](./FEE_DESIGN.md) - Fee mechanism

---

**Last Updated:** 2025-12-04
