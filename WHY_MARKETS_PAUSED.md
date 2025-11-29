# Why Markets Are "Paused" - Root Cause Analysis

## 🔍 Investigation Results

### Current State

Both deployed markets appear "paused" but are actually **technically live**:

| Component              | Status | Value  |
| ---------------------- | ------ | ------ |
| Market 1 `isLive`      | ✅     | `true` |
| Market 2 `isLive`      | ✅     | `true` |
| Vault Liquidity        | ❌     | `0`    |
| Market 1 `b` parameter | ❌     | `0`    |
| Market 2 `b` parameter | ❌     | `0`    |

### The Problem

Markets are **functionally paused** because `b = 0`, which makes the LMSR pricing formula undefined. Trading is impossible.

---

## 🧩 Why `updateGlobalB()` Isn't Called Automatically

### Short Answer

**It IS called automatically!** But it was called when the vault was empty, so it calculated `bGlobal = 0`.

### Detailed Explanation

#### The Code Flow

1. **In `SoothMarketFactory.createMarket()`** (line 49):

   ```solidity
   function createMarket(...) {
       uint256 marketId = nextMarketId++;
       riskManager.setMarketRiskClass(marketId, riskClass);
       riskManager.updateGlobalB(); // ← CALLED HERE!
       // ... rest of market creation
   }
   ```

2. **In `SoothRiskManager.updateGlobalB()`**:

   ```solidity
   function updateGlobalB() external {
       uint256 T = vault.getTreasuryBalance();  // Returns totalAssets
       uint256 B = vault.getLiquidBufferBalance(); // Returns totalAssets - locked
       uint256 K = globalRisk.maxConcurrentWorstCase; // = 10

       uint256 Lmax = (T + B) / K;
       // If T=0 and B=0, then Lmax = 0

       uint256 newB = Lmax * 14427 / 1e4; // ≈ Lmax / ln(2)
       // If Lmax=0, then newB = 0

       globalRisk.bGlobal = newB;
   }
   ```

3. **The Problem**: During deployment:
   ```
   Vault created → totalAssets = 0
   Market created → updateGlobalB() called
   T = 0, B = 0, K = 10
   Lmax = (0 + 0) / 10 = 0
   bGlobal = 0 * 1.4427 = 0
   ```

#### Why Liquidity Wasn't Added

Looking at `DeploySooth.s.sol` (original version):

```solidity
// Line 58: Tokens minted to deployer
collateral._mint(msg.sender, 1_000_000 ether);

// Line 61: Vault created (empty)
SoothVault vault = new SoothVault(collateral);

// ... authorization steps ...

// Line 99: Market created (vault still empty!)
SoothMarket exampleMarket = factory.createMarket(...);
// ↑ This calls updateGlobalB() but vault has 0 liquidity
```

**The tokens were minted but never deposited into the vault!**

---

## ✅ The Fix

### What Was Changed

#### 1. **DeploySooth.s.sol** - Now deposits liquidity before creating markets:

```solidity
// NEW: After line 96
// Deposit initial liquidity into vault
uint256 initialLiquidity = 100_000 ether;
collateral.approve(address(vault), initialLiquidity);
vault.depositFor(msg.sender, initialLiquidity);

// NOW create markets (updateGlobalB will work correctly)
SoothMarket exampleMarket = factory.createMarket(...);
```

#### 2. **CreateSecondMarket.s.sol** - Added verification:

```solidity
// Verify b parameter after creation
uint256 bMarket = riskMgr.getBForMarket(newMarket.marketId());
if (bMarket == 0) {
    console2.log("WARNING: b parameter is 0!");
}
```

#### 3. **Created Helper Scripts** for existing deployments:

- `script/InitializeVault.s.sol` - Solidity script
- `scripts/initialize-vault.sh` - Bash script
- `MANUAL_VAULT_INITIALIZATION.md` - Documentation

---

## 🎯 Design Philosophy

### Why Not Auto-Deposit in the Vault Constructor?

The current design is actually **intentional and flexible**:

1. **Separation of Concerns**:

   - Vault manages liquidity
   - Markets manage trading
   - LPs decide when to add/remove liquidity

2. **Flexibility**:

   - Markets can be created before liquidity exists
   - Multiple LPs can contribute
   - Liquidity can be added/removed dynamically

3. **Real-world Usage**:
   - In production, LPs deposit separately
   - `updateGlobalB()` is called periodically as liquidity changes
   - Markets adjust their `b` parameter dynamically

### The Deployment Script Issue

The deployment script is for **testing/development**, so it should:

- ✅ Create a complete, working system
- ✅ Deposit initial liquidity
- ✅ Ensure markets are immediately tradeable

This is now fixed in the updated script.

---

## 📋 Summary

| Question                         | Answer                                                   |
| -------------------------------- | -------------------------------------------------------- |
| **Are markets paused?**          | No, they're live but untradeable due to `b=0`            |
| **Is `updateGlobalB()` called?** | Yes, automatically by the factory                        |
| **Why is `b=0`?**                | Vault had no liquidity when `updateGlobalB()` was called |
| **Is this a bug?**               | No, it's a deployment script issue                       |
| **How to fix?**                  | Deposit liquidity and call `updateGlobalB()`             |
| **Will this happen again?**      | No, deployment script now deposits liquidity first       |

---

## 🚀 Action Items

1. **Immediate**: Run the initialization commands to fix current deployment
2. **Future**: Use updated deployment scripts
3. **Production**: Ensure vault has liquidity before creating markets

See `VAULT_INITIALIZATION_SUMMARY.md` for step-by-step fix instructions.
