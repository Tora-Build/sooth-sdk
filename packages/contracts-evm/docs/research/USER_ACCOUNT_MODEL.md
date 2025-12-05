# Sooth v3 User Account Model

**Status:** Implemented in `SoothTraderVaultV3`  
**Date:** 2025-12-04

---

## Overview

In Sooth v3, the `TraderVault` acts as the single source of truth for all user funds. Unlike v2, where funds were split between the Vault (collateral) and Market tokens, v3 unifies everything into a single account system with two distinct balance states.

## Account States

Each user has a single account in the `TraderVault` with two balances:

| Balance Type  | Description                                     | Usage                                                                                             |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Available** | Liquid USDC that is fully owned and accessible. | • Withdraw to wallet<br>• Trade on AMM<br>• Place Limit Orders                                    |
| **Pending**   | Funds that are temporarily locked for security. | • Cannot be withdrawn<br>• Cannot be used for trading<br>• Must wait for `lockDuration` to expire |

### 1. Available Balance

This is your "working capital".

- **Source:** Deposits from wallet, claimed unlocks.
- **Yield:** Idle available funds are automatically deposited into Aave/Spark to earn yield for the protocol/users.

### 2. Pending Balance (Time-Locked Proceeds)

This represents "unsettled" profits or proceeds.

- **Source:**
  - **Selling Positions:** When you sell YES or NO tokens (via AMM or Orderbook).
  - **Redemption:** When you redeem winning tokens after a market resolves.
- **Mechanism:**
  - Funds are locked for a default of **48 hours** (configurable by Guardian).
  - This creates a "dispute window" where the Guardian can claw back funds in case of retroactive settlement (e.g., if a market was resolved incorrectly due to oracle failure).
- **Unlock:** After the duration passes, users call `claimUnlocked()` to move funds to **Available**.

---

## Money Flow Examples

### Scenario A: Depositing & Buying

1. **Deposit:** Alice deposits 1,000 USDC.
   - `Available`: 1,000
   - `Pending`: 0
2. **Buy YES:** Alice buys 100 YES tokens for 60 USDC.
   - `Available`: 940 (1,000 - 60)
   - `Pending`: 0
   - _Note: She pays upfront. No collateral locking._

### Scenario B: Selling & Locking

1. **Sell YES:** Alice sells her 100 YES tokens for 70 USDC (profit!).
   - `Available`: 940 (unchanged)
   - `Pending`: 70 (new proceeds locked)
   - _Total Equity:_ 1,010
2. **Wait:** Alice waits 48 hours.
3. **Claim:** Alice calls `claimUnlocked()`.
   - `Available`: 1,010 (940 + 70)
   - `Pending`: 0

### Scenario C: Orderbook Trading (Maker)

1. **Place Order:** Bob places a limit order to Buy NO (which is mathematically selling YES) for 40 USDC.
   - `Available`: Decreases by 40 USDC immediately.
   - _Note: Funds are deducted upfront to guarantee solvency._
2. **Cancel Order:** Bob cancels the order before it fills.
   - `Available`: Increases by 40 USDC immediately.
   - _Note: Refunds are NOT locked because they are just returning your own principal._

---

## Security & Safety

- **Solvency:** Users can never trade with funds they don't have. `Available` balance is checked before every action.
- **Retroactive Settlement:** The `Pending` state protects the protocol. If an oracle reports "YES won" but later it's revealed "NO won", the Guardian can recover the wrongly paid out funds from the `Pending` balances before they leave the protocol.
- **Yield:** By centralizing funds in the Vault, we can efficiently manage liquidity reserves and earn yield on the rest, rather than having idle collateral scattered across hundreds of market contracts.
