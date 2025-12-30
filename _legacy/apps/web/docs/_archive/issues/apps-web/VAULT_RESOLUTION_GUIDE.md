# SoothVault Deposit Issue - Resolution Guide

**Date:** 2025-11-29  
**Status:** Critical - Blocking all deposits  
**Vault Address:** `0x93CD5Cd848af2Af5247Ba132FcAc4B6840531585`  
**Network:** Base Sepolia  
**Owner:** `0xefdb15ee6e7c7c7906cb230aff1edb75ccbaa74f`

---

## Executive Summary

The `SoothVault` contract is reverting on multiple view functions (`totalSupply`, `maxDeposit`, `paused`), which indicates the contract is not properly initialized or has a critical state issue. This is blocking all deposit operations.

## Diagnostic Results

### ✅ Working Functions

- `owner()` → Returns `0xefdb15ee6e7c7c7906cb230aff1edb75ccbaa74f`
- `totalAssets()` → Returns `100000000000000000000000` (100,000 USDC)
- `asset()` → Returns `0x46889B5EfDF72b506D40B3C339701DCe27661232` (MockERC20)

### ❌ Reverting Functions

- `totalSupply()` → **Execution reverted**
- `maxDeposit(address)` → **Execution reverted**
- `paused()` → **Execution reverted**

## Root Cause Analysis

The pattern of reverts suggests one of the following issues:

1. **Missing ERC4626 Initialization**: The vault may inherit from ERC4626 but wasn't properly initialized with the asset token
2. **Storage Collision**: If the contract was upgraded or redeployed, there may be storage layout issues
3. **Dependency on Uninitialized Contract**: The vault may depend on another contract (like RiskManager) that isn't configured
4. **Constructor/Initializer Not Called**: The vault may require an explicit initialization step that was skipped

## Recommended Solutions

### Option 1: Redeploy the Vault (Recommended)

If you have access to the deployment scripts, the cleanest solution is to redeploy the vault with proper initialization:

```bash
# Ensure the deployment script properly initializes the vault
# Check that all constructor parameters are correct
# Verify that any post-deployment initialization is called
```

**Deployment Checklist:**

- [ ] Verify asset token address is correct
- [ ] Call `initialize()` if using proxy pattern
- [ ] Set initial deposit limit if required
- [ ] Configure risk manager integration
- [ ] Verify all view functions work before proceeding

### Option 2: Fix Existing Deployment

If redeployment is not an option, try these recovery steps as the owner:

#### Step 1: Check for Initialization Function

```bash
# Try calling initialize with the asset token
cast send 0x93CD5Cd848af2Af5247Ba132FcAc4B6840531585 \
  "initialize(address)" \
  "0x46889B5EfDF72b506D40B3C339701DCe27661232" \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY
```

#### Step 2: Check for setDepositLimit Function

```bash
# Try setting a deposit limit (e.g., 1M USDC with 18 decimals)
cast send 0x93CD5Cd848af2Af5247Ba132FcAc4B6840531585 \
  "setDepositLimit(uint256)" \
  "1000000000000000000000000" \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY
```

#### Step 3: Check Contract Source

You need to inspect the actual contract source code to understand:

- What initialization is required
- Whether it uses a proxy pattern
- What the `maxDeposit` implementation depends on

```bash
# Get the contract source from Basescan or your deployment artifacts
# Look for:
# - constructor parameters
# - initialize() function
# - maxDeposit() implementation
# - any required setup functions
```

### Option 3: Deploy New Vault and Migrate

If the current vault cannot be fixed:

1. Deploy a new `SoothVault` contract with proper initialization
2. Update `deployments.json` with the new address
3. Migrate any existing liquidity (if applicable)
4. Update frontend configuration

## Frontend Mitigation

While fixing the contract, update the frontend to handle this gracefully:

### Update `useVault.ts`

Add better error handling for the reverts:

```typescript
const { data, refetch, error } = useReadContracts({
  contracts: [
    // ... existing contracts
  ],
  query: {
    enabled: mode === "real" && !!address,
    refetchInterval: 5000,
    retry: 1, // Don't retry excessively on reverts
  },
});

// Add error state handling
if (error) {
  console.error("Vault read error:", error);
  // Show user-friendly message
}
```

### Update `LiquidityForm.tsx`

Show a clear message when deposits are blocked:

```typescript
{
  mode === "real" && currentMaxDeposit === 0n && (
    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
      <p className="text-sm text-amber-400">
        ⚠️ Vault deposits are currently unavailable. The contract is being
        configured. Please check back soon or contact support.
      </p>
    </div>
  );
}
```

## Action Items

### For Contract Owner (`0xefdb15ee6e7c7c7906cb230aff1edb75ccbaa74f`)

1. [ ] Obtain the contract source code or ABI with all functions
2. [ ] Identify the required initialization steps
3. [ ] Execute initialization transactions
4. [ ] Verify `maxDeposit` returns a positive value
5. [ ] Test a small deposit transaction

### For Frontend Developer

1. [ ] Add error boundary for vault read failures
2. [ ] Show user-friendly message when vault is unavailable
3. [ ] Consider adding a "maintenance mode" flag in config
4. [ ] Add monitoring/alerting for contract state issues

### For DevOps/Deployment

1. [ ] Review deployment scripts for initialization steps
2. [ ] Add post-deployment verification checks
3. [ ] Document required initialization sequence
4. [ ] Create runbook for vault deployment

## Testing Checklist

After applying fixes, verify:

- [ ] `maxDeposit(address)` returns a positive number
- [ ] `totalSupply()` returns without reverting
- [ ] `paused()` returns `false`
- [ ] Small test deposit succeeds
- [ ] Withdrawal works correctly
- [ ] Frontend displays correct vault stats

## References

- Issue Report: `/docs/issues/VAULT_DEPOSIT_ISSUE.md`
- Contract Interfaces: `/docs/contract-integration/CONTRACT_INTERFACES.md`
- Vault Hook: `/src/hooks/useVault.ts`
- Deployment Config: `/src/config/deployments.json`

## Contact

If you need the contract source code or deployment scripts, check:

- The original contracts repository
- Basescan contract verification
- Your deployment artifacts/logs

---

**Next Steps:** Run the diagnostic script and share the contract source code to determine the exact initialization requirements.
