# ABI Drift Cheatsheet

A catalog of historical ABI/contract drifts in sooth-core, organized by migration. Pattern-match against this when investigating new errors.

## v0.1.x → v0.2.0

### Settlement lifecycle: single-step → multi-phase

| v0.1.x                                            | v0.2.0                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `TruthMarket.settle(uint8 outcome, uint64 tStar)` | `TruthMarket.resolve(uint8 outcome, uint64 tStar)` then `attest()` then `settle()` then `finalize()` |
| 1 tx                                              | Up to 4 txs across adjudicator phases                                                                |

**Symptom**: `ABI encoding params/values length mismatch. Expected length (params): 0, Given length (values): 2`

**Fix**: CLI's `settle <outcome>` should call `resolve(outcome, tStar)`; add separate dispatchers for `attest` and `finalize` if users need full control.

### Function moved between contracts

| Function                        | v0.1.x location  | v0.2.0 location                                                                               |
| ------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| `isMarketSettled(address)`      | `Collateralizer` | Removed; use `TruthMarket.isSettled()` instead                                                |
| `isMarketRegistered(address)`   | `Collateralizer` | `OrderEngine`                                                                                 |
| `getCollateralBacking(address)` | `Collateralizer` | `OrderEngine` and `SoothBook` (different semantics — OrderEngine total, SoothBook per-market) |

**Symptom**: `Function "isMarketSettled" not found on ABI`

**Fix**: Update both the contract address (Collateralizer no longer in deployment) AND the ABI reference.

### Contract renames in deployment map

| v0.1.x           | v0.2.0                                                          |
| ---------------- | --------------------------------------------------------------- |
| `MockUSDC`       | `BaseToken` (testnet) — same contract, just renamed in registry |
| `Collateralizer` | `OrderEngine` (replaced)                                        |
| n/a              | `AdjudicatorRegistry` (new)                                     |

**Symptom**: `Cannot read properties of undefined (reading 'abi')` or `parameters.abi.length`

**Fix**: grep `deployment.contracts.MockUSDC` and `ABIS.MockUSDC` repo-wide; replace with `BaseToken` equivalents.

### SoothBook market creation: removed

v0.1.x had `SoothBook.createMarket(...)` callable by anyone. v0.2.0 removes it — SoothBook markets are auto-registered by OrderEngine when a Launchpad market graduates.

**Symptom**: `soothbookCommands.createmarket is not a function`

**Fix**: Remove the dispatch case OR replace with a clean "not supported in v0.2.0 — auto-registered on graduation" message.

### `getPositionQuote` return tuple expanded

| v0.1.x                             | v0.2.0                                        |
| ---------------------------------- | --------------------------------------------- |
| `(cost, fee, newPrice)` — 3 values | `(cost, fee, netAmount, newPrice)` — 4 values |

**Symptom**: Calling code reads `fee` and treats it as `newPrice`, leading to absurd price displays.

**Fix**: Destructure all 4. Search for `getPositionQuote` and verify each call site.

### `createMarket` selector changed (Launchpad)

v0.1.x selector: `0x1099c87f` (5 params)
v0.2.0 selector: `0x386ff810` (7 params — added `adjudicatorConfig` bytes and split deadline)

**Symptom**: `function selector was not recognized` or transaction reverts before any logic runs.

**Fix**: Update the parseAbi line for `createMarket` with the full v0.2.0 signature including `bytes adjudicatorConfig`.

### `adjudicatorConfig` encoding

In v0.2.0, `createMarket(..., adjudicatorConfig)` expects exactly 3 fields:

```solidity
abi.encode(resolver: address, deadline: uint64, typeConfig: bytes)
```

The old v0.1.x layout had **4 fields** (with `vetoPeriod: uint48` between deadline and typeConfig). The extra 32 bytes get parsed as the typeConfig length prefix and produce a `Panic(0x41)` (Too much memory allocated).

**Symptom**: `Panic(0x41)` revert from `AdjudicatorBase.configureMarket` at market creation.

**Fix**: Drop `vetoPeriod` from the encoded tuple. See `.claude/rules/lessons.md` section "createMarket Signature".

## How to investigate a new drift

When a new ABI error surfaces:

1. **Get the function name and the contract address** from the viem error message.
2. **Check if the function exists at all** in the JSON ABI:
   ```bash
   grep '"name":' src/core/abis/<Contract>.ts | grep -i <funcName>
   ```
3. **If yes, signature drifted**: compare `inputs:` array in the JSON ABI against the local `parseAbi` line.
4. **If no, function moved or removed**: grep the whole abis/ directory for the name to find its new home, OR check the integration guide for what replaced it.
5. **Verify against deployed bytecode** (most authoritative):
   ```bash
   cast sig "functionName(type1,type2,...)"   # get expected selector
   cast code <address> --rpc-url <rpc> | grep -c '<selector>'
   ```
   Zero matches = function not on the deployed contract; non-zero = present.

The `cast code` check is the ground truth. Local ABI files can be stale — particularly in any sister-repo's `out/` build artifacts (e.g. the `Tora-Build/sooth-core` contracts repo, vendored as a submodule in sooth-alpha at `packages/contracts-core`). Trust the JSON ABIs checked into `src/core/abis/` of this repo only after confirming they match what's actually deployed.

## Adding entries

When you migrate to a new version and find new drifts, add them to this file under a new `## v0.X.Y → v0.Y.Z` section. Future migrations are dramatically faster when this catalog is up to date — pattern-matching is much cheaper than re-investigating.
