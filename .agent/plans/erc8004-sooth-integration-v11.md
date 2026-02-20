> **SUPERSEDED** — This V11 plan has been superseded by V12 (SoothBook). See `docs/V12/` for current architecture.

# ERC-8004 × Sooth Protocol Integration Spec

> **Status**: Planning
> **Created**: 2026-01-19
> **Author**: Claude + Daniel
> **Target Version**: V11.0 (with ERC-8004 support)

---

## Executive Summary

This document specifies the integration of [ERC-8004 "Trustless Agents"](https://eips.ethereum.org/EIPS/eip-8004) with Sooth Protocol, enabling AI agents to participate in prediction markets with verifiable identity, reputation, and cryptographic validation.

| Feature | Impact | Complexity |
|---------|--------|------------|
| Agent-Gated Markets | Deferred (not planned for V11) | N/A |
| Reputation-Weighted Fees | High - trader incentives | Low |
| AI Adjudicators with TEE | High - trust infrastructure | High |
| x402 Trading API | Medium - agent accessibility | Medium |
| Meta-Markets (Agent Performance) | High - reputation discovery | Low |

---

## Current Focus (2026-01-20)

- Priority: adjudicator validation flow; first target is ZK/Brevis (TEE deferred).
- Clarification: agent-gated markets are deferred; trading remains open to all users.
- Scope: agent incentives limited to TickBook fee discounts for registered market makers.
- Clarification: adjudicators may settle before market expiration when truth resolves.
- Deferred: KYC/compliance gating as an extension to agent gating (post-V11).

---

## Part 1: ERC-8004 Background

### 1.1 Core Registries

ERC-8004 provides three on-chain registries that form the trust infrastructure:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ERC-8004 Trust Stack                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   IDENTITY   │  │  REPUTATION  │  │     VALIDATION       │  │
│  │   REGISTRY   │  │   REGISTRY   │  │      REGISTRY        │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤  │
│  │ ERC-721 NFT  │  │ Score 0-100  │  │ TEE Attestations     │  │
│  │ Agent URI    │  │ x402 Proofs  │  │ zkML Verification    │  │
│  │ Endpoints    │  │ Tags/Filters │  │ Stake Mechanisms     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Interfaces (from EIP)

```solidity
// Identity Registry (ERC-721 based)
interface IIdentityRegistry {
    function register(string calldata agentURI) external returns (uint256 agentId);
    function getMetadata(uint256 agentId, string calldata key) external view returns (bytes memory);
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata sig) external;
}

// Reputation Registry
interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        uint8 score,          // 0-100
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
    function validationRequest(
        address validator,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external;

    function validationResponse(
        bytes32 requestHash,
        uint8 response,       // 0-100 (0=failed, 100=passed)
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external;

    function getValidationStatus(bytes32 requestHash) external view returns (
        address validator,
        uint256 agentId,
        uint8 response,
        string memory tag,
        uint256 lastUpdate
    );
}
```

### 1.3 x402 Payment Protocol

[x402](https://github.com/coinbase/x402) enables HTTP-native stablecoin payments:

```
Client                          Server                      Facilitator
  │                               │                              │
  │──── GET /api/trade ──────────►│                              │
  │                               │                              │
  │◄─── 402 Payment Required ─────│                              │
  │     (PAYMENT-REQUIRED header) │                              │
  │                               │                              │
  │──── GET /api/trade ──────────►│                              │
  │     (PAYMENT-SIGNATURE header)│                              │
  │                               │──── POST /verify ───────────►│
  │                               │◄─── verification result ─────│
  │                               │──── POST /settle ───────────►│
  │                               │◄─── settlement confirmed ────│
  │◄─── 200 OK + trade result ────│                              │
```

---

## Part 2: Agent-Gated Markets & Reputation-Weighted Fees

### 2.1 Overview

Two complementary features:
1. **Agent-Gated Markets**: Markets where only ERC-8004 registered agents can trade
2. **Reputation-Weighted Fees**: Fee discounts based on agent reputation score

Note (2026-01-20): Agent-gated markets are deferred; current V11 scope is fee discounts on TickBook only.

### 2.2 Contract Changes: LaunchpadEngine

```solidity
// New imports
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {IReputationRegistry} from "./interfaces/IReputationRegistry.sol";

contract LaunchpadEngine is ILaunchpadEngine, Ownable, ReentrancyGuard {
    // ============================================
    // ERC-8004 Integration
    // ============================================

    /// @notice ERC-8004 Identity Registry (set by owner)
    IIdentityRegistry public identityRegistry;

    /// @notice ERC-8004 Reputation Registry (set by owner)
    IReputationRegistry public reputationRegistry;

    /// @notice Tag used for Sooth-specific reputation queries
    string public constant REPUTATION_TAG = "sooth-trading";

    /// @notice Minimum reputation score for fee discounts (0-100)
    uint8 public minReputationForDiscount = 50;

    /// @notice Maximum fee discount in basis points (default: 50 = 0.5%)
    uint16 public maxFeeDiscountBps = 50;

    /// @notice Per-market: Is this market agent-gated?
    mapping(address => bool) public isAgentGatedMarket;

    /// @notice Per-market: Minimum agent reputation to trade (0 = no minimum)
    mapping(address => uint8) public marketMinReputation;

    // ============================================
    // Events
    // ============================================

    event AgentGatedMarketCreated(address indexed market, uint8 minReputation);
    event AgentTraded(address indexed market, uint256 indexed agentId, uint8 outcome, int256 deltaShares);
    event ReputationFeedbackGiven(address indexed market, uint256 indexed agentId, uint8 score);

    // ============================================
    // Errors
    // ============================================

    error AgentNotRegistered();
    error InsufficientReputation(uint8 required, uint8 actual);
    error NotAgentOwner();

    // ============================================
    // New Functions
    // ============================================

    /**
     * @notice Create an agent-gated market
     * @param question Market question
     * @param startTime Market start time (0 = start now)
     * @param deadline Resolution deadline
     * @param adjudicator Adjudicator address (can be ERC-8004 agent)
     * @param guardian Guardian address
     * @param initialLiquidity Initial liquidity (LaunchpadEngine input)
     * @param minAgentReputation Minimum reputation to trade (0-100)
     */
    function createAgentGatedMarket(
        string calldata question,
        uint64 startTime,
        uint64 deadline,
        address adjudicator,
        address guardian,
        uint256 initialLiquidity,
        uint8 minAgentReputation
    ) external returns (address market) {
        // Create normal market
        market = _createMarketInternal(
            question,
            startTime,
            deadline,
            adjudicator,
            guardian,
            initialLiquidity
        );

        // Mark as agent-gated
        isAgentGatedMarket[market] = true;
        marketMinReputation[market] = minAgentReputation;

        emit AgentGatedMarketCreated(market, minAgentReputation);
    }

    /**
     * @notice Trade on agent-gated market (requires agentId)
     * @param market Market address
     * @param agentId ERC-8004 agent ID (caller must own this agent)
     * @param outcome 0=NO, 1=YES
     * @param deltaShares Positive=buy, negative=sell
     * @param maxCostOrMinProceeds Slippage protection
     */
    function tradeWithAgent(
        address market,
        uint256 agentId,
        uint8 outcome,
        int256 deltaShares,
        uint256 maxCostOrMinProceeds
    ) external nonReentrant returns (uint256 cost, uint256 fee) {
        // Verify agent ownership
        address agentOwner = identityRegistry.ownerOf(agentId);
        if (agentOwner != msg.sender) revert NotAgentOwner();

        // Check if market is agent-gated
        if (isAgentGatedMarket[market]) {
            uint8 minRep = marketMinReputation[market];
            if (minRep > 0) {
                (, uint8 avgScore) = reputationRegistry.getSummary(
                    agentId,
                    new address[](0),
                    REPUTATION_TAG,
                    ""
                );
                if (avgScore < minRep) revert InsufficientReputation(minRep, avgScore);
            }
        }

        // Calculate fee with reputation discount
        uint16 effectiveFee = _calculateFeeWithDiscount(market, agentId);

        // Execute trade
        (cost, fee) = _tradeInternal(market, msg.sender, outcome, deltaShares, maxCostOrMinProceeds, effectiveFee);

        emit AgentTraded(market, agentId, outcome, deltaShares);
    }

    /**
     * @notice Calculate effective fee with reputation discount
     */
    function _calculateFeeWithDiscount(address market, uint256 agentId) internal view returns (uint16) {
        MarketState storage mkt = markets[market];
        uint16 baseFee = mkt.isGraduated ? postGradFeeBps : preGradFeeBps;

        // Get agent reputation
        (, uint8 avgScore) = reputationRegistry.getSummary(
            agentId,
            new address[](0),
            REPUTATION_TAG,
            ""
        );

        // No discount if below threshold
        if (avgScore < minReputationForDiscount) {
            return baseFee;
        }

        // Linear discount: 50 rep = 0%, 100 rep = maxFeeDiscountBps
        // discount = (score - minRep) / (100 - minRep) * maxDiscountBps
        uint16 discountBps = uint16(
            (uint256(avgScore - minReputationForDiscount) * maxFeeDiscountBps) /
            (100 - minReputationForDiscount)
        );

        return baseFee > discountBps ? baseFee - discountBps : 0;
    }

    /**
     * @notice Give reputation feedback after trade settles
     * @dev Called by market settlement or permissionlessly after deadline
     */
    function giveAgentFeedback(
        address market,
        uint256 agentId,
        uint8 score,
        string calldata feedbackURI
    ) external {
        // Only settled markets or market creator can give feedback
        ITruthMarket tm = ITruthMarket(market);
        require(tm.isSettled() || msg.sender == markets[market].creator, "Not authorized");

        reputationRegistry.giveFeedback(
            agentId,
            score,
            REPUTATION_TAG,
            "prediction",
            "",
            feedbackURI,
            keccak256(bytes(feedbackURI))
        );

        emit ReputationFeedbackGiven(market, agentId, score);
    }

    // ============================================
    // Owner Functions
    // ============================================

    function setIdentityRegistry(address _registry) external onlyOwner {
        identityRegistry = IIdentityRegistry(_registry);
    }

    function setReputationRegistry(address _registry) external onlyOwner {
        reputationRegistry = IReputationRegistry(_registry);
    }

    function setReputationParams(uint8 _minRep, uint16 _maxDiscountBps) external onlyOwner {
        require(_minRep <= 100, "Invalid min reputation");
        require(_maxDiscountBps <= 500, "Max discount too high"); // Cap at 5%
        minReputationForDiscount = _minRep;
        maxFeeDiscountBps = _maxDiscountBps;
    }
}
```

### 2.3 Fee Discount Model

Based on [dYdX](https://docs.dydx.xyz/concepts/trading/rewards) and [GMX](https://gov.gmx.io/t/trading-fee-discount-with-staked-gmx-mp/1365) tiered fee models:

| Reputation Score | Discount (bps, example) | Effective Fee Example (base 1%) |
|------------------|--------------------------|----------------------------------|
| 0-49 | 0 | 1.00% |
| 50-59 | 10 | 0.90% |
| 60-69 | 20 | 0.80% |
| 70-79 | 30 | 0.70% |
| 80-89 | 40 | 0.60% |
| 90-100 | 50 | 0.50% |

Note: `maxFeeDiscountBps` is an absolute reduction in basis points. The table assumes
a post-grad base fee of 1% (100 bps). With a 5% base fee, a 50 bps max discount yields 4.5%.

```
Fee Formula (basis points):
  discountBps = (score - minRep) * maxFeeDiscountBps / (100 - minRep)
  effectiveFeeBps = baseFeeBps > discountBps ? baseFeeBps - discountBps : 0
```

### 2.4 Contract Changes: TickBookPoolManager

```solidity
contract TickBookPoolManager is ReentrancyGuard, Ownable {
    // ... existing code ...

    IIdentityRegistry public identityRegistry;
    IReputationRegistry public reputationRegistry;

    /// @notice Per-market: agent-gating config
    mapping(bytes32 => AgentGateConfig) public agentGates;

    struct AgentGateConfig {
        bool isGated;
        uint8 minReputation;
    }

    /**
     * @notice Place order with agent identity
     */
    function placeOrderWithAgent(
        bytes32 marketKey,
        uint256 agentId,
        uint8 outcome,
        uint128 shares,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 maxCost
    ) external nonReentrant returns (uint256 orderId, uint128 filledShares, uint128 cost) {
        // Verify agent ownership
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotAgentOwner();

        // Check agent-gating
        AgentGateConfig storage gate = agentGates[marketKey];
        if (gate.isGated && gate.minReputation > 0) {
            (, uint8 avgScore) = reputationRegistry.getSummary(agentId, new address[](0), "sooth-trading", "");
            if (avgScore < gate.minReputation) revert InsufficientReputation(gate.minReputation, avgScore);
        }

        // Calculate fee with discount
        uint24 effectiveFee = _calculateFeeWithAgentDiscount(agentId);

        // Place order with adjusted fee
        return _placeOrderInternal(marketKey, msg.sender, outcome, shares, tickLower, tickUpper, maxCost, effectiveFee);
    }
}
```

---

## Review Notes (2026-01-19)

- Enforce agent gating in core trade/order paths to prevent bypass via non-agent calls.
- Use ERC-8004 agent wallet resolution (delegated wallet) instead of relying on NFT owner for auth.
- Fee discount examples assume post-grad base fee; see Section 2.3 for absolute bps semantics.

---

## Part 3: AI Adjudicators with TEE Validation

V11 priority: implement the adjudicator validation flow (ValidatedAdjudicator + registry gating).

### 3.1 Architecture

AI agents can serve as adjudicators (oracles) for Sooth markets, with trust established via:

1. **Identity**: Agent registered in ERC-8004 Identity Registry
2. **Reputation**: Historical accuracy tracked in Reputation Registry
3. **Validation**: TEE attestations or zkML proofs in Validation Registry

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI Adjudicator Trust Flow                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐         ┌──────────────┐         ┌────────────┐ │
│   │   AI Agent   │────────►│  Data Source │────────►│  Decision  │ │
│   │  (Adjudic.)  │         │  (APIs, etc) │         │  (0/1/2)   │ │
│   └──────────────┘         └──────────────┘         └──────────────┘ │
│          │                                                   │       │
│          │                                                   │       │
│          ▼                                                   ▼       │
│   ┌──────────────┐         ┌──────────────┐         ┌────────────┐ │
│   │    ROFL     │────────►│  Validation  │────────►│TruthMarket │ │
│   │ (TEE/zkML)  │         │   Registry   │         │  .settle() │ │
│   └──────────────┘         └──────────────┘         └────────────┘ │
│                                                                      │
│   Trust Guarantee: TEE attestation proves agent ran specific code    │
│   on specific inputs to produce the settlement decision.             │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 ROFL Integration (Oasis Network)

Based on [Oasis ROFL](https://docs.oasis.io/adrs/0024-off-chain-runtime-logic/) specification:

```solidity
// ValidatedAdjudicator.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {IValidationRegistry} from "./interfaces/IValidationRegistry.sol";

/**
 * @title ValidatedAdjudicator
 * @notice Adjudicator that requires TEE validation before settlement
 * @dev Integrates with ERC-8004 Validation Registry for attestations
 */
contract ValidatedAdjudicator {
    // ============================================
    // State
    // ============================================

    IValidationRegistry public immutable validationRegistry;

    /// @notice Minimum validation score to proceed (0-100)
    uint8 public minValidationScore = 80;

    /// @notice Approved TEE validators (ROFL operators)
    mapping(address => bool) public approvedValidators;

    /// @notice Pending settlements awaiting validation
    mapping(bytes32 => PendingSettlement) public pendingSettlements;

    struct PendingSettlement {
        address market;
        uint8 outcome;
        uint64 tStar;
        bytes32 validationRequestHash;
        bool validated;
        uint64 requestedAt;
    }

    // ============================================
    // Events
    // ============================================

    event SettlementRequested(
        address indexed market,
        uint8 outcome,
        bytes32 indexed validationRequestHash
    );

    event SettlementValidated(
        address indexed market,
        bytes32 indexed validationRequestHash,
        uint8 validationScore
    );

    event SettlementExecuted(
        address indexed market,
        uint8 outcome,
        bytes32 indexed validationRequestHash
    );

    // ============================================
    // Constructor
    // ============================================

    constructor(address _validationRegistry) {
        validationRegistry = IValidationRegistry(_validationRegistry);
    }

    // ============================================
    // Settlement Flow
    // ============================================

    /**
     * @notice Request settlement with validation
     * @param market Market to settle
     * @param outcome Proposed outcome (0=NO, 1=YES, 2=INVALID)
     * @param tStar Retroactive truth time (0 if not applicable)
     * @param dataSourceURI URI to data used for decision
     * @param validator TEE validator address
     */
    function requestSettlement(
        address market,
        uint8 outcome,
        uint64 tStar,
        string calldata dataSourceURI,
        address validator
    ) external returns (bytes32 requestHash) {
        require(approvedValidators[validator], "Validator not approved");

        // Create validation request
        string memory requestURI = string(abi.encodePacked(
            "sooth://settle/",
            _addressToString(market),
            "?outcome=",
            _uint8ToString(outcome),
            "&data=",
            dataSourceURI
        ));

        requestHash = keccak256(abi.encodePacked(market, outcome, block.timestamp));

        // Register with ERC-8004 Validation Registry
        validationRegistry.validationRequest(
            validator,
            0, // agentId (can be this contract's agent ID if registered)
            requestURI,
            requestHash
        );

        // Store pending settlement
        pendingSettlements[requestHash] = PendingSettlement({
            market: market,
            outcome: outcome,
            tStar: tStar,
            validationRequestHash: requestHash,
            validated: false,
            requestedAt: uint64(block.timestamp)
        });

        emit SettlementRequested(market, outcome, requestHash);
    }

    /**
     * @notice Execute settlement after validation
     * @param requestHash Settlement request hash
     */
    function executeSettlement(bytes32 requestHash) external {
        PendingSettlement storage pending = pendingSettlements[requestHash];
        require(pending.market != address(0), "Settlement not found");
        require(!pending.validated, "Already executed");

        // Check validation status
        (
            address validator,
            ,
            uint8 response,
            string memory tag,
            uint256 lastUpdate
        ) = validationRegistry.getValidationStatus(requestHash);

        require(response >= minValidationScore, "Validation score too low");
        require(lastUpdate > pending.requestedAt, "Not yet validated");

        // Mark as validated
        pending.validated = true;

        emit SettlementValidated(pending.market, requestHash, response);

        // Execute settlement on TruthMarket
        ITruthMarket(pending.market).settle(pending.outcome, pending.tStar);

        emit SettlementExecuted(pending.market, pending.outcome, requestHash);
    }

    // ============================================
    // Admin
    // ============================================

    function setApprovedValidator(address validator, bool approved) external {
        // Governance-controlled
        approvedValidators[validator] = approved;
    }

    function setMinValidationScore(uint8 score) external {
        require(score <= 100, "Invalid score");
        minValidationScore = score;
    }

    // ============================================
    // Helpers
    // ============================================

    function _addressToString(address addr) internal pure returns (string memory) {
        // Implementation omitted for brevity
    }

    function _uint8ToString(uint8 val) internal pure returns (string memory) {
        // Implementation omitted for brevity
    }
}
```

### 3.3 ROFL Validator Implementation (Off-Chain)

```typescript
// rofl-sooth-validator/src/index.ts
// Runs inside Oasis ROFL TEE enclave

import { OasisROFL, AttestationQuote } from '@oasis-network/rofl-sdk';
import { ValidationRegistry } from '@erc8004/sdk';

interface SettlementRequest {
  market: string;
  outcome: number;
  dataSourceURI: string;
  requestHash: string;
}

class SoothValidator {
  private rofl: OasisROFL;
  private validationRegistry: ValidationRegistry;

  async validateSettlement(request: SettlementRequest): Promise<void> {
    // 1. Fetch data from source
    const data = await this.fetchDataSource(request.dataSourceURI);

    // 2. Verify outcome matches data
    const isValid = this.verifyOutcome(request.outcome, data);

    // 3. Generate TEE attestation
    const attestation = await this.rofl.generateAttestation({
      data: {
        market: request.market,
        outcome: request.outcome,
        dataHash: this.hashData(data),
        timestamp: Date.now(),
      },
    });

    // 4. Submit validation response
    const score = isValid ? 100 : 0;
    await this.validationRegistry.validationResponse(
      request.requestHash,
      score,
      `ipfs://${attestation.cid}`,
      attestation.hash,
      'tee-settlement'
    );
  }

  private async fetchDataSource(uri: string): Promise<any> {
    // Fetch from price APIs, news sources, etc.
    // TEE ensures this code runs as expected
  }

  private verifyOutcome(outcome: number, data: any): boolean {
    // Verify the proposed outcome matches the data
    // E.g., "Did BTC hit $100k?" → check price data
  }
}
```

### 3.4 zkML Alternative (Future)

For computationally complex decisions, [zkML](https://blog.icme.io/the-definitive-guide-to-zkml-2025/) can verify ML model execution:

```
Use Case: AI agent uses ML model to determine outcome from ambiguous data

1. Agent runs ML inference off-chain
2. zkML generates ZK proof that:
   - Model M was used (MRENCLAVE hash)
   - Input I was provided
   - Output O was produced
3. Proof verified on-chain in Validation Registry
4. Settlement proceeds if proof valid
```

**Limitation:** zkML is currently too expensive for most use cases (2026 estimate: viable for high-value markets only).

---

## Part 4: x402 Trading API

### 4.1 Overview

Enable AI agents to trade on Sooth via HTTP requests using [x402 protocol](https://docs.cdp.coinbase.com/x402/welcome).

```
Agent                          Sooth API Server              Facilitator
  │                                   │                           │
  │── GET /markets ──────────────────►│                           │
  │◄─ 200 [list of markets] ──────────│                           │
  │                                   │                           │
  │── POST /trade ───────────────────►│                           │
  │   {market, outcome, shares}       │                           │
  │                                   │                           │
  │◄─ 402 Payment Required ───────────│                           │
  │   {amount: "10.50", asset: USDC}  │                           │
  │                                   │                           │
  │── POST /trade ───────────────────►│                           │
  │   X-PAYMENT: <signed payload>     │                           │
  │                                   │── verify ────────────────►│
  │                                   │◄─ valid ──────────────────│
  │                                   │── settle ────────────────►│
  │                                   │◄─ confirmed ──────────────│
  │◄─ 200 {txHash, shares, cost} ─────│                           │
```

### 4.2 API Specification

```typescript
// apps/api/src/routes/x402-trading.ts

import { x402Middleware, PaymentRequired } from '@x402/express';
import { LaunchpadEngine__factory } from '@sooth/contracts';

const router = express.Router();

// Configure x402 middleware
router.use(x402Middleware({
  facilitatorUrl: 'https://x402.cdp.coinbase.com',
  paymentAddress: SOOTH_TREASURY_ADDRESS,
}));

/**
 * @route GET /api/v1/markets
 * @description List all tradeable markets
 */
router.get('/markets', async (req, res) => {
  const markets = await indexer.getActiveMarkets();
  res.json({
    markets: markets.map(m => ({
      address: m.address,
      question: m.question,
      deadline: m.deadline,
      yesPrice: m.yesPrice,
      noPrice: m.noPrice,
      isGraduated: m.isGraduated,
      isAgentGated: m.isAgentGated,
      minReputation: m.minReputation,
    }))
  });
});

/**
 * @route GET /api/v1/markets/:address/quote
 * @description Get quote for a trade
 */
router.get('/markets/:address/quote', async (req, res) => {
  const { address } = req.params;
  const { outcome, shares } = req.query;

  const quote = await launchpadEngine.getQuote(address, outcome, shares);

  res.json({
    market: address,
    outcome: Number(outcome),
    shares: shares,
    cost: formatUnits(quote.cost, 6),
    fee: formatUnits(quote.fee, 6),
    priceImpact: quote.priceImpact,
    totalUSDC: formatUnits(quote.cost + quote.fee, 6),
  });
});

/**
 * @route POST /api/v1/trade
 * @description Execute a trade (x402 payment required)
 * @payment USDC on Base
 */
router.post('/trade', async (req, res) => {
  const { market, agentId, outcome, shares, maxCost } = req.body;

  // Get quote for payment amount
  const quote = await launchpadEngine.getQuote(market, outcome, shares);
  const paymentRequired = quote.cost + quote.fee;

  // Check if payment provided
  const payment = req.x402Payment;
  if (!payment || payment.amount < paymentRequired) {
    throw new PaymentRequired({
      amount: formatUnits(paymentRequired, 6),
      asset: 'USDC',
      network: 'eip155:8453', // Base
      recipient: SOOTH_ROUTER_ADDRESS,
      description: `Trade ${shares} ${outcome === 1 ? 'YES' : 'NO'} shares`,
    });
  }

  // Execute trade on-chain
  const tx = await soothRouter.tradeWithPayment(
    market,
    agentId,
    outcome,
    shares,
    maxCost,
    payment.proof
  );

  const receipt = await tx.wait();

  res.json({
    success: true,
    txHash: receipt.hash,
    shares: shares,
    cost: formatUnits(quote.cost, 6),
    fee: formatUnits(quote.fee, 6),
  });
});

/**
 * @route POST /api/v1/orderbook/order
 * @description Place orderbook order (x402 payment required)
 */
router.post('/orderbook/order', async (req, res) => {
  const {
    marketKey,
    agentId,
    outcome,
    shares,
    tickLower,
    tickUpper,
    maxCost
  } = req.body;

  // Calculate required collateral
  const collateral = calculateOrderCollateral(shares, tickLower, tickUpper);

  const payment = req.x402Payment;
  if (!payment || payment.amount < collateral) {
    throw new PaymentRequired({
      amount: formatUnits(collateral, 6),
      asset: 'USDC',
      network: 'eip155:8453',
      recipient: TICKBOOK_VAULT_ADDRESS,
      description: `Collateral for ${shares} share order`,
    });
  }

  // Deposit to vault and place order
  const tx = await tickBookRouter.placeOrderWithPayment(
    marketKey,
    agentId,
    outcome,
    shares,
    tickLower,
    tickUpper,
    maxCost,
    payment.proof
  );

  const receipt = await tx.wait();
  const orderId = parseOrderIdFromLogs(receipt.logs);

  res.json({
    success: true,
    txHash: receipt.hash,
    orderId: orderId,
    collateral: formatUnits(collateral, 6),
  });
});

export default router;
```

### 4.3 Smart Contract: x402 Router

```solidity
// SoothX402Router.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILaunchpadEngine} from "./interfaces/ILaunchpadEngine.sol";
import {ITickBookPoolManager} from "./interfaces/ITickBookPoolManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

/**
 * @title SoothX402Router
 * @notice Router for x402 payment-authenticated trades
 * @dev Receives USDC via x402 facilitator, executes trades
 */
contract SoothX402Router {
    ILaunchpadEngine public immutable launchpad;
    ITickBookPoolManager public immutable tickBook;
    IERC20 public immutable usdc;

    /// @notice x402 facilitator address (trusted to have settled payment)
    address public facilitator;

    /**
     * @notice Execute AMM trade with x402 payment proof
     * @dev Called by API server after x402 facilitator confirms payment
     */
    function tradeWithPayment(
        address market,
        uint256 agentId,
        uint8 outcome,
        int256 deltaShares,
        uint256 maxCost,
        bytes calldata paymentProof
    ) external returns (uint256 cost, uint256 fee) {
        // Verify caller is API server with valid payment proof
        require(_verifyPaymentProof(paymentProof), "Invalid payment");

        // USDC already transferred by facilitator
        // Execute trade
        (cost, fee) = launchpad.tradeWithAgent(market, agentId, outcome, deltaShares, maxCost);

        // Refund excess if any
        uint256 excess = maxCost - (cost + fee);
        if (excess > 0) {
            usdc.transfer(msg.sender, excess);
        }
    }

    /**
     * @notice Place orderbook order with x402 payment
     */
    function placeOrderWithPayment(
        bytes32 marketKey,
        uint256 agentId,
        uint8 outcome,
        uint128 shares,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 maxCost,
        bytes calldata paymentProof
    ) external returns (uint256 orderId) {
        require(_verifyPaymentProof(paymentProof), "Invalid payment");

        // Deposit to vault on behalf of agent owner
        address agentOwner = launchpad.identityRegistry().ownerOf(agentId);
        tickBook.vault().depositFor(agentOwner, maxCost);

        // Place order
        (orderId, , ) = tickBook.placeOrderWithAgent(
            marketKey,
            agentId,
            outcome,
            shares,
            tickLower,
            tickUpper,
            maxCost
        );
    }

    function _verifyPaymentProof(bytes calldata proof) internal view returns (bool) {
        // Verify x402 facilitator signature
        // Implementation depends on x402 spec
        return true; // Simplified
    }
}
```

### 4.4 Agent SDK

```typescript
// @sooth/agent-sdk

import { x402Client } from '@x402/fetch';

export class SoothAgentClient {
  private client: typeof fetch;
  private apiUrl: string;
  private agentId: bigint;
  private wallet: Wallet;

  constructor(config: {
    apiUrl: string;
    agentId: bigint;
    wallet: Wallet;
  }) {
    this.apiUrl = config.apiUrl;
    this.agentId = config.agentId;
    this.wallet = config.wallet;

    // Wrap fetch with x402 payment handling
    this.client = x402Client(fetch, {
      wallet: this.wallet,
      network: 'base',
    });
  }

  async getMarkets(): Promise<Market[]> {
    const res = await this.client(`${this.apiUrl}/api/v1/markets`);
    return res.json();
  }

  async getQuote(market: string, outcome: 0 | 1, shares: bigint): Promise<Quote> {
    const res = await this.client(
      `${this.apiUrl}/api/v1/markets/${market}/quote?outcome=${outcome}&shares=${shares}`
    );
    return res.json();
  }

  async trade(params: {
    market: string;
    outcome: 0 | 1;
    shares: bigint;
    maxCost: bigint;
  }): Promise<TradeResult> {
    // x402 automatically handles 402 response and payment
    const res = await this.client(`${this.apiUrl}/api/v1/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        market: params.market,
        agentId: this.agentId.toString(),
        outcome: params.outcome,
        shares: params.shares.toString(),
        maxCost: params.maxCost.toString(),
      }),
    });

    return res.json();
  }

  async placeOrder(params: {
    marketKey: string;
    outcome: 0 | 1;
    shares: bigint;
    tickLower: number;
    tickUpper: number;
    maxCost: bigint;
  }): Promise<OrderResult> {
    const res = await this.client(`${this.apiUrl}/api/v1/orderbook/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketKey: params.marketKey,
        agentId: this.agentId.toString(),
        ...params,
      }),
    });

    return res.json();
  }
}

// Usage example
const agent = new SoothAgentClient({
  apiUrl: 'https://api.sooth.markets',
  agentId: 12345n,
  wallet: new Wallet(process.env.AGENT_PRIVATE_KEY),
});

// Trade automatically handles x402 payment flow
const result = await agent.trade({
  market: '0x...',
  outcome: 1, // YES
  shares: parseUnits('100', 18),
  maxCost: parseUnits('50', 6), // 50 USDC max
});
```

---

## Part 5: Meta-Markets for AI Agent Performance

### 5.1 Concept

Create prediction markets about AI agent performance, enabling:
- **Forward-looking reputation**: Market prices predict future performance
- **Reputation discovery**: Crowdsourced evaluation of new agents
- **Incentive alignment**: Agents with skin in the game perform better

### 5.2 Market Types

| Market Type | Example Question | Resolution |
|------------|------------------|------------|
| **Task Completion** | "Will Agent X complete 100 tasks with >90% satisfaction by March 1?" | Check Reputation Registry |
| **Accuracy** | "Will Agent Y's predictions be >70% accurate over next 30 days?" | Aggregate market outcomes |
| **Uptime** | "Will Agent Z maintain 99% uptime for February?" | Monitor endpoint health |
| **Security** | "Will Agent W pass security audit without critical findings?" | Audit report |

### 5.3 Implementation: AgentPerformanceMarketFactory

```solidity
// AgentPerformanceMarketFactory.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILaunchpadEngine} from "./interfaces/ILaunchpadEngine.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {IReputationRegistry} from "./interfaces/IReputationRegistry.sol";

/**
 * @title AgentPerformanceMarketFactory
 * @notice Factory for creating prediction markets about AI agent performance
 */
contract AgentPerformanceMarketFactory {
    ILaunchpadEngine public immutable launchpad;
    IIdentityRegistry public immutable identityRegistry;
    IReputationRegistry public immutable reputationRegistry;

    /// @notice Market type identifiers
    uint8 public constant TYPE_TASK_COMPLETION = 1;
    uint8 public constant TYPE_ACCURACY = 2;
    uint8 public constant TYPE_UPTIME = 3;
    uint8 public constant TYPE_SECURITY = 4;

    struct PerformanceMarket {
        address market;
        uint256 subjectAgentId;
        uint8 marketType;
        uint256 targetValue;      // e.g., 90 for 90% satisfaction
        uint64 evaluationStart;
        uint64 evaluationEnd;
    }

    mapping(address => PerformanceMarket) public performanceMarkets;

    event PerformanceMarketCreated(
        address indexed market,
        uint256 indexed subjectAgentId,
        uint8 marketType,
        uint256 targetValue
    );

    /**
     * @notice Create a task completion market
     * @param subjectAgentId Agent being evaluated
     * @param taskCount Target number of tasks
     * @param minSatisfaction Minimum satisfaction score (0-100)
     * @param evaluationEnd When to evaluate
     * @param initialLiquidity Initial liquidity (LaunchpadEngine input)
     */
    function createTaskCompletionMarket(
        uint256 subjectAgentId,
        uint256 taskCount,
        uint8 minSatisfaction,
        uint64 evaluationEnd,
        uint256 initialLiquidity
    ) external returns (address market) {
        // Verify agent exists
        require(identityRegistry.ownerOf(subjectAgentId) != address(0), "Agent not found");

        // Build question
        string memory question = string(abi.encodePacked(
            "Will Agent #",
            _toString(subjectAgentId),
            " complete ",
            _toString(taskCount),
            " tasks with >",
            _toString(minSatisfaction),
            "% satisfaction by deadline?"
        ));

        // Create market
        market = launchpad.createMarket(
            question,
            0,             // start now
            evaluationEnd,
            address(this), // This contract is adjudicator
            msg.sender,    // Creator is guardian
            initialLiquidity
        );

        // Store metadata
        performanceMarkets[market] = PerformanceMarket({
            market: market,
            subjectAgentId: subjectAgentId,
            marketType: TYPE_TASK_COMPLETION,
            targetValue: (uint256(taskCount) << 8) | minSatisfaction,
            evaluationStart: uint64(block.timestamp),
            evaluationEnd: evaluationEnd
        });

        emit PerformanceMarketCreated(market, subjectAgentId, TYPE_TASK_COMPLETION, taskCount);
    }

    /**
     * @notice Settle a task completion market
     * @param market Market address
     */
    function settleTaskCompletionMarket(address market) external {
        PerformanceMarket storage pm = performanceMarkets[market];
        require(pm.marketType == TYPE_TASK_COMPLETION, "Wrong market type");
        require(block.timestamp >= pm.evaluationEnd, "Too early");

        uint256 targetTasks = pm.targetValue >> 8;
        uint8 minSatisfaction = uint8(pm.targetValue);

        // Query reputation registry
        (uint64 taskCount, uint8 avgScore) = reputationRegistry.getSummary(
            pm.subjectAgentId,
            new address[](0),
            "task-completion",
            ""
        );

        // Determine outcome
        uint8 outcome;
        if (taskCount >= targetTasks && avgScore >= minSatisfaction) {
            outcome = 1; // YES
        } else {
            outcome = 0; // NO
        }

        // Settle market
        ITruthMarket(market).settle(outcome, 0);
    }

    /**
     * @notice Create an accuracy market for trading agents
     */
    function createAccuracyMarket(
        uint256 subjectAgentId,
        uint8 targetAccuracy,    // e.g., 70 for 70%
        uint64 evaluationEnd,
        uint256 initialLiquidity
    ) external returns (address market) {
        // Similar implementation...
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        // Implementation omitted
    }
}
```

### 5.4 Automated Settlement via Keeper

```typescript
// packages/keeper/src/agent-market-settler.ts

import { AgentPerformanceMarketFactory__factory } from '@sooth/contracts';

export class AgentMarketSettler {
  async checkAndSettle(): Promise<void> {
    const markets = await this.indexer.getUnsettledPerformanceMarkets();

    for (const market of markets) {
      if (market.evaluationEnd <= Date.now() / 1000) {
        await this.factory.settleTaskCompletionMarket(market.address);
        console.log(`Settled performance market: ${market.address}`);
      }
    }
  }
}
```

---

## Part 6: Full Integration Roadmap

### 6.1 Combined V11 + ERC-8004 Roadmap

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         V11 + ERC-8004 Roadmap                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Phase 1: V10.9 Foundation (Weeks 1-3)                                  │
│  ├── Trial period mechanics (from V11 plan)                             │
│  ├── lockedCost / trialBalance tracking                                 │
│  ├── dismissMarket() / claimRefund()                                    │
│  └── Frontend trial period UI                                           │
│                                                                          │
│  Phase 2: ERC-8004 Core (Weeks 4-6)                                     │
│  ├── Deploy/integrate Identity Registry                                  │
│  ├── Deploy/integrate Reputation Registry                                │
│  ├── Add tradeWithAgent() to LaunchpadEngine                            │
│  ├── Add placeOrderWithAgent() to TickBookPoolManager                   │
│  └── Implement reputation-weighted fees                                  │
│                                                                          │
│  Phase 3: V11.0 LP Tokens (Weeks 7-8)                                   │
│  ├── LaunchpadLPToken ERC20 contract                                    │
│  ├── Time-locked transfers until settlement                             │
│  ├── Frontend LP transfer UI                                            │
│  └── Migration tooling for legacy markets                               │
│                                                                          │
│  Phase 4: x402 API (Weeks 9-10)                                         │
│  ├── SoothX402Router contract                                           │
│  ├── x402 Express middleware                                            │
│  ├── API endpoints (/trade, /orderbook/order)                           │
│  └── Agent SDK (@sooth/agent-sdk)                                       │
│                                                                          │
│  Phase 5: AI Adjudicators (Weeks 11-13)                                 │
│  ├── Deploy/integrate Validation Registry                               │
│  ├── ValidatedAdjudicator contract                                      │
│  ├── ROFL validator setup (Oasis)                                       │
│  └── Testnet validation flow                                            │
│                                                                          │
│  Phase 6: Meta-Markets (Weeks 14-15)                                    │
│  ├── AgentPerformanceMarketFactory                                      │
│  ├── Task completion market type                                        │
│  ├── Automated settlement keeper                                        │
│  └── Frontend agent market UI                                           │
│                                                                          │
│  Phase 7: Security & Launch (Weeks 16-18)                               │
│  ├── Security review (all new contracts)                                │
│  ├── Gas optimization                                                   │
│  ├── Documentation                                                      │
│  ├── Testnet deployment                                                 │
│  └── Mainnet launch planning                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Dependency Graph

```
                    ┌─────────────────────┐
                    │  ERC-8004 Registries │
                    │  (Identity, Rep, Val)│
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
┌──────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Agent-Gated     │ │  AI Adjudicators │ │  Meta-Markets   │
│  Markets         │ │  (TEE/zkML)      │ │  (Performance)  │
└────────┬─────────┘ └────────┬────────┘ └────────┬────────┘
         │                    │                   │
         ▼                    ▼                   │
┌──────────────────┐ ┌─────────────────┐          │
│  Reputation-     │ │  x402 API       │          │
│  Weighted Fees   │ │  (Agent Trading)│◄─────────┘
└────────┬─────────┘ └────────┬────────┘
         │                    │
         └────────┬───────────┘
                  │
                  ▼
         ┌───────────────┐
         │  V11 Core     │
         │  (Trial, LP)  │
         └───────────────┘
```

### 6.3 Contract Deployment Order

```
1. ERC-8004 Registries (external or deploy fresh)
   - IdentityRegistry
   - ReputationRegistry
   - ValidationRegistry

2. Core V11 Contracts
   - LaunchpadEngine (upgraded with ERC-8004 hooks)
   - LaunchpadLPToken (new)
   - TickBookPoolManager (upgraded with ERC-8004 hooks)

3. Integration Contracts
   - SoothX402Router
   - ValidatedAdjudicator
   - AgentPerformanceMarketFactory

4. Configuration
   - Set registry addresses on LaunchpadEngine
   - Set registry addresses on TickBookPoolManager
   - Set registrar on ValidatedAdjudicator
   - Approve ROFL validators
```

### 6.4 Testing Requirements

#### Unit Tests
- [ ] `tradeWithAgent()` verifies agent ownership
- [ ] `tradeWithAgent()` checks reputation threshold
- [ ] `_calculateFeeWithDiscount()` returns correct discount
- [ ] `placeOrderWithAgent()` for TickBook
- [ ] `ValidatedAdjudicator.requestSettlement()` creates request
- [ ] `ValidatedAdjudicator.executeSettlement()` requires validation
- [ ] `AgentPerformanceMarketFactory.settleTaskCompletionMarket()`

#### Integration Tests
- [ ] Full flow: register agent → trade → feedback → fee discount
- [ ] Full flow: request settlement → ROFL validation → execute
- [ ] Full flow: x402 payment → trade execution
- [ ] Meta-market: create → trade → auto-settle

#### Invariant Tests
- [ ] Fee discount never exceeds maxFeeDiscountBps
- [ ] Agent-gated markets reject non-registered agents
- [ ] Validation score ≥ minValidationScore for settlement

---

## Part 7: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ERC-8004 registry not deployed on target chain | Medium | High | Deploy our own or use bridge |
| Agent Sybil attacks (fake agents farming reputation) | Medium | Medium | x402 payment proofs, stake requirements |
| ROFL validator collusion | Low | High | Multiple validators, slashing |
| zkML proof generation too expensive | High | Medium | Use TEE for now, zkML for high-value only |
| x402 facilitator downtime | Low | Medium | Fallback to direct wallet trading |
| Gas cost increase from registry queries | Medium | Low | Cache reputation, batch queries |

---

## Part 8: Open Questions

1. **Registry Deployment**: Deploy fresh ERC-8004 registries or integrate with existing (if available on Base)?
   - **Recommendation**: Check Base ecosystem first, deploy fresh if needed

2. **Minimum Reputation for Discount**: What threshold?
   - **Recommendation**: Start at 50, adjust based on data

3. **ROFL vs zkML**: Which validation method to prioritize?
   - **Recommendation**: ROFL (TEE) first, zkML for V12

4. **Meta-Market Categories**: What types to support initially?
   - **Recommendation**: Task completion only for V11, expand in V12

5. **x402 Payment Chains**: Base only or multi-chain?
   - **Recommendation**: Base mainnet for V11, expand to other L2s

6. **KYC/Compliance Gating**: Should agent gating be extended to support compliance?
   - **Recommendation**: Defer to post-V11; possible extension of agent gating

---

## References

- [ERC-8004 Official EIP](https://eips.ethereum.org/EIPS/eip-8004)
- [x402 GitHub](https://github.com/coinbase/x402)
- [x402 Documentation](https://docs.cdp.coinbase.com/x402/welcome)
- [Oasis ROFL ADR-0024](https://docs.oasis.io/adrs/0024-off-chain-runtime-logic/)
- [zkML Guide 2025](https://blog.icme.io/the-definitive-guide-to-zkml-2025/)
- [dYdX Fee Structure](https://docs.dydx.xyz/concepts/trading/rewards)
- [GMX Fee Proposal](https://gov.gmx.io/t/trading-fee-discount-with-staked-gmx-mp/1365)
- [V11 User/Market Flow Plan](./user-market-flow-refactoring-v11.md)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-19 | Initial comprehensive spec created |
