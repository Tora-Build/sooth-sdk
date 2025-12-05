# Contract Interface Quick Reference

**Version:** 2.0 (Singleton Trader Vault)

## Key Contracts

| Contract             | Purpose       | Approval Target  |
| -------------------- | ------------- | ---------------- |
| `SoothTraderVault`   | User deposits | ✅ Approve here  |
| `SoothGovernorVault` | LP deposits   | ✅ Approve here  |
| `SoothMarket`        | Trading       | ❌ Don't approve |
| `SoothFeeController` | Fee settings  | Read only        |

## Quick Integration

### 1. User Deposits

```typescript
await usdc.approve(traderVault, MAX);
await traderVault.deposit(amount);
```

### 2. Trading

```typescript
const b = await market.b();
const fee = await market.feeLMSR();
const maxCost = (((estimatedCost * (10000n + fee)) / 10000n) * 105n) / 100n;
await market.trade(0, shares, maxCost);
```

### 3. LP Deposits

```typescript
await usdc.approve(governorVault, MAX);
await governorVault.depositFor(lp, amount);
```

## Button Gating

```typescript
// Trading
const canTrade = isLive && !isSettled && freeBalance >= cost;

// Selling
const canSell = yesBalance >= amount || noBalance >= amount;

// LP Withdraw
const canWithdraw = lpBalance >= shares;

// Claims
const canClaim = settlementRoot !== 0 && !claimed;
```

## Fee Display

```typescript
const orderbookFee = await feeController.orderbookFee(); // Global
const ammFee = await market.feeLMSR(); // Per market

// Display
console.log(`Orderbook: ${orderbookFee / 100}%`);
console.log(`AMM: ${ammFee / 100}%`);
```

## Events

| Contract      | Event                                                 | Purpose             |
| ------------- | ----------------------------------------------------- | ------------------- |
| Market        | `Trade(trader, outcome, shares, cost, obFee, ammFee)` | Trade executed      |
| Market        | `OrderPlaced(id, maker, outcome, price, amount)`      | Limit order created |
| Market        | `OrderFilled(id, amount)`                             | Order matched       |
| GovernorVault | `Deposit(lp, assets)`                                 | LP deposit          |
| GovernorVault | `Withdraw(lp, assets, receiver)`                      | LP withdraw         |
| Settlement    | `Claimed(marketId, batchId, account, pnlDelta)`       | PnL claimed         |

## Common Errors

| Error                       | Fix                    |
| --------------------------- | ---------------------- |
| `insufficient free balance` | Deposit to TraderVault |
| `slippage exceeded`         | Increase maxCost       |
| `not live`                  | Market settled         |
| `not enough YES/NO`         | Insufficient shares    |

## Full Documentation

See [CONTRACT_INTERFACES.md](./CONTRACT_INTERFACES.md) for complete ABIs and examples.
