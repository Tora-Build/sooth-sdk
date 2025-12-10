# Contract Interfaces - V4 Reference

**Version:** 4.0 (Dual-Venue + Hybrid Granularity)
**Updated:** 2025-12-10

---

## Contract Addresses (Base Sepolia)

```json
{
  "USDC": "0xd2C6903C7311C7EC6F2f09DA7A0d417A59CB04ab",
  "GovernorVault": "0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f",
  "TraderVaultV4": "0xee91e05f95cBaACD46f58432DF72CB5C451e98E0",
  "FeeController": "0xa367B312Ca1845B7c6076345cB5cd529F935B4FA"
}
```

---

## 1. SoothTraderVaultV4 - Entry Point

All user interactions go through TraderVaultV4.

### View Functions

```solidity
function accounts(address user) external view returns (uint256 available, uint256 pending);
function ammPositions(address user, address market) external view returns (uint256 yesShares, uint256 noShares, uint256 unlockTime);
```

### Write Functions

#### `deposit(uint256 amount)`
```typescript
await usdc.approve(TRADER_VAULT, amount);
await traderVault.deposit(parseUnits('100', 18));
```

#### `tradeAMM(address market, uint8 outcome, int256 deltaShares, int256 maxCost)`
AMM trade (WAD Granularity).

```typescript
// Buy 10 YES shares (WAD)
await traderVault.tradeAMM(
  MARKET_ADDRESS,
  0, // YES
  parseUnits('10', 18), // shares
  parseUnits('15', 18)  // maxCost
);
```

#### `placeOrder(address market, uint8 outcome, uint256 price, uint256 amount, bool isBuy)`
Orderbook limit order (Integer Granularity, No Locks).

```typescript
await traderVault.placeOrder(
  MARKET_ADDRESS,
  0, // YES
  parseUnits('0.6', 18), // 60% price (WAD)
  100n,                  // 100 Shares (INTEGER)
  true                   // isBuy
);
```

---

## 2. SoothMarketV4 - Market Data

### View Functions

```solidity
function price(uint8 outcome) external view returns (uint256 priceWad);
function calculateAMMTradeCost(uint8 outcome, uint256 shares, bool isBuy) external view returns (int256 cost, uint256 fee, int256 newQYes, int256 newQNo);
```

### Usage

```typescript
// Get probability/price
const priceWad = await market.price(1); // 1 = YES? Check contract convention.

// Estimate cost
const costData = await market.calculateAMMTradeCost(0, parseUnits('10', 18), true);
```

---

## 3. OutcomeToken - ERC1155 Orderbook Tokens

### View Functions

```solidity
function balanceOf(address account, uint256 id) external view returns (uint256);
```

### Usage

```typescript
// Check YES tokens (id=0)
const yesBalance = await outcomeToken.balanceOf(userAddress, 0);

// Check NO tokens (id=1)
const noBalance = await outcomeToken.balanceOf(userAddress, 1);
```

---

## Essential ABIs

New ABIs are located in `src/config/abis/`:
*   `SoothTraderVault.json` (Points to V4)
*   `SoothMarket.json` (Points to V4)
*   `OutcomeToken.json`

---

## Contract Addresses (Base Sepolia)

```json
{
  "USDC": "0xd2C6903C7311C7EC6F2f09DA7A0d417A59CB04ab",
  "GovernorVault": "0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f",
  "TraderVaultV4": "0xee91e05f95cBaACD46f58432DF72CB5C451e98E0",
  "FeeController": "0xa367B312Ca1845B7c6076345cB5cd529F935B4FA"
}
```

---

## 1. SoothTraderVaultV4 - Entry Point

All user interactions go through TraderVaultV4.

### View Functions

```solidity
function accounts(address user) external view returns (uint256 available, uint256 pending);
function ammPositions(address user, address market) external view returns (uint256 yesShares, uint256 noShares, uint256 unlockTime);
```

### Write Functions

#### `deposit(uint256 amount)`
```typescript
await usdc.approve(TRADER_VAULT, amount);
await traderVault.deposit(parseUnits('100', 18));
```

#### `withdraw(uint256 amount)`
```typescript
await traderVault.withdraw(parseUnits('50', 18));
```

#### `executeAMMTrade(address market, uint8 outcome, uint256 shares, uint256 limit, bool isBuy)`

AMM trade with lock-on-buy.

```typescript
// Buy (shares locked 24h)
await traderVault.executeAMMTrade(
  MARKET_ADDRESS,
  1, // YES
  parseUnits('10', 18),
  parseUnits('15', 18), // maxCost
  true
);

// Sell (after unlock, instant USDC)
await traderVault.executeAMMTrade(
  MARKET_ADDRESS,
  1,
  parseUnits('10', 18),
  parseUnits('5', 18), // minProceeds
  false
);
```

#### `placeOrder(address market, uint8 outcome, uint256 price, uint256 amount)`

Orderbook limit order (ERC1155, no locks).

```typescript
await traderVault.placeOrder(
  MARKET_ADDRESS,
  1,
  parseUnits('0.6', 18), // 60% price
  parseUnits('100', 18)
);
```

#### `cancelOrder(address market, uint256 orderId)`
```typescript
await traderVault.cancelOrder(MARKET_ADDRESS, ORDER_ID);
```

---

## 2. SoothMarketV4 - Market Data

### View Functions

```solidity
function currentTick() external view returns (uint16);
function b() external view returns (uint256);
function bBase() external view returns (uint256);
function calculateAMMTradeCost(uint8 outcome, uint256 shares, bool isBuy) external view returns (uint256);
```

### Usage

```typescript
// Get probability
const tick = await market.currentTick();
const probability = tick / 1000; // 500 → 0.5 (50%)

// Get liquidity
const b = await market.b(); // Dynamic liquidity

// Estimate cost
const cost = await market.calculateAMMTradeCost(1, parseUnits('10', 18), true);
```

---

## 3. OutcomeToken - ERC1155 Orderbook Tokens

### View Functions

```solidity
function balanceOf(address account, uint256 id) external view returns (uint256);
function balanceOfBatch(address[] accounts, uint256[] ids) external view returns (uint256[]);
```

### Usage

```typescript
// Check YES tokens (id=1)
const yesBalance = await outcomeToken.balanceOf(userAddress, 1);

// Check NO tokens (id=0)
const noBalance = await outcomeToken.balanceOf(userAddress, 0);
```

---

## 4. Events

### TraderVaultV4

```solidity
event AMMBuy(address indexed user, address indexed market, uint8 outcome, uint256 shares, uint256 cost, uint256 unlockTime);
event AMMSell(address indexed user, address indexed market, uint8 outcome, uint256 shares, uint256 proceeds);
event OrderPlaced(address indexed user, address indexed market, uint256 orderId, uint8 outcome, uint256 price, uint256 amount);
```

### Market

```solidity
event TickUpdated(uint16 oldTick, uint16 newTick);
event Initialized(uint256 marketId, uint256 bBase, uint16 initialTick);
```

---

## Essential ABIs

### TraderVaultV4
```json
[
  "function deposit(uint256) returns (uint256)",
  "function withdraw(uint256) returns (uint256)",
  "function accounts(address) view returns (uint256 available, uint256 pending)",
  "function ammPositions(address, address) view returns (uint256 yesShares, uint256 noShares, uint256 unlockTime)",
  "function executeAMMTrade(address market, uint8 outcome, uint256 shares, uint256 limit, bool isBuy)",
  "function placeOrder(address market, uint8 outcome, uint256 price, uint256 amount) returns (uint256)",
  "function cancelOrder(address market, uint256 orderId)"
]
```

### MarketV4
```json
[
  "function currentTick() view returns (uint16)",
  "function b() view returns (uint256)",
  "function bBase() view returns (uint256)",
  "function calculateAMMTradeCost(uint8 outcome, uint256 shares, bool isBuy) view returns (uint256)"
]
```

### OutcomeToken
```json
[
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"
]
```

---

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `TraderVault: insufficient available` | Not enough USDC | Deposit more |
| `TraderVault: position locked` | AMM shares still locked | Wait for unlock time |
| `Market: slippage exceeded` | Price moved | Increase slippage buffer |
