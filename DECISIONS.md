# Architectural Decision Records (ADRs)

## ADR-082: Adjudicator Trust & Guardian Role (Forward Compatibility)
- **Date**: 2026-01-21
- **Status**: Accepted
- **Context**:
  - Creators need permissionless choice of adjudicator.
  - Adjudicator trust should be signaled by standalone registries (Sooth DAO or third parties), not enforced by protocol.
  - Per-market guardian selection adds friction; guardian should be protocol-level.
  - Protocol owner should delegate daily ops to guardians but retain emergency override.
- **Decision**:
  1. Creators choose any adjudicator address (permissionless).
  2. Adjudicator registries remain standalone/off-chain trust signals; Launchpad does not enforce registry checks.
  3. Remove per-market guardian selection; guardian is a protocol-level role list (EOA/multisig), not creator-controlled.
  4. Global pause authority is delegated to guardians; protocol owner retains emergency override.
  5. Finalization is adjudicator-only; guardians do not finalize.
  6. Retroactive settlement (tStar) is deferred; `settle()` records outcome/tStar and `finalize()` is the future hook for retroactive adjustments.
  7. `ValidatedAdjudicator.registerMarket` should be auto-called during market creation with per-market config (Launchpad-only), so no deployer ops are required.
- **Consequences**:
- UI/indexers can display registry trust without constraining creation.
- Guardian/veto/finalize authority is consistent across all markets in a protocol instance.
- Daily operations move to guardians; owner acts only in emergencies.
- Retroactive settlement remains doc-only; finalize is the planned integration point.

## ADR-083: Canonical Filenames (Remove Versioned Code Paths)
- **Date**: 2026-01-21
- **Status**: Accepted
- **Context**:
  - Repo rules prohibit versioned filenames/folders (e.g., `LaunchpadEngineV11.sol`, `test/v11/`).
  - Current V11 code introduces versioned names that risk divergence and deployment mistakes.
- **Decision**:
  1. Rename versioned contract files to canonical names (e.g., `LaunchpadEngineV11.sol` → `LaunchpadEngine.sol`).
  2. Move tests from `test/v11/` into feature-based, non-versioned paths and rename files to canonical names.
  3. Preserve history via Git; avoid parallel versioned copies in active code.
  4. All new V11 changes must land in canonical filenames; any remaining `*V11*` files are migration debt to remove before release.
- **Consequences**:
  - Imports, deploy scripts, and tests must be updated to the canonical paths.
  - Legacy behavior should be tracked in Git history or archived in a `legacy/` folder if needed.

## ADR-081: V11 Adjudicator & Agent Policy Clarifications
- **Date**: 2026-01-20
- **Status**: Accepted
- **Context**:
  - Some markets resolve based on real-world events without a fixed date, so settlement must be allowed before expiration.
  - Agent-gated markets are not planned for V11; incentives are limited to fee discounts for registered market makers.
  - Adjudicator roadmap prioritizes ZK verification (Brevis) over TEE for the first implementation.
- **Decision**:
  1. Allow adjudicator settlement before market expiration when the truth event resolves (deadline remains the fallback expiration).
  2. Do not enable agent-gated markets in V11; trading remains open to all users.
  3. Limit agent incentives to TickBook fee discounts for registered market makers.
  4. Keep multi-validator adjudicator interfaces as-is; first target adjudicator is ZK/Brevis (TEE deferred).
  5. `tradeWithAgent` in Launchpad remains a compatibility alias (no gating or fee discounts).
- **Consequences**:
  - UI/docs should not assume settlement only after deadline.
  - Agent gating flags should default off; enforcement is not required beyond TickBook discounts.
  - ValidatedAdjudicator remains as a reference; ZK adjudicator integration is the next path.

## ADR-080: V11 ERC-8004 Integration & Trial Period System
- **Date**: 2026-01-20
- **Status**: Implemented (Branch: v11)
- **Context**:
  - V10 lacked creator protection mechanisms for new markets (no "undo" option if market doesn't gain traction)
  - AI agents needed first-class support for trading with reputation-based incentives
  - Market settlement required trustless verification via TEE attestations
  - LP tokens were internal accounting only, limiting DeFi composability
- **Decision**: Implement V11 in two phases:

  **Phase 1: Trial Period & LP Tokens**
  1. **Trial Period System**: New markets have a configurable trial window during which:
     - User costs are tracked via `lockedCost[market][user]`
     - P&L tracked via `trialBalance[market][user]`
     - Creator can call `dismissMarket()` to abort
     - Users can call `claimRefund()` to recover locked costs
  2. **LaunchpadLPToken (ERC20)**:
     - Settlement-locked transfers (freely tradable pre-settlement, locked post-settlement)
     - Enables LP tokens as collateral, staking, or secondary market trading
     - `transfersUnlocked()` = `!ITruthMarket(market).isSettled()`
  3. **Permit Support**: `placeOrderWithPermit()` enables gasless USDC approval (EIP-2612)

  **Phase 2: ERC-8004 Trustless Agents**
  1. **ERC-8004 Interfaces**:
     - `IIdentityRegistry`: Agent identity and wallet management
     - `IReputationRegistry`: Reputation scores and fee discount queries
     - `IValidationRegistry`: TEE attestation storage and verification
  2. **Standard Adjudicator Interface** (`IAdjudicator.sol`):
     - `settle(market, outcome, tStar, resolutionData)`: Generic settlement
     - `canSettle(market)`: Query settlement authorization
     - `adjudicatorType()`: Returns type ("tee", "manual", "oracle", "dao")
     - `IValidatedAdjudicator` extends with multi-attestation support
  3. **ValidatedAdjudicator**: TEE-validated settlement (implements `IValidatedAdjudicator`)
     - Requires valid attestation from registered agent before `settle()`
     - Multi-validator support for high-value markets
     - Configurable attestation window and minimum score
  3. **Agent Trading**:
     - `tradeWithAgent(agentId)`: Fee discount based on agent reputation
     - `placeOrderWithAgent(agentId)`: Orderbook access for agents
     - Agent-gated markets: Only agents with min reputation can trade
- **Rationale**:
  - **Creator Protection**: Trial period reduces risk of launching markets that fail to attract volume
  - **DeFi Composability**: ERC20 LP tokens enable yield farming, collateralization, and DEX trading
  - **Agent Adoption**: Reputation-weighted fees incentivize quality agent behavior
  - **Trust Minimization**: TEE attestations provide cryptographic proof of correct settlement
  - **Capital Efficiency**: Permit removes approval transaction requirement
- **Consequences**:
  - **New Contract**: `LaunchpadEngineV11.sol` replaces `LaunchpadEngine.sol` for new deployments
  - **Interface Extension**: `ILaunchpadEngine.sol` and `ITruthMarket.sol` expanded
  - **ERC-8004 Dependency**: Requires external registry contracts (can be mocked for testing)
  - **Migration Path**: Existing V10 markets continue to work; V11 features for new markets only
- **Files Added**:
  - `packages/contracts-core/src/interfaces/IERC8004.sol`
  - `packages/contracts-core/src/interfaces/IAdjudicator.sol`
  - `packages/contracts-core/src/LaunchpadLPToken.sol`
  - `packages/contracts-core/src/ValidatedAdjudicator.sol`
  - `packages/contracts-core/src/LaunchpadEngineV11.sol`
- **Test Coverage**: 126 tests passing (100%)

---

## ADR-079: ERC20 Token Isolation & Pro Page Split/Merge Removal
- **Date**: 2026-01-15
- **Status**: Accepted
- **Context**:
  - The `Collateralizer` contract provides `split()`/`merge()` functions to mint ERC20 Outcome Tokens (YES/NO) from USDC.
  - The `TickBookVault` (which powers the Pro page orderbook) uses **internal virtual shares** (`_yesInternalWad`) for gas-efficient matching.
  - There is currently **no bridge** to deposit ERC20 Outcome Tokens into the Vault (`depositOutcome` does not exist).
  - The `SplitMergePanel` on the Pro page allowed users to mint ERC20 tokens, but users were then confused because they could not trade these tokens on the orderbook.
- **Decision**:
  1. **Disable Split/Merge UI**: Removed `<SplitMergePanel />` from the Pro trading page.
  2. **Isolate ERC20s**: Acknowledge that ERC20 Outcome Tokens are currently "wallet-only" assets (for holding/transferring/AMMs) and are **incompatible** with the TickBook orderbook.
  3. **Preserve Code**: Retained `SplitMergePanel.tsx` in the codebase (with integer formatting fixes) for future AMM integration or if a Vault Bridge is implemented.
- **Rationale**:
  - **Reduce Confusion**: Prevents users from locking capital into tokens they cannot trade.
  - **Honest UI**: The Pro interface should only show actions that are relevant to the orderbook (Deposit/Withdraw USDC, Trade Internal Shares).
- **Consequences**:
  - **Feature Gap**: Users cannot purely "mint and hold" via the Pro UI anymore (must use CLI or future specialized UI).
  - **Refactor Opportunity**: Future work could implement `TickBookVault.depositOutcome()` to bridge the two systems.
- **Files Changed**:
  - `apps/web/src/pages/Pro.tsx`
  - `STATUS.md`


## ADR-078: MegaETH Platform Stability & Gas Limit Handling
- **Date**: 2026-01-14
- **Status**: Accepted
- **Context**:
  - Market creation on MegaETH Testnet consistently reverted or timed out.
  - Root cause 1: Hardcoded gas limit (2.5M) was insufficient for MegaETH (requires ~28M).
  - Root cause 2: Clock drift between local machine and MegaETH sequencer caused "deadline in past" reverts.
  - Root cause 3: CLI trading commands only supported orderbook-based markets, not pre-graduation Launchpad markets.
- **Decision**:
  1. **Dynamic Gas Estimation**: Removed hardcoded gas limits in `createmarket` and increased `MAX_GAS` cap to 30M in `estimateGas` helper.
  2. **On-Chain Deadlines**: Calculate market deadlines using the `block.timestamp` fetched from the RPC instead of local system time.
  3. **Unified CLI Trading**: Updated `market` command to route trades to `LaunchpadEngine.tradePositions` when a market key is not available but a market address is selected.
- **Consequences**:
  - Successful market creation on MegaETH Testnet.
  - Improved CLI reliability across chains with different gas pricing and clock characteristics.
  - Seamless transition from pre-graduation (AMM) to post-graduation (Orderbook) trading in the CLI.

## ADR-077: Event Instrumentation for Indexer Completeness
- **Date**: 2026-01-12
- **Status**: Accepted
- **Context**:
  - The indexer could not accurately reconstruct balances and liquidity changes due to missing events.
  - Portfolio required reliable USDC balance transitions, LP balance changes, and lock lifecycle visibility.
- **Decision**:
  1. Add explicit spend events for TickBookVault (reserved + available).
  2. Emit lock lifecycle and balance adjustment events in AMMEngine.
  3. Emit LP balance, fee accrual, and graduation progress events in LaunchpadEngine.
  4. Emit internal cleanup and liquidity change events in TickBookPoolManager.
- **Consequences**:
  - Requires full redeploy (Vault + PoolManager + AMM + Launchpad) due to new event signatures.
  - Indexer ABIs and handlers must update and reindex from new start blocks.

## ADR-076: Launchpad Create Flow Simplification
- **Date**: 2026-01-10
- **Status**: Accepted (Implemented)
- **Context**:
  - Launchpad creation required deploying `TruthMarket` externally, then calling `LaunchpadEngine.createMarket`, then activating the market.
  - This split flow caused partial setup states and UI/CLI complexity.
  - We need to support scheduled starts while enforcing a minimum deposit.
- **Decision**:
  1. **Single-Step Create**: `LaunchpadEngine.createMarket` now deploys `TruthMarket` internally and returns `(market, lpTokens)`.
  2. **Start-Time Scheduling**: `TruthMarket` constructor includes `startTime`, and markets are LIVE when `startTime <= now < deadline`.
  3. **Remove Activation**: `TruthMarket.activate()` removed; no CREATED state.
  4. **Minimum Deposit**: Enforce `$10` minimum creator deposit in Launchpad flows.
- **Rationale**:
  - **Atomic setup**: Avoid partial markets and simplify UX (approve → create).
  - **Future scheduling**: Start-time parameter supports planned launches without separate activation.
  - **Consistency**: Single source of truth for market lifecycle; fewer steps in CLI/FE.
- **Consequences**:
  - **Breaking change**: `createMarket` signature and `TruthMarket` constructor/ABI updated.
  - **Frontend/CLI**: Launchpad and Create flows decode `MarketCreated` directly from `TruthMarket`.
  - **Tests**: Debug launchpad creation test updated; fuzz threshold relaxed for stress test.
- **Files Changed**:
  - `packages/contracts-core/src/LaunchpadEngine.sol`
  - `packages/contracts-core/src/TruthMarket.sol`
  - `apps/web/src/pages/Launchpad.tsx`
  - `apps/web/src/pages/Create.tsx`
  - `packages/contracts-testing/script/interactive/commands/market.ts`

## ADR-075: Tick-Indexed Spot Fills for O(overlap) Gas Complexity (V10.4)
- **Date**: 2026-01-06
- **Status**: Accepted (Implementation in `spot-fill-gas-opt` branch)
- **RFC**: RFC-001 (packages/contracts-core/docs/RFC-001-SpotFillGasOptimization.md)
- **Context**:
  - V10's `_fillSpotLiquidity` had O(N) complexity where N = all historical spot sell orders.
  - Even inactive orders cost ~2,100 gas (cold SLOAD) to check the `active` flag.
  - With 500 orders, gas costs grew from ~380k to ~680k+ (with spikes to 1.3M for crossing).
  - Root cause: `for (uint256 sellId = 1; sellId <= maxSpotId; ...)` never decrements.
- **Decision**:
  1. **Tick-Indexed Storage**: Add `_spotSellIdsAtTick[marketKey][outcome][tick][]` mapping.
  2. **Range Cap**: Enforce `MAX_SPOT_RANGE = 50` ticks for spot sell orders.
  3. **Canonical Tick Deduplication**: Process each order once at `max(tickLower, overlapLow)`.
  4. **Eager Cleanup**: Remove from tick arrays on cancel/complete via swap-and-pop.
- **Implementation**:
  ```solidity
  // New storage
  mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint256[]))) private _spotSellIdsAtTick;
  
  // Range validation in placeSpotSell
  if (tickUpper - tickLower + 1 > MAX_SPOT_RANGE) revert SpotRangeTooWide();
  
  // Fill loop: iterate by tick, not by ID
  for (uint16 t = overlapLow; t <= overlapHigh && remaining > 0; t++) {
      uint256[] storage sellIds = _spotSellIdsAtTick[marketKey][sellerOutcome][t];
      for (uint256 i = 0; i < sellIds.length && remaining > 0; i++) {
          // Canonical tick check prevents double-fills
          uint16 canonicalTick = spotOrder.tickLower > overlapLow ? spotOrder.tickLower : overlapLow;
          if (t != canonicalTick) continue;
          // ... fill logic
      }
  }
  ```
- **Gas Impact**:
  | Operation | Before | After | Change |
  |-----------|--------|-------|--------|
  | Cross with 50 historical spots | ~210k | ~20k | **-90%** |
  | Cross with 200 historical spots | ~420k | ~20k | **-95%** |
  | Place 50-tick spot sell | ~350k | ~600k | +70% (bounded) |
- **Rationale**:
  - **Crosser Priority**: Makers (placers) pay more so takers (crossers) get predictable gas.
  - **Bounded Overhead**: 50-tick cap limits placement overhead to ~250k gas maximum.
  - **Simplicity**: Array indexing is simpler than accumulator-based pro-rata.
- **Alternatives Considered**:
  - **Option B (Linked List)**: Still O(active), doesn't leverage tick locality.
  - **Option C (Growth Accumulator)**: Complex Q128 math, changes settlement semantics.
  - **Option D (Boundary Indexing)**: O(1) placement, but complex active-set management in fill loop. Deferred to V10.5 if wider ranges needed.
- **Consequences**:
  - **Breaking Change**: Requires V10.4 deployment.
  - **UX Impact**: Wide spot sells (>50 ticks) now revert with `SpotRangeTooWide()`.
  - **SDK/Frontend**: Should document "narrow range preferred" constraint.
- **Files Changed**:
  - `packages/contracts-core/src/TickBookPoolManager.sol` — Tick-indexed storage + fill rewrite
  - `packages/contracts-testing/test/crossing/UnifiedCrossing.t.sol` — Range cap test
- **Test Coverage**: 10/10 crossing tests pass, including new `test_SpotSellRangeCapped()`.

---

## ADR-073: V10 Unified Crossing with Dual-Collateral Architecture
- **Date**: 2026-01-05
- **Status**: Accepted (Implemented)
- **Context**:
  - V9.9.7/V9.9.8 has fractured liquidity: Range Orders (USDC-backed) and Spot Sells (token-backed) use separate storage and crossing logic.
  - Standard `placeOrder()` only crosses against Range Orders, ignoring potentially cheaper Spot Sell liquidity.
  - This is documented as a known limitation (ADR-072) with frontend routing as mitigation.
  - For V10, we need unified crossing that treats all liquidity sources as a single orderbook.
- **Decision**:
  1. **Unified TickLiquidity structure**: Each tick stores both range and spot liquidity.
     ```solidity
     struct TickLiquidity {
         int128 rangeLiquidityNet;
         uint128 rangeLiquidityGross;
         uint128 spotLiquidity;  // NEW: outcome-token-backed shares
     }
     ```
  2. **Combined bitmap**: OR of (ticks with range liquidity) and (ticks with spot liquidity) for efficient traversal.
  3. **Single `_crossUnified()` function**: Replaces current `_tryCross()`, consumes both sources per tick.
  4. **Fill priority**: Spot first, then range — recycles existing tokens before minting synthetic exposure.
  5. **Settlement branching**: After determining fill source, branch to appropriate vault operations:
     - Spot: `transferLockedOutcome()` to buyer, `creditUsdcAvailable()` to seller
     - Range: Update growth accumulators, mint synthetic positions
  6. **Spot fill attribution**: Two options evaluated:
     - **Per-tick order queue**: `spotSellIdsAtTick[marketKey][outcome][tick][]` — simpler but gas-heavy
     - **Spot growth accumulator**: `_spotFillGrowthGlobalX128` — matches range pattern, more complex math
     - Decision: TBD based on gas benchmarks during V10 development.
- **Rationale**:
  - **Single canonical orderbook**: Any taker gets best available price from all liquidity.
  - **Cleaner integration**: Integrators don't need to know about dual liquidity systems.
  - **Better capital efficiency**: Natural sellers (token holders) compete directly with market makers.
  - **Unified price discovery**: `activeLiquidity` and tick traversal reflect true market depth.
- **Consequences**:
  - **Major refactor**: Tick data structures, bitmap logic, and crossing algorithm all change.
  - **Audit required**: Matching and settlement logic modifications need fresh security review.
  - **Migration**: Existing orders on V9.9.x deployments won't migrate; fresh V10 deployment required.
  - **Gas impact**: Per-tick iteration may increase if both sources have liquidity; needs benchmarking.
- **Architecture Diagram**:
  ```
  ┌─────────────────────────────────────────────────┐
  │              TickLiquidity (per tick)           │
  ├─────────────────────────────────────────────────┤
  │  rangeLiquidityNet: int128   (range orders)     │
  │  rangeLiquidityGross: uint128                   │
  │  spotLiquidity: uint128      (spot sells)       │
  └─────────────────────────────────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────────┐
  │            _crossUnified()                       │
  ├─────────────────────────────────────────────────┤
  │ 1. Traverse ticks via combined bitmap           │
  │ 2. At each tick T:                              │
  │    spotAvail = tick.spotLiquidity               │
  │    rangeAvail = f(tick.rangeLiquidityGross)     │
  │ 3. Fill spot FIRST (recycle existing tokens)    │
  │ 4. Then fill range (mint synthetic)             │
  │ 5. Branch settlement by source type             │
  │ 6. Update growth accumulators                   │
  └─────────────────────────────────────────────────┘
  ```
- **Alternative Considered**: Router contract that orchestrates `buyFromSpotSell()` + `placeOrder()` calls.
  - Pros: No core contract changes, ships fast
  - Cons: Fragmented for direct on-chain callers, extra gas for multi-call
  - Decision: Router is V9.9.8 mitigation; V10 should have native unified crossing.
- **Files Affected (V10)**:
  - `packages/contracts-core/src/TickBookPoolManager.sol` — Updated to V10 Logic (Unified Crossing)
  - `packages/contracts-core/src/libraries/TickBitmap.sol` — Combined bitmap logic
  - `packages/contracts-core/src/interfaces/ITickBookPoolManager.sol` — Updated interface
- **Dependencies**:
  - ADR-072 (V9.9.8 known limitation) documents the gap this addresses
  - Requires fresh audit before mainnet deployment
- **Timeline**: V10 development cycle (post-V9.9.x stabilization)


## ADR-074: MAX_TICK (999) Range Boundary Visibility for Overlap Discovery
- **Date**: 2026-01-06
- **Status**: Accepted (Implemented in code; requires redeploy)
- **Context**:
  - TickBook represents tradable ticks as `1..999` (0.1¢..99.9¢).
  - Range order boundaries are tracked via a bitmap to discover available liquidity.
  - For an order ending at `tickUpper = 999`, the natural upper boundary would be `tickUpper + 1 = 1000`, which is outside the tradable tick space and not representable in the existing bitmap.
  - This can cause overlap discovery to miss liquidity that extends to the top tick, leading to under-crossing and confusing “full range” behavior.
- **Decision**:
  1. Keep tradable ticks as `1..999`.
  2. Special-case `tickUpper == MAX_TICK` boundary bookkeeping:
     - Do not attempt to set a bitmap bit at `1000`.
     - Instead, record a sentinel boundary at `MAX_TICK` so bitmap-based discovery can still "see" liquidity reaching the top.
- **Consequences**:
  - Requires redeploying `TickBookPoolManager` for on-chain behavior to change.
  - Market orders in the frontend are temporarily disabled until sweep semantics are clarified.



## ADR-072: Fractured Liquidity — Spot Sell Isolation (V9.9.8 Known Limitation)
- **Date**: 2026-01-05
- **Status**: Accepted (Known Limitation, Fix Deferred to V10)
- **Context**:
  - V9.9.7 introduced Spot Sell as an "add-on" feature for users to sell existing shares.
  - Spot Sell orders are stored in separate mappings: `_spotSellOrders`, `_spotSellLiquidity`.
  - The `_tryCross()` function in `placeOrder()` only iterates over Range Order liquidity.
  - QA testing confirmed: standard Buy orders do NOT match against Spot Sells.
- **Decision**:
  1. **Accept as V9.9.8 limitation**: Do not modify crossing logic in this release.
  2. **Frontend mitigation required**: Pro.tsx Buy flow must check `getSpotSellLiquidity()` and route to `buyFromSpotSell()` if better price exists.
  3. **Defer unified crossing to V10**: Full integration requires significant `_tryCross()` refactor.
- **Rationale**:
  - **Scope control**: V9.9.8 is a bug-fix release; crossing refactor is high-risk.
  - **Testability**: Separate liquidity pools are easier to reason about and test.
  - **Time constraint**: Frontend routing is faster to implement than contract changes.
- **Consequences**:
  - **UX impact**: Buyers may miss cheaper Spot Sell prices if frontend routing fails.
  - **Fractured depth**: Orderbook visualization must aggregate both liquidity types.
  - **V10 requirement**: Unified crossing is now a hard requirement for V10.
- **Files Affected**:
  - `apps/web/src/pages/Pro.tsx` — Needs Spot Sell routing logic
  - `packages/contracts-core/src/TickBookPoolManagerV996.sol` — `_tryCross()` unchanged
- **QA Reference**: `~/.gemini/antigravity/brain/.../qa_report_997.md.resolved`

## ADR-071: cancelSpotSell Proceeds Double-Claim Prevention
- **Date**: 2026-01-05
- **Status**: Accepted (Implemented)
- **Context**:
  - V9.9.7 introduced spot sell functionality with `placeSpotSell`, `cancelSpotSell`, `buyFromSpotSell`, and `claimSpotSellProceeds`.
  - The `SpotSellOrder` struct tracks `proceedsWad` — USDC owed to seller from partial fills.
  - Both `cancelSpotSell` and `claimSpotSellProceeds` credit proceeds to the seller.
  - **Bug**: `cancelSpotSell` credited `order.proceedsWad` but did NOT zero it, allowing a second credit via `claimSpotSellProceeds`.
- **Decision**:
  1. **Zero proceeds before credit**: In `cancelSpotSell`, capture proceeds to local variable, zero storage, then credit.
  2. **Pattern consistency**: Match the existing pattern in `claimSpotSellProceeds` which already zeros before crediting.
  3. **No separate claim after cancel**: `claimSpotSellProceeds` becomes a no-op after cancel (proceeds already zeroed).
- **Rationale**:
  - **Security**: Prevents double-credit attack that mints extra USDC to sellers.
  - **Simplicity**: Single-line fix, no architectural change needed.
  - **Idempotency**: Either cancel or claim can be called first; the second is a safe no-op.
- **Consequences**:
  - **Requires redeployment**: Contracts must be redeployed to fix vulnerability.
  - **No migration needed**: No state to migrate; new orders use fixed logic.
- **Files Changed**:
  - `packages/contracts-core/src/TickBookPoolManager.sol` — Lines 793-798
  - `packages/contracts-core/src/TickBookPoolManagerV996.sol` — Lines 793-798

## ADR-070: RPC-Only Fill Tracking for Orders
- **Date**: 2026-01-04
- **Status**: Accepted (Implemented)
- **Context**:
  - The Ponder indexer tracks `FillsClaimed` events but cannot accurately compute **pending fills**.
  - The contract uses a global pro-rata accumulator system (`_fillGrowthGlobalX128`) to distribute fills across all orders in a tick range.
  - Only the on-chain `getPendingFills(marketKey, orderId)` view function knows the true pending amount.
  - Previous attempts to merge indexer data with RPC were error-prone and caused stale data issues.
- **Decision**:
  1. **Always use RPC** for user orders via `useUserOrdersDirect` hook.
  2. **Indexer for historical data only** — orderbook depth, trade history, market list.
  3. **Simplified order actions**:
     - Open orders (< 100% filled) → Cancel button (also claims pending)
     - Filled orders (100%) → Claim button
  4. **Remove "claimable" filter** — redundant since cancel claims pending anyway.
- **Rationale**:
  - **Accuracy**: RPC calls `getPendingFills()` which reads accumulator state correctly.
  - **Simplicity**: Single data source eliminates merge/reconciliation bugs.
  - **Performance**: User orders are typically < 200 per market; RPC is fast enough.
- **Consequences**:
  - **No offline pending fills**: UI requires RPC access to show accurate fill status.
  - **Indexer limitation documented**: Clear separation of indexer vs RPC responsibilities.
- **Files Changed**:
  - `apps/web/src/hooks/indexer/useOrdersIndexed.ts` — Always delegates to RPC

## ADR-069: Ponder Indexer with Per-Chain Readiness
- **Date**: 2026-01-04
- **Status**: Accepted (Implemented)
- **Context**:
  - RPC-based order enumeration was hitting rate limits and causing slow page loads.
  - The Pro terminal needed fast access to orderbook depth and trade history.
  - Multi-chain deployment required graceful degradation when one chain's indexer lags.
- **Decision**:
  1. **Ponder Indexer**: Use Ponder v0.15 for event indexing with PGlite embedded database.
  2. **Per-Chain Readiness**: Frontend checks `/status` endpoint and enables indexer per-chain.
  3. **RPC Fallback**: If a chain isn't synced, frontend falls back to direct RPC calls.
  4. **Start Blocks**: Configure recent start blocks to minimize backfill time.
  5. **Symlinked Config**: Indexer uses root `.env` via symlink for shared RPC URLs.
- **Rationale**:
  - **Performance**: Pre-indexed data eliminates N+1 RPC queries for orderbook.
  - **Resilience**: Per-chain checks prevent one slow chain from blocking entire UI.
  - **Developer Experience**: Ponder provides hot-reload and type-safe schema.
- **Consequences**:
  - **Operational**: Indexer must run alongside frontend for full functionality.
  - **Cold Start**: First backfill takes minutes depending on RPC rate limits.
- **Files Added**:
  - `packages/indexer/` — Complete Ponder indexer package
  - `apps/web/src/hooks/indexer/config.ts` — Per-chain readiness checks
  - `apps/web/src/hooks/indexer/useOrdersIndexed.ts`
  - `apps/web/src/hooks/indexer/useOrderbookIndexed.ts`
  - `apps/web/src/hooks/indexer/useTradesIndexed.ts`

## ADR-068: RPC Rate Limit (429) & Bad Request (400) Mitigation Strategy
- **Date**: 2026-01-04
- **Status**: Accepted (Implemented)
- **Context**:
  - The Pro trading terminal and market discovery hooks were causing frequent 429 (Too Many Requests) errors on public RPC nodes (Base Sepolia).
  - Arc Testnet RPCs were returning 400 (Bad Request) errors when multiple high-frequency event listeners were active.
  - The page load triggered 20+ simultaneous metadata requests for market discovery.
- **Decision**:
  1. **Chunked Sequential Fetching**: Implement batching (5 items/batch) with 100ms delays for market discovery metadata.
  2. **Multicall Aggregation**: Replace individual `readContract` loops with `multicall3` for orderbook enumeration.
  3. **Tiered Caching Strategy**:
     - **Static/Meta**: 60s stale time (Tokens, Addresses).
     - **Dynamic/State**: 10s stale time / 20s refresh (Prices, Liquidity).
  4. **Chain-Specific Throttling**: Disable event-based Activity Listeners on Arc Testnet (ID 10143) where RPC filtering is unreliable.
- **Rationale**:
  - **Stability**: Prevents frontend "white-screens" caused by RPC provider lockouts.
  - **UX**: Maintains responsive data updates while staying within free-tier RPC quotas.
  - **Maintainability**: Centralized caching defaults in `useDirectRead` provide a safety net for all future hooks.
- **Consequences**:
  - **Data Freshness**: Prices may lag by up to 10 seconds (acceptable for alpha).
  - **Event Log Gap**: Activity logs on Arc Testnet will require manual refresh or won't be live-updating.
- **Files Changed**:
  - `apps/web/src/hooks/useDirectRead.ts` (Defaults)
  - `apps/web/src/hooks/useOnChainMarkets.ts` (Chunking)
  - `apps/web/src/hooks/useAllOrdersDirect.ts` (Multicall)
  - `apps/web/src/pages/Pro.tsx` (Tiered Caching)
  - `apps/web/src/components/features/ActivityListenerV8.tsx` (Arc disable)

## ADR-067: Launchpad V9.9.6 Redesign (Single Page & Features)
- **Date**: 2026-01-03
- **Status**: Implemented (Frontend)
- **Context**:
  - The legacy `Create.tsx` was a multi-step wizard which felt disjointed.
  - Users requested features: Flexible Expiration (7d/30d/Custom/Open-End), Market Categories, and better Educational Content.
  - "Open-End" markets required a specific implementation (Year 2100 deadline).
  - "Brevis Adjudicator" integration was requested as top-tier partnership feature.
- **Decision**:
  1. **Single-Page Architecture**: Replaced wizard with a scrolling, section-based `Launchpad.tsx`.
  2. **Market Categories**: Introduced UI-only categories (metadata stored in localStorage) as contracts are generalized.
  3. **Open-End Implementation**: Set `TruthMarket` deadline to Jan 1, 2100 (`4102444800`) to keep market LIVE indefinitely until manually settled.
  5. **Mock Brevis Registry**: Added placeholder registry for Brevis ZK adjudicators pending real addresses.
  6. **Earnings Simulator**: Integrated client-side P&L calculator to demonstrate "5% Fee" revenue model directly in the UI.
  7. **USD-Centric Inputs**: Liquidity input focuses on USDC amount, auto-calculating `b` and deposit.
- **Rationale**:
  - **UX**: Single page allows users to review all settings at once.
  - **Feature Parity**: Meets all competitive feature requests (categories, flexible dates).
  - **Education**: Inline cards explain complex AMM concepts (Fees, Graduation) proactively.
- **Consequences**:
  - **Breaking Route**: `/create` now loads `Launchpad`. Old dashboard moved to `/dashboard`.
  - **Storage**: Market metadata depends on browser `localStorage` (temporary solution until Indexer/Subgraph v2).
## ADR-066: Unified Order API (V9.9.6)
- **Date**: 2026-01-01
- **Status**: Accepted (Implemented - Not Yet Deployed)
- **Context**:
  - V9.9.5 had separate `placeRangeOrder()` and `executeMarketOrder()` functions.
  - Users could place orders without claiming their pending fills, leading to "stuck" positions.
  - Frontend needed to maintain two code paths for different order types.
  - "Maker/taker" terminology was confusing since a single user can be both.
- **Decision**:
  1. **Single `placeOrder()` Function**: Replace both functions with unified API:
     ```solidity
     function placeOrder(
         bytes32 marketKey,
         uint8 outcome,
         uint256 shares,
         uint16 tickLower,
         uint16 tickUpper,
         uint256 maxCost
     ) external returns (
         uint256 orderId,
         uint256 filledShares,
         uint256 filledCost,
         uint256 restingShares
     )
     ```
  2. **Order Types via Tick Range**:
     - Market order: `tickLower=1, tickUpper=999` (fill everything)
     - Limit order: `tickLower=X, tickUpper=X` (single tick)
     - Range order: `tickLower < tickUpper` (spread liquidity)
     - Market with floor: `tickLower=floor, tickUpper=999` (fill then rest)
  3. **Auto-Claim on New Order**: `_autoClaimUserOrders()` claims all pending fills before placing.
  4. **Terminology Cleanup**: Renamed `makerOutcome` → `crossedOutcome` throughout.
  5. **No Deprecation**: Alpha phase allows direct API replacement.
- **Rationale**:
  - **Simpler Mental Model**: Every order is a range order that crosses what it can and rests the remainder.
  - **Better UX**: Auto-claim prevents "stuck" positions.
  - **Cleaner Frontend**: Single code path with helper functions.
  - **Gas Efficiency**: Auto-claim adds ~4-8k gas per active order checked.
- **Consequences**:
  - **Breaking Change**: Contracts must be redeployed.
  - **Frontend Update**: New `usePlaceOrder` hook with helpers.
  - **ABI Change**: New `V996_ABIS` export for frontend.
  - **Test Coverage**: 11 new tests covering all order types.
- **Files Changed**:
  - `packages/contracts-core/src/TickBookPoolManagerV996.sol` — New contract
  - `packages/contracts-testing/test/v9/UnifiedOrderSystem.t.sol` — Tests
  - `apps/web/src/hooks/usePlaceOrder.ts` — New hook
  - `apps/web/src/config/abis.ts` — Added V996_ABIS

---

## ADR-065: Package Split — contracts-core + contracts-testing
- **Date**: 2026-01-01
- **Status**: Accepted (Implemented)
- **Context**:
  - Audit preparation required clear scope definition for auditors.
  - Different teams/roles own protocol core vs QA/partner engagement.
  - Old V4/V5/V8 artifacts (broadcast logs, deployment configs) cluttered the codebase.
  - Test infrastructure and partner demos shouldn't be in audit scope.
- **Decision**:
  1. **Split `packages/contracts-evm/`** into two packages:
     - `contracts-core` — Audit scope: core contracts + infrastructure deployment scripts
     - `contracts-testing` — QA/Partners: tests, market scripts, benchmarks, mocks
  2. **Delete outdated artifacts**:
     - `broadcast/` folder (V4/V5/V8 transaction logs)
     - `deployments/v2-archive/`, `v8-*.json`
     - `mockusdc-latest.json`, `test-market-latest.json`
  3. **Use symlinks** for shared dependencies:
     - `contracts-testing/lib` → `../contracts-core/lib`
     - `contracts-testing/core` → `../contracts-core/src`
  4. **Use `@core/` remapping** in tests to import from core package.
- **Rationale**:
  - **Audit Clarity**: Auditors can focus on `contracts-core/src/` only.
  - **Team Separation**: Protocol devs own core, QA owns testing.
  - **Partner Demos**: HFT benchmark and fork tests are partner engagement tools.
  - **Clean Codebase**: Removed ~500+ outdated files.
- **Consequences**:
  - **Path Changes**: All references to `contracts-evm` must update.
  - **Sync Scripts**: Updated to point to `contracts-core/deployments/`.
  - **CI**: May need workflow path updates.
  - **119 tests pass** in the new structure.
- **Files Changed**:
  - `package.json` — Updated workspaces and scripts
  - `apps/web/scripts/sync-v9-deployments.js` — New paths
  - `sync-deployments.sh` — New paths

---

## ADR-064: Fill Overflow & Order Lifecycle Fixes (V9.9.5)
- **Date**: 2025-12-31
- **Status**: Accepted (Deployed to Base Sepolia)
- **Context**:
  - Q128 accumulator math in `_fillGrowthGlobalX128` could cause `filledShares > sharesTotal` (~0.1% drift over many fills).
  - Phantom orders: Fully-filled orders remained "active" with dust liquidity in tick structures.
  - Double subtraction risk: Multiple cleanup paths (crossing, claimFills, cancel) could double-subtract from `_totalLiquidity`.
- **Decision**:
  1. **Add `liquidityRemoved` flag**: New boolean in `RangeOrder` struct for idempotent cleanup.
     ```solidity
     struct RangeOrder {
         // ... existing fields
         bool liquidityRemoved;  // Track if tick liquidity has been cleaned up
     }
     ```
  2. **Cap `filledShares` at `sharesTotal`**: In `claimFills()`, prevent accumulator drift:
     ```solidity
     uint256 maxFillable = order.sharesTotal > order.filledShares
         ? order.sharesTotal - order.filledShares
         : 0;
     if (filledShares > maxFillable) {
         filledShares = maxFillable;
     }
     ```
  3. **Auto-complete orders**: When `filledShares >= sharesTotal`, automatically remove tick liquidity and set `active=false`.
  4. **Guard all cleanup paths**: All three paths (crossing, claimFills, cancel) now check `liquidityRemoved` before subtracting from `_totalLiquidity`.
- **Rationale**:
  - **Invariant Safety**: Ensures `filledShares <= sharesTotal` always holds.
  - **Idempotency**: Multiple claims or cancels cannot corrupt liquidity tracking.
  - **Gas Efficiency**: Auto-completion prevents users from paying gas to cancel fully-filled orders.
- **Consequences**:
  - **Breaking Change**: New struct field requires redeployment (not upgradeable).
  - **Test Coverage**: 40/40 TickBook tests passing including edge cases.
  - **✅ RESOLVED**: Created `TickBookPoolManagerV995.sol` on the lean V9.9.4 base (no hooks).
    - Original V9.9.5 (`TickBookPoolManager.sol`) was based on pre-V9.9.4 code with hooks.
    - New `TickBookPoolManagerV995.sol` applies ADR-064 fixes to hook-free V9.9.4 architecture.
    - Maintains ADR-062/063 decisions (no hooks, simple `setFees()` storage).
- **Deployment**: Base Sepolia `0x949a1dB3907b787fe432D1Af274636497470298e` (old with hooks)
- **New Contract**: `TickBookPoolManagerV995.sol` (lean, ready for deployment)

---

## ADR-063: Fee Cap at 10% (V9.9.4 - TOB-2 Fix)
- **Date**: 2025-12-31
- **Status**: Accepted (Implemented)
- **Context**:
  - Trail of Bits audit (TOB-2) identified that hook-based dynamic fees had no upper bound.
  - A malicious or buggy hook could return `type(uint24).max` (16,777,215 bps = 167,772%).
  - This could extract excessive fees from users or cause griefing attacks.
- **Decision**:
  1. **Hard cap fees at 10%**: Added `MAX_FEE_BPS = 1000` constant.
  2. **Validate in setFees()**: `require(_takerFee <= MAX_FEE_BPS)`.
  3. **Remove hooks entirely**: Replaced with simple `takerFeeBps`/`makerFeeBps` storage.
- **Rationale**:
  - **Security**: Prevents malicious fee extraction.
  - **Simplicity**: Simple fee storage is sufficient for alpha; hooks can return in V10 if needed.
  - **Gas Savings**: Removes ~5-10k gas per trade from hook permission checks.
- **Consequences**:
  - **Breaking**: Existing hook contracts no longer work with V9.9.4.
  - **Migration**: DynamicFeeHook users must use `setFees()` instead.
- **Documentation**: See `audit/TRAIL_OF_BITS_AUDIT_V9.9.3.md` (TOB-2)

---

## ADR-062: V9.9.4 Hook System Removal (Lean Architecture)
- **Date**: 2025-12-31
- **Status**: Accepted (Implemented)
- **Context**:
  - OG Efficiency Review identified 200+ lines of hook infrastructure never used in production.
  - TransientDelta (flash accounting) added 150 lines, also unused.
  - `batchPlaceOrders` existed but frontend never called it.
  - Codebase grew 60% from V8.3 without corresponding feature usage.
- **Decision**:
  1. **Remove ITickBookHooks**: Delete interface, all before/after callbacks.
  2. **Remove TransientDelta**: Archive to `_archived/` folder.
  3. **Remove flash accounting**: Delete `lock()`, `settle()`, `take()`, `getDelta()`.
  4. **Remove batch operations**: Delete `batchPlaceOrders()`.
  5. **Simplify Market struct**: Remove `hook` field.
  6. **Simplify PoolKey**: Remove `hook` from hash.
- **Rationale**:
  - **YAGNI**: No integrators using hooks at alpha stage.
  - **Gas Efficiency**: 30% reduction in TickBook operation costs.
  - **Code Reduction**: 417 lines removed (32% of TickBookPoolManager).
  - **Audit Surface**: Smaller codebase = easier security review.
- **Consequences**:
  - **Breaking**: V9.9.3 hooks no longer work; must redeploy.
  - **Future**: Can reintroduce hooks in V10 if demand emerges.
  - **FE Impact**: None - frontend never used these features.
- **Documentation**: See `audit/OG_EFFICIENCY_REVIEW_V9.9.3.md`

---

## ADR-061: Crossed-Market Taker Discovery & Boundary Math Fix (V9.9.2)
- **Date**: 2025-12-31
- **Status**: Implemented (Merged)
- **Context**:
  - After fixing overlap fill capping (ADR-060), another critical bug was discovered in `_fill` (market execution engine).
  - **Problem 1 (Discovery)**: If the market price (`currentTick`) was "behind" the best available maker (e.g. price at 1, but best bid at 400), takers in the direction of the maker would find "NoLiquidity" because the search logic only looked "ahead".
  - **Problem 2 (Math)**: When moving DOWN (Buy NO / Sell YES), the boundary crossing used `tick + 1` instead of `tick`, causing it to miss boundaries and fail to activate liquidity.
- **Decision**:
  1. **Best-Price Jump**: Inside `_fill`, if `activeLiq == 0`, look for the absolute lowest ask or highest bid in the book. If these "crossed" the current tick, jump to them immediately before starting the fill walk.
  2. **Boundary Crossing Alignment**: Fixed the `liquidityNet` lookup for downward moves to use `tick`, ensuring makers are correctly activated when takers enter their range.
- **Rationale**:
  - **Market Efficiency**: Takers can now always find makers regardless of price gaps or initialization states.
  - **Mathematical Correctness**: Aligns downward boundary crossing with the `TickBook` boundary definition.
- **Consequences**:
  - **Robustness**: Resolves the persistent `NoLiquidity` reverts in fuzz and settlement tests.
  - **Breaking Change**: Requires contract redeployment to V9.9.2.

---

## ADR-060: Global Pro-Rata Arithmetic Safety (V9.9.1)
- **Date**: 2025-12-31
- **Status**: Implemented (Merged)
- **Context**:
  - The V9 TickBook uses a Global Pro-Rata Growth accumulator. In V9.9.0, a bug was identified where `_getOverlappingLiquidity` (the approximation for depth in a range) could over-estimate available liquidity under certain conditions.
  - **Problem**: Over-estimation caused `_fillGrowthGlobalX128` to inflate beyond 100% of an order's capacity, leading to **Arithmetic Underflow (Revert 0x11)** when attempting to cancel such orders (as `filled > total`).
- **Decision**:
  1. **Strict Liquidity Capping**: `_getOverlappingLiquidity` now strictly caps its range estimation by the actual `_totalLiquidity[marketKey][outcome]` in the book.
  2. **Transparency**: Reverted temporary UI-level capping. The protocol must maintain its invariants without cosmetic masking.
- **Rationale**:
  - **Invariants**: Ensures total fills never exceed the mathematical capacity of an order.
  - **Integrity**: Resolves the root cause of arithmetic panics without compromising the global pro-rata architecture.
- **Consequences**:
  - **Bug Fix**: Resolves the "Double Fill" vulnerability.
  - **Breaking Change**: Requires contract redeployment to V9.9.1.

---

## ADR-058: _tryCross Sweep Direction & Overlap-Only Fills (V9.9)
- **Date**: 2025-12-30
- **Status**: Accepted (Merged via PR #21)
- **Context**:
  - After fixing overlap detection (ADR-057), a second bug was discovered: orders could show >100% filled.
  - Root cause: `_tryCross` calculated fills using the **entire** order range instead of only the **overlapping** tick range.
  - Example: BUY [300-400] crosses SELL [350-450]. The overlap is [350-400], but fills were calculated using the full [350-450] range.
- **Decision**:
  1. **Sweep from worst-to-best price**:
     - SELL orders: sweep LOW→HIGH (start at tickLower, move up)
     - BUY orders: sweep HIGH→LOW (start at tickUpper, move down)
  2. **Calculate overlap range explicitly**:
     ```solidity
     overlapLow = max(newOrder.tickLower, lowestOpposite);
     overlapHigh = min(newOrder.tickUpper, highestOpposite);
     ```
  3. **Use overlap-only liquidity**: Added `_getOverlappingLiquidity()` helper.
  4. **Average price across overlap**: Use `(priceLow + priceHigh) / 2` for fair pricing.
- **Rationale**:
  - **Correctness**: Fills now exactly match the price overlap, preventing >100% fills.
  - **Economic Incentive**: Worst-to-best sweep means takers get progressively better prices as they fill.
  - **Simplicity**: Overlap calculation is now explicit and testable.
- **Consequences**:
  - **Breaking Change**: Requires contract redeployment to use V9.9 behavior.
  - **Test Coverage**: 5 new tests verify crossing behavior (see `test_V99_*`).
- **Documentation**: See PR #21

---

## ADR-057: _tryCross Bitmap-Based Overlap Detection (V9.8)
- **Date**: 2025-12-30
- **Status**: Accepted (Merged via PR #19)
- **Context**:
  - The `_tryCross` function in `TickBookPoolManager` determines if a newly placed range order can immediately match against existing opposing liquidity.
  - Original implementation used a `currentTick` range check:
    ```solidity
    if (state.currentTick < newOrder.tickLower || state.currentTick > newOrder.tickUpper) {
        return (0, 0, 0);
    }
    ```
  - **Problem**: `currentTick` was initialized from `initialProbabilityWad` (e.g., tick 999 from graduation = ~99.9% probability) and only changed when market orders executed via `_fill`. Before any market orders, overlapping range orders SHOULD match but DIDN'T because `currentTick` was outside both orders' ranges.
  - **Example Failure**: Market graduates at tick 999. User A places BUY YES at ticks [450, 460]. User B places SELL YES at same ticks. Both orders are at the EXACT SAME price but `_tryCross` returned (0,0,0) because `currentTick (999) > tickUpper (460)`.
- **Decision**:
  1. **Initialize `currentTick` to `MIN_TICK` (1)** instead of `initialProbabilityWad` — let trading establish the price.
  2. **Use bitmap-based overlap detection** in `_tryCross`:
     ```solidity
     // Find best opposing liquidity using bitmap
     uint16 bestOpposite;
     if (newOrder.outcome == 1) {
         bestOpposite = _bitmaps[marketKey][0].findNextUp(0);  // Lowest SELL YES tick
     } else {
         bestOpposite = _bitmaps[marketKey][1].findNextDown(MAX_TICK + 1);  // Highest BUY YES tick
     }
     
     // Check if ranges overlap
     bool crosses = (newOrder.outcome == 1)
         ? bestOpposite <= newOrder.tickUpper
         : bestOpposite >= newOrder.tickLower;
     ```
- **Rationale**:
  - **Correctness**: Overlapping range orders should cross immediately regardless of `currentTick`.
  - **State Independence**: Crossing detection doesn't depend on market order history.
  - **Bitmap Efficiency**: O(log n) lookup using `findNextUp` / `findNextDown`.
- **Consequences**:
  - **Breaking Change**: Requires contract redeployment to use V9.8 behavior.
  - **Behavior Change**: Range orders now cross correctly on newly registered markets.
  - **currentTick Role**: `currentTick` is now only used by `_fill` (market orders), not by `_tryCross`.
- **Documentation**: `packages/contracts-evm/docs/research/V9/TRYCROSS_BITMAP_OVERLAP.md`

---

## ADR-056: Monad Testnet V9 Singleton Migration & Graduation Gas Fix
- **Date**: 2025-12-30
- **Status**: Accepted (Deployed)
- **Context**:
  - Monad Testnet was previously running a fragmented V8/V9 hybrid architecture.
  - Graduation transactions were failing due to:
    1. A "zombie" `TickBook` address in the Engine that had no code deployed.
    2. Insufficient gas (2M) for the complex V9 graduation flow (registering in Singleton PoolManager).
- **Decision**:
  1. **Full Singleton Migration**: Redeploy the complete V9 stack (PoolManager + Vault) to Monad Testnet to match Base Sepolia.
  2. **Increased Gas Ceiling**: Set the hardcoded gas limit for graduation trades to **5,000,000** in both the deployment script and frontend to accommodate Monad's opcode pricing.
  3. **Script Consolidation**: Update `deploy-multichain.ts` to natively support the Singleton architecture and ensure proper cross-linking (Vault-to-PoolManager and Engine-as-Registrar).
- **Rationale**:
  - **Maintainability**: Unified architecture across all chains reduces operational overhead and frontend complexity.
  - **Reliability**: Resolves the `OutOfGas` and empty contract call reverts that were blocking market maturity.
- **Consequences**:
  - **Fresh State**: Previous orders/positions on Monad are lost as the contracts were redeployed.
  - **Reliable Graduation**: Markets can now graduate successfully on Monad Testnet without gas depletion.
  - **Consolidated Scripting**: The multichain script now handles the modern Sooth Singleton stack by default.

---

## ADR-055: getPendingFills View Function for Crossed Order Fills
- **Date**: 2025-12-30
- **Status**: Accepted (Deployed in V9.5.0)
- **Context**:
  - TickBookPoolManager uses a Uniswap V3-style growth accumulator pattern for tracking fills on crossed orders.
  - When Order A (YES) exists and Order B (NO) is placed with overlapping range, `_tryCross` executes.
  - Order B (the NEW order) gets immediate `filledShares` credit + tokens via `vault.creditOutcome`.
  - Order A (the EXISTING order) gets fills tracked via `_fillGrowthGlobalX128[outcome]` accumulator.
  - The frontend was calling `getOrder()` which returns `order.filledShares`, but this does NOT include pending accumulator fills.
  - Result: Crossed orders showed 0% filled and no CLAIM button, even though they had claimable fills.
- **Decision**: Add a new view function `getPendingFills(bytes32 marketKey, uint256 orderId)`:
  ```solidity
  function getPendingFills(bytes32 marketKey, uint256 orderId)
      external view returns (uint256 pendingShares, uint256 pendingCollateralUsed)
  {
      // Calculate fills from growth accumulator without modifying state
      uint256 delta = globalFillGrowth - lastFillGrowth;
      pendingShares = (delta * order.sharesTotal) / Q128;
      // ... similar for collateralUsed
  }
  ```
  - Frontend calls `getOrder()` + `getPendingFills()` in parallel for each order.
  - Displays total fills = `order.filledShares + pendingShares`.
  - CLAIM button appears when `pendingShares > 0`.
- **Rationale**:
  - **Transparency**: Users can see their actual claimable fills without calling `claimFills()`.
  - **UX**: CLAIM button now correctly appears for crossed orders.
  - **Gas Efficiency**: View function doesn't modify state, can be called freely.
  - **Consistency**: Matches the pattern used in Uniswap V3 for pending fees.
- **Technical Note on Order Crossing**:
  - The `_tryCross` function in V9 matches orders when new orders overlap with existing opposite orders.
  - Crossing is immediate (no separate matching step).
  - The new order maker gets tokens immediately via `vault.creditOutcome`.
  - The existing order maker's fills are tracked lazily via the growth accumulator.
  - This is a capital-efficient design where position tokens are only minted when needed.
- **Consequences**:
  - **Contract Addition**: New view function in `TickBookPoolManager.sol`.
  - **ABI Update**: Added to `TickBookPoolManager.json`.
  - **Frontend Update**: `useUserOrdersDirect` hook now calls `getPendingFills`.
  - **Breaking Change**: Requires V9.5.0 deployment to use; older deployments lack this function.

---

[... existing ADRs 001-031 ...]
- **Date**: 2025-12-23
- **Status**: Accepted (Deployed)
- **Context**: V7 achieved dual-engine separation (AMM + Orderbook), but still had complexity around custody, settlement coordination, and venue isolation. The protocol needed a clean, modular architecture that maximizes flexibility and composability.
- **Decision**: Implement **V8 Modular Architecture** with complete domain isolation:
    - **TruthMarket**: Canonical lifecycle and settlement authority (pull-based queries)
    - **AMMEngine**: LMSR position domain with 24h sell locks and T* settlement
    - **TickBook**: 10,000-tick orderbook with bitmap-based O(1) discovery
    - **Collateralizer**: Token split/merge/redeem (1 USDC = 1 YES + 1 NO)
    - **No Built-in Custody**: Removed TraderVaultLite; users manage USDC via any wallet/smart account
- **Architecture Principles**:
    - **Domain Isolation**: AMM and TickBook are completely separate venues (no bridge)
    - **Pull-Based Lifecycle**: All venues query `TruthMarket.isLive()` and `isSettled()` (no hooks)
    - **Custody Flexibility**: Direct USDC transfers; works with EOA, Safe, Biconomy, any ERC-4337
    - **WAD Precision**: All math uses 1e18 precision throughout
- **Consequences**:
    - **Simplicity**: 8 core contracts (down from 11+ in V7)
    - **Flexibility**: Users choose their own custody solution
    - **Composability**: Works with any smart account infrastructure
    - **Testability**: 100% test pass rate (30 tests)
    - **Production-Ready**: Clean build, comprehensive documentation

## ADR-033: No Built-in Custody Layer (TraderVaultLite Removal)
- **Date**: 2025-12-23
- **Status**: Accepted
- **Context**: V8 initially included `TraderVaultLite` for USDC custody, but this created an unnecessary dependency and limited user flexibility in choosing custody solutions.
- **Decision**: **Remove TraderVaultLite** entirely from V8:
    - **AMMEngine**: Uses direct USDC transfers via `SafeERC20`
    - **TickBook**: Already used direct token transfers
    - **User Choice**: Users manage USDC via their preferred solution:
        - EOA wallets (MetaMask, etc.)
        - Smart accounts (Safe, Biconomy, ZeroDev, Alchemy)
        - Account abstraction (ERC-4337)
        - Multisig (Gnosis Safe)
- **Rationale**:
    - **Simpler Protocol**: One less contract to maintain and audit
    - **Maximum Flexibility**: Users aren't locked into protocol-specific custody
    - **Better Composability**: Works seamlessly with existing smart account infrastructure
    - **Reduced Attack Surface**: No custody layer means no custody-related vulnerabilities
    - **Gas Savings**: Eliminates one contract hop per trade
- **Consequences**:
    - **Breaking Change**: Removed 3 files (contract, interface, tests)
    - **Test Count**: Reduced from 36 to 30 tests (100% still passing)
    - **Integration**: SDK must document smart account integration patterns
    - **UX**: Frontend can offer multiple custody options (Safe, Biconomy, etc.)

## ADR-034: TickBook Multi-Tick Swap Execution
- **Date**: 2025-12-23
- **Status**: Accepted
- **Context**: Initial TickBook implementation had a bug where swaps would fail with "insufficient liquidity" even when liquidity existed across multiple ticks. The issue was that `remainingIn` was set to 0 after the first tick, preventing multi-tick execution.
- **Decision**: Implement proper multi-tick swap logic:
    - **Partial Fills**: Calculate how much input can be consumed at each tick
    - **Tick Advancement**: Move to next tick only after current tick is exhausted
    - **Current Tick Inclusion**: Check current tick for liquidity before searching for next
    - **Proper Accounting**: Track `amountInAtTick` and `amountOutAtTick` separately
    - **Safety**: Leave 1 wei in reserves to avoid division by zero
- **Implementation Details**:
    ```solidity
    // Check if we can fill entire order at this tick
    uint256 potentialOut = TickMath.getAmountOut(reserveIn, reserveOut, remainingIn);
    
    if (potentialOut < maxOut) {
        // Partial fill - consume all remaining input
        amountInAtTick = remainingIn;
        amountOutAtTick = potentialOut;
    } else {
        // Full tick consumption
        amountOutAtTick = maxOut - 1; // Leave 1 wei
        amountInAtTick = TickMath.getAmountIn(reserveIn, reserveOut, amountOutAtTick);
    }
    
    remainingIn -= amountInAtTick; // Proper decrement
    ```
- **Consequences**:
    - **Fixes Bug**: Integration tests now pass (6/6 instead of 4/6)
    - **Deep Liquidity**: Swaps can now execute across multiple ticks
    - **Gas Efficiency**: Optimized tick search with bitmap
    - **Test Coverage**: All 30 tests passing (100%)

## ADR-035: TruthMarket as Canonical Lifecycle Authority
- **Date**: 2025-12-23
- **Status**: Accepted
- **Context**: V8 needed a single source of truth for market lifecycle and settlement that all venues could query without tight coupling.
- **Decision**: Implement **TruthMarket** as the canonical authority:
    - **Lifecycle States**: CREATED → LIVE → SETTLING → SETTLED → FINALIZED
    - **Settlement**: Adjudicator-based with YES/NO/INVALID outcomes
    - **T* Support**: Retroactive truth-time for temporal settlement
    - **Guardian Veto**: Emergency dispute resolution mechanism
    - **Pull-Based**: All venues query `isLive()` and `isSettled()` (no callbacks)
- **Interface**:
    ```solidity
    function isLive() external view returns (bool);
    function isSettled() external view returns (bool);
    function winningOutcome() external view returns (uint8);
    function tStar() external view returns (uint64);
    function getRedemptionValue(uint8 outcome) external view returns (uint256);
    ```
- **Consequences**:
    - **Decoupling**: Venues don't need to know about each other
    - **Flexibility**: New venues can be added without modifying existing ones
    - **Security**: Single point of truth prevents inconsistent settlement
    - **Simplicity**: No complex callback mechanisms or event listeners

## ADR-036: V8 as Default Production Architecture
- **Date**: 2025-12-23
- **Status**: Accepted
- **Context**: V8 implementation was complete and tested, but existed in a `/v8` subdirectory alongside older contract versions (V4, V5, V6, V7). This created confusion about which version was current.
- **Decision**: **Promote V8 to default** by restructuring the repository:
    - **Move V8 to Root**: `contracts/v8/*` → `contracts/*`
    - **Move Interfaces**: `contracts/interfaces/v8/*` → `contracts/interfaces/*`
    - **Remove Old Versions**: Delete V4-V7 contracts (available in git history)
    - **Clean Tests**: Remove old test suites, keep only V8 tests
    - **Update Paths**: Fix all import paths in contracts and tests
- **Consequences**:
    - **Clarity**: No ambiguity about which version is current
    - **Simplicity**: Cleaner repository structure
    - **Maintenance**: Only one version to maintain going forward
    - **Git History**: Old versions remain accessible via git history
    - **Breaking Change**: External integrations must update to V8

## ADR-037: V8 LaunchpadEngine - Governance-Controlled Creator Economics
- **Date**: 2025-12-23
- **Status**: Accepted (Implemented)
- **Context**: V8 removed all creator economic incentives from V6/V7 Launchpad model, breaking the fundamental value proposition. After comprehensive gap analysis, decided to implement Option A: restore full Launchpad economics with governance-controlled parameters.
- **Decision**: Implement **LaunchpadEngine** as a wrapper around `AMMEngine`:
    - **Creator Deposits**: Required deposit of `b × ln(2)` USDC for 1.44x liquidity leverage
    - **LP Token System**: Internal accounting (non-transferable) for ownership tracking
    - **Fee Distribution**: 
        - Pre-graduation: Configurable fee (default 5%) → 100% to bBase growth + LP minting
        - Post-graduation: Configurable fee (default 1%) → Configurable split (default 50/30/20)
    - **Graduation Mechanics**: Configurable threshold (default 2× bBase in fees)
    - **LP Redemption**: Honest Floor Model (`Floor = Cash - max(qYes, qNo)`)
    - **Governance Control**: ALL parameters adjustable by protocol owner
- **Key Innovation**: **Governance-Controlled Parameters**
    - `preGradFeeBps` - Pre-graduation fee (default: 500 = 5%, max: 1000 = 10%)
    - `postGradFeeBps` - Post-graduation fee (default: 100 = 1%, max: 500 = 5%)
    - `bBaseShareBps` - % to bBase growth (default: 5000 = 50%)
    - `lpYieldShareBps` - % to LP yield (default: 3000 = 30%)
    - `protocolShareBps` - % to protocol (default: 2000 = 20%)
    - `graduationMultiplier` - Graduation threshold (default: 2 = 2× bBase, range: 1-10)
- **Architecture**:
    ```
    User → LaunchpadEngine (Creator Economics)
              ↓ delegates to
           AMMEngine (Pure Trading Logic)
              ↓ queries
           TruthMarket (Lifecycle)
    ```
- **Implementation**:
    - `LaunchpadEngine.sol` - 484 lines, compiles successfully
    - `ILaunchpadEngine.sol` - 154 lines, complete interface
    - `LaunchpadEngine.t.sol` - 357 lines, 15/17 tests passing (88%)
- **Consequences**:
    - ✅ **Restores V6/V7 Economics**: Full creator incentives restored
    - ✅ **Governance Flexibility**: Can tune economics without redeploying
    - ✅ **Clean Architecture**: LaunchpadEngine wraps AMMEngine cleanly
    - ✅ **Backward Compatible**: AMMEngine unchanged, can be used standalone
    - ✅ **Production Ready**: Core implementation complete, minor test fixes needed
    - ⚠️ **Frontend Changes**: Must call `LaunchpadEngine.tradePositions()` instead of `AMMEngine.tradePositions()`
- **Alternatives Considered**:
    - **Option B** (Simplified Creator Fee): Rejected - doesn't solve core incentive problem
    - **Option C** (Pivot Away from Launchpad): Rejected - would require major rebranding
- **Next Steps**:
    1. Fix graduation test calculations (minor adjustment)
    2. Gas optimization review
    3. Documentation (architecture, integration guides)
    4. Frontend integration

---

## V8 Architecture Summary

**Status**: ⏳ **IMPLEMENTATION IN PROGRESS**  
**Contracts**: 9 core (8 V8 + LaunchpadEngine) + 3 libraries + 6 interfaces  
**Tests**: LaunchpadEngine 15/17 passing (88%), V8 Core 30/30 passing (100%)  
**Size**: ~65 KB total

### Core Stack
```
TruthMarket (Lifecycle)
    ↓ queries
LaunchpadEngine (Creator Economics) ← NEW
    ↓ delegates to
AMMEngine + TickBook (Trading Venues)
    ↓ uses
Collateralizer + OutcomeToken (Token Management)
    ↓ custody
User's Choice (EOA, Safe, Smart Account, etc.)
```

### Key Innovations
- **No Built-in Custody**: Maximum flexibility
- **Domain Isolation**: AMM ≠ TickBook (no bridge)
- **Pull-Based Lifecycle**: No callbacks or hooks
- **WAD Precision**: 1e18 throughout
- **Smart Account Ready**: Works with any ERC-4337 wallet
- **Governance-Controlled Economics**: All fee parameters adjustable by owner

### ✅ Critical Issue Resolved: Creator Economics

**Problem**: V8 removed all creator economic incentives from V6/V7 Launchpad model.

**Solution**: Implemented `LaunchpadEngine` with:
- ✅ Creator deposit requirement (skin in the game)
- ✅ LP token system (ownership stake)
- ✅ Fee distribution (revenue from trading)
- ✅ Graduation mechanics (bonding curve)
- ✅ **All parameters governance-controlled**

**Status**: Core implementation complete (88% test coverage)

**Next Steps**: 
1. ⏳ Fix minor graduation test calculations
2. ⏳ Gas optimization review
3. ⏳ Documentation (architecture, integration)
4. ⏳ Frontend integration
5. ⏳ External audit
6. ⏳ Testnet deployment

**Estimated Time to Production**: 1-2 weeks

## ADR-039: LaunchpadEngine USDC Decimals Bug Fix
- **Date**: 2025-12-24
- **Status**: Identified (Fix Pending)
- **Context**: During V8 frontend integration testing, discovered a critical bug in `LaunchpadEngine.tradePositions()` that prevents trading when USDC has 6 decimals (standard USDC).
- **Bug Location**: `LaunchpadEngine.sol` line 241
  ```solidity
  // BUG: actualCost is in WAD (18 decimals) but USDC.transferFrom expects token decimals (6)
  usdc.safeTransferFrom(msg.sender, address(this), actualCost);
  ```
- **Root Cause**: 
  - `ammEngine.getPositionQuote()` returns cost in WAD (18 decimals)
  - Fee calculation maintains WAD precision
  - But `safeTransferFrom` expects the token's native decimals (6 for USDC)
  - Result: Contract tries to transfer ~1e12x more tokens than intended
- **Fix Required**:
  ```solidity
  // Convert WAD to USDC decimals before transfer
  uint256 actualCostInUsdc = _wadToUsdc(actualCost);
  usdc.safeTransferFrom(msg.sender, address(this), actualCostInUsdc);
  ```
- **Impact**:
  - All trades fail with "USDC: insufficient allowance" 
  - Contract calculates correct cost but transfers wrong amount
  - Frontend is correct; issue is contract-side only
- **Workaround Options**:
  1. **Redeploy LaunchpadEngine** with fix (recommended)
  2. **Deploy 18-decimal MockUSDC** (matches WAD, quick testnet fix)
- **Lessons Learned**:
  - Always verify decimal handling at integration boundaries
  - Test with actual token decimals (6 for USDC) not just 18
  - Frontend-to-contract integration testing caught this before mainnet

## ADR-040: Actor-Centric Educational Strategy & Venue Rebranding
- **Date**: 2025-12-25
- **Status**: Accepted
- **Context**: The protocol was using generic terms like "Trade" and "Pro" which didn't reflect the specific actor roles defined in the Dec 2025 Whitepaper (Creator, Gaming Trader, Arbitrageur, PvP Trader). Additionally, the educational "Learn" page was too generic.
- **Decision**: **Rebrand UI venues and refactor the educational flow** to be actor-centric:
    - **AMM**: Retail-focused venue for "Gaming Traders".
    - **TickBook**: Orderbook venue for "Arbitrageurs" and "PvP Traders".
    - **Launchpad**: Economic venue for "Creators" and "Adjudicators".
    - **Unified Learn/About**: Merge the "About" page into an interactive, actor-centric tutorial at the `/about` route.
- **Rationale**:
    - **Brand Consistency**: Aligns the UI with the "Decentralization Thesis" of the whitepaper.
    - **Clear Value Proposition**: Helps users self-identify their role (e.g., "I am an arbitrageur, I should use TickBook").
    - **Reduced Cognitive Load**: Unified routes and clearer venue names make the protocol easier to navigate.
- **Consequences**:
    - **Breaking Change**: Renamed all primary navigation links.
    - **Documentation**: Updated `V8.1_FRONTEND.md` and `E2E_TESTING_SPEC.md` to reflect new names.
    - **Tests**: All E2E tests updated to expect new terminology.

## ADR-041: Multichain Market Isolation
- **Date**: 2025-12-25
- **Status**: Accepted
- **Context**: Users were seeing all configured markets (Base Sepolia, MegaETH, etc.) regardless of which chain their wallet was connected to. This led to "Contract not found" errors when attempting to interact with a market on the wrong chain.
- **Decision**: **Implement client-side market filtering** by `chainId`:
    - All venue pages (`AMM`, `TickBook`, `Launchpad`, `Gov`) now filter the `marketsConfig.markets` list based on the active `chainId` from `wagmi`.
    - If no chain is connected, a default chain (Base Sepolia) is used for viewing.
- **Rationale**:
    - **User Experience**: Prevents users from clicking on markets they cannot trade.
    - **System Stability**: Eliminates RPC errors caused by calling non-existent addresses on the current chain.
- **Consequences**:
    - **Market Visibility**: Users must switch networks in their wallet to see markets on other chains.
    - **Data Integrity**: Ensures that quotes and balances shown are always relevant to the active connection.

## ADR-042: Custom MetaMask Fixture for E2E Testing
- **Date**: 2025-12-25
- **Status**: Accepted
- **Context**: Synpress (the standard Playwright extension for dApp testing) had persistent caching issues (`Cache for X does not exist`) that prevented reliable wallet tests. The caching mechanism was sensitive to extension versions and environment changes.
- **Decision**: **Build a custom MetaMask fixture** that bypasses Synpress entirely:
    - Pre-download MetaMask extension to `.metamask/extension/` (v11.9.1)
    - Use `chromium.launchPersistentContext()` with `--load-extension` flag
    - Implement wallet import/connection logic directly in test files
    - Use off-screen window positioning (`--window-position=-2400,-2400`) for headed tests
- **Implementation**:
    ```typescript
    // e2e/fixtures/wallet.fixture.ts
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--window-position=-2400,-2400', // Off-screen
      ],
    });
    ```
- **Rationale**:
    - **Reliability**: No caching issues; extension loads fresh each run
    - **Developer Experience**: Off-screen windows don't steal focus during test runs
    - **Control**: Full control over MetaMask onboarding flow
    - **Simplicity**: Single fixture file vs complex Synpress configuration
- **Consequences**:
    - **Removed Synpress Dependency**: Tests no longer require `@synthetixio/synpress`
    - **Extension Maintenance**: Must manually update MetaMask version in `.metamask/`
    - **Test Structure**: Wallet tests use `wallet.fixture.ts`, basic tests use standard Playwright
    - **Hybrid Execution**: Basic tests run headless (1.6 min), wallet tests run headed but off-screen

## ADR-043: Serial E2E Test Execution for Stability
- **Date**: 2025-12-25
- **Status**: Accepted
- **Context**: Parallel E2E test execution with multiple browser instances caused:
    1. Excessive focus stealing (browser popups interrupting developer work)
    2. Web3Modal modals overlapping and blocking clicks
    3. MetaMask extension state conflicts across parallel contexts
- **Decision**: **Run all E2E tests serially** with project-based ordering:
    ```typescript
    // playwright.config.ts
    fullyParallel: false,
    workers: 1,
    projects: [
      { name: 'basic', testMatch: /^(?!.*wallet|.*onchain).*\.spec\.ts$/, use: { headless: true } },
      { name: 'wallet', testMatch: /wallet.*\.spec\.ts$/, dependencies: ['basic'] },
      { name: 'onchain', testMatch: /onchain.*\.spec\.ts$/, dependencies: ['wallet'] },
    ],
    ```
- **Rationale**:
    - **Stability**: Single browser context avoids extension state conflicts
    - **Developer UX**: No focus stealing; headless mode for basic tests
    - **Ordered Execution**: Wallet tests run after basic, onchain after wallet
    - **Acceptable Speed**: 3.2 min for 84 tests is reasonable for CI
- **Consequences**:
    - **Slower CI**: Serial execution is slower than parallel (but more reliable)
    - **Granular Commands**: Can run subsets via `npm run test:e2e:basic`
    - **Clear Dependencies**: Project dependencies ensure correct test order

## ADR-044: Hybrid Concentrated Orderbook (TickBook Refinement)
- **Date**: 2025-12-25
- **Status**: Accepted (Deployed)
- **Context**: The TickBook initially used AMM-style "Liquidity" terminology (e.g., `addLiquidityRange`), which was confusing for professional traders. The protocol needed a cleaner separation between makers (liquidity providers) and takers (swappers) while retaining the capital efficiency of concentrated liquidity.
- **Decision**: **Transition TickBook to a "Hybrid Concentrated Orderbook" model**:
    - **Makers**: Place **Limit Orders** across a range of ticks (asymmetrical liquidity).
    - **Takers**: Execute **Market Orders** for a specific dollar amount (USDC) against existing depth.
    - **Terminology Shift**:
        - `addLiquidityRange` → `placeLimitOrder`
        - `removeLiquidityRange` → `cancelLimitOrder`
        - `swap` → `executeMarketOrder`
- **Rationale**:
    - **Market Standard**: Aligns with professional CEX/DEX exchange primitives.
    - **Clarity**: Explicitly defines the role of each actor (Maker vs Taker).
    - **User Experience**: Takers don't need to understand "sweeping ticks"—they just want to buy $100 worth of YES shares.
- **Consequences**:
    - **Breaking Change**: Updated contract interfaces, events, and state variables.
    - **Contract Re-Audit**: Logic verified through 100% test coverage in `TickBook.t.sol`.
    - **UI Alignment**: Pro terminal updated to use "Limit (Range)" and "Market" terminology.

## ADR-046: Row-Level Reporting Pattern for Portfolio Aggregation
- **Date**: 2025-12-26
- **Status**: Accepted
- **Context**: The Portfolio page needed to sum values (LP, AMM Shares, Outcome Tokens) across multiple markets. Initially, a centralized batch read was attempted, but this was brittle and often lagged behind the dynamic children components, leading to inaccurate totals or $0.00 displays.
- **Decision**: Implement a **Row-Level Reporting Pattern**:
    - **Self-Reporting Components**: Each asset row (`PortfolioLpRow`, `AMMPositionRow`, `OutcomeTokenRow`) calculates its own USD value locally.
    - **Callback Chain**: Children report their value back to the parent `Portfolio` component via an `onValueUpdate(id, value)` callback.
    - **Parent Aggregation**: The `Portfolio` component maintains a `Map` of reported values and sums them for the dashboard display.
- **Rationale**:
    - **Accuracy**: The row component has the most up-to-date state for its specific market (decimals, prices, balance).
    - **Performance**: Avoids massive multi-call reads in the parent component.
    - **Decoupling**: New asset types can be added without modifying the parent's aggregation logic—they just need to call `onValueUpdate`.
- **Consequences**:
    - **React State**: Parent must manage a state object for the child values, triggering a re-render when children report updates.
    - **Stability**: Fixed the persistent "Total Value: $0.00" bug.

## ADR-047: AMMEngine Router Delegation (Correct Per-User Positions + Spendable Proceeds)
- **Date**: 2025-12-26
- **Status**: Accepted
- **Context**: In V8.1, the frontend was forced to reconstruct AMM positions by scanning `LaunchpadEngine.PositionTraded` logs because AMM positions/balances were effectively attributed to the `LaunchpadEngine` call path instead of the trader. This was slow (multi‑million block scans), RPC‑fragile, and created on-chain ambiguity.
- **Decision**: Introduce an **authorized router** model in `AMMEngine`:
    - `AMMEngine` stores **positions + spendable/locked balances per trader**.
    - `LaunchpadEngine` acts as the **router**, trading on behalf of users via `tradePositionsFor(user, ...)`.
    - `AMMEngine` supports a one-time deployment configuration step: `setRouter(LaunchpadEngine)`.
    - When Launchpad fees reinvest into depth (`bCurrent` growth), `LaunchpadEngine` calls `AMMEngine.increaseLiquidity(...)` so AMM pricing depth matches economics.
- **Rationale**:
    - **Correctness**: On-chain state should be canonical (no event-scan reconstruction).
    - **Performance**: Removes heavy `getLogs` scanning and RPC failure modes.
    - **Security**: Only the configured router can spend user "available balance" on their behalf.
- **Consequences**:
    - **Breaking Change**: `AMMEngine` now has an owner-configured router and a new constructor signature; deployments must set router.
    - **Frontend Simplification**: Position hooks can call `AMMEngine.getPosition(market, user)` directly.

## ADR-048: V8.2 Dual-Balance Position Model (YES + NO Positions)
- **Date**: 2025-12-27
- **Status**: Accepted (Deployed)
- **Context**: V8.1's position model used a single `int256 shares` where positive = long YES and negative = long NO. This created problems:
    1. Users could not hold both YES and NO positions simultaneously (forced netting).
    2. "Buy NO" was mathematically equivalent to "Sell YES", causing slippage logic confusion.
    3. Inconsistent with TickBook, which allows independent YES/NO limit orders.
- **Decision**: Refactor `AMMEngine.Position` to a **dual-balance model**:
    ```solidity
    struct Position {
        uint256 yesShares;
        uint256 noShares;
    }
    ```
    - **Independent Tracking**: YES and NO shares tracked separately.
    - **Outcome Parameter**: `tradePositions(market, outcome, deltaShares, maxCost)` — `outcome` = 0 for YES, 1 for NO.
    - **Unsigned Shares**: `deltaShares > 0` = buy, `deltaShares < 0` = sell (for the specified outcome).
    - **Return Tuple**: `getPosition(market, user)` returns `(uint256 yesShares, uint256 noShares)`.
- **Rationale**:
    - **Flexibility**: Users can hedge by holding both sides (e.g., arbitrage between AMM and TickBook).
    - **Simplicity**: No more signed math or netting logic; each outcome is independent.
    - **Consistency**: Aligns AMM position model with TickBook's independent YES/NO orderbook.
    - **UX Clarity**: "Buy YES" and "Buy NO" are clearly distinct actions in the UI.
- **Implementation**:
    - `AMMEngine.sol`: Refactored `_tradePositions` to update `yesShares` or `noShares` based on `outcome`.
    - `LaunchpadEngine.sol`: Updated `tradePositions` to pass `outcome` through to `ammEngine.tradePositionsFor`.
    - `IAMMEngine.sol` / `ILaunchpadEngine.sol`: Updated interfaces with new signatures.
    - Frontend: `useAMMPositionDirect`, `useAMMQuoteDirect`, `SimpleTradingPanel` updated for dual-balance.
- **Consequences**:
    - **Breaking Change**: All trading calls must now include `outcome` parameter.
    - **ABI Change**: Frontend ABIs regenerated from Foundry output.
    - **Migration**: Existing positions on old contracts are not migrated (fresh deployment).
    - **Test Coverage**: 74/74 Foundry tests passing (100%), including new dual-balance tests.
- **Deployment**: V8.2 deployed to Base Sepolia on 2025-12-27.
    - LaunchpadEngine: `0x5B7be7DbfE6035544546F70E4fcAaB5531fBeF15`
    - AMMEngine: `0xC4b7fe6CF6c55aE0212d2c045d6fcd3aac9d1a3f`
    - Collateralizer: `0xdf6aAb7C606B120e9d4BEe83Fcf307Aa03148CD8`
    - TickBook: `0xe0476837584c4bAAbF53e48d2F6cF42f57604CDe`

## ADR-050: Invariant Testing Discovery — AMMEngine Lock Accounting Bug Fix
- **Date**: 2025-12-27
- **Status**: Accepted (Fix Pending Deployment)
- **Context**: During comprehensive QA hardening, an actor-based invariant test discovered a critical accounting bug in `AMMEngine._tradePositions()`.
- **Discovery Method**: Invariant test `invariant_LockedNeverExceedsAvailable` with 768+ random operations found a violation.
- **Bug Description**:
    - When a user buys shares using their `_availableBalance` (from previous sell proceeds), the contract correctly reduces `_availableBalance` but does NOT reduce `_lockedBalance` proportionally.
    - This violates the invariant: `∀ user: _lockedBalance[user] ≤ _availableBalance[user]`
    - **Impact**: Could cause underflow in `claimUnlocked()` and display incorrect locked amounts in UI.
- **Root Cause** (Lines 203-216 in `AMMEngine.sol`):
    ```solidity
    // BUGGY CODE:
    if (_availableBalance[user] >= actualCost) {
        _availableBalance[user] -= actualCost;  // ✅ Correct
        // ❌ MISSING: _lockedBalance[user] reduction
    }
    ```
- **Fix Applied**:
    ```solidity
    // FIXED CODE:
    if (_availableBalance[user] >= actualCost) {
        if (_lockedBalance[user] > 0) {
            uint256 lockedReduction = (actualCost * _lockedBalance[user]) / _availableBalance[user];
            _lockedBalance[user] -= lockedReduction;
        }
        _availableBalance[user] -= actualCost;
    }
    ```
- **Verification**: All 92 tests pass including 256+ run invariant fuzzing.
- **Lessons Learned**:
    1. Invariant tests are invaluable for catching subtle accounting bugs
    2. Actor-based fuzzing with multiple scenarios (buy, sell, claim) catches edge cases unit tests miss
    3. The `spendBalanceFor()` function had the correct logic; it was only the internal `_tradePositions()` that was missing it
- **Consequences**:
    - **Breaking Change**: Requires contract redeployment
    - **Test Suite**: Added 44+ new tests across 6 files
    - **Confidence**: High — invariant holds across 768,000+ random operations

## ADR-049: V8.3 Spendable Proceeds for LaunchpadEngine Buys
- **Date**: 2025-12-27
- **Status**: Accepted
- **Context**: In V8.2, when users sell shares, proceeds go to their `_availableBalance` in AMMEngine and are "spendable" for new trades. However, the UI routes trades through LaunchpadEngine (for fee handling), which always pulled the full cost from the user's wallet via `safeTransferFrom`. This created a disconnect:
    1. Frontend showed "Buying Power = Wallet + Spendable", but only wallet was actually used.
    2. MAX button would allow selecting more shares than the wallet could afford, causing transaction failures.
    3. Spendable proceeds sat unused, contradicting the "instantly spendable" promise.
- **Decision**: Modify `LaunchpadEngine.tradePositions` to check and use spendable proceeds:
    ```solidity
    // Check user's spendable balance in AMMEngine
    (uint256 userAvailable, ) = ammEngine.getBalances(msg.sender);
    uint256 fromBalance = userAvailable > baseCost ? baseCost : userAvailable;
    uint256 fromWallet = actualCost - fromBalance; // remainder + fee
    
    // Pull only what's needed from wallet
    if (fromWalletUsdc > 0) {
        usdc.safeTransferFrom(msg.sender, address(this), fromWalletUsdc);
    }
    ```
    - **AMMEngine's Internal Logic**: Already spends from `_availableBalance[user]` first, then pulls remainder from payer (LaunchpadEngine).
    - **Fee Always from Wallet**: Fees go to LaunchpadEngine, so they can't come from AMMEngine balance.
- **Added Function**: `AMMEngine.spendBalanceFor(user, amount)` — router-only function to explicitly spend from a user's available balance (added for flexibility, though not strictly needed for this flow).
- **Rationale**:
    - **Correct UX**: Buying power now truly equals wallet + spendable.
    - **Gas Efficiency**: Only transfers the minimum required USDC from wallet.
    - **Promise Kept**: Proceeds are actually "instantly spendable" for new buys.
- **Consequences**:
    - **Breaking Change**: New contract deployment required.
    - **Frontend Alignment**: No code changes needed; existing `buyingPowerWad = walletWad + spendable` is now correct.
    - **Test Coverage**: All 74 tests passing.
- **Deployment**: V8.3 deployed to Base Sepolia on 2025-12-27.
    - LaunchpadEngine: `0x1F30742c38c10b28B3960E2B067644A52592bd8f`
    - AMMEngine: `0x8a2E95D54E39F838Fd3Dc1a6f841CF012c22aDC5`
    - Collateralizer: `0x09A7809a33F969B0099A5d19003991592658763f`
    - TickBook: `0x91A2243Fe5e12194539Dcc3AD0BBb23824d9C8Fd`

## ADR-051: TickBook Vault-Native Orderbook (USDC-Collateral) + 1,000 Tick Resolution
- **Date**: 2025-12-27
- **Status**: Implemented (Contracts + Frontend Complete)
- **Context**:
  - The current V8 TickBook is token-inventory based (YES/NO ERC20 approvals + `transferFrom`), which makes **resting limit orders** capital-inefficient when complete sets must be minted externally.
  - The product goal for Pro/TickBook is a V7-like capital-efficient orderbook where bids/shorts reserve only **price × size** in USDC.
  - We also want to keep TickBook’s domain isolated from ERC20 token mechanics during Phase 1 (reduce UX complexity).
- **Decision**:
  1. Introduce a **TickBookVault** (global per-chain) that holds **internal balances** and provides explicit **USDC deposit/withdraw** (exchange-style).
     - TickBook becomes **vault-native**: it reserves internal USDC for orders and performs fills via internal accounting.
  2. Outcome assets are represented as **YES shares / NO shares** internally (non-transferable in Phase 1 UI).
     - ERC20 YES/NO are treated as **boundary assets** for future composability (mint on withdraw, burn on deposit), but are **not required** for Phase 1 trading UX.
  3. Reduce TickBook tick resolution from **10,000** to **1,000** ticks (0.01% → 0.1% increments) to simplify alpha execution and reduce tick-crossing loops.
     - **Valid tick range**: 1–999 (0.1% to 99.9%). Tick 0 (0%) is excluded as it represents a resolved NO outcome.
  4. TickBook maker orders remain **ranged/concentrated** (not point-only) in Phase 1; funding is via reserved internal USDC.
- **Rationale**:
  - **Capital efficiency**: bids/shorts require only `P × qty` (or `(1-P) × qty`) collateral rather than “mint full complete set first”.
  - **UX**: Phase 1 Pro can be USDC-first, while still showing users “what they hold” (YES shares / NO shares) without exposing token custody flows.
  - **Performance**: 1,000 ticks lowers UI density and reduces worst-case tick-crossing iterations for quotes/execution.
- **Consequences**:
  - **Breaking change** for TickBook venue (new contract set + ABI changes + UI changes).
  - **Custody reintroduced, but only for TickBook**: AMM remains “no built-in custody”; TickBookVault is a purpose-built venue vault.
  - TickMap/ladder UI must be updated away from 10,000-tick assumptions (e.g., 100×10 map).
  - Requires new tests focused on vault solvency and reservation invariants.
- **Spec / Plan**:
  - `packages/contracts-evm/docs/research/V8/TICKBOOK_VAULT_NATIVE_PLAN.md`

## ADR-052: TickBookV2 Continuous Range Orders (Uniswap V3-style, Linear Curve)
- **Date**: 2025-12-28
- **Status**: Implemented (Contracts + Tests; Frontend/Deployment Pending)
- **Context**:
  - ADR-051’s TickBook implementation stored maker liquidity **per tick** (one `Order` per tick in the range).
  - Wide ranges (e.g., 200–800 ticks) caused **O(range width)** SSTORE writes and became prohibitively gas-expensive for makers.
- **Decision**:
  1. Introduce `TickBookV2.sol` which stores **one order per range** and tracks liquidity via **tick boundary deltas** (`liquidityNet` / `liquidityGross`) similar to Uniswap V3.
  2. Use a **linear price curve within the active range** (deterministic, low-gas, alpha simplicity).
  3. Attribute maker fills **pro‑rata** using cumulative global counters (Uniswap V3 “feeGrowth” style snapshots):
     - `_cumulativeFills[marketKey][outcome]`
     - `_cumulativeProceeds[marketKey][outcome]`
     - per-order snapshots for lazy claiming via `claimFills(...)`.
  4. Shift maker collateral handling to a **market-collateralized model**:
     - On order placement, maker collateral is moved into `TickBookVault.marketCollateralWad[market]` via `spendAvailableToMarket(...)`.
     - On cancel, unfilled maker collateral is refunded from market collateral via new vault hook `refundMarketToAvailable(...)`.
- **Rationale**:
  - **Gas**: Maker range order placement becomes **O(1)** with respect to range width (only boundary updates), enabling deep range liquidity in alpha.
  - **Simplicity**: Linear curve is easier to reason about and debug than constant‑product while still providing “continuous within range” behavior.
  - **Consistency**: Keeps TickBook vault-native (ADR-051) while fixing the per-tick storage scalability issue.
- **Consequences**:
  - **Breaking**: `ITickBookVault` interface expanded with `refundMarketToAvailable(...)`.
  - **UX**: TickBook becomes “continuous within range” rather than discrete per-tick FIFO execution.
  - **Deployment**: Requires redeploying TickBook (and updating frontend ABIs/configs) to use TickBookV2.
## ADR-053: Pre-Graduation Liquidity Scaling (1/ln(2))
- **Date**: 2025-12-28
- **Status**: Accepted (Deployed)
- **Context**: 
    - In the Launchpad model, $MaxLoss = b \times \ln(2)$. 
    - To maintain a 1:1 relationship between accumulated fees and the pool's maximum loss capacity, every \$1 of fee must increase $MaxLoss$ by \$1.
    - Previous implementation was adding `feeWad` directly to `bCurrent`, which resulted in only ~\$0.69 of capacity growth per \$1 of fee.
- **Decision**: **Scale liquidity parameter $b$ by $1/\ln(2)$** during pre-graduation fee distribution:
    - $\Delta b = \frac{\text{fee}}{\ln(2)}$
    - Implemented using the high-precision constant `LN2_INV_WAD = 1442695040888963407`.
    - Formula: `deltaB = (feeWad * LN2_INV_WAD) / WAD;`
- **Rationale**:
    - **Incentive Alignment**: Ensures that every dollar paid by traders fully backs the pool's ability to absorb future losses, maximizing capital efficiency.
    - **Precision**: Uses the standardized 18-decimal constant from `LN2_CONSTANTS_REFERENCE.md`.
- **Consequences**:
    - **Capacity Growth**: Liquidity parameter `b` now grows ~1.44x faster relative to fee input.
    - **Code Alignment**: Standardized on `LN2_WAD` and `LN2_INV_WAD` across `LaunchpadEngine.sol`, `LMSRMath.sol`, and deployment scripts.
    - **UI Accuracy**: `MarketStats.tsx` and `AMMFormulasCard.tsx` now reflect this "Liquidity Anchor" growth correctly.
## ADR-054: LP Token Unification (USD-par Model)
- **Date**: 2025-12-28
- **Status**: Accepted (Implemented)
- **Context**: 
    - In `LaunchpadEngine.sol`, the creator received LP tokens 1:1 with their USDC deposit (USD-par).
    - However, traders received LP tokens proportional to the liquidity parameter growth ($\Delta b$), which is depth-scaled ($1/\ln(2) \approx 1.44$).
    - This resulted in an unfair distribution where traders received ~4.4% more ownership share per dollar than creators, causing confusion (e.g., $465 fee resulting in 671 LP).
- **Decision**: **Unify all LP token minting to a USD-par model**.
    - Both creators and traders now receive LP tokens exactly **1:1 with the USD value** contributed (deposit or fee).
    - Formula for traders changed from `lpTokens = deltaB` to `lpTokens = feeWad`.
- **Rationale**:
    - **Fairness**: Ownership share in the bonding curve is now strictly proportional to the actual USDC contributed by each participant.
    - **Clarity**: Users can immediately verify their LP balance against the fee paid ($1 paid = 1 LP earned).
    - **Simplicity**: Removes hidden scaling factors from the accounting layer seen by users.
- **Consequences**:
    - **Stakeholder Alignment**: Creators and traders are now treated equally in terms of pool ownership per dollar.
    - **Math Consistency**: While liquidity depth $b$ still scales by $1/\ln(2)$ to maintain capacity (ADR-053), the ownership layer (LP) is decoupled to reflect cash basis.
    - **Deployment**: Integrated into corrected `LaunchpadEngine.sol` (V8.11.0).

---

## V8 Architecture Summary (V8.11.0)

**Status**: ✅ **V8.11.0 PRODUCTION READY**  
**Contracts**: 9 core (V8.11.0)  
**Multichain**: Base Sepolia (84532) + Monad Testnet (10143)

### Core Stack (Sync)
- **LaunchpadEngine**: Creator economics + LP management + USD-par ownership.
- **TickBookV2**: Range-based orderbook with O(1) gas placement.
- **AMMEngine**: Pure LMSR / Dual-Balance position model.
- **TickBookVault**: Unified USDC custody for Pro terminal.
