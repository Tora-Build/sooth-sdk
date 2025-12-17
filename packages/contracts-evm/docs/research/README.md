# Research Notes

This directory contains research findings, analysis, and technical investigations for the Sooth Protocol.

## Documents

### [Risk-Liquidity Trade-off](./RISK_LIQUIDITY_TRADEOFF.md)

**Date:** 2025-11-30  
**Status:** Critical Finding

Analysis of the fundamental trade-off in prediction market design: higher risk markets require more liquidity for good UX, but this increases vault exposure and maximum loss potential.

**Key Insights:**

- HIGH risk markets get 3x more liquidity than LOW risk markets
- This improves trader experience but increases LP risk exposure
- Trade-off is justified for testnet but requires safeguards for mainnet
- Adjudicator quality becomes critical for high-liquidity markets

**Relevant for:**

- Risk management configuration
- LP protection strategies
- Mainnet deployment planning
- Capital adequacy requirements

---

### [Roadmap Review & Strategic Analysis](./ROADMAP_REVIEW.md)

**Date:** 2025-12-01  
**Status:** Strategic Planning

Comprehensive review of the proposed development roadmap, evaluating priorities, timelines, and strategic recommendations against the current state of the Sooth Protocol.

**Key Insights:**

- Strong foundation with ~70% core protocol complete
- Recommended 6-9 month timeline to mainnet (vs. original 9-12 months)
- Guardian system should be Priority 1 (key differentiator)
- Defer ZK integration to post-mainnet (ship solid v1 first)
- Security and UX polish are critical for launch

**Relevant for:**

- Development planning and prioritization
- Resource allocation and budgeting
- Mainnet launch strategy
- Fundraising and team building

---

### [Fix LMSR Implementation](./FIX_LMSR_IMPLEMENTATION.md)

**Date:** Earlier  
**Status:** Technical Note

Technical notes on LMSR implementation fixes.

---

---

### [Fee Design Research](./FEE_DESIGN.md)

**Date:** 2025-12-02  
**Status:** Proposal

Proposal for a volume-based trading fee model to incentivize LPs, fund the protocol, and reward guardians.

**Key Insights:**

- Current protocol has zero explicit fees (unsustainable).
- Recommend **2% trading fee** on volume.
- **Split:** 50% LPs, 30% Protocol, 20% Guardians.
- Requires updates to `SoothMarket` and `SoothVault`.

---

---

### [Staking Design Research](./STAKING_DESIGN.md)

**Date:** 2025-12-02  
**Status:** Proposal

Proposal for a dual-token staking model: Guardian Staking (security) and LP Staking (liquidity).

**Key Insights:**

- **Guardian Staking:** Required for security. USDC-based initially. Slashing for malicious behavior.
- **LP Staking:** Incentivizes long-term liquidity. Earns governance weight.
- **MVP:** Simple `SoothGuardianStaking` contract with USDC.

---

---

### [Access & Config Reference](./ACCESS_AND_CONFIG.md)

**Date:** 2025-12-02  
**Scope:** Core Contracts

Detailed reference of access control roles, modifiers, and configuration parameters for `SoothVault`, `SoothMarket`, and `SoothRiskManager`.

---

---

### [Liquidity Dynamics & Update Mechanics](./LIQUIDITY_DYNAMICS.md)

**Date:** 2025-12-02  
**Status:** Technical Specification

Explains how LP deposits/withdrawals affect market liquidity depth and the update lag issue.

**Key Insights:**

- `bGlobal` is NOT auto-updated on deposit/withdraw.
- Creates lag between TVL changes and market pricing.
- **Keeper bot opportunity**: Monitor TVL and trigger `updateGlobalB()`.

---

### [ln(2) Constants Reference](./LN2_CONSTANTS_REFERENCE.md)

**Date:** 2025-12-17  
**Status:** Reference Document

Comprehensive reference for safe Solidity constants for `ln(2)` across different numeric domains (WAD, RAY, PRBMath types).

**Key Insights:**

- Provides standardized constants for `uint256`, `int256`, `sd59x18`, `ud60x18`, and RAY precision
- Documents usage patterns for max loss, creator deposits, and fee-to-liquidity conversions
- Includes verification methods and inverse constant (1/ln(2))

**Relevant for:**

- LMSR calculations
- Launchpad model implementations
- Max loss calculations
- Fee-to-liquidity conversions

---

## Contributing Research

When adding new research documents:

1. Use descriptive, uppercase filenames with underscores
2. Include date and status at the top
3. Provide clear executive summary
4. Link to relevant code/contracts
5. Update this README with a summary
6. Tag with relevant categories (risk, economics, technical, etc.)

## Categories

- **Risk Management:** RISK_LIQUIDITY_TRADEOFF.md
- **Technical Implementation:** FIX_LMSR_IMPLEMENTATION.md, ACCESS_AND_CONFIG.md
- **Strategic Planning:** ROADMAP_REVIEW.md
- **Economics:** FEE_DESIGN.md
- **Security:** STAKING_DESIGN.md
- **Governance:** (future)
