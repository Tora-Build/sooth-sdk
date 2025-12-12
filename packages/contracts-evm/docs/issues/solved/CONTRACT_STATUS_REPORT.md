# Contract Status Report - Post Redeployment

**Date:** 2025-11-29
**Network:** Base Sepolia

## Summary

The protocol has been redeployed with new contract addresses. The frontend has been updated to point to these new addresses. However, **critical issues remain** with the vault initialization.

---

## Contract Status

### ✅ Working Contracts

#### 1. ExampleMarket (`0xBF72a0aCf1791bA3eA69A8F8aCDD8b6f1547508f`)

- **Status:** ✅ Live and functional
- `isLive()` → `true`
- `ammState()` → Returns state (qYes: 0, qNo: 0) - Market initialized but no trades yet
- **Frontend:** Updated in `markets.json`

#### 2. SoothRiskManager (`0x02ca9Cc271f408eeC17764859FA292F03d84DC91`)

- **Status:** ✅ Functional
- `getBForMarket(1)` → `25,854,000,000,000,000,000,000` (~25,854 \* 10^18)
- **b parameter is configured and accessible**

#### 3. MockERC20 (`0xdE8b3bba693FEBaBfa56BE4123eA885e0a59A7A1`)

- **Status:** ✅ New token deployed
- **Note:** This is a different token than the previous deployment

---

### ❌ Broken Contracts

#### SoothVault (`0x2612A5FB66EBB96e7271FcF1a5ceA553a68fDF77`)

- **Status:** ❌ **CRITICAL - Uninitialized**
- **Issue:** Reverting on core ERC4626 functions
  - `totalSupply()` → Reverts
  - `maxDeposit(address)` → Reverts
  - `paused()` → Reverts
- **Working:**
  - `totalAssets()` → 100,000 USDC
  - `asset()` → Returns MockERC20 address
- **Root Cause:** Contract deployed but `initialize()` not called
- **Impact:** **All LP deposits blocked**

---

## Frontend Updates Completed

### Configuration Files Updated ✅

1. **`src/config/deployments.json`** - All addresses updated
2. **`src/config/markets.json`** - Market contract addresses updated
3. **`src/hooks/useTrade.ts`** - Slippage logic fixed for sells

### Code Changes ✅

- Fixed slippage calculation for negative costs (sell orders)
- Correctly implements algebraic `maxCost` check per contract spec
- Dynamic `b` parameter fetching already in place

---

## Blocking Issues

### 🚨 CRITICAL: Vault Initialization Required

**The vault must be initialized before any LP operations can work.**

**Required Action by Protocol Dev:**

```bash
# Check if initialize function exists
cast call 0x2612A5FB66EBB96e7271FcF1a5ceA553a68fDF77 "initialize(address)" "0xdE8b3bba693FEBaBfa56BE4123eA885e0a59A7A1" --rpc-url https://sepolia.base.org

# If above works, send the transaction
cast send 0x2612A5FB66EBB96e7271FcF1a5ceA553a68fDF77 \
  "initialize(address)" \
  "0xdE8b3bba693FEBaBfa56BE4123eA885e0a59A7A1" \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY
```

---

## What Works Now

### Trading ✅

- Markets are live (`isLive = true`)
- Risk manager configured (`b ≈ 25,854`)
- Frontend slippage logic fixed
- **Users can trade once they have tokens**

### What Doesn't Work ❌

- **LP Deposits** - Vault uninitialized
- **LP Withdrawals** - Vault uninitialized
- **Vault Stats Display** - Will show errors/zeros

---

## Testing Checklist

Once vault is initialized, verify:

- [ ] `totalSupply()` returns without reverting
- [ ] `maxDeposit(address)` returns a positive number
- [ ] `paused()` returns `false`
- [ ] Test deposit: Approve + deposit small amount
- [ ] Test withdrawal: Withdraw small amount
- [ ] Frontend LP Dashboard displays correct stats
- [ ] Run `./scripts/check-vault-health.sh` - should pass all tests

---

## Next Steps

1. **Immediate:** Protocol dev must initialize vault at `0x2612...F77`
2. **Verification:** Run health check script after initialization
3. **Testing:** Test small deposit/withdrawal on testnet
4. **Monitoring:** Watch for any other initialization issues with new contracts

---

## Files Reference

- **Issue Report:** `docs/issues/VAULT_DEPOSIT_ISSUE.md`
- **Dev Message:** `docs/issues/MESSAGE_TO_DEV.md`
- **Health Check:** `scripts/check-vault-health.sh`
- **Deployments:** `src/config/deployments.json`
- **Markets:** `src/config/markets.json`
