# Knowledge Base
> Sooth Protocol V7 — Canonical Facts

---

## Architecture (V7 Dual-Engine)
```
User ──► TraderVault ──┬──► LaunchpadMarket[] (each is its own vault)
                       │      └──► OutcomeToken (ERC1155)
                       ├──► SoothLiquidityVault (global locked proceeds)
                       └──► SoothAdjudicatorRegistry (allowlisted truth)

Factory:
  LaunchpadFactory.createMarket(..., adjudicator) → clones LaunchpadMarket + OutcomeToken

Authorization:
  Vault.isMarket[market]         = via factory check (dynamic)
  Market.traderVault             = TraderVault
  Market.adjudicator             = settlement resolver contract (manual/optimistic/brevis)
```

---

## Definitions
```
Code              | User Term       | Notes
------------------|-----------------|------------------
available         | Liquid          | Withdrawable USDC
pending           | Reserved        | Locked in orders
outcome=0         | YES             | First outcome
outcome=1         | NO              | Second outcome
deltaShares > 0   | Buy             | Purchasing
deltaShares < 0   | Sell            | Liquidating
isBuy=true        | Long            | Buy specified
isBuy=false       | Short           | Buy opposite
price             | Probability     | 0.6e18 = 60%
qYes/qNo          | Inventory       | LMSR state
b / bBase         | Depth           | Liquidity param
isGraduated       | Graduated       | Past bonding phase
adjudicator       | Resolver        | Truth-providing contract
tStar             | Truth Point     | Outcome probability at settlement
```

---

## Precision
```
WAD       = 1e18           // All AMM internal math
USDC_DEC  = 18             // MockUSDC uses 18 decimals (testnet)
SCALAR    = 1              // WAD / USDC = 1e18/1e18
LOCK      = 24 hours       // AMM sell lock duration (Lock-on-Sell)

Note: Real USDC is 6 decimals. Scalar would be 1e12.
      Testnet MockUSDC is 18 decimals for simplicity.
      Lock applies to SELL proceeds, not BUY shares.

V7 Pure WAD Architecture:
      AMM views (ammAssets, totalNetAssets, cost, fee) are 18-decimal WAD.
      Lock/transfer values are native asset decimals (6 for USDC).
```

---

## Formulas
```
// LMSR Price
P(YES) = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
P(NO)  = 1 - P(YES)

// Cost to trade
cost = b * ln(e^(q'Yes/b) + e^(q'No/b)) - b * ln(e^(qYes/b) + e^(qNo/b))

// Collateral
long_collateral  = price * amount
short_collateral = (1 - price) * amount

// Merge (redeem pair)
payout = min(yes, no) * 1e18
```

### Launchpad Market Economics
```
// Creator Deposit
maxLoss = bBase × 0.693 (ln(2))

// Graduation Threshold
bBase >= 2 × initial_b (doubled from creation)

// Pre-Graduation Fees (5%)
100% → bBase growth + 1:1 LP token mint

// Post-Graduation Fees (1%)
50% → bBase growth
30% → LP token accrual
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
AMM Buy (Safe Path):
  depositAndTradeAMM(mkt, 0, +Δ, max)
    → Transfers USDC from wallet if needed
    → Market.executeAMMTrade() → updates qYes
    → Market holds funds (is its own vault)

AMM Sell (Lock-on-Sell):
  tradeAMM(mkt, 0, -Δ, min)
    → require yesShares >= Δ
    → Market.executeAMMTrade() → updates qYes
    → Pre-grad: lock in market's FIFO queue
    → Post-grad: lock via global SoothLiquidityVault

Claim Unlocked:
  claimUnlocked(marketVault)
    → Iterates lock queue, claims expired entries
    → Transfers USDC → user's available balance

Limit Order:
  placeOrder(mkt, out, price, amt, isBuy)
    → lock collateral in pending
    → Market.createOrder()
    → on match: onOrderMatched() → credit shares

Settlement:
  Adjudicator.finalizeResolution(outcome, tStar)
    → Market.isLive = false
    → Traders redeem winning tokens
    → LP holders call redeemLP()
```

---

## Deployments

### Base Sepolia (Chain 84532) — V7.0.0
```
MockUSDC             = 0x7B61060a98D541f7C26fbC7e215FF9753c8D2a11
SoothFeeController   = 0xf2b1f87fDb1fb7c447B654647F565ad1A03227c4
SoothLiquidityVault  = 0xc0413700c172817897C09b14b5643ee7cCFcf34b
SoothTraderVaultV4   = 0x1C70bD3b70B065ACBb5AA81053D7F1aF8CF23045
ProtocolConfig       = 0xEA0f15e3650AEC0c6DF89Fe8C7443EA47CD4bc88
AdjudicatorRegistry  = 0x4C52a6277b1B84121b3072C0c92b6Be0b7CC10F1
LaunchpadFactory     = 0x2C2AdE29b81a6B47Cdd05CcAf06cF10E30d1318C
Market 1             = 0xE467bDC870BC1AEa7401Cc0a3C34ABCcA2c3C64D
Token 1              = 0x89F5FF36A6d684B3ba121FFc7437c84a7e453BA5
Market 2             = 0x5DBe9BB350407c604eDDABa86CbB59514F1A6EfD
Token 2              = 0x35aEA513cD336eF7c80FCAD9569B621ACfD17211
```

---

## Errors
```
Revert String                       | Cause
------------------------------------|----------------------------------
"TraderVault: invalid market"       | market not from factory
"TraderVault: not market"           | caller is not a registered market
"TraderVault: not outcomeToken"     | caller is not a registered token
"TraderVault: insufficient balance" | available < required
"TraderVault: slippage exceeded"    | cost > maxCost or proceeds < min
"SoothLiquidityVault: not authorized"| caller not authorized
"SoothLiquidityVault: Locked funds" | withdraw would breach exposure
"Market: not trading"               | market settled or paused
"Market: not graduated"             | orderbook requires graduation
"OutcomeToken: zero amount"         | merge(0) called
```

---

## Authorization
```
Function                            | Modifier            | Who Can Call
------------------------------------|---------------------|------------------
TraderVault.deposit()               | none                | anyone
TraderVault.withdraw()              | none                | anyone (own funds)
TraderVault.tradeAMM()              | none                | anyone
TraderVault.depositAndTradeAMM()    | none                | anyone (V7)
TraderVault.placeOrder()            | none                | anyone
TraderVault.claimUnlocked()         | none                | anyone (own funds)
TraderVault.onOrderMatched()        | onlyMarket          | Market contracts
TraderVault.creditMergeProceeds()   | onlyOutcomeToken    | OutcomeToken
TraderVault.setLaunchpadFactory()   | onlyOwner           | deployer
Market.executeAMMTrade()            | none                | TraderVault only*
Market.createOrder()                | none                | TraderVault only*
Market.finalizeResolution()         | onlyAdjudicator     | Adjudicator
Market.claimLockedOnMarketEnd()     | none                | anyone (after end)
OutcomeToken.merge()                | none                | anyone (burns own)

* enforced by design (Vault calls on behalf of user)
```

---

```
Version: V7.0.0 | KB: v3.0 | Updated: 2025-12-22
Architecture: V7 Dual-Engine (OB/AMM isolation)
Lock Model: Lock-on-Sell (proceeds locked 24h)
Settlement: Adjudicator-only (Registry-gated)
```
