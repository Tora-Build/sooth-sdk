# Contributing to Sooth Protocol

## Development Workflow

### 1. Choose Your Context

| Role         | Open Folder              | Workflow                   |
| ------------ | ------------------------ | -------------------------- |
| Protocol Dev | `packages/contracts-evm` | `/protocol-dev`            |
| Frontend Dev | `apps/web`               | `/frontend-dev`            |
| Full Stack   | Root folder              | Use separate chat sessions |

### 2. Branch Naming

```
feat/protocol-orderbook-matching
feat/frontend-mobile-wallet
fix/contracts-gas-optimization
docs/update-integration-guide
```

### 3. Pull Request Process

1. Create branch from `main`
2. Make changes in your scope
3. Run tests: `forge test` or `npm run test`
4. Create PR with descriptive title
5. Wait for CODEOWNERS review

### 4. Code Owners

PRs require approval from the team that owns the changed files:

| Path                         | Owner         |
| ---------------------------- | ------------- |
| `packages/contracts-evm/`    | Protocol Team |
| `packages/contracts-solana/` | Protocol Team |
| `apps/web/`                  | Frontend Team |
| `packages/sdk/`              | Both Teams    |

## Commit Messages

Use conventional commits:

```
feat: add orderbook matching
fix: resolve stale balance issue
docs: update deployment guide
refactor: extract trade logic
test: add vault accounting tests
```

## Testing

### Contracts

```bash
cd packages/contracts-evm
forge test           # Run all tests
forge test -vvv      # Verbose output
forge test --match-test testBuyYes  # Specific test
```

### Frontend

```bash
cd apps/web
npm run lint         # Check code style
npm run build        # Verify build
```

## Deployment

### Testnet (Protocol Team only)

```bash
cd packages/contracts-evm
./deploy-and-sync.sh
```

After deployment, sync docs:

```bash
cd ../..
./sync-fe-docs.sh
./sync-deployments.sh
```

## Questions?

Open an issue or reach out to the team.
