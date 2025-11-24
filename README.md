# Sooth Protocol (Upgradeable, Balanced Skeleton)

This repo contains an upgradeable skeleton of the Sooth protocol contracts:

- `SoothVault` — singleton collateral & LP vault (upgradeable).
- `SoothMarket` — binary prediction market using a simplified LMSR-like vAMM.
- `SoothLMSR` — **placeholder** LMSR math (approximate, not production ready).
- `SoothAdjudicatorManager` — adjudicator registry and resolution routing.
- `SoothSettlementMerkle` + `SoothZKVerifierStub` — Merkle-based ZK settlement stub.
- `SoothMarketFactory` — market deployment factory.

> **Important:** The LMSR math and ZK verification are intentionally simplified for testing and architecture exploration.  
> Replace these parts with production-grade implementations and run full audits before deploying to mainnet.

This layout is compatible with both **Hardhat** and **Foundry**.
