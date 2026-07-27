# `sooth` CLI — `soothcli`

Interactive REPL for testing, simulating, and operating Sooth Protocol markets on any deployed chain (Base Sepolia, MegaETH, HyperEVM, Monad, etc.).

The CLI loads the chain manifest from the registry (`registry.sooth.market`), connects to the configured RPC, signs with private keys from `.env`, and exposes commands for actor management, AMM trading, SoothBook orderbook trading, market lifecycle, scenarios, and invariants.

---

## Launch

Three equivalent ways to start the same REPL — all of them ultimately run `packages/sdk/src/cli/interactive.ts`:

```bash
# 1) Global bin (after `pnpm install` at the repo root)
soothcli <nodeId> [flags]

# 2) From the monorepo root
pnpm dev:cli <nodeId> [flags]

# 3) Long-form (filtered workspace script)
pnpm --filter sdk interactive <nodeId> [flags]
```

`<nodeId>` is the 8-character SHA-256 of `chainId:launchpadEngine` from the registry. The most common ones live in `STATUS.md` and the registry manifest. To discover what's available:

```bash
soothcli --list
```

The `--list` branch is handled by the `bin/soothcli.js` wrapper _before_ the REPL boots, so it's only available via `soothcli`. `pnpm dev:cli --list` will skip that branch and try to enter the REPL with `--list` as a node ID.

### Launch flags

| Flag                                  | Effect                                                                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--rpc=<url>`                         | Override the registry-default RPC for this session. Equivalent to running `rpc set <url>` at the prompt.                                                                                  |
| `--market=<addr\|key\|index\|latest>` | Pre-load a market on startup (skips manual `setmarket`).                                                                                                                                  |
| `--scenario=<name>`                   | Run a saved scenario then exit (CI / non-interactive). Process exits 0 on pass, 1 on fail.                                                                                                |
| `--realtime`                          | **MegaETH only.** Use `realtime_sendRawTransaction` instead of standard `eth_sendRawTransaction` + receipt polling. Single roundtrip — see [MegaETH realtime API](#megaeth-realtime-api). |

Examples:

```bash
# Base Sepolia, REPL with default RPC
soothcli a03aa4f4

# Same node, custom RPC override
soothcli a03aa4f4 --rpc=https://sepolia.base.org

# MegaETH testnet, realtime API enabled, pre-loaded market
soothcli <megaeth-node-id> --realtime --market=latest

# Run a saved scenario in CI
soothcli a03aa4f4 --scenario=full-lifecycle
```

---

## Environment

The CLI loads keys from `.env` at the repo root (or `packages/sdk/.env`). Recognized variables:

```bash
# Required: at least one signer
PRIVATE_KEY=0x...                     # default actor (alice)

# Optional: per-actor keys
PRIVATE_KEY_ALICE=0x...
PRIVATE_KEY_BOB=0x...
PRIVATE_KEY_CHARLIE=0x...
PRIVATE_KEY_DAVID=0x...
PRIVATE_KEY_ELLEN=0x...
PRIVATE_KEY_ADMIN=0x...

# Optional: registry override (defaults to https://registry.sooth.market)
SOOTH_REGISTRY_URL=https://registry.sooth.market
```

If `PRIVATE_KEY_<name>` is set, that name becomes a switchable actor at the REPL via `actor <name>`. The plain `PRIVATE_KEY` becomes `alice` by default.

---

## Command reference

Once at the prompt, type `help` to see the full command tree. The major groups:

| Group                    | Examples                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Actor mgmt**           | `actor alice`, `actors`                                                                                                        |
| **Wallet**               | `balance`, `mint 1000`, `approve all`, `allowance`, `snapshot`, `checksum`                                                     |
| **AMM market lifecycle** | `createmarket alien`, `graduate 8`, `marketstatus`, `settle yes`, `redeem`, `redeemlp max`, `pnl 50000`, `transferlp ellen 50` |
| **Trial status**         | `trialstatus`                                                                                                                  |
| **SoothBook trading**    | `buyyes 600 25`, `buyno 400 25`, `mintset 100`, `mergeset 100`, `cancelorder yes 600`, `sbredeem`                              |
| **SoothBook state**      | `state`, `book`, `positions`, `history`, `markets`, `setmarket latest`, `sbcreate <name>`                                      |
| **Scenarios**            | `scenario <name>`, `scenarios`, `record start`, `record stop <name>`, `playback <name>`                                        |
| **Invariants**           | `invariants`, `check`                                                                                                          |
| **Debug / RPC**          | `rpc`, `rpc set <url>`, `rpc reset`, `call <contract> <fn>`                                                                    |
| **Other**                | `help`, `clear`, `exit`                                                                                                        |

---

## MegaETH realtime API

MegaETH (chain IDs `4326` mainnet, `6343` carrot testnet) exposes a non-standard JSON-RPC method `realtime_sendRawTransaction` that returns the transaction receipt in a single roundtrip — no `sendRawTransaction` → `getTransactionReceipt` polling loop.

The CLI opts into this mode via the `--realtime` startup flag. Two important properties:

1. **Locked at launch.** There is currently no runtime command to toggle realtime on/off — you must restart the REPL with or without the flag. (If you need this, file an issue and we'll wire a `realtime on/off` slash command.)
2. **Same RPC URL.** Realtime is _not_ a different endpoint — both standard and realtime methods accept POSTs to the same MegaETH RPC URL. So `rpc set <url>` does not change the send mode; only `--realtime` does.

The flag is silently ignored on non-MegaETH chains.

```bash
# Standard mode (eth_sendRawTransaction + poll for receipt)
soothcli <megaeth-node-id>

# Realtime mode (realtime_sendRawTransaction — single roundtrip)
soothcli <megaeth-node-id> --realtime
```

Implementation: `packages/sdk/src/core/megaeth.ts` (helpers) and `packages/sdk/src/cli/actors.ts` (the `realtimeApi` flag on `ActorManager`).

---

## Architecture

```
packages/sdk/
├── bin/soothcli.js              # CLI entry point (#!/usr/bin/env bun)
│                                # — Handles `--list` then delegates
└── src/cli/
    ├── interactive.ts           # REPL loop, arg parsing, command dispatch
    ├── actors.ts                # ActorManager — multi-actor wallet wrapper
    ├── config.ts                # Registry fetch + chain config
    ├── scenarios.ts             # Scenario engine (record / replay)
    ├── invariants.ts            # Protocol invariant checks
    └── commands/
        ├── wallet.ts            # mint / approve / balance / snapshot
        ├── market.ts            # AMM lifecycle (create / graduate / settle / pnl)
        └── soothbook.ts         # SoothBook trading + state queries
```

The CLI is a thin shell over `sooth/core` and `viem`. Most commands are direct wrappers around SDK actions plus a pretty-printed result. To add a command: implement it in `commands/*.ts`, register the case in `interactive.ts`'s `handleCommand` switch, and add a row to `printHelp()`.

---

## Non-interactive mode

If stdin is not a TTY, the REPL reads piped commands and executes them sequentially:

```bash
echo -e "actor alice\nbalance\nmint 1000\nbalance\nexit" | soothcli a03aa4f4
```

This is also how `--scenario` runs: the named scenario is replayed and the process exits with 0 (pass) or 1 (fail) — suitable for CI.
