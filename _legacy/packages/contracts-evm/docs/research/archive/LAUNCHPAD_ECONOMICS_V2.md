# Launchpad Economics V2 — Role-by-Role Analysis

**Date:** 2025-12-14  
**Status:** Economic Design  
**Supersedes:** Section 20-21 of LAUNCHPAD_MODEL_RESEARCH.md  

---

## Executive Summary

This document provides a comprehensive economic analysis of the Sooth Launchpad model, examining profit and loss constraints for each participant role. The goal is to ensure incentive alignment while making market creation attractive for creators.

---

## Updated Economic Parameters

### Fee Structure

| Phase | Venue | Fee Rate | Destination |
|-------|-------|----------|-------------|
| **Internal** | AMM | 5% | 100% → Liquidity (b growth) |
| **Internal** | Orderbook | N/A | Orderbook disabled |
| **External** | AMM | 1% | 50% liquidity, 30% LP vault, 20% protocol |
| **External** | Orderbook | 0.5% | 50% liquidity, 30% LP vault, 20% protocol |

### LP Vault & Exchange Rate (ERC4626-Style)

The 30% LP share goes to the **LP Vault**, increasing the exchange rate of LP tokens.

```solidity
contract MarketLPVault {
    IERC20 public asset;           // USDC
    uint256 public totalAssets;    // USDC in vault (grows with 30% fees)
    uint256 public totalSupply;    // LP tokens issued (fixed after graduation)
    
    // ERC4626-style exchange rate
    function exchangeRate() public view returns (uint256) {
        if (totalSupply == 0) return 1e18;
        return (totalAssets * 1e18) / totalSupply;
    }
    
    // Called when 30% fee is allocated
    function accrueFeesToVault(uint256 amount) external onlyMarket {
        asset.transferFrom(msg.sender, address(this), amount);
        totalAssets += amount;
        // No new LP tokens minted — existing holders benefit
    }
    
    // At settlement: LP holders redeem shares for assets
    function redeem(uint256 shares) external returns (uint256 assets) {
        require(market.state() == MarketState.Settled, "Not settled");
        assets = (shares * totalAssets) / totalSupply;
        totalSupply -= shares;
        totalAssets -= assets;
        lpToken.burn(msg.sender, shares);
        asset.transfer(msg.sender, assets);
    }
    
    // NO deposit() — LP tokens earned via internal trading only
    // NO withdraw() — only redeem at settlement
}
```

### Exchange Rate Mechanics

```
Initial (at graduation):
  totalAssets = bBase + internalFees = $3,000
  totalSupply = 3,000 LP tokens
  exchangeRate = $1.00 per LP token

After $10,000 in post-graduation volume:
  Fees collected: $10,000 × 1% = $100
  LP vault receives: 30% × $100 = $30
  
  totalAssets = $3,000 + $30 = $3,030
  totalSupply = 3,000 (unchanged)
  exchangeRate = $3,030 / 3,000 = $1.01 per LP token

After $1,000,000 in post-graduation volume:
  Fees collected: $10,000
  LP vault receives: $3,000
  
  totalAssets = $3,000 + $3,000 = $6,000
  totalSupply = 3,000
  exchangeRate = $2.00 per LP token (100% gain!)
```

### LP Token Trading

LP tokens are tradeable ERC20, so:

```
Scenario:
  Alice earned 100 LP tokens during internal phase (paid $100 in fees)
  Exchange rate at graduation: $1.00
  Exchange rate after 6 months: $1.50
  
Options:
  1. Hold until settlement → redeem 100 tokens for $150
  2. Sell on DEX now → sell 100 tokens at ~$1.50 each = $150
  
Secondary market prices LP tokens based on:
  - Current exchange rate
  - Expected future fee revenue
  - Time to settlement
  - Market outcome uncertainty
```

### IMarketLPVault Interface (ERC4626-Inspired)

```solidity
interface IMarketLPVault {
    // ═══════════════════════════════════════════════════════════════
    // ASSET INFO
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice The underlying asset (USDC)
    function asset() external view returns (address);
    
    /// @notice Total USDC in the vault (grows with 30% fee accrual)
    function totalAssets() external view returns (uint256);
    
    // ═══════════════════════════════════════════════════════════════
    // SHARE INFO  
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Total LP tokens issued (fixed after graduation)
    function totalSupply() external view returns (uint256);
    
    /// @notice LP token balance of account
    function balanceOf(address account) external view returns (uint256);
    
    // ═══════════════════════════════════════════════════════════════
    // EXCHANGE RATE (Core 4626-style interface)
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Assets per share (in WAD, 1e18 = 1:1)
    function exchangeRate() external view returns (uint256);
    
    /// @notice Convert shares to assets at current rate
    function convertToAssets(uint256 shares) external view returns (uint256);
    
    /// @notice Convert assets to shares at current rate  
    function convertToShares(uint256 assets) external view returns (uint256);
    
    // ═══════════════════════════════════════════════════════════════
    // RESTRICTED OPERATIONS (No deposit/withdraw)
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Redeem shares for assets (ONLY at settlement)
    /// @dev Reverts if market not settled
    function redeem(uint256 shares, address receiver) external returns (uint256 assets);
    
    /// @notice Preview redemption amount
    function previewRedeem(uint256 shares) external view returns (uint256 assets);
    
    // ═══════════════════════════════════════════════════════════════
    // INTERNAL OPERATIONS (Called by Market contract only)
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Mint LP tokens to trader (internal phase only)
    function mint(address to, uint256 shares) external;
    
    /// @notice Accrue fee revenue to vault (post-graduation)
    function accrueFeesToVault(uint256 amount) external;
    
    // ═══════════════════════════════════════════════════════════════
    // ERC20 TRANSFER (Enabled for secondary market trading)
    // ═══════════════════════════════════════════════════════════════
    
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}
```

### Key Differences from ERC4626

| ERC4626 | MarketLPVault |
|---------|---------------|
| `deposit(assets)` → shares | ❌ Disabled |
| `withdraw(assets)` → shares | ❌ Disabled |
| `mint(shares)` public | ❌ Only market can mint |
| `redeem(shares)` anytime | ✅ Only at settlement |
| `transfer()` | ✅ Enabled (tradeable) |
| `exchangeRate()` | ✅ Same concept |

### Liquidity Leverage Model

Sooth uses **1.44x liquidity leverage** — creators deposit less but get more liquidity depth!

```
Deposit $693 → Get $1,000 liquidity depth
That's 1.44x leverage on your capital!

Leverage Factor = 1 / ln(2) ≈ 1.44x
```

### Tier System (b-Based Options)

Creator selects a **liquidity tier** (b), deposits the required amount:

| Tier | Liquidity (b) | Deposit Required | Graduation (2× b fees) | Volume Needed |
|------|---------------|------------------|------------------------|---------------|
| **Micro** | $100 | **$69** | $200 | $4,000 |
| **Small** | $1,000 | **$693** | $2,000 | $40,000 |
| **Medium** | $10,000 | **$6,930** | $20,000 | $400,000 |
| **Large** | $100,000 | **$69,300** | $200,000 | $4,000,000 |

*Deposit = b × 0.693 (the actual maxLoss)*
*Volume needed = Graduation / 5% internal fee rate*

### Fee Boost Multiplier

Every $1 in trading fees adds **$1.44 to liquidity depth**:

```
feeBoost = fee / 0.693 ≈ fee × 1.44

Examples:
  $10 in fees → $14.43 added to b
  $100 in fees → $144.30 added to b
  $1,000 in fees → $1,443 added to b
```

### Implementation

```solidity
uint256 constant GRADUATION_DEADLINE = 5 days;
uint256 constant WAD = 1e18;
uint256 constant LN2_WAD = 693_147_180_559_945_309; // ln(2) in WAD

uint256[4] public B_TIERS = [100e18, 1000e18, 10000e18, 100000e18];

function depositForTier(uint256 tierIndex) public view returns (uint256) {
    // deposit = b × ln(2) ≈ b × 0.693
    return (B_TIERS[tierIndex] * LN2_WAD) / WAD;
}

function graduationThreshold(uint256 b) public pure returns (uint256) {
    // graduation = 2 × b in fees
    return b * 2;
}

function feeToLiquidityBoost(uint256 fee) public pure returns (uint256) {
    // Every $1 fee adds $1.44 to b
    return (fee * WAD) / LN2_WAD;
}
```

### Why 2× b in Fees to Graduate?

**Key Insight:** Creator CANNOT self-trade to graduation profitably.

```
Creator selects: $1,000 liquidity tier
Creator deposits: $693 (maxLoss)
Graduation needs: $2,000 in fees

Self-trade to graduate:
  Volume needed: $2,000 / 5% = $40,000
  Creator would pay $2,000 in fees (289% of deposit!)
  
Cost to self-graduate: 2.89× capital → economically irrational
```

**Effect:**
- ✅ Requires genuine organic trading interest
- ✅ Strong spam filter (can't pay your way to graduation)
- ✅ Creator's deposit is pure risk capital, fully utilized
- ✅ Market only graduates if traders actually want it

### Initial Probability Setting

Creator can set the **initial YES probability** at market creation (default 50%):

```solidity
function createMarket(
    uint256 tierIndex,           // 0-3 for liquidity tier
    uint256 initialYesBps,       // 0-10000, e.g., 7000 = 70% YES
    address adjudicator,
    bytes32 questionHash
) external {
    uint256 b = B_TIERS[tierIndex];
    uint256 deposit = depositForTier(tierIndex);
    
    // Transfer deposit from creator
    USDC.transferFrom(msg.sender, address(this), deposit);
    
    // Set initial q values to produce desired probability
    (qYes, qNo) = _deriveQFromProbability(initialYesBps, b);
    
    // ...
}
```

**Why not "first trade privilege"?**
- Simpler (no special trade logic)
- No gaming opportunity (can't set extreme price then trade against)
- One less transaction
- Creator's belief expressed without capital risk beyond deposit

---

## Edge Case: Truth Happens Before Graduation

### Scenario

```
Day 0: Market created - "Will ETH hit $5k by Dec 20?"
        bBase = $1,000, needs $2,000 fees to graduate
        
Day 2: $500 in fees collected (not graduated yet)
        ETH hits $5k! Truth is now known.
        
Problem: Market is still in INTERNAL phase, but outcome is resolved.
```

### Why Special Handling IS Needed

| Problem | Impact |
|---------|--------|
| Trading becomes pointless | Everyone knows the answer |
| Late traders exploit | Buy winning outcome at 100% certainty (free money) |
| Early losers trapped | No exit, have to wait for expiry |
| Waiting for expiry | Unfair — truth is known, should settle |

### Solution: Unified Settlement with Conditional Behavior

One `Settled` state, but behavior differs based on `wasGraduated` flag:

```solidity
enum MarketState {
    Internal,    // Pre-graduation, AMM only
    Graduated,   // Post-graduation, orderbook active
    Settled,     // Outcome resolved (from either state)
    Expired      // Failed to graduate in time
}

bool public wasGraduated;  // Set when settlement happens

function settle(uint8 outcome) external onlyAdjudicator {
    require(state == MarketState.Internal || state == MarketState.Graduated);
    
    wasGraduated = (state == MarketState.Graduated);
    state = MarketState.Settled;
    winningOutcome = outcome;
    
    emit MarketSettled(outcome, wasGraduated);
}
```

### Settlement Behavior Matrix

| Condition | `wasGraduated = true` | `wasGraduated = false` |
|-----------|----------------------|------------------------|
| **Settled from** | Graduated | Internal |
| **Orderbook was** | Active | Never activated |
| **Post-grad fees collected** | Yes (50/30/20) | No |
| **Protocol profit share** | 20% if profit | **0%** |
| **LP payout** | From final pool | From current pool |

### Settlement Logic

```solidity
function _distributeSettlement() internal {
    uint256 traderClaims = _calculateTraderClaims();
    uint256 remainingPool = totalLiquidity - traderClaims;
    
    if (wasGraduated && remainingPool > 0) {
        // Normal path: protocol takes 20% of profit
        uint256 protocolShare = (remainingPool * 20) / 100;
        uint256 lpShare = remainingPool - protocolShare;
        _transferToProtocol(protocolShare);
        _distributeToLPs(lpShare);
    } else {
        // Early settlement: protocol gets nothing
        _distributeToLPs(remainingPool);
    }
}
```

### Example: Early Settlement (Not Graduated)

```
Creator selected: $1,000 liquidity tier
Creator deposited: $693 (maxLoss)
Pool: $693 (deposit) + $500 (internal fees) = $1,193
Trader claims: $800
Remaining: $393

wasGraduated = false
  → Protocol share: $0
  → LP share: $393 (100%)
  
LP distribution (pro-rata):
  Creator: 58% × $393 = $228
  Traders: 42% × $393 = $165
  
Creator P&L: $228 - $693 = -$465 (67% loss of deposit)
```

### Example: Normal Settlement (Graduated)

```
Creator selected: $1,000 liquidity tier
Creator deposited: $693 (maxLoss)
Graduation: $2,000 in internal fees collected

MaxLoss capacity: $693 + $2,000 = $2,693
b at graduation: $2,693 / 0.693 = $3,887

Post-graduation: $10,000 external fees
  → 50% to maxLoss: $5,000 → total maxLoss = $7,693
  → 30% to LP Vault: $3,000
  → 20% to Protocol: $2,000

At settlement:
  Pool (maxLoss capacity): $7,693
  Trader claims: $5,000
  Remaining: $2,693 (profit)

wasGraduated = true
  → Protocol share: 20% × $2,693 = $539
  → LP pool share: $2,154

Plus LP Vault: $3,000

Total LP value: $2,154 + $3,000 = $5,154
LP distribution: pro-rata to LP shareholders
```

### Summary

| State | Trigger | Orderbook | Protocol Revenue |
|-------|---------|-----------|------------------|
| `Internal` | Market created | ❌ | 0% |
| `Graduated` | Fees ≥ 2× b | ✅ | 20% of external fees |
| `Settled` (from Graduated) | Adjudicator resolves | N/A | 20% of pool profit |
| `Settled` (from Internal) | Adjudicator resolves early | N/A | **0%** |
| `Expired` | 5 days, no graduation | N/A | 0% (refund) |

### Liquidity Formula (MaxLoss-Based)

Fees increase **maxLoss capacity**, and b is derived:

```
maxLossCapacity = deposit + internalFees + 0.5 × externalFees
b = maxLossCapacity / ln(2) ≈ maxLossCapacity × 1.44
```

Where:
- `deposit` = Creator's initial USDC (= b_tier × 0.693)
- `internalFees` = All fees collected during Internal phase
- `externalFees` = All fees collected after Graduation

**Key Insight:** Fees grow the maxLoss buffer, which allows deeper liquidity (higher b).

### Settlement Profit Sharing

```
If settlementProfit > 0:
    protocolShare = settlementProfit × 20%
Else:
    protocolShare = 0  // Protocol absorbs no losses
```

---

## Role 1: Creator

### Profile
- Selects liquidity tier (b) and deposits required amount (b × 0.693)
- Sets initial probability (default 50%)
- Selects question, outcomes, adjudicator
- Automatically becomes first LP shareholder (proportional to deposit)

### Revenue Streams

| Source | Phase | Amount |
|--------|-------|--------|
| LP share of 30% external fees | Post-Graduation | Pro-rata based on LP ownership |
| LP share of settlement profit | Settlement | Pro-rata (if positive) |

### Profit Constraints

**Maximum Profit Scenario:**
```
Creator selects: $1,000 liquidity tier
Creator deposits: $693 (= $1,000 × 0.693)
Graduation threshold: $2,000 in fees

Internal Phase:
  - Creator's deposit: $693
  - Traders contribute $2,000 in fees to graduate
  - Total LP pool: $693 + $2,000 = $2,693
  - Creator LP ownership: $693 / $2,693 = 25.7%

Post-Graduation (1 year of trading):
  - External volume: $1,000,000
  - AMM fees (1%): $10,000
  - OB fees (0.5%): $2,500 (assuming 50% OB)
  - Total external fees: $12,500

Fee Distribution:
  - Liquidity/maxLoss (50%): $6,250 → b grows
  - LP Vault (30%): $3,750 → exchangeRate ↑
  - Protocol (20%): $2,500

LP Vault value: $3,750
Creator's LP share of vault: 25.7% × $3,750 = $964

Settlement (market profitable):
  - Remaining pool after trader claims: $5,000
  - Protocol takes 20%: $1,000
  - LP receives 80%: $4,000
  - Creator's share: 25.7% × $4,000 = $1,028

TOTAL CREATOR PROFIT:
  Initial deposit: -$693
  LP Vault share: +$964
  Settlement share: +$1,028
  ─────────────────────
  Net: +$1,299 (187% ROI on $693 deposit)
```

**Profit is UNCAPPED** — scales with market success.

### Loss Constraints

**Scenario A: Market Expires (No Graduation)**
```
Creator selects: $1,000 liquidity tier
Creator deposits: $693 (maxLoss)
Market fails to graduate (expires after 5 days)

Refund Mechanism:
  - Internal fees collected: $100
  - Total pool: $693 + $100 = $793
  - Creator's LP share: $693 / $793 = 87.4%
  - Creator refund: 87.4% × $793 = $693 (approximately)

CREATOR LOSS: ~$0 (refunded)
```

**Scenario B: Market Graduates, Settlement Loss**
```
Creator selects: $1,000 liquidity tier
Creator deposits: $693 (maxLoss)
Graduation: $2,000 internal fees collected

At graduation:
  MaxLoss capacity: $693 + $2,000 = $2,693
  b = $2,693 / 0.693 = $3,887

At settlement (worst case):
  Traders collectively win the maximum possible
  LMSR maxLoss = b × ln(2) = $3,887 × 0.693 = $2,693
  Pool depleted to: $0
  
Creator's LP share of $0 pool: $0
Plus LP Vault (if any post-grad trading): some value

WORST CASE CREATOR LOSS: $693 (100% of deposit)
```

**Maximum loss is deposit** (= b × 0.693 = the creator's maxLoss).

**Key insight:** Creator's deposit IS the maxLoss. By design, they can never lose more than what they deposited.

### Risk/Reward Summary

| Scenario | Creator Outcome |
|----------|-----------------|
| Market graduates + high volume + LP profit | Uncapped profit via LP Vault + pool |
| Market graduates + low volume | Small profit or breakeven |
| Market expires (no graduation) | Refunded (~0 loss) |
| Market graduates + settlement loss | **Loss up to deposit** |

**Key Risk:** Creator's deposit (= b × 0.693) is the maxLoss. This is by design — capital efficient, fully utilized.

### Tier Selection Strategy

**Creator's Trade-off:**

| Tier Choice | Pros | Cons |
|-------------|------|------|
| **Micro ($100)** | Low capital at risk, fast test | Low liquidity, high slippage, less attractive |
| **Small ($1,000)** | Balanced risk/reward | Moderate liquidity |
| **Medium ($10,000)** | Good liquidity, serious signal | Significant capital at risk |
| **Large ($100,000)** | Best liquidity, institutional-grade | High capital at risk, high volume needed |

**Liquidity Racing Scenario:**
```
Topic: "ETH to $5k by Q1 2026"

Creator A deploys: $1,000 (Small tier)
  - Needs $250 in fees to graduate
  - Can self-trade $5,000 volume (costs $250) to guarantee graduation

Creator B deploys: $10,000 (Medium tier)
  - Needs $2,500 in fees to graduate
  - Better liquidity attracts more organic traders
  - Harder to self-trade alone ($50,000 volume needed)

Race dynamics:
  - A graduates faster (lower bar) but has worse liquidity
  - B attracts more traders due to better UX but needs more time
  - Traders may prefer B for lower slippage, even if A is "first"
  
Winner: Depends on topic heat and trader preference!
```

### Strategic Considerations

**Free Option Attack Prevention:**

Without lock-on-sell, traders could:
1. Trade to move price
2. Wait for information asymmetry
3. Exit before graduation at profit

**Creator's Defense: `graduationThreshold`**

```
High graduationThreshold = More fees collected before graduation
                         = Higher cost for attackers to manipulate
                         = Longer time for market to stabilize
                         
Low graduationThreshold = Faster graduation
                        = Less fee revenue in internal phase
                        = Higher attack risk
```

**Optimal Strategy:**
- Hot topic (high natural volume): Set low threshold, graduate fast
- Niche topic (slow volume): Set higher threshold, accumulate more LP value
- Controversial topic: Set higher threshold to allow price discovery

---

## Role 2: Internal Trader (Pre-Graduation LP)

### Profile
- Trades during Internal phase
- Earns LP shares proportional to fees paid
- Can buy AND sell without lock
- LP shares are tradeable ERC20

### Revenue Streams

| Source | Phase | Amount |
|--------|-------|--------|
| Trading P&L | Internal | Based on position outcomes |
| LP share of 30% external fees | Post-Graduation | Pro-rata |
| LP share of settlement profit | Settlement | Pro-rata |

### Profit Constraints

**Maximum Profit Scenario (as LP):**
```
Internal Trader contributes: $100 in fees
Total internal fees at graduation: $500
Trader's LP ownership: $100 / ($1,000 bBase + $500 fees) = 6.67%

Post-Graduation fees: $12,500
LP share (30%): $3,750
Trader receives: 6.67% × $3,750 = $250

Settlement profit: $4,000 to LP
Trader receives: 6.67% × $4,000 = $267

TOTAL LP PROFIT:
  Fees paid: -$100
  Fee revenue: +$250
  Settlement: +$267
  ─────────────────────
  Net: +$417 (417% ROI on fees paid)
```

**Profit is UNCAPPED** — LP shares entitle holder to perpetual fee stream.

**Maximum Profit Scenario (as Trader):**
```
Internal Trader:
  - Buys YES at 30% probability ($0.30)
  - Market graduates
  - Sells YES at 70% probability ($0.70) post-graduation
  
Trading Profit:
  Cost: 100 shares × $0.30 = $30
  Proceeds: 100 shares × $0.70 = $70
  Net: +$40 (before fees)

Fees paid:
  Buy: $30 × 5% = $1.50
  Sell: $70 × 1% = $0.70
  Total: $2.20

Net Trading Profit: $40 - $2.20 = $37.80
LP shares earned: $2.20 (additional upside)
```

### Loss Constraints

**Loss Scenario A (Expiry - No Graduation):**
```
Market expires without graduation:
  - Refund mechanism triggers
  
Refund Distribution:
  - Total pool: bBase + internal fees
  - Distributed pro-rata to LP shareholders
  
Internal Trader's refund:
  LP share: $100 / $1,500 = 6.67%
  Refund: 6.67% × $1,500 = $100 (full recovery)
  
LP LOSS: $0 (refunded)
```

**Loss Scenario B (Graduation + Settlement Loss):**
```
Market graduates, then settles with LP loss:
  - LP pool partially or fully depleted
  - Internal trader's LP shares lose value
  
Worst case:
  Fees contributed: $100
  LP share value at settlement: $0
  
LP LOSS: $100 (100% of fee contribution)
```

**Maximum Loss Scenario (as Trader):**
```
Trader buys YES at 90% probability:
  Cost: 100 shares × $0.90 = $90
  Fees: $90 × 5% = $4.50
  Total: $94.50

Market settles NO (100% loss on position):
  Proceeds: $0
  
But trader earned LP shares worth $4.50:
  If market was profitable before settlement loss,
  LP share may partially offset trading loss.

Net Loss: -$94.50 + LP value (variable)
```

**Trading loss can approach 100% of position** — standard prediction market risk.

### Risk/Reward Summary

| Scenario | Internal Trader Outcome |
|----------|------------------------|
| Correct prediction + graduation + LP profit | Trading profit + LP profit |
| Wrong prediction + graduation + LP profit | Trading loss, but LP shares may offset |
| Market expires | Refunded (0 LP loss, trading P&L realized) |
| Graduation + settlement loss | Trading P&L + **LP share loss (up to fees paid)** |

### Key Insight: Fee-as-LP Creates Asymmetry

```
Traditional Market:
  Fees are pure cost → negative EV friction

Sooth Launchpad:
  Fees during Internal = LP shares
  LP shares = claim on future fees + settlement
  
  If market succeeds: Fees become investment
  If market fails: Fees refunded
  
  → Fees have POSITIVE expected value during Internal phase
```

---

## Role 3: External Trader (Post-Graduation)

### Profile
- Trades after Graduation
- Does NOT earn LP shares
- Standard prediction market participant
- Benefits from deeper liquidity (higher `b`)

### Revenue Streams

| Source | Phase | Amount |
|--------|-------|--------|
| Trading P&L | Post-Graduation | Based on position outcomes |

### Profit Constraints

**Maximum Profit Scenario:**
```
External Trader buys YES at 20%:
  Cost: 1000 shares × $0.20 = $200
  Fees: $200 × 1% = $2
  
Market settles YES:
  Proceeds: 1000 shares × $1.00 = $1,000
  
Net Profit: $1,000 - $200 - $2 = $798 (399% ROI)
```

**Profit capped at ~400-900%** depending on entry price (standard binary market dynamics).

### Loss Constraints

**Maximum Loss Scenario:**
```
External Trader buys YES at 90%:
  Cost: 1000 shares × $0.90 = $900
  Fees: $900 × 1% = $9
  
Market settles NO:
  Proceeds: $0
  
Net Loss: -$909 (100% of capital)
```

**Loss capped at 100% of position** — cannot lose more than invested.

### Risk/Reward Summary

| Scenario | External Trader Outcome |
|----------|------------------------|
| Correct prediction | Profit based on entry price |
| Wrong prediction | Loss up to 100% |

### External vs Internal Trader Comparison

| Aspect | Internal Trader | External Trader |
|--------|-----------------|-----------------|
| LP shares | ✅ Yes (proportional to fees) | ❌ No |
| Fee rate (AMM) | 5% | 1% |
| Fee rate (OB) | N/A | 0.5% |
| Refund on expiry | ✅ Yes | N/A (post-graduation) |
| Liquidity depth | Lower (smaller b) | Higher (larger b) |

**Trade-off:**
- Internal: Higher fees, but fees become LP ownership
- External: Lower fees, but pure trading (no LP upside)

---

## Role 4: Protocol (Sooth Treasury)

### Profile
- Operates infrastructure, registry, frontend
- Incentivizes adjudicators
- Receives fees only AFTER graduation
- Shares in settlement profit (if positive)

### Revenue Streams

| Source | Phase | Amount |
|--------|-------|--------|
| 20% of external fees | Post-Graduation | Real-time |
| 20% of settlement profit | Settlement | If positive only |

### Profit Constraints

**Revenue Calculation:**
```
External Trading Volume: V
AMM volume (assume 70%): 0.7V × 1% = 0.007V
OB volume (assume 30%): 0.3V × 0.5% = 0.0015V
Total fees: 0.0085V

Protocol share (20%): 0.0017V

Example: $1M external volume
  Protocol revenue: $1,700
  
+ Settlement profit sharing:
  If LP pool ends with $5,000 profit
  Protocol receives: 20% × $5,000 = $1,000
```

**Revenue scales linearly with platform volume.**

### Loss Constraints

**Maximum Loss Scenario:**
```
Protocol does NOT share in losses:
  - If settlement results in LP loss, protocol takes nothing
  - Protocol's only cost is operational overhead
  
  Loss = Infrastructure costs - Fee revenue
```

**Protocol has NO exposure to market outcomes.**

### Revenue Allocation

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PROTOCOL REVENUE FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Protocol Revenue (20% fees + 20% profit)                          │
│                    │                                                 │
│         ┌──────────┴──────────┐                                     │
│         ▼                     ▼                                     │
│   ┌───────────┐        ┌───────────┐                                │
│   │ Adjudicator│        │ Treasury  │                                │
│   │ Incentives │        │ (Dev/Ops) │                                │
│   │   (TBD%)   │        │ (Remainder)│                               │
│   └───────────┘        └───────────┘                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Role 5: Adjudicator

### Profile
- Smart contract implementing `IAdjudicator`
- Chosen by creator at market creation
- Resolves market outcome
- Incentivized by protocol (not market-specific fees)

### Revenue Streams

| Source | Phase | Amount |
|--------|-------|--------|
| Protocol incentive | Ongoing | Based on successful resolutions |
| Staking rewards | Ongoing | If staking model implemented |

### Profit Constraints

**Incentive Model (Proposed):**
```
Per successful resolution:
  - Base reward: X SOOTH or USDC
  - Bonus for dispute-free resolution
  - Reputation score increase
  
Revenue = Number of markets × Reward per resolution
```

### Loss Constraints

**Maximum Loss Scenario:**
```
If adjudicator ruled incorrectly and disputed:
  - Reputation score decrease
  - Potential slashing (if staking implemented)
  - Removal from verified registry
  
Loss = Staked amount (if any) + Reputation damage
```

### Adjudicator Incentive Alignment

| Behavior | Outcome |
|----------|---------|
| Correct, timely resolution | Reward + reputation |
| Delayed resolution | Reduced reward |
| Incorrect resolution (disputed) | Slashing + reputation loss |
| Collusion with creator | Registry ban + slashing |

---

## Fee Flow Summary

### Internal Phase

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INTERNAL PHASE FEE FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Trader ──► AMM Trade ──► 5% Fee                                   │
│                              │                                       │
│                              ▼                                       │
│                    ┌─────────────────┐                              │
│                    │   100% → b      │                              │
│                    │  (Liquidity)    │                              │
│                    └─────────────────┘                              │
│                              │                                       │
│                              ▼                                       │
│                    LP shares minted                                  │
│                    (proportional to fee)                            │
│                                                                      │
│   Protocol Revenue: $0 (no monetization before graduation)          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Post-Graduation Phase

```
┌─────────────────────────────────────────────────────────────────────┐
│                    POST-GRADUATION FEE FLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Trader ──► AMM Trade ──► 1% Fee                                   │
│              OB Trade ──► 0.5% Fee                                  │
│                              │                                       │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│        ┌─────────┐     ┌─────────┐     ┌─────────┐                  │
│        │   50%   │     │   30%   │     │   20%   │                  │
│        │ → b     │     │→ LP Vault│    │→Protocol│                  │
│        │(liquidity)│   │(exchange │    │(treasury)│                 │
│        │         │     │ rate ↑) │     │         │                  │
│        └─────────┘     └─────────┘     └─────────┘                  │
│                              │                                       │
│                              ▼                                       │
│                    LP Vault totalAssets ↑                           │
│                    exchangeRate increases                           │
│                    (redeemable at settlement)                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Settlement Phase

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SETTLEMENT FEE FLOW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Settlement Pool = b (liquidity accumulated)                       │
│                              │                                       │
│              ┌───────────────┴───────────────┐                      │
│              ▼                               ▼                      │
│   ┌─────────────────────┐       ┌─────────────────────┐            │
│   │ Trader Claims       │       │ LP Settlement       │            │
│   │ (outcome-based)     │       │ (remaining pool)    │            │
│   └─────────────────────┘       └─────────────────────┘            │
│                                          │                          │
│                          ┌───────────────┴───────────────┐         │
│                          ▼                               ▼         │
│                   ┌─────────────┐                ┌─────────────┐   │
│                   │ If Profit:  │                │ If Loss:    │   │
│                   │ 80% → LP    │                │ 100% → LP   │   │
│                   │ 20% → Proto │                │ (absorbs)   │   │
│                   └─────────────┘                └─────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Expiry (Failed Graduation)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EXPIRY REFUND FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Total Pool = bBase + internalFees                                 │
│                              │                                       │
│                              ▼                                       │
│                    Pro-rata refund to                               │
│                    all LP shareholders                              │
│                              │                                       │
│              ┌───────────────┴───────────────┐                      │
│              ▼                               ▼                      │
│        ┌─────────────┐               ┌─────────────┐                │
│        │   Creator   │               │   Traders   │                │
│        │  (bBase %)  │               │  (fees %)   │                │
│        └─────────────┘               └─────────────┘                │
│                                                                      │
│   Protocol Revenue: $0 (no monetization on failed markets)          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Economic Invariants

### Invariant 1: Creator Loss Bounded by bBase

```
∀ markets:
  if expired:
    creatorRefund = bBase × (bBase / totalLP)  // pro-rata, ~100%
    creatorLoss = 0
    
  if graduated:
    creatorMaxLoss = bBase  // if LP pool fully depleted at settlement
    creatorMaxProfit = unbounded  // if market succeeds
    
  maxCreatorLoss = bBase (the initial USDC deposit)
```

### Invariant 2: LP Loss Bounded by Liquidity Pool

```
∀ LP shareholders:
  maxLoss <= proportionalShare × (bBase + totalFees)
  
  // LP cannot lose more than their pro-rata share of the pool
  // This includes maxLoss exposure from settlement
```

### Invariant 3: Protocol Has No Downside Exposure

```
∀ markets:
  if settlementProfit <= 0:
    protocolSettlementRevenue = 0
    
  protocolLoss = 0 (always)
```

### Invariant 4: LP Vault Assets Separate from Liquidity Pool

```
∀ external trades:
  lpVaultRevenue = tradeFees × 30%
  
  // This revenue goes to LP Vault (separate from liquidity pool)
  // Increases exchangeRate for LP token holders
  // NOT subject to maxLoss exposure from settlement
  // LP Vault assets are SAFE — only distributed at settlement
```

### Invariant 5: Total Fees Equal Total Distribution

```
∀ external trades:
  totalFee = ammFee + obFee
  
  totalFee == liquidityShare (50%) + lpShare (30%) + protocolShare (20%)
```

---

## Comparative Analysis: Roles

| Role | Profit Potential | Loss Potential | Risk Profile |
|------|-----------------|----------------|--------------|
| **Creator** | Uncapped (LP fees + settlement) | **bBase (if graduated + settlement loss)** | Medium risk, high reward |
| **Internal Trader** | Uncapped (trading + LP) | Trading: 100%, LP: fee contribution | Medium risk |
| **External Trader** | ~400-900% (trading only) | 100% of position | Standard PM risk |
| **Protocol** | Linear with volume | Zero | No risk |
| **Adjudicator** | Per-resolution rewards | Slashing + reputation | Reputation risk |

---

## Attack Vector Analysis

### Attack 1: Free Option (Information Asymmetry)

**Attack:**
```
1. Attacker has inside information on outcome
2. Trades heavily in Internal phase (low cost due to low b)
3. Waits for graduation
4. Profits from correct prediction
```

**Defense: Creator's `graduationThreshold`**
```
Higher threshold = More fees required = Higher cost to dominate
Attacker must pay 5% fee on all trades
Creator sets threshold based on topic sensitivity

Example:
  Attacker wants to buy $10,000 position at 5% fee = $500 cost
  If threshold is $500, attacker alone triggers graduation
  But attacker paid $500 in fees (significant friction)
```

**Residual Risk:** Moderate — attacker pays 5% for early access to thin liquidity.

### Attack 2: Wash Trading for LP Shares

**Attack:**
```
1. Attacker trades with self to accumulate LP shares
2. Pays 5% in fees, receives 100% back as LP shares
3. Dominates LP ownership cheaply
```

**Defense: Fees Are Real Cost**
```
Attacker pays: $1,000 × 5% = $50 in fees
Attacker receives: $50 in LP shares

LP shares only have value IF:
  - Market graduates AND
  - External volume generates fees AND
  - Settlement is profitable

If market fails: Attacker gets $50 refund (breakeven)
If market succeeds: Attacker's $50 competes with creator's bBase

No free lunch — LP shares cost real money to acquire.
```

**Residual Risk:** Low — wash trading has no inherent profit.

### Attack 3: Creator Rug (Abandon After Graduation)

**Attack:**
```
1. Creator launches market, invests bBase
2. Market graduates
3. Creator sells LP tokens, abandons market
4. No adjudication, market never settles
```

**Defense: Adjudicator Contract Enforcement**
```
Adjudicator is a contract with defined behavior
Market cannot settle without adjudicator call
If adjudicator fails:
  - Dispute mechanism activates
  - Fallback adjudicator (protocol-controlled)
  - Creator reputation damaged
```

**Residual Risk:** Low — adjudicator is smart contract, not creator-controlled.

### Attack 4: Adjudicator Collusion

**Attack:**
```
1. Creator and adjudicator collude
2. Creator takes large position
3. Adjudicator rules in creator's favor
4. Creator profits, other traders lose
```

**Defense: Registry + Reputation + Staking**
```
Verified adjudicator registry
Adjudicators stake collateral
Disputes slash adjudicator stake
Repeat offenders banned from registry

Creator using unverified adjudicator:
  - Market displayed with warning
  - Traders can choose not to participate
```

**Residual Risk:** Medium — requires robust dispute mechanism.

---

## Fee Allocator Module Design

### Requirements

1. **Real-time LP payouts** — 30% of external fees go directly to LP shareholders
2. **Liquidity accumulation** — 50% of external fees increase `b`
3. **Protocol revenue** — 20% of external fees to treasury
4. **Settlement profit sharing** — 20% of profit to protocol

### Interface

```solidity
interface IFeeAllocator {
    // Called on every trade
    function allocateTradeFee(
        address market,
        uint256 feeAmount,
        bool isInternal
    ) external;
    
    // Called at settlement
    function allocateSettlementProfit(
        address market,
        int256 profitOrLoss
    ) external;
    
    // View functions
    function getLPClaimable(address lp, address market) external view returns (uint256);
    function getProtocolClaimable() external view returns (uint256);
}
```

### State

```solidity
contract FeeAllocator {
    // Per-market tracking
    mapping(address => uint256) public marketLiquidityFees;    // 50% bucket
    mapping(address => uint256) public marketLPFees;           // 30% bucket
    mapping(address => uint256) public marketProtocolFees;     // 20% bucket
    
    // Per-LP tracking (for real-time claims)
    mapping(address => mapping(address => uint256)) public lpClaimable;  // lp => market => amount
    
    // Global protocol revenue
    uint256 public protocolClaimable;
}
```

---

## Summary: Why This Model Works

### For Creators
⚠️ Capital at risk: bBase exposed to settlement loss (if graduated)  
✅ Refund on expiry (no graduation = no loss)  
✅ Uncapped upside (LP shares scale with market success)  
✅ Strategic control (set graduationThreshold)  
✅ No SOOTH token requirement (USDC only)  

### For Internal Traders
✅ Fees become investment (LP shares)  
✅ Refund on expiry (no LP loss)  
✅ Early access to thin liquidity (potential alpha)  
✅ Tradeable LP tokens (exit before settlement)  

### For External Traders
✅ Lower fees than Internal (1% vs 5%)  
✅ Deeper liquidity (larger b)  
✅ Standard prediction market experience  
✅ Orderbook available  

### For Protocol
✅ No downside exposure  
✅ Revenue scales with volume  
✅ No pre-graduation costs (only earn on success)  
✅ Settlement profit participation  

### For Adjudicators
✅ Protocol-funded incentives  
✅ Reputation building  
✅ No per-market negotiation  

---

*Economics Status: Role analysis complete. Ready for implementation spec.*
