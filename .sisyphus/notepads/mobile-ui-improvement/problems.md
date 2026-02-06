# Mobile UI/UX Improvement - Problems

## CRITICAL BLOCKER: WalletConnect Initialization Failure

### Error
```
TypeError: _this18.cached.forEach is not a function (it is undefined)
```

### Location
`@walletconnect/core@2.21.10/dist/index.cjs.js:1:73435`

### Impact
- **Complete blocker** - wallet connection is impossible
- App loads but users cannot connect wallets
- Error appears 3 times on screen (same error logged multiple times)

### Root Cause
WalletConnect's `@walletconnect/core` package attempts to call `.forEach()` on cached data that is `undefined`. This happens during initialization when:
1. WalletConnect reads cached session data from AsyncStorage
2. The cached data doesn't exist or is corrupted
3. WalletConnect assumes it's an array and calls `.forEach()` without null checks
4. App crashes because `undefined.forEach()` is invalid

### Attempted Fixes (All Failed)

#### Attempt 1: Wrapped AsyncStorage with error handling
- File: `apps/mobile/src/lib/appkit.ts`
- Added `safeStorage` wrapper with try-catch on getItem/setItem/removeItem
- **Result**: FAILED - error occurs inside WalletConnect before our wrapper is called

#### Attempt 2: Cleared Metro cache and restarted
- Command: `npx expo start --dev-client --clear`
- Restarted Metro on port 8082
- **Result**: FAILED - error persists

#### Attempt 3: Added cache clearing on startup
- File: `apps/mobile/src/lib/appkit.ts`
- Added `clearWalletConnectCache()` function to remove all WC keys from AsyncStorage
- **Result**: FAILED - cache clears but WalletConnect still crashes on init

#### Attempt 4: Manual app restart
- User closed and reopened app multiple times
- **Result**: FAILED - error persists every time

#### Attempt 5: Version-based storage reset
- Files: `apps/mobile/src/lib/storage-init.ts`, `apps/mobile/polyfills.ts`
- Added storage version tracking with `AsyncStorage.clear()` on version mismatch
- **Result**: FAILED - storage clears but error still occurs during WC initialization

#### Attempt 6: Lazy initialization
- File: `apps/mobile/src/lib/appkit.ts`
- Changed to async `getAppKit()` function to delay initialization
- **Result**: FAILED - error still occurs when WalletConnect initializes

### Package Versions
```json
"@reown/appkit-react-native": "^2.0.1",
"@reown/appkit-ethers-react-native": "^2.0.1",
"@walletconnect/modal-react-native": "^1.1.0",
"@walletconnect/react-native-compat": "^2.23.4"
```

Installed versions:
- `@walletconnect/core@2.21.10` (from @reown/appkit-react-native)
- `@walletconnect/core@2.11.0` (from @walletconnect/modal-react-native)

**Version conflict detected**: Two different versions of `@walletconnect/core` are installed.

### Remaining Options

#### Option 1: Patch WalletConnect Core (Recommended)
Use `patch-package` to modify `@walletconnect/core` and add null checks:

1. Find the code in `node_modules/@walletconnect/core/dist/index.cjs.js` that does `_this18.cached.forEach(...)`
2. Add null check: `if (_this18.cached && Array.isArray(_this18.cached))`
3. Generate patch file with `npx patch-package @walletconnect/core`
4. Commit patch to repo

**Pros**: Fixes the root cause  
**Cons**: Requires patching a minified file, may break on package updates

#### Option 2: Downgrade WalletConnect Versions
Try older versions that are known to work:

```bash
cd apps/mobile
npm install @walletconnect/react-native-compat@2.21.8
npm install @reown/appkit-react-native@1.x.x
```

**Pros**: May avoid the bug entirely  
**Cons**: Lose newer features, may have other bugs

#### Option 3: Remove @walletconnect/modal-react-native
The version conflict (2.11.0 vs 2.21.10) may be causing issues:

```bash
cd apps/mobile
npm uninstall @walletconnect/modal-react-native
```

**Pros**: Eliminates version conflict  
**Cons**: May break other functionality that depends on it

#### Option 4: Switch to Different Wallet Library
Use a different wallet connection library:
- RainbowKit (if React Native support exists)
- Direct WalletConnect v2 integration
- Privy

**Pros**: May work better  
**Cons**: Requires significant refactoring

### Recommendation

**Try Option 3 first** (remove @walletconnect/modal-react-native), then **Option 2** (downgrade), then **Option 1** (patch).

Option 4 should be last resort as it requires major refactoring.

### Files Modified This Session
```
apps/mobile/src/lib/appkit.ts - Multiple attempts at fixing initialization
apps/mobile/src/lib/storage-init.ts - NEW - Storage version management
apps/mobile/polyfills.ts - Import storage-init before other polyfills
```

### Metro Status
- Running on port 8082 (tmux session: `mobile-build`)
- No compilation errors
- App hot-reloads successfully
- WalletConnect errors appear immediately after app loads
