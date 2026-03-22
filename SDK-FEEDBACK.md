# SDK Feedback — From Telegram dApp Build

Direct feedback from building the Telegram mini app against `@sooth/sdk`. These are real friction points encountered during development, not theoretical.

## Context

The Telegram app was the first full integration of the unified SDK. The SDK eliminated entire classes of bugs (decimal mismatches, wrong fee bps, missing claim paths) and reduced hook code by ~40-60%. These gaps are what remains.

---

## 1. SoothBook Has No Quote Function (Biggest Gap)

The SDK has `readLaunchpadAmmQuote()` for AMM but nothing for SoothBook. The Telegram app had to write its own indicative quote with local constants — exactly the duplicated math the SDK was supposed to prevent.

**Current app code (should not exist):**

```ts
// useSoothQuote.ts
const WAD = 10n ** 18n;
const BPS_DENOMINATOR = 10_000n;
const rawQuote = (shares * priceWad) / WAD;
const fee = (rawQuote * snapshot.soothBook.feeBps) / BPS_DENOMINATOR;
```

**SDK should provide:**

```ts
readSoothBookQuote(client, contracts, market, { action, outcome, shares })
// → { rawQuote, fee, total, isIndicative: true }
```

Even if the quote is indicative (no full depth simulation), wrap it in the SDK so apps never duplicate fee/price math.

---

## 2. Contract Addresses Repeated in Every Call

Every hook passes the same 4-address config object. This appears 6+ times across hooks.

**Current:**

```ts
const snapshot = await readSoothCoreSnapshot(publicClient, {
  launchpadEngine: CONTRACTS.LaunchpadEngine as Address,
  ammEngine: CONTRACTS.AMMEngine as Address,
  collateralizer: CONTRACTS.Collateralizer as Address,
  soothBook: CONTRACTS.SoothBook as Address,
}, marketAddress);
```

**Proposed — factory pattern:**

```ts
const sooth = createSoothClient(publicClient, {
  launchpadEngine: '0x...',
  ammEngine: '0x...',
  collateralizer: '0x...',
  soothBook: '0x...',
});

const snapshot = await sooth.getSnapshot(marketAddress);
const quote = await sooth.getQuote(marketAddress, { action, outcome, shares });
const tx = sooth.buildTrade({ marketAddress, action, outcome, shares, maxCost });
```

Cuts ~40 lines of boilerplate across hooks.

---

## 3. No Batch Snapshot (N+1 RPC Problem)

`useMarkets` and `usePositions` both call `readSoothCoreSnapshot()` per market inside `Promise.all`. For 20 markets, that's 20 × ~10 RPC calls = ~200 calls.

**Current:**

```ts
const results = await Promise.all(
  markets.map(addr => readSoothCoreSnapshot(client, contracts, addr))
);
```

**SDK should provide:**

```ts
const snapshots = await readSoothCoreSnapshots(client, contracts, marketAddresses);
// Uses multicall3 internally → 1-3 RPC calls total
```

---

## 4. Quote Function Requires Pre-Fetched State

`readLaunchpadAmmQuote()` requires the caller to first get a snapshot, extract `feeBps` and `currentYesPrice`, then pass them separately.

**Current:**

```ts
const snapshot = await readSoothCoreSnapshot(...);
const quote = await readLaunchpadAmmQuote(client, contracts, market, {
  action, outcome, shares,
  feeBps: snapshot.launchpadAmm.launchpad.currentFeeBps,
  currentYesPrice: snapshot.launchpadAmm.amm.yesProbability,
});
```

**Proposed — either self-contained or snapshot-accepting:**

```ts
// Option A: self-contained (fetches its own state)
const quote = await readLaunchpadAmmQuote(client, contracts, market, { action, outcome, shares });

// Option B: accept snapshot to avoid refetch
const quote = computeQuoteFromSnapshot(snapshot, { action, outcome, shares });
```

---

## 5. No Claim/Settlement Request Builders

The SDK has `buildLaunchpadTradeRequest()` and `buildSoothBookBuyRequest()` but no builders for claims. The claim hook still manually constructs all 4 lifecycle paths (~80 lines).

**Current app code handles:**

1. `LaunchpadEngine.claimRefund` (dismissed trial)
2. `SoothBook.redeem` (SoothBook tokens)
3. `Collateralizer.redeemOutcome` (graduated, YES/NO/INVALID)
4. `AMMEngine.settlePosition` (pre-graduation AMM)

**SDK should provide:**

```ts
const claimRequest = buildClaimRequest(snapshot);
// → { contract, functionName, args } — routed by lifecycle automatically
// → null if nothing to claim
```

This is the highest-value missing builder. Claim routing is the most error-prone logic in the app layer.

---

## 6. AMM Position Not in Snapshot

`readSoothCoreSnapshot` includes SoothBook and Collateralizer user balances when `userAddress` is provided, but not AMM position balances. Hooks make an extra manual call.

**Current:**

```ts
const [snapshot, [ammYesShares, ammNoShares]] = await Promise.all([
  readSoothCoreSnapshot(client, contracts, market, { userAddress }),
  publicClient.readContract({
    abi: AMMEngineABI,
    functionName: 'getPosition',
    args: [market, user],
  }),
]);
```

**Fix:** Include AMM position in the snapshot when `userAddress` is provided:

```ts
snapshot.launchpadAmm.amm.userYesShares
snapshot.launchpadAmm.amm.userNoShares
```

---

## 7. No Error Classification

When a trade fails on-chain, the SDK gives no help classifying the error. The app built its own balance pre-check and error mapping.

**SDK should provide:**

```ts
const preflight = await sooth.preflightTrade(snapshot, {
  action, outcome, shares, userBalance,
});
// → { canTrade: false, reason: 'insufficient_balance', required: 105e18n, available: 10e18n }
// → { canTrade: false, reason: 'market_not_active' }
// → { canTrade: true }
```

---

## 8. No Approval Helper

Every trading flow needs ERC20 approval. This is ~30 lines duplicated in every app's trade hook (check allowance → approve if needed → wait → trade).

**SDK should provide:**

```ts
const approvalRequest = buildApprovalRequest(snapshot, { spender, amount });
// → null if already approved
// → { contract, functionName, args } if approval needed
```

---

## Priority Ranking

| # | Fix | Impact | Effort |
|---|-----|--------|--------|
| 1 | Claim request builder | Eliminates most error-prone app code | Medium |
| 2 | Pre-bound client factory | Cuts 40+ lines boilerplate per app | Small |
| 3 | SoothBook quote function | Eliminates last duplicated math in app | Small |
| 4 | Indexer-backed data layer | 200 RPCs → 1 API call for market listing | Medium-Large |
| 5 | RPC shielding support | Protects API keys, enables rate limiting | Small |
| 6 | AMM position in snapshot | Eliminates extra call in 2 hooks | Small |
| 7 | Self-contained quote | Removes two-step snapshot→quote dance | Small |
| 8 | Trade preflight / error classifier | Better UX, less app-layer guesswork | Medium |
| 9 | Approval helper | Removes ~30 lines duplicated per app | Small |

Items 1-3 are SDK-internal. Items 4-5 are infrastructure the SDK should enable.

---

## Infrastructure: RPC Shielding & Indexer

These are not SDK code, but the SDK's architecture should support them. Both directly affect dApp developer experience.

### RPC Shielding

**Problem:** The Telegram app exposes the RPC URL directly in the browser. Any paid RPC key (Alchemy, Infura) is visible to anyone inspecting network requests. Public RPCs get rate-limited under load.

**What the SDK should enable:**

The SDK currently takes a `publicClient` (viem). This is fine, but apps need guidance and tooling for production:

```ts
// Dev: direct RPC (fine for testing)
const client = createPublicClient({ transport: http('https://sepolia.base.org') });

// Production: route through Cloudflare Worker proxy
const client = createPublicClient({ transport: http('https://rpc-proxy.myapp.workers.dev') });
```

The SDK doesn't need to own the proxy, but should:
- Document the recommended proxy pattern in the README
- Provide an example Cloudflare Worker proxy (10-line passthrough with key injection)
- Never assume the transport is direct — no hardcoded RPC URLs in SDK code

### Indexer Integration

**Problem:** `useMarkets` calls `readSoothCoreSnapshot()` per market. For 20 markets = ~200 RPC calls. This is the N+1 problem. `packages/indexer/` (Ponder) already exists but nothing consumes it.

**Why this matters more than multicall:**

Batch snapshots via multicall (feedback item #4 in the original list) is a band-aid. The real fix is pre-aggregated data from the indexer. The cost difference:

| Approach | RPC calls | Latency | Cost |
|----------|-----------|---------|------|
| Current (per-market snapshot) | ~200 | 2-5s | High |
| Multicall batch | ~3 | 0.5-1s | Medium |
| Indexer API | 0 RPC (1 HTTP) | 50-100ms | Near zero |

**What the SDK should enable:**

Define a data provider interface so apps can swap between direct RPC reads and indexer-backed reads:

```ts
// Option A: Direct RPC (current behavior, fine for single-market views)
const sooth = createSoothClient({ mode: 'rpc', publicClient, contracts });

// Option B: Indexer-backed (for market listings, portfolio views)
const sooth = createSoothClient({ mode: 'indexed', indexerUrl: 'https://indexer.sooth.app' });

// Same API surface — hooks don't change
const snapshot = await sooth.getSnapshot(marketAddress);
const markets = await sooth.listMarkets(); // indexer: 1 call, rpc: N+1 calls
```

The indexer should serve data in the same `SoothCoreSnapshot` shape the SDK already defines. This way:
- Hooks stay identical regardless of data source
- Single-market views (Trade, MarketDetail) can use direct RPC for freshness
- Multi-market views (Markets, Portfolio) use the indexer for performance
- The Ponder indexer in `packages/indexer/` gets a clear contract to implement

### Recommended Architecture

```
Browser App
  │
  ├─ Single market (Trade, Detail) → SDK (RPC mode) → CF Worker proxy → RPC
  │
  └─ Market listings (Markets, Portfolio) → SDK (indexed mode) → Ponder indexer → DB
```

The SDK's job: define the data shapes, provide both transport modes, let apps choose per use case.

---

## What the SDK Already Does Well

For balance: the SDK is already a major improvement over the previous approach.

- `readSoothCoreSnapshot` consolidates 9+ RPC calls into one structured object
- `applySlippageToAmount` eliminated slippage formula drift across apps
- `buildLaunchpadTradeRequest` eliminated signed-share convention bugs
- `OUTCOME` enum eliminated outcome encoding mismatches
- `selectTradingVenue` eliminated venue routing guesswork
- Comprehensive README with conformance checklist

The Telegram build went from ~10-17 days (duplicated logic) to ~3-5 days (SDK adapters). The SDK + infrastructure improvements above would close the gap to near-zero friction for any new app surface.

---

## Appendix: SDK as Shared Backend (Future Reference)

Keeping the library model for now — it's simpler, zero-ops, and right for the current stage (alpha, 3 apps, small user base). The backend model is documented here as a future reference for when the thresholds below are met. **No action needed now.**

### Current Model (SDK as Library)

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Telegram    │  │    Demo     │  │    Lens     │
│  (browser)   │  │  (browser)   │  │  (browser)   │
│             │  │             │  │             │
│ SDK code    │  │ SDK code    │  │ SDK code    │
│ RPC calls   │  │ RPC calls   │  │ RPC calls   │
│ Caching     │  │ Caching     │  │ Caching     │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       ▼                ▼                ▼
    RPC node         RPC node         RPC node
   (separate connections, separate caches, separate costs)
```

Each app independently:
- Bundles ~50KB+ of SDK code into the browser
- Opens its own RPC connections
- Maintains its own React Query cache
- Discovers protocol state from scratch on every page load
- Risk: N apps × M users × K markets = N×M×K RPC calls

### Proposed Model (SDK as Backend)

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Telegram    │  │    Demo     │  │    Lens     │
│  (browser)   │  │  (browser)   │  │  (browser)   │
│             │  │             │  │             │
│ Thin client │  │ Thin client │  │ Thin client │
│ (HTTP/WS)   │  │ (HTTP/WS)   │  │ (HTTP/WS)   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
              ┌──────────────────┐
              │   SDK Backend    │
              │  (CF Worker/API) │
              │                  │
              │ • Snapshot cache  │
              │ • Quote engine   │
              │ • Event stream   │
              │ • Tx builder     │
              │ • Key shielding  │
              └────────┬─────────┘
                       │
                       ▼
                ┌──────────────┐
                │   RPC Node   │
                │  (1 connection│
                │   + Ponder)  │
                └──────────────┘
```

### What Changes for dApp Developers

| Concern | Library Model (Current) | Backend Model |
|---------|------------------------|---------------|
| **Bundle size** | ~50KB+ SDK in browser | ~2KB thin client (fetch wrapper) |
| **RPC costs** | N×M×K calls (each user, each app, each market) | 1 backend polls, caches, serves all | 
| **Data freshness** | Stale until next React Query refetch (15s) | Backend pushes updates via WebSocket/SSE |
| **Key shielding** | Requires separate CF Worker proxy | Solved — keys never leave the backend |
| **N+1 problem** | Band-aid with multicall | Eliminated — backend pre-aggregates |
| **New app effort** | Import SDK, write adapter hooks (3-5 days) | Call REST/WS endpoints, wire to UI (1-2 days) |
| **Protocol upgrades** | Update SDK in every app's package.json | Deploy once to backend, all apps get it |
| **Quote accuracy** | Client-side, may use stale state | Server-side with latest block state |
| **Offline resilience** | Can fallback to direct RPC | Backend is SPOF — needs redundancy |
| **Signing** | Client-side (wallet in browser) | Still client-side — backend builds unsigned tx, client signs |

### Concrete API Surface

The backend would expose:

```
GET  /markets                        → MarketDisplay[]
GET  /markets/:address               → SoothCoreSnapshot
GET  /markets/:address/quote          → SoothQuoteData
     ?action=buy&outcome=1&shares=5e18
POST /markets/:address/trade/build    → { to, data, value } (unsigned tx)
     { action, outcome, shares, slippageBps }
GET  /portfolio/:user                 → PositionWithMarket[]
GET  /portfolio/:user/:market/claim   → { to, data, value } (unsigned tx)
WS   /stream                          → real-time price + market updates
```

**What apps do with this:**

```ts
// Entire useMarkets hook becomes:
const { data: markets } = useQuery({
  queryKey: ['markets'],
  queryFn: () => fetch('/api/markets').then(r => r.json()),
  staleTime: 5_000,
});

// Entire useTrade hook becomes:
const trade = async () => {
  const { to, data } = await fetch('/api/markets/${market}/trade/build', {
    method: 'POST',
    body: JSON.stringify({ action, outcome, shares, slippageBps: 500 }),
  }).then(r => r.json());
  
  await walletClient.sendTransaction({ to, data });
};
```

Hooks go from 50-100 lines each to 5-15 lines. The entire adapter layer nearly disappears.

### What Stays Client-Side

Even with a backend SDK, these must remain in the browser:

- **Wallet signing** — private keys never leave the client
- **Approval transactions** — user must approve ERC20 spend from their wallet
- **Privy/auth session** — wallet connection and session management
- **UI state** — loading, error, optimistic updates, toasts
- **i18n/formatting** — locale-specific display

The backend builds unsigned transactions. The client signs and submits.

### Implementation Path

This doesn't need a big bang. It can be layered:

1. **Now**: SDK as library (current state, already working)
2. **Next**: SDK backend as optional accelerator for read operations
   - `GET /markets` and `GET /portfolio/:user` backed by Ponder indexer
   - Apps opt-in per endpoint, fallback to direct RPC
3. **Then**: SDK backend handles all reads + tx building
   - Quote engine runs server-side with latest state
   - Real-time WebSocket stream for price updates
   - Direct RPC only for tx submission
4. **Later**: SDK backend becomes the protocol gateway
   - Rate limiting, analytics, abuse prevention
   - Multi-chain routing (Base, Monad, etc.)
   - Third-party app API keys

### Cost Comparison

Rough estimates for 1,000 daily active users across 3 app surfaces:

| Model | Monthly RPC Calls | RPC Cost | Hosting Cost | Total |
|-------|-------------------|----------|-------------|-------|
| Library (current) | ~90M calls | ~$300-500 | $0 | ~$300-500 |
| Backend + cache | ~500K calls | ~$5-10 | ~$10-20 (CF Workers) | ~$15-30 |

The backend model is ~15-20x cheaper because of aggressive caching. Most protocol state doesn't change block-to-block.

### Risk: Single Point of Failure

The backend becomes a dependency for all apps. Mitigation:

- Cloudflare Workers = edge-distributed, 99.99% uptime SLA
- Apps can fallback to direct RPC if backend is unreachable (SDK thin client includes fallback)
- Health check endpoint for monitoring
- No user funds at risk — backend is read-only + tx builder, never custodial

### Pros and Cons

#### SDK as Library (Current)

**Pros:**
- Zero infrastructure to operate — no servers, no uptime concerns, no hosting costs
- Each app is fully self-contained and independent — no shared dependency that can take everything down
- Works offline / degraded if the user can reach any RPC node
- No deployment coordination — each app upgrades SDK at its own pace
- Simpler security model — no backend to secure, no API keys to manage, no auth layer
- Battle-tested pattern — this is how most DeFi protocols distribute SDKs
- Lower barrier to start — `npm install` and go, no infra setup

**Cons:**
- Every app pays full RPC cost independently (N×M×K scaling problem)
- API keys exposed in browser (requires per-app proxy workaround)
- No shared cache — 100 users viewing the same market = 100× the same RPC calls
- Bundle size grows with SDK complexity (~50KB+ today, will grow)
- Protocol upgrades require each app to update `package.json` and redeploy
- Quote accuracy limited by client-side state freshness (React Query staleTime)
- Each app must implement its own adapter layer (3-5 days per app, non-trivial)
- Data inconsistency between apps — different apps may cache different state at different times

#### SDK as Backend

**Pros:**
- Dramatic RPC cost reduction — 1 backend caches for all apps (~15-20× cheaper)
- Key shielding solved architecturally — keys never leave the server
- Faster data — backend can poll every block, serve pre-aggregated snapshots
- Real-time updates — WebSocket/SSE pushes instead of client polling
- Smaller app bundles — thin client is ~2KB vs ~50KB+ SDK
- One deploy upgrades all apps — protocol changes propagate instantly
- Lower app dev bar — any developer who can call REST endpoints can build on the protocol
- Consistent data — all apps see the same state at the same time
- Enables analytics, rate limiting, and abuse prevention centrally
- Natural path to third-party API access (other teams build on Sooth)

**Cons:**
- Single point of failure — backend down = all apps down (CF Workers mitigates but doesn't eliminate)
- New infrastructure to build and operate — monitoring, alerting, on-call
- Backend latency added to every request (50-200ms per hop)
- Harder local development — need to run or mock the backend locally
- Versioning complexity — breaking API changes affect all apps simultaneously
- Trust shift — apps now trust the backend to return correct data (library model: apps verify on-chain themselves)
- State consistency challenges — backend cache may serve stale data between blocks
- WebSocket infrastructure is non-trivial to scale and debug
- Cost doesn't go to zero — CF Workers free tier has limits, Durable Objects cost money
- Vendor lock-in risk — deep CF Workers integration makes migration harder
- Requires auth/API key system if opened to third-party developers
- More attack surface — backend is a target for DDoS, data manipulation
- Wallet-specific flows (approval, signing) still happen client-side — not everything simplifies

#### Decision: Stay on Library Model

The library model is the right choice now. The backend model breaks even at ~4 apps, but the operational overhead (infra, monitoring, SPOF risk) doesn't justify itself at alpha stage with 3 apps and a small user base.

**Revisit when any of these are true:**

- User count exceeds ~500 DAU (RPC costs start hurting)
- App count exceeds ~4 surfaces (adapter duplication + maintenance cost exceeds backend build)
- Third-party developers want to build on Sooth (need stable API, not a library)

Until then, focus on SDK library improvements (items 1-9 above). The data shapes (`SoothCoreSnapshot`, `SoothQuoteData`, etc.) are already the right abstraction — they become backend response schemas later with minimal rework.

---

### dApp Development Cost: Library vs Backend

Based on real data from the Telegram build and projected effort for future apps.

#### Building a New App Surface (e.g. "build a Lens prediction market app")

| Phase | No SDK | Library SDK (Current) | Backend SDK |
|-------|--------|----------------------|-------------|
| **Understand protocol** | 2-3 days reading Solidity, ABIs, fee structures, lifecycle | 0.5 day reading SDK README + conformance checklist | 0.5 day reading API docs |
| **Project setup** | 1 day (install deps, configure viem, set up RPC, import ABIs) | 0.5 day (install SDK, configure contracts object) | 0.25 day (set API base URL) |
| **Market listing page** | 1 day (6 readContract calls per market, tuple parsing, status logic) | 0.5 day (readSoothCoreSnapshot per market, map to UI) | 0.25 day (fetch `/markets`, render JSON) |
| **Market detail + quotes** | 1-2 days (AMM quote, fee calc, SoothBook indicative, venue routing) | 0.5 day (readLaunchpadAmmQuote + SoothBook indicative path) | 0.25 day (fetch `/markets/:addr/quote`) |
| **Trading flow** | 2-3 days (signed shares, slippage formula, approval flow, gas estimation) | 1 day (buildLaunchpadTradeRequest + manual approval + gas) | 0.5 day (POST `/trade/build`, sign, submit) |
| **Portfolio / positions** | 1 day (multi-venue balance resolution, value calculation) | 0.5 day (readSoothCoreSnapshot per market with userAddress) | 0.25 day (fetch `/portfolio/:user`) |
| **Claims / redemption** | 2 days (4 lifecycle paths, event parsing, error handling) | 1 day (readSoothCoreSnapshot + manual 4-path routing) | 0.25 day (fetch `/claim` endpoint, sign tx) |
| **Error handling** | 1 day (classify reverts, balance checks, market state checks) | 0.5 day (manual balance pre-check, error mapping) | 0.25 day (backend returns structured errors) |
| **Bug fixing & debugging** | 2-5 days (decimal mismatches, wrong fee bps, slippage drift, missing paths) | 0.5-1 day (most logic bugs eliminated at source) | 0.25 day (bugs are backend-side, app is trivial) |
| **Testing & QA** | 2 days (verify each contract interaction independently) | 1 day (verify adapter behavior, SDK is trusted) | 0.5 day (API contract testing, UI-only QA) |
| | | | |
| **Total dev time** | **~14-20 days** | **~5-7 days** | **~2-3 days** |
| **Developer skill required** | Solidity + viem + React + bigint math | React + SDK API + some viem | React + REST/WebSocket |
| **Bugs shipped to prod** | High (decimal, fee, slippage, claim routing) | Low (adapter-layer only) | Very low (UI-only, logic is backend-tested) |

#### Maintaining an Existing App (per protocol upgrade)

| Task | No SDK | Library SDK | Backend SDK |
|------|--------|-------------|-------------|
| **New contract function added** | Find all apps, update ABIs, add calls, test each | Update SDK, update adapter hooks in each app | Update backend, apps get it for free |
| **Fee structure changed** | Find all hardcoded bps values across all apps | Update SDK formula, rebuild each app | Update backend, zero app changes |
| **New venue added (e.g. SoothBook v2)** | Each app adds new trading path independently | SDK adds venue, each app adds adapter | Backend adds venue, apps see new data automatically |
| **Decimal change (e.g. real USDC = 6 decimals)** | Find all hardcoded decimal assumptions | SDK handles at boundary, but each app must rebuild | Backend handles, apps unaffected |
| **Per-upgrade effort** | 2-5 days per app | 0.5-1 day per app | 0 days per app (backend-only deploy) |
| **For 5 apps** | 10-25 days total | 2.5-5 days total | 0.5 day (backend deploy + smoke test) |

#### Cost to Add the Nth App

This is where the models diverge most:

```
Dev days per new app:

         No SDK     Library SDK     Backend SDK
App 1:   17 days    5 days          2 days + 15 days backend build (one-time)
App 2:   17 days    5 days          2 days
App 3:   17 days    5 days          2 days
App 4:   17 days    5 days          2 days
App 5:   17 days    5 days          2 days
         -------    ------          ------
Total:   85 days    25 days         23 days
```

**Break-even: ~4 apps.** Below 4 apps, the library model wins because you skip the 15-day backend build. Above 4 apps, the backend model wins because each marginal app costs only 2 days and protocol upgrades are free.

But this ignores maintenance. With protocol upgrades factored in:

```
Year 1 (assume 5 apps, 6 protocol upgrades):

                      No SDK          Library SDK     Backend SDK
Initial build:        85 days         25 days         23 days
6 upgrades × 5 apps:  60-150 days     15-30 days      3 days
                      -----------     ----------      ----------
Total:                145-235 days    40-55 days      26 days
```

**With maintenance, the backend model is 1.5-2× cheaper than the library model, and 5-9× cheaper than no SDK.**

#### The Hidden Cost: Bugs

Numbers above don't capture the costliest line item — bugs that reach production.

| Bug class | No SDK | Library SDK | Backend SDK |
|-----------|--------|-------------|-------------|
| Decimal mismatch (like the 18-decimal USDC bug) | Each app at risk | Eliminated in SDK, but apps must rebuild to get fix | Eliminated, fix deploys once |
| Slippage formula drift | Each app at risk | Eliminated if apps use `applySlippageToAmount` | Eliminated at source |
| Missing claim path | Each app at risk | Reduced (SDK exposes lifecycle), but app must wire it | Eliminated (backend routes claims) |
| Fee calculation wrong after graduation | Each app at risk | Eliminated in SDK | Eliminated at source |
| Stale quote leading to reverted tx | Each app at risk | Each app at risk (client-side cache) | Reduced (backend has fresher state) |
| **Production incidents per year** | ~10-15 across 5 apps | ~2-4 across 5 apps | ~1-2 (backend-only, caught early) |
| **User-facing downtime** | Hours per incident | Minutes per incident | Minutes, and fewer incidents |

Each production bug costs ~1-3 days to diagnose, fix, and redeploy across affected apps. For 5 apps with no SDK, that's an additional 30-45 wasted days per year on bug chasing alone.
