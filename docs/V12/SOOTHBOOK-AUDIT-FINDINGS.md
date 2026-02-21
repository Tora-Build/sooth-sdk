# SoothBook V12 — Audit Findings (Contract + Frontend + Ops)

> **Date**: 2026-02-21
> **Reviewer**: Claude Opus 4.6 (code review of PR #45 / v12-4atomic-orderbook branch)
> **Primary Contract**: `packages/contracts-core/src/SoothBook.sol`
> **Scope**: Solidity contract behavior + web integration hooks + repository operational hygiene
> **Deployment**: Base Sepolia `0x0eb179c7e79e62bac3ee40d379425e32cb00d22b`

---

## Summary

| # | Severity | Title | Status |
|---|----------|-------|--------|
| 1 | **CRITICAL** | Escrow matching insolvency | Open |
| 2 | **HIGH** | `resolveMarket` allows re-resolution | Open |
| 3 | **HIGH** | Fee mechanism declared but never applied | Open |
| 4 | **HIGH** | 999-tick RPC scan (frontend) | Open |
| 5 | **HIGH** | WAD precision lost through float round-trip (frontend) | Open |
| 6 | **MEDIUM** | Stale `useWaitForTransactionReceipt` state | Open |
| 7 | **MEDIUM** | `approveUSDC` / `claimWinnings` success before confirmation | Open |
| 8 | **MEDIUM** | `toFixed(2)` truncation in balance check | Open |
| 9 | **MEDIUM** | TypeScript `any` violations | Open |
| 10 | **MEDIUM** | Rounding loss on INVALID redemption | Open |
| 11 | **LOW** | Sell escrow has no slippage protection | Open |
| 12 | **LOW** | No event for fee configuration changes | Open |
| 13 | **LOW** | Non-unique outcome token symbols | Open |
| 14 | **LOW** | Errors silently swallowed in useOrderbook | Open |
| 15 | **MEDIUM** | Alchemy API key hardcoded in git | Open |

---

## CRITICAL

### 1. Escrow Matching Insolvency

**Location**: `SoothBook.sol` lines 536–554, 594–600
**ADR**: ADR-086 (Proposed)

When an escrow order matches, the payout is calculated using the escrowed party's own tick price (`oppTick * fill / 1000`), not the actual collateral economics of the crossing. This can drain more USDC than the system holds.

#### Proof of Insolvency

```
Step 0: User X mints 100 complete sets.
        Deposits 100 USDC. Backing = 100. Supply: 100 YES + 100 NO.

Step 1: User X places escrow buyYes at tick 700 (burns 100 NO tokens).
        No USDC deposited. Backing = 100. Supply: 100 YES + 0 NO.

Step 2: User Y places buyNo at tick 400.
        Deposits 40 USDC. Backing = 140. Supply: 100 YES + 0 NO.

Step 3: Match crosses (700 + 400 = 1100 >= 1000).
        - Maker (X, escrow):  payout = 700 * 100 / 1000 = 70 USDC out
        - Taker (Y, normal):  gets 100 NO tokens minted
        - Surplus:            (1100 - 1000) * 100 / 1000 = 10 USDC to taker
        - Total out:          70 + 10 = 80 USDC
        - Backing:            140 - 80 = 60 USDC

Final state:
        Supply: 100 YES (User X) + 100 NO (User Y)
        Max settlement payout: 100 USDC
        Contract balance: 60 USDC
        SHORTFALL: 40 USDC ← INSOLVENT
```

#### Why It Happens

In a normal (non-escrow) crossing, both parties deposit USDC:
- YES buyer: `yesTick * fill / 1000`
- NO buyer: `noTick * fill / 1000`
- Total in: `(yesTick + noTick) * fill / 1000` (always >= `fill`)
- Complete set cost: `fill`
- Surplus returned: `(yesTick + noTick - 1000) * fill / 1000`
- Net retained: exactly `fill` USDC backing `fill` YES + `fill` NO. **Solvent.**

In an escrow crossing, the escrowed party deposits 0 USDC (burns tokens instead). But their payout is still `oppTick * fill / 1000`, which can exceed what the counterparty deposited minus the complete-set cost:

```
Maker payout (escrow):   oppTick * fill / 1000  (= 70)
Counterparty deposited:  counterTick * fill / 1000  (= 40)
Complete set cost:       fill  (= 100)
Gap:                     70 + 100 - 40 = 130 needed, only 140 available → 60 remains for 100 obligations
```

#### Both-Escrow Case

If both maker and taker are escrow, no USDC enters but both get paid out. The subtraction at line 600 (`_collateralBacking -= collateralOut`) will underflow and **revert** (Solidity 0.8+ checked arithmetic). This prevents insolvency but means valid trades fail.

#### Recommended Fix

Escrow payout should use the complement of the counterparty's tick, not the order's own tick:

```solidity
// CURRENT (BUGGY):
uint256 makerPayout = (uint256(oppTick) * uint256(fill)) / NUM_TICKS;

// FIX:
// Escrow maker gets what their counterparty's price implies as the seller's share
uint256 makerPayout = ((NUM_TICKS - takerTick) * uint256(fill)) / NUM_TICKS;
```

The economic logic: when a taker pays `takerTick/1000` per share, the seller (escrow maker) should receive `(1000 - takerTick)/1000` per share — the complement. The surplus `(yesTick + noTick - 1000)` still goes to the taker as price improvement.

Symmetric fix needed for escrow taker payouts at line 553.

#### Invariant Test Required

```solidity
function invariant_Solvency() public view {
    for (uint i = 0; i < markets.length; i++) {
        bytes32 key = markets[i];
        uint256 backing = soothBook.collateralBacking(key);
        uint256 yesSupply = soothBook.markets(key).yesToken.totalSupply();
        uint256 noSupply = soothBook.markets(key).noToken.totalSupply();
        assertGe(backing, max(yesSupply, noSupply), "INSOLVENT");
    }
}
```

Test vectors:
- High-tick escrow maker (700) vs low-tick normal taker (400)
- Low-tick escrow maker (300) vs high-tick normal taker (700)
- Both escrow (should revert today; should succeed after fix)
- Symmetric ticks (500 vs 500, 0 surplus)
- Edge ticks (999 escrow vs 1 normal)

---

## HIGH

### 2. `resolveMarket` Allows Re-Resolution

**Location**: `SoothBook.sol` lines 174–180

**Deployment topology note**: On current Base Sepolia deployment, `SoothBook.owner()` is `LaunchpadEngine` (not an EOA), and `ISoothBook` does not expose `resolveMarket` through the Launchpad path. This reduces immediate exploitability in the current topology, but the missing finalized guard is still a correctness and future-hardening issue.

No check for `m.finalized`. The owner can call `resolveMarket` multiple times, changing the winning outcome on an already-settled market. Users who redeemed based on the first outcome would be correct, but users who haven't yet redeemed could see their winning tokens become losers.

```solidity
// CURRENT:
function resolveMarket(bytes32 marketKey, uint8 outcome) external onlyOwner {
    MarketInfo storage m = _markets[marketKey];
    if (!m.active) revert MarketNotActive();
    m.finalized = true;
    m.outcome = outcome;
    emit MarketResolved(marketKey, outcome);
}

// FIX: Add finalized guard
function resolveMarket(bytes32 marketKey, uint8 outcome) external onlyOwner {
    MarketInfo storage m = _markets[marketKey];
    if (!m.active) revert MarketNotActive();
    if (m.finalized) revert AlreadyFinalized();  // ← ADD THIS
    m.finalized = true;
    m.outcome = outcome;
    emit MarketResolved(marketKey, outcome);
}
```

### 3. Fee Mechanism Declared But Never Applied

**Location**: `SoothBook.sol` lines 107–109, 182–185

Storage variables `feeBps` and `feeRecipient` are set via `setFee()` but never referenced in `_buy()` or `_match()`. The protocol earns zero revenue from orderbook trading. Either implement fees or remove the dead storage to avoid confusion.

If implementing fees:
- Deduct fee from taker's deposit BEFORE collateral backing calculation
- Transfer fee to `feeRecipient`
- Consider whether escrow orders should pay fees (they don't deposit USDC)
- Ensure fee does not create accounting imbalance with `_collateralBacking`

### 4. 999-Tick RPC Scan

**Location**: `apps/web/src/hooks/useOrderbook.ts` lines 68–108

`scanTickDepth` queries ALL 999 ticks for each side (YES and NO) via multicall batches — approximately 2,000 `eth_call` reads every 10 seconds (the polling interval at line 211). This will hit rate limits on public RPCs and degrade UX.

The contract already has a `TickBitmap` library for O(1) tick discovery. The fix is to:
1. Add a view helper that exposes occupied tick iteration (for example, "next active tick from cursor") so the frontend can avoid blind full-range scans
2. Use that helper to fetch only occupied ticks via `getOrdersAtTick`
3. If no helper is added, use bounded scanning from `getBestTick` with strict early-stop rules as an interim mitigation
4. This typically reduces calls from ~2000 to ~10-50 depending on book depth

### 5. WAD Precision Lost Through Float Round-Trip

**Location**: `useOrderbook.ts` lines 45–46, 184–185 → `Pro.tsx` lines 532–533

Share balances undergo a lossy round-trip:
1. `formatUnits(bigint, 18)` → string → `parseFloat()` → number (loses precision beyond 15-16 digits)
2. `number.toString()` → `parseUnits(string, 18)` → bigint (wrong by up to thousands of wei)

```typescript
// useOrderbook.ts:184-185 — converts to float
setUserYesShares(parseFloat(formatUnits(yesBal as bigint, 18)));

// Pro.tsx:532-533 — converts back to WAD from float
const yesBalanceWad = parseUnits((userYesShares || 0).toString(), 18);
```

For typical prediction market amounts (< 1M shares) the error is negligible, but it violates the project's WAD precision principles and is a landmine for large positions.

**Fix**: Keep balances as `bigint` throughout. Only convert to `number` for display rendering.

## MEDIUM

### 6. Stale `useWaitForTransactionReceipt` State

**Location**: `apps/web/src/hooks/useOrderbookTrade.ts` lines 183–186

`txHash` from `useWriteContract` is never cleared after confirmation. The `isConfirming` value can reflect the receipt status of a *previous* transaction, not the current one. This feeds into `isPending` at line 558, which could briefly show incorrect loading state between transactions.

This is the exact pattern documented in `ui-patterns.md` ("Stale transaction receipt state"). Fix by tracking `pendingTxHash` in component state and clearing it on success, or remove the redundant `useWaitForTransactionReceipt` hook since `executeWrite` already uses `publicClient.waitForTransactionReceipt`.

### 7. `approveUSDC` / `claimWinnings` Success Before Confirmation

**Location**: `apps/web/src/hooks/useTraderVault.ts` lines 66–75, 96–103

Both functions toast success when the transaction is *submitted*, not *confirmed*:

```typescript
await writeContractAsync({ ... });
toast.success("USDC approval submitted.");  // ← tx may still revert on-chain
void refetchAllowance();                    // ← reads stale state
```

`refetchAllowance()` fires before the tx is mined, so it reads pre-tx state. Compare with `useOrderbookTrade.ts` which correctly uses `publicClient.waitForTransactionReceipt`.

Additionally, `claimWinnings` has no try/catch — if the wallet rejects, an unhandled promise rejection occurs.

### 8. `toFixed(2)` Truncation in Balance Check

**Location**: `apps/web/src/pages/Pro.tsx` line 664

```typescript
return availableBalance >= parseUnits(estimatedValue.toFixed(2), 18);
```

`estimatedValue` is a float. Using `.toFixed(2)` truncates to 2 decimal places before the comparison. If `estimatedValue` is `100.009`, this compares against `100.00 WAD`, potentially allowing an order to pass the frontend check but fail on-chain where the actual cost is `100.009`.

### 9. TypeScript `any` Violations

**Location**: `apps/web/src/pages/Pro.tsx` lines 255, 943

Per project rules: "No `any`. Use `unknown` + type guards if needed."

```typescript
// Line 255:
onSelect: (market: any) => void;  // should be typed Market interface

// Line 943:
} catch (e: any) {                // should be `e: unknown`
```

### 10. Rounding Loss on INVALID Redemption

**Location**: `SoothBook.sol` line 378

When outcome is `2` (INVALID), payout is `(yesBal + noBal) / 2`. If the sum is odd, integer division truncates by 1 wei. Dust accumulates in `_collateralBacking` over many redemptions. Negligible in practice but technically a permanent loss of funds.

### 15. Alchemy API Key Hardcoded in Git

**Location**: `packages/contracts-core/script/chainConfigs.ts` line 53

The MegaETH testnet Alchemy API key `jbMFWO2gYvRKxW5skck8K` is hardcoded in a git-tracked file. This should be moved to an environment variable following the pattern already used for `BASE_SEPOLIA_RPC_URL` and `ARC_TESTNET_RPC_URL` in the same file.

Severity is calibrated as **MEDIUM** (testnet and currently non-active in primary tooling), but should still be treated as a hygiene/security debt item and removed from git-tracked source.

---

## LOW

### 11. Sell Escrow Has No Slippage Protection

**Location**: `apps/web/src/hooks/useOrderbookTrade.ts` line 376

```typescript
const sellMaxCost = 0n;  // "maxCost is buy-path slippage protection"
```

Escrow sell orders pass `maxCost = 0` (no limit). The contract interprets 0 as "no limit" (line 219). A user selling via escrow has no protection against front-running that could move their fill price unfavorably.

### 12. No Event for Fee Configuration Changes

**Location**: `SoothBook.sol` lines 182–185

`setFee()` changes `feeBps` and `feeRecipient` without emitting an event. Off-chain monitoring systems cannot track fee parameter changes.

### 13. Non-Unique Outcome Token Symbols

**Location**: `SoothBook.sol` lines 145–158

All YES tokens get symbol `SOOTH-YES` and all NO tokens get `SOOTH-NO`, regardless of market. While they are separate contracts at different addresses, this makes them difficult to distinguish in wallets or block explorers. Consider including a market identifier in the symbol (e.g., `SOOTH-YES-BTC75K`).

### 14. Errors Silently Swallowed in useOrderbook

**Location**: `apps/web/src/hooks/useOrderbook.ts` lines 194–198

```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : '';
  if (message.includes('reverted') || message.includes('function selector')) {
    setIsSupported(false);
  }
  // Non-revert errors (network failures, timeouts) silently swallowed
}
```

Network failures produce no user feedback. The UI shows stale data with no indication of refresh failure.

---

## Informational

### Contract-Level Notes

- **Reentrancy**: All entry points protected by `nonReentrant`. `safeTransfer` to maker inside the matching loop (line 542) is safe under the guard but could be moved post-loop for defense-in-depth.
- **Integer overflow**: `_nextOrderId` is `uint64` (18.4 quintillion max). `orderIndex` truncated to `uint32` (4.3 billion per tick). Both practically unreachable.
- **Resting orders on finalized markets**: Users must manually cancel to recover collateral. No automatic refund mechanism.
- **OutcomeToken burn authorization**: `burn(from, amount)` is callable by `collateralizer` or `minter` without approval check. All current call sites pass `msg.sender` as `from`. Safe as long as SoothBook doesn't have bugs allowing burns from unintended addresses.
- **WAD math**: All arithmetic uses `tick * amount / 1000` where tick is a small integer (1–999), not WAD-scaled. No WAD*WAD multiplication bugs found.

### Frontend-Level Notes

- **Outcome inversion** in `useOrderbookTrade.placeOrder()`: Uses `outcome=0→buyYes, outcome=1→buyNo`. Pro.tsx compensates with `const outcome = (isYes ? 0 : 1)`. End-to-end verified correct. Documented in lessons.md as intentional.
- **`as never` type casts** in `useOrderbookTrade.ts` lines 245–246: Bypass TypeScript checking for dynamic contract calls. Pragmatic but fragile.
- **`getOrdersForOutcome`** in `useOrderbook.ts`: Not memoized, recreated every render. Minor perf issue if passed as prop.

---

*Generated from code review of `v12-4atomic-orderbook` branch, commit `053769b7`.*
