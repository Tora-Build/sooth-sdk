# Lessons Learned (Agent Memory Aid)

This file records critical mistakes and rules learned during development.
AI agents should read this at the start of sessions to avoid repeating errors.

**Current Version: V12 (SoothBook orderbook)**

---

## V12 Read First (Traps)

### 1. `useOrderbookTrade.placeOrder()` Local Inversion (DO NOT FIX)
- Hook uses `outcome=0→buyYes, outcome=1→buyNo` internally
- Callers must pass `isYes ? 0 : 1`
- Pro.tsx line 711: `const outcome = (isYes ? 0 : 1)` — compensates correctly
- Net result: `isYes=true` → `buyYes` ✅ **This is intentional, not a bug**
- DO NOT "fix" this inversion — the caller compensation makes it correct end-to-end

### 2. Outcome Encoding in Contracts: 0=NO, 1=YES, 2=INVALID
- Canonical, unchanged since V8.13.0
- Verified in SoothBook.sol, TruthMarket.sol, AMMEngine.sol, Collateralizer.sol, OutcomeToken.sol
- Settlement display in Pro.tsx correctly checks `winningOutcome === 1` for YES ✅
- Frontend constant: `export const OUTCOME = { YES: 1, NO: 0, INVALID: 2 } as const`

### 3. Market Key Encoding: `keccak256(encodePacked(['address'], [marketAddress]))`
- **NOT** `keccak256(abi.encode(...))` — `abi.encode` pads to 32 bytes, `encodePacked` does not
- This matters everywhere market keys are computed (frontend, CLI, contracts)

### 4. Bonding-Stage Markets in SoothBook
- `SoothBook.markets(key)` returns all zeros (collateral=0x0, yesToken=0x0, noToken=0x0) for pre-graduation markets
- This is CORRECT behavior. `sbsetmarket` rejects them — also correct.
- All 3 seed markets (BTC, ETH, SOL) are currently bonding-stage
- Only graduated markets have orderbook entries

### 5. No Vault in V12
- Direct wallet USDC flow. No deposit/withdraw vault.
- `useTraderVault` is a compatibility shim returning wallet balance directly
- "Approve then Deposit" UX pattern from older lessons is **OBSOLETE**
- Users approve USDC → trade directly with SoothBook/Collateralizer

### 6. Dead Packages/Paths
- `packages/contracts-evm` is **GONE** → replaced by `packages/contracts-core`
- `TraderVault`, `GovernorVault`, `TickBook`, `TickBookPoolManager` — all **GONE** in V12
- SoothBook replaces TickBook entirely
- Do NOT reference old package paths in imports, scripts, or documentation

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

## Orderbook Balance & Decimal Precision

### ❌ Pattern: Comparing 6-decimal USDC with 18-decimal WAD
- **Date:** 2025-12-20
- **Root Cause:** `useOrderbookTrade` was comparing `availableBalance` (returned as 6-decimal integer by some RPC providers or due to `MockUSDC` decimals) directly against `totalCost` (WAD 1e18).
- **Symptom:** "Insufficient balance" errors despite having thousands of dollars in the vault.
- **Fix:** Normalize ALL balances to WAD (18 decimals) before comparison.
- **Rule:** Never compare raw contract balances directly. Use a normalization helper to ensure 1e18 scale parity.

---

## Deployment Rules

### ✅ ALWAYS run verification after ANY deployment
- **Script:** `packages/contracts-core/script/verify-deployment.sh`
- **Purpose:** Validates that `deployments.json` matches on-chain state.
- **Checks:**
  - All addresses have code
  - Contract state matches expected configuration
  - Market registrations are correct

### ✅ ALWAYS bump `version` in `deployments.json` after changes
- Triggers browser cache refresh via `useDeployments.ts` guard.
- Prevents stale frontend from sending transactions to wrong addresses.

---

## Address Management

### ⚠️ Frontend may cache old market addresses
- **Symptom:** Transaction reverts with unexpected errors
- **Cause:** Browser localStorage still has old market addresses
- **Fix:** Hard refresh + clear localStorage, or bump config version

### ⚠️ Checksum vs lowercase addresses cause false positive errors
- `cast` returns checksum addresses (mixed case)
- `deployments.json` may have lowercase
- Comparison must normalize case

---

## Crossing Logic Price Inversion

### ❌ Pattern: Comparing raw ticks instead of effective prices
- **Date:** 2026-01-02
- **Bug:** Orders weren't crossing when they should. YES buyer at 44% should cross with NO order implying YES seller at 42%.
- **Root Cause:** The `_tryCross()` function compared raw tick values, but YES and NO ticks represent **different** YES prices.
- **Symptom:** Liquidity map showed overlapping YES bids and NO asks that should have crossed but remained as resting orders.

### The Math:
```
YES at tick T = buyer pays T/1000 for YES
NO at tick T = buyer pays T/1000 for NO = seller accepts (1000-T)/1000 for YES

For crossing: YES buyer price >= YES seller price
  => YES_tick/1000 >= (1000 - NO_tick)/1000
  => YES_tick >= 1000 - NO_tick
  => YES_tick + NO_tick >= 1000
```

### Example:
```
YES order at tick 440 = buyer willing to pay 44% for YES
NO order at tick 580 = buyer pays 58% for NO = seller accepts 42% for YES

44% (buyer) > 42% (seller) → SHOULD CROSS!

Old logic: "Is 580 > 440?" → YES, no crossing ❌
New logic: "Is 440 + 580 >= 1000?" → 1020 >= 1000 → CROSS ✓
```

### Fix:
```solidity
// OLD (WRONG):
if (lowestSell > newOrder.tickUpper) return (0, 0, 0);

// NEW (CORRECT):
// Calculate crossing threshold: lowestSell <= 1000 - newOrder.tickLower
uint16 maxCrossableNoTick = 1000 - newOrder.tickLower;
if (lowestSell > maxCrossableNoTick) return (0, 0, 0);
```

### Rule:
- In binary outcome markets, YES and NO ticks represent **different** effective prices
- YES tick T = YES price of T%
- NO tick T = YES price of (100-T)% as a seller
- Crossing logic must account for this price inversion
- Test crossing with overlapping opposite-outcome orders at various tick combinations

---

## User Orders Array Gas Bloat

### ❌ Pattern: Ever-Growing Array Causes Linear Gas Growth
- **Date:** 2026-01-02
- **Bug:** `_autoClaimUserOrders()` iterated through ALL orders in `_userOrders[marketKey][user]`, but inactive orders (cancelled/filled) were never removed from the array.
- **Root Cause:** Setting `order.active = false` didn't remove the order ID from `_userOrders`, so the loop still had to iterate through all historical orders.
- **Symptom:** After ~27 orders, `placeOrder()` exceeded 2M gas limit with "out of gas" errors.

### Fix:
```solidity
// Added swap-and-pop helper for O(1) removal
function _removeFromUserOrders(bytes32 marketKey, address user, uint256 orderId) internal {
    uint256[] storage orderIds = _userOrders[marketKey][user];
    uint256 len = orderIds.length;
    for (uint256 i = 0; i < len; ) {
        if (orderIds[i] == orderId) {
            orderIds[i] = orderIds[len - 1];
            orderIds.pop();
            return;
        }
        unchecked { ++i; }
    }
}

// Called in cancelOrder() and _claimInternal() when order becomes inactive
order.active = false;
_removeFromUserOrders(marketKey, owner, orderId);
```

### Rule:
- When maintaining arrays that are iterated frequently, ensure cleanup happens when items become inactive
- Use swap-and-pop for O(1) removal from unordered arrays
- Consider gas costs of iteration when designing data structures
- Test with high volume scenarios (100s of orders) to catch linear gas growth

---

## Constant Naming Consistency

### ❌ Pattern: Inconsistent constant names after refactoring = compilation errors
- **Date:** 2025-12-29 (V8.11.0)
- **Bug:** `getGraduationProgress()` in LaunchpadEngine.sol used `LN2` instead of `LN2_WAD`.
- **Root Cause:** ADR-053 refactor renamed constants but missed one usage.
- **Symptom:** Contract doesn't compile from source (`Error 7576: Undeclared identifier`).
- **Detection:** Running `forge build` before deployment.
- **Rule:** After renaming any constant, grep the entire codebase:
  - `grep -r "OLD_NAME" contracts/` to find all usages
  - Verify contract compiles: `forge build 2>&1 | grep -i error`

---

## Monad Testnet RPC State Propagation

### Symptom
Deployment script fails after `registerMarket` TX succeeds: `getOutcomeTokens returned no data ("0x")`.

### Root Cause
Monad testnet RPC has significant state propagation delays. Even after TX confirmation, read calls may return stale/empty data for 15-30+ seconds.

### Detection
- TX shows `status: success` but subsequent read calls fail
- `cast code <address>` returns `0x` right after deployment
- Same address works fine after waiting longer

### Fix (deploy-multichain.ts)
Added chain-specific wait time + retry logic:
```typescript
// Wait for RPC state propagation (Monad testnet needs longer wait)
const waitTime = ctx.chainName === 'monadTestnet' ? 8000 : 2000;
await new Promise(resolve => setTimeout(resolve, waitTime));

// Get token addresses with retry for slow RPCs
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    const tokens = await ctx.publicClient.readContract({ ... });
    break;
  } catch (err) {
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}
```

### Rule
For testnets with known RPC issues:
1. Add chain-specific wait times after state-changing TXs
2. Implement retry logic for read calls
3. Consider using private/premium RPCs for production deployments

---

## Forbidden: Versioned Folders (2025-12-30)

### ❌ Pattern: v1/, v2/, v8/, v9/ folder structure
- **Problem:** Codebase had `hooks/v5/`, `hooks/v8/`, `hooks/v9/`, `components/features/v8/`, `config/abis/v8/`, `pages/v8/`
- **Issues:**
  1. **Import confusion:** Which version to use?
  2. **Naming conflicts:** Same hook name in different versions
  3. **Maintenance burden:** Duplicated code across versions
  4. **Deprecation unclear:** Is v8 still used?
- **Solution:** Flat structure with descriptive names
- **Rule:**
  - **NEVER** create folders named `v1/`, `v2/`, `v8/`, `v9/`, etc.
  - Git history already tracks versions
  - Organize by domain/feature if needed (e.g., `launchpad/`, `market/`)

---

## Forbidden: Versioned Filenames (2026-01-05)

### ❌ Pattern: `ContractV9.sol`, `MarketV10.ts`, `deploy-v9.json`
- **Problem:** Files named `TickBookPoolManagerV10.sol` or `v9-baseSepolia.json` create hard dependencies on specific versions.
- **Issues:**
  - **Refactor Friction:** upgrading logic requires renaming files and updating all imports.
  - **Git History Split:** Renaming a file breaks `git blame` continuity.
  - **Ambiguity:** Is `AppV2.tsx` the current one? Or `AppV3.tsx`?
- **Rule:** 
  - **Canonical Names Only**: Always keep one current version of the file (e.g. `Market.ts`).
  - **Single Source of Truth**: Do not maintain `FeatureV1.tsx` and `FeatureV2.tsx` concurrently.
  - **Archive Strategy**: If strict backward compatibility requires keeping old code, move it to a distinct `archive/` or `legacy/` directory. Otherwise, overwrite it and rely on Git history.

---

## CRITICAL: No Lies Allowed (2026-01-27)

### ❌ Pattern: Claiming transaction reverted when it actually succeeded
- **Date:** 2026-01-27
- **Incident:** Told user that `finalize()` command reverted when the market was actually finalized successfully on-chain
- **Impact:** User wasted time debugging a non-existent problem, lost trust in agent accuracy
- **Root Cause:** Agent made assumption without verifying on-chain state
- **Rule:** **NEVER claim a transaction failed/reverted without proof**
  - ALWAYS verify with `cast call` or `cast receipt` before claiming revert
  - If uncertain, say "I'm not sure, let me check on-chain"
  - Honesty > confidence
  - Being wrong is acceptable, lying is not
- **Acceptable responses when uncertain:**
  - "I'm not sure if that succeeded. Let me check on-chain."
  - "The CLI output is unclear. Let me verify with cast."
  - "I don't have enough information to confirm. Should I investigate?"
- **NEVER say:**
  - "The transaction reverted" (without proof)
  - "The command failed" (without verification)
  - "The market is still settled" (without checking `isFinalized()`)
- **Verification checklist:**
  ```bash
  # Before claiming revert, ALWAYS run:
  cast call $CONTRACT "isFinalized()(bool)" --rpc-url $RPC
  cast call $CONTRACT "isSettled()(bool)" --rpc-url $RPC
  cast receipt $TX_HASH --rpc-url $RPC  # check status field
  ```

---

*Last updated: 2026-02-20*

---

> **Historical lessons** (V4-V9 TickBook/Vault-specific) archived in `.claude/rules/lessons-archive.md`
