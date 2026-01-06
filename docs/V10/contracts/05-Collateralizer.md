# Collateralizer - Token Split/Merge/Redeem

**File**: `packages/contracts-core/src/Collateralizer.sol` (331 lines)  
**Status**: Stable  
**Version**: V10.0.0

---

## Overview

`Collateralizer` manages the core **prediction market token mechanics**:

- **Split**: 1 USDC -> 1 YES token + 1 NO token
- **Merge**: 1 YES + 1 NO -> 1 USDC (reverse operation)
- **Redeem**: After market settles, exchange winning tokens for full USDC value

This contract is the **bridge between USDC and outcome tokens** for the TickBook venue.

### Key Properties
- **1:1:1 Invariant**: 1 USDC always = 1 YES + 1 NO
- **Atomic Operations**: Split/merge in single transaction
- **Settlement-Aware**: Only allows redeem after finalization
- **INVALID Handling**: 50/50 payout if outcome is INVALID

---

## Token Model

### Outcome Tokens (YES/NO)

```solidity
contract OutcomeToken is ERC20 {
    address public collateralizer;  // Can mint/burn
    address public market;          // For tracking
    uint8 public outcome;           // 0=NO, 1=YES
}
```

Each market gets two ERC20 tokens:
- `MarketName - YES` (outcome 1)
- `MarketName - NO` (outcome 0)

Both tokens are created when market is first registered.

---

## State Variables

```solidity
IERC20 public immutable usdc;
uint8 private immutable usdcDecimals;  // Cached for conversions

mapping(address => MarketTokens) private _marketTokens;

struct MarketTokens {
    OutcomeToken yesToken;
    OutcomeToken noToken;
    bool registered;
}
```

---

## Core Functions

### 1. Register Market

```solidity
function registerMarket(
    address market,
    string calldata name,
    string calldata symbol
) external returns (address yesToken, address noToken)
```

**One-time call per market** (usually by LaunchpadEngine)

**Effect**:
- Deploys `OutcomeToken(name+"-YES", symbol+"-YES", ...)`
- Deploys `OutcomeToken(name+"-NO", symbol+"-NO", ...)`
- Stores references for later use

**Example**:
```solidity
(address yes, address no) = collateralizer.registerMarket(
    market,
    "Bitcoin 100k",
    "BTC100K"
);
// Returns:
// - YES token: "Bitcoin 100k - YES" (BTC100K-YES)
// - NO token: "Bitcoin 100k - NO" (BTC100K-NO)
```

---

### 2. Split

```solidity
function split(address market, uint256 amount) external nonReentrant
```

**Caller**: Anyone with USDC  
**Precondition**: Market must be registered  
**Effect**:
1. Transfer `amount` USDC from user to Collateralizer
2. Mint `amount` YES tokens to user
3. Mint `amount` NO tokens to user
4. User now holds balanced position

**Example**:
```solidity
// User has 1000 USDC
usdc.approve(collateralizer, 1000e6);  // 6 decimals
collateralizer.split(market, 1000e18); // WAD amount

// After:
// - USDC balance: 0
// - YES balance: 1000e18 (WAD precision)
// - NO balance: 1000e18
```

**Key Insight**: Split creates a **balanced position** where YES + NO = 0 net exposure (until you sell one token).

---

### 3. Merge

```solidity
function merge(address market, uint256 amount) external nonReentrant
```

**Caller**: Anyone with YES and NO tokens  
**Precondition**: Must have at least `amount` of BOTH YES and NO  
**Effect**:
1. Burn `amount` YES tokens
2. Burn `amount` NO tokens
3. Transfer `amount` USDC to user

**Example**:
```solidity
// User holds 500 YES, 500 NO
collateralizer.merge(market, 300e18);

// After:
// - YES balance: 200
// - NO balance: 200
// - USDC balance: +300
```

**Use Case**: Arbitrage between TickBook and AMM prices

---

### 4. Redeem

```solidity
function redeem(address market, uint256 amount)
    external
    nonReentrant
    returns (uint256 usdcAmount)
```

**Caller**: Anyone with tokens  
**Precondition**: Market must be settled  
**Effect**:
1. Read `winningOutcome` from TruthMarket
2. Burn tokens based on outcome
3. Transfer USDC equivalent

**Payout Table**:

| Outcome | User Has | Action | USDC Payout |
|---------|----------|--------|-------------|
| YES (1) | YES tokens | Burn YES | Full value |
| YES (1) | NO tokens | Burn NO | 0 |
| NO (0) | YES tokens | Burn YES | 0 |
| NO (0) | NO tokens | Burn NO | Full value |
| INVALID (2) | Either | Burn both | 50% each |

**INVALID Special Case**:
For INVALID, user must pass equal amounts of BOTH tokens:
```solidity
// INVALID outcome - burn both for full refund
collateralizer.redeem(market, 100e18);
// Burns 100 YES + 100 NO, returns 100 USDC
```

---

### 5. Redeem Outcome (Granular)

```solidity
function redeemOutcome(
    address market,
    uint8 outcome,
    uint256 amount
) external nonReentrant returns (uint256 usdcAmount)
```

**Purpose**: Redeem a specific outcome token type

**For INVALID**: Each token type redeems for 50%
```solidity
// INVALID outcome
collateralizer.redeemOutcome(market, 1, 100e18);  // 100 YES -> 50 USDC
collateralizer.redeemOutcome(market, 0, 100e18);  // 100 NO -> 50 USDC
```

---

## View Functions

```solidity
// Get outcome token addresses
function getOutcomeTokens(address market)
    external view returns (address yesToken, address noToken)

// Get user's token balances
function getBalances(address market, address user)
    external view returns (uint256 yesBalance, uint256 noBalance)

// Get total collateral locked
function getTotalCollateral(address market)
    external view returns (uint256)

// Check if market is settled
function isMarketSettled(address market) public view returns (bool)

// Get redemption value for outcome
function getRedemptionValue(address market, uint8 outcome)
    external view returns (uint256)

// Check if market is registered
function isMarketRegistered(address market) external view returns (bool)
```

---

## Events

```solidity
event Split(
    address indexed user,
    address indexed market,
    uint256 usdcAmount,
    uint256 tokenAmount
);

event Merged(
    address indexed user,
    address indexed market,
    uint256 tokenAmount,
    uint256 usdcAmount
);

event Redeemed(
    address indexed user,
    address indexed market,
    uint8 outcome,
    uint256 tokenAmount,
    uint256 usdcAmount
);
```

---

## Invariants

### 1:1:1 Conservation

At all times:
```
USDC held by Collateralizer 
    == Sum of all user YES balances
    == Sum of all user NO balances
```

**Why**: Each split mints equal YES/NO, each merge burns equal YES/NO.

### Settlement Finality

Can only redeem after:
1. Market state = `SETTLED` or `FINALIZED`
2. Outcome locked in TruthMarket

### Atomic Split/Merge

Split and merge happen atomically - no partial states.

---

## Security Considerations

### Reentrancy
- `nonReentrant` guard on split/merge/redeem

### Access Control
- Only Collateralizer can mint/burn outcome tokens
- Users need to approve USDC for split

### Arithmetic
- All conversions use WAD precision (1e18)
- USDC decimals handled at entry/exit points
- Ceiling conversion for transfers TO contract
- Floor conversion for transfers FROM contract

---

## Typical User Flows

### Flow 1: Simple HODL + Redeem

```
1. Split 1000 USDC -> 1000 YES + 1000 NO
2. Sell 600 YES on TickBook for 350 USDC
3. Wait for settlement (YES wins)
4. Redeem 400 remaining YES -> 400 USDC
5. Redeem 1000 NO -> 0 USDC
Total: 350 + 400 = 750 USDC (vs 1000 initial)
```

### Flow 2: Arbitrage

```
1. Split 1000 USDC -> YES/NO
2. Notice YES expensive on TickBook (80% price)
3. Sell 500 YES for 400 USDC on TickBook
4. Merge remaining 500 YES + 500 NO -> 500 USDC
5. Total: 400 + 500 = 900 USDC
6. Net: -100 (if you sold at wrong price) or profit
```

### Flow 3: LP + Winnings

```
1. Split 1000 USDC -> YES/NO
2. Provide liquidity on TickBook
3. Market trades, LP earns fees
4. When settled (YES wins), redeem winnings
5. Total = split value + LP fees + outcome profits
```

---

## Integration Points

### LaunchpadEngine

```solidity
// LaunchpadEngine calls during graduation
(address yes, address no) = collateralizer.registerMarket(market, name, symbol);
```

### TickBook

```solidity
// Users split USDC first
collateralizer.split(market, 1000e18);

// Then trade YES/NO tokens on TickBook
// TickBook transfers tokens directly (ERC20 approval)
```

### TruthMarket

```solidity
// Collateralizer queries settlement state
if (ITruthMarket(market).isSettled()) {
    uint8 outcome = ITruthMarket(market).winningOutcome();
    uint256 value = ITruthMarket(market).getRedemptionValue(outcome);
}
```

---

## WAD/USDC Conversion

```solidity
// To USDC (floor - for transfers OUT)
function _wadToUsdc(uint256 wadAmount) internal view returns (uint256) {
    if (usdcDecimals == 18) return wadAmount;
    if (usdcDecimals < 18) return wadAmount / (10 ** (18 - usdcDecimals));
    return wadAmount * (10 ** (usdcDecimals - 18));
}

// To USDC (ceiling - for transfers IN)
function _wadToUsdcCeil(uint256 wadAmount) internal view returns (uint256) {
    if (usdcDecimals < 18) {
        uint256 factor = 10 ** (18 - usdcDecimals);
        return (wadAmount + factor - 1) / factor;
    }
    // ...
}
```

---

## Cross-References

- [OutcomeToken Contract](../../packages/contracts-core/src/OutcomeToken.sol)
- [TickBook Trading](./03-TickBookPoolManager.md)
- [LaunchpadEngine Integration](./06-LaunchpadEngine.md)
- [TruthMarket Settlement](./02-TruthMarket.md)
