# Sooth Protocol Monorepo

A unified prediction market protocol with **Launchpad Markets** — permissionless market creation with aligned incentives.

**Current Version**: V10.8.1 (Atomic Market Creation)  
**Status**: Alpha (breaking changes allowed)

## Active Deployments

### Base Sepolia (chainId: 84532) - V10.8.1
| Contract | Address |
|----------|---------|
| TickBookPoolManager | `0xabfac62af3e6fb92765bea241653c3f454169dd8` |
| TickBookVault | `0x4bf295e9d022986f02501a421bda3d7d3f73cc3f` |
| LaunchpadEngine | `0xa3c20cda4877a1c76728f9cea2224189af2507c4` |
| Collateralizer | `0x2c637e7c996758780e0d4ed781734a31c60c428d` |
| AMMEngine | `0x28b866bc672c7bd79067e5d826f2956c2cb3afb9` |
| MockUSDC | `0xd988365b9b329d8c91548eb3695b65c3cbf1cb9c` |

### Monad Testnet (chainId: 10143) - V10.8.1
| Contract | Address |
|----------|---------|
| TickBookPoolManager | `0xe837986c70a38de67835059e5adb8b33ba145053` |
| TickBookVault | `0xbb5e3d1eb8c7b9930dc265adbbc21d8e927e3c79` |
| LaunchpadEngine | `0xa948000dfc95f4055c60bc235bf8d87b34e4bc8e` |
| Collateralizer | `0x02f25f2cd2a3b476804070110ea587e796e123b4` |
| AMMEngine | `0x9bfaf374d560dafca5ebb522de58ca97491a3035` |
| MockUSDC | `0x20283a043d7cc60729f7c3d58785c7397735562e` |

### MegaETH Testnet (chainId: 6343) - V10.8.1
| Contract | Address |
|----------|---------|
| TickBookPoolManager | `0xaf358498666d7b0f8cd4a02b5194d19ca654756d` |
| TickBookVault | `0x46889b5efdf72b506d40b3c339701dce27661232` |
| LaunchpadEngine | `0x44808be5af27e6856ae40b26a594b03be728b506` |
| Collateralizer | `0x96ec8fac4c5479cacf226b0070e52bfbd0c19800` |
| AMMEngine | `0x67d74ce892608817a8c4eb2ef3591d8eec743be8` |
| MockUSDC | `0xda836339e4487c4e6278babc4c1e3156b7252331` |

### Arc Testnet (chainId: 5042002) - V10.8.1
| Contract | Address |
|----------|---------|
| TickBookPoolManager | `0x12a7537f1ccf4fc650402cc573da14d184965566` |
| TickBookVault | `0x766347b587bb3c03d2d88d72e9a81c228006a548` |
| LaunchpadEngine | `0x3c2f09ba129d9ac0ea7234aa1e796a0376177d8d` |
| Collateralizer | `0xd3c564a6a67997f312e5afa34d0cc2e28c560f6a` |
| AMMEngine | `0x2d94583e48576cd031164c28b9705791aff97034` |
| MockUSDC | `0x1678256a75940938fd9ef78852c48e025f48a3ab` |

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
