# Sooth Protocol — Seed Pitch Deck
*$2M Seed Round*

---

## Slide 1: Cover

**SOOTH**
The Permissionless Prediction Market Launchpad

Seed Round · $2M
sooth.market

---

## Slide 2: Problem

**Prediction markets are centralized at every layer.**

| Layer | Polymarket | Kalshi |
|-------|-----------|--------|
| Market Creation | Gatekept | Gatekept |
| Liquidity | Hybrid (off-chain matching) | Centralized |
| Settlement | Centralized oracle (UMA) | Centralized |
| Price Discovery | Off-chain orderbook | Centralized CLOB |

**Result:**
- Only ~500 markets exist on Polymarket despite billions in volume
- Creators have zero economic upside
- Traders are customers, not stakeholders
- Settlement is a single point of failure

**$50B+ traded on prediction markets in 2025 — through centralized bottlenecks.**

---

## Slide 3: Solution

**Sooth decentralizes every layer of the prediction market stack.**

A permissionless launchpad where anyone can create, trade, and settle prediction markets — with aligned incentives at every step.

**Three Pillars:**

1. **Launchpad** — Permissionless market creation with creator economics. Creators deposit capital, earn fees, become the first LP.

2. **ZK Rules** — Trustless settlement via retroactive finality (T*). No centralized oracle dependency. Multiple adjudicator classes.

3. **TickBook** — On-chain CLOB with 10,000-tick depth. CEX-grade execution, fully on-chain.

---

## Slide 4: Why Now

1. **Prediction markets proven** — Polymarket did $9B+ in 2024 US election volume alone. Category is real.

2. **On-chain infrastructure ready** — High-throughput L2s (Base, Monad, MegaETH) make on-chain orderbooks viable for the first time.

3. **AI agents need markets** — Autonomous agents need permissionless prediction infrastructure to express views, hedge risk, and coordinate. No human gatekeeper can approve markets fast enough.

4. **Regulatory tailwinds** — CFTC evolving stance on prediction markets. Decentralized = compliant by architecture.

---

## Slide 5: How It Works

### Dual Venue Architecture

```
┌─────────────────────┬──────────────────────┐
│    AMM (Retail)      │    TickBook (Pro)     │
├─────────────────────┼──────────────────────┤
│ One-click trading    │ Limit orderbook       │
│ LMSR guaranteed      │ 10K-tick depth        │
│ Fee → LP tokens      │ Maker-taker spreads   │
│ Retail-friendly      │ API-first, bot-ready  │
└─────────────────────┴──────────────────────┘
         ↕ Arbitrage keeps prices aligned ↕
```

**Market Lifecycle:**
1. Creator deposits capital → market goes live
2. Internal phase: 5% fees mint LP tokens to traders (stakeholder conversion)
3. Graduation: fees drop to 1%, TickBook activates
4. Settlement: Adjudicator reports outcome + T* → ZK-verified rewind

---

## Slide 6: The Innovation — Aligned Incentives

**Traditional:** Creator creates market → platform earns fees → traders are customers

**Sooth:** Creator creates market → earns fees as LP → traders earn LP tokens → everyone is a stakeholder

| Actor | Incentive | Alignment |
|-------|-----------|-----------|
| Creator | Deposit capital, earn ongoing LP yield | Promotes market growth |
| Gaming Trader | Fees convert to LP tokens | Even losing bets earn LP upside |
| Arbitrageur | Capture cross-venue spreads | Tightens prices for everyone |
| PvP Trader | Direct conviction trading on TickBook | Pure price discovery |

**Key insight:** A trader who loses their prediction can still profit if the market attracted enough volume — their fee-converted LP tokens appreciate.

---

## Slide 7: Settlement Innovation — T* Retroactive Finality

**The problem:** When news breaks, fast bots exploit stale AMM prices before markets update. LPs bleed value.

**Sooth's solution:** Adjudicators report not just the outcome, but *when it became true* (T*). Trades after T* are rewound.

```
14:00:00 — BTC crosses $100K (T* = this moment)
14:00:05 — News breaks
14:00:10 — Bot buys YES at 60¢ (exploit attempt)
14:00:30 — Adjudicator: "YES, T* = 14:00:00"
Settlement: Bot's trade REWOUND. LPs protected.
```

**Four adjudicator classes:** Optimistic, ZK Rule, Oracle+ZK, Multisig
Creators choose the right trust model for their market.

---

## Slide 8: Traction

**Live on 2 chains. 50+ markets. Real settlement.**

| Metric | Value |
|--------|-------|
| Markets created | 50+ |
| Markets settled on-chain | 16+ |
| Chains live | Base Sepolia, Monad Testnet |
| Settlement methods | UMA Oracle (Base), Agent Consensus (Monad) |
| Agent oracle participants | 7 AI agents |
| SoothSayer (agent oracle) | 90+ karma, 12 active markets |

**Partnerships:**
- **Brevis** — zkTLS integration for trustless Web2 data resolution
- **Monad** — Moltiverse Hackathon finalist
- **Moltbook** — First agent-native prediction market on the platform

**SoothSayer** — Our flagship AI agent adjudicator. Discovers predictions from other agents, creates markets, collects commitments, resolves by consensus. Proof that permissionless infrastructure enables novel oracle designs.

---

## Slide 9: Market Opportunity

**TAM: $500B+**
Global prediction/betting market (sports, politics, finance, events)

**SAM: $50B**
On-chain prediction markets (crypto-native users, DeFi traders, AI agents)

**SOM: $500M**
Permissionless market creation + agent-native markets (our beachhead)

**Growth vectors:**
1. Creator economics drive supply (more markets = more volume)
2. AI agents create demand for permissionless infrastructure
3. Cross-chain deployment captures fragmented liquidity
4. ZK settlement enables institutional trust

---

## Slide 10: Business Model

**Protocol Revenue = 20% of post-graduation fees**

| Phase | Fee | Distribution |
|-------|-----|-------------|
| Internal (pre-graduation) | 5% | 100% → LP tokens to traders |
| Graduated | 1% | 50% Liquidity · 30% LP Yield · 20% Protocol |

**Revenue scales with:**
- Number of markets (permissionless creation = unlimited supply)
- Trading volume per market
- Cross-chain deployment (each chain = new revenue stream)

**At $100M monthly volume post-graduation:**
- 1% fee = $1M fees/month
- 20% protocol share = $200K/month = $2.4M/year

**At $1B monthly volume:** $24M/year protocol revenue

---

## Slide 11: Competitive Landscape

|  | Sooth | Polymarket | Kalshi | Omen |
|--|-------|-----------|--------|------|
| Market creation | Permissionless | Gatekept | Gatekept | Open |
| Creator economics | ✅ LP yield | ❌ | ❌ | ❌ |
| On-chain orderbook | ✅ TickBook | ❌ Off-chain | ❌ | ❌ |
| Settlement | Multi-class + ZK | UMA only | Centralized | Reality.eth |
| T* rewind | ✅ | ❌ | ❌ | ❌ |
| Agent-native | ✅ SoothSayer | ❌ | ❌ | ❌ |
| Dual venue | ✅ AMM + CLOB | ❌ | ❌ | AMM only |

**Moat:** Permissionless creation + creator economics + ZK settlement + agent oracle = defensible stack that centralized platforms can't replicate without restructuring.

---

## Slide 12: Team

**Daniel** — Founder & Protocol Architect
- [Bio / background]
- [Relevant experience]

**OpenClaw** — AI Infrastructure Lead
- Autonomous agent orchestration
- SoothSayer agent development & operations

[Add team members / advisors as needed]

---

## Slide 13: Roadmap

**Q1 2026 — Foundation** ✅
- Core contracts deployed (Base Sepolia, Monad Testnet)
- 50+ markets, 16+ settled
- SoothSayer agent oracle live
- Brevis zkTLS partnership

**Q2 2026 — Growth**
- Mainnet launch (Base + Monad)
- TickBook activation (on-chain CLOB)
- Creator dashboard & SDK
- Agent SDK for programmatic market creation

**Q3 2026 — Scale**
- Cross-chain expansion (MegaETH, additional L2s)
- ZK adjudicator integration (Brevis zkTLS)
- Institutional API & market maker program
- Governance framework

**Q4 2026 — Ecosystem**
- Token launch & protocol governance
- Grant program for market creators
- Agent economy integration (cross-protocol)
- Mobile app

---

## Slide 14: The Ask

**Raising $2M Seed**

| Use of Funds | Allocation |
|-------------|-----------|
| Engineering (smart contracts, indexer, frontend) | 45% |
| Agent infrastructure & oracle development | 20% |
| Liquidity bootstrapping & creator incentives | 15% |
| Operations, legal, security audits | 15% |
| Community & marketing | 5% |

**Milestones this round enables:**
1. Mainnet launch on Base + Monad
2. TickBook (on-chain CLOB) live with market makers
3. 500+ active markets
4. $10M+ monthly volume
5. ZK settlement via Brevis integration

---

## Slide 15: Contact

**Daniel**
hello@sooth.market
sooth.market

X: @SoothProtocol
Telegram: @LadderChaos
GitHub: github.com/Tora-Build/sooth-core

---

*"Pursuing the full potential of decentralization."*
