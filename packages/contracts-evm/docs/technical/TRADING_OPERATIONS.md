# Trading Operations (Custodial Model V4)

## Overview

Sooth Protocol V4 uses a **Custodial Model** for orderbook trading to improve capital efficiency and user experience.
Instead of requiring frequent ERC1155 transfers for every order, the `SoothTraderVaultV4` maintains an internal ledger (`shareBalances`) of user positions.

### Asset Flow Summary
-   **USDC**: User's `available` balance in `TraderVault` (Deposited via `deposit()`).
-   **Shares**: User's `shareBalances` in `TraderVault` (Deposited via `depositShares()` or bought).
-   **Withdrawal**: Users can withdraw USDC or Shares (ERC1155) to their wallet at any time.

---

## 1. Limit Buy (Orderbook)

**Scenario**: User wants to buy Outcome Tokens at a specific price using USDC.

-   **Input**: USDC (`available` internal balance).
-   **Action**: `placeOrder(market, outcome, price, amount, isBuy=true)`
-   **Collateral**: USDC is locked (`Amount * Price`).

### Token Flow

```text
                  [Transaction A: Placement (Buyer)]
+------+             +-------------+              +--------+
| User |             | TraderVault |              | Market |
+--+---+             +------+------+              +----+---+
   |                        |                        |
   | [1. Debit USDC]        |                        |
   +----------------------->|                        |
   |                        | [2. Place "Buy YES"]   |
   |                        +----------------------->|
                                                     |
                                                     v
                  [Transaction B: Matching (Seller)]
                     +--------+                   +--------+
                     | Market |                   | Seller |
                     +----+---+                   +----+---+
                          |                            |
                          |      [3. Match]            |
                          |<---------------------------+
                          |                            |
                          |      [4. Mint/Transfer]    |
                          +--------------------------->|
   [5. Credit Shares]     |    (Vault receives YES)    |
   (Internal Balance)     |                            |
```

1.  **Lock**: Vault debits user's `available` USDC.
2.  **Order**: Vault places order on `SoothMarket` as the Maker.
3.  **Match**: When matched, Vault receives Outcome Tokens (held custodially).
4.  **Credit**: Vault credits `shareBalances[user][market][outcome]`.

---

## 2. Spot Sell (Closing a Position)

**Scenario**: User owns shares (in `shareBalances`) and wants to sell them.

-   **Input**: Shares (`shareBalances`).
-   **Action**: `placeSpotOrder(market, outcome, price, amount)`
-   **Collateral**: Shares are locked from `shareBalances`.

### Token Flow (Custodial)

```text
                  [Transaction A: Placement (Seller)]
+------+             +-------------+
| User |             | TraderVault |
+--+---+             +------+------+
   |                        |
   | [1. Debit Shares]      |
   +----------------------->|
   | (Internal Ledger)      | [2. Lock Shares]
   |                        +-------+
                                    |
                                    v
                  [Transaction B: Matching (Buyer)]
                     +-------------+              +-------+
                     | TraderVault |              | Buyer |
                     +------+------+              +---+---+
                            |                         |
                            |    [3. Match/Fill]      |
                            |<------------------------+
                            |    [Provide USDC]       |
                            |                         |
                            | [4. Merge/Burn]         |
                            +------------------------>|
     [5. Credit USDC]       |                         |
   (Internal Balance)       |                         |
```

1.  **Lock**: Vault debits `shareBalances`. Moves shares to `spotOrders` (logic lock).
2.  **Match**: Buyer pays USDC. Market matches and mints pairs.
3.  **Burn**: Vault holds the Seller's YES (locked) and the Buyer's matching NO. These merge to 1.0 USDC collateral.
4.  **Payout (The Fix)**:
    -   **Proceeds**: 1.0 USDC (from Merge).
    -   **Matched Value**: `Price * Amount`.
    -   **User Payout**: `Price * Amount`.
    -   Vault retains the difference (Implicit Hedge Cost).
5.  **Credit**: Vault credits user's `available` USDC.

---

## 3. Short Sell (Opening a Position)

**Scenario**: User wants to profit from a price drop (Selling YES without owning it).

-   **Input**: USDC.
-   **Action**: `placeOrder(..., isBuy=false)` "Sell YES"
-   **Logic**: Mathematically equivalent to **Buying NO**.
-   **Collateral**: USDC (`Amount * (1 - Price)`).

### Token Flow

```text
                  [Transaction A: Placement (Seller)]
+------+             +-------------+              +--------+
| User |             | TraderVault |              | Market |
+--+---+             +------+------+              +----+---+
   |                        |                        |
   | [1. Debit USDC]        |                        |
   +----------------------->|                        |
   |                        | [2. Place "Buy NO"]    |
   |                        +----------------------->|
                                                     |
                                                     v
                  [Transaction B: Matching (Buyer)]
                     +--------+                   +-------+
                     | Market |                   | Buyer |
                     +----+---+                   +---+---+
                          |                           |
                          |      [3. Match]           |
                          |<--------------------------+
                          |   [Remaining USDC]        |
                          |                           |
                          |      [4. Mint Sets]       |
                          +-------------------------->|
   [5. Credit SHARES]     |    (Vault receives NO)    |
   (Internal Balance)     |                           |
```

1.  **Lock**: Vault debits USDC.
2.  **Order**: Vault places a **Buy NO** order.
3.  **Match**: Vault receives NO tokens.
4.  **Credit**: Vault credits `shareBalances[user][market][OPPOSITE_OUTCOME]`.

---

## 4. Hybrid Sell (Atomic Split)

**Scenario**: User wants to sell `X` amount but only owns `Y` shares (where `Y < X`).

-   **Action**: `executeHybridSell(market, outcome, price, totalAmount)`
-   **Logic**:
    1.  Check `shareBalances`.
    2.  `SpotAmount = min(Balance, TotalAmount)`
    3.  `ShortAmount = TotalAmount - SpotAmount`
    4.  Execute both orders atomically.

### Token Flow (Example: Sell 100 YES, Own 40 YES)

```text
                  [Transaction A: Placement (Seller)]
           +------+
           | User |
           +--+---+
              |
              | 1. Request: Hybrid Sell(100 YES)
              v
      +-------+-------+
      |  TraderVault  | << Checks Internal Balance: 40 YES
      +-------+-------+
              |
              v
      +-------+-------+ 
      |   SPLIT LOGIC | 
      +-------+-------+
      |               |
      v               v
 [Spot Leg]      [Short Leg]
 (40 YES)        (60 YES)
      |               |
      v               v
+-----+-----+   +-----+-----+
| Debit     |   | Debit     |
| Shares    |   | Collateral|
| (40 YES)  |   | (for 60)  |
+-----------+   +-----------+
      |               |
      v               v
 [Spot Order]    [Short Order]
 [Sell 40]       [Buy 60 NO]
```

**Transaction A: Placement (Seller)**
-   **Analysis**: Vault determines split (40 Spot, 60 Short).
-   **Execution**: 
    1.  **Spot**: Debits 40 YES from `shareBalances`, creates Spot Sell Order.
    2.  **Short**: Debits USDC collateral, creates Short Sell Order.
(All happens in ONE atomic transaction).
