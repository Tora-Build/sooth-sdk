<!--
  SPEC-INDEX.md — Sooth Protocol Master Specification Index
  Version: 0.1.1 | Status: Draft | Branch: zak/protocol-spec → develop
  Last Updated: 2026-03-23
  Audience: AI Agents · Operators · Adjudicator · Market Creators . Traders
-->

# Sooth Protocol — Specification Index

> **Single source of truth for architecture, roles, terminology, and cross-references.**
> Start here before reading any other spec file.

---

## Quick-Reference Card

| Property | Value |
|---|---|
| Protocol Version | V1 |
| Solc | `0.8.33`, `via_ir = false`, 200-run optimizer |
| Internal Precision | WAD = 1e18 |
| Collateral | Any ERC20 (`baseToken`) —  dynamic decimals|
| Outcome Encoding | `0 = NO`, `1 = YES`, `2 = INVALID` |
| Market Identity | TruthMarket address (minimal deterministic proxy clone) |
| Tick Range | 1–999 (price = tick / 1000 of one baseToken unit) |
| Positions | Internal balances  |
| Trial Period | 7 days from market creation |
| TruthMarket Deployment | CREATE2 clone of shared `TruthMarketImpl` — ~50k gas per market |

---

## Specification Files

| File | Answers | Primary Audience |
|---|---|---|
| **`SPEC-INDEX.md`** (this file) | What exists? What does each term mean? Who can do what? | Everyone |
| **`LAYER1-CORE-PROTOCOL.md`** | How do the core contracts work? State machines, fee flows, invariants, deployment | AI agents, auditors, integrators, Operators |
| **`LAYER2-ADJUDICATOR.md`** | How is resolution triggered? IAdjudicator interface, settlement flow, how to build a custom adjudicator | Adjudicators |
| **`LAYER3-CREATOR.md`** | How do I create and operate a market? Initial odds, LP economics, trial period, fee config | Market creators |
| **`TRADING-ENGINE.md`** | How does matching work? SoothBook vs offchain CLOB, IMatchingEngine, unified events | Operators|
| **`INTEGRATION.md`** | How do I integrate? ABIs, SDK, indexer API, deployments.json schema, frontend hooks | Frontend devs, SDK consumers |

---

## Glossary

Terms are listed in dependency order (earlier terms do not depend on later ones).

### Base Token

The ERC20 collateral token for an instance. Set once at deployment as an immutable on `LaunchpadEngine`. Can be **any** ERC20 with **any** decimal precision (6, 8, 18, etc.). The protocol reads `baseToken.decimals()` at deploy time and uses it for all WAD ↔ token-decimal conversions.

### WAD

`1e18`. All internal arithmetic uses WAD precision. Base token transfers convert at the boundary using `_wadToToken()` / `_tokenToWad()` with the token's actual decimals. **Never** compare a WAD value against a raw token amount.

### Tick

An integer in `[1, 999]` representing a limit-order price as a fraction of one base token unit. Each tick = 1/1000 of one base token (0.1%). A YES order at tick 600 means the buyer is willing to pay 0.600 base tokens per outcome share (60% implied probability). Stored as `uint16`.

Crossing rule: a YES order at tick Y and a NO order at tick N cross when `Y + N ≥ 1000`, because the combined willingness-to-pay meets or exceeds 1.0 base token (the full payout of a winning share). Any surplus `(Y + N - 1000)` goes to the taker.

The complement of a NO tick in YES-price space is `1000 - noTick`. Example: NO tick 580 = NO buyer pays 58% for NO = accepts 42% as a YES seller.

### Market Key

`bytes32 = keccak256(abi.encodePacked(address marketAddress))`. Canonical identifier for a market across all protocol contracts. The market address is the CREATE2 clone of TruthMarket — deterministic from `(creator, adjudicator, question, nonce)`. Note: uses `encodePacked` (no 32-byte padding), NOT `abi.encode`.

### Outcome

Protocol-wide integer:

| Value | Meaning |
|---|---|
| `0` | NO — the "No" side wins |
| `1` | YES — the "Yes" side wins |
| `2` | INVALID — market invalidated; 50/50 collateral split |

Canonical source: `TruthMarket.sol`. Consistent across AMMEngine, SoothBook, and any IMatchingEngine implementation.

### Position

A trader's YES and NO balances for a given market. Stored as **internal accounting within the SoothBook** (not as ERC20 tokens). For offchain CLOB, they are tracked in the CLOB's own ledger and settled onchain at finalization. Positions are non-transferable; to exit, a trader places an opposing order or merges (yes + no → base token) or cancel based on matching engine.

### bBase

Initial LMSR liquidity parameter (WAD). Set by creator at market creation. Determines AMM depth, creator deposit (`bBase × ln(2)`), and graduation threshold (`creatorDeposit × graduationBps / 10000`). Immutable after creation; `bCurrent` grows with fee reinvestment.

### bCurrent

Current LMSR liquidity parameter (WAD). Starts equal to `bBase`; grows as pre-graduation fees reinvest into depth. Determines instantaneous price sensitivity.

### Graduation

Event when a market's `feesAccrued ≥ graduationThreshold` (where `threshold = creatorDeposit × graduationBps / 10000`, set per-instance by operator). The AMM (bonding) phase ends; the instance's configured matching engine (SoothBook or offchain CLOB) becomes active for the market. Graduated markets cannot be dismissed by the creator.

### Trial Period

7-day window after market creation. During the trial, trader costs are locked (refundable). After the trial:

- If graduated → market continues, no dismiss allowed.
- If not graduated → creator can call `dismissMarket()`; traders claim refunds via `claimRefund()`.

### tStar

"Truth Star" — the timestamp at which the real-world outcome was determinable (not when the adjudicator submitted the proof). Used in retroactive settlement schemes (see `LAYER2-ADJUDICATOR.md`).

### Adjudicator

An autonomous contract implementing `IAdjudicator`, **built and deployed independently by a third party**. It monitors the real-world event, determines the outcome, and calls `TruthMarket.resolve(outcome, tStar)` to propose, `verifyAttestation()` to prove, and `settle()` to finalize. The adjudicator is appointed per-market by the **creator** at market creation. Users execute the final redemption via `AMMEngine.settlePosition()` or `matchingEngine.settlePosition()`. Adjudicator contracts are BSL-licensed.

### LP Token

ERC20 `LaunchpadLPToken` deployed per-market at creation. Represents a pro-rata claim on the AMM's equity floor. Minted to traders during the pre-graduation phase (as a fee rebate). Redeemable via `LaunchpadEngine.redeemLP()` — no settlement gate (LP holders can exit at floor value at any time).

### Instance

One deployment of the full Sooth Protocol stack (LaunchpadEngine + AMMEngine + FeeRouter + TruthMarketImpl + **one** matching engine). At deploy time the Operator chooses either **SoothBook** (onchain orderbook) or an **offchain CLOB** as the instance's matching engine — both implement `IMatchingEngine` and settle onchain. All markets created within an instance use the same matching engine and inherit the same fee parameters.

Typically deployed by Sooth for a third-party community or partner, but the protocol is permissionless — anyone can deploy their own instance.

### Operator

The address that owns `LaunchpadEngine` at construction. The Operator deploys and configures the instance:

- Sets fee parameters (`preGradFeeBps`, `postGradFeeBps`, fee splits)
- Sets `graduationBps` (instance-wide graduation speed)
- Sets `feeRecipient`
- Chooses the base token (at deploy time, immutable)
- Can transfer ownership or renounce it for full immutability

Typically this is Sooth deploying on behalf of a partner, but can be anyone. The Operator defines the economic rules that all markets in the instance follow. In the future, the Operator may configure **hooks** — pluggable logic that adds custom rules to market creation, trading, or settlement within their instance.

### Creator

EOA or contract that calls `LaunchpadEngine.createMarket()`. Sets `bBase`, selects an adjudicator, and sets initial odds. Receives LP tokens at creation (1:1 with deposit) — LP tokens are the creator's only claim, no separate deposit refund. Operates within the fee rules and `graduationBps` set by the Operator.

### Trader / User

Any address that trades (AMM or orderbook), holds LP tokens or positions, and redeems post-settlement. Redemption is pull-based — the protocol never pushes funds.

### Guardian

Address approved by an adjudicator's owner via `AdjudicatorBase`. Guardians monitor resolved markets and can veto incorrect outcomes before settlement is finalized. Guardian management is per-adjudicator (not global). See `LAYER2-ADJUDICATOR.md §8`.

---

## Role Permission Matrix

> ✅ = Can always call | 🔒 = Can call only under conditions | ❌ = Cannot call

| Action | Operator | Creator | Adjudicator | Trader |
|---|---|---|---|---|
| Deploy instance (set base token, fee params) | ✅ | ❌ | ❌ | ❌ |
| Set `preGradFeeBps` / `postGradFeeBps` | ✅ | ❌ | ❌ | ❌ |
| Set fee splits (bBase / LP / Protocol %) | ✅ | ❌ | ❌ | ❌ |
| Set `graduationBps` | ✅ | ❌ | ❌ | ❌ |
| Set `feeRecipient` on SoothBook | ✅ | ❌ | ❌ | ❌ |
| Configure hooks (future) | ✅ | ❌ | ❌ | ❌ |
| `createMarket()` | ✅ | ✅ | ❌ | ❌ |
| Set initial odds for a market | ❌ | ✅ (at creation) | ❌ | ❌ |
| Choose adjudicator for a market | ❌ | ✅ (at creation) | ❌ | ❌ |
| `dismissMarket()` | ❌ | 🔒 (post-trial, not graduated) | ❌ | ❌ |
| `tradePositions()` (AMM) | ❌ | ❌ | ❌ | ✅ |
| `buyYes()` / `buyNo()` | ❌ | ❌ | ❌ | ✅ |
| `mint()` / `merge()` | ❌ | ❌ | ❌ | ✅ |
| `cancel()` own order | ❌ | ❌ | ❌ | ✅ |
| `resolve(outcome, tStar)` / `settle()` on TruthMarket | ❌ | ❌ | ✅ (designated) | ❌ |
| `settlePosition()` via matching engine | ❌ | ❌ | ❌ | ✅ (post-settled) |
| `redeemLP()` from LaunchpadEngine | ❌ | ✅ | ❌ | ✅ |
| `claimRefund()` from LaunchpadEngine | ❌ | ❌ | ❌ | ✅ (post-dismiss) |
| Emergency pause | ✅ | ❌ | ❌ | ❌ |

---

## Architecture Overview

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │  OPERATOR  (above all layers)                                        │
  │  Deploys instance · Chooses matching engine · Sets fee economics     │
  │  Configures baseToken · Future: configures hooks                     │
  └──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      LAYER 1 — CORE PROTOCOL                            │
│                                                                         │
│  LaunchpadEngine                                                        │
│  (market creation, lifecycle, LP tokens, trial/dismiss)                 │
│        │                                                                │
│        ├──► AMMEngine  (LMSR pricing, pre-graduation trading)           │
│        │         └── fees ──► FeeRouter                                 │
│        │                                                                │
│        └──► FeeRouter  (unified fee calc + distribution for all venues) │
│                  │  ▲                                                   │
│                  │  └── fee callback from matching engine               │
│                  ▼                                                      │
│            IMatchingEngine  (unified settlement interface)              │
│            ┌───────────────────────────────────────────┐                │
│            │  SoothBook          │  Offchain CLOB      │                │
│            │  (onchain option)   │  (offchain option)  │                │
│            │  4-atomic OB        │  full CLOB service  │                │
│            │  FIFO matching      │  (e.g. Polymarket   │                │
│            │  internal balances  │   style) settles    │                │
│            │                     │   onchain via this  │                │
│            │                     │   interface         │                │
│            └───────────────────────────────────────────┘                │
│         One engine per instance — chosen at deploy, not per market      │
│                                                                         │
│  TruthMarket  (per-market CREATE2 clone, lifecycle authority)           │
│  baseToken: any ERC20, decimals resolved at deploy                      │
└───────────────▲─────────────────────────────────▲───────────────────────┘
                │ resolve() / settle()            │ createMarket()
┌───────────────┴──────────────────┐   ┌──────────┴──────────────────────┐
│   LAYER 2 — ADJUDICATOR (BSL)    │   │     LAYER 3 — CREATOR           │
│  IAdjudicator · Oracle+Resolver  │   │  Creates markets per instance   │
│  Third-party · independently     │   │  Sets bBase · initial odds      │
│  deployed · BSL-licensed         │   │  Chooses adjudicator            │
│  Examples: PrimusZKTLS ·         │   │  Sets bBase · Chooses adjudicator│
│  Optimistic · Multisig · Manual  │   └─────────────────────────────────┘
└──────────────────────────────────┘
```

---

## Market Lifecycle State Machine

```
                       createMarket()
                            │
                            ▼
                      ┌──────────┐
           Trial ends │  BONDING │ 7-day trial window
       not graduated  │  (AMM)   │ trading costs are locked
           ┌──────────└──────────┘──────────┐
           │                                │ feesAccrued ≥ threshold
           ▼                                ▼
     ┌───────────┐                   ┌────────────┐
     │ DISMISSED │                   │ GRADUATED  │ Matching engine active
     │           │                   │            │ (SoothBook or offchain CLOB)
     └─────┬─────┘                   └─────┬──────┘
           │ claimRefund()                 │
           ▼                               ▼
     ┌───────────┐                   ┌───────────┐  resolve()
     │ REFUNDED  │                   │ RESOLVING │  (adjudicator proposes)
     └───────────┘                   └─────┬─────┘
                                           │ verifyAttestation()
                                           ▼
                                     ┌───────────┐
                                     │ RESOLVED  │  (Guardian can veto)
                                     └─────┬─────┘
                                           │ settle()
                                           ▼
                                     ┌───────────┐
                                     │  SETTLED  │ settlePosition() opens
                                     └───────────┘
```

---

## Fee Flow Summary

### Pre-Graduation (AMM phase)

```
Trader pays 100 baseToken (trade cost + 5% fee)
                │
                ├──► 95 baseToken → AMMEngine (bCurrent growth + qYes/qNo)
                │
                └──► 5 baseToken fee → LaunchpadEngine
                          │
                          └──► 100% → bBase (increases AMM depth)
                               + LaunchpadLPToken minted to trader (same $ value)
```

### Post-Graduation (Matching Engine phase)

```
Trader pays 100 baseToken (trade cost + 1% post-grad fee, configurable)
                │
                ├──► 99 baseToken → selected matching engine
                │                    (SoothBook or offchain CLOB settlement adapter)
                │
                └──► baseToken fee → LaunchpadEngine
                          │
                          ├──► 50% → bBase (bCurrent growth, LP floor rises)
                          ├──► 30% → LP Yield Pool (distributed to LP holders)
                          ├──► 10% → Adjudicator
                          └──► 10% → Protocol Treasury (Optional)
```

Fee percentages (5% pre-grad, Dynamic post-grad) and splits (50/30/10/10) are configurable by the **Operator** at the instance level. All markets in an instance follow the same fee rules. Protocol treasury is optional and can be set to designated address.

> ⚠️ **Pending**: Matching-engine fee integration is implementation-specific. SoothBook native fee routing and offchain CLOB settlement fee routing are both pending design finalization. See `TRADING-ENGINE.md §Fee Integration`.

---

## Key Contracts & Interfaces

| Contract | File | Description |
|---|---|---|
| `LaunchpadEngine` | `src/LaunchpadEngine.sol` | Market creation, LP tokens, trial/dismiss, LP redemption. Owned by Operator. |
| `AMMEngine` | `src/AMMEngine.sol` | LMSR trading engine, position storage, 24h sell lock. Pre-graduation only. |
| `FeeRouter` | `src/FeeRouter.sol` (planned) | Unified fee calculation and distribution for all venues (AMM and matching engine). Handles pre/post-grad fee splits, LP minting, graduation trigger, trial accounting. |
| `IMatchingEngine` | `src/interfaces/IMatchingEngine.sol` (planned) | Unified settlement interface implemented by both onchain and offchain matching engines. Handles post-graduation order matching and onchain settlement for both engine types. |
| `SoothBook` | `src/SoothBook.sol` | **Onchain** `IMatchingEngine` implementation. 4-atomic orderbook, FIFO matching, internal position balances (no ERC20 tokens). One option per instance. |
| `TruthMarket` | `src/TruthMarket.sol` | Per-market lifecycle authority (LIVE→RESOLVING→RESOLVED→SETTLED). Deployed as CREATE2 minimal proxy clone (~50k gas). Third-party adjudicators call `resolve()` / `settle()` directly on this address. |
| `TruthMarketImpl` | `src/TruthMarket.sol` (same) | Shared implementation for all TruthMarket clones. Deployed once per instance. Immutable in `LaunchpadEngine`. |
| `LaunchpadLPToken` | `src/LaunchpadLPToken.sol` | ERC20 LP token, deployed per market at creation |
| `IAdjudicator` | `src/interfaces/IAdjudicator.sol` | Interface all adjudicator contracts must implement (third-party) |
| `ISoothBook` | `src/interfaces/ISoothBook.sol` | SoothBook external interface |
| `ILaunchpadEngine` | `src/interfaces/ILaunchpadEngine.sol` | LaunchpadEngine external interface |
| `TickBitmap` | `src/libraries/TickBitmap.sol` | O(1) non-empty tick lookup |
| `LMSRMath` | `src/libraries/LMSRMath.sol` | Fixed-point LMSR cost function |

**Removed from architecture**: `Collateralizer.sol` — no longer needed since ERC20 outcome tokens are removed; positions are internal to the matching engine and settle directly.

---

## Cross-Reference Index

> Use this table to jump from a concept to the spec that defines it in detail.

| Concept | Primary Spec | Secondary Refs |
|---|---|---|
| Base token (any ERC20) | `LAYER1-CORE-PROTOCOL.md §Base Token` | `INTEGRATION.md §Deployments` |
| LMSR pricing formula | `LAYER1-CORE-PROTOCOL.md §AMMEngine` | `LAYER3-CREATOR.md §bBase Selection` |
| Graduation threshold | `LAYER1-CORE-PROTOCOL.md §Graduation` | `LAYER3-CREATOR.md §Graduation Economics` |
| Trial period & dismiss | `LAYER1-CORE-PROTOCOL.md §Trial Period` | `LAYER3-CREATOR.md §Market Lifecycle` |
| Initial odds (per market) | `LAYER3-CREATOR.md §Initial Odds` | `LAYER1-CORE-PROTOCOL.md §AMMEngine` |
| Fee splits & BPS config | `LAYER1-CORE-PROTOCOL.md §Fee System` | `LAYER3-CREATOR.md §Creator Economics` |
| Operator role & hooks | `LAYER1-CORE-PROTOCOL.md §Operator` | `TRADING-ENGINE.md §Hooks (Future)` |
| FeeRouter & fee routing | `LAYER1-CORE-PROTOCOL.md §FeeRouter` | `TRADING-ENGINE.md §Fee Integration` |
| Matching engine abstraction (IMatchingEngine) | `TRADING-ENGINE.md §IMatchingEngine` | `TRADING-ENGINE.md §Engine Choice` |
| SoothBook (onchain engine) | `TRADING-ENGINE.md §SoothBook Atomics` | `LAYER1-CORE-PROTOCOL.md §SoothBook` |
| Offchain CLOB (offchain engine) | `TRADING-ENGINE.md §Offchain CLOB` | `TRADING-ENGINE.md §Engine Choice` |
| Tick math & matching | `TRADING-ENGINE.md §Tick System` | `LAYER1-CORE-PROTOCOL.md §SoothBook` |
| Onchain vs offchain CLOB | `TRADING-ENGINE.md §Engine Choice` | — |
| IAdjudicator interface | `LAYER2-ADJUDICATOR.md §Interface` | `INTEGRATION.md §Solidity Interfaces` |
| Settlement flow (full) | `LAYER2-ADJUDICATOR.md §Settlement Flow` | `LAYER1-CORE-PROTOCOL.md §TruthMarket` |
| PrimusZKTLS adjudicator | `LAYER2-ADJUDICATOR.md §Implementations` | — |
| TruthMarket clone pattern | `LAYER1-CORE-PROTOCOL.md §TruthMarket` | `INTEGRATION.md §Deployments` |
| Redemption (post-settle) | `LAYER1-CORE-PROTOCOL.md §Settlement` | `LAYER3-CREATOR.md §Trader Redemption` |
| Deployments & config | `INTEGRATION.md §Deployments` | `LAYER1-CORE-PROTOCOL.md §Deployment` |
| Indexer events | `INTEGRATION.md §Event Schema` | `TRADING-ENGINE.md §Unified Events` |
| Frontend SDK hooks | `INTEGRATION.md §SDK` | — |
| WAD ↔ token conversion | `LAYER1-CORE-PROTOCOL.md §Precision` | `INTEGRATION.md §Math Utilities` |

---

## Open Questions (Pending Design Decisions)

These items are intentionally unspecified pending team review. Each spec file marks them `⚠️ OPEN`.

| # | Topic | Blocking | Decision |
|---|---|---|---|
| OQ-1 | Matching-engine fee mechanism — how are fees extracted/routed for SoothBook and offchain CLOB paths? | `TRADING-ENGINE.md` | |
| ~~OQ-2~~ | ~~YES/NO OutcomeToken removal~~ | — | **DECIDED: Removed.** Positions are internal SoothBook balances. |
| OQ-3 | Initial odds implementation — LMSR parameter seeding vs. virtual trade at creation | `LAYER3-CREATOR.md` | |
| ~~OQ-4~~ | ~~Collateralizer ↔ SoothBook integration~~ | — | **DECIDED: Removed.** Collateralizer is removed from the architecture. No ERC20 outcome tokens → no split/merge/redeem contract needed. Settlement goes through the matching engine directly. |
| OQ-5 | Offchain CLOB settlement bridge — how does fill data settle on-chain in a trust-minimized way? | `TRADING-ENGINE.md` | |
| OQ-6 | Per-instance vs per-market matching engine selection?  | `TRADING-ENGINE.md` | **DECIDED: Per Instance.** Engine is set at instance deploy, not per market |
| OQ-7 | Operator hooks — pluggable logic for custom rules on market creation, trading, or settlement within an instance. Design TBD. | `LAYER1-CORE-PROTOCOL.md` | |

---

## Related Documents

| Document | Location | Notes |
|---|---|---|
| SoothBook Design Doc | `docs/SOOTHBOOK.md` | Engineering reference (not audience-facing) |
| Architecture | `docs/ARCHITECTURE.md` | Contract graph and invariants |

---

*Version 0.1.0 — Draft — `zak/protocol-spec` branch — 2026-02-25*
