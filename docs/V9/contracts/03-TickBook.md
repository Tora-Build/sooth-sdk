# TickBook V9.9.6 — Prediction Market Orderbook

**File**: `packages/contracts-core/src/TickBookPoolManagerV996.sol` (45 KB)  
**Version**: V9.9.6-fix9L (Latest)  
**Status**: ✅ Deployed (Base Sepolia, Monad, Arc)  
**Tests**: 138/138 passing

---

## 📌 Overview

`TickBookPoolManager` is a **singleton orderbook** supporting 10,000 probability ticks with O(1) tick discovery. It's the primary trading venue for most users.

### Key Characteristics
- **10,000 ticks** (1 bp = 0.01% price precision)
- **Concentrated liquidity** (any tick range)
- **Bitmap acceleration** (O(1) tick discovery)
- **Unified Order API** (V9.9.6)
- **Auto-claim** before new orders
- **Instant settlement** (vs AMM's retroactive T*)

---

## 🎯 V9.9.6 Major Changes

### Unified Order API

**Old API** (pre-V9.9.6):
```solidity
// Two separate functions
placeRangeOrder(...)      // Resting orders
executeMarketOrder(...)   // Market orders
```

**New API** (V9.9.6+):
```solidity
// One unified function
placeOrder(
    bytes32 marketKey,
    uint8 outcome,       // 0=NO, 1=YES
    uint256 shares,
    uint16 tickLower,    // Min tick to rest at
    uint16 tickUpper,    // Max tick to fill up to
    uint256 maxCost      // Slippage protection
) external returns (
    uint256 orderId,
    uint256 filledShares,
    uint256 filledCost,
    uint256 restingShares
)
```

### Order Types by Tick Range

| Type | tickLower | tickUpper | Example | Behavior |
|------|-----------|-----------|---------|----------|
| **Market** | 1 | 999 | `(1, 999)` | Fill all liquidity up to max cost |
| **Limit** | X | X | `(500, 500)` | Only at single tick (50% prob) |
| **Range** | X | Y | `(400, 600)` | Spread liquidity across range |
| **Market w/ Floor** | F | 999 | `(300, 999)` | Fill down to 30%, rest at 30% |

### Auto-Claim

```solidity
// New: placeOrder() automatically claims pending fills
placeOrder(...);  // Internal call to _autoClaimUserOrders()

// Before: Users had to manually claim
// claimFills(orderId);  // OLD API (deprecated)
```

Benefits:
- ✅ Prevents "stuck" positions
- ✅ Simplified UX (one call instead of two)
- ✅ Gas ~4-8k per active order (bounded)

---

## 📊 Data Structures

### Market

```solidity
struct Market {
    address truthMarket;  // Link to lifecycle contract
    address yesToken;     // Outcome token
    address noToken;      // Outcome token
    bool isActive;        // Can trade?
}
```

### RangeOrder

```solidity
struct RangeOrder {
    address owner;
    uint8 outcome;        // 0=NO, 1=YES
    uint16 tickLower;
    uint16 tickUpper;
    bool active;
    bool liquidityRemoved;  // V9.9.5: Idempotent cleanup flag
    
    uint128 sharesTotal;           // How many shares ordered
    uint128 liquidity;             // Actual tick liquidity
    uint128 collateralDepositedWad; // USDC * 1e12
    uint128 filledShares;          // How many filled (capped at sharesTotal)
    uint128 collateralUsedWad;     // USDC paid for fills
}
```

### TickInfo

```solidity
struct TickInfo {
    int128 liquidityNet;   // +/- when crossing (maker side)
    uint128 liquidityGross; // Total liquidity at tick
}
```

---

## 🎮 Core Functions

### 1. Register Market

```solidity
function registerMarket(
    address truthMarket,
    address yesToken,
    address noToken
) external onlyRegistrar returns (bytes32 marketKey)
```

**Caller**: Registrar only  
**Effect**:
- Creates market in singleton manager
- Initializes tick bitmap and state
- Returns `bytes32 marketKey` for all operations

**One-time setup** per market.

---

### 2. Place Order (V9.9.6)

```solidity
function placeOrder(
    bytes32 marketKey,
    uint8 outcome,
    uint256 shares,
    uint16 tickLower,
    uint16 tickUpper,
    uint256 maxCost
) external nonReentrant returns (
    uint256 orderId,
    uint256 filledShares,
    uint256 filledCost,
    uint256 restingShares
)
```

**Flow**:
1. Auto-claim all user's pending fills
2. Determine order type from tick range
3. Execute crossing phase (fill existing liquidity)
4. Rest remainder as new order
5. Return order ID + fill details

**Gas**: ~200k-400k (varies by crossing depth)

**Example: Market Order**
```solidity
// Buy YES shares at market price (any tick)
tickBook.placeOrder(
    marketKey,
    1,        // YES
    1000e18,  // 1000 shares
    1,        // tickLower = 1 (accept any price)
    999,      // tickUpper = 999 (fill everything)
    2000e18   // maxCost = 2000 USDC (~2 per share)
);
```

**Example: Limit Order**
```solidity
// Sell NO at exactly 40% (400/1000)
tickBook.placeOrder(
    marketKey,
    0,        // NO
    500e18,   // 500 shares
    400,      // tickLower = 400 (40% tick)
    400,      // tickUpper = 400 (same = limit order)
    500e18    // Cost = full deposit
);
```

**Example: Range Order (LP)**
```solidity
// Provide liquidity from 45%-55%
tickBook.placeOrder(
    marketKey,
    1,        // YES (or 0 for NO, both can be provided)
    1000e18,  // liquidity
    450,      // tickLower = 45%
    550,      // tickUpper = 55%
    1000e18   // Expected cost (with slippage)
);
```

---

### 3. Claim Fills

```solidity
function claimFills(uint256 orderId) external returns (
    uint256 filledShares,
    uint256 proceeds
)
```

**Caller**: Order owner  
**Effect**:
- Calculates accrued fills since last claim
- Calculates proceeds (USDC to return to user)
- Transfers tokens and USDC

**Note**: V9.9.6 `placeOrder()` auto-claims all orders, so manual `claimFills()` is rare.

---

### 4. Cancel Order

```solidity
function cancelOrder(uint256 orderId) external
```

**Caller**: Order owner  
**Effect**:
- Removes liquidity from ticks
- Refunds unused USDC
- Sets `active = false`

---

### 5. Add/Remove Liquidity

```solidity
// Internal during placeOrder()
function _updateActiveLiquidity(
    bytes32 marketKey,
    uint8 outcome,
    uint16 tick,
    int128 delta
) internal

// Search for next liquidity tick
function _findNextUp(
    bytes32 marketKey,
    uint8 outcome,
    uint16 currentTick
) internal view returns (uint16)
```

**Tick Crossing Logic**:
- When filling crosses a tick boundary, update `activeLiquidity`
- Use `_safeAddLiquidity()` to prevent underflow
- Update maker attribution (`_fillGrowthGlobalX128`)

---

## 🔍 Key Algorithms

### Bitmap Search (O(1))

```solidity
// Find next liquidity tick
uint16 nextTick = _findNextUp(marketKey, outcome, currentTick);

// Internally uses two-level bitmap:
// - Level 1: 256 bits = 256 × 8 = 2048 tick groups
// - Level 2: 256 bits = 256 × 1 = 256 ticks per group
// Total: 10,000 ticks with O(1) discovery
```

### Tick Crossing

```solidity
// When filling crosses tick T:
TickInfo storage tick = _ticks[marketKey][outcome][T];

// Add/remove active liquidity
activeLiq += tick.liquidityNet;  // +/- liquidity at boundary

// Update maker growth (for proceeds calculation)
_fillGrowthGlobalX128[marketKey][outcome] += fillDelta;
```

### Fill Accounting

```solidity
// Safe addition preventing underflow
uint128 _safeAddLiquidity(uint128 liq, int128 delta) internal pure {
    if (delta >= 0) {
        return liq + uint128(delta);
    } else {
        uint128 absDelta = uint128(-delta);
        return liq >= absDelta ? liq - absDelta : 0;
    }
}
```

---

## 📋 State Management

### Per-Market Storage

```solidity
mapping(bytes32 => Market) _markets;           // Market metadata
mapping(bytes32 => MarketState) _state;        // Current tick + active liquidity
mapping(bytes32 => mapping(uint8 => mapping(uint16 => TickInfo))) _ticks;  // Tick data
mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) _bitmaps;  // Tick bitmaps
```

### Per-Order Storage

```solidity
mapping(bytes32 => mapping(uint256 => RangeOrder)) _orders;
mapping(bytes32 => mapping(address => uint256[])) _userOrders;  // User's orders
mapping(bytes32 => mapping(uint256 => uint256)) _fillGrowthLastX128;  // Maker attribution
```

### Refunds (V9.9.6-fix9d)

```solidity
mapping(address => mapping(bytes32 => uint256)) _pendingRefunds;
```

When orders auto-claim, refunds pool instead of direct transfer (more gas efficient).

---

## 💰 Pricing & Fees

### Tick ↔ Probability Conversion

```solidity
// Tick 500 = 50% probability
probability = tick / 1000;  // tick / 10000 * 100%

// Examples:
// tick 0 = 0% (NO certain)
// tick 100 = 10% (YES 10%)
// tick 500 = 50% (Fair)
// tick 900 = 90% (YES 90%)
// tick 999 = 99.9% (YES almost certain)
```

### Cost Calculation

```solidity
// Cost to buy X shares at tick T:
costUSDC = X * (T / 1000);

// Examples (1000 shares):
// At tick 100: 1000 * 0.1 = 100 USDC
// At tick 500: 1000 * 0.5 = 500 USDC
// At tick 900: 1000 * 0.9 = 900 USDC
```

### Fees

```solidity
takerFeeBps = 10;   // 0.1% taker fee
makerFeeBps = 0;    // 0% maker fee (incentivize LP)

// Example: Buy 100 shares at tick 500
costBeforeFee = 100 * 0.5 = 50 USDC
takerFee = 50 * 0.001 = 0.05 USDC
totalCost = 50.05 USDC
```

---

## 🏥 V9.9.6-fix9L Bug Fixes & Optimizations

### fix1: Active Liquidity Underflow
**Issue**: Tick crossing with negative liquidityNet could underflow  
**Fix**: Safe arithmetic (`_safeAddLiquidity()`)

### fix2: Phantom Orders
**Issue**: Fully-filled orders left dust liquidity  
**Fix**: Auto-complete when `filledShares >= sharesTotal`

### fix3: Array Overflow
**Issue**: Removing orders caused out-of-bounds  
**Fix**: Backwards iteration in `_autoClaimUserOrders()`

### fix4: RPC Limits
**Issue**: Can't enumerate orders via single RPC call  
**Fix**: Added `getAllMarketOrders()` view function

### fix5: Order Lifecycle
**Issue**: Incomplete order cleanup on cancellation  
**Fix**: Proper state management and removal

### fix6: Crossing Logic
**Issue**: Raw tick comparison ignored complementary outcome  
**Fix**: Enforce `YES_tick + NO_tick >= 1000` crossing rule

### fix7: Overlap Calculation
**Issue**: Crossing range inverted  
**Fix**: Corrected to `[sellerPrice, tickUpper]`

### fix8: Bitmap Direction
**Issue**: Expensive seller tick + underflow  
**Fix**: `findNextDown()` + safe subtraction

### fix9L: Spread Autoclaim (Optimal)
**Issue**: Auto-claim O(n) gas growth with user orders  
**Fix**: Check only 5 strategic points (newest, oldest, middle, 1/4, 3/4)
- **Gas**: Constant ~40k regardless of order count
- **Benefit**: Hits 100% filled orders in typical scenarios
- **Strategy**: "Spread" points catch age diversity

---

## ⚖️ Invariants

1. **Order Liquidation**: `filledShares ≤ sharesTotal` (capped in `claimFills()`)
2. **Active Liquidity**: `activeLiquidity ≥ 0` (safe arithmetic)
3. **Tick Consistency**: `liquidityGross ≥ liquidityNet` at all ticks
4. **Bitmap Correctness**: Bitmap correctly reflects occupied ticks
5. **Fee Distribution**: `takerFees = accumulator growth × liquidity`

---

## 🔐 Security

### Reentrancy
- ✅ `nonReentrant` guard on `placeOrder()`, `claimFills()`, `cancelOrder()`

### Input Validation
- ✅ Market must be active
- ✅ Outcome must be 0 or 1
- ✅ Tick range must be valid (`tickLower ≤ tickUpper`, both in [1, 999])

### Arithmetic Safety
- ✅ All tick crossing uses safe helpers
- ✅ Q128 accumulator overflow checked
- ✅ USDC transfers use SafeERC20

---

## 🚀 Usage Flow

### Flow 1: Market Order
```solidity
// User wants to buy 1000 YES shares ASAP
uint256 yesBalance = yesToken.balanceOf(user);
require(yesBalance >= 1000e18, "Not enough YES");

// Approve and place order
yesToken.approve(address(tickBook), 1000e18);
(uint256 orderId, uint256 filled, uint256 cost, uint256 resting)
    = tickBook.placeOrder(
        marketKey,
        1,        // YES
        1000e18,
        1, 999,   // Market order
        1500e18   // Max 1500 USDC slippage
    );

// Order auto-claims, receives refund if not fully filled
```

### Flow 2: Limit Order
```solidity
// User wants to sell 500 NO at exactly 35% (350 tick)
noToken.approve(address(tickBook), 500e18);
(uint256 orderId, , , )
    = tickBook.placeOrder(
        marketKey,
        0,        // NO
        500e18,
        350, 350, // Limit order at 35%
        500e18    // Full deposit
    );

// Order waits at tick 350 for YES buyers
// When filled, claim proceeds
uint256 proceeds = tickBook.claimFills(orderId);
```

---

## 📚 External Resources

- [Test Suite](packages/contracts-core/test/v9/)
- [V996 Retrospective](packages/contracts-core/docs/V996-crossing-logic-retrospective.md)
- [Unified Order API (ADR-066)](../../DECISIONS.md#adr-066)
- [TickBitmap Library](./LIBRARIES.md#tickbitmap)

---

## 🔗 Cross-References

- [TruthMarket Lifecycle](./02-TruthMarket.md)
- [Collateralizer Split/Merge](./05-Collateralizer.md)
- [LaunchpadEngine Graduation](./06-LaunchpadEngine.md)
- [TickBookVault](./TickBookVault.md)
