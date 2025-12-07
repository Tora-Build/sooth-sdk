# ✅ Deployment- **Status**: ✅ Active & Synced

- **Last Sync**: 2025-12-06
- **Issues**: None (Orderbook & Market addresses verified)

### Resolved Issues

1. **Invalid Market Error**: Caused by stale address in `markets.json`. Fixed by automated sync script.
2. **Deposit Revert**: Caused by missing balance check. Fixed by adding pre-flight check in `useTraderVault.ts`.
3. **Limit Order Balance Error**: Caused by undefined `TraderVaultV3` key. Fixed by using `SoothTraderVault`.a (Chain ID: 84532)

## ✅ Active Deployment (v3)

| Contract          | Address                                      |
| ----------------- | -------------------------------------------- |
| **TraderVaultV3** | `0xd82Ef7bc2aFC25aA0f4B7e13E43bd379e955745e` |
| **MarketV3**      | `0xbF4a4f771Ff3375b4028abfaDAB0018b41997Fdf` |
| **GovernorVault** | `0x296682686358E6bAf572118bfCAA6027C349F3d3` |
| **FeeController** | `0x512076933a55acF5375A54A54b2DDBb996b05E97` |

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

{
"MockERC20": "0x703A2bFa154d5Cf2608CcC63d8F61E53Af5C3607",
"SoothTraderVault": "0xd82Ef7bc2aFC25aA0f4B7e13E43bd379e955745e",
"SoothGovernorVault": "0x296682686358E6bAf572118bfCAA6027C349F3d3",
"SoothFeeController": "0x512076933a55acF5375A54A54b2DDBb996b05E97",
"SoothLMSRReal": "0x2fe47234662aE57E714d183c41f2Bd73DE91892F",
"SoothMarketFactory": "Deprecated",
"SoothSettlement": "In Progress",
"SoothAdjudicatorRegistry": "In Progress"
}

````

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
````

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
