# sooth-sdk

![CI](https://github.com/Tora-Build/sooth-sdk/actions/workflows/ci.yml/badge.svg)
[![version](https://img.shields.io/badge/version-0.2.1-blue)](package.json)

TypeScript SDK and `soothcli` REPL for the Sooth Protocol. Pairs with [`Tora-Build/sooth-core`](https://github.com/Tora-Build/sooth-core) (Solidity contracts).

This repo:

- Ships `@sooth/sdk` (npm) — programmatic access to LaunchpadEngine, AMMEngine, SoothBook, OrderEngine, TruthMarket, FeeRouter.
- Ships `soothcli` — interactive REPL for Sooth nodes (`soothcli <nodeId>`, `soothcli --list`).
- SDK version is locked to the sooth-core contract version it targets. The CLI rejects nodes whose `coreVersion` doesn't match [`SUPPORTED_CORE_VERSION`](src/cli/config.ts).
- Migration playbook: `.claude/skills/cli-migration/` (covers ABI drift, parseAbi audits, per-chain RPC config, multi-chain test sweeps).

## Consumed by

- Anyone integrating Sooth markets via `npm install @sooth/sdk`.

## Registry data

The SDK reads registry node/chain metadata via `src/registry-loader.ts`. Order of preference:

1. Injected manifest (`setManifest()` / `setManifestProvider()`) — wire this with a live `nodes.json` for instant feedback during development.
2. HTTP fetch from `registry.sooth.market` (2 s timeout) — the freshness path, picks up newly registered nodes between SDK releases.
3. Embedded snapshot at `data/nodes.snapshot.json` — last-known-good, ships with each release. Drives offline boot and CI.

## Develop locally

```bash
pnpm install
pnpm build           # tsc + chmod the bin
pnpm dev             # tsc --watch
bun src/cli/interactive.ts --list
bun src/cli/interactive.ts c30c6b15
```

---

## Integration Guide

Single canonical protocol interaction layer for Launchpad + AMM + SoothBook + settlement flows.

Primary goals:

1. No missing features.
2. No missing calculations.
3. No missing protocol know-how across app surfaces.

This SDK layer is built from parity review across:

- `apps/demo` (reference-heavy Launchpad/AMM surface + Geek terminal)
- `apps/telegram/webapp` (current live integration testbed)
- `apps/market` (market discovery surface)

## Phase Status

`Phase 1`, `Phase 2`, and `Phase 3` roadmap items are implemented in one shot.

Implemented scope:

- SoothBook quote helper (indicative, centralized math).
- SoothBook write builders (buy/sell/cancel/mint/merge).
- Pre-bound client factory with shared API surface.
- Batch snapshot API.
- Snapshot-based quote convenience path.
- Claim/settlement request builder.
- AMM user position in snapshot.
- Trade preflight + error classification.
- Approval helper.
- Indexed provider architecture hooks.

## Canonical Source Files

**Public API (snapshot, quote, trade builders — consumed by app hooks):**

- `src/core/contracts/launchpadAmm.ts`
- `src/core/contracts/soothCore.ts`
- `src/core/contracts/index.ts`

**Imperative actions (shared write logic — consumed by CLI + Geek terminal):**

- `src/core/actions/simulate.ts` — `runSimulate`
- `src/core/actions/writes.ts` — `runCreateMarket`, `runGraduate`, `runApprove`, `runMintUsdc`, `runRedeemLp`, `runTransferLp`, `runDismiss`, `runClaimRefund`, `runSoothBook{BuyYes,BuyNo,Mint,Merge,Cancel}`
- `src/core/actions/types.ts` — `ActionContext`, `ActionEvent`, `ActionReporter`

See `src/core/actions/` for the full action surface.

## Non-Negotiable Protocol Invariants

### Outcome Encoding

- `0 = NO`
- `1 = YES`
- `2 = INVALID`

Do not remap outcome values in app adapters.

### Launchpad Trade Encoding

Launchpad/AMM uses signed shares:

- Buy => `deltaShares > 0`
- Sell => `deltaShares < 0`

Use SDK builder only:

- `buildLaunchpadTradeRequest(...)`
- `buildTradeRequest(...)`

### Slippage Guard Semantics

Guard arg is always `maxCostOrMinProceeds`:

- Buy => max cost ceiling
- Sell => min proceeds floor

Canonical helper:

- `applySlippageToAmount({ action, amount, slippageBps })`

No hidden extra app-level buffers.

### Fee Composition

AMM quote is raw LMSR cost. Launchpad fee is layered on top:

- pre-grad fee: `preGradFeeBps`
- post-grad fee: `postGradFeeBps`
- selected via market graduation state

Canonical quoting:

- `readLaunchpadAmmQuote(...)`
- `readLaunchpadAmmQuoteFromSnapshot(...)`

### Venue Selection

Canonical venue route:

- Settled/finalized => non-trading lifecycle (claims/redeem domain)
- Graduated + active SoothBook => `soothbook`
- Else => `amm`

Use `selectTradingVenue(...)`.

## Core API

Import path:

```ts
import {
  createSoothClient,
  readSoothCoreSnapshot,
  readSoothCoreSnapshots,
  readSoothQuote,
  readSoothBookQuote,
  buildTradeRequest,
  buildClaimRequest,
  readApprovalRequest,
  preflightTrade,
} from "@sooth/sdk/core/contracts";
```

### 1) Pre-Bound Client Factory

```ts
const sooth = createSoothClient({
  mode: "rpc",
  publicClient,
  contracts: {
    launchpadEngine: "0x...",
    ammEngine: "0x...",
    orderEngine: "0x...",
    soothBook: "0x...",
  },
});

const snapshot = await sooth.getSnapshot(marketAddress);
const snapshots = await sooth.getSnapshots([marketA, marketB, marketC]);
```

### 2) Indexed Provider Mode Hook

`createSoothClient` supports `mode: 'indexed'` with a provider contract.

```ts
const sooth = createSoothClient({
  mode: "indexed",
  indexedProvider: {
    getSnapshot: async (market) => fetchSnapshot(market),
    getSnapshots: async (markets) => fetchSnapshots(markets),
    getQuote: async (market, options) => fetchQuote(market, options),
    listMarkets: async () => fetchMarketAddresses(),
  },
  // optional RPC fallback for quote recomputation / tx prep:
  publicClient,
  contracts,
});
```

This keeps app hooks stable while data source changes from direct RPC to indexer-backed reads.

### 3) Snapshot APIs

Single:

```ts
const snapshot = await readSoothCoreSnapshot(
  publicClient,
  contracts,
  marketAddress,
  {
    userAddress,
  },
);
```

Batch:

```ts
const snapshots = await readSoothCoreSnapshots(
  publicClient,
  contracts,
  marketAddresses,
  {
    userAddress,
  },
);
```

AMM user positions are included in snapshot when `userAddress` is provided:

- `snapshot.launchpadAmm.amm.userYesShares`
- `snapshot.launchpadAmm.amm.userNoShares`

### 4) Quote APIs

#### AMM Quote from Snapshot (preferred app path)

```ts
const quote = await sooth.getAmmQuote(snapshot.launchpadAmm, {
  action: "buy",
  outcome: 1,
  shares: 5n * 10n ** 18n,
});
```

#### SoothBook Quote (indicative)

```ts
const quote = await readSoothBookQuote(publicClient, contracts, marketAddress, {
  action: "buy",
  outcome: 1,
  shares: 5n * 10n ** 18n,
});
// quote.isIndicative === true
```

#### Unified Venue-Aware Quote

```ts
const quote = await readSoothQuote(publicClient, contracts, marketAddress, {
  action: "buy",
  outcome: 1,
  shares: 5n * 10n ** 18n,
});
```

`readSoothQuote` uses canonical venue routing and returns AMM or SoothBook quote shape with explicit `venue` and `isIndicative`.

### 5) Trade Request Builders

Unified:

```ts
const request = buildTradeRequest({
  marketAddress,
  action: "buy",
  outcome: 1,
  shares,
  maxCostOrMinProceeds,
  snapshot, // optional; used for venue + default SoothBook tick
});
```

AMM-only:

```ts
const request = buildLaunchpadTradeRequest({
  marketAddress,
  action: "sell",
  outcome: 0,
  shares,
  maxCostOrMinProceeds,
});
```

SoothBook buy:

```ts
const request = buildSoothBookBuyRequest({
  marketAddress,
  outcome: 1,
  tick: 540,
  amount: shares,
  maxCost,
});
```

SoothBook sell/cancel/mint/merge:

```ts
const sell = buildSoothBookSellRequest({
  marketAddress,
  outcome: 1, // selling YES
  tick: 540, // YES-side desired price; SDK inverts to NO-buy at 1000−540
  amount: shares,
});

const cancel = buildSoothBookCancelRequest({
  marketAddress,
  side: 1,
  tick: 540,
});

const cancelById = buildSoothBookCancelByIdRequest({ orderId: 42n });
const mint = buildSoothBookMintRequest({ marketAddress, amount: shares });
const merge = buildSoothBookMergeRequest({ marketAddress, amount: shares });
```

Max-cost helper for SoothBook limit/taker paths:

```ts
const maxCost = computeSoothBookMaxCost({
  tick: 540,
  amount: shares,
  slippageBps: 500, // default 5%
});
```

### 6) Claim / Settlement Builder

Canonical lifecycle routing:

1. Dismissed trial => `LaunchpadEngine.claimRefund`
2. SoothBook finalized position => `OrderEngine.settlePosition`
3. Graduated collateral redemption => `OrderEngine.settlePosition`
4. Pre-grad AMM position => `AMMEngine.settlePosition`

All non-AMM settlement flows go through `OrderEngine.settlePosition(market)` — no outcome or amount args; the contract auto-calculates payout from the caller's registered position.

```ts
const plan = buildClaimRequest(snapshot, contracts);
if (plan) {
  for (const tx of plan.requests) {
    // execute tx.contract + tx.functionName + tx.args
  }
}
```

### 7) Trade Preflight and Error Classification

```ts
const preflight = preflightTrade(snapshot, {
  action: "buy",
  outcome: 1,
  shares,
  userBalance: usdcBalance,
  maxCostOrMinProceeds: maxCost,
});
```

Possible failures include:

- `invalid_outcome`
- `invalid_shares`
- `market_not_active`
- `market_settled`
- `market_dismissed`
- `venue_unavailable`
- `insufficient_balance`
- `invalid_guard`

Error parser:

```ts
const parsed = classifyTradeError(error);
// { code: 'insufficient_balance' | 'slippage_exceeded' | ... , message }
```

### 8) Approval Helper

Read + build in one step:

```ts
const approval = await readApprovalRequest(publicClient, {
  tokenAddress: collateralToken,
  owner: userAddress,
  spender: spenderAddress,
  amount: maxCost,
});

if (approval) {
  // call ERC20 approve(approval.args[0], approval.args[1])
}
```

Pure builder (if allowance already known):

```ts
const approval = buildApprovalRequest({
  tokenAddress,
  spender,
  amount,
  allowance,
});
```

## Decimal Handling

### Internal Standard

SDK economics use WAD (`1e18`) for:

- shares
- quote values
- fee values
- slippage guards

### Contract Boundary

Boundary conversion must be explicit (token units <-> WAD):

- use `tokenUnitsToWad(...)` and `wadToTokenUnits(...)` from `@sooth/sdk/core/utils`
- never silently mix token decimals in quote/trade math

### Practical Notes

- Base Sepolia MockUSDC in current environments may be 18 decimals.
- Real USDC is 6 decimals.
- Do not hardcode collateral decimals in app logic.

## Adapter Rules (Mandatory)

App hooks/components are adapters, not protocol logic engines.

Allowed in app layer:

- wallet UX
- loading/error states
- query invalidation
- formatting / i18n

Not allowed in app layer:

- fee math duplication
- slippage formula duplication
- outcome remapping
- trade arg assembly duplication
- claim route re-implementation

## Conformance Checklist

An app is conformant only if all pass:

1. Uses `readSoothCoreSnapshot` / `readSoothCoreSnapshots` for lifecycle state.
2. Uses SDK quote APIs (`readSoothQuote`, `readLaunchpadAmmQuoteFromSnapshot`, `readSoothBookQuote`).
3. Uses SDK request builders for tx args.
4. Uses `applySlippageToAmount`.
5. Uses `buildClaimRequest` for claim route selection.
6. Uses SDK preflight + approval helpers instead of local duplicates.
7. Keeps decimals handling at boundaries only.

## Notes

- SoothBook quote remains indicative until full depth simulation is introduced on-chain or in indexer execution.
- Indexed mode is an abstraction hook; it intentionally does not force a specific backend implementation.
