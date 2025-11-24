# Sooth Protocol - Fullstack Skeleton v3 (Upgradeable + Tests + Frontend + Subgraph)

This repo includes:

- **Upgradeable core contracts**
  - `SoothVault` — singleton collateral & LP vault with per-adjudicator pools and LP balances.
  - `SoothMarket` — binary prediction market with simplified LMSR-like vAMM.
  - `SoothAdjudicatorManager` — adjudicator registry and resolution routing (guardian + adapters).
  - `SoothMarketFactory` — deploys and wires markets into the vault & adjudicator manager.
  - `SoothSmartAccount` — optional per-user smart account wrapper with cooldown helper.

- **Adjudicator adapters (stubs)**
  - `SoothAdjudicatorUMA` — UMA-style adapter.
  - `SoothAdjudicatorRealityETH` — Reality.eth-style adapter.
  - `SoothAdjudicatorChainlink` — Chainlink + off-chain rule adapter.
  - `SoothAdjudicatorAttestation` — attestation-based adjudicator.

- **Settlement layer**
  - `SoothSettlementMerkle` + `SoothZKVerifierStub` — Merkle-based settlement with a stubbed zk verifier.

- **Math**
  - `SoothLMSR` — **simplified, non-production** LMSR-like pricing used by `SoothMarket` for now.
  - `SoothLMSRReal` — interface skeleton for a PRBMath-based, production-grade LMSR (not implemented yet).

- **Tooling**
  - Hardhat config (`hardhat.config.ts`) + deployment script (`scripts/deploy-sooth.ts`).
  - Foundry config (`foundry.toml`) and tests:
    - `test/SoothMarket.t.sol` — basic buy/sell lifecycle test.
    - `test/SoothSettlement.t.sol` — basic settlement/claim flow test.

- **Frontend**
  - Minimal Next.js app under `frontend/` with:
    - A simple page that connects a wallet and reads `price(0)` from a configured `SoothMarket`.

- **Subgraph**
  - Basic schema and mappings under `graph/` for:
    - `MarketCreated` events from `SoothMarketFactory`.
    - `Resolved` events from `SoothMarket`.

## Important Warnings

This is **not** a production-ready protocol:

- LMSR math is simplified and approximate.
- The `SoothLMSRReal` module is just a shell. You must integrate a real fixed-point LMSR (e.g. via PRBMathUD60x18).
- The zk verifier is a stub.
- Adjudicator adapters are minimal and require real oracle / UMA / Reality integration.

Use this as a starting point to iterate toward the full Sooth design and then harden, test, and audit before mainnet.
