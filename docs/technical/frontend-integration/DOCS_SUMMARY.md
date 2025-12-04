# Documentation Summary

**Date:** 2025-12-04

## ✅ What's Been Updated

All frontend integration docs have been updated for the current architecture:

### Core Docs

- **[V3_MIGRATION_GUIDE.md](./V3_MIGRATION_GUIDE.md)** - Complete migration guide from v2 to v3
- **[DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)** - Live contract addresses (Base Sepolia)
- **[deployments-v3.json](./deployments-v3.json)** - Machine-readable deployment info

### Integration Guides

- **[ORDERBOOK_INTEGRATION.md](./ORDERBOOK_INTEGRATION.md)** - Unified orderbook logic
- **[SETTLEMENT_GUIDE.md](./SETTLEMENT_GUIDE.md)** - Time-lock claims (redemption coming soon)
- **[UX_RECOMMENDATIONS.md](./UX_RECOMMENDATIONS.md)** - Available vs Pending balance UX
- **[FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)** - Marked as legacy, points to v3 guide

### Research Docs

- **[V3_ROADMAP.md](../../research/V3_ROADMAP.md)** - Updated with Time-Lock completion status
- **[USER_ACCOUNT_MODEL.md](../../research/USER_ACCOUNT_MODEL.md)** - Explains available/pending model

## 🚨 Key Changes for Frontend Devs

1. **Single Entry Point:** All calls go through `TraderVaultV3` (not `Market`)
2. **Account Model:** `availableBalance` (liquid) + `pendingBalance` (locked 48h)
3. **No Collateral:** Users pay USDC upfront, no locking
4. **Unified Orderbook:** Sell YES = Buy NO (automatically mirrored)

## ⏸️ Monad Status

Deployment to Monad Testnet is **paused** due to insufficient funds.

- **Deployer:** `0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F`
- **Needed:** ~0.8 MON

## 🔗 Base Sepolia Addresses

| Contract      | Address                                      |
| ------------- | -------------------------------------------- |
| TraderVaultV3 | `0x8B8c1F0711e5A78F1Fe7ba174eB47eb58880293b` |
| MarketV3      | `0x222948d53B75ED5ef06844ABc8B01dEe557E4945` |
| GovernorVault | `0x83AFf2901f29821f8Ef4f216256D9f8A6fAFaAb2` |
| FeeController | `0x289a936E0947a2bA07D8a3A06116455ddf2c77Ad` |
| AMM           | `0x6471F7B77aD9cDc337f76aA2e533EF03Ca8Bcde4` |
