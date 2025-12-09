# V4 Integration Guide

**Date:** 2025-12-09  
**Status:** ✅ Live on Base Sepolia

---

## Key V4 Changes

1. **Dual-Venue:** AMM + Orderbook trading
2. **Lock-on-Buy:** AMM positions locked 24h after purchase
3. **Instant Sells:** AMM sells give instant USDC (after unlock)
4. **ERC1155 Orderbook:** Limit orders use transferable tokens, no locks
5. **Dynamic Liquidity:** `b` changes based on market performance

---

## Quick Migration from V3

| V3 | V4 |
|----|-----|
| Time-lock on sells | Lock on buys (AMM only) |
| Single venue | Dual venue (AMM + Orderbook) |
| Internal positions only | Internal AMM + ERC1155 orderbook |
| Static `b` | Dynamic `b = bBase + (factor × PnL)` |

---

## Integration Steps

### 1. Update Contract Addresses

```typescript
const TRADER_VAULT = '0xee91e05f95cBaACD46f58432DF72CB5C451e98E0'
const MARKET = '0xf17f4863aeeecdd5db8d0eb2a81a5435987267db' // or other market
```

### 2. Update ABIs

Use V4 ABIs from `out/` folder:
- `SoothTraderVaultV4.json`
- `SoothMarketV4.json`
- `OutcomeToken.json`

### 3. Update Balance Fetching

```typescript
// USDC balances
const { available, pending } = await traderVault.accounts(userAddress)

// AMM positions (locked shares)
const position = await traderVault.ammPositions(userAddress, marketAddress)
// Returns: { yesShares, noShares, unlockTime }

// Orderbook tokens (ERC1155)
const yesTokens = await outcomeToken.balanceOf(userAddress, 1)
const noTokens = await outcomeToken.balanceOf(userAddress, 0)
```

### 4. Update Trading Logic

**AMM Trade:**
```typescript
// executeAMMTrade(market, outcome, shares, limit, isBuy)
await traderVault.executeAMMTrade(
  marketAddress,
  1, // outcome
  shares,
  maxCost,
  true // isBuy
)
```

**Orderbook:**
```typescript
// placeOrder(market, outcome, price, amount)
await traderVault.placeOrder(
  marketAddress,
  1,
  parseUnits('0.6', 18), // price
  parseUnits('100', 18) // amount
)
```

### 5. Add Lock Status UI

```typescript
function isLocked(unlockTime: bigint) {
  return Date.now() / 1000 < unlockTime
}

function getLockRemaining(unlockTime: bigint) {
  const remaining = Number(unlockTime) - Date.now() / 1000
  return remaining > 0 ? remaining : 0
}
```

### 6. Update Probability Display

```typescript
const tick = await market.currentTick()
const probability = tick / 1000 // 500 → 0.5 → "50%"
```

### 7. Handle Two Venues

Show users the option to choose:
- **AMM:** Instant execution, 24h lock, lower gas
- **Orderbook:** Set price, no locks, ERC1155 tokens

---

## Testing

1. Get Base Sepolia ETH
2. Mint USDC: `cast send $USDC "mint(address,uint256)" $YOU 1000e18`
3. Trade on deployed markets
4. Test both AMM and orderbook flows

---

## Full Documentation

See `V4_FRONTEND_GUIDE.md` for complete integration details.
