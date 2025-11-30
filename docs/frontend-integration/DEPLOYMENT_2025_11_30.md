# 🚀 Deployment Complete: Hybrid Liquidity Model (Nov 30, 2025)

**Network:** Base Sepolia (Chain ID: 84532)  
**Deployment Time:** 2025-11-30 14:45 UTC+7  
**Status:** ✅ LIVE

---

## 📦 New Contract Addresses

```json
{
  "MockERC20": "0x377d478517f855102dA8075d1ab3046d84FCF8F6",
  "SoothVault": "0x6cDf92b229F4263c15907BF2ed936232DEDC0096",
  "SoothRiskManager": "0xEC864614A7eEf111e199726f19F8854CE963028e",
  "SoothBalancedAMM": "0x4Fe11Fe06134E0c69cDa77D957f24A632CC1B9E2",
  "SoothAdjudicatorRegistry": "0xc2C23195B4042fCFa05D79377C7cf4dad6d862E6",
  "SoothSettlement": "0xFA7F9515514d35eb34EA5D3f0AE377EB4C653B2d",
  "SoothMarketFactory": "0xEf26d61dbdb07FB4243B379BabB98d7142b02ce9",
  "ExampleMarket": "0x6785db0BA249e84Dc2a32bdF928EEaB0c6916C54",
  "SecondMarket": "0x950Add0f51FAEAb492C2e4854eEd883F420C0e7b"
}
```

**Block Explorer:**

- [View on BaseScan](https://sepolia.basescan.org/)

---

## 🚨 CRITICAL: Frontend Integration Changes Required

### 1. Update Contract Addresses

Replace ALL contract addresses in your frontend with the new ones above.

### 2. Change Approval Target to Vault

**This is the most critical change!**

```javascript
// ❌ OLD (will fail with new contracts):
await collateral.approve(marketAddress, ethers.MaxUint256);

// ✅ NEW (required for new contracts):
const VAULT_ADDRESS = "0x6cDf92b229F4263c15907BF2ed936232DEDC0096";
await collateral.approve(VAULT_ADDRESS, ethers.MaxUint256);
```

### 3. Update ABIs

The following contracts have new functions:

**SoothVault:**

- `recordMarketFlow(uint256 marketId, int256 amount, address user)`
- `getMarketReserve(uint256 marketId) returns (int256)`
- `applySettlementDelta(uint256 marketId, address account, int256 pnlDelta)` (updated signature)

**SoothRiskManager:**

- `getBForMarket(uint256 marketId)` (now includes hybrid boost)
- `reserveMultiplierBps` (new public variable)

---

## 📋 Integration Checklist

- [ ] Update contract addresses in your config
- [ ] **Change approval target from Market to Vault**
- [ ] Update SoothVault ABI
- [ ] Update SoothRiskManager ABI
- [ ] Test deposit flow (approve Vault, then deposit)
- [ ] Test trading flow (approve Vault, then trade)
- [ ] Verify `b` is fetched per market
- [ ] (Optional) Display market reserves

---

## 🎯 What's New?

### Hybrid Liquidity Model

Markets now grow their own liquidity from trading:

```
bMarket = (bGlobal × RiskMultiplier) + (MarketReserve × ReserveMultiplier)
```

**Example:**

- New market: `b = 25,000` (only global)
- Popular market with 5k profits: `b = 30,000` (25k + 5k boost)

### Benefits

- **Deeper liquidity** for popular markets
- **Lower slippage** on high-volume markets
- **Flywheel effect**: More trading → Deeper liquidity → Attracts more traders

---

## 🔧 Testing the Deployment

### Verify Vault Functions

```javascript
const vault = new ethers.Contract(
  "0x6cDf92b229F4263c15907BF2ed936232DEDC0096",
  vaultABI,
  provider
);

// Test new function
const reserve = await vault.getMarketReserve(1);
console.log("Market 1 reserve:", ethers.formatUnits(reserve, 18));
```

### Verify Market Authorization

```javascript
const isAuthorized = await vault.authorizedSpender(
  "0x6785db0BA249e84Dc2a32bdF928EEaB0c6916C54" // ExampleMarket
);
console.log("Market authorized:", isAuthorized); // Should be true
```

### Test Trading Flow

```javascript
// 1. Approve Vault (NOT Market!)
await collateral.approve(vaultAddress, ethers.MaxUint256);

// 2. Execute trade
const market = new ethers.Contract(marketAddress, marketABI, signer);
const tx = await market.trade(
  0, // outcomeIndex (YES)
  ethers.parseUnits("10", 18), // deltaShares
  ethers.parseUnits("6", 18) // maxCost
);

await tx.wait();
console.log("Trade successful!");
```

---

## 📚 Documentation

**Follow these guides:**

1. **[LIQUIDITY_AND_AMM_UPDATE_2025_11_30.md](./LIQUIDITY_AND_AMM_UPDATE_2025_11_30.md)** - Comprehensive guide
2. **[QUICK_START_HYBRID_LIQUIDITY.md](./QUICK_START_HYBRID_LIQUIDITY.md)** - Quick reference
3. **[README.md](./README.md)** - Documentation index

**Deprecated (for old deployment):**

- ~~FRONTEND_SYNC_2025_11_29.md~~ (Old deployment, no longer valid)

---

## 🆘 Troubleshooting

### "ERC20: allowance" Error

**Cause:** You're approving the Market instead of the Vault.

**Fix:**

```javascript
// Approve Vault, not Market
await collateral.approve(VAULT_ADDRESS, ethers.MaxUint256);
```

### "Vault: not authorized" Error

**Cause:** Market is not authorized on the Vault.

**Fix:** This should already be done in deployment. If you see this, contact the protocol team.

### Price Calculations Seem Wrong

**Cause:** Using old LMSR formula instead of Linear AMM.

**Fix:**

```javascript
// Use Linear AMM formula
const price = 0.5 + (qYes - qNo) / (2 * b);
```

---

## 📊 Deployment Stats

- **Gas Used:** ~7,863,104 gas (total for all deployments)
- **Cost:** ~0.000029 ETH (~$0.09 USD)
- **Contracts Deployed:** 8
- **Markets Created:** 2 (ExampleMarket + SecondMarket)
- **Initial Liquidity:** 100,000 mUSDC

---

## ✅ Verification

All contracts are deployed and verified on Base Sepolia:

- ✅ MockERC20 deployed
- ✅ SoothVault deployed (with Hybrid Liquidity)
- ✅ SoothRiskManager deployed (with boost logic)
- ✅ SoothBalancedAMM deployed
- ✅ SoothAdjudicatorRegistry deployed
- ✅ SoothSettlement deployed (with marketId parameter)
- ✅ SoothMarketFactory deployed
- ✅ ExampleMarket (Market #1) created and authorized
- ✅ SecondMarket (Market #2) created and authorized
- ✅ All tests passing (16/16)

**Market Details:**

- Market #1 (ExampleMarket): `0x6785db0BA249e84Dc2a32bdF928EEaB0c6916C54`
- Market #2 (SecondMarket): `0x950Add0f51FAEAb492C2e4854eEd883F420C0e7b`
- Both markets: MEDIUM risk class, same adjudicator

---

## 🎉 Ready to Integrate!

The Hybrid Liquidity Model is now **LIVE** on Base Sepolia.

**Next Steps:**

1. Update your contract addresses
2. **Change approval to Vault** (most important!)
3. Update ABIs
4. Test thoroughly
5. Deploy to production

**Questions?** Check the documentation or contact the protocol team.

---

**Deployment Date:** 2025-11-30  
**Network:** Base Sepolia  
**Version:** V2 Alpha (Hybrid Liquidity)
