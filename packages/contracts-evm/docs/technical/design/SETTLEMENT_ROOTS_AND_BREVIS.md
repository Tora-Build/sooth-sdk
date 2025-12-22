## Settlement Roots + Brevis Integration (Stage 3–4)

This document describes the current on-chain surfaces for **retroactive-finality settlement** and a minimal **Brevis-style adjudicator** integration.

### Components

- **`SoothSettlementRootSink`** (`contracts/core/SoothSettlementRootSink.sol`)
  - Stores roots: `roots[market][batchId] = root`
  - Authorizes submission: `msg.sender == market.adjudicator()` OR `isProver[msg.sender]`
  - Verifies claims (event-only): `claim(market, batchId, pnlWad, proof)`

- **`SoothTraderVaultV4.claimSettlementRoot(...)`** (`contracts/core/SoothTraderVaultV4.sol`)
  - Verifies Merkle proof against `sink.roots(market, batchId)`
  - Applies PnL by moving USDC **between the market-vault and TraderVault**
    - If `pnlWad > 0`: pull funds from market vault and credit `accounts[user].available`
    - If `pnlWad < 0`: debit `accounts[user].available` and push funds into market vault
  - Enforces exact scaling: `pnlWad % scalar == 0`

- **Settlement sink allowlist (Stage 4 hardening)**
  - `TraderVault` now requires `isSettlementSink[sink] == true` for `claimSettlementRoot`.
  - Admin function: `setSettlementSink(address sink, bool enabled)` (owner-only).

- **`SoothBrevisAdjudicator` (stub)** (`contracts/core/adjudicators/SoothBrevisAdjudicator.sol`)
  - Gateway-authenticated callbacks:
    - `brevisResolveMarket(market, outcome, tStar)` → `market.finalizeResolution(outcome, tStar)`
    - `brevisSubmitSettlementRoot(market, batchId, root)` → `sink.submitRoot(market, batchId, root)`
  - Proof verification is intentionally out of scope for the stub; callback authentication is the security boundary.

### Merkle leaf format

- Leaf: `keccak256(abi.encodePacked(market, account, pnlWad, batchId))`
- Proof verifier: sorted-pairs Merkle (see `SoothMerkleProof` in `SoothSettlementRootSink.sol`)

### Notes / intended evolution

- **Stage N (real Brevis)**: replace stub callbacks with real gateway + circuit output verification, and optionally enforce per-market circuit configuration.
- **Accounting**: settlement roots are designed to scale to many accounts with O(1) root submission and O(log N) per-claim verification.

