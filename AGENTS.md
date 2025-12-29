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

## Critical Patterns

### Outcome Encoding (V8.13.0+)
```solidity
// Canonical encoding - all contracts use this
uint8 NO = 0;       // "No" outcome
uint8 YES = 1;      // "Yes" outcome
uint8 INVALID = 2;  // Market invalidated (50% payout to both)
```

### Decimal Handling
```
CONTRACT BOUNDARY RULE:
- Internal math: WAD (18 decimals)
- USDC transfers: Token decimals (usually 6)
- ALWAYS use _wadToUsdc() and _usdcToWad() at transfer boundaries
- Ceil for transfers TO contract, floor for transfers FROM contract
```

### WAD Math (Avoid Overflow)
```solidity
// WRONG: WAD × WAD = overflow
uint256 bad = wadA * wadB;

// CORRECT: Divide by 1e18
uint256 good = (wadA * wadB) / 1e18;
```

### Position Model (V8.2+)
```solidity
// Dual-balance model (NOT signed shares)
struct Position {
    uint256 yesShares;
    uint256 noShares;
}

// Trade signature: outcome 1=YES, 0=NO; deltaShares >0=Buy, <0=Sell
tradePositions(market, outcome, deltaShares, maxCost)
```

### Direct Reads over Event Scanning
```typescript
// AVOID: Event scanning (slow, RPC-heavy)
const position = await scanPositionTradedEvents(market, user);

// PREFER: Direct contract reads
const position = await ammEngine.getPosition(market, user);
```

## Common Issues & Solutions

| Issue | Cause | Fix |
|-------|-------|-----|
| "Insufficient allowance" | Decimal mismatch (WAD vs USDC) | Use `_wadToUsdc()` before `safeTransferFrom` |
| Position shows 0 after trade | 24h AMM lock or event scanning | Use `ammEngine.getPosition()` directly |
| Frontend shows stale data | Config cache | Bump `version` in `deployments.json`, clear localStorage |
| Limit orders only partially crossing | Old TickBookV2 | Use latest deployment (V8.12.0 fix) |
| Transaction reverts | Various | `cast receipt <hash> --rpc-url <url>`, check `revertReason` |

## Key Documentation

| File | Purpose |
|------|---------|
| `STATUS.md` | Current project state and deployments |
| `CHANGELOG.md` | Release history |
| `DECISIONS.md` | Architecture Decision Records |
| `.agent/KNOWLEDGE.md` | Protocol facts and formulas |
| `.agent/LESSONS_LEARNED.md` | Mistakes to avoid |
| `.agent/UI_UX_PATTERNS.md` | Design patterns (frontend) |
| `apps/web/src/config/deployments.json` | Contract addresses (source of truth) |
| `apps/web/src/config/markets.json` | Market configurations |

## Recovery Playbook

If you are confused or repeating mistakes:
1. **Stop**.
2. **Read `.agent/LESSONS_LEARNED.md`**.
3. **Run `/preflight`** to re-ground yourself in the current context.
