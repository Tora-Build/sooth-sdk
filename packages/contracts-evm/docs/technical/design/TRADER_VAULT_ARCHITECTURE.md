# Singleton Trader Vault Architecture Design

**Date:** 2025-12-04
**Status:** Draft

## 1. Overview

The **Singleton Trader Vault** (`SoothTraderVault`) acts as the central custodian for all user funds (USDC). It replaces the direct wallet-to-market interaction model, eliminating the need for repeated token approvals and enabling advanced features like Retroactive Finality and Yield Farming.

## 2. Core Components

### 2.1 SoothTraderVault (New)

- **Responsibility:** Holds User USDC, tracks User free/locked balances.
- **Key Mappings:**
  - `userShares[user]`: Total USDC shares (ERC4626-style or simple 1:1).
  - `lockedCollateral[user]`: Total USDC locked in orders/positions.
- **Interactions:**
  - Accepts deposits/withdrawals from Users.
  - Proxies trades to Markets.
  - Handles fund transfers to `GovernorVault` (for AMM trades).

### 2.2 SoothGovernorVault (Refactored & Simplified)

- **Responsibility:** Holds LP USDC, acts as counterparty for AMM trades.
- **Key Changes:**
  - **Removed:** `RiskManager` and `b_global` logic.
  - **Simplified:** Governor manually sets `b` per market (off-chain risk management).
  - Only accepts funds from `TraderVault` (for AMM trades).
  - Pays funds to `TraderVault` (for AMM wins).

### 2.3 SoothMarket (Updated)

- **Responsibility:** Manages Orderbook & AMM state, User Positions.
- **Key Changes:**
  - `b` is now a fixed parameter (set by Governor), not dynamic.
  - `trade()` becomes `tradeFor(user, ...)` restricted to `TraderVault`.
  - Instead of `transferFrom(user)`, it calls `traderVault.lockFunds(user, amount)` or `traderVault.payToGovernor(user, amount)`.

## 3. Interaction Flows

### 3.1 Deposit

1. **User** calls `traderVault.deposit(1000 USDC)`.
2. **TraderVault** pulls 1000 USDC from User.
3. **TraderVault** credits `userShares[user] += 1000`.

### 3.2 Place Limit Order (Maker)

1. **User** calls `traderVault.placeOrder(market, outcome, price, amount)`.
2. **TraderVault** calls `market.placeOrderFor(user, outcome, price, amount)`.
3. **Market** calculates `requiredCollateral`.
4. **Market** calls `traderVault.lockCollateral(user, requiredCollateral)`.
   - `TraderVault` checks `freeBalance >= requiredCollateral`.
   - `TraderVault` updates `lockedCollateral[user] += requiredCollateral`.
5. **Market** records order.

### 3.3 Market Buy (Taker) - Unified Ladder

1. **User** calls `traderVault.trade(market, outcome, shares, maxCost)`.
2. **TraderVault** calls `market.tradeFor(user, outcome, shares, maxCost)`.
3. **Market** executes Unified Ladder:
   - **Part A (Orderbook Match):**
     - Matches against Maker order.
     - **Market** calls `traderVault.transferLockedToUser(maker, user, cost)`.
     - (Or simply unlocks Maker collateral and debits Taker? No, Taker pays Maker).
     - _Correction:_ Taker pays USDC. Maker receives USDC (or it stays locked if short?).
     - _Refined Logic:_
       - Maker was Short YES (locked 1-P).
       - Taker Buys YES (pays P).
       - Total (1) is now locked for the position?
       - Actually, if Taker Buys YES from Maker (Short YES), the Maker's Short YES position is matched.
       - The USDC from Taker (P) + USDC from Maker (1-P) = 1 USDC.
       - This 1 USDC is now the backing for the YES token held by Taker and NO token held by Maker (implicit).
       - Wait, Maker sold YES. Taker bought YES.
       - Maker is Short YES (Long NO). Taker is Long YES.
       - So 1 USDC is locked in the protocol to back this pair.
   - **Part B (AMM Match):**
     - **Market** calculates `ammCost`.
     - **Market** calls `traderVault.payToGovernor(user, ammCost)`.
     - `TraderVault` moves USDC from `user` to `GovernorVault`.

### 3.4 Settlement (T\*)

1. **Adjudicator** resolves market.
2. **Settlement** contract calculates PnL.
3. **Settlement** pushes deltas:
   - For AMM positions: `GovernorVault` pays `TraderVault` (credited to user).
   - For Orderbook positions: `TraderVault` unlocks collateral / redistributes locked funds.

## 4. Interfaces

### ISoothTraderVault

```solidity
interface ISoothTraderVault {
    // User Actions
    function deposit(uint256 amount) external returns (uint256);
    function withdraw(uint256 amount) external returns (uint256);
    function trade(address market, uint8 outcome, int256 shares, int256 maxCost) external returns (int256 executedShares, int256 cost);
    function placeOrder(address market, uint8 outcome, uint256 price, uint256 amount) external returns (uint256 orderId);

    // Market Actions (Restricted)
    function lockCollateral(address user, uint256 amount) external;
    function unlockCollateral(address user, uint256 amount) external;
    function payToGovernor(address user, uint256 amount) external; // User buys from AMM
    function receiveFromGovernor(address user, uint256 amount) external; // User sells to AMM
    function transferBetweenUsers(address from, address to, uint256 amount) external; // Orderbook match
}
```

### ISoothMarket (Additions)

```solidity
interface ISoothMarket {
    function tradeFor(address user, uint8 outcome, int256 shares, int256 maxCost) external returns (...);
    function placeOrderFor(address user, uint8 outcome, uint256 price, uint256 amount) external returns (uint256);
}
```

## 5. Security Considerations

- **Trust:** `TraderVault` must only allow whitelisted Markets to call `lock/pay/transfer`.
- **Reentrancy:** Strict checks on external calls.
- **Solvency:** `TraderVault` must never allow `locked + free > totalAssets`.

## 6. Yield Integration (Future)

- `TraderVault` can keep a buffer of liquid USDC and deposit the rest into Aave.
- `totalAssets()` would include Aave balance.
- Users earn yield on _free_ balances? Or all balances? (Business decision).
