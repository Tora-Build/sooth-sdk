# Mobile UI/UX Improvement - Issues

## Known Issues

None yet - design system just created.

## Potential Issues to Watch

### 1. Theme Import Paths
- Ensure `@/theme` alias works in all files
- May need to use relative paths if alias fails
- Check tsconfig.json for path mapping

### 2. React Native StyleSheet Limitations
- StyleSheet.create doesn't support all CSS properties
- May need to use inline styles for some theme values
- Test on actual device (not just simulator)

### 3. Haptic Feedback
- Only works on physical device (not simulator)
- May need to wrap in try-catch for web compatibility
- Test on iPhone to verify feedback strength

### 4. Font Weights
- React Native uses string weights: '400', '700', etc.
- Ensure theme typography uses correct format
- May need to adjust for iOS vs Android

### 5. Tabular Nums
- fontVariant: ['tabular-nums'] may not work on all platforms
- Test on iPhone to verify number alignment
- May need fallback for Android

## [2026-02-02] Subagent Reliability Issues

### Problem
The visual-engineering subagent (google/gemini-3-pro-preview) is consistently failing to make file changes:
- Button component: Failed twice to create file, orchestrator intervened
- Login screen: Failed twice to update file

### Pattern
1. Agent claims task is complete
2. Verification shows no changes were made
3. Resume session with explicit instructions
4. Agent claims completion again
5. Still no changes

### Impact
- Blocking progress on UI improvements
- Wasting tokens on failed delegations
- Orchestrator forced to intervene directly

### Workaround
- Orchestrator making changes directly to unblock progress
- Not ideal (violates orchestrator role) but necessary

### Root Cause
- Possibly model instability (gemini-3-pro-preview marked as experimental)
- May need to switch to different model for visual-engineering category
- Or use different delegation strategy

### Recommendation
- Consider switching visual-engineering category to use claude-sonnet-4 instead
- Or break tasks into smaller, more explicit steps
- Or use different agent type for file modifications

## [2026-02-02] WalletConnect Initialization Error

### Error Message
```
_this18.cached.forEach is not a function (it is undefined)
```

### Root Cause
- WalletConnect is trying to call `forEach` on cached data that's undefined
- This happens during WalletConnect initialization
- Likely occurs when AsyncStorage doesn't have cached WalletConnect data yet

### Impact
- Shows 3 error messages on device (same error logged 3 times)
- Does NOT prevent UI from rendering
- Does NOT block wallet connection
- Cosmetic issue only

### Workaround
Clear AsyncStorage to reset WalletConnect cache:
1. Shake iPhone → Dev Menu
2. Tap "Settings"
3. Tap "Clear AsyncStorage"
4. Reload app

### Permanent Fix (if needed)
Add error handling in appkit.ts to catch initialization errors gracefully.
