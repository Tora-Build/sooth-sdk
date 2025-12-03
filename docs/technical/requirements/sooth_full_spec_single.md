
# SOOTH PROTOCOL — FULL ARCHITECTURE, LIQUIDITY & MICROSTRUCTURE SPEC  
### (Unified Single-File Edition, 2025)

---

## 1. Introduction

This document provides the complete, unified specification of the Sooth protocol’s:
- Vault architecture  
- LMSR core liquidity  
- Collateralized orderbook liquidity  
- Maker lifecycle  
- Adjudicator model (A–D classes)  
- Retroactive settlement (T*)  
- SmartAccount  
- Mathematical PnL model  
- Maker profitability simulator  

Sooth is an infinite-end prediction market protocol where markets end when the truth becomes known (**truth time T\***), not on a fixed timestamp.  

This architecture eliminates:
- Latency arbitrage  
- Free-option attacks  
- Oracle timing exploits  
- Adversarial settlement manipulation  

---

## 2. System Overview

```
Trader → SmartAccount → Market → { Orderbook → LMSR } → Vault  
                                    ↑             ↓
                               Maker Liquidity   Settlement (T*)
```

Key layers:
1. **Protocol Layer** – permissionless governance, global registry  
2. **Vault Layer** – adjudicator binding, core liquidity, risk manager  
3. **Market Layer** – orderbook + LMSR execution, lifecycle control  

---

## 3. Vault Architecture

### 3.1 Vault Properties
- Created permissionlessly  
- Scoped by `{chain, adjudicator class}`  
- Multiple vaults of same class allowed  
- Manages base LMSR liquidity  
- Holds LP capital  
- Runs Risk Manager to compute `b_global`

### 3.2 Risk Manager (b computation)
```
b_global = f(vaultCapital, adjudicatorLatency, riskClass, feeAccumulation, concurrentMarkets)
```

### 3.3 Exposure Allocation
- Markets draw bounded exposure from Vault  
- LMSR ensures Vault’s max loss per market ≤ `b * ln(2)`  
- Vault tracks exposure per market  

---

## 4. LMSR Core Liquidity

### 4.1 Pricing
Binary LMSR:
```
p_yes = exp(qYes / b) / (exp(qYes / b) + exp(qNo / b))
```

### 4.2 State
- `qYes`, `qNo`  
- Only updated when **LMSR fills trades**  
- Orderbook fills do not modify qYes/qNo  

### 4.3 Bounded Loss
For binary:
```
WorstCaseLoss = b * ln(2)
```

### 4.4 Purpose
LMSR is:
- Always available  
- Conservatively sized  
- Safety net  
- Fair price anchor  
- Not the main liquidity source  

---

## 5. Orderbook Liquidity (Collateralized Makers)

### 5.1 Core Idea
Makers **do not need to own YES/NO**.  
They open **short/long** positions by posting collateral equal to max loss.

### 5.2 Sell YES (short YES)
At price `P`, size `S`:
```
Maker collateral = (1 - P) * S
Maker revenue   = P * S
```

PnL at settlement T*:
```
If YES wins:  -(1-P)*S
If NO wins:    P*S
```

### 5.3 Buy YES (long YES)
Collateral:
```
P * S
```

### 5.4 Maker Lifecycle
1. Deposit collateral  
2. Place limit orders (short or long)  
3. Orders lock collateral  
4. Cancel orders to free collateral  
5. Re-quote markets  
6. Hedge via LMSR or correlated markets  
7. Settlement resolves PnL  

---

## 6. Matching Engine Specification

### 6.1 Unified Ladder Construction
For a buy YES order:

1. Collect best asks from orderbook  
2. Compute LMSR marginal prices  
3. Build ladder:
```
[orderbook asks] → [LMSR tail curve]
```

### 6.2 Execution Priority
1. Best price wins  
2. If equal prices → **orderbook first**, LMSR second  
3. Unfilled size spills into LMSR  

### 6.3 Effects
- Efficient execution  
- Tight spreads  
- Unlimited scalable depth  
- Conservatively safe fallback  

---

## 7. Adjudicator Layer (A/B/C/D)

### Class A – Optimistic
- UMA/Reality-style  
- Challenge window  
- Human-readable claims

### Class B – ZK Rules
- Fully on-chain deterministic truth  
- Proven via ZK circuit

### Class C – Oracle + ZK  
- Oracle gives raw data  
- ZK verifies derived condition (TWAP, min/max, thresholds)

### Class D – Attestation
- Committee-signed  
- Governance or subjective outcomes  

---

## 8. Retroactive Settlement (T*)

### 8.1 Flow
1. Adjudicator posts truth & T*  
2. Market freezes  
3. Off-chain engine:
   - streams events  
   - replays PnL  
   - builds Merkle tree  
4. Optionally generates ZK proof  
5. Vault applies settlement deltas  

### 8.2 Post-T* Trades
Economically rewound.  
Thus:
- No latency arbitrage  
- No oracle manipulation  
- No front-running of settlement  

---

## 9. SmartAccount

- User margin container  
- Stores positions  
- Deterministic identity simplifies ZK  
- Can hold collateral for maker orders  

---

## 10. Position Accounting Model

Each market tracks:
```
balanceYes[account]
balanceNo[account]
shortYes[account]
shortNo[account]
collateralLocked[account]
```

YES/NO tokens are **internal balances**, not ERC20s.

Orderbook does NOT mint/burn YES/NO:
- It only transfers positions  
- LMSR mint/burn adjusts qYes/qNo  

---

## 11. Mathematical PnL Model (Makers)

### 11.1 PnL Components
```
p = trade price
S = size
Outcome ∈ {YES, NO}
```

### 11.2 Short YES payoff
```
If YES wins:  -(1-p)*S
If NO wins:    p*S
```

### 11.3 Expected Value
Given subjective probability `µ = Prob(YES)`:
```
EV_shortYES = µ * (-(1-p)*S) + (1-µ)*(p*S)
```

### 11.4 Variance
```
Var_shortYES = µ*( (-(1-p)*S - EV)^2 ) + (1-µ)*( (p*S - EV)^2 )
```

### 11.5 Spread Capture Strategy
Maker quotes:
```
bid = p - s
ask = p + s
```
EV increases with fill balance and volatility of mid-price.

---

## 12. Maker Profitability Simulator

```python
import numpy as np

def simulate_maker(P_sell=0.55, size=100, prob_yes=0.5, runs=20000):
    pnl = []
    for _ in range(runs):
        yes = np.random.rand() < prob_yes
        if yes:
            pnl.append(-(1-P_sell)*size)
        else:
            pnl.append(P_sell*size)
    return np.array(pnl)

if __name__=='__main__':
    arr = simulate_maker()
    print('Mean:', arr.mean())
    print('Std:', arr.std())
```

---

## 13. Final Summary

### LMSR → Safety, fallback, price anchoring  
### Orderbook → Scalable depth, maker competitiveness  
### Settlement (T*) → No latency games, perfect fairness  
### Vault → Unified liquidity per adjudicator class  
### SmartAccount → Safe margin container  

This architecture is **complete, scalable, and economically optimal** for infinite-end prediction markets.

