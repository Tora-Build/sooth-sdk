# Frontend Integration Documentation

**Version:** v1.1 (Current Architecture)
**Updated:** 2025-12-04

> [!IMPORTANT] > **Architecture Note:** `SoothTraderVault` is the **SINGLE** entry point for all user actions (Deposit, Withdraw, Trade, Claim). Do not interact with Market contracts directly for trading.

---

## 🚀 Quick Start

```javascript
// 1. Approve TraderVault (once)
await usdc.approve(traderVaultAddress, amount);

// 2. Deposit USDC
// Auto-claims any unlocked funds from previous sells!
await traderVault.deposit(amount);

// 3. Trade (Buy/Sell)
// Note: Call tradeAMM on TraderVault, NOT on the Market contract
await traderVault.tradeAMM(marketAddress, outcomeIndex, deltaShares, maxCost);
```

---

## 📦 Contract Addresses

| Network               | File                                   | Status    |
| --------------------- | -------------------------------------- | --------- |
| Base Sepolia (84532)  | [deployments.json](./deployments.json) | ✅ Live   |
| Monad Testnet (10143) | _Coming Soon_                          | ⏸️ Paused |

### Key Contracts

| Contract             | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `SoothTraderVault`   | **Main Entry Point** (Deposit, Trade, Claim) |
| `SoothMarket`        | Market logic (read-only for FE)              |
| `SoothGovernorVault` | LP Liquidity Management                      |
| `MockUSDC`           | Testnet Stablecoin                           |

---

## 🧩 Key Features (v1.1)

### 1. Lazy View & Auto-Claim

User funds from selling shares are time-locked for 48h.

- **Display:** `availableBalance(user)` _includes_ funds that are unlocked but not yet claimed.
- **Action:** Any `deposit`, `withdraw`, or `trade` automatically claims unlocked funds.
- **Manual:** `claimUnlocked()` is optional.

### 2. Unified Orderbook

- **Sell YES** matches **Buy NO**.
- Single liquidity pool for AMM and Orderbook.

### 3. Settlement Redemption

- Winners redeem shares via `traderVault.redeem(marketAddress)`.
- 1 Winning Share = 1 USDC.

---

## 📖 Documentation Index

### Integration Guides

| Document                                               | Description                                        |
| ------------------------------------------------------ | -------------------------------------------------- |
| [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)         | **Start Here:** Full migration & integration guide |
| [SETTLEMENT_GUIDE.md](./SETTLEMENT_GUIDE.md)           | How to handle locks, claims, and redemption        |
| [ORDERBOOK_INTEGRATION.md](./ORDERBOOK_INTEGRATION.md) | Limit orders & unified book logic                  |
| [ABI_GUIDE.md](./ABI_GUIDE.md)                         | Working with contract ABIs                         |
| [UX_RECOMMENDATIONS.md](./UX_RECOMMENDATIONS.md)       | Best practices for UI/UX                           |

### Reference

| Document                                       | Description             |
| ---------------------------------------------- | ----------------------- |
| [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) | Current deployment info |
| [DOCS_SUMMARY.md](./DOCS_SUMMARY.md)           | Overview of all docs    |

---

## 🆘 Common Issues

| Error                     | Fix                                                                 |
| ------------------------- | ------------------------------------------------------------------- |
| `insufficient allowance`  | Approve `SoothTraderVault` (not Market)                             |
| `insufficient balance`    | Call `traderVault.deposit()`                                        |
| `slippage exceeded`       | Increase `maxCost` (include fees)                                   |
| `transfer failed`         | Check MockUSDC balance or allowance                                 |
| `TraderVault: not market` | You are trying to call restricted function (use `tradeAMM` instead) |
