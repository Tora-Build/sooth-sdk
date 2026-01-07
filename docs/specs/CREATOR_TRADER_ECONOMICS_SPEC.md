# Creator & Trader Economics Specification

**Version**: 1.0.0  
**Status**: Draft  
**Last Updated**: 2026-01-07

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Economic Model Overview](#2-economic-model-overview)
3. [Creator Economics (Carol)](#3-creator-economics-carol-)
4. [Gaming Trader Economics (Alice)](#4-gaming-trader-economics-alice-)
5. [Arbitrageur Economics (Bob)](#5-arbitrageur-economics-bob-)
6. [PvP Trader Economics (Dave)](#6-pvp-trader-economics-dave-)
7. [Comparative Analysis](#7-comparative-analysis)
8. [Fee Flow Diagrams](#8-fee-flow-diagrams)
9. [User Stories](#9-user-stories)
10. [Risk Matrices](#10-risk-matrices)
11. [Appendix](#11-appendix)

---

## 1. Executive Summary

### Purpose

This specification defines the economic models, P&L drivers, and risk profiles for all participant types in the Sooth Protocol Launchpad.

### Four Participant Archetypes

| Archetype | Symbol | Entry Point | Primary Goal | LP Exposure |
|-----------|--------|-------------|--------------|-------------|
| **Creator** | 🎨 | LaunchpadEngine.createMarket | Passive income from volume | High (initial deposit) |
| **Gaming Trader** | 🎮 | LaunchpadEngine.tradePositions | Hedged predictions | Medium (from fees) |
| **Arbitrageur** | 🔄 | Collateralizer + TickBook | Risk-free spreads | None |
| **PvP Trader** | ⚔️ | TickBook limit orders | Pure conviction plays | None |

### Core Insight

Sooth transforms prediction markets from **extractive platforms** into **cooperative value networks** by converting fees into ownership stakes. Traders become stakeholders.

### Key Economic Mechanisms

| Mechanism | Description | Benefit |
|-----------|-------------|---------|
| **Fee → LP Conversion** | Pre-grad fees mint LP tokens to traders | Traders gain ownership |
| **Graduation Threshold** | Fee reduction after break-even | Lower costs for mature markets |
| **LP Floor Protection** | Guaranteed minimum LP value | Downside protection |
| **Dual Venue Arbitrage** | AMM ↔ TickBook price alignment | Tighter spreads for all |

---

## 2. Economic Model Overview

### 2.1 Fee Structure

| Phase | Fee Rate | Distribution | Trigger |
|-------|----------|--------------|---------|
| **Pre-Graduation** | 5% (500 bps) | 100% → bBase growth + LP to trader | Default |
| **Post-Graduation** | 1% (100 bps) | 50% bBase / 30% LP Yield / 20% Protocol | Fees ≥ threshold |

### 2.2 Core Formulas

| Formula | Expression | Description |
|---------|------------|-------------|
| **Creator Deposit** | `b × ln(2) ≈ b × 0.693` | Required USDC to seed liquidity |
| **Graduation Threshold** | `bBase × ln(2) × multiplier` | Fees needed to graduate |
| **LP Floor** | `Cash - max(qYes, qNo)` | Minimum LP redemption value |
| **Break-Even Volume** | `Deposit / 0.05` | Volume needed to recover deposit |
| **LP Token Minting** | `feeWad × (LP_Supply / bBase)` | LP tokens per fee paid |

### 2.3 Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `LN2` | 0.693147 | Natural log of 2 |
| `PRE_GRAD_FEE_BPS` | 500 | 5% fee |
| `POST_GRAD_FEE_BPS` | 100 | 1% fee |
| `BBASE_SHARE_BPS` | 5000 | 50% to bBase growth |
| `LP_YIELD_SHARE_BPS` | 3000 | 30% to LP yield pool |
| `PROTOCOL_SHARE_BPS` | 2000 | 20% to protocol |
| `GRADUATION_MULTIPLIER` | 1 | Default (break-even) |

### 2.4 Liquidity Tiers

| Tier | Liquidity (b) | Creator Deposit | Graduation Threshold |
|------|---------------|-----------------|----------------------|
| Micro | $100 | $69 | $69 in fees |
| Small | $1,000 | $693 | $693 in fees |
| Medium | $10,000 | $6,930 | $6,930 in fees |
| Large | $100,000 | $69,300 | $69,300 in fees |

---

## 3. Creator Economics (Carol) 🎨

### 3.1 Overview

Creators bootstrap markets by depositing capital and become the initial LP. Their profit comes from fee accumulation, not from trading.

### 3.2 Influence Factors

| Factor | Impact | Weight | Description |
|--------|--------|--------|-------------|
| **Trading Volume** | Fee accumulation | ⭐⭐⭐⭐⭐ | #1 driver of returns |
| **Initial Deposit** | LP tokens received | ⭐⭐⭐⭐ | Larger = more ownership |
| **Time to Settlement** | Volume opportunity | ⭐⭐⭐ | More time = more trades |
| **Market Topic** | Trader interest | ⭐⭐⭐ | Trending = more volume |
| **Settlement Outcome** | Final LP value | ⭐⭐ | Affects redemption |

### 3.3 P&L Model (Simplified)

```
Creator Net P&L = LP_Redemption_Value - Initial_Deposit

Where:
  LP_Redemption_Value = (Your_LP / Total_LP) × Floor_Value
  Floor_Value = Total_Cash - Max_Liability
  Total_Cash = Deposit + All_Fees + LP_Yield_Pool
  Max_Liability = max(qYes_Outstanding, qNo_Outstanding)
```

### 3.4 Creator Journey

| Stage | Action | Financial Impact |
|-------|--------|------------------|
| **1. Create** | Deposit $693 for $1000 liquidity | -$693 USDC |
| **2. Receive LP** | Get 693 LP tokens (1:1 with deposit) | +693 LP |
| **3. Pre-Grad Volume** | $13,860 volume → $693 fees (5%) | LP value grows |
| **4. Graduate** | Threshold reached | Fee drops to 1% |
| **5. Post-Grad Volume** | $100k volume → $1k fees | 30% to LP yield |
| **6. Settlement** | Market resolves | Outcome determines final value |
| **7. Redeem** | Exchange LP for USDC | +$2,500 (example) |
| **Net Result** | | **+$1,807 profit** |

### 3.5 Break-Even Analysis

```
Break-Even Volume = Deposit / Pre_Grad_Fee_Rate
                  = $693 / 0.05
                  = $13,860

Interpretation:
- At $13,860 volume: Creator recovers initial deposit
- Above this: Pure profit (minus settlement liability)
- Below this: Partial loss (but LP floor protects)
```

### 3.6 Example: Carol's Market

**Setup**:
- Carol creates "Will ETH flip BTC by 2027?"
- Deposits $693 for $1,000 liquidity tier
- Receives 693 LP tokens

**Scenario A: High Volume ($250,000)**

| Phase | Volume | Fees | LP Value Growth |
|-------|--------|------|-----------------|
| Pre-Grad | $13,860 | $693 | +$693 (graduates) |
| Post-Grad | $236,140 | $2,361 | +$708 (30% to LP yield) |
| **Total** | $250,000 | $3,054 | |

**Final P&L**:
```
Deposit:        -$693
LP Redemption:  +$2,100 (estimated, depends on settlement)
Net Profit:     +$1,407 (203% ROI)
```

**Scenario B: Low Volume ($5,000)**

| Phase | Volume | Fees | LP Value Growth |
|-------|--------|------|-----------------|
| Pre-Grad | $5,000 | $250 | +$250 (doesn't graduate) |

**Final P&L**:
```
Deposit:        -$693
LP Redemption:  +$500 (estimated floor value)
Net Loss:       -$193 (28% loss)
```

### 3.7 Key Insight

> **Creators profit from VOLUME, not from predictions.** Carol doesn't need to trade or be right about the outcome—she earns as others trade. Her #1 job is to create markets that attract volume.

---

## 4. Gaming Trader Economics (Alice) 🎮

### 4.1 Overview

Gaming Traders participate early in markets to earn LP tokens from fees. This creates **asymmetric upside**: they can profit even when predictions are wrong.

### 4.2 Influence Factors

| Factor | Impact | Weight | Description |
|--------|--------|--------|-------------|
| **Entry Timing** | LP tokens per $ fee | ⭐⭐⭐⭐⭐ | Pre-grad = 5x more LP |
| **Market Volume After Entry** | LP appreciation | ⭐⭐⭐⭐ | More volume = more value |
| **Trade Size** | Absolute LP earned | ⭐⭐⭐ | Larger = more LP |
| **Prediction Accuracy** | Direct P&L | ⭐⭐⭐ | Win/lose on prediction |
| **LP Ownership %** | Share of yields | ⭐⭐ | Higher = more upside |

### 4.3 Fee → LP Conversion Mechanism

```
PRE-GRADUATION (5% fee):
┌─────────────────────────────────────────────────────────────┐
│ Trade $100 → Pay $5 fee (5%)                                │
│      ↓                                                      │
│ $5 adds to bBase (liquidity grows)                          │
│      ↓                                                      │
│ $5 worth of LP tokens minted TO THE TRADER                  │
│      ↓                                                      │
│ Trader now earns from all future trading activity!          │
└─────────────────────────────────────────────────────────────┘

POST-GRADUATION (1% fee):
┌─────────────────────────────────────────────────────────────┐
│ Trade $100 → Pay $1 fee (1%)                                │
│      ↓                                                      │
│ NO LP tokens minted                                         │
│ Fee split: 50% bBase | 30% LP Yield | 20% Protocol          │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 The Asymmetric Advantage

| Outcome | Traditional Platform | Sooth Protocol |
|---------|---------------------|----------------|
| **Win prediction** | +Payout | +Payout **+ LP tokens** |
| **Lose prediction** | -Stake (total loss) | -Stake **+ LP tokens** (cushioned) |
| **Market goes viral** | No benefit | **LP tokens appreciate** |

### 4.5 P&L Model (Simplified)

```
Gaming Trader Net P&L = Prediction_PnL + LP_Value

Where:
  Prediction_PnL = +Payout (if correct) OR -Stake (if wrong)
  LP_Value = LP_Tokens × LP_Appreciation_Multiplier
  LP_Appreciation = f(volume_after_entry, fee_rate)
```

### 4.6 Example: Alice's Journey

**Setup**:
- Alice trades $200 during pre-graduation
- Pays $10 fee (5%)
- Receives $10 worth of LP tokens

**After $50,000 Additional Volume**:
- LP tokens appreciate ~7x (simplified estimate)
- Her LP stake is now worth ~$70

**Scenario A: Alice is WRONG (market settles against her)**

| Component | Traditional | Sooth |
|-----------|-------------|-------|
| Prediction | -$200 | -$200 |
| LP Tokens | $0 | +$70 |
| **Net** | **-$200** | **-$130** |

> Alice **recovered 35%** of her loss through LP tokens!

**Scenario B: Alice is RIGHT (market settles in her favor)**

| Component | Traditional | Sooth |
|-----------|-------------|-------|
| Prediction | +$200 | +$200 |
| LP Tokens | $0 | +$70 |
| **Net** | **+$200** | **+$270** |

> Alice earns **EXTRA** from LP even when she wins!

### 4.7 Entry Timing Comparison

| Timing | Fee Rate | LP per $100 Trade | Advantage |
|--------|----------|-------------------|-----------|
| Pre-Graduation | 5% | $5 LP tokens | 5x more LP |
| Post-Graduation | 1% | $0 LP tokens | Lower fees |

### 4.8 Key Insight

> **Gaming Traders have asymmetric upside.** They can profit even when wrong because LP tokens provide a "safety net." The optimal strategy is to enter EARLY during the 5% fee phase to maximize LP accumulation.

---

## 5. Arbitrageur Economics (Bob) 🔄

### 5.1 Overview

Arbitrageurs capture spreads between the AMM and TickBook venues. They provide a SERVICE by tightening prices—it's efficiency provision, not extraction.

### 5.2 Influence Factors

| Factor | Impact | Weight | Description |
|--------|--------|--------|-------------|
| **Price Divergence** | Profit per trade | ⭐⭐⭐⭐⭐ | Larger spread = more profit |
| **Gas Costs** | Eats into margin | ⭐⭐⭐⭐ | Lower = better |
| **Trade Size** | Absolute profit | ⭐⭐⭐ | Larger = more profit |
| **Competition** | Convergence speed | ⭐⭐⭐ | More arbs = less opportunity |
| **Execution Speed** | Capture success | ⭐⭐ | Faster = better |

### 5.3 Arbitrage Mechanics

```
PRICE DIVERGENCE SCENARIO:
┌─────────────────────────────────────────────────────────────┐
│ AMM (LMSR):        YES = 62%                                │
│ TickBook:          YES best ask = 58%                       │
│ Spread:            4 cents per share                        │
└─────────────────────────────────────────────────────────────┘

ARBITRAGE EXECUTION:
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Buy 1,000 YES on TickBook @ 58¢ = $580              │
│ Step 2: Sell 1,000 YES on AMM @ 62¢ = $620                  │
│ Gross Profit: $620 - $580 = $40                             │
└─────────────────────────────────────────────────────────────┘

COSTS:
┌─────────────────────────────────────────────────────────────┐
│ Gas (2 transactions): ~$1.00                                │
│ AMM Fee (1% on sell): $6.20                                 │
│ Total Costs: $7.20                                          │
└─────────────────────────────────────────────────────────────┘

NET PROFIT: $40 - $7.20 = $32.80 (5.7% return)
```

### 5.4 P&L Model (Simplified)

```
Arbitrageur Net P&L = Gross_Spread - Gas_Cost - AMM_Fee

Where:
  Gross_Spread = Trade_Size × Price_Divergence
  Gas_Cost = fixed_cost_per_trade × 2
  AMM_Fee = Trade_Size × Sell_Price × 0.01
```

### 5.5 Minimum Viable Spread

```
Min_Spread = (Gas_Cost + AMM_Fee) / Trade_Size

Example ($5,000 trade, $1 gas):
  AMM_Fee = $5,000 × 0.62 × 0.01 = $31
  Min_Spread = ($1 + $31) / $5,000 = 0.64%

Below 0.64% spread → Not profitable
```

### 5.6 Sensitivity Analysis

| Spread | Gross | Costs | Net Profit | Viable? |
|--------|-------|-------|------------|---------|
| 0.5% | $25 | $26 | -$1 | ❌ No |
| 1.0% | $50 | $31 | +$19 | ✅ Yes |
| 2.0% | $100 | $36 | +$64 | ✅ Yes |
| 4.0% | $200 | $46 | +$154 | ✅ Yes |

### 5.7 Role in Ecosystem

```
┌─────────────────────────────────────────────────────────────┐
│                    ARBITRAGEUR'S ROLE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Before Arb:                After Arb:                      │
│  AMM: 62%   ←── 4% gap ──→  TickBook: 58%                  │
│                                                             │
│                    ↓ Arb trades ↓                           │
│                                                             │
│  AMM: 60%   ←── 1% gap ──→  TickBook: 59%                  │
│                                                             │
│  RESULT: Tighter spreads for ALL traders                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.8 Key Insight

> **Arbitrageurs are NOT extractive—they provide a service.** By capturing spreads, they force prices to converge between venues. This benefits all traders with tighter spreads and more efficient prices.

---

## 6. PvP Trader Economics (Dave) ⚔️

### 6.1 Overview

PvP (Player vs Player) Traders place limit orders on the TickBook, betting directly against other traders. There's NO LP safety net—winner takes all.

### 6.2 Influence Factors

| Factor | Impact | Weight | Description |
|--------|--------|--------|-------------|
| **Information Edge** | Win rate | ⭐⭐⭐⭐⭐ | Know something others don't |
| **Entry Price** | Profit multiple | ⭐⭐⭐⭐ | Better price = more upside |
| **Position Size** | Absolute P&L | ⭐⭐⭐ | Larger = more risk/reward |
| **Conviction Level** | Sizing decisions | ⭐⭐ | Higher = larger positions |
| **Counterparty Quality** | Win probability | ⭐⭐ | Weak = easier to beat |

### 6.3 PvP Mechanics

```
PURE BINARY OUTCOME:
┌─────────────────────────────────────────────────────────────┐
│ If CORRECT:  Payout = Shares × $1.00                        │
│ If WRONG:    Payout = $0.00                                 │
│                                                             │
│ NO LP safety net. NO fee-to-LP conversion.                  │
│ Winner takes all. Loser gets nothing.                       │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 P&L Model (Simplified)

```
PvP Net P&L = (Shares × $1) - Cost    if correct
            = -Cost                    if wrong

Where:
  Shares = Cost / Entry_Price
  Profit_If_Win = Shares - Cost
  Loss_If_Wrong = -Cost
```

### 6.5 Expected Value Formula

```
EV = (Win_Probability × Profit_If_Win) + (Lose_Probability × Loss_If_Wrong)

Example (Dave buys NO at 35%, believes true prob is 60%):
  Cost = $1,000
  Shares = $1,000 / 0.35 = 2,857 NO
  Profit_If_Win = 2,857 - 1,000 = $1,857
  Loss_If_Wrong = -$1,000

  EV = (0.60 × $1,857) + (0.40 × -$1,000)
  EV = $1,114 - $400
  EV = +$714 per trade

If Dave's probability estimate is correct, this is a +EV bet.
If he's WRONG about the probability, he could lose everything.
```

### 6.6 Example: Dave's Trade

**Setup**:
- Market: "Will Protocol X ship v2 by March?"
- Current price: YES 65%, NO 35%
- Dave's thesis: NO is undervalued (should be ~60%)

**Trade**:
- Buys $1,000 of NO at 35%
- Receives 2,857 NO shares

**Scenario A: Dave is RIGHT (NO wins)**

| Component | Value |
|-----------|-------|
| Cost | -$1,000 |
| Payout | +$2,857 |
| **Net Profit** | **+$1,857 (186% return)** 🚀 |

**Scenario B: Dave is WRONG (YES wins)**

| Component | Value |
|-----------|-------|
| Cost | -$1,000 |
| Payout | $0 |
| **Net Loss** | **-$1,000 (100% loss)** 💀 |

### 6.7 PvP vs Gaming Trader Comparison

| Dimension | PvP Trader (Dave) | Gaming Trader (Alice) |
|-----------|-------------------|----------------------|
| **Entry Point** | TickBook (post-grad) | AMM (pre-grad) |
| **LP Safety Net** | ❌ None | ✅ Yes (fee → LP) |
| **Upside if Right** | 🚀 186% (example) | 📈 +$270 (with LP) |
| **Downside if Wrong** | 💀 -100% total loss | 😊 -$130 (LP cushion) |
| **Best For** | High conviction + edge | Hedged exposure |
| **Skill Required** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

### 6.8 Key Insight

> **PvP Trading is PURE CONVICTION.** There's no LP cushion—you're betting directly against another human. If you don't have an edge (better information, analysis, or timing), you're the counterparty that smart money is betting against.

> ⚠️ **Warning**: If you're trading PvP without an edge, you are likely the "dumb money" in the trade.

---

## 7. Comparative Analysis

### 7.1 Archetype Decision Matrix

| If you... | Choose | Why |
|-----------|--------|-----|
| Want passive income from volume | 🎨 Creator | Earn without trading |
| Want prediction exposure with safety | 🎮 Gaming Trader | LP cushions losses |
| Have speed/infrastructure | 🔄 Arbitrageur | Capture spreads |
| Have strong conviction + edge | ⚔️ PvP Trader | Maximum upside |

### 7.2 Risk-Reward Spectrum

```
LOW RISK ←─────────────────────────────────────────→ HIGH RISK
         │                                              │
         │    Creator    Gaming      Arb      PvP       │
         │       🎨       Trader      🔄     Trader     │
         │               🎮                   ⚔️        │
         │                                              │
LOW UPSIDE ←───────────────────────────────────→ HIGH UPSIDE
```

### 7.3 Capital Efficiency Comparison

| Archetype | Capital Locked | Return Driver | Efficiency |
|-----------|----------------|---------------|------------|
| Creator | High (deposit) | Volume fees | Low |
| Gaming Trader | Medium (trades) | Prediction + LP | Medium |
| Arbitrageur | Low (per-trade) | Spread capture | High |
| PvP Trader | Medium (position) | Conviction | High |

### 7.4 Time Commitment

| Archetype | Active Time | Passive Time | Total |
|-----------|-------------|--------------|-------|
| Creator | Setup: 30min | Ongoing: 0 | Low |
| Gaming Trader | Per trade: 10min | Monitoring: 1hr/week | Low-Medium |
| Arbitrageur | Active monitoring | 24/7 automation | High |
| PvP Trader | Research: 2hr | Per trade: 30min | Medium |

---

## 8. Fee Flow Diagrams

### 8.1 Pre-Graduation Flow (5% fee)

```
                         TRADER TRADE
                              │
                              ▼
                        ┌───────────┐
                        │  5% FEE   │
                        └─────┬─────┘
                              │
                              │ 100%
                              ▼
                    ┌─────────────────────┐
                    │    bBase Growth     │
                    │  (liquidity depth)  │
                    └──────────┬──────────┘
                               │
                               │ 1:1 mint
                               ▼
                    ┌─────────────────────┐
                    │   LP TOKENS TO      │
                    │      TRADER         │
                    │  (becomes owner!)   │
                    └─────────────────────┘
```

### 8.2 Post-Graduation Flow (1% fee)

```
                         TRADER TRADE
                              │
                              ▼
                        ┌───────────┐
                        │  1% FEE   │
                        └─────┬─────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
     ┌───────────┐      ┌───────────┐      ┌───────────┐
     │    50%    │      │    30%    │      │    20%    │
     │  bBase    │      │ LP Yield  │      │ Protocol  │
     │  Growth   │      │   Pool    │      │ Treasury  │
     └───────────┘      └───────────┘      └───────────┘
           │                  │
           │                  │
           ▼                  ▼
     Deeper            Distributed to
     Liquidity         LP Token Holders
```

### 8.3 Settlement Flow

```
                      MARKET SETTLES
                            │
                            ▼
                   ┌────────────────┐
                   │ OUTCOME KNOWN  │
                   │  (YES/NO/INV)  │
                   └───────┬────────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
            ▼                             ▼
    ┌───────────────┐             ┌───────────────┐
    │ PREDICTION    │             │ LP TOKEN      │
    │ SETTLEMENT    │             │ REDEMPTION    │
    └───────┬───────┘             └───────┬───────┘
            │                             │
            ▼                             ▼
    Winners redeem              LPs redeem for
    outcome tokens              pro-rata share
    for $1 each                 of floor value
```

---

## 9. User Stories

### 9.1 Creator Stories

#### US-C1: Creator Launches Successful Market

```gherkin
GIVEN Carol has $1,000 USDC and market insight about ETH ecosystem
WHEN she creates a market "Will ETH flip BTC by 2027?" with $1,000 liquidity tier
THEN she deposits $693 USDC (b × ln(2))
AND she receives 693 LP tokens
AND the market is activated for trading

GIVEN the market attracts significant attention
WHEN traders generate $250,000 in volume over 6 months
THEN $693 in fees accumulates (graduation threshold)
AND the market graduates (fee drops to 1%)
AND additional $2,361 in fees accumulates

GIVEN the market settles YES
WHEN Carol redeems her LP tokens
THEN she receives approximately $2,100 USDC
AND her net profit is $1,407 (203% ROI)
```

#### US-C2: Creator's Market Has Low Volume

```gherkin
GIVEN Carol creates a niche market about "Will Protocol X reach 1M users?"
WHEN only $5,000 in volume occurs before deadline
THEN only $250 in fees accumulates
AND the market does NOT graduate

GIVEN the market settles
WHEN Carol redeems her LP tokens
THEN she receives approximately $500 USDC (floor value)
AND her net loss is $193 (28% loss)
AND she learns to choose more popular topics next time
```

#### US-C3: Creator Adds Liquidity Post-Launch

```gherkin
GIVEN Carol's market is performing well
WHEN she wants to increase her ownership stake
THEN she calls increaseBBase() with additional $500 USDC
AND she receives additional LP tokens
AND the market has deeper liquidity for traders
```

### 9.2 Gaming Trader Stories

#### US-GT1: Trader Wins Prediction and Earns LP

```gherkin
GIVEN Alice discovers "Will BTC hit $100k in 2026?" at 40% YES
WHEN she trades $500 on YES during pre-graduation phase
THEN she pays $25 fee (5%)
AND she receives $25 worth of LP tokens
AND she holds 500 YES shares

GIVEN the market generates $100,000 additional volume
WHEN her LP tokens appreciate 5x
THEN her LP stake is worth $125

GIVEN BTC hits $100k and market settles YES
WHEN Alice redeems
THEN she receives $500 from winning prediction
AND she receives approximately $125 from LP redemption
AND her total return is $625 on $500 investment (25% profit)
```

#### US-GT2: Trader Loses Prediction but Recovers via LP

```gherkin
GIVEN Alice trades $200 on YES during pre-graduation
WHEN she pays $10 fee (5%)
THEN she receives $10 worth of LP tokens

GIVEN the market generates $50,000 volume
WHEN her LP tokens appreciate to $70
THEN she has dual exposure: prediction + LP

GIVEN the market settles NO (Alice's prediction is WRONG)
WHEN she calculates her P&L
THEN prediction loss is -$200
AND LP redemption is +$70
AND net loss is only $130 (35% recovered through LP)
```

#### US-GT3: Trader Enters Post-Graduation

```gherkin
GIVEN a market has already graduated (1% fee)
WHEN Bob trades $500 on NO
THEN he pays $5 fee (1%)
AND he receives NO LP tokens (post-graduation)
AND he only has prediction exposure

GIVEN the market settles NO
WHEN Bob redeems
THEN he receives $500 payout
AND he has no LP bonus
AND his profit is standard prediction return
```

### 9.3 Arbitrageur Stories

#### US-A1: Arbitrageur Captures AMM/TickBook Spread

```gherkin
GIVEN AMM prices YES at 62%
AND TickBook has YES ask at 58%
AND spread is 4% (opportunity exists)

WHEN Bob executes arbitrage with $5,000 capital
THEN he buys 8,620 YES on TickBook for $5,000
AND he sells 8,620 YES on AMM for $5,345
AND gross profit is $345

GIVEN gas costs $2 and AMM fee is $53
WHEN Bob calculates net profit
THEN net profit is $290 (5.8% return)
AND market prices have converged to ~60%
AND all traders benefit from tighter spreads
```

#### US-A2: Arbitrage Fails Due to Gas Spike

```gherkin
GIVEN AMM prices YES at 51%
AND TickBook has YES ask at 50%
AND spread is only 1%

WHEN network congestion causes gas to spike to $10
AND Bob attempts arbitrage with $1,000 capital
THEN gross profit would be $10
AND costs would be $20+ (gas + AMM fee)

WHEN Bob's bot evaluates profitability
THEN it correctly rejects the trade
AND Bob waits for better opportunity
```

### 9.4 PvP Trader Stories

#### US-PVP1: PvP Trader Wins Direct Bet

```gherkin
GIVEN Dave believes "Protocol X v2 by March" is overestimated at 65% YES
WHEN he analyzes the team's GitHub activity and finds delays
THEN he forms thesis: true probability is 40% YES / 60% NO

WHEN Dave places limit sell 1,000 NO at 36% on TickBook
AND Charlie (who believes opposite) places limit buy at 36%
THEN orders match directly at 36%
AND no AMM fee is charged (PvP trade)

GIVEN Protocol X delays v2 launch and market settles NO
WHEN settlement occurs
THEN Dave's 2,778 NO shares pay $2,778
AND Dave's net profit is $1,778 (178% return)
AND Charlie loses his $1,000 stake entirely
```

#### US-PVP2: PvP Trader Loses Due to Wrong Thesis

```gherkin
GIVEN Dave believes NO at 35% is undervalued
WHEN he buys $1,000 of NO shares (2,857 shares)
AND he has conviction but no real information edge

GIVEN insiders know Protocol X will actually ship on time
WHEN market settles YES
THEN Dave's NO shares are worth $0
AND Dave loses entire $1,000 stake
AND he learns PvP trading requires actual edge, not just conviction
```

---

## 10. Risk Matrices

### 10.1 Creator Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Low Volume** | Medium | High | Choose trending topics; promote market |
| **Settlement Imbalance** | Low | Medium | LP floor provides minimum value |
| **Smart Contract Bug** | Low | Critical | Protocol is audited |
| **Adjudicator Dispute** | Low | Medium | Guardian veto protects |
| **Topic Becomes Irrelevant** | Low | Medium | Choose timeless questions |

### 10.2 Gaming Trader Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Wrong Prediction** | Medium | Medium | LP tokens cushion loss |
| **Late Entry (Post-Grad)** | N/A | Low | Enter early for LP bonus |
| **Low Market Volume** | Medium | Low | Diversify across markets |
| **Illiquidity at Exit** | Low | Medium | Use limit orders |

### 10.3 Arbitrageur Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Gas Spike** | Medium | Medium | Set profit thresholds |
| **Price Moves During Arb** | Low | High | Atomic execution |
| **High Competition** | Medium | Medium | Speed optimization |
| **Smart Contract Risk** | Low | High | Use audited venues only |

### 10.4 PvP Trader Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Wrong Thesis** | Medium | Critical | Only trade with edge |
| **No Edge** | High | Critical | Don't PvP trade! |
| **Counterparty is Smarter** | Medium | High | Information gathering |
| **Illiquid Exit** | Medium | Medium | Limit order management |
| **Overconfidence** | High | Critical | Position sizing discipline |

### 10.5 LP Floor Protection Explanation

```
LP FLOOR FORMULA:
┌─────────────────────────────────────────────────────────────┐
│  Floor = Cash - max(qYes, qNo)                              │
│                                                             │
│  Example:                                                   │
│  • Vault has $10,000 cash                                   │
│  • 8,000 YES shares outstanding                             │
│  • 6,000 NO shares outstanding                              │
│                                                             │
│  Floor = $10,000 - $8,000 = $2,000                          │
│                                                             │
│  Interpretation:                                            │
│  Even in the WORST case (YES wins, all 8k shares redeem),   │
│  LPs are guaranteed at least $2,000 total redemption value. │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Appendix

### 11.1 Glossary

| Term | Definition |
|------|------------|
| **bBase** | Liquidity parameter for LMSR pricing |
| **LP Token** | Ownership stake in market liquidity |
| **Graduation** | Transition from 5% to 1% fee |
| **Floor Value** | Minimum guaranteed LP redemption |
| **T*** | Timestamp when outcome became true |
| **WAD** | 18 decimal fixed-point (1e18) |

### 11.2 Formula Reference

| Formula | Expression | Use |
|---------|------------|-----|
| Deposit | `b × 0.693` | Creator initial cost |
| Graduation | `deposit × multiplier` | Fee reduction threshold |
| Break-even | `deposit / 0.05` | Volume to recover deposit |
| LP Floor | `cash - max(qYes, qNo)` | Minimum redemption |
| Arb Profit | `spread × size - gas - fee` | Arb P&L |
| PvP EV | `p(win) × profit + p(lose) × loss` | Expected value |

### 11.3 Contract References

| Contract | Function | Archetype |
|----------|----------|-----------|
| LaunchpadEngine | `createMarket()` | Creator |
| LaunchpadEngine | `tradePositions()` | Gaming Trader |
| Collateralizer | `split()` | Arbitrageur |
| TickBook | `placeOrder()` | PvP Trader, Arbitrageur |
| LaunchpadEngine | `redeemLP()` | Creator, Gaming Trader |

### 11.4 External References

- [Sooth Whitepaper](../../apps/web/public/sooth_whitepaper.md)
- [LaunchpadEngine Documentation](../V10/contracts/06-LaunchpadEngine.md)
- [LMSR Pricing Model](../V10/contracts/04-AMMEngine.md)

---

**Document Status**: Draft  
**Next Review**: After UI implementation  
**Owner**: Sooth Protocol Team
