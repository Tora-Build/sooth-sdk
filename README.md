# Sooth Protocol Monorepo

A unified prediction market protocol with **Launchpad Markets** — permissionless market creation with aligned incentives.

**Current Version**: V11.1 (Trial Period, ERC20 LP, ValidatedAdjudicator)  
**Codebase**: V11 | **Deployed**: V11.1 (Base Sepolia testing)  
**Status**: Alpha (breaking changes allowed)

## Active Deployments

### Base Sepolia (chainId: 84532) - V11.1 (Active Testing)
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x3cfa2113c919c916e8334d245b157de937e76836` |
| TickBookPoolManager | `0x61ddf4716a181658e2fa9efd98b93c634ac49cdd` |
| TickBookVault | `0x667c100f8f5667177fce0e9566ffe1403fc7c6f7` |
| AMMEngine | `0x1399d385d2861eb046d83ededb7f4ea3aaca2ef5` |
| Collateralizer | `0x4deae2f0a39b84f57a28f07762e8b47085ed38de` |
| ProtocolConfig | `0x4c76089b2ad28b2fc9c4d7a1c06eeb13d0336fc0` |
| MockUSDC | `0xb4f46ed670ed6c4cf422ea61e06961d64a753e9d` |

> **Note:** V11.1 deployed to Base Sepolia and Monad Testnet. MegaETH and Arc remain at V10.9.

### Monad Testnet (chainId: 10143) - V11.1
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x744724aa5b389644f31dfcfbb67786b581602084` |
| TickBookPoolManager | `0xcc8fbc38af3510c9b28941298b5bdd481a7698b4` |
| TickBookVault | `0x93c9ee74896f1f7854a35003d92c9e7b54c0f296` |
| AMMEngine | `0x67147bc54df45ce43cb88b735043c496047596a7` |
| Collateralizer | `0x57992a707c285971a22dffc3106118331b5e632f` |
| ProtocolConfig | `0x6784f9b2e3a629c94cc05b441b6fdec4a6890830` |
| MockUSDC | `0x3b2f5a6e16cb5d5cf277f8718a9add3af0b1222a` |

### MegaETH Testnet (chainId: 6343) - V10.9
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0xa2b2653124cb98b4d83a8a314e5e0bef2621832f` |
| TickBookPoolManager | `0xf52a8e9f5defcc6fe0e66b523d29ad7cfc3af530` |
| TickBookVault | `0x5b9a8b49d5616326bd61ac57b429cbf84e8cc756` |
| AMMEngine | `0x61470420cc117e9460aae3bdc6cdf77c443ac09c` |
| Collateralizer | `0xe928d0cf62a98f2e24e65978ae487f562749305a` |
| MockUSDC | `0x57bda4319c306a68054f25017183030752f97d63` |

### Arc Testnet (chainId: 5042002) - V10.9
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x625b4b2997232380126f0aecd84867086f89b27e` |
| TickBookPoolManager | `0x8ba9751284d77ed59f46ea877577e6430bc30209` |
| TickBookVault | `0x1695ac9983f457e446d8f903d7c4061fbc7907f8` |
| AMMEngine | `0x0f0dd0be87f6ab153e732039469fe64353b95dbb` |
| Collateralizer | `0x0313af9c18e3c954f42b771a6d301fbbc6ad60a5` |
| MockUSDC | `0x805825e6af09178ea699a32a8d6cc5ca3637df80` |

## Structure

```
sooth-alpha/
├── apps/
│   └── web/                      # Frontend dApp (Vite + React 18)
├── packages/
│   ├── contracts-core/           # Solidity smart contracts (Foundry) - Audit scope
│   ├── contracts-core/        # Contract tests, CLI & deployment scripts
│   ├── indexer/                  # Ponder indexer for orderbook data
│   └── keeper/                   # Arbitrage keeper bot for TickBook
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
pnpm dev:cli:monad     # Monad Testnet
pnpm dev:cli:arc       # Arc Testnet
pnpm dev:cli:megaeth   # MegaETH Testnet
```

**Keeper Bot:**

```bash
PRIVATE_KEY=0x... pnpm dev:keeper:base
PRIVATE_KEY=0x... pnpm dev:keeper:monad
PRIVATE_KEY=0x... pnpm dev:keeper:arc
PRIVATE_KEY=0x... pnpm dev:keeper:megaeth
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

### `packages/contracts-core`

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
| `pnpm dev:cli:monad` | Interactive CLI (Monad Testnet) |
| `pnpm dev:cli:arc` | Interactive CLI (Arc Testnet) |
| `pnpm dev:cli:megaeth` | Interactive CLI (MegaETH Testnet) |
| `pnpm dev:keeper:base` | Keeper bot (Base Sepolia) |
| `pnpm dev:keeper:monad` | Keeper bot (Monad Testnet) |
| `pnpm dev:keeper:arc` | Keeper bot (Arc Testnet) |
| `pnpm dev:keeper:megaeth` | Keeper bot (MegaETH Testnet) |

## Key Files

- `STATUS.md` — Current project state & deployments
- `CHANGELOG.md` — Release history
- `DECISIONS.md` — Architecture decisions (ADRs)
- `.agent/KNOWLEDGE.md` — Protocol facts and formulas
- `.agent/LESSONS_LEARNED.md` — Mistakes to avoid

## License

MIT
