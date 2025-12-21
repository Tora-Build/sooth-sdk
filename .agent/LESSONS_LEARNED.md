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

*Last updated: 2025-12-21*
