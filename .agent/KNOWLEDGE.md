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
WAD       = 1e18
USDC_DEC  = 6
SCALAR    = 1e12        // WAD / USDC
LOCK      = 24 hours
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
    → sets unlockTime = now + 24h

AMM Sell:
  tradeAMM(mkt, 0, -Δ, min)
    → require unlockTime passed
    → require yesShares >= Δ
    → Market.executeAMMTrade() → updates qYes
    → Governor.sendFunds() → Vault
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

## Deployment (Base Sepolia)
```
Vault     = 0x8348A02D742e59B2ad9fe7Bfe354fAE01176d17d
Governor  = 0x6c60D3e25FEf9AECf3DC2F66287322641D8651Be
Fee       = 0x2300BBe091E5176410eCcb3c3710ef67781B68ff
USDC      = 0x2d2aed066c34523913ab7084b668bff3529cb176
Market1   = 0xEA44Fb3acaCF2527c54D8Ec787A50C87b2114535
Token1    = 0x47d955F5269b4addF51491D4e309bD1b052cc14D
Market2   = 0x6Ee804abCBc912A2831fdDdC9d36EeA68aef92cD
Token2    = 0x8bB9E039409fb1d21159E7dBd08faDFe1510C3C3
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
TraderVault.onOrderMatched()        | onlyMarket          | Market contracts
TraderVault.creditMergeProceeds()   | onlyOutcomeToken    | OutcomeToken
TraderVault.setMarket()             | onlyOwner           | deployer
TraderVault.setOutcomeToken()       | onlyOwner           | deployer
GovernorVault.receiveFunds()        | onlyAuthorized      | Markets/Vault
GovernorVault.sendFunds()           | onlyAuthorized      | Markets/Vault
GovernorVault.setAuthorized()       | onlyOwner           | deployer
Market.executeAMMTrade()            | none                | TraderVault only*
Market.createOrder()                | none                | TraderVault only*
OutcomeToken.merge()                | none                | anyone (burns own)

* enforced by design (Vault calls on behalf of user)
```

---

```
Version: V4.5 | KB: v1.2 | Updated: 2025-12-12
```
