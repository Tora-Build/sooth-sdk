# Trading Flows in Sooth Protocol

**Last Updated:** 2025-12-04

## Overview

The Sooth Protocol supports two trading modes:

1. **Market Orders** - Immediate execution at current market price
2. **Limit Orders** - Deferred execution at specified price

Both modes leverage the **Unified Ladder** execution mechanism that routes trades through the Orderbook first, then the AMM.

---

## Market Orders (Quick Trade)

### Execution Flow

```
User → trade() → Unified Ladder → Orderbook → AMM → Execution
```

### How It Works

1. **User Input**: Select outcome (YES/NO), amount, and slippage tolerance
2. **Cost Estimation**: Frontend calculates max cost using `amm.costDelta()`
3. **Approval**: User approves Vault to spend USDC (for buys)
4. **Execution**: Call `market.trade(outcomeIndex, deltaShares, maxCost)`
5. **Unified Ladder**:
   - Contract checks Orderbook for better prices
   - Fills from cheapest orders first
   - Spills over to AMM if orderbook exhausted
6. **Settlement**: User receives shares (buy) or USDC (sell)

### Contract Function

```solidity
function trade(
    uint8 outcomeIndex,   // 0 = YES, 1 = NO
    int256 deltaShares,   // Positive = Buy, Negative = Sell
    int256 maxCost        // Max USDC willing to pay (or min to receive)
) external;
```

### Requirements

- **Buy**: Sufficient USDC balance + approval to Vault
- **Sell**: Sufficient shares of the outcome being sold
- **Market Status**: Must be `trading` (not paused or settled)

### Key Characteristics

- ✅ **Immediate execution**
- ✅ **Best price** (Orderbook → AMM)
- ✅ **Slippage protection** via `maxCost`
- ❌ No price control (market price only)

---

## Limit Orders (Pro Mode)

### Two Execution Paths

Limit orders have different execution paths depending on whether they cross the spread:

#### Path 1: Passive Limit Order (Maker)

```
User → placeOrder() → Orderbook → Waits for Taker
```

**When:**

- BUY price < Market price
- SELL (any price)

**How:**

1. User specifies outcome, price, and amount
2. Frontend calculates collateral: `(1 - price) * amount`
3. User approves Vault for collateral
4. Call `market.placeOrder(outcome, price, amount)`
5. Order added to orderbook (sorted by price)
6. Waits until a Taker fills it

#### Path 2: Crossing Buy Order (Taker)

```
User → trade() → Unified Ladder → Orderbook → AMM → Execution
```

**When:**

- BUY price ≥ Market price (crosses the spread)

**How:**

1. Frontend detects crossing condition
2. Routes to `market.trade()` instead of `placeOrder()`
3. Executes immediately via Unified Ladder
4. Same flow as Market Order

### Contract Functions

#### placeOrder (Maker)

```solidity
function placeOrder(
    uint8 outcome,   // 0 = YES, 1 = NO
    uint256 price,   // Price per share (1e18), e.g., 0.6 ether
    uint256 amount   // Number of shares (1e18)
) external returns (uint256 orderId);
```

**Collateral Required:**

- `(1 - price) * amount` USDC
- This is the maximum loss if outcome resolves against you

#### cancelOrder

```solidity
function cancelOrder(uint256 orderId) external;
```

**Returns:**

- Locked collateral refunded to user

### Buy vs Sell Logic

#### BUY Orders

**Frontend Implementation:**

- "Buy YES at 0.60" → `placeOrder(1, 0.40, amount)` (Sell NO at 0.40)
- Inverted because buying YES = selling NO at complementary price

**Collateral:**

- Buy YES at 0.60 → Sell NO at 0.40 → Collateral = 0.60 \* amount

#### SELL Orders

**Frontend Implementation:**

- "Sell YES at 0.60" → `placeOrder(0, 0.60, amount)` (Direct)

**Collateral:**

- Sell YES at 0.60 → Collateral = 0.40 \* amount

### Key Characteristics

- ✅ **Price control** (specify exact price)
- ✅ **No shares required** for SELL (uses collateral)
- ✅ **Crossing buys execute immediately** via Unified Ladder
- ❌ **SELL orders always passive** (wait in book)
- ❌ **No guarantee of execution** (depends on market)

---

## Execution Path Summary

| Mode       | Type | Condition      | Function       | Execution | Collateral      |
| ---------- | ---- | -------------- | -------------- | --------- | --------------- |
| **Market** | Buy  | Any            | `trade()`      | Immediate | USDC (cost)     |
| **Market** | Sell | Any            | `trade()`      | Immediate | Shares          |
| **Limit**  | Buy  | Price < Market | `placeOrder()` | Waits     | USDC (1-p)\*amt |
| **Limit**  | Buy  | Price ≥ Market | `trade()`      | Immediate | USDC (cost)     |
| **Limit**  | Sell | Any            | `placeOrder()` | Waits     | USDC (1-p)\*amt |

---

## Unified Ladder Mechanism

The Unified Ladder is the core execution engine that provides best price execution:

### How It Works

1. **Check Orderbook**: Scan for orders better than AMM price
2. **Fill Orders**: Execute against orderbook orders (cheapest first)
3. **Spillover to AMM**: If orderbook exhausted, use AMM for remaining amount
4. **Price Improvement**: User gets weighted average price (often better than pure AMM)

### Example

**Scenario:** Buy 100 YES shares

**Orderbook State:**

- Ask 1: 50 shares @ 0.48
- Ask 2: 30 shares @ 0.50
- AMM Price: 0.52

**Execution:**

1. Fill 50 shares @ 0.48 (from Ask 1)
2. Fill 30 shares @ 0.50 (from Ask 2)
3. Fill 20 shares @ 0.52 (from AMM)
4. **Average Price:** 0.496 (better than 0.52 AMM-only)

---

## Frontend Integration Notes

### Market Orders

- Use `useTradeQuote` hook for cost estimation
- Display slippage tolerance selector (default: 0.5%)
- Show price impact warning if > 5%
- Validate user has sufficient balance/shares

### Limit Orders

- Detect crossing orders and route appropriately
- Show dynamic notification:
  - "Crossing buy order - executes via Unified Ladder"
  - "Limit order - waits in orderbook until filled"
- Calculate and display collateral requirement
- Provide "My Orders" view for order management
- Implement cancel functionality

### Shared Components

- Both modes approve Vault (not Market contract)
- Both benefit from Unified Ladder execution
- Both require market to be in `trading` status

---

## Best Practices

### For Traders

- **Market Orders**: Use when you need immediate execution and accept current price
- **Limit Orders**: Use when you want price control and can wait
- **Crossing Limit Buys**: Get best of both worlds (price limit + immediate execution)

### For Developers

- Always fetch fresh market data before trading
- Implement proper error handling for reverts
- Show clear feedback on execution path
- Validate inputs before contract calls
- Handle approval flow gracefully

---

## Common Issues

### Market Orders

**"Insufficient USDC"**

- User doesn't have enough balance for `maxCost`
- Solution: Display balance, suggest reducing amount

**"Not Enough [Outcome] Shares"**

- User trying to sell shares they don't own
- Solution: Validate against `userYesShares`/`userNoShares`

### Limit Orders

**"Unexpected error" on placeOrder**

- Usually insufficient USDC for collateral
- Solution: Check balance against `(1 - price) * amount`

**Order not matching**

- SELL orders don't auto-execute (even if crossing)
- Solution: Explain that SELL orders wait for Takers

**Crossed orderbook**

- Multiple user orders creating arbitrage opportunity
- Solution: This is normal, wait for Takers to resolve

---

## Related Documentation

- [Orderbook Integration Guide](./contract-integration/ORDERBOOK_INTEGRATION.md)
- [Contract Deployment Info](./contract-integration/README.md)
- [Liquidity Dynamics](./core/LIQUIDITY_DYNAMICS.md)
