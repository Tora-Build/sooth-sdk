# AGENTS.md - Sooth Protocol Development Guide

Quick reference for AI agents and developers working in this monorepo.

## Project Structure

```
sooth-alpha/
├── apps/web/                    # React frontend (Vite + Tailwind)
├── packages/
│   ├── contracts-core/          # Solidity contracts (Foundry) - AUDIT SCOPE
│   ├── contracts-testing/       # Tests, CLI, benchmarks
│   └── indexer/                 # Ponder indexer
├── .agent/                      # Agent workflows & knowledge
├── STATUS.md                    # Current project state
├── CHANGELOG.md                 # Change history
└── DECISIONS.md                 # Architecture decisions (ADRs)
```

## Build & Test Commands

### Contracts (Foundry)
```bash
# Build
cd packages/contracts-core && forge build

# Run all tests
cd packages/contracts-testing && forge test

# Run single test file
forge test --match-path test/v10/UnifiedCrossing.t.sol

# Run single test function
forge test --match-test test_PlaceOrder_CrossesExisting -vvv

# Run with verbosity (traces)
forge test --match-test test_PlaceOrder -vvvv

# Fuzz tests only
forge test --match-contract Fuzz

# Invariant tests only
forge test --match-contract Invariants

# Fork tests (live network)
forge test --match-path 'test/v9/fork/*.t.sol' --fork-url https://sepolia.base.org
```

### Frontend (Vite + React)
```bash
cd apps/web
npm run dev           # Start dev server (localhost:5173)
npm run build         # Production build
npm run test:e2e      # Playwright tests
npm run test:e2e:ui   # Playwright with UI
```

### Monorepo (pnpm)
```bash
pnpm dev:all          # Start web + indexer
pnpm test:contracts   # Run forge tests
pnpm interactive:base # CLI for Base Sepolia
pnpm interactive:arc  # CLI for Arc Testnet
```

### Deployment
```bash
cd packages/contracts-core
bun run script/deploy-multichain.ts --chains=baseSepolia
bun run script/deploy-multichain.ts --chains=monadTestnet
bun run script/deploy-multichain.ts --chains=arcTestnet
```

## Code Style Guidelines

### Solidity
- **Solc version**: 0.8.30 with `via_ir = true`
- **Optimizer**: 1 run (size optimization)
- **Naming**: `_privateVar`, `publicVar`, `CONSTANT_NAME`
- **Errors**: Use custom errors, not `require()` strings
- **Math**: All internal math in WAD (1e18). Convert at boundaries.

```solidity
// Good
error InsufficientBalance(uint256 required, uint256 available);
if (balance < amount) revert InsufficientBalance(amount, balance);

// Bad
require(balance >= amount, "insufficient balance");
```

### TypeScript/React
- **Strict mode**: `strict: true` in tsconfig
- **Types**: No `any`. Use `unknown` + type guards if needed.
- **Hooks**: Custom hooks in `src/hooks/`, prefixed with `use`
- **State**: Zustand for global state, React Query for server state

### File Naming
- **Canonical names only**: `Market.sol`, `App.tsx`, `deployments.json`
- **NO version numbers**: `MarketV10.tsx` is FORBIDDEN
- **Flat structure**: No `v8/`, `v9/` folders. Use Git for versioning.

## Critical Rules

### WAD Math (1e18)
```solidity
// If both operands are WAD, divide result by 1e18
uint256 result = (wadA * wadB) / 1e18;

// At USDC boundary (6 decimals), convert:
uint256 usdcAmount = wadAmount / 1e12;
```

### Outcome Encoding (Protocol-Wide)
| Value | Outcome |
|-------|---------|
| `0`   | NO      |
| `1`   | YES     |
| `2`   | INVALID |

### Deployment Checklist
1. Run `forge build` - verify compilation
2. Deploy with `bun run deploy`
3. Run `./script/verify-deployment.sh`
4. Update `apps/web/src/config/deployments.json`
5. Bump `version` field
6. Update `STATUS.md` and `CHANGELOG.md`

## Workflow Commands

| Command | When to Use |
|---------|-------------|
| `/preflight` | Session start, load context |
| `/coordinator` | End of session, sync docs |
| `/evm-dev` | Solidity development |
| `/frontend-dev` | React/TypeScript + UI/UX |
| `/deploy` | Deploy contracts to testnets |
| `/deploy-sync` | After contract deployment |

## Skills (Specialized Knowledge)

| Skill | When to Use |
|-------|-------------|
| `/gas-optimizer` | Gas analysis, storage optimization, snapshot comparison |
| `/security-scan` | Pre-audit security checks, Slither analysis, vulnerability review |
| `/synpress-e2e` | Wallet-connected E2E tests, MetaMask automation |
| `/ponder-gen` | Generate Ponder indexer handlers from ABIs |
| `/webapp-testing` | Playwright browser automation, UI testing |
| `/frontend-design` | UI/UX design, avoiding generic aesthetics |
| `/repo-maintenance` | Versioning, CHANGELOG, deployment sync |

## MCP Servers (External Tools)

This project includes `.mcp.json` with pre-configured MCP servers:

| Server | Purpose |
|--------|---------|
| `foundry` | Forge/Cast/Anvil integration for Solidity development |
| `slither` | Trail of Bits static analysis for security |
| `context7` | Up-to-date library documentation |
| `git` | Git repository operations |
| `filesystem` | Secure file operations |

To use: Ensure MCP servers are installed (`npx`, `uvx` available).

## Key Files

| File | Purpose |
|------|---------|
| `.claude/rules/lessons.md` | Past mistakes - READ FIRST |
| `.claude/rules/knowledge.md` | Protocol formulas & facts |
| `STATUS.md` | Current project state |
| `apps/web/src/config/deployments.json` | Contract addresses |

## Common Pitfalls

1. **Gas on Arc**: Uses USDC as native token. Budget ~0.1-0.5 USDC/tx.
2. **Monad RPC**: State propagation delays. Add 8s wait after txs.
3. **Market orders**: Expensive (2-3M gas) - they sweep entire book.
4. **Frontend caching**: Bump `version` in deployments.json to bust cache.

## Testing Patterns

### Unit Tests
```solidity
function test_PlaceOrder_EmitsEvent() public {
    vm.expectEmit(true, true, false, true);
    emit RangeOrderPlaced(...);
    poolManager.placeOrder(...);
}
```

### Invariant Tests
```solidity
function invariant_VaultSolvency() public view {
    assertGe(usdc.balanceOf(vault), vault.totalClaims());
}
```

## Git Commit Style

```
type(scope): description

feat(contracts): add batch claim function
fix(fe): resolve order display bug  
deploy(arc): V10.6 to Arc Testnet
docs: update STATUS.md
```

Types: `feat`, `fix`, `deploy`, `docs`, `refactor`, `test`, `style`
