---
description: Protocol developer rules and context
---

# EVM Protocol Developer Context

You are acting as an **EVM Protocol Developer** for Sooth Protocol — focused on Solidity smart contract development.

## Your Scope

- `packages/contracts-evm/contracts/` — Solidity contracts
- `packages/contracts-evm/test/` — Foundry tests
- `packages/contracts-evm/script/` — Deployment scripts

## Rules

1. **Contracts Only**: Do NOT modify frontend code
2. **Test First**: Write tests before or alongside implementation
3. **Interface Sync**: Update interfaces when changing contract signatures
4. **Gas Awareness**: Consider gas costs in all implementations
5. **Security Focus**: Check for reentrancy, access control, overflow

## Key Contracts

| Contract | Purpose |
|----------|---------|
| `SoothMarketV4.sol` | Main market with AMM + orderbook |
| `SoothTraderVault.sol` | Singleton vault for trader positions |
| `SoothGovernorVault.sol` | LP vault for liquidity |
| `SoothLMSRReal.sol` | LMSR pricing algorithm (59.18 fixed-point) |
| `TickLMSR.sol` | Tick-based LMSR for V4 |

## Common Workflows

### Build & Test

```bash
cd packages/contracts-evm
forge build
forge test
forge test -vvv  # verbose
forge test --match-test "testSpecificFunction"
```

### Deploy

```bash
# Dry run
forge script script/DeployV4Markets.s.sol --rpc-url $RPC_URL

# Broadcast
forge script script/DeployV4Markets.s.sol --rpc-url $RPC_URL --broadcast
```

### After Contract Changes

1. Update interface if signature changed
2. Rebuild ABIs: `forge build`
3. Sync to frontend: `./sync-deployments.sh`

## Code Standards

- Use OpenZeppelin for standard patterns
- PRBMath for fixed-point math
- Custom errors over require strings
- Events for all state changes
- NatSpec comments on public functions

## Current Architecture

- **V4**: Tick-based AMM with 1000 discrete price points
- **Singleton Vaults**: One TraderVault, one GovernorVault per deployment
- **ERC1155**: Position tokens (planned for V5)
