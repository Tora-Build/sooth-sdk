# Monad Testnet TickBook Accounting Research

**Date:** 2026-01-01T20:38:00+07:00  
**User Address:** `0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F`  
**Network:** Monad Testnet (Chain ID: 10143)  
**TickBookPoolManager:** `0x9363d199C2Ba74553E452a6645637806De099381`

---

## 1. User Identity

This address is the **protocol deployer** for V9.9.6 contracts on Monad Testnet:
- Deployed at: 2026-01-01T15:10:00.000Z
- Nonce: 430 (430 transactions sent)
- MON Balance: 0.364 MON

---

## 2. Contract Addresses (V9.9.6)

| Contract | Address |
|----------|---------|
| MockUSDC | `0x7192f46FA78e7d1b5BB6BA687D15d0b6A0802dA3` |
| Collateralizer | `0x8B8c1F0711e5A78F1Fe7ba174eB47eb58880293b` |
| TickBookVault | `0x3c089e0E5919dEB896f80f5FB3A6997439F61300` |
| TickBookPoolManager | `0x9363d199C2Ba74553E452a6645637806De099381` |
| LaunchpadEngine | `0x0d6b999E9dFed7d00B46B2619eB4AF66Ac320335` |

---

## 3. Discovered Graduated Markets

### Market 1: Unknown Market
| Property | Value |
|----------|-------|
| Truth Market | `0xDF2028D406af0a5062208e41FcE15128C0f7d474` |
| Market Key | `0xd0b250185ff6115b2195959f97cb9953a5ee8824e4051afd0f8b799a3ace07ef` |
| YES Token | `0x5697FfFcbe001E33227BaDa7119206201DA40DC2` |
| NO Token | `0xf06cc616129CaFAB9c5C47E45169eDC7A56c0576` |
| Current Probability | **34.4%** |
| Total Orders | 8 (6 active) |

### Market 2: Unknown Market
| Property | Value |
|----------|-------|
| Truth Market | `0x0e69806CBa6C74B88FF9679FB0b4aD6C8807dCB7` |
| Market Key | `0x3f5e70a322046a7cbe31016895bbcaedf37185593c9be4b60edf530f0648f205` |
| YES Token | `0xa6b2eEfC4Fd77E0Df8c782882048F68981b0802d` |
| NO Token | `0xebfD8E957b914b9f0f36CFC41704e2Ed1a9fbccc` |
| Current Probability | **99.9%** |
| Total Orders | 13 (5 active) |

---

## 4. Market 1 Order Details (6 Active Orders)

### Order #3 — BUY YES
| Field | Value |
|-------|-------|
| Outcome | YES (1) |
| Tick Range | 33.7% – 42.7% |
| Shares Total | 70 |
| Liquidity | 0.769 |
| Collateral Deposited | 29.96 USDC |
| Claimed Fills | 69.99999... (~70) |
| **Pending Fills** | **70 wei** (dust) |
| **Pending Cost** | **10.51 USDC** |
| Status | ⚡ Has pending fills (dust) |

### Order #4 — SELL YES (NO order)
| Field | Value |
|-------|-------|
| Outcome | NO (0) → SELL YES @ 48.1%-56.1% |
| Tick Range | 43.9% – 51.9% (inverted: 48.1%-56.1%) |
| Shares Total | 149 |
| Liquidity | 1.839 |
| Collateral Deposited | 83.738 USDC |
| Claimed Fills | 92.99999... (~93) |
| **Pending Fills** | **0** |
| Status | 🟢 Fully claimed |

### Order #5 — BUY YES
| Field | Value |
|-------|-------|
| Outcome | YES (1) |
| Tick Range | 51.1% – 56.6% |
| Shares Total | 93 |
| Liquidity | 1.66 |
| Collateral Deposited | 52.731 USDC |
| Claimed Fills | 92.99999... (~93) |
| **Pending Fills** | **16 wei** (dust) |
| **Pending Cost** | **13.97 USDC** |
| Status | ⚡ Has pending fills (dust) |

### Order #6 — SELL YES (NO order)
| Field | Value |
|-------|-------|
| Outcome | NO (0) → SELL YES @ 29.0%-37.0% |
| Tick Range | 63.0% – 71.0% (inverted: 29.0%-37.0%) |
| Shares Total | 142 |
| Liquidity | 1.753 |
| Collateral Deposited | 52.682 USDC |
| Claimed Fills | 0 |
| **Pending Fills** | **0** |
| Status | 🔵 Unfilled |

### Order #7 — BUY YES
| Field | Value |
|-------|-------|
| Outcome | YES (1) |
| Tick Range | 24.8% – 31.0% |
| Shares Total | 56 |
| Liquidity | 0.888 |
| Collateral Deposited | 17.416 USDC |
| Claimed Fills | 0 |
| **Pending Fills** | **21.99 shares** |
| **Pending Cost** | **8.41 USDC** |
| Status | ⚡ **Has significant pending fills!** |

### Order #8 — SELL YES (NO order)
| Field | Value |
|-------|-------|
| Outcome | NO (0) → SELL YES @ 57.9%-65.6% |
| Tick Range | 34.4% – 42.1% (inverted: 57.9%-65.6%) |
| Shares Total | 86 |
| Liquidity | 1.102 |
| Collateral Deposited | 56.502 USDC |
| Claimed Fills | 85.99999... (~86) |
| **Pending Fills** | **0** |
| Status | 🟢 100% filled + claimed |

---

## 5. Accounting Summary — Market 1

### 5.1 Order State Summary

| Order | Type | Total | Claimed | Pending | Unfilled | Status |
|-------|------|-------|---------|---------|----------|--------|
| #3 | BUY YES | 70 | 70 | ~0 | 0 | ✓ Fully filled |
| #4 | SELL YES | 149 | 93 | 0 | 56 | Cancel possible |
| #5 | BUY YES | 93 | 93 | ~0 | 0 | ✓ Fully filled |
| #6 | SELL YES | 142 | 0 | 0 | 142 | Cancel possible |
| #7 | BUY YES | 56 | 0 | **22** | 34 | ⚡ **Claim pending!** |
| #8 | SELL YES | 86 | 86 | 0 | 0 | ✓ Fully filled |

### 5.2 Collateral Analysis

| Category | Amount (USDC WAD) |
|----------|-------------------|
| Total Collateral Deposited | 293.04 USDC |
| Already Used (claimed fills) | ~264 USDC (estimated) |
| Pending to Claim | ~32.89 USDC |
| Refundable via Cancel | ~52.68 USDC (Order #6 unfilled) |

### 5.3 Position Summary (from console logs)

| Outcome | Shares Held |
|---------|-------------|
| YES Shares | 263 |
| NO Shares | 291 |

---

## 6. TickBookVault Balances

| Field | Value |
|-------|-------|
| Available USDC (WAD) | 207,599.73 USDC |
| Reserved USDC (WAD) | 0 USDC |

**Note:** Reserved = 0 indicates that the collateral tracking is using a different mechanism (possibly per-order accounting rather than vault-global reservation).

---

## 7. Observations & Behavioral Notes

### 7.1 Trading Pattern
- User places **range orders** spanning 5-10 tick points (~0.5%-1% price ranges)
- Both BUY YES (outcome=1) and SELL YES (outcome=0) positions
- Aggressive limit placements near market price (34.4%)
- Order #7 has significant unclaimed fills (~22 shares worth ~8.41 USDC)

### 7.2 Fill Behavior
- Orders are being partially filled by market takers
- Fills accumulate in the `pendingFills` accumulator
- User must call `claimFills(marketKey, orderId)` to:
  - Receive outcome tokens (YES/NO) for BUY orders
  - Release collateral for SELL orders

### 7.3 Dust Amounts
- Orders #3 and #5 show "pending fills" of 70 and 16 **wei** respectively
- These are rounding dust from the fill accumulator math
- Can safely be claimed but may cost more in gas than recovered

---

## 8. Recommended Actions

### Immediate
1. **Claim Order #7 fills** — 22 shares (~8.41 USDC) pending
2. **Claim Order #3 fills** (optional) — dust only
3. **Claim Order #5 fills** (optional) — dust only

### Strategic
1. **Cancel Order #6** — 142 shares @ 29-37% unfilled, reclaim 52.68 USDC collateral
2. **Cancel Order #4** — 56 remaining shares @ 48-56% unfilled, reclaim partial collateral

### Accounting Verification
After claiming/canceling, verify:
```bash
cast call 0x3c089e0E5919dEB896f80f5FB3A6997439F61300 "availableUsdcWad(address)(uint256)" 0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F --rpc-url https://testnet-rpc.monad.xyz
```

---

## 9. Market 2 Summary (Quick Overview)

Market 2 (`0x0e69806CBa6C74B88FF9679FB0b4aD6C8807dCB7`) at 99.9% probability has:
- 13 total orders, 5 active
- Orders 14, 17, 19, 20, 21 are active
- Order 17 has ~21.5 shares pending fills
- Order 20 has ~9.5 shares pending fills

Full analysis available upon request.

---

## 10. Shell Commands for Follow-up

### Query specific order:
```bash
cast call 0x9363d199C2Ba74553E452a6645637806De099381 \
  "getOrder(bytes32,uint256)" \
  0xd0b250185ff6115b2195959f97cb9953a5ee8824e4051afd0f8b799a3ace07ef \
  7 --rpc-url https://testnet-rpc.monad.xyz
```

### Query pending fills:
```bash
cast call 0x9363d199C2Ba74553E452a6645637806De099381 \
  "getPendingFills(bytes32,uint256)(uint256,uint256)" \
  0xd0b250185ff6115b2195959f97cb9953a5ee8824e4051afd0f8b799a3ace07ef \
  7 --rpc-url https://testnet-rpc.monad.xyz
```

### Claim fills (requires signing):
```bash
cast send 0x9363d199C2Ba74553E452a6645637806De099381 \
  "claimFills(bytes32,uint256)" \
  0xd0b250185ff6115b2195959f97cb9953a5ee8824e4051afd0f8b799a3ace07ef \
  7 --rpc-url https://testnet-rpc.monad.xyz --private-key $PRIVATE_KEY
```
