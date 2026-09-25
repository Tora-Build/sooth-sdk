---
name: cli-migration
description: >-
  Migrate the soothcli (src/cli) when sooth-core ships a new contract version. Use this skill whenever the user mentions migrating the CLI, updating soothcli for new contracts, "the CLI broke after the deploy", upgrading to v0.X.Y, ABI mismatches in the CLI, "Function X not found on ABI", `parseAbi` errors, or running test sweeps across multiple chains. Complements the contract-migration skill — that one handles addresses/ABIs/adjudicators across the whole monorepo; this one is the focused playbook for the CLI specifically: stale parseAbi lists, renamed contracts in the deployment map, function arity changes, dispatch typos, per-chain RPC config, and multi-chain CLI verification.
---

When in doubt and the user mentions both contracts and CLI, run contract-migration first (addresses, ABIs propagated across packages), then this skill to make the CLI actually work end-to-end.

# Sooth CLI Migration

Migrate `src/cli/` (soothcli REPL) when sooth-core ships a new contract version. Pairs with `contract-migration` — that one handles registry addresses and ABI files; this one handles the CLI's behavior on top of them.

## Documentation cross-link

For any cross-repo migration, the long-form historical narrative (commit anchors, postmortem, decision rationale) lives in **sooth-alpha at `docs/migration/<version>/`**. This SDK repo doesn't duplicate it; instead, treat that directory as authoritative for "what actually happened" and search past entries for the same kinds of breakage. From the SDK working tree:

```bash
# Read the most recent postmortem for context before starting:
gh api 'repos/Tora-Build/sooth-alpha/contents/docs/migration' --jq '.[].name' | sort | tail -3
gh api 'repos/Tora-Build/sooth-alpha/contents/docs/migration/v0.X.Y/postmortem.md' --jq '.content' | base64 -d
```

The CLI-side commit you produce in this skill is one row of the cross-repo "Pre/post-migration" commit anchor table in that handoff. After tagging `v0.X.Y` here, paste the new SHA into the sooth-alpha handoff's post-migration row.

## When to use

- New sooth-core version deployed and CLI commands now error
- User shares an integration guide that mentions function signature changes
- `Function "X" not found on ABI` errors at runtime
- `RPC error (returned address)` masking real reverts
- Cross-chain CLI sweep needed to verify parity (Base / HyperEVM / MegaETH)
- Adding a new chain — need to figure out per-chain `getLogs` chunk caps
- `soothbookCommands.X is not a function` dispatch crashes

## Why CLI migrations are surprisingly tricky

The soothcli is **two stacks of ABIs deep**:

1. `src/core/abis/*.ts` — full JSON-derived ABIs, exported via `ABIS.SoothBook` etc.
2. `src/cli/commands/*.ts` — local `parseAbi([...])` lists with only the functions that file uses

Layer 1 gets regenerated automatically when contracts change. **Layer 2 is hand-written and goes stale silently** — `parseAbi` doesn't warn you when the deployed contract's ABI has more functions than your list. You only find out when a user runs the command and viem says `Function "finalize" not found on ABI`.

Plus there's a **deployment-map layer** (`ctx.deployment.contracts.X`) where contract names sometimes get renamed across versions (`MockUSDC` → `BaseToken`) — and again, no compile-time check.

The skill below works through this systematically.

## Workflow

Work through these phases in order. Don't skip — a missed grep takes minutes; a missed bug surfaces during user testing and burns a 30-minute round trip.

### Phase 1 — Pin the supported version

In `src/cli/config.ts`, update:

```ts
export const SUPPORTED_CORE_VERSION = '0.X.Y'; // the new version
```

`interactive.ts` checks this at startup and refuses to launch on mismatched nodes. Without it, users hit the layer-2 ABI errors instead of a clean rejection.

If migrating to a non-existent version constant, add it (see `references/version-filter.md`).

### Phase 2 — Audit local parseAbi lists

Every `parseAbi([...])` list under `src/cli/commands/` is a hand-written subset and a likely source of `Function "X" not found on ABI` errors.

```bash
grep -rn "parseAbi(\[" src/cli/
```

For each list found, **read the corresponding full ABI** (e.g. `src/core/abis/TruthMarket.ts`) and confirm every entry in the local list still exists with the same signature. Pay special attention to:

- **Arity changes**: a function that took 2 args now takes 0 (or vice versa). Example: v0.1.x `settle(outcome, tStar)` → v0.2.0 `settle()` (because `resolve(outcome, tStar)` now takes the args).
- **Renames**: `isMarketSettled` (v0.1.x, on Collateralizer) → `isSettled` (v0.2.0, on TruthMarket). The function moved contract AND renamed.
- **New mandatory functions**: e.g. `attest()` was added to TruthMarket in v0.2.0. If a CLI command needs to call it, the parseAbi list must include it.

Add missing functions; fix renamed ones at call sites; flag arity changes for the user since those need design decisions.

#### Versioned event-alias cleanup (anti-pattern)

When migrating event ABIs, look for **legacy `*V2` aliases** that were added during a prior migration as a transitional shim. Pattern: a previous migration kept both `event OrderPlaced(...)` (old shape, no orderId) and `event OrderPlacedV2(...)` (new shape, with orderId) so the CLI activity scanner could read history from both eras. Once the deployed contracts are uniformly on the new shape, the `*V2` aliases are dead code that bloats `Promise.all` getLogs calls and must go.

```bash
# v0.2.1 example — caught these stale aliases:
grep -nE 'OrderPlacedV2|OrderFilledV2|OrderCancelledV2' src/cli/commands/soothbook.ts
```

Remove the aliases, collapse the duplicated `getLogs` calls in `fetchUserHistoryFeed` (one per event instead of two), and verify the CLI still reads history from the canonical event names. v0.2.1 saw a ~80-line reduction from this single cleanup.

### Phase 3 — Audit deployment-map references

Contract names in `ctx.deployment.contracts.*` can drift from registry/nodes.json. Grep:

```bash
grep -rn "deployment.contracts\." src/cli/
```

Cross-reference each name against the `Deployment` interface in `src/cli/config.ts` (and the registry shape in `data/nodes.snapshot.json`, or sooth-alpha's `packages/registry/src/types.ts` for the live source of truth). Common drifts:

- `MockUSDC` → `BaseToken` (the testnet collateral was renamed)
- `Collateralizer` → `OrderEngine` (replaced)
- New contracts that didn't exist before (e.g., `AdjudicatorRegistry`)

Same pattern applies to `ABIS.X` keys — the ABI export name often matches the contract name.

### Phase 4 — Audit dispatch (interactive.ts)

`src/cli/interactive.ts` is one giant `switch (cmd)` block that dispatches to `marketCommands.foo`, `soothbookCommands.foo`, `walletCommands.foo`. When a function is removed from a command module, the dispatch case still references it — silent crash at runtime.

```bash
grep -nE "soothbookCommands\.\w+|marketCommands\.\w+|walletCommands\.\w+" src/cli/interactive.ts
```

For each reference, confirm the function still exists in the corresponding module's exports map (the `commands` object at the bottom of the file). Examples seen historically:

- `soothbookCommands.createmarket` — never existed; `sbcreate` dispatch was wishful thinking
- `walletCommands.faucet` — renamed to `mint`

Either remove the case, point it at the renamed function, or surface a clean "not supported in this version" message (preferred for commands users might still try).

### Phase 5 — Add registration/state guards on SoothBook reads

This is the most subtle category. SoothBook is the **orderbook** layer; AMM-only graduated markets are NOT registered in SoothBook. When the CLI tries to read SoothBook state for them, viem's `readContract` returns `0x` (no data), and the SDK's `readContractWithRpcFallback` cycles through fallback RPCs (all return `0x`), then throws — the `decodeError` helper sees a hex string of length 42 in the error message and helpfully decodes it as `RPC error (returned address): 0x...`. Misleading garbage.

Every SoothBook read command (`state`, `book`, `positions` against soothbook, `invariants`) needs a pre-flight registration check. Pattern:

```ts
const marketInfo = await readContractWithRpcFallback<readonly [...]>(
  ctx.config.chain, ctx.config.rpc,
  { address: soothBook, abi: ABIS.SoothBook, functionName: 'markets', args: [marketKey] }
).catch((err) => {
  const msg = (err as Error).message.toLowerCase();
  if (msg.includes('no data') || msg.includes('returned address')) return null;
  throw err;
});

if (!marketInfo || marketInfo[0] === '0x0000000000000000000000000000000000000000') {
  return { success: false, message: 'Market not registered in SoothBook (orderbook). This is an AMM-only market — try: marketstatus' };
}
```

Both branches of the guard matter — the `null` branch catches the `readContractWithRpcFallback` throw, and the zero-collateral branch catches the case where the call succeeds but returns empty mapping data.

For `invariants`, short-circuit `runAllInvariants` before any check runs — otherwise each check fails independently with the same noise.

### Phase 6 — Per-chain config (new chains)

If the user added a new chain, two configs in `src/cli/commands/soothbook.ts` need updating:

```ts
const CHAIN_SCAN_CHUNKS: Record<number, bigint> = { ... };  // getLogs cap
const CHAIN_START_BLOCKS: Record<number, bigint> = { ... };  // when sooth-core was deployed
```

For `CHAIN_SCAN_CHUNKS`, use slightly less than the RPC's documented max (e.g. 9_000n for a 10k-cap RPC — leaves headroom). The error you're avoiding is `-32600 ... up to a 10000 block range`. Empirical caps:

| Chain                  | RPC cap | Safe chunk             |
| ---------------------- | ------- | ---------------------- |
| HyperEVM Testnet (998) | 10,000  | 9,000n                 |
| MegaETH Testnet (6343) | 10,000  | 9,000n                 |
| Monad Testnet (10143)  | 1,000   | 900n                   |
| Lens (37111)           | unknown | 10,000n (conservative) |

For `CHAIN_START_BLOCKS`, ask the user (or check this repo's `data/nodes.snapshot.json`, or sooth-alpha's `packages/registry/nodes.json`, for the deployment block of the LaunchpadEngine).

### Phase 6.5 — Pre-deploy snapshot verification (`--offline-registry`)

Before sooth-alpha redeploys its `registry-api` worker, the live `registry.sooth.market/v1/manifest` still serves the OLD payload. To verify the CLI's embedded snapshot for the new version without depending on the live registry, ship and use a `--offline-registry` flag that bypasses the HTTP fetch and forces fallback to `data/nodes.snapshot.json`:

```bash
bun src/cli/interactive.ts --list --offline-registry
# Should show only the new version's nodes with ✓ Compat — proves the snapshot prune happened correctly without the live registry's interference.
```

This pattern was added during v0.2.1 (`--offline-registry` lands in `src/cli/interactive.ts` next to the `--list` flag). Re-use it on every migration. The flag has no production cost — it's a dev-loop convenience that flips one boolean in `loadManifest({ offline })`.

### Phase 7 — Multi-chain test sweep

This is the verification step. The point is to catch bugs that only appear under specific chain conditions (RPC quirks, missing markets, nonce contention).

Spawn one terminal per node you support (use the `orca-cli` skill, or plain terminals), taking node IDs from `data/nodes.snapshot.json`. Example layout:

```
%0 = MegaETH Testnet     soothcli 3b02bcfd --realtime
%1 = Ethereum Sepolia    soothcli 0d896a4f
%2 = Robinhood Testnet   soothcli 08c5ea8a
[%3 = MegaETH Testnet    soothcli 3b02bcfd    (standard mode, optional)]
```

If you spawn both `%0` and `%3`, they share alice's wallet — write commands will hit "nonce too low" on the second pane because both panes' nonce trackers are out of sync. Either:

- Run write-state commands sequentially with delays, or
- Exit one of the two ME panes before any write tests

Then sweep the commands. The full set is in `references/test-sweep.md`. Order matters:

1. **Read commands first** (no chain mutations) — `rpc`, `markets`, `marketstatus`, `state`, `book`, `positions`, `history`, `invariants`, `pnl`, `trialstatus`, `balance`, `allowance`, `checksum`, `scenarios`
2. **Wallet ops** — `mint <amt>`, `approve <contract>`, `allowance`
3. **Write-state ops** — `mintset`, `mergeset`, `transferlp`, `settle`, `finalize`, `redeem`, `redeemamm`, `redeemlp`, `sbresolve`, `sbredeem`, `buyyes`, `buyno`, `cancelorder`, `sbcreate`
4. **Misc** — `record start/stop`, `playback`, `rpc set/reset`, `help`, `clear`

For each command, classify the result into one of three buckets:

- **✅ Pass** — succeeded OR returned a sensible domain error ("Market is not settled yet", "Market not registered in SoothBook")
- **❌ Fail** — viem ABI errors, undefined dispatch crashes, "RPC error (returned address)", `parameters.abi.length` errors. These are CLI bugs, not chain state.
- **⚠️ Environmental** — nonce too low, transient RPC 503, timeout. Not a code bug — note and move on.

Report results as a chain × command matrix. Commands that fail on every chain are CLI bugs (fix). Commands that fail on one chain only are usually chain-specific config issues (Phase 6).

### Phase 8 — Fix what failed

Each bug class has a typical fix shape:

| Symptom                                                             | Likely cause                      | Fix                                               |
| ------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------- |
| `Function "X" not found on ABI`                                     | Stale parseAbi                    | Add `function X(...)` to the local list (Phase 2) |
| `ABI encoding params/values length mismatch`                        | Function arity changed            | Update call site to match new contract signature  |
| `Cannot read property 'abi' of undefined` / `parameters.abi.length` | Renamed contract or ABI key       | Update name (Phase 3)                             |
| `RPC error (returned address): 0xA42C42eC...`                       | SoothBook read on AMM-only market | Add registration guard (Phase 5)                  |
| `soothbookCommands.X is not a function`                             | Dispatch typo                     | Update or remove case in interactive.ts (Phase 4) |
| `up to a 10000 block range`                                         | New chain missing chunk config    | Add to `CHAIN_SCAN_CHUNKS` (Phase 6)              |

### Phase 9 — Re-verify and report

After fixes:

1. Restart all panes (the bun-run CLI reads source on launch)
2. Re-run only the commands that previously failed (don't re-do passing ones)
3. Report the before/after table to the user

If any fix changed CLI semantics (e.g., `settle <outcome>` now calls `resolve` instead of `settle`), call it out explicitly — scenario YAMLs may rely on the old behavior.

## Anti-patterns

These are mistakes I (or others) have made on past CLI migrations. Avoid them.

- **Trusting "the chain's broken"** — when the same command fails on every chain, it's a CLI bug. RPC issues are usually one-chain-only.
- **Calling `state` to test SoothBook reads** on AMM-only markets, then concluding "all chains failed". Pick test markets that are actually registered in SoothBook (or use `marketstatus`, which works on AMM-only).
- **Restarting CLIs by sending `Ctrl-C` to the REPL pane** — Ctrl-C is consumed by the readline loop. Use `exit` (which the REPL accepts) then re-launch.
- **Running write-state tests in parallel across both ME-rt and ME-std panes** — they share alice's account and you'll hit nonce contention. Sequence them or kill one.
- **Skipping the version filter** — without it, every CLI migration becomes a guessing game when a user reports an error. The version filter turns "WTF is this error" into "you're on the wrong CLI version, run --list".

## Files this skill touches

| File                               | Purpose                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `src/cli/config.ts`                | `SUPPORTED_CORE_VERSION` constant                                            |
| `src/cli/interactive.ts`           | Version gate, dispatch cases, help text                                      |
| `src/cli/commands/market.ts`       | TruthMarketAbi/OrderEngineAbi parseAbi lists, market lifecycle commands      |
| `src/cli/commands/wallet.ts`       | OrderEngineAbi parseAbi list, balance/mint/approve                           |
| `src/cli/commands/soothbook.ts`    | SoothBook reads + registration guards, CHAIN_SCAN_CHUNKS, CHAIN_START_BLOCKS |
| `src/cli/assertions/invariants.ts` | Invariant checks + AMM-only short-circuit                                    |

## Pointers

- `references/test-sweep.md` — Full ordered command list for Phase 7, with expected output shape
- `references/version-filter.md` — How the version gate works end-to-end (config + interactive + --list compat column)
- `references/abi-drift-cheatsheet.md` — Catalog of historical ABI drifts (v0.1.x → v0.2.0) for pattern-matching new ones
- `.claude/rules/lessons.md` — Repo-wide lessons; CLI-relevant ones include trial period, fee split, infinite deadline handling
