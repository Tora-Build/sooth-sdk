# Sooth Protocol Monorepo

A unified prediction market protocol with **Launchpad Markets** — permissionless market creation with aligned incentives.

**Current Version**: V10.8 (Atomic Market Creation)  
**Status**: Alpha (breaking changes allowed)

## Active Deployments

### Base Sepolia (chainId: 84532) - V10.8
| Contract | Address |
|----------|---------|
| TickBookPoolManager | `0x2f3464ca4a50a522786c3e72df94f12b02eec46b` |
| TickBookVault | `0x31a1a04ddc44957f5f0645d02f6a050e20bca6c0` |
| LaunchpadEngine | `0x5cec4acf4abfe1dea585bda8532b7f2fcdc52412` |
| Collateralizer | `0x2fc82e6a2b285141366f07635285453221934942` |
| MockUSDC | `0x937a3fae6a2b1702546e141f695d6f29df72c5cc` |

### Monad Testnet (chainId: 10143) - V10.8
| Contract | Address |
|----------|---------|
| TickBookPoolManager | `0x4e9731f61c4e40e80e997a87a12c8a1dc50ec208` |
| TickBookVault | `0x95d9d278448f758397ce338cc250e9e6ab110268` |
| LaunchpadEngine | `0x341173887aad5f63dda5da509f3210f008caea85` |
| Collateralizer | `0xa1a9abaf228b91d85d35da744af4b585a4bf9a84` |
| MockUSDC | `0x1efd2b42ec8178ce667149acce75083f113e27fa` |

### Arc Testnet (chainId: 5042002) - V10.6
| Contract | Address |
|----------|---------|
| TickBookPoolManager | `0xCb209Aa0E77A68378626e3f1d5136A0A5aa18B68` |
| TickBookVault | `0x536D85d924848776995429C9769b5DA12478819b` |
| LaunchpadEngine | `0x63215FA8716417FC805A705a7d7608abF8260598` |
| Collateralizer | `0x1D9A2B863c650e04DDdF5893FfbD2f31F87e8C6f` |
| MockUSDC | `0xec165cDc464cD689732a550776a19c960386329c` |

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
