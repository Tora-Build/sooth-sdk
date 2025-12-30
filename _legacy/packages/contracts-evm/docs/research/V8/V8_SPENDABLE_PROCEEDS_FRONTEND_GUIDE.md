# V8.1 Spendable Proceeds - Frontend Integration Guide

**Version**: 1.0  
**Date**: 2025-12-24  
**Target**: Frontend Development Team  
**Estimated Time**: 1-2 days

---

## 📋 **Overview**

This guide provides step-by-step instructions for integrating the V8.1 Spendable Proceeds feature into the frontend. The feature allows users to immediately spend locked proceeds from AMM sell orders across different markets, while maintaining the 24-hour withdrawal lock.

### **Key User Benefits**
- ✅ **Capital Efficiency**: Trade immediately after selling (no 24h wait)
- ✅ **Cross-Market Liquidity**: Sell in Market A → Buy in Market B instantly
- ✅ **Transparent Balance Tracking**: See available, locked, and withdrawable balances
- ✅ **Anti-Extract Protection**: 24h lock still enforced for withdrawals

---

## 🎯 **Implementation Phases**

### Phase 1: Extract ABIs (15 minutes)
### Phase 2: Create Hooks (2-3 hours)
### Phase 3: Create UI Components (3-4 hours)
### Phase 4: Update Existing Components (1-2 hours)
### Phase 5: Testing & Polish (2-3 hours)

**Total Estimated Time**: 8-12 hours (1-2 days)

---

## 📦 **Phase 1: Extract ABIs**

### Step 1.1: Run ABI Extraction Script

```bash
cd packages/contracts-evm
./script/extract-abis.sh
```

This will generate updated ABIs in `packages/contracts-evm/abis/`.

### Step 1.2: Copy ABIs to Frontend

```bash
# From project root
cp packages/contracts-evm/abis/AMMEngine.json packages/web/src/abis/
cp packages/contracts-evm/abis/IAMMEngine.json packages/web/src/abis/
```

### Step 1.3: Verify ABI Changes

Check that the new ABI includes these functions:
- `getBalances(address user)` → `(uint256 available, uint256 locked)`
- `getLockQueue(address user)` → `LockEntry[] memory`
- `getClaimableAmount(address user)` → `(uint256 claimable, uint64 nextUnlock, uint256 nextAmount)`
- `claimUnlocked(uint256 maxClaims)` → `uint256 totalUnlocked`

And these events:
- `BalanceUsed(address indexed user, uint256 amount, uint256 remaining)`
- `WalletPull(address indexed user, uint256 amount)`
- `LocksProcessed(address indexed user, uint256 count, uint256 totalUnlocked)`

---

## 🪝 **Phase 2: Create Hooks**

### Hook 1: `useAvailableBalance`

**File**: `packages/web/src/hooks/v8/useAvailableBalance.ts`

```typescript
import { useReadContract, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import AMMEngineABI from '@/abis/AMMEngine.json';

export interface AvailableBalanceData {
  available: bigint;
  locked: bigint;
  availableFormatted: string;
  lockedFormatted: string;
  withdrawable: bigint; // available - locked
  withdrawableFormatted: string;
  isLoading: boolean;
  error: Error | null;
}

export function useAvailableBalance(
  ammEngineAddress: `0x${string}` | undefined
): AvailableBalanceData {
  const { address } = useAccount();

  const { data, isLoading, error } = useReadContract({
    address: ammEngineAddress,
    abi: AMMEngineABI,
    functionName: 'getBalances',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!ammEngineAddress,
      refetchInterval: 5000, // Refresh every 5 seconds
    },
  });

  const available = (data as [bigint, bigint])?.[0] ?? 0n;
  const locked = (data as [bigint, bigint])?.[1] ?? 0n;
  const withdrawable = available - locked;

  return {
    available,
    locked,
    availableFormatted: formatUnits(available, 6), // USDC has 6 decimals
    lockedFormatted: formatUnits(locked, 6),
    withdrawable,
    withdrawableFormatted: formatUnits(withdrawable, 6),
    isLoading,
    error: error as Error | null,
  };
}
```

**Usage Example**:
```typescript
const { available, locked, withdrawable, availableFormatted } = useAvailableBalance(ammEngineAddress);

// Display in UI
<div>Available: ${availableFormatted} USDC</div>
<div>Locked: ${lockedFormatted} USDC</div>
<div>Withdrawable: ${withdrawableFormatted} USDC</div>
```

---

### Hook 2: `useLockQueue`

**File**: `packages/web/src/hooks/v8/useLockQueue.ts`

```typescript
import { useReadContract, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import AMMEngineABI from '@/abis/AMMEngine.json';

export interface LockEntry {
  amount: bigint;
  expiry: bigint;
  market: `0x${string}`;
  amountFormatted: string;
  expiryDate: Date;
  isUnlocked: boolean;
  timeUntilUnlock: number; // milliseconds
}

export interface LockQueueData {
  entries: LockEntry[];
  totalLocked: bigint;
  totalLockedFormatted: string;
  unlockedCount: number;
  lockedCount: number;
  isLoading: boolean;
  error: Error | null;
}

export function useLockQueue(
  ammEngineAddress: `0x${string}` | undefined
): LockQueueData {
  const { address } = useAccount();

  const { data, isLoading, error } = useReadContract({
    address: ammEngineAddress,
    abi: AMMEngineABI,
    functionName: 'getLockQueue',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!ammEngineAddress,
      refetchInterval: 5000,
    },
  });

  const now = Date.now();
  const rawEntries = (data as Array<{ amount: bigint; expiry: bigint; market: `0x${string}` }>) ?? [];

  const entries: LockEntry[] = rawEntries.map((entry) => {
    const expiryMs = Number(entry.expiry) * 1000;
    const isUnlocked = now >= expiryMs;
    const timeUntilUnlock = Math.max(0, expiryMs - now);

    return {
      amount: entry.amount,
      expiry: entry.expiry,
      market: entry.market,
      amountFormatted: formatUnits(entry.amount, 6),
      expiryDate: new Date(expiryMs),
      isUnlocked,
      timeUntilUnlock,
    };
  });

  const totalLocked = entries.reduce((sum, entry) => sum + entry.amount, 0n);
  const unlockedCount = entries.filter((e) => e.isUnlocked).length;
  const lockedCount = entries.length - unlockedCount;

  return {
    entries,
    totalLocked,
    totalLockedFormatted: formatUnits(totalLocked, 6),
    unlockedCount,
    lockedCount,
    isLoading,
    error: error as Error | null,
  };
}
```

**Usage Example**:
```typescript
const { entries, unlockedCount, lockedCount } = useLockQueue(ammEngineAddress);

// Display in UI
<div>Unlocked: {unlockedCount} | Locked: {lockedCount}</div>
{entries.map((entry, i) => (
  <div key={i}>
    {entry.amountFormatted} USDC - {entry.isUnlocked ? 'Ready' : 'Locked'}
  </div>
))}
```

---

### Hook 3: `useClaimableAmount`

**File**: `packages/web/src/hooks/v8/useClaimableAmount.ts`

```typescript
import { useReadContract, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import AMMEngineABI from '@/abis/AMMEngine.json';

export interface ClaimableAmountData {
  claimable: bigint;
  claimableFormatted: string;
  nextUnlock: bigint;
  nextUnlockDate: Date | null;
  nextAmount: bigint;
  nextAmountFormatted: string;
  hasClaimable: boolean;
  timeUntilNextUnlock: number; // milliseconds
  isLoading: boolean;
  error: Error | null;
}

export function useClaimableAmount(
  ammEngineAddress: `0x${string}` | undefined
): ClaimableAmountData {
  const { address } = useAccount();

  const { data, isLoading, error } = useReadContract({
    address: ammEngineAddress,
    abi: AMMEngineABI,
    functionName: 'getClaimableAmount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!ammEngineAddress,
      refetchInterval: 5000,
    },
  });

  const claimable = (data as [bigint, bigint, bigint])?.[0] ?? 0n;
  const nextUnlock = (data as [bigint, bigint, bigint])?.[1] ?? 0n;
  const nextAmount = (data as [bigint, bigint, bigint])?.[2] ?? 0n;

  const now = Date.now();
  const nextUnlockMs = Number(nextUnlock) * 1000;
  const timeUntilNextUnlock = nextUnlock > 0n ? Math.max(0, nextUnlockMs - now) : 0;

  return {
    claimable,
    claimableFormatted: formatUnits(claimable, 6),
    nextUnlock,
    nextUnlockDate: nextUnlock > 0n ? new Date(nextUnlockMs) : null,
    nextAmount,
    nextAmountFormatted: formatUnits(nextAmount, 6),
    hasClaimable: claimable > 0n,
    timeUntilNextUnlock,
    isLoading,
    error: error as Error | null,
  };
}
```

**Usage Example**:
```typescript
const { claimable, claimableFormatted, hasClaimable, nextUnlockDate } = useClaimableAmount(ammEngineAddress);

// Display in UI
{hasClaimable && (
  <div>
    <div>Claimable: ${claimableFormatted} USDC</div>
    <button onClick={handleClaim}>Claim Now</button>
  </div>
)}
{nextUnlockDate && (
  <div>Next unlock: {nextUnlockDate.toLocaleString()}</div>
)}
```

---

### Hook 4: `useClaimUnlocked`

**File**: `packages/web/src/hooks/v8/useClaimUnlocked.ts`

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import AMMEngineABI from '@/abis/AMMEngine.json';

export interface ClaimUnlockedData {
  claim: (maxClaims?: number) => void;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
  txHash: `0x${string}` | undefined;
}

export function useClaimUnlocked(
  ammEngineAddress: `0x${string}` | undefined
): ClaimUnlockedData {
  const {
    data: hash,
    writeContract,
    isPending,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const claim = (maxClaims: number = 50) => {
    if (!ammEngineAddress) {
      toast.error('AMM Engine address not found');
      return;
    }

    writeContract({
      address: ammEngineAddress,
      abi: AMMEngineABI,
      functionName: 'claimUnlocked',
      args: [BigInt(maxClaims)],
    });
  };

  // Show toast notifications
  if (isConfirmed) {
    toast.success('Successfully claimed unlocked proceeds!');
  }

  if (writeError || confirmError) {
    toast.error(`Claim failed: ${(writeError || confirmError)?.message}`);
  }

  return {
    claim,
    isPending,
    isConfirming,
    isConfirmed,
    error: (writeError || confirmError) as Error | null,
    txHash: hash,
  };
}
```

**Usage Example**:
```typescript
const { claim, isPending, isConfirming } = useClaimUnlocked(ammEngineAddress);

// In button handler
<button 
  onClick={() => claim(50)} 
  disabled={isPending || isConfirming}
>
  {isPending || isConfirming ? 'Claiming...' : 'Claim Unlocked'}
</button>
```

---

## 🎨 **Phase 3: Create UI Components**

### Component 1: `BalanceCard`

**File**: `packages/web/src/components/v8/BalanceCard.tsx`

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAvailableBalance } from '@/hooks/v8/useAvailableBalance';
import { useClaimableAmount } from '@/hooks/v8/useClaimableAmount';
import { useClaimUnlocked } from '@/hooks/v8/useClaimUnlocked';
import { Wallet, Lock, Unlock } from 'lucide-react';

interface BalanceCardProps {
  ammEngineAddress: `0x${string}`;
}

export function BalanceCard({ ammEngineAddress }: BalanceCardProps) {
  const { 
    availableFormatted, 
    lockedFormatted, 
    withdrawableFormatted,
    isLoading: balanceLoading 
  } = useAvailableBalance(ammEngineAddress);

  const { 
    claimableFormatted, 
    hasClaimable,
    nextUnlockDate,
    isLoading: claimableLoading 
  } = useClaimableAmount(ammEngineAddress);

  const { claim, isPending, isConfirming } = useClaimUnlocked(ammEngineAddress);

  const isLoading = balanceLoading || claimableLoading;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Your Balances
        </CardTitle>
        <CardDescription>
          Available balance can be used for trading. Locked balance cannot be withdrawn for 24h.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Available Balance */}
        <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
          <div className="flex items-center gap-2">
            <Unlock className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium">Available (Spendable)</span>
          </div>
          <span className="text-lg font-bold text-green-600 dark:text-green-400">
            {isLoading ? '...' : `$${availableFormatted}`}
          </span>
        </div>

        {/* Locked Balance */}
        <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-medium">Locked (Not Withdrawable)</span>
          </div>
          <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {isLoading ? '...' : `$${lockedFormatted}`}
          </span>
        </div>

        {/* Withdrawable Balance */}
        <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium">Withdrawable</span>
          </div>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {isLoading ? '...' : `$${withdrawableFormatted}`}
          </span>
        </div>

        {/* Claim Section */}
        {hasClaimable && (
          <div className="pt-4 border-t space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Ready to Claim</span>
              <Badge variant="success" className="text-sm">
                ${claimableFormatted} USDC
              </Badge>
            </div>
            <Button 
              onClick={() => claim(50)} 
              disabled={isPending || isConfirming}
              className="w-full"
              variant="default"
            >
              {isPending || isConfirming ? 'Claiming...' : 'Claim Unlocked Proceeds'}
            </Button>
          </div>
        )}

        {/* Next Unlock Info */}
        {!hasClaimable && nextUnlockDate && (
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Next unlock: {nextUnlockDate.toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### Component 2: `LockQueueTable`

**File**: `packages/web/src/components/v8/LockQueueTable.tsx`

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLockQueue } from '@/hooks/v8/useLockQueue';
import { Clock, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LockQueueTableProps {
  ammEngineAddress: `0x${string}`;
}

export function LockQueueTable({ ammEngineAddress }: LockQueueTableProps) {
  const { entries, unlockedCount, lockedCount, isLoading } = useLockQueue(ammEngineAddress);

  if (isLoading) {
    return <div className="text-center py-8">Loading lock queue...</div>;
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lock Queue</CardTitle>
          <CardDescription>No locked proceeds</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Lock Queue</span>
          <div className="flex gap-2">
            <Badge variant="success">{unlockedCount} Unlocked</Badge>
            <Badge variant="secondary">{lockedCount} Locked</Badge>
          </div>
        </CardTitle>
        <CardDescription>
          Your locked proceeds from sell orders. Unlocked entries can be claimed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Amount</TableHead>
              <TableHead>Market</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Unlock Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">
                  ${entry.amountFormatted}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {entry.market.slice(0, 6)}...{entry.market.slice(-4)}
                </TableCell>
                <TableCell>
                  {entry.isUnlocked ? (
                    <Badge variant="success" className="flex items-center gap-1 w-fit">
                      <CheckCircle className="h-3 w-3" />
                      Unlocked
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <Clock className="h-3 w-3" />
                      Locked
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {entry.isUnlocked 
                    ? 'Ready to claim' 
                    : formatDistanceToNow(entry.expiryDate, { addSuffix: true })
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

---

## 🔄 **Phase 4: Update Existing Components**

### Update 1: `AmmTradingPanel.tsx`

Add indicator when using available balance:

```typescript
// Add to imports
import { useAvailableBalance } from '@/hooks/v8/useAvailableBalance';

// Inside component
const { available } = useAvailableBalance(ammEngineAddress);

// In the quote display section, add:
{quote && available > 0n && (
  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
    <CheckCircle className="h-4 w-4" />
    <span>Using available balance (${formatUnits(available, 6)} USDC)</span>
  </div>
)}
```

### Update 2: Market Detail Page

Add the new components to the market detail page:

```typescript
import { BalanceCard } from '@/components/v8/BalanceCard';
import { LockQueueTable } from '@/components/v8/LockQueueTable';

// In the page layout
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Left column - Market info and trading */}
  <div className="lg:col-span-2 space-y-6">
    <MarketHeader market={market} />
    <AmmTradingPanel market={market} />
  </div>

  {/* Right column - Balances and locks */}
  <div className="space-y-6">
    <BalanceCard ammEngineAddress={ammEngineAddress} />
    <LockQueueTable ammEngineAddress={ammEngineAddress} />
  </div>
</div>
```

---

## ✅ **Phase 5: Testing Checklist**

### Manual Testing

- [ ] **Balance Display**
  - [ ] Available balance shows correctly
  - [ ] Locked balance shows correctly
  - [ ] Withdrawable balance = available - locked
  - [ ] Balances update after trades

- [ ] **Trading with Available Balance**
  - [ ] Buy order uses available balance first
  - [ ] Indicator shows when using available balance
  - [ ] Wallet pull happens only when needed
  - [ ] Cross-market trading works (sell A → buy B)

- [ ] **Lock Queue**
  - [ ] Lock entries appear after sell orders
  - [ ] Correct market address shown
  - [ ] Unlock countdown displays correctly
  - [ ] Status badge updates (Locked → Unlocked)

- [ ] **Claiming**
  - [ ] Claim button appears when claimable > 0
  - [ ] Claim transaction succeeds
  - [ ] Balances update after claim
  - [ ] Lock queue entries removed after claim
  - [ ] Toast notifications work

### Edge Cases

- [ ] **No Balances**: UI handles zero balances gracefully
- [ ] **Large Numbers**: Formatting works for large amounts
- [ ] **Many Locks**: Table scrolls/paginates for 10+ entries
- [ ] **Rapid Trading**: UI updates correctly during rapid trades
- [ ] **Network Errors**: Error states display properly

---

## 🎨 **UI/UX Guidelines**

### Color Coding
- **Green**: Available balance (spendable)
- **Orange**: Locked balance (not withdrawable)
- **Blue**: Withdrawable balance
- **Success Badge**: Unlocked entries
- **Secondary Badge**: Locked entries

### Tooltips & Help Text
Add tooltips to explain:
- "Available balance can be used for trading immediately"
- "Locked balance cannot be withdrawn for 24 hours"
- "Withdrawable balance can be claimed to your wallet"

### Loading States
- Show skeleton loaders while fetching data
- Disable buttons during transactions
- Show "Claiming..." text during claim

### Error Handling
- Display user-friendly error messages
- Provide retry buttons for failed transactions
- Log errors to console for debugging

---

## 📊 **Analytics Events**

Track these events for product analytics:

```typescript
// When user uses available balance
analytics.track('available_balance_used', {
  amount: availableUsed,
  market: marketAddress,
  timestamp: Date.now(),
});

// When user claims unlocked proceeds
analytics.track('proceeds_claimed', {
  amount: claimedAmount,
  lockCount: locksProcessed,
  timestamp: Date.now(),
});

// When user views lock queue
analytics.track('lock_queue_viewed', {
  entryCount: entries.length,
  unlockedCount,
  lockedCount,
});
```

---

## 🚀 **Deployment Checklist**

Before deploying to production:

- [ ] All hooks tested and working
- [ ] All components render correctly
- [ ] Mobile responsive design verified
- [ ] Dark mode tested
- [ ] Error states handled
- [ ] Loading states implemented
- [ ] Analytics events firing
- [ ] ABIs up to date
- [ ] Contract addresses correct
- [ ] User testing completed

---

## 📝 **Code Review Checklist**

- [ ] TypeScript types are correct
- [ ] No `any` types used
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] Accessibility (a11y) considered
- [ ] Mobile responsive
- [ ] Dark mode support
- [ ] Performance optimized (memoization, etc.)
- [ ] Comments added for complex logic
- [ ] Console logs removed

---

## 🐛 **Common Issues & Solutions**

### Issue 1: ABIs Not Found
**Solution**: Run `./script/extract-abis.sh` and copy to frontend

### Issue 2: Contract Address Undefined
**Solution**: Check `deployments.json` has correct AMM Engine address

### Issue 3: Balances Not Updating
**Solution**: Verify `refetchInterval` is set in `useReadContract`

### Issue 4: Claim Button Not Appearing
**Solution**: Check `hasClaimable` logic and ensure time has passed

### Issue 5: USDC Decimals Wrong
**Solution**: Use 6 decimals for USDC (not 18)

---

## 📚 **Additional Resources**

- **Contract Implementation**: `packages/contracts-evm/contracts/AMMEngine.sol`
- **Interface Definition**: `packages/contracts-evm/contracts/interfaces/IAMMEngine.sol`
- **Test Suite**: `packages/contracts-evm/test/v8/SpendableProceeds.t.sol`
- **Implementation Plan**: `packages/contracts-evm/docs/research/V8/V8_SPENDABLE_PROCEEDS_IMPLEMENTATION.md`

---

## 🎯 **Success Criteria**

The frontend integration is complete when:

1. ✅ Users can see their available, locked, and withdrawable balances
2. ✅ Users can trade using their available balance (including locked proceeds)
3. ✅ Users can see their lock queue with unlock times
4. ✅ Users can claim unlocked proceeds with one click
5. ✅ Cross-market trading works (sell A → buy B immediately)
6. ✅ All UI components are responsive and accessible
7. ✅ Error states are handled gracefully
8. ✅ Analytics events are tracked

---

## 💬 **Questions?**

If you encounter any issues during implementation:

1. Check the test suite for expected behavior
2. Review the contract implementation
3. Consult the implementation plan document
4. Reach out to the protocol team

---

**Happy Coding!** 🚀

**Estimated Completion**: 1-2 days  
**Priority**: High (Major UX improvement)  
**Impact**: High (Capital efficiency + cross-market liquidity)
