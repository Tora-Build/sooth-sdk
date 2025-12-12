# CRITICAL: Vault Accounting Issue - Market Reserves

**Status:** 🔴 CRITICAL BUG  
**Severity:** High  
**Impact:** LP share value incorrectly affected by unrealized P&L  
**Date Identified:** 2025-11-30

---

## 🚨 Problem

The vault currently treats **market reserves** (unrealized P&L) as part of `totalAssets`, which affects:

1. **LP Share Value** - Unrealized profits/losses change the exchange rate
2. **Deposit/Withdraw** - LPs can deposit/withdraw based on unrealized gains
3. **Risk Calculations** - Treasury and buffer calculations include unrealized P&L

### Current Broken Flow:

```solidity
function recordMarketFlow(uint256 marketId, int256 amount, address user) external {
    if (amount > 0) {
        asset.transferFrom(user, address(this), pay);
        totalAssets += pay;  // ❌ WRONG: Increases totalAssets
    } else if (amount < 0) {
        totalAssets -= pay;  // ❌ WRONG: Decreases totalAssets
        asset.transfer(user, pay);
    }

    marketReserves[marketId] += amount;
}
```

**Problem:** `totalAssets` changes with every trade, even though the P&L is **unrealized**.

---

## 💡 Correct Behavior

Market reserves should be **tracked separately** and only affect `totalAssets` upon **settlement**:

### Principle:

- **Realized Assets:** Actual collateral deposited by LPs
- **Unrealized P&L:** Market reserves (tracked but not in totalAssets)
- **Settlement:** Converts unrealized → realized

### Correct Flow:

```solidity
// Track market reserves separately
mapping(uint256 => int256) public marketReserves;  // Unrealized P&L
uint256 public totalAssets;  // Only realized assets

function recordMarketFlow(uint256 marketId, int256 amount, address user) external {
    // Transfer tokens but DON'T change totalAssets
    if (amount > 0) {
        asset.transferFrom(user, address(this), pay);
        // totalAssets unchanged ✅
    } else if (amount < 0) {
        asset.transfer(user, pay);
        // totalAssets unchanged ✅
    }

    // Track unrealized P&L separately
    marketReserves[marketId] += amount;
}

function applySettlementDelta(uint256 marketId, address account, int256 pnlDelta) external {
    // NOW we update totalAssets (realized)
    if (pnlDelta > 0) {
        totalAssets -= uint256(pnlDelta);  // ✅ Vault pays out
        asset.transfer(account, uint256(pnlDelta));
    } else if (pnlDelta < 0) {
        totalAssets += uint256(-pnlDelta);  // ✅ Vault receives
        asset.transferFrom(account, address(this), uint256(-pnlDelta));
    }

    // Clear market reserve (now realized)
    marketReserves[marketId] = 0;
}
```

---

## 🔍 Impact Analysis

### Current (Broken):

```
Scenario: Market has +1000 unrealized profit

totalAssets = 100,000 + 1,000 = 101,000  ❌
LP Share Value = 101,000 / 100,000 = 1.01  ❌ (inflated!)

New LP deposits 10,000:
- Gets 10,000 / 1.01 = 9,901 shares  ❌ (unfair!)
- Dilutes existing LPs based on unrealized gains
```

### Correct:

```
Scenario: Market has +1000 unrealized profit

totalAssets = 100,000  ✅ (unrealized P&L not included)
LP Share Value = 100,000 / 100,000 = 1.00  ✅

New LP deposits 10,000:
- Gets 10,000 shares  ✅ (fair!)
- No dilution from unrealized P&L

Upon settlement:
- Market resolves, +1000 profit realized
- totalAssets = 100,000 + 1,000 = 101,000  ✅
- LP Share Value = 101,000 / 110,000 = 0.918  ✅ (all LPs share gains)
```

---

## 🛠️ Proposed Fix

### Option 1: Separate Accounting (Recommended)

```solidity
contract SoothVault {
    uint256 public totalAssets;  // Only realized assets
    mapping(uint256 => int256) public marketReserves;  // Unrealized P&L

    // For risk calculations, use BOTH
    function getTreasuryBalance() external view returns (uint256) {
        int256 totalUnrealized = _sumAllMarketReserves();
        int256 total = int256(totalAssets) + totalUnrealized;
        return total > 0 ? uint256(total) : 0;
    }

    function getLiquidBufferBalance() external view returns (uint256) {
        int256 totalUnrealized = _sumAllMarketReserves();
        int256 total = int256(totalAssets) + totalUnrealized - int256(totalLockedExposure);
        return total > 0 ? uint256(total) : 0;
    }

    // For LP share calculations, use ONLY totalAssets
    function convertToShares(uint256 assets) external view returns (uint256) {
        if (totalSupply == 0) return assets;
        return (assets * totalSupply) / totalAssets;  // ✅ Unrealized P&L excluded
    }

    function convertToAssets(uint256 shares) external view returns (uint256) {
        if (totalSupply == 0) return shares;
        return (shares * totalAssets) / totalSupply;  // ✅ Unrealized P&L excluded
    }

    function recordMarketFlow(uint256 marketId, int256 amount, address user) external {
        // Transfer tokens
        if (amount > 0) {
            asset.transferFrom(user, address(this), uint256(amount));
            // DON'T change totalAssets ✅
        } else if (amount < 0) {
            asset.transfer(user, uint256(-amount));
            // DON'T change totalAssets ✅
        }

        // Track unrealized P&L
        marketReserves[marketId] += amount;
    }

    function applySettlementDelta(uint256 marketId, address account, int256 pnlDelta) external {
        // Realize the P&L
        if (pnlDelta > 0) {
            totalAssets -= uint256(pnlDelta);  // ✅ Now affects LP shares
            asset.transfer(account, uint256(pnlDelta));
        } else if (pnlDelta < 0) {
            totalAssets += uint256(-pnlDelta);  // ✅ Now affects LP shares
            asset.transferFrom(account, address(this), uint256(-pnlDelta));
        }

        // Clear market reserve (now realized)
        marketReserves[marketId] -= pnlDelta;  // Vault's P&L is -user's P&L
    }
}
```

### Option 2: Track Total Unrealized Separately

```solidity
contract SoothVault {
    uint256 public totalRealizedAssets;  // LP deposits/withdrawals
    int256 public totalUnrealizedPnL;    // Sum of all market reserves

    function totalAssets() public view returns (uint256) {
        // For ERC4626 compatibility, return only realized
        return totalRealizedAssets;
    }

    function totalAssetsIncludingUnrealized() public view returns (int256) {
        // For risk calculations
        return int256(totalRealizedAssets) + totalUnrealizedPnL;
    }
}
```

---

## ✅ Recommended Solution

**Use Option 1** with these changes:

### 1. **Modify `recordMarketFlow()`**

```diff
function recordMarketFlow(uint256 marketId, int256 amount, address user) external {
    if (amount > 0) {
        asset.transferFrom(user, address(this), uint256(amount));
-       totalAssets += uint256(amount);  // ❌ Remove this
    } else if (amount < 0) {
-       totalAssets -= uint256(-amount);  // ❌ Remove this
        asset.transfer(user, uint256(-amount));
    }

    marketReserves[marketId] += amount;
    emit MarketFlow(marketId, amount, marketReserves[marketId]);
}
```

### 2. **Update Risk Calculations**

```diff
function getTreasuryBalance() external view returns (uint256) {
-   return totalAssets;
+   // Include unrealized P&L for risk calculations
+   int256 totalUnrealized = _sumAllMarketReserves();
+   int256 total = int256(totalAssets) + totalUnrealized;
+   return total > 0 ? uint256(total) : 0;
}

function getLiquidBufferBalance() external view returns (uint256) {
-   return totalAssets - totalLockedExposure;
+   int256 totalUnrealized = _sumAllMarketReserves();
+   int256 total = int256(totalAssets) + totalUnrealized - int256(totalLockedExposure);
+   return total > 0 ? uint256(total) : 0;
}

+function _sumAllMarketReserves() internal view returns (int256) {
+   // Note: This requires tracking all market IDs or using a separate counter
+   // For now, this is a placeholder - needs implementation
+   return 0;  // TODO: Implement proper summation
+}
```

### 3. **Keep Settlement Logic**

```solidity
// applySettlementDelta() is already correct!
// It updates totalAssets when P&L is realized
```

---

## 🧪 Test Cases

### Test 1: Unrealized P&L Doesn't Affect LP Shares

```solidity
function testUnrealizedPnLDoesNotAffectShares() public {
    // LP deposits 100k
    vault.deposit(100_000 ether, lp);

    // Market generates 10k unrealized profit
    vm.prank(market);
    vault.recordMarketFlow(1, 10_000 ether, trader);

    // New LP deposits 50k
    vault.deposit(50_000 ether, lp2);

    // Both should have proportional shares
    assertEq(vault.balanceOf(lp), 100_000 ether);
    assertEq(vault.balanceOf(lp2), 50_000 ether);  // ✅ Not affected by unrealized P&L
}
```

### Test 2: Settlement Realizes P&L

```solidity
function testSettlementRealizesP&L() public {
    vault.deposit(100_000 ether, lp);

    // Market generates 10k unrealized profit
    vm.prank(market);
    vault.recordMarketFlow(1, 10_000 ether, trader);

    // Before settlement
    assertEq(vault.totalAssets(), 100_000 ether);  // ✅ Unchanged

    // Settlement
    vm.prank(settlement);
    vault.applySettlementDelta(1, trader, -10_000 ether);  // Trader loses, vault gains

    // After settlement
    assertEq(vault.totalAssets(), 110_000 ether);  // ✅ Now realized
}
```

---

## 📊 Priority

**Priority:** 🔴 CRITICAL  
**Urgency:** HIGH  
**Complexity:** MEDIUM

**Recommendation:** Fix before mainnet deployment. This affects LP fairness and protocol economics.

---

## 📝 Action Items

- [ ] Implement Option 1 fix in `SoothVault.sol`
- [ ] Add `_sumAllMarketReserves()` helper (requires tracking market IDs)
- [ ] Update `getTreasuryBalance()` and `getLiquidBufferBalance()`
- [ ] Add test cases for unrealized P&L isolation
- [ ] Redeploy to testnet
- [ ] Update documentation

---

**Reported By:** User  
**Date:** 2025-11-30  
**Status:** 🔴 OPEN - Needs Fix
