# Knowledge Base
> Sooth Protocol V4 — Canonical Facts

---

## Architecture
```
User ──► TraderVault ──┬──► Market[] ──► OutcomeToken[]
                       └──► GovernorVault (USDC Pool)

Authorization:
  Vault.isMarket[market]         = true
  Vault.isOutcomeToken[token]    = true
  Governor.authorized[market]    = true
  Market.traderVault             = Vault
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
b                 | Depth           | Liquidity param
```

---

## Precision
```
WAD       = 1e18           // All internal math
USDC_DEC  = 18             // MockUSDC uses 18 decimals (testnet)
SCALAR    = 1              // WAD / USDC = 1e18/1e18
LOCK      = 24 hours       // AMM sell lock duration (Lock-on-Sell)

Note: Real USDC is 6 decimals. Scalar would be 1e12.
      Testnet MockUSDC is 18 decimals for simplicity.
      Lock applies to SELL proceeds, not BUY shares.
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

### Governor Vault
```
// LP Shares (Vault Token)
shares_mint     = assets * totalSupply / totalAssets   // or 1:1 if first
shares_burn     = assets * totalSupply / totalAssets
assets_per_share = totalAssets / totalSupply

// Exposure Locking
lockedExposure[mktId]   = b × solvencyFactor(pYes)
totalLockedExposure     = Σ lockedExposure[all markets]
availableForWithdraw    = totalAssets - totalLockedExposure

// Solvency Factor (Dynamic based on YES price)
solvencyFactor(pYes) = pYes × ln(pYes) + (1-pYes) × ln(1-pYes)  // negative entropy
// At 50%: ≈ 0.693 (ln(2))
// At 90%: ≈ 0.325
// At 10%: ≈ 0.325

// Market PnL Tracking
marketReserves[mktId]   = cumulative PnL (signed)
  receiveFunds(mkt, amt) → reserves += amt, totalAssets += amt
  sendFunds(mkt, amt)    → reserves -= amt, totalAssets -= amt

// Config Defaults
defaultBBase       = 10000e18        // 10k USDC liquidity depth
defaultFeeBps      = 50              // 0.5%
reserveFactorBps   = 1000            // 10% buffer
```

### Dynamic Liquidity
```
// Market depth scales with trading activity
b_market = b_base + (net_reserves × reserveFactor / 10000)

// Example: b_base=10000, reserves=500, factor=1000 (10%)
// b = 10000 + (500 × 1000 / 10000) = 10050

// Fees reinvest into depth
trade → fee collected → reserves ↑ → b ↑ → slippage ↓
```

---

## Call Chains
```
AMM Buy:
  tradeAMM(mkt, 0, +Δ, max)
    → Market.executeAMMTrade() → updates qYes
    → Vault → Governor.receiveFunds()
    → credits ammPositions[user][mkt].yesShares
    → NO unlock time (shares always tradable)

AMM Sell (Lock-on-Sell):
  tradeAMM(mkt, 0, -Δ, min)
    → require yesShares >= Δ
    → Market.executeAMMTrade() → updates qYes
    → Governor.lockProceeds(marketId, user, netProceeds)
      → creates LockEntry{amount, unlockTime = now + 24h}
      → funds stay in Governor, earmarked for user
    → user.locked += netProceeds

Claim Unlocked:
  claimUnlocked()
    → Governor.claimUnlocked(user, traderVault)
      → iterates lock queue, claims expired entries
      → transfers USDC → TraderVault
    → credits user.available

Limit Order:
  placeOrder(mkt, out, price, amt, isBuy)
    → lock collateral in pending
    → Market.createOrder()
    → on match: onOrderMatched() → credit shares

Spot Sell:
  placeSpotOrder(mkt, out, price, amt)
    → lock shares from shareBalances
    → Market.createOrder() as opposite
    → on match: merge() → creditMergeProceeds()

Hybrid Sell:
  executeHybridSell(mkt, out, price, total)
    → spot = min(shareBalances, total)
    → short = total - spot
    → placeSpotOrder(spot) + placeOrder(short, isBuy=false)
```

---

## Deployments

### Base Sepolia (Chain 84532) — V4.5
```
Vault     = 0x48Efb2434383E87a4a143D2B07BeE73611f5423C
Governor  = 0xcB0f1305951d4BC6EF266790836aC62604cFA733
Fee       = 0xE570Ab7dBbB58241F2cD7E1D3E2dD43196DAee97
USDC      = 0x3E45bf96a8D866D796E168eE77a5fA7507D544F1
Market1   = 0x99CB8c0e3da2604518b8210589edcaB50Cc6f769 (Alien)
Token1    = 0x6C590f0cd0750043ad46Ec37D2d095De89506cfd
Market2   = 0x94D02d846a04A751e9e4f93A6684a30e043444Da (BTC)
Token2    = 0x7178301FDEe367DC0ad10215c466293f9E7CDc5e
```

### BNB Testnet (Chain 97) — V4.5
```
Vault     = 0x50293aD4e42593A8b081960c991c198729E81192
Governor  = 0x8629b9ca457F4088ec8346FAED61DA858FDB498d
Fee       = 0xbc7b155057Bb78BB8bF9c9F9Fa6bFCc931aEAF38
USDC      = 0x58F35BE6A5e3D2be4C3575853043322B02FEeD84
Market1   = 0xa852857A15a10692A5cF22cB2B5b707C8dD64cf8 (Alien)
Token1    = 0x4F0b73177dac5A7f5EA2dbCffd2b983B3719b39B
Market2   = 0x7c60001d89D9878B1f7C4180916fCc3ede592e8d (BTC)
Token2    = 0xaaE4610eEB6bF5FCf3775AcA69A5911691556995
```

### MegaETH Testnet (Chain 6343) — V4.5
```
Vault     = 0xdc980ac16626211a7c472a94a163440eb68c5bfc
Governor  = 0xdb0063ce93e445ff7a8916f6f5a093f80833494f
Fee       = 0x9dbdfe94e596262dff5d91c007bae2ba4d80a8f7
USDC      = 0x493da6e5c9de67ab50b2fb08d14865614189b5c2
Market1   = 0x89ba3fee2fb764ec297dc91bb874aa5bf88f204c (Alien)
Token1    = 0xda5979e913c8ce987d5c44e9d138e0cea87802ff
Market2   = 0xeb33e2f815306d936d4bdd2b33b2b68c16b62fa0 (BTC)
Token2    = 0xd8e977e9e7e81d29daec823bf60e0303e80281cb
```

---

## Errors
```
Revert String                       | Cause
------------------------------------|----------------------------------
"TraderVault: invalid market"       | market not in isMarket[]
"TraderVault: not market"           | caller is not a registered market
"TraderVault: not outcomeToken"     | caller is not a registered token
"TraderVault: insufficient balance" | available < required
"TraderVault: shares locked"        | block.timestamp < unlockTime
"TraderVault: slippage exceeded"    | cost > maxCost or proceeds < min
"GovernorVault: not authorized"     | caller not in authorizedSpender[]
"GovernorVault: Locked funds"       | withdraw would breach exposure
"Market: not trading"               | market settled or paused
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
TraderVault.placeOrder()            | none                | anyone
TraderVault.claimUnlocked()         | none                | anyone (own funds)
TraderVault.onOrderMatched()        | onlyMarket          | Market contracts
TraderVault.creditMergeProceeds()   | onlyOutcomeToken    | OutcomeToken
TraderVault.setMarket()             | onlyOwner           | deployer
TraderVault.setOutcomeToken()       | onlyOwner           | deployer
GovernorVault.receiveFunds()        | onlyAuthorized      | Markets/Vault
GovernorVault.sendFunds()           | onlyAuthorized      | Markets/Vault
GovernorVault.lockProceeds()        | onlyAuthorized      | TraderVault only
GovernorVault.claimUnlocked()       | onlyAuthorized      | TraderVault only
GovernorVault.setAuthorized()       | onlyOwner           | deployer
Market.executeAMMTrade()            | none                | TraderVault only*
Market.createOrder()                | none                | TraderVault only*
OutcomeToken.merge()                | none                | anyone (burns own)

* enforced by design (Vault calls on behalf of user)
```

---

```
Version: V4.6 | KB: v1.4 | Updated: 2025-12-12
Lock Model: Lock-on-Sell (proceeds locked 24h, shares always tradable)
```
