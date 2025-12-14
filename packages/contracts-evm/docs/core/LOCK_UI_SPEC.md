# Lock UI Specification

> **Component**: Locked Funds Display  
> **Version**: V4.6 Lock-on-Sell  
> **Priority**: P1 (Required for Lock-on-Sell release)

---

## Overview

When a user sells shares through the AMM, their proceeds are locked for 24 hours. The UI must clearly show:
1. Current locked balance
2. Unlock timeline (when funds become claimable)
3. Claim action

---

## Data Sources

### Contract Calls

```typescript
// TraderVault (delegates to GovernorVault)
function lockedBalance(user: Address): Promise<bigint>
function claimableBalance(user: Address): Promise<bigint>
function getLockEntries(user: Address): Promise<{
  amounts: bigint[]
  unlockTimes: bigint[]  // Unix timestamps
}>
function nextUnlock(user: Address): Promise<{
  amount: bigint
  unlockTime: bigint
}>

// Action
function claimUnlocked(): Promise<TransactionReceipt>
```

### Hook Interface

```typescript
// useLockedFunds.ts
interface LockEntry {
  amount: bigint        // USDC wei (18 decimals)
  unlockTime: number    // Unix timestamp (seconds)
  isClaimable: boolean  // unlockTime <= now
  timeRemaining: number // seconds until unlock (or 0)
}

interface UseLockedFundsResult {
  // Aggregates
  locked: bigint        // Total locked
  claimable: bigint     // Ready to claim now
  
  // Timeline
  entries: LockEntry[]  // Individual lock entries
  nextUnlock: {         // Next unlock event
    amount: bigint
    time: Date | null
  }
  
  // Action
  claim: () => Promise<void>
  isClaiming: boolean
}
```

---

## UI Placement

### 1. Portfolio Summary (Primary Display)

Location: `apps/web/src/components/PortfolioSummary.tsx`

```
┌────────────────────────────────────────────┐
│ Your Balances                              │
├────────────────────────────────────────────┤
│                                            │
│  💰 Available     $8,000.00     [Withdraw] │
│  🔒 Locked        $2,000.00     [Claim $500]│
│  📋 Pending       $500.00                  │
│  ─────────────────────────────             │
│  Total           $10,500.00                │
│                                            │
│  Next unlock: $500 in 4h 23m               │
│  [View Timeline →]                         │
│                                            │
└────────────────────────────────────────────┘

States:
- If claimable > 0: Show [Claim $X] button (green)
- If locked > 0 but claimable = 0: Show "Unlocking..."
- If locked = 0: Hide locked row entirely
```

### 2. Lock Timeline Modal

Trigger: Click "View Timeline" or "🔒 Locked" row

```
┌────────────────────────────────────────────┐
│ Locked Funds Timeline                   ✕ │
├────────────────────────────────────────────┤
│                                            │
│  ● Ready to Claim                          │
│  └─ $500.00 ─────────────────── [Claim]    │
│                                            │
│  ○ Unlocking Soon                          │
│  ├─ $300.00 ─── in 4h 23m                  │
│  └─ $200.00 ─── in 8h 15m                  │
│                                            │
│  ○ Locked                                  │
│  └─ $1,000.00 ─ in 22h 45m                 │
│                                            │
│  ───────────────────────────────────────   │
│  Total Locked: $2,000.00                   │
│  Claimable Now: $500.00     [Claim All]    │
│                                            │
└────────────────────────────────────────────┘

- Group entries by status (claimable / soon / locked)
- "Soon" = unlocks within 1 hour
- Show countdown for each entry
- Single "Claim All" button claims everything claimable
```

### 3. Trade Confirmation Toast

After AMM sell, show toast:

```
┌────────────────────────────────────────┐
│ ✅ Sold 50 YES for $24.50              │
│                                        │
│ Proceeds locked until Dec 13, 4:52 PM  │
│ [View Locked Funds]                    │
└────────────────────────────────────────┘
```

### 4. Activity Log Entry

```
┌────────────────────────────────────────────────────┐
│ 🔒 Sell Locked                            2m ago   │
│ Sold 50 YES → $24.50 locked (unlocks Dec 13 4:52P)│
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ 🔓 Funds Unlocked                        yesterday │
│ Claimed $300.00 → Available balance               │
└────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### New Components

| Component | Path | Responsibility |
|-----------|------|----------------|
| `LockedFundsRow` | `components/portfolio/LockedFundsRow.tsx` | Single row with claim button |
| `LockTimeline` | `components/portfolio/LockTimeline.tsx` | Modal showing all entries |
| `LockEntryItem` | `components/portfolio/LockEntryItem.tsx` | Single timeline entry |
| `ClaimButton` | `components/portfolio/ClaimButton.tsx` | Claim action with loading state |

### Modified Components

| Component | Changes |
|-----------|---------|
| `PortfolioSummary.tsx` | Add locked row, next unlock hint |
| `AmmTradeForm.tsx` | Show lock notice after sell |
| `ActivityLog.tsx` | Add lock/unlock event types |

### New Hooks

| Hook | Path | Purpose |
|------|------|---------|
| `useLockedFunds` | `hooks/useLockedFunds.ts` | Fetch and manage lock state |

---

## State Management

```typescript
// useLockedFunds.ts
export function useLockedFunds(user: Address | undefined) {
  const [entries, setEntries] = useState<LockEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isClaiming, setIsClaiming] = useState(false)
  
  // Fetch lock entries from contract
  const { data: rawEntries } = useContractRead({
    address: traderVault,
    abi: TRADER_VAULT_ABI,
    functionName: 'getLockEntries',
    args: [user],
    enabled: !!user,
  })
  
  // Transform to LockEntry[]
  useEffect(() => {
    if (!rawEntries) return
    const now = Math.floor(Date.now() / 1000)
    const transformed = rawEntries.amounts.map((amt, i) => ({
      amount: amt,
      unlockTime: Number(rawEntries.unlockTimes[i]),
      isClaimable: Number(rawEntries.unlockTimes[i]) <= now,
      timeRemaining: Math.max(0, Number(rawEntries.unlockTimes[i]) - now),
    }))
    setEntries(transformed)
    setIsLoading(false)
  }, [rawEntries])
  
  // Claim action
  const claim = useCallback(async () => {
    setIsClaiming(true)
    try {
      await writeContract({
        address: traderVault,
        abi: TRADER_VAULT_ABI,
        functionName: 'claimUnlocked',
      })
      // Refetch after claim
    } finally {
      setIsClaiming(false)
    }
  }, [])
  
  // Aggregates
  const locked = entries.reduce((sum, e) => sum + e.amount, 0n)
  const claimable = entries
    .filter(e => e.isClaimable)
    .reduce((sum, e) => sum + e.amount, 0n)
  
  return { entries, locked, claimable, claim, isClaiming, isLoading }
}
```

---

## ABI Requirements

Add to `TRADER_VAULT_ABI`:

```typescript
// New view functions
{
  name: 'lockedBalance',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'user', type: 'address' }],
  outputs: [{ type: 'uint256' }],
},
{
  name: 'claimableBalance',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'user', type: 'address' }],
  outputs: [{ type: 'uint256' }],
},
{
  name: 'getLockEntries',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'user', type: 'address' }],
  outputs: [
    { name: 'amounts', type: 'uint256[]' },
    { name: 'unlockTimes', type: 'uint64[]' },
  ],
},
{
  name: 'nextUnlock',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'user', type: 'address' }],
  outputs: [
    { name: 'amount', type: 'uint256' },
    { name: 'unlockTime', type: 'uint64' },
  ],
},
// New action
{
  name: 'claimUnlocked',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [],
  outputs: [{ type: 'uint256' }],
},
```

---

## Design Tokens

```css
/* Lock status colors */
--lock-locked: #f59e0b;     /* Amber - locked */
--lock-claimable: #10b981;  /* Green - ready to claim */
--lock-soon: #3b82f6;       /* Blue - unlocking soon */

/* Lock icon */
🔒 - Locked
🔓 - Claimable / Unlocked
⏳ - Unlocking soon
```

---

## Error States

| State | Display |
|-------|---------|
| No locked funds | Hide locked row entirely |
| Claim fails | Show toast: "Claim failed: [error]" |
| Zero claimable | Disable claim button, show countdown |
| Wallet disconnected | Show "Connect wallet to view" |

---

## Test Scenarios

1. **Fresh user** — No locked funds, row hidden
2. **After sell** — Lock row appears, shows countdown
3. **Partial unlock** — Some claimable, some still locked
4. **Full unlock** — All claimable, prominent claim button
5. **After claim** — Locked row updated, available increased
6. **Multiple sells** — Timeline shows multiple entries

---

## Implementation Priority

1. **P0**: `useLockedFunds` hook
2. **P0**: `LockedFundsRow` in PortfolioSummary
3. **P1**: `ClaimButton` with loading state
4. **P2**: `LockTimeline` modal
5. **P2**: Trade toast notification
6. **P3**: Activity log entries
