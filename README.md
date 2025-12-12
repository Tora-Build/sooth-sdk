# Sooth Protocol Monorepo

A unified prediction market protocol supporting **EVM** (Ethereum, Base, Monad) and **Solana** (planned).

## Structure

```
sooth-alpha/
├── apps/
│   └── web/                      # Frontend dApp (Vite + React 18)
├── packages/
│   ├── contracts-evm/            # Solidity smart contracts (Foundry)
│   ├── contracts-solana/         # Rust programs (Anchor) [Planned]
│   └── sdk/                      # Shared types, ABIs, and config
├── .github/
│   └── CODEOWNERS                # Role-based PR review enforcement
├── package.json                  # pnpm workspace root
├── pnpm-workspace.yaml
└── turbo.json                    # Build pipeline
```

## Quick Start

### Prerequisites

- **Node.js** 18+
- **pnpm** 9+ (`npm install -g pnpm`)
- **Foundry** (`curl -L https://foundry.paradigm.xyz | bash`)

### Setup

```bash
# Install all dependencies
pnpm install

# Build everything
pnpm build
```

### Development

**Frontend:**

```bash
pnpm --filter web dev
# Opens at http://localhost:5173
```

**Contracts:**

```bash
cd packages/contracts-evm
forge build
forge test
```

## Packages

### `apps/web`

Vite + React 18 dApp with:

- Wagmi v2 for Web3 connectivity
- Zustand for state management
- Tailwind CSS for styling

### `packages/contracts-evm`

Foundry project containing:

- `SoothTraderVaultV4` — User fund management & AMM Positions
- `SoothGovernorVault` — LP liquidity pool
- `SoothMarketV4` — Unified Market (LMSR + Orderbook)
- `OutcomeToken` — Orderbook Share Tokens (ERC1155)

### `packages/sdk`

Shared TypeScript package:

- ABIs exported from contracts
- Type definitions
- Deployment configurations

### `packages/contracts-solana` (Planned)

Anchor project for Solana deployment.

## Agent Workflows

This repo supports **scoped agent contexts** for different developer roles:

| Role         | Workspace                | Command         |
| ------------ | ------------------------ | --------------- |
| Protocol Dev | `packages/contracts-evm` | `/protocol-dev` |
| Frontend Dev | `apps/web`               | `/frontend-dev` |

## Scripts

| Script                  | Description                    |
| ----------------------- | ------------------------------ |
| `./sync-fe-docs.sh`     | Sync contract docs to frontend |
| `./sync-deployments.sh` | Sync deployment addresses      |

## Deployments

### Base Sepolia

See `packages/contracts-evm/deployments.json`

### Monad Testnet

See `packages/contracts-evm/deployments/monad/`

## Documentation

- [Architecture](./packages/contracts-evm/docs/core/ARCHITECTURE.md)
- [Frontend Integration](./packages/contracts-evm/docs/technical/frontend-integration/README.md)
- [Fee Design](./packages/contracts-evm/docs/research/FEE_DESIGN.md)

## License

MIT
