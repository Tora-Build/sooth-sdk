# V10 Testing Overview

**Date**: 2026-01-06  
**Version**: V10.0.0  
**Status**: All tests passing  
**Read Time**: 5 mins

---

## Executive Summary

V10 introduces the **Unified Crossing Architecture** - the most significant testing focus is ensuring spot liquidity is consumed before range liquidity at the same price.

### Key Testing Themes

| Theme | Why It Matters |
|-------|----------------|
| **Unified Crossing** | Core V10 innovation - must work correctly |
| **Spot-First Priority** | Capital efficiency depends on this |
| **Tick Liquidity** | Combined storage must stay consistent |
| **Bitmap Sync** | Dual bitmap system must stay in sync |

---

## Testing Strategy

### Test Pyramid

```
         /\
        /  \     Fork Tests (3)
       /----\    - Live deployment validation
      /      \
     /--------\  Integration Tests (30)
    /          \ - Cross-contract flows
   /------------\- Unified crossing
  /              \
 /----------------\ Unit Tests (45)
/                  \ - Single contract isolation
--------------------
     Fuzz (512+)    - Property-based testing
```

### Priority Order

1. **Critical Path**: Unified crossing (spot → range)
2. **P0**: Settlement, redemption, fee deduction
3. **P1**: Order lifecycle, cancellation, claims
4. **P2**: Edge cases, gas optimization

---

## V10-Specific Test Categories

### 1. Unified Crossing Tests

**Location**: `test/crossing/UnifiedCrossing.t.sol`

Tests the core V10 innovation: when a buyer places an order, the engine fills spot sells FIRST (recycling existing tokens), then range orders (minting synthetic shares).

```solidity
// Core test pattern
function test_UnifiedCrossing_SpotFilledFirst() public {
    // 1. Place range order (provides crossing opportunity)
    poolManager.placeOrder(marketKey, NO, 500e18, 400, 600, 500e18);
    
    // 2. Place spot sell (existing YES shares)
    poolManager.placeSpotSell(marketKey, YES, 200e18, 500, 500);
    
    // 3. Place YES buy - should consume spot FIRST
    poolManager.placeOrder(marketKey, YES, 150e18, 500, 500, 100e18);
    
    // 4. Verify spot was filled before range
    assertEq(spotOrder.sharesFilled, 150e18);
}
```

### 2. Tick Liquidity Tests

**Focus**: Verify the unified `TickLiquidity` struct works correctly.

```solidity
struct TickLiquidity {
    int128 rangeLiquidityNet;     // Range orders
    uint128 rangeLiquidityGross;  // For cleanup
    uint128 spotLiquidity;        // V10: Spot sells
}
```

**Key assertions**:
- Both liquidity types coexist at same tick
- Liquidity correctly removed on fill/cancel
- Bitmap updated when liquidity goes to zero

### 3. Dual Bitmap Tests

**Focus**: Verify separate bitmaps for range and spot liquidity.

```solidity
// Range bitmap
mapping(...) private _bitmaps;

// Spot bitmap (V10)
mapping(...) private _spotBitmaps;
```

**Key assertions**:
- Correct bitmap updated on place/cancel
- OR search finds best price across both
- No orphan bits (bit set but no liquidity)

### 4. Spot Sell Lifecycle

**Location**: `test/repro/SpotSell.t.sol`

```
Place Spot Sell → Lock Tokens → Fill (partial/full) → Claim Proceeds
                              ↓
                        Cancel → Return Tokens
```

**Key tests**:
- Token locking on placement
- Proceeds accumulation on fills
- Clean cancellation with token return

---

## Test Structure

### Directory Layout

```
test/
├── crossing/                 # V10 unified crossing
│   ├── UnifiedCrossing.t.sol # 14 tests
│   └── DebugLaunchpadCreation.t.sol
├── integration/              # Cross-contract flows
│   ├── OrderSystem.t.sol     # 15 tests
│   └── SellSideFee.t.sol     # 15 tests
├── unit/                     # Single contract
│   └── TruthMarket.t.sol     # 25 tests
├── invariants/               # Property-based
│   └── ActiveLiquidity.t.sol # 10 tests + fuzz
├── repro/                    # Reproduction
│   └── SpotSell.t.sol        # 3 tests
└── fork/                     # Live chain
    └── LiveLaunchpad.t.sol   # 3 tests
```

### Naming Conventions

| Pattern | Meaning |
|---------|---------|
| `test_*` | Normal test case |
| `testFuzz_*` | Fuzz test with random inputs |
| `testFail_*` | Expected to revert |
| `test_RevertWhen_*` | Tests specific revert conditions |

---

## Running Tests

### All Tests

```bash
cd packages/contracts-core
forge test
```

### V10-Specific

```bash
# Unified crossing (most important)
forge test --match-path "*crossing*" -vvv

# Spot sells
forge test --match-test "SpotSell" -vv

# Integration
forge test --match-path "*integration*" -vv

# Fuzz only
forge test --match-test "Fuzz" -vv
```

### With Options

```bash
# Gas report
forge test --gas-report

# Verbose (show logs)
forge test -vvv

# Coverage
forge coverage

# Specific test
forge test --match-test "test_UnifiedCrossing_SpotFilledFirst"
```

---

## Test Configuration

### foundry.toml

```toml
[profile.default]
src = "test"
test = "test"
libs = ["lib"]
remappings = [
    "@core/=../contracts-core/src/",
    "@openzeppelin/=lib/openzeppelin-contracts/"
]

[fuzz]
runs = 256
max_test_rejects = 65536
```

### Environment Variables

```bash
# For fork tests
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
export MONAD_TESTNET_RPC_URL="..."
```

---

## Test Assertions Guide

### Common V10 Assertions

```solidity
// 1. Check spot liquidity at tick
uint128 spotLiq = poolManager.getSpotSellLiquidity(marketKey, outcome, tick);
assertEq(spotLiq, expectedAmount);

// 2. Check unified tick liquidity
(int128 rangeNet, uint128 rangeGross, uint128 spotLiq) = 
    poolManager.getTickLiquidity(marketKey, outcome, tick);

// 3. Check spot order state
TickBookPoolManager.SpotSellOrder memory order = 
    poolManager.getSpotSellOrder(marketKey, orderId);
assertEq(order.sharesFilled, expectedFilled);
assertTrue(order.active);

// 4. Check internal balances (vault)
(uint256 yesBalance, uint256 noBalance) = 
    vault.getInternalOutcomes(address(market), user);
```

---

## V10 Test Checklist

Before merging V10 changes, ensure:

- [ ] All `UnifiedCrossing.t.sol` tests pass
- [ ] Spot-first priority verified with mixed liquidity
- [ ] Bitmap consistency after fills/cancels
- [ ] No underflow on tick boundary crossing
- [ ] Fee deduction correct on spot sell proceeds
- [ ] Fork tests pass against live deployment
- [ ] Fuzz tests find no invariant violations

---

## Next Steps

1. **[02-UNIT-TESTS.md](./02-UNIT-TESTS.md)** - Detailed unit test guide
2. **[03-INTEGRATION-TESTS.md](./03-INTEGRATION-TESTS.md)** - Cross-contract flows
3. **[04-FUZZ-INVARIANTS.md](./04-FUZZ-INVARIANTS.md)** - Property-based testing

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `forge test` | Run all tests |
| `forge test -vvv` | Verbose output |
| `forge test --match-path "*crossing*"` | V10 crossing tests |
| `forge test --gas-report` | Gas benchmarks |
| `forge coverage` | Code coverage |
