# Installing EAS Development Build .ipa on iPhone

## Overview

A **development build** is a custom iOS app that includes Expo's developer tools and your app's native dependencies. Unlike Expo Go (which is a sandbox), development builds allow you to test native modules like Privy authentication.

When you run `eas build --profile development --platform ios`, EAS generates a `.ipa` file (iOS Package Archive) that can be installed directly on your iPhone for testing.

**Key Points:**
- Development builds are **not** production apps
- They include developer tools for live reloading and debugging
- They require a paid Apple Developer account (for signing)
- Apps expire after 7 days if using free signing certificates
- You need to trust the developer certificate on your device

---

## Method 1: EAS Direct Install (Recommended - Easiest)

This is the fastest way to install your development build directly from the EAS dashboard.

### Prerequisites
- iPhone with iOS 16+ (for Developer Mode)
- Development Mode enabled on your device
- Build completed on EAS

### Steps

1. **Enable Developer Mode on iPhone**
   - Go to **Settings > Privacy & Security > Developer Mode**
   - Toggle **Developer Mode** ON
   - Restart your iPhone when prompted

2. **Get the Build URL**
   - After `eas build --profile development --platform ios` completes, you'll see a URL
   - Or visit the [EAS Dashboard](https://expo.dev/builds) and find your build

3. **Install via QR Code (Easiest)**
   - On the EAS Dashboard, click the **Install** button on your build
   - A QR code will appear
   - On your iPhone, open **Camera** app and scan the QR code
   - Tap the notification that appears
   - Tap **Install** when prompted
   - Wait for installation to complete

4. **Trust the Developer Certificate**
   - Go to **Settings > General > VPN & Device Management**
   - Find the profile with your Apple ID name
   - Tap it and select **Trust**
   - Confirm by tapping **Trust** again

5. **Launch the App**
   - Go to your home screen
   - Find and tap your app icon
   - The app will launch with developer tools enabled

### Troubleshooting This Method
- **QR code won't scan**: Make sure Developer Mode is enabled
- **"Untrusted Developer" error**: You skipped the trust step - go back to Settings > General > VPN & Device Management
- **App won't install**: Check that your iPhone is connected to the internet

---

## Method 2: TestFlight (For Sharing with Team)

TestFlight is Apple's official testing platform. Use this if you want to share builds with team members or testers.

### Prerequisites
- Apple Developer account
- TestFlight access configured in App Store Connect
- Build completed on EAS

### Steps

1. **Submit Build to TestFlight**
   ```bash
   eas submit --platform ios --profile production
   ```
   (Note: You'll need a production profile configured in `eas.json`)

2. **Configure TestFlight in App Store Connect**
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Select your app
   - Go to **TestFlight > iOS**
   - Add testers (email addresses)

3. **Install on iPhone**
   - Testers receive an email invitation
   - They tap the link and install **TestFlight** app from App Store
   - Open TestFlight and tap your app
   - Tap **Install** or **Update**
   - App installs automatically

4. **Launch the App**
   - Open TestFlight
   - Tap your app to launch it

### Advantages
- No certificate trust step needed
- Works for 90 days
- Easy to share with non-technical testers
- Official Apple method

### Disadvantages
- Requires production build profile
- Takes longer to set up
- Not ideal for rapid development iteration

---

## Method 3: Xcode (For Advanced Users)

Use Xcode if you have the development environment set up and want direct control.

### Prerequisites
- Mac with Xcode installed
- iPhone connected via USB
- `.ipa` file downloaded from EAS

### Steps

1. **Download the .ipa File**
   - Go to EAS Dashboard
   - Find your build
   - Click **Download** to get the `.ipa` file

2. **Open Xcode**
   - Launch Xcode on your Mac
   - Go to **Window > Devices and Simulators**
   - Select your iPhone from the left sidebar

3. **Install the App**
   - In the "Installed Apps" section, click the **+** button
   - Select your downloaded `.ipa` file
   - Click **Open**
   - Wait for installation to complete

4. **Trust the Developer Certificate**
   - On your iPhone: **Settings > General > VPN & Device Management**
   - Tap your developer profile
   - Tap **Trust**

5. **Launch the App**
   - Go to home screen and tap your app

### Advantages
- Full control over installation
- Can see detailed logs
- Works with Xcode debugging tools

### Disadvantages
- Requires Mac and Xcode
- More complex setup
- Not ideal for quick testing

---

## Method 4: Apple Configurator 2 (For Enterprise/Team Distribution)

Use this if you're managing multiple devices or doing team distribution.

### Prerequisites
- Mac with Apple Configurator 2 (free from App Store)
- iPhone connected via USB
- `.ipa` file downloaded from EAS

### Steps

1. **Download the .ipa File**
   - Go to EAS Dashboard and download your build

2. **Open Apple Configurator 2**
   - Launch the app from Applications
   - Connect your iPhone via USB

3. **Add the App**
   - Select your device in the left sidebar
   - Click the **Add** button (or drag the `.ipa` onto the device)
   - Select your `.ipa` file
   - Click **Add**
   - Wait for installation

4. **Trust the Developer Certificate**
   - On iPhone: **Settings > General > VPN & Device Management**
   - Tap your developer profile
   - Tap **Trust**

5. **Launch the App**
   - Go to home screen and tap your app

---

## Troubleshooting Common Issues

### "Untrusted Developer" Error
**Problem:** App won't launch, shows "Untrusted Developer" message

**Solution:**
1. Go to **Settings > General > VPN & Device Management**
2. Find the profile with your Apple ID name
3. Tap it and select **Trust**
4. Confirm by tapping **Trust** again
5. Try launching the app again

### "Cannot Install at This Time"
**Problem:** Installation fails with generic error

**Solution:**
- Make sure Developer Mode is enabled: **Settings > Privacy & Security > Developer Mode**
- Restart your iPhone
- Try installing again
- If still failing, delete the app and retry

### "App Not Compatible with This iPhone"
**Problem:** Build won't install on your device

**Solution:**
- Verify you built for the correct device (arm64 architecture)
- Check that your device is registered in your Apple Developer account
- Run `eas device:create` to register your device if needed

### "Certificate Expired"
**Problem:** App was working but now shows certificate error

**Solution:**
- Development certificates expire after 7 days (free) or 1 year (paid)
- Create a new build: `eas build --profile development --platform ios`
- Install the new build following the steps above

### "Developer Mode Keeps Turning Off"
**Problem:** Developer Mode disables after restart

**Solution:**
- This is normal iOS behavior for security
- Re-enable it: **Settings > Privacy & Security > Developer Mode**
- Toggle it back ON
- Restart your iPhone again

### App Crashes on Launch
**Problem:** App installs but crashes immediately

**Solution:**
- Check that `expo-dev-client` is installed in your project:
  ```bash
  npx expo install expo-dev-client
  ```
- Rebuild: `eas build --profile development --platform ios`
- Reinstall the new build
- Check console logs: `npx expo start` and look for errors

### "Cannot Connect to Development Server"
**Problem:** App launches but can't connect to your local dev server

**Solution:**
- Make sure your Mac and iPhone are on the same WiFi network
- Start the dev server: `npx expo start`
- Scan the QR code shown in terminal with your iPhone camera
- Or manually enter your Mac's IP address in the dev client

---

## Next Steps After Installation

### 1. Start the Development Server
```bash
npx expo start
```

This starts the JavaScript bundler. Your app will automatically reload when you make code changes.

### 2. Connect to Your Dev Server
- **Option A:** Scan the QR code shown in terminal with your iPhone camera
- **Option B:** In the dev client app, tap **Scan QR Code** and scan the terminal QR code
- **Option C:** Manually enter your computer's IP address (shown in terminal)

### 3. Test Your App
- Make changes to your code
- Save the file
- Your app will hot reload on the iPhone
- Test Privy authentication and other native features

### 4. View Logs
```bash
npx expo start
```

Logs from your iPhone will appear in the terminal. Look for errors related to Privy or other native modules.

### 5. Rebuild When Needed
If you:
- Add new native dependencies
- Update native modules
- Change native configuration

You need to rebuild:
```bash
eas build --profile development --platform ios
```

Then reinstall using one of the methods above.

---

## Quick Reference: Installation Methods Comparison

| Method | Setup Time | Ease | Best For | Requirements |
|--------|-----------|------|----------|--------------|
| **EAS Direct** | 2 min | ⭐⭐⭐⭐⭐ | Quick testing | Developer Mode |
| **TestFlight** | 10 min | ⭐⭐⭐⭐ | Team sharing | App Store Connect |
| **Xcode** | 5 min | ⭐⭐⭐ | Debugging | Mac + Xcode |
| **Apple Configurator** | 5 min | ⭐⭐⭐ | Multiple devices | Mac + Configurator |

---

## Important Notes

### Certificate Trust
- iOS requires you to explicitly trust developer certificates
- This is a security feature - only do this for apps you trust
- You can revoke trust anytime in Settings

### App Expiration
- Free signing certificates: 7 days
- Paid Apple Developer account: 1 year
- After expiration, you need to rebuild and reinstall

### Developer Mode
- Only available on iOS 16+
- Must be enabled for development builds
- Disables automatically after restart (security feature)
- Re-enable it when needed

### Privy Integration
- Privy requires native modules (can't use Expo Go)
- Development builds include these modules
- Make sure `expo-dev-client` is installed
- Test authentication flows thoroughly before production

---

## Resources

- [Expo Development Builds Documentation](https://docs.expo.dev/develop/development-builds/)
- [EAS Build Documentation](https://docs.expo.dev/build-reference/overview/)
- [iOS Device Setup Guide](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/)
- [Expo Orbit (Alternative Installation Tool)](https://docs.expo.dev/build/orbit/)
- [Apple Developer Account Setup](https://developer.apple.com/account/)

---

## Summary

**For fastest testing:** Use **Method 1 (EAS Direct Install)** - it's the easiest and requires no additional tools.

**For team testing:** Use **Method 2 (TestFlight)** - it's official and works for 90 days.

**For debugging:** Use **Method 3 (Xcode)** - you get full developer tools and logs.

**For multiple devices:** Use **Method 4 (Apple Configurator)** - it's designed for managing many devices.

All methods require trusting the developer certificate on your iPhone. This is a one-time security step.
