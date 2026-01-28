# TickBook Keeper Specification

## Overview

This document covers the TickBook orderbook design philosophy, matching mechanics, and the role of keeper/arbitrage bots as first-class participants in the protocol.

---

## Part 1: TickBook Design Philosophy

### Core Principles

TickBook is designed around two key principles:

#### 1. Modular & Attachable Architecture
TickBook is a **composable liquidity module** that can be:
- Opted into alongside other trading venues (AMM)
- Attached to different market types
- Used independently or in combination

This explains the market lifecycle: `LaunchpadEngine → AMMEngine → TickBookPoolManager`

#### 2. On-Chain Competence Optimization
Unlike traditional off-chain orderbooks (dYdX, Serum), TickBook optimizes for **blockchain constraints**:

| Constraint | TickBook Solution |
|------------|-------------------|
| Gas costs | Bounded operations, no unbounded loops |
| Atomicity | Single-tx execution, deterministic outcomes |
| Compute limits | "Cross once at placement" model |
| MEV | Predictable execution for integrators |

### Match-on-Interaction Model

TickBook uses a **match-on-interaction** model:

```
┌─────────────────────────────────────────────────────────────┐
│                    TickBook Matching                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Maker places order → Order rests in book                  │
│                                                              │
│   Taker places order → Crosses available liquidity          │
│                        → Remainder rests                     │
│                                                              │
│   Keeper calls sweep → Clears stale crossable orders        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key characteristics:**
- Orders cross **once** at placement time
- No continuous background matching
- Bounded gas per transaction
- External actors (keepers) complete price discovery

### Why This Design is Correct

| Traditional Orderbook | TickBook |
|-----------------------|----------|
| Continuous matching engine | Match-on-interaction |
| Unbounded compute OK | Must bound gas |
| Centralized matching | Decentralized, composable |
| Bots = competition | Bots = protocol participants |

**TickBook trades feature completeness for:**
- Predictable gas costs
- Composability with AMMs/routers
- Simpler integration surface
- Deterministic execution

---

## Part 2: Matching Mechanics

### Order Types

| Type | Tick Range | Behavior |
|------|------------|----------|
| **Range Order** | `[tickLower, tickUpper]` | Spread liquidity across range |
| **Limit Order** | `[tick, tick]` | Single price point |
| **Market Order** | `[1, 999]` | Full range (not guaranteed sweep) |
| **Spot Sell** | Single tick | Direct token sale |

### Crossing Logic (`_crossUnified`)

When `placeOrder()` is called:

```
1. Calculate overlap between new order and opposing liquidity
2. Fill SPOT liquidity first (same-outcome tokens)
3. Fill RANGE liquidity second (opposite-outcome orders)
4. Rest any unfilled shares
```

### Range Order Semantics

**Critical Understanding**: Range orders specify a **trading band**, not a price tolerance.

```
Order: YES buy at 30-40% (ticks 300-400)

Means: "I want to trade within the 30-40% price band"
Does NOT mean: "I'll accept any price up to 40%"

Result: A sell at 29% (better price!) will NOT match
        because 29% is outside the specified band.
```

This is **intentional**, not a bug. It enables:
- Concentrated liquidity provisioning (Uniswap v3 style)
- Predictable execution bounds
- Gas-efficient matching

### Known Behavior: "Better Price" Gap

```
State:
  Spot Sell: YES @ 29% (tick 290) for 100 shares
  Buy Order: YES @ 30-40% (ticks 300-400) for 100 shares

Expected by user: Match at 29% (better price!)
Actual behavior: No match (29% outside buyer's range)

This is correct by design. Keepers bridge the gap.
```

---

## Part 3: Keepers as Protocol Participants

### Philosophy: Bots = Feature

In TickBook's architecture, keepers/arbitrage bots are **first-class protocol participants**, not adversaries.

| Role | On-Chain (TickBook) | Off-Chain (Keepers) |
|------|---------------------|---------------------|
| Matching | Bounded, single-cross | Complete matching |
| Sweeping | Not automatic | Keeper-triggered |
| Arbitrage | Creates opportunities | Captures spread |
| Gas | Paid by users | Paid by keepers |

**Division of labor:**
- **Protocol**: Simple, bounded, composable primitives
- **Keepers**: Complex matching, sweeping, price discovery

### Keeper Economics

Keepers are incentivized by **spread capture**:

```
Example Arbitrage:

  Spot Sell: YES @ 29% → Keeper buys at 29 USDC
  Resting Buy: YES @ 30-40% → Keeper sells at 30 USDC
  
  Profit: 1 USDC per 100 shares (minus gas)
```

Profitability threshold:
```
minSpread = gasCost / orderSize

On L2 (Base, Monad):
  ~500k gas × 0.001 gwei ≈ negligible
  Profitable at <0.1% spreads

On L1:
  ~500k gas × 30 gwei ≈ 0.015 ETH
  Need larger spreads or order sizes
```

---

## Part 4: Keeper Bot Implementation

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Keeper Bot                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────┐ │
│  │   Monitor    │───▶│   Analyzer   │───▶│   Executor     │ │
│  │  (Indexer)   │    │  (Matcher)   │    │   (Signer)     │ │
│  └──────────────┘    └──────────────┘    └────────────────┘ │
│         │                   │                    │          │
│         ▼                   ▼                    ▼          │
│  Poll orderbook       Find arbitrage        Execute tx      │
│  via RPC/Events       opportunities         atomically      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
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
  tick: number;
  shares: bigint;
}

interface Opportunity {
  buyOrder: Order;
  sellSource: SpotSell;
  buyPrice: number;      // Buyer's tickLower (execution price)
  sellPrice: number;     // Seller's tick (acquisition cost)
  spread: number;        // Profit in ticks
  maxShares: bigint;
}

function findOpportunities(
  orders: Order[], 
  spotSells: SpotSell[]
): Opportunity[] {
  const opportunities: Opportunity[] = [];
  
  // Find YES buys with cheaper YES sells outside their range
  const yesBuys = orders.filter(o => o.outcome === 1 && o.restingShares > 0n);
  const yesSells = spotSells.filter(s => s.outcome === 1 && s.shares > 0n);
  
  for (const buy of yesBuys) {
    for (const sell of yesSells) {
      // Sell price BELOW buyer's range = arbitrage opportunity
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
  
  // Same for NO side
  const noBuys = orders.filter(o => o.outcome === 0 && o.restingShares > 0n);
  const noSells = spotSells.filter(s => s.outcome === 0 && s.shares > 0n);
  
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
  
  // Sort by profit (spread × shares)
  return opportunities.sort((a, b) => 
    Number(b.spread * b.maxShares) - Number(a.spread * a.maxShares)
  );
}
```

### Execution Strategy

#### Option A: Two-Step (Simple)

```typescript
async function executeArbitrage(opp: Opportunity) {
  // 1. Buy from cheap spot sell
  const buyTx = await poolManager.write.placeOrder([
    marketKey,
    opp.sellSource.outcome,
    opp.maxShares,
    opp.sellSource.tick,  // Match exactly at sell price
    opp.sellSource.tick,
    maxCost
  ]);
  await publicClient.waitForTransactionReceipt({ hash: buyTx });
  
  // 2. Sell to resting buyer via spot sell
  const sellTx = await poolManager.write.placeSpotSell([
    marketKey,
    opp.buyOrder.outcome,
    opp.maxShares,
    opp.buyOrder.tickLower,  // Sell at buyer's price
    opp.buyOrder.tickLower
  ]);
  await publicClient.waitForTransactionReceipt({ hash: sellTx });
}
```

**Risk**: Position exposure between transactions.

#### Option B: Atomic (Recommended)

Deploy a helper contract for atomic execution:

```solidity
// KeeperExecutor.sol
contract KeeperExecutor {
    ITickBookPoolManager public poolManager;
    ITickBookVault public vault;
    
    function executeArbitrage(
        bytes32 marketKey,
        uint256 spotSellId,
        uint8 outcome,
        uint256 shares,
        uint16 sellToTick
    ) external {
        // 1. Buy from spot sell (tokens credited to this contract)
        poolManager.buyFromSpotSell(marketKey, spotSellId, shares, type(uint256).max);
        
        // 2. Immediately sell to resting order
        poolManager.placeSpotSell(marketKey, outcome, shares, sellToTick, sellToTick);
        
        // 3. Withdraw profit to caller
        uint256 profit = vault.availableUsdcWad(address(this));
        vault.withdrawUsdc(profit);
        IERC20(usdc).transfer(msg.sender, profit);
    }
}
```

### Monitoring Implementation

```typescript
// monitor.ts
import { createPublicClient, http, parseAbiItem } from 'viem';
import { baseSepolia } from 'viem/chains';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL)
});

async function monitorMarket(marketKey: `0x${string}`) {
  // Get all active orders
  const orders = await getActiveOrders(marketKey);
  const spotSells = await getActiveSpotSells(marketKey);
  
  // Find opportunities
  const opportunities = findOpportunities(orders, spotSells);
  
  for (const opp of opportunities) {
    const profit = calculateProfit(opp);
    const gasCost = await estimateGas(opp);
    
    if (profit > gasCost * 1.2) {  // 20% margin
      console.log(`Opportunity found: ${opp.spread} tick spread, ${opp.maxShares} shares`);
      await executeArbitrage(opp);
    }
  }
}

// Poll every block
setInterval(() => {
  monitorMarket(MARKET_KEY).catch(console.error);
}, 2000);
```

---

## Part 5: Future Enhancements

### Contract-Level Improvements

#### 1. Bounded Sweep Function (Recommended)

Add a permissionless, gas-bounded sweep:

```solidity
function sweepCrossableOrders(
    bytes32 marketKey, 
    uint256 maxIterations
) external returns (uint256 matchedCount) {
    for (uint256 i = 0; i < maxIterations; i++) {
        (bool found, uint256 buyId, uint256 sellId) = _findCrossablePair(marketKey);
        if (!found) break;
        _executeCross(buyId, sellId);
        matchedCount++;
    }
    
    // Optional: reward caller with small fee
    if (matchedCount > 0) {
        _rewardKeeper(msg.sender, matchedCount);
    }
}
```

#### 2. Keeper Incentive Hooks

```solidity
event SweepOpportunity(
    bytes32 indexed marketKey,
    uint256 buyOrderId,
    uint256 sellId,
    uint256 spreadTicks
);

// Emit when detectable opportunities exist
function _emitOpportunities(bytes32 marketKey) internal {
    // Help keepers find opportunities without scanning
}
```

#### 3. Router Integration

```solidity
interface ITickBookRouter {
    // Try TickBook first, fallback to AMM
    function swapBestExecution(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint256 maxCost
    ) external returns (uint256 filled, uint256 cost, address venue);
}
```

### Metrics to Track

| Metric | Purpose |
|--------|---------|
| Stale spread duration | How long do crossable orders sit? |
| Keeper fill rate | What % of opportunities are captured? |
| TickBook vs AMM spread | Is TickBook competitive? |
| Gas per arbitrage | Is it economically viable? |

### Escalation Triggers

Revisit the design if:
- Persistent stale spreads (>1 hour) despite active keepers
- Spreads consistently worse than AMM
- Integrators refuse to route through TickBook
- MEV extraction harms users despite slippage bounds

---

## Part 6: Implementation Roadmap

### Phase 1: Documentation (1-4 hours)
- [ ] Update DECISIONS.md with "match-on-interaction" ADR
- [ ] Document keeper role in protocol docs
- [ ] Add keeper section to README

### Phase 2: Keeper Bot MVP (1-2 days)
- [ ] Implement monitor.ts
- [ ] Implement analyzer.ts  
- [ ] Implement executor.ts
- [ ] Deploy to single market for testing

### Phase 3: Contract Enhancements (2-3 days)
- [ ] Add `sweepCrossableOrders()` function
- [ ] Add opportunity events
- [ ] Add keeper reward mechanism (optional)

### Phase 4: Production (1 week)
- [ ] Multi-market support
- [ ] Gas optimization
- [ ] Monitoring dashboard
- [ ] Alerting system

---

## Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Design philosophy | ✅ Sound | Modular, on-chain optimized |
| Matching mechanics | ✅ Correct | Match-on-interaction by design |
| Keeper role | ✅ Defined | First-class participants |
| Bot implementation | 📋 Specified | Ready to build |
| Contract improvements | 📋 Planned | Sweep function recommended |

**Key takeaway**: TickBook's "better price gap" is not a bug - it's the protocol's way of keeping on-chain operations bounded while relying on keepers to complete price discovery. The arbitrage opportunity IS the incentive mechanism.

---

## References

- [TickBook Order Matching Guide](../guides/tickbook-order-matching-guide.md)
- [DECISIONS.md](../../DECISIONS.md) - ADR-073 (Unified Crossing)
- [STATUS.md](../../STATUS.md) - Known Issues
- [TickBookPoolManager.sol](../../packages/contracts-core/src/TickBookPoolManager.sol)
