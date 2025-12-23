# Research Notes

This directory contains research findings, analysis, and technical investigations for the Sooth Protocol.

## Active Research & Priorities

These documents represent active design discussions and high-priority upcoming features.

### 1. [Modular Venue Stack (Truth Market + AMM Engine + OB Venue)](./MODULAR_VENUE_STACK.md)
**Priority:** 🔥 **HIGH**  
**Status:** Design Phase (V7+)  
Modular redesign: extract a self-contained OB venue (tick book, linear probability ticks) while keeping AMM as a non-transferable position domain, and making `TraderVault` optional/logicless.

### 2. [Guardian Staking & Security](./STAKING_DESIGN.md)
**Priority:** 🛡️ **MEDIUM**  
**Status:** Proposal / Roadmap  
Design for the Guardian staking system, including slashing conditions and incentive alignment for market marking and dispute resolution.

### 3. [AMM-Indexed Dynamic Orderbook Fees](./DYNAMIC_OB_FEES.md)
**Priority:** 💸 **MEDIUM**  
**Status:** Draft  
Research into tightening the spread between the Orderbook and AMM by using the AMM price as a reference for dynamic execution fees.

### 4. [Brevis ZK-Settlement Integration](./Partnership/Brevis/)
**Priority:** ⛓️ **MEDIUM**  
**Status:** In Progress  
Ongoing technical integration with Brevis for retroactive ZK-proven settlement and truth-time (\(T^*\)) verification.

---

## Folders

- [**Archive**](./archive/) — Completed research pieces and implemented feature specifications.
- [**Abandoned**](./abandoned/) — Historical models or superseded architectural paths.
- [**Partnership**](./Partnership/) — Research and drafts related to external ecosystem integrations (Brevis, Solana, etc.).

---

## Contributing Research

When adding new research documents:
1. Use descriptive, uppercase filenames with underscores.
2. Include date, status, and priority at the top.
3. Provide a clear executive summary and implementation impact.
4. Move older, completed docs to the `/archive` folder to keep the root directory focused.
