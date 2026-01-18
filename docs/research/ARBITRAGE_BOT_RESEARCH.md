# Arbitrage Bot Research: TickBook Liquidity Sweep Solution

## Problem Statement

**Current Behavior**: V10 TickBook's `placeOrder` only crosses liquidity **once** at placement time. It doesn't sweep ALL opposing liquidity - just the overlap calculated at that moment.

**Known Issue** (from STATUS.md):
> ⚠️ Market Order Semantics (V10) — Current implementation uses full-range order + overlap-based crossing; it is not a guaranteed book sweep.

### Example of the Problem

```
Initial State: Empty orderbook

1. Alice places YES order at 40-60% for 100 shares
   → No opposing liquidity, order rests entirely

2. Bob places NO order at 30-50% for 100 shares  
   → Overlap with Alice at 50-60%
   → Bob's order crosses with Alice (50 shares each filled)
   → Bob's remaining 50 shares rest at 30-50%

3. Carol places NO order at 55-65% for 100 shares
   → Overlap with Alice at 55-60%
   → Carol's order crosses with Alice (25 shares filled)
   → Carol's remaining 75 shares rest at 55-65%

Problem: Alice still has ~25 shares resting that COULD cross with Carol's resting order!
But since crossing only happens on placement, these never match.
```

### Root Cause in Code

In `TickBookPoolManager._crossUnified()` (lines 1091-1232):

```solidity
// Only calculates overlap ONCE
(uint16 overlapLow, uint16 overlapHigh, bool hasOverlap) = _calculateOverlap(...);

// Only fills what's available in THIS overlap
result.rangeFilled = remainingToFill < oppLiqInOverlap ? remainingToFill : oppLiqInOverlap;
```

The crossing is **non-iterative** - it doesn't loop to find ALL possible crossings.

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

function findCrossingOpportunities(orders: Order[]): CrossingPair[] {
  const yesOrders = orders.filter(o => o.outcome === 1);
  const noOrders = orders.filter(o => o.outcome === 0);
  
  const pairs: CrossingPair[] = [];
  
  for (const yes of yesOrders) {
    for (const no of noOrders) {
      // YES tick range = bid price range
      // NO tick range needs conversion: NO at tick T = asking (1000-T) for YES
      const yesEffectiveLow = yes.tickLower;  // e.g., 400 = 40%
      const yesEffectiveHigh = yes.tickUpper; // e.g., 600 = 60%
      
      const noEffectiveLow = 1000 - no.tickUpper;   // e.g., NO 300-500 → YES ask 500-700
      const noEffectiveHigh = 1000 - no.tickLower;
      
      // Crossing condition: YES bid >= NO ask (in YES terms)
      // YES willing to pay up to yesEffectiveHigh
      // NO willing to accept down to noEffectiveLow
      if (yesEffectiveHigh >= noEffectiveLow) {
        // There's overlap!
        const overlapLow = Math.max(yesEffectiveLow, noEffectiveLow);
        const overlapHigh = Math.min(yesEffectiveHigh, noEffectiveHigh);
        
        if (overlapHigh >= overlapLow) {
          pairs.push({
            yesOrder: yes,
            noOrder: no,
            overlapLow,
            overlapHigh,
            maxCrossable: min(yes.restingShares, no.restingShares)
          });
        }
      }
    }
  }
  
  return pairs;
}
```

### Execution Strategy

#### Option A: Place Crossing Order
Place a small order that triggers crossing:

```typescript
async function triggerCrossing(pair: CrossingPair) {
  // Place a YES order at the overlap price
  // This will cross with the NO resting order
  const midTick = (pair.overlapLow + pair.overlapHigh) / 2;
  
  await poolManager.placeOrder(
    marketKey,
    1,  // YES
    pair.maxCrossable,
    midTick,
    midTick,
    maxCost
  );
}
```

**Problem**: Bot takes on position risk.

#### Option B: Place Opposing Pair (Market-Neutral)
Place both YES and NO orders simultaneously to remain neutral:

```typescript
async function triggerCrossingNeutral(pair: CrossingPair) {
  // Place YES order to cross with resting NO
  await poolManager.placeOrder(marketKey, 1, shares, tickLow, tickHigh, maxCost);
  
  // Place NO order to cross with resting YES  
  await poolManager.placeOrder(marketKey, 0, shares, tickLow, tickHigh, maxCost);
  
  // Net position: ~0 (both sides filled equally)
  // Profit: any spread between the two resting orders
}
```

#### Option C: Cancel-and-Replace (Impersonate Maker)
If bot has access to maker's account (e.g., as a service):

```typescript
// Cancel resting order, replace at better price to trigger cross
await poolManager.cancelOrder(marketKey, staleOrderId);
await poolManager.placeOrder(marketKey, outcome, shares, betterTickLow, betterTickHigh, maxCost);
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
