---
name: contract-surface
description: Authoritative v0.2.1 sooth-core contract surface reference. Use this skill whenever the user asks about: contract functions / ABIs, whether a function exists in a contract, SDK-vs-contract parity, ABI drift, ghost functions (called but don't exist), missing functions (in contract but not in SDK), what a contract does, how contracts interact, or before doing any ABI audit task. Read v0.2.1.md for the ground truth function list before grepping the source.
---

# sooth-core v0.2.1 Contract Surface Reference

Ground truth for the SDK-facing contract interface. Use this before touching any ABI file or auditing call sites — reading this takes seconds; re-grepping compiled Forge output takes minutes.

## Where the ABIs live in the SDK

| Layer | Location | Notes |
|-------|----------|-------|
| Full JSON-derived ABIs | `src/core/abis/*.ts` | One file per contract. Canonical; used by SDK core. |
| CLI inline ABIs | `src/cli/commands/*.ts` via `parseAbi([...])` | Hand-written subsets. Go stale silently — no compile-time check. |
| Compiled Forge output | `sooth-core/out/<Contract>.sol/<Contract>.json` | Ground truth. Read these when in doubt. |

## Contracts in scope (v0.2.1)

- **AMMEngine** — LMSR AMM, positions, LP tokens, lock-and-release proceeds
- **LaunchpadEngine** — Market factory, trial period, graduation, fee routing init
- **OrderEngine** — Share registry, settlement, SoothBook fill clearing
- **SoothBook** — Limit order book, tick-based matching, mint/merge
- **TruthMarket** — Per-market lifecycle proxy (resolve→attest→settle / invalidate)
- **FeeRouter** — Pre/post-grad fee collection, graduation threshold tracking
- **AdjudicatorBase** — Base adjudicator logic (configure, resolve, attest, settle)
- **AdjudicatorRegistry** — Approved adjudicator whitelist

## Contracts that NO LONGER EXIST in v0.2.1

These were present in v0.1.x and are fully deleted. Any SDK call to them reverts.

| Removed contract | Replaced by |
|-----------------|-------------|
| `Collateralizer` | `OrderEngine` |
| `OutcomeToken` (YES/NO ERC-20s) | Share positions tracked internally in `OrderEngine` |

## Ghost functions — removed from individual contracts

These function names appear in old code but DO NOT exist on the v0.2.1 contract. Calling them reverts.

| Contract | Ghost function | Replacement |
|----------|---------------|-------------|
| AMMEngine | `getBalances(user)` | `getPosition(market, user)` on AMMEngine or OrderEngine |
| AMMEngine | `getTradeLog(market, user)` | No replacement — removed |
| AMMEngine | `router()` / `setRouter(addr)` | Replaced by `feeRouter()` immutable |
| AMMEngine | `settleLockedProceeds(maxEntries)` | `claimUnlocked(maxClaims)` |
| AMMEngine | `spendBalanceFor(user, amount)` | Removed |
| AMMEngine | `tradePositionsFor(user, market, ...)` | Removed |
| AMMEngine | `usdc()` | `baseToken()` |
| TruthMarket | `finalize()` | `settle()` |
| TruthMarket | `isFinalized()` | `isSettled()` |
| TruthMarket | `isSettling()` | `isResolving()` |
| TruthMarket | `question()` (string) | `questionHash()` (bytes32 only) |
| TruthMarket | `guardian()` | Removed |
| LaunchpadEngine | `dismissMarket(market)` | `TruthMarket.invalidate()` (adjudicator only) |
| LaunchpadEngine | `claimRefund(market)` | `AMMEngine.settlePosition(market)` |
| SoothBook | `redeem(marketKey)` | `OrderEngine.settlePosition(market)` |
| SoothBook | `feeBps()` | Removed — fee routing is in FeeRouter |

## Key v0.2.1 architectural changes

1. **Settlement is unified through OrderEngine.settlePosition(market)** for all post-graduation positions. The caller's position is auto-calculated from the registered share balance.

2. **SoothBook no longer holds outcome state.** `finalized` and `outcome` moved to TruthMarket. SoothBook's `markets(bytes32)` mapping was deleted; use `registeredMarkets(bytes32)` (bool only) + TruthMarket.isSettled().

3. **Proceeds from AMM sells are time-locked** via `lockDuration`. Use `getClaimableAmount(user)` to check what's available and `claimUnlocked(maxClaims)` to release.

4. **Dismissed markets** (trial expired without graduation) no longer have an explicit dismiss tx. The state is implicit via `isTrialExpiredWithoutGraduation(market)`. Refund path is `AMMEngine.settlePosition(market)` for share holders, `AMMEngine.redeemLP(market, lpAmount)` for LP holders.

5. **AdjudicatorBase.configureMarket(market, bytes config)** receives encoded `(address resolver, uint64 deadline, bytes typeConfig)` — NOT the old `(address, uint64, uint48 vetoPeriod, bytes)` 4-tuple. The old encoding panics.

6. **LaunchpadEngine.predictMarketAddress** takes 6 args: `(creator, adjudicator, question, nonce, startTime, deadline)` — not 2.

## Full contract surface

See **v0.2.1.md** in this directory for the complete function/event/error tables per contract.

## How to audit for ghost functions

```bash
# Find all functions called on a contract in CLI layer:
grep -rn "functionName:" src/cli/commands/market.ts | sort -u

# Compare against ground truth:
cat sooth-core/out/TruthMarket.sol/TruthMarket.json | python3 -c "
import json,sys
abi = json.load(sys.stdin)['abi']
fns = [e['name'] for e in abi if e['type']=='function']
print('\n'.join(sorted(fns)))
"

# Quick ghost check — does function X exist?
cat sooth-core/out/AMMEngine.sol/AMMEngine.json | python3 -c "
import json,sys
abi = json.load(sys.stdin)['abi']
names = {e['name'] for e in abi if e['type']=='function'}
print('exists' if 'getBalances' in names else 'GHOST')
"
```

## SDK ABI files — current status (post v0.2.1 audit)

All SDK ABI files were audited and corrected in commit `f0a2ab7d` + `(abi-fix-followup)`. The ground truth is in `v0.2.1.md`.
