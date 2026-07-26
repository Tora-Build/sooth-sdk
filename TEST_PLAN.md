# sooth Test Plan

**Task: Heavy-test the merged `sooth` package, fix all bugs, re-test until clean.**

Working directory: `/Users/danieltang/GitHub/sooth-alpha/packages/sdk`

## Context

Three packages were merged into one `sooth`:

- `packages/sdk/src/core/` — ABIs, math, config, contracts, errors, utils, **actions** (shared write logic)
- `packages/sdk/src/cli/` — Interactive REPL, 40+ commands, actors, scenarios
- `packages/sdk/src/` — SoothClient, Markets, Orderbook, Wallet, Registry

CLI files (`src/cli/**`) are excluded from tsc — they run via `bun` only. The compiled public API is `src/*.ts` + `src/core/**/*.ts`.

**Current nodes** (2026-04-12):

- `a03aa4f4` — Base Sepolia (chain 84532)
- `2ffda94f` — HyperEVM Testnet (chain 998)
- `7a5dd1ad` — MegaETH Testnet (chain 6343)

## Tests to Run

Run ALL of these sequentially. For each test, if it fails, read the relevant source, fix the bug, then re-run that test before continuing. Use 30s timeout for RPC calls.

### 1. TypeScript Build

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && rm -rf dist && npx tsc 2>&1
```

Must produce zero errors.

### 2. Runtime Imports

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && bun -e "
import { SoothClient, Registry, Markets, Orderbook, Wallet } from './dist/index.js';
console.log('Main:', typeof SoothClient, typeof Registry, typeof Markets, typeof Orderbook, typeof Wallet);
import * as core from './dist/core/index.js';
console.log('Core count:', Object.keys(core).length, 'WAD:', typeof core.WAD, 'ABIS:', typeof core.ABIS);
"
```

### 3. soothcli --list

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && bun run bin/soothcli.js -- --list
```

Expect 3 nodes.

### 4. soothcli connect all 3 nodes

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && bun run bin/soothcli.js -- a03aa4f4
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && bun run bin/soothcli.js -- 2ffda94f
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && bun run bin/soothcli.js -- 7a5dd1ad
```

Each should show contracts + market count.

### 5. soothcli error cases

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && bun run bin/soothcli.js -- deadbeef 2>&1
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && bun run bin/soothcli.js 2>&1
```

First: "Unknown node ID". Second: usage message.

### 6. REPL — Base Sepolia full sweep

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'rpc\nactors\nmarkets\nsetmarket 0\nmarketstatus\nbalance\nallowance\npositions\npnl\nstate\nbook 500 5\ninvariants\nsnapshot\nscenarios\nsetmarket latest\ntrialstatus\nactor bob\nactor\nactor alice\n' | bun run src/cli/interactive.ts -- a03aa4f4 2>&1
```

Every command should produce output without errors (red text starting with "Error:").

### 7. REPL — HyperEVM Testnet

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'rpc\nmarkets\nsetmarket 0\nmarketstatus\npositions\nstate\nbook 500 5\n' | bun run src/cli/interactive.ts -- 2ffda94f 2>&1
```

### 8. REPL — MegaETH Testnet

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'rpc\nmarkets\nsetmarket 0\nmarketstatus\nstate\nbook 500 5\n' | bun run src/cli/interactive.ts -- 7a5dd1ad 2>&1
```

### 9. History command (uses eth_getLogs — chain-specific chunk sizes)

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'setmarket 0\nhistory 1 3\n' | bun run src/cli/interactive.ts -- a03aa4f4 2>&1
```

If it fails with "eth_getLogs is limited" error, fix `CHAIN_SCAN_CHUNKS` in `src/cli/commands/soothbook.ts`.

### 10. Monorepo install

```
cd /Users/danieltang/GitHub/sooth-alpha && pnpm install 2>&1
```

### 11. Geek page — Playwright E2E (58 commands)

```
cd /Users/danieltang/GitHub/sooth-alpha/apps/demo && pnpm dev &
E2E_BASE_URL=http://localhost:5173 npx playwright test e2e/specs/geek-commands.spec.ts --project=onchain-specs
```

Expect 58/58 passed. Covers every dispatcher case in `apps/demo/src/lib/sdk/index.ts` — writes, reads, CLI-only stubs, unknown commands. See `docs/specs/GEEK_CLI_ALIGNMENT.md`.

## Key Files for Bug Fixes

| File                            | What                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| `src/cli/cli-utils.ts`          | CLI formatting — imports from `../core/index.js`                     |
| `src/cli/config.ts`             | Chain config, ABIs, WAD/MAX_UINT256 re-exported from `../core/types` |
| `src/cli/commands/soothbook.ts` | `CHAIN_SCAN_CHUNKS` for per-chain eth_getLogs limits                 |
| `src/cli/interactive.ts`        | REPL entry — imports from `./cli-utils` not `./utils`                |
| `src/core/index.ts`             | Barrel export for all core modules (incl. `actions/`)                |
| `src/core/actions/`             | Shared write actions — canonical for both CLI and Geek               |
| `tsconfig.json`                 | Excludes `src/cli/**` from tsc                                       |
| `package.json`                  | v12.1.0, subpath exports `./core/*`                                  |

### 13. RPC resolution + header

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'rpc\nrpc set https://example.com/bad\nrpc\nrpc reset\nrpc\n' | bun run src/cli/interactive.ts -- a03aa4f4 2>&1
```

Verify:

- Header shows `SOOTH SDK v12.1.0`, node ID `a03aa4f4`, chain `Base Sepolia`, core version, and **public** RPC (`https://sepolia.base.org`) — no Alchemy/QuickNode URLs.
- `rpc` prints chain, RPC URL, and block number.
- `rpc set` changes the URL (next `rpc` shows the new one).
- `rpc reset` reverts to registry default.

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'rpc\n' | bun run src/cli/interactive.ts -- a03aa4f4 --rpc=https://custom.rpc.example 2>&1 | head -8
```

Verify: Header RPC line shows `https://custom.rpc.example` (flag overrides registry default).

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'help\n' | bun run src/cli/interactive.ts -- a03aa4f4 2>&1 | grep -A2 'rpc'
```

Verify: Help lists `rpc`, `rpc set <url>`, `rpc reset`.

## Rules

- Fix bugs in-place, re-test the failing command, then continue
- Skip tests that timeout after 30s due to slow RPC — note as "SKIP: RPC timeout"
- At the end, print a summary: PASS/FAIL/SKIP for each test, bugs found and fixed
