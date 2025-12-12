# LP Dashboard UI Specification

> Reference document for LP Dashboard terminology, labels, and calculations.
> Aligned with `.agent/KNOWLEDGE.md` as the canonical source of truth.

---

## 1. Header Stats (GlobalStats)

| Label | Source | Formula |
|-------|--------|---------|
| **MARKETS** | `useProtocolStats().marketCount` | Count of markets matching current mode + chainId |
| **VAULT** | `useProtocolStats().poolCount` | Always 1 in real mode |
| **TOTAL TVL** | `useProtocolStats().totalTVL` | `vault.totalAssets()` (18 decimals) |
| **LOCKED LIQUIDITY** | `useProtocolStats().lockedLiquidity` | `vault.totalLockedExposure()` (18 decimals) |

---

## 2. Vault Stats Card

| Label | Variable | Formula |
|-------|----------|---------|
| **Governor Vault** | Header title | Static text |
| **(Based)** / **(Demo)** | Chain label | `chainLabel` or "Demo" |
| **TVL** | `totalAssets` | `vault.totalAssets()` formatted as currency |
| **Share Price** | `sharePrice` | `totalAssets / totalSupply` (default 1.0) |
| **Available to Withdraw** | Computed | `totalAssets - totalLocked` |
| **APY** | `apy` | Hardcoded 12.4% (placeholder) |

---

## 3. Liquidity Model Info Card

### Source Boxes

| Box | Title | Description |
|-----|-------|-------------|
| **From Vault** | Base Depth | `b_base` allocated to each market |
| **From Trading** | Market PnL | `reserves × 10%` adds to depth |
| **Market Depth** | b | Higher b → Lower slippage |

### Explanation Sections

| Section | Title | Text |
|---------|-------|------|
| Growth Flywheel | **Growth Flywheel** | Profitable markets accumulate reserves, which increases their depth (b), attracting more volume and more profits. |
| Capital Locking | **Capital Locking** | Vault locks `b × solvencyFactor` per market. At 50% odds: locks 69%. At 90%: only 32%. |

### Key Formulas

| Formula | Description | Color |
|---------|-------------|-------|
| `b = b_base + (reserves × 1000 / 10000)` | Market depth = base + 10% of reserves | Blue |
| `lockedExposure = b × solvencyFactor(p)` | Dynamic based on YES price (p) | Gray |
| `solvencyFactor(p) = \|p·ln(p) + (1-p)·ln(1-p)\|` | Negative entropy: 0.693 at 50%, 0.325 at 90% | Amber |
| `available = totalAssets − Σ(lockedExposure)` | Capital LPs can withdraw | Blue |

---

## 4. Active Markets Table

### Summary Boxes

| Label | Variable | Formula |
|-------|----------|---------|
| **Reserve Factor** | `multiplierFormatted` | Static "10%" (reserveFactorBps = 1000) |
| **Total Locked** | `displayTotalLocked` | `Σ(b[i] × solvencyFactor(p[i]))` for all markets |

### Table Columns

| Column Header | Data Source | Formula |
|---------------|-------------|---------|
| **Markets** | `market.name` | Market title from config |
| **Risk** | `market.riskLevel` | LOW / MEDIUM / HIGH badge |
| **Market Status** | `market.isLive`, `market.isSettled` | trading / settled / cooldown |
| **Liquidity (b)** | `market.b()` | Total market depth (18 decimals) |
| **b_base** | `market.bBase()` | Base allocation from vault (18 decimals) |
| **Reserves** | `vault.getMarketReserve(marketId)` | Cumulative PnL (18 decimals, signed) |
| **Solvency Factor** | Computed | `solvencyFactor(yesPrice)` |
| **Locked Exposure** | Computed | `b × solvencyFactor` |

### Column Tooltips

| Column | Tooltip Title | Tooltip Text |
|--------|---------------|--------------|
| **Liquidity (b)** | Hybrid Liquidity | Formula: `b = b_base + (reserves × factor / 10000)` |
| **Solvency Factor** | solvencyFactor(p) | `= p·ln(p) + (1-p)·ln(1-p)` Dynamic based on YES price. At 50%: 0.693 • At 90%: 0.325 |
| **Locked Exposure** | lockedExposure = b × solvencyFactor | Capital locked to guarantee solvency. Worst-case payout if market resolves against vault. |

---

## 5. Liquidity Form Card

| Label | Variable | Notes |
|-------|----------|-------|
| **LIQUIDITY PROVIDER** | Section header | - |
| **Deposit** / **Withdraw** | Tab buttons | Toggle between actions |
| **Wallet Balance** | `userUsdcBalance` | User's USDC balance |
| **Available to Deposit** | Computed | Same as wallet balance |
| **Amount** | Input field | User input |
| **Max: $X.XX** | `maxDeposit` | Vault deposit limit |
| **Confirm Deposit** | Submit button | Calls `vault.deposit()` |

---

## 6. Calculation Reference

### Solvency Factor Function

```typescript
const calcSolvencyFactor = (pYes: number): number => {
  if (pYes <= 0.001 || pYes >= 0.999) return 0.01; // edge case protection
  return Math.abs(pYes * Math.log(pYes) + (1 - pYes) * Math.log(1 - pYes));
};
```

| YES Price (p) | Solvency Factor |
|---------------|-----------------|
| 50% | 0.693 |
| 60% | 0.673 |
| 70% | 0.611 |
| 80% | 0.500 |
| 90% | 0.325 |
| 95% | 0.199 |

### Total Locked Calculation

```typescript
const totalLocked = bParams?.reduce((acc, r, i) => {
  const b = Number(formatUnits(r.result as bigint, 18));
  const pYes = Number(formatUnits(yesPricesData[i].result as bigint, 18));
  const sf = calcSolvencyFactor(pYes);
  return acc + b * sf;
}, 0);
```

### Available to Withdraw

```typescript
const availableForWithdraw = totalAssets - totalLockedExposure;
```

---

## 7. Data Sources

| Data | Contract | Function | Decimals |
|------|----------|----------|----------|
| TVL | SoothGovernorVault | `totalAssets()` | 18 |
| Total Locked | SoothGovernorVault | `totalLockedExposure()` | 18 |
| Market Reserves | SoothGovernorVault | `getMarketReserve(marketId)` | 18 (signed) |
| Market Depth (b) | SoothMarketV4 | `b()` | 18 |
| Base Depth | SoothMarketV4 | `bBase()` | 18 |
| YES Price | SoothMarketV4 | `price(0)` | 18 |
| Share Price | Computed | `totalAssets / totalSupply` | - |

---

## 8. Files Modified

| File | Changes |
|------|---------|
| `VaultStats.tsx` | Removed Vault Type A/B/C/D, simplified to "Governor Vault" |
| `VaultMarkets.tsx` | Added bBase fetch, dynamic solvency factor, fixed headers |
| `LiquidityModelInfo.tsx` | Polished all text and formulas |
| `useVault.ts` | Added totalLockedExposure fetch |
| `useProtocolStats.ts` | Fixed locked calculation (was hardcoded 85%) |
| `abis.ts` | Added totalLockedExposure to GOVERNOR_VAULT_V4_ABI |

---

*Last updated: 2025-12-12*
