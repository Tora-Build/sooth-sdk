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

*Last updated: 2025-12-12*
