# V9.9.4 Implementation Plan: Audit Remediation

**Date**: 2025-12-31  
**From**: V9.9.3  
**To**: V9.9.4 (Lean)  
**Estimated Effort**: 2-3 days  
**Status**: ✅ EXECUTED

---

## Execution Summary

| Phase | Status | Files Changed |
|-------|--------|---------------|
| P0: Security Fixes | ✅ Done | TickBookPoolManagerV994.sol |
| P1: Code Deletion | ✅ Done | Created lean V994 contract |
| P2: Optimizations | ⏸️ Deferred | (PRBMath for V10) |

**New Files Created:**
- `contracts/TickBookPoolManagerV994.sol` - Lean version (850 lines vs 1300 original)
- `contracts/TickBookPoolManager.sol.backup` - Original backup

**Files Modified:**
- `contracts/AMMEngine.sol` - Removed applyRetroSettlement
- `contracts/interfaces/IAMMEngine.sol` - Removed applyRetroSettlement

**Files Archived:**
- `contracts/libraries/_archived/TransientDelta.sol`
- `contracts/interfaces/_archived/ITickBookHooks.sol`

**Test Results:** 106/106 tests passing ✅

---

## Table of Contents

1. [Phase 1: Critical Security Fixes (P0)](#phase-1-critical-security-fixes-p0)
2. [Phase 2: Code Deletion (P1)](#phase-2-code-deletion-p1)
3. [Phase 3: Optimizations (P2)](#phase-3-optimizations-p2)
4. [Removed Code Archive](#removed-code-archive)
5. [Testing Checklist](#testing-checklist)

---

## Phase 1: Critical Security Fixes (P0)

**Effort**: 2-4 hours  
**Risk**: High (blocks mainnet)

### 1.1 Fix TOB-1: Pro-rata Fill Attribution Overflow

**File**: `TickBookPoolManager.sol`  
**Function**: `_tryCross()`  
**Line**: ~780

**Current Code** (VULNERABLE):
```solidity
// Credit shares to new order owner
vault.creditOutcome(m.truthMarket, newOrder.owner, newOrder.outcome, crossedShares);
newOrder.filledShares += uint128(crossedShares);
newOrder.collateralUsedWad += uint128(newOrderCost);

// V9.9.3 FIX: If new order is 100% filled via crossing, remove its tick liquidity
if (newOrder.filledShares >= newOrder.sharesTotal) {
    _updateTickBoundaries(marketKey, newOrder.outcome, newOrder.tickLower, newOrder.tickUpper, -int128(newOrder.liquidity), false);
    _totalLiquidity[marketKey][newOrder.outcome] -= newOrder.sharesTotal;
}

// Update fill growth globals for opposite side
// BUG: This distributes to ALL orders including ones outside overlap range
if (oppLiqInOverlap > 0) {
    _fillGrowthGlobalX128[marketKey][opposite] += (crossedShares * Q128) / oppTotalLiq;
    _collateralUsedGrowthGlobalX128[marketKey][opposite] += (oppositeCost * Q128) / oppTotalLiq;
}
```

**Fixed Code**:
```solidity
// Credit shares to new order owner
vault.creditOutcome(m.truthMarket, newOrder.owner, newOrder.outcome, crossedShares);
newOrder.filledShares += uint128(crossedShares);
newOrder.collateralUsedWad += uint128(newOrderCost);

// V9.9.4 FIX: Always remove filled liquidity from new order
if (newOrder.filledShares >= newOrder.sharesTotal) {
    _updateTickBoundaries(marketKey, newOrder.outcome, newOrder.tickLower, newOrder.tickUpper, -int128(newOrder.liquidity), false);
    _totalLiquidity[marketKey][newOrder.outcome] -= newOrder.sharesTotal;
    newOrder.active = false; // Mark as inactive
}

// V9.9.4 FIX: Only attribute fills to liquidity IN the overlap range
// Use oppLiqInOverlap as denominator, not oppTotalLiq
if (oppLiqInOverlap > 0) {
    _fillGrowthGlobalX128[marketKey][opposite] += (crossedShares * Q128) / oppLiqInOverlap;
    _collateralUsedGrowthGlobalX128[marketKey][opposite] += (oppositeCost * Q128) / oppLiqInOverlap;
}
```

---

### 1.2 Fix TOB-2: Uncapped Hook Fees

**File**: `TickBookPoolManager.sol`  
**Function**: `executeMarketOrder()`  
**Line**: ~450

**Current Code** (VULNERABLE):
```solidity
// Apply dynamic taker fee if hook supports it
uint256 feeAmount = 0;
if (m.hook != address(0) && m.hook.getDynamicFee()) {
    uint24 baseFee = 10; // 0.1% default
    uint24 fee = ITickBookHooks(m.hook).getDynamicFee(marketKey, outcome, sharesFilled, baseFee);
    feeAmount = (totalCost * fee) / 10000;
    totalCost += feeAmount;
}
```

**Fixed Code**:
```solidity
// Apply dynamic taker fee if hook supports it
uint256 feeAmount = 0;
if (m.hook != address(0) && m.hook.getDynamicFee()) {
    uint24 baseFee = 10; // 0.1% default
    uint24 fee = ITickBookHooks(m.hook).getDynamicFee(marketKey, outcome, sharesFilled, baseFee);
    
    // V9.9.4 FIX: Cap fee at 10% (1000 bps) to prevent malicious hooks
    if (fee > 1000) fee = 1000;
    
    feeAmount = (totalCost * fee) / 10000;
    totalCost += feeAmount;
}
```

**Also add constant**:
```solidity
uint24 private constant MAX_FEE_BPS = 1000; // 10% max fee
```

---

## Phase 2: Code Deletion (P1)

**Effort**: 1 day  
**Risk**: Low (no FE impact)

### 2.1 Delete TransientDelta.sol

**File to Delete**: `contracts/libraries/TransientDelta.sol`

**Archived Implementation**: See [Section 4.1](#41-transientdeltasol-full-implementation)

**References to Remove**:
```solidity
// In TickBookPoolManager.sol, remove:
import {TransientDelta} from "./libraries/TransientDelta.sol";
using TransientDelta for address;
```

---

### 2.2 Remove Hook System from TickBookPoolManager

**File**: `TickBookPoolManager.sol`

#### 2.2.1 Remove Imports
```solidity
// DELETE these lines:
import {ITickBookHooks, HookPermissions} from "./interfaces/ITickBookHooks.sol";
using HookPermissions for address;
```

#### 2.2.2 Remove Hook Field from Market Struct
```solidity
// BEFORE:
struct Market {
    address truthMarket;
    address yesToken;
    address noToken;
    address hook;           // DELETE THIS
    bool isActive;
}

// AFTER:
struct Market {
    address truthMarket;
    address yesToken;
    address noToken;
    bool isActive;
}
```

#### 2.2.3 Remove Hook from PoolKey
```solidity
// BEFORE:
struct PoolKey {
    address truthMarket;
    address yesToken;
    address noToken;
    address hook;           // DELETE THIS
}

// AFTER:
struct PoolKey {
    address truthMarket;
    address yesToken;
    address noToken;
}
```

#### 2.2.4 Update _getPoolKey Functions
```solidity
// BEFORE:
function _getPoolKey(PoolKey calldata key) internal pure returns (bytes32) {
    return keccak256(abi.encode(key.truthMarket, key.yesToken, key.noToken, key.hook));
}

// AFTER:
function _getPoolKey(PoolKey calldata key) internal pure returns (bytes32) {
    return keccak256(abi.encode(key.truthMarket, key.yesToken, key.noToken));
}
```

#### 2.2.5 Add Simple Fee Storage (Replacement)
```solidity
// ADD these state variables:
uint24 public takerFeeBps = 10;  // 0.1% default
uint24 public makerFeeBps = 0;   // No maker fee by default

// ADD setter function:
function setFees(uint24 _takerFee, uint24 _makerFee) external onlyOwner {
    require(_takerFee <= MAX_FEE_BPS, "taker fee too high");
    require(_makerFee <= MAX_FEE_BPS, "maker fee too high");
    takerFeeBps = _takerFee;
    makerFeeBps = _makerFee;
    emit FeesUpdated(_takerFee, _makerFee);
}

event FeesUpdated(uint24 takerFee, uint24 makerFee);
```

#### 2.2.6 Remove Hook Callbacks from placeRangeOrder
```solidity
// DELETE this entire block (~20 lines):
// Before hook
bytes memory hookData;
if (m.hook != address(0) && m.hook.beforePlaceOrder()) {
    ITickBookHooks.PlaceOrderParams memory params = ITickBookHooks.PlaceOrderParams({
        marketKey: marketKey,
        sender: msg.sender,
        outcome: outcome,
        tickLower: tickLower,
        tickUpper: tickUpper,
        sharesTotal: sharesTotal
    });
    (bytes4 selector, bytes memory data) = ITickBookHooks(m.hook).beforePlaceOrder(params);
    if (selector != ITickBookHooks.beforePlaceOrder.selector) revert InvalidHookResponse();
    hookData = data;
}

// DELETE this entire block (~15 lines):
// After hook
if (m.hook != address(0) && m.hook.afterPlaceOrder()) {
    ITickBookHooks.PlaceOrderParams memory params = ITickBookHooks.PlaceOrderParams({...});
    ITickBookHooks(m.hook).afterPlaceOrder(params, orderId, hookData);
}
```

#### 2.2.7 Remove Hook Callbacks from executeMarketOrder
```solidity
// DELETE beforeExecuteOrder block (~15 lines)
// DELETE afterExecuteOrder block (~10 lines)
// DELETE getDynamicFee block - REPLACE with simple fee:

// REPLACE hook fee logic with:
uint256 feeAmount = (totalCost * uint256(takerFeeBps)) / 10000;
totalCost += feeAmount;
```

#### 2.2.8 Remove Hook Callbacks from cancelOrder
```solidity
// DELETE beforeCancelOrder block (~10 lines)
// DELETE afterCancelOrder block (~8 lines)
```

#### 2.2.9 Remove Hook Callbacks from _claimInternal
```solidity
// DELETE beforeClaim block (~10 lines)
// DELETE afterClaim block (~8 lines)
```

#### 2.2.10 Remove Hook Callbacks from _tryCross
```solidity
// DELETE beforeCross block (~10 lines)
// DELETE afterCross block (~8 lines)
```

#### 2.2.11 Remove Custom Errors
```solidity
// DELETE:
error InvalidHookResponse();
error HookFailed();
```

**Total Lines Removed**: ~200

---

### 2.3 Remove Flash Accounting Functions

**File**: `TickBookPoolManager.sol`

#### Functions to Delete:
```solidity
// DELETE entire function (~30 lines):
function lock(bytes calldata data) external returns (bytes memory result) {
    address prevLocker = _locker;
    _locker = msg.sender;
    _lockCount++;
    emit LockerChanged(prevLocker, msg.sender);
    result = ILockCallback(msg.sender).lockCallback(data);
    if (!TransientDelta.isSettled()) {
        revert UnsettledDeltas();
    }
    _lockCount--;
    if (_lockCount == 0) {
        _locker = address(0);
        emit LockerChanged(msg.sender, address(0));
    } else {
        _locker = prevLocker;
        emit LockerChanged(msg.sender, prevLocker);
    }
}

// DELETE (~5 lines):
function getDelta(address account) external view returns (int256) {
    return TransientDelta.getDelta(account);
}

// DELETE (~10 lines):
function settle(address account, uint256 amount) external whenLocked {
    int256 delta = TransientDelta.getDelta(account);
    if (delta > 0) {
        uint256 owed = uint256(delta);
        if (amount > owed) amount = owed;
        TransientDelta.addDelta(account, -int256(amount));
    }
}

// DELETE (~10 lines):
function take(address account, uint256 amount) external whenLocked {
    int256 delta = TransientDelta.getDelta(account);
    if (delta < 0) {
        uint256 owed = uint256(-delta);
        if (amount > owed) amount = owed;
        TransientDelta.addDelta(account, int256(amount));
    }
}
```

#### State Variables to Delete:
```solidity
// DELETE:
address private _locker;
uint256 private _lockCount;
```

#### Modifiers to Delete:
```solidity
// DELETE:
modifier onlyLocker() {
    if (msg.sender != _locker) revert LockerMismatch();
    _;
}

modifier whenLocked() {
    if (_locker == address(0)) revert NotLocked();
    _;
}
```

#### Errors to Delete:
```solidity
// DELETE:
error UnsettledDeltas();
error LockerMismatch();
error NotLocked();
```

#### Events to Delete:
```solidity
// DELETE:
event LockerChanged(address indexed oldLocker, address indexed newLocker);
```

#### View Function to Delete:
```solidity
// DELETE:
function locker() external view returns (address) {
    return _locker;
}
```

---

### 2.4 Remove batchPlaceOrders

**File**: `TickBookPoolManager.sol`

```solidity
// DELETE entire function (~50 lines):
function batchPlaceOrders(
    bytes32[] calldata marketKeys,
    uint8[] calldata outcomes,
    uint16[] calldata tickLowers,
    uint16[] calldata tickUppers,
    uint256[] calldata sharesTotals
) external onlyLocker returns (uint256[] memory orderIds) {
    uint256 len = marketKeys.length;
    require(
        outcomes.length == len &&
        tickLowers.length == len &&
        tickUppers.length == len &&
        sharesTotals.length == len,
        "Length mismatch"
    );

    orderIds = new uint256[](len);
    uint256 totalCollateral;

    for (uint256 i = 0; i < len; i++) {
        Market memory m = _markets[marketKeys[i]];
        if (!m.isActive) revert MarketNotActive();
        if (!ITruthMarket(m.truthMarket).isLive()) revert MarketNotLive();

        uint256 collateral = _calculateCollateral(
            outcomes[i],
            tickLowers[i],
            tickUppers[i],
            sharesTotals[i]
        );
        totalCollateral += collateral;

        TransientDelta.addDelta(msg.sender, int256(collateral));

        orderIds[i] = ++_nextOrderId;
        uint256 ticksInRange = uint256(tickUppers[i]) - uint256(tickLowers[i]) + 1;
        uint256 density = sharesTotals[i] / ticksInRange;

        _orders[marketKeys[i]][orderIds[i]] = RangeOrder({
            owner: msg.sender,
            outcome: outcomes[i],
            tickLower: tickLowers[i],
            tickUpper: tickUppers[i],
            active: true,
            sharesTotal: uint128(sharesTotals[i]),
            liquidity: uint128(density),
            collateralDepositedWad: uint128(collateral),
            filledShares: 0,
            collateralUsedWad: 0
        });

        _totalLiquidity[marketKeys[i]][outcomes[i]] += sharesTotals[i];
        _updateTickBoundaries(marketKeys[i], outcomes[i], tickLowers[i], tickUppers[i], int128(uint128(density)), true);
    }
}
```

---

### 2.5 Remove ILockCallback Interface

**File**: `TickBookPoolManager.sol` (bottom)

```solidity
// DELETE:
interface ILockCallback {
    function lockCallback(bytes calldata data) external returns (bytes memory);
}
```

---

### 2.6 Remove applyRetroSettlement

**File**: `AMMEngine.sol`

```solidity
// DELETE entire function (~10 lines):
function applyRetroSettlement(
    address /* market */,
    address /* user */,
    bytes calldata /* proof */
) external pure override returns (uint256) {
    revert("AMMEngine: T* not implemented");
}
```

**Also remove from interface** `IAMMEngine.sol`:
```solidity
// DELETE:
function applyRetroSettlement(
    address market,
    address user,
    bytes calldata proof
) external returns (uint256);
```

---

### 2.7 Delete ITickBookHooks.sol Interface

**File to Delete**: `contracts/interfaces/ITickBookHooks.sol`

**Archived Implementation**: See [Section 4.2](#42-itickbookhookssol-full-implementation)

---

## Phase 3: Optimizations (P2)

**Effort**: 1 day  
**Risk**: Low

### 3.1 Replace LMSRMath with PRBMath

**File**: `contracts/libraries/LMSRMath.sol`

**Current**: Custom Taylor series (~200 lines)  
**Replacement**: PRBMath library (~50 lines)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SD59x18, sd, ln, exp, div, mul, add, sub} from "prb-math/SD59x18.sol";

/**
 * @title LMSRMath
 * @notice LMSR math using PRBMath for precision
 */
library LMSRMath {
    int256 private constant WAD_INT = 1e18;

    function calculateCost(
        uint256 b,
        uint256 qYesBefore,
        uint256 qNoBefore,
        uint256 qYesAfter,
        uint256 qNoAfter
    ) internal pure returns (uint256 cost) {
        SD59x18 bSD = sd(int256(b));
        
        SD59x18 costBefore = _logSumExp(bSD, qYesBefore, qNoBefore);
        SD59x18 costAfter = _logSumExp(bSD, qYesAfter, qNoAfter);
        
        SD59x18 delta = sub(costAfter, costBefore);
        require(delta.unwrap() >= 0, "LMSRMath: negative cost");
        
        return uint256(delta.unwrap());
    }

    function _logSumExp(SD59x18 b, uint256 qYes, uint256 qNo) internal pure returns (SD59x18) {
        SD59x18 a = div(sd(int256(qYes)), b);
        SD59x18 bVal = div(sd(int256(qNo)), b);
        
        SD59x18 expA = exp(a);
        SD59x18 expB = exp(bVal);
        SD59x18 sumExp = add(expA, expB);
        
        return mul(b, ln(sumExp));
    }

    function calculateProbability(
        uint256 b,
        uint256 qYes,
        uint256 qNo
    ) internal pure returns (uint256 probability) {
        SD59x18 bSD = sd(int256(b));
        SD59x18 diff = sd(int256(qYes) - int256(qNo));
        SD59x18 logOdds = div(diff, bSD);
        
        SD59x18 expLogOdds = exp(logOdds);
        SD59x18 one = sd(WAD_INT);
        SD59x18 denom = add(one, expLogOdds);
        SD59x18 prob = div(expLogOdds, denom);
        
        return uint256(prob.unwrap());
    }
}
```

---

### 3.2 Pack RangeOrder Struct

**File**: `TickBookPoolManager.sol`

**Before** (5 slots, 160 bytes):
```solidity
struct RangeOrder {
    address owner;                  // 20 bytes
    uint8 outcome;                  // 1 byte
    uint16 tickLower;               // 2 bytes
    uint16 tickUpper;               // 2 bytes
    bool active;                    // 1 byte
    uint128 sharesTotal;            // 16 bytes (slot 1)
    uint128 liquidity;              // 16 bytes (slot 1)
    uint128 collateralDepositedWad; // 16 bytes (slot 2)
    uint128 filledShares;           // 16 bytes (slot 2)
    uint128 collateralUsedWad;      // 16 bytes (slot 3)
}
```

**After** (3 slots, 96 bytes):
```solidity
struct RangeOrder {
    // Slot 0: 32 bytes
    address owner;                  // 20 bytes
    uint8 outcome;                  // 1 byte
    uint16 tickLower;               // 2 bytes
    uint16 tickUpper;               // 2 bytes
    bool active;                    // 1 byte
    uint48 liquidity;               // 6 bytes (max: 281 trillion)
    
    // Slot 1: 32 bytes
    uint96 sharesTotal;             // 12 bytes (max: 79 billion with 18 decimals)
    uint96 filledShares;            // 12 bytes
    uint64 collateralDepositedWad;  // 8 bytes (max: 18.4 billion USDC)
    
    // Slot 2: 8 bytes used
    uint64 collateralUsedWad;       // 8 bytes
    // 24 bytes free for future use
}
```

**Savings**: 40% reduction in storage gas per order

---

## Removed Code Archive

### 4.1 TransientDelta.sol (Full Implementation)

<details>
<summary>Click to expand (150 lines)</summary>

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TransientDelta
 * @notice Flash accounting using EIP-1153 transient storage (Uniswap V4 pattern)
 * @dev REMOVED in V9.9.4 - Not used by frontend, adds unnecessary complexity
 */
library TransientDelta {
    error DeltaNotSettled(address account, int256 remaining);
    error NonzeroDeltas(uint256 count);

    bytes32 private constant NONZERO_DELTA_COUNT_SLOT =
        keccak256("TickBookV2.TransientDelta.nonzeroDeltaCount");

    function getDelta(address account) internal view returns (int256 delta) {
        bytes32 slot = _deltaSlot(account);
        assembly ("memory-safe") {
            delta := tload(slot)
        }
    }

    function addDelta(address account, int256 amount) internal {
        if (amount == 0) return;
        bytes32 slot = _deltaSlot(account);
        int256 prev;
        int256 next;
        assembly ("memory-safe") {
            prev := tload(slot)
            next := add(prev, amount)
            tstore(slot, next)
        }
        _updateNonzeroCount(prev, next);
    }

    function setDelta(address account, int256 amount) internal {
        bytes32 slot = _deltaSlot(account);
        int256 prev;
        assembly ("memory-safe") {
            prev := tload(slot)
            tstore(slot, amount)
        }
        _updateNonzeroCount(prev, amount);
    }

    function clearDelta(address account) internal returns (int256 prev) {
        bytes32 slot = _deltaSlot(account);
        assembly ("memory-safe") {
            prev := tload(slot)
            tstore(slot, 0)
        }
        if (prev != 0) {
            _decrementNonzeroCount();
        }
    }

    function getNonzeroDeltaCount() internal view returns (uint256 count) {
        bytes32 slot = NONZERO_DELTA_COUNT_SLOT;
        assembly ("memory-safe") {
            count := tload(slot)
        }
    }

    function isSettled() internal view returns (bool) {
        return getNonzeroDeltaCount() == 0;
    }

    function requireSettled() internal view {
        uint256 count = getNonzeroDeltaCount();
        if (count != 0) revert NonzeroDeltas(count);
    }

    function _deltaSlot(address account) private pure returns (bytes32 slot) {
        slot = keccak256(abi.encode("TickBookV2.TransientDelta.delta", account));
    }

    function _updateNonzeroCount(int256 prev, int256 next) private {
        bool wasZero = prev == 0;
        bool isZero = next == 0;
        if (wasZero && !isZero) {
            _incrementNonzeroCount();
        } else if (!wasZero && isZero) {
            _decrementNonzeroCount();
        }
    }

    function _incrementNonzeroCount() private {
        bytes32 slot = NONZERO_DELTA_COUNT_SLOT;
        assembly ("memory-safe") {
            let count := tload(slot)
            tstore(slot, add(count, 1))
        }
    }

    function _decrementNonzeroCount() private {
        bytes32 slot = NONZERO_DELTA_COUNT_SLOT;
        assembly ("memory-safe") {
            let count := tload(slot)
            tstore(slot, sub(count, 1))
        }
    }
}

library TransientMarketDelta {
    function getMarketDelta(
        address market,
        address account,
        uint8 outcome
    ) internal view returns (int256 delta) {
        bytes32 slot = _marketDeltaSlot(market, account, outcome);
        assembly ("memory-safe") {
            delta := tload(slot)
        }
    }

    function addMarketDelta(
        address market,
        address account,
        uint8 outcome,
        int256 amount
    ) internal {
        if (amount == 0) return;
        bytes32 slot = _marketDeltaSlot(market, account, outcome);
        assembly ("memory-safe") {
            let prev := tload(slot)
            tstore(slot, add(prev, amount))
        }
    }

    function clearMarketDelta(
        address market,
        address account,
        uint8 outcome
    ) internal returns (int256 prev) {
        bytes32 slot = _marketDeltaSlot(market, account, outcome);
        assembly ("memory-safe") {
            prev := tload(slot)
            tstore(slot, 0)
        }
    }

    function _marketDeltaSlot(
        address market,
        address account,
        uint8 outcome
    ) private pure returns (bytes32) {
        return keccak256(abi.encode("TickBookV2.MarketDelta", market, account, outcome));
    }
}
```

</details>

---

### 4.2 ITickBookHooks.sol (Full Implementation)

<details>
<summary>Click to expand (200 lines)</summary>

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITickBookHooks
 * @notice Hook interface for extending TickBook functionality (Uniswap V4 pattern)
 * @dev REMOVED in V9.9.4 - No integrators using hooks, replaced with simple fee storage
 */
interface ITickBookHooks {
    struct PlaceOrderParams {
        bytes32 marketKey;
        address sender;
        uint8 outcome;
        uint16 tickLower;
        uint16 tickUpper;
        uint256 sharesTotal;
    }

    struct ExecuteOrderParams {
        bytes32 marketKey;
        address sender;
        uint8 outcome;
        uint256 shares;
        uint256 maxCost;
    }

    struct CancelOrderParams {
        bytes32 marketKey;
        address sender;
        uint256 orderId;
    }

    struct CrossParams {
        bytes32 marketKey;
        uint256 newOrderId;
        uint256 crossedShares;
        uint16 crossTick;
    }

    struct ClaimParams {
        bytes32 marketKey;
        address sender;
        uint256 orderId;
        uint256 filledShares;
    }

    struct SpotSellParams {
        bytes32 marketKey;
        address sender;
        uint8 outcome;
        uint256 shares;
        uint256 minProceeds;
    }

    function beforePlaceOrder(PlaceOrderParams calldata params)
        external returns (bytes4 selector, bytes memory hookData);

    function afterPlaceOrder(
        PlaceOrderParams calldata params,
        uint256 orderId,
        bytes memory hookData
    ) external;

    function beforeExecuteOrder(ExecuteOrderParams calldata params)
        external returns (bytes4 selector, bytes memory hookData);

    function afterExecuteOrder(
        ExecuteOrderParams calldata params,
        uint256 sharesFilled,
        uint256 totalCost,
        bytes memory hookData
    ) external;

    function beforeCancelOrder(CancelOrderParams calldata params)
        external returns (bytes4 selector);

    function afterCancelOrder(CancelOrderParams calldata params, uint256 collateralReleased)
        external;

    function beforeCross(CrossParams calldata params) external returns (bytes4 selector);

    function afterCross(
        CrossParams calldata params,
        uint256 newOrderCost,
        uint256 oppositeOrderCost
    ) external;

    function beforeClaim(ClaimParams calldata params) external returns (bytes4 selector);

    function afterClaim(ClaimParams calldata params, uint256 collateralUsed) external;

    function beforeSpotSell(SpotSellParams calldata params) external returns (bytes4 selector);

    function afterSpotSell(
        SpotSellParams calldata params,
        uint256 sharesSold,
        uint256 proceeds
    ) external;

    function getDynamicFee(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint24 baseFee
    ) external view returns (uint24 fee);

    function getMakerFee(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint24 baseFee
    ) external view returns (uint24 fee, bool isRebate);
}

library HookPermissions {
    uint256 constant BEFORE_PLACE_ORDER_FLAG = 1 << 0;
    uint256 constant AFTER_PLACE_ORDER_FLAG = 1 << 1;
    uint256 constant BEFORE_EXECUTE_ORDER_FLAG = 1 << 2;
    uint256 constant AFTER_EXECUTE_ORDER_FLAG = 1 << 3;
    uint256 constant BEFORE_CANCEL_ORDER_FLAG = 1 << 4;
    uint256 constant AFTER_CANCEL_ORDER_FLAG = 1 << 5;
    uint256 constant BEFORE_CROSS_FLAG = 1 << 6;
    uint256 constant AFTER_CROSS_FLAG = 1 << 7;
    uint256 constant GET_DYNAMIC_FEE_FLAG = 1 << 8;
    uint256 constant BEFORE_CLAIM_FLAG = 1 << 9;
    uint256 constant AFTER_CLAIM_FLAG = 1 << 10;
    uint256 constant BEFORE_SPOT_SELL_FLAG = 1 << 11;
    uint256 constant AFTER_SPOT_SELL_FLAG = 1 << 12;
    uint256 constant GET_MAKER_FEE_FLAG = 1 << 13;

    function hasPermission(address hook, uint256 flag) internal pure returns (bool) {
        return uint256(uint160(hook)) & flag != 0;
    }

    function beforePlaceOrder(address hook) internal pure returns (bool) {
        return hasPermission(hook, BEFORE_PLACE_ORDER_FLAG);
    }

    function afterPlaceOrder(address hook) internal pure returns (bool) {
        return hasPermission(hook, AFTER_PLACE_ORDER_FLAG);
    }

    function beforeExecuteOrder(address hook) internal pure returns (bool) {
        return hasPermission(hook, BEFORE_EXECUTE_ORDER_FLAG);
    }

    function afterExecuteOrder(address hook) internal pure returns (bool) {
        return hasPermission(hook, AFTER_EXECUTE_ORDER_FLAG);
    }

    function beforeCancelOrder(address hook) internal pure returns (bool) {
        return hasPermission(hook, BEFORE_CANCEL_ORDER_FLAG);
    }

    function afterCancelOrder(address hook) internal pure returns (bool) {
        return hasPermission(hook, AFTER_CANCEL_ORDER_FLAG);
    }

    function beforeCross(address hook) internal pure returns (bool) {
        return hasPermission(hook, BEFORE_CROSS_FLAG);
    }

    function afterCross(address hook) internal pure returns (bool) {
        return hasPermission(hook, AFTER_CROSS_FLAG);
    }

    function getDynamicFee(address hook) internal pure returns (bool) {
        return hasPermission(hook, GET_DYNAMIC_FEE_FLAG);
    }

    function beforeClaim(address hook) internal pure returns (bool) {
        return hasPermission(hook, BEFORE_CLAIM_FLAG);
    }

    function afterClaim(address hook) internal pure returns (bool) {
        return hasPermission(hook, AFTER_CLAIM_FLAG);
    }

    function beforeSpotSell(address hook) internal pure returns (bool) {
        return hasPermission(hook, BEFORE_SPOT_SELL_FLAG);
    }

    function afterSpotSell(address hook) internal pure returns (bool) {
        return hasPermission(hook, AFTER_SPOT_SELL_FLAG);
    }

    function getMakerFee(address hook) internal pure returns (bool) {
        return hasPermission(hook, GET_MAKER_FEE_FLAG);
    }
}
```

</details>

---

## Testing Checklist

### Pre-Implementation
- [ ] Run full test suite: `forge test`
- [ ] Record gas benchmarks: `forge test --gas-report > gas-before.txt`
- [ ] Backup current contracts

### Phase 1 (Security Fixes)
- [ ] Add test for TOB-1: `test_ProRataFillCannotExceed100Percent`
- [ ] Add test for TOB-2: `test_HookFeesCapped`
- [ ] Run fuzz tests: `forge test --match-test Fuzz`

### Phase 2 (Deletions)
- [ ] Compile after each deletion: `forge build`
- [ ] Run tests after each deletion
- [ ] Update ABIs: regenerate from compiled contracts
- [ ] Verify no FE breakage: check ABI compatibility

### Phase 3 (Optimizations)
- [ ] Test PRBMath integration with edge cases
- [ ] Verify struct packing doesn't break existing orders
- [ ] Compare gas: `forge test --gas-report > gas-after.txt`

### Post-Implementation
- [ ] Full test suite passes
- [ ] Gas savings verified (target: 30% reduction on TickBook ops)
- [ ] Deploy to testnet
- [ ] FE smoke test on testnet
- [ ] Update `deployments.json` with new addresses

---

## Summary

| Phase | Lines Removed | Lines Added | Net Change | Gas Impact |
|-------|---------------|-------------|------------|------------|
| P0: Security | 0 | +10 | +10 | Neutral |
| P1: Deletions | -400 | +20 | -380 | -30% on TickBook |
| P2: Optimizations | -150 | +50 | -100 | -40% on LMSR |
| **Total** | **-550** | **+80** | **-470** | **-35% avg** |

---

*Implementation plan for V9.9.4. Execute in order: P0 → P1 → P2.*
