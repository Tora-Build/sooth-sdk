# V8 AMM Lock-on-Sell: Locked Proceeds Spendability

**Date**: 2025-12-24  
**Scope**: V8 contracts in `packages/contracts-evm/contracts/*`  
**Question**: When AMM sell proceeds are “locked,” are they still usable to buy? Where are they held?

---

## Conclusion (Decision/Intent)

- **Locked proceeds should be spendable but not withdrawable** during the lock window.
  - Users can keep trading (capital efficiency).
  - Users cannot “cash out” immediately after selling (anti-extract / anti-front-run goal).
- **Spendability should be cross-market**: a sell in Market A can fund a buy in Market B.

---

## Current V8 Implementation (Today)

### Where funds are held
- **Custody**: USDC stays inside `AMMEngine` (contract balance).
- **Accounting**: per-market, per-user:
  - `Position.lockedProceeds`
  - `Position.lockExpiry`
  - stored at `_positions[market][user]`

### Can locked proceeds be used to buy?
- **No** in current code.
  - Buys always pull fresh USDC via `transferFrom(user, ...)`.
  - Locked proceeds are only withdrawable after expiry via `claimUnlocked(market)`.

This is true both when calling `AMMEngine.tradePositions(...)` directly and when routing through `LaunchpadEngine.tradePositions(...)` (which also pulls USDC from the user and forwards the base cost to AMMEngine).

---

## How to Support "Spendable-but-Not-Withdrawable" (Design Options)

### Option A — Global ledger inside `AMMEngine` (fastest V8-aligned change) ✅ RECOMMENDED

**Architecture**:
- Add a **global per-user balance** inside `AMMEngine` that represents spendable USDC credit.
- On **sell**: credit the user's global balance and add a lock entry (lock applies to withdrawal only).
- On **buy (any market)**: spend from the global balance first; fall back to `transferFrom` if insufficient.
- On **withdraw**: allow withdrawing only the unlocked portion.

**Note**: current lock state is per-market; to support cross-market spendability cleanly, you'll likely need to move from "per-market lock" to a **global lock queue** (or global locked sum + per-entry expiries) at the AMMEngine level.

**Pros**:
- ✅ Minimal architectural changes
- ✅ V8-aligned (no new contracts)
- ✅ Supports cross-market spendability
- ✅ Preserves "no custody layer" philosophy

**Cons**:
- ⚠️ Requires refactoring lock state from per-market to global
- ⚠️ Complexity: Need to track global locked sum + per-entry expiries (lock queue)
- ⚠️ Gas cost: Iterating through lock queue on withdrawal could be expensive

### Option B — Move the ledger to `TraderVaultLite` (cleaner architecture) ⚠️ NOT RECOMMENDED

**Architecture**:
- Keep `AMMEngine` as pure execution/math.
- Put `available` vs `locked` accounting in `TraderVaultLite`.
- Have AMMEngine/LaunchpadEngine charge users by decrementing vault balances (instead of always `transferFrom`).

**⚠️ WARNING**: This **contradicts ADR-033** (No Built-in Custody Layer, DECISIONS.md lines 27-49).

> "Remove TraderVaultLite entirely from V8... Users manage USDC via their preferred solution (EOA, Safe, Biconomy, etc.)"

Reintroducing a custody layer would be a **major architectural reversal** from the V8 design philosophy of maximum flexibility for smart account integration.

**Pros**:
- ✅ Cleaner separation of concerns (custody vs execution)
- ✅ Easier to audit (all balance logic in one place)
- ✅ More flexible (could support other features like limit orders, stop-loss, etc.)

**Cons**:
- ❌ Contradicts ADR-033 (No Built-in Custody Layer)
- ❌ Adds contract hop (gas cost)
- ❌ Reintroduces complexity that V8 explicitly removed

---

## Gas Cost Analysis

### Option A (Global Ledger in AMMEngine)
- **Buy**: +~5k gas (balance check + conditional transfer)
- **Sell**: +~20k gas (lock queue push)
- **Claim**: ~50k gas per 10 locks (iteration + cleanup)
- **Total per trade cycle**: ~25k gas overhead

### Option B (TraderVaultLite)
- **Buy**: +~10k gas (extra contract hop)
- **Sell**: +~10k gas (extra contract hop)
- **Claim**: ~30k gas (simpler accounting)
- **Total per trade cycle**: ~20k gas overhead

**Verdict**: Option B is slightly cheaper per trade, but Option A avoids architectural reversal.

---

## Migration Path (Option A Implementation)

### Phase 1: Contract Changes (2-3 days)
1. **Add global balance tracking to AMMEngine**:
   ```solidity
   mapping(address => uint256) private _availableBalance;
   mapping(address => uint256) private _lockedBalance;
   mapping(address => LockEntry[]) private _lockQueue;
   
   struct LockEntry {
       uint256 amount;
       uint64 expiry;
       address market; // Track which market generated this lock
   }
   ```

2. **Modify `tradePositions()` logic**:
   - Buy: Spend from `_availableBalance` first, then `transferFrom`
   - Sell: Credit `_availableBalance` and push to `_lockQueue`

3. **Modify `claimUnlocked()` logic**:
   - Remove per-market parameter (now global)
   - Iterate `_lockQueue`, sum unlocked entries
   - Remove unlocked entries from queue
   - Transfer total unlocked amount

4. **Add gas optimization**: Bounded iteration (max claims per call)

### Phase 2: Testing (1-2 days)
1. **Unit tests**: Balance accounting, lock queue management
2. **Integration tests**: Multi-market scenarios, cross-market spendability
3. **Edge cases**: Empty queue, partial unlocks, concurrent trades
4. **Gas benchmarks**: Compare before/after gas costs

### Phase 3: Frontend Integration (1-2 days)
1. **New hooks**: `useAvailableBalance`, `useLockQueue`, `useClaimableAmount`
2. **UI components**: Balance display, claim button
3. **Trading panel updates**: Show available balance, auto-use available funds

### Phase 4: Deployment (1 day)
1. **Deploy new AMMEngine** to testnet
2. **Update LaunchpadEngine** to point to new AMMEngine
3. **Migrate existing positions** (if any)
4. **Frontend config update** (new ABIs)
5. **User testing** on testnet

**Total Estimated Time**: ~1 week

---

## Frontend Implications

### New UI Elements Needed

**1. Balance Display Component**
```tsx
<BalanceCard>
  <div>Available: ${availableBalance}</div>
  <div>Locked: ${lockedBalance} (unlocks in {timeRemaining})</div>
  <Button disabled={claimableAmount === 0}>
    Claim ${claimableAmount} Unlocked
  </Button>
</BalanceCard>
```

**2. Trading Panel Updates**
```tsx
<TradingPanel>
  <QuoteDisplay>
    Cost: ${cost}
    {availableBalance >= cost && (
      <Badge>Using Available Balance</Badge>
    )}
  </QuoteDisplay>
</TradingPanel>
```

**3. Lock Queue Display**
```tsx
<LockQueueTable>
  {lockQueue.map(entry => (
    <Row>
      <Cell>{entry.market}</Cell>
      <Cell>${entry.amount}</Cell>
      <Cell>{formatExpiry(entry.expiry)}</Cell>
    </Row>
  ))}
</LockQueueTable>
```

### New Hooks Required

**1. `useAvailableBalance(user: Address)`**
```typescript
// Returns: { available, locked, total }
```

**2. `useLockQueue(user: Address)`**
```typescript
// Returns: LockEntry[] with { amount, expiry, market }
```

**3. `useClaimableAmount(user: Address)`**
```typescript
// Returns: { claimable, nextUnlockTime, nextUnlockAmount }
```

**4. `useClaimUnlocked()`**
```typescript
// Returns: { claim: () => Promise<void>, isLoading, error }
```

### Updated Existing Hooks

**`useAmmMarket.ts`**:
- Add `availableBalance` to return value
- Update `tradePositions` to show available balance usage

**`useLaunchpadMarket.ts`**:
- Add `availableBalance` to return value
- Update quote display to show if using available balance

---

## Why this is NOT "domain contamination"

- This change affects **only the AMM position domain** cash ledger semantics.
- It does not make AMM positions fungible with TickBook tokens.
- It does not introduce an AMM↔TickBook bridge.
- It maintains V8's principle of domain isolation (AMM ≠ TickBook).

---

## Decision: Implement Option A

**Rationale**:
1. ✅ Aligns with V8 architecture (ADR-033: No Built-in Custody)
2. ✅ Improves capital efficiency (immediate re-trading)
3. ✅ Maintains anti-extract protection (24h withdrawal lock)
4. ✅ Enables cross-market liquidity (sell A → buy B)
5. ✅ Reasonable gas cost (~25k overhead per trade cycle)

**Next Steps**: See implementation plan in `V8_SPENDABLE_PROCEEDS_IMPLEMENTATION.md`
