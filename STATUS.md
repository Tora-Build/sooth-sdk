# Project Status

> **Codebase Version**: V12.0 (SoothBook)  
> **Active Testing**: Base Sepolia  
> **Last Updated**: 2026-02-19

## V12 SoothBook (Current)

V12 replaces TickBook with **SoothBook** — an orderbook (602 lines) with 4 atomic actions, ERC20 outcome tokens, and FIFO matching. No vault, no growth accumulators. TickBook has been fully removed from the codebase.

| Feature | Description | Status |
|---------|-------------|--------|
| 4 atomic actions | `buyYes`, `buyNo`, `mint`, `merge` | ✅ Deployed |
| Auto-match engine | `yesTick + noTick >= 1000` auto-mints complete set | ✅ Deployed |
| FIFO matching | Array-based with head pointer | ✅ Deployed |
| ERC20 outcome tokens | OutcomeToken with minter role | ✅ Deployed |
| Tick bitmap | O(1) tick discovery via TickBitmap library | ✅ Deployed |
| Market resolution | `resolveMarket` (onlyOwner) + `redeem` | ✅ Deployed |

**Tests**: 218 passing (45 SoothBook + 173 protocol)

### V12 Stack

| Layer | Status | Details |
|-------|--------|---------|
| Contracts | ✅ Deployed | SoothBook + OutcomeToken + TickBitmap on Base Sepolia + Monad Testnet |
| CLI | ✅ Wired | 10 commands (`buyyes`, `buyno`, `sbmint`, `sbmerge`, `sbcancel`, `sbredeem`, `sbresolve`, `sbstate`, `sbbook`, `sbpositions`) |
| SDK | ✅ Built | Browser SDK with 11 commands in `apps/web/src/lib/sdk/commands/soothbook.ts` |
| Indexer | ✅ Configured | 29 event handlers (8 SoothBook + 15 LaunchpadEngine + 6 AMMEngine), 9 schema tables |
| Frontend | ✅ Integrated | Pro page (SoothBook trading) + Trade page (AMM) read from deployments.json |

### V12 Deployment (Base Sepolia)

| Contract | Address |
|----------|---------|
| MockUSDC | `0x51073241ff403cd900008569714e0c9605f65a79` |
| ProtocolConfig | `0xd19842d2cbcb6146460e6639db1571787620583f` |
| Collateralizer | `0x956e8ad7b35c5270fc737ceddfcd7d894a1e5574` |
| AMMEngine | `0x1d736e5008b775948e0cbd06bbf0074d48a9803a` |
| SoothBook | `0x0eb179c7e79e62bac3ee40d379425e32cb00d22b` |
| LaunchpadEngine | `0xf00fb446d1262d1f4100e6d899cf0c8c298a6e61` |

3 seed markets created via LaunchpadEngine (bonding stage). Block 37890676. SoothBook has MAX_MATCHES_PER_TX=128.

---

## Protocol Features (Implemented)

| Feature | Contract | Status |
|---------|----------|--------|
| Trial Period (7 days) | `LaunchpadEngine` | ✅ Implemented |
| ERC20 LP Token | `LaunchpadLPToken` | ✅ Implemented |
| Validated Adjudicator | `ValidatedAdjudicator` | ✅ Implemented |
| Protocol Config (guardian + pause) | `ProtocolConfig` | ✅ Implemented |
| Adjudicator-only finalize | `TruthMarket` | ✅ Implemented |

## Current Focus
- **Pro UX + Order History Stabilization (2026-02-19)** — Refining Pro page behavior after V12 migration repair: historical chart layout/alignment, open/history order table consistency, cancellation UX, and history visibility parity across Web + SDK + interactive CLI.

## Recent Changes (Last 5 Sessions)
- **2026-02-19** — **Order History + Deployment Handoff Sync**: Added historical order `Refund Amt` in `UserOrdersPanel` with event-driven semantics (filled taker surplus, cancelled non-escrow collateral return). Extended feed parsing to include `surplus`/`escrow`. Added pagination baseline of 50 entries in history flows. Added new SDK command `sbhistory [page] [size]` and interactive CLI command `history [page] [size]`, both with consistent columns (`ID`, `Side`, `Price`, `Size`, `Refund Amt`, `Event`). Added inline legend clarifying refund meaning. Added batch-cancel silent mode to avoid duplicate toasts. Captured deployment handoff in `.agent/HANDOFF_2026-02-19_DEPLOY_PROGRESS.md` with verification status for Monad/Base and current warnings.
- **2026-02-16** — **V12 Migration Diagnostic & Repair**: Full audit of V11→V12 "standalone SoothBook" damage. Identified 24 items — 7 needed replacement, 5 were broken stubs. Fixed all: `useOrderbook.ts` + `useOrderbookTrade.ts` rewired to SoothBook (tick-depth reads, buyYes/buyNo/mint/merge/cancel/redeem, Polymarket-style mapping). `useTraderVault` → wallet mode (no vault). `useActivePositions` → SoothBook ERC20 YES/NO tokens + `getImpliedPrice`. `useLockedProceeds`/`useLockedFunds` → clean noops. `TradingAccountCard` → wallet USDC approval semantics. `PositionActionsModal` → wallet wording. Indexer `OrderFilled`/`OrderCancelled` handlers fixed + 6 API endpoints added. ~80 TS errors fixed (ABIS type spread, missing type exports). CLI `markets` command now discovers on-chain markets from LaunchpadEngine. Portfolio page integrated with TradingAccountCard + ActiveOrdersCard. Order store wired to useOrderbookTrade. Pro page findings written to `.agent/PRO_PAGE_FINDINGS.md`.
- **2026-02-15** — **V12 Fresh Deployment**: Deployed fresh V12 contracts to Base Sepolia. Fixed deploy script to transfer SoothBook ownership to LaunchpadEngine (was missing — root cause of graduation not creating SoothBook markets).
- **2026-02-15** — **TickBook Removal**: Removed TickBookPoolManager, TickBookVault, interfaces, hooks, DynamicFeeHook across all layers. SoothBook is now the sole orderbook. 13 test files removed, CLI/SDK/indexer/frontend cleaned of all TickBook references. Updated LaunchpadEngine (removed `_tickBook` constructor param). Zero TickBook references in active code.
- **2026-02-15** — **V12 SoothBook Full Stack**: Deployed SoothBook V12 to Base Sepolia. Built full integration: CLI with 11 `sb*` commands, browser SDK with 11 commands, Ponder indexer with 8 event handlers + 4 tables. 45 unit tests passing.

## Pending/Blocked
- **IPFS Market Metadata** — Currently storing market metadata (name, category) in browser localStorage. Lost on browser clear or cross-device. Need to store on IPFS and emit CID in contract event for persistence.
- **Multi-chain SoothBook deploy** — Monad V12 deployed + verified. MegaETH, Arc still need fresh deployments.
- **Historical chart polish** — Remaining UX tuning for 1m rendering/dot alignment and stats formatting consistency under narrow widths.
- **Indexer double-count caveat** — Both LaunchpadEngine and AMMEngine emit `PositionTraded` for the same trade (call chain). Handler comments flag this for testing.

## Recently Completed
- ✅ **Indexer LaunchpadEngine/AMMEngine handlers (2026-02-19)** — 15 LaunchpadEngine + 6 AMMEngine handlers added. Schema tables (`launchpadMarket`, `ammPosition`, `lpBalance`, `lockEntry`) now populated.
- ✅ **CLI scenario YAML update (2026-02-19)** — All 6 scenario files updated from TickBook to SoothBook V12 commands.
- ✅ **Monad V12 Deployment Verified (2026-02-19)** — Topology + bytecode checks pass via QuickNode RPC. 3 market keys pending graduation (expected).
- ✅ **V12 Migration Repair (2026-02-16)** — All 8 diagnostic/repair tasks complete. 0 TS errors, build passes, 218 forge tests passing.
- ✅ **V12 Fresh Deployment (2026-02-15)** — Fresh contracts deployed to Base Sepolia with SoothBook ownership correctly transferred to LaunchpadEngine.
- ✅ **TickBook Full Removal (2026-02-15)** — Zero TickBook references in active code.

## Known Issues
- **Mobile Wallet Connect** — AppKit reports CONNECT_SUCCESS but `useAccount` stays disconnected; LINKING_ERROR on mobile wallet deep links (Base/Coinbase).
- **Monad RPC Empty eth_call** — Some Monad testnet RPC endpoints intermittently return empty data (`0x`) for view calls.

## V9.9.6 Bug Fixes Summary (2026-01-02)

| Fix | Issue | Solution | Status |
|-----|-------|----------|--------|
| **fix1** | Active liquidity underflow during tick crossing | `_safeSubLiquidity()` helper | ✅ Deployed |
| **fix2** | Inactive orders causing O(n) gas growth | Swap-and-pop removal via `_removeFromUserOrders()` | ✅ Deployed |
| **fix3** | Array index out of bounds during removal | Backwards iteration in `_autoClaimUserOrders()` | ✅ Deployed |
| **fix4** | RPC limits blocking order enumeration | `getAllMarketOrders()` view function | ✅ Deployed |
| **fix6** | Orders not crossing (raw tick vs effective price) | `YES_tick + NO_tick >= 1000` formula | ✅ Deployed |
| **fix7** | Overlap calculation inverted | Corrected to `[sellerPrice, tickUpper]` | ✅ Deployed |
| **fix8** | Bitmap finds expensive seller + underflow | `findNextDown` + `_safeSubTotalLiquidity()` | ✅ Deployed |
| **fix9d** | O(n) autoclaim + manual USDC claim | Auto-claim 100% filled only + auto-release pool | ✅ Deployed |

**Retrospective**: See `packages/contracts-core/docs/V996-crossing-logic-retrospective.md`

## V9.9.6 Unified Order API (2026-01-01)

### API Changes
- **UNIFIED**: Single `placeOrder()` replaces separate `placeRangeOrder()` and `executeMarketOrder()`
- **ORDER TYPES**: Determined by tick range:
  - Market order: `tickLower=1, tickUpper=999`
  - Limit order: `tickLower=X, tickUpper=X`
  - Range order: `tickLower < tickUpper`
  - Market with floor: `tickLower=floor, tickUpper=999`
- **AUTO-CLAIM**: Claims all user's pending fills before placing new order
- **TERMINOLOGY**: Removed maker/taker language (now resting/crossing orders)

### Frontend Integration
- **New Hook**: `usePlaceOrder(marketKey)` with helper functions:
  - `marketOrder(outcome, shares, maxCost)` — fill everything
  - `limitOrder(outcome, shares, priceCents, maxCost)` — single tick
  - `rangeOrder(outcome, shares, priceLow, priceHigh, maxCost)` — spread
  - `marketWithFloor(outcome, shares, floorCents, maxCost)` — fill then rest
- **Market Discovery**: `useOnChainMarkets` hook enables dynamic listing without static config dependency.
- **Account Model**: Integrated spendable proceeds into buying power for better capital efficiency.

### Files Added
- `packages/contracts-core/src/TickBookPoolManagerV996.sol`
- `packages/contracts-testing/test/v9/UnifiedOrderSystem.t.sol`
- `apps/web/src/hooks/usePlaceOrder.ts`
- `apps/web/src/hooks/useOnChainMarkets.ts`
- `apps/web/src/config/abis/TickBookPoolManager.json`

---

## V9.9.5 LEAN Changes (Deployed 2025-12-31)

### Bug Fixes
- **Fill Overflow**: Q128 accumulator math could cause `filledShares > sharesTotal` (~0.1% drift)
- **Phantom Orders**: Fully-filled orders remained "active" with dust liquidity
- **Double Subtraction Risk**: Multiple cleanup paths could double-subtract liquidity

### Solution
- Added `liquidityRemoved` flag to `RangeOrder` struct for idempotent cleanup
- Cap `filledShares` at `sharesTotal` in `claimFills()`
- Auto-complete orders when fully filled (removes tick liquidity, sets `active=false`)
- All three cleanup paths (crossing, claimFills, cancel) now check flag before removing

---

## Current Deployments

See V12 Deployment table above for Base Sepolia addresses.

> Other chains (Monad, MegaETH, Arc) have stale TickBook-era deployments and are disabled in tooling. See git history for legacy addresses.


---

## Package Structure (2026-01-01)

### contracts-core (Audit Scope)
```
packages/contracts-core/
├── src/                 # Core contracts (audit scope)
├── script/              # 1_DeployCore, deploy-multichain, verify
├── deployments/         # baseSepolia.json, monadTestnet.json
├── abi/                 # Generated ABIs
└── lib/                 # Dependencies
```

### contracts-testing (Partner + QA)
```
packages/contracts-testing/
├── test/                # V10 tests only (legacy V9 removed)
├── script/
│   ├── markets/         # Market creation & init scripts
│   ├── deploy/          # Version-specific deploy scripts
│   └── benchmark/       # hft-benchmark.ts
├── mocks/               # MockUSDC
├── core -> ../contracts-core/src  # Symlink
└── lib -> ../contracts-core/lib   # Symlink
```

### Commands
```bash
# Build core (audit scope)
cd packages/contracts-core && forge build

# Run tests
cd packages/contracts-testing && forge test

# Deploy
pnpm deploy:contracts  # → contracts-core

# Benchmark
pnpm benchmark  # → contracts-testing
```

---

## Recent Improvements (2026-01-06)

### V10 Unified Crossing (ADR-073)
- **Unified Liquidity**: `placeOrder` now natively crosses both Spot Sells and Range Orders.
- **Spot Priority**: Takers automatically get the best price (Spot > Range).
- **Verified**: Regression tests (`UnifiedCrossing.t.sol`) confirm correct priority and settlement.

### Interactive CLI (contracts-testing)
New REPL for on-chain testing without external scripts:
```bash
bun run script/interactive/interactive-test.ts --chain=baseSepolia
```

**Commands added:**
- `createmarket <template> [liquidity]` — Deploy TruthMarket + init in LaunchpadEngine
- `graduate [tradeSize] [numTrades]` — Execute trades to accumulate fees until graduation
- `marketstatus` — Show comprehensive status (TruthMarket, AMM, Collateralizer, TickBook)
- `simulate` — Place limit orders + execute market orders for orderbook testing
- `setmarket <address>` — Fetch token info from chain (supports pre-graduation markets)
- `markets` / `m` — Show current market selection

**Key feature:** Everything works from CLI — TruthMarket bytecode embedded, no forge scripts needed.

### Package Split (ADR-065)
- Split `contracts-evm` into `contracts-core` (audit) + `contracts-testing` (QA/partners)
- Deleted outdated V4/V5/V8 artifacts (broadcast logs, old deployment configs)
- Updated sync scripts to point to `contracts-core/deployments/`
- Tests use `@core/` remapping to import from core package

### Deployment Workflow
**STEP 1**: Deploy core contracts via `deploy-multichain.ts`
- Deploys protocol contracts (Collateralizer, AMMEngine, LaunchpadEngine, ProtocolConfig)
- Deploys SoothBook separately via `DeploySoothBook.s.sol`

**STEP 2**: Create markets via CLI or scripts
- Market creation through LaunchpadEngine or directly on SoothBook

---

## Interactive CLI Bug Fixes (2026-01-01)

### Basis Points (BPS) Fixes
**Issue**: `getGraduationProgress` returns progress in basis points (10000 = 100%), but CLI was treating it as percentage.

**Fixed files**:
- `commands/state.ts`: Markets list now displays correct % (was showing "ready!" at 6.9%)
- `commands/market.ts`: Graduate command checks `>= 10000n` not `>= 100n`
- `commands/market.ts`: Progress display divides by 100 for correct %

### Graduate Trade Size Calculation
**Issue**: Trades weren't generating enough fees because:
1. `tradeSize` is in shares, but fees are charged on COST (USDC)
2. SELL trades are half the size of BUY trades
3. With LMSR at ~50% price, cost ≈ 0.5 × shares

**Fix**: Changed formula from `volumeNeeded * 8 / (3 * numTrades)` to account for:
- BUY cost ≈ shares × 0.5
- SELL cost ≈ (shares/2) × 0.5

### Frontend Collateralizer Fix
**Issue**: Pre-graduation markets threw "Collateralizer: not registered" error

**Fix**: `useCollateralizerDirect.ts` now wraps read in try-catch, returns fallback with `isRegistered: false` for pre-graduation markets.

---

## On-Chain Market Discovery (2026-01-01)

Added on-chain market enumeration to replace static `markets.json` config.

### Contract Changes
- `LaunchpadEngine.sol`: Added `address[] public allMarkets` storage
- `LaunchpadEngine.sol`: Added `getMarkets()` and `getMarketCount()` view functions
- `ILaunchpadEngine.sol`: Updated interface with new functions
- `createMarket()` now pushes to `allMarkets` array

### Frontend Changes
- Updated `LaunchpadEngine.json` ABI
- New hook: `useOnChainMarkets.ts`
  - `useOnChainMarkets()` — Returns all markets with metadata
  - `useOnChainMarketCount()` — Lightweight count-only query

### Integration Status
- **Ready**: Contract + hook complete, build passes
- **Pending**: Wire hook into market list pages (Trade, Portfolio, Pro)
- **Decision**: Keep `markets.json` for UI metadata (descriptions, categories, images)

---

## Pending Work

### Critical (Blocking)
- [x] **Create test markets** — V10.3.0 markets created on Monad & Base Sepolia.
- [x] **Frontend Integration** — Connected V10 contracts to web app.

### High Priority
- [x] **Verify Graduate Command** — Validated on V10 markets.
- [ ] **Contract Verification** — Verify V10 contracts on Basescan

### Medium Priority
- [ ] **Integrate useOnChainMarkets** — Replace static config in market pages
- [ ] **Documentation** — Update developer guides for V10 changes

### Interactive CLI Next Steps
- [ ] **Tune graduate trade sizes** — Current formula gets ~70% progress; may need more iterations
- [ ] **Custom market template** — Allow user to specify question/name/symbol
- [ ] **Scenario library** — Add more YAML scenarios for automated testing

### Known Issues
- Graduate command with 4 trades reaches ~70% progress instead of 100% (LMSR price impact varies)

---

## Critical Bug Fix (2026-01-01)

### V9.9.6 Active Liquidity Underflow (RESOLVED in V10)

**Symptom**: First several trades succeed, then one fails with "arithmetic underflow or overflow", and ALL subsequent trades fail.

**Root Cause**: In `_fill()` function, unsafe type casts when `|delta| > activeLiq`.

**Fix**: Added `_safeAddLiquidity()` helper that clamps to 0.

**Status**: **RESOLVED**. Included in V10.3.0.

*Last updated: 2026-02-15 (V12.0 — TickBook fully replaced by SoothBook)*
