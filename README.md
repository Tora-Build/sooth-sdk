# sooth-sdk

![CI](https://github.com/Tora-Build/sooth-sdk/actions/workflows/ci.yml/badge.svg)
[![version](https://img.shields.io/badge/version-0.2.1-blue)](package.json)

TypeScript SDK and `soothcli` REPL for the Sooth Protocol. Pairs with [`Tora-Build/sooth-core`](https://github.com/Tora-Build/sooth-core) (Solidity contracts).

This repo:

- Ships `@sooth/sdk` — programmatic access to LaunchpadEngine, AMMEngine, SoothBook, OrderEngine, TruthMarket, FeeRouter.
- Ships `soothcli` — interactive REPL for Sooth nodes (`soothcli <nodeId>`, `soothcli --list`).
- SDK version is locked to the sooth-core contract version it targets. The CLI rejects nodes whose `coreVersion` doesn't match [`SUPPORTED_CORE_VERSION`](src/cli/config.ts).

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

## Canonical Source Files

**Public API (snapshot, quote, trade builders — consumed by app hooks):**

- `src/core/contracts/launchpadAmm.ts`
- `src/core/contracts/soothCore.ts`
- `src/core/contracts/index.ts`

**Imperative actions (shared write logic — consumed by CLI and app surfaces):**

- `src/core/actions/simulate.ts` — `runSimulate`
- `src/core/actions/writes.ts` — `runCreateMarket`, `runGraduate`, `runApprove`, `runMintUsdc`, `runRedeemLp`, `runTransferLp`, `runDismiss` (→ `TruthMarket.invalidate`), `runClaimRefund` (→ `AMMEngine.settlePosition`), `runSoothBook{BuyYes,BuyNo,Mint,Merge,Cancel}`
- `src/core/actions/types.ts` — `ActionContext`, `ActionEvent`, `ActionReporter`

---

## Non-Negotiable Protocol Invariants

### Outcome Encoding

- `0 = NO`
- `1 = YES`
- `2 = INVALID`

Do not remap outcome values in app adapters.

### AMM Trade Encoding

`AMMEngine.tradePositions` uses signed shares:

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

---

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

**Creates a single client instance** that binds all SDK operations — snapshot reads, quote computation, request builders, preflight, and approval helpers — to your deployed contract addresses and public client. Use this as your single entry point rather than calling individual functions directly.

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

**Swap the data source without changing app code.** In `mode: 'indexed'`, snapshot and quote reads route through your custom provider (indexer backend, database cache, etc.) while all builders, preflight, and approval helpers remain identical. Falls back to RPC for quote recomputation and tx preparation when needed.

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

### 3) Snapshot APIs

**Read complete market state in one call.** A snapshot includes AMM reserves and price, Launchpad graduation and trial status, TruthMarket settlement state, OrderEngine user balances (shares held post-graduation), and SoothBook book state (best ticks, implied price, user balances). Snapshots are the canonical input for all quote helpers, trade builders, and preflight checks.

Single market:

```ts
const snapshot = await readSoothCoreSnapshot(
  publicClient,
  contracts,
  marketAddress,
  { userAddress },
);
```

Batch:

```ts
const snapshots = await readSoothCoreSnapshots(
  publicClient,
  contracts,
  marketAddresses,
  { userAddress },
);
```

AMM user positions are included when `userAddress` is provided:

- `snapshot.launchpadAmm.amm.userYesShares`
- `snapshot.launchpadAmm.amm.userNoShares`

### 4) Quote APIs

**Compute trade cost or proceeds before submitting a tx.** Three paths are available depending on venue and available data.

#### AMM Quote from Snapshot (preferred path)

Exact LMSR cost computed from on-chain reserve state. Fee-adjusted via Launchpad pre/post-grad fee tiers.

```ts
const quote = await sooth.getAmmQuote(snapshot.launchpadAmm, {
  action: "buy",
  outcome: 1,
  shares: 5n * 10n ** 18n,
});
```

#### SoothBook Quote (indicative)

Tick-price-based estimate: `amount × tick / 1000`. Returns `isIndicative: true` — not an execution guarantee since the actual fill depends on resting order depth.

```ts
const quote = await readSoothBookQuote(publicClient, contracts, marketAddress, {
  action: "buy",
  outcome: 1,
  shares: 5n * 10n ** 18n,
});
```

#### Unified Venue-Aware Quote

Auto-routes to AMM or SoothBook based on market state. Always returns `venue` and `isIndicative` fields so the caller doesn't need to know the venue.

```ts
const quote = await readSoothQuote(publicClient, contracts, marketAddress, {
  action: "buy",
  outcome: 1,
  shares: 5n * 10n ** 18n,
});
```

### 5) Trade Request Builders

**Assemble contract call arguments** for AMM and SoothBook trades without duplicating protocol encoding. Each builder returns a typed `{ functionName, args }` tuple ready to pass directly to viem's `writeContract`. Never build these args by hand.

Unified (auto-routes via snapshot venue):

```ts
const request = buildTradeRequest({
  marketAddress,
  action: "buy",
  outcome: 1,
  shares,
  maxCostOrMinProceeds,
  snapshot, // optional — used for venue selection + default SoothBook tick
});
```

AMM only:

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
});
```

SoothBook sell/cancel/mint/merge:

```ts
const sell = buildSoothBookSellRequest({
  marketAddress,
  outcome: 1, // selling YES — SDK inverts to NO-buy at 1000−tick
  tick: 540,
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

**Routes settlement transactions to the correct contract** based on market lifecycle state. The claim route is selected automatically from the snapshot — do not re-implement this logic in app code.

Lifecycle routing:

1. Trial expired without graduation → `AMMEngine.settlePosition(market)`
2. SoothBook finalized position → `OrderEngine.settlePosition(market)`
3. Graduated collateral position → `OrderEngine.settlePosition(market)`
4. Pre-grad AMM share position → `AMMEngine.settlePosition(market)`

All non-AMM settlement flows use `OrderEngine.settlePosition(market)` — no outcome or amount args; the contract auto-calculates payout from the caller's registered position.

```ts
const plan = buildClaimRequest(snapshot, contracts);
if (plan) {
  for (const tx of plan.requests) {
    // execute tx.contract + tx.functionName + tx.args
  }
}
```

### 7) Trade Preflight and Error Classification

**Validate trade inputs before sending a tx.** `preflightTrade` checks market state, outcome validity, venue availability, and balance sufficiency in a single synchronous call — no RPC required. Use it to gate the submit button in UIs.

```ts
const preflight = preflightTrade(snapshot, {
  action: "buy",
  outcome: 1,
  shares,
  userBalance: usdcBalance,
  maxCostOrMinProceeds: maxCost,
});
```

Possible failure reasons:

- `invalid_outcome`
- `invalid_shares`
- `market_not_active`
- `market_settled`
- `market_dismissed`
- `venue_unavailable`
- `insufficient_balance`
- `invalid_guard`

**Error classification** — parses viem revert messages into structured codes for display:

```ts
const parsed = classifyTradeError(error);
// { code: 'insufficient_balance' | 'slippage_exceeded' | ... , message }
```

### 8) Approval Helper

**Check allowance and build an ERC-20 approve tx in one step.** Returns `null` if the current allowance already covers the required amount — no unnecessary approvals.

Read + build in one step (performs on-chain allowance read):

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

Pure builder (if allowance is already known):

```ts
const approval = buildApprovalRequest({
  tokenAddress,
  spender,
  amount,
  allowance,
});
```

---

## Decimal Handling

### Internal Standard

SDK economics use WAD (`1e18`) for:

- shares
- quote values
- fee values
- slippage guards

### Contract Boundary

Conversion between token units and WAD must be explicit at all system boundaries:

- `tokenUnitsToWad(...)` and `wadToTokenUnits(...)` from `@sooth/sdk/core/utils`
- Never silently mix token decimals in quote or trade math
- Do not hardcode collateral decimals — read them from the token contract

---

## Adapter Rules (Mandatory)

App hooks and components are adapters, not protocol logic engines.

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

---

## Conformance Checklist

An app is conformant only if all pass:

1. Uses `readSoothCoreSnapshot` / `readSoothCoreSnapshots` for lifecycle state.
2. Uses SDK quote APIs (`readSoothQuote`, `readLaunchpadAmmQuoteFromSnapshot`, `readSoothBookQuote`).
3. Uses SDK request builders for tx args.
4. Uses `applySlippageToAmount`.
5. Uses `buildClaimRequest` for claim route selection.
6. Uses SDK preflight + approval helpers instead of local duplicates.
7. Keeps decimal handling at boundaries only.
