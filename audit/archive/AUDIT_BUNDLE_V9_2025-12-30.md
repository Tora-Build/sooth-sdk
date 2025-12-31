# Sooth Protocol V9 Audit Bundle
**Date**: 2025-12-30  
**Version**: V9.5 (TickBook Concentrated Orderbook)  
**Focus**: TickBook.sol + Supporting Libraries  

---

## Executive Summary

This audit bundle contains structured prompts for deep review of the V8.1/V9 TickBook implementation - a hybrid concentrated orderbook for prediction markets with 10,000 discrete probability ticks.

---

## Part 1: Audit Prompts

### Prompt 1: Fee Distribution Integrity
```
Review TickBook.sol fee mechanism:
1. Taker fee is 20bps (TAKER_FEE_BPS = 20)
2. Fee is deducted in executeMarketOrder() line ~127: `uint256 fee = (amountOutAtTick * TAKER_FEE_BPS) / 10000`
3. Fee tokens remain in contract but getAccruedFees() returns 0
4. claimFees() returns 0

QUESTIONS:
- Where do the 20bps fees go?
- How should makers claim their proportional share?
- Is there a yield accumulator pattern needed?
```

### Prompt 2: Depth Accounting Consistency
```
Analyze _tickDepth state management in executeMarketOrder():

Current behavior:
- When tick is consumed: _bitmaps[marketKey].clearBit(nextTick)
- BUT: _tickDepth[marketKey][nextTick] is NOT decremented

Trace impact:
1. Maker places 100 WAD liquidity at tick 6000
2. Taker sweeps through tick 6000
3. Bitmap cleared, but _tickDepth[6000] still = 100 WAD
4. Next trade: getVirtualReserveYES(100, 6000) returns non-zero reserves
5. But no tokens exist to fill the order

QUESTIONS:
- Does this cause phantom liquidity?
- Should _tickDepth be decremented proportionally to consumed output?
- What's the correct accounting for partial tick consumption?
```

### Prompt 3: Gas Scalability Audit
```
Analyze loop bounds in placeLimitOrder() and cancelLimitOrder():

for (uint16 i = tickLower; i <= tickUpper; i++) {
    _tickDepth[marketKey][i] += uint128(amount);
    _makerOrders[marketKey][i][msg.sender] += uint128(amount);
    _bitmaps[marketKey].setBit(i);
}

GAS ANALYSIS:
- Each iteration: 2 SSTOREs (warm after first) + 1 SSTORE (bitmap)
- Warm SSTORE: ~5,000 gas (worst case 20,000 for cold)
- 1000 tick range = 1000 iterations * 25,000 gas = 25M gas
- Block gas limit: ~30M (most chains)

QUESTIONS:
- Should there be a MAX_RANGE_WIDTH constant?
- Alternative: lazy depth aggregation with sqrt decomposition?
- Can we batch-update bitmap words instead of per-tick?
```

### Prompt 4: Edge Tick Handling
```
Review TickMath.sol boundary conditions:

getVirtualReserveYES(L, tick):
  require(tick <= MAX_TICK && tick > 0, "TickMath: invalid tick")
  // sqrt((N-i)/i) where N=10000
  // tick=0: division by zero
  // tick=9999: sqrt(1/9999) ≈ 0.01

getVirtualReserveNO(L, tick):
  require(tick <= MAX_TICK && tick < MAX_TICK, "TickMath: invalid tick")
  // tick=9999: denominator = 10000-9999 = 1 (ok)
  // tick=0: sqrt(0/10000) = 0

QUESTIONS:
- Can orders be placed at tick 0 or 9999?
- Do edge ticks represent 0% and 99.99% probability correctly?
- Should edge ticks be MIN_TICK=1 and MAX_TICK=9998?
```

### Prompt 5: Partial Fill Maker Attribution
```
Analyze maker accounting during partial fills:

_makerOrders[marketKey][i][maker] tracks total order size
But executeMarketOrder() doesn't update _makerOrders when consuming depth

Scenario:
1. Alice places 100 WAD limit order at tick 6000
2. Bob market buys, consuming 30 WAD of Alice's liquidity
3. _makerOrders[6000][alice] still = 100 WAD
4. Alice cancels: gets refund for 100 WAD (but 30 was already taken)

QUESTIONS:
- Does this allow over-withdrawal?
- Should _makerOrders track "remaining" vs "original"?
- How to attribute fills to specific makers (FIFO? Pro-rata?)
```

### Prompt 6: Reentrancy Surface Analysis
```
Map all external calls in TickBook.sol:

executeMarketOrder():
  L164: tokenIn.safeTransferFrom(msg.sender, address(this), amountIn)
  L165: tokenOut.safeTransfer(msg.sender, totalOut)

placeLimitOrder():
  L205: IERC20(market.yesToken).safeTransferFrom(...)
  L206: IERC20(market.noToken).safeTransferFrom(...)

cancelLimitOrder():
  L249: IERC20(market.yesToken).safeTransfer(...)
  L250: IERC20(market.noToken).safeTransfer(...)

QUESTIONS:
- CEI pattern followed? (Yes for market orders: state → transfers)
- But placeLimitOrder: transfers before bitmap.setBit() in some paths?
- Should ReentrancyGuard be added for defense-in-depth?
```

### Prompt 7: Bitmap Correctness
```
Verify TickBitmap.sol two-level structure:

Level 1: 100 bits (one per word)
Level 2: 100 words × 100 bits each

Total: 100 × 100 = 10,000 ticks ✓

Edge cases in findNextUp():
- startTick = 9998: searches for 9999+
- If no tick >= 9999 has liquidity, returns MAX_TICK + 1 = 10000

QUESTIONS:
- Is 10000 a valid sentinel for "not found"?
- What happens if caller treats 10000 as valid tick?
- Should return type be uint16 (max 65535) or explicit -1 pattern?
```

### Prompt 8: Token Symmetry Verification
```
Verify YES/NO token requirements in placeLimitOrder():

Case 1: currentTick <= tickLower (order above market)
  → Only YES tokens required (selling YES at higher price)
  
Case 2: currentTick > tickUpper (order below market)
  → Only NO tokens required (selling NO at lower price)

Case 3: tickLower < currentTick <= tickUpper (straddling)
  → Both YES and NO tokens required

QUESTIONS:
- Is the asymmetry correct for prediction market semantics?
- Does cancellation return the correct token mix after price movement?
- What if currentTick moved while order was active?
```

### Prompt 9: Interface Compliance
```
Compare ITickBook.sol declarations vs TickBook.sol implementation:

Interface declares:
- executeMarketOrder() ✓
- getQuote() ✓
- placeLimitOrder() ✓
- cancelLimitOrder() ✓
- getTick() ✓
- getCurrentTick() ✓
- findNextActiveTick() ✓
- registerMarket() ✓
- getMarketInfo() ✓
- getLimitOrder() ✓
- getAccruedFees() ✓ (stub)
- claimFees() ✓ (stub)

Events declared: 3 (MarketOrderExecuted, LimitOrderPlaced, LimitOrderCancelled)

QUESTIONS:
- All interface functions implemented?
- Event emission at correct locations?
- Return types match?
```

### Prompt 10: Economic Attack Vectors
```
Identify potential economic exploits:

1. SANDWICH ATTACK:
   - Front-run large market order with limit order
   - Market order fills your limit
   - Back-run to claim profits
   
2. TICK MANIPULATION:
   - Place tiny orders at many ticks
   - Force sweeps through sparse book
   - Profit from price impact asymmetry

3. PHANTOM LIQUIDITY:
   - Exploit _tickDepth not being decremented
   - Create illusion of depth that can't be filled

QUESTIONS:
- What's the minimum order size enforcement?
- Is there MEV protection (e.g., commit-reveal)?
- How does 20bps taker fee affect sandwich profitability?
```

---

## Part 2: V8 Review Findings (Still Valid for V9)

### Critical Issues Requiring Fix

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| V8-C1 | CRITICAL | Fee accumulation stub - makers earn nothing | OPEN |
| V8-C2 | CRITICAL | _tickDepth not decremented on fill | OPEN |
| V8-H1 | HIGH | O(n) loop in place/cancel can exceed gas limit | OPEN |
| V8-H2 | HIGH | Partial fill doesn't update _makerOrders | OPEN |

### Medium Issues

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| V8-M1 | MEDIUM | Tick 0 and 9999 unusable (div by zero) | OPEN |
| V8-M2 | MEDIUM | No explicit reentrancy guard | OPEN |
| V8-M3 | MEDIUM | isBuy semantics confusing (spend NO to get YES) | OPEN |

### Low/Info

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| V8-L1 | LOW | MAX_TICK + 1 sentinel could be clearer | OPEN |
| V8-I1 | INFO | Test file has unused IERC20 import | OPEN |

---

## Part 3: Recommended Fixes

### Fix 1: Fee Distribution (V8-C1)
```solidity
// Add to state:
mapping(bytes32 => mapping(address => uint256)) private _makerFeeAccrued;
mapping(bytes32 => uint256) private _totalFeeAccrued;

// In executeMarketOrder, after fee calculation:
// Distribute fee pro-rata to makers at consumed tick
_distributeFees(marketKey, nextTick, fee);

function _distributeFees(bytes32 marketKey, uint16 tick, uint256 fee) internal {
    uint128 totalDepth = _tickDepth[marketKey][tick];
    if (totalDepth == 0) return;
    // Store for later claiming - precise pro-rata would need maker enumeration
    _totalFeeAccrued[marketKey] += fee;
}
```

### Fix 2: Depth Accounting (V8-C2)
```solidity
// In executeMarketOrder, when consuming tick:
if (amountOutAtTick + fee >= maxOut) {
    _bitmaps[marketKey].clearBit(nextTick);
    _tickDepth[marketKey][nextTick] = 0; // ADD THIS
} else {
    // Partial consumption - decrement proportionally
    uint256 consumedFraction = (amountOutAtTick * WAD) / maxOut;
    uint256 depthConsumed = (_tickDepth[marketKey][nextTick] * consumedFraction) / WAD;
    _tickDepth[marketKey][nextTick] -= uint128(depthConsumed);
}
```

### Fix 3: Range Cap (V8-H1)
```solidity
uint16 private constant MAX_RANGE_WIDTH = 100; // 1% of tick space

function placeLimitOrder(...) {
    require(tickUpper - tickLower <= MAX_RANGE_WIDTH, "TickBook: range too wide");
    // ... rest of function
}
```

### Fix 4: Add Reentrancy Guard (V8-M2)
```solidity
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TickBook is ITickBook, ReentrancyGuard {
    // Add nonReentrant to:
    function executeMarketOrder(...) external nonReentrant returns (...) { }
    function placeLimitOrder(...) public nonReentrant returns (...) { }
    function cancelLimitOrder(...) public nonReentrant returns (...) { }
}
```

---

## Part 4: Test Prompts

### Test Prompt 1: Fuzz Order Lifecycle
```
fuzz_OrderLifecycle(uint16 tickLower, uint16 tickUpper, uint256 amount):
  1. Bound inputs: 1 <= tickLower <= tickUpper <= 9998, amount > 0
  2. Split USDC to get YES/NO tokens
  3. Place limit order
  4. Verify token balances transferred
  5. Execute partial market order against it
  6. Cancel remaining
  7. Verify: tokens received == tokens deposited - tokens filled
```

### Test Prompt 2: Invariant - Total Depth
```
invariant_TotalDepthMatchesTokens():
  For each market:
    sum(_tickDepth[market][i] for all i) * virtualReserveRatio
    == yesToken.balanceOf(tickBook) + noToken.balanceOf(tickBook)
```

### Test Prompt 3: Edge Tick Behavior
```
test_EdgeTickBehavior():
  1. Try place order at tick 0 → should revert
  2. Try place order at tick 9999 → should revert
  3. Place order at tick 1 → should succeed
  4. Place order at tick 9998 → should succeed
```

---

## Part 5: Audit Execution Checklist

- [ ] Run all prompts against current TickBook.sol
- [ ] Document findings for each prompt
- [ ] Verify V8 issues are addressed or acknowledged
- [ ] Run forge test with verbose output
- [ ] Run slither static analysis
- [ ] Check gas usage for max-width range orders
- [ ] Verify interface compliance
- [ ] Economic attack simulation
- [ ] Sign off on production readiness

---

## Appendix: Contract Files in Scope

| File | Lines | Purpose |
|------|-------|---------|
| `TickBook.sol` | ~270 | Main orderbook contract |
| `ITickBook.sol` | ~130 | Interface definition |
| `TickMath.sol` | ~120 | Math library for tick calculations |
| `TickBitmap.sol` | ~150 | Two-level bitmap for tick discovery |
| `TickBook.t.sol` | ~100 | Unit tests |

---

**Bundle Version**: V9.5-alpha  
**Author**: OG EVM Dev Review  
**Status**: Ready for Execution
