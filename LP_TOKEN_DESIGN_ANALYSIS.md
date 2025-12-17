# LP Token Design Analysis - V6 Launchpad Markets

## Current Implementation (V6)

### Architecture
- **LaunchpadMarket inherits ERC20**: Market contract IS the LP token (no separate vault)
- **Market is its own vault**: Implements `ISoothLiquidityVault` directly
- **totalAssets()**: Returns `_asset.balanceOf(address(this))` (USDC balance in market)

### LP Token Minting

#### Pre-Graduation Phase
```solidity
// In executeAMMTrade() - lines 159-164
if (!isGraduated) {
    // Mint LP tokens to trader (proportional to fee paid)
    // Exchange rate: 1 fee = 1 LP token (1:1 initially)
    if (fee > 0) {
        _mint(trader, fee);  // 1:1 minting with fee
        emit LpTokensAccrued(trader, fee);
    }
}
```
- **Rate**: 1 fee = 1 LP token (1:1)
- **Fee**: 100% auto-compounds into `bBase` (liquidity growth)
- **LP Tokens**: Minted 1:1 with fees paid
- **Initial Mint**: Creator gets LP tokens equal to deposit amount (line 116)

#### Post-Graduation Phase
```solidity
// In executeAMMTrade() - lines 170-186
else {
    // 50% liquidity (b growth), 30% LP tokens (mint), 20% protocol
    uint256 deltaB = (fee * 1442695040888963407) / 1e18 / 2; // 50% to liquidity
    bBase += deltaB;
    
    // 30% to LP tokens (mint to trader)
    uint256 lpAmount = (fee * 3000) / 10000;
    if (lpAmount > 0) {
        _mint(trader, lpAmount);
        emit LpTokensAccrued(trader, lpAmount);
    }
    
    // 20% to protocol (stays in market, can be claimed by treasury)
}
```
- **Rate**: 30% of fee minted as LP tokens
- **Fee Split**: 50% to `bBase` growth, 30% to LP tokens, 20% to protocol
- **LP Tokens**: New tokens minted (dilutes existing holders)

### Exchange Rate Calculation
```solidity
// previewRedeemLP() - lines 477-481
function previewRedeemLP(uint256 amount) public view returns (uint256) {
    uint256 supply = totalSupply();
    if (supply == 0) return 0;
    return (amount * totalAssets()) / supply;
}
```
- **Formula**: `exchangeRate = totalAssets() / totalSupply()`
- **totalAssets()**: `_asset.balanceOf(address(this))` (actual USDC in market)
- **totalSupply()**: Total LP tokens minted

### Redemption
```solidity
// redeemLP() - lines 463-475
function redeemLP(uint256 amount) external {
    require(!isLive, "Market still active");  // Only after settlement/liquidation
    // ...
    uint256 assets = previewRedeemLP(amount);
    _burn(msg.sender, amount);
    _asset.safeTransfer(msg.sender, assets);
}
```
- **Timing**: Only redeemable when market is NOT live (settled or liquidated)
- **Mechanism**: Burns LP tokens, transfers proportional USDC

## Issues & Discrepancies

### 1. Post-Graduation Fee Accrual Mismatch

**Documentation (LAUNCHPAD_ECONOMICS_V2.md) says:**
- Post-graduation: 30% of fees should accrue to vault assets WITHOUT minting new tokens
- This increases exchange rate for existing LP holders (ERC4626-style)

**Actual Implementation:**
- Post-graduation: 30% of fees MINT new LP tokens
- This dilutes existing holders instead of benefiting them
- Exchange rate may decrease or stay flat (depends on if assets grow faster than supply)

### 2. totalAssets() May Not Accurately Reflect LP Value

**Current Implementation:**
- `totalAssets() = _asset.balanceOf(address(this))`
- This includes:
  - Creator deposit
  - Trading proceeds from buys
  - Potentially locked proceeds
  - Protocol fees (20%)

**Problem:**
- Not all assets in market are "LP assets"
- Some assets are locked proceeds (should be separate)
- Some assets are protocol fees (shouldn't accrue to LP holders)
- Some assets are trading proceeds (temporary, will be paid out)

### 3. Exchange Rate May Decrease

**Scenario:**
```
Initial: totalAssets = $1,000, totalSupply = 1,000 LP tokens
Exchange Rate = $1.00 per LP token

Post-graduation trade with $100 fee:
  - 30% ($30) minted as new LP tokens
  - totalAssets increases by fee amount ($100), but...
  - totalSupply increases by $30
  
New: totalAssets = $1,100, totalSupply = 1,030 LP tokens
Exchange Rate = $1.068 per LP token

BUT: If $70 of that fee went to bBase growth (not assets), 
     then totalAssets = $1,030, totalSupply = 1,030
     Exchange Rate = $1.00 per LP token (no gain!)
```

### 4. Protocol Fee Not Handled

**Current:**
- Comment says "20% to protocol (stays in market)"
- But this 20% increases `totalAssets()` without minting LP tokens
- This SHOULD increase exchange rate, but it's unclear if it's properly separated

## Recommended Design (Based on Documentation)

### ERC4626-Style Approach

**Pre-Graduation:**
- ✅ Mint LP tokens 1:1 with fees (current implementation is correct)

**Post-Graduation:**
- ❌ DON'T mint new LP tokens from fees
- ✅ Accrue 30% of fees to `totalAssets` WITHOUT minting
- ✅ This increases exchange rate for existing holders

**Implementation:**
```solidity
// Post-graduation fee handling
uint256 deltaB = (fee * 1442695040888963407) / 1e18 / 2; // 50% to liquidity
bBase += deltaB;

// 30% to LP vault (increase totalAssets, NO minting)
uint256 lpAccrual = (fee * 3000) / 10000;
// Funds stay in market (already there), just track separately
// OR transfer to a separate LP reserve

// 20% to protocol (track separately, don't include in LP exchange rate)
```

### Separation of Concerns

**totalAssets() for LP calculation should only include:**
- Initial creator deposit
- LP fee accruals (30% of post-graduation fees)
- NOT: Locked proceeds
- NOT: Protocol fees
- NOT: Temporary trading balances

## Questions to Resolve

1. **Should post-graduation fees mint new LP tokens or accrue to existing?**
   - Documentation says accrue (ERC4626-style)
   - Implementation mints new tokens

2. **How should totalAssets() be calculated?**
   - Current: All USDC in market
   - Should it exclude locked proceeds? Protocol fees? Trading balances?

3. **When should LP tokens be redeemable?**
   - Current: Only after settlement/liquidation (`!isLive`)
   - Should they be tradeable ERC20 before settlement? (Documentation suggests yes)

4. **How should the 20% protocol fee be handled?**
   - Currently stays in market (increases totalAssets)
   - Should it be separate from LP calculation?
