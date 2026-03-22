<!--
  LAYER1-CORE-PROTOCOL.md — Sooth Protocol Layer 1 Core Contracts
  Version: 0.1.0 | Status: Draft | Branch: zak/protocol-spec
  Last Updated: 2026-02-27
  Audience: AI Agents · Auditors · Integrators · Operators
  Parent: SPEC-INDEX.md
-->

# Layer 1 — Core Protocol Specification

> **How do the core contracts work?**
> State machines, fee flows, invariants, deployment sequence, and migration from legacy.

This spec covers every contract in Layer 1 — the open-source core that is
deployed once per **Instance (Node)** and shared by all markets within that instance.

---

## Table of Contents

1. [Contract Inventory](#1-contract-inventory)
2. [Deployment — CREATE3 via CreateX](#2-deployment--create3-via-createx)
3. [LaunchpadEngine](#3-launchpadengine)
4. [AMMEngine (Brief)](#4-ammengine-brief)
5. [FeeRouter](#5-feerouter)
6. [MatchingEngine (Brief)](#6-matchingengine-brief)
7. [TruthMarket](#7-truthmarket)
8. [AdjudicatorRegistry](#8-adjudicatorregistry)
9. [LaunchpadLPToken](#9-launchpadlptoken)
10. [Libraries](#10-libraries)
11. [Precision & Base Token](#11-precision--base-token)
12. [Market Lifecycle — Full State Machine](#12-market-lifecycle--full-state-machine)
13. [Fee System — Complete Flow](#13-fee-system--complete-flow)
14. [Settlement & Redemption](#14-settlement--redemption)
15. [System Invariants](#15-system-invariants)
16. [Migration from Legacy](#16-migration-from-legacy)
17. [Deployment Sequence](#17-deployment-sequence)
18. [Open Questions](#18-open-questions)

---

## 1. Contract Inventory

### Modified

| Contract | Changes | Reason |
|---|---|---|
| `LaunchpadEngine` | Fee logic extracted to FeeRouter. No longer routes trades. Pause flag internal. Immutable `adjudicatorRegistry`. All cross-references are `immutable` constructor args. Tracks per-creator nonce onchain. Trial cost tracking (userLockedCost, totalLockedCost). | Protocol singleton: market creation + LP + trial + pause. |
| `AMMEngine` | Direct trading (no router). FeeRouter callback. `launchpadEngine` is `immutable`. Pure trading engine — no knowledge of trial periods. | Full spec in `TRADING-ENGINE.md`. Brief overview here. |
| `SoothBook` | Implements `MatchingEngine`. Internal balances (no Outcome tokens). `baseToken` as collateral. | Full spec in `TRADING-ENGINE.md`. Brief overview here. |
| `TruthMarket` | CREATE2 minimal proxy clone from shared `TruthMarketImpl`. Constructor → `initialize()`. Revised state machine: LIVE → RESOLVING → RESOLVED → SETTLED. Added DISMISSED state. | ~50k gas. Deterministic addresses. |
| `LaunchpadLPToken` | Minor — same design. | Per-market ERC20 LP token. |

### New

| Contract | Purpose |
|---|---|
| `FeeRouter` | Unified fee calculation and distribution for AMM and matching engine. Graduation trigger. |
| `MatchingEngine` | Contract that interconnects with SoothBook (onchain DLOB) and offchain CLOB. Handles fee extraction and settlement for both venues. Defines `IMatchingEngine` interface. Full spec in `TRADING-ENGINE.md`. |
| `TruthMarketImpl` | Implementation contract for TruthMarket clones. Deployed once per instance. Same bytecode as `TruthMarket.sol` but used as the template. |
| `AdjudicatorRegistry` | Optional whitelist of approved adjudicators. When set on LaunchpadEngine (non-zero), only approved adjudicators can be used for market creation. When `address(0)`, adjudicator selection is fully permissionless. Immutable per instance. |

### Removed

| Contract | Reason |
|---|---|
| `Collateralizer` | ERC20 outcome tokens removed. Positions are internal to the matching engine. Split/merge/redeem no longer require a separate collateral contract — `mint()` and `merge()` move into the matching engine (SoothBook) as direct base-token operations. Settlement/redemption is through the matching engine. |
| `OutcomeToken` | Positions are internal balances, not transferable ERC20 tokens. SoothBook tracks `(yesShares, noShares)` per `(market, user)` directly. For offchain CLOB, positions are tracked in the CLOB ledger and settled onchain at finalization. |
| `ValidatedAdjudicator` | Layer 2 contract (BSL-licensed). Removed from `sooth-core` (2026-03-19) — concrete adjudicator implementations live in external repos. Core only ships the abstract `AdjudicatorBase` and `Adjudicator`. Spec: `LAYER2-ADJUDICATOR.md`. |
| `ProtocolConfig` | **Fully removed (contract + interface).** Pause flag is internal to LaunchpadEngine. Guardian whitelist moved to `AdjudicatorBase` in Layer 2 — each adjudicator manages its own guardians. No shared `IProtocolConfig` interface. |

### Unchanged

| Library | Purpose |
|---|---|
| `LMSRMath` | Fixed-point LMSR cost/probability functions |
| `DecimalMath` | WAD ↔ token-decimal conversions |
| `TickBitmap` | O(1) non-empty tick lookup for SoothBook |
| `TickMath` | Tick ↔ price conversions |

---

## 2. Deployment — CREATE3 via CreateX

All Layer 1 contracts are deployed using **CREATE3** through the
[CreateX](https://github.com/pcaversaccio/createx) factory (`0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed`).

### 2.1 Why CREATE3

CREATE3 addresses depend **only on salt + deployer**, NOT on constructor args or bytecode.
This eliminates the circular dependency problem where `A.constructor(B)` and `B.constructor(A)`
would make CREATE2 address prediction impossible.

```
CREATE2: address = f(deployer, salt, initcodeHash)   ← depends on constructor args
CREATE3: address = f(deployer, salt)                  ← constructor args irrelevant
```

Internally, CreateX deploys a fixed-bytecode proxy via CREATE2, which then deploys
the actual contract via CREATE. Since proxy address = `f(salt)` and proxy nonce = 1,
the final contract address is fully deterministic regardless of constructor arguments.

### 2.2 Deployment Flow

```
1. Pick salts:
     saltLaunchpad  = keccak256("sooth.launchpad.v1")
     saltAMM        = keccak256("sooth.amm.v1")
     saltFeeRouter  = keccak256("sooth.feerouter.v1")
     saltSoothBook  = keccak256("sooth.soothbook.v1")

2. Predict ALL addresses (no initcode needed):
     predictedLaunchpad  = createX.computeCreate3Address(saltLaunchpad)
     predictedAMM        = createX.computeCreate3Address(saltAMM)
     predictedFeeRouter  = createX.computeCreate3Address(saltFeeRouter)
     predictedSoothBook  = createX.computeCreate3Address(saltSoothBook)

3. Deploy each contract passing predicted addresses as immutable constructor args:
     createX.deployCreate3(saltLaunchpad, LaunchpadEngine.initcode(predictedAMM, predictedFeeRouter, ...))
     createX.deployCreate3(saltAMM, AMMEngine.initcode(predictedLaunchpad, predictedFeeRouter, ...))
     createX.deployCreate3(saltFeeRouter, FeeRouter.initcode(predictedAMM, predictedLaunchpad, ...))
     createX.deployCreate3(saltSoothBook, SoothBook.initcode(predictedFeeRouter, ...))

4. Verify: every contract landed at its predicted address ✓
```

### 2.3 Consequences

| Before (wire pattern) | After (CREATE3 immutables) |
|---|---|
| Configuration functions were needed | **Removed** — all gone |
| `address public ammEngine` (mutable, set via wiring) | `address public immutable ammEngine` (constructor) |
| `setFeeRouter()`, `setAuthorized()` post-deploy calls | **Removed** — set at construction |
| Deploy order matters (LaunchpadEngine first) | Deploy order doesn't matter (all addresses known upfront) |
| Different addresses per chain (different deployer nonce) | **Same addresses on every chain** (same salt + same wallet) |

### 2.4 Salt Protection

CreateX encodes `msg.sender` into the internal salt, so:

- Same salt + different deployer wallet = different address (no front-running)
- Same salt + same deployer wallet + any chain = **same address** (cross-chain determinism)

### 2.5 Dependency Graph (All Immutable)

```
  TruthMarketImpl           (standalone — holds bytecode, no deps)
  AdjudicatorRegistry       (standalone, optional — address(0) for permissionless)

  LaunchpadEngine           (immutable: baseToken, truthMarketImpl, adjudicatorRegistry,
  │                                     ammEngine, feeRouter, matchingEngine)
  │
  ├── AMMEngine             (immutable: baseToken, launchpadEngine, feeRouter)
  │
  ├── FeeRouter             (immutable: baseToken, ammEngine, launchpadEngine)
  │
  └── SoothBook             (immutable: baseToken, feeRouter)
       └── interacts with MatchingEngine (contract)

  All cross-references are immutable constructor args.
  No wiring, no post-deploy setters, no re-configuration risk.
```

---

## 3. LaunchpadEngine

> **Responsibility:** Protocol singleton. Market creation, LP token lifecycle, trial period,
> creator deposit/refund, global pause, adjudicator policy, per-creator nonce tracking.
> Fee logic and trade routing have been **extracted**.

### 3.1 Immutable Constructor Parameters

| Name | Type | Description |
|---|---|---|
| `baseToken` | `address` | Collateral token for this instance |
| `baseTokenDecimals` | `uint8` | Cached decimals |
| `truthMarketImpl` | `address` | Shared TruthMarket implementation for clones |
| `adjudicatorRegistry` | `address` | `AdjudicatorRegistry` address. `address(0)` = permissionless. |
| `ammEngine` | `address` | LMSR AMM contract |
| `feeRouter` | `address` | Unified fee calculator/distributor |
| `matchingEngine` | `address` | SoothBook or offchain CLOB adapter |
| `owner` | `address` | Initial owner (Ownable) |

### 3.2 Pause

LaunchpadEngine manages a global pause flag internally.  other contracts that need pause check call LaunchpadEngine directly.

**State:**

```solidity
bool private _paused;
```

**Functions:**

| Function | Access | Description |
|---|---|---|
| `isPaused()` | View | Returns global pause flag |
| `pause()` | Owner | Set `_paused = true` |
| `unpause()` | Owner | Set `_paused = false` |

Events: `ProtocolPaused()`, `ProtocolUnpaused()`

> **Guardian is NOT in LaunchpadEngine.** Guardian whitelist is per-adjudicator, managed by
> `AdjudicatorBase` in Layer 2. Each adjudicator contract maintains its own guardian set.
> TruthMarket calls `AdjudicatorBase(adjudicator).isGuardian(msg.sender)` for veto checks.
> Full spec: `LAYER2-ADJUDICATOR.md`.

### 3.3 Adjudicator Registry (Immutable Policy)

The `adjudicatorRegistry` is set at construction and **cannot be changed**. This
ensures all markets within the instance follow the same adjudicator policy:

- **`adjudicatorRegistry == address(0)`** → Permissionless. Any address can be set as adjudicator at market creation.
- **`adjudicatorRegistry != address(0)`** → Whitelisted. `createMarket()` reverts with `NotApprovedAdjudicator()` if the chosen adjudicator is not approved in the registry.

This is a deployment-time decision by the operator and is permanent for the instance.

### 3.4 Configurable Parameters (Operator only)

| Parameter | Type | Default | Range | Setter |
|---|---|---|---|---|
| `graduationBps` | `uint32` | `10000` | `1–1000000` | `setGraduationBps()` |
| `defaultTrialPeriod` | `uint64` | `604800` (7d) | `0–30d` | `setDefaultTrialPeriod()` |

> **Note:** Fee parameters (`preGradFeeBps`, `postGradFeeBps`, fee splits) are on **FeeRouter**.
> LaunchpadEngine no longer owns fee config.

### 3.5 Per-Market State

```solidity
struct MarketState {
    address  creator;          // Who created the market
    address  lpToken;          // LaunchpadLPToken address
    uint256  bBase;            // Initial LMSR liquidity (WAD)
    uint256  creatorDeposit;   // bBase * ln(2) — creator's max loss (WAD)
    uint64   graduatedAt;      // Block timestamp at graduation (0 = not graduated)
}

struct TrialState {
    uint64   trialEndTime;     // createdAt + defaultTrialPeriod
    bool     isDismissed;      // Creator dismissed after trial?
}

mapping(address => MarketState)  public markets;
mapping(address => TrialState)   public trialStates;
mapping(address => uint256)      public creatorNonce;     // creator → next nonce (auto-increment)
```

**Removed from legacy MarketState:**

| Field | Reason |
|---|---|
| `isGraduated` | Redundant — use `graduatedAt != 0` instead |
| `createdAt` | Already tracked by TruthMarket (via `startTime` or block timestamp at `initialize()`) |
| `totalLPSupply` | Queryable from `LaunchpadLPToken(lpToken).totalSupply()` — no need to duplicate |

**Trial cost tracking (LaunchpadEngine):**

| Field | Location | Reason |
|---|---|---|
| `totalLockedCost` | `LaunchpadEngine` | LaunchpadEngine tracks trial-period costs via FeeRouter callback. AMMEngine is unaware of trials. |
| `userLockedCost` | `LaunchpadEngine` | Per-user cost tracking for refund claims after market dismissal. |

> **Note:** `graduationBps` is an operator-set parameter that applies to all markets in the instance. It controls what fraction of the creator deposit must be earned in fees before graduation.

### 3.6 Functions

#### `createMarket(...)` → `(address market, address lpToken)`

Creates a new prediction market:

1. **Validate adjudicator:** If `adjudicatorRegistry != address(0)`, check `IAdjudicatorRegistry(adjudicatorRegistry).isApproved(adjudicator)`. Revert with `NotApprovedAdjudicator()` if not approved.

2. **Auto-increment nonce:** `nonce = creatorNonce[msg.sender]++`

3. **Deploy TruthMarket** via CREATE2 minimal proxy clone:

   ```
   salt = keccak256(abi.encodePacked(creator, adjudicator, question, nonce))
   market = Clones.cloneDeterministic(truthMarketImpl, salt)
   TruthMarket(market).initialize(question, startTime, deadline, adjudicator, address(this), creator)
   ```

4. **Calculate creator deposit:** `deposit = bBase * LN2_WAD / WAD`
5. **Transfer deposit** from creator: `baseToken.safeTransferFrom(creator, address(ammEngine), deposit)`
6. **Initialize AMM:** `ammEngine.initializeMarket(market, bBase)`
7. **Deploy LP token:** `lpToken = new LaunchpadLPToken(market, address(this))`
8. **Register in FeeRouter:** `feeRouter.registerMarket(market, bBase)`
9. **Set trial state:** `trialEndTime = block.timestamp + defaultTrialPeriod`
10. **Emit:** `MarketCreated(market, question, startTime, deadline, bBase, adjudicator, lpToken, nonce)`

Parameters:

- `question` — Market question string
- `startTime` — Trading start (0 = now)
- `deadline` — Market deadline (year 2199 for infinite)
- `adjudicator` — Adjudicator contract address (must be registry-approved if registry is set)
- `bBase` — Initial LMSR depth (WAD)
- `initialProbabilityWad` — Starting YES probability in WAD (0 = default 50/50)

> **Note:**  it is auto-incremented per creator.
> Callers can read `creatorNonce[creator]` to predict the next market's CREATE2 salt.

Returns: `(market address, lpToken address)`

#### `dismissMarket(market)`

Creator dismisses a non-graduated market after trial period:

- Requires: `block.timestamp >= trialEndTime`, `graduatedAt == 0`, `!isDismissed`, `msg.sender == creator`
- Sets `isDismissed = true`
- Emit: `MarketDismissed(market)`

#### `claimRefund(market)` → `uint256 refundAmount`

Trader reclaims locked cost after market dismissal:

- Requires: `isDismissed(market)` returns true
- Requires: `userLockedCost[market][msg.sender] > 0`
- Transfers base token to trader (from AMMEngine reserves)
- Clears `userLockedCost[market][msg.sender]`
- Decrements `totalLockedCost[market]`
- Refund amount capped at AMMEngine's available balance per user to ensure solvency
- Emit: `RefundClaimed(market, msg.sender, amount)`

#### `redeemLP(market, lpAmount)` → `uint256 baseTokenAmount`

Burns LP tokens and returns pro-rata share of AMM equity floor:

- No settlement gate — LP holders can exit at any time at the floor value
- Calculates floor: `floorValue = ammEngine.getGrossCash(market) - max(qYes, qNo)`
- Total LP supply: `totalSupply = LaunchpadLPToken(lpToken).totalSupply()`
- Payout: `floorValue * lpAmount / totalSupply`
- Burns LP tokens, transfers base token to user

#### `notifyGraduation(market)` — called by FeeRouter

Callback from FeeRouter when graduation threshold is met:

- Sets `graduatedAt = block.timestamp`
- Registers market in matching engine: `matchingEngine.registerMarket(market, ...)`
- Unlocks creator LP tokens (transferable + redeemable)
- Emit: `MarketGraduated(market)`

#### `mintLPTokens(market, trader, amount)` — called by FeeRouter

Mints LP tokens to a trader during pre-graduation fee distribution:

- Requires: `msg.sender == address(feeRouter)`
- Mints `amount` of `LaunchpadLPToken` to `trader`

#### Helper Views

| Function | Returns |
|---|---|
| `isGraduated(market)` | `markets[market].graduatedAt != 0` |
| `getMarketState(market)` | Full `MarketState` struct |
| `getTrialState(market)` | Full `TrialState` struct |
| `getCreatorNonce(creator)` | Next nonce for this creator |
| `predictMarketAddress(creator, adjudicator, question, nonce)` | Deterministic clone address |

### 3.7 What LaunchpadEngine No Longer Does

| Removed Responsibility | Moved To |
|---|---|
| Fee calculation (`preGradFeeBps`, `postGradFeeBps`) | FeeRouter |
| Fee distribution (`_distributeFee`) | FeeRouter |
| Fee split config (`bBaseShareBps`, `lpYieldShareBps`, `protocolShareBps`) | FeeRouter |
| Trade routing to AMMEngine (`_tradeInternal`) | Traders call AMMEngine directly |
| `feesAccrued` tracking | FeeRouter |
| `bCurrent` tracking | FeeRouter (or AMMEngine) |
| `lpYieldPool` tracking | FeeRouter |
| Graduation threshold check | FeeRouter |
| Collateralizer registration | Removed (no Collateralizer) |
| Guardian whitelist (`_guardians` mapping) | Layer 2 — `AdjudicatorBase` (per-adjudicator) |
| `IProtocolConfig` implementation | Removed — pause is internal, guardian is Layer 2 |
|  post-deploy wiring | Removed — CREATE3 immutables |
| `graduationMultiplier` | Replaced by `graduationBps` (same concept, different units — BPS instead of integer multiplier) |

---

## 4. AMMEngine (Brief)

> **Full specification in `TRADING-ENGINE.md`.**
> This section covers only the interface with Layer 1 contracts.

AMMEngine handles LMSR pricing, position tracking (dual-balance model),
24-hour sell lock, and direct trading (no router intermediary).

### 4.1 Immutables

| Name | Type | Description |
|---|---|---|
| `baseToken` | `IERC20` | Collateral token |
| `baseTokenDecimals` | `uint8` | Cached decimals |
| `launchpadEngine` | `address` | Protocol singleton (immutable — set via CREATE3) |
| `feeRouter` | `address` | Fee callback target (immutable — set via CREATE3) |

### 4.2 Layer 1 Interface

AMMEngine is a pure trading engine. It does not track trial periods, costs, or refunds.
Trial cost tracking is handled by LaunchpadEngine via FeeRouter callbacks.

### 4.3 Key Functions (Layer 1 Interface)

| Function | Caller | Description |
|---|---|---|
| `initializeMarket(market, bBase)` | LaunchpadEngine | Set up LMSR state for new market |
| `tradePositions(market, outcome, delta, maxCost)` | Anyone (trader) | Direct LMSR trade |
| `settlePosition(market)` | Anyone (own position) | Post-settlement redemption |
| `increaseLiquidity(market, deltaB)` | FeeRouter | Fee reinvestment into LMSR depth |
| `getGrossCash(market)` | View | LMSR cost function value `C(qYes, qNo, b)` |

> See `TRADING-ENGINE.md` for full position model, lock queue, sell flow, balance management.

### 4.4 Access Control

| Function | Authorized Caller |
|---|---|
| `initializeMarket` | `launchpadEngine` only (immutable) |
| `tradePositions` | Anyone |
| `increaseLiquidity` | `feeRouter` only (immutable) |
| `settlePosition` | Anyone (for own position) |

---

## 5. FeeRouter

> **Responsibility:** Unified fee calculation and distribution for ALL trading venues.
> Handles pre/post-graduation fee splits, LP minting, graduation trigger.

### 5.1 Rationale

In the legacy architecture, `LaunchpadEngine._distributeFee()` runs ~80 lines of conditional logic on every single trade:
pre/post-grad fee rate selection, bBase reinvestment, LP token minting, yield pool, protocol treasury split,
graduation threshold check. This is gas-heavy and couples fee policy to market creation.

FeeRouter extracts this into a dedicated contract that both AMMEngine and the matching engine call into,
providing a single source of truth for fee economics.

### 5.2 Immutables

| Name | Type | Description |
|---|---|---|
| `baseToken` | `IERC20` | Collateral token |
| `baseTokenDecimals` | `uint8` | Cached decimals |
| `ammEngine` | `address` | For `increaseLiquidity()` callback (immutable via CREATE3) |
| `launchpadEngine` | `address` | For `notifyGraduation()` and `mintLPTokens()` callbacks (immutable via CREATE3) |

### 5.3 Configurable Parameters (Operator only)

| Parameter | Type | Default | Range | Description |
|---|---|---|---|---|
| `preGradFeeBps` | `uint16` | `500` (5%) | `0–1000` | Fee rate during bonding (AMM) phase |
| `postGradFeeBps` | `uint16` | `100` (1%) | `0–500` | Fee rate during matching engine phase |
| `bBaseShareBps` | `uint16` | `5000` (50%) | `0–10000` | Post-grad: % of fee → bCurrent growth |
| `lpYieldShareBps` | `uint16` | `3000` (30%) | `0–10000` | Post-grad: % of fee → LP yield pool |
| `adjudicatorShareBps` | `uint16` | `1000` (10%) | `0–10000` | Post-grad: % of fee → adjudicator |
| `protocolShareBps` | `uint16` | `1000` (10%) | `0–10000` | Post-grad: % of fee → protocol treasury |
| `protocolTreasury` | `address` | Operator | — | Where protocol fees go |

Constraint: `bBaseShareBps + lpYieldShareBps + adjudicatorShareBps + protocolShareBps == 10000`

### 5.4 Per-Market State

```solidity
struct FeeState {
    uint256  bBase;            // Initial LMSR depth (WAD) — from LaunchpadEngine
    uint256  feesAccrued;      // Total fees collected (WAD)
    uint256  lpYieldPool;      // Accumulated LP yield (WAD)
    bool     isGraduated;      // Cached graduation flag
    address  adjudicator;      // For adjudicator fee payout
}

mapping(address => FeeState) public feeStates;
```

### 5.5 Functions

#### `registerMarket(market, bBase)` — called by LaunchpadEngine at creation

Initializes fee state for a new market:

- Stores `bBase`, sets `feesAccrued = 0`, `isGraduated = false`
- Caches adjudicator address from `TruthMarket(market).adjudicator()`

#### `calculateAndDistributeFee(market, trader, baseCost, isBuy)` → `(uint256 fee, uint256 netAmount)`

**Core function** called by AMMEngine (and matching engine) on every trade.

**Pre-graduation flow:**

1. `fee = baseCost * preGradFeeBps / 10000`
2. `netAmount = isBuy ? baseCost + fee : baseCost - fee`
3. Reinvest 100% into LMSR depth: `deltaB = fee / LN2_WAD`
4. Call `ammEngine.increaseLiquidity(market, deltaB)`
5. Mint LP tokens to trader (1:1 with fee WAD value): `launchpadEngine.mintLPTokens(market, trader, fee)`
6. `feesAccrued += fee`
7. **Check graduation:** if `feesAccrued >= creatorDeposit * graduationBps / 10000`:
   - Call `launchpadEngine.notifyGraduation(market)`
   - Set `isGraduated = true`

**Post-graduation flow:**

1. `fee = baseCost * postGradFeeBps / 10000`
2. `netAmount = isBuy ? baseCost + fee : baseCost - fee`
3. Split fee according to configured shares:
   - `bBaseShareBps` → `ammEngine.increaseLiquidity(market, deltaB)`
   - `lpYieldShareBps` → `lpYieldPool += portion` (stored in FeeRouter)
   - `adjudicatorShareBps` → transfer base token to `adjudicator`
   - `protocolShareBps` → transfer base token to `protocolTreasury`
4. `feesAccrued += fee`

Returns: `(fee, netAmount)` where `netAmount` is what the trader pays (buy) or receives (sell).

### 5.6 Fee Transfer Mechanism (Push Model)

The trading contract (AMMEngine or matching engine) collects `baseCost + fee` from the
trader, then transfers the exact fee amount to FeeRouter before calling `calculateAndDistributeFee`.
This ensures FeeRouter always receives the exact fee amount.

```
Trader ──[baseCost + fee]──► AMMEngine ──[fee]──► FeeRouter ──[split]──► destinations
                                │
                                └──[baseCost]──► stays in AMMEngine
```

- No separate approval needed from trader to FeeRouter
- AMMEngine/matching engine verifies the fee amount matches FeeRouter's calculation
- Single approval flow for the trader (approve trading contract only)

### 5.7 Matching Engine Fee Integration

For post-graduation trading through the matching engine:

- Matching engine calls `feeRouter.calculateAndDistributeFee(market, trader, tradeValue, isBuy)` on each fill
- The matching engine collects the fee from the trader and pushes it to FeeRouter
- For offchain CLOB: fees are calculated onchain at settlement batch time; the CLOB adapter collects and pushes fees to FeeRouter

> Full matching engine fee mechanics: `TRADING-ENGINE.md`

#### `getGraduationProgress(market)` → `(uint256 feesAccrued, uint256 threshold, uint256 progressBps)`

View function for graduation progress.

- `threshold = creatorDeposit * graduationBps / 10000`
- `progressBps = feesAccrued * 10000 / threshold` (capped at 10000)

#### Configuration Setters (Operator only)

- `setPreGradFee(feeBps)`
- `setPostGradFee(feeBps)`
- `setFeeDistribution(bBaseBps, lpYieldBps, adjudicatorBps, protocolBps)`
- `setProtocolTreasury(address)`

---

## 6. MatchingEngine (Brief)

> **Full specification in `TRADING-ENGINE.md`.**
> This section covers only the interface and architectural role within Layer 1.

### 6.1 Architecture — Contract + Interface

`MatchingEngine` is a **contract**  that sits between trading venues
(SoothBook, offchain CLOB) and the rest of the protocol. It defines the `IMatchingEngine`
interface and handles the shared concerns: fee extraction via FeeRouter, settlement,
and redemption.

 `MatchingEngine` is the single entry point
for order matching regardless of whether orders originate onchain or offchain.

```
                    ┌─────────────────────┐
  SoothBook ───────►│                     │──── FeeRouter (fee push)
  (onchain DLOB)    │   MatchingEngine    │──── TruthMarket (settlement queries)
                    │                     │──── baseToken (transfers)
  Offchain CLOB ───►│   (IMatchingEngine) │
  (signed orders)   └─────────────────────┘
```

**Interface:**

```solidity
interface IMatchingEngine {
    function registerMarket(address market, address baseToken, uint256 initialPrice) external;
    function getPosition(address market, address user) external view returns (uint256 yesShares, uint256 noShares);
    function getImpliedPrice(address market) external view returns (uint256 yesPrice, uint256 noPrice);
    function isMarketRegistered(address market) external view returns (bool);
    function settlePosition(address market, address user) external returns (uint256 payout);
}
```

**Fee handling:** The MatchingEngine contract collects fees from traders and pushes the
exact fee amount to FeeRouter, ensuring both onchain (SoothBook) and offchain (CLOB)
venues follow the same fee logic and distribution.

### 6.2 SoothBook (Onchain DLOB)

SoothBook is the onchain orderbook that interacts with MatchingEngine for trades:

- `buyYes(marketKey, tick, amount, maxCost)` — place YES limit order
- `buyNo(marketKey, tick, amount, maxCost)` — place NO limit order
- `mint(marketKey, amount)` — 1 baseToken → 1 YES + 1 NO (internal balances)
- `merge(marketKey, amount)` — 1 YES + 1 NO → 1 baseToken
- `cancel(marketKey, side, tick)` / `cancelById(orderId)` — cancel resting orders

Internal positions: SoothBook stores `(yesShares, noShares)` per `(market, user)` directly in storage — no ERC20 minting/burning.

### 6.3 Offchain CLOB

The offchain CLOB uses signed orders matched offchain, with onchain settlement batches
submitted through MatchingEngine (array of matching orders from both sides, similar to
Polymarket's CTF Exchange). The MatchingEngine verifies signatures and settles positions
onchain. Fees are extracted at settlement time through the same FeeRouter push model.

> Whether onchain and offchain use the same matching function (with signatures for offchain)
> or separate functions is detailed in `TRADING-ENGINE.md`.

### 6.4 Engine Choice (Per-Instance)

The matching engine is set **at instance deployment** as an immutable on `LaunchpadEngine`.
All markets within the instance use the same engine. This is a deliberate simplification:

- Reduces per-market configuration complexity
- Ensures uniform UX within an instance
- Operators who need both can deploy two instances

---

## 7. TruthMarket

> **Responsibility:** Per-market lifecycle authority. The canonical source of truth
> for market state, adjudicator authorization, and resolution outcome.

### 7.1 CREATE2 Clone Pattern

Instead of deploying a full `TruthMarket` per market (~500k gas), we use EIP-1167 minimal proxies:

```
TruthMarketImpl (deployed once per instance, ~500k gas)
    │
    ├── clone 1 (Market A, ~50k gas) — deterministic address
    ├── clone 2 (Market B, ~50k gas) — deterministic address
    └── clone N ...
```

**Clone deployment** (in LaunchpadEngine.createMarket):

```solidity
bytes32 salt = keccak256(abi.encodePacked(creator, adjudicator, question, nonce));
address market = Clones.cloneDeterministic(truthMarketImpl, salt);
TruthMarket(market).initialize(...);
```

**Address prediction** (offchain):

```solidity
address predicted = Clones.predictDeterministicAddress(truthMarketImpl, salt, launchpadEngine);
```

### 7.2 State Variables

| Variable | Type | Description |
|---|---|---|
| `state` | `MarketState` | Enum: `LIVE`, `RESOLVING`, `RESOLVED`, `SETTLED`, `DISMISSED` |
| `question` | `string` | Market question |
| `startTime` | `uint64` | When trading can begin |
| `deadline` | `uint64` | Market expiry (year 2199 for infinite) |
| `creator` | `address` | Who created the market |
| `winningOutcome` | `uint8` | 0=NO, 1=YES, 2=INVALID |
| `tStar` | `uint64` | Retroactive truth timestamp |
| `adjudicator` | `address` | Designated resolution authority |
| `launchpadEngine` | `address` | Protocol singleton (for pause checks) |

### 7.3 Lifecycle State Machine

```
        ┌─────────┐
        │  LIVE   │ ← initialize() sets this
        └────┬────┘
             │
     ┌───────┴──────────────────────────────────┐
     │                                          │
  adjudicator                          deadline passes with
  calls resolve()                      no adjudicator action
     │                                          │
     ▼                                          ▼
┌───────────┐                          ┌────────────────────┐
│ RESOLVING │ ← proposed outcome       │ Can be invalidated │
└─────┬─────┘   awaiting veto window   │ (outcome = INVALID)│
      │                                └────────────────────┘
      │                                   unless infinite deadline
      │                                   (only adjudicator resolves)
      │
      │  veto window passes
      │  OR adjudicator calls verifyAttestation(bytes)
      ▼
┌───────────┐  ◄── Guardian can veto() → back to LIVE
│ RESOLVED  │      with proposed outcome cleared
└─────┬─────┘
      │
      │  adjudicator calls settle()
      ▼
┌───────────┐
│  SETTLED  │ ← irreversible, redemption opens
└───────────┘

┌───────────┐
│ DISMISSED │ ← LaunchpadEngine sets (failed trial, not graduated)
└───────────┘   refunds available via claimRefund()
```

**State Naming (change from legacy):**

| Legacy Name | New Name | Meaning |
|---|---|---|
| `SETTLING` | `RESOLVING` | Adjudicator has proposed an outcome, awaiting veto window |
| `SETTLED` | `RESOLVED` | Resolution accepted (no veto). Outcome is locked. |
| `FINALIZED` | `SETTLED` | Terminal state. Redemption opens. Irreversible. |
| *(new)* | `DISMISSED` | Market dismissed by creator after failed trial period. |

**Deadline Semantics:**

| Deadline Type | Behavior |
|---|---|
| Finite deadline (normal) | If `block.timestamp >= deadline` and adjudicator has not resolved, **anyone** can call `invalidate()` to set `winningOutcome = INVALID` and move to SETTLED. No veto window. |
| Infinite deadline (year 2199) | Only the adjudicator can resolve. Deadline never triggers automatic invalidation. Market stays LIVE indefinitely until adjudicator acts. |

### 7.4 Functions

| Function | Access | Description |
|---|---|---|
| `initialize(...)` | Once (proxy pattern) | Sets all state. Replaces constructor for clones. |
| `resolve(outcome, tStar)` | Adjudicator | Proposes winning outcome. `state → RESOLVING`. |
| `verifyAttestation(bytes)` | Adjudicator | Proves proposed outcome. `state → RESOLVED`. Called by Layer 2. |
| `settle()` | Adjudicator | Locks resolution permanently. `state → SETTLED`. |
| `veto()` | Guardian (via AdjudicatorBase) | Reverts to LIVE. Clears proposed outcome. |
| `invalidate()` | Anyone | Only if `deadline` passed and state is LIVE. Sets `outcome = INVALID`, `state → SETTLED`. Not available for infinite-deadline markets. |
| `dismiss()` | LaunchpadEngine | Sets `state = DISMISSED`. Called from `LaunchpadEngine.dismissMarket()`. |
| `isLive()` | View | `state == LIVE && now >= startTime` |
| `isResolving()` | View | `state == RESOLVING` |
| `isResolved()` | View | `state ∈ {RESOLVED, SETTLED}` |
| `isSettled()` | View | `state == SETTLED` (terminal — redemption open) |
| `isDismissed()` | View | `state == DISMISSED` |
| `getRedemptionValue(outcome)` | View | Returns WAD payout for given outcome |

### 7.5 Veto Mechanics

Guardian veto is checked via the adjudicator contract (Layer 2):

```solidity
function veto() external {
    require(state == RESOLVED, "not resolved");
    require(AdjudicatorBase(adjudicator).isGuardian(msg.sender), "not guardian");
    state = LIVE;
    winningOutcome = 0;
    tStar = 0;
    emit Vetoed(msg.sender);
}
```

The guardian whitelist is managed by `AdjudicatorBase` — an abstract contract in Layer 2
that all adjudicator implementations inherit. See `LAYER2-ADJUDICATOR.md`.

**Re-resolution after veto:**

After veto, the market returns to LIVE. The adjudicator can resolve again with the same or a different outcome — but only if the deadline has not passed. If `block.timestamp >= deadline` (for finite-deadline markets), anyone can call `invalidate()` instead, which moves to SETTLED with outcome = INVALID. For infinite-deadline markets, the adjudicator can always re-resolve regardless of time.

```
Veto flow:
  RESOLVED → (guardian veto) → LIVE
    ├── If deadline not passed: adjudicator can re-resolve (resolve → verify → settle)
    ├── If deadline passed (finite): anyone can call invalidate() → SETTLED (INVALID)
    └── If infinite deadline: adjudicator re-resolves (no time constraint)
```

### 7.6 Change from Legacy

The legacy `TruthMarket` uses a **constructor** for initialization. The clone pattern requires changing to an **initializer function** with a one-time guard:

```solidity
bool private _initialized;

function initialize(
    string memory _question,
    uint64 _startTime,
    uint64 _deadline,
    address _adjudicator,
    address _launchpadEngine,
    address _creator
) external {
    require(!_initialized, "already initialized");
    _initialized = true;
    // ... same validation as current constructor
}
```

---

## 8. AdjudicatorRegistry

> **New contract.** Optional whitelist of approved adjudicators for market creation.

### 8.1 Purpose

The operator (instance deployer) deploys an `AdjudicatorRegistry` to control which
adjudicator contracts can be used for market creation. This is set **once** on
LaunchpadEngine at construction via the immutable `adjudicatorRegistry` parameter:

- **`adjudicatorRegistry = address(0)`** → Permissionless. Creators can choose any address as adjudicator.
- **`adjudicatorRegistry = <AdjudicatorRegistry>`** → Whitelisted. Only approved adjudicators are allowed.

This choice is **permanent per instance** — it cannot be changed after deployment.
All markets within the instance follow the same policy.

### 8.2 Interface

```solidity
interface IAdjudicatorRegistry {
    /// @notice Check if an adjudicator is approved for market creation
    function isApproved(address adjudicator) external view returns (bool);
}
```

### 8.3 State

| Variable | Type | Description |
|---|---|---|
| `_approved` | `mapping(address => bool)` | Adjudicator whitelist |

### 8.4 Functions

| Function | Access | Description |
|---|---|---|
| `approve(adjudicator)` | Owner | Approve an adjudicator. Reverts on `address(0)`. |
| `revoke(adjudicator)` | Owner | Revoke an adjudicator's approval. |
| `batchUpdate(toApprove[], toRevoke[])` | Owner | Batch approve/revoke. Skips zero addresses in approve list. |
| `isApproved(adjudicator)` | View | Returns approval status. |

Events: `AdjudicatorApproved(address indexed)`, `AdjudicatorRevoked(address indexed)`

### 8.5 Deployment Notes

- `AdjudicatorRegistry` is deployed **before** the CREATE3 batch (it has no circular deps).
- Owned by the operator (`Ownable` pattern).
- The registry address on LaunchpadEngine is immutable — once set at construction, it cannot be changed.
- The operator can still approve/revoke adjudicators in the registry at any time; this affects future market creation but not existing markets.

---

## 9. LaunchpadLPToken

> **Minor changes — same design.**

ERC20 LP token deployed per-market by LaunchpadEngine. Transfer-locked after market settlement.

| Property | Value |
|---|---|
| Name | `"Sooth LP: {question}"` |
| Symbol | `"sLP"` |
| Decimals | 18 |
| Minter/Burner | LaunchpadEngine only |
| Transfer Lock | Creator LP: locked during bonding (until graduation or settlement). All other LP: freely transferable at all times. |

Creator LP tokens are locked during the bonding phase to prevent draining AMM liquidity. Trader LP tokens (earned via fees) are freely transferable and redeemable throughout. After graduation, all LP tokens (including creator's) are fully transferable and redeemable.
Mints and burns always allowed regardless of lock.

---

## 10. Libraries

### LMSRMath

Fixed-point LMSR arithmetic in WAD (1e18). No changes needed.

| Function | Signature | Description |
|---|---|---|
| `calculateCost` | `(b, qYesBefore, qNoBefore, qYesAfter, qNoAfter) → int256` | Cost difference `C(q') - C(q)` |
| `calculateProbability` | `(b, qYes, qNo) → uint256` | P(YES) in WAD |
| `logSumExp` | `(b, qYes, qNo) → int256` | `b * ln(e^(qYes/b) + e^(qNo/b))` |

### DecimalMath

WAD ↔ token-decimal conversions. **Rename** functions for generality:

| Legacy Name | New Name | Description |
|---|---|---|
| `_wadToUsdc()` | `fromWad(wadAmount, decimals)` | WAD → token decimals (floor) |
| `_usdcToWad()` | `toWad(amount, decimals)` | Token decimals → WAD |
| `_wadToUsdcCeil()` | `fromWadCeil(wadAmount, decimals)` | WAD → token decimals (ceiling) |

> Note: `DecimalMath.sol` already has the generic names in legacy code. Only internal helper references in other contracts need updating.

### TickBitmap / TickMath

Sparse tick data structures for SoothBook. No changes needed.

---

## 11. Precision & Base Token

### 11.1 WAD Convention

All internal math uses WAD = `1e18`. This is non-negotiable and applies to:

- LMSR calculations (qYes, qNo, b, cost)
- Positions (yesShares, noShares)
- Fee amounts
- LP token supply
- Available/locked balances

### 11.2 Base Token Boundary

At **every** base token transfer (in or out), convert between WAD and token decimals:

```
Contract Math (WAD 1e18) ←→ [boundary] ←→ Base Token (N decimals)
```

Rules:

- **Transfers TO contract** (user pays): use `fromWadCeil()` — round UP to protect protocol
- **Transfers FROM contract** (user receives): use `fromWad()` — round DOWN to protect protocol
- **Never** compare WAD values against raw token amounts

### 11.3 Base Token Requirements

The base token must be a standard ERC20 with:

- `decimals()` returning a `uint8` (typically 6, 8, or 18)
- Standard `transfer`, `transferFrom`, `approve`, `balanceOf`
- No fee-on-transfer (rebasing tokens are NOT supported)
- No blacklisting that could trap protocol funds

The protocol reads `baseToken.decimals()` once at deploy time and caches it as `baseTokenDecimals`.

---

## 12. Market Lifecycle — Full State Machine

Combining LaunchpadEngine (trial/graduation) and TruthMarket (resolution/settlement):

```
                    createMarket()
                         │
                         ▼
               ┌───────────────────┐
               │     BONDING       │   ◄─ 7-day trial period
               │   (AMM active)    │      traders call AMMEngine.tradePositions()
               │                   │      fees → FeeRouter → bBase + LP tokens
               └────────┬──────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
   trial ends,      feesAccrued     feesAccrued
   NOT graduated    ≥ threshold     ≥ threshold
         │          (during trial)  (after trial)
         ▼               │               │
   ┌───────────┐         └───────┬───────┘
   │ DISMISSED │                 ▼
   │           │         ┌─────────────────┐
   └─────┬─────┘         │   GRADUATED     │   ◄─ Matching engine activated
         │               │                 │      SoothBook or offchain CLOB
         │               │   AMM + OB both │
         ▼               │   available     │
   ┌───────────┐         └────────┬────────┘
   │ REFUNDED  │                  │
   └───────────┘          TruthMarket lifecycle:
                                  │
                    ┌─────────────┼──────────────────┐
                    │                                │
              adjudicator                   deadline passes,
              calls resolve()               no resolution
                    │                                │
                    ▼                                ▼
              ┌───────────┐                 ┌─────────────────┐
              │ RESOLVING │                 │   INVALIDATED   │
              └─────┬─────┘                 │(outcome=INVALID)│
                    │                       └────────┬────────┘
                    │ verifyAttestation(bytes) or veto window        │ (auto → SETTLED)
                    │ passes                         │
                    ▼                                │
              ┌───────────┐                          │
              │ RESOLVED  │  ◄── Guardian veto()     │
              │           │      → back to LIVE      │
              └─────┬─────┘                          │
                    │ settle()                       │
                    ▼                                │
              ┌───────────┐ ◄────────────────────────┘
              │  SETTLED  │   ◄─ Redemption opens
              └───────────┘      AMMEngine.settlePosition()
                                 matchingEngine.settlePosition()
                                 LaunchpadEngine.redeemLP()
```

**Infinite deadline markets** (year 2199): The right-side "deadline passes" path does NOT
apply. Only the adjudicator can resolve these markets. They stay LIVE indefinitely.

### Phase Trading Availability

| Phase | AMMEngine | Matching Engine | Redemption |
|---|---|---|---|
| BONDING (pre-grad) | Active | Not registered | No |
| GRADUATED (LIVE) | Active (reduced fee) | Active (post-grad fee) | No |
| RESOLVING | Halted | Halted | No |
| RESOLVED | Halted | Halted | No (waiting settle) |
| SETTLED | Halted | Halted | Yes |
| DISMISSED | Halted | N/A | Refund only |

---

## 13. Fee System — Complete Flow

### 13.1 Pre-Graduation (Bonding Phase)

```
Trader calls AMMEngine.tradePositions(market, outcome, delta, maxCost)
    │
    ├── AMMEngine calculates baseCost via LMSR
    │
    ├── AMMEngine calls feeRouter.calculateAndDistributeFee(market, trader, baseCost, isBuy)
    │       │
    │       ├── fee = baseCost * preGradFeeBps / 10000        (default 5%)
    │       ├── 100% of fee → bBase growth
    │       │     └── feeRouter calls ammEngine.increaseLiquidity(market, fee / LN2_WAD)
    │       ├── LP tokens minted to trader (1:1 with fee)
    │       │     └── feeRouter calls launchpadEngine.mintLPTokens(market, trader, fee)
    │       ├── feesAccrued += fee
    │       ├── CHECK: if feesAccrued >= threshold → notifyGraduation()
    │       │     └── launchpadEngine unlocks creator LP tokens
    │       └── returns (fee, netCost = baseCost + fee)
    │
    ├── AMMEngine collects baseCost + fee from trader (balance + wallet)
    │   └── pushes fee to FeeRouter
    │
    └── AMMEngine updates LMSR state + position
```

### 13.2 Post-Graduation

```
Trader calls AMMEngine.tradePositions(...)  OR  matchingEngine.buyYes/buyNo(...)
    │
    ├── Venue calculates baseCost (LMSR or tick-based)
    │
    ├── Venue collects baseCost + fee from trader, pushes fee to FeeRouter
    │
    ├── Venue calls feeRouter.calculateAndDistributeFee(market, trader, baseCost, isBuy)
    │       │
    │       ├── fee = baseCost * postGradFeeBps / 10000       (default 1%)
    │       ├── Split fee:
    │       │     ├── 50% → bBase growth (ammEngine.increaseLiquidity)
    │       │     ├── 30% → LP yield pool (stored in FeeRouter)
    │       │     ├── 10% → adjudicator address (base token transfer)
    │       │     └── 10% → protocol treasury (base token transfer)
    │       └── returns (fee, netAmount)
    │
    └── Venue settles trade with netAmount
```

### 13.3 LP Yield Distribution

Post-graduation fees accumulate in `lpYieldPool`. LP holders claim yield proportionally to their LP token balance when they call `redeemLP()` after settlement:

```
LP payout = floorValue * (lpAmount / totalSupply) + yieldShare * (lpAmount / totalSupply)
```

Where `floorValue = grossCash - max(qYes, qNo)` and `yieldShare = lpYieldPool`.

---

## 14. Settlement & Redemption

### 14.1 Resolution Flow (Triggered by Adjudicator)

```
Adjudicator → TruthMarket.resolve(outcome, tStar)    // state → RESOLVING
              (veto window)
Adjudicator → TruthMarket.verifyAttestation(bytes)                    // state → RESOLVED
              (guardian veto window)
Adjudicator → TruthMarket.settle()                    // state → SETTLED (terminal)
```

Between RESOLVED and SETTLED, the Guardian can call `TruthMarket.veto()` to revert to LIVE.

**Deadline expiry (finite deadlines only):**

```
Anyone → TruthMarket.invalidate()       // state → SETTLED, outcome = INVALID
         (only if deadline passed AND state still LIVE)
```

### 14.2 Redemption (Post-Settlement)

Three independent redemption paths (all pull-based):

**1. AMM positions** (`AMMEngine.settlePosition(market)`):

- Reads `TruthMarket(market).winningOutcome`
- Pays: YES wins → yesShares, NO wins → noShares, INVALID → (yesShares + noShares) / 2
- Transfers base token to trader

**2. Matching engine positions** (`matchingEngine.settlePosition(marketKey, user)`):

- Same payout logic based on winning outcome (handled by `MatchingEngine` contract)
- Burns internal balances, transfers base token

**3. LP tokens** (`LaunchpadEngine.redeemLP(market, lpAmount)`):

- Burns LP tokens
- Returns: pro-rata share of AMM equity floor + LP yield pool share
- Equity floor = `grossCash - max(qYes, qNo)` (guaranteed LP value)

All three are independent — a user with positions in both AMM and matching engine redeems from each separately.

---

## 15. System Invariants

These must hold at all times. Violation of any invariant indicates a critical bug.

### 15.1 AMMEngine Invariants

| # | Invariant | Check |
|---|---|---|
| A1 | `_lockedBalance[user] <= _availableBalance[user]` | Locked is always a subset of available |
| A2 | `baseToken.balanceOf(ammEngine) >= sum(_availableBalance[all users])` | AMM always solvent |
| A3 | `qYes >= 0 && qNo >= 0` | Inventory never negative |
| A4 | After settlement: `totalPayouts <= baseToken.balanceOf(ammEngine)` | Enough to pay all winners |
| A5 | `position.yesShares >= 0 && position.noShares >= 0` | Positions always non-negative |
| A6 | `totalLockedCost[market] >= sum(userLockedCost[market][*])` | Trial cost accounting consistent |

### 15.2 FeeRouter Invariants

| # | Invariant | Check |
|---|---|---|
| F1 | `feesAccrued` is monotonically increasing | Fees never decrease |
| F2 | If `isGraduated`, `feesAccrued >= creatorDeposit * graduationBps / 10000` | Graduation threshold was met |
| F3 | Post-grad fee split percentages sum to 10000 bps | No fee leakage |
| F4 | LP tokens minted (pre-grad) equal total fees distributed to traders | 1:1 minting |

### 15.3 MatchingEngine Invariants

| # | Invariant | Check |
|---|---|---|
| S1 | `baseToken.balanceOf(matchingEngine) >= collateralBacking[market]` for all markets | Always solvent |
| S2 | `sum(yesShares) == sum(noShares)` per market (complete sets only) | Balance conservation |
| S3 | Active order has `amount > 0` | No ghost orders |
| S4 | `_orderHead[tick] <= orders[tick].length` | Head never past end |

### 15.4 TruthMarket Invariants

| # | Invariant | Check |
|---|---|---|
| T1 | State transitions are monotonic: LIVE→RESOLVING→RESOLVED→SETTLED | No backward jumps (except veto: RESOLVED→LIVE) |
| T2 | `winningOutcome ∈ {0, 1, 2}` when settled | Valid outcome |
| T3 | Only adjudicator can resolve/verifyAttestation/settle | Access control |
| T4 | Only guardian (via AdjudicatorBase) can veto | Access control |
| T5 | `invalidate()` only callable when `deadline < block.timestamp && state == LIVE` | Deadline-gated |

### 15.5 Cross-Contract Invariants

| # | Invariant | Check |
|---|---|---|
| X1 | `LaunchpadEngine.isGraduated == FeeRouter.isGraduated` per market | Graduation state consistent |
| X2 | Only graduated markets are registered in matching engine | No pre-grad orderbook |
| X3 | `TruthMarket.isLive()` → trading allowed; `!isLive()` → no new trades | Lifecycle enforced |
| X4 | Total base token across all contracts ≥ total liabilities | System-wide solvency |
| X5 | `creatorNonce[creator]` monotonically increasing, never decremented | Nonce integrity |

---

## 16. Migration from Legacy

### 16.1 Contract Changes Summary

```
Legacy Current                       →  New Architecture
─────────────────────────────────────────────────────────────
LaunchpadEngine (720 lines)          →  LaunchpadEngine (~350 lines)
                                        - pause flag internal (no IProtocolConfig)
                                        - guardian REMOVED (moved to AdjudicatorBase, Layer 2)
                                        - all cross-refs immutable (CREATE3)
                                        - immutable adjudicatorRegistry
                                        - per-creator nonce tracking
                                        - simplified MarketState struct
                                     +  FeeRouter (~250 lines, NEW)
                                     +  AdjudicatorRegistry (~100 lines, NEW)

AMMEngine (645 lines)                →  AMMEngine (~600 lines, direct trading)
  - router pattern removed
  - tradePositionsFor() removed
  - launchpadEngine immutable (CREATE3)
  - feeRouter immutable (CREATE3)
  - trial cost tracking stays on LaunchpadEngine (AMMEngine is pure trading)

SoothBook (694 lines)                →  SoothBook (~500 lines)
  - interacts with MatchingEngine contract (fee extraction, settlement)
  - OutcomeToken removed (internal balances)
  - baseToken instead of hardcoded USDC

TruthMarket (201 lines)              →  TruthMarket (~230 lines)
  - constructor → initialize() for clone pattern
  - + TruthMarketImpl (same file)
  - state names: RESOLVING/RESOLVED/SETTLED (not SETTLING/SETTLED/FINALIZED)
  - DISMISSED state added
  - deadline expiry → invalidation (not auto-settle)
  - veto checks AdjudicatorBase (Layer 2), not IProtocolConfig

Collateralizer (325 lines)           →  REMOVED
OutcomeToken (89 lines)              →  REMOVED
ValidatedAdjudicator (290 lines)     →  REMOVED from core (2026-03-19); concrete impls in external repos
ProtocolConfig (69 lines)            →  REMOVED (pause internal, guardian to Layer 2)
IProtocolConfig                      →  REMOVED (interface deleted entirely)
```

### 16.2 Breaking Changes

| Change | Impact |
|---|---|
| No ERC20 outcome tokens | Traders cannot transfer YES/NO positions. Exit only via opposing orders or merge. |
| Direct AMMEngine trading | Frontend calls `AMMEngine.tradePositions()` not `LaunchpadEngine.tradePositions()`. |
| FeeRouter is new dependency | All trading venues must integrate FeeRouter callback. |
| TruthMarket clone pattern | Market addresses are now deterministic (CREATE2). Frontend can predict addresses before creation. |
| `usdc` → `baseToken` | All USDC references become generic ERC20. Decimals are dynamic. |
| Collateralizer removed | `split()`/`merge()` move into SoothBook. AMM settlement is on AMMEngine directly. |
| IProtocolConfig removed | No shared interface. LaunchpadEngine has internal `isPaused()`. Veto checks go through AdjudicatorBase. |
| CREATE3 deployment | All cross-references are immutable constructor args.  no post-deploy setters. Same addresses on all chains. |
| AdjudicatorRegistry (new) | Operators choose whitelisted or permissionless adjudicator policy at instance deploy time. Immutable choice. |
| State name changes | `SETTLING→RESOLVING`, `SETTLED→RESOLVED`, `FINALIZED→SETTLED`. Frontend must update enum references. |
| Guardian moved to Layer 2 | Guardian whitelist is per-adjudicator (AdjudicatorBase), not per-instance (LaunchpadEngine). |
| Nonce is auto-incremented | `nonce` parameter removed from `createMarket()`. Use `creatorNonce[creator]` to predict. |
| Deadline expiry = invalidation | Expired deadline (non-infinite) can be invalidated by anyone. Not auto-settled by adjudicator. |
| `claimRefund` on LaunchpadEngine | Traders call `LaunchpadEngine.claimRefund(market)` — LaunchpadEngine tracks trial costs via FeeRouter callback. |

### 16.3 Frontend Migration

| Legacy Call | New Call |
|---|---|
| `LaunchpadEngine.tradePositions(market, outcome, delta, max)` | `AMMEngine.tradePositions(market, outcome, delta, max)` |
| `LaunchpadEngine.claimRefund(market)` | `LaunchpadEngine.claimRefund(market)` (same — stays on LaunchpadEngine) |
| `Collateralizer.split(market, amount)` | `SoothBook.mint(marketKey, amount)` |
| `Collateralizer.merge(market, amount)` | `SoothBook.merge(marketKey, amount)` |
| `Collateralizer.redeem(market, amount)` | `matchingEngine.settlePosition(market)` |
| `LaunchpadEngine.getGraduationProgress(market)` | `FeeRouter.getGraduationProgress(market)` |
| `protocolConfig.isGuardian(account)` | `AdjudicatorBase(adjudicator).isGuardian(account)` |
| `TruthMarket.isFinalized()` | `TruthMarket.isSettled()` (renamed) |

---

## 17. Deployment Sequence

Step-by-step deployment for a new instance using **CREATE3 via CreateX**:

```
Step 1: Deploy standalone contracts (no circular deps)
  → TruthMarketImpl: constructor() — just holds bytecode
  → (Optional) AdjudicatorRegistry: constructor(owner)
    → approve(adjudicator1), approve(adjudicator2), ...
    → Skip for permissionless (pass address(0) in Step 3)

Step 2: Pick salts and predict ALL addresses
  → saltLaunchpad  = keccak256("sooth.launchpad.v1")
  → saltAMM        = keccak256("sooth.amm.v1")
  → saltFeeRouter  = keccak256("sooth.feerouter.v1")
  → saltSoothBook  = keccak256("sooth.soothbook.v1")
  → predictedLaunchpad  = createX.computeCreate3Address(saltLaunchpad)
  → predictedAMM        = createX.computeCreate3Address(saltAMM)
  → predictedFeeRouter  = createX.computeCreate3Address(saltFeeRouter)
  → predictedSoothBook  = createX.computeCreate3Address(saltSoothBook)

Step 3: Deploy all core contracts via CREATE3
  → createX.deployCreate3(saltLaunchpad, LaunchpadEngine(
        baseToken, truthMarketImpl, adjudicatorRegistry,
        predictedAMM, predictedFeeRouter, predictedSoothBook, owner
    ))
  → createX.deployCreate3(saltAMM, AMMEngine(
        baseToken, predictedLaunchpad, predictedFeeRouter
    ))
  → createX.deployCreate3(saltFeeRouter, FeeRouter(
        baseToken, predictedAMM, predictedLaunchpad
    ))
  → createX.deployCreate3(saltSoothBook, SoothBook(
        baseToken, predictedFeeRouter
    ))

Step 4: Verify all contracts deployed at predicted addresses
  → require(predictedLaunchpad.code.length > 0)
  → require(predictedAMM.code.length > 0)
  → require(predictedFeeRouter.code.length > 0)
  → require(predictedSoothBook.code.length > 0)

Step 5: Configure fee parameters
  → feeRouter.setPreGradFee(500)       // 5%
  → feeRouter.setPostGradFee(100)      // 1%
  → feeRouter.setFeeDistribution(5000, 3000, 1000, 1000)
  → feeRouter.setProtocolTreasury(treasuryAddress)

Step 6: Verify deployment
  → Run verification script
  → Check all immutable cross-references resolve correctly
  → Attempt a createMarket() → trade → verify fee flow
```

**No post-deploy wiring needed.** All cross-references are immutable constructor args
set via CREATE3 address prediction. The deployment is complete after Step 5.

**Cross-chain deployment:** Using the same wallet and same salts produces the **same
contract addresses** on every chain where CreateX is deployed (Base, Monad, Arc, etc.).

---

## 18. Open Questions

These items are intentionally unspecified pending team review.

| # | Topic | Blocking | Notes |
|---|---|---|---|
| OQ-1 | Matching-engine fee extraction — exact mechanics of push model in SoothBook and offchain CLOB | `TRADING-ENGINE.md` | SoothBook collects fee, pushes to FeeRouter; CLOB may batch |
| OQ-7 | Operator hooks — pluggable logic for custom rules. Where do hooks attach? What can they modify? | This spec | Deferred to future version |
| OQ-13 | TruthMarket resolve/verifyAttestation/settle — should these be 3 separate calls or can resolve+verifyAttestation be combined? | This spec | 3-step gives maximum veto flexibility; 2-step reduces gas. Some adjudicators skip RESOLVING by combining resolve + verifyAttestation in one call. |
| OQ-14 | CreateX salt versioning — how to handle redeployment (e.g., v2)? Bump salt suffix? | Deployment | `keccak256("sooth.launchpad.v2")` for new version |

---

## Related Documents

| Document | Location | Notes |
|---|---|---|
| SPEC-INDEX.md | `docs/specs/SPEC-INDEX.md` | Master index, glossary, architecture overview |
| TRADING-ENGINE.md | `docs/specs/TRADING-ENGINE.md` (planned) | AMMEngine full spec, SoothBook atomics, offchain CLOB, MatchingEngine details |
| LAYER2-ADJUDICATOR.md | `docs/specs/LAYER2-ADJUDICATOR.md` (planned) | AdjudicatorBase, guardian management, IAdjudicator interface |
| LAYER3-CREATOR.md | `docs/specs/LAYER3-CREATOR.md` (planned) | Market creation UX, bBase selection, initial odds |
| Architecture | `docs/ARCHITECTURE.md` | Architecture reference |

---

*Version 0.1.0 — Draft — `zak/protocol-spec` branch — 2026-02-27*
