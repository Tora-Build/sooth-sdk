# Security Patterns in Valencia V8

This document describes the security patterns implemented across Valencia V8 smart contracts.

## Reentrancy Protection

### ReentrancyGuard Usage

All contracts with external state-changing functions inherit from OpenZeppelin's `ReentrancyGuard`:

```solidity
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AMMEngine is IAMMEngine, Ownable, ReentrancyGuard {
    function settlePosition(address market)
        external
        override
        nonReentrant  // Protected
        returns (uint256 payout)
    {
        // ...
    }
}
```

### Protected Functions by Contract

| Contract | Protected Functions |
|----------|---------------------|
| `AMMEngine` | `settlePosition()` |
| `Collateralizer` | `split()`, `merge()`, `redeem()`, `redeemOutcome()` |
| `TickBook` | `placeLimitOrder()`, `cancelOrder()`, `executeMarketOrder()` |
| `TickBookV2` | `executeSpotSell()`, `executeMarketOrder()`, `executeHybridSell()` |
| `TickBookVault` | `depositUsdc()`, `withdrawUsdc()`, `redeemResolved()` |
| `LaunchpadEngine` | `createMarket()`, `tradePositions()`, `redeemLP()`, `increaseBBase()` |

### Avoiding External Self-Calls

External calls to `this.function()` bypass the reentrancy guard because they create a new call context. Always use internal functions:

```solidity
// BAD: Bypasses reentrancy guard
function executeHybridSell(...) external nonReentrant {
    this.executeSpotSell(...);  // New call context!
}

// GOOD: Uses internal function
function executeHybridSell(...) external nonReentrant {
    _executeSpotSellInternal(...);  // Same call context
}
```

---

## Checks-Effects-Interactions (CEI) Pattern

All functions follow CEI to prevent reentrancy attacks:

### Example: AMMEngine.settlePosition()

```solidity
function settlePosition(address market) external override nonReentrant returns (uint256 payout) {
    // 1. CHECKS
    require(ITruthMarket(market).isSettled(), "AMMEngine: not settled");
    Position storage position = _positions[market][msg.sender];
    require(position.yesShares > 0 || position.noShares > 0, "AMMEngine: no position");

    // Cache values before clearing
    uint256 yesShares = position.yesShares;
    uint256 noShares = position.noShares;

    // 2. EFFECTS (state changes before external calls)
    position.yesShares = 0;
    position.noShares = 0;

    // Calculate payout...

    // 3. INTERACTIONS (external calls last)
    if (payout > 0) {
        usdc.safeTransfer(msg.sender, _wadToUsdc(payout));
    }
}
```

### Example: Collateralizer.merge()

```solidity
function merge(address market, uint256 amount) external override nonReentrant {
    // 1. CHECKS
    require(amount > 0, "Collateralizer: zero amount");
    MarketTokens memory tokens = _getTokens(market);

    // 2. EFFECTS (burns before transfer)
    tokens.yesToken.burn(msg.sender, amount);
    tokens.noToken.burn(msg.sender, amount);

    // 3. INTERACTIONS
    usdc.safeTransfer(msg.sender, _wadToUsdc(amount));
}
```

---

## Safe Token Operations

### Using SafeERC20

All USDC operations use OpenZeppelin's SafeERC20:

```solidity
using SafeERC20 for IERC20;

// Safe transfer (reverts on failure)
usdc.safeTransfer(recipient, amount);

// Safe transferFrom
usdc.safeTransferFrom(sender, recipient, amount);

// Safe approve (handles non-standard tokens)
usdc.forceApprove(spender, amount);
```

### forceApprove vs approve

Some tokens (like USDT) don't allow `approve()` when current allowance is non-zero. Use `forceApprove()`:

```solidity
// BAD: May fail with USDT-like tokens
usdc.approve(spender, amount);

// GOOD: Handles all edge cases
usdc.forceApprove(spender, amount);
```

---

## Access Control

### Owner-Only Functions

Administrative functions use OpenZeppelin's `Ownable`:

```solidity
contract AMMEngine is IAMMEngine, Ownable, ReentrancyGuard {
    function setRouter(address _router) external onlyOwner {
        router = _router;
    }
}
```

### Role-Based Access

TruthMarket uses role-based access:

```solidity
// Only adjudicator can settle
function settle(uint8 outcome, uint64 _tStar) external {
    require(msg.sender == adjudicator, "TruthMarket: not adjudicator");
}

// Only guardian can veto
function veto() external {
    require(msg.sender == guardian, "TruthMarket: not guardian");
}

// Only creator can activate
function activate() external {
    require(msg.sender == creator, "TruthMarket: not creator");
}
```

### TickBook Authorization

TickBook operations require vault authorization:

```solidity
modifier onlyTickBook() {
    require(msg.sender == tickBook, "TickBookVault: only tickBook");
    _;
}

function creditOutcome(...) external onlyTickBook { ... }
function reserveUsdc(...) external onlyTickBook { ... }
```

---

## Input Validation

### Outcome Validation

All functions accepting outcome validate the value:

```solidity
require(outcome <= 1, "invalid outcome");  // For trading (0 or 1)
require(outcome <= 2, "invalid outcome");  // For settlement (0, 1, or 2)
```

### Amount Validation

Zero amounts are rejected:

```solidity
require(amount > 0, "zero amount");
require(shares > 0, "zero shares");
```

### Tick Range Validation

TickBook validates tick ranges:

```solidity
require(tickLower <= tickUpper, "invalid range");
require(tickLower >= MIN_TICK && tickUpper <= MAX_ORDER_TICK, "tick out of range");
```

---

## State Validation

### Market State Checks

Functions validate market lifecycle state:

```solidity
// Trading requires live market
require(ITruthMarket(market).isLive(), "not live");

// Settlement requires settled market
require(ITruthMarket(market).isSettled(), "not settled");
```

### Balance Checks

Sufficient balance is verified before operations:

```solidity
require(position.yesShares >= absDelta, "insufficient YES shares");
require(_availableUsdcWad[user] >= amountWad, "insufficient available");
```

---

## Event Emission

### Audit Trail

All state changes emit events for off-chain tracking:

```solidity
emit PositionTraded(user, market, outcome, deltaShares, cost, newQYes, newQNo);
emit PositionSettled(user, market, winningOutcome, yesShares, noShares, payout);
emit MarketActivated(market, block.timestamp);
emit MarketVetoed(market, previousOutcome, previousTStar);
```

### Indexed Parameters

Key parameters are indexed for efficient filtering:

```solidity
event PositionSettled(
    address indexed user,     // Indexed for user queries
    address indexed market,   // Indexed for market queries
    uint8 winningOutcome,
    uint256 yesShares,
    uint256 noShares,
    uint256 payout
);
```

---

## Upgrade Safety

### TickBookVault Upgrade Pattern

The vault allows tickBook updates for migration:

```solidity
function setTickBook(address _tickBook) external onlyOwner {
    require(_tickBook != address(0), "zero tickBook");
    address previousTickBook = tickBook;
    tickBook = _tickBook;
    emit TickBookSet(_tickBook);

    if (previousTickBook != address(0)) {
        emit TickBookUpdated(previousTickBook, _tickBook);
    }
}
```

**Security Note**: Previous tickBook loses authorization immediately. Ensure:
1. No pending orders in old tickBook
2. Users have withdrawn/canceled before migration
3. New tickBook is properly tested

---

## Common Pitfalls Avoided

1. **No `tx.origin` usage** - Always use `msg.sender`
2. **No unchecked external calls** - All use SafeERC20
3. **No floating pragma** - Pinned to `^0.8.20`
4. **No assembly** - Pure Solidity for auditability
5. **No selfdestruct** - Contracts are permanent
6. **No delegatecall** - No proxy patterns
