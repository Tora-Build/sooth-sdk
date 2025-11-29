# Vault Redeployment - November 29, 2025

**Status:** ✅ Implemented  
**Severity:** Critical Security Fix  
**Date:** 2025-11-29

---

## Executive Summary

The SoothVault contract has been updated with critical security fixes and will be redeployed. This document outlines:

1. **Issues Fixed**: Vault initialization problems and decimals normalization security vulnerability
2. **Contract Changes**: New `decimalsScale` feature to prevent price attacks
3. **Deployment Updates**: Enhanced verification and logging
4. **Frontend Impact**: No breaking changes to existing integrations

---

## Issues Resolved

### Issue #1: Vault Initialization Failure

**Problem:**

- Previous vault deployment at `0x93CD5Cd848af2Af5247Ba132FcAc4B6840531585` was reverting on core view functions
- `totalSupply()`, `maxDeposit()`, and `paused()` all failed
- Blocked all deposit operations

**Root Cause:**

- Vault was not properly initialized during deployment
- Missing initial liquidity deposit before market creation

**Solution:**

- Deployment script now deposits 100,000 tokens as initial liquidity
- Added verification logging to confirm vault state
- Markets are created AFTER liquidity is deposited

### Issue #2: Decimals Normalization Security Vulnerability

**Problem:**

- Original implementation assumed all collateral tokens have 18 decimals
- Using tokens with fewer decimals (e.g., 6-decimal USDC) caused:
  - Treasury/buffer values to shrink by 10^(18-decimals)
  - Shares to become artificially cheap
  - **Price attack vulnerability** where attackers could exploit the decimal mismatch

**Example Attack Scenario:**

```
With 6-decimal USDC (1,000,000 = $1):
- Actual treasury: 100,000,000,000 (100k USDC)
- System interprets as: 0.0001 USDC (due to missing 10^12 scaling)
- Shares become 1 trillion times cheaper than intended
- Attacker drains vault by buying underpriced shares
```

**Solution:**

- Added `decimalsScale` to vault: `10^(18 - assetDecimals)`
- RiskManager now scales treasury/buffer values before computing `bGlobal`
- Pricing calculations use normalized 18-decimal values
- Vault accounting remains in native token units

---

## Contract Changes

### 1. SoothInterfaces.sol

**Added IERC20Metadata Interface:**

```solidity
interface IERC20Metadata is IERC20 {
    function decimals() external view returns (uint8);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
}
```

**Updated ISoothVault Interface:**

```solidity
interface ISoothVault {
    // ... existing functions
    function decimalsScale() external view returns (uint256); // NEW
}
```

### 2. SoothVault.sol

**Added Decimals Normalization:**

```solidity
contract SoothVault is ISoothVault, Ownable {
    IERC20 public immutable override asset;

    /// @notice Decimals scaling factor: 10^(18 - assetDecimals)
    uint256 public immutable decimalsScale; // NEW

    constructor(IERC20 _asset) {
        asset = _asset;

        // Read decimals and compute scaling factor
        uint8 assetDecimals = IERC20Metadata(address(_asset)).decimals();
        require(assetDecimals <= 18, "Vault: decimals > 18 not supported");

        // For 18-decimal tokens: scale = 1 (no scaling)
        // For 6-decimal tokens: scale = 10^12
        decimalsScale = 10 ** (18 - assetDecimals);
    }
}
```

### 3. SoothRiskManager.sol

**Updated Global B Calculation:**

```solidity
function updateGlobalB() external {
    uint256 T_raw = vault.getTreasuryBalance();
    uint256 B_raw = vault.getLiquidBufferBalance();
    uint256 scale = vault.decimalsScale(); // NEW
    uint256 K = globalRisk.maxConcurrentWorstCase;
    if (K == 0) return;

    // Normalize to 18 decimals for pricing calculations
    uint256 T = T_raw * scale; // NEW
    uint256 B = B_raw * scale; // NEW

    uint256 Lmax = (T + B) / K;
    uint256 LN2_INV_BPS = 14427;
    uint256 newB = Lmax * LN2_INV_BPS / 1e4;

    globalRisk.bGlobal = newB;
    emit GlobalBUpdated(newB, Lmax, T, B);
}
```

### 4. DeploySooth.s.sol

**Enhanced Deployment Script:**

```solidity
// Verify decimals normalization
uint8 collateralDecimals = collateral.decimals();
uint256 decimalsScale = vault.decimalsScale();
console2.log("Collateral decimals:", collateralDecimals);
console2.log("Decimals scale factor:", decimalsScale);

// Deposit initial liquidity BEFORE creating markets
uint256 initialLiquidity = 100_000 ether;
collateral.approve(address(vault), initialLiquidity);
vault.depositFor(msg.sender, initialLiquidity);

// Verify vault state
console2.log("Vault totalAssets:", vault.totalAssets());
console2.log("Vault LP balance:", vault.balanceOfLP(msg.sender));
```

---

## Deployment Verification

When deploying, you will see the following logs confirming proper initialization:

```
Collateral decimals: 18
Decimals scale factor: 1
Expected scale: 10^(18-decimals) = 1
Initial liquidity deposited: 100000000000000000000000
Vault totalAssets: 100000000000000000000000
Vault LP balance: 100000000000000000000000
```

For 6-decimal USDC:

```
Collateral decimals: 6
Decimals scale factor: 1000000000000
Expected scale: 10^(18-decimals) = 1000000000000
```

---

## Frontend Integration Impact

### ✅ No Breaking Changes

The decimals normalization is **transparent to frontend developers**. All existing integrations continue to work without modification.

### What Stays the Same

1. **Vault Interface**: All existing functions work identically
2. **Deposit/Withdraw**: Same parameters, same behavior
3. **Balance Queries**: Returns values in native token units
4. **Transaction Flow**: No changes to user workflows

### What's New (Optional)

Frontend developers can optionally query the new `decimalsScale` for informational purposes:

```typescript
// Optional: Display scaling information
const decimalsScale = await vaultContract.read.decimalsScale();
console.log("Decimals scale factor:", decimalsScale);
```

### Updated Contract Addresses

After redeployment, update `deployments.json` with new addresses:

```json
{
  "SoothVault": "0x[NEW_ADDRESS]",
  "SoothRiskManager": "0x[NEW_ADDRESS]"
  // ... other contracts
}
```

---

## Testing Checklist

Before going live, verify:

- [ ] `decimalsScale()` returns correct value
- [ ] For 18-decimal tokens: `decimalsScale == 1`
- [ ] For 6-decimal tokens: `decimalsScale == 1000000000000`
- [ ] `totalAssets()` shows initial liquidity
- [ ] `balanceOfLP(deployer)` matches deposited amount
- [ ] `updateGlobalB()` computes non-zero `bGlobal`
- [ ] Markets can be created successfully
- [ ] Deposits work in frontend
- [ ] Withdrawals work in frontend
- [ ] Prices display correctly

---

## Security Improvements

### Before (Vulnerable)

```solidity
// Direct use of raw values - VULNERABLE with <18 decimal tokens
uint256 T = vault.getTreasuryBalance(); // Could be 100,000,000 (6 decimals)
uint256 B = vault.getLiquidBufferBalance();
uint256 Lmax = (T + B) / K; // Lmax is 10^12 times too small!
```

### After (Secure)

```solidity
// Normalized to 18 decimals - SECURE for all token types
uint256 T_raw = vault.getTreasuryBalance(); // 100,000,000 (6 decimals)
uint256 scale = vault.decimalsScale(); // 10^12
uint256 T = T_raw * scale; // 100,000,000,000,000,000,000 (18 decimals)
uint256 Lmax = (T + B) / K; // Correct value!
```

---

## Migration Guide

### For Existing Deployments

If you have an existing deployment that needs to be fixed:

1. **Redeploy** all core contracts with the updated code
2. **Update** `deployments.json` with new addresses
3. **Migrate** liquidity from old vault to new vault (if needed)
4. **Update** frontend configuration
5. **Verify** all functions work correctly
6. **Announce** maintenance window to users

### For New Deployments

Simply run the updated deployment script:

```bash
forge script script/DeploySooth.s.sol:DeploySooth \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

---

## Related Documentation

- **Issue Reports**: `docs/issues/VAULT_DEPOSIT_ISSUE.md`
- **Resolution Guide**: `docs/issues/VAULT_RESOLUTION_GUIDE.md`
- **Decimals Spec**: `docs/decimals-normalization.md`
- **Multi-Vault Future**: `docs/requirements/MULTI_VAULT_ARCHITECTURE.md`
- **Frontend Integration**: `docs/frontend-integration/CONTRACT_INTERFACES.md`

---

## Support

If you encounter issues during redeployment:

1. Check deployment logs for verification output
2. Verify collateral token implements `decimals()`
3. Ensure initial liquidity deposit succeeds
4. Confirm `bGlobal` is non-zero after market creation
5. Test deposit/withdraw in UI before announcing

---

## Summary

✅ **Fixed**: Vault initialization issues  
✅ **Fixed**: Decimals normalization security vulnerability  
✅ **Added**: Comprehensive deployment verification  
✅ **Maintained**: Full backward compatibility for frontend  
✅ **Improved**: Security for multi-decimal token support

**Action Required**: Redeploy contracts and update `deployments.json`
