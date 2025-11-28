# Sooth Protocol - Contract Interface Documentation for Frontend Integration

## Overview
This document provides comprehensive contract interfaces, ABIs, function signatures, and usage examples for integrating with the Sooth Protocol smart contracts.

## Contract Addresses
Load from `deployments.json`:
```json
{
  "MockERC20": "0x...",
  "SoothVault": "0x...",
  "SoothRiskManager": "0x...",
  "SoothBalancedAMM": "0x...",
  "SoothAdjudicatorRegistry": "0x...",
  "SoothSettlement": "0x...",
  "SoothMarketFactory": "0x...",
  "ExampleMarket": "0x..."
}
```

---

## 1. SoothMarket - Prediction Market Contract

### Key View Functions

#### `isLive() → bool`
Check if market is active for trading.
```solidity
function isLive() external view returns (bool)
```

#### `isSettled() → bool`
Check if market has been settled.
```solidity
function isSettled() external view returns (bool)
```

#### `ammState() → (int256 qYes, int256 qNo)`
Get current AMM state (quantity of YES and NO shares).
```solidity
function ammState() external view returns (int256 qYes, int256 qNo)
```

#### `yesBalance(address) → uint256`
Get user's YES share balance.
```solidity
function yesBalance(address user) external view returns (uint256)
```

#### `noBalance(address) → uint256`
Get user's NO share balance.
```solidity
function noBalance(address user) external view returns (uint256)
```

#### `winningOutcome() → uint8`
Get winning outcome after settlement (0 = NO, 1 = YES).
```solidity
function winningOutcome() external view returns (uint8)
```

#### `truthTime() → uint64`
Get truth time (T*) when market was settled.
```solidity
function truthTime() external view returns (uint64)
```

### Write Functions

#### `trade(uint8 outcomeIndex, int256 deltaShares)`
Execute a trade (buy or sell shares).

**Parameters:**
- `outcomeIndex`: 0 = YES, 1 = NO
- `deltaShares`: Positive to buy, negative to sell (in wei, 1e18 = 1 share)

**Requirements:**
- Market must be live (`isLive == true && isSettled == false`)
- For sells: user must own sufficient shares
- User must approve collateral token spending for buys

**Events:**
```solidity
event Trade(address indexed trader, uint8 outcomeIndex, int256 deltaShares, int256 cost)
```

**Example Usage:**
```typescript
// Buy 10 YES shares
await market.trade(0, ethers.parseEther("10"));

// Sell 5 NO shares
await market.trade(1, ethers.parseEther("-5"));
```

---

## 2. SoothVault - Liquidity Pool Contract

### Key View Functions

#### `totalAssets() → uint256`
Total assets held by the vault.
```solidity
function totalAssets() external view returns (uint256)
```

#### `balanceOfLP(address) → uint256`
Get LP's share balance.
```solidity
function balanceOfLP(address lp) external view returns (uint256)
```

#### `getTreasuryBalance() → uint256`
Get total treasury balance (same as totalAssets).
```solidity
function getTreasuryBalance() external view returns (uint256)
```

#### `getLiquidBufferBalance() → uint256`
Get available liquidity (totalAssets - totalLockedExposure).
```solidity
function getLiquidBufferBalance() external view returns (uint256)
```

#### `lockedExposure(uint256 marketId) → uint256`
Get locked exposure for a specific market.
```solidity
function lockedExposure(uint256 marketId) external view returns (uint256)
```

### Write Functions

#### `depositFor(address lp, uint256 assets) → uint256`
Deposit collateral to provide liquidity.

**Parameters:**
- `lp`: Address to credit LP shares to
- `assets`: Amount of collateral to deposit (in wei)

**Requirements:**
- User must approve collateral token spending
- `assets > 0`

**Events:**
```solidity
event Deposit(address indexed lp, uint256 assets)
```

**Example Usage:**
```typescript
// Approve collateral
await collateral.approve(vaultAddress, ethers.parseEther("1000"));

// Deposit 1000 tokens
await vault.depositFor(userAddress, ethers.parseEther("1000"));
```

#### `withdrawFor(address lp, uint256 assets, address receiver) → uint256`
Withdraw liquidity.

**Parameters:**
- `lp`: Address to debit LP shares from
- `assets`: Amount to withdraw
- `receiver`: Address to receive the collateral

**Requirements:**
- LP must have sufficient balance
- Vault must have sufficient unlocked liquidity

**Events:**
```solidity
event Withdraw(address indexed lp, uint256 assets, address indexed receiver)
```

---

## 3. SoothSettlement - Settlement & Claims Contract

### Key View Functions

#### `results(uint256 marketId) → (bool exists, bool settled, bytes32 adjudicatorId, uint64 truthTime, uint8 winningOutcome)`
Get settlement result for a market.
```solidity
function results(uint256 marketId) external view returns (
    bool exists,
    bool settled,
    bytes32 adjudicatorId,
    uint64 truthTime,
    uint8 winningOutcome
)
```

#### `settlementRoots(bytes32 batchId) → bytes32`
Get Merkle root for a settlement batch.
```solidity
function settlementRoots(bytes32 batchId) external view returns (bytes32)
```

#### `claimed(bytes32 batchId, address account) → bool`
Check if account has claimed from a batch.
```solidity
function claimed(bytes32 batchId, address account) external view returns (bool)
```

### Write Functions (Owner/Prover Only)

#### `storeResult(uint256 marketId, bytes32 adjudicatorId, uint8 winningOutcome, uint64 truthTime)`
Store the adjudicated result for a market.

**Role:** Owner only
**Parameters:**
- `marketId`: Market identifier
- `adjudicatorId`: Adjudicator that resolved the market
- `winningOutcome`: 0 = NO, 1 = YES
- `truthTime`: Timestamp when truth was determined (T*)

**Requirements:**
- Adjudicator must be enabled
- Market must not already be settled

**Events:**
```solidity
event ResultStored(uint256 indexed marketId, bytes32 adjudicatorId, uint8 winningOutcome, uint64 truthTime)
```

#### `storeSettlementRoot(uint256 marketId, bytes32 batchId, bytes32 root, bytes proofMeta)`
Upload Merkle root for PnL settlement.

**Role:** Prover only (set via `setProver()`)
**Parameters:**
- `marketId`: Market identifier
- `batchId`: Unique batch identifier
- `root`: Merkle root of (marketId, account, pnlDelta) tuples
- `proofMeta`: Optional metadata (currently unused)

**Requirements:**
- Caller must be authorized prover
- Market must be settled

**Events:**
```solidity
event SettlementRootStored(uint256 indexed marketId, bytes32 batchId, bytes32 root)
```

### Write Functions (Public)

#### `claimSettlement(uint256 marketId, bytes32 batchId, int256 pnlDelta, bytes32[] merkleProof)`
Claim PnL for a settled market.

**Parameters:**
- `marketId`: Market identifier
- `batchId`: Settlement batch ID
- `pnlDelta`: User's PnL delta (positive = profit, negative = loss)
- `merkleProof`: Merkle proof for inclusion

**Requirements:**
- Settlement root must exist for batchId
- User must not have already claimed
- Merkle proof must be valid

**Merkle Leaf Format:**
```solidity
bytes32 leaf = keccak256(abi.encodePacked(marketId, msg.sender, pnlDelta));
```

**Events:**
```solidity
event Claimed(uint256 indexed marketId, bytes32 batchId, address indexed account, int256 pnlDelta)
```

**Example Usage:**
```typescript
// Claim settlement with proof
await settlement.claimSettlement(
    marketId,
    batchId,
    pnlDelta, // e.g., ethers.parseEther("50") for +50 profit
    merkleProof // array of bytes32
);
```

---

## 4. Price Calculation (Off-chain Helper)

To get current prices, you need to call the AMM contract directly:

```solidity
// SoothBalancedAMM
function price(
    State memory s,      // ammState from market
    uint8 outcomeIndex,  // 0 = YES, 1 = NO
    uint256 b            // from riskManager.getBForMarket(marketId)
) external pure returns (uint256 priceWad)
```

**Example Integration:**
```typescript
// Get market state
const [qYes, qNo] = await market.ammState();
const b = await riskManager.getBForMarket(marketId);

// Get price for YES (outcomeIndex = 0)
const ammState = { qYes, qNo };
const yesPrice = await amm.price(ammState, 0, b);

// Get price for NO (outcomeIndex = 1)
const noPrice = await amm.price(ammState, 1, b);
```

---

## 5. UI Button Gating Logic

### Trading Interface
```typescript
// Enable trade button if:
const canTrade = market.isLive && !market.isSettled;

// For sell orders, check balance:
const canSellYes = yesBalance >= sellAmount;
const canSellNo = noBalance >= sellAmount;
```

### LP Dashboard
```typescript
// Enable deposit if vault is active
const canDeposit = true; // No specific gate

// Enable withdraw if:
const canWithdraw = lpBalance >= withdrawAmount && 
                    vault.getLiquidBufferBalance() >= withdrawAmount;
```

### Settlement/Claims
```typescript
// Show settlement upload if:
const canUploadSettlement = isProver && marketResult.settled;

// Show claim button if:
const canClaim = settlementRoots[batchId] !== 0 && 
                 !claimed[batchId][userAddress];
```

---

## 6. Role-Based Access Control

### Owner-Only Functions
- `SoothMarket.markSettled()`
- `SoothSettlement.storeResult()`
- `SoothVault.setAuthorized()`
- `SoothMarketFactory.createMarket()`

### Prover-Only Functions
- `SoothSettlement.storeSettlementRoot()` - requires `provers[msg.sender] == true`

### Authorized-Only Functions
- `SoothVault.allocateExposure()` - requires `authorizedSpender[msg.sender] == true`
- `SoothVault.applySettlementDelta()` - requires `authorizedSpender[msg.sender] == true`

---

## 7. Complete ABIs

### SoothMarket ABI (Essential Functions)
```json
[
  "function isLive() view returns (bool)",
  "function isSettled() view returns (bool)",
  "function ammState() view returns (int256 qYes, int256 qNo)",
  "function yesBalance(address) view returns (uint256)",
  "function noBalance(address) view returns (uint256)",
  "function winningOutcome() view returns (uint8)",
  "function truthTime() view returns (uint64)",
  "function trade(uint8 outcomeIndex, int256 deltaShares)",
  "event Trade(address indexed trader, uint8 outcomeIndex, int256 deltaShares, int256 cost)"
]
```

### SoothVault ABI (Essential Functions)
```json
[
  "function totalAssets() view returns (uint256)",
  "function balanceOfLP(address) view returns (uint256)",
  "function getTreasuryBalance() view returns (uint256)",
  "function getLiquidBufferBalance() view returns (uint256)",
  "function depositFor(address lp, uint256 assets) returns (uint256)",
  "function withdrawFor(address lp, uint256 assets, address receiver) returns (uint256)",
  "event Deposit(address indexed lp, uint256 assets)",
  "event Withdraw(address indexed lp, uint256 assets, address indexed receiver)"
]
```

### SoothSettlement ABI (Essential Functions)
```json
[
  "function results(uint256) view returns (bool exists, bool settled, bytes32 adjudicatorId, uint64 truthTime, uint8 winningOutcome)",
  "function settlementRoots(bytes32) view returns (bytes32)",
  "function claimed(bytes32, address) view returns (bool)",
  "function storeResult(uint256 marketId, bytes32 adjudicatorId, uint8 winningOutcome, uint64 truthTime)",
  "function storeSettlementRoot(uint256 marketId, bytes32 batchId, bytes32 root, bytes proofMeta)",
  "function claimSettlement(uint256 marketId, bytes32 batchId, int256 pnlDelta, bytes32[] merkleProof)",
  "event ResultStored(uint256 indexed marketId, bytes32 adjudicatorId, uint8 winningOutcome, uint64 truthTime)",
  "event SettlementRootStored(uint256 indexed marketId, bytes32 batchId, bytes32 root)",
  "event Claimed(uint256 indexed marketId, bytes32 batchId, address indexed account, int256 pnlDelta)"
]
```

---

## 8. Common Integration Patterns

### Pattern 1: Execute a Trade
```typescript
// 1. Get current price
const [qYes, qNo] = await market.ammState();
const b = await riskManager.getBForMarket(marketId);
const price = await amm.price({ qYes, qNo }, outcomeIndex, b);

// 2. Approve collateral (for buys)
if (deltaShares > 0) {
  const cost = estimateCost(price, deltaShares); // Calculate off-chain
  await collateral.approve(vaultAddress, cost);
}

// 3. Execute trade
await market.trade(outcomeIndex, deltaShares);
```

### Pattern 2: Provide Liquidity
```typescript
// 1. Approve collateral
await collateral.approve(vaultAddress, depositAmount);

// 2. Deposit
await vault.depositFor(userAddress, depositAmount);

// 3. Check new balance
const lpBalance = await vault.balanceOfLP(userAddress);
```

### Pattern 3: Claim Settlement
```typescript
// 1. Check if market is settled
const result = await settlement.results(marketId);
if (!result.settled) return;

// 2. Check if user has claimed
const hasClaimed = await settlement.claimed(batchId, userAddress);
if (hasClaimed) return;

// 3. Get proof from off-chain service
const { pnlDelta, merkleProof } = await fetchSettlementProof(marketId, userAddress);

// 4. Claim
await settlement.claimSettlement(marketId, batchId, pnlDelta, merkleProof);
```

---

## 9. Event Monitoring

### Key Events to Monitor

**Trading Activity:**
- `SoothMarket.Trade` - Track all trades for price updates

**LP Activity:**
- `SoothVault.Deposit` - Track liquidity additions
- `SoothVault.Withdraw` - Track liquidity removals

**Settlement:**
- `SoothSettlement.ResultStored` - Market outcome determined
- `SoothSettlement.SettlementRootStored` - PnL batch ready for claims
- `SoothSettlement.Claimed` - User claimed settlement

---

## 10. Error Handling

Common revert reasons:

**SoothMarket:**
- `"Market: not live"` - Market is not active or already settled
- `"Market: zero trade"` - deltaShares is 0
- `"Market: not enough YES/NO"` - Insufficient shares for sell

**SoothVault:**
- `"Vault: zero deposit"` - Deposit amount is 0
- `"Vault: insufficient shares"` - LP doesn't have enough shares
- `"Vault: locked"` - Not enough liquid balance for withdrawal

**SoothSettlement:**
- `"Settlement: no root"` - Settlement root not uploaded yet
- `"Settlement: already claimed"` - User already claimed this batch
- `"Settlement: bad proof"` - Invalid Merkle proof
