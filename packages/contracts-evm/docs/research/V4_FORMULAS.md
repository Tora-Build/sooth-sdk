# V4 Complete Formula
## Core Formulas

### 1. Effective Liquidity

```
b = bBase + (reserveFactorBps / 10000) × unrealizedPnL
```

**Parameters:**
- `bBase` = Base liquidity (governor-controlled)
- `reserveFactorBps` = Reserve factor in basis points (default: 1000 = 10%)
- `unrealizedPnL` = Market's unrealized P&L (int256, can be +/-)

**Example:**
```
bBase = 10,000
reserveFactorBps = 1000 (10%)
unrealizedPnL = +50,000

b = 10,000 + (1000/10000) × 50,000
  = 10,000 + 5,000
  = 15,000
```

---

## 2. Market Reserve Tracking

```
marketReserve[marketId] = Σ payouts - Σ fees
                        = Σ(userBuyCost - fee) - Σ(userSellCost - fee)
```

**Interpretation:**
- Positive = LP owes traders (liability)
- Negative = LP has surplus (profit)

**Updates:**
- `receiveFunds(marketId, amount)` → `marketReserve += amount` (LP receives money)
- `sendFunds(marketId, recipient, amount)` → `marketReserve -= amount` (LP pays out)

**Example:**
```
Users buy for 100k (LP receives) → marketReserve += 100k
Fees collected: 5k                → (included in receiveFunds)
Users sell for 80k (LP pays)     → marketReserve -= 80k

Net marketReserve = +100k - 80k = +20k (LP has surplus)
```

---

## 3. Total Assets (LP Pool)

```
totalAssets = Σ deposits - Σ withdrawals + Σ fees_collected
```

**Does NOT include:**
- ❌ Unrealized marketReserve
- ❌ Pending settlements

**Only includes:**
- ✅ Actual USDC in vault
- ✅ Realized profits from settled markets
- ✅ Collected fees

---

## 4. Max Loss per Market

### Tick-Based Calculation

```
maxLoss = max(|costToMove(tick, 0, b)|, |costToMove(tick, 1000, b)|)
```

**Where:**
- `costToMove(from, to, b)` = Sum of tick costs scaled by b
- Varies by current tick position
- Accurate representation of actual LP risk

**Example:**
```
At tick 500: maxLoss ≈ 0.693 × b (worst case, 50% probability)
At tick 800: maxLoss ≈ 0.55 × b (lower risk, skewed market)
At tick 200: maxLoss ≈ 0.55 × b (lower risk, opposite skew)
```

**Note:** Max loss is highest at tick 500 (50/50 market) where `maxLoss ≈ b × ln(2)`.

---

## 5. Locked Exposure per Market

```
lockedExposure[marketId] = maxLoss (tick-based calculation)
```

---

## 6. Total Locked Exposure

```
totalLockedExposure = Σ lockedExposure[marketId]
```

Updated via:
```
updateExposure(marketId, newExposure)
```

---

## 7. Solvency Constraint

```
totalAssets ≥ totalLockedExposure
```

Must hold for:
- LP withdrawals
- New market creation
- Exposure updates

---

## 8. Solvency Factor (Ratio)

```
Solvency Factor = totalAssets / totalLockedExposure
```

**Example:**
```
totalAssets = 1,000,000
totalLockedExposure = 30,000

Solvency Factor = 1,000,000 / 30,000 = 33.3x
```

**Interpretation:**
- `> 1` = Solvent ✓
- `< 1` = Insolvent (cannot cover all worst-case losses)

---

## 9. Available LP Capacity

```
Available = totalAssets - totalLockedExposure
```

Maximum amount LPs can withdraw without violating solvency.

---

## 10. Trade Cost (Tick-Based)

```
cost = Σ tickCosts[i] × b / WAD  (for i from fromTick to toTick)
```

**Properties:**
- Larger `b` → smaller cost per tick (cheaper trades)
- Smaller `b` → larger cost per tick (more expensive trades)

---

## Summary Table

| Formula | Symbol | Type | Updates |
|---------|--------|------|---------|
| **Effective b** | `bBase + reserve×factor` | uint256 | When bBase or marketReserve changes |
| **marketReserve** | `Σfees - Σpayouts` | int256 | Every trade/settlement |
| **totalAssets** | `Σdeposits - Σwithdrawals + Σfees` | uint256 | Deposits/withdrawals |
| **maxLoss** | `b × 0.693` (conservative) | uint256 | When b changes |
| **lockedExposure** | `≈ maxLoss` | uint256 | Manual via updateExposure() |
| **Solvency** | `assets / exposure` | ratio | Derived from above |

---

## Constants

```solidity
uint256 constant WAD = 1e18;
uint256 constant LN2_WAD = 693147180559945309;
uint256 constant MAX_BPS = 10000;
```
