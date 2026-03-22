# Layer 2: Adjudicator Specification

> Sooth Protocol — Adjudicator Layer
> Version: 1.0.0
> Date: 2026-03-23
> License: Business Source License 1.1 (BSL-1.1)
>
> **Canonical source for concrete implementations**: [soothsayer](https://github.com/Tora-Build/soothsayer) repo.
> This document covers the **sooth-core side** of the adjudicator interface plus the architectural design.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Layer Architecture](#2-layer-architecture)
3. [IAdjudicator — Canonical Interface](#3-iadjudicator--canonical-interface)
4. [AdjudicatorBase — Foundation Contract](#4-adjudicatorbase--foundation-contract)
5. [Adjudicator Type Taxonomy](#5-adjudicator-type-taxonomy)
6. [Market Creation & Adjudicator Binding](#6-market-creation--adjudicator-binding)
7. [AdjudicatorRegistry — Operator Whitelists](#7-adjudicatorregistry--operator-whitelists)
8. [Resolution Lifecycle](#8-resolution-lifecycle)
9. [Guardian Protocol (Dispute Flow)](#9-guardian-protocol-dispute-flow)
10. [Retroactive Settlement (T*)](#10-retroactive-settlement-t)
11. [Reputation System](#11-reputation-system)
12. [Building a Custom Adjudicator](#12-building-a-custom-adjudicator)
13. [Licensing & Third-Party Development](#13-licensing--third-party-development)
14. [Security Considerations](#14-security-considerations)

---

## 1. Overview

### What is Layer 2?

The Sooth Protocol separates concerns into two layers:

| Layer | Responsibility | Contracts |
|-------|---------------|-----------|
| **Layer 1** (Settlement) | Market lifecycle, trading, LP economics | TruthMarket, LaunchpadEngine, AMMEngine, FeeRouter, SoothBook |
| **Layer 2** (Adjudication) | Truth determination, outcome resolution, guardian oversight | AdjudicatorBase, AdjudicatorRegistry (in sooth-core); concrete impls in soothsayer |

Layer 1 is the **execution layer** — it handles market creation, trading, fee distribution, collateral management, and settlement state transitions. Layer 1 is protocol-controlled and immutable per deployment.

Layer 2 is the **truth layer** — it determines what actually happened in the real world and communicates that outcome to Layer 1. Layer 2 is **modular, extensible, and permissionless**. Anyone can build a new adjudicator type by inheriting `AdjudicatorBase`.

### Design Principles

1. **Separation of Concerns**: Layer 1 never determines truth. Layer 2 never manages funds.
2. **Modularity**: Adjudicators are interchangeable. Markets choose their adjudicator at creation time.
3. **Extensibility**: New adjudicator types can be developed independently under BSL license.
4. **Progressive Trust**: Markets start with guardian oversight and earn reputation over time.
5. **Pull-Based**: Layer 1 queries TruthMarket state; adjudicators push state transitions to TruthMarket.

### Key Invariant

> **The adjudicator is the ONLY address that can call `resolve()`, `attest()`, and `settle()` on a TruthMarket.** Guardians dispute via the adjudicator (not TruthMarket directly), and anyone can `invalidateAfterDeadline()` for expired markets.

### Repository Split

| What | Where | License |
|------|-------|---------|
| `IAdjudicator.sol`, `AdjudicatorBase.sol`, `AdjudicatorRegistry.sol` | `sooth-core/src/` | MIT |
| ManualAdjudicator, ZkOracleAdjudicator, ZkRuleAdjudicator, UmaAdjudicator | `soothsayer/src/` | BSL-1.1 |
| Off-chain services, keepers, resolvers | `soothsayer/offchain/`, `soothsayer/apps/` | BSL-1.1 |

---

## 2. Layer Architecture

```
                         ┌─────────────────────────────┐
                         │    LAYER 2: TRUTH            │
                         │  (Adjudicator Domain)        │
                         │                              │
                         │  ┌─────────────────────────┐ │
                         │  │  AdjudicatorBase         │ │
                         │  │  (abstract, sooth-core)  │ │
                         │  │  - 6-phase state machine │ │
                         │  │  - guardian management   │ │
                         │  │  - configureMarket()     │ │
                         │  │  - resolve() / attest()  │ │
                         │  │  - settle() / dispute()  │ │
                         │  │  - hooks for overriding  │ │
                         │  └─────┬────────────────────┘ │
                         │        │ inherits              │
                         │  ┌─────┴──────────────────┐   │
                         │  │   Concrete Types        │   │
                         │  │   (soothsayer repo)     │   │
                         │  │                         │   │
                         │  │ ┌─────────────────────┐ │   │    ┌──────────────────┐
                         │  │ │ZkOracleAdjudicator  │─┼───┼───►│Primus (zkTLS)    │
                         │  │ │(type: "zk-oracle")  │ │   │    └──────────────────┘
                         │  │ └─────────────────────┘ │   │
                         │  │ ┌─────────────────────┐ │   │    ┌──────────────────┐
                         │  │ │ZkRuleAdjudicator    │─┼───┼───►│Brevis (ZK proof) │
                         │  │ │(type: "zk-rule")    │ │   │    └──────────────────┘
                         │  │ └─────────────────────┘ │   │
                         │  │ ┌─────────────────────┐ │   │    ┌──────────────────┐
                         │  │ │UmaAdjudicator       │─┼───┼───►│UMA OOv3          │
                         │  │ │(type: "uma")        │ │   │    └──────────────────┘
                         │  │ └─────────────────────┘ │   │
                         │  │ ┌─────────────────────┐ │   │
                         │  │ │ManualAdjudicator    │ │   │
                         │  │ │(type: "manual")     │ │   │
                         │  │ └─────────────────────┘ │   │
                         │  │ ┌─────────────────────┐ │   │
                         │  │ │Future: Agent, ID    │ │   │
                         │  │ │Committee, Optimistic│ │   │
                         │  │ └─────────────────────┘ │   │
                         │  └─────────────────────────┘   │
                         │                                │
                         │  ┌─────────────────────────┐   │
                         │  │ AdjudicatorRegistry     │   │
                         │  │ (optional whitelist)     │   │
                         │  └─────────────────────────┘   │
                         └──────────────┬─────────────────┘
                                        │
                       configureMarket() / resolve() / attest() / settle()
                                        │
                                        ▼
                         ┌─────────────────────────┐
                         │    LAYER 1: SETTLEMENT   │
                         │  (Protocol Domain)       │
                         │                          │
                         │  ┌───────────────────┐   │
                         │  │   TruthMarket     │   │
                         │  │ LIVE→RESOLVING→   │   │
                         │  │ ATTESTED→SETTLED  │   │
                         │  └───────────────────┘   │
                         └─────────────────────────┘
```

---

## 3. IAdjudicator — Canonical Interface

The `IAdjudicator` interface lives in `sooth-core/src/interfaces/IAdjudicator.sol` and defines the contract between Layer 1 and Layer 2.

### MarketState Struct

```solidity
struct MarketState {
    uint8 phase;        // 0=IDLE, 1=ACTIVE, 2=RESOLVED, 3=ATTESTED, 4=SETTLED, 5=DISPUTED
    uint8 outcome;      // 0=NO, 1=YES, 2=INVALID
    uint48 vetoPeriod;  // seconds guardians have to dispute
    uint64 tStar;       // retroactive truth-time (0 if N/A)
    uint64 deadline;    // resolution deadline (0 = infinite)
    uint64 vetoEndsAt;  // timestamp when veto window closes
    address resolver;   // per-market resolver address
    bytes32 dataHash;   // hash of supporting data
}
```

### Lifecycle Functions

```solidity
/// Called by LaunchpadEngine during market creation.
/// config = abi.encode(resolver, deadline, vetoPeriod, typeConfig)
function configureMarket(address market, bytes calldata config) external;

/// Resolver proposes outcome + data hash. ACTIVE → RESOLVED.
function resolve(address market, uint8 outcome, bytes32 dataHash) external;

/// Submit attestation proof. RESOLVED → ATTESTED when fully attested.
function attest(address market, bytes calldata proof) external;

/// Finalize after veto window. RESOLVED|ATTESTED → SETTLED.
function settle(address market) external;

/// Guardian disputes outcome during veto window. RESOLVED|ATTESTED → DISPUTED.
function dispute(address market) external;

/// Force-invalidate after deadline. Permissionless. Outcome = INVALID.
function invalidateAfterDeadline(address market) external;

/// Post T*-adjusted settlement Merkle root to AMMEngine.
function postSettlementRoot(address market, bytes32 merkleRoot) external;
```

### Query Functions

```solidity
function canSettle(address market) external view returns (bool);
function getPhase(address market) external view returns (uint8);
function getOutcome(address market) external view returns (uint8);
function getMarketState(address market) external view returns (MarketState memory);
function adjudicatorType() external view returns (string memory);
function supportsTStar() external view returns (bool);
```

### Events

```solidity
event MarketConfigured(address indexed market, address indexed resolver, uint64 deadline);
event OutcomeProposed(address indexed market, uint8 outcome, bytes32 dataHash);
event AttestationVerified(address indexed market, uint256 index);
event MarketSettled(address indexed market, uint8 outcome, uint64 tStar);
event MarketDisputed(address indexed market, uint8 previousOutcome);
```

### Errors

```solidity
error InvalidPhase(uint8 expected, uint8 actual);
error NotResolver();
error NotLaunchpadEngine();
error DeadlinePassed();
error DeadlineNotPassed();
error NoDeadline();
error VetoWindowActive();
error NotGuardian();
error VetoWindowClosed();
error NoTStar();
```

---

## 4. AdjudicatorBase — Foundation Contract

`AdjudicatorBase` lives in `sooth-core/src/adjudicators/AdjudicatorBase.sol`. All concrete adjudicators inherit from it.

### Constructor

```solidity
constructor(address _owner, address _launchpadEngine, address _ammEngine) Ownable(_owner)
```

- `_launchpadEngine`: used to gate `configureMarket()` (only LaunchpadEngine can call it)
- `_ammEngine`: used for `postSettlementRoot()` forwarding

### Phase Constants

```solidity
uint8 public constant PHASE_IDLE      = 0;  // Not yet configured
uint8 public constant PHASE_ACTIVE    = 1;  // Configured, awaiting resolution
uint8 public constant PHASE_RESOLVED  = 2;  // Outcome proposed by resolver
uint8 public constant PHASE_ATTESTED  = 3;  // Attestation verified
uint8 public constant PHASE_SETTLED   = 4;  // Terminal — market finalized
uint8 public constant PHASE_DISPUTED  = 5;  // Guardian disputed, awaiting re-resolution
```

### Hooks (Override in Concrete Implementations)

```solidity
// Called during configureMarket — decode type-specific config
function _onConfigure(address market, bytes memory typeConfig) internal virtual;

// Called during resolve — custom logic before TruthMarket.resolve()
function _onResolve(address market, uint8 outcome, bytes32 dataHash) internal virtual;

// Called during attest — verify the proof (MUST override if _requiresAttestation)
function _verifyAttestation(address market, bytes calldata proof) internal virtual;

// Check if all required attestations are in
function _isFullyAttested(address market) internal view virtual returns (bool);

// Whether this adjudicator type requires the attest step
function _requiresAttestation() internal pure virtual returns (bool);

// Called before settle
function _beforeSettle(address market) internal virtual;

// Called when guardian disputes
function _onDispute(address market) internal virtual;
```

### Settlement Target Overrides

```solidity
// Override these to change how the adjudicator talks to TruthMarket
function _resolveMarket(address market, uint8 outcome, uint64 tStar) internal virtual;
function _attestMarket(address market) internal virtual;
function _settleMarket(address market, uint8 outcome, uint64 tStar) internal virtual;
```

### Guardian Management

```solidity
function approveGuardian(address guardian) external onlyOwner;
function revokeGuardian(address guardian) external onlyOwner;
function batchUpdateGuardians(address[] calldata toApprove, address[] calldata toRevoke) external onlyOwner;
function isGuardian(address account) external view returns (bool);
```

---

## 5. Adjudicator Type Taxonomy

All types implement `IAdjudicator`. Concrete implementations live in the **soothsayer** repo.

| Type | ID | Trust Model | Partner | Attestation | T* | Status |
|------|----|-------------|---------|-------------|-----|--------|
| **ZK Rule** | `zk-rule` | Trustless (ZK proof) | Brevis | Auto (callback) | Yes | Implemented |
| **ZK Oracle** | `zk-oracle` | Trustless (zkTLS) | Primus | Required (multi-source) | No | Implemented |
| **UMA** | `uma` | Economic Security | UMA OOv3 | Required (bond/dispute) | No | Implemented |
| **Manual** | `manual` | Trusted Resolver | — | No-op | No | Implemented |
| **Agent** | `agent` | Hardware Trust + AI | Moltbook | Required (ERC-8004/TEE) | No | Planned |
| **Onchain-ID Committee** | `id-committee` | Reputation Based | Lens | Required (M-of-N sigs) | No | Planned |
| **Optimistic** | `optimistic` | Economic Security | — | Implicit (dispute window) | No | Planned |

### Universal Lifecycle

All types follow the same phase pattern:

```
configureMarket() → resolve() → attest() [optional] → settle()
```

| Step | Required? | Description |
|------|-----------|-------------|
| `configureMarket()` | Yes | Decode config, validate, store per-market params |
| `resolve()` | Yes | Propose outcome + data hash |
| `attest()` | Type-dependent | Secondary verification (zkTLS, ZK proof, bond, etc.) |
| `settle()` | Yes | Finalize → TruthMarket.settle() |
| `invalidateAfterDeadline()` | Fallback | Force INVALID if deadline passes without resolution |

### Attestation Behavior by Type

| Type | `attest()` Behavior |
|------|---------------------|
| ZK Rule | Brevis callback provides proof automatically; no manual attest needed |
| ZK Oracle | Requires zkTLS attestation proof submission (multi-source supported) |
| UMA | Assertion + dispute window (bond-based); UMA callback handles it |
| Manual | No-op; trusted resolver |
| Agent | TEE/ERC-8004 attestation required |
| ID Committee | Requires M-of-N identity-verified signatures |
| Optimistic | Dispute window; attest = no dispute received |

> For detailed specs per type, see: `soothsayer/docs/spec/ZK_RULE_SPEC.md`, `ZK_ORACLE_SPEC.md`, `ADJUDICATOR_TYPES.md`

---

## 6. Market Creation & Adjudicator Binding

When a creator calls `LaunchpadEngine.createMarket()`, they specify an adjudicator address. LaunchpadEngine calls `adjudicator.configureMarket(market, config)` during creation. This address is **permanently bound** — it cannot be changed.

### `configureMarket` Call Chain

```
Creator → LaunchpadEngine.createMarket(question, startTime, deadline, adjudicator, bBase, initialProb)
  │
  ├── Deploy TruthMarket (CREATE2 clone)
  ├── Initialize AMMEngine
  └── adjudicator.configureMarket(market, abi.encode(resolver, deadline, vetoPeriod, typeConfig))
       │
       ├── AdjudicatorBase: validates phase=IDLE, stores resolver/deadline/vetoPeriod
       └── _onConfigure(market, typeConfig): type-specific validation and storage
           └── If incompatible: REVERTS (market creation fails)
```

### Config Encoding

```solidity
bytes memory config = abi.encode(
    resolver,       // address — who can propose outcomes for this market
    deadline,       // uint64 — resolution deadline (0 = infinite)
    vetoPeriod,     // uint48 — guardian veto window in seconds
    typeConfig      // bytes — type-specific config (urlHashes, vkHash, bond, etc.)
);
```

### Two Modes of Adjudicator Selection

#### Mode 1: Permissionless (registry = address(0))

```
LaunchpadEngine constructor: adjudicatorRegistry = address(0)
→ Creator can pass ANY address as adjudicator. No validation.
```

#### Mode 2: Registry-Gated (registry = AdjudicatorRegistry)

```
LaunchpadEngine constructor: adjudicatorRegistry = 0x1234...
→ Creator MUST choose from approved adjudicators:
  require(IAdjudicatorRegistry(registry).isApproved(_adjudicator))
```

The registry address on LaunchpadEngine is **immutable** — set at construction, cannot be changed.

---

## 7. AdjudicatorRegistry — Operator Whitelists

Simple whitelist contract deployed by an operator:

```solidity
contract AdjudicatorRegistry is IAdjudicatorRegistry, Ownable {
    mapping(address => bool) private _approved;

    function approve(address adjudicator) external onlyOwner;
    function revoke(address adjudicator) external onlyOwner;
    function batchUpdate(address[] calldata toApprove, address[] calldata toRevoke) external onlyOwner;
    function isApproved(address adjudicator) external view returns (bool);
}
```

---

## 8. Resolution Lifecycle

### Adjudicator Phase Machine (6 states)

```
                  ┌──────────┐
                  │   IDLE   │
                  └────┬─────┘
                       │ configureMarket()
                       │ [LaunchpadEngine only]
                       ▼
                  ┌──────────┐
         ┌───────│  ACTIVE  │◄───────────────────┐
         │       └────┬─────┘                     │
         │            │ resolve(outcome, dataHash) │
         │            │ [resolver only]            │
         │            ▼                            │
         │       ┌──────────┐                      │
         │       │ RESOLVED │──────┐               │
         │       └────┬─────┘      │               │
         │            │ attest()   │ dispute()     │
         │            │            │ [guardian]     │
         │            ▼            ▼               │
         │       ┌──────────┐ ┌──────────┐         │
         │       │ ATTESTED │ │DISPUTED  │─────────┘
         │       └────┬─────┘ └──────────┘
         │            │ settle()
         │            │ [after veto window]
         │            ▼
         │       ┌──────────┐
         │       │ SETTLED  │  ← Terminal
         │       └──────────┘
         │
         │  invalidateAfterDeadline()
         └──────────────────────────► SETTLED (INVALID)
```

### TruthMarket State Machine (Layer 1)

```
                  ┌──────────┐
                  │   LIVE   │◄─────────────────┐
                  └────┬─────┘                   │
                       │ resolve(outcome, tStar) │ veto()
                       │ [adjudicator only]      │ [adjudicator via dispute()]
                       ▼                         │
                  ┌───────────┐                  │
                  │ RESOLVING │──────────────────┘
                  └────┬──────┘
                       │ attest()
                       │ [adjudicator only]
                       ▼
                  ┌──────────┐
                  │ ATTESTED │
                  └────┬─────┘
                       │ settle()
                       │ [adjudicator only]
                       ▼
                  ┌──────────┐
                  │ SETTLED  │  ← Terminal (irreversible)
                  └──────────┘
```

### Resolution Stages

#### Stage 1: ACTIVE → RESOLVED (`resolve`)

The resolver proposes an outcome.

```solidity
// Adjudicator (internal):
st.phase = PHASE_RESOLVED;
st.outcome = outcome;
st.dataHash = dataHash;
st.vetoEndsAt = block.timestamp + vetoPeriod;

// → TruthMarket: LIVE → RESOLVING
ITruthMarket(market).resolve(outcome, tStar);
```

#### Stage 2: RESOLVED → ATTESTED (`attest`)

Type-specific proof verification. Skipped for types that don't require attestation.

```solidity
// Adjudicator (internal):
_verifyAttestation(market, proof);  // custom verification
if (_isFullyAttested(market)) {
    st.phase = PHASE_ATTESTED;
    // → TruthMarket: RESOLVING → ATTESTED
    ITruthMarket(market).attest();
}
```

#### Stage 3: ATTESTED → SETTLED (`settle`)

Finalizes the market. Anyone can call after veto window expires.

```solidity
// Adjudicator (internal):
require(block.timestamp >= st.vetoEndsAt, VetoWindowActive());
st.phase = PHASE_SETTLED;
// → TruthMarket: ATTESTED → SETTLED
ITruthMarket(market).settle();
```

#### Dispute: RESOLVED|ATTESTED → DISPUTED → ACTIVE

Guardian disputes via the adjudicator (not TruthMarket directly):

```solidity
// adjudicator.dispute(market) — called by guardian
require(_guardians[msg.sender], NotGuardian());
require(block.timestamp < st.vetoEndsAt, VetoWindowClosed());

st.phase = PHASE_DISPUTED;
st.outcome = 0;
st.tStar = 0;

// → TruthMarket: veto() → back to LIVE
ITruthMarket(market).veto();
```

After dispute, the resolver can re-resolve (phase goes DISPUTED → ACTIVE on the next resolve call).

#### Deadline Invalidation

Permissionless — anyone can call when deadline passes without settlement:

```solidity
// adjudicator.invalidateAfterDeadline(market)
require(block.timestamp > st.deadline, DeadlineNotPassed());
require(st.phase == PHASE_ACTIVE || st.phase == PHASE_RESOLVED || st.phase == PHASE_DISPUTED);

st.phase = PHASE_SETTLED;
st.outcome = OUTCOME_INVALID;
// → TruthMarket: resolve(INVALID, 0) → attest() → settle()
```

---

## 9. Guardian Protocol (Dispute Flow)

### Key Change from Previous Architecture

Guardians now call `dispute()` on the **adjudicator**, not `veto()` on TruthMarket directly. The adjudicator handles state management and then calls `TruthMarket.veto()` internally.

### Who Can Be a Guardian?

Guardians are addresses approved by the adjudicator owner via `approveGuardian()`. Typical entities:

| Entity | Role |
|--------|------|
| Protocol team multisig | Emergency override for critical markets |
| Independent validators | Third-party monitoring outcomes |
| Community DAOs | Decentralized oversight |
| Automated checker bots | Verify adjudicator outputs programmatically |

### Dispute Flow

```
1. Adjudicator resolves market → adjudicator phase = RESOLVED
2. Veto window opens (vetoEndsAt = now + vetoPeriod)
3. Guardian detects incorrect outcome
4. Guardian calls adjudicator.dispute(market)
5. Adjudicator: checks guardian whitelist, checks veto window still open
6. Adjudicator: phase = DISPUTED, clears outcome
7. Adjudicator: calls TruthMarket.veto() → TruthMarket back to LIVE
8. Resolver can re-resolve with correct outcome
```

### Veto Window

The veto window is configured per-market via `vetoPeriod` in `configureMarket()`:

- `vetoPeriod = 0`: No veto window (settle immediately after resolve/attest)
- `vetoPeriod > 0`: Guardians have this many seconds to dispute
- `settle()` reverts with `VetoWindowActive()` until `block.timestamp >= vetoEndsAt`

---

## 10. Retroactive Settlement (T*)

Some adjudicator types report a `tStar` — the timestamp when the outcome became true in the real world. This enables retroactive settlement where trades made after T* are unwound.

### Supported Types

| Type | supportsTStar() | How T* is determined |
|------|-----------------|---------------------|
| ZK Rule | `true` | ZK proof of on-chain event timestamp |
| All others | `false` | Standard settlement (no retroactive adjustment) |

### Settlement Root Flow

```
1. Adjudicator settles market with tStar > 0
2. Off-chain computation: recompute all balances as of tStar
3. Generate Merkle tree of (user, payout) pairs
4. Resolver calls adjudicator.postSettlementRoot(market, merkleRoot)
5. Adjudicator forwards to AMMEngine.postSettlementRoot(market, merkleRoot)
6. Users claim via Merkle proof
```

---

## 11. Reputation System

### On-Chain Signals

| Signal | Source | Meaning |
|--------|--------|---------|
| `MarketConfigured` | AdjudicatorBase | Market bound to this adjudicator |
| `OutcomeProposed` | AdjudicatorBase | Resolution proposed |
| `MarketSettled` | AdjudicatorBase | Settlement finalized |
| `MarketDisputed` | AdjudicatorBase | Guardian overrode the adjudicator |
| `MarketInvalidated` | TruthMarket | Deadline passed with no resolution |

### Metrics

| Metric | Formula | Meaning |
|--------|---------|---------|
| Resolution Rate | settled / configured | Reliability |
| Dispute Rate | disputed / resolved | Accuracy |
| Invalidation Rate | invalidated / finite-deadline markets | Responsiveness |
| Avg Resolution Time | avg(settled_ts - configured_ts) | Speed |

---

## 12. Building a Custom Adjudicator

### Step 1: Inherit AdjudicatorBase

```solidity
// SPDX-License-Identifier: BSL-1.1
pragma solidity ^0.8.33;

import {AdjudicatorBase} from "@sooth-core/adjudicators/AdjudicatorBase.sol";

contract MyAdjudicator is AdjudicatorBase {
    constructor(address _owner, address _launchpadEngine, address _ammEngine)
        AdjudicatorBase(_owner, _launchpadEngine, _ammEngine)
    {}

    function adjudicatorType() external pure override returns (string memory) {
        return "my-custom-type";
    }
}
```

### Step 2: Override Hooks

```solidity
contract MyAdjudicator is AdjudicatorBase {
    // ...

    /// Decode type-specific config during market creation
    function _onConfigure(address market, bytes memory typeConfig) internal override {
        (bytes32 feedId, uint64 maxAge) = abi.decode(typeConfig, (bytes32, uint64));
        // Store per-market config...
    }

    /// If your type requires attestation proof
    function _verifyAttestation(address market, bytes calldata proof) internal override {
        // Verify the proof...
    }

    function _requiresAttestation() internal pure override returns (bool) {
        return true; // or false for trusted-resolver types
    }

    function _isFullyAttested(address market) internal view override returns (bool) {
        // Return true when all required proofs are submitted
        return true;
    }
}
```

### Step 3: Deploy & Register

```bash
# Deploy
forge script DeployMyAdjudicator.s.sol --broadcast

# Approve guardians
cast send $ADJUDICATOR "approveGuardian(address)" $GUARDIAN

# Register in AdjudicatorRegistry (if registry-gated)
cast send $REGISTRY "approve(address)" $ADJUDICATOR
```

### Testing Checklist

- [ ] `configureMarket()` accepts valid config and reverts on invalid
- [ ] `resolve()` only callable by resolver, transitions to RESOLVED
- [ ] `attest()` verifies proofs correctly (if applicable)
- [ ] `settle()` only succeeds after veto window
- [ ] `dispute()` only callable by guardian during veto window
- [ ] `invalidateAfterDeadline()` works when deadline passes
- [ ] Multiple markets can use the same adjudicator
- [ ] `adjudicatorType()` returns correct string
- [ ] `supportsTStar()` returns correct value

---

## 13. Licensing & Third-Party Development

### License: BSL-1.1

- **sooth-core** base contracts (`AdjudicatorBase`, `IAdjudicator`): MIT
- **soothsayer** concrete implementations: BSL-1.1

### What Third Parties Can Do

**Without license:**
- Fork and study the code
- Build custom adjudicators inheriting `AdjudicatorBase`
- Deploy to testnets
- Contribute upstream

**With license (from the adjudicator developer):**
- Deploy to production for commercial use
- Offer adjudicator-as-a-service
- Deploy and operate registries

---

## 14. Security Considerations

### Adjudicator Risks

| Risk | Mitigation |
|------|-----------|
| Malicious adjudicator resolves incorrectly | Guardian dispute; reputation system; registry curation |
| Adjudicator key compromise | Guardian dispute; multisig resolver addresses |
| Adjudicator goes offline (no resolution) | `invalidateAfterDeadline()` for finite-deadline markets |
| Resolver front-runs market resolution | MEV protection; commit-reveal schemes |

### Guardian Risks

| Risk | Mitigation |
|------|-----------|
| Guardian collusion with resolver | Multiple independent guardians; reputation tracking |
| Guardian griefing (disputing correct outcomes) | Guardian revocation by owner; reputation penalties |
| All guardians compromised | Owner can revoke all and appoint new guardians |

### Per-Type Threat Models

| Type | Trust Assumption | Attack Vector | Mitigation |
|------|-----------------|---------------|------------|
| ZK Rule | ZK proof validity | Compromised Brevis prover | Registered vkHash whitelist |
| ZK Oracle | TLS connection integrity | Compromised endpoint | URL hash verification + zkTLS proof |
| UMA | Economic security holds | Under-collateralized dispute | Bond mechanism |
| Manual | Resolver is honest | Resolver lies | Reputation + guardian |

---

## Appendix: Contract Reference

### Contracts in sooth-core

| Contract | Location | Description |
|----------|----------|-------------|
| `AdjudicatorBase.sol` | `src/adjudicators/AdjudicatorBase.sol` | Abstract base with 6-phase state machine, guardian management, hooks |
| `AdjudicatorRegistry.sol` | `src/adjudicators/AdjudicatorRegistry.sol` | Operator whitelist |
| `IAdjudicator.sol` | `src/interfaces/IAdjudicator.sol` | Full interface with MarketState struct |
| `IAdjudicatorRegistry.sol` | `src/interfaces/IAdjudicatorRegistry.sol` | Registry interface |

### Contracts in soothsayer

| Contract | Type ID | Description |
|----------|---------|-------------|
| `ManualAdjudicator.sol` | `manual` | Simplest — trusted resolver, no attestation |
| `ZkOracleAdjudicator.sol` | `zk-oracle` | zkTLS proof of Web2 API data (Primus) |
| `ZkRuleAdjudicator.sol` | `zk-rule` | ZK proof of on-chain conditions (Brevis) |
| `UmaAdjudicator.sol` | `uma` | Optimistic oracle via UMA OOv3 |

### Key Function Selectors

| Function | Called By | On |
|----------|----------|-----|
| `configureMarket(address,bytes)` | LaunchpadEngine | Adjudicator |
| `resolve(address,uint8,bytes32)` | Resolver | Adjudicator |
| `attest(address,bytes)` | Varies | Adjudicator |
| `settle(address)` | Anyone (after veto) | Adjudicator |
| `dispute(address)` | Guardian | Adjudicator |
| `invalidateAfterDeadline(address)` | Anyone | Adjudicator |
| `resolve(uint8,uint64)` | Adjudicator | TruthMarket |
| `attest()` | Adjudicator | TruthMarket |
| `settle()` | Adjudicator | TruthMarket |
| `veto()` | Adjudicator (via dispute) | TruthMarket |

---

> **Version**: 1.0.0 | **Spec**: Layer 2 Adjudicator | **Updated**: 2026-03-23
> **Layer 1 Dependency**: TruthMarket lifecycle (LIVE → RESOLVING → ATTESTED → SETTLED)
> **Adjudicator Phase Machine**: IDLE → ACTIVE → RESOLVED → ATTESTED → SETTLED (with DISPUTED branch)
> **Canonical Implementations**: [soothsayer](https://github.com/Tora-Build/soothsayer)
