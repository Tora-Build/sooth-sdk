# V8 Test Suite QA Analysis

**Date:** 2025-12-27  
**Version:** V8.2 (Dual-Balance Model)  
**Status:** ✅ All 74 tests passing

---

## Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total Tests | 74 | ✅ |
| Test Suites | 7 | ✅ |
| Fuzz Tests | 3 | ⚠️ Low |
| Invariant Tests | 2 (inline) | ❌ Missing dedicated suite |
| Line Coverage | 67.22% | ⚠️ Target: 80%+ |
| Branch Coverage | 28.35% | ❌ Target: 60%+ |
| Function Coverage | 80.18% | ✅ Good |

---

## Coverage by Contract

| Contract | Lines | Branches | Status | Priority |
|----------|-------|----------|--------|----------|
| `TruthMarket.sol` | 100% | 23% | ✅ Lines good, branches need work | P2 |
| `OutcomeToken.sol` | 100% | 0% | ⚠️ No branch tests | P3 |
| `Collateralizer.sol` | 93% | 15% | ⚠️ Branch coverage low | P2 |
| `LaunchpadEngine.sol` | 92% | 30% | ✅ Good | P3 |
| `AMMEngine.sol` | 83% | 33% | ⚠️ Critical - needs more coverage | P1 |
| `TickBook.sol` | 55% | 28% | ❌ Significant gaps | P1 |
| `LMSRMath.sol` | 84% | 41% | ⚠️ Math lib needs edge cases | P2 |
| `TickMath.sol` | 72% | 38% | ⚠️ Needs more coverage | P2 |
| `TickBitmap.sol` | 91% | 35% | ✅ Good | P3 |

---

## ✅ BUG FIXED: AMMEngine Lock Accounting

**Severity:** MEDIUM  
**Discovery:** Invariant test `invariant_LockedNeverExceedsAvailable`  
**Status:** ✅ FIXED (2025-12-27)

### Description

When a user buys shares using their available balance (from previous sell proceeds), `_tradePositions()` reduces `_availableBalance` but does **not** reduce `_lockedBalance` proportionally.

### Root Cause

In `AMMEngine._tradePositions()` (lines 203-216):
```solidity
// Pay cost
if (_availableBalance[user] >= actualCost) {
    _availableBalance[user] -= actualCost;  // ✅ Correct
    // ❌ MISSING: _lockedBalance[user] reduction
    emit BalanceUsed(user, actualCost, _availableBalance[user]);
} else {
    uint256 fromBalance = _availableBalance[user];
    uint256 fromWallet = actualCost - fromBalance;
    _availableBalance[user] = 0;  // ✅ Correct
    // ❌ MISSING: _lockedBalance[user] reduction
    ...
}
```

### Comparison with spendBalanceFor

The `spendBalanceFor()` function (lines 436-457) **correctly** reduces locked:
```solidity
if (_lockedBalance[user] > 0) {
    uint256 lockedReduction = (spent * _lockedBalance[user]) / available;
    _lockedBalance[user] -= lockedReduction;
}
```

### Impact

1. **Invariant violation:** `locked > available` can occur
2. **claimUnlocked underflow:** When user calls `claimUnlocked()`, line 388 does `_lockedBalance[msg.sender] -= totalUnlocked`, which will revert if locked was already reduced elsewhere
3. **User confusion:** Balance display shows locked > available which is logically incorrect

### Fix Applied

Added locked balance reduction to `_tradePositions()` at lines 203-217:

```solidity
// Full coverage case: reduce locked proportionally
if (_lockedBalance[user] > 0) {
    uint256 lockedReduction = (actualCost * _lockedBalance[user]) / _availableBalance[user];
    _lockedBalance[user] -= lockedReduction;
}
_availableBalance[user] -= actualCost;

// Partial coverage case: clear locked when available goes to 0
_lockedBalance[user] = 0;
_availableBalance[user] = 0;
```

**Verification:** Invariant test `invariant_LockedNeverExceedsAvailable` now passes with 768,000+ random operations.

### Reproduction Test

```solidity
function test_Bug_LockedExceedsAvailable() public {
    // Buy NO
    vm.prank(trader1);
    amm.tradePositions(address(market), NO, 100 * int256(WAD), 500 * WAD);
    
    // Sell NO - locks proceeds
    vm.prank(trader1);
    amm.tradePositions(address(market), NO, -50 * int256(WAD), 0);
    
    (uint256 availBefore, uint256 lockedBefore) = amm.getBalances(trader1);
    assertEq(availBefore, lockedBefore, "Before: available == locked");
    
    // Buy NO using available balance
    vm.prank(trader1);
    amm.tradePositions(address(market), NO, 30 * int256(WAD), 500 * WAD);
    
    (uint256 availAfter, uint256 lockedAfter) = amm.getBalances(trader1);
    // BUG: locked remains unchanged while available decreased
    assertGe(availAfter, lockedAfter, "After: available >= locked"); // FAILS
}
```

---

## Critical Gaps Identified

### 1. 🔴 AMMEngine Settlement (CRITICAL - P0)

**Not Tested:**
- `settlePosition()` - Pays out winning positions after settlement
- `applyRetroSettlement()` - T* mechanism (placeholder, but should test revert)

**Why Critical:**
- Settlement is when users get paid. A bug here = loss of funds.
- LMSR payout calculation must be correct for both YES and NO wins.

**Recommended Tests:**
```solidity
test_SettlePosition_YESWins()
test_SettlePosition_NOWins()
test_SettlePosition_INVALIDWins()
test_SettlePosition_RevertWhen_NotSettled()
test_SettlePosition_RevertWhen_NoPosition()
test_ApplyRetroSettlement_Reverts()
```

### 2. 🔴 TickBook Coverage (CRITICAL - P0)

**Only 55% line coverage. Missing:**
- Complex order matching scenarios
- Cross-tick market orders
- Fee collection (`claimFees`)
- Partial fills
- Order cancellation edge cases

**Why Critical:**
- TickBook handles graduated market trading
- Complex tick math can overflow or underflow

**Recommended Tests:**
```solidity
test_MarketOrder_CrossesMultipleTicks()
test_MarketOrder_PartialFill()
test_LimitOrder_BothSides()
test_OrderMatching_PriceImpact()
testFuzz_LimitOrder_RandomTickRanges()
testFuzz_MarketOrder_RandomAmounts()
```

### 3. 🟡 Branch Coverage Overall (HIGH - P1)

**28% branch coverage is dangerously low.**

Most untested branches are:
- Error conditions (require statements)
- Edge case arithmetic (zero amounts, max values)
- Conditional logic paths

**Priority Branches to Test:**
- Zero amount handling in all trade functions
- Max uint256 overflow prevention
- Slippage protection edge cases
- Lock expiry boundary conditions (exactly at 24h)

### 4. 🟡 LMSRMath Edge Cases (HIGH - P1)

**Missing:**
- Extreme price scenarios (P → 0 or P → 1)
- Large quantity trades (overflow checks)
- Near-zero liquidity scenarios

**Recommended Tests:**
```solidity
testFuzz_LMSRPrice_ExtremeValues(uint256 qYes, uint256 qNo, uint256 b)
test_LMSRCost_NearZeroLiquidity()
test_LMSRCost_MaxQuantity()
```

### 5. 🟡 Spendable Proceeds + LaunchpadEngine Integration (MEDIUM - P2)

**Covered but needs:**
- LaunchpadEngine.tradePositions spending from AMMEngine available balance
- Full integration test: sell in market A → buy in market B via LaunchpadEngine

---

## Missing Test Categories

### Invariant Tests (Need Dedicated Suite)

The protocol lacks a proper invariant test file. Critical invariants:

```solidity
// Solvency Invariant
invariant_AMM_HasSufficientCollateral()
// sum(positions) * redemption_value <= vault.balance

// LP Accounting Invariant  
invariant_LP_TotalSupplyMatchesBalances()
// sum(lpBalances[market][user]) == markets[market].totalLPSupply

// Lock Consistency Invariant
invariant_LockedNeverExceedsAvailable()
// forall user: _lockedBalance[user] <= _availableBalance[user]

// Token Symmetry Invariant
invariant_YesNoSupplyEqual()
// YESToken.totalSupply() == NOToken.totalSupply() per market

// LMSR Price Sum Invariant
invariant_PricesSumToOne()
// P(YES) + P(NO) == 1.0 (within rounding tolerance)
```

### Fuzz Tests Needed

| Function | Status | Priority |
|----------|--------|----------|
| `AMMEngine.tradePositions(shares)` | ❌ | P0 |
| `LaunchpadEngine.tradePositions(shares)` | ❌ | P0 |
| `Collateralizer.split(amount)` | ✅ | Done |
| `TickBook.placeLimitOrder(tick, L)` | ❌ | P1 |
| `TickBook.executeMarketOrder(amount)` | ❌ | P1 |
| `LMSRMath.getCost(q, delta)` | ❌ | P1 |
| `AMMEngine.claimUnlocked(maxClaims)` | ❌ | P2 |

### Scenario Tests Needed

1. **Multi-User Graduation Race**
   - 10 traders racing to graduate a market
   - Verify graduation happens atomically
   - Verify fee distribution is correct

2. **Settlement with Locked Proceeds**
   - User has locked proceeds when market settles
   - Verify they can still redeem winning tokens
   - Verify locked proceeds remain claimable

3. **Creator LP Redemption Pre-Graduation**
   - Creator tries to dump LP before graduation
   - Verify proper floor value calculation
   - Verify liquidity withdrawal limits

4. **Cross-Market Reinvestment Flow**
   - Sell in Market A → proceeds locked
   - Use locked proceeds to buy in Market B
   - Verify no double-spend, correct accounting

---

## Recommended Action Plan

### Phase 1: Critical (This Week)

1. **Add AMMEngine Settlement Tests** - 5 tests
   - `test_SettlePosition_YESWins`
   - `test_SettlePosition_NOWins`  
   - `test_SettlePosition_NoPosition_Reverts`
   - `test_SettlePosition_NotSettled_Reverts`
   - `testFuzz_SettlePosition_RandomShares`

2. **Add TickBook Edge Cases** - 8 tests
   - Cross-tick orders
   - Partial fills
   - Extreme tick values (0, 10000)

### Phase 2: High Priority (Next Sprint)

3. **Create Invariant Test Suite** - `test/invariants/V8Invariants.t.sol`
   - Actor-based invariant testing
   - 5 core invariants from above

4. **Add Fuzz Tests** - 6 tests
   - Trade amount fuzzing
   - Tick range fuzzing
   - LMSR quantity fuzzing

### Phase 3: Hardening (Before Mainnet)

5. **Branch Coverage Push** - Target 60%+
   - Systematic require() testing
   - Boundary conditions

6. **Fork Tests on Base Sepolia**
   - Verify deployed contracts match test behavior
   - Integration with real MockUSDC

---

## Test Command Reference

```bash
# Run all V8 tests
forge test --match-path "test/v8/*"

# Run with coverage
forge coverage --ir-minimum

# Run specific test file
forge test --match-contract LaunchpadEngineTest -vvv

# Fuzz with more runs
forge test --fuzz-runs 10000

# Fork test
FORK_URL=https://sepolia.base.org forge test --fork-url $FORK_URL
```

---

## Files Requiring Tests

| File | Current Tests | Gaps |
|------|--------------|------|
| `AMMEngine.sol` | SpendableProceeds.t.sol | Settlement, T* |
| `LaunchpadEngine.sol` | LaunchpadEngine.t.sol | Integration with spendable |
| `TickBook.sol` | TickBook.t.sol | 45% uncovered |
| `Collateralizer.sol` | Collateralizer.t.sol, CollateralizerDecimals.t.sol | Branches |
| `TruthMarket.sol` | TruthMarket.t.sol | Branches |
| `LMSRMath.sol` | (via other tests) | Direct unit tests |
| `TickMath.sol` | (via TickBook.t.sol) | Edge cases |

---

**Next Steps:** Create `AMMSettlement.t.sol` and `V8Invariants.t.sol`

*Generated by QA workflow - 2025-12-27*

