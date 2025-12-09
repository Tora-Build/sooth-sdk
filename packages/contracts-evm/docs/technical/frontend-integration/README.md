# Frontend Integration Documentation

Welcome to Sooth Protocol V4 frontend integration docs.

## Start Here

**👉 [V4_FRONTEND_GUIDE.md](./V4_FRONTEND_GUIDE.md)** - Complete integration guide for V4

## Quick Reference

### Deployed Contracts (Base Sepolia)

**Infrastructure:**
- USDC: `0xd2C6903C7311C7EC6F2f09DA7A0d417A59CB04ab`
- GovernorVault: `0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f`
- TraderVaultV4: `0xee91e05f95cBaACD46f58432DF72CB5C451e98E0`
- FeeController: `0xa367B312Ca1845B7c6076345cB5cd529F935B4FA`

**Markets:**
1. UN Confirms Alien Life: `0xf17f4863aeeecdd5db8d0eb2a81a5435987267db`
2. BTC 7-day TWAP >= $100k: `0xb6cfef7a8128eb236362c4f60a9b4f0aa7784ef7`

### Key Changes in V4

- ✅ **Dual-venue trading:** AMM + Orderbook
- ✅ **AMM:** Lock-on-buy (24h), instant sell after unlock
- ✅ **Orderbook:** ERC1155 tokens, no locks, limit orders
- ✅ **Dynamic liquidity:** `b = bBase + (reserveFactor × unrealizedPnL)`
- ✅ **Separate OutcomeToken** per market

---

## Additional Resources

- `ABI_GUIDE.md` - How to extract and use ABIs
- `CONTRACT_INTERFACES.md` - Contract function reference
- `DEPLOYMENT_STATUS.md` - Current deployment info
- `FEE_DESIGN.md` - Fee structure
- `INTEGRATION_GUIDE.md` - Step-by-step integration
- `UX_RECOMMENDATIONS.md` - UI/UX best practices
- `QUICK_REFERENCE.md` - Cheat sheet

---

## Archive

Older V2/V3 documentation moved to `Archive/v2-v3/` for reference.

---

## Need Help?

1. Start with `V4_FRONTEND_GUIDE.md`
2. Check contract interfaces in `CONTRACT_INTERFACES.md`
3. Review UX recommendations in `UX_RECOMMENDATIONS.md`
4. Test on Base Sepolia with deployed contracts above
