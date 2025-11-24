# Sooth Protocol - Fullstack Skeleton v2 (Upgradeable + Foundry + Hardhat)

This repo includes:

- Upgradeable core contracts:
  - `SoothVault` — singleton collateral & LP vault with per-adjudicator pools.
  - `SoothMarket` — binary prediction market with a simplified LMSR-like vAMM.
  - `SoothAdjudicatorManager` — adjudicator registry and resolution routing (guardian + adapters).
  - `SoothMarketFactory` — deploys and wires markets into the vault & adjudicator manager.

- Settlement layer:
  - `SoothSettlementMerkle` + `SoothZKVerifierStub` — Merkle-based settlement with a stubbed zk verifier.

- Math:
  - `SoothLMSR` — **simplified, non-production** LMSR-like pricing.
    - This is suitable for architecture & testnet experiments.
    - Replace it with a real fixed-point LMSR (e.g. using PRBMath) before mainnet.

- Tooling:
  - Hardhat config (`hardhat.config.ts`).
  - Foundry config (`foundry.toml`) and a basic test (`test/SoothMarket.t.sol`).
  - Minimal Next.js frontend stub (`frontend/`).
  - Basic subgraph schema (`graph/schema.graphql`).

## Warning

This is **not** a production-ready protocol:

- LMSR math is approximate.
- The zk verifier is a stub.
- No slashing, governance, or full oracle integrations are wired here.

Use this as a starting point to iterate toward the full Sooth design we discussed.
