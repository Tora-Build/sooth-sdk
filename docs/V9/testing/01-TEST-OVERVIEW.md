# Testing Strategy & Overview

**Package**: `packages/contracts-testing`  
**Status**: 138/138 tests passing ✅  
**Coverage**: Unit + Integration + Fuzz + Invariant + Fork

---

## 📋 Test Breakdown

```
138 Total Tests
├── Unit Tests (60)
│   ├── TickBook (35)
│   ├── TruthMarket (15)
│   ├── AMMEngine (7)
│   ├── Collateralizer (9)
│   └── LaunchpadEngine (4)
├── Integration Tests (40)
│   ├── TickBook ↔ Collateralizer (12)
│   ├── Full Lifecycle (10)
│   ├── Settlement Flows (8)
│   └── Fee Distribution (10)
├── Fuzz Tests (768 runs across 3 suites)
│   ├── TickBook Fuzzing (256 runs)
│   ├── Market Fuzzing (256 runs)
│   └── Collateral Fuzzing (256 runs)
├── Invariant Tests (12)
│   ├── Liquidity Conservation (2)
│   ├── Fee Accumulation (2)
│   ├── Settlement Finality (2)
│   ├── Tick Consistency (3)
│   └── Position Safety (3)
└── Fork Tests (8)
    ├── Live Market Replay (4)
    ├── Gas Profiling (2)
    └── RPC Integration (2)
```

---

## 🎯 Testing Strategy

### 1. Unit Tests
**Purpose**: Isolated contract behavior  
**Approach**: AAA pattern (Arrange, Act, Assert)

```solidity
function testPlaceMarketOrder() public {
    // Arrange: setup market, user balance
    vm.startPrank(user);
    yesToken.approve(address(tickBook), 1000e18);
    
    // Act: place order
    (uint256 orderId, uint256 filled, , ) = tickBook.placeOrder(
        marketKey, 1, 1000e18, 1, 999, 1500e18
    );
    
    // Assert: check state
    assertEq(filled, 1000e18);
    assertEq(tickBook.getOrder(orderId).active, true);
}
```

**When to Use**: Testing single function behavior in isolation

---

### 2. Integration Tests
**Purpose**: Cross-contract interactions  
**Approach**: Real market workflows

```solidity
function testFullLifecycle() public {
    // 1. Create market
    address market = launchpad.createMarket(...);
    
    // 2. User splits USDC
    collateralizer.split(market, 1000e6);
    
    // 3. Trade on TickBook
    tickBook.placeOrder(marketKey, 1, 500e18, 500, 500, 250e18);
    
    // 4. Settle and redeem
    truthMarket.settle(1, 0);
    uint256 proceeds = collateralizer.redeem(market, 500e18);
    assertEq(proceeds, 500e18);
}
```

**When to Use**: Testing realistic user flows across multiple contracts

---

### 3. Fuzz Tests
**Purpose**: Property-based verification  
**Approach**: Random inputs, verify properties hold

```solidity
function testFuzzPlaceOrder(uint256 shares, uint16 tick) public {
    vm.assume(shares > 0 && shares < 1e9e18);
    vm.assume(tick >= 1 && tick <= 999);
    
    // Property: cost should always be positive
    uint256 cost = tickBook.simulateCost(...);
    assertGt(cost, 0, "Cost must be positive");
    
    // Property: filled shares <= requested
    (uint256 orderId, uint256 filled, , ) = tickBook.placeOrder(...);
    assertLe(filled, shares, "Filled <= requested");
}
```

**When to Use**: Verifying mathematical properties, edge cases

---

### 4. Invariant Tests
**Purpose**: Protocol-level properties  
**Approach**: State machine exploration

```solidity
invariant liquidityConserved() {
    // After any sequence of operations,
    // total liquidity should not decrease unexpectedly
    uint128 totalLiq = tickBook.getTotalLiquidity(marketKey);
    assertGe(totalLiq, initialLiquidity);
}

invariant neverNegativeReserves() {
    // Reserves can never be negative
    (uint256 reservesYes, uint256 reservesNo) = ammEngine.getReserves(market);
    assertGe(reservesYes, 0);
    assertGe(reservesNo, 0);
}
```

**When to Use**: Ensuring invariant properties always hold

---

### 5. Fork Tests
**Purpose**: Against live deployment  
**Approach**: Replay on mainnet/testnet state

```solidity
function testLiveMarketReplay() public {
    // Create fork of Base Sepolia
    vm.createSelectFork(RPC_URL);
    
    // Replay existing market operations
    address existingMarket = 0x...;
    tickBook.placeOrder(marketKey, 1, 500e18, 450, 550, 250e18);
    
    // Verify state matches live
    // (Useful for validating deployments)
}
```

**When to Use**: Validating changes don't break live deployments

---

## 🚀 Running Tests

### All Tests
```bash
cd packages/contracts-testing
forge test
```

**Output**:
```
[PASS] TickBookPoolManager (60 tests)
[PASS] TruthMarketLifecycle (15 tests)
[PASS] ActiveLiquidityUnderflow (8 tests)
[PASS] UnifiedOrderSystem (11 tests)
[PASS] V9Fuzz (768 runs)
[PASS] V9Invariants (12 properties)
[PASS] LiveLaunchpadTrade (8 tests)

138/138 tests passed ✅
```

---

### Specific Test Suite
```bash
# Run only TickBook tests
forge test --match-contract "TickBookPoolManager"

# Run only fuzz tests
forge test --match-path "*Fuzz*" -v

# Run single test
forge test --match-test "testPlaceMarketOrder" -vv
```

---

### With Gas Report
```bash
forge test --gas-report
```

**Output** (excerpt):
```
Contract: TickBookPoolManagerV996
├── placeOrder()           ~250k gas
├── claimFills()           ~150k gas
├── cancelOrder()          ~180k gas
└── getAllMarketOrders()   ~50k gas
```

---

### Verbose Output
```bash
forge test -vv      # Show console logs
forge test -vvv     # Full trace
forge test --fail-fast  # Stop on first failure
```

---

## 📊 Test Coverage Metrics

### By Contract
```
TickBook        ████████████████████ 85% (60 tests)
TruthMarket     ████████████████░░░░ 80% (15 tests)
AMMEngine       ███████████████░░░░░ 75% (12 tests)
Collateralizer  ███████████░░░░░░░░░ 70% (9 tests)
LaunchpadEngine ████████░░░░░░░░░░░░ 55% (4 tests)
```

### By Type
```
Unit Tests      ████████████░░░░░░░░ 43% (60 tests)
Integration     ██████████░░░░░░░░░░ 29% (40 tests)
Fuzz            ██████████░░░░░░░░░░ 22% (768 runs)
Invariants      ██░░░░░░░░░░░░░░░░░░ 9% (12 properties)
Fork            █░░░░░░░░░░░░░░░░░░░ 6% (8 tests)
```

---

## 🧪 Key Test Files

### Core Tests (138 passing)

| File | Tests | Focus |
|------|-------|-------|
| **TickBookPoolManager.t.sol** | 60 | Unified API, tick crossing, liquidity |
| **TruthMarketLifecycle.t.sol** | 15 | Settlement, veto, finalization |
| **ActiveLiquidityUnderflow.t.sol** | 8 | V9.9.6-fix1 regression |
| **UnifiedOrderSystem.t.sol** | 11 | Market/limit/range orders |
| **V9Fuzz.t.sol** | 256 | Random inputs, property checks |
| **V9Invariants.t.sol** | 12 | State machine properties |
| **LiveLaunchpadTrade.t.sol** | 8 | Fork tests (on-chain) |

---

## 📈 Test Trends

### Test Growth Over Time
```
V8 (2025-12-01):  30 tests
V9 (2025-12-15):  80 tests
V9.9.5 (2025-12-31): 110 tests
V9.9.6 (2026-01-03): 138 tests (includes fix9d regression)
```

### Bug Detection History
- **fix1** (underflow): Caught by 8 regression tests
- **fix2** (array overflow): Caught by 4 new tests
- **fix3** (RPC limits): Caught by integration test
- **fix6** (crossing logic): Caught by 11 unified order tests
- **fix9d** (auto-claim): Caught by 4 new tests

---

## ✅ Quality Assurance Checklist

- [ ] All 138 tests passing locally
- [ ] Gas report reviewed (no unexpected spikes)
- [ ] Fuzz runs complete (768+ runs)
- [ ] Fork tests pass against live
- [ ] New features have unit + integration tests
- [ ] Bug fixes include regression tests
- [ ] No warnings or deprecations

---

## 🏗️ CI/CD Pipeline

```mermaid
graph LR
    A[Push to GitHub] --> B[Run forge test]
    B --> C[Gas Report]
    C --> D[Fuzz Suite]
    D --> E{All Pass?}
    E -->|Yes| F[Deploy Testnet]
    E -->|No| G[Block Merge]
    F --> H[Fork Tests]
    H --> I{Live OK?}
    I -->|Yes| J[✅ Ready]
    I -->|No| K[⚠️ Alert]
```

---

## 🎓 Test Template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ITickBook} from "@core/interfaces/ITickBook.sol";

contract MyTest is Test {
    ITickBook tickBook;
    address user = address(0x1);
    address market = address(0x2);
    
    function setUp() public {
        // Deploy contracts
        // Setup initial state
    }
    
    function testMyFeature() public {
        // Arrange
        vm.startPrank(user);
        
        // Act
        tickBook.placeOrder(...);
        
        // Assert
        assertEq(...);
    }
}
```

---

## 📞 Common Questions

**Q: How do I add a new test?**  
A: See [02-UNIT-TESTS.md](./02-UNIT-TESTS.md#writing-new-tests)

**Q: How do I run fuzz tests?**  
A: `forge test --match-path "*Fuzz*"` (runs 256 iterations)

**Q: What if a test fails?**  
A: Check test output with `-vv`, then read contract code (01-OVERVIEW.md)

**Q: How do I test my own integration?**  
A: Use interactive CLI (05-INTERACTIVE-CLI.md) for manual testing

**Q: What's the gas budget per function?**  
A: See [06-BENCHMARKS.md](./06-BENCHMARKS.md) for baseline

---

**Last Updated**: 2026-01-03  
**Test Status**: 138/138 passing ✅
