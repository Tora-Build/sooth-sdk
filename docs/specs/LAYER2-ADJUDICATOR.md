# Layer 2: Adjudicator Specification

> Sooth Protocol — Adjudicator Layer
> Version: 0.1.1
> Date: 2026-03-23
> License: Business Source License 1.1 (BSL-1.1)
>
> **Note (2026-03-23):** Concrete adjudicator implementations (ZkTLSAdjudicator, ValidatedAdjudicator) were removed from `sooth-core` in the 2026-03-19 cleanup. Only the abstract base contracts (`AdjudicatorBase`, `Adjudicator`) and `AdjudicatorRegistry` remain in core. Concrete implementations are expected to live in external repos. The type taxonomy below describes the extensible design, not current deployment state.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Layer Architecture](#2-layer-architecture)
3. [AdjudicatorBase — Foundation Contract](#3-adjudicatorbase--foundation-contract)
4. [Adjudicator Type Taxonomy](#4-adjudicator-type-taxonomy)
5. [Market Creation & Adjudicator Binding](#5-market-creation--adjudicator-binding)
6. [AdjudicatorRegistry — Operator Whitelists](#6-adjudicatorregistry--operator-whitelists)
7. [Resolution Lifecycle](#7-resolution-lifecycle)
8. [Guardian Protocol](#8-guardian-protocol)
9. [Reputation System](#9-reputation-system)
10. [Licensing & Third-Party Development](#10-licensing--third-party-development)
11. [Building a Custom Adjudicator](#11-building-a-custom-adjudicator)
12. [Security Considerations](#12-security-considerations)
13. [Appendix: Contract Reference](#appendix-contract-reference)

---

## 1. Overview

### What is Layer 2?

The Sooth Protocol separates concerns into two layers:

| Layer | Responsibility | Contracts |
|-------|---------------|-----------|
| **Layer 1** (Settlement) | Market lifecycle, trading, LP economics | TruthMarket, LaunchpadEngine, AMMEngine, FeeRouter, SoothBook |
| **Layer 2** (Adjudication) | Truth determination, outcome resolution, guardian oversight | AdjudicatorBase, Adjudicator (abstract), AdjudicatorRegistry |

Layer 1 is the **execution layer** — it handles market creation, trading, fee distribution, collateral management, and settlement state transitions. Layer 1 is protocol-controlled and immutable per deployment.

Layer 2 is the **truth layer** — it determines what actually happened in the real world and communicates that outcome to Layer 1. Layer 2 is **modular, extensible, and permissionless**. Anyone can build a new adjudicator type, and operators can deploy registries to curate trusted adjudicators for their instances.

### Design Principles

1. **Separation of Concerns**: Layer 1 never determines truth. Layer 2 never manages funds.
2. **Modularity**: Adjudicators are interchangeable. Markets choose their adjudicator at creation time.
3. **Extensibility**: New adjudicator types can be developed independently under BSL license.
4. **Progressive Trust**: Markets start with guardian oversight and earn reputation over time.
5. **Pull-Based**: Layer 1 queries TruthMarket state; adjudicators push state transitions to TruthMarket.

### Key Invariant

> **The adjudicator is the ONLY address that can call `resolve()`, `verifyAttestation()`, and `settle()` on a TruthMarket.** Guardians can veto (RESOLVED → LIVE), and anyone can `invalidate()` expired markets, but truth determination is exclusively the adjudicator's responsibility.

---

## 2. Layer Architecture

```
                         ┌─────────────────────────┐
                         │    LAYER 2: TRUTH       │
                         │  (Adjudicator Domain)   │
                         │                         │
                         │  ┌───────────────────┐  │
                         │  │  AdjudicatorBase  │  │
                         │  │  (abstract)       │  │
                         │  │  - guardian mgmt  │  │
                         │  │  - resolve()      │  │
                         │  │  - verifyAttest() │  │
                         │  │  - settle()       │  │
                         │  └─────┬─────────────┘  │
                         │        │ inherits       │
                         │  ┌─────┴──────────────┐ │
                         │  │   Concrete Types   │ │
                         │  │                    │ │
                         │  │ ┌─────────────────┐│ │
                         │  │ │ZkTLSAdjudicator ││ │    ┌──────────────────┐
                         │  │ │(Primus/ZK proof)│┼─┼───►│ZK Verifier       │
                         │  │ └─────────────────┘│ │    └──────────────────┘
                         │  │ ┌─────────────────┐│ │
                         │  │ │TEEAdjudicator   ││ │    ┌──────────────────┐
                         │  │ │(secure enclave) │┼─┼───►│Attestation Svc   │
                         │  │ └─────────────────┘│ │    └──────────────────┘
                         │  │ ┌─────────────────┐│ │
                         │  │ │OracleAdjudicator││ │    ┌──────────────────┐
                         │  │ │(Chainlink/API3) │┼─┼───►│Oracle Network    │
                         │  │ └─────────────────┘│ │    └──────────────────┘
                         │  │ ┌─────────────────┐│ │
                         │  │ │DAOAdjudicator   ││ │    ┌──────────────────┐
                         │  │ │(governance vote)│┼─┼───►│Governor Contract │
                         │  │ └─────────────────┘│ │    └──────────────────┘
                         │  │ ┌─────────────────┐│ │
                         │  │ │ManualAdj.       ││ │
                         │  │ │(EOA/multisig)   ││ │
                         │  │ └─────────────────┘│ │
                         │  └────────────────────┘ │
                         │                         │
                         │  ┌─────────────────────┐│
                         │  │ AdjudicatorRegistry ││
                         │  │ (optional whitelist)││
                         │  └─────────────────────┘│
                         └──────────────┬──────────┘
                                        │
                       resolve() / verifyAttestation() / settle()
                                        │
                                        ▼
                         ┌─────────────────────────┐
                         │    LAYER 1: SETTLEMENT  │
                         │  (Protocol Domain)      │
                         │                         │
                         │  ┌───────────────────┐  │
                         │  │   TruthMarket     │  │
                         │  │ LIVE→RESOLVING→   │  │
                         │  │ RESOLVED→SETTLED  │  │
                         │  └───────┬───────────┘  │
                         │          │              │
                         │  ┌───────┴───────────┐  │
                         │  │  Execution Venues │  │
                         │  │  AMMEngine        │  │
                         │  │  SoothBook        │  │
                         │  │  MatchingEngine   │  │
                         │  └───────────────────┘  │
                         └─────────────────────────┘
```

### Communication Protocol

Layer 2 → Layer 1 communication is **direct function calls** on TruthMarket:

```
Adjudicator ──► TruthMarket.resolve(outcome, tStar)       → LIVE → RESOLVING
Adjudicator ──► TruthMarket.verifyAttestation(attestation) → RESOLVING → RESOLVED
Adjudicator ──► TruthMarket.settle()                       → RESOLVED → SETTLED
Guardian    ──► TruthMarket.veto()                         → RESOLVED → LIVE
```

Layer 1 → Layer 2 communication is **view calls** for guardian checks:

```
TruthMarket.veto() ──► AdjudicatorBase(adjudicator).isGuardian(msg.sender)
```

There are **no callbacks** from Layer 1 to Layer 2. Adjudicators monitor markets off-chain and push state transitions when ready.

---

## 3. AdjudicatorBase — Foundation Contract

### Purpose

`AdjudicatorBase` is the abstract contract that ALL adjudicator implementations must inherit. It provides:

1. **Guardian whitelist management** — per-adjudicator guardian addresses
2. **Ownership** — via OpenZeppelin `Ownable` for admin operations
3. **Standard interface** — `isGuardian(address)` callable by TruthMarket
4. **Resolution lifecycle** — `resolve()`, `verifyAttestation()`, `settle()` as virtual functions for children to override

### Contract Interface

```solidity
abstract contract AdjudicatorBase is Ownable {
    // ── Resolution Lifecycle (children override) ──

    /// @notice Propose an outcome. Moves market LIVE → RESOLVING.
    function resolve(address market, uint8 outcome, uint64 tStar) external virtual;

    /// @notice Verify attestation/proof for the proposed outcome. Moves RESOLVING → RESOLVED.
    /// @dev Implementations that don't require attestation verification can skip this step
    ///      by calling resolve() in a way that goes directly to RESOLVED.
    function verifyAttestation(address market, bytes calldata attestation) external virtual;

    /// @notice Lock settlement permanently. Moves RESOLVED → SETTLED.
    function settle(address market) external virtual;

    // ── Guardian Management (owner only) ──

    function approveGuardian(address guardian) external onlyOwner;
    function revokeGuardian(address guardian) external onlyOwner;
    function batchUpdateGuardians(
        address[] calldata toApprove,
        address[] calldata toRevoke
    ) external onlyOwner;

    // ── Guardian Query (called by TruthMarket.veto()) ──

    function isGuardian(address account) external view returns (bool);

    // ── Type Identifier ──

    function adjudicatorType() external view virtual returns (string memory);
}
```

### Three-Phase Resolution Pattern

All adjudicators follow the same base pattern but decide their own implementation:

```
resolve()             → Propose outcome (LIVE → RESOLVING)
verifyAttestation()   → Prove the outcome is correct (RESOLVING → RESOLVED)
settle()              → Lock permanently after veto window (RESOLVED → SETTLED)
```

Each concrete adjudicator **overrides** these functions for their specific resolution mechanism:

- **ZkTLS**: `verifyAttestation()` verifies a ZK proof on-chain
- **Oracle**: `verifyAttestation()` may be a no-op (oracle data is self-verifying at resolve time)
- **Manual**: `verifyAttestation()` may be skipped entirely (operator directly resolves)
- **DAO**: `verifyAttestation()` checks governance vote quorum

Implementations that don't require a separate attestation step can combine `resolve()` + `verifyAttestation()` logic, effectively skipping the RESOLVING state and moving directly from LIVE to RESOLVED.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Per-adjudicator guardians (not per-market) | Simplicity. An adjudicator operator manages one set of trusted guardians across all markets. |
| `Ownable` not `AccessControl` | Adjudicators have a single operator. Role-based access is overkill. |
| Virtual `resolve/verifyAttestation/settle` | Each adjudicator type overrides with its own proof mechanism. |
| Private `_guardians` mapping | Children cannot bypass guardian checks. Only the base exposes `isGuardian()`. |

### Guardian Lifecycle

```
Adjudicator deployed → owner calls approveGuardian(addr) → guardian active
                      → owner calls revokeGuardian(addr)  → guardian removed
                      → owner calls batchUpdateGuardians() → bulk changes
```

---

## 4. Adjudicator Type Taxonomy

The types listed below are initial designs. **Any new adjudicator type can be introduced** by inheriting `AdjudicatorBase` and overriding the resolution functions. These types represent different trust models and data source strategies, and all will be released under BSL license.

### 4.1 ZkTLS Adjudicator (type: `"zktls"`)

**Status**: Design complete. Reference implementation was removed from `sooth-core` in the 2026-03-19 cleanup — concrete adjudicator implementations are expected to live in external repos under BSL license. Based on Primus zkTLS technology.

**How it works**: ZkTLS (Zero-Knowledge TLS) proves that specific data was received from a specific HTTPS endpoint without revealing the full response. The adjudicator:

1. Configures a market with a `urlHash` (hash of the expected API endpoint)
2. A prover fetches the API response via TLS
3. A ZK proof is generated attesting to the response content
4. The proof is verified on-chain by a ZK verifier contract
5. The outcome is extracted from the proven data and submitted

**Trust model**: Trustless. No trusted intermediary — the ZK proof mathematically guarantees the data came from the specified endpoint and was interpreted correctly.

**Extends**: `AdjudicatorBase` — overrides `resolve()`, `verifyAttestation()`, `settle()` with ZK-specific logic.

**Key parameters (per-market)**:

| Parameter | Description |
|-----------|-------------|
| `urlHash` | `keccak256(apiUrl)` — identifies the data source |
| `deadline` | Resolution deadline (0 or year-2199 for infinite) |
| `maxAge` | Maximum age of the ZK proof (freshness check) |
| `vetoPeriod` | Guardian veto window after resolution |

**Resolution flow**:

```
Off-chain Prover          ZK Verifier Contract        ZkTLSAdjudicator          TruthMarket
      │                          │                          │                       │
      │── TLS fetch(apiUrl) ────►│                          │                       │
      │── generate ZK proof ────►│                          │                       │
      │                          │                          │                       │
      │── resolve(market, outcome, dataHash) ──────────────►│                       │
      │                          │                          │── resolve() ─────────►│
      │                          │                          │         (RESOLVING)   │
      │                          │                          │                       │
      │── verifyAttestation(market, proof) ────────────────►│                       │
      │                          │◄── verify(proof) ────────│                       │
      │                          │──── valid ──────────────►│                       │
      │                          │                          │─ verifyAttestation()─►│
      │                          │                          │         (RESOLVED)    │
      │                          │                          │                       │
      │                          │                    [veto period]                 │
      │                          │                          │                       │
      │── settle(market) ──────────────────────────────────►│                       │
      │                          │                          │── settle() ──────────►│
      │                          │                          │          (SETTLED)    │
```

**Deadline handling**: If `deadline` passes with no resolution and no valid attestation, `invalidateAfterDeadline()` sets outcome to INVALID and finalizes.

---

### 4.2 TEE Adjudicator (type: `"tee"`)

**Status**: Planned. Not yet implemented.

**How it works**: A TEE (Trusted Execution Environment) agent runs resolution logic inside a secure enclave (e.g., Intel SGX, ARM TrustZone). The enclave guarantees code integrity — the agent cannot deviate from its programmed resolution logic. The agent fetches resolution data, evaluates the market question, generates a hardware attestation proving correct execution, and submits it to the adjudicator contract for on-chain verification.

**Trust model**: Trust-minimized. Settlement requires a valid hardware attestation verified on-chain. The TEE enclave provides stronger guarantees than a simple EOA but weaker than a ZK proof (relies on hardware trust assumptions).

**Resolution pattern**: Overrides `resolve()` to propose an outcome, `verifyAttestation()` to verify the TEE hardware attestation on-chain, and `settle()` after the veto window.

**Suitable for**: General-purpose web data resolution, API-based markets, any scenario where HTTPS data needs to be fetched and evaluated programmatically.

---

### 4.3 Oracle Adjudicator (type: `"oracle"`)

**Status**: Planned. Not yet implemented.

**How it works**: Relies on established oracle networks (Chainlink, API3, Pyth, etc.) for truth determination. The adjudicator is configured with an oracle feed ID and a threshold condition per market. When the condition is met on the oracle feed, anyone can trigger resolution permissionlessly. The oracle's own timestamp serves as `tStar`.

**Trust model**: Delegates to oracle network trust. The security of the resolution depends entirely on the oracle network's integrity. Oracle manipulation risks apply.

**Resolution pattern**: May combine `resolve()` + `verifyAttestation()` into a single step since oracle data is self-verifying at query time — the on-chain feed IS the proof. `settle()` is called after the veto window.

**Suitable for**: Price-based prediction markets (BTC above $X, ETH below $Y), sports outcomes with oracle feeds, weather derivatives, any market with a reliable on-chain data feed.

---

### 4.4 DAO Adjudicator (type: `"dao"`)

**Status**: Planned. Not yet implemented.

**How it works**: Resolution via on-chain governance vote. Anyone can propose an outcome with evidence. Token holders vote during a configurable voting period. If quorum is met, the winning outcome is submitted via `resolve()`. The governance vote result itself serves as the attestation — `verifyAttestation()` checks that quorum was reached and the vote is finalized. Standard veto window applies after resolution.

**Trust model**: Decentralized governance. Subject to voter participation, token distribution, and governance attacks. Stronger decentralization guarantees but slower resolution times.

**Suitable for**: Subjective markets ("Best crypto project of 2026"), political outcomes, events without reliable data feeds, any market where human judgment is required.

---

### 4.5 Manual Adjudicator (type: `"manual"`)

**Status**: Simplest implementation. Suitable for testnets and low-stakes markets.

**How it works**: An EOA or multisig directly calls `resolve()` and `settle()` on the TruthMarket. The `verifyAttestation()` step is skipped entirely — the operator's authority IS the proof. The adjudicator address itself is the resolving entity.

**Trust model**: Fully trusted. The adjudicator has unilateral power to determine outcomes. Guardians provide the only check.

**Suitable for**: Testnet deployments, markets with known trusted resolvers, bootstrap phase before automated adjudicators are available.

---

### 4.6 UMA/Optimistic Adjudicator (type: `"optimistic"`)

**Status**: Conceptual.

**How it works**: Optimistic resolution with dispute mechanism. Anyone proposes an outcome with a bond. If undisputed for the challenge period, it's accepted. If disputed, escalated to a dispute resolution mechanism (e.g., UMA's Data Verification Mechanism). The `verifyAttestation()` step checks that the challenge period has passed without dispute, or that the dispute was resolved.

**Trust model**: Economic security via bonds and disputes.

---

### Type Summary

| Type | Trust Model | Automation | Attestation Step | Suitable For |
|------|------------|------------|-----------------|-------------|
| `zktls` | ZK proof | Full | ZK proof verification | HTTPS-verifiable data |
| `tee` | TEE enclave | Full | Hardware attestation | General purpose, web data |
| `oracle` | Oracle network | Full | Self-verifying (may skip) | Price feeds, measurable data |
| `dao` | Governance vote | Partial | Quorum check | Subjective questions |
| `manual` | Fully trusted | None | Skipped | Testnets, low-stakes |
| `optimistic` | Economic bond | Partial | Challenge period check | Broad coverage |

> **Extensibility**: These are initial types. Any new adjudicator type can be developed by inheriting `AdjudicatorBase` and overriding the resolution functions with a custom proof/verification mechanism.

---

## 5. Market Creation & Adjudicator Binding

### Binding at Creation

When a creator calls `LaunchpadEngine.createMarket()`, they specify an adjudicator address. This address is **permanently bound** to the TruthMarket — it cannot be changed after creation.

```solidity
// LaunchpadEngine.createMarket()
function createMarket(
    string memory _question,
    uint64 _startTime,
    uint64 _deadline,
    address _adjudicator,    // ← Layer 2 binding point
    uint256 _bBase,
    uint256 _initialProbabilityWad   // 0 = default 50/50
) external returns (address market, address lpToken);
```

The TruthMarket stores this address as `adjudicator` and uses it to gate all resolution functions:

```solidity
function resolve(uint8 outcome, uint64 _tStar) external {
    require(msg.sender == adjudicator, NotAdjudicator());
    // ...
}
```

### Two Modes of Adjudicator Selection

LaunchpadEngine supports two modes, determined at deployment. This is a **per-instance decision** made by the operator (the entity deploying the core protocol node). Once set at construction, the mode is **immutable** — all creators on that instance must follow the same policy for the lifetime of the deployment.

#### Mode 1: Permissionless (registry = address(0))

```
LaunchpadEngine constructor:
    adjudicatorRegistry = address(0)

Creator can pass ANY address as adjudicator.
No validation. No restrictions.
```

- Anyone can deploy an adjudicator and use it
- Creators take full responsibility for adjudicator quality
- Suitable for permissionless, open protocols
- Risk: Creators may use malicious adjudicators (e.g., always resolve in their favor)

#### Mode 2: Registry-Gated (registry = AdjudicatorRegistry)

```
LaunchpadEngine constructor:
    adjudicatorRegistry = 0x1234... (deployed AdjudicatorRegistry)

Creator MUST choose from approved adjudicators:
    require(IAdjudicatorRegistry(registry).isApproved(_adjudicator));
```

- Operator curates a whitelist of trusted adjudicators
- Creators choose from approved options
- Higher trust guarantees for traders
- Suitable for operated/institutional deployments

### Adjudicator Validation at Creation

```
createMarket(_adjudicator)
    │
    ├─ if registry == address(0): ALLOW any address
    │
    └─ if registry != address(0):
        └─ require(registry.isApproved(_adjudicator))
            ├─ true: ALLOW
            └─ false: REVERT
```

---

## 6. AdjudicatorRegistry — Operator Whitelists

### Purpose

The `AdjudicatorRegistry` is a simple whitelist contract deployed by an **operator** (instance deployer). It determines which adjudicators are available for market creation in a given LaunchpadEngine instance.

### Contract

```solidity
contract AdjudicatorRegistry is IAdjudicatorRegistry, Ownable {
    mapping(address => bool) private _approved;

    function approve(address adjudicator) external onlyOwner;
    function revoke(address adjudicator) external onlyOwner;
    function batchUpdate(address[] calldata toApprove, address[] calldata toRevoke) external onlyOwner;
    function isApproved(address adjudicator) external view returns (bool);
}
```

### Deployment Model

```
Operator A deploys:
  ├── AdjudicatorRegistry(ownerA)
  │     ├── approve(zktlsAdjudicator)
  │     ├── approve(oracleAdjudicator)
  │     └── approve(manualAdjudicator)
  │
  └── LaunchpadEngine(..., adjudicatorRegistry=registryA, ...)
        └── Creators choose from {zktlsAdj, oracleAdj, manualAdj}

Operator B deploys:
  └── LaunchpadEngine(..., adjudicatorRegistry=address(0), ...)
        └── Creators use ANY adjudicator (permissionless)
```

### Registry Immutability

The registry address on LaunchpadEngine is **immutable** — set at construction, cannot be changed. This is deliberate:

- Prevents operator from swapping to a more restrictive registry after markets exist
- All markets in the instance follow the same policy
- If a new policy is needed, deploy a new LaunchpadEngine

### Third-Party Registries

Adjudicator developers or third-party organizations can deploy their own registries:

```
Adjudicator Party X deploys:
  └── AdjudicatorRegistry(partyX)
        ├── approve(xAdjudicatorV1)
        ├── approve(xAdjudicatorV2)
        └── Markets created under this registry trust Party X's curation
```

Multiple LaunchpadEngine instances can point to the same registry, enabling shared trust pools.

---

## 7. Resolution Lifecycle

### State Machine (Layer 1)

```
                  ┌──────────┐
                  │   LIVE   │◄────────────────────┐
                  └────┬─────┘                     │
                       │ resolve(outcome, tStar)   │ veto()
                       │ [adjudicator only]        │ [guardian only]
                       ▼                           │
                  ┌──────────┐                     │
                  │RESOLVING │                     │
                  └────┬─────┘                     │
                       │ verifyAttestation()       │
                       │ [adjudicator only]        │
                       ▼                           │
                  ┌──────────┐                     │
                  │ RESOLVED │─────────────────────┘
                  └────┬─────┘
                       │ settle()
                       │ [adjudicator only]
                       ▼
                  ┌──────────┐
                  │ SETTLED  │  ← Terminal (irreversible)
                  └──────────┘

Special paths:
  LIVE ──invalidate()──► SETTLED     (deadline passed, no resolution)
  LIVE ──dismiss()─────► DISMISSED   (failed trial, LaunchpadEngine only)

Note: Some adjudicator implementations skip RESOLVING by combining
resolve + verifyAttestation in a single call → LIVE directly to RESOLVED.
```

### Resolution Stages Explained

#### Stage 1: LIVE → RESOLVING (`resolve`)

The adjudicator proposes an outcome. Trading halts on venues that check `isLive()`.

```solidity
ITruthMarket(market).resolve(outcome, tStar);
```

- `outcome`: 0=NO, 1=YES, 2=INVALID
- `tStar`: Retroactive truth-time (when the outcome became true). 0 if not applicable.
- The proposed outcome needs to be proven/verified before it becomes accepted.

#### Stage 2: RESOLVING → RESOLVED (`verifyAttestation`)

The adjudicator proves the proposed outcome is correct. The guardian veto window opens.

```solidity
ITruthMarket(market).verifyAttestation(attestation);
```

- For ZkTLS: submits a ZK proof that is verified on-chain
- For TEE: submits a hardware attestation
- For Oracle: may be combined with `resolve()` (oracle data is self-verifying)
- For Manual: may be skipped entirely (operator authority is the proof)
- Implementations that don't need this step combine it with `resolve()`, going directly LIVE → RESOLVED

#### Stage 3: RESOLVED → SETTLED (`settle`)

The adjudicator locks the outcome permanently. Redemption opens.

```solidity
ITruthMarket(market).settle();
```

- **Irreversible**. No state transition can undo SETTLED.
- Opens `AMMEngine.settlePosition()` and `matchingEngine.settlePosition()` for traders
- Opens `LaunchpadEngine.redeemLP()` for LP token holders

#### Guardian Veto: RESOLVED → LIVE

During RESOLVED state, guardians can veto the outcome and return the market to LIVE:

```solidity
TruthMarket(market).veto(); // called by guardian directly
```

- Clears `winningOutcome` and `tStar`
- Market returns to LIVE, adjudicator can try again
- See [Section 8: Guardian Protocol](#8-guardian-protocol) for details

### Adjudicator-Specific Flow Patterns

**Proof-based adjudicators (ZkTLS, TEE)**:

```
resolve(outcome, tStar)  →  RESOLVING  →  verifyAttestation(proof)  →  RESOLVED  →  [veto window]  →  settle()
```

- Separate `resolve` and `verifyAttestation` steps
- The proof must be verified before the market reaches RESOLVED

**Self-verifying adjudicators (Oracle, Manual)**:

```
resolve(outcome, tStar) + verifyAttestation()  →  RESOLVED  →  [veto window]  →  settle()
```

- Skip RESOLVING state — combine resolve and verification in one call
- Oracle data or operator authority serves as implicit proof

---

## 8. Guardian Protocol

### Purpose

Guardians are the safety net. They watch resolved markets and veto incorrect outcomes before settlement becomes irreversible. Guardians are managed per-adjudicator (not per-market, not globally).

### Who Can Be a Guardian?

Guardians are addresses approved by the adjudicator owner. Typical guardian entities:

| Entity | Role |
|--------|------|
| Protocol team multisig | Emergency override for critical markets |
| Independent validators | Third-party auditors monitoring outcomes |
| Community DAOs | Decentralized oversight committees |
| Automated agents | Checker bots that verify adjudicator outputs |

### Veto Mechanics

```
1. Adjudicator resolves market → state = RESOLVED
2. Guardian detects incorrect outcome
3. Guardian calls TruthMarket.veto()
4. TruthMarket checks: AdjudicatorBase(adjudicator).isGuardian(msg.sender)
5. If approved: state = LIVE, outcome cleared
6. Adjudicator can re-resolve with correct outcome (if deadline not passed)
   - Finite deadline: if deadline passed, anyone calls invalidate() → SETTLED (INVALID)
   - Infinite deadline: adjudicator can always re-resolve (no time constraint)
```

### Veto Window

The veto window is the time between RESOLVED and SETTLED states. It is NOT enforced on-chain by TruthMarket — the adjudicator implementation determines when to call `settle()`:

- **ZkTLSAdjudicator**: `vetoPeriod` is configured per-market. `settle()` requires `block.timestamp >= resolvedAt + vetoPeriod`.
- **ManualAdjudicator**: Operator manually calls `settle()` after reviewing and waiting.
- **OracleAdjudicator**: Configurable delay before `settle()` is callable.

### Guardian Reputation Impact

Guardian actions affect adjudicator reputation (see [Section 9](#9-reputation-system)):

| Action | Reputation Impact |
|--------|------------------|
| Veto of genuinely wrong outcome | Positive for guardian, negative for adjudicator |
| Veto of correct outcome (griefing) | Negative for guardian (tracked off-chain) |
| No veto on correct outcome | Neutral (expected behavior) |
| No veto on wrong outcome | Negative for guardian (failure to act) |

---

## 9. Reputation System

### Overview

Adjudicator reputation is a critical component of the trust model. Traders, creators, and operators need objective metrics to evaluate adjudicator quality. The reputation system is **hybrid** — combining on-chain signals with off-chain aggregation.

### On-Chain Signals

These events are emitted by Layer 1 and Layer 2 contracts and are indexable:

| Signal | Source | Meaning |
|--------|--------|---------|
| `MarketResolved` | TruthMarket | Adjudicator resolved with an outcome |
| `MarketSettled` | TruthMarket | Settlement finalized |
| `MarketVetoed` | TruthMarket | Guardian overrode the adjudicator |
| `MarketInvalidated` | TruthMarket | Deadline passed with no resolution |
| `MarketDismissedByEngine` | TruthMarket | Trial failed (not adjudicator's fault) |
| `GuardianApproved` / `GuardianRevoked` | AdjudicatorBase | Guardian roster changes |

### Reputation Metrics

#### 1. Resolution Rate

```
resolution_rate = markets_settled / markets_created_with_adjudicator
```

- High resolution rate = reliable adjudicator
- Low rate = markets abandoned or stuck in LIVE

#### 2. Veto Rate

```
veto_rate = markets_vetoed / markets_resolved
```

- High veto rate = adjudicator frequently wrong
- Zero veto rate = either always correct or no guardians active

#### 3. Time to Resolution

```
avg_resolution_time = avg(settled_timestamp - market_creation_timestamp)
```

- Fast resolution = responsive adjudicator
- Slow resolution = may be causing trader uncertainty

#### 4. Invalidation Rate

```
invalidation_rate = markets_invalidated / markets_with_finite_deadline
```

- High invalidation rate = adjudicator not resolving before deadlines
- Should be near zero for well-operated adjudicators

#### 5. Settlement Accuracy (requires post-settlement feedback)

```
accuracy = correct_settlements / total_settlements
```

- Measured via community feedback and dispute tracking
- Traders and creators can flag incorrect settlements

---

## 10. Licensing & Third-Party Development

### License: BSL-1.1 (Business Source License)

All Sooth Protocol adjudicator contracts are released under BSL-1.1:

- **Source available**: Anyone can read, study, and learn from the code
- **Non-production use**: Free for development, testing, research, and personal use
- **Production use**: Requires a license grant from the **adjudicator developer** (the entity that built and published the adjudicator) for commercial production use
- **Change date**: After the change date (typically 2-4 years), code converts to a permissive open-source license (e.g., MIT)

### What Third Parties Can Do

#### Without License

- **Fork and study** the adjudicator code
- **Build custom adjudicators** for their own protocols that inherit `AdjudicatorBase`
- **Deploy to testnets** for development and testing
- **Build tooling** around the adjudicator interfaces
- **Contribute upstream** via pull requests

#### With License (from the adjudicator developer)

- **Deploy to production** for commercial use
- **Offer adjudicator-as-a-service** to market creators
- **Deploy and operate registries** listing their adjudicators
- **Monetize** through adjudicator fees or premium features

### Third-Party Adjudicator Development

Anyone can develop a new adjudicator type by:

1. **Inheriting `AdjudicatorBase`** for guardian management and the resolution interface
2. **Overriding `resolve()`, `verifyAttestation()`, `settle()`** with custom logic
3. **Deploying to a supported chain**
4. **Requesting approval** from registry operators (for registry-gated instances)
5. **Building reputation** through successful settlements

### Registry Operator Model

Registry operators curate adjudicators for their platform instances:

```
Operator deploys AdjudicatorRegistry
  │
  ├── Reviews third-party adjudicator code and reputation
  ├── Approves vetted adjudicators: registry.approve(addr)
  ├── Monitors performance metrics
  ├── Revokes underperforming adjudicators: registry.revoke(addr)
  │
  └── Revenue model (optional):
      ├── Adjudicator listing fees
      ├── Revenue share on settlement fees
      └── Premium tier features
```

---

## 11. Building a Custom Adjudicator

### Step-by-Step Guide

#### Step 1: Inherit AdjudicatorBase

```solidity
// SPDX-License-Identifier: BSL-1.1
pragma solidity ^0.8.33;

import {AdjudicatorBase} from "sooth-core/src/AdjudicatorBase.sol";
import {ITruthMarket} from "sooth-core/src/interfaces/ITruthMarket.sol";

contract MyAdjudicator is AdjudicatorBase {
    constructor(address _owner) AdjudicatorBase(_owner) {}
}
```

#### Step 2: Override Resolution Functions

```solidity
contract MyAdjudicator is AdjudicatorBase {
    address public dataSource;

    constructor(address _dataSource, address _owner) AdjudicatorBase(_owner) {
        dataSource = _dataSource;
    }

    /// @notice Propose an outcome (LIVE → RESOLVING)
    function resolve(address market, uint8 outcome, uint64 tStar) external override {
        require(msg.sender == owner(), "Not authorized");
        ITruthMarket(market).resolve(outcome, tStar);
    }

    /// @notice Verify proof and move to RESOLVED (RESOLVING → RESOLVED)
    function verifyAttestation(address market, bytes calldata attestation) external override {
        // Your verification logic here
        // e.g., verify ZK proof, check oracle feed, validate TEE attestation
        require(_verifyProof(attestation), "Invalid proof");
        ITruthMarket(market).verifyAttestation(attestation);
    }

    /// @notice Finalize settlement after veto window (RESOLVED → SETTLED)
    function settle(address market) external override {
        ITruthMarket(market).settle();
    }

    function adjudicatorType() external pure override returns (string memory) {
        return "custom";
    }
}
```

#### Step 3: Add Guardian Management

This is inherited from `AdjudicatorBase`. The owner can:

```solidity
// Deploy
MyAdjudicator adj = new MyAdjudicator(dataSource, msg.sender);

// Approve guardians
adj.approveGuardian(guardian1);
adj.approveGuardian(guardian2);

// Guardians can now veto any market using this adjudicator
```

### Testing Checklist

- [ ] Adjudicator can call `resolve()`, `verifyAttestation()`, and `settle()` on TruthMarket
- [ ] Guardian can call `veto()` successfully (returns to LIVE)
- [ ] Non-guardian cannot call `veto()`
- [ ] Settlement is irreversible after `settle()`
- [ ] Multiple markets can use the same adjudicator
- [ ] Market creation with adjudicator works in both permissionless and registry modes
- [ ] `adjudicatorType()` returns the correct type string
- [ ] Gas cost is within acceptable bounds

---

## 12. Security Considerations

### Adjudicator Risks

| Risk | Mitigation |
|------|-----------|
| Malicious adjudicator resolves incorrectly | Guardian veto; reputation system; registry curation |
| Adjudicator key compromise | Guardian veto; multisig adjudicator addresses |
| Adjudicator goes offline (no resolution) | `invalidate()` for finite-deadline markets; guardian monitoring |
| Adjudicator front-runs market resolution | MEV protection (private mempool, Flashbots); commit-reveal schemes |
| Sybil attack on reputation | Minimum settlement count; weighted scoring; stake requirements |

### Guardian Risks

| Risk | Mitigation |
|------|-----------|
| Guardian collusion with adjudicator | Multiple independent guardians; guardian reputation tracking |
| Guardian griefing (vetoing correct outcomes) | Guardian revocation by adjudicator owner; reputation penalties |
| All guardians compromised | Adjudicator owner can revoke all and appoint new guardians |
| No guardians active | Markets proceed without veto protection; reputation penalized |

### Registry Risks

| Risk | Mitigation |
|------|-----------|
| Registry operator censorship | Permissionless alternative instances always available |
| Registry operator approves malicious adjudicator | Guardian oversight; trader reporting; reputation monitoring |
| Registry address immutable (can't upgrade) | Deploy new LaunchpadEngine with new registry if needed |

---

## Appendix: Contract Reference

### Contracts

| Contract | Location | Description |
|----------|----------|-------------|
| `AdjudicatorBase.sol` | `src/AdjudicatorBase.sol` | Abstract base with guardian whitelist and resolution interface |
| `AdjudicatorRegistry.sol` | `src/AdjudicatorRegistry.sol` | Operator whitelist |
| `IAdjudicator.sol` | `src/interfaces/IAdjudicator.sol` | Full adjudicator interface |
| `IAdjudicatorRegistry.sol` | `src/interfaces/IAdjudicatorRegistry.sol` | Registry interface |

### Interface Selectors

| Function | Selector | Called By |
|----------|----------|----------|
| `isGuardian(address)` | `0x0505c8c9` | TruthMarket.veto() |
| `isApproved(address)` | `0xd4788bb4` | LaunchpadEngine.createMarket() |
| `resolve(uint8,uint64)` | TruthMarket | Adjudicator implementations |
| `verifyAttestation(bytes)` | TruthMarket | Adjudicator implementations |
| `settle()` | TruthMarket | Adjudicator implementations |
| `veto()` | TruthMarket | Guardian addresses |

### Events Index

| Event | Emitted By |
|-------|-----------|
| `GuardianApproved(address)` | AdjudicatorBase |
| `GuardianRevoked(address)` | AdjudicatorBase |
| `AdjudicatorApproved(address)` | AdjudicatorRegistry |
| `AdjudicatorRevoked(address)` | AdjudicatorRegistry |
| `MarketConfigured(address,bytes32,uint64,uint64,uint64)` | IAdjudicator |
| `MarketResolved(address,uint8,bytes32)` | IAdjudicator |
| `AttestationVerified(address,bytes32)` | IAdjudicator |

---

> **Version**: 0.1.0 | **Spec**: Layer 2 Adjudicator | **Updated**: 2026-03-06
> **Layer 1 Dependency**: TruthMarket lifecycle (LIVE → RESOLVING → RESOLVED → SETTLED)
> **License**: BSL-1.1
> **Contracts**: `src/AdjudicatorBase.sol`, `src/AdjudicatorRegistry.sol`
