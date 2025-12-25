# Sooth Protocol Monorepo

A unified prediction market protocol with **Launchpad Markets** — permissionless market creation with aligned incentives.

**Current Version**: V8.0.0  
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

## Architecture (V8 Modular)

V8 is a modular stack with clear domain separation:

```
TruthMarket (lifecycle + settlement)
  ↑ (queried by)
LaunchpadEngine (creator economics, governance params)
  ↓ (delegates to)
AMMEngine (LMSR positions + 24h sell locks)
TickBook (orderbook venue)
Collateralizer (split/merge/redeem)
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **TruthMarket** | Canonical lifecycle + settlement authority |
| **LaunchpadEngine** | Creator deposit + LP accounting + fee distribution + graduation mechanics |
| **AMMEngine** | Pure LMSR trading logic + 24h sell lock mechanics |
| **TickBook** | Orderbook venue (separate domain from AMM) |
| **Collateralizer** | Token split/merge/redeem operations |

## Packages

### `apps/web`

Vite + React 18 dApp with:

- Wagmi v2 for Web3 connectivity
- Zustand for state management
- Tailwind CSS for styling

### `packages/contracts-evm`

Foundry project containing:

- `TruthMarket` — Lifecycle + settlement authority
- `LaunchpadEngine` — Creator economics wrapper (governance-controlled)
- `AMMEngine` — Pure trading logic (LMSR)
- `TickBook` — Orderbook venue
- `Collateralizer` — Token management
- `OutcomeToken` — Outcome token contract

### `packages/sdk`

Shared TypeScript package:

- ABIs exported from contracts
- Type definitions
- Deployment configurations

## Active Deployments

### Base Sepolia (Chain 84532) — V8 ✅
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x196138C0d39eE18a6EEFbD9f889f455e67774bAe` |
| Collateralizer | `0x33CEF938B38C0449d9DA786c27168F6F7Dc4FFac` |
| AMMEngine | `0x26728543542297dc17A91D82C0B1605Dc2331537` |
| TickBook | `0x10dC96D3A82FE35b2FF4571B90D8FE5984c60A87` |

See `apps/web/src/config/deployments.json` for full addresses + markets.

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

- [Web Specs Index (V8)](./apps/web/docs/specs/README.md)
- [EVM Docs Root](./packages/contracts-evm/docs/README.md)
- [V8 Modular Architecture (research)](./packages/contracts-evm/docs/research/V8/V8_MODULAR_ARCHITECTURE.md)
- [V8 Launchpad Architecture (research)](./packages/contracts-evm/docs/research/V8/V8_LAUNCHPAD_ARCHITECTURE.md)
- [Deployment (V8)](./packages/contracts-evm/docs/V8_DEPLOYMENT_GUIDE.md)
- [Money Flow Diagram](./packages/contracts-evm/docs/core/MONEY_FLOW_DIAGRAM.md)

Historical docs are kept under per-package `_archive/` folders:

- [Web archives](./apps/web/docs/_archive/README.md)
- [EVM archives](./packages/contracts-evm/docs/_archive/README.md)

## Key Files

- `STATUS.md` — Current project state
- `CHANGELOG.md` — Release history
- `DECISIONS.md` — Architecture decisions (ADRs)
- `.agent/KNOWLEDGE.md` — Protocol facts and formulas
- `.agent/LESSONS_LEARNED.md` — Mistakes to avoid

## License

MIT
