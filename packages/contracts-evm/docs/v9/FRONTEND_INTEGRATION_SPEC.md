# V9 Frontend Integration Specification

## Overview

V9 introduces a **singleton architecture** where one `TickBookPoolManager` contract manages ALL markets. This simplifies frontend integration and enables flash accounting for batch operations.

## Contract Addresses (Deployment TBD)

```typescript
const V9_CONTRACTS = {
  poolManager: '0x...', // TickBookPoolManager (singleton)
  vault: '0x...',       // TickBookVault
  launchpad: '0x...',   // LaunchpadEngine
  collateralizer: '0x...', // Collateralizer
  usdc: '0x...',        // USDC token
};
```

## Key Concepts

### Market Key
Every market is identified by a `bytes32` market key:
```typescript
const marketKey = keccak256(
  abiEncode(['address', 'address', 'address', 'address'],
    [truthMarket, yesToken, noToken, hook])
);
```

### Tick System
- Tick range: 1-999
- Each tick represents a probability: `tick / 1000`
- Tick 500 = 50% probability
- Current tick represents the market's current price

### Order Types
1. **Range Orders**: Provide liquidity across a tick range (makers)
2. **Market Orders**: Fill against existing liquidity (takers)

## Read Operations

### Get Market State
```typescript
const [currentTick, activeLiqNo, activeLiqYes, probability] =
  await poolManager.getMarketState(marketKey);

// currentTick: 500 = 50%
// activeLiqNo: Liquidity available to buy NO
// activeLiqYes: Liquidity available to buy YES
// probability: Current probability in WAD (1e18)
```

### Get Order Details
```typescript
const order = await poolManager.getOrder(marketKey, orderId);
// Returns: {
//   owner, outcome, tickLower, tickUpper, active,
//   sharesTotal, liquidity, collateralDepositedWad,
//   filledShares, collateralUsedWad
// }
```

### Get Market Info
```typescript
const [truthMarket, yesToken, noToken, hook, isActive] =
  await poolManager.getMarketInfo(marketKey);
```

### Get User Delta (Flash Accounting)
```typescript
const delta = await poolManager.getDelta(userAddress);
// Positive = user owes funds
// Negative = user is owed funds
```

## Write Operations

### 1. Deposit USDC to Vault
```typescript
// Approve vault first
await usdc.approve(vaultAddress, amount);

// Deposit (amount in USDC decimals, e.g., 100e6 for $100)
await vault.depositUsdc(amount);

// Check balance (returns WAD, 1e18)
const balanceWad = await vault.availableUsdcWad(userAddress);
```

### 2. Place Range Order (Maker)
```typescript
// Place a YES order from tick 400-600 with 1000 shares
const tx = await poolManager.placeRangeOrder(
  marketKey,
  1,        // outcome: 0=NO, 1=YES
  400,      // tickLower
  600,      // tickUpper
  parseEther('1000') // sharesTotal in WAD
);

const receipt = await tx.wait();
// Parse RangeOrderPlaced event for orderId, crossingFilled, crossingCost
```

### 3. Execute Market Order (Taker)
```typescript
// Buy 500 YES shares with max cost of 300 USDC
const tx = await poolManager.executeMarketOrder(
  marketKey,
  1,        // outcome: 0=NO, 1=YES
  parseEther('500'),   // shares in WAD
  parseEther('300')    // maxCost in WAD (slippage protection)
);

// Parse MarketOrderExecuted event for sharesFilled, totalCost, refunded
```

### 4. Cancel Order
```typescript
await poolManager.cancelOrder(marketKey, orderId);
// Collateral is automatically refunded
```

### 5. Claim Fills (Maker)
```typescript
// Claim your own fills
const [filledShares, collateralUsed] = await poolManager.claimFills(marketKey, orderId);

// Permissionless claim (anyone can trigger)
await poolManager.claimFillsFor(marketKey, orderId);

// Batch claim (gas efficient for keepers)
await poolManager.batchClaimFills(marketKey, [orderId1, orderId2, orderId3]);
```

### 6. Withdraw USDC from Vault
```typescript
// Withdraw WAD amount
await vault.withdrawUsdc(amountWad);
```

## Events

### RangeOrderPlaced
```solidity
event RangeOrderPlaced(
    address indexed owner,
    bytes32 indexed marketKey,
    uint256 indexed orderId,
    uint8 outcome,
    uint16 tickLower,
    uint16 tickUpper,
    uint256 liquidity,
    uint256 collateralReserved,
    uint256 crossingFilled,
    uint256 crossingCost
);
```

### MarketOrderExecuted
```solidity
event MarketOrderExecuted(
    address indexed taker,
    bytes32 indexed marketKey,
    uint8 outcome,
    uint256 sharesRequested,
    uint256 sharesFilled,
    uint256 totalCost,
    uint16 startTick,
    uint16 endTick,
    uint256 refunded
);
```

### FillsClaimed
```solidity
event FillsClaimed(
    address indexed owner,
    bytes32 indexed marketKey,
    uint256 indexed orderId,
    uint256 filledShares,
    uint256 collateralUsedWad
);
```

## Price Calculation

```typescript
// Tick to probability
function tickToProbability(tick: number): BigNumber {
  return BigNumber.from(tick).mul(parseEther('1')).div(1000);
}

// Probability to tick
function probabilityToTick(probWad: BigNumber): number {
  return probWad.mul(1000).div(parseEther('1')).toNumber();
}

// Cost estimation for market order
function estimateCost(shares: BigNumber, currentTick: number, outcome: number): BigNumber {
  const price = outcome === 1
    ? tickToProbability(currentTick)
    : parseEther('1').sub(tickToProbability(currentTick));
  return shares.mul(price).div(parseEther('1'));
}
```

## Migration from V8

### Changes
| V8 (TickBook) | V9 (TickBookPoolManager) |
|---------------|--------------------------|
| Per-market contracts | Singleton contract |
| `registerMarket` on each TickBook | `registerMarket` on PoolManager |
| Manual claims | Permissionless `claimFillsFor` |
| No batch operations | Flash accounting + `batchPlaceOrders` |
| No hooks | Full hook system |

### Backward Compatibility
- `registerMarket(market, yes, no, prob)` still works (no hook)
- Existing LaunchpadEngine works unchanged
- All existing markets continue to function

## Error Codes

| Error | Description |
|-------|-------------|
| `ZeroAddress()` | Invalid zero address |
| `MarketNotActive()` | Market not registered or paused |
| `MarketNotLive()` | Market deadline passed |
| `InvalidOutcome()` | Outcome must be 0 or 1 |
| `ZeroAmount()` | Cannot trade 0 shares |
| `InvalidTickRange()` | Ticks outside 1-999 or lower > upper |
| `NotOwner()` | Caller doesn't own the order |
| `OrderNotActive()` | Order already cancelled |
| `NoLiquidity()` | No liquidity to fill against |
| `SlippageExceeded()` | Cost exceeded maxCost |
| `UnsettledDeltas()` | Flash loan not repaid |
