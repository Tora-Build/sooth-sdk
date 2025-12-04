# Orderbook & Unified Ladder Integration Guide

**Date:** 2025-12-04
**Version:** 2.0

## Overview

The Sooth Protocol implements a **hybrid liquidity model** combining:

1. **LMSR AMM** - Instant execution with algorithmic pricing
2. **Orderbook** - Limit orders with maker-provided liquidity
3. **Unified Ladder** - Smart routing that automatically finds the best price

## Architecture

```
User calls trade()
       ↓
Unified Ladder (Smart Routing)
       ↓
   ┌───┴───┐
   ▼       ▼
Orderbook  AMM
(Limit)  (Market)
```

### Key Concepts

**Unified Ladder** = Execution strategy (NOT a separate component)

- Automatically routes trades to get the best price
- Tries orderbook first, then falls back to AMM
- Transparent to users - happens in a single transaction

**Token Accounting** = Shared between both systems

- Same `yesBalance` / `noBalance` mappings
- Users receive identical YES/NO tokens regardless of fill source
- No distinction between "orderbook tokens" and "AMM tokens"

## User-Facing Terminology

### Recommended Labels:

| Backend Term   | UI Label                     | User Benefit          |
| :------------- | :--------------------------- | :-------------------- |
| LMSR AMM       | **Market Order**             | Instant execution     |
| Orderbook      | **Limit Order**              | Set your price        |
| Unified Ladder | **Smart Routing** (optional) | Best price guaranteed |

**Don't expose:** "Unified Ladder", "LMSR", "Synthetic" - these are implementation details.

## Contract Interfaces

### SoothMarket.sol

#### `placeOrder` - Create Limit Order

```solidity
function placeOrder(
    uint8 outcome,   // 0 = YES, 1 = NO
    uint256 price,   // Price per share (1e18), e.g., 0.6 ether
    uint256 amount   // Number of shares (1e18)
) external returns (uint256 orderId);
```

- **Action:** Places a limit order to SELL an outcome
- **Collateral:** Locks `(1 - price) * amount` in Vault
- **Returns:** Unique `orderId`

#### `cancelOrder` - Cancel Limit Order

```solidity
function cancelOrder(uint256 orderId) external;
```

- **Action:** Cancels order and refunds locked collateral
- **Requires:** Caller must be the order maker

#### `trade` - Execute Trade (Market or Smart Routed)

```solidity
function trade(
    uint8 outcomeIndex,
    int256 deltaShares,
    int256 maxCost
) external;
```

- **Behavior:** Automatically routes through orderbook first, then AMM
- **User Experience:** Single transaction, best price execution
- **No Change:** Same function signature as before

### Reading the Orderbook

```solidity
struct Order {
    uint256 id;
    address maker;
    uint8 outcome;      // 0 = YES, 1 = NO
    uint256 price;      // 1e18 fixed point
    uint256 amount;     // Remaining size
    uint256 timestamp;
}

mapping(uint256 => Order) public orders;
mapping(uint8 => uint256) public bestOrder;  // Head of linked list
mapping(uint256 => uint256) public nextOrder; // Next order in list
```

#### Fetching Orderbook (Frontend)

```javascript
// Get all asks for YES outcome
async function fetchOrderbook(marketAddress, outcome) {
  const market = new ethers.Contract(marketAddress, ABI, provider);
  const orders = [];
  let currentId = await market.bestOrder(outcome);

  while (currentId !== 0 && orders.length < 50) {
    const order = await market.orders(currentId);
    orders.push({
      id: order.id,
      maker: order.maker,
      price: ethers.formatEther(order.price),
      amount: ethers.formatEther(order.amount),
    });
    currentId = await market.nextOrder(currentId);
  }
  return orders;
}
```

## User Flows

### 1. Placing a Limit Order (Maker)

```
User Input:
- Outcome: YES
- Price: 0.60
- Amount: 100 shares

Frontend Calculates:
- Collateral = (1 - 0.60) × 100 = 40 USDC

Steps:
1. Check/request approval: collateral.approve(vault, 40 USDC)
2. Call: market.placeOrder(0, 0.6e18, 100e18)
3. Display: "Order placed! Locked 40 USDC"
```

### 2. Market Order (Taker) - Smart Routed

```
User Input:
- Action: Buy YES
- Amount: 100 shares

What Happens (Automatic):
1. Contract checks orderbook for best prices
2. Fills 60 shares @ 0.58 from limit orders
3. Fills 40 shares @ 0.62 from AMM
4. User gets 100 shares @ 0.60 average

Frontend Display:
"Bought 100 YES @ 0.60 avg"
(Optional: Show breakdown)
```

### 3. Visualizing Execution Breakdown (Optional)

```javascript
// Listen to events during transaction
const receipt = await tx.wait();
const orderFills = receipt.logs
  .filter((log) => log.topics[0] === OrderFilledEventSignature)
  .map((log) => parseOrderFilled(log));

// Display:
if (orderFills.length > 0) {
  console.log("Filled via:");
  orderFills.forEach((fill) => console.log(`  ${fill.amount} @ limit orders`));
  console.log(`  ${remaining} @ market price`);
}
```

## Important Notes

### Collateral Accounting

- **Maker collateral** is locked in `SoothVault`
- Currently tracked in `marketReserves[marketId]` (mixed with AMM PnL)
- **Future improvement:** Separate `lockedMakerCollateral` mapping

### Token Fungibility

- YES/NO tokens are **identical** regardless of source
- A YES token from orderbook = YES token from AMM
- Users can sell tokens acquired from either source

## Events

```solidity
event OrderPlaced(uint256 indexed orderId, address indexed maker,
                  uint8 outcome, uint256 price, uint256 amount);
event OrderCancelled(uint256 indexed orderId);
event OrderFilled(uint256 indexed orderId, uint256 amount);
event Trade(address indexed trader, uint8 outcomeIndex,
            int256 deltaShares, int256 cost);
```

## Testing

See `test/SoothOrderbook.t.sol` for comprehensive test coverage:

- ✅ Order placement and cancellation
- ✅ Orderbook-only fills
- ✅ Unified execution (orderbook + AMM)
- ✅ Price priority (skips expensive orders)

```

```

## UI Execution Breakdown (Recommended)

### Current Limitation
The `trade()` function performs smart routing automatically but only emits:
```solidity
emit Trade(msg.sender, outcomeIndex, deltaShares, totalCost);
```

**Missing:** Breakdown showing how the trade was filled (orderbook vs AMM).

### Recommended Enhancement
```
Bought 100 YES @ 0.60 avg
├─ 60 shares @ 0.58 (Limit Orders)
└─ 40 shares @ 0.62 (Market Price)
```

### Implementation

**Step 1: Listen to OrderFilled Events**
```javascript
async function executeWithBreakdown(market, outcome, shares, maxCost) {
    const tx = await market.trade(outcome, shares, maxCost);
    const receipt = await tx.wait();
    
    const orderFills = receipt.logs
        .filter(log => {
            try {
                return market.interface.parseLog(log).name === 'OrderFilled';
            } catch { return false; }
        })
        .map(log => market.interface.parseLog(log).args);
    
    return { receipt, orderFills };
}
```

**Step 2: Calculate Split**
```javascript
const orderbookShares = orderFills.reduce((sum, fill) => sum + fill.amount, 0n);
const ammShares = totalShares - orderbookShares;
```

**Step 3: Display**
```jsx
{orderbookShares > 0 && <div>├─ {orderbookShares} (Limit)</div>}
{ammShares > 0 && <div>└─ {ammShares} (Market)</div>}
```

**Alternative:** Simple badge: `[Smart Routed ✓]`
