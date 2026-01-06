# AMMEngine - LMSR Position Trading with 24h Locks

**File**: `packages/contracts-core/src/AMMEngine.sol` (643 lines)  
**Status**: Stable  
**Version**: V10.0.0

---

## Overview

`AMMEngine` is a **position-based AMM** using **LMSR (Logarithmic Market Scoring Rule)** pricing. It provides:

- Continuous liquidity (no order book needed)
- Automatic probability pricing
- 24-hour sell locks (prevent informed traders from dominating)
- Non-transferable positions (isolation from token market)
- Direct USDC transfers

### Key Design
- **Domain Isolated**: Separate from TickBook - users can use both
- **Non-transferable**: Positions locked to user, no MEV
- **Direct USDC**: No vault dependency, pull-based transfers
- **LMSR Math**: Log-sum-exp for smooth probability curves

---

## LMSR Pricing Model

### The Formula

```
Cost to buy X shares of outcome O:
    C = b * ln(exp(Q_yes/b) + exp(Q_no/b)) - baseline
```

Where:
- `b` = Liquidity parameter (determines price sensitivity)
- `Q_yes` = Current YES quantity
- `Q_no` = Current NO quantity

### Intuition

```
Starting state: Q_yes = 0, Q_no = 0 -> 50/50 probability
Buy 100 YES shares

Cost in USDC ~ 55 USDC (slightly more than 50% due to slippage)

New state: Q_yes = 100, Q_no = 0
New YES price ~ 52% (more likely now)
```

### Price Calculation

```solidity
// From LMSRMath library
function calculateProbability(
    uint256 b,
    uint256 qYes,
    uint256 qNo
) internal pure returns (uint256 priceWad)
```

---

## Data Structures

### Position

```solidity
struct Position {
    uint256 yesShares;              // YES outcome shares
    uint256 noShares;               // NO outcome shares
}
```

### Market State

```solidity
struct MarketState {
    uint256 qYes;           // YES quantity (WAD)
    uint256 qNo;            // NO quantity (WAD)
    uint256 liquidity;      // Liquidity parameter b (WAD)
    bool initialized;
}
```

### Lock Entry

```solidity
struct LockEntry {
    uint256 amount;         // Amount locked
    uint64 expiry;          // When lock expires
    address market;         // Which market
}
```

---

## Core Functions

### 1. Trade Positions

```solidity
function tradePositions(
    address market,
    uint8 outcome,      // 0=NO, 1=YES
    int256 deltaShares,
    uint256 maxCostOrMinProceeds
) external returns (uint256 actualCost)
```

**For Buys** (`deltaShares > 0`):
1. Calculate cost using LMSR formula
2. Check `actualCost <= maxCostOrMinProceeds` (slippage)
3. Use available balance first, then pull from wallet
4. Update market state (qYes/qNo)
5. Update user position

**For Sells** (`deltaShares < 0`):
1. Check user has enough shares
2. Calculate proceeds using inverse LMSR
3. Apply fee (deducted by router)
4. Add proceeds to locked balance (24h lock)
5. Update market state and position

**Gas**: ~150k-200k

**Example: Buy**
```solidity
// Buy 100 YES shares at current market price
uint256 cost = ammEngine.tradePositions(
    market,
    1,        // YES
    100e18,   // 100 shares
    150e18    // max cost 150 USDC
);
```

---

### 2. Trade Positions For (Router)

```solidity
function tradePositionsFor(
    address user,
    address market,
    uint8 outcome,
    int256 deltaShares,
    uint256 maxCostOrMinProceeds,
    uint256 fee
) external onlyRouter returns (uint256 actualCost)
```

**Caller**: Only LaunchpadEngine (router)  
**Purpose**: Execute trades with fee handling

---

### 3. Increase Liquidity

```solidity
function increaseLiquidity(address market, uint256 deltaLiquidity) external onlyRouter
```

**Caller**: Only router  
**Effect**: Increases `b` parameter, making prices more stable

---

### 4. Claim Unlocked

```solidity
function claimUnlocked(uint256 maxClaims) external returns (uint256 totalUnlocked)
```

**What it does**:
- Iterates through user's lock queue
- Claims all entries where `block.timestamp >= expiry`
- Transfers USDC to user
- Removes claimed entries

**Example**:
```solidity
// Claim up to 20 expired locks
uint256 claimed = ammEngine.claimUnlocked(20);
// claimed = total USDC transferred
```

---

### 5. Get Position Quote

```solidity
function getPositionQuote(
    address market,
    uint8 outcome,
    int256 deltaShares
) external view returns (uint256 cost, uint256 newPrice)
```

**Returns**:
- `cost`: USDC required (buy) or received (sell)
- `newPrice`: Probability after trade

---

## 24h Lock Mechanism

### Why Locks?

Prevents **informed trading attacks**:
1. Insider knows outcome before market
2. Buys winning side at favorable price
3. Immediately sells after public info
4. LPs lose money to informed trader

With 24h locks:
- Insider must wait 24h before selling
- Public info typically arrives within 24h
- Prices adjust, reducing attack profit

### How It Works

```solidity
// On sell, proceeds are locked
_availableBalance[user] += proceeds;
_lockedBalance[user] += proceeds;

_lockQueue[user].push(LockEntry({
    amount: proceeds,
    expiry: uint64(block.timestamp + 24 hours),
    market: market
}));
```

### Balance Types

| Balance | Can Spend on Buys | Can Withdraw |
|---------|-------------------|--------------|
| Available | Yes | Only unlocked portion |
| Locked | Yes (for buys) | No (until expiry) |

---

## Settlement

### Settle Position

```solidity
function settlePosition(address market) external returns (uint256 payout)
```

**Caller**: Any user with position  
**Precondition**: Market must be settled  
**Effect**:
1. Read winning outcome from TruthMarket
2. Calculate payout based on position
3. Clear user position
4. Transfer USDC

**Payout Formula**:
```solidity
if (winningOutcome == 1) {
    // YES won: pay full value for YES shares
    payout = yesShares;
} else if (winningOutcome == 0) {
    // NO won: pay full value for NO shares
    payout = noShares;
} else {
    // INVALID (2): 50% of total position
    payout = (yesShares + noShares) / 2;
}
```

---

## View Functions

```solidity
// Get user's position
function getPosition(address market, address user)
    external view returns (uint256 yesShares, uint256 noShares)

// Get market state
function getMarketState(address market)
    external view returns (uint256 qYes, uint256 qNo, uint256 price)

// Get liquidity parameter
function getLiquidity(address market) external view returns (uint256)

// Get user balances
function getBalances(address user) external view returns (uint256 available, uint256 locked)

// Get lock queue
function getLockQueue(address user) external view returns (LockEntry[] memory)

// Get claimable amount
function getClaimableAmount(address user)
    external view returns (uint256 claimable, uint64 nextUnlock, uint256 nextAmount)
```

---

## Events

```solidity
event PositionTraded(
    address indexed user,
    address indexed market,
    uint8 outcome,
    int256 deltaShares,
    uint256 cost,
    uint256 newQYes,
    uint256 newQNo
);

event ProceedsLocked(
    address indexed user,
    address indexed market,
    uint256 amount,
    uint64 expiry
);

event ProceedsClaimed(
    address indexed user,
    address indexed market,
    uint256 amount
);

event LiquidityIncreased(
    address indexed market,
    uint256 deltaLiquidity,
    uint256 newLiquidity
);

event PositionSettled(
    address indexed user,
    address indexed market,
    uint8 winningOutcome,
    uint256 yesShares,
    uint256 noShares,
    uint256 payout
);
```

---

## Invariants

1. **Reserve Conservation**: `qYes + qNo` grows with each trade (LMSR property)
2. **Position Ownership**: Only position holder can trade/settle
3. **Locked <= Available**: `_lockedBalance[user] <= _availableBalance[user]`
4. **24h Lock**: Cannot withdraw proceeds until lock expires

---

## Security Considerations

### Reentrancy
- `nonReentrant` on settlement

### Access Control
- `onlyRouter` for privileged functions
- User can only trade their own position

### Arithmetic
- All math uses WAD precision (1e18)
- SafeERC20 for transfers
- Overflow protection (Solidity 0.8+)

---

## Integration with LaunchpadEngine

```solidity
// LaunchpadEngine wraps AMMEngine
function tradePositions(...) external {
    // 1. Calculate fee
    uint16 feeBps = state.isGraduated ? postGradFeeBps : preGradFeeBps;
    uint256 fee = (baseCost * feeBps) / BPS_DENOMINATOR;
    
    // 2. Execute trade via AMMEngine
    ammEngine.tradePositionsFor(user, market, outcome, deltaShares, ...);
    
    // 3. Distribute fee
    _distributeFee(market, fee, ...);
}
```

---

## Example Flows

### Flow 1: Simple Buy/Sell

```solidity
// 1. Buy 100 YES
ammEngine.tradePositions(market, 1, 100e18, 200e18);

// 2. Wait for price to rise
// ... time passes ...

// 3. Sell 50 YES
ammEngine.tradePositions(market, 1, -50e18, 30e18);

// 4. Proceeds locked for 24h
// 5. After 24h, claim
ammEngine.claimUnlocked(10);
```

### Flow 2: Settlement

```solidity
// Market settles as YES
// User has 100 YES, 50 NO

uint256 payout = ammEngine.settlePosition(market);
// payout = 100e18 (YES shares, NO worth 0)
```

---

## Cross-References

- [LaunchpadEngine Fee Distribution](./06-LaunchpadEngine.md)
- [TruthMarket Settlement](./02-TruthMarket.md)
- [LMSRMath Library](../../packages/contracts-core/src/libraries/LMSRMath.sol)
