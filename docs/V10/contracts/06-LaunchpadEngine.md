# LaunchpadEngine - Creator Economics & Fee Distribution

**File**: `packages/contracts-core/src/LaunchpadEngine.sol` (671 lines)  
**Status**: Stable  
**Version**: V10.0.0

---

## Overview

`LaunchpadEngine` wraps the AMMEngine to add **creator economics**:

- **Market creation** with initial liquidity
- **LP token issuance** to track ownership
- **Automatic fee collection** (5% pre-grad, 1% post-grad)
- **Graduation mechanics** (threshold-based fee reduction)
- **Fee distribution** across creator, LPs, and protocol

It's the **primary entry point** for market creators.

### Key Properties
- **Dual-balance positions** (users can hold both YES and NO)
- **LP tokens track ownership** (non-fungible stake in market)
- **Automatic graduation** when fees accumulate to threshold
- **Configurable parameters** (owner can adjust fees, graduation threshold)

---

## State Variables

### Market State

```solidity
struct MarketState {
    address creator;
    uint256 bBase;              // Initial liquidity (WAD)
    uint256 bCurrent;           // Current liquidity (WAD)
    uint256 creatorDeposit;     // Initial deposit (USDC decimals)
    uint256 feesAccrued;        // Total fees collected (USDC decimals)
    uint256 totalLPSupply;      // Total LP tokens minted (WAD)
    uint256 lpYieldPool;        // Accumulated yields for LPs (USDC decimals)
    bool isGraduated;
    uint64 createdAt;
    uint64 graduatedAt;
    string name;                // Market name
    string symbol;              // Market symbol
}

mapping(address => MarketState) public markets;
address[] public allMarkets;  // For enumeration
```

### Fee Configuration

```solidity
uint16 public preGradFeeBps = 500;       // 5% pre-graduation
uint16 public postGradFeeBps = 100;      // 1% post-graduation

// Post-grad fee split
uint16 public bBaseShareBps = 5000;      // 50% to b growth
uint16 public lpYieldShareBps = 3000;    // 30% to LP yield
uint16 public protocolShareBps = 2000;   // 20% to protocol
```

### LP Tokens

```solidity
mapping(address => mapping(address => uint256)) public lpBalances;  // market => user => amount
```

---

## Core Functions

### 1. Create Market

```solidity
function createMarket(
    address market,
    uint256 initialLiquidity,
    string calldata name,
    string calldata symbol
) external nonReentrant returns (uint256 lpTokens)
```

**Caller**: Market creator (must match TruthMarket.creator)  
**Effect**:
1. Calculate required deposit: `b x ln(2)`
2. Transfer deposit from creator
3. Initialize AMM with liquidity
4. Mint LP tokens to creator
5. Store market state
6. Add to `allMarkets` array

**LP Token Minting**:
```solidity
lpTokens = depositWad;  // 1:1 with deposit in WAD
```

**Example**:
```solidity
address market = launchpadEngine.createMarket(
    truthMarket,
    1000e18,      // b = 1000 (liquidity parameter)
    "Bitcoin 100k",
    "BTC100K"
);
// Deposit = 1000 * ln(2) = ~693 USDC
// Creator receives ~693e18 LP tokens
```

---

### 2. Trade Positions

```solidity
function tradePositions(
    address market,
    uint8 outcome,
    int256 deltaShares,
    uint256 maxCostOrMinProceeds
) external nonReentrant returns (uint256 actualCost)
```

**Effect** (Buy):
1. Get quote from AMM
2. Calculate fee (5% pre-grad, 1% post-grad)
3. Pull USDC from user (using available balance first)
4. Execute trade on AMM
5. Distribute fee

**Effect** (Sell):
1. Get quote from AMM
2. Calculate and deduct fee
3. Execute trade on AMM
4. Proceeds go to user's locked balance (24h lock)
5. Distribute fee

**Example**:
```solidity
// Buy 100 YES shares
uint256 cost = launchpadEngine.tradePositions(
    market,
    1,        // YES
    100e18,   // 100 shares
    200e18    // max cost
);
```

---

### 3. Fee Distribution

```solidity
function _distributeFee(
    address market,
    uint256 feeWad,
    uint256 feeUsdc,
    address trader
) internal
```

**Pre-Graduation** (100% to bBase + LP minting):
```solidity
// Fee goes to increasing liquidity
uint256 deltaB = (feeWad * LN2_INV_WAD) / WAD;
state.bCurrent += deltaB;
ammEngine.increaseLiquidity(market, deltaB);

// Mint LP tokens to TRADER (not creator!)
lpBalances[market][trader] += feeWad;
state.totalLPSupply += feeWad;
```

**Post-Graduation** (50/30/20 split):
```solidity
// 50% to bBase growth
uint256 toBBase = (feeWad * bBaseShareBps) / BPS_DENOMINATOR;
state.bCurrent += toBBase;

// 30% to LP yield pool
uint256 toLPYield = (feeUsdc * lpYieldShareBps) / BPS_DENOMINATOR;
state.lpYieldPool += toLPYield;

// 20% to protocol treasury
uint256 toProtocol = (feeUsdc * protocolShareBps) / BPS_DENOMINATOR;
usdc.safeTransfer(protocolTreasury, toProtocol);
```

---

### 4. Graduation Mechanism

**Threshold Formula**:
```
Threshold = bBase x ln(2) x graduationMultiplier
```

Where:
- `bBase x ln(2)` = creator's initial deposit
- `graduationMultiplier` = 1 (default) means graduate at break-even

**Trigger**:
```solidity
uint256 graduationThreshold = (state.bBase * LN2_WAD * graduationMultiplier) / WAD;
uint256 feesInWad = _usdcToWad(state.feesAccrued);

if (feesInWad >= graduationThreshold) {
    state.isGraduated = true;
    state.graduatedAt = uint64(block.timestamp);
    
    // Atomic graduation: Register in Collateralizer and TickBook
    collateralizer.registerMarket(market, name, symbol);
    tickBook.registerMarket(market, yesToken, noToken, ammProbability, defaultHook);
    
    emit MarketGraduated(market, feesAccrued, block.timestamp);
}
```

**Example**:
```
bBase = 1000, graduationMultiplier = 1
Threshold = 1000 * 0.693 * 1 = 693 USDC

When feesAccrued >= 693 USDC:
- isGraduated = true
- Fee drops from 5% to 1%
- Market registered in TickBook
```

---

### 5. Redeem LP

```solidity
function redeemLP(
    address market,
    uint256 lpAmount
) external nonReentrant returns (uint256 usdcAmount)
```

**Effect**:
1. Calculate floor value (worst-case LP value)
2. Calculate pro-rata share
3. Burn LP tokens
4. Transfer USDC

**Floor Calculation**:
```solidity
function _calculateFloor(address market) internal view returns (uint256) {
    // Total cash = deposit + fees + LP yield
    uint256 totalCash = state.creatorDeposit + state.feesAccrued + state.lpYieldPool;
    
    // Max liability = max(qYes, qNo)
    uint256 maxLiability = qYes > qNo ? qYes : qNo;
    
    // Floor = Cash - Liability
    return totalCash > maxLiability ? totalCash - maxLiability : 0;
}
```

---

### 6. Increase bBase (Creator)

```solidity
function increaseBBase(
    address market,
    uint256 amount
) external nonReentrant
```

**Caller**: Market creator only  
**Effect**:
1. Transfer USDC from creator
2. Increase bCurrent and bBase
3. Mint LP tokens to creator

---

## Configurable Parameters

| Parameter | Default | Range | Purpose |
|-----------|---------|-------|---------|
| `preGradFeeBps` | 500 (5%) | 0-1000 | Fee before graduation |
| `postGradFeeBps` | 100 (1%) | 0-500 | Fee after graduation |
| `bBaseShareBps` | 5000 (50%) | Sum=10000 | Post-grad: % to b growth |
| `lpYieldShareBps` | 3000 (30%) | Sum=10000 | Post-grad: % to LP yield |
| `protocolShareBps` | 2000 (20%) | Sum=10000 | Post-grad: % to protocol |
| `graduationMultiplier` | 1 | 1-10 | Threshold multiplier |

### Owner Functions

```solidity
function setPreGradFee(uint16 feeBps) external onlyOwner
function setPostGradFee(uint16 feeBps) external onlyOwner
function setFeeDistribution(uint16 bBaseBps, uint16 lpYieldBps, uint16 protocolBps) external onlyOwner
function setGraduationMultiplier(uint16 multiplier) external onlyOwner
function setDefaultHook(address hook) external onlyOwner
```

---

## View Functions

```solidity
// Get market state
function getMarketState(address market)
    external view returns (
        address creator,
        uint256 bBase,
        uint256 bCurrent,
        uint256 totalLPSupply,
        bool isGraduated,
        uint256 floorValue
    )

// Get LP balance
function getLPBalance(address market, address user) external view returns (uint256)

// Get graduation progress
function getGraduationProgress(address market)
    external view returns (uint256 feesAccrued, uint256 threshold, uint256 progressBps)

// Get all markets
function getMarkets() external view returns (address[] memory)
function getMarketCount() external view returns (uint256)
```

---

## Events

```solidity
event MarketCreated(
    address indexed market,
    address indexed creator,
    uint256 initialLiquidity,
    uint256 creatorDeposit,
    uint256 lpTokens
);

event PositionTraded(
    address indexed user,
    address indexed market,
    uint8 outcome,
    int256 deltaShares,
    uint256 actualCost,
    uint256 fee
);

event MarketGraduated(
    address indexed market,
    uint256 feesAccrued,
    uint256 timestamp
);

event FeeDistributedPreGrad(
    address indexed market,
    uint256 feeUsdc,
    uint256 feeWad,
    uint256 lpTokensMinted,
    address indexed trader
);

event FeeDistributedPostGrad(
    address indexed market,
    uint256 feeUsdc,
    uint256 toBBase,
    uint256 toLPYield,
    uint256 toProtocol
);

event LPRedeemed(
    address indexed user,
    address indexed market,
    uint256 lpAmount,
    uint256 usdcAmount
);

event LiquidityIncreased(
    address indexed market,
    address indexed provider,
    uint256 usdcAmount,
    uint256 liquidityDelta
);
```

---

## Market Lifecycle

```
CREATE
  |
  v
ACTIVATE (trading enabled)
  |
  v
ACCUMULATE FEES
  |
  v
GRADUATION THRESHOLD REACHED
  |
  v
GRADUATED (fees drop to 1%, new distribution)
  |
  v
DEADLINE REACHED
  |
  v
SETTLEMENT
  |
  v
FINALIZATION
  |
  v
LIQUIDATION (claim LP share)
```

---

## Security Considerations

### Reentrancy
- `nonReentrant` on all state-changing functions

### LP Token Safety
- Only minted via createMarket or fee distribution
- Cannot mint unbounded

### Graduation
- Fee reduction only happens once
- Threshold includes safety margins

---

## Example Flows

### Creator LP Strategy

```solidity
// 1. Create market with 1000 USDC worth of liquidity
market = createMarket(truthMarket, 1000e18, "BTC 100k", "BTC100K");

// 2. Users trade, fees accumulate
// Assume 5000 USDC volume at 5% fee = 250 USDC fees

// 3. Market graduates when fees >= 693 USDC

// 4. Post-graduation:
// - Fees = 1%
// - 50% to b growth, 30% to LP yield, 20% to protocol

// 5. After settlement, redeem LP tokens
uint256 payout = redeemLP(market, lpBalance);
```

### Trader Becomes Stakeholder

```solidity
// Pre-graduation: Traders earn LP tokens from fees
tradePositions(market, 1, 100e18, 200e18);
// Fee = 5%
// Trader receives LP tokens proportional to fee paid

// Later, trader can redeem LP for pro-rata share
uint256 lpBalance = getLPBalance(market, trader);
redeemLP(market, lpBalance);
```

---

## Cross-References

- [AMMEngine Integration](./04-AMMEngine.md)
- [Collateralizer Registration](./05-Collateralizer.md#register-market)
- [TruthMarket Creation](./02-TruthMarket.md)
- [TickBook Registration](./03-TickBookPoolManager.md#register-market)
