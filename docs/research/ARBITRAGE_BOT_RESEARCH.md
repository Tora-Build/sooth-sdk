# Arbitrage Bot Research: TickBook Liquidity Sweep Solution

## Problem Statement

**Current Behavior**: V10 TickBook's range orders only cross within their **specified tick range**, not at better prices outside that range.

**Known Issue** (from STATUS.md):
> ⚠️ Market Order Semantics (V10) — Current implementation uses full-range order + overlap-based crossing; it is not a guaranteed book sweep.

### Example of the Problem

```
Initial State:

1. Alice places YES sell at 29% (tick 290) for 100 shares
   → Resting ask at 29¢

2. Bob places YES buy at 30-40% (ticks 300-400) for 100 shares
   → Bob is willing to pay 30-40¢ for YES
   → Bob would HAPPILY pay 29¢ (better price!)
   → But NO MATCH occurs because 29% is outside Bob's tick range [300-400]

Result: Both orders rest. Bob misses a better deal.
```

**The Core Issue**: Range orders treat tick bounds as a **strict filter** ("only match at 30-40%") rather than price tolerance ("willing to pay UP TO 40%").

A buyer at 30-40% should logically accept anything ≤ 40%, including 29%. But the contract only looks for liquidity WITHIN the specified tick range.

### Root Cause in Code

In `TickBookPoolManager._crossUnified()` (lines 1091-1232):

```solidity
// Overlap is calculated between order ranges
(uint16 overlapLow, uint16 overlapHigh, bool hasOverlap) = _calculateOverlap(...);

// Only fills liquidity WITHIN the overlap
// Liquidity at better prices (outside the range) is ignored!
```

The crossing logic doesn't search for liquidity at **better** prices outside the order's tick range.

---

## Solution: Arbitrage Keeper Bot

### Concept

An off-chain bot that:
1. **Monitors** the orderbook for uncrossed liquidity
2. **Identifies** price discrepancies (YES bid >= effective NO ask)
3. **Triggers** crossing by placing small orders that complete the match
4. **Captures** spread profit (if any) or operates at break-even as a public good

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Arbitrage Keeper                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐ │
│  │   Monitor    │───▶│   Analyzer   │───▶│  Executor  │ │
│  │  (Indexer)   │    │  (Matcher)   │    │   (Bot)    │ │
│  └──────────────┘    └──────────────┘    └────────────┘ │
│         │                   │                   │        │
│         ▼                   ▼                   ▼        │
│  Poll orderbook       Find crossing        Place order   │
│  via RPC/Indexer      opportunities        to trigger    │
│                                            crossing      │
└─────────────────────────────────────────────────────────┘
```

### Detection Algorithm

```typescript
interface Order {
  orderId: bigint;
  outcome: 0 | 1;  // 0=NO, 1=YES
  tickLower: number;
  tickUpper: number;
  restingShares: bigint;
}

interface SpotSell {
  sellId: bigint;
  outcome: 0 | 1;
  tick: number;  // Single price point
  shares: bigint;
}

interface ArbitrageOpportunity {
  buyOrder: Order;       // Resting buy order
  sellSource: Order | SpotSell;  // Cheaper sell
  buyPrice: number;      // Buyer's lowest tick (what they'll pay)
  sellPrice: number;     // Seller's ask price
  spread: number;        // Profit per share (in ticks, /10 for %)
  maxShares: bigint;
}

function findArbitrageOpportunities(
  orders: Order[], 
  spotSells: SpotSell[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  
  // Find YES buys with cheaper YES sells available
  const yesBuys = orders.filter(o => o.outcome === 1);
  const yesSells = spotSells.filter(s => s.outcome === 1);
  
  for (const buy of yesBuys) {
    // Buyer willing to pay [tickLower, tickUpper], e.g., 300-400 (30-40%)
    // Look for sells BELOW tickLower (better price for buyer)
    
    for (const sell of yesSells) {
      if (sell.tick < buy.tickLower) {
        // Sell at 29% (290), Buy range 30-40% (300-400)
        // Arbitrage: Buy at 290, sell to resting buyer at 300
        opportunities.push({
          buyOrder: buy,
          sellSource: sell,
          buyPrice: buy.tickLower,  // 300 (30%)
          sellPrice: sell.tick,      // 290 (29%)
          spread: buy.tickLower - sell.tick,  // 10 ticks = 1%
          maxShares: min(buy.restingShares, sell.shares)
        });
      }
    }
  }
  
  // Same logic for NO side (inverted)
  const noBuys = orders.filter(o => o.outcome === 0);
  const noSells = spotSells.filter(s => s.outcome === 0);
  
  for (const buy of noBuys) {
    for (const sell of noSells) {
      if (sell.tick < buy.tickLower) {
        opportunities.push({
          buyOrder: buy,
          sellSource: sell,
          buyPrice: buy.tickLower,
          sellPrice: sell.tick,
          spread: buy.tickLower - sell.tick,
          maxShares: min(buy.restingShares, sell.shares)
        });
      }
    }
  }
  
  // Sort by spread (most profitable first)
  return opportunities.sort((a, b) => b.spread - a.spread);
}
```

### Execution Strategy

#### The Arbitrage Trade

```
State:
- Spot Sell: YES at 29% (290) for 100 shares
- Resting Buy: YES at 30-40% (300-400) for 100 shares

Arbitrage:
1. Bot buys 100 YES from spot sell at 29% → pays 29 USDC
2. Bot sells 100 YES to resting buyer at 30% → receives 30 USDC
3. Profit: 1 USDC (minus gas)
```

#### Implementation

```typescript
async function executeArbitrage(opp: ArbitrageOpportunity) {
  const { buyOrder, sellSource, spread, maxShares } = opp;
  
  // Step 1: Buy from the cheap source (spot sell)
  if ('sellId' in sellSource) {
    // It's a spot sell - use buyFromSpotSell
    await poolManager.buyFromSpotSell(
      marketKey,
      sellSource.sellId,
      maxShares,
      maxCost
    );
  } else {
    // It's a range order - place crossing order at that tick
    await poolManager.placeOrder(
      marketKey,
      sellSource.outcome,
      maxShares,
      sellSource.tickLower,
      sellSource.tickUpper,
      maxCost
    );
  }
  
  // Step 2: Sell to the resting buyer
  // Place a spot sell at the buyer's tick range
  await poolManager.placeSpotSell(
    marketKey,
    buyOrder.outcome,
    maxShares,
    buyOrder.tickLower,  // Sell at buyer's low tick (guaranteed fill)
    buyOrder.tickLower
  );
  
  // Profit = (buyOrder.tickLower - sellSource.tick) * maxShares / 1000
}
```

#### Atomic Execution (Flash Loan Style)

To avoid position risk between steps, bundle in single transaction:

```solidity
// ArbitrageExecutor.sol
function executeArbitrage(
    bytes32 marketKey,
    uint256 spotSellId,
    uint256 buyOrderId,
    uint256 shares
) external {
    // 1. Buy from spot sell (receive YES tokens)
    poolManager.buyFromSpotSell(marketKey, spotSellId, shares, type(uint256).max);
    
    // 2. Immediately sell to resting buyer
    poolManager.placeSpotSell(marketKey, 1, shares, targetTick, targetTick);
    
    // 3. Profit is already in vault as USDC
}
```

### Profitability Analysis

| Scenario | Profit Source | Risk |
|----------|---------------|------|
| Spread exists | Capture bid-ask spread | Execution risk |
| No spread (break-even) | None (public good) | Gas cost |
| Negative spread | None - don't execute | N/A |

**Minimum Spread for Profitability**:
```
minSpread = gasCost / orderSize
         ≈ 500,000 gas × 10 gwei / 100 shares
         ≈ 0.005 ETH / 100 shares
         ≈ 0.00005 ETH/share
         ≈ $0.15/share (at ETH=$3000)
```

On L2s (Base, Monad), gas is much cheaper (~$0.001/share).

---

## Implementation Plan

### Phase 1: Monitor-Only Bot

```typescript
// monitor.ts
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http()
});

async function monitorOrderbook(marketKey: `0x${string}`) {
  // Fetch all active orders
  const orders = await client.readContract({
    address: POOL_MANAGER,
    abi: POOL_MANAGER_ABI,
    functionName: 'getAllMarketOrders',
    args: [marketKey]
  });
  
  // Find crossing opportunities
  const opportunities = findCrossingOpportunities(orders);
  
  if (opportunities.length > 0) {
    console.log('Found crossing opportunities:', opportunities);
  }
}

// Poll every block
setInterval(() => monitorOrderbook(MARKET_KEY), 2000);
```

### Phase 2: Execution Bot

```typescript
// executor.ts
async function executeArbitrage(pair: CrossingPair) {
  // Check profitability
  const gasEstimate = await estimateGas(pair);
  const expectedProfit = calculateProfit(pair);
  
  if (expectedProfit <= gasEstimate) {
    console.log('Not profitable, skipping');
    return;
  }
  
  // Execute
  const tx = await walletClient.writeContract({
    address: POOL_MANAGER,
    abi: POOL_MANAGER_ABI,
    functionName: 'placeOrder',
    args: [marketKey, outcome, shares, tickLow, tickHigh, maxCost]
  });
  
  console.log('Executed arbitrage:', tx);
}
```

### Phase 3: MEV Protection

To avoid being front-run:
1. Use Flashbots/MEV-Share on mainnet
2. Use private mempools where available
3. Bundle multiple crossings in single tx

---

## Alternative Solutions (Contract-Level)

### Option 1: Continuous Matching Engine
Modify `placeOrder` to iterate and cross ALL overlapping orders:

```solidity
function _crossUnifiedIterative(...) {
  while (hasMoreOverlap()) {
    CrossingResult memory partial = _crossOnce(...);
    result.add(partial);
  }
}
```

**Cons**: Unbounded gas, potential DoS vector.

### Option 2: Keeper-Triggered Sweep
Add a `sweep()` function anyone can call:

```solidity
function sweepCrossableOrders(bytes32 marketKey, uint256 maxIterations) external {
  for (uint i = 0; i < maxIterations; i++) {
    (bool found, uint256 yesId, uint256 noId) = _findCrossableOrderPair(marketKey);
    if (!found) break;
    _crossOrderPair(yesId, noId);
  }
}
```

**Pros**: Gas-bounded, permissionless.
**Cons**: Requires contract upgrade.

### Option 3: Matching as Service
Off-chain matcher submits batch of crossings:

```solidity
function batchCross(
  bytes32 marketKey, 
  uint256[] calldata yesOrderIds,
  uint256[] calldata noOrderIds
) external {
  for (uint i = 0; i < yesOrderIds.length; i++) {
    _crossOrderPair(yesOrderIds[i], noOrderIds[i]);
  }
}
```

---

## Recommendation

**Short-term**: Build an off-chain arbitrage bot (Phase 1-2) as a keeper service. This:
- Doesn't require contract changes
- Can be deployed immediately
- Provides immediate UX improvement
- Captures any available spread

**Medium-term**: Add `sweepCrossableOrders()` to contract in next version. This:
- Gives users a way to trigger their own crossings
- Incentivizes keepers with gas refunds
- Makes the system self-healing

---

## Files to Create

```
packages/keeper/
├── src/
│   ├── index.ts           # Entry point
│   ├── monitor.ts         # Orderbook monitoring
│   ├── analyzer.ts        # Crossing detection
│   ├── executor.ts        # Trade execution
│   └── config.ts          # Chain configs
├── package.json
└── README.md
```

---

## References

- [Polymarket Order Matching](https://docs.polymarket.com/)
- [dYdX V4 Orderbook](https://dydx.exchange/blog/v4-deep-dive-orderbook)
- [Flashbots MEV Protection](https://docs.flashbots.net/)
- [Uniswap V3 JIT Liquidity](https://uniswap.org/blog/jit-liquidity)
