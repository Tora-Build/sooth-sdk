# Immediate Action Items - Sooth Protocol dApp

**Date:** November 28, 2025
**Priority:** High
**Status:** Pending Implementation

---

## 🚨 Critical (Hardening "Real" Mode)

### 1. Robust RPC Error Handling

**Why:** Current hooks expose raw errors; network failures or user rejections can crash the UI or leave it in a bad state.
**Impact:** High - Essential for mainnet reliability.
**Effort:** 2-3 hours

**Action:**

- Wrap `TraderTerminal` and `LPDashboard` in an **ErrorBoundary** that can catch render errors from hooks.
- Implement a global **Toast Notification** system (e.g., `react-hot-toast`) to display transaction failures (User Rejected, Insufficient Funds) in a user-friendly way.

### 2. Data Read Fallbacks

**Why:** `useReadContract` returns `undefined` while loading or on error. The UI must not flicker or break during these states.
**Impact:** Medium - Polished UX.
**Effort:** 1-2 hours

**Action:**

- Audit `TraderTerminal.tsx` and `LPDashboard.tsx`.
- Ensure all price/balance displays have a loading skeleton or safe default (e.g., `0.00` or `-`) when `isOnChain` is true but data is pending.

---

## ⚠️ High Priority (Safety & Verification)

### 3. Automated Testing for Gating Logic

**Why:** The dual-mode logic (`mode === 'real'`) is critical. A regression could accidentally send a real user to the demo simulation path or vice versa.
**Impact:** High - Security/Safety.
**Effort:** 4 hours

**Action:**

- Set up **Vitest**.
- Write unit tests for `TraderTerminal` that mock the `Market` prop.
- **Verify:**
  - If `market.mode === 'real'`, `useTrade` hook is called.
  - If `market.mode === 'demo'`, `onSimulateTrade` is called.

### 4. Slippage Protection (Real Mode)

**Why:** On-chain trades currently execute without explicit slippage limits in the UI args (though the contract may have defaults, the UI should control this).
**Impact:** High - User fund safety.
**Effort:** 2-3 hours

**Action:**

- Add a "Slippage Tolerance" dropdown (0.5%, 1%, etc.) to `TraderTerminal`.
- Pass `minOutput` or `maxPrice` parameters to the `trade` function in `useMarket.ts`.

---

## 📋 Medium Priority

### 5. Polling / Real-time Updates

**Why:** On-chain data goes stale.
**Action:** Configure `wagmi` hooks with `refetchInterval: 10_000` (10s) for active markets.

---

## ✅ Checklist

- [ ] Install `react-hot-toast` & `vitest`
- [ ] Create `ErrorBoundary.tsx`
- [ ] Add loading skeletons for on-chain data
- [ ] Write unit test: `TraderTerminal` gating logic
- [ ] Add slippage UI parameter
