# @sooth/sdk

Unified Sooth Protocol SDK for programmatic market access plus the `soothcli` interactive terminal.

## What is included

- Programmatic client: `SoothClient`
- Runtime registry client: `Registry` (defaults to `https://registry.sooth.market`)
- Trading modules: `Markets`, `Orderbook`, `Wallet`
- Core exports: ABIs, math, types, utils (`@sooth/sdk/core`)
- Unified CLI entry point: `soothcli`

This package is the merged successor of the previous split packages (`sdk-core`, interactive CLI, and SDK surface).

## Install

```bash
pnpm add @sooth/sdk
```

Or in this monorepo:

```bash
pnpm --filter @sooth/sdk build
```

## Quick start (TypeScript)

```ts
import { SoothClient } from '@sooth/sdk';

const client = await SoothClient.create('03d4f3f7', {
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
});

const marketAddresses = await client.markets.list();
console.log(marketAddresses);

if (marketAddresses.length > 0) {
  const info = await client.markets.getInfo(marketAddresses[0]);
  console.log(info);
}
```

## CLI

```bash
# list nodes from registry
soothcli --list

# connect by node id
soothcli 03d4f3f7

# custom rpc
soothcli 03d4f3f7 --rpc=https://your-rpc.example
```

## Public API surface

- `SoothClient`
- `Registry`
- `Markets`
- `Orderbook`
- `Wallet`
- Registry types: `SoothNode`, `SoothContracts`, `ChainMeta`, `NodesManifest`

Core subpath exports:

- `@sooth/sdk/core`
- `@sooth/sdk/core/abis`
- `@sooth/sdk/core/math`
- `@sooth/sdk/core/contracts`
- `@sooth/sdk/core/types`
- `@sooth/sdk/core/utils`
- `@sooth/sdk/core/errors`

## Development scripts

```bash
pnpm --filter @sooth/sdk build
pnpm --filter @sooth/sdk dev
pnpm --filter @sooth/sdk interactive
pnpm --filter @sooth/sdk interactive -- 03d4f3f7
```

## Hardening notes

- `soothcli --list` is intentionally lightweight and does not load the full interactive runtime.
- The wrapper prints a clear error when runtime dependencies are missing.
- CLI accepts only 8-character node IDs. Aliases and `--chain=` are rejected by design.

## Troubleshooting

- `Missing runtime dependency 'viem'`
  - Run `pnpm install` at repo root (or install deps in your environment), then retry.
- `Failed to fetch node list`
  - Check network access to `registry.sooth.market`.
  - Override registry URL with `SOOTH_REGISTRY_URL`.
