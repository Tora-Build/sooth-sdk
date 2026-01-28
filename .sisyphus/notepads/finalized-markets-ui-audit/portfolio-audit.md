# Portfolio Page Component Audit

**File**: `apps/web/src/pages/Portfolio.tsx`
**Date**: 2026-01-27

---

## AMMPositionRow (lines 31-95)

### Return null when (line 56)
```typescript
if (isLoading || (yesShares === 0n && noShares === 0n)) return null;
```
- Returns null while loading
- Returns null if user has no YES or NO shares

### Hooks used
- `useAMMPositionDirect(market.address)` (line 38)
  - Calls `AMMEngine.getPosition(marketAddress, userAddress)`
  - Returns `{ yesShares, noShares, shares }`

### Data needed (props)
| Prop | Type | Required | Purpose |
|------|------|----------|---------|
| `market` | `OnChainMarket` | Yes | Market metadata |
| `stage` | `OnChainMarket['stage']` | Yes | Badge display |
| `price` | `bigint` | No | Value calculation |
| `onValueUpdate` | callback | No | Portfolio total |
| `onRedeem` | callback | No | Redemption action |

### Finalized handling
- **YES** - Shows "Finalized" badge (line 66)
- **YES** - Shows "Redeem Position" button when `stage === 'finalized'` (line 85-92)
- **NO ISSUES** - Correctly handles finalized markets

### Issues found
- **None** - Component correctly displays AMM positions for all stages including finalized

---

## LPPositionRow (lines 97-191)

### Return null when (line 163)
```typescript
if (!lpBalance || lpBalance === 0n) return null;
```
- Returns null if no LP balance or balance is zero

### Hooks used
- **None** - All data passed via props

### Data needed (props)
| Prop | Type | Required | Purpose |
|------|------|----------|---------|
| `market` | `OnChainMarket` | Yes | Market metadata |
| `stage` | `OnChainMarket['stage']` | Yes | Badge display |
| `lpBalance` | `bigint` | No | User's LP tokens |
| `lpSupply` | `bigint` | No | Total LP supply |
| `floorValue` | `bigint` | No | Direct floor value |
| `bCurrent` | `bigint` | No | LMSR b parameter |
| `qYes` | `bigint` | No | YES quantity |
| `qNo` | `bigint` | No | NO quantity |
| `decimals` | `number` | Yes | USDC decimals |
| `onValueUpdate` | callback | No | Portfolio total |
| `onRedeem` | callback | No | Redemption action |

### Value calculation (lines 110-155)
1. **Primary**: Uses `floorValue` from contract (un-graduated markets)
2. **Secondary**: Calculates Floor = Cash - Liability via LMSR formula (graduated markets)
3. **Fallback**: Estimates Floor as Cash (b * ln(2))

### Finalized handling
- **YES** - Shows "Finalized" badge (line 173)
- **YES** - Shows "Redeem LP Tokens" button when `stage === 'finalized'` (lines 181-188)
- **NO ISSUES** - Correctly handles finalized markets

### Issues found
- **None** - Component correctly displays LP positions for all stages including finalized

---

## TickBookInternalRow (lines 197-262)

### Return null when (line 223)
```typescript
if (isLoading || (yesInternal === 0n && noInternal === 0n)) return null;
```
- Returns null while loading
- Returns null if user has no internal YES or NO outcomes

### Hooks used
- `useTickBookVaultDirect(userAddress, market.address)` (line 206)
  - Calls `TickBookVault.getInternalOutcomes(marketAddress, userAddress)`
  - Returns `{ yesInternal, noInternal, yesLocked, noLocked, ... }`

### Data needed (props)
| Prop | Type | Required | Purpose |
|------|------|----------|---------|
| `market` | `OnChainMarket` | Yes | Market metadata |
| `stage` | `OnChainMarket['stage']` | Yes | Badge display |
| `userAddress` | `0x${string}` | Yes | User wallet |
| `price` | `bigint` | No | Value calculation |
| `onValueUpdate` | callback | No | Portfolio total |
| `onRedeem` | callback | No | Redemption action |

### Finalized handling
- **YES** - Shows "Finalized" badge (line 233)
- **YES** - Shows "Redeem Position" button when `stage === 'finalized'` (lines 252-259)
- **NO ISSUES** - Correctly handles finalized markets

### Issues found
- **None** - Component correctly displays TickBook internal positions for all stages

---

## LockedSharesRow (lines 264-326)

### Return null when (line 286)
```typescript
if (isLoading || (yesLocked === 0n && noLocked === 0n)) return null;
```
- Returns null while loading
- Returns null if user has no locked YES or NO shares

### Hooks used
- `useTickBookVaultDirect(userAddress, market.address)` (line 272)
  - Calls `TickBookVault.getLockedOutcome(marketAddress, userAddress, outcome)`
  - Returns `{ yesLocked, noLocked, ... }`

### Data needed (props)
| Prop | Type | Required | Purpose |
|------|------|----------|---------|
| `market` | `OnChainMarket` | Yes | Market metadata |
| `stage` | `OnChainMarket['stage']` | Yes | Badge display |
| `userAddress` | `0x${string}` | Yes | User wallet |
| `price` | `bigint` | No | Value calculation |
| `onValueUpdate` | callback | No | Portfolio total |
| `onRedeem` | callback | No | Redemption action |

### Finalized handling
- **YES** - Shows "Finalized" badge (line 296)
- **YES** - Shows "Redeem Position" button when `stage === 'finalized'` (lines 316-323)
- **NO ISSUES** - Correctly handles finalized markets

### Issues found
- **None** - Component correctly displays locked shares for all stages

---

## Summary

### Components that work on finalized markets
All 4 components correctly handle finalized markets:
1. **AMMPositionRow** - Shows badge + redeem button
2. **LPPositionRow** - Shows badge + redeem button
3. **TickBookInternalRow** - Shows badge + redeem button
4. **LockedSharesRow** - Shows badge + redeem button

### Components with issues
**None** - All components have proper finalized market handling

### Common patterns
1. **Return null pattern**: All components return null when loading OR when position is zero
2. **Badge display**: All components show stage badges consistently (bonding, live, settled, finalized, dismissed)
3. **Redeem button**: All components show redeem button only when `stage === 'finalized'` AND position > 0
4. **Value calculation**: All use price-based valuation with fallback to 0.5 if price unavailable

### Root cause investigation needed
If AMM shares are not showing despite user having them, the issue is likely:
1. **Data source**: The `useAMMPositionDirect` hook may not be returning data correctly
2. **Market filtering**: The parent component may be filtering out finalized markets before rendering
3. **Stage detection**: The `stage` prop may be incorrectly set

**Next step**: Audit how Portfolio.tsx iterates over markets and passes data to these components (lines 328+)
