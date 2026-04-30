# Test Sweep — Soothcli Multi-Chain Verification

The full ordered command list for Phase 7 of the migration playbook. Send these to each chain's pane sequentially.

## Setup before sweep

For each pane, set a **graduated** market (not pre-graduation, not SoothBook-registered) — this is the realistic state most users will be in:

```
setmarket <graduated-market-address>
```

Find graduated markets via `markets` command — look for `stage: graduated`.

## Group 1 — Read commands (no chain mutations)

Safe to send all at once. Expected: clean output or sensible error.

| Command | Expected (post-fix) | Notes |
|---|---|---|
| `rpc` | Chain name + block number | Fast |
| `markets` | List of markets | Slow on chains with many markets |
| `marketstatus` | TruthMarket + OrderEngine + AMM data | The most useful command on AMM-only markets |
| `state` | "Market not registered in SoothBook" (AMM-only) OR full state (SoothBook market) | Needs registration guard |
| `book` | Same as state | Same guard |
| `positions` | Multi-actor table with USDC/YES/NO balances | Hits OrderEngine.getBalances + BaseToken.balanceOf |
| `history` | "No order history" or paged orderbook events | getLogs — slow, needs chunk config per chain |
| `invariants` | 4 SKIP on AMM-only, 4 PASS on SoothBook market | Needs short-circuit |
| `pnl` | P&L summary | Reads LP value |
| `trialstatus` | Trial period state | |
| `balance` | Wallet USDC for current actor | |
| `allowance` | Approval status | |
| `checksum` | "No snapshot stored" or zero-sum verify | |
| `scenarios` | List of available scenarios | |

## Group 2 — Wallet ops (chain-mutating but cheap)

| Command | Expected | Notes |
|---|---|---|
| `mint <amt>` | "✓ Minted N USDC" | MockUSDC has public mint on testnet |
| `approve <contract>` | "✓ Approved <contract> for unlimited USDC" | Args: `launchpad`, `soothbook`, or `all` |
| `actor <name>` | "Switched to bob" | Test with `actor bob`, then `actor alice` to restore |

**Critical**: arg order is `approve <contract> [amount]`, NOT `approve <amount> <contract>`. Tests like `approve 100 launchpad` will fail with "Number `launchpad` is not a valid decimal".

## Group 3 — Market lifecycle ops (write-state, may need adjudicator role)

These often revert with auth checks — that's fine, the test is whether the call gets that far without ABI errors.

| Command | Expected (post-fix) | Notes |
|---|---|---|
| `mintset <amt>` | "✓ Minted N complete sets" | Hits SoothBook.mint — works on most chains, may revert on ME with sel 0xfb8f41b2 if market not registered there |
| `mergeset <amt>` | "✓ Merged N sets" | Hits SoothBook.merge — same caveat |
| `transferlp <actor> <amt>` | "✓ Transferred N LP" | LP token transfer, must be pre-settlement |
| `settle <outcome>` | Calls `resolve(outcome, tStar)`; reverts on auth (alice ≠ adjudicator) | Was `settle(outcome, 0n)` — broke with v0.2.0 |
| `finalize` | Calls `finalize()`; reverts on state | parseAbi list must include `finalize` |
| `redeem` | "Market is not settled yet" | Must read `TruthMarket.isSettled`, not removed `OrderEngine.isMarketSettled` |
| `redeemamm` | "Market is not settled yet" | Clean error |
| `redeemlp <amt>` | Reverts (pre-settlement) | Expected |
| `sbresolve <outcome>` | Tx succeeds (owner-callable) | |
| `sbredeem` | Reverts (no winning tokens) | Expected |
| `dismiss` | "Market cannot be dismissed" (graduated market) | Domain error |
| `claimrefund` | Reverts (no dismissal) | Expected |

## Group 4 — Orderbook (write-state, expected reverts on AMM-only)

These will all revert because the test market is AMM-only (not SoothBook-registered). The test is whether the revert is a clean contract revert (✅ Pass) or a CLI crash (❌ Fail).

| Command | Expected | Notes |
|---|---|---|
| `buyyes <tick> <amt>` | Revert sel 0xb521771a | Unknown selector → expected |
| `buyno <tick> <amt>` | Same | Same |
| `cancelorder <side> <tick>` | Revert sel 0x1d4ecc5b | Unknown selector → expected (no order to cancel) |
| `sbcreate <name>` | "sbcreate is not supported in v0.2.0" | Removed feature, clean message |

## Group 5 — Misc

| Command | Expected | Notes |
|---|---|---|
| `record start` | "Recording started", prompt becomes `alice [REC]>` | |
| `record stop <name>` | "Saved scenario" | Saves YAML |
| `playback <name>` | Replays recorded steps | |
| `rpc set <url>` | "RPC updated" | |
| `rpc reset` | "RPC reset to registry default" | |
| `help` / `?` | Full help dump | Both work, `?` is alias |
| `clear` | Wipes scrollback | |

## Group 6 — Untested (creates new on-chain markets)

Skip unless explicitly asked — these mutate chain state significantly:

- `createmarket <template>` — creates a new prediction market
- `graduate [steps]` — graduates a market via repeated trades
- `simulate [orders] [avg] [seed]` — simulates orderflow
- `scenario <name>` — runs a multi-step recorded scenario

If asked to test these, run them only on Base Sepolia (cheapest gas, most tolerant testnet) and report carefully — they leave persistent on-chain state.

## Result classification

For each (command, chain) cell in the matrix:

| Symbol | Meaning |
|---|---|
| ✅ | Succeeded, OR returned a domain-appropriate error ("not settled yet", "not registered", "trial not expired") |
| ❌ | Crashed with a CLI bug (ABI not found, undefined.method, "RPC error returned address", parameters.abi.length) |
| ⚠️ | Environmental issue (RPC 503, timeout, nonce too low) — note and move on, not a code bug |

**Rule of thumb**: a command failing on every chain = CLI bug. Failing on one chain only = chain-specific config (likely Phase 6).
