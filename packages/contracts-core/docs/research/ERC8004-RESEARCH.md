# ERC-8004 Research: Trustless Agents for Prediction Markets

> **Date**: 2026-01-19
> **Status**: Research Complete
> **Related**: Integration spec (internal working doc in `.agent/plans/erc8004-sooth-integration-v11.md`)

---

## Executive Summary

ERC-8004 "Trustless Agents" is an Ethereum standard (proposed Aug 2025, mainnet Q2 2026) that enables autonomous AI agents to discover, trust, and transact without intermediaries. This document captures research on how ERC-8004 can enhance Sooth Protocol's prediction market infrastructure.

**Key Synergies Identified:**

| Integration | Value to Sooth | Complexity |
|-------------|---------------|------------|
| Agent-Gated Markets | New market type for AI-only trading | Medium |
| Reputation-Weighted Fees | Incentivize quality agents | Low |
| AI Adjudicators (TEE) | Trustless oracle infrastructure | High |
| x402 Trading API | HTTP-native agent trading | Medium |
| Meta-Markets | Forward-looking agent reputation | Low |

---

## 1. ERC-8004 Overview

### 1.1 Background

- **Proposed**: August 13, 2025
- **Authors**: Marco De Rossi (MetaMask), Davide Crapis (Ethereum Foundation), Jordan Ellis (Google), Erik Reppel (Coinbase)
- **Expected Mainnet**: Q2 2026 (Glamsterdam hard fork)
- **Status**: 8+ implementations within 24 hours of proposal

### 1.2 Core Architecture

ERC-8004 defines three on-chain registries:

```
┌─────────────────────────────────────────────────────────────┐
│                   ERC-8004 Trust Stack                       │
├───────────────┬───────────────┬─────────────────────────────┤
│   IDENTITY    │  REPUTATION   │       VALIDATION            │
│   REGISTRY    │   REGISTRY    │        REGISTRY             │
├───────────────┼───────────────┼─────────────────────────────┤
│ • ERC-721 NFT │ • Score 0-100 │ • TEE Attestations          │
│ • Agent URI   │ • x402 Proofs │ • zkML Verification         │
│ • Endpoints   │ • Tags/Filter │ • Stake Mechanisms          │
│ • Metadata    │ • Feedback    │ • Third-party validators    │
└───────────────┴───────────────┴─────────────────────────────┘
```

### 1.3 Key Interfaces

```solidity
// Identity Registry (ERC-721 based)
interface IIdentityRegistry {
    function register(string calldata agentURI) external returns (uint256 agentId);
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata sig) external;
    function getMetadata(uint256 agentId, string calldata key) external view returns (bytes memory);
}

// Reputation Registry
interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        uint8 score,           // 0-100
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    function getSummary(
        uint256 agentId,
        address[] calldata clients,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, uint8 averageScore);
}

// Validation Registry
interface IValidationRegistry {
    function validationRequest(address validator, uint256 agentId, string calldata requestURI, bytes32 requestHash) external;
    function validationResponse(bytes32 requestHash, uint8 response, string calldata responseURI, bytes32 responseHash, string calldata tag) external;
    function getValidationStatus(bytes32 requestHash) external view returns (address, uint256, uint8, string memory, uint256);
}
```

### 1.4 Agent Registration File

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Sooth Trading Agent",
  "description": "AI agent for prediction market trading",
  "image": "ipfs://...",
  "endpoints": [
    { "protocol": "A2A", "url": "https://agent.sooth.markets/a2a" },
    { "protocol": "MCP", "url": "https://agent.sooth.markets/mcp" }
  ],
  "x402Support": true,
  "active": true,
  "supportedTrust": ["reputation", "tee-attestation"]
}
```

---

## 2. x402 Payment Protocol

### 2.1 Overview

x402 is Coinbase's HTTP-native payment protocol that enables instant stablecoin payments using the HTTP 402 status code.

- **Launched**: May 2025
- **Processed**: 100M+ payments
- **Supported Networks**: Base, Solana (USDC)
- **Key Partners**: Cloudflare (~20% of web), Coinbase

### 2.2 Payment Flow

```
Client                          Server                      Facilitator
  │                               │                              │
  │── GET /resource ─────────────►│                              │
  │                               │                              │
  │◄─ 402 Payment Required ───────│                              │
  │   PAYMENT-REQUIRED header     │                              │
  │                               │                              │
  │── GET /resource ─────────────►│                              │
  │   PAYMENT-SIGNATURE header    │                              │
  │                               │── POST /verify ─────────────►│
  │                               │◄─ valid ─────────────────────│
  │                               │── POST /settle ─────────────►│
  │                               │◄─ confirmed ─────────────────│
  │◄─ 200 OK + resource ──────────│                              │
```

### 2.3 SDK Availability

| Language | Package |
|----------|---------|
| TypeScript | `@x402/core`, `@x402/evm`, `@x402/fetch`, `@x402/express` |
| Python | `pip install x402` |
| Go | `go get github.com/coinbase/x402/go` |
| Java | Available |

### 2.4 ERC-8004 + x402 Synergy

> "If x402 is the wallet that makes transactions effortless, ERC-8004 is the ID card and credit score that ensures everyone plays fair."

- x402 handles **payment** (how agents pay for services)
- ERC-8004 handles **trust** (which agents to transact with)
- Together: Complete agent economy infrastructure

---

## 3. TEE/ROFL Validation

### 3.1 Oasis ROFL Overview

ROFL (Runtime Off-chain Logic) is Oasis Network's framework for executing verifiable off-chain computation in TEEs (Trusted Execution Environments).

**Key Capabilities:**
- Confidential compute in secure enclaves
- Cryptographic attestations verifiable on-chain
- Support for oracles, AI inference, game logic

### 3.2 Attestation Flow

```
1. ROFL App executes in TEE enclave
2. Remote Attestation generates quote
3. Node endorses capability with signature
4. RONL verifies quote + enclave identity
5. Attestation stored in Validation Registry
```

### 3.3 On-Chain Verification

From Oasis ADR-0024:
- Quotes submitted to Sapphire with collateral
- Chain verifies Intel Root CA signature chain
- Measurements compared against compile-time values
- Platform security updates validated

### 3.4 Oracle Use Cases

ROFL is designed for:
- Price oracles
- LLM oracles
- Game hosting
- MCP servers
- AI-powered chatbots

**Relevance to Sooth:** TEE-validated adjudicators can prove they fetched correct data and executed correct settlement logic.

---

## 4. zkML (Zero-Knowledge Machine Learning)

### 4.1 Current State (2026)

- Proof generation can be parallelized across clusters
- GPU-optimized implementations emerging
- Viable for production finance/healthcare applications

### 4.2 Limitations

| Capability | Status |
|------------|--------|
| Prove inference | Viable |
| Prove training | Not yet feasible |
| Real-time verification | Getting closer |
| Cost | Still expensive (1000x+ slower than inference) |

### 4.3 Key Players

- **EZKL**: ONNX → ZK-SNARK circuits
- **Modulus Labs**: Benchmarking up to 18M parameters
- **zkVML**: Python library for verifiable ML

### 4.4 Relevance to Sooth

For high-value markets, zkML can verify:
- ML model was used (MRENCLAVE hash)
- Specific input was provided
- Correct output was produced

**Recommendation:** Use TEE for V11, consider zkML for high-value markets in V12.

---

## 5. Tiered Fee Models (dYdX, GMX)

### 5.1 dYdX Model

Volume-based maker-taker fees:
- Baseline: 0.05% taker, 0.01% maker
- 6 tiers based on 30-day volume
- Additional discounts for staked DYDX
- Hedgie NFT holders: 3% discount

### 5.2 GMX Model

- Flat 0.1% position fee
- Governance proposal for tiered fees based on staked GMX
- Multiplier points system for long-term stakers

### 5.3 Sooth Application

Reputation-based discounts (similar to volume-based):

| Reputation | Discount | Rationale |
|------------|----------|-----------|
| 0-49 | 0% | Unproven agents pay full fee |
| 50-69 | 10-20% | Established agents |
| 70-89 | 30-40% | Trusted agents |
| 90-100 | 50% | Elite agents |

---

## 6. Prediction Market + AI Agent Synergies

### 6.1 Agent-Gated Markets

Markets where only ERC-8004 registered agents can trade.

**Use Cases:**
- AI trading competitions
- Research-focused markets (avoid noise)
- High-stakes markets requiring accountability

**Implementation:**
```solidity
mapping(address => bool) public isAgentGatedMarket;
mapping(address => uint8) public marketMinReputation;

function tradeWithAgent(address market, uint256 agentId, ...) external {
    require(identityRegistry.ownerOf(agentId) == msg.sender);
    if (isAgentGatedMarket[market]) {
        (, uint8 score) = reputationRegistry.getSummary(agentId, ...);
        require(score >= marketMinReputation[market]);
    }
    // Execute trade
}
```

### 6.2 AI Adjudicators

Agents serving as oracles/adjudicators with TEE validation.

**Trust Model:**
1. Agent registered in Identity Registry
2. Historical accuracy in Reputation Registry
3. Settlement proofs in Validation Registry

**Flow:**
```
Agent fetches data → TEE generates attestation →
Validation Registry records proof → TruthMarket.settle()
```

### 6.3 Meta-Markets

Prediction markets about AI agent performance.

**Examples:**
- "Will Agent X complete 100 tasks with >90% satisfaction?"
- "Will Agent Y's predictions be >70% accurate?"

**Value:**
- ERC-8004 Reputation is backward-looking (history)
- Sooth markets are forward-looking (prediction)
- Combined: Complete trust signal

### 6.4 x402 Trading API

HTTP-native trading for AI agents.

**Benefits:**
- No wallet SDK required
- Standard HTTP requests
- Automatic payment handling
- Works with any HTTP client

### 6.5 Automated Market Making

AI agents providing liquidity with reputation tracking.

**Model:**
- Agent registers as LP
- Performance tracked (returns, uptime)
- Reputation affects capital allocation

---

## 7. Industry Adoption

### 7.1 ERC-8004 Ecosystem

| Project | Integration |
|---------|-------------|
| MetaMask | Native wallet support |
| Google | A2A protocol, 2 FT engineers on V2 spec |
| Coinbase | x402 payment integration |
| Base | Core infrastructure support |
| Taiko | L2 support |
| Questflow | Building on top |
| Oasis Network | ROFL for validation |

### 7.2 Prediction Market Interest

From [aixbt_agent tweet](https://x.com/aixbt_agent/status/2007399027982139785):
> "Polymarket and Kalshi both recognized it, PayAI partnership already announced for prediction market infra"

Market context:
- Polymarket: $338M OI
- Kalshi: Tens of billions traded

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ERC-8004 not on target chain | Medium | High | Deploy own registries |
| Agent Sybil attacks | Medium | Medium | x402 payment proofs, stake |
| ROFL validator collusion | Low | High | Multiple validators, slashing |
| zkML too expensive | High | Medium | Use TEE for now |
| x402 facilitator downtime | Low | Medium | Fallback to direct trading |

---

## 9. Recommendations

### 9.1 Short-term (V11)

1. **Integrate ERC-8004 registries** on Base
2. **Add `tradeWithAgent()`** to LaunchpadEngine
3. **Implement reputation-weighted fees** (dYdX model)
4. **Build x402 API** for agent trading

### 9.2 Medium-term (V11.5)

5. **Deploy ValidatedAdjudicator** with ROFL integration
6. **Launch AgentPerformanceMarketFactory**
7. **Release @sooth/agent-sdk**

### 9.3 Long-term (V12+)

8. **zkML validation** for high-value markets
9. **Cross-chain agent identity**
10. **Agent-to-agent orderbook trading**

---

## 10. References

### Official Sources

- [ERC-8004 EIP](https://eips.ethereum.org/EIPS/eip-8004)
- [x402 GitHub](https://github.com/coinbase/x402)
- [x402 Whitepaper](https://www.x402.org/x402-whitepaper.pdf)
- [x402 Documentation](https://docs.cdp.coinbase.com/x402/welcome)
- [Oasis ROFL ADR-0024](https://docs.oasis.io/adrs/0024-off-chain-runtime-logic/)

### Analysis & News

- [U.Today: Ethereum Meets AI Agents](https://u.today/ethereum-meets-ai-agents-what-is-erc-8004)
- [BlockEden: ERC-8004 OS for AI Agents](https://blockeden.xyz/blog/2026/01/15/erc-8004-trustless-agents-ai-blockchain-coordination/)
- [Questflow: ERC-8004 Pioneering Trustless Agents](https://blog.questflow.ai/p/erc-8004-pioneering-trustless-agents)
- [WEEX: ERC-8004 + x402 Trust Layer](https://www.weex.com/news/detail/unlocking-the-future-how-erc-8004-complements-x402-in-building-trust-for-ai-agents-205447)
- [PayRam: ERC-8004 Protocol Overview](https://payram.com/blog/what-is-erc-8004-protocol)
- [Oasis: ROFL on Mainnet](https://dev.to/caerlower/rofl-is-live-on-mainnet-confidential-compute-meets-web3-4plk)

### Technical Deep-Dives

- [zkML Definitive Guide 2025](https://blog.icme.io/the-definitive-guide-to-zkml-2025/)
- [dYdX Fee Documentation](https://docs.dydx.xyz/concepts/trading/rewards)
- [GMX Fee Discount Proposal](https://gov.gmx.io/t/trading-fee-discount-with-staked-gmx-mp/1365)
- [Oasis TEE Attestation](https://oasis.net/blog/tees-remote-attestation-process)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-19 | Initial research document |
