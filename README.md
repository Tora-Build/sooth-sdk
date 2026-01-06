# Sooth Protocol Monorepo

A unified prediction market protocol with **Launchpad Markets** — permissionless market creation with aligned incentives.

**Current Version**: V10.3.1  
**Status**: Alpha (breaking changes allowed)

## Active Deployments

### Base Sepolia (chainId: 84532)
| Contract | Address |
|----------|---------|
| TickBookPoolManager | `0x8e14f863109cc93ec91540919287556cc368ff0b` |
| LaunchpadEngine | `0x11f921f0b2b36e8e0536afb8a292f1954700e695` |
| MockUSDC | `0x515728b80658b61cc030ebc8b63ca4b0bf6c8174` |

### Monad Testnet (chainId: 10143)
| Contract | Address |
|----------|---------|
| TickBookPoolManager | `0x9decb678ec60a4ef90b62271b57eae015f750563` |
| LaunchpadEngine | `0xae6b89ebf3d4b34d095811da9219b15f25447357` |
| MockUSDC | `0xac7082e54f16a6336781a2a9d74b5ceb11640774` |

## Structure

```
sooth-alpha/
├── apps/
│   └── web/                      # Frontend dApp (Vite + React 18)
├── packages/
│   ├── contracts-core/           # Solidity smart contracts (Foundry) - Audit scope
│   ├── contracts-testing/        # Contract tests, CLI & deployment scripts
│   └── indexer/                  # Ponder indexer for orderbook data
├── .agent/                       # Agent workflows and knowledge base
├── start-all.sh                  # Dev environment launcher
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

**Start Everything (Recommended):**

```bash
# Start web + indexer together
pnpm dev:all

# Or with process management (logs, PID tracking)
./start-all.sh
```

**Individual Services:**

```bash
# Frontend only
pnpm dev:web
# → http://localhost:5173

# Indexer only
pnpm dev:indexer
# → http://localhost:42069
```

**Service Management:**

```bash
# Check status
./start-all.sh --status

# Stop all
./start-all.sh --stop
```

**Contracts:**

```bash
# Build core contracts
cd packages/contracts-core && forge build

# Run tests
cd packages/contracts-testing && forge test

# Deploy to testnets
bun run packages/contracts-core/script/deploy-multichain.ts --chains=baseSepolia,monadTestnet
```

**Interactive CLI:**

```bash
# Interactive REPL for testing
pnpm interactive:base     # Base Sepolia
pnpm interactive:monad    # Monad Testnet
```

## Architecture (V10 Unified Crossing)

V10 introduces unified crossing where `placeOrder` natively crosses both Spot Sells and Range Orders:

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

### Key Concepts

| Concept | Description |
|---------|-------------|
| **TruthMarket** | Canonical lifecycle + settlement authority |
| **LaunchpadEngine** | Creator deposit + fee distribution + graduation |
| **AMMEngine** | LMSR trading logic for pre-graduation markets |
| **TickBookPoolManager** | V10 unified orderbook (spot-first, then range crossing) |
| **TickBookVault** | User fund custody (USDC + outcome tokens) |
| **Collateralizer** | Token split/merge/redeem operations |

## Packages

### `apps/web`

Vite + React 18 dApp with:

- Wagmi v2 + Viem for Web3 connectivity
- Zustand for state management
- CSS variables for theming

### `packages/contracts-core`

Foundry project containing the **audit scope**:

- `TickBookPoolManager` — V10 unified orderbook with spot-first crossing
- `TickBookVault` — User fund custody
- `LaunchpadEngine` — Market creation + graduation
- `AMMEngine` — LMSR trading (pre-graduation)
- `Collateralizer` — Token management
- `TruthMarket` — Lifecycle + settlement

### `packages/contracts-testing`

Testing & deployment tools:

- Forge test suites (79 tests)
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

| Script                  | Description                         |
| ----------------------- | ----------------------------------- |
| `./start-all.sh`        | Start all dev services              |
| `./start-all.sh --stop` | Stop all services                   |
| `./start-all.sh --status` | Check service status              |
| `pnpm dev:all`          | Start web + indexer (parallel)      |
| `pnpm dev:web`          | Start web only                      |
| `pnpm dev:indexer`      | Start indexer only                  |
| `pnpm test:contracts`   | Run forge tests                     |
| `pnpm interactive:base` | Interactive CLI (Base Sepolia)      |
| `pnpm interactive:monad`| Interactive CLI (Monad Testnet)     |

## Key Files

- `STATUS.md` — Current project state & deployments
- `CHANGELOG.md` — Release history
- `DECISIONS.md` — Architecture decisions (ADRs)
- `.agent/KNOWLEDGE.md` — Protocol facts and formulas
- `.agent/LESSONS_LEARNED.md` — Mistakes to avoid

## License

MIT
