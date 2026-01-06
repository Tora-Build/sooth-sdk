# V10 Unit Tests

**Date**: 2026-01-06  
**Version**: V10.0.0  
**Read Time**: 10 mins

---

## Overview

Unit tests verify individual contracts in isolation. V10 adds significant unit tests for the unified tick storage and spot sell functionality.

---

## Test Files

| File | Tests | Focus |
|------|-------|-------|
| `TruthMarket.t.sol` | 25 | Market lifecycle |
| `UnifiedCrossing.t.sol` | 14 | V10 crossing |
| `SpotSell.t.sol` | 3 | Spot sell repro |

---

## TruthMarket Unit Tests

**Location**: `test/unit/TruthMarket.t.sol`

### Constructor Tests

```solidity
function test_Constructor_SetsCorrectValues() public view {
    assertEq(market.question(), QUESTION);
    assertEq(market.deadline(), deadline);
    assertEq(market.creator(), creator);
    assertEq(market.adjudicator(), adjudicator);
    assertEq(market.guardian(), guardian);
    assertEq(uint8(market.state()), 0); // CREATED
}

function test_Constructor_RevertWhenDeadlineInPast() public {
    vm.expectRevert("TruthMarket: deadline in past");
    new TruthMarket(QUESTION, uint64(block.timestamp - 1), adjudicator, guardian);
}
```

### Activation Tests

```solidity
function test_Activate_Success() public {
    vm.prank(creator);
    market.activate();
    assertEq(uint8(market.state()), 1); // LIVE
    assertTrue(market.isLive());
}

function test_Activate_RevertWhenNotCreator() public {
    vm.prank(randomUser);
    vm.expectRevert("TruthMarket: not creator");
    market.activate();
}
```

### Settlement Tests

```solidity
function test_Settle_YESWins() public {
    vm.prank(creator);
    market.activate();
    
    vm.prank(adjudicator);
    market.settle(1, 0); // YES = 1
    
    assertTrue(market.isSettled());
    assertEq(market.winningOutcome(), 1);
}

function test_Settle_INVALIDWins() public {
    // ... settle with outcome = 2
    assertEq(market.getRedemptionValue(0), 0.5e18); // 50% each
    assertEq(market.getRedemptionValue(1), 0.5e18);
}
```

### Veto Tests

```solidity
function test_Veto_Success() public {
    // Activate -> Settle -> Veto
    vm.prank(guardian);
    market.veto();
    
    assertTrue(market.isSettling());
    assertEq(market.winningOutcome(), 0); // Reset
}
```

### Full Lifecycle Test

```solidity
function test_FullLifecycle_HappyPath() public {
    // CREATED -> LIVE -> SETTLING -> SETTLED -> FINALIZED
    assertEq(uint8(market.state()), 0);
    
    vm.prank(creator);
    market.activate();
    assertTrue(market.isLive());
    
    vm.warp(deadline + 1);
    assertTrue(market.isSettling());
    
    vm.prank(adjudicator);
    market.settle(1, 0);
    assertTrue(market.isSettled());
    
    vm.prank(guardian);
    market.finalize();
    assertTrue(market.isFinalized());
    
    assertEq(market.getRedemptionValue(1), 1e18);
}
```

---

## V10 Spot Sell Unit Tests

**Location**: `test/repro/SpotSell.t.sol`

### Place Spot Sell

```solidity
function test_PlaceSpotSell_Works() public {
    // Fund Alice with YES shares
    vm.prank(address(poolManager));
    vault.creditOutcome(address(market), alice, 1, 1000e18);
    
    vm.startPrank(alice);
    uint256 sellId = poolManager.placeSpotSell(
        marketKey,
        1,          // YES outcome
        500e18,     // shares
        600,        // tickLower
        600         // tickUpper
    );
    vm.stopPrank();
    
    assertGt(sellId, 0, "Sell ID should be created");
    
    // Verify shares are locked
    (uint256 aliceYes, ) = vault.getInternalOutcomes(address(market), alice);
    assertEq(aliceYes, 500e18, "500 available, 500 locked");
}
```

### Unified Crossing

```solidity
function test_Unified_PlaceOrderCrossesSpotSell() public {
    // 1. Alice places Spot Sell for YES at tick 600
    vm.prank(alice);
    poolManager.placeSpotSell(marketKey, 1, 500e18, 600, 600);
    
    // 2. Bob places regular BUY Limit Order for YES at tick 600
    vm.prank(bob);
    (uint256 orderId, uint256 filledShares, , ) = poolManager.placeOrder(
        marketKey,
        1,          // YES
        500e18,     // shares
        600,        // tickLower
        600,        // tickUpper
        310e18      // maxCost
    );
    
    // 3. Verify CROSSING occurred (V10)
    assertGt(filledShares, 0, "Should cross with Spot Sell in V10");
}
```

### Explicit Buy From Spot

```solidity
function test_BuyFromSpotSell_ExplicitlyWorks() public {
    // 1. Alice places Spot Sell
    vm.prank(alice);
    uint256 sellId = poolManager.placeSpotSell(marketKey, 1, 500e18, 600, 600);
    
    // 2. Bob calls explicit buyFromSpotSell
    vm.prank(bob);
    uint256 cost = poolManager.buyFromSpotSell(
        marketKey,
        sellId,
        100e18,     // buy 100 shares
        65e18       // max cost
    );
    
    assertGt(cost, 0, "Cost should be > 0");
    
    // 3. Verify shares transferred
    (uint256 bobYes, ) = vault.getInternalOutcomes(address(market), bob);
    assertEq(bobYes, 100e18, "Bob should have 100 YES shares");
}
```

---

## V10 Tick Liquidity Unit Tests

**Location**: `test/crossing/UnifiedCrossing.t.sol`

### Tick Liquidity Updates

```solidity
function test_SpotSellUpdatesTickLiquidity() public {
    // Initial: no spot liquidity
    (, , uint128 spotLiqBefore) = poolManager.getTickLiquidity(marketKey, 1, 500);
    assertEq(spotLiqBefore, 0);
    
    // Place spot sell across 3 ticks
    vm.prank(alice);
    poolManager.placeSpotSell(marketKey, 1, 300e18, 500, 502);
    
    // Verify liquidity at each tick (100e18 per tick)
    (, , uint128 spotLiq500) = poolManager.getTickLiquidity(marketKey, 1, 500);
    (, , uint128 spotLiq501) = poolManager.getTickLiquidity(marketKey, 1, 501);
    (, , uint128 spotLiq502) = poolManager.getTickLiquidity(marketKey, 1, 502);
    
    assertEq(spotLiq500, 100e18);
    assertEq(spotLiq501, 100e18);
    assertEq(spotLiq502, 100e18);
}
```

### Bitmap Updates

```solidity
function test_SpotSellBitmapUpdated() public {
    // Place spot sell
    vm.prank(alice);
    uint256 sellId = poolManager.placeSpotSell(marketKey, 1, 100e18, 500, 500);
    
    // Verify spot liquidity exists
    uint128 spotLiq = poolManager.getSpotSellLiquidity(marketKey, 1, 500);
    assertEq(spotLiq, 100e18);
    
    // Cancel the spot sell
    vm.prank(alice);
    poolManager.cancelSpotSell(marketKey, sellId);
    
    // Verify spot liquidity removed
    uint128 spotLiqAfter = poolManager.getSpotSellLiquidity(marketKey, 1, 500);
    assertEq(spotLiqAfter, 0);
}
```

### Multiple Spot Sells Accumulate

```solidity
function test_MultipleSpotSellsAccumulate() public {
    // First spot sell
    vm.prank(alice);
    poolManager.placeSpotSell(marketKey, 1, 100e18, 500, 500);
    
    // Second spot sell at same tick
    _fundAliceWithYesShares(200e18);
    vm.prank(alice);
    poolManager.placeSpotSell(marketKey, 1, 150e18, 500, 500);
    
    // Verify accumulation
    uint128 spotLiq = poolManager.getSpotSellLiquidity(marketKey, 1, 500);
    assertEq(spotLiq, 250e18, "Spot liquidity should accumulate");
}
```

### Partial Fill Reduces Liquidity

```solidity
function test_PartialSpotFillReducesTickLiquidity() public {
    vm.prank(alice);
    uint256 sellId = poolManager.placeSpotSell(marketKey, 1, 500e18, 500, 500);
    
    assertEq(poolManager.getSpotSellLiquidity(marketKey, 1, 500), 500e18);
    
    // Bob buys partial
    vm.prank(bob);
    poolManager.buyFromSpotSell(marketKey, sellId, 200e18, 150e18);
    
    // Verify reduction
    assertEq(poolManager.getSpotSellLiquidity(marketKey, 1, 500), 300e18);
}
```

---

## Writing New Unit Tests

### Test Template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManager} from "@core/TickBookPoolManager.sol";
// ... other imports

contract MyFeatureTest is Test {
    // State variables
    TickBookPoolManager public poolManager;
    // ...
    
    function setUp() public {
        // Deploy contracts
        // Fund test accounts
        // Register market
    }
    
    function test_Feature_HappyPath() public {
        // Arrange
        // Act
        // Assert
    }
    
    function test_Feature_RevertWhenInvalidInput() public {
        vm.expectRevert("Expected error message");
        // Action that should revert
    }
    
    function testFuzz_Feature_RandomInputs(uint256 amount) public {
        amount = bound(amount, 1e18, 1000000e18);
        // Test with bounded random input
    }
}
```

### Best Practices

1. **One assertion per test** (when practical)
2. **Use descriptive names**: `test_Feature_RevertWhenCondition`
3. **Test edge cases**: zero, max, boundary values
4. **Test reverts**: use `vm.expectRevert`
5. **Test events**: use `vm.expectEmit`

---

## Test Helpers

### Common Setup Pattern

```solidity
function _fundAliceWithYesShares(uint256 amount) internal {
    vm.prank(address(poolManager));
    vault.creditOutcome(address(market), alice, 1, amount);
}

function _fundBobWithUsdc(uint256 amount) internal {
    usdc.mint(bob, amount);
    vm.prank(bob);
    usdc.approve(address(vault), type(uint256).max);
    vm.prank(bob);
    vault.depositUsdc(amount);
}
```

---

## Next Steps

- **[03-INTEGRATION-TESTS.md](./03-INTEGRATION-TESTS.md)** - Cross-contract flows
- **[04-FUZZ-INVARIANTS.md](./04-FUZZ-INVARIANTS.md)** - Property-based testing
