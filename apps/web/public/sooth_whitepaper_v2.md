# Sooth Protocol V2
## The Permissionless Prediction Market Launchpad

---

> *"Trade smarter. Predict better. Win bigger."*

---

## Executive Summary

Sooth Protocol is a **fully on-chain prediction market infrastructure** that combines the best of AMM liquidity with orderbook price discovery. Our thesis: **decentralization creates better markets**.

### The Sooth Advantage

| Dimension | Traditional Platforms | Sooth Protocol |
|-----------|----------------------|----------------|
| **Market Creation** | Gatekept, slow approval | Permissionless, instant |
| **Liquidity** | Fragmented per market | Unified vault + dual venue |
| **Settlement** | Centralized oracle | Multi-class + ZK attestation |
| **Price Discovery** | AMM-only or off-chain | On-chain AMM + Orderbook |
| **LP Economics** | Static fees | Dynamic graduation + yield |
| **Trader Protection** | None | 7-day trial period |

### Key Metrics Target

| Metric | Target |
|--------|--------|
| Markets Created | 1,000+ in Year 1 |
| Total Volume | $100M+ |
| Active Traders | 50,000+ |
| LP Yield | 15-30% APY |

---

## 1. The Problem

### 1.1 Traditional Prediction Markets Are Broken

**High Slippage**
Traditional AMMs punish large trades with massive price impact. A $10,000 trade can move prices 5-10%, destroying edge.

**Illiquid Markets**
Low liquidity means poor prices and stuck positions. Traders can't exit without significant loss.

**No Real Price Discovery**
AMM-only systems can't find true market clearing prices. The "wisdom of crowds" gets distorted by curve mechanics.

**Centralized Control**
Gatekeepers decide which markets exist. Settlement depends on single oracles. Users have no recourse when things go wrong.

### 1.2 The Decentralization Opportunity

| Platform | Creation | Resolution | Price Discovery |
|----------|----------|------------|-----------------|
| Polymarket | Gatekept | UMA oracle | Off-chain matching |
| Kalshi | Regulated | Centralized | Centralized CLOB |
| Omen | Open | Reality.eth | Per-market AMM |
| **Sooth** | **Permissionless** | **Multi-class + ZK** | **On-chain AMM + CLOB** |

---

## 2. The Sooth Solution

### 2.1 Dual Venue Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DUAL VENUE DESIGN                         │
├─────────────────────────────┬───────────────────────────────┤
│         AMM (Retail)        │       TickBook (Pro)          │
├─────────────────────────────┼───────────────────────────────┤
│ LMSR market maker           │ Limit orderbook               │
│ Always-on liquidity         │ Zero slippage                 │
│ One-click trading           │ Professional execution        │
│ LP yield opportunities      │ Maker-taker spreads           │
│ 24h sell lock (proceeds)    │ Instant settlement            │
└─────────────────────────────┴───────────────────────────────┘
```

**Best of both worlds. Unified in one protocol.**

### 2.2 The Three Pillars

| Pillar | Innovation | User Benefit |
|--------|------------|--------------|
| **Launchpad** | Permissionless creation + creator economics | Anyone can create markets and earn |
| **Dual Venue** | AMM + Orderbook unified execution | Best price, always |
| **ZK Settlement** | Trustless resolution via attestation | Truth without trust |

---

## 3. Pillar I: The Launchpad

### 3.1 Permissionless Market Creation

Anyone can create a prediction market by depositing collateral. The creator becomes the first LP, aligning incentives from day one.

**Creator Deposit Formula:**
```
deposit = liquidity × ln(2) ≈ liquidity × 0.693

Examples:
$1,000 liquidity tier → $693 deposit
$10,000 liquidity tier → $6,930 deposit
```

### 3.2 The Graduation Mechanism

Markets evolve through two phases:

| Phase | Fee | Who Benefits | Purpose |
|-------|-----|--------------|---------|
| **Bonding** | 5% | Traders (LP mint) + Depth | Bootstrap liquidity |
| **Graduated** | 1% | 50% LP · 30% Yield · 20% Protocol | Sustainable growth |

**Graduation triggers when:**
```
fees_accrued >= deposit × 2
```

When a market graduates:
- TickBook orderbook activates
- ERC20 LP tokens become transferable
- Lower fees attract higher volume

### 3.3 Creator Economics

| Event | Creator Impact |
|-------|----------------|
| Market created | -$693 deposit (for $1,000 tier) |
| Trading generates fees | +LP tokens minted |
| Market graduates | Unlocks yield stream |
| Market settles profitably | +Share of vault assets |

**Example:**
> Carol creates "Protocol X hacked?" with $693 deposit.
> - $3,000 volume generates $150 fees (5%)
> - Market graduates after $1,386 fees
> - Carol holds 50% LP → Claims ~$1,500 at settlement
> - **Net P&L: +$807** (even without trading)

### 3.4 Gaming Trader Rewards

Early traders who pay fees receive LP tokens, converting them from customers into stakeholders.

```
Trader pays 5% fee on $100 trade = $5
→ $5 adds to liquidity depth
→ $5 worth of LP tokens minted TO THE TRADER
→ Trader now earns from future activity
```

| Scenario | Traditional | Sooth |
|----------|-------------|-------|
| Win prediction | +Payout | +Payout + LP tokens |
| Lose prediction | -Stake | -Stake + LP recovery |
| Market goes viral | Nothing | LP tokens appreciate |

---

## 4. Pillar II: Dual Venue Trading

### 4.1 LMSR AMM Engine

The Logarithmic Market Scoring Rule provides:
- **Continuous liquidity** at any price
- **Bounded loss** for liquidity providers
- **Numerical stability** via log-sum-exp trick

**Price Formula:**
```
P(YES) = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
```

Where:
- `qYes`, `qNo` = inventory positions
- `b` = liquidity depth parameter

### 4.2 TickBook Orderbook

The on-chain central limit order book provides:
- **1,000 price ticks** (0.1% to 99.9%)
- **Two-level bitmap** for O(1) best price discovery
- **Unified crossing** with spot-first execution
- **Flash accounting** via EIP-1153 transient storage

**Crossing Logic:**
```
YES_tick + NO_tick >= 1000 → Orders cross

Example:
YES bid at 440 (44%) + NO ask at 580 (58% for NO = 42% for YES)
440 + 580 = 1020 >= 1000 → CROSS at market-clearing price
```

### 4.3 Arbitrage Keeps Prices Tight

```
Scenario: Price divergence detected
├─ AMM: YES = 62%
├─ TickBook: YES ask = 58%
└─ Arbitrage:
   → Buy YES on TickBook at 58¢
   → Sell YES on AMM at 62¢
   → Pocket 4¢ per share (risk-free)
   → Prices converge
```

**Everyone benefits:**
- Arbitrageurs profit from inefficiencies
- All traders get better prices
- LPs earn fees from volume

---

## 5. Pillar III: ZK Settlement (V11)

### 5.1 The ValidatedAdjudicator

V11 introduces **Zero-Knowledge (ZK) attestation** for trustless settlement via ERC-8004.

```
┌─────────────────────────────────────────────────────────────┐
│                   ZK SETTLEMENT FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ZK Agent ──► Generate Attestation ──► Submit to Contract  │
│       │                                         │            │
│       │         ┌─────────────────────┐        │            │
│       └────────►│ ERC-8004 Registry   │◄───────┘            │
│                 │ - Identity          │                      │
│                 │ - Reputation        │                      │
│                 │ - Validation        │                      │
│                 └─────────────────────┘                      │
│                          │                                   │
│                          ▼                                   │
│                 ┌─────────────────────┐                      │
│                 │ ValidatedAdjudicator│                      │
│                 │ verifyAndSettle()   │                      │
│                 └─────────────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Multi-Class Adjudicators

| Class | Use Case | Trust Model |
|-------|----------|-------------|
| **ZK Validated** | Objective facts | Zero-knowledge proof |
| **Optimistic** | Subjective events | Challenge period |
| **ZK Rule** | On-chain conditions | Pure smart contract |
| **Oracle+ZK** | Price thresholds | Chainlink + ZK proof |

### 5.3 The T* Mechanism

Adjudicators report not just **what** happened, but **when** (T*). This enables retroactive settlement:

```
Timeline:
├─ 14:00:00 — Event occurs (T* = this moment)
├─ 14:00:05 — News breaks
├─ 14:00:10 — Trader exploits stale price
├─ 14:00:30 — Settlement: "YES, T* = 14:00:00"
└─ Result: Post-T* trades rewound
   → Exploiter receives refund, not windfall
   → LPs protected from latency attacks
```

---

## 6. Trader Protection: Trial Period (V11)

### 6.1 7-Day Safety Window

New markets enter a **trial period** where:
- Creator can **dismiss** the market if something's wrong
- Traders receive **full refunds** of locked costs
- No penalty for early exit

```solidity
struct TrialState {
    uint64 trialEndTime;      // 7 days from creation
    bool isDismissed;         // Creator can abort
    uint256 totalLockedCost;  // Refundable amount
}
```

### 6.2 Why Trial Period Matters

| Scenario | Without Trial | With Trial Period |
|----------|---------------|-------------------|
| Ambiguous question | Traders stuck | Creator dismisses, full refund |
| Market manipulation | Losses realized | Early detection, abort |
| Technical issue | Stuck funds | Clean exit for everyone |

### 6.3 Trial Period Flow

```
CREATE ──► TRIAL (7 days) ──► LIVE ──► SETTLED
              │
              │ Creator detects issue
              ▼
          DISMISSED ──► Traders claim refunds
```

---

## 7. LP Token Economics (V11)

### 7.1 ERC20 LP Tokens

V11 introduces **transferable LP tokens** via LaunchpadLPToken:

| Phase | Token Behavior |
|-------|----------------|
| **Pre-Settlement** | Freely transferable |
| **Post-Settlement** | Locked (must redeem directly) |

### 7.2 LP Valuation Model

```
Floor = Cash - max(qYes, qNo)    ← Guaranteed minimum
Ceiling = Cash - min(qYes, qNo)  ← Best case
ExRate = Floor / LP_Supply       ← Redemption rate
```

### 7.3 LP Revenue Streams

| Source | Pre-Graduation | Post-Graduation |
|--------|----------------|-----------------|
| **Swap Fees** | → Depth growth | 50% → Depth |
| **LP Yield** | — | 30% → LP holders |
| **Protocol** | — | 20% → Treasury |

---

## 8. Technical Architecture

### 8.1 Contract Graph (V11)

```
                    ┌─────────────────┐
                    │ ProtocolConfig  │  Guardian + Pause
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│LaunchpadEngine  │ │TickBookPoolMgr  │ │  Collateralizer │
│  + LPToken      │ │Unified Crossing │ │  Split/Merge    │
└────────┬────────┘ └─────────────────┘ └─────────────────┘
         │
         ▼
┌─────────────────┐
│   AMMEngine     │  LMSR + 24h Locks
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  TruthMarket    │◄────│ValidatedAdj     │  ZK Settlement
│  Lifecycle Auth │     │  ERC-8004       │
└─────────────────┘     └─────────────────┘
```

### 8.2 Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Domain Isolation** | AMM and TickBook don't share state |
| **Pull-Based Lifecycle** | Venues query TruthMarket |
| **No Custody** | Users keep funds until trade |
| **Pure WAD Math** | All internal math uses 18 decimals |
| **Gas Optimized** | EIP-1153 flash accounting |

### 8.3 Key Interfaces

**LaunchpadEngine (Retail)**
```solidity
function createMarket(
    address market,
    address creator,
    uint256 bBase,
    address adjudicator,
    uint256 agentId,
    uint256 minValidators
) external returns (uint256 requiredDeposit);

function tradePositions(
    address market,
    uint8 outcome,      // 0=NO, 1=YES
    int256 deltaShares,
    uint256 maxCost
) external returns (uint256 actualCost);
```

**TickBookPoolManager (Pro)**
```solidity
function placeOrder(
    bytes32 marketKey,
    uint8 outcome,
    uint16 tickLower,
    uint16 tickUpper,
    uint128 shares,
    address recipient
) external returns (uint256 orderId);
```

**ValidatedAdjudicator (Settlement)**
```solidity
function settleWithAttestation(
    address market,
    uint8 outcome,
    uint64 tStar,
    bytes calldata attestation
) external;
```

---

## 9. Two Trader Archetypes

### 9.1 The Retail Trader

| Dimension | Description |
|-----------|-------------|
| **Profile** | Retail users, hedgers, speculators |
| **Entry** | `LaunchpadEngine.tradePositions()` |
| **Asset** | Non-transferable positions |
| **Liquidity** | LMSR (always available) |
| **Constraint** | 24h lock on sell proceeds |
| **Reward** | Fee → LP token conversion |

**Journey:**
1. Discover promising market
2. Trade during bonding phase (5% fee → LP tokens)
3. Win on prediction AND/OR LP appreciation

### 9.2 The Pro Trader

| Dimension | Description |
|-----------|-------------|
| **Profile** | Market makers, arbitrageurs, bots |
| **Entry** | `Collateralizer.split()` → TickBook |
| **Asset** | Transferable ERC20 tokens |
| **Liquidity** | Limit orderbook |
| **Constraint** | None (instant) |
| **Reward** | Spread capture, arbitrage |

**Journey:**
1. Mint tokens: 1 USDC → 1 YES + 1 NO
2. Place limit orders at desired prices
3. Capture spreads, arbitrage AMM ↔ TickBook
4. Redeem winners after settlement

### 9.3 Why Two Venues?

| Need | AMM | TickBook |
|------|-----|----------|
| Guaranteed liquidity | ✅ | ❌ |
| Precise pricing | ❌ | ✅ |
| Large orders | ❌ (slippage) | ✅ |
| Instant execution | ✅ | ❌ (wait for fill) |
| API trading | Basic | Full |
| Retail simplicity | ✅ | ❌ |

---

## 10. Market Lifecycle

```
┌──────────┐   7 days    ┌──────────┐   activate   ┌──────────┐
│ CREATED  │────────────►│  TRIAL   │─────────────►│   LIVE   │
└──────────┘             └──────────┘              └──────────┘
     │                        │                         │
     │                        │ dismiss()               │ deadline
     │                        ▼                         ▼
     │                   ┌──────────┐             ┌──────────┐
     │                   │DISMISSED │             │ SETTLING │
     │                   └──────────┘             └──────────┘
     │                        │                         │
     │                        │ claimRefund()           │ settle()
     │                        ▼                         ▼
     │                   [Refunded]                ┌──────────┐
     │                                            │ SETTLED  │
     │                                            └──────────┘
     │                                                  │
     │                                                  │ veto window
     │                                                  ▼
     │                                            ┌──────────┐
     │                                            │FINALIZED │
     │                                            └──────────┘
     │                                                  │
     └────────────────────────────────────────────────►│
                                                       ▼
                                                  [Complete]
```

---

## 11. Competitive Landscape

### 11.1 Feature Comparison

| Feature | Polymarket | Kalshi | Sooth |
|---------|------------|--------|-------|
| Permissionless creation | ❌ | ❌ | ✅ |
| On-chain orderbook | ❌ | ❌ | ✅ |
| LP rewards for traders | ❌ | ❌ | ✅ |
| Creator economics | ❌ | ❌ | ✅ |
| Trial period protection | ❌ | ❌ | ✅ |
| ZK settlement | ❌ | ❌ | ✅ |
| Dual venue execution | ❌ | ❌ | ✅ |

### 11.2 Market Positioning

```
                    High Decentralization
                           │
                           │     ★ SOOTH
                           │
              Omen ●       │
                           │
    Low ───────────────────┼─────────────────── High
    Liquidity              │                Liquidity
                           │
                           │    ● Polymarket
                           │
                ● Augur    │         ● Kalshi
                           │
                    Low Decentralization
```

---

## 12. Roadmap

### Phase 1: Foundation (Complete)
- [x] LMSR AMM Engine
- [x] Launchpad with graduation
- [x] Basic settlement

### Phase 2: V11 Launch (Current)
- [x] TickBook orderbook
- [x] Unified crossing
- [x] Trial period protection
- [x] ZK settlement (ValidatedAdjudicator)
- [x] ERC20 LP tokens
- [ ] Multi-chain deployment

### Phase 3: Scale
- [ ] Cross-chain markets
- [ ] Advanced adjudicator plugins
- [ ] Mobile app
- [ ] Governance token

### Phase 4: Ecosystem
- [ ] Market maker partnerships
- [ ] API for third-party integrations
- [ ] SDK for custom frontends
- [ ] Institutional features

---

## 13. Team

Building at the intersection of DeFi and prediction markets.

*[Team details to be added]*

---

## 14. Conclusion

Sooth Protocol proves that **decentralization is a competitive advantage**, not a compromise.

| Traditional | Sooth |
|-------------|-------|
| Gatekept creation | Permissionless launchpad |
| Single oracle | Multi-class + ZK |
| Off-chain matching | On-chain CLOB |
| Extractive fees | Fee → LP conversion |
| No protection | 7-day trial period |
| One venue | Dual venue execution |

**The result:** A prediction market infrastructure where:
- **Creators** earn from market success
- **Traders** get LP rewards for participation
- **Arbitrageurs** keep prices efficient
- **Everyone** is protected by trial periods and trustless settlement

*When every participant has aligned incentives, the protocol doesn't need gatekeepers. Truth emerges from the market itself.*

---

## Appendix A: Technical Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `DEFAULT_TRIAL_PERIOD` | 7 days | New market protection |
| `PRE_GRAD_FEE_BPS` | 500 (5%) | Bonding phase fee |
| `POST_GRAD_FEE_BPS` | 100 (1%) | Graduated market fee |
| `GRADUATION_MULTIPLIER` | 2 | Fees needed = 2× deposit |
| `LOCK_DURATION` | 24 hours | AMM sell lock |
| `ATTESTATION_WINDOW` | 1 hour | ZK attestation validity |

## Appendix B: Outcome Encoding

| Value | Meaning |
|-------|---------|
| `0` | NO |
| `1` | YES |
| `2` | INVALID (50% payout) |

## Appendix C: Error Codes

| Error | Cause |
|-------|-------|
| `MarketNotLive` | Trading on inactive market |
| `SlippageExceeded` | Price moved beyond limit |
| `InTrialPeriod` | Action blocked during trial |
| `MarketDismissed` | Creator dismissed market |
| `AttestationInvalid` | ZK attestation failed |
| `TransfersLocked` | LP tokens locked post-settlement |

---

**Version:** 2.0 (V11 Architecture)
**Updated:** January 2026

---

**Resources:**
- Website: [sooth.market](https://sooth.market)
- Documentation: [docs.sooth.market](https://docs.sooth.market)
- Twitter: [@soothprotocol](https://twitter.com/soothprotocol)
