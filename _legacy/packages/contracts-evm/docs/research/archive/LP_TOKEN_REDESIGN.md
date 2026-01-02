# LP Token System Redesign - V6 Launchpad Markets

**Date:** 2025-12-17  
**Status:** Design & Implementation Plan  
**Related:** `LP_TOKEN_DESIGN_ANALYSIS.md`, `CREATOR_VAULT_LIFECYCLE_FLOW.md`, `LAUNCHPAD_ECONOMICS_V2.md`

---

## Executive Summary

This document outlines the redesign of the LP token system in V6 Launchpad markets to align with documented ERC4626-style economics, fix accounting issues, and add creator liquidity enhancement capabilities.

**Key Issues Identified:**
1. Post-graduation LP minting dilutes existing holders (should accrue instead)
2. `totalAssets()` includes non-LP funds (locked proceeds, protocol fees, liquidity exposure, trading balances)
3. Expiry refund gives everything to creator (should be pro-rata)
4. Protocol fees inflate exchange rate (should be tracked separately)

---

## Current Implementation Analysis

### Architecture

- **LaunchpadMarket inherits ERC20**: Market contract IS the LP token (no separate vault)
- **Market is its own vault**: Implements `ISoothLiquidityVault` directly
- **All funds co-mingled**: Single USDC balance: `_asset.balanceOf(address(this))`

### Pre-Graduation LP Token Minting

```solidity
// In executeAMMTrade() - pre-graduation branch
if (fee > 0) {
    _mint(trader, fee);  // 1:1 minting with fee
}
```

- **Rate**: 1 fee = 1 LP token (1:1)
- **Fee**: 100% auto-compounds into `bBase` (liquidity growth)
- **Exchange Rate**: Maintains 1.0 during pre-graduation
- **Distribution**: LP tokens minted to the trader who paid the fee

### Post-Graduation LP Token Minting (Current - Problematic)

```solidity
// In executeAMMTrade() - post-graduation branch
uint256 lpAmount = (fee * 3000) / 10000;  // 30% of fee
if (lpAmount > 0) {
    _mint(trader, lpAmount);  // NEW tokens minted - dilutes existing holders
}
```

- **Rate**: 30% of fee minted as LP tokens
- **Fee Split**: 50% to `bBase` growth, 30% to LP tokens, 20% to protocol
- **Problem**: New tokens dilute existing holders instead of benefiting them

### Exchange Rate Calculation (Current)

```solidity
function previewRedeemLP(uint256 amount) public view returns (uint256) {
    uint256 supply = totalSupply();
    if (supply == 0) return 0;
    return (amount * totalAssets()) / supply;
}
```

- **Formula**: `exchangeRate = totalAssets() / totalSupply()`
- **totalAssets()**: Currently `_asset.balanceOf(address(this))` (everything)
- **Problem**: Includes locked proceeds, protocol fees, liquidity exposure, trading balances

---

## Issues & Discrepancies

### Issue 1: Post-Graduation Fee Accrual Mismatch

**Documentation (LAUNCHPAD_ECONOMICS_V2.md) says:**
- Post-graduation: 30% of fees should accrue to vault assets WITHOUT minting new tokens
- This increases exchange rate for existing LP holders (ERC4626-style)

**Actual Implementation:**
- Post-graduation: 30% of fees MINT new LP tokens
- This dilutes existing holders instead of benefiting them

**Mathematical Impact:**
```
Trade with $100 fee:
  Current: totalAssets += $100, totalSupply += $30
           exchangeRate = $1,100 / 1,030 = 1.068 (with dilution)
  
  Recommended: totalAssets += $30, totalSupply unchanged
               exchangeRate = $1,030 / 1,000 = 1.03 (better for existing holders)
```

### Issue 2: totalAssets() Includes Non-LP Funds

**Current Implementation:**
- `totalAssets() = _asset.balanceOf(address(this))`
- Includes:
  - ✅ Creator deposit (should be included)
  - ✅ Trading fees (should be included, but need separation)
  - ❌ Locked proceeds (user funds, NOT LP pool)
  - ❌ Protocol fees (20%, treasury's share, NOT LP pool)
  - ❌ Liquidity exposure (50% of post-grad fees, NOT LP pool)
  - ❌ Temporary trading balances (AMM proceeds, NOT LP pool)

**Problem:** Not all assets in market are "LP assets"

### Issue 3: Expiry Refund Gives Everything to Creator

**Current Implementation:**
```solidity
function claimCreatorRefund() external {
    require(!isLive && !isGraduated, "Not expired/failed");
    require(msg.sender == creator, "Not creator");
    
    uint256 totalRefund = totalAssets();  // Gets ALL funds!
    _asset.safeTransfer(creator, totalRefund);
}
```

**Problem:** If traders have LP tokens, they should get their proportional share.

**Expected:** Pro-rata refund based on LP token ownership (like `claimLiquidationRefund()`)

### Issue 4: Protocol Fee Inflates Exchange Rate

**Current:** Protocol fee (20%) stays in market, included in `totalAssets()`, inflating LP exchange rate

**Solution:** Track separately, exclude from LP calculations, enable treasury claims

---

## Recommended Design

### Exchange Rate Formula (Standard ERC4626-style)

```
exchangeRate = totalAssets() / totalSupply()
```

- `totalSupply()` = ERC20 LP token supply (from `ERC20.totalSupply()`)
- **Only ONE totalSupply** - the LP token supply
- For any LP holder with `lpTokens` amount:
  - `value = lpTokens × exchangeRate = lpTokens × (totalAssets() / totalSupply())`
  - `assets_redeemable = (lpTokens × totalAssets()) / totalSupply()`

### Pre-Graduation (Keep Current - Correct)

- ✅ Mint LP tokens 1:1 with fees
- ✅ All fees go to LP pool
- ✅ Exchange rate = 1.0

### Post-Graduation (ERC4626-Style Accrual)

**DON'T mint new LP tokens from fees**

**DO accrue 30% of fees to existing holders:**
```solidity
// Post-graduation fee handling
uint256 deltaB = (fee * 1442695040888963407) / 1e18 / 2; // 50% to liquidity
bBase += deltaB;

// 30% to LP vault (increase totalAssets, NO minting)
uint256 lpAccrual = (fee * 3000) / 10000;
lpAccrued += lpAccrual;  // Track separately, increases totalAssets()

// 20% to protocol (track separately, don't include in LP exchange rate)
protocolFeesAccrued += (fee * 2000) / 10000;
```

### totalAssets() Calculation (Separate Accounting)

**What to INCLUDE:**
- Creator deposit
- Pre-graduation fees (100% to LP pool)
- Post-graduation LP accruals (30% of fees)

**What to EXCLUDE:**
- Locked proceeds (user funds awaiting unlock)
- Protocol fees (20%, treasury's share)
- Liquidity exposure funds (50% of post-grad fees that grow bBase - NOT LP pool)
- AMM trader proceeds (temporary trading balances)

**Implementation:**
```solidity
function totalAssets() public view override returns (uint256) {
    // LP Pool only:
    uint256 base = totalCreatorDeposit + feesAccrued; // Pre-grad: deposit + fees
    uint256 lp = lpAccrued; // Post-grad: only 30% accrues to LP
    
    // Explicitly EXCLUDE:
    // - totalLockedProceeds (user funds)
    // - protocolFeesAccrued (treasury, 20%)
    // - Liquidity exposure (50% of post-grad fees - NOT LP pool)
    // - AMM trader proceeds (temporary trading balances)
    
    return base + lp;
}
```

---

## LP Token Value vs MaxLoss Capacity Relationship

**Important Clarification:** These are **different concepts**

### LP Token Value
- `LP_token_value = LP_tokens × (totalAssets() / totalSupply())`
- Represents what LP holders can redeem from the LP pool
- Based on `totalAssets()` (LP pool only)

### MaxLoss Capacity
- `maxLossCapacity = deposit + internalFees + 0.5 × externalFees`
- Maximum liquidity exposure (affects `bBase` calculation)
- Used for `bBase = maxLossCapacity / ln(2)`

### Relationship

**Pre-graduation:**
- `totalAssets() = deposit + feesAccrued = maxLossCapacity` (they're equal)

**Post-graduation:**
- `totalAssets() = deposit + feesAccrued + lpAccrued` (LP pool, only 30% of post-grad fees)
- `maxLossCapacity = deposit + feesAccrued + (50% of post-grad fees)` (includes liquidity exposure)
- **They diverge** - LP pool is smaller because only 30% accrues to LP holders

**Key Points:**
- The 50% liquidity exposure increases `bBase` (better trading experience) but doesn't accrue to LP holders
- LP holders can only redeem from `totalAssets()` (LP pool), not from maxLoss capacity
- The 50% liquidity exposure and 20% protocol fees stay in market but don't accrue to LP holders

---

## Implementation Changes

### 1. Post-Graduation Fee Accrual (ERC4626-Style)

**Add state variable:**
```solidity
uint256 public lpAccrued;  // Post-graduation LP fee accruals
```

**Modify executeAMMTrade() post-graduation branch:**
- Remove: `_mint(trader, lpAmount)`
- Add: `lpAccrued += (fee * 3000) / 10000;`
- Emit: `LpTokensAccrued(address(0), lpAmount)` (address(0) indicates accrual, not mint)

### 2. Separate Asset Accounting

**Add state variable:**
```solidity
uint256 public protocolFeesAccrued;
```

**Update totalAssets():**
```solidity
function totalAssets() public view override returns (uint256) {
    uint256 base = totalCreatorDeposit + feesAccrued; // Pre-grad: deposit + fees
    uint256 lp = lpAccrued; // Post-grad: only 30% accrues to LP
    return base + lp;  // Explicitly excludes: locked proceeds, protocol fees, liquidity exposure, trading balances
}
```

**Invariant check:**
```solidity
require(
    totalAssets() + totalLockedProceeds + protocolFeesAccrued + liquidityExposureFunds <= _asset.balanceOf(address(this)),
    "Balance accounting mismatch"
);
```

### 3. Protocol Fee Tracking & Claims

**In post-graduation fee handling:**
```solidity
protocolFeesAccrued += (fee * 2000) / 10000;
```

**Add claim function:**
```solidity
function claimProtocolFees() external {
    require(msg.sender == protocolTreasury || msg.sender == factory, "Unauthorized");
    uint256 amount = protocolFeesAccrued;
    require(amount > 0, "No fees");
    protocolFeesAccrued = 0;
    _asset.safeTransfer(protocolTreasury, amount);
    emit ProtocolFeesClaimed(amount);
}
```

### 4. Fix Expiry Refund (Pro-Rata Distribution)

**Replace claimCreatorRefund() with:**
```solidity
function claimExpiryRefund(address user) external {
    require(!isLive && !isGraduated, "Not expired");
    require(user == msg.sender || msg.sender == traderVault, "Unauthorized");
    
    uint256 userLP = balanceOf(user);
    uint256 totalLP = totalSupply();
    require(totalLP > 0, "No LP tokens");
    
    uint256 userShare = (totalAssets() * userLP) / totalLP;
    require(userShare > 0, "No refund");
    
    _burn(user, userLP);
    _asset.safeTransfer(user, userShare);
    emit ExpiryRefundClaimed(user, userShare);
}
```

### 5. Creator Post-Graduation Liquidity Enhancement

**New Feature:** Allow creators to increase maxLoss capacity post-graduation

**Implementation:**
```solidity
function increaseMaxLossCapacity(uint256 additionalDeposit) external {
    require(isGraduated, "Must be graduated");
    require(msg.sender == creator, "Only creator");
    require(additionalDeposit > 0, "Zero deposit");
    
    // Transfer USDC from creator
    _asset.safeTransferFrom(msg.sender, address(this), additionalDeposit);
    
    // Update tracking
    totalCreatorDeposit += additionalDeposit;
    
    // Increase liquidity depth (bBase)
    // b = deposit / 0.693, so deltaB = additionalDeposit / 0.693
    uint256 deltaB = (additionalDeposit * 1e18) / 693147180559945309; // 1 / ln(2) in WAD
    bBase += deltaB;
    
    // NO LP tokens minted - exchange rate increases for existing holders
    // totalAssets increases by additionalDeposit, totalSupply unchanged
    
    emit MaxLossCapacityIncreased(creator, additionalDeposit, bBase);
}
```

**Benefits:**
- Allows creators to enhance liquidity after seeing market traction
- Benefits existing LP holders (exchange rate increases without dilution)
- Benefits traders (deeper liquidity, lower slippage)
- Optional - creators only add capital if they see value

---

## Accounting Structure Summary

### LP Pool (totalAssets)

**What LP holders own:**
- Creator deposit
- Pre-graduation fees (100%)
- Post-graduation LP accruals (30% of fees)

**Formula:**
```
totalAssets() = totalCreatorDeposit + feesAccrued + lpAccrued
```

### MaxLoss Capacity (Liquidity Exposure)

**Total liquidity backing:**
- Creator deposit
- Pre-graduation fees (100%)
- Post-graduation liquidity exposure (50% of fees)

**Formula:**
```
maxLossCapacity = totalCreatorDeposit + feesAccrued + (50% of post-grad fees)
bBase = maxLossCapacity / ln(2)
```

### Physical Balance Breakdown

**Market's USDC balance contains:**
```
_asset.balanceOf(address(this)) = 
  totalAssets()                    // LP pool
  + totalLockedProceeds           // User funds awaiting unlock
  + protocolFeesAccrued           // Treasury's share (20%)
  + liquidityExposureFunds        // For bBase growth (50% of post-grad fees)
  + tradingBalances              // Temporary AMM proceeds
```

### Exchange Rate

```
exchangeRate = totalAssets() / totalSupply()
LP_token_value = LP_tokens × exchangeRate
```

**There is only ONE totalSupply** - the ERC20 LP token supply.

**Pre-graduation:**
- `totalSupply()` increases 1:1 with fees
- `exchangeRate = 1.0`

**Post-graduation:**
- `totalSupply()` stays fixed (no new minting)
- `totalAssets()` increases via accrual
- `exchangeRate` increases (existing holders benefit)

---

## Settlement Scenarios & LP Redemption

The redesign must properly handle all settlement scenarios where LP holders redeem their tokens. Settlement occurs when:
1. **Early Settlement** - Market resolves before graduation (`wasGraduated = false`)
2. **Normal Settlement** - Market resolves after graduation (`wasGraduated = true`)
3. **Expiry** - Market fails to graduate in time
4. **Liquidation** - Guardian liquidates expired market

### Settlement Flow Overview

```
Market Settles (isLive = false)
  ↓
1. Traders redeem winning shares (via TraderVault.redeem())
   - Each winning share = 1 USDC
   - Funds leave market's liquidity pool
   - This reduces available funds for LP redemption
  ↓
2. Calculate remaining LP pool value
   - Remaining = totalAssets() - (already claimed by traders)
   - But wait: trader claims come from liquidity pool, not LP pool!
  ↓
3. LP holders redeem via redeemLP()
   - Pro-rata based on LP token ownership
   - Exchange rate = totalAssets() / totalSupply()
  ↓
4. Protocol fees claimed separately (if graduated)
   - Only if wasGraduated = true
   - Treasury claims protocolFeesAccrued
```

### Key Insight: Trader Claims vs LP Pool

**Important:** Trader claims are paid from the **liquidity pool** (maxLoss capacity), not from `totalAssets()` (LP pool).

- **MaxLoss Capacity** = total liquidity exposure (used for trader payouts)
- **LP Pool (totalAssets)** = What LP holders own (smaller, excludes liquidity exposure)

After traders claim:
- The liquidity pool is reduced by trader payouts
- But LP pool (`totalAssets()`) doesn't automatically reflect this reduction
- We need to ensure `redeemLP()` uses the correct remaining value

### Scenario 1: Early Settlement (Not Graduated)

**State:**
- `wasGraduated = false`
- `isLive = false`
- `totalAssets() = deposit + feesAccrued` (LP pool)
- `totalSupply() = deposit + feesAccrued` (LP tokens, 1:1 minted)
- `protocolFeesAccrued = 0` (no post-grad fees)
- `lpAccrued = 0` (no post-grad accruals)

**Trader Claims:**
- Traders redeem winning shares via TraderVault
- Claims paid from liquidity pool (maxLoss capacity)
- After claims: liquidity pool reduced

**LP Redemption:**
```solidity
// LP holders can redeem via redeemLP()
// Uses: totalAssets() / totalSupply()
// Since totalAssets() represents LP pool, this works correctly
// Protocol gets 0% (not graduated)
```

**Example:**
```
Initial: deposit = $693, feesAccrued = $500
totalAssets() = $1,193
totalSupply() = $1,193 LP tokens

Traders claim: $800 (from liquidity pool)
Remaining liquidity: $393

LP redemption:
  Creator (693 LP): 693/1193 × $1,193 = $693
  Traders (500 LP): 500/1193 × $1,193 = $500
  Total: $1,193 ✓
```

**Note:** In early settlement, the liquidity pool and LP pool are the same (no post-grad divergence), so `redeemLP()` works correctly.

### Scenario 2: Normal Settlement (Graduated)

**State:**
- `wasGraduated = true`
- `isLive = false`
- `totalAssets() = deposit + feesAccrued + lpAccrued` (LP pool only)
- `totalSupply() = deposit + feesAccrued` (fixed after graduation, no new minting)
- `protocolFeesAccrued > 0` (20% of post-grad fees)
- `lpAccrued > 0` (30% of post-grad fees)
- `maxLossCapacity > totalAssets()` (includes 50% liquidity exposure)

**Trader Claims:**
- Traders redeem winning shares via TraderVault
- Claims paid from liquidity pool (maxLoss capacity)
- Liquidity exposure funds (50% of post-grad fees) used for claims
- LP pool (`totalAssets()`) remains intact

**LP Redemption:**
```solidity
// LP holders redeem via redeemLP()
// Uses: totalAssets() / totalSupply()
// totalAssets() = deposit + feesAccrued + lpAccrued (LP pool)
// totalSupply() = deposit + feesAccrued (fixed)

// Exchange rate > 1.0 because lpAccrued increases totalAssets without minting
exchangeRate = totalAssets() / totalSupply()
LP_value = LP_tokens × exchangeRate
```

**Protocol Fee Claim:**
```solidity
// Treasury claims protocol fees separately (if any remaining)
// These are excluded from totalAssets() already
claimProtocolFees() // Claims protocolFeesAccrued
```

**Example:**
```
At graduation:
  deposit = $693, feesAccrued = $2,000
  totalAssets() = $2,693
  totalSupply() = $2,693 LP tokens

Post-graduation: $10,000 fees collected
  lpAccrued = $3,000 (30%)
  protocolFeesAccrued = $2,000 (20%)
  liquidity exposure = $5,000 (50%, not in totalAssets)
  
  totalAssets() = $2,693 + $3,000 = $5,693
  totalSupply() = $2,693 (unchanged)
  exchangeRate = $5,693 / $2,693 = 2.115

Settlement:
  Traders claim: $5,000 (from liquidity pool, including liquidity exposure)
  Liquidity pool reduced by $5,000
  
  LP redemption:
    Creator (693 LP): 693 × 2.115 = $1,465
    Traders (2000 LP): 2000 × 2.115 = $4,230
    Total: $5,695 ✓ (slight rounding)
    
  Protocol claims: $2,000 separately
```

### Scenario 3: Expiry (No Graduation)

**State:**
- `isGraduated = false`
- `isLive = false` (expired)
- Same as Scenario 1 (early settlement)

**Refund Logic:**
- Use `claimExpiryRefund()` (pro-rata, not `claimCreatorRefund()`)
- All LP holders can claim their proportional share
- Protocol gets 0%

**Implementation:** Already fixed in redesign (Section 4)

### Scenario 4: Liquidation

**State:**
- `isLiquidated = true`
- `isGraduated = false`
- Guardian liquidated expired market

**Current Implementation:**
- `claimLiquidationRefund()` already uses pro-rata logic ✓
- Uses `totalAssets() / totalSupply()` correctly

**No changes needed** - liquidation refund is already correct

### RedeemLP() Function Behavior

**Current Implementation:**
```solidity
function redeemLP(uint256 amount) external {
    require(!isLive, "Market still active");
    require(amount > 0, "Zero amount");
    require(balanceOf(msg.sender) >= amount, "Insufficient balance");
    
    uint256 assets = previewRedeemLP(amount);
    require(assets > 0, "Zero assets");
    
    _burn(msg.sender, amount);
    _asset.safeTransfer(msg.sender, assets);
    
    emit LpTokensRedeemed(msg.sender, amount, assets);
}

function previewRedeemLP(uint256 amount) public view returns (uint256) {
    uint256 supply = totalSupply();
    if (supply == 0) return 0;
    return (amount * totalAssets()) / supply;
}
```

**After Redesign:**
- `totalAssets()` correctly represents LP pool only
- `previewRedeemLP()` works correctly for all scenarios
- No changes needed to `redeemLP()` logic
- **However:** Need to ensure `totalAssets()` doesn't include trader claims that already left

**Potential Issue:** If `totalAssets()` includes funds that traders already claimed, LP holders might over-redeem.

**Resolution:** Trader claims are paid from liquidity pool (via TraderVault), and the liquidity pool funds are separate from LP pool funds. Since we exclude liquidity exposure (50% of post-grad fees) from `totalAssets()`, and trader claims come from liquidity exposure + pre-grad pool, the LP pool remains accurate.

**Verification:**
- Pre-grad: LP pool = liquidity pool (same thing)
- Post-grad: LP pool = totalAssets(), liquidity pool = maxLoss capacity (larger)
- Trader claims come from liquidity pool
- LP redemption comes from LP pool
- They're separate, so no double-spending

### Settlement Accounting Summary

| Scenario | LP Pool Source | Protocol Fee | Trader Claims Source |
|----------|----------------|--------------|---------------------|
| Early Settlement | deposit + feesAccrued | 0% | Liquidity pool (same as LP pool) |
| Normal Settlement | deposit + feesAccrued + lpAccrued | 20% of profit | Liquidity pool (maxLoss, includes 50% liquidity exposure) |
| Expiry | deposit + feesAccrued | 0% | N/A (no traders to claim) |
| Liquidation | deposit + feesAccrued | 0% (liquidation fee to protocol) | N/A |

**Key Points:**
1. `totalAssets()` represents LP pool value (what LP holders own)
2. Trader claims come from liquidity pool (larger, includes liquidity exposure)
3. LP redemption uses `totalAssets() / totalSupply()` - correct after redesign
4. Protocol fees claimed separately (excluded from `totalAssets()`)
5. No double-spending because LP pool and liquidity pool are separate after graduation

---

## Implementation Order

1. Add state variables (lpAccrued, protocolFeesAccrued)
2. Update totalAssets() calculation (separate accounting, exclude non-LP funds)
3. Fix post-graduation fee handling (accrue instead of mint)
4. Add protocol fee tracking (increment protocolFeesAccrued)
5. Fix expiry refund logic (pro-rata distribution)
6. Add protocol fee claims (treasury withdrawal function)
7. Add creator liquidity enhancement (increaseMaxLossCapacity function)
8. Verify and enforce invariant (LP token × exchange rate relationship)
9. Update tests (verify new behavior, test invariant)

---

## Testing Requirements

### Core Functionality
- Verify exchange rate increases post-graduation without dilution
- Verify totalAssets excludes locked proceeds, protocol fees, liquidity exposure, trading balances
- Verify expiry refund is pro-rata (creator and traders get correct shares)
- Verify protocol fees can be claimed separately
- Verify invariant: `totalAssets() + totalLockedProceeds + protocolFeesAccrued + liquidityExposureFunds <= actual balance`
- Verify pre-graduation behavior unchanged (1:1 minting)

### Settlement Scenarios
- **Early Settlement (Not Graduated):**
  - Verify trader claims work correctly
  - Verify LP redemption uses correct totalAssets()
  - Verify protocol gets 0% (no protocol fees)
  - Verify all LP holders can redeem pro-rata
  
- **Normal Settlement (Graduated):**
  - Verify trader claims paid from liquidity pool (maxLoss capacity)
  - Verify LP redemption uses totalAssets() / totalSupply() with correct exchange rate
  - Verify protocol fees can be claimed separately
  - Verify LP holders get their proportional share of LP pool (deposit + feesAccrued + lpAccrued)
  - Verify liquidity exposure (50% of post-grad fees) is NOT part of LP redemption
  
- **Expiry:**
  - Verify claimExpiryRefund() is pro-rata (not creator-only)
  - Verify all LP holders can claim
  - Verify protocol gets 0%
  
- **Liquidation:**
  - Verify claimLiquidationRefund() still works correctly (already pro-rata)
  - Verify liquidation fee goes to protocol (if applicable)
- **Verify exchange rate calculation:**
  - `exchangeRate = totalAssets() / totalSupply()` (only one totalSupply - LP token supply)
  - Pre-grad: `exchangeRate = 1.0` (1:1 minting maintains rate)
  - Post-grad: `exchangeRate > 1.0` (accrual increases rate without minting)
- **Verify maxLoss capacity vs LP pool:**
  - Pre-grad: `totalAssets() == maxLossCapacity`
  - Post-grad: `totalAssets() < maxLossCapacity` (only 30% accrues to LP, 50% goes to liquidity)
- **Verify creator liquidity enhancement:**
  - Additional deposit increases bBase correctly
  - Exchange rate increases without new LP minting
  - Existing LP holders benefit proportionally

---

## Migration Considerations

- **Existing deployed markets:** No migration needed (changes only affect new behavior)
- **Frontend updates:** May need to update to show new exchange rate calculation
- **Documentation:** Update to reflect ERC4626-style accrual model

---

## References

- `LP_TOKEN_DESIGN_ANALYSIS.md` - Detailed analysis of current implementation
- `CREATOR_VAULT_LIFECYCLE_FLOW.md` - Complete money flow documentation
- `LAUNCHPAD_ECONOMICS_V2.md` - Economic design specifications
- `LAUNCHPAD_ECONOMICS_V2.md` line 444-458 - MaxLoss capacity formula
- `LAUNCHPAD_ECONOMICS_V2.md` line 26-87 - ERC4626-style LP vault design
