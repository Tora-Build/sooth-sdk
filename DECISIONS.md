# Architectural Decision Records

## ADR-001: Remove Solana Integration, EVM-Only

- **Date**: 2025-12-05
- **Status**: Accepted
- **Context**: Solana integration was causing stability issues (Phantom popups, white pages, crashes). Maintaining multi-chain added complexity without immediate benefit.
- **Decision**: Remove all Solana code, archive docs, focus on EVM chains (Base Sepolia, Monad).
- **Consequences**: Simpler codebase, faster iteration. Solana can be revisited later if needed.

## ADR-002: Singleton Trader Vault Architecture (v2.0)

- **Date**: 2025-12-03
- **Status**: Accepted
- **Context**: Original design had per-user vaults which created complexity and gas overhead.
- **Decision**: Single global TraderVault where users deposit/withdraw, positions tracked internally.
- **Consequences**: Reduced gas costs, simpler frontend integration, shared liquidity.

## ADR-003: V3 Tick-Based AMM Design

- **Date**: 2025-12-08
- **Status**: **Superseded by ADR-005**
- **Context**: Need for unified AMM, ERC1155 tokenization, and merge() function.
- **Decision**: Fund lock mechanism applies only to AMM interactions. Orderbook uses separate mechanics. No tokenization of AMM inventory.
- **Consequences**: Clear separation of concerns, documented implementation guides needed.

## ADR-004: Tick Cost Initialization Strategy

- **Date**: 2025-12-09
- **Status**: **Superseded by ADR-005**
- **Context**: `SoothMarketV4.initialize()` originally called `initializeTickCosts()` which populates a 1000-element array of LMSR tick costs. This consumed ~7M gas, exceeding Base Sepolia's per-tx gas limit (~3M). Deployment failed with `OutOfGas`.
- **Decision**: Extract tick costs to external `TickCostRegistry.sol`, deploy once per chain, initialize in batches.
- **Consequences**: Was successfully deployed, but superseded by continuous LMSR approach.

## ADR-005: Continuous LMSR (qYes/qNo) - Ticks Removed

- **Date**: 2025-12-09
- **Status**: **Accepted**
- **Context**: Tick-based LMSR (1000 discrete ticks) required external `TickCostRegistry` and added complexity. Continuous LMSR with `qYes`/`qNo` state is mathematically cleaner and gas-efficient.
- **Decision**: Replace tick-based pricing with continuous LMSR using PRB-Math. Market state is now `(qYes, qNo)` instead of `currentTick`. Price calculated via `exp(qYes/b) / (exp(qYes/b) + exp(qNo/b))`.
- **Key Changes**:
  - `initialize()` now takes `_initialQYes`, `_initialQNo` instead of `_tickCostRegistry`, `_initialTick`
  - `calculateAMMTradeCost()` returns `(cost, fee, newQYes, newQNo)` instead of `newTick`
  - `TickCostRegistry.sol` is no longer needed for new deployments
- **Consequences**: Simpler deployment, no external registry dependencies, arbitrary precision pricing. Deployed to Base Sepolia 2025-12-09.

---

*Add new ADRs above this line following the template*

