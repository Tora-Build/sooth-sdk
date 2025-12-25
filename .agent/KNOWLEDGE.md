# Knowledge Base
> Sooth Protocol V8.1 — Canonical Facts

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
deltaShares > 0   | Long YES        | Buy YES shares
deltaShares < 0   | Long NO         | Buy NO shares (sell YES)
price             | Probability     | 0.6e18 = 60%
qYes/qNo          | Inventory       | LMSR state
b / bBase         | Depth           | Liquidity param
isGraduated       | Graduated       | Past bonding phase
adjudicator       | Resolver        | Truth-providing contract
tStar             | Truth Point     | When outcome became known
```

---

## Precision
```
WAD       = 1e18           // All internal math (AMMEngine, LaunchpadEngine)
USDC_DEC  = 6              // Standard USDC uses 6 decimals
SCALAR    = 1e12           // WAD / USDC = 1e18/1e6
LOCK      = 24 hours       // AMM sell lock duration (Lock-on-Sell)

CRITICAL BOUNDARY RULE:
  - Contract math is in WAD (18 decimals)
  - USDC transfers are in token decimals (6)
  - Use _wadToUsdc() and _usdcToWad() at transfer boundaries
  - Ceil for transfers TO contract, floor for transfers FROM contract
```

---

## Formulas
```
// LMSR Price
P(YES) = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
P(NO)  = 1 - P(YES)

// Cost to trade
cost = b * ln(e^(q'Yes/b) + e^(q'No/b)) - b * ln(e^(qYes/b) + e^(qNo/b))

// Collateral (Collateralizer)
split:  1 USDC → 1 YES + 1 NO
merge:  1 YES + 1 NO → 1 USDC
redeem: 1 winning token → 1 USDC (after settlement)
```

### Launchpad Market Economics
```
// Creator Deposit
maxLoss = bBase × 0.693 (ln(2))

// Graduation Threshold (default)
graduated when: feesAccrued >= bBase × graduationMultiplier
default: graduationMultiplier = 2 (2× bBase)

// Pre-Graduation Fees (default 5%)
100% → bBase growth + 1:1 LP token mint to trader

// Post-Graduation Fees (default 1%)
50% → bBase growth
30% → LP yield pool
20% → Protocol treasury
```

### LP Valuation (Honest Floor Model)
```
// AMM Ledger (Pure Accounting)
AMM_Cash = Initial_Seed + Fees + (Current_LMSR_Cost - Initial_LMSR_Cost)

// Floor Value (Worst Case)
Floor = AMM_Cash - max(qYes, qNo)

// Ceiling Value (Best Case)
Ceiling = AMM_Cash - min(qYes, qNo)

// Exchange Rate
ExRate = Floor / LP_Supply
```

---

## Call Chains
```
AMM Buy (via LaunchpadEngine):
  LaunchpadEngine.tradePositions(market, +Δ, maxCost)
    → Calculates fee (5% pre-grad, 1% post-grad)
    → Calls AMMEngine.tradePositions() for LMSR execution
    → Mints LP tokens to trader (pre-grad only)
    → Transfers USDC from user (WAD → USDC conversion)

AMM Sell (Lock-on-Sell):
  LaunchpadEngine.tradePositions(market, -Δ, minProceeds)
    → AMMEngine.tradePositions() executes trade
    → Proceeds locked for 24 hours
    → Locked funds spendable (can buy other markets)
    → After 24h: withdrawable to wallet

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

### Base Sepolia (Chain 84532) — V8.1.0
```
LaunchpadEngine   = 0xFf422cc9b537BD41DD2583E3E611CA2eF1C149B4
Collateralizer    = 0x2C60E3A96334E449C92C7d035E51EB8A6dA9245E
AMMEngine         = 0x35089e985E23D01b4D2E453E775D570649624E8E
TickBook          = 0xEDe4d7AAa1311A6391Dd203E5E728bb6489575aF
Market 1 (Alien)  = 0xa67D75Bb57e6aBe59Cc6E8d102b319D894919ef1
Market 2 (BTC)    = 0xAbEf550048C255B6513fF9B28EaFC6bF1e27b089
Market 3 (ETH5K)  = 0xcdE5B0b2dD6b229d8d6195D14CBAb726025ECd18
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
graduationMultiplier    | 2         | 1-10       | setGraduationMultiplier()
```

---

```
Version: V8.1.0 | KB: v4.0 | Updated: 2025-12-25
Architecture: V8 Modular (Domain Isolation)
Lock Model: Lock-on-Sell (proceeds locked 24h, spendable immediately)
Settlement: Pull-based via TruthMarket
Custody: None (direct USDC transfers)
```
