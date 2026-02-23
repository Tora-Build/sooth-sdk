# Sooth Protocol — Three-Layer Architecture

> Strategic architecture defining the Sooth Protocol's business model across three
> unified layers: Core Protocol, Adjudicator Extension, and Creator Layer.

**Version**: 1.0
**Date**: 2026-02-22
**Status**: Draft

---

## Overview

The Sooth Protocol operates as a three-layer stack. Each layer has distinct
responsibilities, licensing terms, and economic incentives. Together they form
a unified system where prediction markets generate sustainable revenue while
scaling from operator-driven launch to community-driven growth.

The separation of concerns is deliberate:

- **Layer 1** provides the open, auditable trading infrastructure that anyone can verify.
- **Layer 2** encapsulates the operational complexity of truth resolution behind a
  clean interface, enabling specialization and monetization.
- **Layer 3** empowers market operators to build sustainable businesses on top of
  the protocol without modifying its core.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  LAYER 3 — CREATOR LAYER                                                │
│                                                                         │
│  Evolution: Operators ─► Interest Groups ─► Communities ─► Individuals  │
│                                                                         │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────┐  ┌─────────────┐    │
│  │ Adjudicator  │  │    Fee     │  │    Income    │  │   Data &    │    │
│  │  Selection   │  │ Allocation │  │ Distribution │  │  Analytics  │    │
│  └──────┬───────┘  └─────┬──────┘  └──────┬───────┘  └──────┬──────┘    │
│         │                │                │                 │           │
│         │  chooses       │  configures    │  manages        │  uses     │
│         ▼                ▼                ▼                 ▼           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LAYER 2 — ADJUDICATOR LAYER (Extension)                                │
│                                                                         │
│  Definition:  Oracle  +  Resolver  =  Adjudicator                       │
│                                                                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────────┐    │
│  │    TEE     │  │   Oracle   │  │    DAO     │  │    Manual /     │    │
│  │ Validated  │  │ Feed-Based │  │ Governance │  │   Optimistic    │    │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └───────┬─────────┘    │
│        └───────────────┴───────────────┴─────────────────┘              │
│                              │                                          │
│  Interface: IAdjudicator { settle() · canSettle() · adjudicatorType() } │
│  License:   Business Source License (BSL)                               │
│                              │                                          │
├──────────────────────────────┼──────────────────────────────────────────┤
│                              ▼                                          │
│  LAYER 1 — CORE SOOTH PROTOCOL                                          │
│                                                                         │
│  ┌──────────────┐  ┌───────────┐  ┌────────────┐  ┌────────────────┐    │
│  │  Launchpad   │  │    AMM    │  │  SoothBook │  │ ProtocolConfig │    │
│  │   Engine     │  │   Engine  │  │  Orderbook │  │  (Governance)  │    │
│  └──────────────┘  └───────────┘  └────────────┘  └────────────────┘    │
│                                                                         │
│  Supporting: TruthMarket · Collateralizer · OutcomeToken · LP Token     │
│                                                                         │
│  License: Open Source (Copyleft — modifications must be distributed     │
│           under the same open-source license)                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1 — Core SOOTH Protocol

### Purpose

The foundation layer. All smart contracts that define the prediction market
lifecycle — from market creation through trading to settlement and redemption.

### Components

| Contract         | Role                                                             |
|------------------|------------------------------------------------------------------|
| **LaunchpadEngine** | Creator economics: market creation, trial periods, fee distribution, graduation |
| **AMMEngine**       | Pre-graduation trading via LMSR continuous pricing (log-sum-exp) |
| **SoothBook**       | Post-graduation orderbook: 4 atomic actions, FIFO matching, ERC20 tokens |
| **ProtocolConfig**  | Governance: guardian list, global pause, protocol-level access control |
| **TruthMarket**     | Canonical lifecycle authority: LIVE → SETTLING → SETTLED → FINALIZED |
| **Collateralizer**  | Token operations: split (1 USDC → 1 YES + 1 NO), merge, redeem |
| **OutcomeToken**    | ERC20 YES/NO outcome tokens per market, transferable and composable |
| **LaunchpadLPToken**| ERC20 LP shares for creators/LPs, freely transferable pre-settlement |

### Data Flow

```
Creator deposit (USDC)
       │
       ▼
 LaunchpadEngine ──── createMarket() ───► TruthMarket (lifecycle)
       │
       ├── Pre-Graduation: AMMEngine (LMSR pricing, 5% fee)
       │         │
       │         └── Fees accumulate → graduation threshold
       │
       ├── Graduation ─────────────────► Collateralizer (register tokens)
       │                                 SoothBook (create orderbook)
       │
       └── Post-Graduation: SoothBook (orderbook, 1% fee)
                   │
                   └── 4 actions: buyYes · buyNo · mint · merge
                                  │
                                  ▼
                          ERC20 Outcome Tokens
                          (YES / NO in user wallets)
```

### Licensing

The core protocol is released as **fully open-source software** under a
copyleft license. This means:

- Anyone can read, audit, deploy, and build on the protocol.
- Any modifications to the core contracts **must** be distributed under
  the same open-source license.
- This ensures ecosystem integrity: forks cannot close-source improvements
  to the foundational layer.

### Design Principles

1. **Pull-Based Lifecycle** — All contracts query `TruthMarket.isLive()` and
   `isSettled()`. No callbacks, no hooks, no centralized coordinator.
2. **WAD Precision** — All internal math uses 1e18 (WAD). Conversion to USDC
   decimals (1e6) happens only at transfer boundaries.
3. **No Vault** — Direct USDC ↔ token transfers. No custody layer.
4. **ERC20 Composability** — Outcome tokens and LP tokens are standard ERC20,
   enabling integration with DeFi protocols.

---

## Layer 2 — Adjudicator Layer (Extension)

### Purpose

The truth-resolution layer. An **Adjudicator** is defined as the combination
of an Oracle (data source) and a Resolver (settlement logic). Multiple
specialized implementations can coexist, each optimized for different market
types and trust models.

### Definition

```
┌─────────────────────────────────────────────────┐
│               ADJUDICATOR                       │
│                                                 │
│   ┌──────────────┐      ┌────────────────────┐  │
│   │   Oracle     │      │     Resolver       │  │
│   │  (data feed) │ ───► │  (settlement logic)│  │
│   └──────────────┘      └────────────────────┘  │
│                                                 │
│   Examples:                                     │
│   • TEE attestation + ERC-8004 validation       │
│   • Chainlink feed + threshold resolver         │
│   • DAO vote + quorum resolver                  │
│   • Human committee + multi-sig                 │
│   • UMA/Optimistic + dispute window             │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Interface

All adjudicators implement the `IAdjudicator` interface:

```solidity
interface IAdjudicator {
    /// Settle a market with the determined outcome
    /// @param outcome  0 = NO, 1 = YES, 2 = INVALID
    function settle(
        address market,
        uint8   outcome,
        uint64  tStar,           // retroactive truth-time (0 if N/A)
        bytes32 resolutionData   // implementation-specific proof
    ) external;

    /// Check if this adjudicator can settle a specific market
    function canSettle(address market) external view returns (bool);

    /// Adjudicator type identifier ("tee", "oracle", "dao", "manual")
    function adjudicatorType() external view returns (string memory);
}
```

Adjudicators that require per-market configuration also implement:

```solidity
interface IAdjudicatorRegistration {
    function registerMarket(
        address market,
        uint256 agentId,        // e.g. ERC-8004 agent ID
        uint256 minValidators   // minimum validators required
    ) external;
}
```

### Specialization

Because the interface is minimal, adjudicators can be built for any
resolution mechanism:

| Type               | Oracle Source            | Resolver Logic                      | Trust Model       |
|--------------------|--------------------------|--------------------------------------|-------------------|
| **TEE Validated**  | TEE attestation          | ERC-8004 agent verification          | Hardware trust     |
| **Oracle Feed**    | Chainlink / Pyth / API3  | Threshold comparison                 | Decentralized feed |
| **DAO Governance** | Community vote           | Quorum + timelock                    | Social consensus   |
| **Manual**         | Human adjudicator        | Direct submission                    | Reputation-based   |
| **Optimistic**     | Proposer assertion       | Dispute window + bond                | Economic security  |

### Economics

Adjudication has real operational costs — running TEE infrastructure, maintaining
oracle feeds, operating dispute resolution systems. The economics reflect this:

- **Creators choose** their preferred adjudicator at market creation time.
- **Certain adjudicators may charge fees** for their resolution services.
  These fees are agreed upon during market setup and may involve a fee split
  with the creator.
- **Competition** between adjudicators drives quality and cost efficiency.
  Creators select based on trust, cost, speed, and specialization.

### Licensing

The adjudicator layer is **open-source** but governed by a **Business Source
License (BSL)**. This means:

- Source code is publicly readable and auditable.
- Use requires a commercial license during the protection period.
- After the protection period, the code converts to a fully open license.
- This allows Sooth (and partners) to build sustainable adjudicator services
  while keeping the code transparent.

### Settlement Flow

```
 Market deadline reached
        │
        ▼
 Adjudicator.settle(market, outcome, tStar, proof)
        │
        ├── Validates proof (TEE attestation / oracle data / vote result)
        │
        ▼
 TruthMarket.settle(outcome, tStar)
        │
        ├── State: LIVE/SETTLING → SETTLED
        │
        ├── Guardian veto window (emergency override)
        │
        ▼
 Adjudicator.finalize()
        │
        ▼
 TruthMarket.finalize()
        │
        ├── State: SETTLED → FINALIZED
        │
        ▼
 Collateralizer.redeem(market, amount)
        │
        └── Burns winning tokens → returns USDC
```

---

## Layer 3 — Creator Layer

### Purpose

The business layer. Creators are the entities that deploy and operate
prediction markets. They make the economic decisions that determine whether
a market is viable and profitable.

### Evolution

The creator ecosystem evolves through four phases:

```
Phase 1              Phase 2              Phase 3              Phase 4
OPERATORS            INTEREST GROUPS      COMMUNITIES          INDIVIDUALS
                                                              
Professional         Domain experts       Local/niche          Anyone
market makers        & organizations      communities         
                                                              
Systematic series    Specialized          Community-driven     Personal
of markets           verticals            questions            predictions
                                                              
High volume,         Medium volume,       Lower volume,        Long-tail,
algorithmic          curated              organic              diverse
```

**Phase 1 (Current)**: Market creation is operator-based, with systematic
liquidity provision across series of related markets. Operators bring
professional market-making expertise and capital.

**Phase 2**: As infrastructure, data, and education services mature,
specialized groups (research organizations, media outlets, industry
associations) begin creating markets in their domains of expertise.

**Phase 3**: Local communities and interest groups create markets relevant
to their constituencies — local elections, community decisions, niche topics.

**Phase 4**: Full individual access. Anyone can create and operate a market
with minimal capital and effort, supported by mature tooling and analytics.

### Creator Responsibilities

#### (a) Adjudicator Selection

Creators choose their preferred adjudicator during market creation:

```solidity
launchpadEngine.createMarket(
    question,
    startTime,
    deadline,
    adjudicator,              // ◄── Creator's choice of settlement authority
    guardian,
    initialLiquidity,
    adjudicatorAgentId,       // TEE agent config (0 to skip)
    adjudicatorMinValidators  // Multi-validator threshold (0 to skip)
);
```

Selection considerations:
- **Cost**: Some adjudicators charge resolution fees (fee split with creator).
- **Trust**: TEE-validated adjudicators offer hardware-level assurance.
  Oracle-based adjudicators leverage decentralized data feeds.
  Manual adjudicators rely on reputation.
- **Speed**: Time from event occurrence to market settlement.
- **Coverage**: Not all adjudicators serve all market types.

#### (b) Fee Allocation

Utilizing the open-source logic of the core protocol, creators can initially
allocate **100%** of collected trading fees:

```
Pre-Graduation (5% fee on AMM trades):
┌─────────────────────────────────────────────────┐
│  Trading Fee                                    │
│       │                                         │
│       ├──► Liquidity Growth (deepens the AMM)   │
│       │                                         │
│       └──► LP Tokens minted to trader           │
│            (aligns trader incentives with       │
│             market growth)                      │
│                                                 │
│  Fee accumulation drives graduation:            │
│  Threshold = bBase × ln(2) × multiplier         │
└─────────────────────────────────────────────────┘

Post-Graduation (1% fee on orderbook trades):
┌─────────────────────────────────────────────────┐
│  Trading Fee                                    │
│       │                                         │
│       ├──► 50%  bBase Growth (AMM liquidity)    │
│       │                                         │
│       ├──► 30%  LP Yield Pool (creator + LPs)   │
│       │                                         │
│       └──► 20%  Protocol Treasury               │
└─────────────────────────────────────────────────┘
```

The pre-graduation fee model is non-extractive: fees convert directly into
deeper liquidity and LP token issuance. This bootstraps market depth while
rewarding early participants with ownership.

#### (c) Income Distribution

Creators manage the split of income between channels and liquidity providers:

- **LP Token Holders** receive yield from the LP Yield Pool (30% of post-grad fees).
- **Creator** holds initial LP tokens from deposit — their income is proportional
  to their LP share.
- **Protocol Treasury** receives 20% of post-grad fees for protocol development
  and maintenance.
- **Fee parameters** (`preGradFeeBps`, `postGradFeeBps`, distribution ratios)
  are configurable by the protocol owner, allowing adjustment as the ecosystem
  matures.

LP Token redemption value:

```
Floor Value = (Total Cash − Max AMM Liability) / Total LP Supply
```

LP tokens are ERC20 — transferable and composable. Creators can sell, stake,
or use them in DeFi protocols, creating secondary markets for market ownership.

#### (d) Data and Analytics

Creators leverage data services to optimize market parameters:

- **Market Sizing**: Historical volume data informs initial liquidity settings.
- **Pricing Signals**: Real-time orderbook depth and AMM price curves guide
  liquidity provision strategy.
- **Fee Optimization**: Analytics on fee sensitivity help tune fee parameters
  for maximum volume × fee revenue.
- **Graduation Tracking**: Progress toward graduation threshold informs
  whether to increase liquidity or adjust strategy.
- **Settlement Analytics**: Resolution accuracy and speed metrics help
  creators evaluate and select adjudicators.

---

## Revenue Architecture

```
                        ┌──────────────┐
                        │   CREATOR    │
                        │   (Layer 3)  │
                        └──────┬───────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
                 ▼             ▼             ▼
          ┌──────────┐  ┌───────────┐  ┌──────────────┐
          │  USDC    │  │Adjudicator│  │  Market      │
          │  Deposit │  │   Fee     │  │  Parameters  │
          └────┬─────┘  └────┬──────┘  └──────┬───────┘
               │             │                │
               ▼             ▼                ▼
      ┌────────────┐  ┌───────────┐  ┌──────────────┐
      │ Launchpad  │  │Adjudicator│  │  Fee Config  │
      │  Engine    │  │ (Layer 2) │  │  (bps, split)│
      └─────┬──────┘  └───────────┘  └──────┬───────┘
            │                               │
            │         TRADING ACTIVITY      │
            │         ═══════════════       │
            │                │              │
            ▼                ▼              │
     ┌────────────┐   ┌───────────┐         │
     │ AMMEngine  │   │ SoothBook │◄────────┘
     │ (pre-grad) │   │(post-grad)│
     └─────┬──────┘   └─────┬─────┘
           │                 │
           └────────┬────────┘
                    │
              Trading Fees
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
  ┌──────────┐ ┌─────────┐ ┌──────────┐
  │ Liquidity│ │LP Yield │ │ Protocol │
  │  Growth  │ │  Pool   │ │ Treasury │
  │  (50%)   │ │ (30%)   │ │  (20%)   │
  └──────────┘ └────┬────┘ └──────────┘
                    │
                    ▼
              LP Token Holders
              (Creator + LPs)
```

### Revenue Sustainability

The model creates three reinforcing loops:

1. **Liquidity Loop** — 50% of post-grad fees deepen AMM liquidity,
   reducing slippage, attracting more volume, generating more fees.

2. **Creator Loop** — 30% of post-grad fees flow to LP holders.
   Profitable markets attract more creators, expanding market coverage.

3. **Protocol Loop** — 20% of post-grad fees fund protocol development,
   improving infrastructure, enabling more creators and markets.

---

## Licensing Summary

| Layer   | Component          | License                | Rationale                                    |
|---------|--------------------|------------------------|----------------------------------------------|
| Layer 1 | Core Protocol      | Open Source (Copyleft) | Auditability, trust, ecosystem integrity     |
| Layer 2 | Adjudicator Layer  | Business Source (BSL)  | Sustainable ops, transparent code             |
| Layer 3 | Creator Tools      | Varies by operator     | Business flexibility for market operators     |

**Copyleft** ensures that anyone who modifies the core protocol must
distribute their changes under the same license. This prevents proprietary
forks from fragmenting the ecosystem while allowing unrestricted use and
deployment of the unmodified protocol.

**Business Source License** keeps adjudicator implementations transparent
and auditable while enabling the teams that build and operate resolution
infrastructure to sustain their operations commercially.

---

## Contract Mapping

For reference, here is how the three-layer model maps to the V12 codebase:

| Layer   | Concept              | Contract(s)                                     |
|---------|----------------------|-------------------------------------------------|
| Layer 1 | Launchpad            | `LaunchpadEngine.sol`, `LaunchpadLPToken.sol`   |
| Layer 1 | AMM                  | `AMMEngine.sol`, `libraries/LMSRMath.sol`       |
| Layer 1 | SoothBook            | `SoothBook.sol`, `libraries/TickBitmap.sol`     |
| Layer 1 | Governance           | `ProtocolConfig.sol`                            |
| Layer 1 | Market Lifecycle     | `TruthMarket.sol`                               |
| Layer 1 | Token Operations     | `Collateralizer.sol`, `OutcomeToken.sol`        |
| Layer 2 | Adjudicator Interface| `interfaces/IAdjudicator.sol`                   |
| Layer 2 | TEE Adjudicator      | `ValidatedAdjudicator.sol`                      |
| Layer 2 | (Future) Oracle      | TBD — Chainlink / Pyth integration              |
| Layer 2 | (Future) DAO         | TBD — Governance vote resolver                  |
| Layer 3 | Market Creation      | `LaunchpadEngine.createMarket()`                |
| Layer 3 | Fee Configuration    | `LaunchpadEngine.setPreGradFee()`, `setPostGradFee()` |
| Layer 3 | LP Economics         | `LaunchpadLPToken`, `LaunchpadEngine.redeemLP()`|

All contracts are located in `packages/contracts-core/src/`.

---

## Summary

This unified three-layer structure ensures that:

1. **The Core Protocol** remains open, auditable, and forkable — building trust
   and enabling permissionless innovation.

2. **The Adjudicator Layer** provides specialized, monetizable truth-resolution
   services — funding the operational costs of reliable settlement.

3. **The Creator Layer** empowers market operators to build sustainable businesses —
   from professional operators running market series to individuals creating
   single prediction markets.

Together, the layers create an ecosystem where markets generate sustainable
revenue while attracting the user base necessary for long-term operational success.
