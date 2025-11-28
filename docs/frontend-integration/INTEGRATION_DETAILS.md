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

## 2. Collateral Token Details

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

## 3. Market ID System

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
const marketId = await market.marketId();  // Returns uint256
```

### Market ID → Address Mapping

**You need to maintain your own mapping** of marketId → market address. Here are the approaches:

#### Approach 1: Listen to Factory Events (Recommended)
```typescript
// Listen to MarketCreated events
const factory = new ethers.Contract(factoryAddress, factoryABI, provider);

factory.on("MarketCreated", (marketId, marketAddress, adjudicatorId, riskClass, exposure) => {
  // Store in your database or state
  marketRegistry[marketId] = {
    address: marketAddress,
    adjudicatorId,
    riskClass,
    exposure
  };
});
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
const events = await factory.queryFilter(filter, 0, 'latest');

const marketRegistry = {};
events.forEach(event => {
  marketRegistry[event.args.marketId] = {
    address: event.args.market,
    adjudicatorId: event.args.adjudicatorId,
    riskClass: event.args.riskClass
  };
});
```

#### Approach 3: Use deployments.json for Initial Markets
```typescript
import deployments from './deployments.json';

// For the example market created during deployment
const exampleMarketAddress = deployments.ExampleMarket;
const exampleMarket = new ethers.Contract(exampleMarketAddress, marketABI, provider);
const marketId = await exampleMarket.marketId(); // Should be 1

// Store in registry
marketRegistry[marketId] = exampleMarketAddress;
```

### Settlement Flow with Market IDs

```typescript
// 1. Store result (uses marketId)
await settlement.storeResult(
  marketId,        // uint256
  adjudicatorId,
  winningOutcome,
  truthTime
);

// 2. Store settlement root (uses marketId)
await settlement.storeSettlementRoot(
  marketId,        // uint256
  batchId,
  merkleRoot,
  proofMeta
);

// 3. Claim settlement (uses marketId)
await settlement.claimSettlement(
  marketId,        // uint256
  batchId,
  pnlDelta,
  merkleProof
);

// 4. Query result (uses marketId)
const result = await settlement.results(marketId);
// Returns: (bool exists, bool settled, bytes32 adjudicatorId, uint64 truthTime, uint8 winningOutcome)
```

---

## 4. Helper Functions Summary

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
  const pricePercent = Number(priceWei) / 1e18 * 100;
  
  return pricePercent;
}
```

---

## 5. Contract Addresses Reference

All contract addresses are in `deployments.json`:
```json
{
  "MockERC20": "0x...",           // Collateral token
  "SoothVault": "0x...",          // LP vault
  "SoothRiskManager": "0x...",    // Risk parameters (getBForMarket)
  "SoothBalancedAMM": "0x...",    // AMM for pricing
  "SoothAdjudicatorRegistry": "0x...",
  "SoothSettlement": "0x...",     // Settlement & claims
  "SoothMarketFactory": "0x...",  // Market creation
  "ExampleMarket": "0x..."        // First market (marketId = 1)
}
```

---

## 6. Quick Integration Checklist

- [ ] Load `SoothRiskManager` contract with address from deployments.json
- [ ] Add `getBForMarket(uint256)` to your hooks
- [ ] Get collateral decimals dynamically via `vault.asset()` then `decimals()`
- [ ] Use `uint256 marketId` (not address) for all settlement functions
- [ ] Maintain marketId → address mapping via `MarketCreated` events
- [ ] For initial market, get ID via `market.marketId()` (should be 1)
- [ ] Use `marketId` in all settlement contract calls
- [ ] Format amounts using the correct decimals (18 for mock, 6 for real USDC)
