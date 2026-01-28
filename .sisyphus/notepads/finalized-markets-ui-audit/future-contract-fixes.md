# Future Contract-Level Fixes

## 1. LP Yield Not Claimed on Redemption

**Priority**: CRITICAL  
**Type**: Contract Bug  
**Status**: Deferred to future contract upgrade  
**Reported**: 2026-01-27

### Issue
`LaunchpadEngine.redeemLP()` does NOT claim LP yield when redeeming LP tokens.

### Evidence
- User redeemed all LP tokens
- LP Yield Pool still shows $82
- User's share shows $0 (0.0%)
- Yield is lost/inaccessible

### Contract Analysis
File: `packages/contracts-core/src/LaunchpadEngine.sol`  
Function: `redeemLP()` (lines 537-557)

```solidity
function redeemLP(
    address market,
    uint256 lpAmount
) external override nonReentrant returns (uint256 usdcAmount) {
    MarketState storage state = markets[market];
    LaunchpadLPToken lpToken = LaunchpadLPToken(state.lpToken);

    require(lpToken.balanceOf(msg.sender) >= lpAmount, "LaunchpadEngine: insufficient LP");

    uint256 floorValue = _calculateFloor(market);
    usdcAmount = (floorValue * lpAmount) / state.totalLPSupply;

    lpToken.burn(msg.sender, lpAmount);
    state.totalLPSupply -= lpAmount;

    emit LPBalanceUpdated(market, msg.sender, -int256(lpAmount), lpToken.balanceOf(msg.sender), state.totalLPSupply);

    usdc.safeTransfer(msg.sender, usdcAmount);

    emit LPRedeemed(msg.sender, market, lpAmount, usdcAmount);
}
```

**Problem**: 
- Line 546: `floorValue` calculation includes `state.lpYieldPool` in total cash
- Line 547: User gets proportional share of floor value
- **BUT**: `state.lpYieldPool` is NOT transferred to user
- **RESULT**: Yield remains in pool, user loses their share

### Root Cause
The `_calculateFloor()` function (line 559-571) includes `lpYieldPool` in `totalCash`:

```solidity
function _calculateFloor(address market) internal view returns (uint256) {
    MarketState memory state = markets[market];
    (uint256 qYes, uint256 qNo, ) = ammEngine.getMarketState(market);
    uint256 totalCash = state.creatorDeposit + state.feesAccrued + state.lpYieldPool;  // ← Includes yield
    uint256 maxLiability = qYes > qNo ? qYes : qNo;
    uint256 maxLiabilityInUsdc = _wadToUsdc(maxLiability);

    if (totalCash > maxLiabilityInUsdc) {
        return totalCash - maxLiabilityInUsdc;
    } else {
        return 0;
    }
}
```

This is **incorrect accounting** - the yield pool should be distributed separately, not included in floor calculation.

### Proposed Contract Fix

**Option A: Include yield in redemption** (Recommended)
```solidity
function redeemLP(
    address market,
    uint256 lpAmount
) external override nonReentrant returns (uint256 usdcAmount) {
    MarketState storage state = markets[market];
    LaunchpadLPToken lpToken = LaunchpadLPToken(state.lpToken);

    require(lpToken.balanceOf(msg.sender) >= lpAmount, "LaunchpadEngine: insufficient LP");

    // Calculate floor value (principal)
    uint256 floorValue = _calculateFloor(market);
    uint256 principalAmount = (floorValue * lpAmount) / state.totalLPSupply;
    
    // Calculate yield share
    uint256 yieldShare = (state.lpYieldPool * lpAmount) / state.totalLPSupply;
    
    // Total redemption = principal + yield
    usdcAmount = principalAmount + yieldShare;

    // Update state
    lpToken.burn(msg.sender, lpAmount);
    state.totalLPSupply -= lpAmount;
    state.lpYieldPool -= yieldShare;  // ← Deduct claimed yield

    emit LPBalanceUpdated(market, msg.sender, -int256(lpAmount), lpToken.balanceOf(msg.sender), state.totalLPSupply);

    usdc.safeTransfer(msg.sender, usdcAmount);

    emit LPRedeemed(msg.sender, market, lpAmount, usdcAmount);
}
```

**Option B: Separate claim function**
```solidity
function claimLPYield(address market) external nonReentrant returns (uint256 yieldAmount) {
    MarketState storage state = markets[market];
    LaunchpadLPToken lpToken = LaunchpadLPToken(state.lpToken);
    
    uint256 lpBalance = lpToken.balanceOf(msg.sender);
    require(lpBalance > 0, "LaunchpadEngine: no LP balance");
    
    yieldAmount = (state.lpYieldPool * lpBalance) / state.totalLPSupply;
    state.lpYieldPool -= yieldAmount;
    
    usdc.safeTransfer(msg.sender, yieldAmount);
    
    emit LPYieldClaimed(msg.sender, market, yieldAmount);
}
```

### Impact
- **User Impact**: HIGH - Users lose yield earnings on every LP redemption
- **Financial Impact**: Cumulative loss across all LP redemptions
- **Severity**: CRITICAL - Money is lost

### Workaround (Frontend)
**NONE** - This requires a contract fix. Frontend cannot claim yield that contract doesn't distribute.

### Recommendation
1. Deploy fixed contract in next version (V11.1 or V12)
2. Add `claimLPYield()` function for existing markets
3. Update frontend to call `claimLPYield()` before `redeemLP()`
4. Add warning in UI: "Claim yield before redeeming LP tokens"

### Testing Required
- Unit test: Verify yield is claimed on redemption
- Integration test: Full LP lifecycle with yield accrual
- Invariant test: `lpYieldPool` should decrease when LP redeemed
- Fork test: Verify on live network

### Related Files
- Contract: `packages/contracts-core/src/LaunchpadEngine.sol`
- Interface: `packages/contracts-core/src/interfaces/ILaunchpadEngine.sol`
- Tests: `packages/contracts-testing/test/unit/LaunchpadEngine.t.sol`

---

**Status**: Documented for future contract upgrade  
**Next Steps**: Fix other UI issues, revisit this in V11.1/V12
