# V10 Gas Benchmarks

**Date**: 2026-01-06  
**Version**: V10.0.0  
**Read Time**: 5 mins

---

## Overview

V10 introduces unified crossing which affects gas costs. This document provides baseline benchmarks and comparison with V9.

---

## Running Benchmarks

### Basic Gas Report

```bash
cd packages/contracts-core
forge test --gas-report
```

### Specific Benchmarks

```bash
# Order placement
forge test --match-test "GasBenchmark" --gas-report

# Crossing operations
forge test --match-path "*crossing*" --gas-report
```

---

## V10 Baseline Results

### Order Operations

| Operation | Gas (avg) | Gas (max) | Notes |
|-----------|-----------|-----------|-------|
| `placeOrder` (no crossing) | ~280,000 | ~350,000 | Single tick limit |
| `placeOrder` (with crossing) | ~350,000 | ~500,000 | Depends on fills |
| `cancelOrder` | ~80,000 | ~120,000 | Includes cleanup |
| `claimFills` | ~60,000 | ~150,000 | Per claim |

### V10 Spot Sell Operations

| Operation | Gas (avg) | Gas (max) | Notes |
|-----------|-----------|-----------|-------|
| `placeSpotSell` | ~180,000 | ~250,000 | Token locking |
| `cancelSpotSell` | ~70,000 | ~100,000 | Token return |
| `buyFromSpotSell` | ~150,000 | ~200,000 | Direct buy |
| Unified crossing (spot) | ~120,000 | ~180,000 | Per spot fill |

### Market Lifecycle

| Operation | Gas (avg) | Notes |
|-----------|-----------|-------|
| `createMarket` | ~2,500,000 | Full deployment |
| `activate` | ~50,000 | State change |
| `settle` | ~80,000 | Adjudicator only |
| `finalize` | ~40,000 | Guardian/adj |
| `redeem` | ~150,000 | Token burn + transfer |

---

## V10 vs V9 Comparison

### Order Placement

| Scenario | V9 | V10 | Delta |
|----------|----|----|-------|
| Limit order (no cross) | 270k | 280k | +4% |
| Range order (no cross) | 290k | 300k | +3% |
| Market order (crossing) | 320k | 350k | +9% |

### Why V10 Uses More Gas

1. **Dual Bitmap Search**: V10 searches both range and spot bitmaps
2. **Unified Tick Storage**: Additional storage reads for spot liquidity
3. **Spot-First Logic**: Priority checking adds ~10k gas

### When V10 Saves Gas

| Scenario | V9 | V10 | Delta |
|----------|----|----|-------|
| Buy from spot (explicit) | N/A | 150k | New |
| Hybrid sell (spot + short) | 350k* | 180k | -49% |

*V9 required separate transactions

---

## Benchmark Tests

### No Existing Orders

```solidity
function test_PlaceOrder_GasBenchmark_NoExistingOrders() public {
    vm.prank(alice);
    uint256 gasBefore = gasleft();
    poolManager.placeOrder(marketKey, 1, 1000e18, 500, 500, 600e18);
    uint256 gasUsed = gasBefore - gasleft();
    
    emit log_named_uint("Gas used (no existing orders)", gasUsed);
    assertLt(gasUsed, 350_000, "Gas should be reasonable");
}
```

### With Existing Orders

```solidity
function test_PlaceOrder_GasBenchmark_With3ExistingOrders() public {
    // Setup: 3 existing orders
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

### Unified Crossing

```solidity
function test_UnifiedCrossing_GasBenchmark() public {
    // Setup spot + range
    vm.prank(alice);
    poolManager.placeOrder(marketKey, 0, 500e18, 400, 600, 500e18);
    vm.prank(alice);
    poolManager.placeSpotSell(marketKey, 1, 200e18, 500, 500);
    
    uint256 gasBefore = gasleft();
    vm.prank(bob);
    poolManager.placeOrder(marketKey, 1, 300e18, 400, 600, 200e18);
    uint256 gasUsed = gasBefore - gasleft();
    
    emit log_named_uint("Gas used (unified crossing)", gasUsed);
}
```

---

## Gas Optimization Tips

### For Users

1. **Use exact tick ranges**: Wider ranges = more storage reads
2. **Prefer spot sells**: Direct `buyFromSpotSell` is cheaper than unified
3. **Batch claims**: Multiple `claimFills` in one tx

### For Developers

1. **Minimize bitmap searches**: Tighter tick bounds
2. **Use view functions first**: Check state before write ops
3. **Consider multicall**: Bundle operations when possible

---

## HFT Benchmark Script

**Location**: `script/benchmark/hft-benchmark.ts`

```bash
cd packages/contracts-core
bun run script/benchmark/hft-benchmark.ts --chain=baseSepolia
```

### Output

```
=== HFT Benchmark Results ===
Orders per second: 12.5
Average latency: 80ms
Gas per order: 285,000
Total gas (100 orders): 28,500,000
```

---

## Gas Limits by Chain

| Chain | Block Gas Limit | Max Orders/Block |
|-------|-----------------|------------------|
| Base Sepolia | 30M | ~85 |
| Monad Testnet | 100M | ~285 |
| Ethereum Mainnet | 30M | ~85 |

---

## Recommendations

### For Production

1. **Set reasonable gas limits**: 500k for complex orders
2. **Monitor gas prices**: Adjust maxCost accordingly
3. **Batch when possible**: Multicall saves 21k per tx

### For Testing

1. **Use `--gas-report`**: Always check gas impact
2. **Compare with baseline**: Watch for regressions
3. **Test edge cases**: Many fills, many ticks

---

## Next Steps

- **[TESTING-REVIEW.md](./TESTING-REVIEW.md)** - Coverage analysis
