# ln(2) Constants Reference

This document provides safe Solidity constants for `ln(2)` across different numeric domains used in the Sooth Protocol codebase.

## Overview

The natural logarithm of 2 (`ln(2) ≈ 0.693147180559945309...`) is a critical constant in LMSR (Logarithmic Market Scoring Rule) calculations. It appears in:

- **Max Loss Calculations**: `MaxLoss = b × ln(2)`
- **Creator Deposit Calculations**: `deposit = b × ln(2)` (Launchpad model)
- **Fee-to-Liquidity Conversion**: `delta_b = fee / ln(2)`
- **LMSR Cost Functions**: Used in log-sum-exp calculations

## Safe Constants by Numeric Domain

### 1. uint256 WAD (1e18) Precision

**Use Case**: Typical fixed-point math with unsigned integers, standard WAD precision.

```solidity
uint256 constant LN2_WAD = 693147180559945309; // ≈ ln(2) * 1e18
```

**Example Usage:**
```solidity
// Max loss calculation
uint256 maxLoss = (b * LN2_WAD) / WAD;

// Creator deposit (Launchpad)
uint256 deposit = (bTier * LN2_WAD) / WAD;
```

**Current Usage:**
- `TickLMSR.sol`: `LN2_WAD = 693147180559945309`
- `LAUNCHPAD_ECONOMICS_V2.md`: Same constant
- Most unsigned WAD calculations in the codebase

---

### 2. int256 WAD (1e18) Precision

**Use Case**: Signed fixed-point math with WAD precision (for calculations that can be negative).

```solidity
int256 constant LN2_WAD = 693147180559945309; // ≈ ln(2) * 1e18
```

**Example Usage:**
```solidity
// Signed max loss calculation
int256 maxLoss = (int256(b) * LN2_WAD) / int256(WAD);
```

**Note**: The magnitude is the same as `uint256`, but the type is `int256` for signed arithmetic compatibility.

---

### 3. sd59x18 (PRBMath Signed 18-decimal Fixed-Point)

**Use Case**: PRBMath library functions that expect `sd59x18` type (signed 59.18 fixed-point).

```solidity
import {wrap} from "prb-math/src/sd59x18/Casting.sol";

int256 constant LN2_SD59x18 = 693147180559945309; // sd59x18
```

**Example Usage:**
```solidity
import {ln} from "prb-math/src/sd59x18/Math.sol";
import {wrap} from "prb-math/src/sd59x18/Casting.sol";

// Using PRBMath ln function
sd59x18 ln2 = wrap(LN2_SD59x18);
```

**Current Usage:**
- `SoothLMSRReal.sol` (archived): Uses PRBMath for LMSR calculations
- Any code using PRBMath's `sd59x18` functions

---

### 4. ud60x18 (PRBMath Unsigned 18-decimal Fixed-Point)

**Use Case**: PRBMath library functions that expect `ud60x18` type (unsigned 60.18 fixed-point).

```solidity
uint256 constant LN2_UD60x18 = 693147180559945309;
```

**Example Usage:**
```solidity
import {ln} from "prb-math/src/ud60x18/Math.sol";
import {wrap} from "prb-math/src/ud60x18/Casting.sol";

ud60x18 ln2 = wrap(LN2_UD60x18);
```

**Note**: Same magnitude as WAD constants, but typed for PRBMath's unsigned domain.

---

### 5. RAY Precision (1e27)

**Use Case**: Higher precision fixed-point math using RAY (27 decimals) instead of WAD (18 decimals).

```solidity
uint256 constant LN2_RAY = 693147180559945309417232121; // ≈ ln(2) * 1e27
```

**Example Usage:**
```solidity
uint256 constant RAY = 1e27;

// High-precision max loss
uint256 maxLoss = (b * LN2_RAY) / RAY;
```

**When to Use**: If your codebase uses RAY precision for higher accuracy in financial calculations.

---

## Precision Notes

### Rounding

- **Values above are rounded toward zero** (safe for upper-bound checks and conservative math)
- For rounding half-up, the same values are standard:
  - WAD: `693147180559945309`
  - RAY: `693147180559945309417232121`

### Type Consistency

**Critical**: Keep the type consistent with your math library and domain:

- PRBMath `sd59x18` functions expect `int256` scaled by 1e18
- PRBMath `ud60x18` functions expect `uint256` scaled by 1e18
- Standard WAD math uses `uint256` or `int256` scaled by 1e18
- RAY math uses `uint256` scaled by 1e27

### Solidity Literal Format

For Solidity literals, avoid underscores in the constant definition. Use comments to indicate scale:

```solidity
// ✅ Good
uint256 constant LN2_WAD = 693147180559945309; // ln(2) * 1e18

// ❌ Avoid (underscores in literals can cause issues)
uint256 constant LN2_WAD = 693_147_180_559_945_309;
```

---

## Common Use Cases in Sooth Protocol

### 1. Max Loss Calculation

```solidity
uint256 constant LN2_WAD = 693147180559945309;
uint256 constant WAD = 1e18;

function maxLoss(uint256 b) public pure returns (uint256) {
    return (b * LN2_WAD) / WAD;
}
```

### 2. Creator Deposit (Launchpad)

```solidity
function depositForTier(uint256 tierIndex) public view returns (uint256) {
    uint256 b = B_TIERS[tierIndex];
    // deposit = b × ln(2) ≈ b × 0.693
    return (b * LN2_WAD) / WAD;
}
```

### 3. Fee-to-Liquidity Conversion

```solidity
function feeToLiquidityBoost(uint256 fee) public pure returns (uint256) {
    // Every $1 fee adds $1.44 to b (1/ln(2) ≈ 1.44)
    // delta_b = fee / ln(2)
    return (fee * WAD) / LN2_WAD;
}
```

### 4. Inverse: 1/ln(2)

For calculations requiring `1/ln(2) ≈ 1.442695...`:

```solidity
uint256 constant LN2_INV_WAD = 1442695040888963407; // 1/ln(2) * 1e18

// Usage: delta_b = fee * LN2_INV_WAD / WAD
uint256 deltaB = (fee * LN2_INV_WAD) / WAD;
```

**Current Usage in Codebase:**
- `LaunchpadMarket.sol`: `1442695040888963407` (1/ln(2) in WAD)

---

## Verification

To verify these constants are correct:

```solidity
// Python verification
import math

# WAD precision
ln2_wad = int(math.log(2) * 1e18)
assert ln2_wad == 693147180559945309

# RAY precision  
ln2_ray = int(math.log(2) * 1e27)
assert ln2_ray == 693147180559945309417232121

# Inverse
ln2_inv_wad = int((1 / math.log(2)) * 1e18)
assert ln2_inv_wad == 1442695040888963407
```

---

## References

- **LMSR Theory**: The max loss for a binary LMSR market is `b × ln(2)` regardless of price distribution
- **Launchpad Model**: See `LAUNCHPAD_ECONOMICS_V2.md` for detailed usage
- **V4 Formulas**: See `V4_FORMULAS.md` for LMSR cost function details
- **PRBMath**: [PRBMath Documentation](https://github.com/PaulRBerg/prb-math)

---

## Summary Table

| Domain | Type | Constant | Value |
|--------|------|----------|-------|
| WAD (unsigned) | `uint256` | `LN2_WAD` | `693147180559945309` |
| WAD (signed) | `int256` | `LN2_WAD` | `693147180559945309` |
| sd59x18 | `int256` | `LN2_SD59x18` | `693147180559945309` |
| ud60x18 | `uint256` | `LN2_UD60x18` | `693147180559945309` |
| RAY | `uint256` | `LN2_RAY` | `693147180559945309417232121` |
| 1/ln(2) WAD | `uint256` | `LN2_INV_WAD` | `1442695040888963407` |

---

*Last Updated: 2025-12-17*



