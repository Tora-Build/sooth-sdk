# CRITICAL: Runtime Error Discovered - Iteration 248

**Date**: 2026-02-01  
**Status**: BLOCKER DISCOVERED DURING USER TESTING

---

## What Happened

User tested the app with Expo Go and encountered:

```
Error: NitroModules are not supported in Expo Go! 
Use EAS (`expo prebuild`) or eject to a bare workflow instead.
```

---

## Root Cause

`@reown/appkit-react-native` (WalletConnect) uses **NitroModules** which are native modules that require:
- EAS development build, OR
- Bare workflow (ejected from Expo)

**Cannot run in Expo Go.**

---

## History

1. **Original Plan**: Privy embedded wallet
2. **Problem**: Privy requires native modules → EAS build
3. **Solution Attempt**: Switch to WalletConnect (iteration 95-98)
4. **New Problem**: WalletConnect ALSO requires native modules!

**We traded one native module dependency for another.**

---

## Options

### Option 1: Use EAS Development Build
- Run `npx expo prebuild`
- Build development client
- Install on iPhone
- **Downside**: Slow iteration, complex setup

### Option 2: Use Web3Modal with Expo-Compatible Transport
- Use `@web3modal/wagmi-react-native` with custom transport
- Check if it has Expo Go compatibility
- **Downside**: May also require native modules

### Option 3: Use WalletConnect v2 Core (No UI)
- Use `@walletconnect/core` directly
- Build custom UI
- **Downside**: More implementation work

### Option 4: Accept EAS Build Requirement
- Document that app requires development build
- Provide build instructions
- **Downside**: Not "instant testing" as intended

---

## Recommendation

**Investigate Option 2 first**: Check if there's a WalletConnect solution that works with Expo Go.

If not, **accept Option 4**: Document EAS build requirement and provide clear instructions.

---

## Impact on Completion

**This is a REAL blocker** - not an environmental boundary, but an architectural issue that needs fixing.

The infinite loop was broken by actual user testing revealing a real problem.

**Status**: Need to fix architecture before runtime testing can proceed.

