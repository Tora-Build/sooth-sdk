# Issues

## 2026-01-31 Dev Client blocker: Privy allowed app identifier

## 2026-01-31 Dev Client warning: "Ping reached timeout"
Logcat shows `Error: Ping reached timeout` after deep linking to `sooth://login`. Likely a transient Dev Client connection issue; retry reload if login UI appears blank.

Logcat shows `Error: Native app ID com.sooth.mobile has not been set as an allowed app identifier in the Privy dashboard.`
Action: add com.sooth.mobile to the allowed app identifiers in Privy dashboard for the EXPO_PUBLIC_PRIVY_APP_ID, then retry login.

## 2026-01-31 Privy mobile URL scheme missing
Privy dashboard screenshot shows Allowed app URL schemes is empty. Must add `sooth` (matches app.json scheme) and click **Save Changes** so mobile auth deep links work.



## Unintended Edits Reverted (2026-01-31)

**Issue**: Prior subagent accidentally modified two sacred files:
- `.sisyphus/plans/mobile-trading-app.md` — All checkboxes marked as `[x]` (completed)
- `.sisyphus/notepads/mobile-trading-app/learnings.md` — Truncated from 232 to 19 lines

**Resolution**: Both files restored to HEAD state using `git checkout -- <file>`. Plan file is now clean with all checkboxes reset to `[ ]` (uncompleted). Learnings file restored to full 232-line content.

**Lesson**: Plan files are sacred and must never be modified by subagents. Only the Orchestrator manages plan state.

## 2026-01-31 Proceeding with Task 2 while Privy blocker persists
User has not yet updated Privy App settings (Settings → Basics → Mobile) to add `com.sooth.mobile` as allowed app identifier. Task 3 remains blocked on user action. Proceeding with Task 2 (SDK-core extraction) which is independent and unblocked.

## $(date +%Y-%m-%d) - SDK-core ESM Import Issues

**Issue**: sdk-core build completes but runtime imports fail with ERR_MODULE_NOT_FOUND

**Root Cause**: TypeScript doesn't automatically add `.js` extensions to imports when compiling to ESM. All import statements need explicit `.js` extensions.

**Files Needing Fix**:
- `packages/sdk-core/src/index.ts` - ✅ FIXED
- `packages/sdk-core/src/abis/index.ts` - needs `.js` extensions
- `packages/sdk-core/src/math/index.ts` - needs `.js` extensions  
- `packages/sdk-core/src/config/index.ts` - needs `.js` extensions
- `packages/sdk-core/src/contracts/index.ts` - needs `.js` extensions
- All other files that have relative imports

**Status**: Task 2 is INCOMPLETE - sdk-core builds but exports don't work at runtime
