# Frontend Integration Documentation

This directory contains all documentation needed for frontend integration with the Sooth Protocol smart contracts.

---

## 🎉 DEPLOYMENT COMPLETE!

**[DEPLOYMENT_2025_11_30.md](./DEPLOYMENT_2025_11_30.md)** - ✅ **HYBRID LIQUIDITY NOW LIVE**

The Hybrid Liquidity Model has been deployed to **Base Sepolia**!

**Critical Changes Required:**

- ✅ Update contract addresses (see deployment doc)
- ✅ **Approve Vault** (not Market) - **MOST IMPORTANT!**
- ✅ Update ABIs for SoothVault and SoothRiskManager
- ✅ Follow [DEPLOYMENT_2025_11_30.md](./DEPLOYMENT_2025_11_30.md) for full integration steps

---

## 🟣 MONAD TESTNET DEPLOYMENT (Nov 30, 2025)

The protocol is now live on **Monad Testnet** (Chain ID: 10143) with 5 active markets!

**Documentation:**

- **[MONAD_DEPLOYMENT_GUIDE.md](./MONAD_DEPLOYMENT_GUIDE.md)** - Full integration guide
- **[MONAD_DEPLOYMENT_SUMMARY.md](./MONAD_DEPLOYMENT_SUMMARY.md)** - Deployment report
- **[deployments.json](./deployments.json)** - Unified contract addresses for all chains
- **[markets.json](./markets.json)** - Unified market configurations for all chains

---

## 📖 Documentation Index

### 🚀 Start Here

1. **[QUICK_START_HYBRID_LIQUIDITY.md](./QUICK_START_HYBRID_LIQUIDITY.md)**

   - **Start with this if you're integrating now**
   - Critical breaking changes
   - Quick code examples
   - Common issues and solutions

2. **[LIQUIDITY_AND_AMM_UPDATE_2025_11_30.md](./LIQUIDITY_AND_AMM_UPDATE_2025_11_30.md)**
   - **Comprehensive technical guide**
   - Hybrid Liquidity Model explained
   - Complete ABI specifications
   - Detailed code examples
   - Integration patterns

### 📋 Reference Documents

3. **[FRONTEND_SYNC_2025_11_29.md](./FRONTEND_SYNC_2025_11_29.md)**

   - Previous deployment information
   - Now superseded by the Nov 30 update
   - Kept for historical reference

4. **[deployments.json](./deployments.json)**
   - Current contract addresses
   - Update this after each deployment

---

## 🎯 What Changed? (Nov 30, 2025)

### Critical Breaking Changes

1. **Approval Flow**: Users must approve `SoothVault` (not market contracts)
2. **Dynamic `b`**: Each market has its own liquidity depth
3. **AMM Switch**: LMSR AMM (`SoothLMSRReal`, fixed) instead of the linear fallback
4. **New Functions**: `recordMarketFlow()`, `getMarketReserve()`

### New Features

- **Hybrid Liquidity Model**: Markets grow their own liquidity from trading
- **Market Reserves**: Track per-market accumulated profits
- **Liquidity Boost**: Popular markets get deeper liquidity automatically

---

## 🔧 Quick Integration Checklist

- [ ] Read [QUICK_START_HYBRID_LIQUIDITY.md](./QUICK_START_HYBRID_LIQUIDITY.md)
- [ ] Update contract ABIs (Vault, RiskManager)
- [ ] Change approval target to Vault
- [ ] Update `b` fetching to be per-market
- [ ] Switch to Linear AMM formula
- [ ] Test trading flow end-to-end
- [ ] (Optional) Display market reserves

---

## 📦 Contract Addresses

See [deployments.json](./deployments.json) for current addresses.

**Key Contracts:**

- `SoothVault` - Holds all collateral, issues LP tokens
- `SoothRiskManager` - Calculates `b` parameters
- `SoothLMSRReal` - LMSR AMM for pricing
- `SoothMarket` - Individual prediction markets
- `SoothSettlement` - Handles adjudication and payouts

---

## 🆘 Support

**Common Issues:**

1. **Transaction fails with "ERC20: allowance"**

   - Fix: Approve `SoothVault`, not the market

2. **"Market: slippage exceeded"**

   - Fix: Increase slippage tolerance or fetch fresh `b`

3. **Price calculations seem wrong**
   - Fix: Use Linear formula: `p = 0.5 + (qYes - qNo) / (2 * b)`

**Need more help?**

- Check the comprehensive guide: [LIQUIDITY_AND_AMM_UPDATE_2025_11_30.md](./LIQUIDITY_AND_AMM_UPDATE_2025_11_30.md)
- Review contract source code in `/contracts/core/`
- Ask the dev team

---

## 📚 Additional Resources

### Protocol Documentation

- [HYBRID_LIQUIDITY_MODEL.md](../requirements/HYBRID_LIQUIDITY_MODEL.md) - Requirement specification
- [BMARKET_LIQUIDITY_RELATIONSHIPS.md](../BMARKET_LIQUIDITY_RELATIONSHIPS.md) - Liquidity concepts
- [BGLOBAL_CALCULATION_FLOW.md](../BGLOBAL_CALCULATION_FLOW.md) - Global b calculation

### Contract Source

- `/contracts/core/SoothVault.sol`
- `/contracts/core/SoothRiskManager.sol`
- `/contracts/core/SoothLMSRReal.sol`
- `/contracts/core/SoothMarket.sol`

---

**Last Updated:** 2025-11-30  
**Version:** V2 Alpha
