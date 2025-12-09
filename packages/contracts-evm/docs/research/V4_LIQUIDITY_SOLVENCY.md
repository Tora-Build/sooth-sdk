# V4 Liquidity & Solvency (Tick-Based)

## Core Formula

```
b = bBase + (reserveFactorBps / 10000) × unrealizedPnL
```

---

## Tick-Based Max Loss Calculation

**Unlike continuous LMSR**, tick-based LMSR max loss depends on **current tick position**:

```solidity
// Max loss if market goes to 0%
int256 costTo0 = tickCosts.costToMove(currentTick, 0, b);

// Max loss if market goes to 100%  
int256 costTo1000 = tickCosts.costToMove(currentTick, 1000, b);

// Actual max loss (LP's worst case)
uint256 maxLoss = max(abs(costTo0), abs(costTo1000));
```

**Why it varies by tick:**

```
Current Tick    Max to 0    Max to 1000    Actual Max
────────────────────────────────────────────────────────
0               0           b×ln(2)        b×ln(2)
250             b×0.3       b×0.5          b×0.5
500 (50%)       b×0.693     b×0.693        b×0.693  ← Worst case
750             b×0.5       b×0.3          b×0.5
1000            b×ln(2)     0              b×ln(2)
```

At tick 500 (50% probability), LP exposure is maximized at **`b × ln(2) ≈ 0.693b`**.
At extremes (tick 0 or 1000), max loss is still **`b × ln(2)`** but in one direction.

---

## Dynamic Solvency with Tick Awareness

**Set locked exposure based on current tick:**

```solidity
// Calculate actual max loss for current position
uint256 maxLoss = calculateMaxLossAtTick(market.currentTick(), market.b());

// Update solvency tracking
governorVault.updateExposure(marketId, maxLoss);
```

**Example:**

```
Market at tick 500 (50%):
  b = 20,000
  maxLoss = costToMove(500, 0 or 1000, 20k)
          ≈ 20,000 × 0.693
          = 13,863
  
Market at tick 800 (80%):
  b = 20,000
  maxLoss = costToMove(800, 0, 20k) 
          ≈ 20,000 × 0.55
          = 11,000  ← Lower risk!
```

---

## Implementation

**Add helper to Market:**

```solidity
/// @notice Calculate max LP loss from current tick position
function maxLoss() public view returns (uint256) {
    int256 costTo0 = tickCosts.costToMove(currentTick, 0, b());
    int256 costTo1000 = tickCosts.costToMove(currentTick, 1000, b());
    
    uint256 lossTo0 = costTo0 < 0 ? uint256(-costTo0) : 0;
    uint256 lossTo1000 = costTo1000 < 0 ? uint256(-costTo1000) : 0;
    
    return lossTo0 > lossTo1000 ? lossTo0 : lossTo1000;
}
```

**Update exposure on tick changes:**

```solidity
// In executeAMMTrade(), after tick update:
currentTick = targetTick;
uint256 newMaxLoss = maxLoss();
governorVault.updateExposure(marketId, newMaxLoss);
```

---

## Solvency Formula

```
Solvency Factor = totalAssets / Σ maxLoss_i

where maxLoss_i = market_i.maxLoss() (tick-based)
```

**Conservative approach:**
Use `b × ln(2)` as upper bound regardless of tick:

```solidity
uint256 conservativeMaxLoss = (b() × LN2_WAD) / WAD;
```

This ensures solvency even if all markets move to their worst tick (500).

---

## Summary Table

| Approach | Max Loss | When to Use |
|----------|----------|-------------|
| **Tick-based** | `maxLoss()` from current tick | Accurate, updates frequently |
| **Conservative** | `b × ln(2)` always | Simple, worst-case bound |

**Recommendation:** Use conservative `b × ln(2)` for gas efficiency, unless markets rarely move.
