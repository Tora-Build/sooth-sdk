# V8.1 Actor Flow Diagrams

> Visual documentation of Sooth Protocol V8.1 architecture, actors, and data flows.

---

## 🏛️ 1. Contract Architecture

```mermaid
graph TB
    subgraph "Core Contracts (V8.1)"
        TM[TruthMarket<br/>Lifecycle & Settlement]
        AMM[AMMEngine<br/>LMSR Trading]
        LP[LaunchpadEngine<br/>Creator Economics]
        COL[Collateralizer<br/>Token Split/Merge]
        OT[OutcomeToken<br/>YES/NO ERC20]
    end

    subgraph "External"
        USDC[(USDC)]
        TREASURY[Protocol Treasury]
    end

    LP -->|initializeMarket| AMM
    LP -->|tradePositions| AMM
    LP -->|reads isLive| TM
    AMM -->|reads isLive| TM
    COL -->|deploys| OT
    COL -->|reads tStar| TM
    LP -->|fee split| TREASURY
    LP <-->|transfers| USDC
    AMM <-->|available balance| USDC
    COL <-->|split/redeem| USDC

    style LP fill:#e1f5fe,stroke:#0288d1,color:#01579b
    style AMM fill:#fff3e0,stroke:#ff9800,color:#e65100
    style TM fill:#e8f5e9,stroke:#4caf50,color:#1b5e20
    style COL fill:#fce4ec,stroke:#e91e63,color:#880e4f
    style OT fill:#f3e5f5,stroke:#9c27b0,color:#4a148c
    style USDC fill:#e0f2f1,stroke:#009688,color:#004d40
    style TREASURY fill:#fff8e1,stroke:#ffc107,color:#ff6f00
```

---

## 👥 2. Actor Roles & Permissions

```mermaid
graph LR
    subgraph "Traders"
        AMM_TRADER[🐢 AMM Trader<br/>Retail / Hedger]
        OB_TRADER[⚡ TickBook Trader<br/>HFT / Arbitrageur]
    end

    subgraph "Operators"
        CREATOR[🎨 Creator]
        ADJ[⚖️ Adjudicator]
        GUARD[🛡️ Guardian]
        OWNER[👑 Owner]
    end

    subgraph "TruthMarket"
        TM_ACT[activate]
        TM_SET[settle]
        TM_FIN[finalize]
        TM_VETO[veto]
    end

    subgraph "LaunchpadEngine (AMM)"
        LP_INIT[initializeMarket]
        LP_TRADE[tradePositions]
        LP_REDEEM[redeemLP]
        LP_CONFIG[setFees]
    end

    subgraph "Collateralizer (TickBook)"
        COL_SPLIT[split]
        COL_MERGE[merge]
        COL_REDEEM[redeem]
    end

    CREATOR -->|owns| TM_ACT
    CREATOR -->|deposits| LP_INIT
    CREATOR -->|earns| LP_REDEEM
    
    ADJ -->|resolves| TM_SET
    GUARD -->|protects| TM_VETO
    GUARD -->|confirms| TM_FIN
    
    AMM_TRADER -->|buys/sells| LP_TRADE
    
    OB_TRADER -->|mints tokens| COL_SPLIT
    OB_TRADER -->|burns pairs| COL_MERGE
    OB_TRADER -->|settles| COL_REDEEM
    
    OWNER -->|governs| LP_CONFIG

    style AMM_TRADER fill:#bbdefb,stroke:#1976d2,color:#0d47a1
    style OB_TRADER fill:#ffe0b2,stroke:#f57c00,color:#e65100
    style CREATOR fill:#c8e6c9,stroke:#388e3c,color:#1b5e20
    style ADJ fill:#fff9c4,stroke:#fbc02d,color:#f57f17
    style GUARD fill:#ffccbc,stroke:#e64a19,color:#bf360c
    style OWNER fill:#e1bee7,stroke:#7b1fa2,color:#4a148c
```

---

## 🐢⚡ 2b. Two Trader Archetypes

The V8.1 dual-venue architecture serves **fundamentally different trader profiles**:

```mermaid
graph TB
    subgraph "🐢 AMM Trader (Retail)"
        AMM_WHO[Who: Retail users, hedgers, speculators]
        AMM_FREQ[Frequency: Low (LFT)]
        AMM_GOAL[Goal: Express opinion, hedge risk]
        AMM_SIZE[Size: Small to medium]
        AMM_TOOL[Tool: LaunchpadEngine]
        AMM_ASSET[Asset: Positions ledger entries]
        AMM_LOCK[Constraint: 24h sell lock]
    end

    subgraph "⚡ TickBook Trader (Pro)"
        OB_WHO[Who: Market makers, arbitrageurs, bots]
        OB_FREQ[Frequency: High (HFT)]
        OB_GOAL[Goal: Price discovery, arbitrage]
        OB_SIZE[Size: Large, rapid]
        OB_TOOL[Tool: Collateralizer + TickBook]
        OB_ASSET[Asset: ERC20 OutcomeTokens]
        OB_LOCK[Constraint: None - instant transfer]
    end

    style AMM_WHO fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
    style AMM_FREQ fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
    style AMM_GOAL fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
    style AMM_SIZE fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
    style AMM_TOOL fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
    style AMM_ASSET fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
    style AMM_LOCK fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
    
    style OB_WHO fill:#fff3e0,stroke:#ff9800,color:#e65100
    style OB_FREQ fill:#fff3e0,stroke:#ff9800,color:#e65100
    style OB_GOAL fill:#fff3e0,stroke:#ff9800,color:#e65100
    style OB_SIZE fill:#fff3e0,stroke:#ff9800,color:#e65100
    style OB_TOOL fill:#fff3e0,stroke:#ff9800,color:#e65100
    style OB_ASSET fill:#fff3e0,stroke:#ff9800,color:#e65100
    style OB_LOCK fill:#fff3e0,stroke:#ff9800,color:#e65100
```

### Comparison Table

| Dimension | 🐢 AMM Trader | ⚡ TickBook Trader |
|-----------|--------------|-------------------|
| **Profile** | Retail, hedgers, opinion traders | MMs, arbitrageurs, HFT bots |
| **Frequency** | Low (hours/days) | High (seconds/blocks) |
| **Primary Goal** | Express view, hedge exposure | Price discovery, capture spreads |
| **Trade Size** | Small-medium (retail) | Large (institutional) |
| **Entry Point** | `LaunchpadEngine.tradePositions()` | `Collateralizer.split()` → TickBook |
| **Asset Type** | Non-transferable positions | Transferable ERC20 tokens |
| **Liquidity** | LMSR curve (always available) | Limit orderbook (depth varies) |
| **Sell Constraint** | 24h lock on proceeds | Instant (token transfer) |
| **Fee Model** | 5% pre-grad / 1% post-grad | Maker-taker spreads |
| **Settlement** | Automatic via position | Explicit token redemption |
| **UX Priority** | Simplicity, one-click trades | Speed, API access, depth |

### Why Two Venues?

```mermaid
flowchart LR
    subgraph "Market Evolution"
        LAUNCH[🚀 Launch<br/>AMM Only]
        GROW[📈 Growth<br/>AMM + TickBook]
        MATURE[🏛️ Mature<br/>TickBook Dominant]
    end

    LAUNCH -->|Graduation| GROW
    GROW -->|Volume shifts| MATURE

    subgraph "AMM Role"
        AMM_EARLY[Bootstrap liquidity]
        AMM_LATE[Retail access, tail]
    end

    subgraph "TickBook Role"
        OB_EARLY[Price discovery]
        OB_LATE[Institutional volume]
    end

    LAUNCH --> AMM_EARLY
    GROW --> AMM_LATE
    GROW --> OB_EARLY
    MATURE --> OB_LATE

    style LAUNCH fill:#c8e6c9,stroke:#388e3c,color:#1b5e20
    style GROW fill:#fff9c4,stroke:#fbc02d,color:#f57f17
    style MATURE fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
```

**Pre-Graduation**: AMM bootstraps liquidity, TickBook disabled  
**Post-Graduation**: Both venues active, arbitrageurs keep prices aligned  
**Mature Market**: TickBook handles institutional flow, AMM serves retail tail

---

## 💱 3. AMM Trading Flow (🐢 Retail Trader)

> **Actor**: Retail user expressing opinion or hedging risk

```mermaid
sequenceDiagram
    participant U as 🐢 AMM Trader
    participant FE as Frontend
    participant USDC as USDC Token
    participant LP as LaunchpadEngine
    participant AMM as AMMEngine
    participant TM as TruthMarket

    U->>FE: Enter shares amount (10,000)
    FE->>AMM: getPositionQuote(market, +10000 WAD)
    AMM-->>FE: cost = 5000 WAD, newPrice = 0.6

    Note over FE: Calculate:<br/>fee = cost × 5%<br/>maxCost = (cost + fee) × 1.01

    FE->>USDC: allowance(user, LP)
    USDC-->>FE: current allowance

    alt Allowance < maxCost
        FE->>U: Request approval
        U->>USDC: approve(LP, maxCost)
    end

    U->>LP: tradePositions(market, +10000 WAD, maxCost)
    LP->>TM: isLive()?
    TM-->>LP: true
    LP->>AMM: tradePositions(market, +10000 WAD, maxCost)
    AMM->>AMM: Calculate LMSR cost
    AMM->>AMM: Credit position to user
    AMM-->>LP: actualCost
    
    LP->>LP: Calculate fee (5% pre-grad)
    LP->>LP: Update bCurrent, feesAccrued
    LP->>LP: Mint LP tokens to creator
    LP->>USDC: safeTransferFrom(user, LP, totalCost)
    
    LP-->>FE: PositionTraded event
    FE-->>U: ✅ Trade complete
```

---

## ⚡ 3b. TickBook Trading Flow (Pro Trader)

> **Actor**: Market maker or arbitrageur seeking price discovery and spread capture

```mermaid
sequenceDiagram
    participant U as ⚡ TickBook Trader
    participant USDC as USDC Token
    participant COL as Collateralizer
    participant OT as OutcomeTokens
    participant TB as TickBook
    participant TM as TruthMarket

    Note over U: Step 1: Mint tokens via split
    U->>USDC: approve(Collateralizer, 1000 USDC)
    U->>COL: split(market, 1000 WAD)
    COL->>USDC: transferFrom(user, 1000)
    COL->>OT: mint YES + NO to user (1000 each)

    Note over U: Step 2: Place limit order
    U->>TB: placeOrder(market, YES, 0.55, 500, isBuy=false)
    TB->>TB: Add to orderbook at tick 55

    Note over U: Step 3: Order gets filled by taker
    participant T as Taker
    T->>TB: takeOrder(orderId)
    TB->>OT: transfer YES tokens
    TB->>USDC: transfer payment

    Note over U: Step 4: Arbitrage if AMM mispriced
    alt AMM price < TickBook price
        U->>LP: Buy cheap on AMM
        U->>TB: Sell expensive on TickBook
    else AMM price > TickBook price
        U->>TB: Buy cheap on TickBook
        U->>LP: Sell expensive on AMM
    end

    Note over U: Step 5: Settlement
    TM->>TM: Market settles (YES wins)
    U->>COL: redeem(market)
    COL->>OT: burn YES tokens
    COL->>USDC: transfer 1 USDC per YES
```

### Key Differences from AMM Trading

| Aspect | AMM (🐢) | TickBook (⚡) |
|--------|----------|--------------|
| **Entry** | Direct trade | Split USDC → tokens first |
| **Asset** | Position ledger | ERC20 tokens (transferable) |
| **Pricing** | LMSR formula | Limit orderbook |
| **Execution** | Instant (vs curve) | Depends on depth |
| **Fees** | 5%/1% protocol fee | Maker-taker spread |
| **Sell Lock** | 24h on proceeds | None (instant transfer) |
| **Best For** | Retail, one-click | MMs, arb bots, API |

---

## 💸 4. AMM Sell Flow (🐢 With 24h Lock)

> **Constraint**: Sell proceeds are locked for 24 hours to prevent manipulation

```mermaid
sequenceDiagram
    participant U as 🐢 AMM Trader
    participant LP as LaunchpadEngine
    participant AMM as AMMEngine

    U->>LP: tradePositions(market, -5000 WAD, 0)
    LP->>AMM: tradePositions(market, -5000 WAD, 0)
    
    AMM->>AMM: Check position ≥ 5000
    AMM->>AMM: Calculate sell proceeds
    AMM->>AMM: Deduct position
    AMM->>AMM: Add proceeds to availableBalance
    AMM->>AMM: Add to lockQueue (24h)
    
    AMM-->>LP: actualProceeds
    LP->>LP: Calculate fee
    LP-->>U: PositionTraded event

    Note over U,AMM: 24 hours later...

    U->>AMM: claimProceeds()
    AMM->>AMM: Process expired locks
    AMM->>AMM: Move to withdrawable
    AMM-->>U: claimable amount

    U->>AMM: withdraw(amount)
    AMM->>U: USDC transfer
```

---

## 🎓 5. Graduation & Fee Flow

```mermaid
flowchart TB
    subgraph "Pre-Graduation (5% Fee)"
        PRE_FEE[5% of trade cost]
        PRE_B[100% → bBase growth]
        PRE_LP[1:1 LP tokens minted]
    end

    subgraph "Post-Graduation (1% Fee)"
        POST_FEE[1% of trade cost]
        POST_B[50% → bBase growth]
        POST_LP[30% → LP yield pool]
        POST_PROTO[20% → Protocol treasury]
    end

    subgraph "Graduation Check"
        CHECK{bCurrent ≥<br/>2 × bBase?}
    end

    TRADE[Trade Executed] --> CHECK
    CHECK -->|No| PRE_FEE
    CHECK -->|Yes| POST_FEE
    
    PRE_FEE --> PRE_B
    PRE_B --> PRE_LP

    POST_FEE --> POST_B
    POST_FEE --> POST_LP
    POST_FEE --> POST_PROTO

    style CHECK fill:#fff9c4,stroke:#fbc02d,color:#f57f17
    style PRE_FEE fill:#e8f5e9,stroke:#4caf50,color:#1b5e20
    style POST_FEE fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
    style TRADE fill:#f5f5f5,stroke:#616161,color:#212121
    style PRE_B fill:#e8f5e9,stroke:#4caf50,color:#1b5e20
    style PRE_LP fill:#e8f5e9,stroke:#4caf50,color:#1b5e20
    style POST_B fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
    style POST_LP fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
    style POST_PROTO fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
```

---

## 🔄 6. Market Lifecycle

```mermaid
stateDiagram-v2
    [*] --> CREATED: Creator deploys TruthMarket
    
    CREATED --> LIVE: creator.activate()
    LIVE --> LIVE: Trading active
    
    LIVE --> SETTLING: deadline passed
    SETTLING --> SETTLED: adjudicator.settle(outcome, tStar)
    
    SETTLED --> FINALIZED: guardian.finalize()
    SETTLED --> SETTLED: guardian.veto()
    
    FINALIZED --> [*]: Redemptions enabled

    note right of CREATED
        Creator deposits USDC
        LP initializes AMM
    end note

    note right of LIVE
        Traders buy/sell
        Fees collected
        Graduation check
    end note

    note right of SETTLED
        24h veto window
        Guardian oversight
    end note

    note right of FINALIZED
        Winners redeem
        LP claims yield
    end note
```

---

## 🏠 7. Frontend Component Flow

```mermaid
flowchart TB
    subgraph "Pages"
        MARKETS[/markets/]
        DETAIL[/market/:id/]
        PORT[/portfolio/]
        OP[/operator/]
    end

    subgraph "V8 Hooks"
        H_TM[useTruthMarketDirect]
        H_AMM[useAmmMarketDirect]
        H_LP[useLaunchpadMarketDirect]
        H_COL[useCollateralizerDirect]
        H_QUOTE[useAMMQuoteDirect]
        H_BAL[useAvailableBalance]
        H_LOCK[useLockQueue]
    end

    subgraph "Components"
        STATS[AMMStatsCard]
        PANEL[SimpleTradingPanel]
        POS[AMMPositionCard]
        SETTLE[AMMSettlementCard]
        FORMULA[AMMFormulasCard]
        PROCEEDS[ProceedsManagement]
        CREATOR[CreatorDashboard]
    end

    DETAIL --> H_TM & H_AMM & H_LP
    DETAIL --> STATS & PANEL & POS

    PANEL --> H_QUOTE
    PANEL --> H_BAL

    POS --> H_COL
    POS --> PROCEEDS
    PROCEEDS --> H_LOCK

    PORT --> H_AMM & H_COL

    OP --> H_LP
    OP --> CREATOR & SETTLE

    style PANEL fill:#e3f2fd,stroke:#1976d2,color:#0d47a1
    style H_QUOTE fill:#fff3e0,stroke:#ff9800,color:#e65100
    style DETAIL fill:#f3e5f5,stroke:#9c27b0,color:#4a148c
    style STATS fill:#e8f5e9,stroke:#4caf50,color:#1b5e20
    style POS fill:#e8f5e9,stroke:#4caf50,color:#1b5e20
    style PROCEEDS fill:#fce4ec,stroke:#e91e63,color:#880e4f
    style CREATOR fill:#fff9c4,stroke:#fbc02d,color:#f57f17
```

---

## 📊 8. Data Flow Summary

```mermaid
graph LR
    subgraph "Read Path"
        RPC[Base Sepolia RPC]
        PUB[publicClient]
        HOOK[React Query + Direct Hooks]
        UI[UI Components]
    end

    subgraph "Write Path"
        BTN[Trade Button]
        WAGMI[Wagmi writeContract]
        WALLET[MetaMask]
        TX[Transaction]
    end

    RPC --> PUB --> HOOK --> UI
    BTN --> WAGMI --> WALLET --> TX --> RPC

    style HOOK fill:#c8e6c9,stroke:#388e3c,color:#1b5e20
    style WAGMI fill:#bbdefb,stroke:#1976d2,color:#0d47a1
    style RPC fill:#f5f5f5,stroke:#616161,color:#212121
    style UI fill:#fff3e0,stroke:#ff9800,color:#e65100
    style WALLET fill:#fff9c4,stroke:#fbc02d,color:#f57f17
    style TX fill:#fce4ec,stroke:#e91e63,color:#880e4f
```

---

## 📋 Architecture Reference Table

| Layer | Contract | Trader Type | Responsibility |
|-------|----------|-------------|---------------|
| **Lifecycle** | `TruthMarket` | All | Question, deadline, settlement, roles |
| **AMM Trading** | `AMMEngine` | 🐢 Retail | LMSR pricing, positions, 24h locks |
| **Economics** | `LaunchpadEngine` | 🐢 Retail | Fees, LP tokens, graduation |
| **Token Ops** | `Collateralizer` | ⚡ Pro | Token split/merge, redemption |
| **Orderbook** | `TickBook` | ⚡ Pro | Limit orders, matching engine |
| **Tokens** | `OutcomeToken` | ⚡ Pro | Transferable ERC20 (OB-domain only) |

---

## 🎯 Key Design Principles

1. **Dual Trader Architecture**
   - 🐢 **AMM Traders** (Retail) → LaunchpadEngine → Non-transferable positions
   - ⚡ **TickBook Traders** (Pro) → Collateralizer → Transferable ERC20 tokens
   - Different constraints, fees, and UX for each archetype
   - Arbitrageurs bridge the two venues, keeping prices aligned

2. **Separation of Concerns**
   - `TruthMarket` = Source of truth (lifecycle only)
   - `AMMEngine` = Pure trading math (no economics)
   - `LaunchpadEngine` = Creator incentives wrapper
   - `Collateralizer` = Orderbook-domain token operations

3. **Pure WAD Architecture**
   - All internal math uses 18 decimals (WAD)
   - Conversion to token decimals only at transfer boundary
   - Consistent precision across all contracts

4. **Lock-on-Sell Model (AMM Only)**
   - Sell proceeds locked for 24 hours
   - Spendable immediately for new trades
   - Withdrawable after lock expires
   - TickBook has no lock (instant token transfer)

5. **Two-Phase Fee Model**
   - Pre-graduation: 5% → 100% to liquidity growth
   - Post-graduation: 1% → split (50/30/20)

---

*Generated: 2025-12-25 | Version: V8.1*

