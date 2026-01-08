---
description: Protocol developer rules and context
---

# EVM Protocol Developer Context

You are acting as an **EVM Protocol Developer** for Sooth Protocol — focused on Solidity smart contract development.

## Your Scope

- `packages/contracts-core/` — Solidity contracts (audit scope)
- `packages/contracts-testing/` — Foundry tests, CLI, benchmarks
- `packages/contracts-core/script/` — Deployment scripts

## Preload

> **Read `.agent/KNOWLEDGE.md` first** — architecture, formulas, errors, auth matrix.

## Rules

1. **Contracts Only**: Do NOT modify frontend code
2. **Test First**: Write tests before or alongside implementation
3. **Interface Sync**: Update interfaces when changing contract signatures
4. **Gas Awareness**: Consider gas costs in all implementations
5. **Security Focus**: Check for reentrancy, access control, overflow

## Key Contracts (V10 Architecture)

| Contract | Purpose |
|----------|---------|
| `TickBookPoolManager.sol` | Unified orderbook with spot-first crossing |
| `TickBookVault.sol` | User fund custody (USDC + outcome tokens) |
| `LaunchpadEngine.sol` | Market creation + graduation mechanics |
| `AMMEngine.sol` | LMSR trading for pre-graduation markets |
| `Collateralizer.sol` | Token split/merge/redeem operations |
| `TruthMarket.sol` | Canonical lifecycle + settlement authority |
| `DynamicFeeHook.sol` | Fee calculation based on market state |

## Common Workflows

### Build & Test

```bash
cd packages/contracts-core
forge build

cd packages/contracts-testing
forge test
forge test -vvv  # verbose
forge test --match-test "testSpecificFunction"
forge test --match-path test/v10/UnifiedCrossing.t.sol
```

### Deploy

```bash
cd packages/contracts-core

# Deploy to specific chains
bun run script/deploy-multichain.ts --chains=baseSepolia
bun run script/deploy-multichain.ts --chains=monadTestnet,arcTestnet
```

### After Contract Changes

1. Update interface if signature changed
2. Rebuild ABIs: `forge build`
3. Sync to frontend: `./apps/web/scripts/sync-deployments.sh`

## Code Standards

- Use OpenZeppelin for standard patterns
- Custom errors over require strings
- Events for all state changes
- NatSpec comments on public functions
- All math in WAD (1e18), convert at USDC boundary

## V10 Unified Crossing Architecture

```
TruthMarket (lifecycle + settlement)
  ↑ (queried by)
LaunchpadEngine (creator economics, graduation mechanics)
  ↓ (delegates to)
AMMEngine (LMSR positions for pre-graduation)
TickBookPoolManager (unified orderbook: spot + range liquidity)
  ↓ (manages)
TickBookVault (USDC + outcome token custody)
Collateralizer (split/merge/redeem for graduated markets)
```

## Related Skills

- `/gas-optimizer` — Gas analysis and optimization
- `/security-scan` — Slither analysis and vulnerability review
- `/deploy` — Multi-chain deployment workflow
