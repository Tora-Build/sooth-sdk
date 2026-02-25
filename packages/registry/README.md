# @sooth/registry

Single source of truth for Sooth Protocol node and chain configuration.

## Problem

Contract addresses, chain metadata, and RPC endpoints were duplicated across 6 files:
- Frontend `deployments.ts` + `chains.ts` + `wagmi.ts`
- SDK `deployments.ts`
- CLI `config.ts`
- Indexer `ponder.config.ts`

Adding a new chain meant editing all 6 files. This caused drift, stale entries, and bugs (e.g., explorer links always pointing to Base Sepolia regardless of chain).

## Design

### Core Concept: Sooth Node

A **Sooth Node** is the atomic unit of the protocol: `(chainId, contracts)`. It represents a complete deployment of all Sooth contracts on a single chain.

### `nodes.json` — The Single Source of Truth

```jsonc
{
  "version": "12.0.0",
  "nodes": [
    {
      "id": "base-sepolia-v12",
      "chainId": 84532,
      "contracts": {
        "launchpadEngine": "0x...",
        "soothBook": "0x...",
        "ammEngine": "0x...",
        "collateralizer": "0x...",
        "usdc": "0x...",
        "protocolConfig": "0x..."
      },
      "startBlock": 37890676,
      "deployedAt": "2026-02-20T00:02:00.000Z",
      "deployedBy": "0x..."
    }
  ],
  "chains": {
    "84532": {
      "name": "Base Sepolia",
      "nativeCurrency": { "name": "Ether", "symbol": "ETH", "decimals": 18 },
      "rpcUrls": ["https://sepolia.base.org"],
      "explorer": { "name": "Basescan", "url": "https://sepolia.basescan.org" },
      "testnet": true
    }
  }
}
```

Key decisions:
- **Nodes and chains are separate sections.** A chain can host multiple nodes (e.g., V12 + V13 during migration).
- **`startBlock` on the node.** All contracts deployed in same batch — indexer uses this for all contracts.
- **`rpcUrls` = public fallbacks only.** Private RPCs (QuickNode) are injected via env vars at consumer level.
- **No `markets` array.** Markets are auto-discovered via the indexer.
- **camelCase contract keys** matching existing frontend convention.

## Usage

### Basic lookups

```typescript
import {
  getAllNodes,
  getNodeByChainId,
  getNodeBySoothBook,
  getChain,
  getSupportedChainIds,
  getAddressUrl,
  getTxUrl,
} from '@sooth/registry';

// Get all deployed nodes
const nodes = getAllNodes();

// Look up by chain
const baseNode = getNodeByChainId(84532);
console.log(baseNode?.contracts.soothBook);

// Look up by contract address
const node = getNodeBySoothBook('0x0eb179c7...');
console.log(node?.chainId); // 84532

// Chain metadata
const chain = getChain(84532);
console.log(chain?.explorer.url); // https://sepolia.basescan.org

// Explorer URLs (chain-aware — fixes the multi-chain explorer bug)
const url = getAddressUrl(10143, '0x6fd8...');
// → https://testnet.monadvision.com/address/0x6fd8...
```

### Viem chain integration

```typescript
import { toViemChain, getAllViemChains } from '@sooth/registry/viem';

// Single chain with RPC override
const chain = toViemChain(84532, ['https://my-private-rpc.com']);

// All chains
const chains = getAllViemChains({
  84532: ['https://my-base-rpc.com'],
  10143: ['https://my-monad-rpc.com'],
});
```

### Raw JSON import

```typescript
import manifest from '@sooth/registry/nodes.json';
// Direct access to the manifest for custom processing
```

### Types only

```typescript
import type { SoothNode, SoothContracts, ChainMeta } from '@sooth/registry/types';
```

## Subpath Exports

| Import path | Contents |
|---|---|
| `@sooth/registry` | All helpers + type re-exports |
| `@sooth/registry/types` | Type definitions only |
| `@sooth/registry/viem` | `toViemChain()`, `getAllViemChains()` (requires viem as peer dep) |
| `@sooth/registry/nodes.json` | Raw JSON manifest |

## API Reference

### Node lookups

| Function | Returns | Description |
|---|---|---|
| `getAllNodes()` | `SoothNode[]` | All registered nodes |
| `getNodeByChainId(chainId)` | `SoothNode \| undefined` | First node on a chain |
| `getNodesByChainId(chainId)` | `SoothNode[]` | All nodes on a chain |
| `getNodeById(id)` | `SoothNode \| undefined` | By human-readable ID |
| `getNodeByLaunchpad(address)` | `SoothNode \| undefined` | By launchpadEngine address |
| `getNodeBySoothBook(address)` | `SoothNode \| undefined` | By soothBook address |

### Chain lookups

| Function | Returns | Description |
|---|---|---|
| `getChain(chainId)` | `ChainMeta \| undefined` | Chain metadata |
| `getSupportedChainIds()` | `number[]` | All chain IDs with nodes |
| `getSupportedChains()` | `(ChainMeta & { chainId })[]` | All chains with metadata |

### Explorer helpers

| Function | Returns | Description |
|---|---|---|
| `getAddressUrl(chainId, address)` | `string` | Block explorer address link |
| `getTxUrl(chainId, txHash)` | `string` | Block explorer tx link |

### Viem helpers (`@sooth/registry/viem`)

| Function | Returns | Description |
|---|---|---|
| `toViemChain(chainId, rpcOverride?)` | `Chain` | Viem Chain object |
| `getAllViemChains(rpcOverrides?)` | `Chain[]` | All chains as viem objects |

## Consumer Migration

Each consumer has a thin adapter that re-exports from `@sooth/registry` using the existing call signatures. No import sites needed to change.

| Consumer | Adapter file | What changed |
|---|---|---|
| Frontend | `apps/market/src/config/deployments.ts` | `INSTANCES` + helpers now read from registry |
| Frontend | `apps/market/src/config/chains.ts` | Chain list + explorer helpers from registry |
| Frontend | `apps/market/src/lib/wagmi.ts` | `toViemChain()` replaces inline `defineChain()` |
| SDK | `packages/sdk-core/src/config/deployments.ts` | `DEPLOYMENTS` record replaced; stale monadMainnet removed |
| CLI | `packages/contracts-testing/script/interactive/config.ts` | `monadTestnet` chain def from registry |
| Indexer | `packages/indexer/ponder.config.ts` | Chains + contract addresses built from `nodes.json` |

## Adding a New Chain

1. Add the chain entry to `nodes.json` under `chains`
2. Add the node entry to `nodes.json` under `nodes`
3. Run `pnpm -r build` — all consumers pick up the new chain automatically
4. Add chain-specific overrides where needed (private RPCs, polling intervals)

## Adding a New Deployment (Same Chain)

1. Add a new node entry to `nodes.json` with a unique `id`
2. Consumers using `getNodeByChainId()` get the first node; use `getNodesByChainId()` for all
