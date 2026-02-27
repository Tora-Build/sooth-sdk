# @sooth/sdk Test Plan

**Task: Heavy-test the merged `@sooth/sdk` package, fix all bugs, re-test until clean.**

Working directory: `/Users/danieltang/GitHub/sooth-alpha/packages/sdk`

## Context

Three packages were merged into one `@sooth/sdk`:
- `packages/sdk/src/core/` — ABIs, math, config, contracts, errors, utils (from `sdk-core`)
- `packages/sdk/src/cli/` — Interactive REPL, 40+ commands, actors, scenarios (from `contracts-testing`)
- `packages/sdk/src/` — SoothClient, Markets, Orderbook, Wallet, Registry (original `sdk`)

CLI files (`src/cli/**`) are excluded from tsc — they run via `bun` only. The compiled public API is `src/*.ts` + `src/core/**/*.ts`.

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
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && bun run bin/soothcli.js -- 03d4f3f7
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && bun run bin/soothcli.js -- c5059e71
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && bun run bin/soothcli.js -- a7f3b2e1
```
Each should show contracts + market count.

### 5. soothcli error cases
```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && bun run bin/soothcli.js -- deadbeef 2>&1
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && bun run bin/soothcli.js 2>&1
```
First: "Node not found". Second: usage message.

### 6. REPL — Base Sepolia full sweep
```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'rpc\nactors\nmarkets\nsetmarket 0\nmarketstatus\nbalance\nallowance\npositions\npnl\nstate\nbook 500 5\ninvariants\nsnapshot\nscenarios\nsetmarket latest\ntrialstatus\nactor bob\nactor\nactor alice\n' | bun run src/cli/interactive.ts -- --chain=baseSepolia 2>&1
```
Every command should produce output without errors (red text starting with "Error:").

### 7. REPL — Monad Testnet
```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'rpc\nmarkets\nsetmarket 0\nmarketstatus\npositions\nstate\nbook 500 5\n' | bun run src/cli/interactive.ts -- --chain=monadTestnet 2>&1
```

### 8. REPL — Lens Testnet
```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'rpc\nmarkets\nsetmarket latest\nmarketstatus\nstate\nbook 500 5\n' | bun run src/cli/interactive.ts -- --chain=lensTestnet 2>&1
```

### 9. History command (uses eth_getLogs — chain-specific chunk sizes)
```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'setmarket 0\nhistory 1 3\n' | bun run src/cli/interactive.ts -- --chain=baseSepolia 2>&1
```
If it fails with "eth_getLogs is limited" error, fix `CHAIN_SCAN_CHUNKS` in `src/cli/commands/soothbook.ts`.

### 10. contracts-testing redirect
```
cd /Users/danieltang/GitHub/sooth-alpha/packages/contracts-testing && printf 'rpc\n' | bun run interactive -- --chain=baseSepolia 2>&1
```

### 11. sdk-core backward compat
```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk-core && rm -rf dist && npx tsc 2>&1
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk-core && bun -e "import { WAD, ABIS, decodeError } from './dist/index.js'; console.log('OK:', typeof WAD, typeof ABIS, typeof decodeError);"
```

### 12. Monorepo install
```
cd /Users/danieltang/GitHub/sooth-alpha && bun install 2>&1
```

## Key Files for Bug Fixes

| File | What |
|------|------|
| `src/cli/cli-utils.ts` | CLI formatting — imports from `../core/index.js` |
| `src/cli/config.ts` | Chain config, ABIs, WAD/MAX_UINT256 re-exported from `../core/types` |
| `src/cli/commands/soothbook.ts` | `CHAIN_SCAN_CHUNKS` for per-chain eth_getLogs limits |
| `src/cli/interactive.ts` | REPL entry — imports from `./cli-utils` not `./utils` |
| `src/core/index.ts` | Barrel export for all core modules |
| `tsconfig.json` | Excludes `src/cli/**` from tsc |
| `package.json` | v12.1.0, subpath exports `./core/*` |

### 13. RPC resolution + header
```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'rpc\nrpc set https://example.com/bad\nrpc\nrpc reset\nrpc\n' | bun run src/cli/interactive.ts -- --chain=baseSepolia 2>&1
```
Verify:
- Header shows `SOOTH SDK v12.1.0`, node ID `03d4f3f7`, chain `Base Sepolia`, core version, and **public** RPC (`https://sepolia.base.org`) — no Alchemy/QuickNode URLs.
- `rpc` prints chain, RPC URL, and block number.
- `rpc set` changes the URL (next `rpc` shows the new one).
- `rpc reset` reverts to registry default.

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'rpc\n' | bun run src/cli/interactive.ts -- --rpc=https://custom.rpc.example --chain=baseSepolia 2>&1 | head -8
```
Verify: Header RPC line shows `https://custom.rpc.example` (flag overrides registry default).

```
cd /Users/danieltang/GitHub/sooth-alpha/packages/sdk && printf 'help\n' | bun run src/cli/interactive.ts -- --chain=baseSepolia 2>&1 | grep -A2 'rpc'
```
Verify: Help lists `rpc`, `rpc set <url>`, `rpc reset`.

## Rules
- Fix bugs in-place, re-test the failing command, then continue
- Skip tests that timeout after 30s due to slow RPC — note as "SKIP: RPC timeout"
- At the end, print a summary: PASS/FAIL/SKIP for each test, bugs found and fixed
