# V4 Quick Reference

**Version:** 4.0 (Dual-Venue)

---

## Contract Addresses (Base Sepolia)

```
TraderVaultV4: 0xee91e05f95cBaACD46f58432DF72CB5C451e98E0
GovernorVault: 0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f
FeeController:  0xa367B312Ca1845B7c6076345cB5cd529F935B4FA
USDC:          0xd2C6903C7311C7EC6F2f09DA7A0d417A59CB04ab

Market 1: 0xf17f4863aeeecdd5db8d0eb2a81a5435987267db
Market 2: 0xb6cfef7a8128eb236362c4f60a9b4f0aa7784ef7
```

---

## Quick Actions

### Deposit
```ts
await usdc.approve(TRADER_VAULT, MAX);
await traderVault.deposit(amount);
```

### AMM Buy (24h lock)
```ts
await traderVault.executeAMMTrade(market, outcome, shares, maxCost, true);
```

### AMM Sell (instant, after unlock)
```ts
await traderVault.executeAMMTrade(market, outcome, shares, minProceeds, false);
```

### Orderbook Order (no locks)
```ts
await traderVault.placeOrder(market, outcome, price, amount);
```

---

## Button Gating

```ts
// Can trade?
const canTrade = available >= estimatedCost;

// Can sell AMM?
const isUnlocked = Date.now() / 1000 >= position.unlockTime;
const canSellAMM = position.yesShares >= amount && isUnlocked;

// Can sell orderbook?
const canSellOrderbook = tokenBalance >= amount; // Always, no locks
```

---

## Data Fetching

```ts
// Balances
const { available, pending } = await traderVault.accounts(user);

// AMM positions
const { yesShares, noShares, unlockTime } = await traderVault.ammPositions(user, market);

// Orderbook tokens
const yesTokens = await outcomeToken.balanceOf(user, 1);

// Market data
const tick = await market.currentTick();
const probability = tick / 1000;
const b = await market.b();
```

---

## Two Venues

| Feature | AMM | Orderbook |
|---------|-----|-----------|
| Speed | Instant | Wait for match |
| Lock | 24h on buy | No locks |
| Tokens | Internal | ERC1155 |
| Gas | Lower | Higher |

---

## Common Errors

| Error | Fix |
|-------|-----|
| `insufficient available` | Deposit USDC |
| `position locked` | Wait for unlock |
| `slippage exceeded` | Increase maxCost |

---

## See Also

- `V4_FRONTEND_GUIDE.md` - Complete guide
- `CONTRACT_INTERFACES.md` - Full ABI reference
