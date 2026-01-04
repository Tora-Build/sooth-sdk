# Unit Tests — Contract-Level Testing

**Status**: 60 unit tests passing ✅  
**Focus**: Individual contract behavior, isolated from others

---

## 📋 Test Files by Contract

### TickBookPoolManager.t.sol (35 tests)
```solidity
function testRegisterMarket() — Market registration
function testPlaceMarketOrder() — Fill-everything orders
function testPlaceLimitOrder() — Single-tick resting orders
function testPlaceRangeOrder() — Concentrated liquidity
function testAutoClaimOnNewOrder() — V9.9.6 auto-claim
function testCancelOrder() — Order cancellation
function testClaimFills() — Fill settlement
function testBitmapDiscovery() — O(1) tick lookup
function testTickCrossing() — Crossing logic (fix6)
function testActiveLiquidityUnderflow() — Fix1 regression
function testArrayOverflow() — Fix2-3 regression
... (25+ more)
```

### TruthMarketLifecycle.t.sol (15 tests)
```solidity
function testCreate() — Market creation
function testActivate() — Enable trading
function testSettle() — Outcome determination
function testVeto() — Guardian veto
function testFinalize() — Lock settlement
function testSettleWithTStar() — Retroactive time
function testGuardianVetoWindow() — 48h veto period
... (8+ more)
```

### Other Unit Tests (10 tests)
- Collateralizer.t.sol — Split, merge, redeem
- ActiveLiquidityUnderflow.t.sol — Fix1 regression (8 tests)

---

## ✍️ Writing Unit Tests

### Template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ITickBook} from "@core/interfaces/ITickBook.sol";

contract MyFeatureTest is Test {
    ITickBook tickBook;
    address user = address(0x1);
    address market = address(0x2);
    bytes32 marketKey;
    
    function setUp() public {
        // Deploy or get reference to contracts
        // Setup initial state (users, balances, markets)
    }
    
    function testHappyPath() public {
        // Arrange: Setup preconditions
        vm.startPrank(user);
        
        // Act: Execute the function
        uint256 result = tickBook.someFunction(...);
        
        // Assert: Verify expected behavior
        assertEq(result, expectedValue);
    }
    
    function testEdgeCase() public {
        // Test boundary conditions
        vm.expectRevert("Error message");
        tickBook.failingFunction(...);
    }
}
```

---

## 🎯 Test Categories

### 1. Happy Path Tests
**Purpose**: Verify normal operation  
**Pattern**: Setup → Call → Assert

```solidity
function testPlaceAndClaimOrder() public {
    vm.startPrank(user);
    yesToken.approve(address(tickBook), 1000e18);
    
    (uint256 orderId, uint256 filled, uint256 cost, ) = tickBook.placeOrder(
        marketKey, 1, 1000e18, 1, 999, 1500e18
    );
    
    assertEq(filled, 1000e18);
    assertEq(cost, 500e18); // Approximately
    assertEq(tickBook.getOrder(orderId).filledShares, 1000e18);
}
```

---

### 2. Edge Case Tests
**Purpose**: Test boundaries, minimums, maximums  
**Pattern**: Setup boundary → Call → Assert

```solidity
function testZeroShares() public {
    vm.expectRevert("ZeroAmount");
    tickBook.placeOrder(marketKey, 1, 0, 500, 500, 0);
}

function testMinTick() public {
    (uint256 orderId, , , ) = tickBook.placeOrder(
        marketKey, 1, 100e18, 1, 1, 50e18  // Min tick (1)
    );
    assertGt(orderId, 0);
}

function testMaxTick() public {
    (uint256 orderId, , , ) = tickBook.placeOrder(
        marketKey, 1, 100e18, 999, 999, 99e18  // Max tick (999)
    );
    assertGt(orderId, 0);
}
```

---

### 3. Revert Tests
**Purpose**: Verify error handling  
**Pattern**: Setup invalid state → Call → Expect revert

```solidity
function testInvalidOutcome() public {
    vm.expectRevert("InvalidOutcome");
    tickBook.placeOrder(marketKey, 2, 100e18, 500, 500, 50e18);
}

function testMarketNotActive() public {
    vm.expectRevert("MarketNotActive");
    tickBook.placeOrder(inactiveMarket, 1, 100e18, 500, 500, 50e18);
}

function testInsufficientBalance() public {
    // Don't approve enough
    yesToken.approve(address(tickBook), 50e18);
    
    vm.expectRevert("InsufficientBalance");
    tickBook.placeOrder(marketKey, 1, 100e18, 500, 500, 50e18);
}
```

---

### 4. State Mutation Tests
**Purpose**: Verify state changes  
**Pattern**: Setup → Call → Assert state

```solidity
function testOrderStateUpdates() public {
    vm.startPrank(user);
    yesToken.approve(address(tickBook), 1000e18);
    
    (uint256 orderId, , , ) = tickBook.placeOrder(
        marketKey, 1, 1000e18, 500, 500, 500e18
    );
    
    ITickBook.RangeOrder memory order = tickBook.getOrder(orderId);
    assertEq(order.owner, user);
    assertEq(order.outcome, 1);
    assertEq(order.tickLower, 500);
    assertEq(order.tickUpper, 500);
    assertTrue(order.active);
    assertEq(order.sharesTotal, 1000e18);
}
```

---

### 5. Invariant Tests
**Purpose**: Verify properties always hold  
**Pattern**: Setup → Multiple operations → Assert invariant

```solidity
function testLiquidityConservation() public {
    // Get initial liquidity
    uint128 initialLiq = tickBook.getTotalLiquidity(marketKey, 1);
    
    // Place order
    tickBook.placeOrder(marketKey, 1, 100e18, 500, 500, 50e18);
    
    // Liquidity should increase
    uint128 afterLiq = tickBook.getTotalLiquidity(marketKey, 1);
    assertGt(afterLiq, initialLiq);
}
```

---

## 🧪 Common Test Patterns

### Pattern 1: Approval → Action → Assert
```solidity
function testApprovalRequired() public {
    vm.startPrank(user);
    
    // Approve tokens
    yesToken.approve(address(tickBook), 1000e18);
    
    // Place order
    (uint256 orderId, , , ) = tickBook.placeOrder(...);
    
    // Assert worked
    assertGt(orderId, 0);
}
```

---

### Pattern 2: Before → After Comparison
```solidity
function testBalanceChange() public {
    uint256 balanceBefore = yesToken.balanceOf(user);
    
    vm.startPrank(user);
    yesToken.approve(address(tickBook), 100e18);
    tickBook.placeOrder(...);
    
    uint256 balanceAfter = yesToken.balanceOf(user);
    assertEq(balanceAfter, balanceBefore - 100e18);
}
```

---

### Pattern 3: Time-Dependent (24h lock)
```solidity
function testCannotSellWithin24h() public {
    // Buy shares
    tickBook.buy(market, 1, 100e18, 150e18);
    
    // Try to sell immediately
    vm.expectRevert("24hLockNotElapsed");
    tickBook.sell(market, 1, 100e18, 50e18);
    
    // Wait 24h
    vm.warp(block.timestamp + 24 hours + 1);
    
    // Now can sell
    uint256 proceeds = tickBook.sell(market, 1, 100e18, 50e18);
    assertGt(proceeds, 0);
}
```

---

### Pattern 4: Access Control
```solidity
function testOnlyCreatorCanActivate() public {
    address market = launchpad.createMarket(...);
    
    // Non-creator tries to activate
    vm.startPrank(address(0x999));
    vm.expectRevert("NotCreator");
    truthMarket.activate();
    
    // Creator can activate
    vm.startPrank(creator);
    truthMarket.activate();
    assertTrue(truthMarket.isLive());
}
```

---

## 📝 Assertion Helpers

### Standard Assertions
```solidity
assertEq(actual, expected);           // Equality
assertGt(actual, expected);           // Greater than
assertLt(actual, expected);           // Less than
assertGe(actual, expected);           // Greater or equal
assertLe(actual, expected);           // Less or equal
assertTrue(condition);                // Boolean true
assertFalse(condition);               // Boolean false
```

### Custom Assertions
```solidity
function assertNear(uint256 a, uint256 b, uint256 tolerance) internal {
    uint256 diff = a > b ? a - b : b - a;
    assertLe(diff, tolerance);
}

// Usage
uint256 cost = tickBook.simulateCost(...);
uint256 actualCost = 500e18;
assertNear(cost, actualCost, 1e18);  // Within 1 USDC
```

---

## 🚀 Running Unit Tests Only

```bash
# All unit tests
forge test --match-path "*test/v9/*.t.sol" --skip "*fork*" --skip "*Fuzz*" --skip "*Invariant*"

# Specific contract
forge test --match-contract "TickBookPoolManager" -v

# Specific test
forge test --match-test "testPlaceMarketOrder" -vv

# With verbose output
forge test -vv  # Show logs
forge test -vvv # Show full trace
```

---

## ✅ Test Quality Checklist

For each new test:
- [ ] Has descriptive name (`test<Action><Condition><Result>`)
- [ ] Tests one thing (single assertion principle)
- [ ] Uses AAA pattern (Arrange, Act, Assert)
- [ ] Includes edge cases
- [ ] Documents why this test matters
- [ ] Passes locally before PR
- [ ] No flakiness (deterministic)
- [ ] Reasonable gas (< 1M for unit test)

---

## 🎯 Common Mistakes to Avoid

### ❌ Don't: Test implementation
```solidity
// Bad - tests internal function
function testInternalLiquidityCalculation() public {
    // Can't call _updateActiveLiquidity directly
}
```

### ✅ Do: Test behavior
```solidity
// Good - tests user-facing behavior
function testLiquidityUpdatesAfterOrder() public {
    uint128 before = tickBook.getTotalLiquidity(marketKey, 1);
    tickBook.placeOrder(...);
    uint128 after = tickBook.getTotalLiquidity(marketKey, 1);
    assertGt(after, before);
}
```

---

### ❌ Don't: Multiple assertions per test
```solidity
// Bad - multiple concerns
function testOrderBehavior() public {
    assertEq(order.filled, expected);
    assertEq(order.active, true);
    assertEq(order.owner, user);
    assertEq(order.cost, cost);  // 4 assertions!
}
```

### ✅ Do: One assertion per test (or related)
```solidity
// Good
function testOrderFilled() public {
    (uint256 orderId, uint256 filled, , ) = tickBook.placeOrder(...);
    assertEq(filled, expectedFilled);
}

function testOrderActiveAfterPlace() public {
    (uint256 orderId, , , ) = tickBook.placeOrder(...);
    assertTrue(tickBook.getOrder(orderId).active);
}
```

---

### ❌ Don't: Magic numbers
```solidity
// Bad - unclear why 500, 500, 250e18
function testTrade() public {
    tickBook.placeOrder(marketKey, 1, 500e18, 500, 500, 250e18);
}
```

### ✅ Do: Named constants
```solidity
// Good
uint256 constant ORDER_SIZE = 500e18;
uint16 constant LIMIT_PRICE = 500;  // 50%
uint256 constant MAX_COST = 250e18;

function testTrade() public {
    tickBook.placeOrder(marketKey, 1, ORDER_SIZE, LIMIT_PRICE, LIMIT_PRICE, MAX_COST);
}
```

---

## 📚 Resources

- **Foundry Docs**: https://book.getfoundry.sh/forge/tests
- **Test Examples**: [03-INTEGRATION-TESTS.md](./03-INTEGRATION-TESTS.md)
- **Interactive Testing**: [05-INTERACTIVE-CLI.md](./05-INTERACTIVE-CLI.md)

---

**Last Updated**: 2026-01-03  
**Tests Status**: 60/60 unit tests passing ✅
