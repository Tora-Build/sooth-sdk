# V4 Complete System Documentation

All formulas verified and corrected. ✅ 85 tests passing.

---

## Core Formulas

### 1. Effective Liquidity
```
b = bBase + (reserveFactorBps / 10000) × unrealizedPnL
```

### 2. Market Reserve
```
unrealizedPnL = Σ payouts - Σ fees
              = Σ(userBuyCost - fee) - Σ(userSellCost - fee)
```
- Positive = LP liability
- Negative = LP profit

### 3. Total Assets (LP Pool)
```
totalAssets = Σ deposits - Σ withdrawals + Σ fees
```
Does NOT include unrealized unrealizedPnL.

### 4. Max Loss (Tick-Based)
```
maxLoss = max(|costToMove(tick, 0, b)|, |costToMove(tick, 1000, b)|)
```
Worst case at tick 500: `maxLoss ≈ b × 0.693`

### 5. Locked Exposure
```
lockedExposure[marketId] = maxLoss
```

### 6. Total Locked Exposure
```
totalLockedExposure = Σ lockedExposure[marketId]
```

### 7. Solvency Constraint
```
totalAssets ≥ totalLockedExposure
```

### 8. Solvency Factor
```
Solvency Factor = totalAssets / totalLockedExposure
```

### 9. Available Capacity
```
Available = totalAssets - totalLockedExposure
```

### 10. Trade Cost
```
tradeCost = Σ tickCosts[i] × b / WAD  (from tick_start to tick_end)
```
User pays: `tradeCost + fee` (buy)  
User gets: `|tradeCost| - fee` (sell)

---

## Example Walkthrough

**Setup:**
```
bBase = 10,000
reserveFactorBps = 1000 (10%)
unrealizedPnL = +50,000
currentTick = 500
```

**Calculated:**
```
b = 10,000 + (0.1 × 50,000) = 15,000

maxLoss = 15,000 × 0.693 = 10,395

lockedExposure = 10,395
```

**LP Pool:**
```
totalAssets = 1,000,000
totalLockedExposure = 10,395 (from this market)

Solvency Factor = 1,000,000 / 10,395 = 96.2x ✓
Available = 989,605
```

---

## How b Changes

| Event | Effect on b | Example |
|-------|-------------|---------|
| Governor increases bBase | ✅ Increases | 10k → 15k: b = 15k + 5k = 20k |
| Traders buy (LP receives) | ✅ Increases unrealizedPnL | unrealizedPnL +10k → b +1k |
| Traders sell (LP pays) | ✅ Decreases unrealizedPnL | unrealizedPnL -10k → b -1k |
| Market settled | ✅ Resets unrealizedPnL | Final payout, reset to 0 |

---

## Constants

```solidity
uint256 constant WAD = 1e18;
uint256 constant LN2_WAD = 693147180559945309;  // ln(2) in WAD
uint256 constant MAX_BPS = 10000;
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `SoothMarketV4.sol` | Dynamic `b()` calculation |
| `SoothGovernorVault.sol` | `unrealizedPnL`, `totalAssets`, `updateExposure()` |
| `SoothTraderVaultV4.sol` | Lock-on-buy logic |
| `OutcomeToken.sol` | ERC1155 orderbook tokens |

---

## Testing

All formulas tested in `test/V4Integration.t.sol`:
- ✅ Dynamic b() with unrealizedPnL
- ✅ Lock-on-buy mechanism  
- ✅ Instant USDC on sell after unlock
- ✅ Orderbook independence
- ✅ 85 total tests passing
