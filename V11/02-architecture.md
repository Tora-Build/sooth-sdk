# Sooth Protocol Architecture

**Version:** 11
**Status:** Alpha (Testnet Deployments)
**Last Updated:** 2026-01-23

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Core Data Structures](#core-data-structures)
4. [Contract Specifications](#contract-specifications)
5. [V11 Features](#v11-features)
6. [LMSR Mathematics](#lmsr-mathematics)
7. [TickBook Orderbook](#tickbook-orderbook)
8. [Market Lifecycle](#market-lifecycle)
9. [Fee Economics](#fee-economics)
10. [Settlement & Redemption](#settlement--redemption)
11. [Security Invariants](#security-invariants)
12. [Implementation Notes](#implementation-notes)

---

## Executive Summary

Sooth Protocol is a decentralized prediction market platform with a **dual-venue architecture**:

1. **AMM (Automated Market Maker)** — LMSR-based continuous pricing for retail trading
2. **TickBook (Orderbook)** — Concentrated range orders for professional trading

### V11 Key Additions

- **Trial Period** — 7-day window where creators can dismiss markets and traders get refunds
- **ERC20 LP Tokens** — Transferable LP tokens (locked after settlement)
- **ValidatedAdjudicator** — TEE attestation-based settlement via ERC-8004
- **ProtocolConfig** — Protocol-level guardian list and pause mechanism
- **Per-Market Adjudicator** — Markets can specify their own adjudicator at creation

### Core Architectural Decisions

- **Dual-balance positions**: Users can hold both YES and NO shares simultaneously
- **Lock-on-Sell**: 24-hour lock on AMM sell proceeds (immediately spendable for new trades)
- **Launchpad model**: Creator economics with graduation mechanics
- **Pull-based lifecycle**: TruthMarket as canonical source of truth
- **No custody layer**: Direct token transfers, works with any account type

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                     PROTOCOL CONFIG (V11)                             │  │
│   │   ┌─────────────────────────────────────────────────────────────┐    │  │
│   │   │ • Guardian List Management                                   │    │  │
│   │   │ • Protocol-Wide Pause                                        │    │  │
│   │   └─────────────────────────────────────────────────────────────┘    │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                       LAUNCHPAD ENGINE                                │  │
│   │   ┌─────────────────────────────────────────────────────────────┐    │  │
│   │   │ • Market Creation (atomic, with trial period)                │    │  │
│   │   │ • Fee Collection & Distribution                              │    │  │
│   │   │ • Graduation Mechanics                                       │    │  │
│   │   │ • ERC20 LP Token Management (V11)                            │    │  │
│   │   │ • Trial Period & Dismissal (V11)                             │    │  │
│   │   └─────────────────────────────────────────────────────────────┘    │  │
│   └──────────────────────┬───────────────────────────────────────────────┘  │
│                          │                                                   │
│            ┌─────────────┴─────────────┐                                    │
│            ▼                           ▼                                    │
│   ┌─────────────────┐        ┌─────────────────┐                           │
│   │   AMM ENGINE    │        │   TICKBOOK      │                           │
│   │   (LMSR)        │        │   POOL MANAGER  │                           │
│   │                 │        │                 │                           │
│   │ • Continuous    │        │ • Range Orders  │                           │
│   │   Pricing       │        │ • Spot Sells    │                           │
│   │ • Dual-Balance  │        │ • Unified       │                           │
│   │   Positions     │        │   Crossing      │                           │
│   │ • 24h Lock      │        │ • O(overlap)    │                           │
│   └────────┬────────┘        └────────┬────────┘                           │
│            │                          │                                     │
│            │                          ▼                                     │
│            │                 ┌─────────────────┐                           │
│            │                 │  TICKBOOK VAULT │                           │
│            │                 │  (Collateral)   │                           │
│            │                 └─────────────────┘                           │
│            │                                                                │
│            └──────────────┬─────────────────────────────────────────────   │
│                           ▼                                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      TRUTH MARKET                                     │  │
│   │   ┌─────────────────────────────────────────────────────────────┐    │  │
│   │   │ • Lifecycle Authority (LIVE → SETTLED → FINALIZED)          │    │  │
│   │   │ • Adjudicator-based Resolution                               │    │  │
│   │   │ • Guardian Veto via ProtocolConfig (V11)                     │    │  │
│   │   └─────────────────────────────────────────────────────────────┘    │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                   VALIDATED ADJUDICATOR (V11)                         │  │
│   │   ┌─────────────────────────────────────────────────────────────┐    │  │
│   │   │ • TEE Attestation-Based Settlement                          │    │  │
│   │   │ • ERC-8004 Validation Registry Integration                  │    │  │
│   │   │ • Multi-Validator Support                                    │    │  │
│   │   └─────────────────────────────────────────────────────────────┘    │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      COLLATERALIZER                                   │  │
│   │   ┌─────────────────────────────────────────────────────────────┐    │  │
│   │   │ • Split: 1 USDC → 1 YES + 1 NO                              │    │  │
│   │   │ • Merge: 1 YES + 1 NO → 1 USDC                              │    │  │
│   │   │ • Redeem: Winner → USDC (post-settlement)                   │    │  │
│   │   └─────────────────────────────────────────────────────────────┘    │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Contract Dependency Graph

```
ProtocolConfig (V11)
    │
    └──► LaunchpadEngine (Router)
            │
            ├──► AMMEngine (LMSR Trading)
            │       │
            │       └──► TruthMarket (Lifecycle Query)
            │
            ├──► TickBookPoolManager (Orderbook)
            │       │
            │       └──► TickBookVault (Collateral)
            │
            ├──► Collateralizer (Token Ops)
            │       │
            │       └──► OutcomeToken (YES/NO ERC20)
            │
            ├──► LaunchpadLPToken (V11: ERC20 LP)
            │
            ├──► ValidatedAdjudicator (V11: TEE Settlement)
            │       │
            │       └──► IValidationRegistry (ERC-8004)
            │
            └──► TruthMarket (Market State)
                    │
                    └──► ProtocolConfig (Guardian)
```

---

## Core Data Structures

### Outcome Encoding (Protocol-Wide)

| Value | Outcome | Description |
|-------|---------|-------------|
| `0` | NO | The "No" side of the prediction |
| `1` | YES | The "Yes" side of the prediction |
| `2` | INVALID | Market unresolvable (50% payout each) |

This encoding is canonical across all contracts.

### Position Model (Dual-Balance)

```
struct Position {
    uint256 yesShares;    // User's YES position (always ≥ 0)
    uint256 noShares;     // User's NO position (always ≥ 0)
}
```

**Key Properties:**
- Users can hold both YES and NO simultaneously (no forced netting)
- Each outcome is tracked independently
- Selling requires sufficient shares of that outcome

### AMM Market State

```
struct AMMMarketState {
    uint256 qYes;        // YES quantity in WAD (1e18)
    uint256 qNo;         // NO quantity in WAD (1e18)
    uint256 b;           // Liquidity parameter (depth)
    bool initialized;
}
```

### Launchpad Market State (V11)

```
struct MarketState {
    address creator;           // Market creator
    address lpToken;           // V11: ERC20 LP token address
    uint256 bBase;             // Initial liquidity b
    uint256 bCurrent;          // Current b (grows with pre-grad fees)
    uint256 creatorDeposit;    // Initial USDC deposit
    uint256 feesAccrued;       // Accumulated fees (USDC)
    uint256 totalLPSupply;     // Total LP tokens issued
    uint256 lpYieldPool;       // Post-graduation LP yield
    bool isGraduated;          // Has market graduated
    uint64 createdAt;
    uint64 graduatedAt;
}
```

### Trial State (V11)

```
struct TrialState {
    uint64 trialEndTime;       // When trial period ends (default: 7 days)
    bool isDismissed;          // Creator dismissed during trial
    uint256 totalLockedCost;   // Total cost locked across all traders
}
```

### ValidatedAdjudicator Market Config (V11)

```
struct MarketConfig {
    bool registered;
    uint256 agentId;           // ERC-8004 agent ID for TEE operator
    uint256 minValidators;     // Minimum attestations required
    bytes32 lastAttestation;   // Last used attestation (replay prevention)
}
```

### Range Order (TickBook)

```
struct RangeOrder {
    address owner;
    uint8 outcome;                   // 0=NO, 1=YES
    uint16 tickLower;                // Lower tick bound (1-999)
    uint16 tickUpper;                // Upper tick bound
    bool active;
    bool liquidityRemoved;           // For cleanup tracking
    uint128 sharesTotal;             // Total shares to place
    uint128 liquidity;               // Density per tick
    uint128 collateralDepositedWad;  // Initial collateral
    uint128 filledShares;            // Accumulated fills
    uint128 collateralUsedWad;       // Accumulated collateral used
}
```

### Spot Sell Order (TickBook)

```
struct SpotSellOrder {
    address owner;
    uint8 outcome;           // 0=NO, 1=YES
    uint16 tickLower;        // Min price willing to accept
    uint16 tickUpper;        // Max price (usually same as lower)
    bool active;
    uint128 sharesTotal;     // Total shares to sell
    uint128 sharesFilled;    // Filled so far
    uint128 proceedsWad;     // Accumulated proceeds
}
```

### Tick Liquidity (Unified)

```
struct TickLiquidity {
    int128 rangeLiquidityNet;    // Net liquidity change at tick
    uint128 rangeLiquidityGross; // Gross liquidity (for cleanup)
    uint128 spotLiquidity;       // Spot sell liquidity
}
```

### Balance Lock Entry

```
struct LockEntry {
    uint256 amount;      // Amount locked
    uint64 expiry;       // Unlock timestamp
    address market;      // Source market
}
```

---

## Contract Specifications

### 1. ProtocolConfig (V11)

**Purpose:** Protocol-level guardian management and pause mechanism

#### State Variables

```
mapping(address => bool) _guardians;
bool _paused;
address owner;
```

#### Key Functions

**setGuardians(add[], remove[])**
```
Only owner
1. For each address in add[]: set _guardians[addr] = true
2. For each address in remove[]: set _guardians[addr] = false
3. Emit GuardianAdded/GuardianRemoved events
```

**pause() / unpause()**
```
Only owner or guardian
1. Set _paused = true/false
2. Emit ProtocolPaused/ProtocolUnpaused event
```

**isGuardian(address) → bool**
```
Return _guardians[address]
```

**isPaused() → bool**
```
Return _paused
```

### 2. LaunchpadEngine (V11)

**Purpose:** Creator economics, market lifecycle, fee routing, trial period

#### State Variables

```
mapping(address => MarketState) markets;
mapping(address => TrialState) trialStates;                    // V11
mapping(address => mapping(address => uint256)) userLockedCost; // V11
mapping(address => mapping(address => int256)) userTrialBalance; // V11
IProtocolConfig protocolConfig;                                 // V11

address ammEngine;
address collateralizer;
address tickBookPoolManager;
address tickBookVault;
address protocolTreasury;
address usdc;

uint256 preGradFeeBps;        // Default: 500 (5%)
uint256 postGradFeeBps;       // Default: 100 (1%)
uint256 bBaseShareBps;        // Default: 5000 (50%)
uint256 lpYieldShareBps;      // Default: 3000 (30%)
uint256 protocolShareBps;     // Default: 2000 (20%)
uint256 graduationMultiplier; // Default: 1

uint256 constant DEFAULT_TRIAL_PERIOD = 7 days;  // V11
```

#### Key Functions

**createMarket(params) → (market, lpTokens)** (V11 Signature)
```
Input: question, startTime, deadline, adjudicator, guardian,
       initialLiquidity, adjudicatorAgentId, adjudicatorMinValidators

require !protocolConfig.isPaused()
require guardian == address(protocolConfig)

1. Calculate creator deposit = bBase × ln(2)
2. Pull deposit from creator
3. Deploy TruthMarket with adjudicator and protocolConfig as guardian
4. If adjudicatorAgentId > 0 && minValidators > 0:
   - Call adjudicator.registerMarket(market, agentId, minValidators)
5. Initialize AMM state: qYes = qNo = 0, b = bBase
6. Deploy LaunchpadLPToken ERC20 for this market
7. Record MarketState with lpToken address
8. Initialize TrialState with trialEndTime = now + 7 days
9. Mint initial LP tokens to creator
10. Return (market, lpTokens)
```

**tradePositions(market, outcome, deltaShares, maxCostOrMinProceeds)**
```
require !protocolConfig.isPaused()
require !trialStates[market].isDismissed

1. Get base cost from AMM quote
2. Calculate fee based on graduation state
3. Execute trade via AMMEngine
4. If in trial period (now < trialEndTime):
   - Track userLockedCost for refunds
   - Track userTrialBalance
5. Distribute fee based on graduation state
6. Check graduation trigger
```

**dismissMarket(market)** (V11)
```
require msg.sender == markets[market].creator
require now >= trialStates[market].trialEndTime  // After trial ends
require !trialStates[market].isDismissed
require !markets[market].isGraduated             // Only non-graduated markets

1. Set trialStates[market].isDismissed = true
2. Emit MarketDismissed event
```

**claimRefund(market) → refundAmount** (V11)
```
require trialStates[market].isDismissed

1. refundAmount = userLockedCost[market][msg.sender]
2. require refundAmount > 0
3. Set userLockedCost[market][msg.sender] = 0
4. Reduce totalLockedCost
5. Transfer USDC to user
6. Emit RefundClaimed event
```

**redeemLP(market, lpAmount) → usdcAmount**
```
1. Calculate floor value of market
2. Pro-rata share: usdcAmount = (floor × lpAmount) / totalLPSupply
3. Burn LP tokens via LaunchpadLPToken.burn()
4. Transfer USDC to user
```

### 3. LaunchpadLPToken (V11)

**Purpose:** ERC20 LP token with settlement-locked transfers

#### State Variables

```
address immutable market;
address immutable launchpadEngine;
```

#### Key Functions

**transfersUnlocked() → bool**
```
return !ITruthMarket(market).isSettled()
```

**_update(from, to, value)** (Override)
```
// Mints (from == 0) and burns (to == 0) always allowed
if from != 0 && to != 0:
    require transfersUnlocked() // "TransfersLocked"
super._update(from, to, value)
```

**mint(to, amount)**
```
require msg.sender == launchpadEngine
_mint(to, amount)
```

**burn(from, amount)**
```
require msg.sender == launchpadEngine
_burn(from, amount)
```

### 4. ValidatedAdjudicator (V11)

**Purpose:** TEE attestation-based settlement via ERC-8004 Validation Registry

#### State Variables

```
IValidationRegistry validationRegistry;
mapping(address => MarketConfig) marketConfigs;
uint256 attestationWindow;      // Default: 1 hour
uint8 minValidationScore;       // Default: 80 (0-100 scale)
```

#### Key Functions

**registerMarket(market, agentId, minValidators)**
```
require !marketConfigs[market].registered
marketConfigs[market] = MarketConfig({
    registered: true,
    agentId: agentId,
    minValidators: minValidators,
    lastAttestation: bytes32(0)
})
Emit MarketRegistered event
```

**settle(market, outcome, tStar, attestationHash)**
```
1. Verify market is registered and not settled
2. Fetch attestation from validationRegistry.getValidationStatus(hash)
3. Verify:
   - Attestation exists (validator != address(0))
   - Agent ID matches marketConfig.agentId
   - Score >= minValidationScore
   - Timestamp within attestationWindow
4. Store lastAttestation (replay prevention)
5. Call TruthMarket.settle(outcome, tStar)
6. Emit MarketSettled event
```

**settleWithMultipleAttestations(market, outcome, tStar, attestationHashes[])**
```
require attestationHashes.length >= marketConfig.minValidators

1. For each attestation hash:
   - Fetch and verify attestation (same as single)
2. Store first attestation as lastAttestation
3. Call TruthMarket.settle(outcome, tStar)
4. Emit MarketSettled event
```

**canSettle(market) → bool**
```
return marketConfigs[market].registered && !ITruthMarket(market).isSettled()
```

### 5. AMMEngine

**Purpose:** LMSR-based automated market making

#### State Variables

```
mapping(address => AMMMarketState) marketStates;
mapping(address => mapping(address => Position)) positions;
mapping(address => uint256) _availableBalance;  // Spendable
mapping(address => uint256) _lockedBalance;     // Time-locked subset
mapping(address => LockEntry[]) _lockQueue;     // FIFO lock queue
address router;  // LaunchpadEngine
uint256 constant LOCK_DURATION = 24 hours;
```

#### Key Functions

**tradePositionsFor(user, market, outcome, deltaShares, maxCost, payer)**
```
1. Validate market is live via TruthMarket.isLive()
2. Calculate cost using LMSR (see Mathematics section)
3. Handle payment:
   a. If _availableBalance[user] >= cost:
      - Spend from available
      - Reduce locked proportionally
   b. Else:
      - Spend all available
      - Pull remainder from payer
4. For sells: lock proceeds for 24h
   - Add to _availableBalance
   - Add to _lockedBalance
   - Push to _lockQueue
5. Update position:
   - outcome=1: yesShares += deltaShares
   - outcome=0: noShares += deltaShares
6. Update market state (qYes, qNo)
```

**getPositionQuote(market, outcome, deltaShares) → cost**
```
1. Get current state (qYes, qNo, b)
2. Calculate new state after trade
3. Return cost = C(new) - C(old)
```

**claimUnlocked(user)**
```
1. Process _lockQueue entries where expiry <= now
2. Reduce _lockedBalance by unlocked amounts
3. _availableBalance unchanged (still spendable)
4. User can now withdraw via separate function
```

### 6. TruthMarket

**Purpose:** Canonical lifecycle authority for a single market

#### State Variables

```
enum State { LIVE, SETTLING, SETTLED, FINALIZED }

State state;
uint8 winningOutcome;      // 0=NO, 1=YES, 2=INVALID
uint64 startTime;          // Market goes live
uint64 deadline;           // Trading deadline
uint64 tStar;              // Retroactive truth timestamp
address adjudicator;       // Can settle
address guardian;          // ProtocolConfig (V11)
address creator;
string question;
```

#### State Machine

```
                    ┌──────────────────────────────────────┐
                    │              LIVE                    │
                    │  (startTime ≤ now < deadline)        │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────┐
                    │            SETTLING                  │
                    │  (deadline passed, awaiting resolve) │
                    └───────────────┬──────────────────────┘
                                    │ adjudicator.settle()
                    ┌───────────────▼──────────────────────┐
     guardian.veto()│            SETTLED                   │
          ┌─────────│  (outcome determined, veto window)   │
          │         └───────────────┬──────────────────────┘
          │                         │ adjudicator.finalize()
          │         ┌───────────────▼──────────────────────┐
          └────────►│           FINALIZED                  │
                    │  (irreversible, redemption enabled)  │
                    └──────────────────────────────────────┘
```

#### Key Functions

**settle(outcome, tStar)**
```
require msg.sender == adjudicator
require state == LIVE or state == SETTLING
require outcome <= 2

winningOutcome = outcome
tStar = tStar
state = SETTLED
```

**finalize()**
```
require msg.sender == adjudicator
require state == SETTLED

state = FINALIZED
// Redemption now enabled
```

**veto()**
```
require IProtocolConfig(guardian).isGuardian(msg.sender)  // V11
require state == SETTLED

state = SETTLING
winningOutcome = 0
tStar = 0
// Allows re-adjudication
```

**isLive() → bool**
```
return state == LIVE && block.timestamp >= startTime && block.timestamp < deadline
```

**isSettled() → bool**
```
return state == SETTLED || state == FINALIZED
```

### 7. TickBookPoolManager

**Purpose:** Unified orderbook with range orders and spot sells

*(Same as V10 - no V11 changes)*

#### State Variables

```
mapping(bytes32 => Market) _markets;
mapping(bytes32 => MarketState) _state;
mapping(bytes32 => mapping(uint256 => RangeOrder)) _orders;
mapping(bytes32 => mapping(uint256 => SpotSellOrder)) _spotSellOrders;
mapping(bytes32 => mapping(uint8 => mapping(uint16 => TickLiquidity))) _tickLiquidity;
mapping(bytes32 => mapping(uint8 => Bitmap)) _bitmaps;
mapping(bytes32 => mapping(uint8 => Bitmap)) _spotBitmaps;

mapping(bytes32 => mapping(uint8 => uint256)) _fillGrowthGlobalX128;
mapping(bytes32 => mapping(uint8 => uint256)) _collateralUsedGrowthGlobalX128;

TickBookVault vault;
address registrar;
uint256 nextOrderId;
uint256 nextSpotSellId;
```

#### Key Functions

**placeOrder(marketKey, outcome, tickLower, tickUpper, shares, maxCost) → orderId**
```
1. Calculate collateral required
2. Reserve collateral via vault
3. Create RangeOrder struct
4. Update tick liquidity
5. Set bitmap bits for active ticks
6. Attempt crossing (_crossUnified)
7. Return order ID
```

**placeSpotSell(marketKey, outcome, tickLower, tickUpper, shares) → spotSellId**
```
1. Pull outcome tokens from user
2. Create SpotSellOrder struct
3. Update spot liquidity at price tick
4. Set spot bitmap bit
5. Return spot sell ID
```

**cancelOrder(marketKey, orderId)**
```
1. Verify ownership
2. Calculate unclaimed fills
3. Return unfilled collateral
4. Credit filled shares
5. Remove liquidity from ticks
6. Clear bitmap if tick now empty
7. Mark order inactive
```

**claimFills(marketKey, orderId) → (filledShares, collateralReturned)**
```
1. Calculate fills since last claim using accumulator
2. Credit shares to owner via vault
3. Return unused collateral
4. Update order's fill/collateral snapshots
```

### 8. Collateralizer

**Purpose:** Outcome token lifecycle management

*(Same as V10 - no V11 changes)*

#### Key Functions

**registerMarket(market, symbol) → (yesToken, noToken)**
```
1. Deploy OutcomeToken for YES (outcome=1)
2. Deploy OutcomeToken for NO (outcome=0)
3. Store mapping
4. Return addresses
```

**split(market, amount)**
```
// 1 USDC → 1 YES + 1 NO
1. Transfer amount USDC from user
2. Mint amount YES tokens to user
3. Mint amount NO tokens to user
```

**merge(market, amount)**
```
// 1 YES + 1 NO → 1 USDC
1. Burn amount YES tokens from user
2. Burn amount NO tokens from user
3. Transfer amount USDC to user
```

**redeem(market, amount)**
```
require TruthMarket is FINALIZED

outcome = TruthMarket.winningOutcome()

if outcome == 2 (INVALID):
    // 50% payout for both
    Burn user's YES tokens (up to amount)
    Burn user's NO tokens (up to amount)
    Transfer amount USDC to user
else:
    // 100% payout for winner, 0% for loser
    if outcome == 1:
        Burn amount YES tokens
        Transfer amount USDC
    else:
        Burn amount NO tokens
        Transfer amount USDC
```

---

## V11 Features

### Trial Period

Markets have a 7-day trial period that serves as a "proving ground":
1. **During trial** — Trading happens, fees accrue, costs are tracked for potential refunds
2. **After trial ends** — Evaluation based on graduation status:
   - **Graduated** → Market proved traction, continues normally (no dismiss allowed)
   - **NOT graduated** → Creator can dismiss, traders get refunds
3. **Dismiss condition** — `now >= trialEndTime && !isGraduated`

**Flow:**
```
Market Created
     │
     ▼
┌────────────────────────────────────┐
│         TRIAL PERIOD (7 days)      │
│                                    │
│  Trading happens, costs tracked    │
│  Fees accrue toward graduation     │
└──────────────┬─────────────────────┘
               │
               ▼ Trial ends, evaluate:
     ┌─────────┴─────────┐
     ▼                   ▼
┌──────────────┐   ┌──────────────────┐
│ NOT GRADUATED │   │    GRADUATED     │
│               │   │                  │
│ Creator can   │   │ Market continues │
│ dismiss()     │   │ (no dismiss)     │
│     │         │   │                  │
│     ▼         │   └──────────────────┘
│ DISMISSED     │
│ Refunds OK    │
└──────────────┘
```

**Tracking:**
- `userLockedCost[market][user]` — Cost paid by user (for refunds)
- `userTrialBalance[market][user]` — Net balance (costs - proceeds)
- `totalLockedCost` — Total across all traders (for protocol accounting)

### ERC20 LP Tokens

Each market has a dedicated ERC20 LP token:
- **Pre-settlement:** Freely transferable (DeFi composability)
- **Post-settlement:** Transfers locked (prevents gaming at settlement)
- **Minting:** Only LaunchpadEngine can mint (during trading)
- **Burning:** Only LaunchpadEngine can burn (during redemption)

**Token naming:**
- Name: `"Sooth LP: <truncated question>"`
- Symbol: `"sLP-<market address>"`

### ValidatedAdjudicator (TEE Settlement)

Markets can use a TEE-based adjudicator that verifies attestations:

1. **Registration:** When market is created with `adjudicatorAgentId` and `minValidators`
2. **Attestation:** TEE operator submits attestation to ERC-8004 Validation Registry
3. **Settlement:** Anyone can call `settle()` with the attestation hash
4. **Verification:** Adjudicator checks attestation is valid, recent, and from correct agent

**Multi-validator mode:** For high-value markets, require multiple attestations:
```
settleWithMultipleAttestations(market, outcome, tStar, [hash1, hash2, hash3])
```

### ProtocolConfig (Guardian & Pause)

Protocol-level controls:
- **Guardian list:** Multiple addresses can be guardians
- **Pause:** Guardians can pause LaunchpadEngine (stops creates and trades)
- **Veto:** Guardians can veto settled markets (via TruthMarket)

**Integration:**
- LaunchpadEngine checks `protocolConfig.isPaused()` on createMarket/tradePositions
- TruthMarket checks `protocolConfig.isGuardian(msg.sender)` on veto

### ERC-8004 Interfaces

ValidatedAdjudicator integrates with three ERC-8004 registries:

1. **Identity Registry:** TEE agent registration and metadata
2. **Reputation Registry:** Agent feedback and scoring
3. **Validation Registry:** Attestation submission and verification

**Attestation flow:**
```
TEE Agent                    Validation Registry              ValidatedAdjudicator
    │                               │                                │
    │ validationRequest(hash)       │                                │
    │──────────────────────────────►│                                │
    │                               │                                │
    │ validationResponse(hash,      │                                │
    │   score, proof)               │                                │
    │──────────────────────────────►│                                │
    │                               │                                │
    │                               │   settle(market, outcome,      │
    │                               │          tStar, hash)          │
    │                               │◄───────────────────────────────│
    │                               │                                │
    │                               │   getValidationStatus(hash)    │
    │                               │──────────────────────────────►│
    │                               │                                │
    │                               │   (validator, agentId,        │
    │                               │    score, tag, timestamp)      │
    │                               │◄──────────────────────────────│
```

---

## LMSR Mathematics

### Core Formulas

**Price Function:**
```
P(YES) = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
P(NO)  = 1 - P(YES)
```

**Cost Function (to reach state q from initial):**
```
C(qYes, qNo) = b × ln(e^(qYes/b) + e^(qNo/b))
```

**Trade Cost:**
```
cost = C(qYes_after, qNo_after) - C(qYes_before, qNo_before)
```

### Implementation (Numerical Stability)

The log-sum-exp trick prevents overflow:

```
// ln(e^a + e^b) = max(a,b) + ln(1 + e^(-|a-b|))

function logSumExp(b, qYes, qNo):
    a = qYes / b
    c = qNo / b
    maxVal = max(a, c)
    diff = abs(a - c)
    return b × (maxVal + ln(1 + e^(-diff)))
```

**Pseudocode for Trade Cost:**
```
function calculateCost(b, qYesBefore, qNoBefore, delta, isBuyYes):
    if isBuyYes:
        qYesAfter = qYesBefore + delta
        qNoAfter = qNoBefore
    else:
        qYesAfter = qYesBefore
        qNoAfter = qNoBefore + delta

    costBefore = logSumExp(b, qYesBefore, qNoBefore)
    costAfter = logSumExp(b, qYesAfter, qNoAfter)

    return costAfter - costBefore
```

### LP Valuation (Honest Floor Model)

```
Gross Cash = C(qYes, qNo, b)              // LMSR cost function value
Liability  = max(qYes, qNo)              // Worst-case payout
Floor      = max(0, Gross - Liability)   // Guaranteed LP equity
Ceiling    = max(0, Gross - min(qYes, qNo))  // Best-case LP equity
ExRate     = Floor / LP_Supply           // LP token value
```

---

## TickBook Orderbook

### Tick System

- **Range:** 1-999 (representing 0.1% to 99.9% probability)
- **Conversion:** `probability = tick / 1000`
- **Linear spacing** (unlike Uniswap V3's sqrt price)

### Two-Level Bitmap

```
struct Bitmap {
    uint256 level1;                    // 4 bits (one per word)
    mapping(uint8 => uint256) level2;  // 4 words × 256 bits = 1024 ticks
}

// Mapping tick → bitmap position:
wordIndex = tick >> 8       // tick / 256
bitIndex = tick & 0xFF      // tick % 256
```

**Operations:**
```
setBit(tick):
    level2[wordIndex] |= (1 << bitIndex)
    level1 |= (1 << wordIndex)

clearBit(tick):
    level2[wordIndex] &= ~(1 << bitIndex)
    if level2[wordIndex] == 0:
        level1 &= ~(1 << wordIndex)

findNextUp(startTick) → nextTick:
    // Find next set bit >= startTick
    // O(1) via word-level scan

findNextDown(startTick) → prevTick:
    // Find next set bit <= startTick
    // O(1) via word-level scan
```

### Unified Crossing Algorithm

**Order Types:**
1. **Range Orders** — Provide liquidity across tick range
2. **Spot Sells** — Sell existing tokens at specific price

**Crossing Priority:**
1. Spot sells first (recycle existing tokens)
2. Range orders second (mint synthetic tokens)

**Pseudocode:**
```
function crossUnified(newOrder):
    // Phase 1: Fill from spot sells
    overlapRange = calculateOverlap(newOrder)
    spotFilled = fillSpotLiquidity(newOrder, overlapRange)

    // Phase 2: Fill from range orders
    remainingShares = newOrder.shares - spotFilled
    rangeFilled = fillRangeLiquidity(newOrder, remainingShares, overlapRange)

    // Phase 3: Handle unfilled
    unfilled = newOrder.shares - spotFilled - rangeFilled
    if unfilled > dustThreshold:
        createRestingOrder(newOrder, unfilled)
    else:
        refundDust(newOrder.owner, unfilled)

    return (spotFilled + rangeFilled)
```

### Overlap Calculation (Price Inversion)

YES and NO ticks represent different effective YES prices:
- YES tick T = buyer pays T/1000 for YES
- NO tick T = buyer pays T/1000 for NO = seller accepts (1000-T)/1000 for YES

**Crossing condition:**
```
YES_tick + NO_tick >= 1000
```

**Example:**
```
YES order at tick 440 = willing to pay 44% for YES
NO order at tick 580 = willing to accept 42% for YES (100% - 58%)

44% (buyer) > 42% (seller) → CROSS!
440 + 580 = 1020 >= 1000 ✓
```

### Maker Attribution (Pro-Rata Fills)

Uses accumulator pattern for O(1) fill claims:

```
// Global accumulator (updated on each fill)
fillGrowthGlobalX128 += (filledShares × 2^128) / totalActiveLiquidity

// Per-order snapshot (set at order creation, updated on claim)
fillGrowthLastX128[orderId] = fillGrowthGlobalX128

// Pending fills for order
pendingFills = ((fillGrowthGlobalX128 - fillGrowthLastX128[orderId]) × order.liquidity) / 2^128
```

---

## Market Lifecycle

### Creation Flow (V11)

```
1. Creator calls LaunchpadEngine.createMarket() with:
   - question, startTime, deadline
   - adjudicator address
   - initialLiquidity
   - adjudicatorAgentId (optional, for ValidatedAdjudicator)
   - adjudicatorMinValidators (optional)
2. Creator deposit = bBase × ln(2) pulled
3. TruthMarket deployed with adjudicator and ProtocolConfig as guardian
4. If using ValidatedAdjudicator: register market with agent config
5. AMMEngine initialized: qYes=0, qNo=0, b=bBase
6. LaunchpadLPToken ERC20 deployed
7. Trial period initialized: trialEndTime = now + 7 days
8. Creator receives initial LP tokens
9. Market is LIVE
```

### Trading Flow (with Trial Period)

```
1. User calls LaunchpadEngine.tradePositions()
2. Check market not dismissed
3. Fee calculated based on graduation state
4. AMMEngine.tradePositionsFor() executed
5. If in trial period:
   - Track userLockedCost for potential refund
   - Track userTrialBalance
6. Spendable balance used first, then wallet
7. Sells: proceeds locked for 24h
8. Position updated (dual-balance)
9. Market state (qYes, qNo) updated
```

### Trial Period Resolution

```
After 7-day trial period ends, evaluate graduation status:

OPTION A: Market Graduated (success)
1. Fees accrued >= graduation threshold
2. Market continues normally
3. Creator CANNOT dismiss (market proved traction)
4. No refunds available
5. Proceeds to settlement when deadline passes

OPTION B: Market NOT Graduated (failed to gain traction)
1. Fees accrued < graduation threshold after 7 days
2. Creator can call dismissMarket()
3. Traders call claimRefund() to recover locked costs
4. Market frozen
```

### Graduation Trigger

```
Graduation occurs when:
    feesAccrued >= bBase × ln(2) × graduationMultiplier

On graduation:
1. isGraduated = true
2. Outcome tokens registered via Collateralizer
3. Market registered in TickBook for orderbook trading
4. Fee distribution switches to post-grad splits
```

### Settlement Flow (with ValidatedAdjudicator)

```
1. Deadline passes → Market enters SETTLING
2. TEE agent generates attestation → submits to Validation Registry
3. Anyone calls ValidatedAdjudicator.settle(market, outcome, tStar, attestationHash)
4. Adjudicator verifies attestation and calls TruthMarket.settle()
5. Market enters SETTLED
6. Optional: Guardian (via ProtocolConfig) can veto
7. Adjudicator calls finalize()
8. Market enters FINALIZED
9. Redemption enabled via Collateralizer.redeem()
```

---

## Fee Economics

### Pre-Graduation (Default 5%)

```
On each trade:
    fee = tradeCost × 5%

Distribution:
    100% → Liquidity depth (bCurrent)
    100% → LP tokens minted to trader

Calculation:
    deltaB = fee × (1 / ln(2))
    bCurrent += deltaB
    lpMinted = fee
```

### Post-Graduation (Default 1%)

```
On each trade:
    fee = tradeCost × 1%

Distribution:
    50% → Liquidity depth (bCurrent)
    30% → LP yield pool
    20% → Protocol treasury

Calculation:
    toBBase = fee × 50%
    toLPYield = fee × 30%
    toProtocol = fee × 20%
```

### Graduation Threshold

```
threshold = bBase × ln(2) × graduationMultiplier

multiplier = 1: Graduate at break-even (fees = creator deposit)
multiplier = 2: Graduate at 2× break-even

Example:
    bBase = 10,000 USDC
    deposit = 10,000 × 0.693 = 6,930 USDC
    threshold (mult=1) = 6,930 USDC in fees
```

---

## Settlement & Redemption

### Outcome Values

| Outcome | YES Token Value | NO Token Value |
|---------|-----------------|----------------|
| YES (1) | 1.0 USDC | 0 USDC |
| NO (0) | 0 USDC | 1.0 USDC |
| INVALID (2) | 0.5 USDC | 0.5 USDC |

### Redemption Process

```
1. Market must be FINALIZED
2. User calls Collateralizer.redeem(market, amount)
3. Winning tokens burned
4. USDC returned at face value
```

### AMM Settlement

```
1. Trading stops when TruthMarket.isLive() returns false
2. LP redemption uses floor value
3. User positions redeemable via Collateralizer
```

### TickBook Settlement

```
1. Active orders can be cancelled
2. Filled shares become outcome tokens
3. Outcome tokens redeemable via Collateralizer
```

---

## Security Invariants

### Critical Invariants

1. **Token Conservation:**
   ```
   supply(YES) == supply(NO) (always)
   ```

2. **Vault Solvency:**
   ```
   vault.totalCollateral >= sum(all order collateral requirements)
   ```

3. **Lock Invariant:**
   ```
   lockedBalance[user] <= availableBalance[user] (always)
   ```

4. **LMSR Non-Negativity:**
   ```
   qYes >= 0, qNo >= 0, b > 0 (always)
   ```

5. **Position Non-Negativity:**
   ```
   position.yesShares >= 0
   position.noShares >= 0
   ```

6. **Fill Completeness:**
   ```
   order.filledShares <= order.sharesTotal (always)
   ```

7. **Trial Refund Integrity (V11):**
   ```
   sum(userLockedCost) == totalLockedCost
   ```

8. **LP Token Transfer Lock (V11):**
   ```
   If market.isSettled(): LP transfers blocked
   ```

### Access Control

| Function | Caller |
|----------|--------|
| LaunchpadEngine.createMarket() | Anyone (when not paused) |
| LaunchpadEngine.tradePositions() | Anyone (when not paused) |
| LaunchpadEngine.dismissMarket() | Creator only (during trial) |
| LaunchpadEngine.claimRefund() | Anyone (after dismissal) |
| LaunchpadEngine.setFees() | Owner only |
| AMMEngine.tradePositionsFor() | Router only |
| TruthMarket.settle() | Adjudicator only |
| TruthMarket.finalize() | Adjudicator only |
| TruthMarket.veto() | Guardian (via ProtocolConfig) |
| ProtocolConfig.pause() | Owner or Guardian |
| ProtocolConfig.setGuardians() | Owner only |
| TickBookPoolManager.registerMarket() | Registrar only |
| ValidatedAdjudicator.settle() | Anyone (with valid attestation) |
| LaunchpadLPToken.mint/burn() | LaunchpadEngine only |

### Reentrancy Protection

All state-changing functions must be protected:
- AMM trades
- Orderbook operations
- Collateral transfers
- LP redemptions
- Trial dismissal/refunds

---

## Implementation Notes

### Precision & Decimals

| Context | Precision | Notes |
|---------|-----------|-------|
| Internal math | WAD (1e18) | All calculations |
| USDC transfers | 6 decimals | Standard USDC |
| Tick range | 1-999 | 0.1%-99.9% probability |
| Basis points | /10000 | Fee percentages |
| Lock duration | 24 hours | Sell proceeds |
| Trial period | 7 days | V11 default |
| Attestation window | 1 hour | V11 default |
| Validation score | 0-100 | ERC-8004 |

**Conversion Functions:**
```
wadToUsdc(wadAmount):
    return wadAmount / 1e12  // 18 - 6 = 12

usdcToWad(usdcAmount):
    return usdcAmount × 1e12
```

### Gas Optimization Patterns

1. **Bitmap for tick discovery** — O(1) instead of O(n)
2. **Accumulator pattern for fills** — O(1) claim instead of O(orders)
3. **Packed storage** — Multiple values in single slot
4. **Unchecked arithmetic** — Where overflow impossible

### Error Handling

Use custom errors instead of require strings:
```
error InsufficientBalance(uint256 required, uint256 available);
error MarketNotLive();
error SlippageExceeded(uint256 actual, uint256 limit);
error UnauthorizedCaller();
error InvalidOutcome(uint8 outcome);
error TransfersLocked();                    // V11: LP token
error MarketDismissed();                    // V11: Trial period
error TrialEnded();                         // V11: Trial period
error AttestationInvalid();                 // V11: ValidatedAdjudicator
error InsufficientValidators();             // V11: ValidatedAdjudicator
```

### Testing Requirements

1. **Unit tests** — Individual function behavior
2. **Integration tests** — Cross-contract flows
3. **Fuzz tests** — Random input validation
4. **Invariant tests** — Property-based testing
5. **Fork tests** — Live network verification
6. **Trial period tests** — Dismiss/refund flows (V11)
7. **Attestation tests** — ValidatedAdjudicator flows (V11)

---

## Appendix: Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `WAD` | 1e18 | Standard precision |
| `MIN_TICK` | 1 | Minimum tick |
| `MAX_TICK` | 999 | Maximum tick |
| `LOCK_DURATION` | 86400 | 24 hours in seconds |
| `DEFAULT_TRIAL_PERIOD` | 604800 | 7 days in seconds (V11) |
| `DEFAULT_ATTESTATION_WINDOW` | 3600 | 1 hour in seconds (V11) |
| `DEFAULT_MIN_VALIDATION_SCORE` | 80 | 0-100 scale (V11) |
| `LN2_WAD` | 693147180559945309 | ln(2) × 1e18 |
| `LN2_INV_WAD` | 1442695040888963407 | 1/ln(2) × 1e18 |
| `Q128` | 2^128 | Accumulator precision |
| `BPS_DENOMINATOR` | 10000 | Basis point divisor |
| `INFINITE_DEADLINE` | 7258118399 | Dec 31, 2199 UTC |

---

## Version History

- **V11** — Trial Period, ERC20 LP Tokens, ValidatedAdjudicator, ProtocolConfig
- **V10.8** — Unified crossing, spot-first settlement
- **V10.0** — Package split (core/testing)
- **V9.0** — Singleton PoolManager architecture
- **V8.2** — Dual-balance position model
- **V8.0** — Lock-on-Sell, router delegation

---

*This document provides specifications for rebuilding the Sooth Protocol on any blockchain platform.*
