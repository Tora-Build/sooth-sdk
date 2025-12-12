# Sooth Protocol - Knowledge Base & Content Reference

## Document Purpose

This is the single source of truth for all content, terminology, and messaging used across the Sooth Protocol dApp. Use this document to ensure consistency in language, definitions, and brand voice across all pages and components.

---

## BRAND IDENTITY

### Protocol Name

**Sooth Protocol** (or simply "Sooth")

### Subtitle

**On-chain Truth Market**

**Definition:** A prediction market system where outcomes are determined by verifiable truth (via adjudicators) rather than arbitrary time-based expiration, with all core logic and settlement executed on-chain.

### Tagline

"Prediction markets that terminate on truth, not on time."

### Positioning Statement

"Event-perpetual · Truth-first"

### Core Value Proposition

Sooth is a fully on-chain protocol for infinite-end prediction markets that use retroactive finality to neutralize latency arbitrage and protect LPs, backed by a unified vault and multi-class adjudication.

### Brand Attributes

- Technical but accessible
- Neutral infrastructure provider
- Governance-tunable
- ZK-ready
- Deliberately narrow focus

---

## CORE CONCEPTS & DEFINITIONS

### On-chain Truth Market

A prediction market that terminates based on adjudicated truth rather than a predetermined expiration date, with all market logic, settlement, and accounting executed on-chain. This contrasts with traditional prediction markets that close at a fixed time regardless of whether truth has been established.

**Key distinction:** Truth-driven termination vs. time-driven termination

**Usage:** Can be used as a subtitle or descriptor for Sooth Protocol

### Infinite-End Markets

Markets that do not have a fixed expiration date. They remain active until truth is determined by an adjudicator. Unlike traditional prediction markets that close on a predetermined date, infinite-end markets close only when truth is established.

**Key phrase:** "Markets do not expire on a fixed date. They remain live until an adjudicator reports a truth and a termination time T\*."

### T\* (T-Star / Truth Time)

The precise timestamp when an event became true, as determined by the adjudicator. This is the cornerstone of retroactive settlement.

**Usage:** Always use "T\*" with the asterisk. Can be referred to as "Truth Time" in explanatory text.

**Key phrase:** "T\* = Truth Time"

### Retroactive Finality

The mechanism by which trades executed after T\* are economically rewound via ZK-verified settlement, neutralizing latency arbitrage and free-option attacks.

**Key phrase:** "Settlement is computed back from T\*, rewinding any latency-driven trades."

**Benefit statement:** "No rollbacks. No LP bleed from stale quotes."

### Latency Arbitrage

The practice of exploiting delays in information propagation to gain unfair trading advantages. Sooth's retroactive finality mechanism neutralizes this.

**Related terms:** Latency-agnostic, Free-option resistant

### Free-Option Attack

An exploit where traders can delay commitment until after an outcome is known, getting a "free option" on the result. Sooth structurally removes this attack vector.

**Key phrase:** "This structurally removes free-option attacks and latency arbitrage around resolution."

---

## LIQUIDITY METRICS (User-Facing)

### Liquidity (b) - Market Depth Parameter

The liquidity depth parameter for a specific market. Higher `b` means lower slippage.

**Formula:**

```
b = Base Liquidity + (Market Reserve × Reserve Multiplier)
```

**Key phrase:** "Liquidity grows as the market earns trading spreads"

**Components:**

- **Base Liquidity**: Global vault allocation (risk-adjusted)
- **Market Reserve**: Net profit/loss from trading spreads and settlements
- **Reserve Multiplier**: Currently 1.00x (100% conversion)

### Market Reserve - Accumulated Spread & PnL

The cumulative profit or loss for a specific market from trading activity and settlement outcomes.

**Key phrase:** "Market Reserve = Σ(Trading Spreads) + Settlement PnL"

**Important:** NOT a "fee" - there's no explicit fee percentage. The reserve grows from the natural bid-ask spread in AMM pricing.

**Can be negative:** If the market settles against the AMM's position.

### Solvency Factor - Capital Efficiency Ratio

The ratio of locked capital to liquidity depth.

**Formula:**

```
Solvency Factor = Max Loss / b
```

**Typical value:** ~0.693 for balanced markets (derived from ln(2))

**Key phrase:** "Indicates how efficiently capital is being used"

### Max Loss (Locked) - Worst-Case Payout

The maximum amount the vault could lose if the market resolves against its position. This capital is "locked" to guarantee solvency.

**Formula:**

```
Max Loss ≈ b × Solvency Factor
```

**For balanced markets:**

```
Max Loss ≈ b × 0.693
```

### Idle Liquidity - Available Capital

Capital in the vault not currently locked for any market. Available to support new markets or increased positions.

**Formula:**

```
Idle Liquidity = TVL - Σ(All Max Loss)
```

### The Flywheel Effect

**Key phrase:** "As markets earn spreads (Reserves), their liquidity (b) automatically grows. This attracts more trading volume, generating more spreads, further deepening liquidity."

**Visual representation:**

```
Trading Activity → Market Reserve grows →
Liquidity (b) increases → Max Loss adjusts →
More liquidity attracts more trading → (loop)
```

### Mathematical Relationships

**Primary equations:**

1. `b = Base + (Reserve × Multiplier)`
2. `Max Loss = b × Solvency Factor`
3. `Idle = TVL - Σ(Max Loss for all markets)`

**Derived relationships:**

- Reserve → b: Direct linear (1:1 with 1.00x multiplier)
- b → Max Loss: Proportional via Solvency Factor (~0.693)
- Max Loss → Idle: Inverse (more locked = less idle)

### Terminology Standards

- **Capitalize:** Market Reserve, Solvency Factor, Max Loss, Idle Liquidity
- **Lowercase:** liquidity depth, reserve multiplier, trading spreads
- **Symbols:** `b` for liquidity parameter (always lowercase, monospace)

### User-Facing Explanations

**For Traders:**

- "Higher `b` = Better prices (less slippage)"
- "Popular markets get deeper over time"
- "You pay the spread, not a separate fee"

**For LPs:**

- "Share price grows with positive market reserves"
- "Diversification spreads risk across markets"
- "Idle liquidity can back new markets"

**For Market Creators:**

- "New markets start with base liquidity allocation"
- "Successful markets earn their own liquidity boost"
- "Risk class affects initial base allocation"

### Common Misconceptions to Avoid

❌ "There's a 0.2% trading fee" → ✅ "Trading cost comes from the bid-ask spread"
❌ "Max Loss = Market Reserve + Locked" → ✅ "Max Loss ≈ b × 0.693"
❌ "Reserves are separate from vault value" → ✅ "Reserves are owned by LPs collectively"

---

## TECHNICAL ARCHITECTURE

### LMSR (Logarithmic Market Scoring Rule)

An automated market maker algorithm that provides liquidity with bounded loss for the liquidity provider.

**Always pair with:** "Bounded-loss LMSR"

### vAMM (Virtual Automated Market Maker)

An AMM that uses virtual liquidity rather than requiring full collateral for each market.

**Key phrase:** "LMSR vAMM that prices outcome exposure"

### Singleton Vault

A unified liquidity pool shared across multiple markets within the same adjudicator class.

**Key phrase:** "A unified vault per (chain, adjudicator class)"

**LP benefit:** "LPs deposit into a singleton vault and earn fees and yield across all markets sharing that adjudicator class."

### Bounded Loss

A guarantee that liquidity providers cannot lose more than a predetermined maximum amount.

**Key phrase:** "LMSR ensures bounded loss; ZK settlement avoids loss-vs-rebalancing from stale quotes."

### Virtual Liquidity

Liquidity that exists in the pricing mechanism but doesn't require full collateral backing.

**Key phrase:** "Virtual liquidity can be weighted per market while preserving bounded vault loss."

### ZK Settlement

Zero-knowledge proof-verified settlement that computes per-account profit/loss off-chain with on-chain verification.

**Technology reference:** "e.g. Brevis" (when giving examples)

**Key phrase:** "Trades, positions, and T\* feed into an off-chain ZK engine that computes per-account delta-PnL. A settlement batch with proof is posted on-chain and applied to Smart Accounts."

### Smart Accounts

On-chain accounts with programmable logic for managing user positions.

**Usage:** Always "Smart Accounts" (not "Sooth Accounts")

### Merkle-root Settlement

A settlement method using Merkle trees to efficiently verify multiple account balances with a single root hash.

### Delta-PnL

The change in profit and loss for an account.

---

## ADJUDICATION SYSTEM

### Adjudicator

The entity or mechanism responsible for determining the truth outcome of a market and providing T\*.

### Adjudicator Classes

Different types of adjudication mechanisms. Always present in this order:

**A. Optimistic (UMA / Reality-style)**
Dispute-based resolution system.

**B. ZK Rule (pure on-chain logic)**
Fully on-chain verification using zero-knowledge proofs.

**C. Oracle + ZK enhancement**
Oracle data enhanced with ZK proofs for additional security.

**D. Attestation-based**
Trust-based verification system.

**Count:** "4 Adjudicator classes" (always use this number)

### Multi-class Adjudication

The system supporting multiple adjudicator types within the protocol.

---

## MARKET LIFECYCLE

### Market States

**Live**
Market is actively trading and accepting new positions.
**Display:** "Live · Infinite-End"

**Cooldown**
Waiting period after truth is reported, before final settlement.
**Display:** "Cooldown · T\* pending"

**Settled**
Market has been finalized and all positions resolved.
**Display:** "Settled"

### Lifecycle Phases

**Event-driven lifecycle**
Market states change based on events (truth determination) rather than time.

**Guardian-driven cooldown**
A safety mechanism where guardians can trigger waiting periods.

**Retroactive settlement on T\***
Final settlement computed backwards from the truth time.

---

## PROTOCOL LAYERS

### Layer 1: Market Layer

**Title:** Infinite-End Markets

**Description:** Markets are not tied to an expiry timestamp. They terminate solely on adjudicated truth, using a precise T\* to define when an event became true. This structurally removes free-option attacks and latency arbitrage around resolution.

**Features:**

- Event-driven lifecycle
- Guardian-driven cooldown
- Retroactive settlement on T\*

### Layer 2: Liquidity Layer

**Title:** Singleton Vault + LMSR vAMM

**Description:** A unified vault per (chain, adjudicator class) powers an LMSR vAMM that prices outcome exposure. Virtual liquidity can be weighted per market while preserving bounded vault loss.

**Features:**

- Unified LP exposure
- Virtual liquidity routing
- Bounded-loss LMSR curve

### Layer 3: Settlement & Account Layer

**Title:** ZK-Verified PnL

**Description:** Trades, positions, and T\* feed into an off-chain ZK engine (e.g. Brevis) that computes per-account delta-PnL. A settlement batch with proof is posted on-chain and applied to Smart Accounts.

**Features:**

- Merkle-root settlement
- Proof-verified accounting
- Local PnL application per account

---

## COMPETITIVE POSITIONING

### Positioning Statement

"Sooth complements existing platforms like Polymarket, Kalshi, Omen, and HIP-4 by focusing on infinite-end, vault-backed, ZK-verifiable markets."

### Context Statement

"Sooth is deliberately narrow: it aims to be the most expressive and secure base layer for truth-terminated, infinite-end markets, while remaining neutral infrastructure for any front-end or ecosystem that wants to build on top."

### Comparison Framework

| Platform       | Market Type              | Liquidity Model        | Resolution Method           | Decentralization              |
| -------------- | ------------------------ | ---------------------- | --------------------------- | ----------------------------- |
| **Sooth**      | Infinite-End, T\*-driven | Vault + LMSR vAMM      | Multi-class + ZK settlement | Fully on-chain protocol       |
| **Polymarket** | Fixed event markets      | Hybrid CLOB / on-chain | Oracle + optimistic         | Hybrid infra                  |
| **Kalshi**     | Fixed event contracts    | Centralized CLOB       | Centralized oracle          | Centralized exchange          |
| **Omen**       | Fixed Q&A markets        | Per-market AMM pools   | Reality.eth + arbitration   | Fully on-chain                |
| **HIP-4**      | Event perps              | On-chain CLOB          | Chosen oracle               | Custom L1, semi-decentralized |

---

## EXAMPLE MARKETS

### Market Format

[Question] > [Threshold]

### Demo Market Examples

1. **BTC 7-day TWAP > $100k**

   - Adjudicator: Oracle+ZK
   - Status: Live · Infinite-End
   - Implied YES: 62%

2. **"Protocol X hacked > $1M?"**

   - Adjudicator: ZK Rule
   - Status: Cooldown · T\* pending
   - Implied YES: 41%

3. **"UN Announces Confirmation of Alien Life"**

   - Adjudicator: Optimistic
   - Status: Live · Infinite-End
   - Implied YES: 54%

4. **"Stablecoin Z depegs < 0.90"**
   - Adjudicator: Oracle+ZK
   - Status: Settled
   - Implied YES: 0%

---

## KEY MESSAGING

### Feature Highlights (3 Pillars)

1. **∞ Live until truth** - Markets remain open until truth is determined
2. **4 Adjudicator classes** - Multiple verification mechanisms
3. **ZK Verified settlement** - Cryptographically proven accounting

### Protection Mechanisms

- **Free-option resistant** - Eliminates delayed commitment exploits
- **Latency-agnostic** - Neutralizes information propagation advantages
- **Retroactive Finality** - Economic rewinding of post-truth trades

### LP Value Proposition

- Unified vault exposure across markets
- Bounded loss guarantee via LMSR
- Protection from stale quote losses
- Fees and yield across all markets in adjudicator class

### Trader Value Proposition

- No expiration-based forced exits
- Fair settlement based on truth time
- Protection against latency arbitrage
- Multiple adjudication options

---

## DISCLAIMERS & LEGAL

### Demo Disclaimer

"All numbers on this page are illustrative only."

**Usage:** Include on any page showing mock data or example markets.

### Demo Badge

"Demo Only"

**Usage:** Tag any snapshot cards or example data displays.

---

## TERMINOLOGY STANDARDS

### Capitalization Rules

- **Capitalize:** Sooth Protocol, Truth Time, Smart Accounts, Infinite-End (when used as adjective)
- **Lowercase:** adjudicator, vault, settlement, oracle
- **Acronyms:** LMSR, vAMM, ZK (always caps)

### Hyphenation

- **Hyphenate:** infinite-end, event-driven, truth-driven, on-chain, off-chain, ZK-verified, vault-backed
- **No hyphen:** truth time (when used as noun), smart accounts

### Preferred Terms

- Use "infinite-end" not "infinite end" or "infiniteEnd"
- Use "T*" not "T-star" or "t*" (except in explanatory text)
- Use "adjudicator" not "oracle" (unless specifically referring to oracle-type adjudicators)
- Use "retroactive finality" not "retroactive funding"
- Use "Smart Accounts" not "Sooth Accounts"

### Avoid

- "Expiry" or "expiration date" (markets don't have these)
- "Close" or "closing" (use "settle" or "terminate")
- "Prediction market" alone (always qualify as "infinite-end prediction market")

---

## VOICE & TONE

### Voice Characteristics

- **Technical precision** - Use exact terminology
- **Accessible explanation** - Define complex concepts clearly
- **Neutral positioning** - Infrastructure provider, not competitor
- **Confidence without hype** - State capabilities factually

### Writing Guidelines

1. Lead with the unique value (truth-termination, not time-termination)
2. Explain "why" before "how" when introducing concepts
3. Use concrete examples (demo markets) to illustrate abstract concepts
4. Acknowledge the ecosystem (complementary, not competitive)
5. Emphasize structural guarantees over promises

### Example Phrases to Use

- "Markets do not expire on a fixed date"
- "Terminate solely on adjudicated truth"
- "Structurally removes [attack vector]"
- "Neutralizes [exploit]"
- "Governance-tunable"
- "Replaceable and composable"

### Example Phrases to Avoid

- "Revolutionary" or "game-changing"
- "Best" or "only" (unless factually true)
- "Disrupting" or "replacing"
- Absolute guarantees without technical basis

---

## VISUAL LANGUAGE

### Color Associations

- **Emerald/Green** - Truth, Live markets, Positive states, YES outcomes
- **Rose/Red** - NO outcomes, Negative states
- **Indigo/Purple** - ZK features, Technical components
- **Amber/Yellow** - Cooldown, Pending states, Warnings
- **Slate/Gray** - Settled, Inactive, Neutral information

### Icon/Symbol Usage

- **∞** - Infinite-end markets
- **ZK** - Zero-knowledge features
- **T\*** - Truth time
- **4** - Number of adjudicator classes

---

## FOOTER STANDARD

### Copyright

"© Sooth Protocol · Demo UI"

### Standard Links

- Whitepaper
- Docs
- GitHub
- Governance

---

## REVISION HISTORY

**Version 1.0** - Initial knowledge base creation

- Extracted from original landing page content
- Standardized terminology and messaging
- Established voice and tone guidelines
