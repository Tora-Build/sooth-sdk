# Sooth Protocol Monorepo

A unified prediction market protocol with **Launchpad Markets** — permissionless market creation with aligned incentives.

**Current Version**: V10.8.3 (Auto-derived Symbol)  
**Status**: Alpha (breaking changes allowed)

## Active Deployments

### Base Sepolia (chainId: 84532) - V10.8.3
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0xdc51a2beb6ed2e65f1ee4cfa87a228b77e697a21` |
| TickBookPoolManager | `0x463759fa866e6045c97cb37c25bcd74d23aa9b34` |
| TickBookVault | `0x3727d8d586bd37cd716c1bdbc05c6c2c6b8adc5d` |
| AMMEngine | `0x95c0a48c38a19dcdd9b8d21b0c304154230b56b9` |
| Collateralizer | `0x3aeeedd2e749c6d7bbabafdfd76ad84ad6c414f1` |
| MockUSDC | `0x2bba41ddbd9a10b3719c3865029ce5238ec09dac` |

### Monad Testnet (chainId: 10143) - V10.8.3
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x9ca66ac4a00e7c380db41a714be470493bc2eee1` |
| TickBookPoolManager | `0xaa3daf93c823258fe025b26be90e8a08d2abf84f` |
| TickBookVault | `0xb3ea593be1a834650e2955cc8f038921f4571ffa` |
| AMMEngine | `0xd18e6e7489d07e38f903e301c19f6a43650a0178` |
| Collateralizer | `0x7cbabf4a2dad48f7b5180b54adb8038a42663cb7` |
| MockUSDC | `0x28db001c8803ca586b3da0bfd31d8ce676aff0f0` |

### MegaETH Testnet (chainId: 6343) - V10.8.3
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x2de2f2e6aad4f310dc72acc6f896412ceb4706f3` |
| TickBookPoolManager | `0x7f7a84196dc38b054a6f31b2efcd7142860b37c6` |
| TickBookVault | `0xb80a06cc6813c03f1b04bc969942740b7483b447` |
| AMMEngine | `0xed1ffac79bfe9a13715774d2694a0f55ed392656` |
| Collateralizer | `0x86437735e952ec47884e3ff202594d8789943a81` |
| MockUSDC | `0x749d2d9937c10e28dd065d1f301ed485f1525f0a` |

### Arc Testnet (chainId: 5042002) - V10.8.3
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x7015ea4bdada102969f5d9eb9457e087a559cedc` |
| TickBookPoolManager | `0xb4240ac6cc3a082d5819e9410f0eb90209a4a3f3` |
| TickBookVault | `0xadd058a6bd2bce6f1fe1cbd3c9e21250c055e242` |
| AMMEngine | `0x3c01829ddac95f1f143c04afdcf0c2689aa979f0` |
| Collateralizer | `0xed16d73f5879ccf8ca1a16cfda46615fa98ef30c` |
| MockUSDC | `0x31a1380bea9b3616956cdc05b2f3fad489803717` |

## Structure

```
sooth-alpha/
├── apps/
│   └── web/                      # Frontend dApp (Vite + React 18)
├── packages/
│   ├── contracts-core/           # Solidity smart contracts (Foundry) - Audit scope
│   ├── contracts-testing/        # Contract tests, CLI & deployment scripts
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
