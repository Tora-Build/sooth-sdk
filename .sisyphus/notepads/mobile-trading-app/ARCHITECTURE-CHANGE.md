# Architecture Change: Remove Privy, Add Wallet Apps

**Date**: 2026-02-01  
**Decision**: Remove Privy embedded wallet, support popular wallet apps instead  
**Impact**: Major - affects auth, build config, and user flow

---

## Why This Change

### Problems with Privy
1. **Build Complexity**: Requires native modules (NitroModules)
2. **EAS Build Issues**: pnpm workspace + native modules = complex build setup
3. **Development Build Required**: Cannot use Expo Go
4. **Build Time**: Slow remote builds

### Benefits of Wallet Apps
1. **No Native Modules**: Standard Expo managed workflow
2. **Simpler Build**: Can use Expo Go for development
3. **Faster Iteration**: No EAS build needed for testing
4. **Standard Pattern**: WalletConnect is well-established
5. **User Familiarity**: Users already have wallet apps

---

## Popular Wallet Apps to Support

### Primary: WalletConnect v2
- **Library**: `@walletconnect/modal-react-native`
- **Supports**: MetaMask, Rainbow, Trust Wallet, Coinbase Wallet, 300+ wallets
- **Pattern**: QR code or deep link to wallet app
- **Expo Compatible**: Yes (no native modules in latest version)

### Alternative: RainbowKit (if React Native version exists)
- Check if `@rainbow-me/rainbowkit` has React Native support
- May be web-only

---

## Implementation Plan

### 1. Remove Privy Dependencies
```bash
cd apps/mobile
pnpm remove @privy-io/expo @privy-io/expo-native-extensions
```

### 2. Add WalletConnect
```bash
pnpm add @walletconnect/modal-react-native @walletconnect/react-native-compat
pnpm add @react-native-async-storage/async-storage
```

### 3. Update Configuration
- Remove Privy app ID from `.env`
- Add WalletConnect project ID (get from https://cloud.walletconnect.com)
- Remove `expo-dev-client` plugin (no longer needed)
- Simplify `eas.json` (remove prebuild hook)

### 4. Update Code
**Files to modify**:
- `app/_layout.tsx` - Replace PrivyProvider with WalletConnectModal
- `app/login.tsx` - Replace Privy login with WalletConnect button
- `src/lib/client.ts` - Update wallet client creation
- Remove Privy-specific polyfills if any

### 5. User Flow Changes
**Before (Privy)**:
1. User taps "Login with Email/Google/Apple"
2. Privy creates embedded wallet
3. User never leaves app

**After (WalletConnect)**:
1. User taps "Connect Wallet"
2. WalletConnect shows wallet list
3. User selects wallet app (e.g., MetaMask)
4. App opens wallet app
5. User approves connection
6. Returns to app

---

## Benefits of This Change

### For Development
- ✅ Can use Expo Go (no build needed)
- ✅ Faster iteration (instant reload)
- ✅ Simpler build config
- ✅ No pnpm workspace issues
- ✅ No native module compilation

### For Users
- ✅ Use existing wallet (no new account)
- ✅ Familiar UX (standard wallet pattern)
- ✅ More secure (keys in dedicated wallet app)
- ✅ Works with hardware wallets

### For Testing
- ✅ Can test immediately in Expo Go
- ✅ No EAS build wait time
- ✅ No iPhone installation needed
- ✅ Can test on Android too

---

## Risks & Mitigations

### Risk 1: User Friction
**Issue**: Users need to install wallet app first  
**Mitigation**: Show "Install MetaMask" link if no wallet detected

### Risk 2: App Switching
**Issue**: User leaves app to approve in wallet  
**Mitigation**: Standard pattern, users are familiar with it

### Risk 3: WalletConnect Compatibility
**Issue**: May have React Native issues  
**Mitigation**: WalletConnect v2 is designed for React Native

---

## Implementation Steps

1. **Research** (5 min)
   - Verify WalletConnect React Native compatibility
   - Check latest docs
   - Get project ID

2. **Remove Privy** (10 min)
   - Uninstall packages
   - Remove from code
   - Clean up config

3. **Add WalletConnect** (30 min)
   - Install packages
   - Set up provider
   - Update login screen
   - Update client creation

4. **Test in Expo Go** (15 min)
   - Run `npx expo start`
   - Test on iPhone with Expo Go
   - Connect MetaMask
   - Verify wallet connection

5. **Update Documentation** (10 min)
   - Update README
   - Update HANDOFF.md
   - Document wallet setup

**Total Time**: ~1 hour

---

## Decision

**Proceed with this change?**

This will:
- ✅ Unblock all runtime testing (can use Expo Go)
- ✅ Simplify build process significantly
- ✅ Enable immediate testing
- ✅ Follow standard Web3 mobile patterns

**Recommendation**: YES - This is a better architecture for a mobile trading app.
