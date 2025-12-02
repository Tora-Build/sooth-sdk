# Complete Flow: What Determines bGlobal, Buffer, and bMarket

## Key Insight: Treasury vs Buffer

**IMPORTANT:** The naming is confusing in the code!

```solidity
// From SoothVault.sol
getTreasuryBalance() = totalAssets
getLiquidBufferBalance() = totalAssets - totalLockedExposure
```

**These are NOT separate pools!** They're two different views of the same vault:

- **Treasury** = Total vault assets
- **Buffer** = Unlocked (available) portion of vault assets

---

## The Complete Flow

### 1. Initial Configuration (Set by Owner)

```
┌──────────────────────────────────────┐
│ K = 10                               │  ← Max concurrent worst-case markets
│ (maxConcurrentWorstCase)             │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Risk Class Multipliers:              │
│   LOW:      6000 bps  (60%)          │
│   MEDIUM:  10000 bps (100%)          │
│   HIGH:    14000 bps (140%)          │
│   CRITICAL: 18000 bps (180%)         │
└──────────────────────────────────────┘
```

---

### 2. LP Deposits USDC

```
LP deposits 100,000 USDC
    ↓
Vault receives 100,000 USDC
    ↓
LP receives 100,000 svTokens (1:1 exchange)
    ↓
┌──────────────────────────────────────┐
│ Vault State:                         │
│   totalAssets = 100,000              │
│   totalLockedExposure = 0            │
│   totalSupply (LP shares) = 100,000  │
└──────────────────────────────────────┘
```

---

### 3. Market Creation Triggers updateGlobalB()

```
Factory calls: riskManager.updateGlobalB()
    ↓
┌──────────────────────────────────────────────────────┐
│ RiskManager reads from Vault:                        │
│                                                       │
│   T_raw = vault.getTreasuryBalance()                 │
│        = totalAssets                                 │
│        = 100,000 USDC                                │
│                                                       │
│   B_raw = vault.getLiquidBufferBalance()             │
│        = totalAssets - totalLockedExposure           │
│        = 100,000 - 0                                 │
│        = 100,000 USDC                                │
└───────────────────────────────────────────┌─────────────────────────────────────────────────────────────────┐
│              bGLOBAL CALCULATION                                 │
│              (In SoothRiskManager.sol)                          │
│                                                                  │
│  Step 1: Get vault balances                                     │
│    T = vault.getTreasuryBalance() (Total Assets)                │
│    B = vault.getLiquidBufferBalance() (Available Assets)        │
│                                                                  │
│  Step 2: Calculate Lmax (Soft Cap Model)                        │
│    fairShare = T / K                                            │
│    Lmax = min(fairShare, B)                                     │
│                                                                  │
│    Logic:                                                       │
│    - Give fair share (T/K) if buffer permits                    │
│    - If buffer low (Market K+1), give remaining B               │
│                                                                  │
│  Step 3: Calculate bGlobal                                      │
│    bGlobal = Lmax * 1.4427                                      │
│                                                                  │
│  STORED: globalRisk.bGlobal = bGlobal                           │
└─────────────────────────────────────────────────────────────────┘

**Wait, why is T + B = 2 \* totalAssets?**

Because:

- T = totalAssets
- B = totalAssets - totalLockedExposure
- When totalLockedExposure = 0:
  - T + B = totalAssets + totalAssets = 2 \* totalAssets

**This seems like a bug or confusing design!**

Let me check if this is intentional by looking at what happens after exposure is allocated...

---

### 4. Calculate bMarket for New Market

```

Market created with risk class = MEDIUM
↓
┌──────────────────────────────────────────────────────┐
│ bMarket = bGlobal _ riskMultiplier / 10000 │
│ = 28,854 _ 10000 / 10000 │
│ = 28,854 USDC │
└──────────────────────────────────────────────────────┘

```

---

### 5. Allocate Exposure for Market

```

Factory calculates:
Lmax_market = bMarket _ ln(2)
≈ 28,854 _ 0.693
≈ 20,000 USDC
↓
Factory calls: vault.allocateExposure(marketId, 20,000)
↓
┌──────────────────────────────────────────────────────┐
│ Vault State Updated: │
│ totalAssets = 100,000 (unchanged) │
│ totalLockedExposure = 20,000 │
└──────────────────────────────────────────────────────┘

```

---

### 6. After First Market Created

```

Now if we calculate T + B again:

T = totalAssets = 100,000
B = totalAssets - totalLockedExposure
= 100,000 - 20,000
= 80,000

T + B = 100,000 + 80,000 = 180,000

If we create a second market:
Lmax = 180,000 / 10 = 18,000
bGlobal = 18,000 \* 1.4427 ≈ 25,969

bGlobal decreased because buffer decreased!

```

---

## The Formula Explained

### Why T + B?

Looking at the formula:

```

Lmax = (T + B) / K

```

Where:

- T = totalAssets
- B = totalAssets - totalLockedExposure

This expands to:

```

Lmax = (totalAssets + totalAssets - totalLockedExposure) / K
= (2 \* totalAssets - totalLockedExposure) / K

```

**Interpretation:**

- Start with 2x the total vault size
- Subtract what's already locked
- Divide by max concurrent markets

This effectively gives each new market a budget based on:

1. Total vault capital (counted twice for some reason?)
2. Minus what's already committed
3. Divided by how many markets could fail simultaneously

---

## Concrete Example: Creating Multiple Markets

### Starting State

```

totalAssets = 100,000 USDC
totalLockedExposure = 0
K = 10

```

### Market 1 (MEDIUM risk)

```

T + B = 100,000 + 100,000 = 200,000
Lmax = 200,000 / 10 = 20,000
bGlobal = 20,000 _ 1.4427 = 28,854
bMarket = 28,854 _ 100% = 28,854
Exposure allocated = 28,854 \* 0.693 ≈ 20,000

New state:
totalLockedExposure = 20,000

```

### Market 2 (MEDIUM risk)

```

T + B = 100,000 + (100,000 - 20,000) = 180,000
Lmax = 180,000 / 10 = 18,000
bGlobal = 18,000 _ 1.4427 = 25,969
bMarket = 25,969 _ 100% = 25,969
Exposure allocated = 25,969 \* 0.693 ≈ 18,000

New state:
totalLockedExposure = 38,000

```

### Market 3 (MEDIUM risk)

```

T + B = 100,000 + (100,000 - 38,000) = 162,000
Lmax = 162,000 / 10 = 16,200
bGlobal = 16,200 _ 1.4427 = 23,372
bMarket = 23,372 _ 100% = 23,372
Exposure allocated = 23,372 \* 0.693 ≈ 16,200

New state:
totalLockedExposure = 54,200

```

**Pattern:** Each new market gets less liquidity depth as more exposure is locked!

---

## Summary: What Determines Each Value

### bGlobal

**Determined by:**

1. **totalAssets** (from LP deposits)
2. **totalLockedExposure** (from previous markets)
3. **K** (configured by owner, default 10)

**Formula:**

```

bGlobal = ((2 _ totalAssets - totalLockedExposure) / K) _ 1.4427

```

### Treasury (T)

**Determined by:**

- **totalAssets** only
- T = totalAssets

### Buffer (B)

**Determined by:**

- **totalAssets** (from LP deposits)
- **totalLockedExposure** (from markets created)
- B = totalAssets - totalLockedExposure

### bMarket

**Determined by:**

1. **bGlobal** (calculated above)
2. **Risk class** of the market (set when market is created)

**Formula:**

```

bMarket = bGlobal \* riskMultiplier / 10000

```

---

## Key Takeaways

1. **T + B is NOT two separate pools** - it's a confusing way to count totalAssets twice minus locked exposure

2. **bGlobal decreases** as more markets are created (because buffer shrinks)

3. **First market gets most liquidity**, subsequent markets get progressively less

4. **K controls** how much liquidity each market can access (higher K = less per market)

5. **Risk class** scales the base bGlobal up or down for individual markets
```
