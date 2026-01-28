# Finalized Markets UI Audit & Improvement

## Context

### Original Request
User reported multiple issues with finalized market displays:
1. Portfolio page shows wrong stage badge ("Bonding" instead of "Live")
2. User has both LP tokens AND AMM shares, but AMM shares not showing
3. LP Leaderboard broken on finalized Trade page
4. Need to audit ALL position/claim components across Trade, Pro, Portfolio
5. Improve UI of position components in Trade/Pro pages
6. Decide whether to remove order details in Pro page's finalized status

### Interview Summary
**Key Issues Identified**:
- Stage detection logic may be broken (shows "bonding" when should be "live")
- AMM position display missing despite user having shares
- LP Leaderboard not rendering or showing wrong data on finalized markets
- Need consistent UI/UX for finalized markets across all pages

**Research Findings**:
- Stage logic in `useOnChainMarkets.ts` lines 152-164: `bonding → live → settled → finalized → dismissed`
- Stage determined by: `isDismissed > isFinalized > isSettled > isGraduated > bonding`
- AMMPositionRow returns null if `yesShares === 0n && noShares === 0n` (line 56)
- LPHolders returns null if `!launchpad || !stats` (line 80-82)
- Pro page has UserOrdersPanel in finalized view (may not be needed)

**Component Locations**:
- Portfolio: `apps/web/src/pages/Portfolio.tsx`
  - AMMPositionRow (line 31-95)
  - LPPositionRow (line 97-195)
  - TickBookInternalRow (line 197-267)
  - LockedSharesRow (line 269-336)
- Trade: `apps/web/src/pages/Trade.tsx`
  - AMMSettlementCard (imported from components/features)
  - LPHolders (line 468)
  - DismissedMarketPanel (imported)
- Pro: `apps/web/src/pages/Pro.tsx`
  - Settled/Finalized view (lines 1082-1228)
  - UserOrdersPanel in finalized view (line 1202)

---

## Work Objectives

### Core Objective
Audit and fix all position display and claim action components across Trade, Pro, and Portfolio pages for finalized markets, ensuring consistent UI/UX and correct data display.

### Concrete Deliverables
- All position types (AMM, LP, TickBook, Locked Shares) display correctly on finalized markets
- Stage badges show correct values across all pages
- LP Leaderboard works on finalized Trade page
- Improved UI for position/claim components in Trade/Pro pages
- Decision made and implemented: keep or remove order details in Pro finalized view
- Consistent redemption flow across all pages

### Definition of Done
- [ ] Portfolio page shows correct stage badges for all markets
- [ ] AMM positions visible when user has shares (even if market is graduated/finalized)
- [ ] LP Leaderboard renders correctly on finalized Trade page
- [ ] All claim/redeem buttons work on finalized markets (Trade, Pro, Portfolio)
- [ ] UI improvements applied to Trade/Pro position components
- [ ] Pro page finalized view decision implemented (orders panel kept or removed)
- [ ] Build passes with no TypeScript errors
- [ ] Manual testing confirms all positions display and actions work

### Must Have
- Correct stage detection and display
- All position types visible when user has balance > 0
- Working claim/redeem actions for finalized markets
- Consistent UI patterns across pages

### Must NOT Have (Guardrails)
- ❌ DO NOT break existing functionality for non-finalized markets
- ❌ DO NOT add new RPC calls that scale with market count
- ❌ DO NOT change contract interaction logic (only UI/display)
- ❌ DO NOT modify redemption contract calls (they work, just UI issues)
- ❌ DO NOT skip verification of each component type

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (no automated frontend tests)
- **User wants tests**: Manual verification with real wallet
- **Framework**: Browser testing with connected wallet
- **QA approach**: Test each component type on finalized market

### Verification Approach
1. **Stage Detection**: Check Portfolio page shows correct badges
2. **AMM Positions**: Verify AMM shares display when balance > 0
3. **LP Leaderboard**: Confirm renders on finalized Trade page
4. **Claim Actions**: Test all redeem buttons work
5. **UI Quality**: Visual review of improved components

---

## Task Flow

```
Phase 1: Audit & Document Current State
    ↓
Phase 2: Fix Stage Detection
    ↓
Phase 3: Fix Position Display (AMM, LP, TickBook)
    ↓
Phase 4: Fix LP Leaderboard
    ↓
Phase 5: UI Improvements (Trade/Pro)
    ↓
Phase 6: Pro Page Finalized View Decision
    ↓
Phase 7: Verification & Testing
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 2.1, 2.2 | Independent file changes |
| B | 3.1, 3.2, 3.3 | Independent component fixes |
| C | 5.1, 5.2 | Independent page improvements |

| Task | Depends On | Reason |
|------|------------|--------|
| 2.x | 1 | Need audit results before fixing |
| 3.x | 2 | Need correct stage data before fixing displays |
| 4 | 3 | LP Leaderboard depends on correct data flow |
| 5.x | 3, 4 | UI improvements after functionality fixed |
| 6 | 5 | Decision after seeing improved UI |
| 7 | 6 | Final verification after all changes |

---

## TODOs

### Phase 1: Audit & Document Current State

- [ ] 1. Audit All Position Components

  **What to do**:
  1. **Portfolio page audit**:
     - Check AMMPositionRow: When does it return null? What data does it need?
     - Check LPPositionRow: Same questions
     - Check TickBookInternalRow: Same questions
     - Check LockedSharesRow: Same questions
     - Document which components show on finalized markets
  
  2. **Trade page audit**:
     - Check AMMSettlementCard: Does it handle finalized markets?
     - Check LPHolders: Why does it return null on finalized markets?
     - Check DismissedMarketPanel: When does it show?
     - Document redemption flow
  
  3. **Pro page audit**:
     - Check settled/finalized view (lines 1082-1228)
     - Check if UserOrdersPanel should show in finalized view
     - Document what actions are available
  
  4. **Create audit report** in `.sisyphus/notepads/finalized-markets-ui-audit/audit-report.md`:
     ```markdown
     # Component Audit Report
     
     ## Portfolio Page
     - AMMPositionRow: [findings]
     - LPPositionRow: [findings]
     - TickBookInternalRow: [findings]
     - LockedSharesRow: [findings]
     
     ## Trade Page
     - AMMSettlementCard: [findings]
     - LPHolders: [findings]
     - DismissedMarketPanel: [findings]
     
     ## Pro Page
     - Finalized view: [findings]
     - UserOrdersPanel in finalized: [findings]
     
     ## Issues Found
     1. [Issue description]
     2. [Issue description]
     
     ## Recommendations
     1. [Recommendation]
     2. [Recommendation]
     ```

  **Must NOT do**:
  - Do not make any code changes in this task
  - Do not skip any component type

  **Parallelizable**: NO (blocking for all other tasks)

  **References**:
  - Portfolio components: `apps/web/src/pages/Portfolio.tsx` lines 31-336
  - Trade components: `apps/web/src/pages/Trade.tsx`, `apps/web/src/components/features/`
  - Pro finalized view: `apps/web/src/pages/Pro.tsx` lines 1082-1228
  - Stage logic: `apps/web/src/hooks/useOnChainMarkets.ts` lines 152-164

  **Acceptance Criteria**:
  - [ ] All 11 components audited (4 Portfolio + 3 Trade + 2 Pro + 2 shared)
  - [ ] Audit report created with findings
  - [ ] Issues documented with line numbers
  - [ ] Recommendations provided for each issue

  **Commit**: NO (audit only, no code changes)

---

### Phase 2: Fix Stage Detection

- [ ] 2.1 Verify Stage Logic in useOnChainMarkets

  **What to do**:
  1. Read `apps/web/src/hooks/useOnChainMarkets.ts` lines 152-164
  2. Verify the stage detection logic is correct:
     ```typescript
     if (isDismissed) stage = 'dismissed';
     else if (isFinalized) stage = 'finalized';
     else if (isSettled) stage = 'settled';
     else if (isGraduated) stage = 'live';
     else stage = 'bonding';
     ```
  3. Check if `isGraduated` is being fetched correctly (line 106)
  4. Add console logging to debug stage detection if needed
  5. Test with real market to confirm stage is correct

  **Must NOT do**:
  - Do not change the stage priority order without understanding impact
  - Do not add new RPC calls

  **Parallelizable**: YES (with 2.2)

  **References**:
  - `apps/web/src/hooks/useOnChainMarkets.ts` lines 84-164
  - LaunchpadEngine ABI: `apps/web/src/config/abis.ts`

  **Acceptance Criteria**:
  - [ ] Stage logic verified as correct OR bug identified
  - [ ] `isGraduated` fetch confirmed working
  - [ ] If bug found: fix applied and tested
  - [ ] Console logs added for debugging (if needed)

  **Commit**: YES (if changes made)
  - Message: `fix(web): verify and fix stage detection in useOnChainMarkets`
  - Files: `apps/web/src/hooks/useOnChainMarkets.ts`
  - Pre-commit: `npm run build`

---

- [ ] 2.2 Fix Stage Badge Display in Portfolio Components

  **What to do**:
  1. Verify all 4 Portfolio row components show correct stage badges:
     - AMMPositionRow (lines 63-67)
     - LPPositionRow (lines 170-174)
     - TickBookInternalRow (lines 230-234)
     - LockedSharesRow (lines 293-297)
  2. Ensure `stage` prop is passed correctly from parent
  3. Verify badge colors match across all components:
     - bonding = indigo (cyan)
     - live = success (emerald)
     - settled = custom amber class
     - finalized = success (emerald)
     - dismissed = danger (rose)
  4. Test with real finalized market

  **Must NOT do**:
  - Do not change badge color scheme without user approval
  - Do not add new props

  **Parallelizable**: YES (with 2.1)

  **References**:
  - Portfolio row components: `apps/web/src/pages/Portfolio.tsx` lines 31-336
  - Badge component: `apps/web/src/components/ui/Badge.tsx`

  **Acceptance Criteria**:
  - [ ] All 4 components show correct stage badges
  - [ ] Badge colors consistent across components
  - [ ] Finalized markets show "Finalized" badge (emerald)
  - [ ] Visual verification with browser

  **Commit**: YES (if changes made)
  - Message: `fix(web): ensure correct stage badges in Portfolio components`
  - Files: `apps/web/src/pages/Portfolio.tsx`
  - Pre-commit: `npm run build`

---

### Phase 3: Fix Position Display

- [ ] 3.1 Fix AMM Position Display

  **What to do**:
  1. Check `AMMPositionRow` in Portfolio.tsx (line 31-95)
  2. Current logic: `if (isLoading || (yesShares === 0n && noShares === 0n)) return null;`
  3. Verify this is correct - should NOT show if user has 0 shares
  4. Check if `useAMMPositionDirect` hook is working for finalized markets
  5. Add error handling if hook fails
  6. Test with finalized market where user has AMM shares

  **Issue to investigate**: User reports having AMM shares but not seeing them. Possible causes:
  - Hook returning 0n when should have value
  - Hook failing silently
  - Component not rendering due to other condition

  **Must NOT do**:
  - Do not show row when user has 0 shares (that's correct behavior)
  - Do not add fake data

  **Parallelizable**: YES (with 3.2, 3.3)

  **References**:
  - AMMPositionRow: `apps/web/src/pages/Portfolio.tsx` lines 31-95
  - useAMMPositionDirect: `apps/web/src/hooks/useAMMPositionDirect.ts`

  **Acceptance Criteria**:
  - [ ] Hook verified working for finalized markets
  - [ ] Error handling added if needed
  - [ ] Component shows when user has shares > 0
  - [ ] Component hides when user has 0 shares
  - [ ] Tested with real finalized market

  **Commit**: YES (if changes made)
  - Message: `fix(web): ensure AMM positions display on finalized markets`
  - Files: `apps/web/src/pages/Portfolio.tsx`, possibly hook file
  - Pre-commit: `npm run build`

---

- [ ] 3.2 Fix LP Position Display

  **What to do**:
  1. Check `LPPositionRow` in Portfolio.tsx (line 97-195)
  2. Current logic: `if (!lpBalance || lpBalance === 0n) return null;`
  3. Verify LP value calculation works for finalized markets
  4. Check if `valueUsd` calculation (lines 110-155) handles finalized state
  5. Ensure redemption button shows for finalized markets (lines 185-193)
  6. Test with finalized market where user has LP tokens

  **Must NOT do**:
  - Do not change LP valuation math without understanding impact
  - Do not show row when lpBalance is 0

  **Parallelizable**: YES (with 3.1, 3.3)

  **References**:
  - LPPositionRow: `apps/web/src/pages/Portfolio.tsx` lines 97-195
  - calculateLMSRCost: `apps/web/src/pages/Portfolio.tsx` lines 13-28

  **Acceptance Criteria**:
  - [ ] LP value calculation verified for finalized markets
  - [ ] Redemption button shows when `stage === 'finalized' && lpBalance > 0n`
  - [ ] Component shows when user has LP > 0
  - [ ] Tested with real finalized market

  **Commit**: YES (if changes made)
  - Message: `fix(web): ensure LP positions display correctly on finalized markets`
  - Files: `apps/web/src/pages/Portfolio.tsx`
  - Pre-commit: `npm run build`

---

- [ ] 3.3 Fix TickBook Internal Shares Display

  **What to do**:
  1. Check `TickBookInternalRow` in Portfolio.tsx (line 197-267)
  2. Current logic: `if (isLoading || (yesInternal === 0n && noInternal === 0n)) return null;`
  3. Verify hook works for finalized markets
  4. Ensure redemption button shows for finalized markets (lines 252-260)
  5. Test with finalized market where user has TickBook shares

  **Must NOT do**:
  - Do not show row when user has 0 internal shares
  - Do not change redemption logic

  **Parallelizable**: YES (with 3.1, 3.2)

  **References**:
  - TickBookInternalRow: `apps/web/src/pages/Portfolio.tsx` lines 197-267
  - useTickBookVaultDirect: `apps/web/src/hooks/useTickBookVaultDirect.ts`

  **Acceptance Criteria**:
  - [ ] Hook verified working for finalized markets
  - [ ] Redemption button shows when `stage === 'finalized' && (yesInternal > 0n || noInternal > 0n)`
  - [ ] Component shows when user has shares > 0
  - [ ] Tested with real finalized market

  **Commit**: YES (if changes made)
  - Message: `fix(web): ensure TickBook positions display on finalized markets`
  - Files: `apps/web/src/pages/Portfolio.tsx`
  - Pre-commit: `npm run build`

---

### Phase 4: Fix LP Leaderboard

- [ ] 4. Fix LP Leaderboard on Finalized Trade Page

  **What to do**:
  1. Check `LPHolders` component: `apps/web/src/components/features/LPHolders.tsx`
  2. Current logic: `if (!launchpad || !stats) return null;` (line 80-82)
  3. Debug why component returns null on finalized markets:
     - Is `launchpad` data loading?
     - Is `stats` calculation failing?
     - Check `useMarketStatsMath` hook for finalized market handling
  4. Add error handling and fallback display
  5. Ensure Floor/Ceiling calculations work for finalized markets
  6. Test with finalized market

  **Possible issues**:
  - `useLaunchpadMarketDirect` may not work for finalized markets
  - `useMarketStatsMath` may fail if AMM state is unavailable
  - Stats calculation may need special handling for finalized state

  **Must NOT do**:
  - Do not show fake data if stats unavailable
  - Do not change LMSR math without understanding

  **Parallelizable**: NO (depends on Phase 3 data fixes)

  **References**:
  - LPHolders: `apps/web/src/components/features/LPHolders.tsx`
  - useMarketStatsMath: `apps/web/src/hooks/useMarketStatsMath.ts`
  - useLaunchpadMarketDirect: `apps/web/src/hooks/useLaunchpadMarketDirect.ts`

  **Acceptance Criteria**:
  - [ ] Component renders on finalized markets
  - [ ] Floor/Ceiling values display correctly
  - [ ] Creator and user LP positions show
  - [ ] LP Yield Pool displays (even if 0)
  - [ ] Error handling added for missing data
  - [ ] Tested with real finalized market

  **Commit**: YES
  - Message: `fix(web): ensure LP Leaderboard renders on finalized markets`
  - Files: `apps/web/src/components/features/LPHolders.tsx`, possibly hooks
  - Pre-commit: `npm run build`

---

### Phase 5: UI Improvements

- [ ] 5.1 Improve Trade Page Position Components UI

  **What to do**:
  1. Review `AMMSettlementCard` component
  2. Improve visual hierarchy:
     - Make redemption buttons more prominent
     - Add clear status indicators (Settled vs Finalized)
     - Improve spacing and alignment
  3. Add helpful text explaining what user can do
  4. Ensure consistent styling with Portfolio page
  5. Consider adding:
     - Winning outcome badge
     - Estimated redemption value
     - Clear CTA for redemption

  **Design principles**:
  - Finalized = Green theme (emerald)
  - Settled = Amber theme (waiting for finalization)
  - Clear visual distinction between states
  - Prominent action buttons

  **Must NOT do**:
  - Do not change functionality, only styling
  - Do not add new data fetching

  **Parallelizable**: YES (with 5.2)

  **References**:
  - AMMSettlementCard: `apps/web/src/components/features/launchpad/AMMSettlementCard.tsx`
  - Trade page: `apps/web/src/pages/Trade.tsx`

  **Acceptance Criteria**:
  - [ ] Improved visual hierarchy
  - [ ] Clear status indicators
  - [ ] Prominent redemption buttons
  - [ ] Helpful explanatory text
  - [ ] Consistent with Portfolio page styling
  - [ ] Visual verification with browser

  **Commit**: YES
  - Message: `feat(web): improve Trade page position component UI for finalized markets`
  - Files: `apps/web/src/components/features/launchpad/AMMSettlementCard.tsx`
  - Pre-commit: `npm run build`

---

- [ ] 5.2 Improve Pro Page Finalized View UI

  **What to do**:
  1. Review Pro page finalized view (lines 1082-1228)
  2. Improve settlement card UI:
     - Better visual hierarchy
     - Clearer winning outcome display
     - More prominent redemption button
  3. Ensure consistent with Trade page improvements
  4. Add helpful status text
  5. Consider layout improvements for better UX

  **Must NOT do**:
  - Do not change grid layout (60/40 is correct)
  - Do not change functionality

  **Parallelizable**: YES (with 5.1)

  **References**:
  - Pro finalized view: `apps/web/src/pages/Pro.tsx` lines 1082-1228

  **Acceptance Criteria**:
  - [ ] Improved visual hierarchy
  - [ ] Clear winning outcome display
  - [ ] Prominent redemption button
  - [ ] Consistent with Trade page
  - [ ] Visual verification with browser

  **Commit**: YES
  - Message: `feat(web): improve Pro page finalized view UI`
  - Files: `apps/web/src/pages/Pro.tsx`
  - Pre-commit: `npm run build`

---

### Phase 6: Pro Page Finalized View Decision

- [ ] 6. Decide: Keep or Remove UserOrdersPanel in Pro Finalized View

  **What to do**:
  1. **Analyze current state**:
     - Pro page finalized view shows UserOrdersPanel (line 1202)
     - Panel shows active orders, spot sells, and positions
     - Question: Are orders relevant on finalized markets?
  
  2. **Consider use cases**:
     - **Keep orders panel IF**:
       - Users may have unclaimed fills from before finalization
       - Users may have uncanceled orders that need cleanup
       - Showing order history provides context
     - **Remove orders panel IF**:
       - Orders are auto-canceled on finalization
       - No actions possible on finalized markets
       - Panel clutters the UI unnecessarily
  
  3. **Check contract behavior**:
     - Do orders remain active after finalization?
     - Can users claim fills on finalized markets?
     - Can users cancel orders on finalized markets?
  
  4. **Make decision and implement**:
     - **Option A: Keep panel** - Add conditional to only show if user has orders/fills
     - **Option B: Remove panel** - Remove UserOrdersPanel from finalized view entirely
     - **Option C: Simplified view** - Show only claimable fills, hide order details
  
  5. **Document decision** in `.sisyphus/notepads/finalized-markets-ui-audit/decisions.md`

  **Must NOT do**:
  - Do not make decision without checking contract behavior
  - Do not remove panel if users need to claim fills

  **Parallelizable**: NO (depends on Phase 5 UI improvements)

  **References**:
  - Pro finalized view: `apps/web/src/pages/Pro.tsx` lines 1082-1228
  - UserOrdersPanel: `apps/web/src/components/features/pro/UserOrdersPanel.tsx`
  - TickBookPoolManager contract: Check if orders remain active after finalization

  **Acceptance Criteria**:
  - [ ] Contract behavior verified (orders on finalized markets)
  - [ ] Decision made with clear reasoning
  - [ ] Implementation complete based on decision
  - [ ] Decision documented in notepad
  - [ ] Visual verification with browser

  **Commit**: YES
  - Message: `refactor(web): [keep/remove/simplify] orders panel in Pro finalized view`
  - Files: `apps/web/src/pages/Pro.tsx`, possibly UserOrdersPanel
  - Pre-commit: `npm run build`

---

### Phase 7: Verification & Testing

- [ ] 7. Final Verification & Testing

  **What to do**:
  1. **Build verification**:
     ```bash
     cd apps/web && npm run build
     ```
     Expected: No errors
  
  2. **Manual testing with finalized market**:
     - Navigate to Portfolio page
     - Verify stage badges show "Finalized" (emerald)
     - Verify all position types display (AMM, LP, TickBook)
     - Verify redemption buttons appear and work
     - Navigate to Trade page
     - Verify LP Leaderboard renders
     - Verify AMMSettlementCard shows correctly
     - Navigate to Pro page
     - Verify finalized view shows correctly
     - Verify UserOrdersPanel decision implemented
  
  3. **Test redemption flow**:
     - Click redeem button on each position type
     - Verify transaction executes
     - Verify balance updates after redemption
     - Verify position row hides after full redemption
  
  4. **Cross-page consistency check**:
     - Verify same market shows same stage on all pages
     - Verify same position values across pages
     - Verify consistent UI styling
  
  5. **Create verification report** in `.sisyphus/notepads/finalized-markets-ui-audit/verification-report.md`

  **Must NOT do**:
  - Do not skip any page
  - Do not skip any position type

  **Parallelizable**: NO (final verification)

  **References**:
  - All pages: Portfolio, Trade, Pro
  - All components: AMM, LP, TickBook, Locked Shares

  **Acceptance Criteria**:
  - [ ] Build passes with no errors
  - [ ] Portfolio page verified:
    - [ ] Correct stage badges
    - [ ] All position types display
    - [ ] Redemption buttons work
  - [ ] Trade page verified:
    - [ ] LP Leaderboard renders
    - [ ] AMMSettlementCard shows correctly
    - [ ] Improved UI visible
  - [ ] Pro page verified:
    - [ ] Finalized view shows correctly
    - [ ] UserOrdersPanel decision implemented
    - [ ] Improved UI visible
  - [ ] Redemption flow tested for all position types
  - [ ] Cross-page consistency confirmed
  - [ ] Verification report created

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 2.1 | `fix(web): verify and fix stage detection in useOnChainMarkets` | useOnChainMarkets.ts | npm run build |
| 2.2 | `fix(web): ensure correct stage badges in Portfolio components` | Portfolio.tsx | npm run build |
| 3.1 | `fix(web): ensure AMM positions display on finalized markets` | Portfolio.tsx, hooks | npm run build |
| 3.2 | `fix(web): ensure LP positions display correctly on finalized markets` | Portfolio.tsx | npm run build |
| 3.3 | `fix(web): ensure TickBook positions display on finalized markets` | Portfolio.tsx | npm run build |
| 4 | `fix(web): ensure LP Leaderboard renders on finalized markets` | LPHolders.tsx, hooks | npm run build |
| 5.1 | `feat(web): improve Trade page position component UI for finalized markets` | AMMSettlementCard.tsx | npm run build |
| 5.2 | `feat(web): improve Pro page finalized view UI` | Pro.tsx | npm run build |
| 6 | `refactor(web): [decision] orders panel in Pro finalized view` | Pro.tsx, UserOrdersPanel | npm run build |

---

## Success Criteria

### Verification Commands
```bash
# Build check
cd apps/web && npm run build  # Expected: No errors

# Dev server
npm run dev  # Expected: Starts on localhost:5173
```

### Final Checklist
- [ ] All position types display on finalized markets (Portfolio, Trade, Pro)
- [ ] Stage badges show correct values across all pages
- [ ] LP Leaderboard renders on finalized Trade page
- [ ] All redemption buttons work
- [ ] UI improvements visible and polished
- [ ] Pro page UserOrdersPanel decision implemented
- [ ] Cross-page consistency verified
- [ ] No TypeScript errors
- [ ] Manual testing complete with real finalized market

---

## CRITICAL ADDITION: LP Yield Not Claimed on Redemption

**Added**: 2026-01-27  
**Severity**: CRITICAL  
**Priority**: Fix BEFORE other tasks

### Issue
After redeeming LP tokens, LP yield is NOT claimed. User loses their yield earnings.

### Evidence
Screenshot shows:
- User: 0 LP • 0%
- LP Yield Pool: $82 (unclaimed)
- User's share: $0 (0.0%)

### Fix Required
Check if `LaunchpadEngine.redeemLP()` claims yield automatically:
- **If YES**: Verify it works, may be frontend display issue
- **If NO**: Add yield claim call to all LP redemption handlers

### Files to Fix
- Portfolio.tsx LP redemption handler
- Trade.tsx LP redemption section  
- Pro.tsx LP redemption (if exists)
- Possibly: Add "Claim Yield" button to LPHolders component

### New Task: 0. Fix LP Yield Claim on Redemption
- **Priority**: CRITICAL (do FIRST)
- **Parallelizable**: NO (blocking)
- **Commit**: YES

