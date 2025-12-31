# TickBook V9 Audit Findings Report
**Date**: 2025-12-30  
**Auditor**: OG EVM Dev  
**Contract**: TickBook.sol (270 LOC)  
**Status**: 4 CRITICAL, 3 HIGH, 3 MEDIUM issues found

---

## Finding 1: Fee Distribution Not Implemented [CRITICAL]

**Location**: Lines 269-270
```solidity
function getAccruedFees(bytes32 marketKey, address recipient) external pure override returns (uint256 amount) { return 0; }
function claimFees(bytes32 marketKey) external pure override returns (uint256 amount) { return 0; }
```

**Issue**: The 20bps taker fee (line 127: `fee = (amountOutAtTick * TAKER_FEE_BPS) / 10000`) is collected but permanently locked in the contract. Makers provide liquidity but earn zero yield.

**Impact**: 
- Protocol claims 0.2% on every taker trade
- Makers have no incentive to provide depth
- Fee tokens are permanently stranded

**Proof of Concept**:
```solidity
// Alice places 1000 WAD limit order
// Bob executes market order, pays 2 WAD in fees
// Alice calls claimFees() → returns 0
// 2 WAD permanently stuck in contract
```

**Recommendation**:
```solidity
mapping(bytes32 => uint256) private _feePool;

// In executeMarketOrder, after fee calculation:
_feePool[marketKey] += fee;

// Implement pro-rata distribution or simple claim
function claimFees(bytes32 marketKey) external returns (uint256 amount) {
    // Calculate maker's share based on filled volume
    amount = _calculateMakerFeeShare(marketKey, msg.sender);
    _feePool[marketKey] -= amount;
    // Transfer fee tokens to maker
}
```

---

## Finding 2: Depth Not Decremented on Fill [CRITICAL]

**Location**: Lines 150-153
```solidity
if (amountOutAtTick + fee >= maxOut) {
    _bitmaps[marketKey].clearBit(nextTick);
    currentTick = isBuy ? nextTick + 1 : (nextTick == 0 ? MAX_TICK + 1 : nextTick - 1);
}
```

**Issue**: When a tick is consumed, the bitmap is cleared but `_tickDepth[marketKey][nextTick]` is NOT decremented. This creates phantom liquidity.

**Impact**:
- `getTick()` returns non-zero reserves for consumed ticks
- Frontend displays incorrect depth
- Subsequent re-enabling of tick (via new order) compounds phantom depth

**Proof of Concept**:
```solidity
// 1. Alice places 100 WAD at tick 6000
_tickDepth[marketKey][6000] = 100e18;

// 2. Bob fully sweeps tick 6000
bitmap.clearBit(6000);  // ✓
// _tickDepth[6000] still = 100e18  // BUG!

// 3. Charlie places 50 WAD at tick 6000
_tickDepth[6000] += 50e18;  // Now = 150e18 (wrong!)

// 4. Virtual reserves computed from L=150e18, but only 50e18 tokens exist
```

**Recommendation**:
```solidity
if (amountOutAtTick + fee >= maxOut) {
    _tickDepth[marketKey][nextTick] = 0;  // ADD THIS
    _bitmaps[marketKey].clearBit(nextTick);
    // ...
}
```

---

## Finding 3: Partial Fill Accounting Bug [CRITICAL]

**Location**: Lines 157-159 (partial consumption branch)
```solidity
} else {
    currentTick = nextTick;
    break; 
}
```

**Issue**: When a tick is partially consumed (not fully swept), neither `_tickDepth` nor `_makerOrders` is updated. The maker can cancel their full original amount despite partial fill.

**Impact**:
- Maker can withdraw more tokens than remain
- Contract becomes insolvent
- Tokens extracted from other makers' deposits

**Proof of Concept**:
```solidity
// 1. Alice places 100 WAD at tick 6000, deposits 100 YES tokens
_makerOrders[6000][alice] = 100e18;

// 2. Bob partially fills (takes 30 WAD worth of YES)
// No state update to _makerOrders

// 3. Alice cancels: _makerOrders[6000][alice] still = 100e18
// Alice withdraws 100 YES tokens (but only 70 remain)
// Contract is now short 30 YES tokens
```

**Recommendation**: Track per-tick fills and adjust cancellation math:
```solidity
// Option A: Track remaining per maker
mapping(bytes32 => mapping(uint16 => mapping(address => uint128))) private _makerRemaining;

// Option B: Global fill tracking with FIFO/pro-rata attribution
```

---

## Finding 4: Over-Withdrawal Vulnerability [CRITICAL]

**Location**: Lines 235-240 (cancelLimitOrder)
```solidity
for (uint16 i = tickLower; i <= tickUpper; i++) {
    require(_makerOrders[marketKey][i][msg.sender] >= amount, "TickBook: insufficient order size");
    _tickDepth[marketKey][i] -= uint128(amount);
    _makerOrders[marketKey][i][msg.sender] -= uint128(amount);
```

**Issue**: Combined with Finding 3, this allows withdrawing tokens that were already filled to takers. The `require` passes because `_makerOrders` was never decremented.

**Impact**: Direct fund extraction from contract.

**Severity Multiplier**: This is the exploit path enabled by Finding 3.

---

## Finding 5: Unbounded Loop Gas Exhaustion [HIGH]

**Location**: Lines 220-224 and 235-243
```solidity
for (uint16 i = tickLower; i <= tickUpper; i++) {
    _tickDepth[marketKey][i] += uint128(amount);
    _makerOrders[marketKey][i][msg.sender] += uint128(amount);
    _bitmaps[marketKey].setBit(i);
}
```

**Issue**: No limit on range width. A 1000-tick range requires 1000 iterations with 3 SSTOREs each.

**Gas Analysis**:
| Range Width | Iterations | SSTORE Cost (warm) | Total Gas |
|-------------|------------|---------------------|-----------|
| 100 | 100 | ~5,000 | 1.5M |
| 500 | 500 | ~5,000 | 7.5M |
| 1000 | 1000 | ~5,000 | 15M |
| 5000 | 5000 | ~5,000 | 75M (FAILS) |

**Impact**: Orders > ~600 tick range will exceed block gas limit on most chains.

**Recommendation**:
```solidity
uint16 private constant MAX_RANGE_WIDTH = 100;

function placeLimitOrder(...) {
    require(tickUpper - tickLower <= MAX_RANGE_WIDTH, "TickBook: range too wide");
    // ...
}
```

---

## Finding 6: Edge Tick Division by Zero [HIGH]

**Location**: TickMath.sol lines 36-38 and 52-54
```solidity
// getVirtualReserveYES: tick=0 causes division by zero
uint256 denominator = uint256(tick);  // tick=0 → denominator=0
uint256 ratio = (numerator * WAD) / denominator;  // REVERTS

// getVirtualReserveNO: tick=9999 causes numerator=9999, denom=1 (ok)
// but tick=0: sqrt(0/10000) = 0 (functionally broken)
```

**Issue**: Tick 0 is unusable due to division by zero. Tick 9999 produces valid but extreme values.

**Impact**:
- 0.01% probability (tick 0) cannot be expressed
- Edge market states cannot be reached
- Effective tick range is 1-9998

**Recommendation**:
```solidity
uint16 constant MIN_TICK = 1;
uint16 constant MAX_TICK = 9998;

require(tick >= MIN_TICK && tick <= MAX_TICK, "TickMath: tick out of range");
```

---

## Finding 7: No Reentrancy Guard [HIGH]

**Location**: All external mutating functions

**Issue**: While CEI (Checks-Effects-Interactions) pattern is followed, no explicit `ReentrancyGuard` is applied. If YES/NO tokens are malicious (callback on transfer), reentrancy is possible.

**Attack Surface**:
- `placeLimitOrder`: Token transfers after loop but before event emission
- `cancelLimitOrder`: Token transfers after state changes (safe)
- `executeMarketOrder`: Token transfers after state changes (safe)

**Impact**: Low in practice if tokens are standard ERC20, but violates defense-in-depth.

**Recommendation**:
```solidity
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TickBook is ITickBook, ReentrancyGuard {
    function executeMarketOrder(...) external nonReentrant { ... }
    function placeLimitOrder(...) public nonReentrant { ... }
    function cancelLimitOrder(...) public nonReentrant { ... }
}
```

---

## Finding 8: Confusing isBuy Semantics [MEDIUM]

**Location**: Lines 166-168
```solidity
IERC20 tokenIn = isBuy ? IERC20(market.noToken) : IERC20(market.yesToken);
IERC20 tokenOut = isBuy ? IERC20(market.yesToken) : IERC20(market.noToken);
```

**Issue**: `isBuy=true` means "spend NO tokens to receive YES tokens". Interface comment says "buy YES" but the actual mechanic is "swap NO→YES".

**Impact**: 
- Developer confusion
- Frontend integration errors
- User expectation mismatch (expected to spend USDC, not NO tokens)

**Recommendation**: Rename to `isYesDirection` or add explicit NatSpec:
```solidity
/// @param isBuy true = swap NO for YES (price moves up), false = swap YES for NO (price moves down)
```

---

## Finding 9: Incomplete Range Order Tracking [MEDIUM]

**Location**: Lines 263-266
```solidity
function getLimitOrder(...) external view override returns (uint256 amount) {
    // For simplicity, we currently track liquidity per-tick in _makerOrders.
    // Returning depth at the lower tick as a proxy for the range order.
    return uint256(_makerOrders[marketKey][tickLower][maker]);
}
```

**Issue**: Returns only lower tick's depth, not the full range order state. Doesn't reflect partial fills.

**Impact**: Frontend cannot accurately display order status.

**Recommendation**: Return minimum across range or track orders by ID:
```solidity
struct LimitOrder {
    uint16 tickLower;
    uint16 tickUpper;
    uint256 originalAmount;
    uint256 remainingAmount;
}
mapping(bytes32 => mapping(uint256 => LimitOrder)) private _orders;
```

---

## Finding 10: MAX_TICK + 1 Sentinel Ambiguity [MEDIUM]

**Location**: TickBitmap.sol `findNextUp()` returns `MAX_TICK + 1 = 10000`

**Issue**: Return value 10000 is used as "not found" sentinel, but it's a valid uint16. Callers must know to check `> MAX_TICK`.

**Impact**: Silent bugs if caller uses return value without boundary check.

**Recommendation**: Use `type(uint16).max` (65535) as sentinel or return `(bool found, uint16 tick)`.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 4 | Must fix before production |
| HIGH | 3 | Should fix before mainnet |
| MEDIUM | 3 | Recommended improvements |
| LOW | 0 | - |
| INFO | 0 | - |

**Overall Assessment**: **NOT PRODUCTION READY**

The depth accounting bugs (Finding 2, 3, 4) create a direct fund extraction vulnerability. These must be fixed before any deployment with real value.

---

## Appendix: Code References

- TickBook.sol: 270 lines
- TickMath.sol: 120 lines  
- TickBitmap.sol: 150 lines
- ITickBook.sol: 130 lines
- TickBook.t.sol: 100 lines (tests don't cover partial fill scenario)

**Report Generated**: 2025-12-30 UTC
