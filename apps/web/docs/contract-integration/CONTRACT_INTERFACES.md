# Sooth Protocol - Contract Interface Documentation

**Version:** 2.0 (Singleton Trader Vault)  
**Updated:** 2025-12-04

> [!WARNING]
> This doc was updated for the v2 architecture. Key changes:
>
> - Users deposit to `SoothTraderVault` (not market)
> - LPs deposit to `SoothGovernorVault` (renamed from SoothVault)
> - `SoothRiskManager` removed - Governor sets `b` directly
> - New `SoothFeeController` for orderbook fees

---

## Contract Addresses

Load from `deployments.json` or `deployments-monad.json`:

```json
{
  "MockERC20": "0x...",
  "SoothTraderVault": "0x...",
  "SoothGovernorVault": "0x...",
  "SoothFeeController": "0x...",
  "SoothLMSRReal": "0x...",
  "SoothAdjudicatorRegistry": "0x...",
  "SoothSettlement": "0x...",
  "SoothMarketFactory": "0x..."
}
```

---

## 1. SoothTraderVault - User Fund Management (NEW)

### View Functions

```solidity
function freeBalance(address user) external view returns (uint256);
function lockedBalance(address user) external view returns (uint256);
function asset() external view returns (IERC20);
```

### Write Functions

#### `deposit(uint256 amount)`

Deposit collateral to trade.

```typescript
// Approve first
await usdc.approve(traderVaultAddress, amount);
// Deposit
await traderVault.deposit(parseUnits("100", 6));
```

#### `withdraw(uint256 amount)`

Withdraw available (unlocked) funds.

```typescript
await traderVault.withdraw(parseUnits("50", 6));
```

---

## 2. SoothGovernorVault - LP Liquidity (Renamed)

### View Functions

```solidity
function totalAssets() external view returns (uint256);
function balanceOf(address lp) external view returns (uint256);  // LP shares
function totalSupply() external view returns (uint256);  // Total LP shares
function getMarketReserve(uint256 marketId) external view returns (int256);
```

### Write Functions

#### `depositFor(address lp, uint256 assets)`

LP deposits collateral, receives svTokens.

```typescript
await usdc.approve(governorVaultAddress, amount);
await governorVault.depositFor(lpAddress, amount);
```

#### `withdrawFor(address lp, uint256 assets, address receiver)`

LP withdraws liquidity.

```typescript
await governorVault.withdrawFor(lpAddress, amount, lpAddress);
```

---

## 3. SoothMarket - Trading

### View Functions

```solidity
function isLive() external view returns (bool);
function isSettled() external view returns (bool);
function ammState() external view returns (int256 qYes, int256 qNo);
function yesBalance(address) external view returns (uint256);
function noBalance(address) external view returns (uint256);
function winningOutcome() external view returns (uint8);
function truthTime() external view returns (uint64);
function b() external view returns (uint256);         // Liquidity parameter
function feeLMSR() external view returns (uint256);   // AMM fee (bps)
function governor() external view returns (address);  // Governor address
```

### Write Functions

#### `trade(uint8 outcomeIndex, int256 deltaShares, int256 maxCost)`

Execute trade with fee and slippage protection.

**Parameters:**

- `outcomeIndex`: 0 = YES, 1 = NO
- `deltaShares`: Positive = buy, Negative = sell
- `maxCost`: Max cost including fees (slippage protection)

**Example:**

```typescript
// Get price info
const b = await market.b();
const feeLMSR = await market.feeLMSR();
const [qYes, qNo] = await market.ammState();

// Calculate cost
const [cost] = await amm.costDelta({ qYes, qNo }, 0, parseEther("10"), b);

// Add fee + slippage
const fee = (cost * BigInt(feeLMSR)) / 10000n;
const maxCost = ((cost + fee) * 105n) / 100n; // 5% slippage buffer

// Execute
await market.trade(0, parseEther("10"), maxCost);
```

**Events:**

```solidity
event Trade(
    address indexed trader,
    uint8 outcomeIndex,
    int256 deltaShares,
    int256 cost,
    uint256 orderbookFee,  // Fee from orderbook fills
    uint256 ammFee         // Fee from AMM fills
);
```

#### `placeOrder(uint8 outcome, uint256 price, uint256 amount)`

Place limit order.

```typescript
await market.placeOrder(0, parseEther("0.6"), parseEther("100"));
```

#### `cancelOrder(uint256 orderId)`

Cancel limit order.

```typescript
await market.cancelOrder(orderId);
```

---

## 4. SoothFeeController - Fee Settings (NEW)

### View Functions

```solidity
function orderbookFee() external view returns (uint256);  // Basis points
function lpSplitBps() external view returns (uint256);    // LP share of fees
function treasury() external view returns (address);
```

### Usage

```typescript
// Display fees
const orderbookFee = await feeController.orderbookFee();
const feeLMSR = await market.feeLMSR();

console.log(`Orderbook Fee: ${orderbookFee / 100}%`);
console.log(`AMM Fee: ${feeLMSR / 100}%`);
```

---

## 5. SoothSettlement - Claims

### View Functions

```solidity
function results(uint256 marketId) external view returns (
    bool exists,
    bool settled,
    bytes32 adjudicatorId,
    uint64 truthTime,
    uint8 winningOutcome
);
function settlementRoots(bytes32 batchId) external view returns (bytes32);
function claimed(bytes32 batchId, address account) external view returns (bool);
```

### Write Functions

```solidity
function claimSettlement(
    uint256 marketId,
    bytes32 batchId,
    int256 pnlDelta,
    bytes32[] merkleProof
) external;
```

---

## 6. Price Calculation

```typescript
// Get market params
const [qYes, qNo] = await market.ammState();
const b = await market.b();

// Get prices from AMM
const yesPrice = await amm.price({ qYes, qNo }, 0, b);
const noPrice = await amm.price({ qYes, qNo }, 1, b);

// Calculate expected cost
const [cost] = await amm.costDelta({ qYes, qNo }, 0, parseEther("10"), b);
```

---

## 7. Button Gating Logic

### Trading

```typescript
const canTrade = market.isLive && !market.isSettled;
const hasFunds = traderVault.freeBalance(user) >= estimatedCost;
const canSellYes = yesBalance >= sellAmount;
```

### LP Dashboard

```typescript
const canDeposit = usdc.balanceOf(user) >= amount;
const canWithdraw = governorVault.balanceOf(user) >= lpShares;
```

### Claims

```typescript
const canClaim = settlementRoots[batchId] !== 0 && !claimed[batchId][user];
```

---

## 8. Essential ABIs

### SoothTraderVault

```json
[
  "function deposit(uint256 amount) returns (uint256)",
  "function withdraw(uint256 amount) returns (uint256)",
  "function freeBalance(address) view returns (uint256)",
  "function lockedBalance(address) view returns (uint256)"
]
```

### SoothGovernorVault

```json
[
  "function totalAssets() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function depositFor(address lp, uint256 assets) returns (uint256)",
  "function withdrawFor(address lp, uint256 assets, address receiver) returns (uint256)"
]
```

### SoothMarket

```json
[
  "function isLive() view returns (bool)",
  "function isSettled() view returns (bool)",
  "function ammState() view returns (int256 qYes, int256 qNo)",
  "function yesBalance(address) view returns (uint256)",
  "function noBalance(address) view returns (uint256)",
  "function b() view returns (uint256)",
  "function feeLMSR() view returns (uint256)",
  "function trade(uint8 outcomeIndex, int256 deltaShares, int256 maxCost)",
  "function placeOrder(uint8 outcome, uint256 price, uint256 amount) returns (uint256)",
  "function cancelOrder(uint256 orderId)",
  "event Trade(address indexed trader, uint8 outcomeIndex, int256 deltaShares, int256 cost, uint256 orderbookFee, uint256 ammFee)"
]
```

### SoothFeeController

```json
[
  "function orderbookFee() view returns (uint256)",
  "function lpSplitBps() view returns (uint256)",
  "function treasury() view returns (address)"
]
```

---

## 9. Error Handling

**SoothTraderVault:**

- `"TraderVault: insufficient free balance"` - Deposit more funds
- `"TraderVault: not a market"` - Only markets can call restricted functions

**SoothMarket:**

- `"Market: not live"` - Market settled or paused
- `"Market: slippage exceeded"` - Increase maxCost
- `"Market: not enough YES/NO"` - Insufficient shares to sell

**SoothGovernorVault:**

- `"GovernorVault: insufficient shares"` - LP doesn't have enough tokens
