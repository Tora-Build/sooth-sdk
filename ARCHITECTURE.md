# Sooth Protocol Architecture

**Version:** 9.9.0  
**Status:** Alpha (Testnet Deployments)  
**Last Updated:** 2025-12-30

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
│                           SOOTH PROTOCOL V9.9                               │
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
│   │                    SMART CONTRACTS (packages/contracts-evm)          │   │
│   │                                                                      │   │
│   │   ┌─────────────────┐         ┌─────────────────────────────────┐   │   │
│   │   │ LaunchpadEngine │─────────│ Creator Economics Layer         │   │   │
│   │   │  (Router)       │         │ • Market creation/registration  │   │   │
│   │   └────────┬────────┘         │ • Fee collection & distribution │   │   │
│   │            │                  │ • Graduation mechanics          │   │   │
│   │            │                  │ • LP token management           │   │   │
│   │   ┌────────▼────────┐         └─────────────────────────────────┘   │   │
│   │   │   AMMEngine     │         ┌─────────────────────────────────┐   │   │
│   │   │  (LMSR AMM)     │         │ Pure Trading Logic              │   │   │
│   │   └────────┬────────┘         │ • LMSR cost calculation         │   │   │
│   │            │                  │ • Position tracking (dual-bal.) │   │   │
│   │            │                  │ • 24h sell lock mechanism       │   │   │
│   │   ┌────────▼────────┐         └─────────────────────────────────┘   │   │
│   │   │  TruthMarket    │         ┌─────────────────────────────────┐   │   │
│   │   │  (Lifecycle)    │         │ Settlement Authority            │   │   │
│   │   └─────────────────┘         │ • Market states (LIVE→SETTLED)  │   │   │
│   │                               │ • Adjudicator-based resolution  │   │   │
│   │   ┌─────────────────┐         │ • tStar (retroactive truth)     │   │   │
│   │   │TickBookPoolMgr  │         └─────────────────────────────────┘   │   │
│   │   │  (Singleton)    │         ┌─────────────────────────────────┐   │   │
│   │   └────────┬────────┘         │ V9 Orderbook Singleton          │   │   │
│   │            │                  │ • Range order placement (O(1))  │   │   │
│   │   ┌────────▼────────┐         │ • Market order execution        │   │   │
│   │   │  TickBookVault  │         │ • Cross matching (sweep fills)  │   │   │
│   │   │  (USDC Custody) │         │ • Hook system (DynamicFeeHook)  │   │   │
│   │   └─────────────────┘         └─────────────────────────────────┘   │   │
│   │                                                                      │   │
│   │   ┌─────────────────┐         ┌─────────────────────────────────┐   │   │
│   │   │  Collateralizer │         │ Token Operations                │   │   │
│   │   │                 │─────────│ • Split: USDC → YES + NO        │   │   │
│   │   └─────────────────┘         │ • Merge: YES + NO → USDC        │   │   │
│   │                               │ • Redeem: Winner token → USDC   │   │   │
│   │   ┌─────────────────┐         └─────────────────────────────────┘   │   │
│   │   │  OutcomeToken   │                                               │   │
│   │   │   (ERC20)       │                                               │   │
│   │   └─────────────────┘                                               │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
sooth-alpha/
├── apps/
│   └── web/                          # Frontend dApp
│       ├── src/
│       │   ├── components/           # React components
│       │   │   ├── features/         # Domain components (launchpad, etc.)
│       │   │   ├── layout/           # App layout (Navbar, Footer)
│       │   │   └── ui/               # Generic UI components
│       │   ├── config/               # Configuration files
│       │   │   ├── abis/             # Contract ABIs
│       │   │   ├── abis.ts           # ABI exports
│       │   │   ├── deployments.json  # Contract addresses per chain
│       │   │   └── markets.json      # Market configurations
│       │   ├── hooks/                # React hooks (47 total, flat structure)
│       │   ├── lib/                  # Utilities (wagmi, math, formatting)
│       │   ├── pages/                # Route pages
│       │   │   ├── Trade.tsx         # AMM trading terminal
│       │   │   ├── Pro.tsx           # TickBook professional terminal
│       │   │   ├── Portfolio.tsx     # User positions & LP
│       │   │   ├── Create.tsx        # Launchpad market creation
│       │   │   └── Gov.tsx           # Governance & settlement
│       │   └── store/                # Zustand state management
│       └── docs/                     # Frontend specifications
│
├── packages/
│   └── contracts-evm/                # Solidity smart contracts
│       ├── contracts/
│       │   ├── LaunchpadEngine.sol   # Creator economics router
│       │   ├── AMMEngine.sol         # LMSR trading logic
│       │   ├── TruthMarket.sol       # Lifecycle & settlement
│       │   ├── TickBookPoolManager.sol # Orderbook singleton
│       │   ├── TickBookVault.sol     # Orderbook USDC custody
│       │   ├── Collateralizer.sol    # Token split/merge/redeem
│       │   ├── OutcomeToken.sol      # ERC20 YES/NO tokens
│       │   ├── interfaces/           # Contract interfaces
│       │   ├── libraries/            # Math libraries (LMSR, Tick, Bitmap)
│       │   └── hooks/                # TickBook hook contracts
│       ├── script/                   # Deployment scripts (Foundry)
│       ├── test/                     # Test suites (92+ tests)
│       └── docs/                     # Contract documentation
│
├── .agent/                           # Agent workflows & knowledge
│   ├── GUIDE.md                      # Workflow quick reference
│   ├── KNOWLEDGE.md                  # Domain knowledge base
│   ├── LESSONS_LEARNED.md            # Persistent agent memory
│   └── workflows/                    # Role-based workflow files
│
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
createMarket(truthMarket, yesToken, noToken, bBase)  // Register new market
tradePositions(market, outcome, deltaShares, maxCost) // Execute trades
redeemLP(market)                                       // LP redemption

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
activate()                              // Creator activates market
finalizeResolution(outcome, tStar)      // Adjudicator settles
vetoResolution()                        // Guardian emergency veto

// States
CREATED → LIVE → SETTLING → SETTLED → FINALIZED

// State
isLive(), isSettled()          // Query functions (pull-based)
winningOutcome()               // 0=YES, 1=NO, 2=INVALID
tStar                          // Retroactive truth timestamp
```

### 4. TickBookPoolManager (V9 Singleton)
**Purpose:** Concentrated liquidity orderbook for professional trading

```solidity
// Key Functions
placeRangeOrder(marketKey, outcome, tickLower, tickUpper, shares)
cancelOrder(marketKey, orderId)
fill(marketKey, outcome, maxShares, limitTick)  // Market order
claimFills(marketKey, orderId)                   // Claim crossed fills
getPendingFills(marketKey, orderId) → (pendingShares, pendingCollateral)

// Architecture
- Singleton pattern (one contract per chain)
- Uniswap V3-style range positions (boundary storage)
- Pro-rata fill attribution via growth accumulators
- Hook system (DynamicFeeHook for fees)
```

**V9.9 Matching Mechanics:**
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

| Library | Purpose |
|---------|---------|
| **LMSRMath.sol** | LMSR price/cost calculations (log-sum-exp) |
| **TickMath.sol** | Tick ↔ Price conversions (1-999 ticks = 0.1%-99.9%) |
| **TickBitmap.sol** | Efficient tick discovery (findNextUp/findNextDown) |
| **TransientDelta.sol** | EIP-1153 transient storage for atomic ops |

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

## Multi-Chain Deployments

### Base Sepolia (Chain 84532) - V9.9.0
```
MockUSDC           = 0xee08d25a466e54c97417dcc721baee82b145ab99
LaunchpadEngine    = 0xbe602ee838c1ecb959c1582fab8e65fc4ccb809a
AMMEngine          = 0xbfe2ece93b9a0afe2574923d63999aea83a320f4
Collateralizer     = 0xed402829b2582211374d17a00082aceecd47e420
TickBookPoolManager= 0x8cdaddec24919ab31bdb64b97a3d1e58c921a272
TickBookVault      = 0xfe72a031afafc33281a62ad8a765665ccd69042b
DynamicFeeHook     = 0xdbf40370e87a043ad267d46475722389738bf1f9
```

### Monad Testnet (Chain 10143) - V9.6.0
```
MockUSDC           = 0x7192f46fa78e7d1b5bb6ba687d15d0b6a0802da3
LaunchpadEngine    = 0xfc439a4bd763900cc544154e74258721f4a2bbbb
AMMEngine          = 0xc83a0fad313d9174ebdb6201c5d115e5773e4d80
Collateralizer     = 0xc620770047e6710d2539bc6aa46de9be458207a7
TickBookPoolManager= 0xd209a3db4bb3a65da69001313e75f3309888e52f
TickBookVault      = 0x7996195bf20d84b51e28ba8f44f6fc85a4cf59b7
```

---

## Frontend Architecture

### Tech Stack
- **Framework:** React 18 + Vite
- **Web3:** Wagmi v2 + Reown AppKit
- **State:** Zustand + TanStack Query
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
| `TruthMarket.activate()` | onlyCreator | Market creator |
| `TruthMarket.finalizeResolution()` | onlyAdjudicator | Adjudicator contract |
| `TickBookPoolManager.registerMarket()` | onlyRegistrar | LaunchpadEngine |

---

## Testing & QA

### Test Coverage
- **92+ tests** across unit, integration, fuzz, and invariant suites
- Key test files:
  - `TickBookPoolManager.t.sol` - 22 core orderbook tests
  - `V9Fuzz.t.sol` - 10 fuzz tests (tick bounds, slippage)
  - `V9Invariants.t.sol` - 4 actor-based invariants
  - `TruthMarketLifecycle.t.sol` - 32 settlement tests

### Running Tests
```bash
cd packages/contracts-evm
forge test                    # All tests
forge test --match-test V99   # V9.9 crossing tests
forge test -vvv               # Verbose output
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
pnpm --filter web dev

# Contracts
cd packages/contracts-evm
forge build
forge test
```

---

## References

- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [DECISIONS.md](./DECISIONS.md) - Architecture decisions
- [STATUS.md](./STATUS.md) - Current project state
- [.agent/KNOWLEDGE.md](./.agent/KNOWLEDGE.md) - Domain knowledge
- [packages/contracts-evm/docs/](./packages/contracts-evm/docs/) - Contract docs
