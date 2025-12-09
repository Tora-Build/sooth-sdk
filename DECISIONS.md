# Architectural Decision Records (ADRs)

## ADR-001: Client-Side Optimistic Pricing
- **Date**: 2025-12-09
- **Context**: Users experienced "jumping" UI and laybout shifts because pricing depended solely on async on-chain calls which were slow and sometimes returned stale or raw data (like shares instead of price).
- **Decision**: Implement a dual-layer pricing strategy in `useV4Quote.ts`:
    1.  **Client-Side**: Immediate, synchronous calculation using `lmsr.ts` (shared logic) for instant feedback.
    2.  **On-Chain**: Debounced async verification to ensure security and final accuracy.
- **Consequences**:
    - UI is instant and stable (no flickering).
    - Requires maintaining duplicate math logic in TypeScript (`lmsr.ts`) alongside Solidity (`SoothMarketV4.sol`).
    - **Risk**: If JS math diverges from Solidity math, user sees one price but transaction fails or executes differently. (Mitigation: 100% test coverage on `lmsr.ts` against contract method).

## ADR-002: Signed Integer Trading Interface
- **Date**: 2025-12-09
- **Context**: V4 contracts use `int256` for `deltaShares` (+ for buy, - for sell) and `maxCost`. The frontend previously treated everything as unsigned `uint256`.
- **Decision**: Refactor `useTrade.ts` to strictly handle signed BigInts for all V4 trading operations.
- **Consequences**:
    - Frontend logic must explicitly handle sign conversion (`shares > 0 ? limit : -limit`).
    - Eliminates ambiguity in "Buy vs Sell" distinct functions; unified into single `tradeAMM` call.
