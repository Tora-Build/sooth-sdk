# Project Status

> Last Updated: 2025-12-30 23:45 (V9.9.0 Merged)

- **✅ V9.9.0 MERGED** — `_tryCross` sweep fix (worst-to-best price, overlap-only fills)
- **✅ V9.8.0 DEPLOYED** — Base Sepolia with bitmap overlap detection
- **✅ FE CONFIG SYNCED** — `deployments.json` and `markets.json` updated
- **⚠️ MONAD PAUSED** — RPC state propagation issues; keeping V9.6.0 addresses

## 🆕 Latest PR: #21 (V9.9.0)

### Summary

**Fix**: TickBook matching now sweeps from worst-to-best price and only fills within overlapping tick ranges.

### Changes

| File | Change |
|------|--------|
| `TickBookPoolManager.sol` | Fixed `_tryCross` sweep direction, added overlap calculation |
| `TickBookPoolManager.t.sol` | Added 5 new V9.9 crossing tests |

### Test Results

```
Ran 27 tests for TickBookPoolManager.t.sol
[PASS] test_V99_CrossingOnlyInOverlap()
[PASS] test_V99_NoCrossingWithoutOverlap()
[PASS] test_V99_SellSweepsLowToHigh()
[PASS] test_V99_BuySweepsHighToLow()
[PASS] test_V99_FillsDoNotExceedOrderSize()
Suite result: ok. 27 passed; 0 failed
```

### Coordination Updates

| Doc | Update |
|-----|--------|
| `CHANGELOG.md` | ✅ Added V9.9.0 entry |
| `DECISIONS.md` | ✅ Added ADR-058 |
| `STATUS.md` | ✅ Updated |

---

## Deployment Summary

| Chain | Version | Status |
|-------|---------|--------|
| **Base Sepolia** | V9.8.0 deployed, V9.9.0 pending | Need redeploy for V9.9 |
| **Monad Testnet** | V9.6.0 | RPC issues, keeping previous |

---

## Pending Work

- [ ] **Deploy V9.9.0 to Base Sepolia** — Contains the sweep fix
- [ ] **Retry Monad Deployment** — When RPC stabilizes
- [ ] **Run HFT Benchmark** — After V9.9 deployment

---

*Last updated: 2025-12-30 23:45*
