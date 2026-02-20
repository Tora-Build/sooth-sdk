# Sooth on Lens — Solution Design & User Flows

*v1.0 — 2026-02-20*

---

## 1. Product Vision

Sooth turns the Lens social graph into a **prediction market launchpad**. Every market starts as a Lens post with an LMSR AMM — real-time price discovery, not pool-splitting like Orb's pari-mutuel approach. When a market proves traction (enough trading fees), it **graduates** to a full SoothBook orderbook, opening it up to traders beyond Lens.

This creates a flywheel: opinion leaders and AI agents on Lens create markets on topics they have insight into. Social engagement drives trading volume. Graduating markets attract external traders into the Lens ecosystem — bringing liquidity, attention, and new users to the protocol.

**Core value props**:
- **For Lens users**: Real-time probability pricing on social predictions. Buy and sell positions at any time with instant price feedback.
- **For opinion leaders & agents**: Monetize predictions. Create markets, build reputation, earn from graduated orderbooks.
- **For the broader market**: Graduated orderbooks are open to any on-chain trader — not just Lens users. Social context (comments, reactions, creator reputation) enriches every market.
- **For Lens protocol**: Every graduated market is a bridge that pulls external traders into the Lens social graph.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Lens Ecosystem                          │
│                                                            │
│  Orb / Hey / Firefly / any Lens client                     │
│       │                                                    │
│       │  (sees Sooth markets as normal Lens posts          │
│       │   with prediction market UI via Post Actions)      │
│       │                                                    │
│  ┌────▼─────────────────────────────────┐                  │
│  │          Sooth Lens App              │                  │
│  │  (React frontend — sooth.market)     │                  │
│  │                                      │                  │
│  │  • Market creation wizard            │                  │
│  │  • Trading terminal (buy/sell)       │                  │
│  │  • Position portfolio                │                  │
│  │  • Market feed / discovery           │                  │
│  └────┬─────────────────────────────────┘                  │
│       │                                                    │
│  ┌────▼─────────────────────────────────┐                  │
│  │     @lens-protocol/client SDK        │                  │
│  │                                      │                  │
│  │  post() ──────── Create market post  │                  │
│  │  executePostAction() ─── BUY/SELL    │                  │
│  │  executePostAction() ─── RESOLVE     │                  │
│  │  executePostAction() ─── REDEEM      │                  │
│  │  fetchPosts() ──── Market discovery  │                  │
│  └────┬─────────────────────────────────┘                  │
│       │                                                    │
│  ┌────▼─────────────────────────────────┐                  │
│  │     ActionHub (0xc6D5…A802)          │                  │
│  │     (Lens Chain, chainId 232)        │                  │
│  │                                      │                  │
│  │  Forwards all calls to:              │                  │
│  │  ┌───────────────────────────────┐   │                  │
│  │  │  SoothPostAction              │   │                  │
│  │  │  ├── configure() → init LMSR  │   │                  │
│  │  │  ├── execute()   → trade/     │   │                  │
│  │  │  │               resolve/     │   │                  │
│  │  │  │               redeem       │   │                  │
│  │  │  └── setDisabled() → pause    │   │                  │
│  │  └───────────────────────────────┘   │                  │
│  │                                      │                  │
│  │  Uses:                               │                  │
│  │  • WGHO (0x6bDc…e2F) for collateral  │                  │
│  │  • LMSRMath library for pricing      │                  │
│  └──────────────────────────────────────┘                  │
└────────────────────────────────────────────────────────────┘
```

---

## 3. User Flows

### 3.1 Create a Market

**Who**: Any Lens user with WGHO for the creator subsidy
**Where**: Sooth app or any Lens client that supports SoothPostAction

```
┌─────────────────────────────────────────────────────────────┐
│                    MARKET CREATION FLOW                     │
│                                                             │
│  User fills market form:                                    │
│  ┌─────────────────────────────┐                            │
│  │ Question: "Will ETH hit     │                            │
│  │           $5K by June?"     │                            │
│  │ Deadline:  June 30, 2026    │                            │
│  │ Liquidity: 100 WGHO (b)     │                            │
│  │ Fee:       2%               │                            │
│  └─────────────────────────────┘                            │
│       │                                                     │
│       ▼                                                     │
│  1. Upload metadata to Grove                                │
│     article({                                               │
│       title: "Will ETH hit $5K by June?",                   │
│       content: "Resolution: ...",                           │
│       tags: ["sooth-market", "ethereum"],                   │
│       attributes: [                                         │
│         { key: "market_type", value: "binary" },            │
│         { key: "resolution_deadline", value: "1751241600" },│
│         { key: "b_parameter", value: "100e18" },            │
│         { key: "fee_bps", value: "200" }                    │
│       ]                                                     │
│     })                                                      │
│     → lens://af5225b...                                     │
│       │                                                     │
│       ▼                                                     │
│  2. Approve WGHO for ActionHub                              │
│     wgho.approve(ActionHub, subsidy)                        │
│     subsidy = b × ln(2) ≈ 69.3 WGHO                         │
│       │                                                     │
│       ▼                                                     │
│  3. Create post with SoothPostAction attached               │
│     post(sessionClient, {                                   │
│       contentUri: uri("lens://af5225b..."),                 │
│       actions: [{                                           │
│         unknown: {                                          │
│           address: SOOTH_POST_ACTION,                       │
│           params: encode({                                  │
│             "sooth.param.b": 100e18,                        │
│             "sooth.param.deadline": 1751241600,             │
│             "sooth.param.feeBps": 200                       │
│           })                                                │
│         }                                                   │
│       }]                                                    │
│     })                                                      │
│       │                                                     │
│       ▼                                                     │
│  4. ActionHub calls SoothPostAction.configure()             │
│     → Creates LMSR market state                             │
│     → Transfers creator subsidy (b × ln(2) WGHO)            │
│     → Market starts at 50/50                                │
│       │                                                     │
│       ▼                                                     │
│  5. Market is LIVE                                          │
│     • Visible as a Lens post in any client                  │
│     • Sooth UI shows YES/NO prices + trading panel          │
│     • Other Lens apps see it as an article post             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Buy Shares (Trade)

**Who**: Any Lens user with WGHO
**Precondition**: Market is live (not resolved, not past deadline)

```
┌─────────────────────────────────────────────────────────────┐
│                       BUY FLOW                              │
│                                                             │
│  User views market post:                                    │
│  ┌─────────────────────────────┐                            │
│  │ "Will ETH hit $5K by June?" │                            │
│  │  YES: 62%    NO: 38%        │                            │
│  │                             │                            │
│  │  [Buy YES ▼]  Amount: 10    │                            │
│  │  Cost: ~7.2 WGHO + 0.14 fee │                            │
│  │  New price: ~64%            │                            │
│  │                             │                            │
│  │  [ Confirm Buy ]            │                            │
│  └─────────────────────────────┘                            │
│       │                                                     │
│       ▼                                                     │
│  1. Quote (read-only)                                       │
│     quoteBuy(feed, postId, YES, 10e18)                      │
│     → { cost: 7.2e18, fee: 0.14e18, total: 7.34e18 }        │
│       │                                                     │
│       ▼                                                     │
│  2. Approve WGHO (if not already)                           │
│     wgho.approve(ActionHub, totalCost)                      │
│       │                                                     │
│       ▼                                                     │
│  3. Execute Post Action                                     │
│     executePostAction(sessionClient, {                      │
│       post: postId("42"),                                   │
│       action: {                                             │
│         unknown: {                                          │
│           address: SOOTH_POST_ACTION,                       │
│           params: encode({                                  │
│             "sooth.param.action": 0,     // BUY             │
│             "sooth.param.outcome": 1,    // YES             │
│             "sooth.param.amount": 10e18, // 10 shares       │
│             "sooth.param.maxCost": 8e18  // slippage limit  │
│           })                                                │
│         }                                                   │
│       }                                                     │
│     })                                                      │
│       │                                                     │
│       ▼                                                     │
│  4. ActionHub → SoothPostAction.execute()                   │
│     → Decodes action=BUY                                    │
│     → LMSR cost calculation                                 │
│     → safeTransferFrom(user, contract, totalCost)           │
│     → Fee sent to treasury                                  │
│     → Updates qYes, credits user yesShares                  │
│     → Emits SharesBought event                              │
│       │                                                     │
│       ▼                                                     │
│  5. UI updates                                              │
│     • Price moves (YES prob increases)                      │
│     • Position shows in portfolio                           │
│     • Activity feed shows trade                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Sell Shares

**Who**: User holding shares
**Precondition**: Market is live

```
┌─────────────────────────────────────────────────────────────┐
│                       SELL FLOW                             │
│                                                             │
│  User views their position:                                 │
│  ┌─────────────────────────────┐                            │
│  │ Your Position:              │                            │
│  │  10 YES shares              │                            │
│  │  Current value: ~6.8 WGHO   │                            │
│  │  P&L: -0.4 WGHO (-5.6%)     │                            │
│  │                             │                            │
│  │  [Sell]  Amount: 5 shares   │                            │
│  │  Proceeds: ~3.1 WGHO        │                            │
│  │                             │                            │
│  │  [ Confirm Sell ]           │                            │
│  └─────────────────────────────┘                            │
│       │                                                     │
│       ▼                                                     │
│  1. Quote (read-only)                                       │
│     quoteSell(feed, postId, YES, 5e18)                      │
│     → { proceeds: 3.2e18, fee: 0.06e18, total: 3.14e18 }    │
│       │                                                     │
│       ▼                                                     │
│  2. Execute Post Action (no approval needed — selling)      │
│     executePostAction(sessionClient, {                      │
│       action: {                                             │
│         unknown: {                                          │
│           address: SOOTH_POST_ACTION,                       │
│           params: encode({                                  │
│             "sooth.param.action": 1,     // SELL            │
│             "sooth.param.outcome": 1,    // YES             │
│             "sooth.param.amount": 5e18   // 5 shares        │
│           })                                                │
│         }                                                   │
│       }                                                     │
│     })                                                      │
│       │                                                     │
│       ▼                                                     │
│  3. Contract sends WGHO to user (minus fee)                 │
│     → Price moves (YES prob decreases slightly)             │
│     → Position updated: 5 YES remaining                     │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Resolve Market

**Who**: Market creator (resolver) only
**Precondition**: Market exists, not yet resolved

```
┌─────────────────────────────────────────────────────────────┐
│                     RESOLVE FLOW                            │
│                                                             │
│  Creator views their market:                                │
│  ┌─────────────────────────────┐                            │
│  │ "Will ETH hit $5K by June?" │                            │
│  │  Status: AWAITING RESOLUTION│                            │
│  │  Deadline: June 30 (passed) │                            │
│  │                             │                            │
│  │  Resolve as:                │                            │
│  │  (●) YES   ( ) NO   ( ) N/A │                            │
│  │                             │                            │
│  │  [ Resolve Market ]         │                            │
│  └─────────────────────────────┘                            │
│       │                                                     │
│       ▼                                                     │
│  1. Execute Post Action                                     │
│     executePostAction(sessionClient, {                      │
│       action: {                                             │
│         unknown: {                                          │
│           address: SOOTH_POST_ACTION,                       │
│           params: encode({                                  │
│             "sooth.param.action": 2,     // RESOLVE         │
│             "sooth.param.outcome": 1     // YES wins        │
│           })                                                │
│         }                                                   │
│       }                                                     │
│     })                                                      │
│       │                                                     │
│       ▼                                                     │
│  2. Contract checks msg.sender == resolver                  │
│     → Sets resolved = true, winningOutcome = YES            │
│     → Trading frozen                                        │
│     → Emits MarketResolved event                            │
│       │                                                     │
│       ▼                                                     │
│  3. UI updates to show resolution                           │
│     • "Resolved: YES" badge on post                         │
│     • Winners see "Redeem" button                           │
│     • Losers see "Market resolved — you lost"               │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 Redeem Winnings

**Who**: Users holding winning shares
**Precondition**: Market is resolved

```
┌─────────────────────────────────────────────────────────────┐
│                      REDEEM FLOW                            │
│                                                             │
│  Winner views resolved market:                              │
│  ┌─────────────────────────────┐                            │
│  │ "Will ETH hit $5K by June?" │                            │
│  │  ✓ Resolved: YES            │                            │
│  │                             │                            │
│  │  Your position: 10 YES      │                            │
│  │  Payout: 10.00 WGHO         │                            │
│  │                             │                            │
│  │  [ Redeem Winnings ]        │                            │
│  └─────────────────────────────┘                            │
│       │                                                     │
│       ▼                                                     │
│  1. Execute Post Action                                     │
│     executePostAction(sessionClient, {                      │
│       action: {                                             │
│         unknown: {                                          │
│           address: SOOTH_POST_ACTION,                       │
│           params: encode({                                  │
│             "sooth.param.action": 3     // REDEEM           │
│           })                                                │
│         }                                                   │
│       }                                                     │
│     })                                                      │
│       │                                                     │
│       ▼                                                     │
│  2. Contract sends winning shares × 1 WGHO each             │
│     → 10 YES shares → 10 WGHO                               │
│     → Position zeroed out                                   │
│     → Emits SharesRedeemed event                            │
│       │                                                     │
│       ▼                                                     │
│  3. WGHO lands in user's wallet                             │
│     → Can unwrap to GHO for gas                             │
│     → Or use to trade other markets                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Market Lifecycle & Graduation

Markets on Sooth Lens follow a two-phase lifecycle that bridges social predictions with deep-liquidity orderbook trading. This is what makes Sooth more than a social toy — it's a pipeline from social signal to real markets.

### Phase 1: LMSR Social Market

Every market starts as a Lens post with an LMSR AMM:

- Creator posts a question with SoothPostAction attached
- LMSR provides instant automated pricing (starts at 50/50)
- Ideal for social topics, short-lived questions, hot takes
- Accessible via Lens Post Actions (Lens ecosystem users)
- Trading fees accrue toward a **graduation threshold**

### Phase 2: Graduated Orderbook Market

When accumulated fees reach the threshold (`b × ln(2) × multiplier`), the market **graduates**:

- A **SoothBook** orderbook is deployed on-chain for the market
- Limit orders become available alongside the AMM
- **Any on-chain user** can trade — not just Lens users
- The Lens post remains the social hub (comments, reactions, reposts)
- External traders discover markets via the orderbook or Sooth web app

```
┌───────────────────────────────────────────────────────────┐
│                   MARKET LIFECYCLE                        │
│                                                           │
│  Lens Post + SoothPostAction                              │
│       │                                                   │
│       ▼                                                   │
│  ┌─────────────────────────────┐                          │
│  │  Phase 1: LMSR AMM          │  Lens-native users       │
│  │  • Automated pricing        │  Fees accrue → threshold │
│  │  • Social predictions       │                          │
│  └──────────────┬──────────────┘                          │
│                 │                                         │
│    fees >= b × ln(2) × multiplier?                        │
│       NO → expires / creator dismisses                    │
│       YES ↓                                               │
│                 │                                         │
│  ┌──────────────▼──────────────┐                          │
│  │  Phase 2: SoothBook         │  Open to ALL traders     │
│  │  • Limit orders + AMM       │  Deeper liquidity        │
│  │  • Cross-platform access    │  Pro trading UX          │
│  └─────────────────────────────┘                          │
│                                                           │
│  Lens post remains the social hub throughout              │
└───────────────────────────────────────────────────────────┘
```

### Why Graduation Matters

| Benefit | Description |
|---------|-------------|
| **Opinion leader monetization** | Lens influencers create markets on topics they have insight into. Graduated markets generate ongoing fee revenue from the orderbook. |
| **Agent oracle monetization** | AI agents on Lens create + resolve markets programmatically. Graduation validates market quality and unlocks deeper liquidity. |
| **Lens protocol awareness** | Graduated orderbooks bring external traders INTO the Lens ecosystem. They discover the Lens post, comments, social graph — new users find Lens organically. |
| **Natural quality filter** | Only markets with genuine interest graduate. Low-quality predictions stay small and expire. The graduation threshold ensures only proven markets get orderbooks. |

### Trial Period

New markets enter a **7-day trial period**:

- If the market **graduates** during the trial, it continues with an orderbook. The creator cannot dismiss — graduation protects traders.
- If the market **has not graduated** after the trial, the creator can dismiss and refund all participants.
- This protects traders from abandoned or low-quality markets while giving promising ones room to grow.

---

## 5. Post Metadata Schema

Markets are Lens Article posts. Metadata attributes carry structured market data so any client can render them.

```typescript
import { article } from "@lens-protocol/metadata";

const metadata = article({
  title: "Will ETH hit $5K by June 2026?",
  content: `## Resolution Criteria\n- Chainlink ETH/USD >= $5,000\n- Before June 30, 2026 23:59 UTC`,
  tags: [
    "sooth-market",      // identifies as Sooth market
    "ethereum",          // topic tags
    "price"
  ],
  attributes: [
    // Required
    { key: "sooth.market_type", value: "binary" },
    { key: "sooth.resolution_deadline", value: "1751241600" },
    { key: "sooth.b_parameter", value: "100000000000000000000" },
    { key: "sooth.fee_bps", value: "200" },

    // Optional
    { key: "sooth.oracle_type", value: "creator" },
    { key: "sooth.category", value: "crypto" },
    { key: "sooth.outcome_yes_label", value: "Yes, above $5K" },
    { key: "sooth.outcome_no_label", value: "No, below $5K" },
  ]
});
```

### Tag Convention

| Tag | Purpose |
|-----|---------|
| `sooth-market` | Primary identifier — all Sooth markets have this |
| Topic tags (e.g., `ethereum`, `politics`) | Discovery and filtering |

### Attribute Convention

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `sooth.market_type` | string | Yes | Always `"binary"` for now |
| `sooth.resolution_deadline` | unix timestamp | Yes | When market can be resolved |
| `sooth.b_parameter` | WAD string | Yes | LMSR liquidity depth |
| `sooth.fee_bps` | string | Yes | Trading fee in basis points |
| `sooth.oracle_type` | string | No | `"creator"` / `"chainlink"` / `"uma"` |
| `sooth.category` | string | No | Market category |
| `sooth.outcome_yes_label` | string | No | Custom YES label |
| `sooth.outcome_no_label` | string | No | Custom NO label |

---

## 6. Market Discovery

Markets are found by querying Lens posts filtered by the `sooth-market` tag.

```typescript
import { fetchPosts } from "@lens-protocol/client/actions";

// All active Sooth markets
const markets = await fetchPosts(client, {
  filter: {
    metadata: {
      tags: { oneOf: ["sooth-market"] }
    }
  }
});

// Markets by a specific creator
const myMarkets = await fetchPosts(client, {
  filter: {
    authors: [evmAddress("0xCreator...")],
    metadata: {
      tags: { oneOf: ["sooth-market"] }
    }
  }
});

// Markets by category
const cryptoMarkets = await fetchPosts(client, {
  filter: {
    metadata: {
      tags: { all: ["sooth-market", "crypto"] }
    }
  }
});
```

For each discovered post, the frontend reads on-chain state:

```typescript
// Read market state
const market = await readContract({
  address: SOOTH_POST_ACTION,
  abi: SoothPostActionABI,
  functionName: "markets",
  args: [feedAddress, postId]
});

// Read current price
const yesProb = await readContract({
  address: SOOTH_POST_ACTION,
  abi: SoothPostActionABI,
  functionName: "getPrice",
  args: [feedAddress, postId]
});

// Read user position
const [yesShares, noShares] = await readContract({
  address: SOOTH_POST_ACTION,
  abi: SoothPostActionABI,
  functionName: "getPosition",
  args: [feedAddress, postId, userAddress]
});
```

---

## 7. WGHO Approval Strategy

Users need to approve WGHO spending before trading. The approval target depends on the flow:

| Flow | Approval Target | When |
|------|----------------|------|
| Create market | ActionHub | Before `post()` with action |
| Buy shares | ActionHub | Before `executePostAction()` |
| Sell shares | None needed | Contract sends WGHO to user |
| Resolve | None needed | No token transfer |
| Redeem | None needed | Contract sends WGHO to user |

The ActionHub is the intermediary — it calls `SoothPostAction.configure()` / `execute()`, and those functions call `wgho.safeTransferFrom(originalMsgSender, ...)`. Since the ActionHub is `msg.sender` from WGHO's perspective, the user must approve the ActionHub (not the SoothPostAction contract directly).

**Recommended UX**: Prompt for infinite approval on first trade, then no further approvals needed.

```typescript
import { prepareSignerErc20Approval } from "@lens-protocol/client/viem";

// Check if approval needed
const allowance = await readContract({
  address: WGHO,
  abi: erc20Abi,
  functionName: "allowance",
  args: [userAddress, ACTION_HUB]
});

if (allowance < totalCost) {
  // Prompt user for approval
  await prepareSignerErc20Approval(sessionClient, {
    approval: { infinite: evmAddress(ACTION_HUB) }
  }).andThen(handleOperationWith(walletClient));
}
```

---

## 8. Cross-Client Compatibility

Because Sooth markets are standard Lens posts, they appear in **every Lens client** (Orb, Hey, Firefly, etc.):

| Client | What Users See |
|--------|---------------|
| **Sooth App** | Full trading UI — prices, charts, buy/sell, portfolio |
| **Orb** | Article post with market description. May render the Post Action as an "unknown action" button |
| **Hey** | Article post. Can see comments/reactions but no trading UI |
| **Firefly** | Article post. If Firefly adds Sooth plugin, full trading UI |

This is the power of building on Lens — the social layer (reactions, comments, reposts, follows) works automatically across all clients. Only the trading UI requires Sooth-specific rendering.

---

## 9. Event-Driven Indexing

The SoothPostAction emits events that can be indexed for real-time UIs:

```solidity
event MarketCreated(address indexed feed, uint256 indexed postId, address resolver, uint256 b, uint64 deadline, uint16 feeBps);
event SharesBought(address indexed feed, uint256 indexed postId, address indexed user, uint8 outcome, uint256 shares, uint256 cost);
event SharesSold(address indexed feed, uint256 indexed postId, address indexed user, uint8 outcome, uint256 shares, uint256 proceeds);
event MarketResolved(address indexed feed, uint256 indexed postId, uint8 winningOutcome);
event SharesRedeemed(address indexed feed, uint256 indexed postId, address indexed user, uint256 payout);
```

**Indexing options:**
1. **Ponder** (existing Sooth indexer) — add Lens Chain as a new network
2. **The Graph subgraph** — deploy to Lens Chain
3. **Direct RPC polling** — for MVP, poll events with `eth_getLogs`

---

## 10. Gasless UX (Sponsorships)

Lens Sponsorships allow apps to pay gas on behalf of users. For Sooth markets:

```typescript
// Fund Sooth's sponsorship pool
await fundSponsorship(sessionClient, {
  app: evmAddress(SOOTH_APP),
  amount: "500" // GHO
});
```

When a user trades, the SDK automatically checks if sponsorship is available:
- **Sponsored**: User signs, app pays gas. Zero friction.
- **Self-funded**: User pays GHO gas. Still cheap (~$0.01 on L2).

**What to sponsor**: Market creation (attracts creators), first trade (onboarding), resolution (incentivize cleanup). Limit: buy/sell beyond first trade should be self-funded to prevent abuse.

---

## 11. Security Considerations

| Risk | Mitigation |
|------|-----------|
| Creator rug (resolve wrong outcome) | Social reputation + Lens identity. Future: dispute mechanism |
| Flash loan price manipulation | LMSR is manipulation-resistant (cost increases superlinearly) |
| Reentrancy | `nonReentrant` on all state-changing functions |
| Unauthorized resolution | `onlyResolver` check (= post creator) |
| Stale approvals | Use `maxCost` slippage parameter on buys |
| Front-running | Lens Chain L2 has sequencer ordering. Low risk vs L1 |

---

## 12. Implementation Phases

### Phase 1: Contract Deployment (current)
- [x] SoothPostAction contract written
- [x] 22 unit tests passing
- [ ] Deploy to Lens testnet (chain 37111)
- [ ] E2E test: create market + buy + sell + resolve + redeem on testnet

### Phase 2: Minimal Frontend
- [ ] Connect wallet to Lens Chain
- [ ] Create market form → `post()` with SoothPostAction
- [ ] Market detail page → read on-chain state + `quoteBuy`/`quoteSell`
- [ ] Trade panel → `executePostAction()` for BUY/SELL
- [ ] Portfolio page → `getPosition()` for all user markets

### Phase 3: Social Integration
- [ ] Market feed via `fetchPosts()` with `sooth-market` tag
- [ ] Comments on market posts (discussion)
- [ ] Reactions as sentiment signals
- [ ] User profile with prediction history

### Phase 4: Graduation & Orderbook
- [ ] Add graduation threshold logic to SoothPostAction (fee tracking)
- [ ] Deploy SoothBook on Lens Chain for graduated markets
- [ ] Auto-deploy orderbook when market graduates
- [ ] Cross-platform trading UI (non-Lens users can trade graduated markets)
- [ ] Trial period: 7-day proving ground with dismiss/refund for ungrown markets

### Phase 5: Advanced Features
- [ ] Sponsorships for gasless first trade
- [ ] Market categories + search
- [ ] Price charts (from SharesBought/SharesSold events)
- [ ] Leaderboard (accuracy + P&L tracking)
- [ ] Multiple oracle types (Chainlink, UMA, social consensus)
- [ ] Agent oracle framework (AI agents as market creators + resolvers)

---

## 13. Key Constants

| Constant | Value | Notes |
|----------|-------|-------|
| WGHO (Lens mainnet) | `0x6bDc36E20D267Ff0dd6097799f82e78907105e2F` | 18 decimals |
| ActionHub (Lens mainnet) | `0xc6D57Ee750Ef2ee017a9E985A0C4198bEd16A802` | All actions route through here |
| Lens Chain ID | `232` (mainnet) / `37111` (testnet) | ZKsync L2 |
| Default b | `100e18` | ~69.3 WGHO creator deposit |
| Default fee | `200` (2%) | Basis points |
| Outcome NO | `0` | |
| Outcome YES | `1` | |
| Outcome INVALID | `2` | 50/50 split |

---

*End of spec. See also:*
- *[LENS_PREDICTION_MARKETS.md](LENS_PREDICTION_MARKETS.md) — research notes on Orb + Sooth implementation*
- *[LENS_API_REVIEW.md](LENS_API_REVIEW.md) — full Lens V3 API review*
- *[FIREFLY_LENS_SPEC.md](FIREFLY_LENS_SPEC.md) — Firefly plugin spec*
