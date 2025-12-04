# Sooth Protocol Architecture

**Status:** Current (v2.0 - Singleton Trader Vault)  
**Last Updated:** 2025-12-04

---

## Architecture Overview

The Sooth Protocol uses a **Singleton Trader Vault** architecture, replacing the previous shared vault model.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SOOTH PROTOCOL                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐              ┌─────────────────┐              │
│  │ SoothTraderVault│              │SoothGovernorVault│             │
│  │   (User Funds)  │              │   (LP Funds)    │              │
│  ├─────────────────┤              ├─────────────────┤              │
│  │ • Deposits      │              │ • LP Deposits   │              │
│  │ • Withdrawals   │              │ • LP Withdrawals│              │
│  │ • Free Balance  │              │ • Market Reserves│             │
│  │ • Locked Collat.│              │ • AMM PnL       │              │
│  └────────┬────────┘              └────────┬────────┘              │
│           │                                │                        │
│           └───────────┬───────────────────┘                        │
│                       │                                             │
│                       ▼                                             │
│            ┌──────────────────────┐                                │
│            │     SoothMarket      │                                │
│            │  (Per-Market Logic)  │                                │
│            ├──────────────────────┤                                │
│            │ • AMM Trading        │                                │
│            │ • Orderbook Trading  │                                │
│            │ • Fee Application    │                                │
│            │ • Governor Controls  │                                │
│            └──────────────────────┘                                │
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐ │
│  │ SoothFeeCtrl    │    │ SoothSettlement │    │  SoothLMSRReal │ │
│  │ (Guardian Fees) │    │ (PnL Dist.)     │    │  (AMM Curve)   │ │
│  └─────────────────┘    └─────────────────┘    └────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Contracts

### 1. SoothTraderVault

**Purpose:** Manages ALL user funds (traders).

| Function                            | Description                     |
| ----------------------------------- | ------------------------------- |
| `deposit(amount)`                   | User deposits USDC, gets credit |
| `withdraw(amount)`                  | User withdraws USDC             |
| `lockCollateral(user, amount)`      | Market locks funds for orders   |
| `unlockCollateral(user, amount)`    | Market unlocks funds            |
| `payToGovernor(user, amount)`       | Transfer from user to LP pool   |
| `receiveFromGovernor(user, amount)` | Transfer from LP pool to user   |

### 2. SoothGovernorVault

**Purpose:** Manages LP liquidity (ERC4626-style shares).

| Function                                 | Description                 |
| ---------------------------------------- | --------------------------- |
| `depositFor(lp, assets)`                 | LP deposits, gets svTokens  |
| `withdrawFor(lp, assets, receiver)`      | LP withdraws                |
| `allocateExposure(marketId, amount)`     | Reserve capacity for market |
| `receiveFunds(marketId, amount)`         | Receive from market trades  |
| `sendFunds(marketId, recipient, amount)` | Pay out for market trades   |

### 3. SoothMarket

**Purpose:** Per-market trading logic.

| Parameter  | Controller | Description                         |
| ---------- | ---------- | ----------------------------------- |
| `b`        | Governor   | Liquidity parameter (increase only) |
| `feeLMSR`  | Governor   | AMM trade fee (basis points)        |
| `governor` | Factory    | Market governor address             |

**Key Functions:**

- `trade(outcome, deltaShares, maxCost)` - Execute trade
- `placeOrder(outcome, price, amount)` - Place limit order
- `cancelOrder(orderId)` - Cancel limit order
- `increaseB(amount)` - Governor increases liquidity
- `setFeeLMSR(feeBps)` - Governor sets AMM fee

### 4. SoothFeeController

**Purpose:** Guardian-controlled global fee settings.

| Parameter      | Controller | Description                         |
| -------------- | ---------- | ----------------------------------- |
| `orderbookFee` | Guardian   | Unified orderbook fee (all markets) |
| `lpSplitBps`   | Guardian   | % of fees to LP pool                |
| `treasury`     | Guardian   | Protocol treasury address           |

---

## Fee Structure

### Two Fee Types

| Fee Type       | Controller | Scope      | Applied To          |
| -------------- | ---------- | ---------- | ------------------- |
| **LMSR (AMM)** | Governor   | Per market | AMM trades          |
| **Orderbook**  | Guardian   | Global     | Limit order matches |

### Fee Flow

```
AMM Trade:
  User pays: Cost + (Cost × feeLMSR / 10000)
  Fee goes to: GovernorVault (LP benefit)

Orderbook Trade:
  User pays: Cost + (Volume × orderbookFee / 10000)
  Fee goes to: GovernorVault (LP benefit)
```

---

## Roles & Permissions

### Protocol Guardian (Owner of FeeController)

| Can Do                     | Cannot Do                  |
| -------------------------- | -------------------------- |
| Set orderbook fee (global) | Set per-market fees        |
| Set LP split ratio         | Control individual markets |
| Set treasury address       | Freeze user funds          |

### Governor (Per Market)

| Can Do                       | Cannot Do                         |
| ---------------------------- | --------------------------------- |
| Increase `b` (add liquidity) | Decrease `b` (withdraw liquidity) |
| Set `feeLMSR` (AMM fee)      | Set orderbook fee                 |
| N/A                          | Settle markets (Adjudicator role) |

### Factory Owner

| Can Do                      |
| --------------------------- |
| Create new markets          |
| Authorize markets on vaults |
| Set default AMM             |

---

## Removed Components (v1 → v2)

| Removed                        | Replaced By                               |
| ------------------------------ | ----------------------------------------- |
| `SoothVault`                   | `SoothGovernorVault` + `SoothTraderVault` |
| `SoothRiskManager`             | Governor sets `b` directly                |
| `bGlobal` calculation          | Fixed `b` per market                      |
| Risk tiers (LOW, MEDIUM, etc.) | Governor discretion                       |
| `SoothSmartAccount`            | Direct `SoothTraderVault` deposits        |

---

## Liquidity Parameter (`b`)

### Design Philosophy

- **Governor sets `b` at market creation**
- **`b` can only INCREASE** (Governor can add liquidity, never remove)
- **No formulas or automatic calculation**

### Guidelines (Not Enforced On-Chain)

| Risk Profile | Suggested `b` | Rationale                            |
| ------------ | ------------- | ------------------------------------ |
| Low Risk     | 25,000 USDC   | More capital exposure, tight spreads |
| Medium Risk  | 10,000 USDC   | Balanced                             |
| High Risk    | 5,000 USDC    | Less capital exposure, wider spreads |

**Higher `b`** = More liquidity = Lower slippage = More capital at risk  
**Lower `b`** = Less liquidity = Higher slippage = Less capital at risk

---

## Contract Deployment Order

```
1. MockERC20 (or real USDC)
2. SoothGovernorVault
3. SoothTraderVault
4. SoothLMSRReal (AMM)
5. SoothFeeController
6. SoothAdjudicatorRegistry
7. SoothSettlement
8. SoothMarketFactory

Authorizations:
- GovernorVault.setAuthorized(Settlement, true)
- GovernorVault.setAuthorized(Factory, true)
- TraderVault.setMarket(Settlement, true)
- TraderVault.setGovernorVault(GovernorVault)

Per-Market:
- GovernorVault.setAuthorized(Market, true)
- TraderVault.setMarket(Market, true)
```

---

## Trade Flow

### AMM Trade (Buy)

```
1. User calls market.trade(YES, +100, maxCost)
2. Market calculates: cost = AMM.costDelta(...)
3. Market calculates: fee = cost * feeLMSR / 10000
4. TraderVault.payToGovernor(user, cost + fee)
5. GovernorVault.receiveFunds(marketId, cost + fee)
6. User receives shares (yesBalance[user] += 100)
7. Emit Trade(user, YES, +100, cost, 0, fee)
```

### Orderbook Trade (Buy)

```
1. User calls market.trade(YES, +100, maxCost)
2. Market matches against existing orders
3. For each fill: TraderVault.lockCollateral(user, cost)
4. Orderbook fee calculated: fee = volume * orderbookFee / 10000
5. TraderVault.payToGovernor(user, fee)
6. User receives shares
7. Remaining fills via AMM (with AMM fee)
```

---

## Frontend Integration Changes

### Old (v1)

```javascript
// Approve Market
await usdc.approve(marketAddress, amount);
// Deposit directly via Market
await market.deposit(amount);
```

### New (v2)

```javascript
// Approve TraderVault
await usdc.approve(traderVaultAddress, amount);
// Deposit to TraderVault
await traderVault.deposit(amount);
// Trade (funds already in vault)
await market.trade(outcome, shares, maxCost);
```

### New Contract Addresses to Track

```javascript
const contracts = {
  traderVault: "0x...", // NEW - User deposits here
  governorVault: "0x...", // Renamed from SoothVault
  feeController: "0x...", // NEW - Query orderbook fee
  // ... markets as before
};
```

---

**See Also:**

- [FEE_DESIGN.md](../research/FEE_DESIGN.md) - Complete fee mechanism details
- [SINGLETON_TRADER_VAULT.md](./SINGLETON_TRADER_VAULT.md) - Architecture rationale
