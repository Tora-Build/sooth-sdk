# AMMEngine — LMSR Position Trading with 24h Locks

**File**: `packages/contracts-core/src/AMMEngine.sol` (9.1 KB)  
**Status**: ✅ Stable  
**Tests**: 30/30 passing  

---

## 📌 Overview

`AMMEngine` is a **position-based AMM** using **LMSR (Logarithmic Market Scoring Rule)** pricing. It provides:

- Continuous liquidity (no order book needed)
- Automatic probability pricing
- 24-hour sell locks (prevent informed traders from dominating)
- Non-transferable positions (isolation from token market)
- Retroactive settlement via T* (truth-time)

### Key Design
- **Domain Isolated**: Separate from TickBook — users can use both
- **Non-transferable**: Positions locked to user, no MEV
- **Direct USDC**: No vault dependency, pull-based transfers
- **LMSR Math**: Log-sum-exp for smooth probability curves

---

## 🎯 LMSR Pricing Model

### The Formula

```
Cost to buy X shares of outcome O:
    C = b * ln(exp(R_O(current)/b) + exp(X/b)) - sum(R * ln(exp(R_O/b) + ...))
```

Where:
- `b` = Initial liquidity parameter (determines price sensitivity)
- `R_O` = Current reserves for outcome O
- `X` = Shares to buy

### Intuition

```
Starting reserves: (1000, 1000) — 50/50 probability
Buy 100 YES shares

Cost in USDC = 50 * ln(e^(1000/50) + e^(100/50)) - ...
            ≈ 55 USDC (approx)

New reserves: (1000, 1100) — shifted toward YES
New price: ~52% (YES now more likely)
```

### Implementation

```solidity
library LMSRMath {
    // Core LMSR calculation
    function cost(
        uint256 b,           // Liquidity parameter
        uint256 reserves_no,
        uint256 reserves_yes,
        uint256 shares,
        uint8 outcome
    ) internal pure returns (uint256 costWad)
    
    // Inverse: how many shares for given cost
    function sharesForCost(
        uint256 b,
        uint256 reserves_no,
        uint256 reserves_yes,
        uint256 costWad,
        uint8 outcome
    ) internal pure returns (uint256 shares)
}
```

---

## 📊 Data Structures

### Position

```solidity
struct Position {
    uint128 sharesYes;              // YES outcome shares
    uint128 sharesNo;               // NO outcome shares
    uint128 usdcSpent;              // Total USDC invested
    uint64 lastSellTimestamp;       // For 24h lock enforcement
}
```

### Market State

```solidity
struct MarketState {
    uint256 b;                      // LMSR liquidity parameter
    uint256 reservesYes;            // Total YES shares (WAD)
    uint256 reservesNo;             // Total NO shares (WAD)
    uint256 feesCollected;          // Cumulative protocol fees
}
```

---

## 🎮 Core Functions

### 1. Buy Shares

```solidity
function buy(
    address market,
    uint8 outcome,      // 0=NO, 1=YES
    uint256 shares,
    uint256 maxCost
) external returns (uint256 costWad)
```

**Flow**:
1. Calculate cost using LMSR formula
2. Check `costWad ≤ maxCost` (slippage protection)
3. Collect fees (5% pre-grad, 1% post-grad)
4. Transfer USDC from user to vault
5. Update reserves and user position
6. Update `lastSellTimestamp` to enforce 24h lock

**Gas**: ~150k-200k  
**Reverts if**:
- Market not live
- Cost exceeds `maxCost`
- USDC transfer fails

**Example**:
```solidity
// Buy 100 YES shares at current market price
uint256 cost = ammEngine.buy(market, 1, 100e18, 150e18);
// If cost > 150 USDC, reverts (slippage)
// Otherwise, user now holds 100 YES shares
```

---

### 2. Sell Shares

```solidity
function sell(
    address market,
    uint8 outcome,
    uint256 shares,
    uint256 minProceeds
) external returns (uint256 proceedsWad)
```

**Requirements**:
- User must hold `≥ shares` of outcome
- `block.timestamp ≥ lastSellTimestamp + 24 hours` (24h lock)

**Flow**:
1. Check 24h lock elapsed
2. Calculate proceeds using inverse LMSR
3. Deduct fees
4. Update reserves
5. Transfer USDC to user
6. Update `lastSellTimestamp`

**24h Lock Rationale**: 
- Prevents informed traders (who know the outcome) from dumping
- Ensures liquidity providers can compete
- Adds delay before settlement arbitrage

**Example**:
```solidity
// Sell 50 YES shares
uint256 proceeds = ammEngine.sell(market, 1, 50e18, 20e18);
// Must have waited 24h since last buy/sell
// If proceeds < 20 USDC, reverts (slippage)
```

---

### 3. Get Price

```solidity
function getPrice(
    address market,
    uint8 outcome
) external view returns (uint256 probabilityWad)
```

**Returns**: Probability as WAD (0-1e18)  
**Formula**: `exp(reserves_O / b) / sum(exp(reserves/b))`

**Examples**:
```
Reserves: (1000, 1000) → YES price = 0.5e18 (50%)
Reserves: (800, 1200) → YES price = 0.6e18 (60%)
Reserves: (500, 1500) → YES price = 0.75e18 (75%)
```

---

### 4. Settlement & Redemption

```solidity
function redeemAfterSettlement(
    address market,
    uint256 minProceeds
) external returns (uint256 proceedsWad)
```

**Caller**: Any user with position  
**Preconditions**: Market must be `FINALIZED`  
**Effect**:
- Read winning outcome from TruthMarket
- Calculate proceeds based on outcome
- Zero out user position
- Transfer USDC

**Payout Formula**:
```solidity
if (outcome == YES) {
    proceeds = sharesYes;           // NO worth 0
} else if (outcome == NO) {
    proceeds = sharesNo;            // YES worth 0
} else {  // INVALID
    proceeds = (sharesYes + sharesNo) / 2;  // 50/50 split
}
```

---

## 🔒 Access Control & Invariants

### Invariants

1. **Reserve Conservation**: During trading, total `(reservesYes + reservesNo)` grows with each trade
2. **Position Ownership**: Only position holder can sell/redeem their shares
3. **24h Lock**: Cannot sell within 24 hours of last trade
4. **Fee Consistency**: All trades pay the configured fee rate
5. **Settlement Lock**: Can only redeem after market finalization

### State Transitions

```
CREATED        → market not tradeable
   ↓
LIVE          → buy/sell enabled
   ↓
SETTLING      → no new buy/sell (wait for settlement)
   ↓
FINALIZED     → redeem enabled, all trades frozen
```

---

## 💡 Use Cases

### LP Strategy
```solidity
// Creator deposits 100 USDC → (100 YES, 100 NO)
ammEngine.buy(market, 1, 100e18, 150e18);  // Buy YES
ammEngine.buy(market, 0, 100e18, 150e18);  // Buy NO
// Now holds 100/100 balanced position
// As markets trade (YES goes to 60%), position value increases
// Creator earns from spread
```

### Trader Strategy
```solidity
// Predict YES will win, buy YES
ammEngine.buy(market, 1, 200e18, 300e18);  // Buy 200 YES
// Wait 24h
ammEngine.sell(market, 1, 200e18, 250e18);  // Sell when price rises
// Profit = proceeds (250) - cost (300) = -50 (loss in this case)
```

### Arbitrageur (Cross-Venue)
```solidity
// If TickBook YES price > AMMEngine YES price:
// 1. Buy YES on AMMEngine (cheaper)
// 2. Sell YES on TickBook (more expensive)
// 3. Profit from spread
// (But 24h lock prevents instant arb!)
```

---

## 📈 Graduation Impact

### Pre-Graduation (0-100% of threshold)
- Fee: 5% per trade
- User position subject to 24h lock
- Creator accumulates fees in LaunchpadEngine

### Post-Graduation (>100% of threshold)
- Fee: 1% per trade
- 24h lock still applies (safety)
- Fees split 4 ways:
  - 50% → `bBase` growth (reserves increase)
  - 30% → LP yields
  - 20% → protocol treasury

---

## ⚠️ Security & Limitations

### Known Limitations

1. **24h Lock for Everyone**: Even long-term LPs can't rebalance quickly
2. **LMSR Curvature**: Price can move dramatically with large trades
3. **No Emergency Pause**: If bug found, users stuck in positions
4. **T* Placeholder**: Retroactive settlement not fully implemented

### Mitigations

- ✅ Input validation on all parameters
- ✅ Slippage protection (`maxCost`, `minProceeds`)
- ✅ ReentrancyGuard on all state-changing functions
- ✅ SafeERC20 for transfers
- ✅ All math uses WAD precision (1e18)

---

## 🧮 Examples

### Example 1: Simple Trade

```solidity
// Market conditions: b = 50e18, reserves = (50e18, 50e18)
// Current YES price = 50%

// User buys 10 YES shares
uint256 cost = ammEngine.buy(market, 1, 10e18, 20e18);
// cost ≈ 5e18 (10 shares × 50%)
// Plus 5% fee = 5.25e18 total
// (In WAD: 5250000000000000000)

// Reserves now: (50, 60) — YES more likely
// New YES price ≈ 55%

// User waits 24h, then sells
uint256 proceeds = ammEngine.sell(market, 1, 10e18, 4e18);
// proceeds ≈ 5.5e18 (10 shares × 55%)
// Minus 1% fee = 5.445e18
// Profit = 5.445 - 5.25 = 0.195 USDC
```

### Example 2: Invalid Outcome

```solidity
// Market settles as INVALID (outcome = 2)
// User position: 50 YES, 50 NO

// Redeem after finalization
uint256 payout = ammEngine.redeemAfterSettlement(market, 0);
// payout = (50 + 50) / 2 = 50 USDC (50/50 split)
```

---

## 🔗 Cross-References

- [LMSR Math Library](./LIBRARIES.md#lmsrmath)
- [LaunchpadEngine Fee Distribution](./06-LaunchpadEngine.md)
- [TruthMarket Settlement](./02-TruthMarket.md)
- [ADR-064: Fill Overflow Fixes](../../DECISIONS.md#adr-064)

---

## 📚 Additional Resources

- **LMSR Paper**: Hanson, "Logarithmic Market Scoring Rules for Modular Combinatorial Information Aggregation" (2002)
- **24h Lock Rationale**: [ADR-054](../../DECISIONS.md) — Prevents informed trading attacks
- **Test Suite**: `packages/contracts-testing/test/v8/AMMEngine.t.sol`
