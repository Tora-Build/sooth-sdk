# Collateralizer — Token Split/Merge/Redeem

**File**: `packages/contracts-core/src/Collateralizer.sol` (8.5 KB)  
**Status**: ✅ Stable  
**Tests**: 9/9 passing

---

## 📌 Overview

`Collateralizer` manages the core **prediction market token mechanics**:

- **Split**: 1 USDC → 1 YES token + 1 NO token
- **Merge**: 1 YES + 1 NO → 1 USDC (reverse operation)
- **Redeem**: After market settles, exchange winning tokens for full USDC value

This contract is the **bridge between USDC and outcome tokens** for TickBook venue.

### Key Properties
- **1:1:1 Invariant**: 1 USDC always = 1 YES + 1 NO
- **Atomic Operations**: Split/merge in single transaction
- **Settlement-Aware**: Only allows redeem after finalization
- **INVALID Handling**: 50/50 payout if outcome is INVALID

---

## 🔄 Token Model

### Outcome Tokens (YES/NO)

```solidity
contract OutcomeToken is ERC20 {
    address public collateralizer;  // Can mint/burn
    address public market;          // For tracking
    uint8 public outcome;           // 0=NO, 1=YES
}
```

Each market gets two ERC20 tokens:
- `MarketName-YES` (outcome 1)
- `MarketName-NO` (outcome 0)

Both tokens are created when market is first registered.

---

## 💾 State Variables

```solidity
IERC20 public immutable usdc;
uint8 private immutable usdcDecimals;  // Cached (usually 6 on mainnet, 18 on testnet)

mapping(address => MarketTokens) private _marketTokens;

struct MarketTokens {
    OutcomeToken yesToken;
    OutcomeToken noToken;
    bool registered;
}
```

---

## 🎮 Core Functions

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
function split(
    address market,
    uint256 usdcAmount
) external
```

**Caller**: Anyone with USDC  
**Precondition**: Market must be registered  
**Effect**:
1. Transfer `usdcAmount` USDC from user to Collateralizer
2. Mint `usdcAmount` YES tokens to user
3. Mint `usdcAmount` NO tokens to user
4. User now holds balanced position (can trade one token)

**Example**:
```solidity
// User has 1000 USDC
usdc.approve(collateralizer, 1000e6);  // 6 decimals
collateralizer.split(market, 1000e6);

// After:
// - USDC balance: 0
// - YES balance: 1000e18 (WAD precision)
// - NO balance: 1000e18

// User can now:
// 1. Trade YES on TickBook (sell when price high)
// 2. Trade NO on TickBook (sell when price high)
// 3. Merge back to USDC
```

**Key Insight**: Split creates a **balanced position** where YES + NO = 0 net exposure (until you sell one token).

---

### 3. Merge

```solidity
function merge(
    address market,
    uint256 amount
) external
```

**Caller**: Anyone with YES and NO tokens  
**Precondition**: Must have at least `amount` of BOTH YES and NO  
**Effect**:
1. Burn `amount` YES tokens
2. Burn `amount` NO tokens
3. Transfer `amount` USDC to user

**Example**:
```solidity
// User holds 500 YES, 500 NO from earlier split
// User sells 200 YES for 150 USDC on TickBook
// Now holds: 300 YES, 500 NO

// Merge 300 YES + 300 NO back to USDC
collateralizer.merge(market, 300e18);

// After:
// - YES balance: 0
// - NO balance: 200
// - USDC balance: 300 (from merge)
// Plus 150 from TickBook sale = 450 total USDC
```

**Use Case**: Arbitrage between TickBook and AMM prices

---

### 4. Redeem

```solidity
function redeem(
    address market,
    uint256 amount
) external
```

**Caller**: Anyone with winning tokens  
**Precondition**: Market must be `FINALIZED`  
**Effect**:
1. Read `winningOutcome` from TruthMarket
2. Burn tokens based on outcome
3. Transfer USDC equivalent

**Payout Table**:

| Outcome | Input | Payout |
|---------|-------|--------|
| YES (1) | YES tokens | Full value |
| YES (1) | NO tokens | 0 |
| NO (0) | YES tokens | 0 |
| NO (0) | NO tokens | Full value |
| INVALID (2) | Any tokens | 50% value each |

**Example 1: YES Wins**
```solidity
// Market finalized with YES outcome
// User holds 100 YES tokens, 50 NO tokens

// Redeem YES tokens
collateralizer.redeem(market, 100e18);  // Gets 100 USDC

// Redeem NO tokens (now worthless)
collateralizer.redeem(market, 50e18);   // Gets 0 USDC
```

**Example 2: INVALID**
```solidity
// Market finalized with INVALID outcome
// User holds 100 YES, 100 NO

// Redeem YES
collateralizer.redeem(market, 100e18);  // Gets 50 USDC

// Redeem NO
collateralizer.redeem(market, 100e18);  // Gets 50 USDC

// Total: 100 USDC (full recovery)
```

---

## 📊 Invariants

### 1:1:1 Conservation

At all times:
```
USDC held by Collateralizer 
    == Sum of all user YES balances (across all markets)
    == Sum of all user NO balances (across all markets)
```

**Why**: Each split mints equal YES/NO, each merge burns equal YES/NO.

### Settlement Finality

Can only redeem after:
1. Market state = `FINALIZED`
2. Outcome locked in TruthMarket

### Atomic Split/Merge

Split and merge happen atomically — no partial states.

---

## 🔐 Security

### Reentrancy
- ✅ `nonReentrant` guard on split/merge/redeem

### Access Control
- ✅ Only Collateralizer can mint/burn outcome tokens
- ✅ No approval required for USDC (safe: users approve then call)

### Arithmetic
- ✅ All conversions use WAD precision (1e18)
- ✅ USDC decimals handled at entry/exit points

### Settlement State
- ✅ Checks TruthMarket.isSettled() before redeem
- ✅ Prevents early redemption

---

## 💡 Typical User Flows

### Flow 1: Simple HODL + Redeem

```
1. Split 1000 USDC → 1000 YES + 1000 NO
2. Sell 600 YES on TickBook for 350 USDC (price went up)
3. Wait for settlement (YES wins)
4. Redeem 400 remaining YES → 400 USDC
5. Redeem 1000 NO → 0 USDC
Total: 350 + 400 = 750 USDC (vs 1000 initial = 25% loss)
```

### Flow 2: Arbitrage

```
1. Split 1000 USDC → YES/NO
2. Notice YES expensive on TickBook (80% price)
3. Sell 500 YES for 400 USDC on TickBook
4. Merge remaining 500 YES + 500 NO → 500 USDC
5. Total USDC: 400 + 500 = 900
6. Profit = 100 (10% gain from price discrepancy)
```

### Flow 3: LP + Winnings

```
1. Split 1000 USDC → YES/NO
2. Provide liquidity on TickBook (rest 100 YES at 50% tick)
3. Market trades, LP earns fees
4. When settled (YES wins), redeem winnings
5. Still have unused YES to redeem
6. Total = split value + LP fees + outcome profits
```

---

## 🏗️ Integration with Other Contracts

### LaunchpadEngine

```solidity
// LaunchpadEngine calls during market initialization
(address yes, address no) = collateralizer.registerMarket(market, name, symbol);

// Stores token addresses for later use
// Users interact with tokens directly after split
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
if (truthMarket.isSettled()) {
    uint8 outcome = truthMarket.winningOutcome();
    // Calculate payout based on outcome
}
```

---

## 🧪 Example Test Cases

```solidity
// Test 1: Basic split → redeem (YES wins)
split(1000) → (YES: 1000, NO: 1000)
settle(YES)
redeem(YES: 1000) → 1000 USDC ✓
redeem(NO: 1000) → 0 USDC ✓

// Test 2: Merge prevents loss
split(1000)
sell 600 YES for 350 USDC (60% price)
merge(400) → 400 USDC
Total: 350 + 400 = 750 USDC
Remaining: 600 NO (worthless if YES wins)

// Test 3: INVALID outcome splits evenly
split(1000)
settle(INVALID)
redeem(YES: 1000) → 500 USDC
redeem(NO: 1000) → 500 USDC
Total: 1000 USDC (full recovery)
```

---

## ⚠️ Known Limitations

1. **No Pause**: Can't stop redemption in emergency (design choice)
2. **No Mint Limit**: Infinite YES/NO can be created if circuit breaker fails
3. **Settlement Dependency**: Must query TruthMarket for outcome (external call risk)

---

## 📚 Related Documentation

- [OutcomeToken Contract](./OutcomeToken.md)
- [TickBook Split Example](./03-TickBook.md#flow-1-market-order)
- [LaunchpadEngine Integration](./06-LaunchpadEngine.md)
- [TruthMarket Settlement](./02-TruthMarket.md)
