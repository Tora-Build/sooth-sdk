# Knowledge Base
> Sooth Protocol V8.2 — Canonical Facts

---

## Architecture (V8.1 Modular)
```
User ──► LaunchpadEngine ──┬──► AMMEngine (LMSR trading, 24h locks)
              │            ├──► TruthMarket (lifecycle authority)
              │            └──► Collateralizer (split/merge/redeem)
              │
              └──► TickBook (orderbook venue, separate from AMM)

No Custody Layer:
  Users manage USDC via their preferred wallet (EOA, Safe, Smart Account)
  Direct USDC transfers at trade boundaries

Pull-Based Lifecycle:
  All venues query TruthMarket.isLive() and TruthMarket.isSettled()
  No callbacks or hooks between contracts
```

---

## Definitions
```
Code              | User Term       | Notes
------------------|-----------------|------------------
available         | Liquid          | Withdrawable USDC
outcome=0         | YES             | First outcome
outcome=1         | NO              | Second outcome
yesShares         | YES Position    | User's long YES tokens (V8.2)
noShares          | NO Position     | User's long NO tokens (V8.2)
deltaShares > 0   | Buy             | Buying shares of the outcome
deltaShares < 0   | Sell            | Selling shares of the outcome
price             | Probability     | 0.6e18 = 60%
qYes/qNo          | Inventory       | LMSR state
b / bBase         | Depth           | Liquidity param
isGraduated       | Graduated       | Past bonding phase
adjudicator       | Resolver        | Truth-providing contract
tStar             | Truth Point     | When outcome became known
Row-Level Report  | Aggregate Value | Portfolio value summing pattern
```

## V8.2 Position Model (CRITICAL)
```
DUAL-BALANCE MODEL:
  struct Position {
      uint256 yesShares;  // User's YES position (always ≥ 0)
      uint256 noShares;   // User's NO position (always ≥ 0)
  }

KEY CHANGE FROM V8.1:
  - V8.1: int256 shares (positive=YES, negative=NO, forced netting)
  - V8.2: Separate yesShares and noShares (no netting, can hold both)

TRADE FUNCTION SIGNATURE:
  tradePositions(address market, uint8 outcome, int256 deltaShares, uint256 maxCost)
  - outcome: 0 = YES, 1 = NO
  - deltaShares > 0: Buy the outcome
  - deltaShares < 0: Sell the outcome (requires sufficient shares)

GET POSITION RETURNS:
  (uint256 yesShares, uint256 noShares)

FRONTEND HOOKS:
  - useAMMPositionDirect(market) → { yesShares, noShares }
  - useAMMQuoteDirect(market, shares, outcome, isBuy) → { cost, fee, priceImpact }
```

---

## Precision
```
WAD       = 1e18           // All internal math (AMMEngine, LaunchpadEngine)
USDC_DEC  = 6              // Standard USDC uses 6 decimals (CAUTION: 18 on Base Sepolia MockUSDC)
SCALAR    = 1e12           // WAD / USDC = 1e18/1e6
LOCK      = 24 hours       // AMM sell lock duration (Lock-on-Sell)

CRITICAL BOUNDARY RULE:
  - Contract math is in WAD (18 decimals)
  - USDC transfers are in token decimals (usually 6, but check usdc.decimals())
  - Use _wadToUsdc() and _usdcToWad() at transfer boundaries
  - Ceil for transfers TO contract, floor for transfers FROM contract
```

---

## Formulas
```
// LMSR Price
P(YES) = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
P(NO)  = 1 - P(YES)

// Cost to reach state (qYes, qNo)
C(q) = b * ln(e^(qYes/b) + e^(qNo/b))

// Swap P&L (AMM Revenue)
Swap_PnL = C(q_current) - C(0, 0)

// AMM Accounting (Gross Cash)
AMM_Cash = Initial_Seed + Fees + Swap_PnL + LP_Yield

// Equity Floor (Worst Case)
Liability = max(qYes, qNo)
Floor = max(0, AMM_Cash - Liability)

// Exchange Rate
ExRate = Floor / LP_Supply
```

### Launchpad Market Economics
```
// Creator Deposit = Max Loss
deposit = bBase × ln(2) ≈ bBase × 0.693

// Graduation Threshold
threshold = bBase × ln(2) × multiplier
graduated when: feesAccrued >= threshold

default: multiplier = 1 (break-even: fees = creator deposit)
option:  multiplier = 2 (2× break-even for extra safety margin)

// Pre-Graduation Fees (default 5%)
100% → bBase growth + 1:1 LP token mint to trader

// Post-Graduation Fees (default 1%)
50% → bBase growth
30% → LP yield pool
20% → Protocol treasury
```

### LP Valuation (LMSR Accounting)
```
// Gross Cash = LMSR Cost Function Value
// This represents total cash in the AMM needed to cover all obligations
Gross = C(qYes, qNo, bCurrent) = bCurrent × ln(e^(qYes/b) + e^(qNo/b))

// Liability = worst-case payout to traders
Liability = max(qYes, qNo)

// Floor Value (Guaranteed LP Equity)
Floor = Gross - max(qYes, qNo)

// Ceiling Value (Best Case LP Equity)
Ceiling = Gross - min(qYes, qNo)

// Exchange Rate (LP token value)
ExRate = Floor / LP_Supply

// Note: With dynamic b (fee reinvestment), don't try to decompose
// Gross into "Seed + Fees + P&L" - the cost function changes non-linearly.
```

---

## Call Chains
```
AMM Buy YES (via LaunchpadEngine):
  LaunchpadEngine.tradePositions(market, 0, +Δ, maxCost)
    → Calculates fee (5% pre-grad, 1% post-grad)
    → Calls AMMEngine.tradePositionsFor(user, market, 0, +Δ, ...) 
    → Updates user's yesShares += Δ
    → Mints LP tokens to trader (pre-grad only)
    → Transfers USDC from user (WAD → USDC conversion)

AMM Buy NO (via LaunchpadEngine):
  LaunchpadEngine.tradePositions(market, 1, +Δ, maxCost)
    → Same as above, but updates noShares += Δ

AMM Sell YES (Lock-on-Sell):
  LaunchpadEngine.tradePositions(market, 0, -Δ, minProceeds)
    → Requires user.yesShares >= Δ
    → AMMEngine.tradePositionsFor() executes trade
    → Updates user's yesShares -= Δ
    → Proceeds locked for 24 hours
    → Locked funds spendable (can buy other markets)
    → After 24h: withdrawable to wallet

AMM Sell NO (Lock-on-Sell):
  LaunchpadEngine.tradePositions(market, 1, -Δ, minProceeds)
    → Same as above, but updates noShares -= Δ

Token Operations:
  Collateralizer.split(market, amount)
    → Burns USDC, mints YES + NO tokens
  Collateralizer.merge(market, amount)
    → Burns YES + NO, returns USDC
  Collateralizer.redeem(market, outcome, amount)
    → After settlement: winning token → USDC

Settlement:
  Adjudicator.finalizeResolution(outcome, tStar)
    → TruthMarket.isSettled = true
    → TruthMarket.winningOutcome = outcome
    → Traders redeem via Collateralizer
    → LPs call LaunchpadEngine.redeemLP()
```

---

## Deployments

### Base Sepolia (Chain 84532) — V8.4.0 (QA Hardened)
```
LaunchpadEngine   = 0xaf8e68Dfc5e129a33735EE7Df900500D9bb37c88
Collateralizer    = 0xc3b53dAcbEE7F240a2c9Da05cef8ac7AbE02A767
AMMEngine         = 0x2646453758922d1500362AAbc385A8cf02D82ee9
TickBook          = 0xDb710FA6B587ba2e6fB56a0D5166C029f6852D57
USDC (MockUSDC)   = 0x856fbeebd91db28e3b4550e7602142cfab683796
```

### MegaETH Frontier (Chain 4326) — V6 (Legacy)
```
MockUSDC           = 0xeb33e2f815306d936d4bdd2b33b2b68c16b62fa0
LaunchpadFactory   = 0x347a74a7025c42be608f3bdc0b150d4ad6eb4674
Market 1 (Alien)   = 0x813F5A52d0dBD948e848b656e2415a57c5dE27B3
Market 2 (BTC)     = 0x8E8895A78bDdFbb2C04C7b382b8a1D773811a4Df
```

---

## Errors
```
Revert String                              | Cause
-------------------------------------------|----------------------------------
"LaunchpadEngine: zero usdc"               | Constructor: USDC address is 0
"LaunchpadEngine: zero ammEngine"          | Constructor: AMMEngine is 0
"LaunchpadEngine: market not created"      | Trading on unregistered market
"LaunchpadEngine: not creator"             | Non-creator calling creator-only
"LaunchpadEngine: already graduated"       | Action not allowed post-graduation
"LaunchpadEngine: insufficient LP"         | Redeeming more LP than balance
"AMMEngine: market not live"               | Trading on settled market
"AMMEngine: slippage exceeded"             | Cost > maxCost
"Collateralizer: not settled"              | Redeeming before settlement
"Collateralizer: invalid outcome"          | Redeeming losing tokens
"TruthMarket: not adjudicator"             | Non-adjudicator calling settle
"TruthMarket: already settled"             | Double settlement attempt
```

---

## Authorization
```
Function                                | Modifier            | Who Can Call
----------------------------------------|---------------------|------------------
LaunchpadEngine.createMarket()          | none                | anyone
LaunchpadEngine.tradePositions()        | none                | anyone
LaunchpadEngine.redeemLP()              | none                | anyone (own LP)
LaunchpadEngine.setPreGradFeeBps()      | onlyOwner           | protocol owner
LaunchpadEngine.setPostGradFeeBps()     | onlyOwner           | protocol owner
LaunchpadEngine.setFeeSplits()          | onlyOwner           | protocol owner
AMMEngine.tradePositions()              | none                | LaunchpadEngine
AMMEngine.getPositionQuote()            | view                | anyone
Collateralizer.split()                  | none                | anyone
Collateralizer.merge()                  | none                | anyone
Collateralizer.redeem()                 | none                | anyone (post-settle)
TruthMarket.activate()                  | onlyCreator         | creator
TruthMarket.finalizeResolution()        | onlyAdjudicator     | adjudicator
```

---

## Governance Parameters
```
Parameter               | Default   | Range      | Setter Function
------------------------|-----------|------------|---------------------------
preGradFeeBps           | 500 (5%)  | 0-1000     | setPreGradFeeBps()
postGradFeeBps          | 100 (1%)  | 0-500      | setPostGradFeeBps()
bBaseShareBps           | 5000 (50%)| 0-10000    | setFeeSplits()
lpYieldShareBps         | 3000 (30%)| 0-10000    | setFeeSplits()
protocolShareBps        | 2000 (20%)| 0-10000    | setFeeSplits()
graduationMultiplier    | 1         | 1-10       | setGraduationMultiplier()

Graduation formula: threshold = bBase × ln(2) × multiplier
  - multiplier=1: graduate at break-even (fees = creator deposit)
  - multiplier=2: graduate at 2× break-even
```

---

## TickBook Maker/Taker Fee System (V9.7)

```
TAKER: fee = baseFee + volatilityFee → sent to feeRecipient
MAKER: rebate = volumeDiscount - makerBaseFee → reduces collateralUsed

See: packages/contracts-evm/docs/research/V9/TICKBOOK_FEES.md for full documentation
```

---

---

## Infinite Deadline Handling

Markets resolved by truth (not time) use "infinite" deadline.

```
IMPLEMENTATION:
  deadline = 'infinite' → timestamp 7258118399 (Dec 31, 2199 23:59:59 UTC)

WHY NOT MAX UINT64:
  - Max uint64 (18446744073709551615) exceeds JavaScript Number.MAX_SAFE_INTEGER
  - Would cause precision loss and display bugs in frontend
  - Year 2199 is effectively infinite for prediction markets

FRONTEND DISPLAY:
  - Threshold: 4102444800 (year 2100)
  - deadline > threshold → show "No expiry"
  - deadline > threshold → never mark as "expired"

CONTRACT VALIDATION:
  - TruthMarket requires: deadline > block.timestamp
  - Year 2199 passes validation on all chains

FILES:
  - CLI: packages/contracts-testing/script/interactive/commands/market.ts
  - SDK: apps/web/src/lib/sdk/commands/market.ts
  - UI:  apps/web/src/components/features/launchpad/MarketDetailHeader.tsx
  - UI:  apps/web/src/components/features/market/MarketCard.tsx
```

---

## V11 Trial Period (CRITICAL)

```
TRIAL PERIOD = 7-DAY PROVING GROUND

Purpose: Protect traders from failed markets while allowing successful markets to continue.

FLOW:
  Market Created → TRIAL (7 days) → Evaluate graduation status:
    - GRADUATED → Market continues (no dismiss allowed)
    - NOT GRADUATED → Creator can dismiss, traders get refunds

DISMISS CONDITIONS (ALL must be true):
  1. block.timestamp >= trialEndTime  (trial period ended)
  2. !isGraduated                     (market failed to gain traction)
  3. !isDismissed                     (not already dismissed)
  4. msg.sender == creator            (only creator can dismiss)

KEY INSIGHT:
  Graduation PROTECTS traders. If a market proves traction (enough fees),
  the creator cannot pull the rug.

STORAGE:
  struct TrialState {
      uint64 trialEndTime;       // creation + 7 days
      bool isDismissed;          // creator dismissed after trial
      uint256 totalLockedCost;   // refundable amount
  }
  mapping(address => mapping(address => uint256)) userLockedCost;

FUNCTIONS:
  dismissMarket(market)  → Creator aborts after trial if not graduated
  claimRefund(market)    → Trader recovers locked cost after dismissal

DEFAULT_TRIAL_PERIOD = 7 days = 604800 seconds
```

---

```
Version: V11.0 | KB: v5.6 | Updated: 2026-01-24
Architecture: V10 Unified Crossing (TickBookPoolManager)
Position Model: Dual-Balance (yesShares + noShares, can hold both)
Lock Model: Lock-on-Sell (proceeds locked 24h, spendable immediately)
Settlement: Pull-based via TruthMarket
Custody: None (direct USDC transfers)
Graduation: threshold = bBase × ln(2) × multiplier (LP break-even based)
TickBook Fees: Maker/Taker split (taker pays volatility, maker gets rebate)
Infinite Deadline: Year 2199 (7258118399), display "No expiry" for > year 2100
Trial Period: 7-day proving ground, dismiss only AFTER trial AND if NOT graduated
```
