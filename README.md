# Sooth Protocol Monorepo

A unified prediction market protocol with **Launchpad Markets** — permissionless market creation with aligned incentives.

**Current Version**: V6.2.7  
**Status**: Alpha (breaking changes allowed)

## Structure

```
sooth-alpha/
├── apps/
│   └── web/                      # Frontend dApp (Vite + React 18)
├── packages/
│   ├── contracts-evm/            # Solidity smart contracts (Foundry)
│   └── sdk/                      # Shared types, ABIs, and config
├── .agent/                       # Agent workflows and knowledge base
├── docs_archive/                 # Archived documentation
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

## Architecture (V6 Launchpad)

All markets are **Launchpad Markets** created via `LaunchpadFactory`:

```
User → TraderVault → LaunchpadMarket (is its own vault)
                         └→ OutcomeToken (ERC1155)
                    → SoothLiquidityVault (global locked proceeds)
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Launchpad Market** | Each market is its own vault, holds USDC, implements LP tokens |
| **Bonding Phase** | Pre-graduation: 5% fee auto-compounds into liquidity |
| **Graduation** | When `bBase >= 2x initial`, orderbook activates, fee drops to 1% |
| **Lock-on-Sell** | Sell proceeds locked 24h, shares always tradable |
| **Adjudicator Settlement** | Markets resolve via adjudicator contracts (V7) |

## Packages

### `apps/web`

Vite + React 18 dApp with:

- Wagmi v2 for Web3 connectivity
- Zustand for state management
- Tailwind CSS for styling

### `packages/contracts-evm`

Foundry project containing:

- `SoothTraderVaultV4` — User fund management & AMM positions
- `SoothLiquidityVault` — Global locked proceeds tracking
- `LaunchpadFactory` — Permissionless market creation
- `LaunchpadMarket` — Unified market (LMSR + Orderbook + LP Vault)
- `OutcomeToken` — ERC1155 outcome tokens

### `packages/sdk`

Shared TypeScript package:

- ABIs exported from contracts
- Type definitions
- Deployment configurations

## Active Deployments

### Base Sepolia (Chain 84532)
| Contract | Address |
|----------|---------|
| TraderVault | `0x1364d5CCc14251C73823e0291EF57e9EA4b9E673` |
| LaunchpadFactory | `0x7D4f70a4A8E5dD888e1F4b36E632F6b704f8ADd9` |

### MegaETH Frontier (Chain 4326)
| Contract | Address |
|----------|---------|
| TraderVault | `0x98169fffdf249b1196e4e8095f673379f3d06694` |
| LaunchpadFactory | `0x347a74a7025c42be608f3bdc0b150d4ad6eb4674` |

See `apps/web/src/config/deployments.json` for full addresses.

## Agent Workflows

This repo supports **scoped agent contexts** for different developer roles:

| Role         | Command         | Focus                      |
| ------------ | --------------- | -------------------------- |
| EVM Dev      | `/evm-dev`      | Solidity contracts         |
| Frontend Dev | `/frontend-dev` | React dApp                 |
| Full-Stack   | `/fullstack-dev`| Cross-package features     |
| Librarian    | `/librarian`    | Docs & cleanup             |

Run `/preflight` at session start to load context.

## Scripts

| Script                  | Description                    |
| ----------------------- | ------------------------------ |
| `./sync-deployments.sh` | Sync deployment addresses      |
| `verify-deployment.sh`  | Validate on-chain state        |

## Documentation

- [V6 Architecture](./packages/contracts-evm/docs/V6_ARCHITECTURE.md)
- [LMSR Pricing](./packages/contracts-evm/docs/research/LMSR_PRICING_GUARDRAILS.md)
- [Launchpad Economics](./packages/contracts-evm/docs/research/LAUNCHPAD_ECONOMICS_V2.md)
- [Money Flow Diagram](./packages/contracts-evm/docs/core/MONEY_FLOW_DIAGRAM.md)

## Key Files

- `STATUS.md` — Current project state
- `CHANGELOG.md` — Release history
- `DECISIONS.md` — Architecture decisions (ADRs)
- `.agent/KNOWLEDGE.md` — Protocol facts and formulas
- `.agent/LESSONS_LEARNED.md` — Mistakes to avoid

## License

MIT
