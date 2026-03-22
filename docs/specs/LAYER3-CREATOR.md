# Layer 3: Market Creator Specification

> Sooth Protocol — Creator Layer
> Version: 0.1.0
> Date: 2026-03-07
> License: MIT (Layer 1 Core)

---

## Table of Contents

1. [Overview](#1-overview)
2. [What is a Creator?](#2-what-is-a-creator)
3. [Creating a Market](#3-creating-a-market)
4. [bBase Selection — Liquidity Depth](#4-bbase-selection--liquidity-depth)
5. [Initial Odds](#5-initial-odds)
6. [Creator Deposit & Economics](#6-creator-deposit--economics)
7. [Graduation — From Bonding to Full Market](#7-graduation--from-bonding-to-full-market)
8. [Trial Period — The 7-Day Proving Ground](#8-trial-period--the-7-day-proving-ground)
9. [Dismissing a Market](#9-dismissing-a-market)
10. [Choosing an Adjudicator](#10-choosing-an-adjudicator)
11. [LP Token Economics](#11-lp-token-economics)
12. [Fee Configuration (Operator-Set)](#12-fee-configuration-operator-set)
13. [Market Lifecycle from Creator Perspective](#13-market-lifecycle-from-creator-perspective)
14. [Redemption & Settlement](#14-redemption--settlement)
15. [Deadline Strategies](#15-deadline-strategies)
16. [Creator Checklist](#16-creator-checklist)

---

## 1. Overview

### What is Layer 3?

The Sooth Protocol is structured in three layers:

| Layer | Responsibility | Primary Audience |
|-------|---------------|-----------------|
| **Layer 1** (Settlement) | Core contracts, trading, fees, lifecycle | Operators, auditors, integrators |
| **Layer 2** (Adjudication) | Truth determination, resolution, guardians | Adjudicator developers |
| **Layer 3** (Creation) | Market creation, LP economics, trial management | **Market creators** |

Layer 3 is not a separate set of contracts. It describes **how a creator interacts with Layer 1 contracts** to create, operate, and manage prediction markets. This spec covers every decision a creator makes, the economics behind those decisions, and the lifecycle of a market from the creator's perspective.

### Who is This Spec For?

- **Market creators** who want to understand what happens when they create a market
- **AI agents** that need to help users create markets programmatically
- **Frontend developers** building market creation UIs
- **Anyone** who wants to understand the economics of market creation

---

## 2. What is a Creator?

A creator is any EOA or contract that calls `LaunchpadEngine.createMarket()`. The creator:

1. **Chooses the question** — what the market is about
2. **Sets bBase** — the initial liquidity depth (determines deposit)
3. **Selects an adjudicator** — the contract that will determine the outcome
4. **Sets timing** — start time and deadline
5. **Pays a deposit** — locked collateral that funds the initial AMM liquidity
6. **Sets initial odds** — the starting probability for YES/NO (default 50/50)
7. **Graduation speed** — controlled by operator's `graduationBps` setting (instance-wide)

After creation, the creator has limited ongoing powers:

| Action | When Available |
|--------|---------------|
| Increase bBase | Any time before settlement (adds liquidity + receives LP tokens) |
| Dismiss market | After trial period ends, only if NOT graduated |
| Redeem LP tokens | After graduation, or after settlement |

#### `increaseBBase(market, amount)`

The creator can add additional liquidity to the AMM at any time:

```
Creator calls LaunchpadEngine.increaseBBase(market, amount)
  1. baseToken.transferFrom(creator, ammEngine, amount)
  2. mState.bBase += amountInWad
  3. ammEngine.increaseLiquidity(market, amountInWad)
  4. Mint LP tokens to creator (1:1 with WAD deposit)
```

This increases the AMM depth (less price impact) and gives the creator additional LP tokens. Note: increasing bBase also increases the deposit (and thus the graduation threshold), since `threshold = deposit * graduationBps / 10000`.

The creator **cannot**:

- Change the adjudicator after creation
- Modify fees after creation
- Force-resolve the market
- Redeem LP tokens during bonding phase (locked until graduation or settlement)
- Prevent traders from trading
- Dismiss a graduated market

### Creator vs Operator

| | Creator | Operator |
|---|---|---|
| **Scope** | Per-market | Per-instance (all markets) |
| **Sets** | bBase, adjudicator, question, odds | Fee rates, fee splits, matching engine, base token, trial period, graduationBps |
| **Deploys** | Nothing (calls createMarket) | The entire instance (LaunchpadEngine, AMMEngine, etc.) |
| **Economics** | Deposit → LP tokens (redeemable after settlement) | Fee revenue from all markets |

The creator operates **within** the economic rules set by the operator. All markets in an instance share the same fee structure, base token, and matching engine.

---

## 3. Creating a Market

### The createMarket() Function

```solidity
function createMarket(
    string memory _question,
    uint64 _startTime,
    uint64 _deadline,
    address _adjudicator,
    uint256 _bBase,
    uint256 _initialProbabilityWad   // 0 = default 50/50, else WAD (e.g., 0.7e18 = 70% YES)
) external returns (address market, address lpToken);
```

### Parameters Explained

#### `_question` (string)

The prediction market question. This is stored on-chain in the TruthMarket clone and is immutable after creation.

**Good questions:**

- "Will BTC exceed $100,000 by December 31, 2026?"
- "Will Ethereum merge to proof-of-stake before Q3 2026?"
- "Will it rain in San Francisco on March 15, 2026?"

**Bad questions:**

- "Is BTC good?" (subjective, no clear resolution criteria)
- "" (empty string — will still deploy but is useless)

The question should be unambiguous and resolvable by the chosen adjudicator.

#### `_startTime` (uint64)

Unix timestamp when trading begins. Before this time, `TruthMarket.isLive()` returns false and no trades are allowed.

- Set to `block.timestamp` (or 0) for immediate trading
- Set to a future timestamp for delayed start (e.g., event-based markets)
- Must be before `_deadline`

#### `_deadline` (uint64)

Unix timestamp after which the market can be invalidated if the adjudicator hasn't resolved it.

Two strategies:

| Strategy | Deadline Value | Behavior |
|----------|---------------|----------|
| **Finite** | Any future timestamp | After deadline: anyone can call `invalidate()` → outcome = INVALID, state → SETTLED |
| **Infinite** | `7258118399` (Dec 31, 2199) | Only the adjudicator can resolve. No automatic invalidation. Market stays LIVE indefinitely. |

See [Section 15: Deadline Strategies](#15-deadline-strategies) for guidance.

#### `_adjudicator` (address)

The contract that will determine the market outcome. This address is **permanently bound** — it cannot be changed after creation. Only this address can call `resolve()`, `verifyAttestation()`, and `settle()` on the market's TruthMarket.

Two selection modes (per-instance, set by operator):

| Mode | Condition | Creator Choice |
|------|-----------|---------------|
| **Permissionless** | `adjudicatorRegistry == address(0)` | Any address |
| **Registry-gated** | `adjudicatorRegistry != address(0)` | Must be in the approved whitelist |

See [Section 10: Choosing an Adjudicator](#10-choosing-an-adjudicator) for detailed guidance.

#### `_bBase` (uint256)

The initial LMSR liquidity parameter in WAD (1e18). See [Section 4](#4-bbase-selection--liquidity-depth) for detailed guidance. It determines:

1. **Creator deposit** ≈ `bBase * 0.693` (at 50/50 odds, higher with custom odds)
2. **Graduation threshold** = `deposit * graduationBps / 10000`
3. **AMM depth** — higher bBase = less price impact per trade

#### `_initialProbabilityWad` (uint256) — optional

Starting probability for YES in WAD precision. Set to `0` for default 50/50. See [Section 5](#5-initial-odds) for the math and deposit impact.

#### `graduationBps` (operator-set, instance-wide)

> **Note:** `graduationBps` is NOT a createMarket parameter. It is set by the **operator** at the instance level via `setGraduationBps()` on LaunchpadEngine. All markets in the instance share the same graduation speed.

Controls how much fee revenue is required to graduate. The graduation threshold is:

```
graduationThreshold = creatorDeposit * graduationBps / 10000
```

| graduationBps | Threshold vs Deposit | Meaning |
|--------------|---------------------|---------|
| 1 | 0.01% of deposit | Almost instant graduation (minimal fees needed) |
| 5000 | 50% of deposit | Graduates at half the fee volume (faster) |
| 10000 (default) | 100% of deposit | Fees must equal deposit to graduate (break-even) |
| 20000 | 200% of deposit | Needs 2× deposit in fees (harder, proves stronger demand) |
| 1000000 | 10000% of deposit | Extreme — 100× deposit in fees required |

Lower values = faster graduation = quicker LP unlock, but less proof of market demand. Higher values = slower graduation = stronger traction signal before the matching engine opens.

Range: `1–1000000`. Set by operator via `LaunchpadEngine.setGraduationBps()`.

### What Happens During createMarket()

Step-by-step execution inside LaunchpadEngine:

```
1. Validate adjudicator
   ├── If registry == address(0): ALLOW any address
   └── If registry != address(0): require(registry.isApproved(_adjudicator))

2. Calculate and collect creator deposit
   If initialProbabilityWad == 0:
     deposit = bBase * LN2_WAD / 1e18              (≈ bBase * 0.693)
   Else:
     (initQYes, initQNo) = computeLogit(bBase, initialProbabilityWad)
     deposit = C(initQYes, initQNo)                (higher for non-50/50 odds)
   require(deposit >= MIN_DEPOSIT_WAD)
   baseToken.transferFrom(creator, ammEngine, depositInBaseTokenDecimals)

3. Deploy TruthMarket clone via CREATE2 (~50k gas)
   salt = keccak256(abi.encodePacked(creator, adjudicator, question, nonce))
   nonce = creatorNonce[creator]++  (auto-incremented)
   market = Clones.cloneDeterministic(truthMarketImpl, salt)

4. Initialize TruthMarket
   market.initialize(question, startTime, deadline, adjudicator, launchpadEngine, creator)

5. Initialize AMM state
   If initialProbabilityWad == 0:
     ammEngine.initializeMarket(market, bBase, 0, 0)         → 50/50
   Else:
     ammEngine.initializeMarket(market, bBase, initQYes, initQNo)  → custom odds

6. Deploy LaunchpadLPToken (ERC20)
   lpToken = new LaunchpadLPToken(market, launchpadEngine, "Sooth LP: {question}", "sLP-{addr}")

7. Register with FeeRouter
   feeRouter.registerMarket(market, bBase)
   (FeeRouter reads the adjudicator from TruthMarket internally)

8. Store market state
   MarketState { creator, lpToken, bBase, creatorDeposit, graduatedAt: 0 }
   TrialState { trialEndTime: block.timestamp + defaultTrialPeriod, isDismissed: false }

9. Mint initial LP tokens to creator
   lpTokens = depositWad  (1:1 with deposit in WAD)
   LaunchpadLPToken(lpToken).mint(creator, lpTokens)

10. Emit MarketCreated event

Returns: (market address, lpToken address)
```

### Deterministic Market Addresses

Market addresses are deterministic via CREATE2. Anyone can predict the address before creation:

```solidity
bytes32 salt = keccak256(abi.encodePacked(creator, adjudicator, question, nonce));
address predicted = Clones.predictDeterministicAddress(truthMarketImpl, salt, launchpadEngine);
```

The nonce auto-increments per creator. To predict the next address, read `creatorNonce[creator]` from LaunchpadEngine.

**Market Key** (used by matching engine):

```
bytes32 marketKey = keccak256(abi.encodePacked(marketAddress));
```

Note: uses `encodePacked` (not `abi.encode`) — no 32-byte padding.

---

## 4. bBase Selection — Liquidity Depth

### What is bBase?

`bBase` is the initial LMSR liquidity parameter. It controls how much the price moves in response to trades. Think of it as the "depth" of the automated market maker.

### How bBase Affects Price Impact

The LMSR pricing formula is defined in Layer 1 (`AMMEngine` section). The key relationship for creators: **higher bBase = less price impact per trade**.

**Price impact example** (buying 100 YES shares at 50/50):

| bBase | Price before | Price after 100 shares | Move |
|-------|-------------|----------------------|------|
| 100 | 50.0% | 73.1% | +23.1% |
| 1,000 | 50.0% | 52.5% | +2.5% |
| 10,000 | 50.0% | 50.25% | +0.25% |

Higher bBase = smoother price discovery. But it also means a larger deposit and a higher graduation threshold.

### bBase vs Graduation Threshold

The graduation threshold depends on both the deposit and the operator's `graduationBps`:

```
threshold = deposit * graduationBps / 10000
```

| bBase | Deposit | graduationBps | Threshold | Meaning |
|-------|---------|--------------|-----------|---------|
| 1,000 | 693 | 10000 (default) | 693 in fees | Break-even: fees = deposit |
| 1,000 | 693 | 5000 | 347 in fees | Faster: half the fees needed |
| 10,000 | 6,930 | 10000 | 6,930 in fees | Break-even at larger scale |
| 10,000 | 6,930 | 20000 | 13,860 in fees | Harder: 2× deposit in fees |

**The key insight**: graduation threshold scales with both bBase (via deposit) and `graduationBps`. The creator controls depth (via bBase), the operator controls graduation speed (via graduationBps).

### Choosing the Right bBase

**Consider:**

1. **Expected trading volume** — Will enough traders participate to reach graduation?
2. **Price discovery quality** — Too low bBase means volatile, manipulable prices
3. **Capital commitment** — Deposit is locked until graduation or market settlement
4. **Time horizon** — Longer markets have more time to accumulate fees

### bCurrent Growth

`bCurrent` starts equal to `bBase` and grows as pre-graduation fees are reinvested:

```
When a fee is collected (pre-graduation):
  bCurrentIncrease = fee / ln(2)
  bCurrent += bCurrentIncrease
```

This means the AMM gets deeper over time as more trading occurs. Early traders face more price impact; later traders face less.

---

## 5. Initial Odds

### `_initialProbabilityWad` (uint256) — optional

The creator can set a starting probability for YES. If omitted (or set to 0), the default is 50/50.

The LMSR supports arbitrary starting odds via parameter seeding. The `createMarket()` function accepts `_initialProbabilityWad` in WAD precision (e.g., `0.7e18` = 70% YES).

### How It Works

For a target P(YES) = `p`, the LMSR initial state is computed using the **logit function**:

```
qYes - qNo = b × logit(p) = b × ln(p / (1 - p))
```

Convention: fix one side at zero, offset the other:

- `p >= 50%`: set `qNo = 0`, `qYes = b × logit(p)`
- `p < 50%`: set `qYes = 0`, `qNo = b × logit(1 - p)`

| Target P(YES) | qYes (for b=1000) | qNo | Deposit (relative to b) |
|--------------|-------------------|-----|------------------------|
| 50% (default) | 0 | 0 | 0.693 × b |
| 60% | 405 | 0 | 0.743 × b (+7%) |
| 70% | 847 | 0 | 0.857 × b (+24%) |
| 80% | 1,386 | 0 | 1.075 × b (+55%) |
| 90% | 2,197 | 0 | 1.504 × b (+117%) |
| 30% | 0 | 847 | 0.857 × b (+24%) |
| 15% | 0 | 1,735 | 1.504 × b (+117%) |

### Deposit Impact

The deposit equals the LMSR cost function at the initial state: `C(qYes, qNo) = b × ln(e^(qYes/b) + e^(qNo/b))`.

At 50/50 this reduces to `b × ln(2) ≈ b × 0.693`. With asymmetric odds the deposit **increases** because the LMSR starts with inventory exposure. The extra deposit covers the higher worst-case liability.

### Contract Changes

Three modifications to support initial odds:

1. **`AMMEngine.initializeMarket(market, bBase, initQYes, initQNo)`** — accepts initial inventory state instead of hardcoding zeros
2. **`LaunchpadEngine.createMarket(..., initialProbabilityWad)`** — computes logit internally, derives `(initQYes, initQNo)`, calculates the correct deposit via `C(initQYes, initQNo)`
3. **`LMSRMath.logit(p)`** — exposes the logit function (the library already has the needed `ln()` internally)

No virtual trades are emitted. The deposit calculation is exact. The cost function `C(qYes, qNo)` already handles arbitrary starting positions correctly.

### createMarket Step 5 With Custom Odds

When `initialProbabilityWad != 0`:

```
5. Initialize AMM state (with custom odds)
   (initQYes, initQNo) = computeLogit(bBase, initialProbabilityWad)
   ammEngine.initializeMarket(market, bBase, initQYes, initQNo)
   Deposit = C(initQYes, initQNo) instead of bBase * ln(2)
```

---

## 6. Creator Deposit & Economics

### Deposit Calculation

The creator deposit is the collateral locked when creating a market:

```
creatorDeposit = bBase * LN2_WAD / 1e18     (at 50/50 odds)
creatorDeposit = C(initQYes, initQNo)        (with custom odds — higher)
```

Simplified at 50/50: **deposit ≈ bBase * 0.693**

The deposit goes directly to AMMEngine as initial LMSR liquidity. In return, the creator receives LP tokens equal to the deposit (1:1 in WAD). **LP tokens are the creator's only claim on the AMM** — there is no separate deposit refund.

### Deposit Lifecycle

```
Creation                  Graduation              Settlement
   │                          │                       │
   ▼                          ▼                       ▼
 Creator pays deposit    LP tokens unlock         LP tokens redeemable
 → goes to AMMEngine     (transferable +          for floor value + yield
 → receives LP tokens    redeemable)
 → LP tokens LOCKED
```

**LP tokens are locked during bonding** (cannot redeem, cannot transfer). This prevents the creator from draining AMM liquidity before the market proves itself. LP tokens unlock at graduation or at settlement.

### What Happens to the Deposit?

| Scenario | Creator Outcome |
|----------|----------------|
| Market graduates + settles | Redeem LP for floor value + LP yield. Best case. |
| Market dismissed | Redeem LP for residual floor value. Traders get locked costs refunded via `claimRefund()`. Creator recovers remaining AMM equity via LP tokens. |
| Market settled without graduation | Redeem LP for floor value. Same as normal settlement. |

### Creator P&L Scenarios

All values assume bBase=1000, deposit ≈ 693 tokens, 50/50 odds.

**Best case: Market graduates, heavy trading, settles**

```
Creator pays:     693 tokens (deposit)
Creator receives: LP redemption value (floor + yield from accumulated fees)
Net P&L:          Positive — fees grew the AMM, LP tokens worth more than deposit
```

**Neutral case: Market graduates, minimal trading**

```
Creator pays:     693 tokens (deposit)
Creator receives: LP redemption ≈ 693 tokens (floor ≈ deposit when balanced trading)
Net P&L:          Break-even
```

**Worst case: Market dismissed, one-sided trading**

```
Creator pays:     693 tokens (deposit)
Creator receives: LP redemption = floor value (reduced by max(qYes, qNo))
Net P&L:          Negative — floor shrinks as one-sided exposure grows
```

**Dismissed, almost no trading:**

```
Creator pays:     693 tokens
Creator receives: LP redemption ≈ 693 (qYes ≈ qNo ≈ 0, floor ≈ deposit)
Net P&L:          ≈ break-even (creator recovers most via LP)
```

### Why This Design?

1. **Skin in the game** — creators fund the initial AMM, can't withdraw during bonding
2. **LP tokens as the single claim** — no separate deposit refund, no double-counting
3. **Market-driven outcomes** — creator's recovery depends on how the market traded, not a guaranteed refund

At `graduationBps = 10000` (default), the graduation threshold equals the deposit — the market must generate enough fees to prove demand before the matching engine opens.

---

## 7. Graduation — From Bonding to Full Market

### What is Graduation?

Graduation is the transition from the bonding phase (AMM-only trading with high fees) to a full market (AMM + matching engine with low fees). It occurs when accumulated fees reach the graduation threshold.

### Graduation Trigger

```
graduationThreshold = creatorDeposit * graduationBps / 10000
Condition: feesAccrued >= graduationThreshold
```

Graduation is checked automatically inside FeeRouter after every trade. When the condition is met:

```
1. FeeRouter calls launchpadEngine.notifyGraduation(market)
2. LaunchpadEngine:
   a. Marks market as graduated (graduatedAt = block.timestamp)
   b. Unlocks LP tokens (transferable + redeemable)
   c. Registers market in matching engine (SoothBook or offchain CLOB)
3. Fee rate drops from preGradFeeBps (5%) to postGradFeeBps (1%)
4. Fee distribution changes to post-grad split (50/30/10/10)
```

### Before vs After Graduation

| Property | Pre-Graduation (Bonding) | Post-Graduation |
|----------|-------------------------|-----------------|
| **Trading venue** | AMMEngine only | AMMEngine + Matching Engine |
| **Fee rate** | 5% (default) | 1% (default) |
| **Fee distribution** | 100% → bBase growth + LP tokens to trader | 50% bBase / 30% LP yield / 10% adjudicator / 10% protocol |
| **LP token minting** | Yes (to traders) | No |
| **LP tokens** | Locked (no transfer, no redeem) | Unlocked (transferable + redeemable) |
| **Can be dismissed** | Yes (after trial) | No |
| **Price discovery** | AMM-driven (LMSR) | AMM + orderbook |
| **Liquidity depth** | Growing (bCurrent increases) | Stable + orderbook liquidity |

### Graduation Progress

Frontends should show graduation progress:

```
progress = feesAccrued / graduationThreshold * 100%

Where: graduationThreshold = creatorDeposit * graduationBps / 10000
```

Example: bBase = 1000, deposit ≈ 693, graduationBps = 10000, feesAccrued = 400

```
threshold = 1000 * 0.693 * 1 = 693
progress  = 400 / 693 = 57.7%
```

**Important**: Use `feesAccrued` for progress, NOT `bBase` or `bCurrent`. The graduation is fee-driven.

### What Happens to Trading at Graduation?

Nothing disrupts ongoing AMM trading. The AMM continues to work exactly as before. The only changes are:

1. Fee rate drops
2. Fee distribution changes
3. Matching engine becomes available as an additional venue
4. LP token minting stops

Traders can continue using the AMM after graduation. The matching engine is an additional venue, not a replacement.

---

## 8. Trial Period — The 7-Day Proving Ground

### Purpose

The trial period protects traders from failed markets. It gives the market a window to prove viability (via graduation). If the market fails to graduate within the trial period, the creator can dismiss it.

### How it Works

```
Market created → Trial starts (defaultTrialPeriod, default 7 days)
                    │
                    ├── During trial: normal AMM trading
                    │
                    ├── If market graduates DURING trial:
                    │   Trial becomes irrelevant. Market continues.
                    │   LP tokens unlocked. Cannot be dismissed.
                    │
                    └── After trial ends:
                        ├── If graduated: market continues normally
                        └── If NOT graduated: creator can dismiss
```

### Trial State

| Storage | Type | Description |
|---------|------|-------------|
| `trialEndTime` | `uint64` | `block.timestamp + defaultTrialPeriod` at creation |
| `isDismissed` | `bool` | Set to true when creator calls `dismissMarket()` |

The `defaultTrialPeriod` is configurable by the operator (max 30 days, default 7 days).

### What Can Happen After Trial Ends?

| Scenario | Graduated? | Creator Action | Trader Action |
|----------|-----------|---------------|---------------|
| Market is thriving | Yes | None needed (LP unlocked) | Continue trading |
| Market has no activity | No | Call `dismissMarket()` | Call `claimRefund()` to recover locked costs |
| Market has some activity | No | Choose: wait or dismiss | Wait for graduation, or `claimRefund()` after dismiss |

### Key Rule

**Graduation protects traders.** Once a market graduates, it cannot be dismissed. The creator cannot "rug pull" a market that has proven traction.

---

## 9. Dismissing a Market

### When Can a Creator Dismiss?

All four conditions must be true:

```
1. block.timestamp >= trialEndTime        (trial period has ended)
2. !isGraduated                           (market has NOT graduated)
3. !isDismissed                           (not already dismissed)
4. msg.sender == creator                  (only the creator)
```

### What Happens on Dismiss?

```
Creator calls LaunchpadEngine.dismissMarket(market)
    │
    ├── Validates conditions:
    │   ├── msg.sender == creator
    │   ├── block.timestamp >= trialEndTime
    │   ├── !isDismissed
    │   └── graduatedAt == 0 (not graduated)
    │
    ├── Sets trial.isDismissed = true
    │
    ├── Calls TruthMarket.dismiss() → state = DISMISSED
    │   └── Trading halts (isLive() returns false)
    │
    └── Redemption paths:
        ├── Traders: claimRefund(market) → locked cost refunded (what they paid)
        └── Creator: redeemLP() → residual floor value
```

All redemption is pull-based. Dismissed ≠ INVALID: traders get their locked cost back (not a 50% payout per share). The refund amount is capped at the AMMEngine's available balance per user to ensure solvency.

### What if the Creator Doesn't Dismiss?

If the market doesn't graduate and the creator never dismisses:

- The market stays LIVE indefinitely (or until deadline)
- Traders can still trade on the AMM
- The adjudicator can still resolve the market normally
- Settlement proceeds normally if the adjudicator acts

There is no automatic dismissal. The creator must actively choose to dismiss.

---

## 10. Choosing an Adjudicator

### Why This Matters

The adjudicator is the entity that determines the market outcome. Choosing the wrong adjudicator means:

- The market may never resolve (adjudicator goes offline)
- The market may resolve incorrectly (adjudicator is malicious or buggy)
- Traders may lose trust (unreliable or slow resolution)

The adjudicator choice is **permanent** — it cannot be changed after creation.

For the full adjudicator type taxonomy (ZkTLS, TEE, Oracle, DAO, Manual, Optimistic), trust models, and resolution patterns, see **`LAYER2-ADJUDICATOR.md` Section 4**.

### Selection Modes

Two modes (set by operator at the instance level):

- **Permissionless** (`adjudicatorRegistry == address(0)`): creator can pass any address. Full responsibility on creator.
- **Registry-gated** (`adjudicatorRegistry != address(0)`): creator must choose from operator's approved whitelist.

### Creator Quick Check

1. Does the adjudicator match the question type? (See Layer 2 taxonomy)
2. Is it active? (Check resolution rate and guardian count)
3. Is it approved in this instance? (If registry-gated)

---

## 11. LP Token Economics

### What are LP Tokens?

Each market has its own ERC20 LP token (`LaunchpadLPToken`) deployed at creation. LP tokens represent a pro-rata claim on the AMM's equity.

### How LP Tokens Are Minted

**At creation**, the creator receives LP tokens equal to their deposit:

```
Creator LP tokens = depositWad = bBase * ln(2)
```

This gives the creator a pro-rata claim on AMM equity from day one. The creator's LP tokens represent their share of the initial liquidity they funded.

**During bonding** (pre-graduation), LP tokens are also minted to traders proportional to fees paid:

```
When a trader buys during bonding:
  fee = tradeCost * preGradFeeBps / 10000         (e.g., 5%)
  LP tokens minted to trader = fee amount          (1:1 with fee in WAD value)
```

**After graduation**, LP minting stops entirely.

This means:

- **The creator receives LP tokens at creation** (equal to deposit, ~bBase * 0.693)
- **Early traders also get LP tokens** as a rebate for paying higher bonding fees
- **LP tokens stop minting after graduation**
- Creator's LP share dilutes as more traders earn LP tokens during bonding

### LP Token Value

LP token value = pro-rata share of the AMM equity floor + LP yield pool. For the floor value formula (`Gross Cash - max(qYes, qNo)`) and exchange rate math, see **Layer 1, LP Valuation section**.

### LP Token Lifecycle

```
Creation   → Creator receives depositWad LP tokens (LOCKED for creator)
Bonding    → Traders earn LP tokens (freely transferable + redeemable)
Graduation → Creator LP unlocked. All LP freely transferable.
Settlement → redeemLP() burns tokens, returns pro-rata base tokens
```

### redeemLP()

`LaunchpadEngine.redeemLP(market, lpAmount)` — callable by anyone holding LP tokens. Burns and transfers pro-rata base tokens. Currently does not enforce a settlement requirement (LP holders can exit at any time at the floor value).

---

## 12. Fee Configuration (Operator-Set)

Creators do **not** set fees. Fee parameters are configured by the **operator** at the instance level and apply to all markets.

### Fee Parameters

| Parameter | Default | Range | Set By |
|-----------|---------|-------|--------|
| `preGradFeeBps` | 500 (5%) | 0-1000 | Operator |
| `postGradFeeBps` | 100 (1%) | 0-500 | Operator |
| `bBaseShareBps` | 5000 (50%) | 0-10000 | Operator |
| `lpYieldShareBps` | 3000 (30%) | 0-10000 | Operator |
| `adjudicatorShareBps` | 1000 (10%) | 0-10000 | Operator |
| `protocolShareBps` | 1000 (10%) | 0-10000 | Operator |
| `graduationBps` | 10000 | 1-1000000 | Operator |
| `defaultTrialPeriod` | 7 days | 0-30 days | Operator |

Post-graduation splits must sum to 10000 bps (100%).

### How Fees Affect the Creator

For the full fee distribution mechanics, see **Layer 1, FeeRouter section**. The creator-relevant summary:

- **Pre-grad**: 100% of fees → deeper AMM + LP tokens to traders. More volume = faster graduation.
- **Post-grad**: Fees split across bBase growth, LP yield, adjudicator, protocol. Creator benefits via LP tokens.

### What Creators Should Know

1. **Higher pre-grad fee** = faster graduation (more fees per trade) but potentially fewer traders
2. **Lower graduationBps** = faster graduation, quicker LP unlock, but less proof of demand
3. **Fee rates and graduationBps are instance-wide** — set by operator, apply to all markets

---

## 13. Market Lifecycle from Creator Perspective

### Complete Timeline

```
Phase 1: CREATION
  Creator calls createMarket()
  ├── Deposit collected and sent to AMMEngine
  ├── TruthMarket clone deployed (CREATE2)
  ├── AMM initialized at creator-set odds (default 50/50)
  ├── LP token deployed, creator receives depositWad LP tokens
  └── Trial period starts (defaultTrialPeriod)

Phase 2: BONDING (pre-graduation)
  Traders buy/sell on AMM
  ├── 5% fee per trade → bCurrent grows, LP tokens minted to traders
  ├── Creator watches graduation progress
  ├── If feesAccrued >= threshold → GRADUATION (Phase 3)
  └── If trial ends without graduation → creator can dismiss

Phase 3: GRADUATION
  Matching engine activated (SoothBook or offchain CLOB)
  ├── LP tokens unlocked (transferable + redeemable)
  ├── Fee drops to 1%, distribution changes
  ├── AMM + orderbook both active
  ├── LP minting stops
  └── Market cannot be dismissed

Phase 4: TRADING (post-graduation)
  Normal market operation
  ├── AMM and matching engine both available
  ├── Post-grad fees accumulate (LP yield, adjudicator, protocol)
  └── Creator waits for resolution

Phase 5: RESOLUTION (adjudicator acts)
  Adjudicator determines outcome
  ├── resolve() → RESOLVING (proposed outcome)
  ├── verifyAttestation() → RESOLVED (outcome proven)
  ├── Guardian veto window (RESOLVED → LIVE if vetoed)
  └── settle() → SETTLED (irreversible, redemption opens)

Phase 6: SETTLEMENT
  Creator (and all LP holders) redeem
  ├── redeemLP(market, lpAmount) → receives pro-rata base tokens
  ├── AMM positions settled via AMMEngine.settlePosition()
  └── Matching engine positions settled via matchingEngine.settlePosition()
```

### State Diagram (Creator's View)

```
          CREATED
             │
             ▼
    ┌─────────────────┐
    │     BONDING      │   Creator watches progress
    │   (7-day trial)  │   Deposit locked
    └────────┬─────────┘
             │
     ┌───────┼──────────┐
     │                   │
  NOT graduated      GRADUATED
  (trial ended)          │
     │                   ▼
     ▼            ┌─────────────┐
  DISMISS?        │   ACTIVE    │   LP tokens unlocked
  (creator        │ (AMM + OB)  │   LP yield accruing
   choice)        └──────┬──────┘
     │                   │
     ▼                   ▼
  DISMISSED         RESOLVING → RESOLVED → SETTLED
  (claimRefund             │
   available)              ▼
     │              REDEEMABLE
     └──────────► (LP tokens → base tokens)
```

---

## 14. Redemption & Settlement

From the creator's perspective, redemption is a single step:

**`LaunchpadEngine.redeemLP(market, lpAmount)`** — burns LP tokens, returns pro-rata base tokens (floor value + LP yield pool share).

The creator always holds LP tokens (minted at creation). There is no separate deposit refund — LP tokens are the single claim on AMM equity.

| Scenario | When | What Creator Gets |
|----------|------|-------------------|
| Market graduated + settled | After settlement | `redeemLP()` → floor + yield |
| Market dismissed | After dismiss (DISMISSED state) | `redeemLP()` → residual floor |
| Market settled without graduation | After settlement | `redeemLP()` → floor |

For full settlement mechanics (AMM positions, matching engine positions, INVALID outcome handling), see **Layer 1, Section 10: Settlement Flow**. All redemption is pull-based.

---

## 15. Deadline Strategies

### Finite Deadline

Use when the question has a clear time boundary:

```
"Will BTC exceed $100k by December 31, 2026?"
→ deadline = 1735689599 (Dec 31, 2026 23:59:59 UTC)
```

**Behavior:**

- After deadline passes, if adjudicator hasn't resolved → anyone can call `invalidate()`
- Invalidation sets outcome = INVALID, state → SETTLED
- Acts as a safety net against unresponsive adjudicators

**Recommended for:**

- Time-bound predictions
- Event-based markets with known dates
- Any market where "no answer" should default to INVALID

### Infinite Deadline

Use when the question has no time boundary or when only the adjudicator should determine timing:

```
"Will humanity reach Mars?"
→ deadline = 7258118399 (Dec 31, 2199 = "infinite")
```

**Behavior:**

- No automatic invalidation path
- Only the adjudicator can resolve the market
- Market stays LIVE indefinitely until resolution

**Recommended for:**

- Open-ended predictions
- Markets resolved by truth (not time)
- Markets where "no answer by date X" is not a meaningful outcome

Frontend display rules for deadlines are defined in Layer 1.

---

## 16. Creator Checklist

### Before Creating

- [ ] **Question**: Is it unambiguous and resolvable?
- [ ] **Adjudicator**: Does the chosen adjudicator support this question type?
- [ ] **Adjudicator**: Is it approved in this instance (if registry-gated)?
- [ ] **bBase**: Is the deposit amount acceptable? (higher with custom odds — see Section 5)
- [ ] **Initial odds**: Want non-50/50? Note the deposit increase (Section 5)
- [ ] **graduationBps**: Set by operator (default 10000 = break-even). Lower = faster graduation.
- [ ] **Deadline**: Finite or infinite? Does it match the question's time horizon?
- [ ] **Start time**: Immediate or delayed?
- [ ] **Base token balance**: Do you have enough base tokens for the deposit?
- [ ] **Base token approval**: Have you approved LaunchpadEngine to spend the deposit amount?

### After Creating

- [ ] **Verify market address**: Check that the TruthMarket clone was deployed
- [ ] **Share the market**: Promote to potential traders
- [ ] **Monitor graduation progress**: Track `feesAccrued / graduationThreshold`
- [ ] **After trial**: If not graduated, decide whether to dismiss or wait

### After Graduation

- [ ] **LP tokens unlocked**: Can now transfer or redeem LP tokens
- [ ] **Monitor resolution**: Wait for adjudicator to resolve the market
- [ ] **After settlement**: Redeem LP tokens via `redeemLP()` → pro-rata base tokens

### Common Mistakes

| Mistake | Consequence | Prevention |
|---------|-------------|-----------|
| bBase too high | Market never graduates | Match bBase to expected volume (Section 4) |
| bBase too low | AMM is volatile, easily manipulated | Set bBase proportional to expected volume |
| Wrong adjudicator | Market can't be resolved | Verify adjudicator supports the question type |
| Missing base token approval | `createMarket()` reverts | Approve LaunchpadEngine before calling |
| Not dismissing after trial | Market stays live with no traction | Monitor and dismiss failed markets promptly |
| Infinite deadline for time-bound question | No invalidation fallback | Use finite deadline for time-bound questions |

---

> **Version**: 0.1.0 | **Spec**: Layer 3 Creator | **Updated**: 2026-03-07
> **Layer 1 Dependency**: LaunchpadEngine, AMMEngine, FeeRouter, TruthMarket
> **Layer 2 Dependency**: Adjudicator selection and binding
> **Audience**: Market Creators, AI Agents, Frontend Developers
