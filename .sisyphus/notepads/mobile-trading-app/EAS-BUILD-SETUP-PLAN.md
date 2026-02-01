# EAS Development Build Setup Plan

**Date**: 2026-02-01  
**Status**: READY TO EXECUTE  
**Estimated Time**: 30-45 minutes

---

## Overview

Set up EAS development build for the mobile app to enable WalletConnect functionality.

---

## Prerequisites

### User Must Have
- ✅ Expo account (free tier is fine)
- ✅ Apple Developer account ($99/year) for iOS builds
- ✅ iPhone with USB cable OR TestFlight access

### Already Complete
- ✅ Code 100% complete (3,064 lines)
- ✅ TypeScript compiles
- ✅ Static verification passes
- ✅ WalletConnect project ID configured

---

## Steps

### 1. Install EAS CLI (User)

```bash
npm install -g eas-cli
```

### 2. Login to Expo (User)

```bash
eas login
```

### 3. Configure EAS Build (Agent)

```bash
cd apps/mobile
eas build:configure
```

This creates `eas.json` with build profiles.

### 4. Update `eas.json` (Agent)

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

### 5. Create Development Build (User)

```bash
cd apps/mobile
eas build --profile development --platform ios
```

**What happens**:
- EAS builds custom development client
- Includes all native modules (WalletConnect, etc.)
- Takes 10-20 minutes
- Outputs `.ipa` file or TestFlight link

### 6. Install on iPhone (User)

**Option A: Direct Install (USB)**
```bash
# Download .ipa from EAS dashboard
# Install via Xcode or Apple Configurator
```

**Option B: TestFlight (Easier)**
- EAS provides TestFlight link
- User installs via TestFlight app
- No USB cable needed

### 7. Start Development Server (User)

```bash
cd apps/mobile
npx expo start --dev-client
```

**What happens**:
- Metro bundler starts
- Development client connects
- App loads with WalletConnect working

---

## Expected Outcomes

### After Build Completes
- ✅ Custom development client installed on iPhone
- ✅ WalletConnect works (no NitroModules error)
- ✅ All native modules functional
- ✅ Hot reload still works

### Testing Flow
1. Open development client on iPhone
2. Scan QR from `npx expo start --dev-client`
3. App launches with full functionality
4. Test wallet connection
5. Test market discovery
6. Test trading
7. Test portfolio

---

## Iteration Speed

### Before (Expo Go)
- ❌ Instant QR scan
- ❌ But doesn't work (NitroModules error)

### After (EAS Build)
- ✅ Initial build: 10-20 min (one-time)
- ✅ Code changes: Instant (hot reload)
- ✅ Native module changes: Rebuild (10-20 min)

**Net result**: Slightly slower initial setup, but full functionality.

---

## Cost

### Free Tier (Expo)
- 30 builds/month
- Sufficient for development

### Paid Tier (Optional)
- $29/month: Unlimited builds
- Not needed for this project

### Apple Developer
- $99/year (required for iOS)
- User already has this (assumption)

---

## Troubleshooting

### Build Fails
- Check `eas.json` syntax
- Verify Apple Developer account linked
- Check EAS dashboard for error logs

### App Won't Install
- Verify device UDID registered
- Check provisioning profile
- Try TestFlight instead of direct install

### WalletConnect Still Errors
- Verify `.env` has real project ID
- Check network connectivity
- Verify Base Sepolia RPC accessible

---

## Documentation Updates Needed

After successful build:

1. Update `apps/mobile/README.md`:
   - Remove "Expo Go" instructions
   - Add EAS build instructions
   - Add TestFlight installation guide

2. Update `.sisyphus/plans/mobile-trading-app.md`:
   - Mark Task 3 complete (Expo setup)
   - Update acceptance criteria for Tasks 4-7
   - Document EAS build requirement

3. Update `USER-ACTION-REQUIRED.md`:
   - Replace Expo Go steps with EAS build steps
   - Add Apple Developer account requirement
   - Add estimated time (30-45 min)

---

## Success Criteria

- [ ] `eas build --profile development --platform ios` succeeds
- [ ] Development client installed on iPhone
- [ ] `npx expo start --dev-client` launches app
- [ ] WalletConnect modal appears (no NitroModules error)
- [ ] User can connect wallet
- [ ] Markets display
- [ ] Trading executes
- [ ] Portfolio shows positions

---

## Next Agent Instructions

1. Run `eas build:configure` in `apps/mobile`
2. Create/update `eas.json` with development profile
3. Update all documentation (README, plan, user guide)
4. Provide user with clear build instructions
5. Mark research task complete in plan

---

**Status**: Plan ready. Awaiting execution.
