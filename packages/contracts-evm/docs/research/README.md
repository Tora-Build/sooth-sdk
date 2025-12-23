# Research Notes

This directory contains research findings, analysis, and technical investigations for the Sooth Protocol.

## Active Research (V8 Modular Stack)

These documents represent the core architectural convergence for the next-generation Sooth venue stack.

### 1. [Architectural Consensus Summary](./V8/RESEARCH_SUMMARY_MODULAR_STACK.md)
**Priority:** 🔥 **CRITICAL**  
Summary of the tri-modular stack (Truth Market + AMM Engine + OB Venue) and the fundamental non-fungible domain decision.

### 2. [Modular Venue Stack Specification](./V8/MODULAR_VENUE_STACK.md)
**Priority:** 🔥 **HIGH**  
Full specification for the decoupled architecture, standard interfaces, and self-contained OB venue mechanics.

### 3. [Continuous Linear Ticks (CLT) Math](./V8/CONTINUOUS_LINEAR_TICK_RESEARCH.md)
**Priority:** 🔥 **HIGH**  
Technical deep-dive into the "Fungible Concentrated Liquidity" model and the math for linear probability ticks.

### 4. [Design Review: Modular Stack](./V8/MODULAR_VENUE_STACK_REVIEW.md)
**Priority:** ✅ **REVIEWED**  
Comprehensive design review of the modular stack proposal with identified gaps and phased next steps.

---

## Supporting Research & Priorities

### 1. [Guardian Staking & Security](./STAKING_DESIGN.md)
**Priority:** 🛡️ **MEDIUM**  
Design for the Guardian staking system, including slashing conditions and incentive alignment for decentralized monitoring.

### 2. [AMM-Indexed Dynamic Orderbook Fees](./DYNAMIC_OB_FEES.md)
**Priority:** 💸 **MEDIUM**  
Research into tightening the spread between the Orderbook and AMM using AMM-indexed dynamic fee logic.

### 3. [Partnership Integrations](./partnership/)
- [**Brevis ZK-Settlement**](./partnership/Brevis/): Retroactive ZK-proven settlement and truth-time verification.
- [**Solana Expansion**](./partnership/Solana/): Exploratory research for cross-chain liquidity and incubator applications.

---

## Folders

- [**Archive**](./archive/) — Completed research pieces and implemented feature specifications.
- [**Abandoned**](./abandoned/) — Historical models or superseded architectural paths.

---

## Contributing Research

When adding new research documents:
1. Use descriptive, uppercase filenames with underscores.
2. Include date, status, and priority at the top.
3. Provide a clear executive summary and implementation impact.
4. Move completed docs to the `/archive` folder to keep the root directory focused.
