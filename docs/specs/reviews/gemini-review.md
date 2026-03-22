# Gemini Protocol Review: V12 Specifications

> **Scope**: Layer 1 (Core), Layer 2 (Adjudicator), Layer 3 (Creator), and Trading Engine.
> **Version**: 0.1.0 (Draft)
> **Reviewer**: Gemini CLI (Autonomous Agent)
> **Date**: 2026-03-08

---

## 1. Executive Summary

The transition from V11 to **Sooth Protocol V12** represents a major architectural shift toward **modularity, scalability, and simplified collateral management**. By removing the `Collateralizer` (and its complex ERC20 `OutcomeTokens`) in favor of internal position management and a shared `Matching Engine`, the protocol significantly reduces gas overhead while enabling high-performance trading via off-chain CLOBs.

### Key Architectural Shifts
- **Internal Positions**: Removing native ERC20 transferability for shares simplifies the matching logic and significantly reduces the "mint/burn" gas costs.
- **Unified Matching Engine**: A single on-chain entry point for both **SoothBook (on-chain)** and **CLOB (off-chain)** ensures shared liquidity and uniform settlement.
- **Dynamic Fee Router**: Moving fee logic out of the `LaunchpadEngine` into a dedicated `FeeRouter` allows for flexible, instance-wide fee management without redeploying the core engine.

---

## 2. Review of Core Specification Layers

### **Layer 1: Core Protocol (Settlement)**
*   **Infrastructure**: The use of **CREATE3 via CreateX** is highly recommended for cross-chain address parity, which is essential for multi-chain liquidity.
*   **Safety**: The listed system invariants (e.g., "bBase must always grow") are comprehensive.
*   **Omissions**: I suggest including a formal "Invariants" section in the codebase (using `forge` invariant tests) to programmatically enforce the rules described in this spec.

### **Layer 2: Adjudicator (Truth)**
*   **Modular Design**: The 3-phase resolution (`resolve` → `verifyAttestation` → `settle`) is excellent. It allows for a standardized interface across wildly different trust models (ZkTLS vs. Manual).
*   **Guardian Management**: Moving guardians from a global config to the `AdjudicatorBase` is a major win for modularity. It ensures that users of a specific adjudicator trust the guardians monitoring that specific truth source.

### **Layer 3: Creator (Markets)**
*   **Initial Odds Logic**: The logit-based implementation for custom starting odds is a mathematically sound way to seed markets without the need for artificial "virtual trades."
*   **Economics**: Linking the creator's deposit directly to LP tokens (1:1 WAD) simplifies the incentive alignment. Creators earn from market growth (LP yield) and have skin in the game (floor value exposure).
*   **Correction**: In Section 12, `graduationBps` is erroneously listed under "Operator-Set." It should be correctly marked as a **Creator-set** parameter.

### **Trading Engine (Matching)**
*   **SoothBook (On-chain)**: The tick-based system (`1-999`) and O(1) bitmap discovery provide a high-efficiency on-chain book. The `escrow` flag is a clever way to handle position exits using a single "buy" primitive.
*   **CLOB (Off-chain)**: The shared `Matching Engine` logic ensures that even with off-chain matching, the **payout integrity** is verified on-chain via EIP-712 signatures. This is a critical security property.

---

## 3. Critical Path: Open Questions (OQs)

The following OQs from the specifications are identified as high-priority for the next engineering sprint:

| ID | Title | Priority | Impact |
|----|-------|----------|--------|
| **OQ-5** | CLOB Bridge | **High** | Critical for trust-minimized off-chain trading. |
| **OQ-7** | Operator Hooks | **Med** | Needed for institutional/private market support. |
| **OQ-13** | Resolution Steps | **High** | Gas optimization vs. Veto window security tradeoff. |

---

## 4. Conclusion & Recommendation

The V12 specification is architecturally robust and ready for implementation. It addresses the scalability bottlenecks seen in V11 while providing a more flexible foundation for professional market makers.

**Recommendation**: Proceed to implementation, prioritizing the **shared Matching Engine contract** as the anchor for both on-chain and off-chain venues.

---

*End of Review*
