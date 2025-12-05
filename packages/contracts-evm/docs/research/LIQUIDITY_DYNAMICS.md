# Liquidity Dynamics & Update Mechanics

**Date:** 2025-12-02  
**Status:** Technical Specification  
**Impact:** Market Depth, Trader UX, Keeper Opportunities

---

## Executive Summary

Every LP deposit/withdrawal changes vault TVL, which **should** update market liquidity depth (`bGlobal`). However, **`bGlobal` is not automatically recalculated** on vault operations. This creates a lag between capital changes and pricing updates, presenting both risks and keeper bot opportunities.

---

## 1. The Liquidity Formula Chain

### **Complete Formula:**

```
b_market = Base + Boost

Where:
  Base = bGlobal × RiskClassMultiplier
  Boost = MarketReserves × ReserveMultiplier (if reserves > 0)

  bGlobal = Lmax × 1.4427
  Lmax = min(TVL / K, LiquidBuffer)
```

### **Key Dependencies:**

```
TVL (totalAssets)
    ↓
Lmax = TVL / K
    ↓
bGlobal = Lmax × 1.4427
    ↓
Base = bGlobal × RiskMultiplier
    ↓
b_market = Base + Boost
    ↓
Market Prices (LMSR uses b)
```

---

## 2. The Update Lag Problem

### **Current Behavior:**

`SoothVault.deposit()` and `SoothVault.withdraw()` **do NOT** call `riskManager.updateGlobalB()`.

**Code Evidence:**

```solidity
// SoothVault.sol - deposit function
function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
    // ... transfer logic ...
    totalAssets += assets;  // ← TVL changes here
    // ... emit events ...
    // ❌ NO updateGlobalB() call
}
```

### **When IS `bGlobal` Updated?**

1. **Market Creation**: `SoothMarketFactory.createMarket()` calls `updateGlobalB()` before creating the market.
2. **Manual Trigger**: Anyone can call `riskManager.updateGlobalB()` (it's a public function).

### **Implications:**

| Event                          | TVL Change | `bGlobal` Updated? | Market Impact                                  |
| :----------------------------- | :--------- | :----------------- | :--------------------------------------------- |
| LP deposits 100k USDC          | +100k      | ❌ **NO**          | Markets still use old (lower) liquidity depth  |
| LP withdraws 50k USDC          | -50k       | ❌ **NO**          | Markets still use old (higher) liquidity depth |
| New market created             | 0          | ✅ **YES**         | All markets get updated `bGlobal`              |
| Keeper calls `updateGlobalB()` | 0          | ✅ **YES**         | All markets get updated `bGlobal`              |

---

## 3. Impact Analysis

### **Scenario 1: Large Deposit (No Update)**

**Setup:**

- Vault TVL: 100k USDC
- K = 10
- `bGlobal` = 14,427 USDC
- Alice deposits 100k USDC

**Expected Behavior:**

- New TVL: 200k USDC
- New `bGlobal`: 28,854 USDC (doubled)
- Markets should have 2x deeper liquidity

**Actual Behavior:**

- `bGlobal` remains 14,427 USDC until someone calls `updateGlobalB()`
- Traders get **worse execution** than they should
- Markets are **under-liquid** relative to available capital

### **Scenario 2: Large Withdrawal (No Update)**

**Setup:**

- Vault TVL: 200k USDC
- `bGlobal` = 28,854 USDC
- Bob withdraws 100k USDC

**Expected Behavior:**

- New TVL: 100k USDC
- New `bGlobal`: 14,427 USDC (halved)
- Markets should have 2x shallower liquidity

**Actual Behavior:**

- `bGlobal` remains 28,854 USDC until someone calls `updateGlobalB()`
- Markets are **over-liquid** relative to available capital
- **Risk**: Vault may not have enough capital to cover max losses if multiple markets hit `Lmax` simultaneously

---

## 4. Keeper Bot Opportunity

### **Strategy:**

Monitor vault events and call `updateGlobalB()` when TVL changes significantly.

### **Implementation:**

```javascript
// Keeper Bot Pseudocode
const THRESHOLD = 0.05; // 5% TVL change
let lastTVL = await vault.totalAssets();

vault.on("Deposit", async (caller, owner, assets, shares) => {
  const newTVL = await vault.totalAssets();
  const change = Math.abs(newTVL - lastTVL) / lastTVL;

  if (change > THRESHOLD) {
    await riskManager.updateGlobalB();
    lastTVL = newTVL;
    console.log(`Updated bGlobal. TVL changed by ${change * 100}%`);
  }
});

vault.on("Withdraw", async (caller, receiver, owner, assets, shares) => {
  // Same logic as Deposit
});
```

### **Gas Cost:**

`updateGlobalB()` is a simple calculation (no loops, no storage writes except one `uint256`). Estimated gas: **~30k-50k**.

### **Revenue Model:**

- **Option 1**: Protocol subsidizes keeper (pays gas + small reward).
- **Option 2**: Keeper is altruistic (MEV searchers, LPs protecting their capital).
- **Option 3**: Charge a small "update fee" from traders (e.g., 0.01% of trade volume goes to keeper fund).

---

## 5. Recommendations

### **Short-Term (Current Alpha):**

1. **Document the lag** in frontend UI: "Liquidity depth updates on market creation or manual trigger."
2. **Run a keeper bot** internally during testnet to ensure `bGlobal` stays fresh.

### **Medium-Term (Mainnet v1):**

1. **Add `updateGlobalB()` to deposit/withdraw** (gas cost: ~30k per LP operation).
   - **Pro**: Always accurate.
   - **Con**: Increases LP gas costs.
2. **OR: Implement a "staleness threshold"** in `getBForMarket()`:
   ```solidity
   function getBForMarket(uint256 marketId) external view returns (uint256) {
       if (block.timestamp - lastUpdateTime > 1 hours) {
           revert("bGlobal stale, call updateGlobalB()");
       }
       // ... existing logic ...
   }
   ```
   - **Pro**: Forces updates without adding gas to LP ops.
   - **Con**: Traders pay the gas (first trade after 1 hour triggers update).

### **Long-Term (Mainnet v2):**

1. **Incentivize keepers** via a "Liquidity Accuracy Reward" funded by trading fees.
2. **Automate via Chainlink Automation** or Gelato Network.

---

## 6. Code References

| Contract                 | Function          | Behavior                                               |
| :----------------------- | :---------------- | :----------------------------------------------------- |
| `SoothVault.sol`         | `deposit()`       | Updates `totalAssets`, does NOT call `updateGlobalB()` |
| `SoothVault.sol`         | `withdraw()`      | Updates `totalAssets`, does NOT call `updateGlobalB()` |
| `SoothRiskManager.sol`   | `updateGlobalB()` | Recalculates `bGlobal` from current `totalAssets`      |
| `SoothMarketFactory.sol` | `createMarket()`  | Calls `updateGlobalB()` before creating market         |

---
