# Deployment Status - Sooth Protocol V4

## Base Sepolia (Live)

**Chain ID:** 84532  
**Status:** ✅ Active  
**Deployed:** December 9, 2025

### Core Infrastructure

| Contract | Address | Status |
|----------|---------|--------|
| MockUSDC | `0xd2C6903C7311C7EC6F2f09DA7A0d417A59CB04ab` | ✅ Live |
| GovernorVault | `0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f` | ✅ Live (500k funded) |
| TraderVaultV4 | `0xee91e05f95cBaACD46f58432DF72CB5C451e98E0` | ✅ Live |
| FeeController | `0xa367B312Ca1845B7c6076345cB5cd529F935B4FA` | ✅ Live |

### Markets

| ID | Name | Market Address | Status |
|----|------|----------------|--------|
| 1 | UN Confirms Alien Life | `0xf17f4863aeeecdd5db8d0eb2a81a5435987267db` | ✅ Live |
| 2 | BTC 7-day TWAP >= $100k | `0xb6cfef7a8128eb236362c4f60a9b4f0aa7784ef7` | ✅ Live |

---

## Contract Verification

All contracts deployed and verified on Base Sepolia block explorer.

---

## Version History

- **V4** (Dec 2025): Dual-venue, lock-on-buy AMM, ERC1155 orderbook
- **V3** (Nov 2025): Lock-on-sell model (archived)
- **V2** (Oct 2025): Initial singleton architecture (archived)

---

## RPC Endpoint

```
https://sepolia.base.org
```

---

## Faucets

- Base Sepolia ETH: https://www.base.org/faucet
- Mock USDC: Use `mint()` function on contract

---

## ABI Files

Located in: `out/<ContractName>.sol/<ContractName>.json`

Key contracts:
- `SoothTraderVaultV4.json`
- `SoothMarketV4.json`
- `OutcomeToken.json`
- `SoothGovernorVault.json`
