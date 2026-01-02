# ADR-067: TickBook V10 - (tick, user) Primary Indexing

- **Date**: 2026-01-02
- **Status**: Implemented
- **Supersedes**: ADR-066 (V9.9.6 Unified Order API)

## Context

V9.9.6 used `orderId` as the primary key for orders. This created several pain points:

1. **O(n) Array Maintenance**: `_userOrders[marketKey][user]` required iteration to find/remove orders
2. **Order ID Proliferation**: Each order got a unique ID even when same user added to same tick
3. **Complex Range Attribution**: Range orders spanning multiple ticks complicated fill attribution
4. **Global Accumulators**: `_fillGrowthGlobalX128[outcome]` distributed fills across ALL orders, not just at traded ticks

## Decision

Refactor to `(marketKey, outcome, tick, user)` as the primary key:

### 1. Single-Tick Positions Only

Core contract only supports positions at individual ticks. Range orders are supported via peripheral `RangeOrderHelper` contract (Uniswap-style core/peripheral split).

### 2. Position Merging

When a user places an order at a tick where they already have a position, shares are merged (not a new order). Pro-rata fill dilution is accepted.

### 3. Per-Tick Accumulators

Fill growth tracked per tick (`TickState.fillGrowthX128`) instead of globally per outcome.

### 4. Unified API with tick=0 for Market Orders

```solidity
function placeOrder(
    bytes32 marketKey,
    uint8 outcome,
    uint256 shares,
    uint16 tick,        // 0 = market order, 1-999 = limit order
    uint256 maxCost
) returns (uint256 filledShares, uint256 filledCost, uint256 restingShares);
```

## Data Structures

### Position (replaces RangeOrder)

```solidity
struct Position {
    uint128 shares;                    // Total shares at this tick
    uint128 collateralDepositedWad;    // Locked collateral
    uint128 filledShares;              // Already claimed fills
    uint128 collateralUsedWad;         // Collateral consumed
    uint256 fillGrowthLastX128;        // Snapshot of tick's accumulator
    uint256 collateralGrowthLastX128;  // Snapshot of tick's collateral accumulator
}

// Primary: (market, outcome, tick, user) -> Position
mapping(bytes32 => mapping(uint8 => mapping(uint16 => mapping(address => Position)))) _positions;
```

### TickState (per-tick aggregate)

```solidity
struct TickState {
    uint128 totalShares;           // Sum of all positions at this tick
    uint256 fillGrowthX128;        // Cumulative fills per share (Q128)
    uint256 collateralGrowthX128;  // Cumulative collateral per share (Q128)
}

mapping(bytes32 => mapping(uint8 => mapping(uint16 => TickState))) _tickStates;
```

### User Enumeration

```solidity
// (market, outcome, user) -> tick[]
mapping(bytes32 => mapping(uint8 => mapping(address => uint16[]))) _userTicks;
```

## Key Algorithms

### Market Order (tick=0)

Uniswap V3-style tick-by-tick walk:

```
remaining = shares
currentTick = findBestTick(opposite)
while remaining > 0 && currentTick valid:
    fillAtTick = min(remaining, tickStates[currentTick].totalShares)

    // Update per-tick accumulators
    tickState.fillGrowthX128 += (fillAtTick * Q128) / totalShares
    tickState.collateralGrowthX128 += (cost * Q128) / totalShares

    remaining -= fillAtTick
    currentTick = findNextTick()
```

### Fill Attribution

```solidity
delta = tickState.fillGrowthX128 - position.fillGrowthLastX128
filledShares = (delta * position.shares) / Q128
```

### Crossing Formula (unchanged)

```
YES at tick Y crosses NO at tick N when: Y + N >= 1000
```

## Consequences

### Positive

- **Simpler Core**: No range order complexity in core contract
- **O(1) Position Updates**: Adding to existing position is 3 slots, not 7
- **Bounded Enumeration**: `_userTicks` is bounded by unique tick positions (max 999)
- **Auditable**: Core is small and focused
- **Evolvable Peripheral**: RangeOrderHelper can change without core redeploy

### Negative

- **No Native Ranges**: Range orders require peripheral contract
- **Gas for Ranges**: N single-tick orders vs 1 range order
- **Pro-Rata Dilution**: Adding to existing position dilutes fill attribution

### Neutral

- **Breaking Change**: Requires migration from V9.9.6
- **New API**: Frontend hooks need update

## Files

| File | Description |
|------|-------------|
| `src/TickBookPoolManagerV10.sol` | Core contract |
| `src/interfaces/ITickBookPoolManagerV10.sol` | Interface |
| `src/periphery/RangeOrderHelper.sol` | Range order peripheral |
| `test/v10/TickBookV10.t.sol` | 12 tests |

## Migration

Clean break (recommended for alpha):
1. Deploy V10 as new contract
2. Users cancel V9.9.6 orders, place new V10 orders
3. Frontend detects contract version, prompts migration

## Gas Comparison

| Operation | V9.9.6 | V10 |
|-----------|--------|-----|
| New position | ~7 slots | ~5 slots |
| Add to existing | ~7 slots (new order) | ~3 slots (merge) |
| User enumeration | O(n) orders | O(m) ticks |
| Cancel | O(n) find + O(1) remove | O(1) direct |

## References

- Uniswap V3: Position-based concentrated liquidity
- ADR-066: V9.9.6 Unified Order API (predecessor)
- `.agent/plans/lively-bubbling-lighthouse.md`: Original design document
