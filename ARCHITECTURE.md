# Sooth Protocol Architecture

**Version:** 10.8  
**Status:** Alpha (Testnet Deployments)  
**Last Updated:** 2026-01-11

---

## V10 Changes (Unified Crossing)

V10 introduces **Unified Crossing**, merging Spot Sells and Range Orders into a single liquidity layer:

| Change | Impact |
|--------|--------|
| Unified `placeOrder` | Replaces separate range and market order functions |
| Spot Priority | Takers automatically get best price (Spot > Range) |
| Dual-Collateral Vault | Native support for both USDC and outcome tokens in TickBook |
| Atomic Creation | Markets are created and initialized in a single transaction |
| Package Split | Split into `contracts-core` (audit) and `contracts-testing` (QA) |

**Contract**: `TickBookPoolManager.sol` (V10 Unified Crossing)

---

## Executive Summary

Sooth Protocol is a decentralized prediction market platform with a **dual-venue architecture** combining:
1. **AMM (Automated Market Maker)** - LMSR-based continuous pricing for retail trading
2. **TickBook (Orderbook)** - Uniswap V3-style concentrated range orders for professional trading

The protocol uses a **Launchpad model** for market creation, where creators provide initial liquidity and earn LP tokens. Markets "graduate" from the bonding phase to full trading once sufficient fees accumulate.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SOOTH PROTOCOL V10.8                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      FRONTEND (apps/web)                            │   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│   │  │  Trade   │  │   Pro    │  │ Portfolio│  │  Create  │            │   │
│   │  │  (AMM)   │  │(TickBook)│  │          │  │(Launchpad│            │   │
│   │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│   └───────┼─────────────┼─────────────┼─────────────┼───────────────────┘   │
│           │             │             │             │                       │
│           └──────────────────┬────────────────────────                      │
│                              │                                              │
│   ┌──────────────────────────▼──────────────────────────────────────────┐   │
│   │                    SMART CONTRACTS (packages/contracts-core)        │   │
│   │                                                                      │   │
│   │   ┌─────────────────┐         ┌─────────────────────────────────┐   │   │
│   │   │ LaunchpadEngine │─────────│ Creator Economics Layer         │   │   │
│   │   │  (Router)       │         │ • Atomic market creation        │   │   │
│   │   └────────┬────────┘         │ • Fee collection & graduation   │   │   │
│   │            │                  │ • LP token management           │   │   │
│   │   ┌────────▼────────┐         └─────────────────────────────────┘   │   │
│   │   │   AMMEngine     │         ┌─────────────────────────────────┐   │   │
│   │   │  (LMSR AMM)     │         │ Pure Trading Logic              │   │   │
│   │   └────────┬────────┘         │ • Dual-balance position model   │   │   │
│   │            │                  │ • 24h sell lock mechanism       │   │   │
│   │   ┌────────▼────────┐         └─────────────────────────────────┘   │   │
│   │   │  TruthMarket    │         ┌─────────────────────────────────┐   │   │
│   │   │  (Lifecycle)    │         │ Settlement Authority            │   │   │
│   │   └─────────────────┘         │ • Market states (LIVE→SETTLED)  │   │   │
│   │                               │ • Adjudicator-based resolution  │   │   │
│   │   ┌─────────────────┐         └─────────────────────────────────┘   │   │
│   │   │TickBookPoolMgr  │         ┌─────────────────────────────────┐   │   │
│   │   │  (V10 Unified)  │         │ V10 Unified Orderbook           │   │   │
│   │   └────────┬────────┘         │ • Unified placeOrder API        │   │   │
│   │            │                  │ • Spot + Range crossing         │   │   │
│   │   ┌────────▼────────┐         │ • O(overlap) spot search        │   │   │
│   │   │  TickBookVault  │         └─────────────────────────────────┘   │   │
│   │   │ (Fund Custody)  │                                               │   │
│   │   └─────────────────┘                                               │   │
│   │                                                                      │   │
│   │   ┌─────────────────┐         ┌─────────────────────────────────┐   │   │
│   │   │  Collateralizer │         │ Token Operations                │   │   │
│   │   │                 │─────────│ • Split: USDC → YES + NO        │   │   │
│   │   └─────────────────┘         │ • Merge: YES + NO → USDC        │   │   │
│   │                               └─────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
sooth-alpha/
├── apps/
│   └── web/                          # Frontend dApp (Vite + React)
│       ├── src/
│       │   ├── components/           # React components
│       │   ├── config/               # ABIs + deployments.json
│       │   ├── hooks/                # React hooks (flat structure)
│       │   ├── lib/                  # Utilities (wagmi, math, formatting)
│       │   ├── pages/                # Route pages
│       │   └── store/                # Zustand state management
│       └── docs/                     # Frontend specifications
│
├── packages/
│   ├── contracts-core/               # Core Solidity contracts (Audit Scope)
│   │   ├── src/                      # TickBookPoolManager, LaunchpadEngine, etc.
│   │   ├── script/                   # Multi-chain deployment scripts
│   │   ├── deployments/              # Canonical addresses (baseSepolia.json, etc.)
│   │   └── abi/                      # Generated ABIs
│   ├── contracts-testing/            # QA & Testing package
│   │   ├── test/                     # V10 Forge test suites
│   │   └── script/                   # Interactive CLI & benchmarks
│   └── indexer/                      # Ponder indexer for orderbook data
│
├── .agent/                           # Agent workflows & knowledge
├── package.json                      # Workspace root
├── pnpm-workspace.yaml               # pnpm workspace config
├── turbo.json                        # Turborepo build pipeline
├── STATUS.md                         # Current project state
├── CHANGELOG.md                      # Version history
└── DECISIONS.md                      # Architecture Decision Records (ADRs)
```

---

## Core Contracts

### 1. LaunchpadEngine (Router)
**Purpose:** Creator economics and market lifecycle management

```solidity
// Key Functions
createMarket(...)                   // Atomic market creation (deploys TruthMarket)
tradePositions(market, outcome, deltaShares, maxCost) // Execute trades
redeemLP(market)                    // LP redemption

// State
marketInfos[market] → {creator, bBase, feesAccrued, lpSupply, isGraduated}
lpBalances[market][user] → uint256
```

**Responsibilities:**
- Market registration with TruthMarket contracts
- Fee collection: 5% pre-graduation, 1% post-graduation
- Graduation mechanics: threshold = bBase × ln(2) × multiplier
- LP token accounting (non-transferable)
- Fee distribution splits (post-graduation)

### 2. AMMEngine (Pure Trading)
**Purpose:** LMSR-based automated market making

```solidity
// Key Functions
tradePositionsFor(user, market, outcome, delta, maxCost, router)
getPositionQuote(market, outcome, deltaShares) → cost
getPosition(market, user) → (yesShares, noShares)
getMarketState(market) → (qYes, qNo, b)

// State (per market)
qYes, qNo              // LMSR inventory (18 decimals WAD)
b                      // Liquidity parameter
positions[user]        // Dual-balance: {yesShares, noShares}
_availableBalance[user] // Spendable proceeds
_lockedBalance[user]    // 24h locked proceeds
```

**Key Features:**
- Dual-balance position model (can hold both YES and NO)
- Lock-on-Sell: 24h lock for sell proceeds (immediately spendable for new trades)
- Router delegation (LaunchpadEngine authorized)

### 3. TruthMarket (Lifecycle Authority)
**Purpose:** Canonical source of truth for market state

```solidity
// Key Functions
finalizeResolution(outcome, tStar)      // Adjudicator settles
vetoResolution()                        // Guardian emergency veto

// States
LIVE → SETTLED → FINALIZED

// State
isLive(), isSettled()          // Query functions (pull-based)
winningOutcome()               // 0=NO, 1=YES, 2=INVALID
tStar                          // Retroactive truth timestamp
startTime                       // Scheduled market start
```

### 4. TickBookPoolManager (V10 Unified Orderbook)
**Purpose:** Professional trading venue with unified Spot and Range liquidity.

```solidity
// Key Functions
placeOrder(marketKey, outcome, tickLower, tickUpper, shares, maxCost)
cancelOrder(marketKey, orderId)
claimFills(marketKey, orderId)

// V10 Architecture
- Singleton pattern (one contract per chain)
- Unified crossing: spot sells first, then range orders
- Tick-indexed spot fills for O(overlap) traversal
- Auto-claim support for pending fills
```

**Matching Mechanics:**
- SELL orders sweep LOW→HIGH (worst to best ask)
- BUY orders sweep HIGH→LOW (worst to best bid)
- Overlap-only fills (no >100% fill bug)

### 5. TickBookVault (USDC Custody)
**Purpose:** Capital-efficient collateral management for orderbook

```solidity
// Key Functions
deposit(amount)         // Deposit USDC
withdraw(amount)        // Withdraw available
reserveUsdc(...)        // Lock for orders
creditOutcome(...)      // Credit internal shares

// State
availableUsdcWad[user]          // Withdrawable USDC
reservedUsdcWad[user]           // Locked in orders
marketCollateralWad[market]     // Per-market collateral
yesInternal[market][user]       // Internal YES shares
noInternal[market][user]        // Internal NO shares
```

### 6. Collateralizer (Token Operations)
**Purpose:** Manages outcome token lifecycle

```solidity
// Key Functions
split(market, amount)                    // USDC → YES + NO
merge(market, amount)                    // YES + NO → USDC
redeem(market, outcome, amount)          // Winner → USDC (post-settlement)

// Identity: 1 USDC = 1 YES + 1 NO (complete set)
```

### 7. Libraries

| Library | Purpose | Status |
|---------|---------|--------|
| **LMSRMath.sol** | LMSR price/cost calculations (log-sum-exp) | Active |
| **TickMath.sol** | Tick ↔ Price conversions (1-999 ticks = 0.1%-99.9%) | Active |
| **TickBitmap.sol** | Efficient tick discovery (findNextUp/findNextDown) | Active |
| **TransientDelta.sol** | EIP-1153 transient storage for atomic ops | ⚠️ Archived (V9.9.4) |

---

## Money Flow

### AMM Trading Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ AMM BUY (via LaunchpadEngine)                                           │
│                                                                         │
│ User ──[USDC]──► LaunchpadEngine ──[Cost]──► AMMEngine                 │
│          │                              │                               │
│          │                              ├──► Updates qYes/qNo           │
│          │                              └──► Credits user.yesShares     │
│          │                                                              │
│          └──[Fee]──► LaunchpadEngine                                   │
│                         │                                               │
│                         ├──► Pre-grad: 100% to bBase + LP mint         │
│                         └──► Post-grad: Split (50% bBase, 30% LP, 20% │
│                                         protocol)                       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ AMM SELL (Lock-on-Sell)                                                 │
│                                                                         │
│ User.yesShares ──► AMMEngine ──[Proceeds]──► AMMEngine._availableBalance│
│                        │                            │                   │
│                        │                            ├──► Locked 24h     │
│                        └──► Updates qYes/qNo        │                   │
│                                                     │                   │
│ After 24h: _availableBalance ──► User wallet (withdraw)                │
│ Immediately: _availableBalance ──► New trades (spendable)              │
└─────────────────────────────────────────────────────────────────────────┘
```

### TickBook Trading Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ RANGE ORDER PLACEMENT                                                   │
│                                                                         │
│ User ──[deposit USDC]──► TickBookVault.availableUsdcWad                │
│                                │                                        │
│                                ▼                                        │
│ placeRangeOrder(outcome, tickLower, tickUpper, shares)                 │
│                                │                                        │
│                                ├──► TickBookVault.reserveUsdc()        │
│                                ├──► Update liquidityNet at boundaries  │
│                                └──► _tryCross() for immediate matches  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ MARKET ORDER EXECUTION                                                  │
│                                                                         │
│ fill(marketKey, outcome, maxShares, limitTick)                         │
│                                │                                        │
│                                ├──► Sweep ticks (worst-to-best)        │
│                                ├──► Pro-rata fills to makers           │
│                                ├──► Update growth accumulators         │
│                                └──► Credit taker via vault             │
│                                                                         │
│ Maker claims via: claimFills(orderId) or getPendingFills() view        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Fee Collection & Distribution (Delegate Session)

This section is a delegate-focused overview of who earns what from fees, in which phase, and how those flows are implemented on-chain.

### Actors

| Actor                | Role                                                                          |
|----------------------|-------------------------------------------------------------------------------|
| **Creator**          | Seeds initial liquidity via `bBase × ln(2)` and receives initial LP tokens   |
| **Gaming Traders**   | Retail users trading via `LaunchpadEngine → AMMEngine`, earn LP pre-grad     |
| **LP Token Holders** | Hold LP tokens and redeem against the Honest Floor (and LP yield post-grad)  |
| **Protocol Treasury**| Receives a portion of post-graduation fees                                   |

### Fee Phases & Splits

#### 1. Pre-Graduation (Bonding Phase)

- **Default fee:** `preGradFeeBps = 500` (5%).
- **Applied on both buys and sells** (Launchpad’s wrapper around AMM quotes).
- **Distribution:**

| Portion            | Recipient                 | Notes                                                                   |
|--------------------|---------------------------|-------------------------------------------------------------------------|
| 100% of fee (WAD)  | Gaming trader (as LP)     | Minted 1:1 in `lpBalances[market][trader]` and added to `totalLPSupply` |
| 100% of fee (WAD)  | Market depth (`bCurrent`)| Scaled by `LN2_INV_WAD` then mirrored into AMM via `increaseLiquidity`  |

Effectively, every fee dollar in the bonding phase both **deepens the AMM** and **turns active traders into LPs**.

#### 2. Post-Graduation (Mature Phase)

Once `feesAccrued` crosses the graduation threshold

```text
feesAccrued (USDC) ≥ bBase × ln(2) × graduationMultiplier
```

the market flips `isGraduated = true` and future fees use the post-grad split:

- **Default fee:** `postGradFeeBps = 100` (1%).
- **Configurable shares:** `bBaseShareBps`, `lpYieldShareBps`, `protocolShareBps` (sum = 10_000).

| Portion                          | Recipient                | Notes                                                   |
|----------------------------------|--------------------------|---------------------------------------------------------|
| `bBaseShareBps` of fee (WAD)     | Market depth (`bCurrent`)| Scaled and applied via `ammEngine.increaseLiquidity`    |
| `lpYieldShareBps` of fee (USDC)  | LP Yield Pool            | Accumulates in `lpYieldPool` for LP redemption/yield    |
| `protocolShareBps` of fee (USDC) | Protocol Treasury        | Transferred out immediately via `usdc.safeTransfer`     |

### Fee Flow Chart

```text
User Trade (via LaunchpadEngine.tradePositions)
│
├─► Quote from AMMEngine (baseCost, new price)
│
├─► Compute fee = baseCost × feeBps / 10_000
│
├─► If BUY:
│    └─► User pays baseCost + fee
│
└─► If SELL:
     └─► User receives baseCost − fee (after AMM execution)

Pre-Graduation Distribution
---------------------------
fee (WAD)
│
├─► deltaB = fee × (1 / ln(2))
│    ├─► markets[market].bCurrent += deltaB
│    └─► ammEngine.increaseLiquidity(market, deltaB)
│
└─► lpBalances[market][trader] += fee
     └─► totalLPSupply += fee

Post-Graduation Distribution
----------------------------
fee (WAD/USDC)
│
├─► toBBase   = feeWad  × bBaseShareBps   / 10_000
│   ├─► markets[market].bCurrent += toBBase
│   └─► ammEngine.increaseLiquidity(market, toBBase)
│
├─► toLPYield = feeUsdc × lpYieldShareBps / 10_000
│   └─► markets[market].lpYieldPool += toLPYield
│
└─► toProtocol = feeUsdc × protocolShareBps / 10_000
    └─► usdc.safeTransfer(protocolTreasury, toProtocol)
```

### Delegate Takeaways

- **Before graduation**, fees primarily reward **active traders** and deepen the AMM; the protocol treasury gets nothing.
- **After graduation**, fees primarily reward **LPs and the protocol**, while still growing depth through `bCurrent`.
- Adjusting `preGradFeeBps`, `postGradFeeBps`, and the three post-grad shares tunes:
  - How quickly markets graduate.
  - How much upside creators/gaming traders vs. passive LPs vs. protocol receive over time.

---

## Key Formulas

### LMSR Pricing
```
P(YES) = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
P(NO)  = 1 - P(YES)

Cost to reach state (qYes, qNo):
C(q) = b × ln(e^(qYes/b) + e^(qNo/b))
```

### LP Valuation
```
Gross Cash = C(qYes, qNo, b)           // LMSR cost function value
Liability  = max(qYes, qNo)            // Worst-case payout
Floor      = max(0, Gross - Liability) // Guaranteed LP equity
ExRate     = Floor / LP_Supply         // LP token value
```

### Creator Economics
```
Creator Deposit = bBase × ln(2) ≈ bBase × 0.693

Graduation Threshold = bBase × ln(2) × multiplier
  - multiplier=1: Graduate at break-even (fees = deposit)
  - multiplier=2: Graduate at 2× break-even

Pre-Graduation Fees (5%):
  → 100% to bBase growth (scaled by 1/ln(2) ≈ 1.44)
  → LP tokens minted 1:1 to fee payer

Post-Graduation Fees (1%):
  → 50% to bBase growth
  → 30% to LP yield pool
  → 20% to protocol treasury
```

---

## Precision & Decimals

| Context | Precision | Notes |
|---------|-----------|-------|
| Internal math | WAD (1e18) | All contract calculations |
| USDC transfers | 6 decimals | Standard USDC (caution: MockUSDC uses 18) |
| Tick range | 1-999 | 0.1% to 99.9% probability |
| Basis points | /10000 | Fee percentages |
| Lock duration | 24 hours | Sell proceeds lock |

**Critical Rule:** Convert at boundaries using `_wadToUsdc()` and `_usdcToWad()`.

---

## Multi-Chain Deployments (V10.8)

### Base Sepolia (Chain 84532)
```
MockUSDC           = 0xf9ac031408f4638c147764377ba8a5ab34584515
LaunchpadEngine    = 0x35292381f577692d29078fd66c22aa99aae9a8d6
AMMEngine          = 0x224f012eacbb7425d336bf0bd5546feb74bbb16e
Collateralizer     = 0x87a7042bdeae36309a97d79203dc41d876a76853
TickBookPoolManager= 0x9f4c719823935cbbb9db3f8e78556d8684c9b877
TickBookVault      = 0x307425430128a2948bbd33d6f4bc558cc1a58929
```

### Arc Testnet (Chain 5042002)
```
MockUSDC           = 0x72bc95f1b88d102eee3e7d7937be11ce58a3d7a2
LaunchpadEngine    = 0xa610975cc06de01456a36bd27390d12d5e4b6629
AMMEngine          = 0xc6a1a4540af68cb20aea0e68a202c0f221f599b4
Collateralizer     = 0x3fba88351d0f51dafe6a2462c24f3c58f2af16aa
TickBookPoolManager= 0xf17e44c3ebcc7383b3a786a5d48783c2a5220c8e
TickBookVault      = 0x11e4e0f62745a26b0433b44b0f36cceaf4b6dde7
```

### Monad Testnet (Chain 10143)
```
MockUSDC           = 0xa87fc95697bd72b2a4aebf2897fbfdb4e37df724
LaunchpadEngine    = 0x6e295996fd9902b6ebf2c44068da9a07b81cd527
AMMEngine          = 0xed9aaecb4577319dc258bfd902f504972e530f67
Collateralizer     = 0xb6bf9fc30884699a37c1138d6c1a0b5dd8f70980
TickBookPoolManager= 0x19424e5482ad7b79654706fa60f4e5153d54e3c3
TickBookVault      = 0x8e417a8e71bc1a2adea4291fc0d0cd04e445cc1c
```

---

## Frontend Architecture

### Tech Stack
- **Framework:** React 18 + Vite
- **Web3:** Wagmi v2 + Viem
- **State:** Zustand + React Query
- **Styling:** Tailwind CSS

### Page Structure
| Route | Page | Purpose |
|-------|------|---------|
| `/trade` | Trade.tsx | AMM retail trading terminal |
| `/pro` | Pro.tsx | TickBook professional terminal |
| `/portfolio` | Portfolio.tsx | User positions, LP, balances |
| `/create` | Create.tsx | Launchpad market creation |
| `/gov` | Gov.tsx | Governance & settlement UI |
| `/faucet` | Faucet.tsx | Testnet USDC faucet |
| `/about` | Learn.tsx | Educational content |

### Hook Categories
```
hooks/
├── useAMMQuoteDirect.ts       # LMSR cost calculations
├── useAMMPositionDirect.ts    # User AMM positions
├── useLaunchpadMarkets.ts     # Market discovery
├── useTickBookVaultDirect.ts  # Orderbook balances
├── useUserOrdersDirect.ts     # User's range orders
├── useDirectRead.ts           # Generic contract reads
├── useInvalidateQueries.ts    # Query invalidation
└── ... (47 total hooks)
```

---

## Authorization Model

| Function | Modifier | Authorized Caller |
|----------|----------|-------------------|
| `LaunchpadEngine.createMarket()` | none | Anyone |
| `LaunchpadEngine.tradePositions()` | none | Anyone |
| `LaunchpadEngine.setPreGradFeeBps()` | onlyOwner | Protocol owner |
| `AMMEngine.tradePositionsFor()` | onlyRouter | LaunchpadEngine |
| `TruthMarket.finalizeResolution()` | onlyAdjudicator | Adjudicator contract |
| `TickBookPoolManager.registerMarket()` | onlyRegistrar | LaunchpadEngine |

---

## Testing & QA

### Test Coverage
- V10 unit, integration, fuzz, and invariant suites live in `packages/contracts-testing/test/`.
- Core audit-scope sources live in `packages/contracts-core/src/`.

### Running Tests
```bash
cd packages/contracts-core && forge build
cd packages/contracts-testing && forge test
```

---

## Development Workflows

See `.agent/GUIDE.md` for role-based workflows:

| Workflow | Purpose |
|----------|---------|
| `/preflight` | Session initialization, context loading |
| `/evm-dev` | Solidity contract development |
| `/frontend-dev` | React/TypeScript frontend work |
| `/deploy` | Contract deployment preparation |
| `/deploy-sync` | Post-deployment config sync |
| `/coordinator` | Status documentation updates |

---

## Key Design Decisions

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-033 | No built-in custody | Maximum flexibility, works with any smart account |
| ADR-048 | Dual-balance positions | Can hold both YES and NO simultaneously |
| ADR-051 | TickBook vault-native | Capital-efficient orderbook collateral |
| ADR-052 | TickBookV2 range orders | O(1) gas for wide ranges |
| ADR-057 | Bitmap-based overlap | Correct crossing detection |
| ADR-058 | Sweep worst-to-best | Prevents >100% fills |
| ADR-059 | V9.9.4 Hook removal | Simplicity over extensibility for alpha |
| ADR-060 | Fee cap at 10% | Prevent malicious fee extraction (TOB-2) |

See `DECISIONS.md` for full ADR history.

---

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 9+
- Foundry (for contracts)

### Setup
```bash
pnpm install
pnpm build
```

### Development
```bash
# Frontend
pnpm dev:web

# Contracts
cd packages/contracts-core && forge build
cd packages/contracts-testing && forge test
```

---

## References

- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [DECISIONS.md](./DECISIONS.md) - Architecture decisions
- [STATUS.md](./STATUS.md) - Current project state
- [.agent/KNOWLEDGE.md](./.agent/KNOWLEDGE.md) - Domain knowledge
