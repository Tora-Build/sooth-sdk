# Session Handoff - Finalized Markets UI Audit & Fixes

**Date**: 2026-01-27  
**Session Status**: PAUSED - Resume in new session  
**Work Plan**: `.sisyphus/plans/finalized-markets-ui-audit.md`  
**Progress**: Phase 1 Complete (Audit), Ready for Phase 2-7 (Fixes)

---

## What Was Accomplished This Session

### ✅ Phase 1: Audit Complete
- Comprehensive audit of all 11 components across Portfolio, Trade, and Pro pages
- Audit report created: `.sisyphus/notepads/finalized-markets-ui-audit/audit-report.md`
- Additional issues documented: `.sisyphus/notepads/finalized-markets-ui-audit/additional-issues.md`
- Future contract fixes documented: `.sisyphus/notepads/finalized-markets-ui-audit/future-contract-fixes.md`

### 📋 Issues Identified

#### CRITICAL (P0)
1. **LP Yield Not Claimed on Redemption** ✅ DOCUMENTED FOR FUTURE CONTRACT FIX
   - Contract-level issue in `LaunchpadEngine.redeemLP()`
   - Yield remains in pool after LP redemption
   - User loses $82 yield in reported case
   - **Action**: Deferred to future contract upgrade (V11.1/V12)
   - **File**: `.sisyphus/notepads/finalized-markets-ui-audit/future-contract-fixes.md`

2. **AMMSettlementCard Uses Mock Data** ⏳ READY TO FIX
   - File: `apps/web/src/components/features/AMMSettlementCard.tsx`
   - Lines 54-57: Hardcoded `yesShares: 0n, noShares: 0n`
   - Users can't see positions or claim payouts
   - Fix: Use `useAMMPositionDirect(address)` hook

#### HIGH (P1)
3. **LPHolders Returns Null on Finalized Markets** ⏳ READY TO FIX
   - File: `apps/web/src/components/features/LPHolders.tsx`
   - Line 80-82: `if (!launchpad || !stats) return null;`
   - LP Leaderboard doesn't show on finalized Trade page
   - Fix: Add fallback for finalized markets when stats fails

4. **AMM Positions Not Showing** ⏳ NEEDS INVESTIGATION
   - User reports having AMM shares but not seeing them
   - Likely `useAMMPositionDirect` hook issue
   - Need to verify hook works for finalized markets

5. **Wrong Stage Badges** ⏳ NEEDS INVESTIGATION
   - Shows "Bonding" instead of "Live"
   - Data issue in `useOnChainMarkets` hook
   - Need to verify `isGraduated` fetch

#### MEDIUM (P2)
6. **UserOrdersPanel in Pro Finalized View** ⏳ NEEDS DECISION
   - Currently shows in Pro finalized view (lines 1206-1221)
   - Question: Should it show? Keep/Remove/Simplify?
   - Need to check if orders remain active after finalization

7. **UI Improvements Needed** ⏳ READY TO IMPLEMENT
   - AMMSettlementCard visual hierarchy
   - Pro finalized view UI polish
   - Consistent styling across pages

---

## Work Plan Status

### Completed Phases
- ✅ **Phase 1**: Audit & Document Current State (1 task)

### Remaining Phases
- ⏳ **Phase 2**: Fix Stage Detection (2 tasks)
- ⏳ **Phase 3**: Fix Position Display (3 tasks)
- ⏳ **Phase 4**: Fix LP Leaderboard (1 task)
- ⏳ **Phase 5**: UI Improvements (2 tasks)
- ⏳ **Phase 6**: Pro Page Decision (1 task)
- ⏳ **Phase 7**: Final Verification (1 task)

**Total Remaining**: 10 tasks across 6 phases

---

## Next Session: Start Here

### Immediate Actions

1. **Read the work plan**:
   ```bash
   cat .sisyphus/plans/finalized-markets-ui-audit.md
   ```

2. **Read the audit report**:
   ```bash
   cat .sisyphus/notepads/finalized-markets-ui-audit/audit-report.md
   ```

3. **Start with Phase 2, Task 2.1**: Fix AMMSettlementCard Mock Data
   - This is the most critical user-facing issue
   - Clear fix: Replace mock data with `useAMMPositionDirect` hook
   - File: `apps/web/src/components/features/AMMSettlementCard.tsx`

### Recommended Execution Order

**Priority 1 - Critical Fixes** (Do First):
1. Fix AMMSettlementCard mock data (Phase 2, Task 2.1)
2. Fix LPHolders null return (Phase 4)

**Priority 2 - High Impact** (Do Second):
3. Verify stage detection (Phase 2, Task 2.1)
4. Fix stage badges (Phase 2, Task 2.2)
5. Verify AMM positions display (Phase 3, Task 3.1)

**Priority 3 - Polish** (Do Last):
6. UI improvements (Phase 5)
7. Pro page UserOrdersPanel decision (Phase 6)
8. Final verification (Phase 7)

---

## Key Files Reference

### Work Plan & Documentation
- **Work Plan**: `.sisyphus/plans/finalized-markets-ui-audit.md`
- **Audit Report**: `.sisyphus/notepads/finalized-markets-ui-audit/audit-report.md`
- **Additional Issues**: `.sisyphus/notepads/finalized-markets-ui-audit/additional-issues.md`
- **Future Contract Fixes**: `.sisyphus/notepads/finalized-markets-ui-audit/future-contract-fixes.md`
- **This Handoff**: `.sisyphus/notepads/finalized-markets-ui-audit/SESSION-HANDOFF.md`

### Components to Fix
- **AMMSettlementCard**: `apps/web/src/components/features/AMMSettlementCard.tsx`
- **LPHolders**: `apps/web/src/components/features/LPHolders.tsx`
- **Portfolio**: `apps/web/src/pages/Portfolio.tsx`
- **Trade**: `apps/web/src/pages/Trade.tsx`
- **Pro**: `apps/web/src/pages/Pro.tsx`
- **UserOrdersPanel**: `apps/web/src/components/features/pro/UserOrdersPanel.tsx`

### Hooks to Verify
- **useOnChainMarkets**: `apps/web/src/hooks/useOnChainMarkets.ts` (stage detection)
- **useAMMPositionDirect**: `apps/web/src/hooks/useAMMPositionDirect.ts` (AMM positions)
- **useMarketStatsMath**: `apps/web/src/hooks/useMarketStatsMath.ts` (LP stats)
- **useLaunchpadMarketDirect**: `apps/web/src/hooks/useLaunchpadMarketDirect.ts` (launchpad data)

---

## Quick Start Commands for Next Session

```bash
# Navigate to project
cd /Users/danieltang/GitHub/sooth-alpha

# Check git status
git status

# Read work plan
cat .sisyphus/plans/finalized-markets-ui-audit.md

# Read audit report
cat .sisyphus/notepads/finalized-markets-ui-audit/audit-report.md

# Read this handoff
cat .sisyphus/notepads/finalized-markets-ui-audit/SESSION-HANDOFF.md

# Start dev server for testing
cd apps/web && npm run dev
```

---

## Context for Next Agent

### User's Original Request
User reported multiple issues with finalized market displays:
1. Portfolio page shows wrong stage badge ("Bonding" instead of "Live")
2. User has both LP tokens AND AMM shares, but AMM shares not showing
3. LP Leaderboard broken on finalized Trade page
4. **NEW**: After LP redemption, LP yield ($82) not claimed - documented for future contract fix

### User's Directive
- "fix all" - Fix all UI issues except LP yield (contract issue)
- "record 1 for future fix" - LP yield issue documented in `future-contract-fixes.md`
- "resume and remain the plan in new session" - Continue with work plan in fresh session

### What User Expects
- All position types (AMM, LP, TickBook) display correctly on finalized markets
- Correct stage badges across all pages
- LP Leaderboard works on finalized Trade page
- Improved UI for finalized market components
- Decision made on UserOrdersPanel in Pro finalized view

### Testing Approach
- Manual testing with real finalized market
- User will verify with their wallet
- No automated tests required (infrastructure doesn't exist)

---

## Important Notes

### LP Yield Issue - DO NOT FIX IN FRONTEND
The LP yield not being claimed is a **contract-level bug** in `LaunchpadEngine.redeemLP()`. 

**Why it can't be fixed in frontend**:
- Contract doesn't have a separate `claimYield()` function
- `redeemLP()` doesn't distribute yield, only principal
- Yield calculation includes `lpYieldPool` in floor but doesn't transfer it
- This requires a contract upgrade to fix

**What was done**:
- Issue fully documented in `.sisyphus/notepads/finalized-markets-ui-audit/future-contract-fixes.md`
- Proposed contract fixes provided (Option A: include in redemption, Option B: separate claim function)
- Marked for V11.1 or V12 contract upgrade

**Frontend action**: NONE - Focus on other UI issues

### Git Status
- Working tree is clean except for:
  - `.sisyphus/` directory (untracked, expected)
  - `packages/contracts-testing/script/interactive/commands/market.ts` (modified, unrelated)

### Token Usage
- This session used ~133k/200k tokens
- Fresh session will have full 200k budget
- Work plan is comprehensive but can be executed incrementally

---

## Execution Strategy for Next Session

### Approach A: Systematic (Recommended)
Follow the work plan phases in order:
1. Phase 2: Fix stage detection (2 tasks)
2. Phase 3: Fix position display (3 tasks)
3. Phase 4: Fix LP Leaderboard (1 task)
4. Phase 5: UI improvements (2 tasks)
5. Phase 6: Pro page decision (1 task)
6. Phase 7: Final verification (1 task)

**Pros**: Thorough, organized, follows plan  
**Cons**: Takes more time

### Approach B: Critical First (Alternative)
Fix critical issues first, then polish:
1. Fix AMMSettlementCard mock data
2. Fix LPHolders null return
3. Verify stage detection and AMM positions
4. UI improvements and Pro page decision
5. Final verification

**Pros**: Gets critical fixes deployed faster  
**Cons**: Less systematic

### Recommended: Approach B
User wants "fix all" but critical issues should be prioritized for immediate deployment.

---

## Success Criteria (From Work Plan)

### Must Have
- ✅ Correct stage detection and display
- ✅ All position types visible when user has balance > 0
- ✅ Working claim/redeem actions for finalized markets
- ✅ Consistent UI patterns across pages

### Verification
- [ ] Portfolio page shows correct stage badges
- [ ] AMM positions visible when user has shares
- [ ] LP Leaderboard renders on finalized Trade page
- [ ] All claim/redeem buttons work
- [ ] UI improvements visible and polished
- [ ] Pro page UserOrdersPanel decision implemented
- [ ] Build passes with no TypeScript errors
- [ ] Manual testing complete with real finalized market

---

## Final Notes

This is a well-scoped, well-documented project. The audit is complete, issues are identified, and the work plan is ready to execute.

**Key Success Factor**: Follow the work plan systematically. Each task has:
- Clear "What to do"
- Clear "Must NOT do"
- Acceptance criteria
- Commit strategy

**Estimated Effort**: 10 tasks, ~2-3 hours of focused work

**Next Agent**: Start with Phase 2, Task 2.1 (Fix AMMSettlementCard). Good luck! 🚀
