# V10 Integration Tests

**Date**: 2026-01-06  
**Version**: V10.0.0  
**Read Time**: 10 mins

---

## Overview

Integration tests verify cross-contract interactions. V10's key integration scenarios focus on the unified crossing architecture and sell-side fee mechanics.

---

## Test Files

| File | Tests | Focus |
|------|-------|-------|
| `OrderSystem.t.sol` | 15 | Unified order API |
| `SellSideFee.t.sol` | 15 | Fee integration |
| `UnifiedCrossing.t.sol` | 14 | Crossing priority |

---

## Unified Crossing Integration

**Location**: `test/crossing/UnifiedCrossing.t.sol`

### Spot-First Priority

The core V10 test: when both spot and range liquidity exist, spot must be consumed first.

```solidity
function test_UnifiedCrossing_SpotFilledFirst() public {
    // Carol places range order (NO side - provides YES crossing)
    vm.prank(carol);
    poolManager.placeOrder(marketKey, 0, 500e18, 400, 600, 500e18);
    
    // Alice places spot sell (YES side - same price range)
    vm.prank(alice);
    uint256 spotSellId = poolManager.placeSpotSell(marketKey, 1, 200e18, 500, 500);
    
    // Verify both liquidity types exist
    (int128 rangeNet, uint128 rangeGross, ) = poolManager.getTickLiquidity(marketKey, 0, 400);
    assertGt(rangeGross, 0, "Range liquidity should exist");
    
    (, , uint128 spotLiq) = poolManager.getTickLiquidity(marketKey, 1, 500);
    assertEq(spotLiq, 200e18, "Spot liquidity should be 200e18");
    
    // Bob buys YES - should consume spot FIRST
    vm.prank(bob);
    poolManager.placeOrder(marketKey, 1, 150e18, 500, 500, 100e18);
    
    // Verify spot was filled (not range)
    TickBookPoolManager.SpotSellOrder memory spotOrder = 
        poolManager.getSpotSellOrder(marketKey, spotSellId);
    assertEq(spotOrder.sharesFilled, 150e18, "Spot should be filled first");
}
```

### Mixed Fill (Spot + Range)

```solidity
function test_UnifiedCrossing_MixedFill() public {
    // Carol: range order
    vm.prank(carol);
    poolManager.placeOrder(marketKey, 0, 500e18, 500, 600, 500e18);
    
    // Alice: smaller spot sell
    vm.prank(alice);
    uint256 spotSellId = poolManager.placeSpotSell(marketKey, 1, 100e18, 500, 600);
    
    // Bob buys 250 - should use 100 spot first, then 150 from range
    vm.prank(bob);
    poolManager.placeOrder(marketKey, 1, 250e18, 500, 600, 200e18);
    
    // Verify spot fully consumed
    TickBookPoolManager.SpotSellOrder memory spotOrder = 
        poolManager.getSpotSellOrder(marketKey, spotSellId);
    assertEq(spotOrder.sharesFilled, 100e18, "Spot should be fully filled");
    assertFalse(spotOrder.active, "Spot should be inactive");
}
```

### Manual Sequence (Explicit Spot-First)

```solidity
function test_UnifiedCrossing_SpotFirstManualSequence() public {
    // Setup liquidity
    vm.prank(carol);
    poolManager.placeOrder(marketKey, 0, 500e18, 500, 600, 500e18);
    
    vm.prank(alice);
    uint256 spotSellId = poolManager.placeSpotSell(marketKey, 1, 100e18, 550, 550);
    
    // Bob manually buys from spot FIRST
    vm.prank(bob);
    uint256 spotCost = poolManager.buyFromSpotSell(marketKey, spotSellId, 100e18, 70e18);
    assertGt(spotCost, 0);
    
    // Verify spot consumed
    TickBookPoolManager.SpotSellOrder memory spotOrder = 
        poolManager.getSpotSellOrder(marketKey, spotSellId);
    assertEq(spotOrder.sharesFilled, 100e18);
    assertFalse(spotOrder.active);
    
    // Bob places order for more (uses range)
    vm.prank(bob);
    poolManager.placeOrder(marketKey, 1, 200e18, 500, 600, 150e18);
    
    // Verify total received
    (uint256 bobYes, ) = vault.getInternalOutcomes(address(market), bob);
    assertGt(bobYes, 100e18, "Bob should have spot + range shares");
}
```

---

## Order System Integration

**Location**: `test/integration/OrderSystem.t.sol`

### Limit Order (Single Tick)

```solidity
function test_PlaceOrder_SingleTick_LimitOrder() public {
    vm.prank(alice);
    (uint256 orderId, uint256 filledShares, uint256 filledCost, uint256 restingShares) =
        poolManager.placeOrder(
            marketKey,
            1,          // YES
            1000e18,    // shares
            500,        // tickLower = 50%
            500,        // tickUpper = 50%
            600e18      // maxCost
        );
    
    assertGt(orderId, 0, "Order ID assigned");
    assertEq(filledShares, 0, "No crossing expected");
    assertEq(restingShares, 1000e18, "All shares resting");
}
```

### Crossing Order

```solidity
function test_PlaceOrder_SingleTick_WithCrossing() public {
    // Alice places NO at tick 500
    vm.prank(alice);
    poolManager.placeOrder(marketKey, 0, 1000e18, 500, 500, 600e18);
    
    // Bob places YES at tick 500 - should cross
    vm.prank(bob);
    (uint256 orderId, uint256 filledShares, , ) =
        poolManager.placeOrder(marketKey, 1, 1000e18, 500, 500, 600e18);
    
    assertGt(orderId, 0);
    assertGt(filledShares, 0, "Should have crossing fill");
}
```

### Market Order (Full Range)

```solidity
function test_PlaceOrder_FullRange_MarketOrder() public {
    // Setup liquidity
    vm.prank(alice);
    poolManager.placeOrder(marketKey, 0, 1000e18, 400, 600, 700e18);
    
    // Bob places full range "market order"
    vm.prank(bob);
    (uint256 orderId, , , ) = poolManager.placeOrder(
        marketKey,
        1,          // YES
        500e18,     // shares
        1,          // tickLower (min)
        999,        // tickUpper (max)
        600e18      // maxCost
    );
    
    assertGt(orderId, 0, "Market order created");
}
```

### Slippage Protection

```solidity
function test_PlaceOrder_RevertsOnSlippageExceeded() public {
    vm.prank(alice);
    vm.expectRevert(TickBookPoolManager.SlippageExceeded.selector);
    poolManager.placeOrder(
        marketKey,
        1,
        1000e18,
        500,
        500,
        100e18      // maxCost too low
    );
}
```

---

## Sell-Side Fee Integration

**Location**: `test/integration/SellSideFee.t.sol`

### Fee Deduction on Sell

```solidity
function test_SellYes_DeductsFeeFromProceeds() public {
    // 1. Buy YES shares
    vm.prank(trader);
    launchpad.tradePositions(address(market), YES, int256(50 * WAD), 100 * WAD);
    
    // 2. Get quote for selling
    (uint256 baseCost, ) = amm.getPositionQuote(address(market), YES, -int256(25 * WAD));
    uint256 expectedFee = (baseCost * PRE_GRAD_FEE_BPS) / BPS;
    uint256 expectedNetProceeds = baseCost - expectedFee;
    
    // 3. Sell YES shares
    vm.prank(trader);
    uint256 actualProceeds = launchpad.tradePositions(
        address(market), YES, -int256(25 * WAD), 0
    );
    
    // 4. Verify net proceeds
    assertEq(actualProceeds, expectedNetProceeds, "Proceeds should be net of fee");
    assertGt(baseCost, actualProceeds, "Base > Net");
}
```

### Fee Accumulation

```solidity
function test_SellFee_AccruesToMarket() public {
    vm.prank(trader);
    launchpad.tradePositions(address(market), YES, int256(100 * WAD), 200 * WAD);
    
    (,,,, uint256 feesBefore,,,,,,,) = launchpad.markets(address(market));
    
    vm.prank(trader);
    launchpad.tradePositions(address(market), YES, -int256(50 * WAD), 0);
    
    (,,,, uint256 feesAfter,,,,,,,) = launchpad.markets(address(market));
    
    assertGt(feesAfter, feesBefore, "Fees should increase after sell");
}
```

### Slippage on Net Proceeds

```solidity
function test_SellSlippage_ChecksNetProceeds() public {
    vm.prank(trader);
    launchpad.tradePositions(address(market), YES, int256(100 * WAD), 200 * WAD);
    
    (uint256 baseCost, ) = amm.getPositionQuote(address(market), YES, -int256(50 * WAD));
    uint256 netProceeds = baseCost - (baseCost * PRE_GRAD_FEE_BPS / BPS);
    
    // Should fail: minProceeds > netProceeds
    vm.prank(trader);
    vm.expectRevert("AMMEngine: slippage exceeded");
    launchpad.tradePositions(address(market), YES, -int256(50 * WAD), netProceeds + 1);
    
    // Should succeed: minProceeds == netProceeds
    vm.prank(trader);
    uint256 actual = launchpad.tradePositions(
        address(market), YES, -int256(50 * WAD), netProceeds
    );
    assertGe(actual, netProceeds);
}
```

---

## Full Lifecycle Integration

### Create -> Trade -> Settle -> Redeem

```solidity
function test_FullLifecycle() public {
    // 1. Create market via Launchpad
    vm.prank(deployer);
    launchpad.createMarket(address(market), 100e18, "TEST", "TST");
    
    // 2. Trade (buy YES)
    vm.prank(trader);
    launchpad.tradePositions(address(market), YES, int256(50e18), 100e18);
    
    // 3. Graduate (accumulate fees)
    // ... simulate trades until graduation threshold
    
    // 4. Settle market
    vm.warp(market.deadline() + 1);
    vm.prank(adjudicator);
    market.settle(1, 0); // YES wins
    
    vm.prank(guardian);
    market.finalize();
    
    // 5. Redeem
    (uint256 yesShares, ) = amm.getPosition(address(market), trader);
    vm.prank(trader);
    collateralizer.redeem(address(market), yesShares, yesShares);
    
    // 6. Verify payout
    assertGt(usdc.balanceOf(trader), 0);
}
```

---

## Gas Benchmarks

### Crossing Operations

```solidity
function test_PlaceOrder_GasBenchmark_NoExistingOrders() public {
    vm.prank(alice);
    uint256 gasBefore = gasleft();
    poolManager.placeOrder(marketKey, 1, 1000e18, 500, 500, 600e18);
    uint256 gasUsed = gasBefore - gasleft();
    
    emit log_named_uint("Gas used (no existing orders)", gasUsed);
    assertLt(gasUsed, 350_000, "Gas should be reasonable");
}

function test_PlaceOrder_GasBenchmark_With3ExistingOrders() public {
    vm.startPrank(alice);
    poolManager.placeOrder(marketKey, 1, 100e18, 400, 400, 100e18);
    poolManager.placeOrder(marketKey, 1, 100e18, 500, 500, 100e18);
    poolManager.placeOrder(marketKey, 1, 100e18, 600, 600, 100e18);
    
    uint256 gasBefore = gasleft();
    poolManager.placeOrder(marketKey, 1, 100e18, 700, 700, 100e18);
    uint256 gasUsed = gasBefore - gasleft();
    vm.stopPrank();
    
    emit log_named_uint("Gas used (3 existing orders)", gasUsed);
    assertLt(gasUsed, 350_000);
}
```

---

## Writing Integration Tests

### Template

```solidity
contract FeatureIntegrationTest is Test {
    // Full contract stack
    LaunchpadEngine launchpad;
    AMMEngine amm;
    TickBookPoolManager tickBook;
    // ...
    
    function setUp() public {
        // Deploy entire stack
        // Create and activate market
        // Fund test accounts
    }
    
    function test_Feature_EndToEnd() public {
        // 1. User action (buy/sell/order)
        // 2. Verify intermediate state
        // 3. Another action
        // 4. Verify final state
    }
}
```

---

## Next Steps

- **[04-FUZZ-INVARIANTS.md](./04-FUZZ-INVARIANTS.md)** - Property-based testing
- **[05-INTERACTIVE-CLI.md](./05-INTERACTIVE-CLI.md)** - Manual testing
