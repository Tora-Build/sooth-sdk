# TruthMarket - Market Lifecycle & Settlement

**File**: `packages/contracts-core/src/TruthMarket.sol` (206 lines)  
**Status**: Stable  
**Version**: V10.0.0

---

## Overview

`TruthMarket` is the **canonical source of truth** for market state. All execution venues (AMM, TickBook) query it to determine if trading is allowed, if settlement is active, etc.

It does **NOT** handle trading logic - only lifecycle and outcome determination.

---

## Market Lifecycle

```
+-------------+
|   CREATED   |  Market instantiated but not trading
+------+------+
       | creator calls activate()
       |
+------v------+
|    LIVE     |  Trading active (before deadline)
+------+------+
       | deadline passes
       |
+------v------+
|  SETTLING   |  Awaiting adjudicator outcome
+------+------+
       | adjudicator calls settle()
       |
+------v------+
|  SETTLED    |  Outcome set, guardian can veto
+------+------+
       | guardian accepts (or no veto within delay)
       |
+------v------+
| FINALIZED   |  Settlement locked, redemption enabled
+-------------+
```

### State Variables

```solidity
MarketState public state;           // Current market state
string public question;             // Market question ("Will X happen?")
uint64 public deadline;             // Unix timestamp when trading ends
address public creator;             // Market creator (only can activate)
uint8 public winningOutcome;        // 0=NO, 1=YES, 2=INVALID
uint64 public tStar;               // Retroactive truth-time (0 if N/A)

address public adjudicator;        // Authority that settles outcome
address public guardian;           // Can veto settlement
```

---

## Core Functions

### 1. Constructor

```solidity
constructor(
    string memory _question,
    uint64 _deadline,
    address _adjudicator,
    address _guardian
)
```

**Requirements**:
- `_deadline > block.timestamp` (must be future)
- `_adjudicator != address(0)`
- `_guardian != address(0)`

**State after**:
- `state = CREATED`
- Market is unclaimed and cannot trade yet

---

### 2. Activate

```solidity
function activate() external
```

**Caller**: Only market creator  
**Preconditions**: `state == CREATED` and `block.timestamp < deadline`  
**Effect**: Transitions to `LIVE`, enables trading  
**Emits**: `MarketActivated(address, timestamp)`

**Use case**: Creator prepares market, then activates when ready.

---

### 3. Settle

```solidity
function settle(uint8 outcome, uint64 _tStar) external
```

**Caller**: Only adjudicator  
**Preconditions**: `state == LIVE || state == SETTLING`, `deadline <= block.timestamp`  
**Effect**: 
- Sets `winningOutcome` (0=NO, 1=YES, 2=INVALID)
- Sets `tStar` (retroactive truth-time if applicable)
- Transitions to `SETTLED`

**Outcome Values**:
| Value | Meaning | Payout |
|-------|---------|--------|
| 0 | NO | NO token holders get USDC |
| 1 | YES | YES token holders get USDC |
| 2 | INVALID | Both holders split USDC 50/50 |

**Example**:
```solidity
// Adjudicator resolves market
truthMarket.settle(1, 0);  // YES won, no retroactive time
```

---

### 4. Veto Settlement

```solidity
function veto() external
```

**Caller**: Only guardian  
**Preconditions**: `state == SETTLED`  
**Effect**:
- Clears `winningOutcome`
- Transitions back to `SETTLING`
- Waits for re-settlement

**Use case**: Guardian detects adjudicator error and triggers re-determination.

---

### 5. Finalize

```solidity
function finalize() external
```

**Caller**: Adjudicator or guardian  
**Preconditions**: `state == SETTLED`  
**Effect**: Transitions to `FINALIZED`, locks outcome  
**Irreversible**: Once finalized, outcome cannot be changed

---

## View Functions

```solidity
// Check if market is currently trading
function isLive() external view returns (bool)

// Check if market is awaiting settlement
function isSettling() external view returns (bool)

// Check if market is settled and can be redeemed
function isSettled() external view returns (bool)

// Check if market is fully finalized
function isFinalized() external view returns (bool)

// Get redemption value for an outcome
function getRedemptionValue(uint8 outcome) external view returns (uint256)
```

---

## Invariants

1. **Monotonic Progression**: State only moves forward (CREATED -> LIVE -> SETTLING -> SETTLED -> FINALIZED), except veto can revert SETTLED -> SETTLING
2. **Deadline Immutable**: Cannot change deadline after creation
3. **Outcome Locked**: Once finalized, `winningOutcome` cannot change
4. **Trading Window**: `isLive()` returns false after deadline even if not yet settled

---

## Events

```solidity
event MarketActivated(address indexed market, uint256 activatedAt);
event MarketSettled(address indexed market, uint8 outcome, uint64 tStar);
event MarketVetoed(address indexed market, uint8 previousOutcome, uint64 previousTStar);
event MarketFinalized(address indexed market);
```

---

## Integration Points

### How AMMEngine Uses It
```solidity
// Before allowing trades
require(truthMarket.isLive(), "Market not live");

// On settlement
if (truthMarket.isSettled()) {
    winningOutcome = truthMarket.winningOutcome();
    // Calculate payouts
}
```

### How TickBook Uses It
```solidity
// Check market is active
require(truthMarket.isLive(), "Market not live");

// After deadline, prevent new orders
if (block.timestamp >= truthMarket.deadline()) {
    revert MarketNotLive();
}
```

### How Collateralizer Uses It
```solidity
// Only allow redeem after finalization
require(truthMarket.isSettled(), "Not settled yet");
uint8 outcome = truthMarket.winningOutcome();

if (outcome == 0) {
    // NO won: give NO token holders full value
    uint256 payout = noTokens;
} else if (outcome == 1) {
    // YES won: give YES token holders full value
    uint256 payout = yesTokens;
} else {
    // INVALID: 50/50 split
    uint256 payout = (yesTokens + noTokens) / 2;
}
```

---

## Security Considerations

### Access Control
- Only creator can activate
- Only adjudicator can settle
- Only guardian can veto
- Only adjudicator/guardian can finalize

### Reentrancy
- No external calls, pure state transitions

### Timestamp Assumptions
- Relies on `block.timestamp` - can be manipulated by miners +/-15 seconds
- Guardian veto mechanism provides safety net

---

## Deployment Checklist

- [ ] Verify `_deadline` is reasonable future timestamp
- [ ] Verify `_adjudicator` is legitimate authority (DAO, multisig, Brevis ZK oracle)
- [ ] Verify `_guardian` exists
- [ ] Test full lifecycle (activate -> settle -> finalize)
- [ ] Test veto flow (settle -> veto -> re-settle -> finalize)

---

## Example Usage

```solidity
// Creator deploys market
TruthMarket market = new TruthMarket(
    "Will Bitcoin reach $100k by 2025?",
    1735689600,  // Jan 1 2025 00:00 UTC
    adjudicator,
    guardian
);

// Some time passes, market state = CREATED

// Creator activates when ready
market.activate();  // state = LIVE, trading enabled

// Users trade on AMM/TickBook

// After deadline, adjudicator settles
market.settle(1, 0);  // YES won

// Guardian accepts or no veto
market.finalize();  // state = FINALIZED

// Users can now redeem tokens for USDC
// YES token holders get full value
// NO token holders get 0
```

---

## Cross-References

- [Collateralizer Redeem Flow](./05-Collateralizer.md#redeem)
- [AMMEngine Settlement](./04-AMMEngine.md#settlement)
- [TickBook Lifecycle Checks](./03-TickBookPoolManager.md#lifecycle-enforcement)
