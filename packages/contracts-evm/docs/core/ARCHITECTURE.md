# Sooth Protocol Architecture

**Status:** Current (v4.0 - Dual-Venue Hybrid)  
**Last Updated:** 2025-12-10

---

## Architecture Overview

Sooth V4 introduces a **Dual-Venue** architecture, combining an integer-based **Central Limit Order Book (CLOB)** with a WAD-based **Continuous LMSR AMM**.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SOOTH PROTOCOL V4                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐              ┌─────────────────┐              │
│  │ SoothTraderVault│              │SoothGovernorVault│             │
│  │       V4        │              │   (LP Funds)    │              │
│  ├─────────────────┤              ├─────────────────┤              │
│  │ • User Accounts │              │ • LP Deposits   │              │
│  │ • AMM Positions │              │ • Market Reserves│             │
│  │ • Order Collateral             │ • AMM PnL       │              │
│  └────────┬────────┘              └────────┬────────┘              │
│           │                                │                        │
│           └────────────────┬───────────────┘                        │
│                            │                                        │
│                            ▼                                        │
│                 ┌──────────────────────┐                           │
│                 │    SoothMarketV4     │                           │
│                 │ (Continuous LMSR)    │                           │
│                 ├──────────────────────┤                           │
│                 │ • AMM Logic (qYes/No)│                           │
│                 │ • Orderbook Matching │                           │
│                 │ • Price Discovery    │                           │
│                 └──────────┬───────────┘                           │
│                            │                                        │
│                 ┌──────────▼───────────┐                           │
│                 │    OutcomeToken      │                           │
│                 │      (ERC1155)       │                           │
│                 │ (Orderbook Shares)   │                           │
│                 └──────────────────────┘                           │
│                                                                     │
│   ┌─────────────────┐                    ┌─────────────────┐       │
│   │ SoothFeeCtrl    │                    │ SoothTimeLock   │       │
│   │ (Guardian Fees) │                    │ (Governance)    │       │
│   └─────────────────┘                    └─────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. SoothTraderVaultV4 (Dual-Venue)

**Purpose:** The central treasury and position manager for users. It supports two distinct types of positions:

*   **AMM Positions:** Internal accounting (structs). Users hold "virtual" exposure against the AMM. High precision (WAD).
*   **Orderbook Positions:** ERC1155 tokens (`OutcomeToken`). Users hold tangible tokens traded peer-to-peer. Integer precision (Shares).

| Function                            | Description                                      |
| ----------------------------------- | ------------------------------------------------ |
| `deposit(amount)`                   | User deposits USDC.                              |
| `tradeAMM(...)`                     | Executed against Market's Continuous LMSR.       |
| `placeOrder(...)`                   | Places limit order on Market (Integer shares).   |
| `creditMergeProceeds(...)`          | Credits user when merging YES/NO tokens.         |

### 2. SoothMarketV4 (Continuous LMSR)

**Purpose:** Unified market logic handling both AMM pricing and Orderbook matching.

*   **AMM Math:** Uses **Continuous LMSR** (`qYes`, `qNo` state) instead of discrete ticks. Calculates cost using log-sum-exp.
*   **Orderbook:** Standard CLOB matching. Filled orders mint `OutcomeToken`s.
*   **Liquidity:** `bBase` parameter defines AMM depth.

### 3. OutcomeToken (ERC1155)

**Purpose:** Represents **Orderbook Shares** only.
*   **ID 0:** YES Shares
*   **ID 1:** NO Shares
*   **Minting:** Only occurs when Orderbook orders match.
*   **Merging:** Users can merge 1 YES + 1 NO to redeem 1 USDC (via TraderVault).

### 4. SoothGovernorVault

**Purpose:** LP Liquidity Pool.
*   Provides liquidity (`reserve`) to Markets.
*   Absorbs AMM PnL.
*   Earns fees from both AMM and Orderbook trades.

---

## Granularity Model (Hybrid)

V4 uses a hybrid precision model to optimize for both AMM accuracy and Orderbook UX.

| Feature       | Granularity      | Typical Unit | Logic                                   |
| ------------- | ---------------- | ------------ | --------------------------------------- |
| **AMM**       | **Fractional**   | `1e18` (WAD) | Math requires high precision.           |
| **Orderbook** | **Integer Only** | `1` (Share)  | Matches user mental model ("10 shares").|

*   **Orderbook:** `amount = 10` means 10 whole shares.
*   **AMM:** `amount = 10 * 1e18` means 10.0 shares.

---

## Trade Flow

### AMM Trade (Buy YES)
1.  User calls `traderVault.tradeAMM(market, YES, +10e18)` (Buy 10 shares).
2.  Vault calls `market.executeAMMTrade(...)`.
3.  Market updates `qYes`, `qNo` and calculates `cost`.
4.  Vault deducts `cost` from user's USDC balance.
5.  Vault records internal **AMM Position**: `ammPositions[user][market].yesShares += 10e18`.

### Orderbook Trade (Limit Buy YES)
1.  User calls `traderVault.placeOrder(market, YES, price=0.40, amount=10, isBuy=true)`.
2.  Vault locks collateral: `10 * 0.40 = 4.00 USDC`.
3.  Vault calls `market.createOrder(...)`.
4.  **If Matched:**
    *   `OutcomeToken` mints 10 YES to Buyer.
    *   `OutcomeToken` mints 10 NO to Seller (or transfers if they already hold).

---

## Deployment Order

1.  **MockUSDC** (Testnet)
2.  **SoothFeeController**
3.  **SoothGovernorVault** (Linked to USDC)
4.  **SoothTraderVaultV4** (Linked to Governor)
5.  **SoothMarketV4** (Linked to Trader + Governor + Fees)
    *   *Initialize with `OutcomeToken`*
6.  **OutcomeToken**
    *   *Initialize with `Market` + `TraderVault`*

---

## Legacy Removal (V3)
*   Removed `SoothMarket` (V3), `SoothTraderVault` (V3), `SoothLMSRReal` (standalone), `TickCostRegistry`.
*   Removed `ISoothAMM` interface.
*   Replaced with pure V4 stack.

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
