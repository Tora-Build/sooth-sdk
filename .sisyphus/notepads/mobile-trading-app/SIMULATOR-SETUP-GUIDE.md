# Simulator Setup Guide

**Created**: February 1, 2026
**Purpose**: Help user resolve the simulator blocker

---

## Quick Setup Options

### Option 1: iOS Simulator (5 minutes)
1. Open Xcode (already installed: version 26.2)
2. Window → Devices and Simulators (Cmd+Shift+2)
3. Click "+" button
4. Select: iPhone 15 Pro, iOS (latest)
5. Click "Create"

**Test it**:
```bash
cd apps/mobile
npx expo start --ios
```

### Option 2: Android Emulator (if previously working)
```bash
cd apps/mobile
npx expo start --android
```

### Option 3: Physical iPhone (Easiest!)
1. Install "Expo Go" from App Store
2. Run: `cd apps/mobile && npx expo start`
3. Scan QR code with iPhone camera
4. App opens in Expo Go

---

## After Simulator is Ready

Once you have a working simulator/device:

1. **Run the app**:
   ```bash
   cd apps/mobile
   npx expo start --ios  # or --android
   ```

2. **Follow testing guide**: `.sisyphus/notepads/mobile-trading-app/HANDOFF.md`

3. **Report any bugs** you find

4. **Agent will**:
   - Fix bugs
   - Mark remaining 24 checkboxes
   - Complete work plan

---

## Known Issues to Expect

### Privy Dashboard Error
**Error**: "Native app ID com.sooth.mobile has not been set"

**Fix**: Contact support@privy.io with this error message

**Impact**: Login will fail until fixed

### First Run
- App may take 30-60 seconds to build first time
- Metro bundler will start automatically
- Simulator will launch automatically

---

## Troubleshooting

**Simulator won't start**:
- Check Xcode is fully installed
- Try: `sudo xcode-select --reset`

**Expo won't connect**:
- Check firewall settings
- Try: `npx expo start --tunnel`

**Build errors**:
- Try: `cd apps/mobile && rm -rf node_modules && pnpm install`

---

**Once simulator is working, tell the agent to continue and it will help you test everything!**
