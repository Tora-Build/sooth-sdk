# Sooth on Lens — Solution Design & User Flows

*v2.0 — 2026-02-26 (rewritten to match original architectural intent)*

> **v2.0 change**: The v1.0 spec incorrectly described a monolithic `SoothPostAction` that
> reimplemented LMSR trading in a single contract. The actual intent is a **thin Lens adapter**
> that delegates into the full Sooth Core protocol (LaunchpadEngine, AMMEngine, TruthMarket,
> Collateralizer, SoothBook). This rewrite corrects the architecture.

---

## 1. Product Vision

Sooth turns the Lens social graph into a **prediction market launchpad**. Every market starts as a Lens post backed by the full Sooth Core protocol — LMSR AMM with real-time price discovery, not pool-splitting like Orb's pari-mutuel approach. When a market proves traction (enough trading fees), it **graduates** to a full SoothBook orderbook, opening it up to traders beyond Lens.

This creates a flywheel: opinion leaders and AI agents on Lens create markets on topics they have insight into. Social engagement drives trading volume. Graduating markets attract external traders into the Lens ecosystem — bringing liquidity, attention, and new users to the protocol.

**Core value props**:
- **For Lens users**: Real-time probability pricing on social predictions. Buy and sell positions at any time with instant price feedback.
- **For opinion leaders & agents**: Monetize predictions. Create markets, build reputation, earn from graduated orderbooks.
- **For the broader market**: Graduated orderbooks are open to any on-chain trader — not just Lens users. Social context (comments, reactions, creator reputation) enriches every market.
- **For Lens protocol**: Every graduated market is a bridge that pulls external traders into the Lens social graph.

---

## 2. System Architecture

The Lens Post Action is a **thin adapter** — it translates Lens SDK calls (`configure`, `execute`) into Sooth Core contract calls. All market logic, pricing, positions, settlement, and graduation live in the core protocol, not in the adapter.

```
┌────────────────────────────────────────────────────────────────┐
│                      Lens Ecosystem                            │
│                                                                │
│  Orb / Hey / Firefly / any Lens client                         │
│       │                                                        │
│       │  (sees Sooth markets as normal Lens posts              │
│       │   with prediction market UI via Post Actions)          │
│       │                                                        │
│  ┌────▼──────────────────────────────────┐                     │
│  │        Sooth Lens App                 │                     │
│  │  (React frontend — sooth.market)      │                     │
│  │                                       │                     │
│  │  • Market creation wizard             │                     │
│  │  • Trading terminal (buy/sell)        │                     │
│  │  • Position portfolio                 │                     │
│  │  • Market feed / discovery            │                     │
│  └────┬──────────────────────────────────┘                     │
│       │                                                        │
│  ┌────▼──────────────────────────────────┐                     │
│  │   @lens-protocol/client SDK           │                     │
│  │                                       │                     │
│  │  post() ──────── Create market post   │                     │
│  │  executePostAction() ─── BUY/SELL     │                     │
│  │  executePostAction() ─── RESOLVE      │                     │
│  │  executePostAction() ─── REDEEM       │                     │
│  │  fetchPosts() ──── Market discovery   │                     │
│  └────┬──────────────────────────────────┘                     │
│       │                                                        │
│  ┌────▼──────────────────────────────────┐                     │
│  │   ActionHub (Lens infra)              │                     │
│  │                                       │                     │
│  │   Forwards calls to:                  │                     │
│  │   ┌─────────────────────────────┐     │                     │
│  │   │  SoothLensAdapter           │     │                     │
│  │   │  (thin IPostAction wrapper) │     │                     │
│  │   │                             │     │                     │
│  │   │  configure() ──────────┐    │     │                     │
│  │   │  execute()   ──────────┤    │     │                     │
│  │   │  setDisabled() ────────┤    │     │                     │
│  │   └────────────────────────┤────┘     │                     │
│  └────────────────────────────┤──────────┘                     │
│                               │                                │
│  ┌────────────────────────────▼──────────────────────────────┐ │
│  │            Sooth Core Protocol (Lens Chain)               │ │
│  │                                                           │ │
│  │  LaunchpadEngine ──┬──► AMMEngine (LMSR trading)          │ │
│  │       │            ├──► TruthMarket (per-market lifecycle) │ │
│  │       │            └──► Collateralizer (split/merge/redeem)│ │
│  │       │                                                   │ │
│  │       └──► SoothBook (orderbook, post-graduation)         │ │
│  │                                                           │ │
│  │  ProtocolConfig ─── pause, guardians                      │ │
│  │  WGHO ─── collateral token (18 decimals)                  │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### Key Architectural Principle

**The adapter has no market logic.** It is a Lens → Sooth translator:

| Lens SDK Call | Adapter Method | Delegates To |
|---|---|---|
| `post()` with action | `configure()` | `LaunchpadEngine.createMarket()` |
| `executePostAction(BUY)` | `execute()` | `LaunchpadEngine.tradePositions(outcome, +delta, maxCost)` |
| `executePostAction(SELL)` | `execute()` | `LaunchpadEngine.tradePositions(outcome, -delta, minProceeds)` |
| `executePostAction(RESOLVE)` | `execute()` | `TruthMarket.settle(outcome, tStar)` |
| `executePostAction(REDEEM)` | `execute()` | `Collateralizer.redeem(market, amount)` |

The adapter's only state is a mapping from `(feed, postId) → TruthMarket address`, linking Lens posts to their core protocol markets.

---

## 3. Contracts to Deploy on Lens Chain

The full Sooth Core protocol is deployed to Lens Chain, same as on Base Sepolia and Monad Testnet.

| Contract | Role | Notes |
|---|---|---|
| **SoothLensAdapter** | `IPostAction` implementation | Thin wrapper, ~150 lines. Translates Lens `KeyValue[]` params into core contract calls. |
| **LaunchpadEngine** | Market creation, trading, graduation, LP tokens | Existing V12 code. Collateral = WGHO instead of USDC. |
| **AMMEngine** | LMSR pricing, position tracking, lock-on-sell | Existing V12 code. |
| **Collateralizer** | Split/merge/redeem outcome tokens (ERC-20) | Existing V12 code. |
| **SoothBook** | Orderbook for graduated markets | Existing V12 code. Activated per-market on graduation. |
| **ProtocolConfig** | Pause, guardian management | Existing V12 code. |
| **WGHO** | Collateral token | Already deployed: `0x6bDc…e2F` (mainnet), `0xeee5…eB8` (testnet). 18 decimals. |

### Deployment Note: WGHO vs USDC

Sooth Core on Base Sepolia and Monad uses USDC (6 decimals). On Lens Chain, the collateral is WGHO (18 decimals). Since the core protocol operates in WAD (18 decimals) internally, WGHO simplifies the boundary — **no `_wadToUsdc()` / `_usdcToWad()` conversion is needed** because WGHO is already 18 decimals. The `SCALAR` is effectively 1.

### Deployment Note: ZKsync Compatibility

Lens Chain is a ZKsync ZK Stack L2. Deployment requires `foundry-zksync` and zksolc compiler. See `DEPLOYMENT_HANDOFF.md` for toolchain setup. The core protocol must compile and pass tests under zksolc before deployment.

---

## 4. SoothLensAdapter Contract

The adapter implements `IPostAction` and holds no market state beyond the post-to-market mapping.

```solidity
contract SoothLensAdapter is IPostAction, ReentrancyGuard, Ownable {
    ILaunchpadEngine public immutable launchpadEngine;
    ICollateralizer public immutable collateralizer;
    IERC20 public immutable wgho;
    address public immutable actionHub;

    /// @notice (feed, postId) → TruthMarket address
    mapping(address => mapping(uint256 => address)) public marketOf;

    /// @notice (TruthMarket address) → (feed, postId)
    mapping(address => PostRef) public postOf;

    modifier onlyActionHub() {
        require(msg.sender == actionHub);
        _;
    }

    // ── IPostAction: configure ──
    // Decode params → call LaunchpadEngine.createMarket()
    // Store marketOf[feed][postId] = newMarketAddress
    function configure(
        address originalMsgSender,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) external payable onlyActionHub nonReentrant returns (bytes memory);

    // ── IPostAction: execute ──
    // Decode action type from params
    //   BUY/SELL → LaunchpadEngine.tradePositions()
    //   RESOLVE  → TruthMarket.settle()
    //   REDEEM   → Collateralizer.redeem()
    function execute(
        address originalMsgSender,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) external payable onlyActionHub nonReentrant returns (bytes memory);

    // ── IPostAction: setDisabled ──
    // Pause/unpause via ProtocolConfig or market-level control
    function setDisabled(
        address originalMsgSender,
        address feed,
        uint256 postId,
        bool isDisabled,
        KeyValue[] calldata params
    ) external payable onlyActionHub returns (bytes memory);
}
```

### What the adapter does NOT do

- No LMSR math
- No position tracking
- No fee calculation
- No settlement logic
- No collateral accounting
- No LP token management

All of these live in the core contracts, battle-tested across Base Sepolia and Monad.

---

## 5. User Flows

### 5.1 Create a Market

**Who**: Any Lens user with WGHO for the creator deposit
**Where**: Sooth app or any Lens client that supports the adapter

```
┌─────────────────────────────────────────────────────────────┐
│                    MARKET CREATION FLOW                      │
│                                                             │
│  User fills market form:                                    │
│  ┌─────────────────────────────┐                            │
│  │ Question: "Will ETH hit     │                            │
│  │           $5K by June?"     │                            │
│  │ Deadline:  June 30, 2026    │                            │
│  │ Liquidity: 100 WGHO (b)    │                            │
│  └─────────────────────────────┘                            │
│       │                                                     │
│       ▼                                                     │
│  1. Upload metadata to Grove                                │
│     article({                                               │
│       title: "Will ETH hit $5K by June?",                   │
│       content: "Resolution: ...",                           │
│       tags: ["sooth-market", "ethereum"],                   │
│       attributes: [                                         │
│         { key: "sooth.market_type", value: "binary" },      │
│         { key: "sooth.resolution_deadline",                 │
│           value: "1751241600" },                            │
│         { key: "sooth.b_parameter",                         │
│           value: "100000000000000000000" }                   │
│       ]                                                     │
│     })                                                      │
│     → lens://af5225b...                                     │
│       │                                                     │
│       ▼                                                     │
│  2. Approve WGHO for ActionHub                              │
│     wgho.approve(ActionHub, deposit)                        │
│     deposit = b × ln(2) ≈ 69.3 WGHO                        │
│       │                                                     │
│       ▼                                                     │
│  3. Create post with SoothLensAdapter attached              │
│     post(sessionClient, {                                   │
│       contentUri: uri("lens://af5225b..."),                 │
│       actions: [{                                           │
│         unknown: {                                          │
│           address: SOOTH_LENS_ADAPTER,                      │
│           params: encode({                                  │
│             "sooth.param.question": "Will ETH hit...",      │
│             "sooth.param.b": 100e18,                        │
│             "sooth.param.deadline": 1751241600              │
│           })                                                │
│         }                                                   │
│       }]                                                    │
│     })                                                      │
│       │                                                     │
│       ▼                                                     │
│  4. ActionHub → SoothLensAdapter.configure()                │
│     Adapter decodes params and calls:                       │
│       LaunchpadEngine.createMarket(                         │
│         question, startTime, deadline,                      │
│         adjudicator, guardian, initialLiquidity, ...         │
│       )                                                     │
│     → Returns TruthMarket address                           │
│     → Adapter stores marketOf[feed][postId] = market        │
│       │                                                     │
│       ▼                                                     │
│  5. Core protocol creates:                                  │
│     • TruthMarket instance (lifecycle authority)            │
│     • AMMEngine position (LMSR initialized, 50/50)         │
│     • LP tokens minted to creator                           │
│     • Creator deposit transferred (b × ln(2) WGHO)         │
│     • 7-day trial period starts                             │
│       │                                                     │
│       ▼                                                     │
│  6. Market is LIVE                                          │
│     • Visible as a Lens post in any client                  │
│     • Sooth UI reads on-chain state from core contracts     │
│     • Graduation progress tracked by LaunchpadEngine        │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Buy Shares

**Who**: Any Lens user with WGHO
**Precondition**: Market is live (TruthMarket.isLive() == true)

```
┌─────────────────────────────────────────────────────────────┐
│                       BUY FLOW                              │
│                                                             │
│  User views market post:                                    │
│  ┌─────────────────────────────┐                            │
│  │ "Will ETH hit $5K by June?" │                            │
│  │  YES: 62%    NO: 38%        │                            │
│  │                             │                            │
│  │  [Buy YES ▼]  Amount: 10   │                            │
│  │  Cost: ~7.2 WGHO + 0.14 fee│                            │
│  │                             │                            │
│  │  [ Confirm Buy ]           │                            │
│  └─────────────────────────────┘                            │
│       │                                                     │
│       ▼                                                     │
│  1. Quote (read-only, direct to core)                       │
│     AMMEngine.getPositionQuote(market, YES, +10e18)         │
│     → { cost: 7.2e18, newPrice: 0.64e18 }                  │
│       │                                                     │
│       ▼                                                     │
│  2. Approve WGHO (if needed)                                │
│     wgho.approve(ActionHub, cost + fee)                     │
│       │                                                     │
│       ▼                                                     │
│  3. Execute Post Action                                     │
│     executePostAction(sessionClient, {                      │
│       post: postId("42"),                                   │
│       action: {                                             │
│         unknown: {                                          │
│           address: SOOTH_LENS_ADAPTER,                      │
│           params: encode({                                  │
│             "sooth.param.action": 0,     // BUY             │
│             "sooth.param.outcome": 1,    // YES             │
│             "sooth.param.amount": 10e18, // shares          │
│             "sooth.param.maxCost": 8e18  // slippage        │
│           })                                                │
│         }                                                   │
│       }                                                     │
│     })                                                      │
│       │                                                     │
│       ▼                                                     │
│  4. ActionHub → SoothLensAdapter.execute()                  │
│     Adapter looks up market = marketOf[feed][postId]        │
│     Adapter calls:                                          │
│       LaunchpadEngine.tradePositions(                       │
│         market, 1, +10e18, 8e18                             │
│       )                                                     │
│     Core protocol handles:                                  │
│       → LMSR cost calculation (AMMEngine)                   │
│       → Fee split (pre-grad: bBase growth + LP mint)        │
│       → WGHO transfer from user                             │
│       → Position update (yesShares += 10e18)                │
│       → Graduation progress check                           │
│       │                                                     │
│       ▼                                                     │
│  5. UI reads updated state from core contracts              │
│     • AMMEngine.getMarketState(market) → new price          │
│     • AMMEngine.getPosition(market, user) → shares          │
│     • LaunchpadEngine.getGraduationProgress(market)         │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Sell Shares

**Who**: User holding shares
**Precondition**: Market is live

```
┌─────────────────────────────────────────────────────────────┐
│                       SELL FLOW                             │
│                                                             │
│  1. Execute Post Action with action=SELL                    │
│     params: outcome, amount (shares to sell)                │
│                                                             │
│  2. Adapter calls:                                          │
│       LaunchpadEngine.tradePositions(                       │
│         market, outcome, -shares, minProceeds               │
│       )                                                     │
│                                                             │
│  3. Core protocol:                                          │
│     → LMSR proceeds calculation                             │
│     → Fee deduction                                         │
│     → Proceeds LOCKED for 24 hours (lock-on-sell)           │
│     → Locked funds immediately spendable for other trades   │
│     → After 24h: withdrawable to wallet                     │
│                                                             │
│  NOTE: Lock-on-sell is a core protocol feature that the     │
│  monolithic v1.0 SoothPostAction did not implement.         │
│  By delegating to core, we get it automatically.            │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Resolve Market

**Who**: Adjudicator (set at market creation — can be creator, oracle contract, or agent)
**Precondition**: Market exists, not yet settled

```
┌─────────────────────────────────────────────────────────────┐
│                     RESOLVE FLOW                            │
│                                                             │
│  1. Execute Post Action with action=RESOLVE                 │
│     params: outcome (0=NO, 1=YES, 2=INVALID)               │
│                                                             │
│  2. Adapter looks up TruthMarket for this post              │
│     Calls: TruthMarket.settle(outcome, tStar)              │
│                                                             │
│  3. TruthMarket:                                            │
│     → Verifies caller is adjudicator                        │
│     → Sets winningOutcome                                   │
│     → Enters settling state                                 │
│     → After finalization: isFinalized() = true              │
│                                                             │
│  4. All venues (AMM, SoothBook) check                       │
│     TruthMarket.isLive() → false, stop trading              │
│                                                             │
│  NOTE: Resolution uses the pull-based lifecycle model.      │
│  TruthMarket is the single source of truth. No callbacks.   │
└─────────────────────────────────────────────────────────────┘
```

### 5.5 Redeem Winnings

**Who**: Users holding winning outcome tokens
**Precondition**: Market is finalized

```
┌─────────────────────────────────────────────────────────────┐
│                      REDEEM FLOW                            │
│                                                             │
│  1. Execute Post Action with action=REDEEM                  │
│                                                             │
│  2. Adapter calls:                                          │
│       Collateralizer.redeem(market, amount)                 │
│                                                             │
│  3. Collateralizer:                                         │
│     → Checks TruthMarket.isFinalized()                      │
│     → Burns winning outcome tokens (ERC-20)                 │
│     → Transfers WGHO to user (1 token = 1 WGHO)            │
│     → INVALID outcome: 50% payout on both sides             │
│                                                             │
│  NOTE: Outcome tokens are real ERC-20s from the             │
│  Collateralizer, not internal mappings. They can be         │
│  transferred, used as collateral elsewhere, etc.            │
└─────────────────────────────────────────────────────────────┘
```

### 5.6 Direct Trading (Bypassing Lens)

**Who**: Any on-chain user (no Lens account needed)
**Precondition**: Market exists on-chain

Because the core protocol is deployed directly on Lens Chain, users can interact with it without going through the Lens adapter:

```
┌─────────────────────────────────────────────────────────────┐
│                   DIRECT TRADING                            │
│                                                             │
│  External trader (no Lens account):                         │
│                                                             │
│  • Read prices:  AMMEngine.getMarketState(market)           │
│  • Buy/sell:     LaunchpadEngine.tradePositions(...)        │
│  • Limit orders: SoothBook.placeOrder(...)  (graduated)     │
│  • Redeem:       Collateralizer.redeem(...)                  │
│                                                             │
│  The Lens adapter is one entry point, not the only one.     │
│  Graduated markets are fully accessible to the broader      │
│  crypto trading ecosystem.                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Market Lifecycle & Graduation

Markets follow the standard Sooth Core lifecycle. The Lens Post Action adapter does not alter it.

### Phase 1: LMSR Social Market (Bonding)

- Creator posts on Lens → adapter calls `LaunchpadEngine.createMarket()`
- LMSR provides instant automated pricing (starts at 50/50)
- Trading fees accrue toward graduation threshold
- Pre-graduation fees: 5% → bBase growth + LP tokens minted to trader
- 7-day trial period starts

### Phase 2: Graduated Orderbook

When fees reach the threshold (`b × ln(2) × multiplier`):

- LaunchpadEngine marks the market as graduated
- SoothBook orderbook opens — limit orders available
- Post-graduation fees: 1% → 50% bBase / 30% LP yield / 20% protocol
- **Any on-chain user** can trade — not just Lens users
- The Lens post remains the social hub (comments, reactions, reposts)

```
┌───────────────────────────────────────────────────────────┐
│                   MARKET LIFECYCLE                         │
│                                                           │
│  Lens Post + SoothLensAdapter                             │
│       │                                                   │
│       ▼                                                   │
│  ┌─────────────────────────────┐                          │
│  │  Phase 1: LMSR AMM          │                          │
│  │  (LaunchpadEngine + AMM)    │  Lens-native users       │
│  │  • Automated pricing        │  5% fees → graduation    │
│  │  • LP tokens to traders     │  7-day trial period      │
│  │  • Social predictions       │                          │
│  └──────────────┬──────────────┘                          │
│                 │                                         │
│    fees >= b × ln(2) × multiplier?                        │
│       NO + trial ended → creator can dismiss (refunds)    │
│       NO + graduated   → cannot dismiss (traders safe)    │
│       YES ↓                                               │
│                 │                                         │
│  ┌──────────────▼──────────────┐                          │
│  │  Phase 2: SoothBook         │                          │
│  │  (Orderbook + AMM)          │  Open to ALL traders     │
│  │  • Limit orders             │  1% fees, split 3 ways   │
│  │  • Cross-platform access    │  Deeper liquidity        │
│  │  • Pro trading UX           │                          │
│  └─────────────────────────────┘                          │
│                                                           │
│  Lens post remains the social hub throughout.             │
│  External traders discover markets via SoothBook           │
│  or the Sooth web app → pulled into Lens ecosystem.       │
└───────────────────────────────────────────────────────────┘
```

### Trial Period

New markets enter a **7-day trial period** (managed by LaunchpadEngine):

- If the market **graduates** during the trial, it continues. Creator cannot dismiss.
- If the market **has not graduated** after the trial, the creator can dismiss and refund all participants.
- This protects traders from abandoned or low-quality markets.

### What the v1.0 monolithic SoothPostAction was missing

| Core Feature | v1.0 Status | v2.0 (core delegation) |
|---|---|---|
| Graduation | "Phase 4 future work" | Built-in from day one |
| SoothBook orderbook | Not available | Activates on graduation |
| LP tokens | None | Minted to traders pre-graduation |
| Lock-on-sell (24h) | None | Core protocol enforces |
| Trial period + dismiss/refund | None | Core protocol enforces |
| Outcome tokens (ERC-20) | Internal mappings | Real transferable tokens |
| Fee splitting (bBase/LP/protocol) | Flat treasury send | Full 3-way split post-graduation |
| ProtocolConfig (pause/guardians) | None | Core protocol provides |

---

## 7. Post Metadata Schema

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
| `sooth.oracle_type` | string | No | `"creator"` / `"chainlink"` / `"uma"` |
| `sooth.category` | string | No | Market category |
| `sooth.outcome_yes_label` | string | No | Custom YES label |
| `sooth.outcome_no_label` | string | No | Custom NO label |

---

## 8. Market Discovery & On-Chain Reads

Markets are found by querying Lens posts filtered by the `sooth-market` tag. On-chain state is read directly from core contracts, not from the adapter.

```typescript
import { fetchPosts } from "@lens-protocol/client/actions";

// Discover markets via Lens
const markets = await fetchPosts(client, {
  filter: {
    metadata: {
      tags: { oneOf: ["sooth-market"] }
    }
  }
});
```

For each discovered post, read on-chain state from **core contracts**:

```typescript
// 1. Get the TruthMarket address for this post
const market = await readContract({
  address: SOOTH_LENS_ADAPTER,
  abi: adapterABI,
  functionName: "marketOf",
  args: [feedAddress, postId]
});

// 2. Read AMM state (price, inventory) from AMMEngine
const { qYes, qNo, price } = await readContract({
  address: AMM_ENGINE,
  abi: ammEngineABI,
  functionName: "getMarketState",
  args: [market]
});

// 3. Read user position from AMMEngine
const [yesShares, noShares] = await readContract({
  address: AMM_ENGINE,
  abi: ammEngineABI,
  functionName: "getPosition",
  args: [market, userAddress]
});

// 4. Read graduation progress from LaunchpadEngine
const { feesAccrued, threshold, progressBps } = await readContract({
  address: LAUNCHPAD_ENGINE,
  abi: launchpadABI,
  functionName: "getGraduationProgress",
  args: [market]
});

// 5. Quote a trade from AMMEngine
const { cost, newPrice } = await readContract({
  address: AMM_ENGINE,
  abi: ammEngineABI,
  functionName: "getPositionQuote",
  args: [market, 1, 10n * 10n**18n]  // YES, 10 shares
});
```

---

## 9. WGHO Approval Strategy

Users approve WGHO for the ActionHub (which forwards to the adapter, which forwards to core contracts).

| Flow | Approval Target | When |
|------|----------------|------|
| Create market | ActionHub | Before `post()` — creator deposit: `b × ln(2)` |
| Buy shares | ActionHub | Before `executePostAction()` — trade cost |
| Sell shares | None needed | Proceeds locked in AMMEngine (24h) |
| Resolve | None needed | No token transfer |
| Redeem | None needed | Collateralizer sends WGHO to user |

**Recommended UX**: Prompt for infinite approval on first interaction.

```typescript
import { prepareSignerErc20Approval } from "@lens-protocol/client/viem";

const allowance = await readContract({
  address: WGHO,
  abi: erc20Abi,
  functionName: "allowance",
  args: [userAddress, ACTION_HUB]
});

if (allowance < totalCost) {
  await prepareSignerErc20Approval(sessionClient, {
    approval: { infinite: evmAddress(ACTION_HUB) }
  }).andThen(handleOperationWith(walletClient));
}
```

---

## 10. Cross-Client Compatibility

Because Sooth markets are standard Lens posts, they appear in **every Lens client**:

| Client | What Users See |
|--------|---------------|
| **Sooth App** | Full trading UI — prices, charts, buy/sell, portfolio, graduation progress |
| **Orb** | Article post with market description. Unknown action button. |
| **Hey** | Article post. Can see comments/reactions but no trading UI |
| **Firefly** | Article post. If Firefly adds Sooth plugin, full trading UI |
| **Direct (no Lens)** | Trade via LaunchpadEngine/SoothBook directly on-chain |

---

## 11. Event-Driven Indexing

Events come from the **core contracts**, not the adapter. The existing Sooth indexer (Ponder) can be extended to Lens Chain.

| Event | Source Contract | Use |
|-------|---------------|-----|
| `MarketCreated` | LaunchpadEngine | New market discovery |
| `PositionTraded` | AMMEngine | Trade feed, price history |
| `MarketGraduated` | LaunchpadEngine | Graduation notifications |
| `MarketSettled` | TruthMarket | Resolution display |
| `OrderPlaced` / `OrderFilled` | SoothBook | Orderbook activity (post-graduation) |

The adapter emits a lightweight `PostLinked(feed, postId, market)` event to link Lens posts to core markets.

**Indexing options:**
1. **Ponder** (existing Sooth indexer) — add Lens Chain as a new network
2. **The Graph subgraph** — deploy to Lens Chain
3. **Direct RPC polling** — for MVP, poll events with `eth_getLogs`

---

## 12. Gasless UX (Sponsorships)

Lens Sponsorships allow apps to pay gas on behalf of users:

```typescript
await fundSponsorship(sessionClient, {
  app: evmAddress(SOOTH_APP),
  amount: "500" // GHO
});
```

| Action | User Pays Gas? | User Pays WGHO? |
|--------|---------------|-----------------|
| Create market (post + configure) | No (sponsored) | YES (creator deposit) |
| Buy shares | No (sponsored) | YES (trade cost) |
| Sell shares | No (sponsored) | No (receives proceeds after 24h) |
| Resolve market | No (sponsored) | No |
| Redeem winnings | No (sponsored) | No (receives WGHO) |
| ERC20 approve | No (sponsored) | No |

On testnet, Lens provides a global sponsorship fallback. On mainnet, the Sooth app must fund its own pool.

---

## 13. Security Considerations

| Risk | Mitigation |
|------|-----------|
| Creator rug (resolve wrong outcome) | TruthMarket adjudicator pattern + social reputation. Future: dispute mechanism via guardians. |
| Flash loan price manipulation | LMSR is manipulation-resistant (cost increases superlinearly) |
| Reentrancy | Core contracts have ReentrancyGuard on all state-changing functions |
| Unauthorized resolution | TruthMarket enforces `onlyAdjudicator` |
| Stale approvals | `maxCost` slippage parameter on buys |
| Front-running | Lens Chain L2 has sequencer ordering. Low risk vs L1. |
| Adapter compromise | Adapter has no funds, no market state. Worst case: it stops routing. Core contracts remain independently accessible. |
| Protocol pause | ProtocolConfig allows guardians to pause in emergencies |

---

## 14. Implementation Phases

### Phase 1: Core Deployment to Lens Chain
- [ ] Verify all core contracts compile under zksolc (`forge build --zksync`)
- [ ] Deploy full Sooth Core to Lens testnet (chain 37111): LaunchpadEngine, AMMEngine, Collateralizer, SoothBook, ProtocolConfig
- [ ] Verify deployment with `verify-deployment.sh`
- [ ] Register in `packages/registry/nodes.json` under chain 37111

### Phase 2: Lens Adapter
- [ ] Write `SoothLensAdapter` (~150 lines, IPostAction → core delegation)
- [ ] Unit tests for param decoding + delegation
- [ ] Deploy adapter to Lens testnet
- [ ] E2E test: create post → configure → buy → sell → resolve → redeem

### Phase 3: Frontend Integration
- [ ] Update `apps/lens` to read from core contracts (not monolithic SoothPostAction)
- [ ] Market detail page reads AMMEngine, LaunchpadEngine, TruthMarket
- [ ] Trade panel routes through Lens adapter (executePostAction)
- [ ] Graduation progress bar from `getGraduationProgress()`
- [ ] Portfolio page from `AMMEngine.getPosition()`

### Phase 4: Social Integration
- [ ] Market feed via `fetchPosts()` with `sooth-market` tag
- [ ] Link Lens post metadata to on-chain market via adapter's `marketOf` mapping
- [ ] Comments on market posts (discussion)
- [ ] Reactions as sentiment signals
- [ ] User profile with prediction history

### Phase 5: Mainnet + Advanced
- [ ] Deploy core + adapter to Lens mainnet (chain 232, WGHO collateral)
- [ ] Sponsorships for gasless first trade
- [ ] Multiple oracle types (Chainlink, UMA, social consensus)
- [ ] Agent oracle framework (AI agents as market creators + resolvers)
- [ ] Leaderboard (accuracy + P&L tracking)

---

## 15. Key Constants

| Constant | Value | Notes |
|----------|-------|-------|
| WGHO (Lens mainnet) | `0x6bDc36E20D267Ff0dd6097799f82e78907105e2F` | 18 decimals |
| WGRASS (Lens testnet) | `0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8` | 18 decimals |
| ActionHub (mainnet) | `0xc6D57Ee750Ef2ee017a9E985A0C4198bEd16A802` | All actions route through here |
| ActionHub (testnet) | `0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11` | |
| Global Feed (mainnet) | `0xcB5E109FFC0E15565082d78E68dDDf2573703580` | |
| Global Feed (testnet) | `0x31232Cb7dE0dce17949ffA58E9E38EEeB367C871` | |
| Lens Chain ID | `232` (mainnet) / `37111` (testnet) | ZKsync L2 |
| Outcome NO | `0` | |
| Outcome YES | `1` | |
| Outcome INVALID | `2` | 50/50 split |
| Pre-grad fee | 500 bps (5%) | → bBase growth + LP mint |
| Post-grad fee | 100 bps (1%) | → 50/30/20 split |
| Trial period | 7 days (604800s) | Dismiss only after trial + if not graduated |
| Graduation threshold | `b × ln(2) × multiplier` | Default multiplier = 1 |

---

## 16. Contracts: Existing (Retire) vs New (Build)

| Contract | Status | Action |
|---|---|---|
| `SoothPostAction.sol` (monolithic, 510 lines) | Deployed on testnet `0x7ADC…f84` | **Retire** — does not match architecture |
| `SoothLensAdapter.sol` (thin wrapper, ~150 lines) | Not yet written | **Build** — translates IPostAction → core |
| LaunchpadEngine, AMMEngine, Collateralizer, SoothBook, ProtocolConfig | Deployed on Base Sepolia + Monad | **Deploy** to Lens Chain (same code, WGHO collateral) |

---

*End of spec. See also:*
- *[LENS_PREDICTION_MARKETS.md](LENS_PREDICTION_MARKETS.md) — research notes on Orb + Sooth implementation*
- *[LENS_API_REVIEW.md](LENS_API_REVIEW.md) — full Lens V3 API review*
- *[FIREFLY_LENS_SPEC.md](FIREFLY_LENS_SPEC.md) — Firefly plugin spec (original architectural vision)*
- *[DEPLOYMENT_HANDOFF.md](DEPLOYMENT_HANDOFF.md) — ZKsync toolchain + deployment steps*
