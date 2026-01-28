# Additional Issues Found

## Issue: LP Yield Not Claimed on Redemption

**Date**: 2026-01-27  
**Severity**: CRITICAL  
**Reporter**: User

### Description
After redeeming LP tokens on a finalized market, the LP yield pool balance is not claimed. User is left with:
- 0 LP tokens
- $82 in LP Yield Pool (unclaimed)
- User's share shows $0 (0.0%)

### Evidence (Screenshot)
- LP Leaderboard shows:
  - User: 0 LP • 0%
  - LP Yield Pool: $82
  - Your share (0.0%): $0
  - Floor: $0 (0.000x)
  - Ceiling: $0 (0.000x)

### Expected Behavior
When user redeems LP tokens, the redemption should:
1. Burn LP tokens
2. **Claim LP yield share** (proportional to LP tokens being redeemed)
3. Return principal + yield to user

### Current Behavior
LP redemption only:
1. Burns LP tokens
2. Returns principal
3. **DOES NOT claim yield** - yield remains in pool but user has 0% share

### Root Cause Analysis

**Contract Level**:
- Need to check `LaunchpadEngine.redeemLP()` function
- Does it automatically claim yield?
- Or is there a separate `claimYield()` function needed?

**Frontend Level**:
- Portfolio.tsx LP redemption handler (lines 185-193)
- Trade.tsx LP redemption section
- Pro.tsx LP redemption (if exists)
- Do any of these call yield claim before/after LP redemption?

### Impact
- **User Impact**: HIGH - Users lose their yield earnings
- **Financial Impact**: Users can't access their earned yield
- **UX Impact**: Confusing - shows $82 yield but user can't claim it

### Fix Required

**Option A: Contract handles it** (Preferred)
- `LaunchpadEngine.redeemLP()` should automatically claim yield
- Frontend just calls `redeemLP(market, amount)`
- No frontend changes needed

**Option B: Frontend must claim separately**
- Before calling `redeemLP()`, call `claimYield(market)`
- Or after calling `redeemLP()`, call `claimYield(market)`
- Requires frontend changes to all redemption handlers

**Option C: Separate claim button**
- Add "Claim Yield" button to LP Leaderboard
- User must manually claim yield before/after redemption
- Not ideal UX but works

### Files to Check

**Contracts**:
- `packages/contracts-core/src/LaunchpadEngine.sol` - `redeemLP()` function
- Check if there's a `claimYield()` or `claimLPYield()` function

**Frontend**:
- `apps/web/src/pages/Portfolio.tsx` - LP redemption handler
- `apps/web/src/pages/Trade.tsx` - LP redemption section
- `apps/web/src/pages/Pro.tsx` - LP redemption (if exists)
- `apps/web/src/components/features/LPHolders.tsx` - LP Leaderboard display

### Recommended Fix

1. **Check contract**: Does `redeemLP()` claim yield automatically?
2. **If YES**: No frontend changes needed, just verify it works
3. **If NO**: 
   - Add yield claim call before LP redemption in all handlers
   - Or add separate "Claim Yield" button
   - Update all redemption handlers (Portfolio, Trade, Pro)

### Priority
**CRITICAL** - Must fix before users redeem more LP tokens and lose yield

### Related Issues
- This may affect all LP redemptions, not just finalized markets
- Need to check if graduated markets have same issue
