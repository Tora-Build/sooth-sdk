# Frontend Handoff & Migration Guide

**Status:** Completed  
**Last Updated:** 2025-12-05

---

## 1. Current Status

- **Framework:** Vite + React 18
- **State Management:** Zustand
- **Web3 Library:** Wagmi v2
- **Completion:** ~85%
  - ✅ AMM trading
  - ✅ Portfolio display
  - ✅ Orderbook display
  - ⚠️ Limit orders (needs testing)
  - ⚠️ LP Dashboard (needs testing)

---

## 2. Key Architecture Decisions

- **Market Data Fetching:** Polling via Wagmi hooks
- **Orderbook Construction:** Client-side from contract events/state
- **Source of Truth:** `deployments.json` and `markets.json` in config folder

---

## 3. Known Issues & Tech Debt

- [ ] Stale balances after trade (refetch timing issue)
- [ ] Mobile wallet connect is flaky
- [ ] No error boundaries implemented

---

## 4. Environment Variables

- `VITE_RPC_URL` — RPC endpoint
- `VITE_CHAIN_ID` — Target chain ID

---

## 5. Migration Watchouts

> [!IMPORTANT]
> These items MUST be addressed during the monorepo migration.

| Issue                | Location         | Fix Required                               |
| -------------------- | ---------------- | ------------------------------------------ |
| `@/` alias           | `vite.config.ts` | Update alias to new path structure         |
| Relative ABI imports | `../config/abis` | Move to `packages/sdk` and update imports  |
| Hardcoded addresses  | `markets.json`   | Consolidate with `deployments.json` in SDK |
