# Additional Integration Details

This document provides specific technical details requested by the frontend team.

## 1. SoothRiskManager ABI

### Complete ABI

```json
[
  "function getBForMarket(uint256 marketId) view returns (uint256)",
  "function globalRisk() view returns (uint256 bGlobal, uint256 maxConcurrentWorstCase)",
  "function marketRiskClass(uint256 marketId) view returns (uint8)",
  "function riskClassConfigs(uint8 riskClass) view returns (uint256 multiplierBps)",
  "function updateGlobalB() nonpayable",
  "function vault() view returns (address)",
  "event GlobalBUpdated(uint256 bGlobal, uint256 Lmax, uint256 T, uint256 B)",
  "event MarketRiskClassSet(uint256 indexed marketId, uint8 cls)"
]
```

### Key View Functions

#### `getBForMarket(uint256 marketId) → uint256`

**Purpose**: Get the dynamic `b` parameter for a specific market (used in AMM pricing).

**Parameters**:

- `marketId`: uint256 - The market identifier

**Returns**:

- `uint256` - The `b` value in wei (1e18 = 1.0)

**Usage**:

```typescript
const marketId = await market.marketId();
const b = await riskManager.getBForMarket(marketId);
// b is used in amm.price() and amm.costDelta()
```

#### `globalRisk() → (uint256 bGlobal, uint256 maxConcurrentWorstCase)`

**Purpose**: Get global risk parameters.

**Returns**:

- `bGlobal`: Global base `b` value
- `maxConcurrentWorstCase`: K parameter (max concurrent worst-case scenarios)

#### `marketRiskClass(uint256 marketId) → uint8`

**Purpose**: Get the risk class for a market.

**Returns**:

- `0` = LOW
- `1` = MEDIUM
- `2` = HIGH
- `3` = CRITICAL

#### `riskClassConfigs(uint8 riskClass) → uint256`

**Purpose**: Get the multiplier for a risk class (in basis points).

**Default Values**:

- LOW: 6000 bps (0.6x)
- MEDIUM: 10000 bps (1.0x)
- HIGH: 14000 bps (1.4x)
- CRITICAL: 18000 bps (1.8x)

---

## 2. SoothVault Balance Functions

### Quick Reference

| Function                   | Returns   | Purpose                              | Used In                 |
| -------------------------- | --------- | ------------------------------------ | ----------------------- |
| `getTreasuryBalance()`     | `uint256` | Total vault assets (all LP deposits) | bGlobal calculation (T) |
| `getLiquidBufferBalance()` | `uint256` | Available liquidity (unlocked)       | bGlobal calculation (B) |
| `totalAssets()`            | `uint256` | Same as getTreasuryBalance           | Vault accounting        |
| `balanceOfLP(address)`     | `uint256` | LP's share balance                   | LP withdrawals          |
| `lockedExposure(uint256)`  | `uint256` | Locked exposure per market           | Market risk tracking    |
| `totalLockedExposure()`    | `uint256` | Total locked across all markets      | Vault utilization       |

### Complete ABI (Balance-Related Functions)

```json
[
  "function getTreasuryBalance() view returns (uint256)",
  "function getLiquidBufferBalance() view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function balanceOfLP(address lp) view returns (uint256)",
  "function lockedExposure(uint256 marketId) view returns (uint256)",
  "function totalLockedExposure() view returns (uint256)"
]
```

### Key View Functions

#### `getTreasuryBalance() → uint256`

**Purpose**: Get the total treasury balance (all LP deposits in the vault).

**Returns**:

- `uint256` - Total assets in the vault (in collateral token units)

**Implementation**:

```solidity
// Returns totalAssets
function getTreasuryBalance() external view returns (uint256) {
    return totalAssets;
}
```

**Usage**:

```typescript
const treasuryBalance = await vault.getTreasuryBalance();
// This is the "T" value used in bGlobal calculation
```

#### `getLiquidBufferBalance() → uint256`

**Purpose**: Get the available (unlocked) liquidity in the vault.

**Returns**:

- `uint256` - Available liquidity (totalAssets - totalLockedExposure)

**Implementation**:

```solidity
// Returns available liquidity
function getLiquidBufferBalance() external view returns (uint256) {
    return totalAssets - totalLockedExposure;
}
```

**Usage**:

```typescript
const bufferBalance = await vault.getLiquidBufferBalance();
// This is the "B" value used in bGlobal calculation
```

#### `totalAssets() → uint256`

**Purpose**: Get total assets held by the vault (same as getTreasuryBalance).

#### `balanceOfLP(address lp) → uint256`

**Purpose**: Get the LP share balance for a specific liquidity provider.

**Parameters**:

- `lp`: address - The liquidity provider address

**Returns**:

- `uint256` - LP's share balance (1:1 with underlying asset in this implementation)

#### `lockedExposure(uint256 marketId) → uint256`

**Purpose**: Get the locked exposure for a specific market.

**Parameters**:

- `marketId`: uint256 - The market identifier

**Returns**:

- `uint256` - Amount of exposure locked for this market

#### `totalLockedExposure() → uint256`

**Purpose**: Get the total locked exposure across all markets.

**Returns**:

- `uint256` - Sum of all locked exposure

### Understanding the Relationship: Vault Balances → bGlobal → bMarket

The vault balances directly determine the global and market-specific `b` parameters used in AMM pricing:

```
┌─────────────────────────────────────────────────────────────┐
│                    VAULT BALANCES                           │
├─────────────────────────────────────────────────────────────┤
│ T = getTreasuryBalance()      (total LP deposits)          │
│ B = getLiquidBufferBalance()  (available liquidity)        │
│ K = maxConcurrentWorstCase    (from RiskManager)           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  GLOBAL B CALCULATION                       │
├─────────────────────────────────────────────────────────────┤
│ Lmax = (T + B) / K                                          │
│ bGlobal ≈ Lmax / ln(2) ≈ Lmax × 1.4427                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                 MARKET B CALCULATION                        │
├─────────────────────────────────────────────────────────────┤
│ bMarket = bGlobal × riskClassMultiplier / 10000            │
│                                                             │
│ Risk Class Multipliers:                                     │
│   LOW:      6000 bps (0.6x)                                │
│   MEDIUM:  10000 bps (1.0x)                                │
│   HIGH:    14000 bps (1.4x)                                │
│   CRITICAL: 18000 bps (1.8x)                               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    AMM PRICING                              │
├─────────────────────────────────────────────────────────────┤
│ price = amm.price(state, outcomeIndex, bMarket)            │
│ cost = amm.costDelta(state, outcomeIndex, delta, bMarket)  │
└─────────────────────────────────────────────────────────────┘
```

### Complete Example: Monitoring Vault Health & Pricing

```typescript
// 1. Get vault balances
const treasury = await vault.getTreasuryBalance();
const buffer = await vault.getLiquidBufferBalance();
const locked = await vault.totalLockedExposure();

console.log(`Treasury (T): ${ethers.formatUnits(treasury, 18)} mUSDC`);
console.log(`Buffer (B): ${ethers.formatUnits(buffer, 18)} mUSDC`);
console.log(`Locked: ${ethers.formatUnits(locked, 18)} mUSDC`);
console.log(
  `Utilization: ${((Number(locked) / Number(treasury)) * 100).toFixed(2)}%`
);

// 2. Get global risk parameters
const [bGlobal, K] = await riskManager.globalRisk();
console.log(`bGlobal: ${ethers.formatUnits(bGlobal, 18)}`);
console.log(`Max Concurrent Worst Case (K): ${K}`);

// 3. Get market-specific b
const marketId = await market.marketId();
const bMarket = await riskManager.getBForMarket(marketId);
console.log(
  `bMarket for market ${marketId}: ${ethers.formatUnits(bMarket, 18)}`
);

// 4. Calculate price using bMarket
const [qYes, qNo] = await market.ammState();
const price = await amm.price({ qYes, qNo }, 0, bMarket);
console.log(`YES price: ${((Number(price) / 1e18) * 100).toFixed(2)}%`);
```

### When to Update bGlobal

The `bGlobal` value should be updated when vault balances change significantly:

```typescript
// After LP deposits/withdrawals or market settlements
await riskManager.updateGlobalB();

// Listen to the event
riskManager.on("GlobalBUpdated", (bGlobal, Lmax, T, B) => {
  console.log(`bGlobal updated to ${ethers.formatUnits(bGlobal, 18)}`);
  console.log(
    `Based on T=${ethers.formatUnits(T, 18)}, B=${ethers.formatUnits(B, 18)}`
  );
});
```

---

## 3. Collateral Token Details

### MockERC20 (Development/Testnet)

```solidity
string public name = "Mock USDC";
string public symbol = "mUSDC";
uint8 public decimals = 18;  // ⚠️ NOTE: 18 decimals (not 6 like real USDC)
```

**Important**: The mock token uses **18 decimals** for simplicity in development. Real USDC uses 6 decimals.

### Getting Token Info Dynamically

```typescript
// Get collateral token address
const collateralAddress = await vault.asset();

// Create token contract instance
const collateral = new ethers.Contract(
  collateralAddress,
  ["function decimals() view returns (uint8)"],
  provider
);

// Get decimals
const decimals = await collateral.decimals(); // Returns 18 for mock, 6 for real USDC
```

### Formatting Amounts

```typescript
// For display (wei to human-readable)
const displayAmount = ethers.formatUnits(weiAmount, decimals);

// For transactions (human-readable to wei)
const weiAmount = ethers.parseUnits(userInput, decimals);
```

---

## 4. Market ID System

### How Market IDs Work

**Market IDs are `uint256` values**, NOT addresses. The system uses a simple auto-incrementing counter.

#### Market ID Assignment

```solidity
// In SoothMarketFactory
uint256 public nextMarketId = 1;  // Starts at 1

function createMarket(...) returns (SoothMarket) {
    uint256 marketId = nextMarketId++;  // Auto-increment
    // ...
    market.initialize(marketId, ...);
}
```

#### Getting Market ID from Market Contract

```typescript
// Each SoothMarket contract stores its own ID
const marketId = await market.marketId(); // Returns uint256
```

### Market ID → Address Mapping

**You need to maintain your own mapping** of marketId → market address. Here are the approaches:

#### Approach 1: Listen to Factory Events (Recommended)

```typescript
// Listen to MarketCreated events
const factory = new ethers.Contract(factoryAddress, factoryABI, provider);

factory.on(
  "MarketCreated",
  (marketId, marketAddress, adjudicatorId, riskClass, exposure) => {
    // Store in your database or state
    marketRegistry[marketId] = {
      address: marketAddress,
      adjudicatorId,
      riskClass,
      exposure,
    };
  }
);
```

**MarketCreated Event**:

```solidity
event MarketCreated(
    uint256 indexed marketId,
    address market,
    bytes32 adjudicatorId,
    SoothRiskManager.RiskClass riskClass,
    uint256 exposureAllocated
)
```

#### Approach 2: Query Past Events on Load

```typescript
// Get all historical market creations
const filter = factory.filters.MarketCreated();
const events = await factory.queryFilter(filter, 0, "latest");

const marketRegistry = {};
events.forEach((event) => {
  marketRegistry[event.args.marketId] = {
    address: event.args.market,
    adjudicatorId: event.args.adjudicatorId,
    riskClass: event.args.riskClass,
  };
});
```

#### Approach 3: Use deployments.json for Initial Markets

```typescript
import deployments from "./deployments.json";

// For the example market created during deployment
const exampleMarketAddress = deployments.ExampleMarket;
const exampleMarket = new ethers.Contract(
  exampleMarketAddress,
  marketABI,
  provider
);
const marketId = await exampleMarket.marketId(); // Should be 1

// Store in registry
marketRegistry[marketId] = exampleMarketAddress;
```

### Settlement Flow with Market IDs

```typescript
// 1. Store result (uses marketId)
await settlement.storeResult(
  marketId, // uint256
  adjudicatorId,
  winningOutcome,
  truthTime
);

// 2. Store settlement root (uses marketId)
await settlement.storeSettlementRoot(
  marketId, // uint256
  batchId,
  merkleRoot,
  proofMeta
);

// 3. Claim settlement (uses marketId)
await settlement.claimSettlement(
  marketId, // uint256
  batchId,
  pnlDelta,
  merkleProof
);

// 4. Query result (uses marketId)
const result = await settlement.results(marketId);
// Returns: (bool exists, bool settled, bytes32 adjudicatorId, uint64 truthTime, uint8 winningOutcome)
```

---

## 5. Helper Functions Summary

### Essential Helpers for UI

```typescript
// 1. Get market ID from market address
const marketId = await marketContract.marketId();

// 2. Get b parameter for pricing
const b = await riskManager.getBForMarket(marketId);

// 3. Get AMM state for pricing
const [qYes, qNo] = await marketContract.ammState();

// 4. Calculate price
const price = await amm.price({ qYes, qNo }, outcomeIndex, b);

// 5. Get collateral decimals
const decimals = await collateralContract.decimals();

// 6. Check if market is settled
const result = await settlement.results(marketId);
const isSettled = result.settled;
```

### Complete Price Calculation Example

```typescript
async function getMarketPrice(marketAddress: string, outcomeIndex: 0 | 1) {
  // Get contracts
  const market = new ethers.Contract(marketAddress, marketABI, provider);
  const marketId = await market.marketId();

  // Get AMM state
  const [qYes, qNo] = await market.ammState();

  // Get b parameter
  const b = await riskManager.getBForMarket(marketId);

  // Calculate price
  const priceWei = await amm.price({ qYes, qNo }, outcomeIndex, b);

  // Convert to percentage (0-100)
  const pricePercent = (Number(priceWei) / 1e18) * 100;

  return pricePercent;
}
```

---

## 6. Contract Addresses Reference

All contract addresses are in `deployments.json`:

```json
{
  "MockERC20": "0x...", // Collateral token
  "SoothVault": "0x...", // LP vault
  "SoothRiskManager": "0x...", // Risk parameters (getBForMarket)
  "SoothBalancedAMM": "0x...", // AMM for pricing
  "SoothAdjudicatorRegistry": "0x...",
  "SoothSettlement": "0x...", // Settlement & claims
  "SoothMarketFactory": "0x...", // Market creation
  "ExampleMarket": "0x..." // First market (marketId = 1)
}
```

---

## 7. Quick Integration Checklist

### Risk Manager & Pricing

- [ ] Load `SoothRiskManager` contract with address from deployments.json
- [ ] Add `getBForMarket(uint256)` to your hooks
- [ ] Add `globalRisk()` to get `bGlobal` and `K` parameters

### Vault Balance Monitoring

- [ ] Load `SoothVault` contract with address from deployments.json
- [ ] Add `getTreasuryBalance()` to monitor total vault assets (T)
- [ ] Add `getLiquidBufferBalance()` to monitor available liquidity (B)
- [ ] Add `totalLockedExposure()` to calculate vault utilization
- [ ] Call `riskManager.updateGlobalB()` after significant vault balance changes
- [ ] Listen to `GlobalBUpdated` events to track bGlobal changes

### Market IDs & Settlement

- [ ] Use `uint256 marketId` (not address) for all settlement functions
- [ ] Maintain marketId → address mapping via `MarketCreated` events
- [ ] For initial market, get ID via `market.marketId()` (should be 1)
- [ ] Use `marketId` in all settlement contract calls

### Token Handling

- [ ] Get collateral decimals dynamically via `vault.asset()` then `decimals()`
- [ ] Format amounts using the correct decimals (18 for mock, 6 for real USDC)
