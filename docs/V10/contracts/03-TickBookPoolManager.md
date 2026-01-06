# TickBookPoolManager V10 - Unified Prediction Market Orderbook

**File**: `packages/contracts-core/src/TickBookPoolManager.sol` (1,490 lines)  
**Version**: V10.0.0 (Latest)  
**Status**: Alpha

---

## Overview

`TickBookPoolManager` is a **singleton orderbook** supporting 10,000 probability ticks with O(1) tick discovery. V10 introduces the **Unified Crossing Architecture** - the major innovation that combines spot sell liquidity with range order liquidity.

### Key Characteristics
- **10,000 ticks** (1 bp = 0.01% price precision)
- **Concentrated liquidity** (any tick range)
- **Bitmap acceleration** (O(1) tick discovery)
- **Unified Order API** (from V9.9.6)
- **V10: Unified Crossing** (spot first, then range)
- **V10: Dual Bitmap System** (range + spot)

---

## V10 Major Innovation: Unified Crossing

### The Problem (V9)
In V9, two types of liquidity existed in isolation:
- **Range Orders**: USDC-backed, mint synthetic tokens
- **Spot Sells**: Token-backed, recycle existing tokens

This led to fractured liquidity and suboptimal price discovery.

### The Solution (V10)

```
+------------------+
|   Buyer Order    |
+--------+---------+
         |
         v
+------------------+
| PHASE 1: SPOT    |  Fill spot sells FIRST
| (recycle tokens) |  No minting - maximum efficiency
+--------+---------+
         |
         v
+------------------+
| PHASE 2: RANGE   |  Fill range orders SECOND
| (mint synthetic) |  Standard pro-rata distribution
+--------+---------+
         |
         v
+------------------+
|   Order Filled   |
+------------------+
```

### Benefits
| Aspect | V9 | V10 |
|--------|----|----|
| Liquidity Sources | Separate | Unified |
| Token Velocity | Low | High |
| Capital Efficiency | ~70% | ~95% |
| Price Discovery | Good | Optimal |

---

## V10 Data Structures

### Unified Tick Liquidity

```solidity
/// @dev V10: Unified tick liquidity - combines range and spot in one struct
struct TickLiquidity {
    int128 rangeLiquidityNet;     // Range order net liquidity (for crossing)
    uint128 rangeLiquidityGross;  // Range order gross liquidity (for cleanup)
    uint128 spotLiquidity;        // Spot sell liquidity at this tick (NEW)
}
```

### Crossing Result

```solidity
/// @dev V10: Internal struct for unified crossing results
struct CrossingResult {
    uint256 totalFilled;
    uint256 spotFilled;      // From spot sells (recycled)
    uint256 rangeFilled;     // From range orders (minted)
    uint256 newOrderCost;
    uint256 spotCost;
    uint256 rangeCost;
    uint16 crossTick;
}
```

### Storage Layout

```solidity
/// @dev V10: Unified tick liquidity storage
mapping(bytes32 => mapping(uint8 => mapping(uint16 => TickLiquidity))) private _tickLiquidity;

/// @dev Range order bitmaps (existing)
mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _bitmaps;

/// @dev V10: Separate bitmap for spot liquidity
mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _spotBitmaps;
```

---

## Core Functions

### 1. Place Order (Unified API)

```solidity
function placeOrder(
    bytes32 marketKey,
    uint8 outcome,       // 0=NO, 1=YES
    uint256 shares,
    uint16 tickLower,    // Min tick to rest at
    uint16 tickUpper,    // Max tick to fill up to
    uint256 maxCost      // Slippage protection
) external nonReentrant returns (
    uint256 orderId,
    uint256 filledShares,
    uint256 filledCost,
    uint256 restingShares
)
```

**Order Types by Tick Range**:

| Type | tickLower | tickUpper | Example | Behavior |
|------|-----------|-----------|---------|----------|
| **Market** | 1 | 999 | `(1, 999)` | Fill all liquidity up to max cost |
| **Limit** | X | X | `(500, 500)` | Only at single tick (50% prob) |
| **Range** | X | Y | `(400, 600)` | Spread liquidity across range |
| **Market w/ Floor** | F | 999 | `(300, 999)` | Fill down to 30%, rest at 30% |

**V10 Flow**:
1. Auto-claim all user's pending fills
2. Release pooled refunds to available balance
3. Determine order type from tick range
4. **Execute unified crossing** (`_crossUnified()`)
5. Rest remainder as new order
6. Return order ID + fill details

**Gas**: ~200k-400k (varies by crossing depth)

**Example: Market Order**
```solidity
// Buy YES shares at market price
tickBook.placeOrder(
    marketKey,
    1,        // YES
    1000e18,  // 1000 shares
    1,        // tickLower = 1 (accept any price)
    999,      // tickUpper = 999 (fill everything)
    2000e18   // maxCost = 2000 USDC
);
```

---

### 2. Place Spot Sell (V10)

```solidity
function placeSpotSell(
    bytes32 marketKey,
    uint8 outcome,          // Which token to sell
    uint256 shares,         // Amount to sell
    uint16 tickLower,       // Ask price range start
    uint16 tickUpper        // Ask price range end
) external nonReentrant returns (uint256 sellId)
```

**What it does**:
- Locks existing outcome tokens in vault
- Adds liquidity to unified tick storage
- Sets spot bitmap bits
- Creates spot sell order

**Example: Sell YES tokens**
```solidity
// User owns 500 YES tokens, wants to sell at 60%+ price
tickBook.placeSpotSell(
    marketKey,
    1,        // YES
    500e18,   // 500 shares
    600,      // tickLower = 60%
    700       // tickUpper = 70%
);
```

**Key Difference from Range Orders**:
| Aspect | Range Order | Spot Sell |
|--------|-------------|-----------|
| Backing | USDC | Existing tokens |
| On Fill | Mint new tokens | Transfer existing |
| For | Buyers/LPs | Token holders |

---

### 3. Cancel Spot Sell

```solidity
function cancelSpotSell(bytes32 marketKey, uint256 sellId)
    external
    nonReentrant
    returns (uint256 sharesReturned)
```

**Effect**:
- Returns unfilled tokens to owner
- Removes from unified tick liquidity
- Clears spot bitmap if no more liquidity
- Credits any proceeds

---

### 4. Buy From Spot Sell (Direct)

```solidity
function buyFromSpotSell(
    bytes32 marketKey,
    uint256 sellId,
    uint256 shares,
    uint256 maxCost
) external nonReentrant returns (uint256 cost)
```

**Use case**: Directly buy from a specific spot sell order (bypasses unified crossing).

---

## Unified Crossing Algorithm

### `_crossUnified()` Implementation

```solidity
function _crossUnified(
    bytes32 marketKey,
    uint256 newOrderId
) internal returns (CrossingResult memory result) {
    // 1. Check for any liquidity to cross against
    uint256 oppTotalLiq = _totalLiquidity[marketKey][opposite];
    bool hasSpotLiq = _hasSpotLiquidity(...);
    if (oppTotalLiq == 0 && !hasSpotLiq) return result;

    // 2. Calculate overlap range
    (uint16 overlapLow, uint16 overlapHigh, bool hasOverlap) = _calculateOverlap(...);
    if (!hasOverlap) return result;

    // 3. PHASE 1: Fill spot liquidity FIRST (recycle tokens)
    result.spotFilled = _fillSpotLiquidity(...);
    result.spotCost = _calculateCostForOutcome(...);

    // 4. PHASE 2: Fill range liquidity (mint synthetic)
    uint256 remainingToFill = newOrderSharesInOverlap - result.spotFilled;
    if (remainingToFill > 0) {
        result.rangeFilled = _getOverlappingLiquidity(...);
        // Credit minted shares, update accumulators
    }

    // 5. Update state and emit events
    emit UnifiedCrossing(...);
}
```

### Overlap Calculation

For a YES buy order:
```solidity
// Find cheapest seller price across BOTH sources:
// 1. NO range orders (at high NO ticks = low YES asking price)
// 2. YES spot sells (direct YES share sellers)

uint16 highestNoRange = _bitmaps[marketKey][0].findNextDown(MAX_TICK + 1);
uint16 highestYesSpot = _spotBitmaps[marketKey][1].findNextDown(MAX_TICK + 1);

// Convert and compare
uint16 cheapestFromRange = 1000 - highestNoRange;  // NO tick to YES price
uint16 cheapestFromSpot = highestYesSpot;          // Already YES price

uint16 cheapestSellerPrice = min(cheapestFromRange, cheapestFromSpot);
```

---

## Spot Sell Liquidity Management

### Adding Spot Liquidity

```solidity
// In placeSpotSell()
for (uint16 t = tickLower; t <= tickUpper; t++) {
    _tickLiquidity[marketKey][outcome][t].spotLiquidity += density;
    
    // Set spot bitmap if first liquidity at tick
    if (_tickLiquidity[marketKey][outcome][t].spotLiquidity == density) {
        _spotBitmaps[marketKey][outcome].setBit(t);
    }
}
```

### Removing Spot Liquidity

```solidity
// After spot sell fill or cancel
for (uint16 t = tickLower; t <= tickUpper; t++) {
    TickLiquidity storage tick = _tickLiquidity[marketKey][outcome][t];
    tick.spotLiquidity = tick.spotLiquidity >= density 
        ? tick.spotLiquidity - density 
        : 0;
    
    // Clear bitmap if no more spot liquidity
    if (tick.spotLiquidity == 0) {
        _spotBitmaps[marketKey][outcome].clearBit(t);
    }
}
```

---

## Claims & Refunds

### Auto-Claim (on placeOrder)

```solidity
function _autoClaimUserOrders(bytes32 marketKey, address user)
    internal
    returns (uint256 totalClaimedShares, uint256 totalCollateralUsed)
{
    // Only claim 100% filled orders (max 20 for gas safety)
    // Iterates backwards to handle array removal
}
```

### Pooled Refunds

```solidity
// Refunds accumulate when orders complete
mapping(address => mapping(bytes32 => uint256)) private _pendingRefunds;

// Auto-released on next placeOrder, or manually claim:
function claimPooledRefunds(bytes32 marketKey) external returns (uint256 refund)
```

---

## View Functions

### Get Unified Tick Liquidity (V10)

```solidity
function getTickLiquidity(bytes32 marketKey, uint8 outcome, uint16 tick)
    external
    view
    returns (int128 rangeLiquidityNet, uint128 rangeLiquidityGross, uint128 spotLiquidity)
```

### Get Spot Sell Order

```solidity
function getSpotSellOrder(bytes32 marketKey, uint256 sellId)
    external
    view
    returns (SpotSellOrder memory)
```

### Get User Orders

```solidity
function getUserOrders(bytes32 marketKey, address user) external view returns (uint256[] memory)
function getUserSpotSells(bytes32 marketKey, address user) external view returns (uint256[] memory)
```

---

## Events

### V10 Events

```solidity
/// @dev V10: Enhanced crossing event with source breakdown
event UnifiedCrossing(
    bytes32 indexed marketKey,
    uint256 indexed newOrderId,
    uint8 newOutcome,
    uint256 spotFilled,
    uint256 rangeFilled,
    uint256 spotCost,
    uint256 rangeCost,
    uint16 crossTick
);

event SpotSellPlaced(
    address indexed owner,
    bytes32 indexed marketKey,
    uint256 indexed sellId,
    uint8 outcome,
    uint16 tickLower,
    uint16 tickUpper,
    uint256 shares
);

event SpotSellFilled(
    bytes32 indexed marketKey,
    uint256 indexed sellId,
    uint256 sharesFilled,
    uint256 proceeds
);

event SpotSellCancelled(
    address indexed owner,
    bytes32 indexed marketKey,
    uint256 indexed sellId,
    uint256 sharesReturned
);
```

---

## Invariants

1. **Unified Liquidity**: `TickLiquidity.spotLiquidity` + range liquidity accurately reflects all available liquidity
2. **Spot First**: During crossing, spot liquidity is always filled before range liquidity
3. **Bitmap Consistency**: Bitmap bits are set iff there's liquidity at that tick
4. **Order Completeness**: `filledShares <= sharesTotal` (capped in claim)
5. **Active Liquidity**: `activeLiquidity >= 0` (safe arithmetic)

---

## Security Considerations

### Reentrancy
- `nonReentrant` guard on all state-changing functions

### Input Validation
- Market must be active
- Outcome must be 0 or 1
- Tick range must be valid (`tickLower <= tickUpper`, both in [1, 999])

### Arithmetic Safety
- All tick crossing uses safe helpers
- Q128 accumulator overflow checked
- USDC transfers use SafeERC20

---

## Usage Examples

### Example 1: Place Order with Unified Crossing

```solidity
// Buyer places YES order - will fill spot sells first, then range orders
(uint256 orderId, uint256 filled, uint256 cost, uint256 resting)
    = tickBook.placeOrder(
        marketKey,
        1,        // YES
        1000e18,  // 1000 shares
        400,      // Accept prices from 40%
        600,      // Up to 60%
        700e18    // Max cost
    );

// Result might be:
// - spotFilled: 300 (from spot sellers recycling tokens)
// - rangeFilled: 400 (from range orders minting)
// - restingShares: 300 (placed as new order)
```

### Example 2: Spot Sell Flow

```solidity
// User owns YES tokens and wants to sell
uint256 sellId = tickBook.placeSpotSell(
    marketKey,
    1,        // YES tokens
    500e18,   // 500 shares
    550,      // Sell at 55%+
    600       // Up to 60%
);

// Later, check status
SpotSellOrder memory order = tickBook.getSpotSellOrder(marketKey, sellId);
// order.sharesFilled = how many sold
// order.proceedsWad = USDC earned

// Claim proceeds or cancel
uint256 proceeds = tickBook.claimSpotSellProceeds(marketKey, sellId);
```

---

## Cross-References

- [TruthMarket Lifecycle](./02-TruthMarket.md)
- [TickBookVault](./07-TickBookVault.md)
- [Collateralizer Split/Merge](./05-Collateralizer.md)
- [LaunchpadEngine Graduation](./06-LaunchpadEngine.md)
