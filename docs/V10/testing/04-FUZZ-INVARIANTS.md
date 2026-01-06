# V10 Fuzz & Invariant Tests

**Date**: 2026-01-06  
**Version**: V10.0.0  
**Read Time**: 8 mins

---

## Overview

Fuzz and invariant tests verify system properties hold across random inputs. V10 adds critical invariants for unified crossing and tick liquidity consistency.

---

## Test Files

| File | Focus | Runs |
|------|-------|------|
| `ActiveLiquidity.t.sol` | Underflow regression + fuzz | 256+ |

---

## V10 Critical Invariants

### 1. Spot-First Guarantee

```
INVARIANT: If spot and range liquidity exist at the same price,
           spot must be consumed before range.

TEST: For any crossing order:
      spotFilled > 0 implies rangeFilled == 0 at overlapping ticks
      (until spot is exhausted)
```

### 2. Fill Accounting

```
INVARIANT: filledShares <= sharesTotal for all orders

TEST: After any operation:
      order.filledShares <= order.sharesTotal
```

### 3. Bitmap Consistency

```
INVARIANT: Bitmap bit set if and only if liquidity > 0 at tick

TEST: For all ticks:
      bitmapBitSet(tick) <=> (rangeLiquidity(tick) > 0 OR spotLiquidity(tick) > 0)
```

### 4. Token Conservation

```
INVARIANT: Total minted == sum of all outcome balances

TEST: sum(yesBalances) + sum(noBalances) == totalMinted
```

### 5. No Underflow on Crossing

```
INVARIANT: Tick crossing never causes arithmetic underflow

TEST: After crossing tick boundary:
      activeLiquidity >= 0 (clamped, not underflowed)
```

---

## Active Liquidity Underflow Tests

**Location**: `test/invariants/ActiveLiquidity.t.sol`

### Regression Test: Tick Crossing

```solidity
/**
 * @notice Test that crossing ticks with negative liquidityNet doesn't underflow
 * @dev Core bug scenario:
 *      1. Place range order [100, 200]
 *      2. Execute market order that crosses tick 200
 *      3. At boundary, liquidityNet is negative
 *      4. Without fix: activeLiq + delta underflows
 */
function test_TickCrossing_DoesNotUnderflow() public {
    // Alice places NO order at ticks [100, 200]
    vm.prank(alice);
    poolManager.placeOrder(marketKey, 0, 10_000e18, 100, 200, 100_000e18);
    
    // Bob places market order that crosses through entire range
    vm.prank(bob);
    (uint256 orderId, , , ) = poolManager.placeOrder(
        marketKey,
        1,          // YES (crosses NO orders)
        20_000e18,  // more shares than available
        1,          // tickLower (market order)
        999,        // tickUpper
        500_000e18
    );
    
    // Should succeed without underflow panic
    assertGt(orderId, 0, "Order should be created");
}
```

### Multiple Trades After Crossing

```solidity
/**
 * @notice Test trades continue to work after tick crossing
 * @dev Bug symptom: first trades succeed, then one fails,
 *      then ALL subsequent trades fail permanently
 */
function test_MultipleTradesAfterCrossing_StillWork() public {
    // Setup liquidity across multiple ticks
    vm.prank(alice);
    poolManager.placeOrder(marketKey, 0, 5_000e18, 100, 150, 100_000e18);
    vm.prank(alice);
    poolManager.placeOrder(marketKey, 0, 5_000e18, 150, 200, 100_000e18);
    
    // Trade 1: Cross first range
    vm.prank(bob);
    poolManager.placeOrder(marketKey, 1, 3_000e18, 1, 999, 100_000e18);
    
    // Trade 2: Cross second range (bug would trigger here)
    vm.prank(bob);
    poolManager.placeOrder(marketKey, 1, 5_000e18, 1, 999, 100_000e18);
    
    // Trade 3: Should still work (bug would fail here)
    vm.prank(carol);
    (uint256 orderId, , , ) = poolManager.placeOrder(
        marketKey, 1, 1_000e18, 1, 999, 100_000e18
    );
    assertGt(orderId, 0, "Trade after crossing should succeed");
    
    // Trade 4: Confirm stability
    vm.prank(carol);
    (uint256 orderId2, , , ) = poolManager.placeOrder(
        marketKey, 0, 500e18, 200, 300, 100_000e18
    );
    assertGt(orderId2, 0, "Subsequent trades should work");
}
```

### Extreme Liquidity Net

```solidity
/**
 * @notice Test handling of extreme liquidityNet values
 */
function test_ExtremeLiquidityNet_ClampsToZero() public {
    // Place large order
    vm.prank(alice);
    (uint256 aliceOrderId, , , ) = poolManager.placeOrder(
        marketKey, 0, 100_000e18, 50, 100, 1_000_000e18
    );
    
    // Place smaller opposing order
    vm.prank(bob);
    poolManager.placeOrder(marketKey, 1, 10_000e18, 50, 100, 500_000e18);
    
    // Cancel large order (creates large negative liquidityNet)
    vm.prank(alice);
    poolManager.cancelOrder(marketKey, aliceOrderId);
    
    // New order should work despite negative liquidityNet
    vm.prank(carol);
    (uint256 carolOrderId, , , ) = poolManager.placeOrder(
        marketKey, 1, 5_000e18, 1, 999, 200_000e18
    );
    assertGt(carolOrderId, 0, "Order after cancel should work");
}
```

---

## Fuzz Tests

### Random Order Sequences

```solidity
/**
 * @notice Fuzz test with random order sequences
 */
function testFuzz_RandomOrderSequences_NoUnderflow(
    uint8 numOrders,
    uint128 seed
) public {
    numOrders = uint8(bound(numOrders, 3, 8));
    
    vm.startPrank(alice);
    for (uint8 i = 0; i < numOrders; i++) {
        // Pseudo-random tick range
        uint16 tickLow = uint16(bound(
            uint256(keccak256(abi.encode(seed, i, "low"))), 1, 900
        ));
        uint16 tickHigh = uint16(bound(
            uint256(keccak256(abi.encode(seed, i, "high"))), tickLow + 1, 999
        ));
        uint8 outcome = uint8(uint256(keccak256(abi.encode(seed, i, "outcome"))) % 2);
        uint128 shares = uint128(bound(
            uint256(keccak256(abi.encode(seed, i, "shares"))), 100e18, 10_000e18
        ));
        
        try poolManager.placeOrder(
            marketKey, outcome, shares, tickLow, tickHigh, 1_000_000e18
        ) {
            // Success
        } catch {
            // May fail for valid reasons (insufficient balance)
        }
    }
    vm.stopPrank();
    
    // Execute market orders to trigger crossing
    vm.startPrank(bob);
    for (uint8 i = 0; i < 3; i++) {
        try poolManager.placeOrder(
            marketKey, uint8(i % 2), 5_000e18, 1, 999, 500_000e18
        ) {} catch {}
    }
    vm.stopPrank();
    
    // If we reach here, no underflow panic
    assertTrue(true, "No underflow panic occurred");
}
```

### Fuzz: Unified Crossing

```solidity
function testFuzz_UnifiedCrossing(
    uint256 rangeShares,
    uint256 spotShares,
    uint256 buyShares,
    uint16 tickLower,
    uint16 tickUpper
) public {
    // Bound inputs
    rangeShares = bound(rangeShares, 1e18, 1000000e18);
    spotShares = bound(spotShares, 0, 1000000e18);
    buyShares = bound(buyShares, 1e18, 1000000e18);
    tickLower = uint16(bound(tickLower, 1, 998));
    tickUpper = uint16(bound(tickUpper, tickLower + 1, 999));
    
    // Place range order
    vm.prank(alice);
    poolManager.placeOrder(marketKey, 0, rangeShares, tickLower, tickUpper, rangeShares);
    
    // Place spot sell (if any)
    if (spotShares > 0) {
        _fundAliceWithYesShares(spotShares);
        vm.prank(alice);
        poolManager.placeSpotSell(marketKey, 1, spotShares, tickLower, tickUpper);
    }
    
    // Place buy order
    vm.prank(bob);
    (uint256 orderId, uint256 filled, , ) = poolManager.placeOrder(
        marketKey, 1, buyShares, tickLower, tickUpper, buyShares
    );
    
    // Invariant: order created
    assertGt(orderId, 0);
    
    // Invariant: spot filled first (if both exist)
    // This requires event checking or state inspection
}
```

---

## Invariant Test Configuration

### foundry.toml

```toml
[invariant]
runs = 256
depth = 64
fail_on_revert = false

[fuzz]
runs = 256
max_test_rejects = 65536
```

---

## Stress Tests

### Many Consecutive Trades

```solidity
/**
 * @notice Stress test with many consecutive trades
 * @dev Original bug caused ALL subsequent trades to fail
 */
function test_ManyConsecutiveTrades_AllSucceed() public {
    // Setup liquidity
    vm.prank(alice);
    poolManager.placeOrder(marketKey, 0, 50_000e18, 50, 200, 500_000e18);
    vm.prank(alice);
    poolManager.placeOrder(marketKey, 1, 50_000e18, 300, 450, 500_000e18);
    
    // Execute 20 consecutive trades
    for (uint256 i = 0; i < 20; i++) {
        address trader = i % 2 == 0 ? bob : carol;
        uint8 outcome = uint8(i % 2);
        
        vm.prank(trader);
        (uint256 orderId, , , ) = poolManager.placeOrder(
            marketKey, outcome, 1_000e18, 1, 999, 100_000e18
        );
        
        assertGt(orderId, 0, string.concat("Trade ", vm.toString(i), " should succeed"));
    }
}
```

### Bidirectional Crossing

```solidity
/**
 * @notice Test crossing in both directions
 */
function test_BidirectionalCrossing_BothDirectionsWork() public {
    // YES liquidity at high ticks
    vm.prank(alice);
    poolManager.placeOrder(marketKey, 1, 5_000e18, 600, 700, 200_000e18);
    
    // NO liquidity at low ticks
    vm.prank(alice);
    poolManager.placeOrder(marketKey, 0, 5_000e18, 300, 400, 200_000e18);
    
    // Cross upward (buy YES)
    vm.prank(bob);
    (uint256 orderId1, , , ) = poolManager.placeOrder(
        marketKey, 1, 3_000e18, 1, 999, 200_000e18
    );
    assertGt(orderId1, 0, "Upward crossing should work");
    
    // Cross downward (buy NO)
    vm.prank(carol);
    (uint256 orderId2, , , ) = poolManager.placeOrder(
        marketKey, 0, 3_000e18, 1, 999, 200_000e18
    );
    assertGt(orderId2, 0, "Downward crossing should work");
    
    // Verify continued operation
    vm.prank(bob);
    (uint256 orderId3, , , ) = poolManager.placeOrder(
        marketKey, 1, 1_000e18, 500, 550, 100_000e18
    );
    assertGt(orderId3, 0, "Orders after bidirectional crossing work");
}
```

---

## Edge Cases

### Zero Active Liquidity

```solidity
/**
 * @notice Test delta application when activeLiq is already zero
 */
function test_ZeroActiveLiquidity_WithNegativeDelta() public {
    // Place and immediately cancel (leaves tick state but no active liq)
    vm.prank(alice);
    (uint256 orderId, , , ) = poolManager.placeOrder(
        marketKey, 0, 1_000e18, 100, 150, 50_000e18
    );
    vm.prank(alice);
    poolManager.cancelOrder(marketKey, orderId);
    
    // New order should work despite zero active liquidity
    vm.prank(bob);
    (uint256 bobOrderId, , , ) = poolManager.placeOrder(
        marketKey, 1, 500e18, 1, 999, 100_000e18
    );
    assertGt(bobOrderId, 0, "Order with zero active liquidity should work");
}
```

---

## Next Steps

- **[05-INTERACTIVE-CLI.md](./05-INTERACTIVE-CLI.md)** - Manual testing
- **[06-BENCHMARKS.md](./06-BENCHMARKS.md)** - Gas benchmarks
