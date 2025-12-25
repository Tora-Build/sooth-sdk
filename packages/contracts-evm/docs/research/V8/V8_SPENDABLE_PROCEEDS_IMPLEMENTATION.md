# V8 Spendable Proceeds Implementation Plan

**Feature**: Enable locked AMM sell proceeds to be spendable (but not withdrawable) during the 24h lock period  
**Decision**: Option A - Global ledger inside AMMEngine  
**Status**: 📋 Planning  
**Estimated Time**: 1 week  
**Priority**: Medium (UX improvement, not critical)

---

## Overview

Currently, when users sell AMM positions, proceeds are locked for 24 hours and **cannot be used** to buy other positions. This forces users to either:
1. Wait 24 hours to trade again
2. Deposit additional USDC from their wallet

This implementation will allow users to **spend locked proceeds immediately** while maintaining the 24h withdrawal lock for anti-extract protection.

**Key Principle**: Locked proceeds are **spendable but not withdrawable**.

---

## Architecture Changes

### Current State (V8.0)
```
User sells → Proceeds locked in per-market Position struct
User buys  → Always pulls fresh USDC via transferFrom()
User claims → After 24h, transfers locked proceeds to wallet
```

### Target State (V8.1)
```
User sells → Proceeds credited to global available balance + added to lock queue
User buys  → Spends from available balance first, then pulls from wallet if needed
User claims → Transfers only unlocked portion from available balance to wallet
```

---

## Phase 1: Contract Changes (2-3 days)

### 1.1 Add Global Balance Tracking to AMMEngine

**File**: `packages/contracts-evm/contracts/AMMEngine.sol`

**New State Variables**:
```solidity
/// @notice User available balances (spendable USDC, includes locked)
mapping(address => uint256) private _availableBalance;

/// @notice User locked balances (subset of available, not withdrawable)
mapping(address => uint256) private _lockedBalance;

/// @notice Lock queue for tracking individual lock entries
mapping(address => LockEntry[]) private _lockQueue;

struct LockEntry {
    uint256 amount;     // Locked amount (WAD)
    uint64 expiry;      // Unlock timestamp
    address market;     // Market that generated this lock
}
```

**Invariant**: `_lockedBalance[user] <= _availableBalance[user]` at all times

---

### 1.2 Modify `tradePositions()` Function

**Current Logic** (lines 88-154):
```solidity
if (deltaShares > 0) {
    // Buy: Always pull from wallet
    usdc.safeTransferFrom(msg.sender, address(this), actualCost);
    position.shares += deltaShares;
} else {
    // Sell: Lock proceeds in position
    position.lockedProceeds += actualCost;
    position.lockExpiry = uint64(block.timestamp + LOCK_DURATION);
    position.shares += deltaShares;
}
```

**New Logic**:
```solidity
if (deltaShares > 0) {
    // Buy: Spend from available balance first
    if (_availableBalance[msg.sender] >= actualCost) {
        // Sufficient available balance
        _availableBalance[msg.sender] -= actualCost;
        emit BalanceUsed(msg.sender, actualCost, _availableBalance[msg.sender]);
    } else {
        // Partial or full wallet pull
        uint256 fromBalance = _availableBalance[msg.sender];
        uint256 fromWallet = actualCost - fromBalance;
        
        _availableBalance[msg.sender] = 0;
        usdc.safeTransferFrom(msg.sender, address(this), fromWallet);
        
        emit BalanceUsed(msg.sender, fromBalance, 0);
        emit WalletPull(msg.sender, fromWallet);
    }
    
    position.shares += deltaShares;
    
} else {
    // Sell: Credit available balance + add to lock queue
    require(position.shares >= -deltaShares, "AMMEngine: insufficient shares");
    
    _availableBalance[msg.sender] += actualCost;
    _lockedBalance[msg.sender] += actualCost;
    
    _lockQueue[msg.sender].push(LockEntry({
        amount: actualCost,
        expiry: uint64(block.timestamp + LOCK_DURATION),
        market: market
    }));
    
    position.shares += deltaShares;
    
    emit ProceedsLocked(msg.sender, market, actualCost, uint64(block.timestamp + LOCK_DURATION));
}
```

---

### 1.3 Modify `claimUnlocked()` Function

**Current Signature** (line 194):
```solidity
function claimUnlocked(address market) external override returns (uint256 amount)
```

**New Signature**:
```solidity
function claimUnlocked(uint256 maxClaims) external returns (uint256 totalUnlocked)
```

**New Logic**:
```solidity
function claimUnlocked(uint256 maxClaims) external returns (uint256 totalUnlocked) {
    require(maxClaims > 0 && maxClaims <= 50, "AMMEngine: invalid maxClaims");
    
    LockEntry[] storage queue = _lockQueue[msg.sender];
    require(queue.length > 0, "AMMEngine: no locks");
    
    uint256 processed = 0;
    uint256 i = 0;
    
    // Iterate through queue, remove expired locks
    while (i < queue.length && processed < maxClaims) {
        if (block.timestamp >= queue[i].expiry) {
            totalUnlocked += queue[i].amount;
            
            // Remove entry (swap with last, pop)
            queue[i] = queue[queue.length - 1];
            queue.pop();
            
            processed++;
            // Don't increment i (we just swapped in a new entry)
        } else {
            i++;
        }
    }
    
    require(totalUnlocked > 0, "AMMEngine: no unlocked proceeds");
    
    // Update balances
    _lockedBalance[msg.sender] -= totalUnlocked;
    _availableBalance[msg.sender] -= totalUnlocked;
    
    // Transfer to user
    usdc.safeTransfer(msg.sender, totalUnlocked);
    
    emit ProceedsClaimed(msg.sender, totalUnlocked, processed);
}
```

**Gas Optimization**: Bounded iteration prevents unbounded gas costs. Users with >50 locks must call multiple times.

---

### 1.4 Add New View Functions

```solidity
/**
 * @notice Get user's available and locked balances
 * @param user User address
 * @return available Total available balance (spendable)
 * @return locked Locked balance (subset of available, not withdrawable)
 */
function getBalances(address user) 
    external 
    view 
    returns (uint256 available, uint256 locked) 
{
    return (_availableBalance[user], _lockedBalance[user]);
}

/**
 * @notice Get user's lock queue
 * @param user User address
 * @return entries Array of lock entries
 */
function getLockQueue(address user) 
    external 
    view 
    returns (LockEntry[] memory entries) 
{
    return _lockQueue[user];
}

/**
 * @notice Calculate currently claimable amount
 * @param user User address
 * @return claimable Amount that can be claimed now
 * @return nextUnlock Timestamp of next unlock (0 if none)
 * @return nextAmount Amount of next unlock (0 if none)
 */
function getClaimableAmount(address user) 
    external 
    view 
    returns (
        uint256 claimable, 
        uint64 nextUnlock, 
        uint256 nextAmount
    ) 
{
    LockEntry[] memory queue = _lockQueue[user];
    uint64 earliestLocked = type(uint64).max;
    
    for (uint256 i = 0; i < queue.length; i++) {
        if (block.timestamp >= queue[i].expiry) {
            claimable += queue[i].amount;
        } else if (queue[i].expiry < earliestLocked) {
            earliestLocked = queue[i].expiry;
            nextAmount = queue[i].amount;
        }
    }
    
    nextUnlock = (earliestLocked == type(uint64).max) ? 0 : earliestLocked;
}
```

---

### 1.5 Update Interface

**File**: `packages/contracts-evm/contracts/interfaces/IAMMEngine.sol`

**Add to interface**:
```solidity
// Events
event BalanceUsed(address indexed user, uint256 amount, uint256 remaining);
event WalletPull(address indexed user, uint256 amount);

// Structs (make public)
struct LockEntry {
    uint256 amount;
    uint64 expiry;
    address market;
}

// New functions
function getBalances(address user) external view returns (uint256 available, uint256 locked);
function getLockQueue(address user) external view returns (LockEntry[] memory entries);
function getClaimableAmount(address user) external view returns (uint256 claimable, uint64 nextUnlock, uint256 nextAmount);

// Modified function signature
function claimUnlocked(uint256 maxClaims) external returns (uint256 totalUnlocked);
```

---

### 1.6 Migration Considerations

**Breaking Changes**:
1. ✅ `claimUnlocked()` signature changed (market parameter removed)
2. ✅ `Position.lockedProceeds` and `Position.lockExpiry` are now **deprecated** (but kept for backward compatibility)

**Backward Compatibility Strategy**:
- Keep old `Position` struct fields (don't remove)
- Add a one-time migration function to move old locks to new queue
- Frontend should check both old and new lock systems during transition

**Migration Function** (optional, for testnet only):
```solidity
function migrateOldLocks(address[] calldata markets) external {
    for (uint256 i = 0; i < markets.length; i++) {
        Position storage position = _positions[markets[i]][msg.sender];
        
        if (position.lockedProceeds > 0) {
            // Move to new system
            _availableBalance[msg.sender] += position.lockedProceeds;
            _lockedBalance[msg.sender] += position.lockedProceeds;
            
            _lockQueue[msg.sender].push(LockEntry({
                amount: position.lockedProceeds,
                expiry: position.lockExpiry,
                market: markets[i]
            }));
            
            // Clear old fields
            position.lockedProceeds = 0;
            position.lockExpiry = 0;
        }
    }
}
```

---

## Phase 2: Testing (1-2 days)

### 2.1 Unit Tests

**File**: `packages/contracts-evm/test/AMMEngine.t.sol`

**Test Cases**:
1. ✅ `test_SpendAvailableBalance_FullCoverage()` - Buy with sufficient available balance
2. ✅ `test_SpendAvailableBalance_PartialCoverage()` - Buy with partial available balance
3. ✅ `test_SpendAvailableBalance_NoCoverage()` - Buy with zero available balance
4. ✅ `test_LockQueue_SingleEntry()` - Sell creates lock entry
5. ✅ `test_LockQueue_MultipleEntries()` - Multiple sells create multiple entries
6. ✅ `test_ClaimUnlocked_SingleEntry()` - Claim single unlocked entry
7. ✅ `test_ClaimUnlocked_MultipleEntries()` - Claim multiple unlocked entries
8. ✅ `test_ClaimUnlocked_PartialUnlock()` - Some entries unlocked, some still locked
9. ✅ `test_ClaimUnlocked_BoundedIteration()` - Respects maxClaims limit
10. ✅ `test_CrossMarketSpendability()` - Sell in Market A, buy in Market B

### 2.2 Integration Tests

**File**: `packages/contracts-evm/test/integration/SpendableProceeds.t.sol`

**Scenarios**:
1. ✅ User sells in Market A → immediately buys in Market B (cross-market)
2. ✅ User sells → buys → sells → buys (rapid trading)
3. ✅ User accumulates 100 locks → claims in batches of 50
4. ✅ User has locked proceeds → tries to withdraw before expiry (should fail)
5. ✅ User has locked proceeds → waits 24h → claims successfully

### 2.3 Gas Benchmarks

**Metrics to Track**:
- Buy with available balance: ~X gas
- Buy with wallet pull: ~Y gas
- Sell (lock queue push): ~Z gas
- Claim 1 lock: ~A gas
- Claim 10 locks: ~B gas
- Claim 50 locks: ~C gas

**Target**: <300k gas for worst-case claim (50 locks)

---

## Phase 3: Frontend Integration (1-2 days)

### 3.1 Extract New ABIs

**Script**: `packages/contracts-evm/script/extract-abis.sh`

**New ABI exports**:
- `getBalances(address)`
- `getLockQueue(address)`
- `getClaimableAmount(address)`
- `claimUnlocked(uint256)`

### 3.2 Create New Hooks

**File**: `apps/web/src/hooks/v8/useAvailableBalance.ts`
```typescript
export function useAvailableBalance(user?: Address) {
  const { data, isLoading, error } = useReadContract({
    address: deployments.ammEngine,
    abi: AMM_ENGINE_ABI,
    functionName: 'getBalances',
    args: user ? [user] : undefined,
  });

  return {
    available: data?.[0] ?? 0n,
    locked: data?.[1] ?? 0n,
    withdrawable: (data?.[0] ?? 0n) - (data?.[1] ?? 0n),
    isLoading,
    error,
  };
}
```

**File**: `apps/web/src/hooks/v8/useLockQueue.ts`
```typescript
export function useLockQueue(user?: Address) {
  const { data, isLoading, error } = useReadContract({
    address: deployments.ammEngine,
    abi: AMM_ENGINE_ABI,
    functionName: 'getLockQueue',
    args: user ? [user] : undefined,
  });

  return {
    lockQueue: data ?? [],
    isLoading,
    error,
  };
}
```

**File**: `apps/web/src/hooks/v8/useClaimableAmount.ts`
```typescript
export function useClaimableAmount(user?: Address) {
  const { data, isLoading, error } = useReadContract({
    address: deployments.ammEngine,
    abi: AMM_ENGINE_ABI,
    functionName: 'getClaimableAmount',
    args: user ? [user] : undefined,
  });

  return {
    claimable: data?.[0] ?? 0n,
    nextUnlock: data?.[1] ?? 0n,
    nextAmount: data?.[2] ?? 0n,
    isLoading,
    error,
  };
}
```

**File**: `apps/web/src/hooks/v8/useClaimUnlocked.ts`
```typescript
export function useClaimUnlocked() {
  const { writeContractAsync } = useWriteContract();

  const claim = async (maxClaims: number = 50) => {
    return writeContractAsync({
      address: deployments.ammEngine,
      abi: AMM_ENGINE_ABI,
      functionName: 'claimUnlocked',
      args: [BigInt(maxClaims)],
    });
  };

  return { claim };
}
```

### 3.3 Create UI Components

**File**: `apps/web/src/components/features/v8/BalanceCard.tsx`
```tsx
export function BalanceCard() {
  const { address } = useAccount();
  const { available, locked, withdrawable } = useAvailableBalance(address);
  const { claimable, nextUnlock } = useClaimableAmount(address);
  const { claim } = useClaimUnlocked();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Balance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Available (Spendable):</span>
            <span className="font-mono">{formatUSDC(available)}</span>
          </div>
          <div className="flex justify-between text-amber-600">
            <span>Locked (24h):</span>
            <span className="font-mono">{formatUSDC(locked)}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>Withdrawable:</span>
            <span className="font-mono">{formatUSDC(withdrawable)}</span>
          </div>
        </div>

        {claimable > 0n && (
          <Button 
            onClick={() => claim()} 
            className="w-full mt-4"
          >
            Claim {formatUSDC(claimable)} Unlocked
          </Button>
        )}

        {nextUnlock > 0n && claimable === 0n && (
          <p className="text-sm text-muted-foreground mt-2">
            Next unlock in {formatTimeRemaining(nextUnlock)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**File**: `apps/web/src/components/features/v8/LockQueueTable.tsx`
```tsx
export function LockQueueTable() {
  const { address } = useAccount();
  const { lockQueue } = useLockQueue(address);

  if (lockQueue.length === 0) {
    return <p className="text-muted-foreground">No locked proceeds</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Market</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Unlocks</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lockQueue.map((entry, i) => (
          <TableRow key={i}>
            <TableCell>{truncateAddress(entry.market)}</TableCell>
            <TableCell className="font-mono">{formatUSDC(entry.amount)}</TableCell>
            <TableCell>{formatTimestamp(entry.expiry)}</TableCell>
            <TableCell>
              {Date.now() / 1000 >= entry.expiry ? (
                <Badge variant="success">Unlocked</Badge>
              ) : (
                <Badge variant="warning">Locked</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### 3.4 Update Existing Components

**File**: `apps/web/src/components/features/v8/AmmTradingPanel.tsx`

**Add balance usage indicator**:
```tsx
// Inside quote display
{quote && availableBalance >= quote.cost && (
  <div className="flex items-center gap-2 text-sm text-green-600">
    <CheckCircle className="w-4 h-4" />
    Using available balance (no wallet pull needed)
  </div>
)}
```

---

## Phase 4: Deployment (1 day)

### 4.1 Deploy to Base Sepolia

```bash
cd packages/contracts-evm

# Deploy new AMMEngine
forge script script/DeployV8.s.sol:DeployV8 \
  --rpc-url base-sepolia \
  --broadcast \
  --verify

# Verify deployment
./script/verify-deployment-v8.sh
```

### 4.2 Update LaunchpadEngine

**Option A**: Deploy new LaunchpadEngine pointing to new AMMEngine  
**Option B**: Keep existing LaunchpadEngine (it will automatically use new AMMEngine features)

**Recommendation**: Option B (no changes needed to LaunchpadEngine)

### 4.3 Update Frontend Config

```bash
# Extract new ABIs
cd packages/contracts-evm
./script/extract-abis.sh

# Update deployments.json
cd apps/web/src/config
# Manually update ammEngine address (or run sync script)

# Bump version
# "version": "8.1.0" (was "8.0.0")
```

### 4.4 User Testing Checklist

- [ ] User can sell AMM position
- [ ] Locked proceeds appear in "Available Balance"
- [ ] User can immediately buy in same market using locked proceeds
- [ ] User can buy in different market using locked proceeds (cross-market)
- [ ] User cannot withdraw locked proceeds before 24h
- [ ] After 24h, user can claim unlocked proceeds
- [ ] Lock queue displays correctly
- [ ] Balance card shows correct available/locked/withdrawable amounts

---

## Success Criteria

1. ✅ All tests passing (unit + integration)
2. ✅ Gas costs within target (<300k for worst-case claim)
3. ✅ Frontend displays balances correctly
4. ✅ Cross-market spendability works
5. ✅ 24h lock still enforced for withdrawals
6. ✅ No regressions in existing functionality

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Lock queue grows unbounded | High gas costs | Bounded iteration (maxClaims) |
| Reentrancy in claim function | Critical security | Use checks-effects-interactions pattern |
| Integer overflow in balance tracking | Critical security | Use Solidity 0.8+ (built-in overflow checks) |
| Frontend shows stale balances | Poor UX | Aggressive cache invalidation on trades |
| Users confused by new balance types | Poor UX | Clear UI labels + tooltips |

---

## Rollback Plan

If critical issues are discovered post-deployment:

1. **Pause new deposits** (if pause mechanism exists)
2. **Deploy hotfix** with reverted logic
3. **Migrate users** back to old system
4. **Refund gas costs** for failed transactions (if applicable)

**Prevention**: Comprehensive testing on testnet before mainnet deployment.

---

## Future Enhancements (Post-V8.1)

1. **Auto-claim on withdraw**: Automatically claim unlocked proceeds when user withdraws
2. **Batch claim optimization**: Use Merkle trees for efficient multi-claim
3. **Lock queue compression**: Merge adjacent locks with same expiry
4. **Cross-chain spendability**: Use locked proceeds across different chains (requires bridge)

---

**Status**: 📋 Ready for implementation  
**Next Step**: Begin Phase 1 (Contract Changes)
