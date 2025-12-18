# Market Vault Accounting Research

## Current Issue: TVL Shows $0

**Root Cause:** MockUSDC has 18 decimals, but Factory expects 6 decimals (like real USDC).

```solidity
// MockUSDC.sol
uint8 public constant decimals = 18;  // ❌ Should be 6

// LaunchpadFactory.sol - expects 6 decimals
tierDeposits[1] = 1000 * 1e6;  // 1,000,000,000 tokens
```

**Result:** 
- Tier 1 deposit = 1,000,000,000 tokens
- With 18 decimals: 1e9 / 1e18 = 0.000000001 USDC ≈ **$0**
- With 6 decimals: 1e9 / 1e6 = 1,000 USDC = **$1,000** ✓

**Fix Required:** Redeploy MockUSDC with 6 decimals OR adjust Factory tier amounts for 18 decimals.

---

## Market Vault Accounting Model

### Key Concepts

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LAUNCHPAD MARKET                             │
├─────────────────────────────────────────────────────────────────────┤
│  ASSETS (USDC Balance)                                              │
│  ├── Creator Deposit (initial seed)                                 │
│  ├── Buy Premiums (cost - shares)                                   │
│  └── Sell Proceeds (shares sold back)                               │
│                                                                     │
│  LIABILITIES                                                        │
│  ├── Outstanding YES shares (qYes) - pay if YES wins                │
│  └── Outstanding NO shares (qNo) - pay if NO wins                   │
│                                                                     │
│  LP TOKENS                                                          │
│  ├── Creator LP (= initial deposit, minted at creation)             │
│  └── Trader LP (= fees paid, minted on trade)                       │
└─────────────────────────────────────────────────────────────────────┘
```

### On-Chain Values

| Field | Description | Decimals | Contract Function |
|-------|-------------|----------|-------------------|
| `totalAssets()` | USDC balance in market | 6 (USDC) | `_asset.balanceOf(address(this))` |
| `totalSupply()` | Total LP tokens | 6 (matches USDC) | ERC20.totalSupply() |
| `totalCreatorDeposit` | Initial seed from creator | 6 (USDC) | storage |
| `feesAccrued` | Cumulative trading fees | 6 (USDC) | storage |
| `bBase` | Base liquidity parameter | 18 (WAD) | storage |
| `b()` | Effective liquidity (= bBase for launchpad) | 18 (WAD) | view |
| `graduationThreshold()` | Target bBase (2x initial) | 18 (WAD) | `getLiquidityB(tier) * 2` |
| `qYes` | Outstanding YES shares | 18 (WAD) | storage |
| `qNo` | Outstanding NO shares | 18 (WAD) | storage |
| `totalLockedProceeds` | Sell proceeds locked for 24h | 6 (USDC) | storage |

### Decimal Conversions

```javascript
// USDC values (6 decimals)
const totalAssets = formatUnits(raw, 6);     // $1000.00
const lpBalance = formatUnits(raw, 6);        // 1000 LP

// WAD values (18 decimals)  
const bParam = formatUnits(raw, 18);          // 1442.695
const qYes = formatUnits(raw, 18);            // 500.00 shares

// Prices (18 decimals, 0-1 range)
const priceYes = formatUnits(raw, 18);        // 0.50 = 50%
```

---

## LP Accounting & PnL

### Pre-Graduation State

```
LP Value = totalAssets / totalSupply × userLP

Where:
- totalAssets = USDC in contract
- Grows from: trading fees, buy premiums
- Shrinks from: sell payouts (locked for 24h)
```

### Settlement Simulation

```
IF YES WINS:
  LP Payout = totalAssets - qYes
  (LPs pay all YES holders at $1 each)

IF NO WINS:
  LP Payout = totalAssets - qNo  
  (LPs pay all NO holders at $1 each)

EXPECTED LP VALUE:
  = priceYes × (totalAssets - qYes) + priceNo × (totalAssets - qNo)
  = totalAssets - (priceYes × qYes + priceNo × qNo)
```

### Max Loss Calculation

```
Max Loss = b × ln(2) ≈ 0.693 × b

This occurs at 50/50 probability where:
- qYes = qNo
- Either outcome requires same payout
```

### Example Calculation

```
Given:
  totalAssets = $1,000
  qYes = 100 shares (WAD)
  qNo = 50 shares (WAD)
  priceYes = 0.60 (60%)
  priceNo = 0.40 (40%)

Settlement Payouts (need to convert qYes/qNo to USDC):
  IF YES: $1,000 - (100 × decimalsScale) = $1,000 - $100 = $900 to LPs
  IF NO:  $1,000 - (50 × decimalsScale)  = $1,000 - $50 = $950 to LPs

Expected LP Value:
  = 0.60 × $900 + 0.40 × $950
  = $540 + $380 = $920

LP PnL:
  = Expected Value - Initial Investment
  = $920 - $1,000 = -$80 (8% expected loss)
```

---

## Recommended UI Display

### Market Info Card

```
┌────────────────────────────────────────────────────────────────┐
│ 📊 Market Stats                                          [?]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   60.0% / 40.0%  YES / NO                                      │
│   ████████████████████░░░░░░░░░░░░                              │
│                                                                │
│ ┌──────────────┬──────────────┬──────────────┐                 │
│ │ TVL          │ Depth (b)    │ LP Supply    │                 │
│ │ $1,000       │ $1,443       │ 1,000        │                 │
│ └──────────────┴──────────────┴──────────────┘                 │
│                                                                │
│ ┌──────────────┬──────────────┬──────────────┐                 │
│ │ qYes         │ qNo          │ Max Loss     │                 │
│ │ 100          │ 50           │ $1,000       │                 │
│ └──────────────┴──────────────┴──────────────┘                 │
│                                                                │
│ Settlement Simulation                                          │
│ ┌──────────────┬──────────────┬──────────────┐                 │
│ │ IF YES       │ IF NO        │ EXPECTED     │                 │
│ │ $900 (+10%)  │ $950 (+5%)   │ $920 (+8%)   │                 │
│ └──────────────┴──────────────┴──────────────┘                 │
│                                                                │
│ 🔒 Locked: Total $50 | Yours $10                               │
│                                                                │
│ Addresses: Market: 0x0C15...DF1 | Creator: 0xEfdB...A74F       │
└────────────────────────────────────────────────────────────────┘
```

### Pre-Graduation Accounting

```
┌────────────────────────────────────────────────────────────────┐
│ 💰 Vault Accounting                                      [?]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ Sources of Funds                                               │
│   Creator Deposit      $1,000.00                               │
│   Trading Fees         $50.00 (5% pre-grad)                    │
│   ─────────────────────────────                                │
│   Total Assets         $1,050.00                               │
│                                                                │
│ Obligations                                                    │
│   qYes Liability       100 shares × $1 = -$100                 │
│   qNo Liability        50 shares × $1 = -$50                   │
│   Locked Proceeds      $50 (24h lock)                          │
│                                                                │
│ LP Value                                                       │
│   If YES wins          $1,050 - $100 = $950                    │
│   If NO wins           $1,050 - $50 = $1,000                   │
│   Expected             $950×0.6 + $1000×0.4 = $970             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Post-Graduation Changes

After graduation:
- Fee drops from 5% to 1%
- Only 30% of fee goes to LP tokens (70% to protocol)
- bBase is frozen (no more growth from fees)
- Market operates like standard AMM

---

## Implementation Checklist

### Frontend Fixes Needed

1. **[CRITICAL] Fix decimals for MockUSDC-based testnet:**
   - Either redeploy MockUSDC with 6 decimals
   - Or use 18 decimals consistently in frontend

2. **Add accounting display:**
   ```typescript
   // Fetch additional data
   const creatorDeposit = await market.totalCreatorDeposit();
   const feesAccrued = await market.feesAccrued();
   
   // Calculate liabilities (need decimalsScale for conversion)
   const decimalsScale = await market.decimalsScale();
   const qYesUSDC = (qYes / 1e18) * decimalsScale; // Convert WAD to USDC
   ```

3. **Settlement simulation:**
   ```typescript
   const lpPayoutYes = totalAssets - qYesUSDC;
   const lpPayoutNo = totalAssets - qNoUSDC;
   const expectedPayout = priceYes * lpPayoutYes + priceNo * lpPayoutNo;
   ```

### Contract Clarifications

- `b()` and `bBase` are identical for LaunchpadMarket (no PnL adjustment)
- `qYes/qNo` are in WAD (18 decimals), NOT in USDC terms
- Use `decimalsScale()` to convert between WAD and asset decimals
- `totalAssets()` returns actual USDC balance, not accounting value

---

## Next Steps

1. **Immediate:** Fix MockUSDC decimals mismatch (redeploy with 6 decimals)
2. **Frontend:** Add proper decimal handling based on asset decimals
3. **UI:** Implement accounting card with settlement simulation
4. **Education:** Add tooltips explaining LP economics
