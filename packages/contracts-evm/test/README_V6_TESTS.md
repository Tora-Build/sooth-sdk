# Launchpad V6 Test Suite

## Status: ✅ Tests Written, ⏳ Awaiting V6 Architecture Merge

## Overview

This directory contains comprehensive test suites for Launchpad V6:

1. **`LaunchpadV6.t.sol`** - 25 feature tests for V6 architecture
2. **`LaunchpadInvariants.t.sol`** - 8 invariant property tests
3. **`Launchpad.t.sol`** - 16 existing tests (legacy architecture)

## ⚠️ Important Note

**These tests are written for V6 architecture which includes:**
- Merged LPVault (Market implements ISoothGovernorVault)
- Immutable Factory (no Ownable, ProtocolConfig reference)
- Pre-graduation locking with `useLockedProceeds()`
- Guardian liquidation and `forceGraduate()`

**Current worktree has OLD architecture:**
- Separate `MarketLPVault` contract
- `Ownable` Factory with mutable state
- No ProtocolConfig
- No liquidation/guardian functions

**Result:** Tests will NOT compile until V6 architecture is merged.

## Test Coverage

### Pre-Graduation Locking (5 tests)
- ✅ All sells lock proceeds
- ✅ Withdrawals blocked
- ✅ Locked proceeds can be used for buying
- ✅ FIFO lock queue
- ✅ 24h unlock claim

### Liquidation (4 tests)
- ✅ Guardian authorization
- ✅ Access control
- ✅ State validation
- ✅ User refunds

### Force Graduate (2 tests)
- ✅ Guardian power
- ✅ Access control

### 2-Contract Architecture (3 tests)
- ✅ Market is own GovernorVault
- ✅ Market holds USDC
- ✅ Interface compliance

### LP Tokens (3 tests)
- ✅ Creator receives LP tokens
- ✅ Traders receive LP from fees
- ✅ Redemption rules

### Invariants (4 tests)
- ✅ Solvency
- ✅ LP accounting
- ✅ Lock consistency
- ✅ Asset tracking

### Edge Cases (4 tests)
- ✅ Zero/partial usage
- ✅ WAD math precision

## Running Tests

### After V6 Merge:
```bash
# Run all V6 tests
forge test --match-contract LaunchpadV6Test -vvv

# Run invariant tests
forge test --match-contract LaunchpadInvariants -vvv

# Run with fuzzing
forge test --match-contract LaunchpadInvariants --fuzz-runs 10000
```

### Current (Old Architecture):
```bash
# Run existing tests (legacy)
forge test --match-contract LaunchpadTest -vvv
```

## Files

- `LaunchpadV6.t.sol` - V6 feature tests (25 tests)
- `LaunchpadInvariants.t.sol` - Invariant tests (8 properties)
- `Launchpad.t.sol` - Legacy tests (16 tests)
- `QA_STATUS.md` - QA status and findings
- `QA_REPORT_V6.md` - Full QA report
- `LaunchpadV6Coverage.md` - Coverage analysis

## Next Steps

1. ✅ Tests written
2. ⏳ Merge V6 architecture
3. ⏳ Update test setup if needed
4. ⏳ Run tests and fix failures
5. ⏳ Add fuzz tests

---

*Last updated: 2025-12-15*

