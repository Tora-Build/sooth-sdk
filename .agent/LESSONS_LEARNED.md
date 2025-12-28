# Lessons Learned (Agent Memory Aid)

This file records critical mistakes and rules learned during development.
AI agents should read this at the start of sessions to avoid repeating errors.

---

## Fork Testing (Avoid Manual UI Testing)

### ✅ Use `LiveAmmBuy.t.sol` for repeatable AMM tests
- **Location:** `test/LiveAmmBuy.t.sol`
- **Run:** `forge test --match-contract LiveAmmBuy --fork-url https://sepolia.base.org -vvv`
- **Purpose:** Impersonate trader wallet, execute trades on live contracts without UI
- **Note:** AMM positions show 0 due to 24h lock — verify via `AMMBuy` event in trace

---

## WAD Math Bugs

### ❌ Pattern: WAD × WAD without /1e18 = OVERFLOW
- **Date:** 2025-12-11 (V4.4 Audit)
- **6 Critical Bugs Found:**
  1. `onOrderMatched`: `proceeds = matchedAmount * 1e18` (matchedAmount already WAD)
  2. `_placeOrder`: `refund = targetPrice * matchedAmount` (both WAD)
  3. `redeem()`: `payout = shares * 1e18 / scalar` (shares already WAD)
  4. `_matchBuyOrder`: `totalValue = matchAmount * matchPrice` (both WAD)
  5. `_matchSellOrder`: Same as above
  6. `merge()`: `return amount * 1e18` (amount already WAD)
- **Symptom:** Balances showing 1e36+ (corrupted)
- **Rule:** If both operands are WAD, the result is WAD×WAD. Divide by 1e18!
- **Checklist before multiplying:**
  - "Is operand A in WAD?" → If yes, check B
  - "Is operand B in WAD?" → If yes, MUST `/1e18`

---

## Deployment Rules

### ❌ NEVER use `DeployFreshV4.s.sol` without verification
- **Date:** 2025-12-11
- **Mistake:** The script deployed contracts with mismatched constructor arguments, creating a "zombie" TraderVault that didn't function correctly.
- **Symptom:** `deposit` calls reverted, `ammPositions` failed to fetch.
- **Fix:** Use `RedeployMarketsOnly.s.sol` which references known-good core contracts.

### ✅ ALWAYS run `verify-deployment.sh` after ANY deployment
- **Script:** `packages/contracts-evm/script/verify-deployment.sh`
- **Purpose:** Validates that `deployments.json` matches on-chain state.
- **Checks:**
  - All addresses have code
  - `TraderVault.asset()` matches USDC
  - `Market.traderVault()` matches config
  - `TraderVault.isMarket()` returns true for all markets

### ✅ ALWAYS bump `version` in `deployments.json` after changes
- Triggers browser cache refresh via `useDeployments.ts` guard.
- Prevents stale frontend from sending transactions to wrong addresses.

---

## Address Management

### ⚠️ Frontend may cache old market addresses
- **Symptom:** Transaction reverts with `TraderVault: invalid market`
- **Cause:** Browser localStorage still has old market addresses
- **Fix:** Hard refresh + clear localStorage, or bump config version

### ⚠️ Checksum vs lowercase addresses cause false positive errors
- `cast` returns checksum addresses (mixed case)
- `deployments.json` may have lowercase
- Comparison must normalize case

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

## Orderbook Balance & Decimal Precision

### ❌ Pattern: Comparing 6-decimal USDC with 18-decimal WAD
- **Date:** 2025-12-20
- **Root Cause:** `useOrderbookTrade` was comparing `availableBalance` (returned as 6-decimal integer by some RPC providers or due to `MockUSDC` decimals) directly against `totalCost` (WAD 1e18).
- **Symptom:** "Insufficient balance" errors despite having thousands of dollars in the vault.
- **Fix:** Normalize ALL balances to WAD (18 decimals) before comparison.
- **Rule:** Never compare raw contract balances directly. Use a normalization helper to ensure 1e18 scale parity.

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

## UI Performance & Scrolling

### ✅ Fix: Full-Page Flickering on Scroll
- **Symptom**: Background gradients and glass cards "flicker" or disappear during fast scrolling on macOS Safari/Chrome.
- **Cause**: Browser layout engine recalculating complex radial gradients and glass filters on every scroll frame.
- **Fix**: 
  1. `background-attachment: fixed` on the body to stabilize the background layer.
  2. `will-change: transform` on sticky/complex elements to promote them to GPU layers.
  3. `contain: paint` on cards to isolate paint invalidation.

---

## V8 Contract-Frontend Decimal Boundary

### ❌ Pattern: WAD in Contract ↔ Token Decimals in USDC
- **Date:** 2025-12-24
- **Mistake:** `LaunchpadEngine.tradePositions()` calculates `actualCost` in WAD (18 decimals) from LMSR, but passes it directly to `USDC.safeTransferFrom()` without converting to token decimals (6 for standard USDC).
- **Root Cause:** V8's "Pure WAD" architecture uses 1e18 internally, but USDC is 1e6. The contract has helper functions `_wadToUsdc()` and `_usdcToWad()` but forgot to use them at the transfer boundary.
- **Symptom:** Trades fail with "USDC: insufficient allowance" even with massive allowances, because contract tries to transfer 1e12x more tokens than intended.
- **Fix:** Add `_wadToUsdc(actualCost)` conversion before the `safeTransferFrom` call.
- **Rule:** At every USDC transfer boundary, check:
  1. "Is this value in WAD (18 decimals)?"
  2. "Does USDC expect token decimals (6)?"
  3. If yes to both → MUST convert using `_wadToUsdc()`
- **Lesson:** Frontend-to-contract integration testing is essential. Unit tests with 18-decimal MockUSDC won't catch this.

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

## V8.6 Outcome Mapping Bug

### ❌ Pattern: YES/NO UI Labels Inverted from Contract Values
- **Date:** 2025-12-28
- **Mistake:** Pro.tsx had `const outcome = isYes ? 1 : 0` but the contract uses `outcome=0` for YES and `outcome=1` for NO.
- **Symptom:** Clicking "Buy YES" actually submitted a "Buy NO" order to the contract. User thought they were buying YES but was buying NO.
- **Root Cause:** Developer assumed YES=1/NO=0 (common convention) but the contract uses YES=0/NO=1.
- **Fix:** Changed to `const outcome = isYes ? 0 : 1`.
- **Multiple Locations Affected:**
  1. `handleTrade()` outcome calculation
  2. `useTickBookQuoteDirect()` outcome parameter
- **Rule:** When mapping UI labels to contract enum values, ALWAYS check the contract source:
  ```solidity
  // In comments or constants
  // outcome=0 means YES, outcome=1 means NO
  ```
- **Lesson:** Create a shared constant file for magic numbers:
  ```typescript
  export const OUTCOME = { YES: 0, NO: 1 } as const;
  ```

---

*Last updated: 2025-12-28*
