# Sooth Protocol: The Permissionless Prediction Market Launchpad
### Official Whitepaper
---

> *"Pursuing the full potential of decentralization."*

---

## 1. Abstract

Sooth Protocol is a fully on-chain prediction market infrastructure designed around one core thesis: **decentralization creates better markets**.

We pursue this through three foundational pillars:

| Pillar | Innovation | Decentralization Unlock |
|--------|------------|------------------------|
| **🚀 Launchpad** | Permissionless market creation with creator economics | Economic incentive alignment without gatekeepers |
| **⚖️ ZK Rules** | Autonomous, retroactive settlement via T* | Trustless resolution without centralized oracles |
| **📊 SoothBook** | On-chain CLOB with 10,000-tick depth | Decentralized price discovery rivaling CEX execution |

By aligning incentives across **Creators**, **Gaming Traders**, and **Arbitrageurs**, Sooth transforms prediction markets from extractive platforms into **cooperative value creation networks**.

---

## 2. The Decentralization Thesis

Traditional prediction markets fail to capture the full potential of decentralization:

| Platform | Creation | Liquidity | Resolution | Price Discovery |
|----------|----------|-----------|------------|-----------------|
| Polymarket | Gatekept | Hybrid | Centralized oracle | Off-chain matching |
| Kalshi | Gatekept | Centralized | Centralized | Centralized CLOB |
| Omen | Open | Fragmented | Reality.eth | Per-market AMM |
| **Sooth** | **Permissionless** | **Unified Vault** | **ZK + Multi-class** | **On-chain SoothBook + AMM** |

Sooth's architecture ensures that every layer—creation, liquidity, settlement, and discovery—benefits from decentralized design.

---

## 3. Pillar I: The Launchpad 🚀 — Decentralized Economic Design

The Launchpad transforms market creation from a privileged operation into an **incentive-aligned economic game**.

### 3.1 The Creator's Game

**Problem:** Traditional platforms decide which markets exist. Creators have no stake in success.

**Sooth's Solution:** Creators deposit capital and become the first LP. Their economic interests are permanently aligned with market success.

#### Creator P&L Analysis

| Event | Creator Impact |
|-------|----------------|
| Market created | -$693 deposit (for $1,000 liquidity tier) |
| Trading generates fees | +LP tokens minted (pre-graduation) |
| Market graduates | Unlocks ongoing yield stream |
| Market settles profitably | +Proportional share of vault assets |
| Market settles at loss | -Bounded by initial deposit |

**Key insight:** Creators can profit even if the market settles against the "crowd" prediction, as long as trading volume generates sufficient fees.

**Example:**
> Carol creates "Protocol X hacked > $1M?" with $693 deposit.
> - $3,000 in trading volume generates $150 in fees (5%)
> - Market graduates after $2,000 cumulative fees
> - Carol holds 50% LP tokens → Claims ~$1,500 at settlement
> - **Net P&L: +$807** (even if she never traded)

### 3.2 The Gaming Trader's Reward 🎮

**Problem:** Early traders take the most risk but receive no special reward.

**Sooth's Solution:** Pre-graduation fees mint LP tokens to traders, converting them from customers into stakeholders.

#### Fee → LP Mechanism

```
Trader pays 5% fee on $100 trade = $5
→ $5 adds to liquidity depth (bBase grows)
→ $5 worth of LP tokens minted TO THE TRADER
→ Trader now earns from future trading activity
```

**The Gaming Trader's P&L:**

| Scenario | Traditional Platform | Sooth |
|----------|---------------------|-------|
| Win prediction | +Payout | +Payout + LP tokens |
| Lose prediction | -Stake | -Stake + LP tokens (partial recovery) |
| Market becomes popular | No benefit | LP tokens appreciate |

**Example:**
> Alice bets $200 on YES during the internal phase, paying $10 in fees.
> - She receives $10 worth of LP tokens
> - The market goes viral, generating $50,000 in volume
> - Her LP tokens now represent a share of ~$2,500 in fees
> - **Even if her prediction loses, her LP position may offset the loss**

### 3.3 Graduation Economics

| Phase | Fee | Who Benefits |
|-------|-----|--------------|
| **Internal** | 5% | Traders (LP minting) + Liquidity depth |
| **Graduated** | 1% | 50% Liquidity · 30% LP Yield · 20% Protocol |

The high internal phase fee incentivizes early participation. As markets mature, lower fees attract higher volume.

### 3.4 Liquidity Tiers

| Tier | Liquidity ($b$) | Creator Deposit | Graduation Threshold |
| :--- | :--- | :--- | :--- |
| **Micro** | $100 | $69 | $200 in fees |
| **Small** | $1,000 | $693 | $2,000 in fees |
| **Medium** | $10,000 | $6,930 | $20,000 in fees |
| **Large** | $100,000 | $69,300 | $200,000 in fees |

---

## 4. Pillar II: ZK Rules ⚖️ — Autonomous and Retroactive Settlement

Settlement is where centralization causes the most damage. Biased oracles, delayed resolution, and latency exploitation all undermine market integrity.

### 4.1 The T* Mechanism: Retroactive Finality

**Problem:** When truth emerges, fast traders exploit stale AMM quotes before prices update.

**Sooth's Solution:** Adjudicators report not just the outcome, but **when** it became true (T*). Settlement rewinds trades executed after T*.

#### How It Works

```
Timeline:
├─ 14:00:00 — BTC crosses $100k (T* = this moment)
├─ 14:00:05 — News breaks
├─ 14:00:10 — Arbitrageur buys YES at 60¢
├─ 14:00:30 — Adjudicator reports: "YES, T* = 14:00:00"
└─ Settlement: The 14:00:10 trade is REWOUND
    → Arbitrageur receives refund, not windfall
    → LPs protected from latency exploitation
```

**Result:** No rollbacks on-chain. ZK proofs verify the rewind accounting. LPs don't bleed to faster traders.

### 4.2 Four Adjudicator Classes

| Class | Use Case | Trust Model |
|-------|----------|-------------|
| **Optimistic** | Subjective events, disputes | UMA/Reality.eth-style challenges |
| **ZK Rule** | On-chain verifiable conditions | Pure smart contract logic |
| **Oracle+ZK** | Price feeds, data thresholds | Chainlink + ZK enhancement |
| **Multisig** | Institutional, private data | N-of-M authorized signers |

**Creators choose** the appropriate adjudicator for their market. More trust assumptions = more market types possible.

### 4.3 Optional Open-End Markets

Not all markets need to be open-end. Sooth supports both models:

| Type | Description | Best For |
|------|-------------|----------|
| **Open-End** | No expiry; settles when truth is known | "Will X ever happen?" |
| **Fixed-End** | Traditional expiry date | "Will X happen by Y date?" |

**Open-End advantages:**
- No forced liquidations at arbitrary deadlines
- Markets can live forever until resolution
- Truth-driven rather than time-driven

**Fixed-End advantages:**
- Familiar structure for traditional events
- Clear settlement timeline for traders

---

## 5. Pillar III: SoothBook 📊 — Decentralized CLOB Alternative

The SoothBook brings CEX-grade execution to on-chain prediction markets.

### 5.1 Architecture

- **10,000 price ticks** from 0.01% to 99.99%
- **Bitmap-based O(1) tick discovery** — Finding the best price is constant-time
- **On-chain matching** — No off-chain sequencer, no MEV extraction
- **Native to high-throughput L2s** — Optimized for MegaETH, Base, and similar chains

### 5.2 Dual Venue Architecture

Sooth operates two parallel trading venues for different trader archetypes:

```
┌───────────────────────────────────────────────────────────┐
│                     DUAL VENUE DESIGN                     │
├────────────────────────────┬──────────────────────────────┤
│       AMM (Retail)         │       SoothBook (Pro)         │
├────────────────────────────┼──────────────────────────────┤
│ Entry: LaunchpadEngine     │ Entry: Collateralizer.split()│
│ Asset: Position ledger     │ Asset: Transferable ERC20    │
│ Pricing: LMSR curve        │ Pricing: Limit orderbook     │
│ Execution: Always available│ Execution: Depth-dependent   │
│ Fees: 5%/1% protocol fee   │ Fees: Maker-taker spread     │
│ Sell Lock: 24h on proceeds │ Sell Lock: None (instant)    │
│ Best For: Retail, one-click│ Best For: MMs, arb bots, API │
└────────────────────────────┴──────────────────────────────┘
```

### 5.3 Market Evolution

Markets naturally evolve through phases:

```
  LAUNCH             GROWTH              MATURE
 [AMM Only]    →   [AMM + SoothBook]  →  [SoothBook Dominant]

 AMM Role:     Bootstrap liquidity  →   Retail access, tail liquidity
 SoothBook:     (Disabled)           →   Price discovery, institutional flow
```

**Pre-Graduation**: AMM bootstraps liquidity, SoothBook disabled
**Post-Graduation**: Both venues active, arbitrageurs keep prices aligned
**Mature Market**: SoothBook handles institutional flow, AMM serves retail tail

### 5.4 The Arbitrageur's Playground

**Dual-venue arbitrage** creates tight, efficient prices through pure market forces:

#### AMM ↔ SoothBook Arbitrage

```
Scenario: YES price diverges
├─ AMM (LMSR): YES = 62%
├─ SoothBook: YES best ask = 58%
└─ Arbitrage opportunity:
    → Buy YES on SoothBook at 58¢
    → Sell YES on AMM at 62¢
    → Pocket 4¢ per share (risk-free)
    → Prices converge
```

**Who benefits:**
- Arbitrageurs profit from price discrepancies
- All traders get better prices from tighter spreads
- LPs earn fees from the increased volume

#### PvP Trading on SoothBook

The SoothBook enables **pure peer-to-peer trading** without LP intermediation:

| Trading Mode | Counterparty | Who Takes Risk |
|--------------|--------------|----------------|
| AMM | Liquidity Pool | LPs |
| SoothBook | Other Traders | Traders vs Traders |

**PvP advantages for sophisticated traders:**
- No slippage on large orders (if matched)
- Set exact prices with limit orders
- No LP spread extraction
- True price discovery through order flow

**Example:**
> Bob thinks YES is overvalued at 65%. He places a limit sell at 64%.
> Charlie thinks YES is undervalued at 64%. He places a limit buy at 64%.
> → Orders match. Bob and Charlie trade directly.
> → No AMM fee, no LP involvement, pure PvP.

---

## 6. Two Trader Archetypes

The dual-venue architecture serves **fundamentally different trader profiles**:

### 6.1 The 🐢 AMM Trader (Retail)

| Dimension | Description |
|-----------|-------------|
| **Profile** | Retail users, hedgers, speculators |
| **Frequency** | Low (hours/days) |
| **Primary Goal** | Express opinion, hedge risk |
| **Trade Size** | Small-medium |
| **Entry Point** | `LaunchpadEngine.tradePositions()` |
| **Asset Type** | Non-transferable positions |
| **Constraint** | 24h sell lock on proceeds |
| **Reward** | Fee → LP token conversion |

**The 🐢 Trader Journey:**
1. Discover promising early-stage market
2. Trade during internal phase (5% fee → LP tokens)
3. Accumulate LP position alongside prediction position
4. Win on prediction OR win on LP appreciation (or both)

### 6.2 The ⚡ SoothBook Trader

| Dimension | Description |
|-----------|-------------|
| **Profile** | Market makers, arbitrageurs, HFT bots |
| **Frequency** | High (seconds/blocks) |
| **Primary Goal** | Price discovery, capture spreads |
| **Trade Size** | Large, rapid |
| **Entry Point** | `Collateralizer.split()` → SoothBook |
| **Asset Type** | Transferable ERC20 tokens |
| **Constraint** | None — instant transfer |
| **Reward** | Spread capture, arbitrage profit |

**The ⚡ Trader Journey:**
1. Mint tokens via `Collateralizer.split()` (1 USDC → 1 YES + 1 NO)
2. Place limit orders on SoothBook at desired prices
3. Capture spreads when orders fill
4. Arbitrage AMM ↔ SoothBook price discrepancies
5. Redeem winning tokens after settlement

### 6.3 Comparison Matrix

| Dimension | 🐢 AMM Trader | ⚡ SoothBook Trader |
|-----------|--------------|-------------------|
| **Entry Point** | `LaunchpadEngine.tradePositions()` | `Collateralizer.split()` → SoothBook |
| **Asset Type** | Non-transferable positions | Transferable ERC20 tokens |
| **Liquidity** | LMSR curve (always available) | Limit orderbook (depth varies) |
| **Sell Constraint** | 24h lock on proceeds | Instant (token transfer) |
| **Fee Model** | 5% pre-grad / 1% post-grad | Maker-taker spreads |
| **Settlement** | Automatic via position | Explicit token redemption |
| **UX Priority** | Simplicity, one-click trades | Speed, API access, depth |

### 6.4 Why Two Venues?

Different traders have different needs. Forcing everyone through one interface means nobody is optimally served.

| Need | AMM Provides | SoothBook Provides |
|------|--------------|-------------------|
| Guaranteed liquidity | ✅ LMSR always quotes | ❌ Depends on depth |
| Precise pricing | ❌ Curve-determined | ✅ Set your own price |
| Large orders | ❌ High slippage | ✅ Match at limit |
| Instant execution | ✅ Trade immediately | ❌ Wait for fill |
| API trading | ❌ Basic | ✅ Full orderbook API |
| Retail simplicity | ✅ One-click trades | ❌ Complex token flow |

**Arbitrageurs bridge the gap** — keeping prices aligned between venues while profiting from discrepancies.

---

## 7. Actor-Driven Design

Sooth's architecture is designed around **who uses it and why**.

### 7.1 The Creator 🎨

**Motivation:** Monetize market-making expertise or community insight.

**Journey:**
1. Identify an underserved prediction topic
2. Deposit capital, select adjudicator class
3. Promote the market to attract early traders
4. Earn LP tokens as the market grows
5. Collect ongoing yield post-graduation

**P&L Drivers:**
- ✅ Trading volume (more volume = more fees = more LP value)
- ✅ Market graduation (unlocks yield stream)
- ⚠️ Settlement outcome (affects final LP redemption value)

### 7.2 The Gaming Trader 🎮

**Motivation:** Profit from predictions while earning stakeholder rewards.

**Journey:**
1. Discover promising early-stage markets
2. Trade during internal phase (5% fee → LP tokens)
3. Accumulate LP position alongside prediction position
4. Win on prediction OR win on LP appreciation (or both)

**P&L Drivers:**
- ✅ Correct predictions
- ✅ LP token appreciation from market success
- ✅ Early entry (higher fee → more LP)

**The Gaming Trader's Edge:** Unlike traditional platforms, losing a prediction doesn't mean total loss. LP tokens provide upside even on wrong bets.

### 7.3 The Arbitrageur 🔄

**Motivation:** Risk-free profit from market inefficiencies.

**Journey:**
1. Monitor AMM and SoothBook prices in real-time
2. Identify divergences (>1% spread = opportunity)
3. Execute simultaneous buy/sell across venues
4. Capture spread, repeat

**P&L Drivers:**
- ✅ Price divergence frequency
- ✅ Execution speed (on-chain, but still competitive)
- ✅ Volume capacity before prices converge

**The Arbitrageur's Role:** They're not extracting value—they're providing a service. Arbitrage tightens spreads and improves prices for all traders.

### 7.4 The PvP Trader ⚔️

**Motivation:** Trade conviction against other humans, not algorithms.

**Journey:**
1. Form thesis on market outcome
2. Place limit orders on SoothBook at desired price
3. Wait for counterparty to match
4. Settle directly—winner takes loser's stake

**P&L Drivers:**
- ✅ Superior information or analysis
- ✅ Correct timing of market entry/exit
- ❌ No LP safety net—pure skill/conviction game

**The PvP Trader's Arena:** The SoothBook is where conviction meets conviction. No AMM cushion, no fee→LP conversion. Just traders vs traders.

---

## 8. Technical Architecture

```
                     ┌─────────────────┐
                     │   TruthMarket   │  Lifecycle Authority
                     │    isLive()     │  Settlement State
                     │   isSettled()   │  T* Storage
                     └────────┬────────┘
                              │ queries
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
    ┌────────────────┐ ┌──────────────┐ ┌────────────────┐
    │LaunchpadEngine │ │   SoothBook   │ │ Collateralizer │
    │    (Retail)    │ │    (Pro)     │ │  Token Mgmt    │
    │  Fee->LP Mint  │ │ PvP Trading  │ │  Split/Merge   │
    └───────┬────────┘ └──────────────┘ └────────────────┘
            │ delegates
            ▼
    ┌─────────────────┐
    │    AMMEngine    │  LMSR Trading
    │ 24h Lock-on-Sell│  Guaranteed Liquidity
    └─────────────────┘
            │ direct USDC
            ▼
    ┌─────────────────┐
    │   User Wallet   │  EOA, Safe, Smart Account
    └─────────────────┘
```

### Architecture Reference

| Layer | Contract | Trader Type | Responsibility |
|-------|----------|-------------|---------------|
| **Lifecycle** | `TruthMarket` | All | Question, deadline, settlement, roles |
| **AMM Trading** | `AMMEngine` | 🐢 Retail | LMSR pricing, positions, 24h locks |
| **Economics** | `LaunchpadEngine` | 🐢 Retail | Fees, LP tokens, graduation |
| **Token Ops** | `Collateralizer` | ⚡ Pro | Token split/merge, redemption |
| **Orderbook** | `SoothBook` | ⚡ Pro | Limit orders, matching engine |
| **Tokens** | `OutcomeToken` | ⚡ Pro | Transferable ERC20 (OB-domain only) |

### Design Principles

| Principle | Why It Matters |
|-----------|----------------|
| **Domain Isolation** | AMM and SoothBook don't share state—cleaner, safer |
| **Pull-Based Lifecycle** | Venues query TruthMarket, no callback complexity |
| **No Custody Layer** | Users keep funds in their wallets until trade |
| **Pure WAD Architecture** | All internal math uses 18 decimals |
| **Dual Trader Support** | Different constraints, fees, and UX for each archetype |

---

## 9. Market Lifecycle

```
┌──────────┐   activate()   ┌──────────┐    deadline    ┌───────────┐
│ CREATED  │───────────────►│   LIVE   │───────────────►│ SETTLING  │
└──────────┘                └──────────┘                └───────────┘
     │                           │                            │
     │ Creator deposits          │ Trading active             │ settle(outcome, T*)
     │ LP initializes AMM        │ Fees collected             ▼
     │                           │ Graduation check      ┌───────────┐
     │                           │                       │  SETTLED  │
     │                           │                       └───────────┘
     │                           │                            │
     │                           │                            │ 24h veto window
     │                           │                            │ Guardian oversight
     │                           │                            ▼
     │                           │                       ┌───────────┐
     │                           │                       │ FINALIZED │
     │                           │                       └───────────┘
     │                           │                            │
     │                           │                            │ Winners redeem
     │                           │                            │ LP claims yield
     │                           │                            ▼
     └───────────────────────────┴──────────────────────►[Complete]
```

---

## 10. LP Valuation: The Honest Floor Model

LP tokens represent ownership in market liquidity. The protocol uses worst-case accounting:

```
Floor = Cash - max(qYes, qNo)    ← Guaranteed minimum
Ceiling = Cash - min(qYes, qNo)  ← Best case
ExRate = Floor / LP_Supply       ← Redemption rate
```

**Lock-on-Sell (AMM only):** Sell proceeds lock for 24 hours (spendable but not withdrawable) to prevent hit-and-run extraction. SoothBook traders have instant transfer via ERC20 tokens.

---

## 11. Technical Interfaces

### LaunchpadEngine (🐢 Retail)
```solidity
interface ILaunchpadEngine {
    function createMarket(address market, address creator, uint256 bBase) 
        external returns (uint256 requiredDeposit);
    
    function tradePositions(address market, int256 deltaShares, uint256 maxCost) 
        external returns (uint256 actualCost);
    
    function redeemLP(address market, uint256 lpAmount) 
        external returns (uint256 payout);
}
```

### Collateralizer (⚡ Pro)
```solidity
interface ICollateralizer {
    function split(address market, uint256 amount) external;   // 1 USDC → 1 YES + 1 NO
    function merge(address market, uint256 amount) external;   // 1 YES + 1 NO → 1 USDC
    function redeem(address market, uint8 outcome, uint256 amount) external;
}
```

### SoothBook (⚡ Pro)
```solidity
interface ISoothBook {
    function placeOrder(address market, uint8 outcome, uint16 tick, uint256 amount, bool isBuy)
        external returns (uint256 orderId);
    
    function cancelOrder(uint256 orderId) external;
    
    function getBestBid(address market, uint8 outcome) external view returns (uint16, uint256);
    function getBestAsk(address market, uint8 outcome) external view returns (uint16, uint256);
}
```

### TruthMarket
```solidity
interface ITruthMarket {
    function isLive() external view returns (bool);
    function isSettled() external view returns (bool);
    function winningOutcome() external view returns (uint8);
    function tStar() external view returns (uint64);
}
```

---

## 12. Testnet Deployment

Live on **Base Sepolia**:

| Contract | Address |
|----------|---------|
| **LaunchpadEngine** | `0xFf422cc9b537BD41DD2583E3E611CA2eF1C149B4` |
| **Collateralizer** | `0x2C60E3A96334E449C92C7d035E51EB8A6dA9245E` |
| **AMMEngine** | `0x35089e985E23D01b4D2E453E775D570649624E8E` |
| **SoothBook** | `0xEDe4d7AAa1311A6391Dd203E5E728bb6489575aF` |

**Sample Markets:** UN Alien Confirmation · BTC ATH 2026 (Chainlink TWAP) · Lakers NBA Championship

---

## 13. Conclusion: The Decentralization Dividend

Sooth Protocol proves that decentralization isn't a compromise—it's a **competitive advantage**.

| Centralized Approach | Sooth's Decentralized Design |
|---------------------|------------------------------|
| Gatekept creation | Permissionless launchpad with aligned incentives |
| Single oracle | Four adjudicator classes + ZK verification |
| Off-chain matching | On-chain CLOB with transparent execution |
| Extractive fees | Fee→LP conversion rewards participants |
| Forced expiration | Optional open-end markets |
| One-size-fits-all | Dual venue for retail (🐢) and pro (⚡) traders |

**The result:** A prediction market infrastructure where:
- **Creators 🎨** are incentivized to build great markets
- **Gaming Traders 🎮** are rewarded for early participation
- **Arbitrageurs 🔄** keep prices efficient across venues
- **PvP Traders ⚔️** find fair, transparent battlegrounds

*When every participant has aligned incentives, the protocol doesn't need gatekeepers. Truth emerges from the market itself.*

---

*Updated: December 2025*

---

**Resources:**
- [GitHub](https://github.com/sooth-protocol)
- [Documentation](https://docs.sooth.markets)
- [dApp](https://app.sooth.markets)
