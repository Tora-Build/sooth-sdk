# Creator Vault (LP Token System) Lifecycle Money Flow

## Overview

The LaunchpadMarket contract serves as its own "creator vault" - it implements `ISoothLiquidityVault` and holds all USDC directly. LP tokens are ERC20 tokens minted by the market contract itself. All funds (creator deposit + fees) are stored in one co-mingled balance: `_asset.balanceOf(address(this))`.

> Update (Stage 1+): `claimCreatorRefund()` and `claimLiquidationRefund()` were removed in favor of a single pro-rata path: **`redeemLP(...)`** after market end. Market resolution is **Adjudicator-only** via `finalizeResolution(outcome, tStar)`.

## Phase 1: Market Creation (Initialization)

```
Creator selects tier (e.g., $1,000 liquidity tier)
  ↓
Creator deposits: $693 (bBase × 0.693 = maxLoss)
  ↓
Factory.transferFrom(creator, market, $693)
  ↓
Market.initializeLaunchpad():
  - totalCreatorDeposit = $693
  - _mint(creator, $693 LP tokens)  ← 1:1 initial mint
  - totalAssets() = $693 (creator deposit)
  - totalSupply() = $693 LP tokens
  - exchangeRate = $693 / $693 = 1.0
```

**State at Creation:**
- `totalAssets()` = $693 (creator deposit)
- `totalSupply()` = $693 LP tokens (all owned by creator)
- `feesAccrued` = 0
- `bBase` = $1,000 (initial liquidity depth, not actual USDC)

**Key Point:** Creator deposit physically moves to market contract, creator receives LP tokens representing ownership.

---

## Phase 2: Pre-Graduation Trading (Internal Phase)

### Trade Flow

```
Trader buys YES for $100
  ↓
executeAMMTrade() called:
  - Cost calculation (LMSR): $100
  - Fee (5%): $5
  - Cost to trader: $105
  ↓
Fee Handling (Pre-Graduation):
  1. feesAccrued += $5
  2. deltaB = $5 / 0.693 = $7.22 (liquidity growth)
     bBase += $7.22
  3. _mint(trader, $5 LP tokens)  ← 1:1 mint with fee
  4. Fee stays in market (co-mingled with creator deposit)
```

**After Multiple Trades:**

Example: 10 trades, $50 total fees collected

```
State:
  - totalAssets() = $693 + $50 = $743 (creator deposit + fees)
  - totalSupply() = $693 + $50 = $743 LP tokens
  - feesAccrued = $50
  - bBase = $1,000 + ($50 / 0.693) = $1,072 (liquidity depth)
  - exchangeRate = $743 / $743 = 1.0 (maintains 1:1)
```

**Key Points:**
- Every $1 in fees = $1 LP token minted (1:1 rate maintained)
- All fees stay in market balance (co-mingled)
- Exchange rate stays at 1.0 during pre-graduation
- `bBase` grows (abstract liquidity depth, not actual USDC)

---

## Phase 3: Graduation Threshold Reached

```
Condition: bBase >= graduationThreshold (2 × initial_b)
Example: bBase = $2,000 (doubled from $1,000)
  ↓
graduate() called (automatic or manual):
  - isGraduated = true
  - Fee rate switches: 5% → 1%
  - Orderbook enabled
```

**State at Graduation:**
- `totalAssets()` = $693 + feesAccrued (all fees collected)
- `totalSupply()` = $693 + feesAccrued (all LP tokens minted)
- `isGraduated` = true
- Fee split changes from 100% liquidity → 50/30/20 split

**Key Point:** No money movement at graduation - just state change and fee split logic changes.

---

## Phase 4: Post-Graduation Trading

### Trade Flow (Post-Graduation)

```
Trader buys YES for $100
  ↓
executeAMMTrade() called:
  - Cost calculation (LMSR): $100
  - Fee (1%): $1
  - Cost to trader: $101
  ↓
Fee Handling (Post-Graduation):
  1. deltaB = ($1 / 0.693) / 2 = $0.72 (50% to liquidity)
     bBase += $0.72
  2. lpAmount = $1 × 30% = $0.30
     _mint(trader, $0.30 LP tokens)  ← NEW tokens minted
  3. Protocol fee = $1 × 20% = $0.20
     (stays in market, tracked separately but co-mingled)
```

**After Multiple Post-Graduation Trades:**

Example: 100 trades, $100 total fees

```
State:
  - totalAssets() = $743 + $100 = $843 (includes all fees)
  - totalSupply() = $743 + $30 = $773 LP tokens (only 30% minted)
  - feesAccrued = $50 (pre-grad only)
  - Protocol fees: $20 (tracked conceptually, but co-mingled)
  - exchangeRate = $843 / $773 = 1.09 (increased due to dilution)
```

**Current Implementation Issue:**
- Exchange rate increases BUT new tokens dilute existing holders
- Protocol fee ($20) included in `totalAssets()`, inflating exchange rate
- Not aligned with documented ERC4626-style (should accrue, not mint)

**What Should Happen (ERC4626-Style):**
- No new LP tokens minted
- 30% of fee ($0.30) should accrue to existing holders
- exchangeRate = ($743 + $30) / $743 = 1.04 (better for existing holders)

---

## Phase 5A: Market Expiry (Failed to Graduate)

```
Condition: deadline passed && !isGraduated
  ↓
expire() called:
  - isLive = false
  ↓
LP holders redeem pro-rata:
  - call `redeemLP(amount)` after market end
  - assets = (amount × totalAssets()) / totalSupply()
  - _burn(user, amount)
  - _asset.safeTransfer(user, assets)
```

**Money Flow:**
```
Initial: Creator deposited $693
Fees collected: $50
Total in market: $743

Expiry:
  - Creator gets: $743 (everything)
  - Traders who received LP tokens: Nothing (LP tokens worthless)
  
Wait... This seems wrong! Traders should get their share based on LP tokens.
```

**Note:** This document previously described a creator-only refund path; that path has been removed. Expiry refunds are now pro-rata via `redeemLP(...)`.

---

## Phase 5B: Market Settlement (After Graduation)

```
Condition: Adjudicator calls finalizeResolution(outcome, tStar)
  ↓
Market settles (via SoothMarketBase logic):
  - isLive = false
  - Outcome determined
  - Traders claim winning outcome tokens
  ↓
LP Token Redemption:
  - LP holders call redeemLP(amount)
  - assets = (amount × totalAssets()) / totalSupply()
  - _burn(user, amount)
  - _asset.safeTransfer(user, assets)
```

**Money Flow:**

Example settlement:
```
State before settlement:
  - totalAssets() = $843 (creator deposit + all fees)
  - totalSupply() = $773 LP tokens
  - Trader claims: $400 (via outcome tokens)
  - Remaining pool: $843 - $400 = $443

LP Redemption:
  Creator owns: $693 LP tokens (89.7%)
  Creator redeems: ($693 × $443) / $773 = $396
  
  Trader owns: $80 LP tokens (10.3%)
  Trader redeems: ($80 × $443) / $773 = $46
  
Total redeemed: $396 + $46 = $442 (remaining pool)
```

**Key Point:** LP tokens redeemed proportionally based on final `totalAssets()` after trader claims.

---

## Phase 5C: Guardian Liquidation (Expired Market)

```
Condition: deadline passed && !isGraduated && guardian calls liquidate()
  ↓
liquidate() called:
  - isLiquidated = true
  - isLive = false
  - liquidationFee = totalAssets() × liquidationFeeBps / 10000
  - refundAmount = totalAssets() - liquidationFee
  ↓
LP holders redeem pro-rata:
  - userShare = (totalAssets() × userLP) / totalSupply()
  - _burn(user, userLP)
  - _asset.safeTransfer(user, userShare)
```

**Money Flow:**

```
Total assets: $743
Liquidation fee (e.g., 5%): $37.15
Refund pool: $705.85

Creator (93.3% LP):
  Share: ($743 × $693) / $743 = $693
  Receives: $693
  
Trader (6.7% LP):
  Share: ($743 × $50) / $743 = $50
  Receives: $50

Protocol receives liquidation fee: $37.15
```

**Note:** The liquidation refund uses `totalAssets()` (which includes liquidation fee), but actual transfer excludes it. This is a bit inconsistent but works if liquidation fee is transferred out first.

---

## Current Implementation Issues Summary

### Issue 1: Co-mingled Balance
- All funds in one place: `_asset.balanceOf(address(this))`
- Includes: creator deposit, fees, locked proceeds, protocol fees, trading balances
- Hard to separate for accounting purposes

### Issue 2: Post-Graduation LP Minting
- Currently mints new LP tokens (dilutes existing holders)
- Should accrue to existing holders (ERC4626-style)
- Exchange rate calculation includes protocol fees (inflated)

### Issue 3: Expiry/Liquidation Refund Logic
- Pro-rata refunds for LP holders are handled via `redeemLP(...)` (creator is just an LP).

### Issue 4: totalAssets() Calculation
- Currently: `_asset.balanceOf(address(this))` (everything)
- Should exclude: locked proceeds, protocol fees, temporary trading balances
- Should only include: LP-related assets (creator deposit + LP accruals)

---

## Recommended Lifecycle Flow (Fixed)

### Phase 2: Pre-Graduation (Keep Current)
- ✅ 1:1 LP minting with fees
- ✅ All fees stay in market
- ✅ Exchange rate = 1.0

### Phase 4: Post-Graduation (Fix)
- ❌ Don't mint new LP tokens
- ✅ Accrue 30% fees to existing holders
- ✅ Track protocol fees separately
- ✅ Exchange rate increases without dilution

### Phase 5A: Expiry (Fix)
- ❌ Don't give all funds to creator
- ✅ Pro-rata refund based on LP ownership
- ✅ Use same pattern as `claimLiquidationRefund()`

### Phase 5B: Settlement (Keep Current)
- ✅ LP redemption after trader claims
- ✅ Pro-rata based on final `totalAssets()`
- ✅ Need to ensure `totalAssets()` excludes non-LP funds

---

## Key Accounting Questions

1. **What should `totalAssets()` represent?**
   - Currently: All USDC in market
   - Should be: LP pool only (creator deposit + LP fee accruals)

2. **How to handle locked proceeds?**
   - Currently: Included in `totalAssets()`
   - Should be: Tracked separately, excluded from LP calculations

3. **How to handle protocol fees?**
   - Currently: Co-mingled, increases `totalAssets()`
   - Should be: Tracked separately, excluded from LP exchange rate

4. **How to handle trading balances?**
   - Currently: Included in `totalAssets()`
   - Should be: Temporary, excluded (will be paid out to traders)

5. **Pro-rata refund on expiry?**
   - Currently: Creator gets everything
   - Should be: Based on LP token ownership (like liquidation refund)
