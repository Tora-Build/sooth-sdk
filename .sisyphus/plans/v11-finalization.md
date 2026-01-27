# V11.1 Finalization Work Plan

## Context

### Original Request
Finalize V11 upgrade - fresh Base Sepolia deployment, hide other 3 chains, update documentation.

### Interview Summary
**Key Discussions**:
- V11 features complete (Trial Period, ERC20 LP, Validated Adjudicator, Protocol Config)
- 266 tests passing, ADR-083 refactoring complete
- 7 uncommitted deployment config files need committing first
- User wants fresh V11.1 deploy (not upgrade in place)
- Comment out (not delete) Monad, MegaETH, Arc from all tooling

**Research Findings**:
- `DEPLOYMENT_VERSION` in deploy-multichain.ts is still 'V11.0' → must bump to 'V11.1'
- CHANGELOG.md has duplicate V11.0 entries (lines 5 and 65) → need to consolidate
- Verify scripts exist: `packages/contracts-core/script/verify-deployment.sh` and `.ts`
- Deployment JSON has 7 contracts: MockUSDC, ProtocolConfig, Collateralizer, AMMEngine, TickBookVault, TickBookPoolManager, LaunchpadEngine
- Version format in JSON is `"V11.0"` not `"11.0"`
- `wagmiChains` array is in `apps/web/src/lib/chains.ts` line 261
- `allowedChains` array is in `apps/web/src/lib/chains.ts` lines 77-179 (controls UI visibility)
- Indexer needs both `chains` and `contracts.*.chain` sections updated

**Note on ADR-083 Status**: STATUS.md line 91 still lists "ADR-083 Refactor" as Pending/Blocked, but research confirmed the refactoring is actually COMPLETE (contracts use canonical names, tests moved to feature-based paths). This is stale documentation - the plan's context claim is accurate based on codebase state.

### Metis Review
**Identified Gaps** (addressed):
- Version constant: Added task to bump DEPLOYMENT_VERSION
- Start block capture: Added explicit step before deploy
- CHANGELOG duplicate: Added task to consolidate entries
- Contract count: Corrected to 7 contracts (includes ProtocolConfig)
- Indexer scope: Now covers both `chains` and `contracts.*.chain` sections
- Working directories: Specified cwd for every command

---

## Work Objectives

### Core Objective
Deploy fresh V11.1 contracts to Base Sepolia, consolidate to single-chain testing focus, and update all documentation to reflect the new deployment.

### Concrete Deliverables
- Fresh V11.1 contract deployment on Base Sepolia (7 unique contracts + 1 alias = 8 keys in config)
- Updated `deployments.json` with new addresses and version bump
- Other 3 chains commented out in indexer, CLI, and frontend configs
- CHANGELOG.md with V11.1 release entry
- STATUS.md with new deployment addresses
- README.md deployment table updated

### Definition of Done
- [x] `forge test` passes (266 tests) in `packages/contracts-testing/`
- [x] All 7 V11.1 contracts deployed to Base Sepolia
- [x] `pnpm build` succeeds (no TypeScript errors) from repo root
- [x] `pnpm dev:web` starts and shows only Base Sepolia in chain selector
- [x] `pnpm dev:indexer` starts without errors for disabled chains
- [x] `./script/verify-deployment.sh` passes in `packages/contracts-core/`
- [x] All documentation reflects V11.1 and new addresses

### Must Have
- Fresh deployment (new contract addresses)
- Single-chain focus (Base Sepolia only visible in UI)
- Clear comment markers for disabled chains (reversible)
- Version bumped to V11.1

### Must NOT Have (Guardrails)
- ❌ DO NOT delete chain configs - comment them out with `// V11.1: Disabled` marker
- ❌ DO NOT modify contract source code during this task
- ❌ DO NOT push to remote until all local verification passes
- ❌ DO NOT deploy to mainnet (out of scope)
- ❌ DO NOT update Render indexer deployment (separate manual task)
- ❌ DO NOT implement IPFS metadata or other deferred features
- ❌ DO NOT commit `.sisyphus/` files (plans, drafts are working files)
- ❌ DO NOT modify `package.json` scripts (CLI/keeper commands stay, will fail at runtime)

### "Disabled in Tooling" Scope Definition
The following are affected by single-chain focus:

| Component | File | Action | Runtime Behavior |
|-----------|------|--------|------------------|
| Frontend chain selector | `apps/web/src/lib/chains.ts` | Comment out from arrays | Only Base Sepolia visible |
| Indexer | `packages/indexer/ponder.config.ts` | Comment out chain configs | Only indexes Base Sepolia |
| CLI config | `packages/contracts-testing/script/interactive/config.ts` | Comment out from CHAINS map | CLI errors if non-Base chain selected |

**NOT modified (expected behavior):**
- `package.json` scripts (`dev:cli:monad`, `dev:keeper:arc`, etc.) — Commands remain but will fail at runtime with "chain not found" error when the chain is not in CHAINS config. This is intentional.
- README.md "Interactive CLI" section — Keep documentation of all commands; add note that only Base Sepolia is active.
- Keeper package config — Will fail at runtime for non-Base chains (acceptable)

### TypeScript Commenting Recipe
When commenting out multi-line objects/arrays in TypeScript, use block comments to preserve syntax validity:

**For array entries (e.g., `allowedChains`, `wagmiChains`):**
```typescript
// V11.1: Disabled - single-chain focus
/*
{
  id: 10143,
  type: 'evm',
  name: 'Monad Testnet',
  ...
},
*/
```

**For object properties (e.g., indexer `chains`, `contracts.*.chain`):**
```typescript
// V11.1: Disabled - single-chain focus
/*
monadTestnet: {
  id: 10143,
  rpc: "...",
},
*/
```

**Important**: Keep trailing commas inside the comment to maintain syntax when re-enabling.

### Contract Keys Clarification
The deployment configs contain **8 keys** (7 unique contracts + 1 alias):

| Key | Contract | Notes |
|-----|----------|-------|
| `MockUSDC` | MockUSDC | Test USDC token |
| `ProtocolConfig` | ProtocolConfig | Guardian roles + pause (V11 feature) |
| `Collateralizer` | Collateralizer | Token split/merge/redeem |
| `AMMEngine` | AMMEngine | LMSR trading |
| `TickBookVault` | TickBookVault | User fund custody |
| `TickBookPoolManager` | TickBookPoolManager | Unified orderbook |
| `TickBook` | TickBookPoolManager | **ALIAS** - same address as TickBookPoolManager |
| `LaunchpadEngine` | LaunchpadEngine | Market creation + graduation |

**When updating configs:**
- Update all 8 keys in `apps/web/src/config/deployments.json`
- Update all 8 keys in `packages/contracts-core/deployments/baseSepolia.json`
- `TickBook` MUST equal `TickBookPoolManager` address
- `ProtocolConfig` is present in Base Sepolia only (other chains are V10.9)

**Note on DynamicFeeHook:**
The deploy script also deploys `DynamicFeeHook`, but this contract is NOT tracked in deployment configs (it's an internal contract used by TickBookPoolManager). **Ignore it** when recording addresses - only track the 7 config-tracked contracts listed above.

### Pre-Commit Hook Behavior
The `.husky/pre-commit` hook triggers when `deployments.json` is staged:
- **Expected behavior**: Hook looks for `packages/contracts-evm/script/verify-deployment.sh` (OLD path)
- **Actual path**: Script is at `packages/contracts-core/script/verify-deployment.sh`
- **Result**: Hook will warn "verify-deployment.sh not found, skipping verification"
- **Mitigation**: Phase 6 manual verification is the true gating check

This hook path mismatch is a known issue (repo was split from contracts-evm to contracts-core) and does not block commits.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Foundry + pnpm build + verify-deployment scripts)
- **User wants tests**: Manual verification with existing tooling
- **Framework**: forge test, pnpm build, verify-deployment.sh

### Verification Approach
1. **Contracts**: `forge test` in `packages/contracts-testing/`, verify with `verify-deployment.sh`
2. **Frontend**: `pnpm build` from root, start dev server, visual verification
3. **Indexer**: `pnpm dev:indexer`, check logs for errors
4. **Documentation**: Review diffs before commit

---

## Task Flow

```
Phase 1: Commit Pending (clean slate)
    ↓
Phase 2: Deploy Fresh V11.1 to Base Sepolia
    ↓
Phase 3: Update Deployment Configs (addresses + version)
    ↓
Phase 4: Comment Out Other Chains (indexer, CLI, frontend)
    ↓
Phase 5: Update Documentation (STATUS, CHANGELOG, README)
    ↓
Phase 6: Verify Everything (build, dev, smoke test)
    ↓
Phase 7: Final Commit
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 4.1, 4.2, 4.3 | Independent config files |
| B | 5.1, 5.2, 5.3 | Independent documentation files |

| Task | Depends On | Reason |
|------|------------|--------|
| 2 | 1 | Need clean working tree before deploy |
| 3 | 2 | Need new addresses from deployment |
| 4.x | 3 | Need deployment configs updated first |
| 5.x | 2 | Need new addresses for documentation |
| 6 | 4, 5 | Need all changes complete before verification |
| 7 | 6 | Need verification to pass before commit |

---

## TODOs

### Phase 1: Clean Slate

- [x] 1. Commit Pending Deployment Config Changes

  **What to do**:
  1. Run `git status` to confirm the modified files
  2. Stage only the 7 specific files (avoid accidental staging of untracked files):
     ```bash
     git add apps/web/src/config/deployments.json \
             packages/contracts-core/deployments/arcTestnet.json \
             packages/contracts-core/deployments/baseSepolia.json \
             packages/contracts-core/deployments/megaethTestnet.json \
             packages/contracts-core/deployments/monadTestnet.json \
             packages/contracts-core/script/deploy-multichain.ts \
             packages/indexer/ponder.config.ts
     ```
  3. Commit with message: `chore: stage V11 deployment configs`

  **Must NOT do**:
  - Do not use `git add .` (may catch untracked files)
  - Do not push to remote yet

  **Parallelizable**: NO (first task, clean slate)

  **References**:
  - Current git status shows 7 modified deployment config files
  - Commit message follows conventional commits pattern per AGENTS.md

  **Acceptance Criteria**:
  - [ ] `git status` shows no modified/staged changes (only `.sisyphus/` untracked is acceptable)
  - [ ] `git log -1` shows commit message "chore: stage V11 deployment configs"
  - [ ] Commit includes exactly 7 files (no extras)

  **Commit**: YES (standalone)
  - Message: `chore: stage V11 deployment configs`
  - Files: 7 deployment config files listed above
  - Pre-commit: Hook may warn "verify-deployment.sh not found" (expected due to path mismatch, see "Pre-Commit Hook Behavior" section)

---

### Phase 2: Deploy Fresh V11.1

- [x] 2. Deploy V11.1 to Base Sepolia

  **What to do**:
  1. **Run tests** (working directory: `packages/contracts-testing/`):
     ```bash
     cd packages/contracts-testing && forge test
     ```
     Expected: 266 tests passing
  
  2. **Query current block number BEFORE deploying**:
     ```bash
     cast block-number --rpc-url https://sepolia.base.org
     ```
     Record this value (e.g., `37000000`).
     
     **startBlock derivation**: `startBlock = queried_block - 10`
     This ensures the indexer catches all deployment events. The same startBlock value will be used for ALL 4 indexed contracts.
  
  3. **Bump version constant** (working directory: `packages/contracts-core/`):
     Edit `packages/contracts-core/script/deploy-multichain.ts` line 73:
     ```typescript
     // Change from:
     const DEPLOYMENT_VERSION = 'V11.0';
     // Change to:
     const DEPLOYMENT_VERSION = 'V11.1';
     ```
  
  4. **Run deployment** (working directory: `packages/contracts-core/`):
     ```bash
     cd packages/contracts-core && bun run script/deploy-multichain.ts --chains=baseSepolia
     ```
  
  5. **Record deployment output**:
     - 7 contract addresses: MockUSDC, ProtocolConfig, Collateralizer, AMMEngine, TickBookVault, TickBookPoolManager, LaunchpadEngine
     - Start block: `block_at_deploy - 10`

  **Must NOT do**:
  - Do not deploy to other chains
  - Do not modify contract source code
  - Do not skip the forge test step

  **Parallelizable**: NO (depends on Task 1)

  **References**:
  - Deploy script: `packages/contracts-core/script/deploy-multichain.ts:73` (DEPLOYMENT_VERSION constant)
  - Test location: `packages/contracts-testing/` per AGENTS.md "Build & Test Commands"
  - Expected 7 contracts per `packages/contracts-core/deployments/baseSepolia.json` structure

  **Acceptance Criteria**:
  - [ ] `forge test` output shows 266 tests passing
  - [ ] Deploy script completes without errors
  - [ ] Deploy script auto-writes `packages/contracts-core/deployments/baseSepolia.json` with:
        - Updated `version`, `timestamp`, `deployer`
        - All 8 contract addresses in `contracts` object
  - [ ] 7 unique contract addresses captured from deploy output:
        1. MockUSDC
        2. ProtocolConfig
        3. Collateralizer
        4. AMMEngine
        5. TickBookVault
        6. TickBookPoolManager
        7. LaunchpadEngine
  - [ ] Start block number recorded (block_at_deploy - 10) - this SAME value will be used for ALL 4 indexed contracts
  - [ ] Verify LaunchpadEngine deployed:
        ```bash
        cast call <LaunchpadEngine_address> "owner()(address)" --rpc-url https://sepolia.base.org
        ```
        Expected: Returns deployer address
  - [ ] Verify ProtocolConfig deployed (V11 feature):
        ```bash
        cast code <ProtocolConfig_address> --rpc-url https://sepolia.base.org
        ```
        Expected: Returns non-empty bytecode (not `0x`)

  **Commit**: NO (groups with Task 3)

---

### Phase 3: Update Deployment Configs

- [x] 3. Verify and Sync Deployment Config Files

  **Context**: The deploy script (`deploy-multichain.ts`) automatically writes to `packages/contracts-core/deployments/baseSepolia.json`. This task is to VERIFY the auto-generated file and SYNC addresses to frontend/indexer configs.

  **What to do**:
  1. **Verify `packages/contracts-core/deployments/baseSepolia.json`** (auto-generated by deploy):
     Confirm the deploy script wrote:
     - `version`: Should be `"V11.1"` (set by DEPLOYMENT_VERSION constant you edited)
     - `timestamp`: Should be current ISO timestamp
     - `deployer`: Should be your deployer address
     - All 8 contract keys with new addresses
     - `contracts.TickBook` equals `contracts.TickBookPoolManager` (alias)
     
     **If any field is incorrect**, manually fix it now.
  
  2. **Update `apps/web/src/config/deployments.json`**:
     - Update `version` field (top level): `"V11.0"` → `"V11.1"` (triggers cache invalidation)
     - Update `networks.baseSepolia.contracts`:
       - `MockUSDC`: New address
       - `ProtocolConfig`: New address
       - `Collateralizer`: New address
       - `AMMEngine`: New address
       - `TickBookVault`: New address
       - `TickBookPoolManager`: New address
       - `TickBook`: **MUST equal TickBookPoolManager address** (alias)
       - `LaunchpadEngine`: New address
  
  3. **Update `packages/indexer/ponder.config.ts`**:
     - Update comment at line 36: `// V11.0 deployment` → `// V11.1 deployment - 2026-01-26`
     - Update `TickBookPoolManager.chain.baseSepolia.address` and `startBlock`
     - Update `LaunchpadEngine.chain.baseSepolia.address` and `startBlock`
     - Update `TickBookVault.chain.baseSepolia.address` and `startBlock`
     - Update `AMMEngine.chain.baseSepolia.address` and `startBlock`
     
     **IMPORTANT**: Use the SAME `startBlock` value (recorded in Task 2) for ALL 4 contracts to ensure consistent event indexing.

  **Must NOT do**:
  - Do not change other chain addresses yet (that's Phase 4)
  - Do not delete any chain configurations
  - Do not forget the `TickBook` alias (must match `TickBookPoolManager`)

  **Parallelizable**: NO (depends on Task 2)

  **References**:
  - `packages/contracts-core/deployments/baseSepolia.json` - exact schema: `{chainId, chainName, version, timestamp, deployer, contracts: {...}, markets: []}`
  - `apps/web/src/config/deployments.json` - version field triggers cache bust
  - `packages/indexer/ponder.config.ts` lines 65-150 - contracts section structure

  **Acceptance Criteria**:
  - [ ] `baseSepolia.json` has all 8 keys updated (7 contracts + TickBook alias) + `version: "V11.1"` + updated `timestamp`
  - [ ] `deployments.json` version field is `"V11.1"` and all 8 baseSepolia contract keys updated
  - [ ] `ponder.config.ts` Base Sepolia addresses updated for all 4 indexed contracts
  - [ ] `ponder.config.ts` startBlock is SAME value for all 4 contracts
  - [ ] `ponder.config.ts` comment updated to `// V11.1 deployment - 2026-01-26`
  - [ ] `TickBook` address equals `TickBookPoolManager` address in both config files
  - [ ] Addresses match between `baseSepolia.json` and `deployments.json` for all 8 keys (including ProtocolConfig)

  **Commit**: NO (groups with Phase 4)

---

### Phase 4: Comment Out Other Chains

- [x] 4.1 Comment Out Chains in Indexer Config

  **What to do**:
  1. Edit `packages/indexer/ponder.config.ts`
  
  2. In the `chains` object (lines 40-64), use block comments to disable:
     - `monadTestnet` block (lines 45-51)
     - `arcTestnet` block (lines 52-57)
     - `megaethTestnet` block (lines 58-63)
     
     Use the commenting recipe from "TypeScript Commenting Recipe" section:
     ```typescript
     // V11.1: Disabled - single-chain focus
     /*
     monadTestnet: {
       id: 10143,
       rpc: "...",
       pollingInterval: 500,
       ethGetLogsBlockRange: 1_000,
     },
     */
     ```
  
  3. In EACH contract's `chain` object, use block comments for non-Base entries:
     - `TickBookPoolManager.chain`: comment out `monadTestnet`, `arcTestnet`, `megaethTestnet`
     - `LaunchpadEngine.chain`: comment out `monadTestnet`, `arcTestnet`, `megaethTestnet`
     - `TickBookVault.chain`: comment out `monadTestnet`, `arcTestnet`, `megaethTestnet`
     - `AMMEngine.chain`: comment out `monadTestnet`, `arcTestnet`, `megaethTestnet`

  **Must NOT do**:
  - Do not delete the configurations
  - Do not break object syntax (keep block comments with trailing commas inside)

  **Parallelizable**: YES (with 4.2, 4.3)

  **References**:
  - `packages/indexer/ponder.config.ts` lines 40-64 for `chains` object
  - `packages/indexer/ponder.config.ts` lines 65-150 for `contracts` object with per-chain entries

  **Acceptance Criteria**:
  - [ ] Only `baseSepolia` is active in `chains` object
  - [ ] Only `baseSepolia` entries remain active in each contract's `chain` object
  - [ ] All commented sections have `// V11.1: Disabled` marker
  - [ ] `pnpm dev:indexer` starts without errors (from repo root)

  **Commit**: NO (groups with Phase 4)

---

- [x] 4.2 Comment Out Chains in CLI Config

  **What to do**:
  1. Edit `packages/contracts-testing/script/interactive/config.ts`
  2. In the `CHAINS` map, use block comments to disable entries for:
     - `monadTestnet`
     - `megaethTestnet`
     - `arcTestnet`
     
     Use the commenting recipe from "TypeScript Commenting Recipe" section:
     ```typescript
     // V11.1: Disabled - single-chain focus
     /*
     monadTestnet: {
       chainId: 10143,
       ...
     },
     */
     ```

  **Must NOT do**:
  - Do not delete the chain definitions
  - Do not break TypeScript types or object syntax

  **Parallelizable**: YES (with 4.1, 4.3)

  **References**:
  - `packages/contracts-testing/script/interactive/config.ts` - CHAINS map structure

  **Acceptance Criteria**:
  - [ ] Only `baseSepolia` is active in CHAINS map
  - [ ] Commented sections have `// V11.1: Disabled` marker
  - [ ] `pnpm dev:cli:base` runs without errors (from repo root)

  **Commit**: NO (groups with Phase 4)

---

- [x] 4.3 Comment Out Chains in Frontend

  **What to do**:
  1. Edit `apps/web/src/lib/chains.ts`:
  
     a. In `allowedChains` array (lines 77-179), use block comments to disable:
        - Monad Testnet entry (lines 131-145)
        - MegaETH Testnet entry (lines 146-161)
        - Arc Testnet entry (lines 162-178)
        
        Use the commenting recipe from "TypeScript Commenting Recipe" section:
        ```typescript
        // V11.1: Disabled - single-chain focus
        /*
        {
          id: 10143,
          type: 'evm',
          name: 'Monad Testnet',
          displayName: 'Monad',
          ...
        },
        */
        ```
     
     b. In `wagmiChains` array (line 261), change from:
        ```typescript
        export const wagmiChains: Chain[] = [baseSepolia, monadTestnet, megaethTestnet, arcTestnet];
        ```
        To:
        ```typescript
        // V11.1: Single-chain focus - other chains disabled
        export const wagmiChains: Chain[] = [baseSepolia];
        ```
     
     c. Keep the chain definitions (`monadTestnet`, `megaethTestnet`, `arcTestnet` at lines 182-255) - do NOT comment these out as they're needed for TypeScript compilation

  **Must NOT do**:
  - Do not delete chain definitions (viem defineChain blocks) - keep them for type safety
  - Do not remove chain exports (other code may reference them)
  - Only comment out from `allowedChains` and `wagmiChains` arrays
  - Do not break array syntax (keep block comments with trailing commas inside)
  - **WARNING: No nested block comments!** `chains.ts` already has block-commented entries (BNB Testnet at lines 94-110, MegaETH Frontier at lines 112-128). Comment ONLY the individual object literals for Monad/MegaETH Testnet/Arc - do NOT wrap larger regions that would nest `/* */` inside existing `/* */`.

  **Parallelizable**: YES (with 4.1, 4.2)

  **References**:
  - `apps/web/src/lib/chains.ts:77-179` - `allowedChains` array (controls UI chain selector)
  - `apps/web/src/lib/chains.ts:261` - `wagmiChains` array (controls wagmi available chains)
  - Keep `defineChain` blocks (lines 182-255) uncommented for type compilation

  **Acceptance Criteria**:
  - [ ] `allowedChains` array only contains Base Sepolia entry
  - [ ] `wagmiChains` array only contains `baseSepolia`
  - [ ] Chain definitions (defineChain blocks) remain intact
  - [ ] `pnpm build` succeeds (no TypeScript errors) from repo root
  - [ ] `pnpm dev:web` shows only Base Sepolia in chain selector

  **Commit**: NO (groups with Phase 4)

---

### Phase 5: Update Documentation

- [x] 5.1 Update STATUS.md

  **What to do**:
  1. Update "Codebase Version" to V11.1 (line 3)
  2. Update "Last Updated" date to 2026-01-26 (line 5)
  3. Update "Current Deployments" Base Sepolia section (lines 171-179):
     - Update all existing contract addresses
     - **Add `ProtocolConfig` row** if not present (V11 feature, may be missing from current table)
     - Ensure table has 7 rows: LaunchpadEngine, TickBookPoolManager, TickBookVault, AMMEngine, Collateralizer, ProtocolConfig, MockUSDC
  4. Add note that other chains are temporarily disabled for single-chain focus
  5. Add entry to "Recent Changes" section describing V11.1 deployment

  **Must NOT do**:
  - Do not remove other chain deployment sections (keep for historical reference)

  **Parallelizable**: YES (with 5.2, 5.3)

  **References**:
  - `STATUS.md` lines 1-5 for header format
  - `STATUS.md` lines 171-179 for Base Sepolia deployment table format

  **Acceptance Criteria**:
  - [ ] Version shows V11.1
  - [ ] Date shows 2026-01-26
  - [ ] Base Sepolia addresses match deployed contracts (7 addresses)
  - [ ] Recent Changes has new entry for V11.1

  **Commit**: NO (groups with Phase 5)

---

- [x] 5.2 Fix and Update CHANGELOG.md

  **What to do**:
  1. **Consolidate duplicate V11.0 entries**:
     - There are two `## [V11.0]` entries: one at line 5 (2026-01-25) and one at line 65 (2026-01-24)
     - Keep the more recent one (line 5, 2026-01-25)
     - Merge any unique content from line 65 into line 5, then remove the duplicate
  
  2. **Add new V11.1 entry** at top of file:
     ```markdown
     ## [V11.1] - 2026-01-26
     
     ### Deployment
     - Fresh V11.1 deployment to Base Sepolia
     - Single-chain focus: Monad, MegaETH, Arc temporarily disabled
     - Version bump from V11.0
     
     ### Changed
     - Indexer, CLI, and frontend configs updated for single-chain testing
     - All deployment configs updated with new contract addresses
     ```

  **Must NOT do**:
  - Do not delete historical entries beyond the duplicate
  - Do not change dates of past releases

  **Parallelizable**: YES (with 5.1, 5.3)

  **References**:
  - `CHANGELOG.md` line 5: `## [V11.0] - 2026-01-25` (keep this one)
  - `CHANGELOG.md` line 65: `## [V11.0] - 2026-01-24` (duplicate to remove)
  - Entry format: `## [Vx.x] - YYYY-MM-DD`

  **Acceptance Criteria**:
  - [ ] Only one V11.0 entry exists (duplicate removed)
  - [ ] V11.1 entry at top with date 2026-01-26
  - [ ] Clear description of deployment and single-chain focus

  **Commit**: NO (groups with Phase 5)

---

- [x] 5.3 Update README.md Deployment Table

  **What to do**:
  1. Update "Active Deployments" section Base Sepolia table:
     - Update all existing contract addresses
     - **Add `ProtocolConfig` row** if not present (V11 feature, may be missing from current table)
     - Ensure table has 7 rows: LaunchpadEngine, TickBookPoolManager, TickBookVault, AMMEngine, Collateralizer, ProtocolConfig, MockUSDC
  2. Update version reference to V11.1 (in "Current Version" line near top)
  3. Add note that other chains are temporarily disabled:
     ```markdown
     > **Note:** V11.1 focuses on Base Sepolia for testing. Monad, MegaETH, and Arc deployments remain at V10.9 but are disabled in tooling.
     ```

  **Must NOT do**:
  - Do not remove other chain sections (keep for reference)

  **Parallelizable**: YES (with 5.1, 5.2)

  **References**:
  - `README.md` lines 15-60 for deployment table format
  - Current format: `| Contract | Address |` table per chain

  **Acceptance Criteria**:
  - [ ] Base Sepolia addresses match deployed contracts (7 addresses)
  - [ ] Version reference shows V11.1
  - [ ] Note about single-chain focus is visible

  **Commit**: NO (groups with Phase 5)

---

### Phase 6: Verification

- [x] 6. Verify All Changes

  **What to do**:
  1. **Build contracts** (working directory: `packages/contracts-core/`):
     ```bash
     cd packages/contracts-core && forge build
     ```
     Expected: success
  
  2. **Run verification script** (working directory: `packages/contracts-core/`):
     ```bash
     cd packages/contracts-core && ./script/verify-deployment.sh
     ```
     Expected: All checks pass for Base Sepolia
  
  3. **Build frontend** (working directory: repo root):
     ```bash
     pnpm build
     ```
     Expected: success, no TypeScript errors
  
  4. **Start frontend** (working directory: repo root):
     ```bash
     pnpm dev:web
     ```
     Verify:
     - Chain selector shows only Base Sepolia
     - Can connect wallet
     - Shows 0 markets (fresh deployment)
  
  5. **Start indexer** (working directory: repo root):
     ```bash
     pnpm dev:indexer
     ```
     Verify:
     - Starts without chain errors
     - No errors about missing monad/arc/megaeth configs
     - Health endpoint responds: `curl http://localhost:42069/health`
  
  6. **Verify contract on explorer**:
     - Visit `https://sepolia.basescan.org/address/<LaunchpadEngine>`
     - Confirm bytecode is visible (contract deployed)
     - Source verification is optional for this task

  **Must NOT do**:
  - Do not skip any verification step
  - Do not proceed if any step fails

  **Parallelizable**: NO (depends on all previous tasks)

  **References**:
  - Verify script: `packages/contracts-core/script/verify-deployment.sh`
  - AGENTS.md "Deployment Checklist" for verification pattern

  **Acceptance Criteria**:
  - [ ] `forge build` succeeds
  - [ ] `verify-deployment.sh` passes (note: does NOT check ProtocolConfig)
  - [ ] `pnpm build` succeeds with no TypeScript errors
  - [ ] Frontend chain selector shows only Base Sepolia
  - [ ] Indexer starts without errors
  - [ ] Health check `curl http://localhost:42069/health` returns 200
  - [ ] Contract bytecode visible on Basescan
  - [ ] **Address cross-check** (manual, since verify-deployment.sh doesn't cover all):
        Verify these addresses match between `baseSepolia.json` and `deployments.json`:
        - ProtocolConfig (not in verify-deployment.sh)
        - MockUSDC
        - All other contracts

  **Commit**: NO (verification only)

---

### Phase 7: Final Commit

- [x] 7. Create Final Commit

  **What to do**:
  1. Stage ONLY the deployment-related files (do NOT use `git add .`):
     ```bash
     # Deployment configs
     git add packages/contracts-core/deployments/baseSepolia.json
     git add packages/contracts-core/script/deploy-multichain.ts
     git add apps/web/src/config/deployments.json
     
     # Indexer config
     git add packages/indexer/ponder.config.ts
     
     # CLI config
     git add packages/contracts-testing/script/interactive/config.ts
     
     # Frontend chain config
     git add apps/web/src/lib/chains.ts
     
     # Documentation
     git add STATUS.md
     git add CHANGELOG.md
     git add README.md
     ```
     
     **IMPORTANT**: Do NOT commit `.sisyphus/` files (plans, drafts). These are working files and should remain untracked.
  
  2. Create commit with message:
     ```
     deploy(baseSepolia): V11.1 fresh deployment + single-chain focus
     
     - Deploy fresh V11.1 contracts to Base Sepolia
     - Comment out Monad, MegaETH, Arc configs (reversible)
     - Update all deployment configs and documentation
     - Consolidate CHANGELOG duplicate V11.0 entries
     ```
  3. Do NOT push yet - wait for user confirmation

  **Must NOT do**:
  - Do not push to remote without user confirmation
  - Do not use --force or --amend

  **Parallelizable**: NO (final task)

  **References**:
  - AGENTS.md "Git Commit Style" for message format

  **Acceptance Criteria**:
  - [ ] `git status` shows only `.sisyphus/` as untracked (this is expected)
  - [ ] `git log -1` shows correct commit message
  - [ ] Commit includes exactly 9 files:
        - `packages/contracts-core/deployments/baseSepolia.json`
        - `packages/contracts-core/script/deploy-multichain.ts`
        - `apps/web/src/config/deployments.json`
        - `packages/indexer/ponder.config.ts`
        - `packages/contracts-testing/script/interactive/config.ts`
        - `apps/web/src/lib/chains.ts`
        - `STATUS.md`
        - `CHANGELOG.md`
        - `README.md`
  - [ ] `.sisyphus/` directory NOT included in commit

  **Commit**: YES (final)
  - Message: `deploy(baseSepolia): V11.1 fresh deployment + single-chain focus`
  - Files: 9 specific files listed above (NOT using `git add .`)
  - Pre-commit: Hook will attempt `packages/contracts-evm/script/verify-deployment.sh` (path mismatch, will warn "not found"). **Phase 6 is the actual verification gate.**

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `chore: stage V11 deployment configs` | 7 pending files | git status clean |
| 7 | `deploy(baseSepolia): V11.1 fresh deployment + single-chain focus` | All Phase 2-5 files | forge build && pnpm build |

---

## Success Criteria

### Verification Commands
```bash
# In packages/contracts-testing/
cd packages/contracts-testing && forge test
# Expected: 266 tests passing

# In packages/contracts-core/
cd packages/contracts-core && forge build
# Expected: success

cd packages/contracts-core && ./script/verify-deployment.sh
# Expected: All checks pass

# From repo root
pnpm build
# Expected: success, no TS errors

# Contract verification
cast call <LaunchpadEngine> "owner()(address)" --rpc-url https://sepolia.base.org
# Expected: deployer address
```

### Final Checklist
- [x] All "Must Have" present:
  - [x] Fresh V11.1 deployment with new addresses (7 contracts)
  - [x] Single-chain focus (Base Sepolia only in UI)
  - [x] Comment markers for disabled chains (`// V11.1: Disabled`)
  - [x] Version bumped to V11.1
- [x] All "Must NOT Have" absent:
  - [x] No deleted chain configs (all commented)
  - [x] No contract source changes
  - [x] No remote push without verification
- [x] All tests pass (266)
- [x] verify-deployment.sh passes
- [x] All documentation updated (STATUS, CHANGELOG, README)
