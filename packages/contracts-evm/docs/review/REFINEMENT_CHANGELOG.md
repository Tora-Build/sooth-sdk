# Smart Contract Refinement Changelog

**Version**: V8.13.0
**Date**: December 2024
**Branch**: `LadderChaos/smart-contract-refine`

## Overview

This document describes the comprehensive smart contract refinement focused on **logic correctness**, **efficiency**, and **consistency** across all Valencia V8 contracts.

---

## Breaking Changes

### Outcome Semantics Alignment

The outcome encoding has been standardized across all contracts to match `TruthMarket`:

| Outcome | Old Value | New Value |
|---------|-----------|-----------|
| NO      | 1         | **0**     |
| YES     | 0         | **1**     |
| INVALID | 2         | 2 (unchanged) |

**Affected Contracts:**
- `AMMEngine.sol`
- `IAMMEngine.sol` (interface comments)

**Migration Required:**
- Frontend/backend code passing `outcome` parameter must swap values
- Existing test files updated to use `YES = 1`, `NO = 0`

---

## Security Improvements

### ReentrancyGuard Added

All external state-changing functions now protected with OpenZeppelin's `ReentrancyGuard`:

| Contract | Functions Protected |
|----------|---------------------|
| `AMMEngine` | `settlePosition()` |
| `Collateralizer` | `split()`, `merge()`, `redeem()`, `redeemOutcome()` |
| `TickBook` | `placeLimitOrder()`, `cancelOrder()`, `executeMarketOrder()` |
| `TickBookV2` | `executeSpotSell()`, `executeMarketOrder()`, `executeHybridSell()` |
| `LaunchpadEngine` | `createMarket()`, `tradePositions()`, `redeemLP()`, `increaseBBase()` |

### Dangerous External Calls Fixed

**TickBookV2.sol** - `executeHybridSell()` previously used:
```solidity
// BEFORE (dangerous - bypasses reentrancy guard)
(spotSold, proceeds) = this.executeSpotSell(...);
(shortSold, shortCost, ) = this.executeMarketOrder(...);
```

Now uses internal functions:
```solidity
// AFTER (safe - internal call)
(spotSold, proceeds) = _executeSpotSellInternal(...);
(shortSold, shortCost, ) = _executeMarketOrderInternal(...);
```

### Safe Approval Pattern

**LaunchpadEngine.sol** - Changed from unsafe `approve()` to `forceApprove()`:
```solidity
// BEFORE
usdc.approve(address(ammEngine), amount);

// AFTER
usdc.forceApprove(address(ammEngine), amount);
```

This handles tokens that don't allow `approve()` when allowance is non-zero.

### CEI Pattern Enforcement

All functions now follow Checks-Effects-Interactions pattern:
- State changes (burns, position clears) happen before external calls
- Reduces reentrancy attack surface

---

## Logic Improvements

### INVALID Outcome Handling

#### AMMEngine.settlePosition()

Now properly handles all three outcomes:
```solidity
if (winningOutcome == 1) {
    payout = yesShares;           // YES won
} else if (winningOutcome == 0) {
    payout = noShares;            // NO won
} else {
    payout = (yesShares + noShares) / 2;  // INVALID: 50% return
}
```

#### Collateralizer.redeem()

INVALID outcome burns both tokens and returns full value:
```solidity
if (winningOutcome == 2) {
    tokens.yesToken.burn(msg.sender, amount);
    tokens.noToken.burn(msg.sender, amount);
    usdcAmount = amount;  // Full value back
}
```

### Market Lifecycle Improvements

#### TruthMarket.isLive()

Now checks deadline in addition to state:
```solidity
// BEFORE
return state == MarketState.LIVE;

// AFTER
return state == MarketState.LIVE && block.timestamp < deadline;
```

This prevents trading after deadline even if `settle()` hasn't been called.

#### New Helper Functions

```solidity
// Check if awaiting adjudicator resolution
function isSettling() external view returns (bool);

// Check if irreversibly finalized
function isFinalized() external view returns (bool);
```

---

## New Events

### TruthMarket

```solidity
// Emitted when market is activated
event MarketActivated(address indexed market, uint256 activatedAt);

// Emitted when guardian vetoes settlement
event MarketVetoed(address indexed market, uint8 previousOutcome, uint64 previousTStar);
```

### AMMEngine

```solidity
// Emitted when position is settled
event PositionSettled(
    address indexed user,
    address indexed market,
    uint8 winningOutcome,
    uint256 yesShares,
    uint256 noShares,
    uint256 payout
);
```

### TickBookVault

```solidity
// Emitted when tickBook address is updated (not just initially set)
event TickBookUpdated(address indexed previousTickBook, address indexed newTickBook);
```

---

## Flexibility Improvements

### TickBookVault.setTickBook()

Removed one-time restriction to allow upgrades:
```solidity
// BEFORE
require(tickBook == address(0), "already set");

// AFTER
// No restriction - owner can update for migrations
```

---

## Library Fixes

### TickMath.getVirtualReserveNO()

Fixed redundant/incorrect tick validation:
```solidity
// BEFORE (redundant check)
require(tick <= MAX_TICK && tick < MAX_TICK, "invalid tick");

// AFTER (correct bounds)
require(tick > 0 && tick < MAX_TICK, "invalid tick");
```

---

## Gas Optimizations

1. **Internal function calls** in TickBookV2 instead of external `this.` calls
2. **Early returns** when `usdcAmount == 0` in `redeemOutcome()`
3. **Memory caching** of position values before clearing in `settlePosition()`

---

## Test Updates

Updated outcome constants in test files:
- `test/v8/AMMSettlement.t.sol`
- `test/v8/LaunchpadEngine.t.sol`
- `test/v8/SpendableProceeds.t.sol`
- `test/v8/fuzz/TradeFuzz.t.sol`
- `test/v8/invariants/V8Invariants.t.sol`

All 146 tests pass (1 fork test skipped - requires external URL).

---

## Migration Guide

### For Frontend/Backend Developers

1. **Update outcome parameters:**
   ```javascript
   // BEFORE
   const YES = 0;
   const NO = 1;

   // AFTER
   const YES = 1;
   const NO = 0;
   ```

2. **Listen for new events:**
   - `MarketActivated` - track when markets go live
   - `MarketVetoed` - alert on guardian intervention
   - `PositionSettled` - detailed settlement info

3. **Check `isLive()` behavior:**
   - Now returns `false` after deadline even if not settled
   - Use `isSettling()` to check if awaiting adjudication

### For Contract Integrators

1. Ensure your contracts handle the new outcome encoding
2. Note that `TickBookVault.setTickBook()` can now be called multiple times
3. `Collateralizer.redeem()` with INVALID outcome requires both token types

---

## Files Changed

| File | Changes |
|------|---------|
| `TruthMarket.sol` | +events, +isSettling(), +isFinalized(), deadline check in isLive() |
| `AMMEngine.sol` | +ReentrancyGuard, outcome flip, INVALID handling, +PositionSettled event |
| `Collateralizer.sol` | +ReentrancyGuard, INVALID handling, CEI pattern |
| `TickBook.sol` | +ReentrancyGuard on all order functions |
| `TickBookV2.sol` | +ReentrancyGuard, internal function refactor |
| `TickBookVault.sol` | Removable tickBook restriction, +TickBookUpdated event |
| `LaunchpadEngine.sol` | +ReentrancyGuard, forceApprove() |
| `ITruthMarket.sol` | +MarketVetoed event |
| `IAMMEngine.sol` | Updated outcome comments |
| `TickMath.sol` | Fixed tick validation |

---

## Audit Notes

Key areas for security review:
1. Outcome semantics change - verify all callsites updated
2. ReentrancyGuard placement - ensure all entry points covered
3. INVALID outcome math - verify 50% calculations are correct
4. `setTickBook()` - assess upgrade security implications
