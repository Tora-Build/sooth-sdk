# Lessons Archive (Historical - V4-V9)

This file contains lessons from V4-V9 development (TickBook, TraderVault, GovernorVault architecture).
These contracts NO LONGER EXIST in V12. Kept for historical reference only.
Active lessons are in `.claude/rules/lessons.md`.

---

## V9 Testing Patterns (2025-12-29)

### ✅ Actor-Based Invariant Testing Pattern
- **Location:** `test/v9/V9Invariants.t.sol`
- **Pattern:** Create `TraderActor` contracts that wrap target contracts
- **Purpose:** Multi-user fuzz testing with independent state
- **Key invariants tested:**
  - Vault Solvency: Total claims <= vault balance
  - No Negative Balances: Reserved never exceeds initial
  - Market State Consistency: Tick always in valid range
  - Order Integrity: Active orders have collateral

### ✅ Fuzz Test Edge Cases to Watch
- **Date:** 2025-12-29
- **Pattern:** Use `bound()` to constrain fuzz inputs
- **Pitfalls:**
  - Tick ranges: Must be 1-999, tickLower < tickUpper
  - Fee configs: MIN_FEE=1, MAX_FEE=1000 in DynamicFeeHook
  - Multi-order tests: Limit numOrders to avoid tick overflow
- **Rule:** Always check contract constraints before fuzzing

### ✅ Vault API Usage
- **Correct:** `vault.availableUsdcWad(user)`, `vault.reservedUsdcWad(user)`
- **Deprecated:** No `getUserPosition()` in V9 TickBookVault
- **Internal outcomes:** `vault.getInternalOutcomes(market, user)` → (yesShares, noShares)

---

## Liquidity Tracking Consistency

### ❌ Pattern: Tracking density vs total shares = crossing failures
- **Date:** 2025-12-29 (V8.12.0)
- **Bug:** `_totalLiquidity` tracked density (shares per tick) but `_tryCross` compared against `density × range`.
- **Root Cause:** Inconsistent semantics between what's stored vs what's compared.
- **Symptom:** Overlapping orders only crossed ~0.1% instead of fully matching.
- **Detection:** User reported "FILL: 10.01 (0%)" when expecting full 10,000 share cross.
- **Fix:** 
  1. Store `sharesTotal` in `_totalLiquidity` (not just density)
  2. Use `order.sharesTotal` in pro-rata calculations (not recalculated)
- **Rule:** When tracking aggregates, ensure the unit matches how it's used:
  - If comparing X against Y, both must be in same unit (total shares, not density)
  - Use stored fields (e.g., `order.sharesTotal`) rather than recalculating

---

## Fork Testing (Avoid Manual UI Testing)

### ✅ Use `LiveAmmBuy.t.sol` for repeatable AMM tests
- **Location:** `test/LiveAmmBuy.t.sol`
- **Run:** `forge test --match-contract LiveAmmBuy --fork-url https://sepolia.base.org -vvv`
- **Purpose:** Impersonate trader wallet, execute trades on live contracts without UI
- **Note:** AMM positions show 0 due to 24h lock — verify via `AMMBuy` event in trace

---

## V9.0 Singleton Architecture

### ✅ Pattern: Uniswap V4-Style PoolManager
- **Date:** 2025-12-29
- **Change:** Replaced per-market `TickBook` contracts with singleton `TickBookPoolManager`.
- **Rationale:**
  - Simpler deployment (1 contract vs N contracts)
  - Cross-market arbitrage in single transaction
  - Flash accounting for 200x cheaper batch operations
  - Unified state management
- **Key Features:**
  - **Flash Accounting**: EIP-1153 transient storage (`TSTORE`/`TLOAD` at 100 gas vs `SSTORE` at 20,000 gas)
  - **Hooks System**: 13 callback points (beforePlaceOrder, afterPlaceOrder, getDynamicFee, etc.)
  - **Permissionless Claims**: `claimFillsFor()` allows keepers to settle fills
  - **Batch Operations**: `batchClaimFills()` for gas-efficient settlement
- **Frontend Migration:**
  | V8 | V9 |
  |----|-----|
  | Per-market `TickBook` address | Single `TickBookPoolManager` address |
  | `registerMarket` on each TickBook | `registerMarket` on PoolManager |
  | Manual claims only | Permissionless `claimFillsFor()` |
  | No batch operations | Flash accounting + batch APIs |
- **Documentation:** `packages/contracts-evm/docs/v9/`
- **ABIs:** `packages/contracts-evm/abi/v9/`

---

## V9 Graduation Gas Requirements

### ❌ Pattern: Hardcoded Gas Limit Causes Graduation Trades to Fail
- **Date:** 2025-12-29 (updated 2025-12-29)
- **Bug:** Frontend hardcoded `gas: 600000n` for all `tradePositions` calls. Graduation trades require ~1.5M gas.
- **Root Cause:** LaunchpadEngine's graduation flow deploys 2 ERC20 outcome tokens (~500k gas each) + TickBook registration (~118k gas).
- **Symptom:** Trades that would trigger graduation fail with `status: 0` and no logs. Gas used is ~589k (hitting limit).
- **Detection:** `cast receipt` shows `gasUsed ≈ gasLimit` and `status: 0`. `cast call` simulation succeeds (no gas limit enforced).
- **Fix:** Dynamic gas estimation in frontend (use 50% threshold, not 80%):
  ```typescript
  // Use launchpad?.isGraduated from hook, not the prop (avoids stale data)
  // Use 50% threshold because large trades can jump from <80% to 100% in one tx
  const isNearGraduation = !launchpad?.isGraduated && (launchpad?.graduationProgress ?? 0) > 50;
  const gasLimit = (tradeMode === 'buy' && isNearGraduation) ? 2000000n : 600000n;
  ```
- **Why 50% not 80%:** A large trade (e.g., 5000 shares) can push graduation progress from <80% to >100% in a single transaction. If the pre-trade progress is 79%, the 80% check fails, gas limit stays at 600k, and the graduation OOGs.
- **Alternative Fix:** Pre-register markets in Collateralizer + TickBook before graduation trades:
  ```bash
  cast send $COLLATERALIZER "registerMarket(address,string,string)" $MARKET "Name" "SYMBOL"
  cast send $TICKBOOK "registerMarket(address,address,address,uint256)" $MARKET $YES $NO $PROB
  ```
- **Rule:** When contract state transitions involve deploying new contracts, gas requirements spike dramatically. Use conservative thresholds for dynamic gas estimation.

---

## 22. TickBook Registrar Access Control

### Symptom
Non-graduated markets could be registered in TickBook via direct `registerMarket()` calls, bypassing the LaunchpadEngine graduation flow.

### Root Cause
`TickBookPoolManager.registerMarket()` had no access control - anyone could register any market.

### Fix
Added `registrar` role pattern:
```solidity
address public registrar;
error UnauthorizedRegistrar();

modifier onlyRegistrar() {
    if (msg.sender != registrar && msg.sender != owner()) revert UnauthorizedRegistrar();
    _;
}

function registerMarket(...) external onlyRegistrar returns (bytes32) { ... }

function setRegistrar(address _registrar) external onlyOwner { ... }
```

### Deployment Steps
After deploying TickBookPoolManager, set LaunchpadEngine as registrar:
```bash
cast send $TICKBOOK "setRegistrar(address)" $LAUNCHPAD_ENGINE --rpc-url $RPC --private-key $PK
```

### Rule
Access-controlled registration ensures only graduated markets (via LaunchpadEngine) can be added to TickBook. Owner can still register manually if needed.

---

## V6 LP Accounting (Honest Floor Model)

### ❌ Pattern: Including Locked Proceeds in Ceiling Value
- **Date:** 2025-12-21
- **Mistake:** Calculating Ceiling Value using raw `totalAssets`.
- **Root Cause:** Locked proceeds represent funds already paid out to traders (sell transactions) that are merely awaiting a timelock. They are no longer part of LP equity even in a best-case scenario.
- **Rule:** `Ceiling Assets = Gross Assets - Locked Proceeds`.

### ❌ Pattern: Hybridizing AMM Liability and Orderbook Collateral
- **Date:** 2025-12-21
- **Mistake:** Treating total token supply as a single "Market Liability" line item.
- **Root Cause:** AMM liability is a "short" position where the LP is the counterparty (uncollateralized debt). Orderbook/Direct-Split tokens are fully collateralized by users at mint time (self-backed).
- **Principle:** Liability is NOT shared. The LP floor is only hit by the AMM's virtual inventory (`qYes/qNo`). Orderbook tokens are "neutral" to the LP because their USDC backing is already in the vault.
- **UI Rule:** Always display `AMM Liability` and `OB Collateral` as separate deductions from the Ceiling to reach the Floor.

---

## V8.2 Position Model Change

### ❌ Pattern: Single Signed Shares Causes "Buy NO = Sell YES" Confusion
- **Date:** 2025-12-27
- **Mistake:** V8.1 used `int256 shares` where positive = long YES and negative = long NO. This meant "buy NO" mathematically reduced the user's `shares` (toward negative), which triggered sell-side slippage logic.
- **Symptom:** "Buy NO" transactions failed with "slippage exceeded" because `maxCost` was being compared against `minProceeds` logic internally.
- **Root Cause:** The signed-shares model conflates two independent positions (YES and NO) into one value, forcing netting behavior and mixing buy/sell semantics.
- **Fix:** Refactored to dual-balance model:
  ```solidity
  struct Position {
      uint256 yesShares;
      uint256 noShares;
  }
  ```
  Added `outcome` parameter to `tradePositions(market, outcome, deltaShares, maxCost)`.
- **Lesson:** For prediction markets, YES and NO are independent assets. Don't force netting. Let users hold both simultaneously.

### ✅ Pattern: Direct Position Reads vs Event-Sourced Reconstruction
- **Date:** 2025-12-27
- **Issue:** `useLaunchpadPositionDirect` was scanning 5M+ blocks of logs to reconstruct user positions from `PositionTraded` events. This was slow, RPC-fragile, and often returned stale/incomplete data.
- **Fix:** With the router delegation pattern (ADR-047) and dual-balance model (ADR-048), `AMMEngine.getPosition(market, user)` now returns canonical on-chain position state. Replaced event-scanning with a direct `readContract` call.
- **Rule:** Always prefer on-chain view functions over event reconstruction when possible. Events are for historical/indexing use cases, not real-time UI state.

---

## V8.3 Spendable Proceeds Integration

### ❌ Pattern: Frontend "Buying Power" Misaligned with Contract "TransferFrom"
- **Date:** 2025-12-27
- **Mistake:** Frontend showed `buyingPower = wallet + spendable`, but `LaunchpadEngine.tradePositions` always did `usdc.safeTransferFrom(msg.sender, ...)` for the full cost. Spendable proceeds sat unused in AMMEngine.
- **Symptom:** MAX button allowed selecting more shares than wallet could afford, causing `ERC20InsufficientBalance` transaction failures.
- **Root Cause:** AMMEngine's `_tradePositions` has internal logic to use `_availableBalance[user]` first, but only when called directly. LaunchpadEngine bypassed this by pulling USDC from user's wallet before calling AMMEngine.
- **Fix:** Modified `LaunchpadEngine.tradePositions` to:
  1. Check user's available balance via `ammEngine.getBalances(msg.sender)`
  2. Calculate `fromBalance = min(availableBalance, baseCost)`
  3. Only pull `(baseCost - fromBalance) + fee` from user's wallet
  4. Approve AMMEngine for only the portion that comes from wallet
  5. Let AMMEngine's internal logic spend from user's balance for the rest
- **Rule:** When integrating two contracts, ensure the "money flow" matches the UX promise. If you show "X is spendable", make sure the contract actually spends it.

---

## V8.4 Invariant Testing Bug Discovery

### ✅ Pattern: Actor-Based Invariant Fuzzing Catches Subtle Accounting Bugs
- **Date:** 2025-12-27
- **Discovery:** Invariant test `invariant_LockedNeverExceedsAvailable` with 768+ random operations discovered that `AMMEngine._tradePositions()` was NOT reducing `_lockedBalance` when spending from `_availableBalance`.
- **Bug Impact:** `_lockedBalance > _availableBalance` could occur, causing underflow in `claimUnlocked()` and incorrect UI displays.
- **Root Cause:** The `spendBalanceFor()` function correctly reduced locked proportionally, but `_tradePositions()` (the main trading path) forgot this logic:
  ```solidity
  // BUGGY: Only reduced available, not locked
  if (_availableBalance[user] >= actualCost) {
      _availableBalance[user] -= actualCost;
      // ❌ MISSING: _lockedBalance reduction
  }
  ```
- **Fix:** Added proportional locked reduction before available reduction.
- **Why Unit Tests Missed It:** Unit tests only covered simple flows (buy, sell, claim separately). They didn't simulate the complex multi-step scenario: sell → buy using proceeds → check balances.
- **Rule:** For accounting invariants (like "locked ≤ available"), write an explicit invariant test with an actor that performs random sequences of buy/sell/claim operations.
- **Invariant Test Pattern:**
  ```solidity
  function invariant_LockedNeverExceedsAvailable() public view {
      for (uint i = 0; i < traders.length; i++) {
          (uint256 available, uint256 locked) = amm.getBalances(traders[i]);
          assertTrue(locked <= available, "locked exceeds available");
      }
  }
  ```
- **Lesson:** Invariant tests are invaluable for catching edge cases that emerge from complex state transitions. Always write them for critical accounting properties BEFORE mainnet.

---

## ~~V8.6 Outcome Mapping Bug~~ (OBSOLETE - See V8.13.0)

> ⚠️ **OBSOLETE**: This entry was correct at the time (AMMEngine used inverted semantics from TruthMarket).
> V8.13.0 unified all contracts to use `YES=1, NO=0, INVALID=2` matching TruthMarket.
> See the V8.13.0 entry below for the current canonical values.

### ~~❌ Pattern: YES/NO UI Labels Inverted from Contract Values~~
- **Date:** 2025-12-28
- **Context:** AMMEngine had `outcome=0` for YES, but TruthMarket had `outcome=1` for YES.
- **Resolution:** V8.13.0 refactored AMMEngine to match TruthMarket (see below).

---

## V8.13.0 Unified Outcome Semantics

### ✅ Pattern: Canonical Outcome Encoding (Protocol-Wide)
- **Date:** 2025-12-29
- **Change:** All V8 contracts now use TruthMarket as the canonical source of outcome semantics.
- **Standard Values:**
  | Value | Outcome | Description |
  |-------|---------|-------------|
  | `0`   | NO      | The "No" side of the prediction |
  | `1`   | YES     | The "Yes" side of the prediction |
  | `2`   | INVALID | Market invalidated (ambiguous, unresolvable) |
- **Affected Contracts:**
  - `TruthMarket.sol` (canonical source)
  - `AMMEngine.sol` (refactored from `0=YES, 1=NO` to `0=NO, 1=YES`)
  - `Collateralizer.sol`
  - `TickBook.sol`, `TickBookV2.sol`
  - `TickBookVault.sol`
- **Frontend Update Required:**
  ```typescript
  // V8.13.0 canonical constants
  export const OUTCOME = { YES: 1, NO: 0, INVALID: 2 } as const;
  ```
- **Additional V8.13.0 Changes:**
  - ReentrancyGuard added to all state-changing functions
  - INVALID outcome handling (50% payout)
  - `isLive()` now checks `block.timestamp < deadline`
  - New events: `PositionSettled`, `MarketActivated`, `MarketVetoed`
- **Documentation:** `packages/contracts-evm/docs/review/OUTCOME_SEMANTICS.md`
- **Rule:** Always use `YES=1, NO=0` in frontend code. Reference `OUTCOME_SEMANTICS.md` for canonical definitions.

---

## 24. V9.9.6 Active Liquidity Underflow (Complete Fix)

### ❌ Pattern: Incomplete Arithmetic Safety Fix Leaves Code Paths Vulnerable
- **Date:** 2026-01-01
- **Bug:** V9.9.6 added `_safeAddLiquidity()` to protect `_fill()` from underflow, but missed 6 other subtraction sites in `_updateActiveLiquidity()` and `_tryCross()`.
- **Root Cause:** When crossing tick boundaries or cancelling orders, `activeLiquidity -= delta` could underflow when `delta > activeLiquidity`.
- **Symptom:** First several trades succeed, then one fails with `panic: arithmetic underflow or overflow (0x11)`, and ALL subsequent trades fail permanently.
- **Detection:** Regression tests (`test_ExtremeLiquidityNet_ClampsToZero`, `test_ManyConsecutiveTrades_AllSucceed`) failed with panic 0x11.

### Original (Buggy) Code Sites:
```solidity
// _updateActiveLiquidity (lines 747, 753)
state.activeLiquidityNo -= liquidityDelta;
state.activeLiquidityYes -= liquidityDelta;

// _tryCross (lines 843, 845, 851, 853)
state.activeLiquidityNo -= activeFilled;
state.activeLiquidityYes -= activeFilled;
```

### Complete Fix:
```solidity
// Added new helper (V9.9.6)
function _safeSubLiquidity(uint128 liq, uint128 delta) internal pure returns (uint128) {
    return liq >= delta ? liq - delta : 0;
}

// Applied to all 6 sites
state.activeLiquidityNo = _safeSubLiquidity(state.activeLiquidityNo, liquidityDelta);
state.activeLiquidityYes = _safeSubLiquidity(state.activeLiquidityYes, liquidityDelta);
```

### Rule:
- When adding arithmetic safety to one function, **grep the entire contract** for similar patterns:
  - `grep -n "activeLiquidity.*-=" TickBookPoolManagerV996.sol`
  - `grep -n "state\\.active.*-=" src/*.sol`
- Create regression tests that specifically target the edge cases (extreme values, order cancellations, many consecutive trades)
- Mark safe helpers with `@notice` comments listing all call sites

### Regression Tests Added:
- `test/v9/ActiveLiquidityUnderflow.t.sol` (8 tests, 138 total V9 tests passing)

---

## 28. Duplicate Contract Files = Stale Deployment (2026-01-05)

### ❌ Pattern: Two contract files with same purpose but different content
- **Date:** 2026-01-05
- **Bug:** Deployed contract had pro-rata bug despite source code showing the fix.
- **Root Cause:** Codebase had TWO files:
  - `TickBookPoolManager.sol` — had the pro-rata fix
  - `TickBookPoolManagerV10.sol` — STALE copy WITHOUT the fix
- **Deploy script used `TickBookPoolManagerV10`** → deployed the buggy version
- **Symptom:** Fresh orders showed 99% filled immediately (accumulator overflow).
- **Detection:** `cast call getOrder()` showed `filledShares ≈ sharesTotal` on brand new orders.

### The Trap:
```bash
# Both files had the fix comment, but V10 had OLD denominator logic
grep "V9.9.8-fix" TickBookPoolManager.sol     # ✓ found
grep "V9.9.8-fix" TickBookPoolManagerV10.sol  # ✓ found (misleading!)

# But actual logic differed:
TickBookPoolManager.sol:     oppTotalLiq  ← CORRECT
TickBookPoolManagerV10.sol:  oppLiqInOverlap ← WRONG (stale)
```

### Rule:
- **NEVER** have two files for the same contract (e.g., `Foo.sol` and `FooV10.sol`)
- If you must version, use Git tags/branches, not filename suffixes
- After any contract change, verify deploy script references the CORRECT file:
  ```bash
  grep -r "deployContract.*TickBook" script/
  ```
- Before deployment, diff the file being deployed against expected source:
  ```bash
  forge inspect TickBookPoolManager bytecode | md5
  ```

### Fix Applied:
1. Deleted `TickBookPoolManagerV10.sol`
2. Updated deploy script: `'TickBookPoolManagerV10'` → `'TickBookPoolManager'`
3. Regenerated ABI from single source

---

## Tick Space Mismatch in Spot Sell Crossing (2026-01-09)

### ❌ Pattern: Using YES-equivalent ticks to iterate NO spot sells
- **Date:** 2026-01-09
- **Location:** `TickBookPoolManager._fillSpotLiquidity()` lines 1279-1370
- **Bug:** When a NO range order attempts to cross with NO spot sells:
  - `_calculateOverlap()` returns overlap range in YES-equivalent tick space (e.g., 500-999)
  - `_fillSpotLiquidity()` iterates `for (t = overlapLow; t <= overlapHigh; t++)`
  - But NO spot sells are stored at their NATIVE NO ticks (e.g., 150-152)
  - The iteration at ticks 500-999 completely MISSES spot sells at ticks 150-152
- **Symptom:** NO spot sells never get crossed by NO range orders
- **Root Cause:** Overlap calculation converts everything to YES-equivalent tick space, but spot sell lookup uses native ticks
- **Impact:** ~100 NO shares in spot sells were not crossed with Order 91 (10,000 NO shares)
- **Fix Required:**
  ```solidity
  // In _fillSpotLiquidity, before iteration:
  if (sellerOutcome == 0) {
      // Convert YES-equivalent to NO-native ticks
      iterLow = 1000 - overlapHigh;
      iterHigh = 1000 - overlapLow;
  }
  ```
- **Rule:** When working with dual tick spaces (YES/NO):
  - Always verify which tick space data is stored in vs. which space calculations use
  - Add explicit conversion when crossing between YES-equivalent and native tick spaces
  - Test both YES and NO order + spot sell crossing scenarios
- **Detection:** Manual investigation of unfilled orders on Monad testnet
- **Plan:** See `.agent/plans/crossing-bug-investigation-2025-01-09.md`
- **Resolution (V10.7):** 
  - Root cause was deeper: `_calculateOverlap()` returns a NARROW range (market-clearing price zone only)
  - Passing this narrow overlap to `_fillSpotLiquidity()` missed spot sells at better prices outside the range
  - Fix: Pass buyer's FULL tick range to spot fill, not just the overlap
  - Overlap range is still used for range-vs-range crossing (correct)
  - Tests: Added `SpotSellTickSpace.t.sol` with 6 regression tests (all passing)
  - Gas impact: +11k (350k → 361k) - acceptable for correctness

---

## Future Contract Cleanup: buyFromSpotSell (2026-01-15)

### Note: `buyFromSpotSell` May Be Obsolete
- **Date:** 2026-01-15
- **Context:** V10 unified crossing automatically crosses spot sells during `placeOrder()`
- **Function:** `TickBookPoolManager.buyFromSpotSell(marketKey, sellId, shares, maxCost)`
- **Current Status:** Function exists but is NOT used by frontend or CLI
- **Reason:** When a user places a buy order via `placeOrder()`, the contract automatically:
  1. Crosses against spot sells first (spot-first crossing)
  2. Then crosses against range orders
  3. Remaining becomes resting order
- **Recommendation for V11+:** Consider removing `buyFromSpotSell` from the contract:
  - Reduces contract size (~500 bytes)
  - Removes redundant code path
  - Simplifies mental model (one way to buy, one way to sell)
- **If Keeping:** Only useful for power users who want to target a specific spot sell by ID
- **SDK Status:** Removed `buyspotsell` command from Geek Mode CLI (2026-01-15)

---

## Contract Relationships (V4 Architecture)

```
TraderVault (0x8348...) ─────┬──► GovernorVault (0x6c60...)
                             │
                             ├──► Market1 (0xEA44...) ──► OutcomeToken1
                             │
                             └──► Market2 (0x6Ee8...) ──► OutcomeToken2
```

- Markets must be registered via `TraderVault.setMarket(address, true)`
- **OutcomeTokens** must be registered via `TraderVault.setOutcomeToken(address, true)`
- Markets must be authorized on GovernorVault via `setAuthorized(address, true)`
- Markets store their TraderVault address in `traderVault` state variable

---

## OutcomeToken Authorization Bug

### ❌ Pattern: Wrong Modifier for Callback Caller
- **Date:** 2025-12-12 (V4.5 Fix)
- **Root Cause:** `creditMergeProceeds` used `onlyMarket` modifier, but is called by OutcomeToken during merge.
- **Call Chain:**
  ```
  TraderVault.onOrderMatched() → OutcomeToken.merge() → TraderVault.creditMergeProceeds()
  ```
- **Symptom:** "TraderVault: not market" error on hybrid sell
- **Fix:** Added `onlyOutcomeToken` modifier, registered OutcomeTokens in deployment
- **Lesson:** Always trace callback chains to verify `msg.sender` at each step

---

## Workflow SOPs

### After Deployment:
1. Run `./script/verify-deployment.sh`
2. Update `apps/web/src/config/deployments.json`
3. Update `apps/web/src/config/markets.json`
4. Bump `version` field
5. Commit with pre-commit hook validation
6. Tell user to hard refresh

### When User Reports "Revert" Error:
1. Get transaction hash
2. Run `cast receipt <hash> --rpc-url <url>`
3. Check `revertReason` field
4. Run `cast tx <hash> input --rpc-url <url>` to see what function was actually called
5. Match function selector to ABI

---

## SOP Change - 2025-12-12

### UI Spec Check-In/Check-Out (frontend-dev)
- **What**: Added mandatory spec consultation before/after UI modifications
- **Why**: LP Dashboard polish revealed terminology drift and inconsistent formulas
- **Files**: `.agent/workflows/frontend-dev.md`
- **Specs Location**: `apps/web/docs/specs/`
  - `LP_DASHBOARD_SPEC.md`
  - `TRADING_TERMINAL_SPEC.md`
  - `OPERATOR_CONSOLE_SPEC.md`
  - `ACTIVITY_LOG_SPEC.md`

---

## UI/UX Patterns

### The "Approve then Deposit" pattern
- USDC deposits require ERC20 approval first
- UI should show "Approve USDC" button when `allowance < depositAmount`
- After approval, button changes to "Confirm Deposit"

### Debug info in dialogs
- Don't leave debug text like "Allowance: $0.00" in production UI
- Remove after testing

---

## UI Performance & Scrolling

### ✅ Fix: Full-Page Flickering on Scroll
- **Symptom**: Background gradients and glass cards "flicker" or disappear during fast scrolling on macOS Safari/Chrome.
- **Cause**: Browser layout engine recalculating complex radial gradients and glass filters on every scroll frame.
- **Fix**: 
  1. `background-attachment: fixed` on the body to stabilize the background layer.
  2. `will-change: transform` on sticky/complex elements to promote them to GPU layers.
  3. `contain: paint` on cards to isolate paint invalidation.
