# Outcome Semantics Guide

## Overview

Valencia V8 uses a consistent outcome encoding across all contracts. This document describes the standard and how it's used throughout the protocol.

## Outcome Values

| Value | Outcome | Description |
|-------|---------|-------------|
| `0`   | NO      | The "No" side of the prediction |
| `1`   | YES     | The "Yes" side of the prediction |
| `2`   | INVALID | Market invalidated (ambiguous question, unresolvable, etc.) |

## Canonical Source

`TruthMarket.sol` is the canonical source of truth for outcome semantics. All other contracts follow this standard.

```solidity
// TruthMarket.settle()
function settle(uint8 outcome, uint64 _tStar) external {
    // outcome: 0=NO, 1=YES, 2=INVALID
}

// TruthMarket.getRedemptionValue()
function getRedemptionValue(uint8 outcome) external view returns (uint256) {
    if (winningOutcome == 0) {
        return outcome == 0 ? WAD : 0;  // NO won
    } else if (winningOutcome == 1) {
        return outcome == 1 ? WAD : 0;  // YES won
    } else {
        return WAD / 2;  // INVALID: 50% for both
    }
}
```

## Usage by Contract

### AMMEngine

```solidity
// Trading
function tradePositions(
    address market,
    uint8 outcome,      // 0 = NO, 1 = YES
    int256 deltaShares,
    uint256 maxCostOrMinProceeds
) external;

// Settlement
function settlePosition(address market) external returns (uint256 payout) {
    uint8 winningOutcome = truthMarket.winningOutcome();

    if (winningOutcome == 1) {
        payout = yesShares;      // YES won
    } else if (winningOutcome == 0) {
        payout = noShares;       // NO won
    } else {
        payout = (yesShares + noShares) / 2;  // INVALID
    }
}
```

### Collateralizer

```solidity
// Redemption after settlement
function redeem(address market, uint256 amount) external returns (uint256 usdcAmount) {
    uint8 winningOutcome = truthMarket.winningOutcome();

    if (winningOutcome == 2) {
        // INVALID: burn both, return full value
        tokens.yesToken.burn(msg.sender, amount);
        tokens.noToken.burn(msg.sender, amount);
        usdcAmount = amount;
    } else if (winningOutcome == 1) {
        // YES won: burn YES tokens
        tokens.yesToken.burn(msg.sender, amount);
        usdcAmount = amount;
    } else {
        // NO won: burn NO tokens
        tokens.noToken.burn(msg.sender, amount);
        usdcAmount = amount;
    }
}
```

### TickBook / TickBookV2

```solidity
// Order placement
function placeLimitOrder(
    bytes32 marketKey,
    uint8 outcome,      // 0 = NO, 1 = YES
    uint16 tickLower,
    uint16 tickUpper,
    uint256 sharesPerTick
) external;

// Market orders
function executeMarketOrder(
    bytes32 marketKey,
    uint8 outcome,      // 0 = NO, 1 = YES
    uint256 shares,
    uint16 limitTick
) external;
```

### TickBookVault

```solidity
// Internal balance tracking
function getInternalOutcomes(address market, address user)
    external view
    returns (uint256 yesSharesWad, uint256 noSharesWad);  // Note: YES first, then NO

// Outcome credit
function creditOutcome(address market, address user, uint8 outcome, uint256 sharesWad) external {
    if (outcome == 1) {
        _yesInternalWad[market][user] += sharesWad;
    } else {
        _noInternalWad[market][user] += sharesWad;
    }
}
```

## INVALID Outcome Behavior

When a market settles as INVALID (outcome = 2):

| Contract | Behavior |
|----------|----------|
| `TruthMarket` | `getRedemptionValue()` returns `0.5 WAD` for both outcomes |
| `AMMEngine` | `settlePosition()` returns 50% of total position value |
| `Collateralizer` | `redeem()` requires both tokens, returns full value |
| `Collateralizer` | `redeemOutcome()` returns 50% for either token type |
| `TickBookVault` | `redeemResolved()` calculates using `getRedemptionValue()` |

## Code Examples

### Frontend: Buy YES shares

```typescript
const YES = 1;
const shares = ethers.parseEther("100");  // 100 shares
const maxCost = ethers.parseEther("60");  // Max $60

await ammEngine.tradePositions(
    marketAddress,
    YES,           // outcome = 1
    shares,        // positive = buy
    maxCost
);
```

### Frontend: Sell NO shares

```typescript
const NO = 0;
const shares = ethers.parseEther("50");
const minProceeds = ethers.parseEther("20");

await ammEngine.tradePositions(
    marketAddress,
    NO,                              // outcome = 0
    -BigInt(shares.toString()),      // negative = sell
    minProceeds
);
```

### Frontend: Check settlement outcome

```typescript
const YES = 1;
const NO = 0;
const INVALID = 2;

const winningOutcome = await truthMarket.winningOutcome();

switch (winningOutcome) {
    case NO:
        console.log("NO won - NO holders get full payout");
        break;
    case YES:
        console.log("YES won - YES holders get full payout");
        break;
    case INVALID:
        console.log("INVALID - Everyone gets 50% back");
        break;
}
```

## Historical Note

Prior to this refinement, the AMMEngine used inverted semantics (0=YES, 1=NO) which was inconsistent with TruthMarket. This has been corrected for protocol-wide consistency.

## Testing Constants

All test files should use:

```solidity
// Correct outcome constants
uint8 constant YES = 1;
uint8 constant NO = 0;
uint8 constant INVALID = 2;
```
