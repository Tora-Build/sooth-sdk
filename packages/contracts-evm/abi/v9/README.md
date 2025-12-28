# V9 Contract ABIs

Pre-compiled ABIs for frontend integration.

## Core Contracts

| Contract | Description |
|----------|-------------|
| `TickBookPoolManager.json` | Singleton order book manager (V9 - replaces TickBook) |
| `TickBookVault.json` | USDC custody and internal balance tracking |
| `TruthMarket.json` | Market lifecycle and settlement source of truth |
| `LaunchpadEngine.json` | Market creation and bonding curve graduation |
| `Collateralizer.json` | Token split/merge/redeem operations |

## Hooks & Extensions

| Contract | Description |
|----------|-------------|
| `DynamicFeeHook.json` | Volume/volatility-based dynamic fees |
| `ITickBookHooks.json` | Hook interface for custom logic |

## Key Changes from V8

1. **TickBook -> TickBookPoolManager**: Singleton architecture replaces per-market contracts
2. **Flash Accounting**: EIP-1153 transient storage for batch operations
3. **Hooks System**: Extensible before/after callbacks
4. **Permissionless Claims**: `claimFillsFor()` and `batchClaimFills()` for keepers

## Usage

```typescript
import TickBookPoolManager from '@sooth/contracts/abi/v9/TickBookPoolManager.json';

const poolManager = new ethers.Contract(
  POOL_MANAGER_ADDRESS,
  TickBookPoolManager.abi,
  signer
);

// Register market (LaunchpadEngine compatibility)
await poolManager.registerMarket(marketAddr, yesToken, noToken, initialProb);

// Place range order
await poolManager.placeRangeOrder(marketKey, outcome, tickLower, tickUpper, shares);

// Execute market order
await poolManager.executeMarketOrder(marketKey, outcome, shares, maxCost);

// Permissionless claim (keepers can trigger for any order)
await poolManager.claimFillsFor(marketKey, orderId);
```

## Regenerating ABIs

```bash
forge build
cp out/TickBookPoolManager.sol/TickBookPoolManager.json abi/v9/
# ... copy other contracts
```
