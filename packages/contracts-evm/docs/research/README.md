# Research Notes

This directory contains research findings, analysis, and technical investigations for the Sooth Protocol.

## Active Research (V8 Modular Stack)

These documents represent the core architectural convergence for the next-generation Sooth venue stack.

### 1. [V8 Modular Architecture](./V8/V8_MODULAR_ARCHITECTURE.md)
**Priority:** 🔥 **CRITICAL**  
Canonical writeup of the V8 modular stack (TruthMarket + AMMEngine + TickBook + Collateralizer) and the key domain-separation decisions.

### 2. [V8 Launchpad Architecture](./V8/V8_LAUNCHPAD_ARCHITECTURE.md)
**Priority:** 🔥 **HIGH**  
Creator-economics layer design (LaunchpadEngine) and how it wraps the pure AMM engine.

### 3. [V8 Frontend Integration Guide](./V8/V8_FRONTEND_INTEGRATION_GUIDE.md)
**Priority:** 🔥 **HIGH**  
Practical integration notes and conventions for wiring contracts → frontend.

### 4. [V8 Gas Optimization Review](./V8/V8_GAS_OPTIMIZATION_REVIEW.md)
**Priority:** ✅ **REVIEWED**  
Gas review notes and optimization opportunities.

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
