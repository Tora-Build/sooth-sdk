# Issue Report: SoothVault Deposits Blocked

**Severity:** Critical
**Status:** Active (Re-opened)
**Date:** 2025-11-29 (Redeployment Failed)

## Summary

The **redeployed** `SoothVault` contract on Base Sepolia is **still rejecting all deposits** and reverting on core view functions. It appears the initialization issue persists in the new deployment.

## Contract Details

- **Network:** Base Sepolia
- **Contract Name:** SoothVault
- **Old Address:** `0x93CD5Cd848af2Af5247Ba132FcAc4B6840531585`
- **New Address:** `0x2612A5FB66EBB96e7271FcF1a5ceA553a68fDF77` (Current)

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

## Diagnostic Results (2025-11-29 - New Deployment)

**Diagnostic script run:** `scripts/check-vault-health.sh`
**Target:** `0x2612A5FB66EBB96e7271FcF1a5ceA553a68fDF77`

### Working Functions ✅

- `totalAssets()` → `100000000000000000000000` (100,000 USDC)
- `asset()` → `0xdE8b3bba693FEBaBfa56BE4123eA885e0a59A7A1` (New MockERC20)

### Reverting Functions ❌

- `totalSupply()` → **Execution reverted**
- `maxDeposit(address)` → **Execution reverted**
- `paused()` → **Execution reverted**

## Root Cause

The new deployment exhibits the exact same symptoms as the previous one. The vault is uninitialized. The deployment script likely deploys the proxy/implementation but fails to call `initialize()` with the required parameters.

## Recommended Action

**See:** `VAULT_RESOLUTION_GUIDE.md` for detailed resolution steps.

**Immediate Actions:**

1. Obtain the contract source code to identify required initialization
2. As owner, attempt to call `initialize()` or equivalent setup function
3. If unfixable, redeploy the vault with proper initialization
4. Update frontend to show maintenance message while vault is being fixed
