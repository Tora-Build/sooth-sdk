# @sooth/sdk

Shared TypeScript package containing ABIs, types, and configuration for Sooth Protocol.

## Installation

From within the monorepo:

```bash
pnpm add @sooth/sdk --filter web
```

## Usage

### Import ABIs

```typescript
import { SOOTH_MARKET_ABI, SOOTH_TRADER_VAULT_ABI } from "@sooth/sdk/abis";
```

### Import Config

```typescript
import { deployments, markets } from "@sooth/sdk/config";

const traderVaultAddress = deployments.baseSepolia.traderVault;
```

### Import Types

```typescript
import type { MarketState, Order } from "@sooth/sdk";
```

## Package Structure

```
src/
  index.ts          # Main exports
  abis/
    index.ts        # ABI exports
    SoothMarket.json
    SoothTraderVault.json
    SoothGovernorVault.json
  config/
    index.ts        # Config exports
    deployments.ts  # Contract addresses by chain
    markets.ts      # Market metadata
  types/
    index.ts        # TypeScript types
```

## Development

```bash
# Type check
pnpm --filter sdk typecheck

# Build
pnpm --filter sdk build
```

## Adding New ABIs

1. After contract changes, copy ABI from `packages/contracts-evm/out/`:

```bash
cp ../contracts-evm/out/SoothMarket.sol/SoothMarket.json src/abis/
```

2. Export in `src/abis/index.ts`:

```typescript
export { default as SOOTH_MARKET_ABI } from "./SoothMarket.json";
```
