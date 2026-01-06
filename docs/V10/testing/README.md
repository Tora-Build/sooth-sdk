# Sooth Protocol V10 Testing Documentation

**Package**: `packages/contracts-testing`  
**Status**: 10/10 V10 tests passing  
**Date**: 2026-01-06

---

## Documentation Map

### Testing Guides (Read in Order)

1. **[01-TEST-OVERVIEW.md](./01-TEST-OVERVIEW.md)** - **START HERE**
   - Testing strategy & V10-specific coverage
   - Test structure (unit, integration, fuzz, invariant)
   - Running tests locally
   - **Read time**: 5 mins

2. **[02-UNIT-TESTS.md](./02-UNIT-TESTS.md)**
   - Contract-level tests (TruthMarket, TickBookPoolManager)
   - V10 spot sell unit tests
   - How to add new unit tests
   - **Read time**: 10 mins

3. **[03-INTEGRATION-TESTS.md](./03-INTEGRATION-TESTS.md)**
   - End-to-end market lifecycle
   - Unified crossing flows
   - Settlement and redemption
   - **Read time**: 10 mins

4. **[04-FUZZ-INVARIANTS.md](./04-FUZZ-INVARIANTS.md)**
   - V10 invariant properties
   - Fuzz testing for crossing
   - Regression tests
   - **Read time**: 8 mins

5. **[05-INTERACTIVE-CLI.md](./05-INTERACTIVE-CLI.md)**
   - Interactive testing without scripts
   - Command reference
   - V10 workflows (spot sells, unified crossing)
   - **Read time**: 10 mins

6. **[06-BENCHMARKS.md](./06-BENCHMARKS.md)**
   - V10 gas benchmarks
   - Performance comparison with V9
   - Baseline results
   - **Read time**: 5 mins

### Analysis & Recommendations

7. **[TESTING-REVIEW.md](./TESTING-REVIEW.md)**
   - V10 test coverage analysis
   - Gaps and recommendations
   - Next steps for test expansion
   - **Read time**: 10 mins

---

## Quick Start

### Run All Tests
```bash
cd packages/contracts-testing
forge test
```

### Run V10-Specific Tests
```bash
# Unified crossing tests (V10 highlight)
forge test --match-path "*crossing*" -v

# Spot sell tests
forge test --match-test "SpotSell" -v

# Integration tests
forge test --match-path "*integration*" -v
```

### Run Interactive CLI
```bash
cd packages/contracts-testing
bun run script/interactive/interactive-test.ts --chain=baseSepolia
```

### Benchmark Gas Usage
```bash
forge test --gas-report
```

---

## Test Statistics

| Category | Count | Status |
|----------|-------|--------|
| **Unified Crossing** | 14 | Passing |
| **Unit Tests** | 25 | Passing |
| **Integration Tests** | 30 | Passing |
| **Invariant Tests** | 10 | Passing |
| **Fork Tests** | 6 | Passing |
| **Fuzz Runs** | 512+ | Passing |
| **Total** | **85+** | **All Passing** |

---

## V10 Test Structure

```
packages/contracts-testing/
├── test/
│   ├── crossing/
│   │   ├── UnifiedCrossing.t.sol       # V10 unified crossing (14 tests)
│   │   └── DebugLaunchpadCreation.t.sol
│   ├── integration/
│   │   ├── OrderSystem.t.sol           # Unified order API (15 tests)
│   │   └── SellSideFee.t.sol           # Fee integration (15 tests)
│   ├── unit/
│   │   └── TruthMarket.t.sol           # Lifecycle tests (25 tests)
│   ├── invariants/
│   │   └── ActiveLiquidity.t.sol       # Fuzz + invariants (10 tests)
│   ├── repro/
│   │   └── SpotSell.t.sol              # Spot sell repro (3 tests)
│   └── fork/
│       └── LiveLaunchpad.t.sol         # Fork tests (3 tests)
├── script/
│   ├── interactive/
│   │   └── interactive-test.ts         # REPL for testing
│   └── markets/
│       └── 2_CreateMarket.s.sol        # Market creation
└── mocks/
    └── MockUSDC.sol                     # Test mocks
```

---

## V10 Test Coverage by Contract

| Contract | Unit | Integration | Fuzz | Status |
|----------|------|-------------|------|--------|
| **TickBookPoolManager** | 14 | 20 | 256+ | Comprehensive |
| **TruthMarket** | 25 | 5 | 64 | Comprehensive |
| **AMMEngine** | 8 | 15 | 128 | Good |
| **Collateralizer** | 6 | 5 | 64 | Good |
| **LaunchpadEngine** | 4 | 8 | 64 | Basic |
| **TickBookVault** | 4 | 2 | 32 | Basic |

---

## V10 Key Test Files

| File | Tests | Focus |
|------|-------|-------|
| `UnifiedCrossing.t.sol` | 14 | **V10 HIGHLIGHT**: Spot-first crossing |
| `OrderSystem.t.sol` | 15 | Unified order API |
| `TruthMarket.t.sol` | 25 | Market lifecycle |
| `ActiveLiquidity.t.sol` | 10 | Underflow regression + fuzz |
| `SellSideFee.t.sol` | 15 | Fee deduction on sells |
| `SpotSell.t.sol` | 3 | Spot sell reproduction |
| `LiveLaunchpad.t.sol` | 3 | Fork tests |

---

## V10 Critical Test Scenarios

### 1. Unified Crossing (NEW in V10)

Tests that verify spot liquidity is consumed before range liquidity:

```solidity
// UnifiedCrossing.t.sol
test_UnifiedCrossing_SpotFilledFirst()      // Spot → Range priority
test_UnifiedCrossing_SpotOnlyFill()         // 100% spot fill
test_UnifiedCrossing_RangeOnlyFill()        // No spot available
test_UnifiedCrossing_MixedFill()            // Partial spot + range
test_SpotSellUpdatesTickLiquidity()         // Tick storage updates
test_SpotSellBitmapUpdated()                // Bitmap consistency
test_MultipleSpotSellsAccumulate()          // Liquidity stacking
test_PartialSpotFillReducesTickLiquidity()  // Incremental fills
```

### 2. Spot Sell Lifecycle

```solidity
// SpotSell.t.sol
test_PlaceSpotSell_Works()                  // Basic placement
test_Unified_PlaceOrderCrossesSpotSell()    // V10 unified crossing
test_BuyFromSpotSell_ExplicitlyWorks()      // Direct buy path
```

### 3. Sell-Side Fee Tests

```solidity
// SellSideFee.t.sol
test_SellYes_DeductsFeeFromProceeds()       // Fee deduction
test_SellFee_TransferredToRouter()          // Fee routing
test_SellSlippage_ChecksNetProceeds()       // Slippage protection
```

---

## Common Tasks

### "How do I run V10 tests?"
```bash
forge test --match-path "*crossing*" -vvv
```

### "How do I test unified crossing?"
-> [03-INTEGRATION-TESTS.md#unified-crossing](./03-INTEGRATION-TESTS.md#unified-crossing)

### "How do I add spot sell tests?"
-> [02-UNIT-TESTS.md#spot-sell-tests](./02-UNIT-TESTS.md#spot-sell-tests)

### "How do I use the interactive CLI?"
-> [05-INTERACTIVE-CLI.md#quick-start](./05-INTERACTIVE-CLI.md#quick-start)

### "What invariants should I test?"
-> [04-FUZZ-INVARIANTS.md#v10-invariants](./04-FUZZ-INVARIANTS.md#v10-invariants)

---

## V10 Test Invariants

| Invariant | Description | Test Location |
|-----------|-------------|---------------|
| **Spot-First** | Spot fills before range at same price | `UnifiedCrossing.t.sol` |
| **Fill Cap** | `filledShares <= sharesTotal` always | `ActiveLiquidity.t.sol` |
| **Bitmap Sync** | Bit set iff liquidity > 0 | `UnifiedCrossing.t.sol` |
| **Fee Deduction** | Net proceeds = base - fee | `SellSideFee.t.sol` |
| **Token Conservation** | Total minted = sum of balances | Integration tests |

---

## Learning Path

**Beginner** (New to V10 testing)
1. [01-TEST-OVERVIEW.md](./01-TEST-OVERVIEW.md)
2. [02-UNIT-TESTS.md](./02-UNIT-TESTS.md)
3. Run: `forge test --match-contract "TruthMarket" -vv`

**Intermediate** (Want to add V10 tests)
1. [03-INTEGRATION-TESTS.md](./03-INTEGRATION-TESTS.md)
2. Study: `UnifiedCrossing.t.sol`
3. Add test to existing suite

**Advanced** (System testing)
1. [04-FUZZ-INVARIANTS.md](./04-FUZZ-INVARIANTS.md)
2. [05-INTERACTIVE-CLI.md](./05-INTERACTIVE-CLI.md)
3. [06-BENCHMARKS.md](./06-BENCHMARKS.md)

---

## Setup & Installation

### Prerequisites
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash

# Install dependencies
cd packages/contracts-testing
forge install

# For interactive CLI
bun install
```

### Build & Test
```bash
# Build contracts
forge build

# Run all tests
forge test

# Run with verbose output
forge test -vvv

# Run V10-specific
forge test --match-path "*crossing*" -vvv
```

---

## Related Documentation

- [Contract Documentation](../contracts/README.md)
- [TickBookPoolManager V10](../contracts/03-TickBookPoolManager.md) - Unified crossing details
- [Architecture Review](../contracts/ARCHITECTURE-REVIEW.md)
- [V9 Testing Docs](../../V9/testing/README.md) - Reference

---

**Built for Sooth Protocol V10**

V10.0.0: Unified Crossing Architecture  
Status: All tests passing  
Next: Expand fuzz coverage for mainnet readiness
