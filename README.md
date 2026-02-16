# Sooth Protocol Monorepo

A unified prediction market protocol with **Launchpad Markets** — permissionless market creation with aligned incentives.

**Current Version**: V12.0 (SoothBook orderbook)  
**Status**: Alpha (breaking changes allowed)

## Active Deployments

### Base Sepolia (chainId: 84532) - V12.0 (Active Testing)
| Contract | Address |
|----------|---------|
| SoothBook | `0xa83b770de63349629ea1f92ad9b40285b1d47d74` |
| LaunchpadEngine | `0xc5f6b53c74a5d14336e971459ee7cf936d401384` |
| AMMEngine | `0xb7cf9d7e3357052238a9bbdc9aaaa63e1b1346f2` |
| Collateralizer | `0x72b11e98d4050b5edaa9b069d1c6d7309a8c8f04` |
| ProtocolConfig | `0xaf2b599fedfda277f66525bf91ef6f49df6bddae` |
| MockUSDC | `0xe2025de4fbee78d0a3832ea02d070d791c42ed1e` |

> **Note:** Only Base Sepolia is deployed with V12 SoothBook. Other chains (Monad, MegaETH, Arc) remain at older versions and are disabled in tooling.

## Structure

```
sooth-alpha/
├── apps/
│   └── web/                      # Frontend dApp (Vite + React 18)
├── packages/
│   ├── contracts-core/           # Solidity smart contracts (Foundry) - Audit scope
│   ├── contracts-testing/        # Contract tests, CLI & deployment scripts
│   ├── indexer/                  # Ponder indexer for SoothBook market data
│   └── sdk-core/                 # Shared SDK utilities (@sooth/sdk-core)
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
- **Bun** (for deployment scripts: `curl -fsSL https://bun.sh/install | bash`)

### Setup

```bash
# Install all dependencies
pnpm install

# Build everything
pnpm build
```

### Development

```bash
# Start web + indexer (parallel)
pnpm dev

# Or individually
pnpm dev:web        # → http://localhost:5173
pnpm dev:indexer    # → http://localhost:42069
```

**Contracts:**

```bash
# Build
pnpm build

# Test
pnpm test:contracts

# Deploy
pnpm deploy:contracts
```

**Interactive CLI:**

```bash
pnpm dev:cli:base      # Base Sepolia
```

## Architecture (V12 SoothBook)

V12 replaces TickBook with SoothBook — an orderbook (602 lines) with 4 atomic actions, ERC20 outcome tokens, and FIFO matching:

```
TruthMarket (lifecycle + settlement)
  ↑ (queried by)
LaunchpadEngine (creator economics, graduation mechanics)
  ↓ (delegates to)
AMMEngine (LMSR positions for pre-graduation)
SoothBook (orderbook: buyYes, buyNo, mint, merge)
Collateralizer (split/merge/redeem for graduated markets)
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **TruthMarket** | Canonical lifecycle + settlement authority |
| **LaunchpadEngine** | Creator deposit + fee distribution + graduation |
| **AMMEngine** | LMSR trading logic for pre-graduation markets |
| **SoothBook** | Standalone orderbook — 4 atomic actions (buyYes, buyNo, mint, merge), ERC20 outcome tokens, FIFO matching |
| **Collateralizer** | Token split/merge/redeem operations |

## Packages

### `apps/web`

Vite + React 18 dApp with:

- Wagmi v2 + Viem for Web3 connectivity
- Zustand for state management
- CSS variables for theming

### `packages/contracts-core`

Foundry project containing the **audit scope**:

- `SoothBook` — Standalone orderbook with 4 atomic actions
- `LaunchpadEngine` — Market creation + graduation
- `AMMEngine` — LMSR trading (pre-graduation)
- `Collateralizer` — Token management
- `TruthMarket` — Lifecycle + settlement

### `packages/contracts-testing`

Testing & deployment tools:

- Forge test suites (207 tests)
- Interactive CLI for on-chain testing
- Deployment scripts (multi-chain)

## Agent Workflows

This repo supports **scoped agent contexts** for different developer roles:

| Role         | Command         | Focus                      |
| ------------ | --------------- | -------------------------- |
| EVM Dev      | `/evm-dev`      | Solidity contracts         |
| Frontend Dev | `/frontend-dev` | React dApp                 |
| Full-Stack   | `/fullstack-dev`| Cross-package features     |
| Librarian    | `/librarian`    | Docs & cleanup             |
| Preflight    | `/preflight`    | Session startup checklist  |

Run `/preflight` at session start to load context.

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start web + indexer (parallel) |
| `pnpm dev:web` | Start web only |
| `pnpm dev:indexer` | Start indexer only |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm test:contracts` | Run forge tests |
| `pnpm deploy:contracts` | Deploy contracts |
| `pnpm dev:cli:base` | Interactive CLI (Base Sepolia) |

## Key Files

- `STATUS.md` — Current project state & deployments
- `CHANGELOG.md` — Release history
- `DECISIONS.md` — Architecture decisions (ADRs)
- `.agent/KNOWLEDGE.md` — Protocol facts and formulas
- `.agent/LESSONS_LEARNED.md` — Mistakes to avoid

## License

MIT
