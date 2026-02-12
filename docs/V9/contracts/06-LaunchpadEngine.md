# LaunchpadEngine — Creator Economics & Fee Distribution

**File**: `packages/contracts-core/src/LaunchpadEngine.sol` (15 KB)  
**Status**: ✅ Stable (V9.9.6 compatible)  
**Tests**: 60/60 passing

---

## 📌 Overview

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

## 💾 State Variables

### Market State

```solidity
struct MarketState {
    address creator;
    uint256 bBase;                  // LMSR b parameter (WAD)
    uint256 bCurrent;               // Current b after buybacks
    uint256 creatorDeposit;         // Initial deposit (USDC decimals)
    uint256 feesAccrued;            // Total fees collected (USDC decimals)
    uint256 totalLPSupply;          // Total LP tokens (WAD)
    uint256 lpYieldPool;            // Accumulated yields for LPs (USDC decimals)
    bool isGraduated;
    uint64 createdAt;
    uint64 graduatedAt;
    string name;
    string symbol;
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
mapping(address => mapping(address => uint256)) public lpBalances;  // market → user → amount
mapping(address => mapping(address => mapping(address => uint256))) 
    public lpAllowances;  // Standard ERC20-like approval
```

---

## 🎮 Core Functions

### 1. Create Market

```solidity
function createMarket(
    string calldata name,
    string calldata symbol,
    uint256 initialLiquidityUSDC,
    uint64 deadline,
    address adjudicator,
    address guardian
) external returns (address market)
```

**Caller**: Anyone (market creator)  
**Effect**:
1. Create TruthMarket with given parameters
2. Register with Collateralizer (deploy YES/NO tokens)
3. Register with AMMEngine (set bBase)
4. Mint LP tokens to creator
5. Add market to `allMarkets` array

**Parameters**:
- `initialLiquidityUSDC`: Creator's deposit (e.g., 1000 USDC)
- `deadline`: Unix timestamp when trading stops
- `adjudicator`: Who settles the market
- `guardian`: Who can veto settlement

**LP Token Minting**:
```solidity
lpTokens = initialLiquidityUSDC * WAD / bBase;
// If b = 100e18, then 1000 USDC → 10e18 LP tokens
```

**Example**:
```solidity
address market = launchpadEngine.createMarket(
    "Bitcoin $100k",
    "BTC100K",
    1000e6,  // 1000 USDC deposit
    1735689600,  // Jan 1 2025
    0x...,  // adjudicator
    0x...   // guardian
);

// Creator now holds:
// - 10e18 LP tokens (tracking 1000 USDC stake)
// - Market is registered but not yet LIVE
```

---

### 2. Activate Market

```solidity
function activateMarket(address market) external
```

**Caller**: Market creator (owner of LP tokens)  
**Effect**: Call `TruthMarket.activate()` to enable trading  
**Precondition**: Market state must be CREATED

---

### 3. Claim Fees & Buyback

```solidity
function claimFeesAndBuyback(
    address market
) external returns (uint256 buybackAmount)
```

**Caller**: Anyone (public)  
**Effect** (pre-graduation):
1. Collect accumulated fees from AMMEngine
2. Buy YES and NO tokens with fees (rebalance position)
3. Burn bought tokens (increases per-LP value)
4. Update `bCurrent` to reflect new reserves

**Effect** (post-graduation):
1. Collect fees
2. Distribute 50% to bBase (buyback), 30% to LP yield, 20% to protocol
3. Update fee shares

**Mechanism**: Buyback increases `bCurrent`, which increases per-LP token value:
```solidity
// Before buyback: 100 LP tokens, b = 100
// Creator value per LP = 1.0

// Fees = 5 USDC, buyback buys YES/NO with it
// New b = 105
// Creator value per LP = 1.05
```

---

### 4. Graduation Mechanism

```solidity
function getGraduationProgress(
    address market
) external view returns (uint256 bpsProgress)
```

**Returns**: Progress in basis points (0-10000 = 0%-100%)

**Graduation Trigger**:
```
Threshold = bBase × ln(2) × graduationMultiplier
Graduated when: fees accrued ≥ Threshold
```

**Default**: `graduationMultiplier = 1`
```
Example: bBase = 100, ln(2) ≈ 0.693
Threshold = 100 × 0.693 × 1 = 69.3 USDC
Once 69.3 USDC in fees → graduated, fee drops to 1%
```

**Effect of graduation**:
- Pre-grad: 5% fee
- Post-grad: 1% fee
- Fee distribution becomes 50/30/20 split

**Rationale**: Incentivizes early adoption (higher fees = cheaper for creator), automatic reduction rewards active markets.

---

### 5. LP Token Management

```solidity
function transferLP(
    address market,
    address to,
    uint256 amount
) external

function burnLP(
    address market,
    uint256 amount
) external
```

**Like ERC20**: Users can transfer/burn LP tokens  
**Per-Token Value** increases with:
- Buyback operations (increase `bCurrent`)
- Market trading (fees accumulated)

**Example**:
```solidity
// Creator owns 10e18 LP tokens
// Market value per LP = 1.1 USDC (grew from 1.0)

// Transfer 5e18 to partner
launchpadEngine.transferLP(market, partner, 5e18);

// Partner now holds 5.5 USDC equivalent value
// Creator holds 5.5 USDC equivalent value (from remaining tokens)
```

---

### 6. View Functions

```solidity
// Get all markets
function getMarkets() external view returns (address[] memory)

function getMarketCount() external view returns (uint256)

// Get market state
function getMarketState(address market) 
    external view returns (MarketState memory)

// Get LP token value
function getLPTokenValue(address market, uint256 amount)
    external view returns (uint256 usdcValue)

// Get fees that can be claimed
function getClaimableFees(address market)
    external view returns (uint256 usdcAmount)
```

---

## 📊 Economics Model

### Fee Structure (Pre-Graduation)

```
User buys 100 YES at $50% = 50 USDC cost
Fees = 50 × 5% = 2.5 USDC

Distribution:
- Creator: 2.5 USDC (buyback)
```

### Fee Structure (Post-Graduation)

```
User buys 100 YES at $50% = 50 USDC cost
Fees = 50 × 1% = 0.5 USDC

Distribution:
- bBase growth (buyback): 0.5 × 50% = 0.25 USDC
- LP yield pool: 0.5 × 30% = 0.15 USDC
- Protocol treasury: 0.5 × 20% = 0.1 USDC
```

### Buyback Mechanics

**Goal**: Increase `bCurrent` → increase per-LP value

```solidity
// Collect 5 USDC in fees
// Buy YES and NO with it (balanced position)
// Burn both (remove from supply)
// Effect: b increases, each LP token now worth more

// Example:
// Before: 100 LP tokens, bCurrent = 100, AMMEngine reserves = (100, 100)
// After fee buyback: 100 LP tokens, bCurrent = 105, reserves = (105, 105)
// Creator value per LP = 1.05 (5% increase)
```

---

## 🔄 Market Lifecycle

```
CREATE
  ↓
ACTIVATE (trading enabled)
  ↓
ACCUMULATE FEES
  ↓
GRADUATION THRESHOLD REACHED
  ↓
GRADUATED (fees drop to 1%, new distribution)
  ↓
DEADLINE REACHED
  ↓
SETTLEMENT
  ↓
FINALIZATION
  ↓
LIQUIDATION (claim LP share of final value)
```

---

## 💡 Use Cases

### Creator LP Strategy

```solidity
// Step 1: Create market with 1000 USDC
market = createMarket("BTC $100k", "BTC100K", 1000e6, ...)

// Step 2: Activate
activateMarket(market)

// Step 3: Users trade, fees accumulate
// (Assume 5000 USDC in volume at 5% fee = 250 USDC fees)

// Step 4: Claim and buyback
claimFeesAndBuyback(market)  // Buyback increases per-LP value

// Step 5: Market graduates, fees drop to 1%
// Continue trading with lower fees

// Step 6: Market settles, redeem outcomes
// Creator redeems LP share + winning tokens
```

### Liquidity Provider (Non-Creator)

```solidity
// Step 1: Buy LP tokens from creator
launchpadEngine.transferLP(market, lpPartner, 2e18)

// Step 2: Enjoy per-token value increases
// As buyback happens, LP tokens become more valuable

// Step 3: Exit early (transfer to another user)
launchpadEngine.transferLP(market, newPartner, 1e18)

// Step 4: Or hold until settlement
// Redeem LP tokens for final share
```

---

## 📈 Configurable Parameters

```solidity
// Owner can adjust these

uint16 preGradFeeBps = 500;           // 5%
uint16 postGradFeeBps = 100;          // 1%
uint16 graduationMultiplier = 1;      // Threshold = b × ln(2) × mult

// Post-grad split
uint16 bBaseShareBps = 5000;          // 50% to b
uint16 lpYieldShareBps = 3000;        // 30% to LP
uint16 protocolShareBps = 2000;       // 20% to protocol
```

---

## 🔐 Security

### Reentrancy
- ✅ `nonReentrant` on `claimFeesAndBuyback()`

### LP Token Safety
- ✅ No approval exploits (internal transfers only)
- ✅ Cannot mint unbounded (only via createMarket)

### Graduation
- ✅ Fee reduction only happens once
- ✅ Threshold calculation includes safety margins

---

## ⚠️ Known Limitations

1. **No Emergency Pause**: Cannot freeze market creation/trading
2. **Fixed Fee Schedule**: Fees cannot increase post-graduation
3. **LP Token Illiquidity**: LP tokens are non-standard (custom transfer)
4. **Graduation Dependency**: Once past threshold, cannot "de-graduate"

---

## 🔗 Cross-References

- [AMMEngine Integration](./04-AMMEngine.md)
- [Collateralizer Registration](./05-Collateralizer.md#register-market)
- [TruthMarket Creation](./02-TruthMarket.md)
- [ADR-062: Fee Model](../../DECISIONS.md#adr-062)
- [ADR-061: Graduation Mechanics](../../DECISIONS.md#adr-061)

---

## 📚 Additional Resources

- **Fee Economics**: See STATUS.md for current fee rates
- **Test Suite**: `packages/contracts-core/test/v9/LaunchpadEngine.t.sol`
- **Interactive CLI**: `packages/contracts-core/script/interactive/interactive-test.ts`
