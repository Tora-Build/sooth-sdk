# Issue Report: SoothVault Deposits Blocked

**Severity:** Critical
**Status:** Active
**Date:** 2025-11-29

## Summary

The `SoothVault` contract on Base Sepolia is currently rejecting all deposits because `maxDeposit` returns `0`. This effectively pauses the vault and prevents any liquidity provision.

## Contract Details

- **Network:** Base Sepolia
- **Contract Name:** SoothVault
- **Address:** `0x93CD5Cd848af2Af5247Ba132FcAc4B6840531585`

## Symptoms

1.  **UI Feedback:** Frontend shows "Deposits Paused" (derived from `maxDeposit == 0`).
2.  **Transaction Reverts:** Any attempt to call `deposit` or `depositFor` reverts with "Deposit amount exceeds vault limit".
3.  **Read Call:** `maxDeposit(userAddress)` returns `0`.

## Steps to Reproduce

Run the following `cast` command (or equivalent):

```bash
cast call 0x93CD5Cd848af2Af5247Ba132FcAc4B6840531585 "maxDeposit(address)" "0xYOUR_ADDRESS" --rpc-url https://sepolia.base.org
```

**Expected Result:** A positive integer (e.g., `1000000000000000000000000` for 1M USDC).
**Actual Result:** `0`.

## Potential Causes

1.  **Not Initialized:** The vault might require an initialization step to set the initial cap.
2.  **Paused State:** The vault might be in a `PAUSED` state.
3.  **Risk Manager Config:** If the vault delegates limits to `SoothRiskManager`, the risk manager might be misconfigured.

## Diagnostic Results (2025-11-29)

**Diagnostic script run:** `scripts/diagnose-vault.sh`

### Working Functions ✅

- `owner()` → `0xefdb15ee6e7c7c7906cb230aff1edb75ccbaa74f`
- `totalAssets()` → `100000000000000000000000` (100,000 USDC)
- `asset()` → `0x46889B5EfDF72b506D40B3C339701DCe27661232`

### Reverting Functions ❌

- `totalSupply()` → **Execution reverted**
- `maxDeposit(address)` → **Execution reverted**
- `paused()` → **Execution reverted**

## Root Cause

The vault is reverting on multiple core view functions, indicating a **critical initialization issue** rather than a simple deposit limit configuration. This suggests:

1. Missing ERC4626 initialization
2. Storage collision or upgrade issue
3. Dependency on uninitialized contract
4. Constructor/initializer not properly called

## Recommended Action

**See:** `VAULT_RESOLUTION_GUIDE.md` for detailed resolution steps.

**Immediate Actions:**

1. Obtain the contract source code to identify required initialization
2. As owner, attempt to call `initialize()` or equivalent setup function
3. If unfixable, redeploy the vault with proper initialization
4. Update frontend to show maintenance message while vault is being fixed
