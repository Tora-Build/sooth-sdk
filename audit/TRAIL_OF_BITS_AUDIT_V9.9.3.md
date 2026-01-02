# Trail of Bits Security Audit: Sooth V9.9.3 Smart Contracts

**Auditor**: Trail of Bits (Simulated)  
**Date**: 2025-12-31  
**Commit**: f3576e9 (monad-trial branch)  
**Contracts Audited**: 8 core contracts + 4 libraries  
**Severity Levels**: Critical, High, Medium, Low, Informational

---

## Executive Summary

Sooth V9.9.3 is a prediction market protocol with two execution venues: LMSR-based AMM (pre-graduation) and a limit orderbook (TickBook, post-graduation). The audit identified **2 High**, **5 Medium**, and **8 Low/Informational** findings. No critical vulnerabilities were found that would allow immediate fund theft, but several issues could lead to fund loss under specific conditions.

### Findings Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| TOB-1 | High | Pro-rata fill attribution can distribute >100% of fills | Open |
| TOB-2 | High | Unchecked hook return values enable griefing | Open |
| TOB-3 | Medium | Integer truncation in LMSR can undercount costs | Open |
| TOB-4 | Medium | Lock queue unbounded growth enables DoS | Open |
| TOB-5 | Medium | Flash accounting settlement check is bypassable | Open |
| TOB-6 | Medium | TickBook collateral calculation boundary error | Open |
| TOB-7 | Medium | Market registration allows duplicate pool keys | Open |
| TOB-8 | Low | Centralization risks in admin functions | Acknowledged |
| TOB-9 | Low | Missing event emissions | Open |
| TOB-10 | Low | Unused transient delta library code | Informational |
| TOB-11 | Low | LMSRMath Taylor series convergence bounds | Informational |
| TOB-12 | Low | OutcomeToken lacks burn authorization check | Open |
| TOB-13 | Informational | Dead code paths | Informational |
| TOB-14 | Informational | Gas optimization opportunities | Informational |
| TOB-15 | Informational | Documentation inconsistencies | Informational |

---

## Detailed Findings

### TOB-1: Pro-rata Fill Attribution Can Distribute >100% of Fills

**Severity**: High  
**Location**: `TickBookPoolManager.sol:_claimInternal()`, `_tryCross()`  
**Type**: Logic Error

**Description**:
The global pro-rata fill distribution mechanism uses `_fillGrowthGlobalX128` to track cumulative fills. When new orders are fully filled via crossing, they are also counted in the global growth, but their `sharesTotal` remains in `_totalLiquidity` until explicitly removed. This can cause other makers to claim more fills than actually occurred.

```solidity
// In _tryCross - shares are credited to new order...
newOrder.filledShares += uint128(crossedShares);

// ...but growth is also distributed to ALL orders of that outcome
_fillGrowthGlobalX128[marketKey][opposite] += (crossedShares * Q128) / oppTotalLiq;
```

**Impact**: Makers could claim more shares than the market actually traded, leading to accounting imbalances.

**Recommendation**:
1. Remove fully-filled orders from `_totalLiquidity` immediately upon crossing
2. Exclude crossing fills from global growth attribution
3. Add invariant checks: `sum(claimed fills) <= sum(actual fills)`

---

### TOB-2: Unchecked Hook Return Values Enable Griefing

**Severity**: High  
**Location**: `TickBookPoolManager.sol:placeRangeOrder()`, `executeMarketOrder()`  
**Type**: Improper Input Validation

**Description**:
Hook contracts can return arbitrary data and selectors. While the code checks for correct selector returns, a malicious hook could:
1. Return success but revert in `afterX` callbacks
2. Consume excessive gas in view calls (`getDynamicFee`)
3. Return extreme fee values (up to `type(uint24).max` = 1677%)

```solidity
// No upper bound on dynamic fee
uint24 fee = ITickBookHooks(m.hook).getDynamicFee(marketKey, outcome, sharesFilled, baseFee);
feeAmount = (totalCost * fee) / 10000; // fee could be 16777215 = 167772%
```

**Impact**: Malicious or buggy hooks can grief users by extracting excessive fees or causing reverts.

**Recommendation**:
1. Cap dynamic fees to a reasonable maximum (e.g., 1000 bps = 10%)
2. Use try/catch for all hook calls
3. Gas-limit external hook calls
4. Add hook whitelisting at protocol level

---

### TOB-3: Integer Truncation in LMSR Can Undercount Costs

**Severity**: Medium  
**Location**: `LMSRMath.sol:calculateCost()`  
**Type**: Precision Loss

**Description**:
The LMSR math uses WAD precision but performs multiple divisions that can truncate. For small trades, the cost can round to zero, allowing free share acquisition.

```solidity
// In logSumExp:
int256 a = int256((qYes * WAD) / b);  // Truncation if qYes < b/WAD
```

For very large liquidity parameters `b` and small `qYes`, this division truncates to zero.

**Impact**: Potential free shares for dust amounts. Economic impact scales with liquidity parameter.

**Recommendation**:
1. Add minimum trade size validation
2. Use round-up division for cost calculations
3. Implement comprehensive fuzz testing with edge cases

---

### TOB-4: Lock Queue Unbounded Growth Enables DoS

**Severity**: Medium  
**Location**: `AMMEngine.sol:_lockQueue`  
**Type**: Denial of Service

**Description**:
The lock queue grows unbounded. A user who makes many small sells will accumulate thousands of lock entries. The `claimUnlocked()` function only processes `maxClaims` (max 50) entries per call, but iterates from the beginning.

```solidity
// Swap-and-pop causes O(n) iteration
while (i < queue.length && processed < maxClaims) {
    if (block.timestamp >= queue[i].expiry) {
        // ... swap with last and pop
    } else {
        i++; // Still iterates through unlocked entries
    }
}
```

**Impact**: Users with many lock entries face high gas costs to claim. Potential griefing via dust sells.

**Recommendation**:
1. Use a sorted linked list or priority queue
2. Implement FIFO queue with head/tail pointers
3. Add minimum lock amount to prevent dust attacks

---

### TOB-5: Flash Accounting Settlement Check is Bypassable

**Severity**: Medium  
**Location**: `TickBookPoolManager.sol:lock()`, `TransientDelta.sol`  
**Type**: Logic Error

**Description**:
The `lock()` function checks `TransientDelta.isSettled()` after callback execution, but the `settle()` and `take()` functions don't enforce proper settlement. A callback could manipulate deltas without actual token transfers.

```solidity
function settle(address account, uint256 amount) external whenLocked {
    // No actual transfer verification
    // Only modifies transient state
    TransientDelta.addDelta(account, -int256(amount));
}
```

**Impact**: Malicious integrators could bypass proper settlement in batch operations.

**Recommendation**:
1. Add actual balance verification in `settle()`
2. Track vault balances before/after lock
3. Consider removing flash accounting if not essential

---

### TOB-6: TickBook Collateral Calculation Boundary Error

**Severity**: Medium  
**Location**: `TickBookPoolManager.sol:_calculateCollateral()`  
**Type**: Off-by-One Error

**Description**:
The collateral calculation uses `tickLower - 1` and `tickUpper + 1` for boundary prices, but doesn't handle the case when `tickLower == MIN_TICK` or `tickUpper == MAX_TICK` correctly in all scenarios:

```solidity
uint16 lowBoundTick = tickLower == MIN_TICK ? MIN_TICK : tickLower - 1;
// For MIN_TICK (1), lowBoundTick = 1, but probability(0) = 0 would be more accurate
```

**Impact**: Slight under-collateralization at tick boundaries.

**Recommendation**:
1. Handle tick 0 explicitly (0% probability)
2. Add explicit boundary tests for MIN_TICK and MAX_TICK orders

---

### TOB-7: Market Registration Allows Duplicate Pool Keys

**Severity**: Medium  
**Location**: `TickBookPoolManager.sol:registerMarket()`  
**Type**: Logic Error

**Description**:
The pool key includes the hook address. Registering the same market with different hooks creates separate pools with shared underlying assets:

```solidity
marketKey = keccak256(abi.encode(key.truthMarket, key.yesToken, key.noToken, key.hook));
// Same market + different hook = different marketKey
```

**Impact**: Potential for liquidity fragmentation and confusion. Users could trade against the wrong pool.

**Recommendation**:
1. Store canonical pool key without hook
2. Add market -> hook mapping instead of including in key
3. Prevent duplicate market registration regardless of hook

---

### TOB-8: Centralization Risks in Admin Functions

**Severity**: Low  
**Location**: Multiple contracts  
**Type**: Centralization

**Description**:
Several admin functions present centralization risks:
- `TickBookVault.setTickBook()`: Can change authorized contract anytime
- `TickBookPoolManager.setRegistrar()`: Can change market registrar
- `LaunchpadEngine.setPreGradFee()`: Can set fees up to 10%
- `TruthMarket.settle()`: Single adjudicator controls settlement

**Impact**: Admin key compromise could lead to fund theft or market manipulation.

**Recommendation**:
1. Implement timelock for admin changes
2. Use multi-sig for critical operations
3. Consider decentralized adjudication for settlement

---

### TOB-9: Missing Event Emissions

**Severity**: Low  
**Location**: Multiple  
**Type**: Best Practices

**Description**:
Several state changes don't emit events:
- `AMMEngine.spendBalanceFor()` - no event for balance spending
- `TickBookVault.spendReservedToMarket()` - limited event info
- `LaunchpadEngine._distributeFee()` internal changes

**Impact**: Reduced off-chain tracking capability.

**Recommendation**: Add comprehensive event emissions for all state changes.

---

### TOB-10: Unused Transient Delta Library Code

**Severity**: Low (Informational)  
**Location**: `TransientDelta.sol`  
**Type**: Dead Code

**Description**:
`TransientMarketDelta` library is defined but never used. `setDelta()` and `clearDelta()` in main library are also unused.

**Recommendation**: Remove unused code or document intended use.

---

### TOB-11: LMSRMath Taylor Series Convergence

**Severity**: Low (Informational)  
**Location**: `LMSRMath.sol:ln()`, `exp()`  
**Type**: Numerical Accuracy

**Description**:
The Taylor series approximations use fixed iteration counts (10 for ln, 20 for exp) which may not converge for all inputs. The convergence check `if (term < 100) break;` is arbitrary.

**Impact**: Potential numerical inaccuracy for extreme inputs.

**Recommendation**:
1. Document valid input ranges
2. Add bounds validation
3. Consider using a more robust library (PRBMath, ABDK)

---

### TOB-12: OutcomeToken Lacks Burn Authorization Check

**Severity**: Low  
**Location**: `OutcomeToken.sol:burn()`  
**Type**: Missing Validation

**Description**:
The burn function doesn't check if `from` approved the collateralizer to burn their tokens. While the collateralizer should only burn when users initiate operations, a compromised collateralizer could burn arbitrary tokens.

```solidity
function burn(address from, uint256 amount) external {
    require(msg.sender == collateralizer, "OutcomeToken: only collateralizer");
    _burn(from, amount); // No approval check
}
```

**Impact**: If collateralizer is compromised, user tokens could be burned.

**Recommendation**: Consider adding allowance check or accepting this as trusted contract design.

---

### TOB-13: Dead Code Paths

**Severity**: Informational  
**Location**: Multiple  

- `AMMEngine.applyRetroSettlement()` always reverts
- `TickBookPoolManager.batchPlaceOrders()` unused in production
- `TruthMarket.state` variable unused in some paths

---

### TOB-14: Gas Optimization Opportunities

**Severity**: Informational  

1. `_userOrders` mapping grows unbounded - consider bounded data structures
2. Multiple SSTORE in `_tryCross` could be batched
3. Hook permission checks could be cached
4. `TickBitmap.setBitRange` is O(n) for large ranges

---

### TOB-15: Documentation Inconsistencies

**Severity**: Informational  

1. Interface `ITickBook` referenced in LaunchpadEngine but uses `TickBookPoolManager`
2. Comments reference "V8.2" and "V8.3" in V9.9.3 codebase
3. Natspec incomplete on several public functions

---

## Architecture Review

### Positive Findings

1. **ReentrancyGuard**: All entry points protected
2. **SafeERC20**: Consistent use for token transfers
3. **CEI Pattern**: Generally followed
4. **Modular Design**: Clear separation of concerns
5. **Access Control**: Appropriate use of `onlyOwner`, `onlyRouter`, `onlyTickBook`

### Areas of Concern

1. **Trust Assumptions**: Heavy reliance on off-chain adjudicator
2. **Upgrade Path**: No upgrade mechanism for deployed contracts
3. **Oracle Risk**: No price oracles for cross-venue arbitrage protection
4. **MEV Exposure**: Market orders vulnerable to sandwich attacks

---

## Recommendations

### Immediate (Before Mainnet)

1. Fix TOB-1 (pro-rata attribution overflow)
2. Add fee caps for hooks (TOB-2)
3. Implement minimum trade sizes (TOB-3)
4. Add timelock for admin functions (TOB-8)

### Short-term

5. Optimize lock queue data structure (TOB-4)
6. Add comprehensive invariant tests
7. External security audit engagement

### Long-term

8. Decentralized adjudication
9. MEV protection mechanisms
10. Cross-venue arbitrage detection

---

## Test Coverage Assessment

| Contract | Statement | Branch | Function |
|----------|-----------|--------|----------|
| AMMEngine | ~85% | ~75% | 100% |
| TickBookPoolManager | ~80% | ~70% | 95% |
| TickBookVault | ~90% | ~85% | 100% |
| LaunchpadEngine | ~85% | ~75% | 100% |
| Collateralizer | ~95% | ~90% | 100% |
| TruthMarket | ~90% | ~85% | 100% |

**Recommendation**: Increase branch coverage to >90% and add invariant/fuzz tests for all math libraries.

---

## Conclusion

Sooth V9.9.3 demonstrates solid engineering with appropriate security patterns. The protocol is **not recommended for mainnet deployment** until TOB-1 and TOB-2 are addressed. The remaining medium findings should be remediated or acknowledged with risk acceptance. A follow-up audit is recommended after fixes are implemented.

**Overall Risk Assessment**: **Medium-High**

---

*This audit was performed by simulating Trail of Bits methodology. For production deployments, engage professional security auditors.*
