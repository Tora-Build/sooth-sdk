# Contract ABI Files

**Generated:** 2025-12-04

## Available ABIs

All v3 contract ABIs are available in this folder:

- `SoothMarketV3.abi.json` - Market contract (orderbook + AMM)
- `SoothTraderVaultV3.abi.json` - Single entry point for all trading
- `SoothGovernorVault.abi.json` - LP liquidity vault

## Key Functions for Frontend

### SoothMarketV3

**Read Functions:**

```typescript
// Market state
function b() external view returns (uint256);  // Liquidity parameter
function ammState() external view returns (State memory);  // { qYes, qNo }
function getPrice(uint8 outcome) external view returns (uint256);
function isLive() external view returns (bool);
function isSettled() external view returns (bool);

// Orderbook
function bestAsk() external view returns (uint256);  // Best ask order ID
function bestBid() external view returns (uint256);  // Best bid order ID
function orders(uint256 orderId) external view returns (OrderV3 memory);
function nextOrder(uint256 orderId) external view returns (uint256);

// Balances
function yesBalance(address user) external view returns (uint256);
function noBalance(address user) external view returns (uint256);
```

**Note:** Market functions are called BY TraderVault, not directly by users.

### SoothTraderVaultV3

**Read Functions:**

```typescript
function availableBalance(address user) external view returns (uint256);
function pendingBalance(address user) external view returns (uint256);
function totalBalance(address user) external view returns (uint256);
```

**Write Functions:**

```typescript
function deposit(uint256 amount) external;
function withdraw(uint256 amount) external;
function tradeAMM(address market, uint8 outcome, int256 deltaShares, int256 maxCost) external;
function placeOrder(address market, uint8 outcome, uint256 price, uint256 amount) external returns (uint256 orderId);
function cancelOrder(address market, uint256 orderId) external;
function claimUnlocked() external returns (uint256 amount);
```

## Usage Example

```typescript
import SoothMarketV3ABI from "./SoothMarketV3.abi.json";
import SoothTraderVaultV3ABI from "./SoothTraderVaultV3.abi.json";

// Read market data
const market = new ethers.Contract(marketAddress, SoothMarketV3ABI, provider);
const bParam = await market.b();
const ammState = await market.ammState();
const yesPrice = await market.getPrice(0);

// Trade via TraderVault
const vault = new ethers.Contract(vaultAddress, SoothTraderVaultV3ABI, signer);
await vault.tradeAMM(marketAddress, 0, ethers.parseEther("100"), maxCost);
```

## Troubleshooting

**Market showing $0 liquidity?**

- Check that `market.b()` returns a value > 0
- Check that `market.ammState()` returns `{ qYes, qNo }` with values > 0
- Verify market is initialized: `market.isLive()` should return `true`

**If market is not initialized:**
The deployed market needs to be initialized by calling `market.initialize(...)` as owner.
