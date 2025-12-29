# Sooth Monorepo

This repository contains the Sooth V9 prediction market protocol contracts and frontend.
It uses a monorepo structure managed by `turbo` and `pnpm`.

## Core Commands

### Development
- **Start All**: `pnpm dev` (Starts frontend and dependencies)
- **Frontend Only**: `cd apps/web && npm run dev`
- **Contracts Only**: `cd packages/contracts-evm`

### Testing
- **Run All Tests**: `pnpm test`
- **Frontend Tests**: `cd apps/web && npm run test:e2e` (Playwright)
- **Contract Tests**: `cd packages/contracts-evm && forge test`
- **Contract Match Test**: `forge test --match-contract <Name> -vvv`

### Deployment & Verification
- **Run Deployment**: `cd packages/contracts-evm && forge script script/InitializeV9Markets.s.sol --broadcast --rpc-url <URL>`
- **Verify Deployment**: `./packages/contracts-evm/script/verify-deployment.sh` (MANDATORY after deployment)
- **Sync Frontend**: `cd apps/web && npm run sync-deployments`

## Project Layout

- `apps/web/` → **Frontend Application**
  - Next-gen prediction market UI
  - Stack: React, Vite, AppKit, Wagmi, TailwindCSS
  - Config: `src/config/deployments.json` acts as the source of truth for contract addresses

- `packages/contracts-evm/` → **Smart Contracts**
  - Protocol core logic (V9 Engine, TickBookPoolManager)
  - Stack: Solidity 0.8.x, Foundry
  - Key Directories:
    - `contracts/`: Source code
    - `script/`: Deployment and management scripts
    - `test/`: Invariant and unit tests

- `.agent/` → **Agent Context**
  - `workflows/`: Standard Operating Procedures (SOPs)
  - `LESSONS_LEARNED.md`: Memory of past mistakes and fixes
  - `GUIDE.md`: Quick reference for agent roles

## Development Patterns & Constraints

### General
- **Package Manager**: `pnpm` (use `npm` inside `apps/web` if legacy scripts require it, but prefers `pnpm` at root)
- **Monorepo**: Uses TurboRepo for task orchestration.

### Smart Contracts (EVM)
- **Verification**: ALWAYS run `verify-deployment.sh` after any on-chain deployment.
- **Initialization**: V9 requires `InitializeV9Markets.s.sol` to set up initial markets.
- **Outcome Semantics**: V8.13+ uses `NO=0, YES=1, INVALID=2` (TruthMarket standard).
- **Math**: Use 18-decimal WAD math. Always divide by `1e18` when multiplying two WAD numbers.

### Frontend
- **Config Sync**: Never manually edit contract addresses in UI code. Update `deployments.json` and bump the version.
- **Validation**: `npm run validate-config` runs automatically before build/dev to ensure config sanity.

## Git Workflow Essentials

1. **Branching**: `feature/<name>` or `fix/<name>`.
2. **Commits**: Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
3. **Pre-commit**: Husky hooks enforce linting.

## Agent Roles & Workflows

Use the following slash commands to adopt specific personas:

- `/sop` → **SOP Manager**: Manage workflows, rules, and lessons learned.
- `/preflight` → **Session Starter**: Check context and status before working.
- `/deploy` → **Release Engineer**: Handle contract deployment safely.
- `/deploy-sync` → **Integration Engineer**: Sync deployments to frontend.
- `/qa` → **QA Engineer**: Analysis, test strategy, and invariant checking.

## Evidence Required for Every PR

- **Contracts**: Passing `forge test`. Included invariant tests for new accounting logic.
- **Frontend**: Passing `npm run build` and `npm run test:e2e`.
- **Docs**: Updated `STATUS.md` and `CHANGELOG.md`.

## Recovery Playbook

If you are confused or repeating mistakes:
1. **Stop**.
2. **Read `.agent/LESSONS_LEARNED.md`**.
3. **Run `/preflight`** to re-ground yourself in the current context.
