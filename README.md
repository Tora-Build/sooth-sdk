# Sooth Protocol Monorepo

A unified prediction market protocol with **Launchpad Markets** — permissionless market creation with aligned incentives.

**Current Version**: V10.8 (Atomic Market Creation)  
**Status**: Alpha (breaking changes allowed)

## Active Deployments

### Base Sepolia (chainId: 84532) - V10.8
| Contract | Address |
|----------|---------|
| TickBookPoolManager | `0x9f4c719823935cbbb9db3f8e78556d8684c9b877` |
| TickBookVault | `0x307425430128a2948bbd33d6f4bc558cc1a58929` |
| LaunchpadEngine | `0x35292381f577692d29078fd66c22aa99aae9a8d6` |
| Collateralizer | `0x87a7042bdeae36309a97d79203dc41d876a76853` |
| AMMEngine | `0x224f012eacbb7425d336bf0bd5546feb74bbb16e` |
| MockUSDC | `0xf9ac031408f4638c147764377ba8a5ab34584515` |

### Monad Testnet (chainId: 10143) - V10.8
| Contract | Address |
|----------|---------|
| TickBookPoolManager | `0x19424e5482ad7b79654706fa60f4e5153d54e3c3` |
| TickBookVault | `0x8e417a8e71bc1a2adea4291fc0d0cd04e445cc1c` |
| LaunchpadEngine | `0x6e295996fd9902b6ebf2c44068da9a07b81cd527` |
| Collateralizer | `0xb6bf9fc30884699a37c1138d6c1a0b5dd8f70980` |
| AMMEngine | `0xed9aaecb4577319dc258bfd902f504972e530f67` |
| MockUSDC | `0xa87fc95697bd72b2a4aebf2897fbfdb4e37df724` |

### Arc Testnet (chainId: 5042002) - V10.8
| Contract | Address |
|----------|---------|
| TickBookPoolManager | `0x3520983370eef2d1e417154bbeddf57f0dd5823f` |
| TickBookVault | `0x751f57c504cb7311f52ccc4953e3658d2322c274` |
| LaunchpadEngine | `0x137ad07970322fb72c1e4d7758976b2237e3fe36` |
| Collateralizer | `0xe9a9b730062f76f35133ad662f36d2f0db97764e` |
| AMMEngine | `0xc3c92b8eb4185657be969848ba14e481752d8d01` |
| MockUSDC | `0x2231f76e847cfdc3f1dee2197f97de2edf57fe5e` |

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
