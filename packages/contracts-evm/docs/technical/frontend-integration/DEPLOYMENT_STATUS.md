# Deployment Status - Sooth Protocol V4

## Base Sepolia (Live)

**Chain ID:** 84532  
**Status:** ✅ Active  
**Deployed:** December 10, 2025 (V4 Hybrid Sell)

### Core Infrastructure

| Contract | Address | Status |
|----------|---------|--------|
| MockUSDC | `0x85232d6e51467dac82dd36aab5b25cd412fab7a8` | ✅ Live |
| GovernorVault | `0xbb044a919bed2d20eda32de62f52ca7fc819268d` | ✅ Live |
| TraderVaultV4 | `0x12b3c9456d9b0f0edbc29c9e4f95f7b21d51256f` | ✅ Live |
| FeeController | `0x2f043cff8ab8366d3e96f378089c3bbbc41cf1fb` | ✅ Live |

### Markets

| ID | Name | Market Address | Status |
|----|------|----------------|--------|
| 1 | UN Confirms Alien Life | `0xf4a4077645f76a78e1a29d9b817cec59aa38709e` | ✅ Live |
| 2 | BTC 7-day TWAP >= $100k | `0xff38c86ac7481b298f2196cca553685bae385977` | ✅ Live |

---

## Contract Verification

All contracts deployed and verified on Base Sepolia block explorer.

---

## Version History

- **V4 Hybrid Sell** (Dec 10, 2025): Added `executeHybridSell` for atomic Split (Spot/Short).
- **V4 Fix** (Dec 10, 2025): Fixed Spot Order settlement bug.
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
