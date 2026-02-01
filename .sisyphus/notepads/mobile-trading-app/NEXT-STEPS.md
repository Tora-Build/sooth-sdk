# Next Steps - EAS Build Retry

## What Was Fixed

**Problem**: EAS build failed with "Install dependencies build phase failed"

**Root Cause**: Missing `expo-dev-client` plugin in `app.json`

**Fix Applied**: Added `"expo-dev-client"` to the plugins array

## Retry the Build

Run this command from the mobile app directory:

```bash
cd apps/mobile
npx eas build --profile development --platform ios
```

**Expected outcome**:
- Build should succeed this time
- Build time: ~10-15 minutes
- You'll get a download link for the .ipa file

## After Build Succeeds

### 1. Install the Development Build on iPhone

**Option A: Direct Install (Recommended)**
1. Open the EAS build URL on your iPhone
2. Tap "Install" to install the development build
3. Trust the developer certificate in Settings → General → VPN & Device Management

**Option B: TestFlight**
1. Submit to TestFlight via EAS
2. Install via TestFlight app

### 2. Start Metro Bundler

```bash
cd apps/mobile
npx expo start --dev-client
```

This will:
- Start the Metro bundler
- Show a QR code
- Wait for the development build to connect

### 3. Open App on iPhone

1. Open the "Sooth" app on your iPhone
2. It will automatically connect to Metro bundler
3. You should see the login screen

### 4. Test the App

Follow the testing guide in `HANDOFF.md`:

1. **Login Flow** (Task 3)
   - Tap "Login with Privy"
   - Complete authentication
   - Verify wallet connection

2. **Markets Tab** (Task 4)
   - See list of markets
   - Tap a market to view details
   - Check price display

3. **Trading Tab** (Task 5)
   - Select a market
   - Enter trade amount
   - See quote update
   - Place order (if you have testnet USDC)

4. **Portfolio Tab** (Task 6)
   - View positions
   - Check P&L calculations
   - Test claim functionality

### 5. Report Issues

If you encounter any bugs:
1. Note the exact steps to reproduce
2. Check Metro bundler logs for errors
3. Share error messages

## Troubleshooting

### Build Still Fails
- Check EAS build logs at the URL provided
- Look for specific error messages
- May need to add additional configuration

### App Crashes on Launch
- Check Metro bundler logs
- Verify Privy dashboard configuration
- Ensure .env file is present with EXPO_PUBLIC_PRIVY_APP_ID

### Metro Bundler Connection Issues
- Ensure iPhone and computer are on same WiFi
- Try `npx expo start --dev-client --tunnel` for tunnel mode
- Check firewall settings

### Privy Auth Still Fails
- Verify Privy dashboard has:
  - App identifier: `com.sooth.mobile`
  - URL scheme: `sooth`
  - Client ID configured
- Wait 30 minutes for CDN propagation after dashboard changes

## Current Status

- ✅ Task 2: SDK-core extraction - COMPLETE & VERIFIED
- ✅ Tasks 3-7: Mobile app implementation - CODE COMPLETE
- ⏳ EAS build configuration - FIXED, awaiting retry
- ⏳ Runtime testing - BLOCKED until build succeeds

**Next Action**: Retry EAS build with the fixed configuration
