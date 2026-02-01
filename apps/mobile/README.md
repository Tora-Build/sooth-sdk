# Sooth Mobile Trading App

A mobile prediction market trading app built with Expo and React Native. Trade on prediction markets, manage your portfolio, and redeem positions—all from your iPhone.

**Status**: Alpha (iOS only, Base Sepolia testnet)  
**Build Type**: EAS Development Build (required for WalletConnect native modules)

---

## 1. Quick Start

Get the app running in 4 steps:

```bash
# 1. Install dependencies
cd apps/mobile
npm install && npm install -g eas-cli

# 2. Login to Expo
eas login

# 3. Build for iOS (10-20 min, one-time)
eas build --profile development --platform ios

# 4. Start development server
npx expo start --dev-client
```

Then open the development client on your iPhone and scan the QR code.

---

## 2. Prerequisites

### Required
- **Node.js** 18+ ([nodejs.org](https://nodejs.org/))
- **Expo Account** (free: [expo.dev/signup](https://expo.dev/signup))
- **Apple Developer Account** ($99/year: [developer.apple.com](https://developer.apple.com/))
- **iPhone** (iOS 13+) for testing
- **Wallet App** (MetaMask, Rainbow, Trust, or Safe)

### Why These Are Required
- **Node.js**: Build tooling and package management
- **Expo Account**: Manages builds and provisioning
- **Apple Developer**: Required to sign iOS apps and distribute via TestFlight
- **iPhone**: WalletConnect requires a physical device (simulator won't work)
- **Wallet App**: To sign transactions and interact with blockchain

### Why NOT Expo Go?
This app uses **WalletConnect with NitroModules** (native code). Expo Go cannot run apps with native modules. You **must** create a development build.

---

## 3. Installation

### Step 1: Clone & Install

```bash
cd apps/mobile
npm install
```

### Step 2: Install EAS CLI

```bash
npm install -g eas-cli
```

Verify installation:
```bash
eas --version
```

### Step 3: Login to Expo

```bash
eas login
```

You'll be prompted for your Expo credentials. Create a free account at [expo.dev/signup](https://expo.dev/signup) if you don't have one.

### Step 4: Link Apple Developer Account

```bash
eas credentials
```

Follow the prompts to:
1. Select iOS
2. Link your Apple Developer account
3. Create provisioning profiles

---

## 4. Development Build

### What Is a Development Build?

A development build is a custom iOS app that includes:
- All native modules (WalletConnect, secure storage, etc.)
- Metro bundler for hot reload
- Development tools and debugging

Unlike Expo Go, it's built specifically for your app and can run native code.

### Build for iOS

```bash
eas build --profile development --platform ios
```

**What happens:**
1. EAS compiles your app with native modules
2. Uploads to Apple servers for signing
3. Provides a download link (takes 10-20 minutes)

**Output options:**
- **TestFlight Link**: Install via Apple's TestFlight app (easiest)
- **Direct Download**: Download `.ipa` and install via Xcode

### Install on iPhone

#### Option A: TestFlight (Recommended)

1. EAS will provide a TestFlight link
2. Open link on your iPhone
3. Tap "Open in TestFlight"
4. Tap "Install"
5. App appears on home screen

**Pros**: Easy, no computer needed, automatic updates  
**Cons**: Limited to 100 testers per app

#### Option B: Direct Install (Xcode)

1. Download `.ipa` from EAS dashboard
2. Open Xcode
3. Window → Devices and Simulators
4. Select your iPhone
5. Drag `.ipa` onto the device

**Pros**: No TestFlight limit  
**Cons**: Requires Xcode, more steps

#### Option C: Apple Configurator

1. Download `.ipa` from EAS dashboard
2. Open Apple Configurator 2
3. Select your iPhone
4. Drag `.ipa` onto the device

---

## 5. Development Server

### Start the Metro Bundler

```bash
npx expo start --dev-client
```

You'll see:
```
› Metro waiting on exp://192.168.1.100:8081
› Scan the QR code above with Expo Go or your development client
```

### Open on iPhone

1. Open the development client app on your iPhone
2. Scan the QR code from the terminal
3. App loads with full functionality

### Hot Reload

After the initial build, code changes reload instantly:

```bash
# Edit a file
# Save
# App reloads automatically on iPhone
```

**What reloads instantly:**
- JavaScript/TypeScript code
- Styles
- Component logic

**What requires rebuild:**
- Native module changes (rare)
- Dependencies added/removed
- `app.json` changes

---

## 6. Environment Variables

### Create `.env` File

```bash
# apps/mobile/.env
EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id-here
```

### Get Your WalletConnect Project ID

1. Go to [cloud.walletconnect.com](https://cloud.walletconnect.com/)
2. Sign up or login
3. Create a new project
4. Copy the **Project ID**
5. Paste into `.env`

### Verify Configuration

The app will fail to connect wallets without a valid project ID. You'll see:
```
WalletConnect Error: Invalid project ID
```

---

## 7. Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Expo + React Native |
| **Navigation** | Expo Router (file-based) |
| **Auth** | WalletConnect/AppKit |
| **Blockchain** | viem + wagmi |
| **State** | React Query (server), React Context (client) |
| **Styling** | React Native StyleSheet |
| **Storage** | expo-secure-store (encrypted) |

### Key Libraries

- **expo-router**: File-based routing (like Next.js)
- **@walletconnect/react-native-compat**: Wallet connection
- **viem**: Ethereum client library
- **react-query**: Server state management
- **expo-secure-store**: Encrypted local storage

### Data Flow

```
User → WalletConnect → MetaMask
         ↓
      viem (contract calls)
         ↓
    Base Sepolia RPC
         ↓
    Smart Contracts
         ↓
    React Query (cache)
         ↓
    UI Components
```

---

## 8. Project Structure

```
apps/mobile/
├── app/                           # Expo Router pages (file-based routing)
│   ├── _layout.tsx               # Root layout with providers
│   ├── login.tsx                 # Login/wallet connection screen
│   └── (tabs)/                   # Tab navigation (bottom tabs)
│       ├── _layout.tsx           # Tab layout
│       ├── index.tsx             # Markets (discovery & swipe)
│       ├── trade.tsx             # Trading flow (buy/sell)
│       └── portfolio.tsx         # Portfolio & redeem positions
│
├── src/
│   ├── components/               # Reusable UI components
│   │   ├── MarketCard.tsx       # Market display card
│   │   ├── TradeForm.tsx        # Buy/sell form
│   │   ├── PortfolioItem.tsx    # Position display
│   │   └── ...
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useMarkets.ts        # Fetch markets
│   │   ├── useWallet.ts         # Wallet connection
│   │   ├── useTrade.ts          # Trading logic
│   │   └── ...
│   │
│   └── lib/                      # Utilities & config
│       ├── config.ts            # App configuration
│       ├── contracts.ts         # Contract ABIs & addresses
│       ├── rpc.ts               # RPC client setup
│       └── ...
│
├── assets/                       # Images, icons, fonts
│   ├── icon.png                 # App icon
│   └── splash-icon.png          # Splash screen
│
├── eas.json                      # EAS build configuration
├── app.json                      # Expo configuration
├── package.json                  # Dependencies
└── tsconfig.json                 # TypeScript config
```

### Key Files

| File | Purpose |
|------|---------|
| `app/_layout.tsx` | Root layout, providers (WalletConnect, React Query) |
| `app/login.tsx` | Wallet connection screen |
| `app/(tabs)/index.tsx` | Market discovery (swipeable cards) |
| `app/(tabs)/trade.tsx` | Trading interface (buy/sell) |
| `app/(tabs)/portfolio.tsx` | User positions & redeem |
| `src/lib/contracts.ts` | Contract ABIs & addresses |
| `eas.json` | Build profiles (development, preview, production) |

---

## 9. Features

### Implemented ✅

- **Wallet Connection**: WalletConnect with MetaMask, Rainbow, Trust, Safe
- **Market Discovery**: Swipeable market cards with real-time data
- **AMM Trading**: Buy/sell YES/NO outcomes via LMSR
- **Market Orders**: Place orders on TickBook orderbook
- **Portfolio**: View positions, track P&L
- **Redeem**: Claim winnings after market resolution
- **Base Sepolia**: Testnet support with faucet integration

### Coming Soon 🚀

- Android support
- Mainnet deployment
- Advanced charting
- Order history
- Notifications

---

## 10. Testing

### Prerequisites

1. **iPhone with development build installed** (see Installation section)
2. **Wallet app** (MetaMask, Rainbow, Trust, or Safe)
3. **Base Sepolia testnet USDC** (get from [faucet.circle.com](https://faucet.circle.com/))

### Test Checklist

#### 1. Wallet Connection
- [ ] Launch app
- [ ] Tap "Connect Wallet"
- [ ] Select wallet (MetaMask, Rainbow, etc.)
- [ ] Approve connection
- [ ] See wallet address in app

#### 2. Market Discovery
- [ ] See list of markets
- [ ] Swipe up/down to browse
- [ ] Tap market to view details
- [ ] See current odds and volume

#### 3. Trading (AMM)
- [ ] Tap "Trade" on a market
- [ ] Enter amount (e.g., 10 USDC)
- [ ] Select YES or NO
- [ ] Tap "Buy"
- [ ] Approve transaction in wallet
- [ ] See position in portfolio

#### 4. Market Orders (TickBook)
- [ ] Tap "Place Order" on a market
- [ ] Enter price and amount
- [ ] Select YES or NO
- [ ] Tap "Place Order"
- [ ] See order in order book

#### 5. Portfolio
- [ ] Tap "Portfolio" tab
- [ ] See all positions
- [ ] See P&L for each position
- [ ] Verify balances match wallet

#### 6. Redeem (After Market Resolution)
- [ ] Wait for market to resolve
- [ ] Tap "Redeem" on winning position
- [ ] Approve transaction
- [ ] See USDC returned to wallet

### Common Test Scenarios

**Scenario 1: Buy and Hold**
1. Buy 10 USDC of YES on a market
2. Wait for market to resolve YES
3. Redeem position
4. Verify USDC returned

**Scenario 2: Sell Short**
1. Buy 10 USDC of NO on a market
2. Market resolves NO
3. Redeem position
4. Verify profit

**Scenario 3: Place Limit Order**
1. Place order at 0.60 for YES
2. Wait for market to cross
3. See order filled
4. Verify position in portfolio

---

## 11. Troubleshooting

### "NitroModules are not supported in Expo Go!"

**Problem**: You tried to use Expo Go, but the app requires native modules.

**Solution**:
```bash
# Use development build instead
eas build --profile development --platform ios
```

**Why**: WalletConnect uses native code that Expo Go can't run.

---

### Build Fails with "Invalid Apple Developer Account"

**Problem**: EAS can't access your Apple Developer account.

**Solution**:
```bash
# Re-authenticate
eas credentials
# Select iOS
# Re-enter Apple credentials
```

**Verify**:
- Apple ID is correct
- Two-factor authentication is enabled
- Account has active developer membership ($99/year)

---

### App Won't Install on iPhone

**Problem**: TestFlight link doesn't work or `.ipa` won't install.

**Causes & Solutions**:

1. **Device not registered**
   ```bash
   eas device
   # Follow prompts to register device UDID
   ```

2. **Provisioning profile expired**
   ```bash
   eas credentials
   # Regenerate provisioning profile
   ```

3. **TestFlight limit reached** (100 testers max)
   - Use direct `.ipa` install instead
   - Or remove old testers from TestFlight

4. **Wrong iOS version**
   - App requires iOS 13+
   - Check iPhone Settings → General → About

---

### WalletConnect Errors

**Problem**: "Invalid project ID" or wallet won't connect.

**Solution**:
1. Verify `.env` file exists:
   ```bash
   cat .env
   # Should show: EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID=...
   ```

2. Get a new project ID:
   - Go to [cloud.walletconnect.com](https://cloud.walletconnect.com/)
   - Create new project
   - Copy Project ID
   - Update `.env`

3. Rebuild app:
   ```bash
   eas build --profile development --platform ios
   ```

---

### App Crashes on Launch

**Problem**: App crashes immediately after opening.

**Solution**:
1. Check Metro bundler is running:
   ```bash
   npx expo start --dev-client
   ```

2. Check for errors in terminal:
   ```
   ERROR: [error message]
   ```

3. Clear cache and rebuild:
   ```bash
   rm -rf node_modules .expo
   npm install
   eas build --profile development --platform ios
   ```

---

### Hot Reload Not Working

**Problem**: Code changes don't reload on iPhone.

**Solution**:
1. Verify Metro is running:
   ```bash
   npx expo start --dev-client
   ```

2. Check iPhone is on same WiFi as computer

3. Manually reload:
   - Shake iPhone
   - Tap "Reload"

4. For native changes, rebuild:
   ```bash
   eas build --profile development --platform ios
   ```

---

### Slow Performance

**Problem**: App is laggy or slow.

**Causes & Solutions**:

1. **Too many markets loaded**
   - Pagination is implemented
   - Scroll to load more

2. **Network latency**
   - Check internet connection
   - Try different RPC endpoint

3. **Old development build**
   - Rebuild with latest code:
     ```bash
     eas build --profile development --platform ios
     ```

---

### Contract Interaction Fails

**Problem**: "Transaction failed" or "Contract error".

**Causes & Solutions**:

1. **Insufficient USDC balance**
   - Get testnet USDC: [faucet.circle.com](https://faucet.circle.com/)
   - Verify balance in wallet

2. **Wrong network**
   - Verify wallet is on Base Sepolia
   - Check app config: `src/lib/config.ts`

3. **Contract address mismatch**
   - Verify addresses in `src/lib/contracts.ts`
   - Check against [STATUS.md](../../STATUS.md)

4. **RPC rate limit**
   - Wait a few seconds
   - Try again

---

## 12. Cost Breakdown

### Expo (EAS Builds)

| Tier | Price | Builds/Month | Use Case |
|------|-------|--------------|----------|
| **Free** | $0 | 30 | Development |
| **Pro** | $29/month | Unlimited | Production |

**For this project**: Free tier is sufficient (30 builds/month is plenty for development).

### Apple Developer

| Item | Cost | Required |
|------|------|----------|
| **Developer Account** | $99/year | ✅ Yes |
| **TestFlight** | Free | ✅ Yes (included) |
| **App Store Distribution** | Free | ❌ No (not needed yet) |

**For this project**: $99/year for Apple Developer account.

### Total Cost

| Scenario | Cost |
|----------|------|
| **Development Only** | $99/year (Apple) |
| **Production (App Store)** | $99/year (Apple) + $29/month (Expo Pro) |

### Cost Optimization

- Use **free Expo tier** during development (30 builds/month)
- Upgrade to **Pro** only when deploying to App Store
- Apple Developer account is one-time $99/year

---

## Documentation Links

### Official Docs
- [Expo Documentation](https://docs.expo.dev/) — Framework & tools
- [EAS Build](https://docs.expo.dev/build/introduction/) — Build service
- [Expo Router](https://docs.expo.dev/routing/introduction/) — File-based routing
- [React Native](https://reactnative.dev/) — Core framework

### Blockchain
- [WalletConnect](https://docs.walletconnect.com/) — Wallet connection
- [viem](https://viem.sh/) — Ethereum client
- [wagmi](https://wagmi.sh/) — React hooks for Ethereum

### Testnet
- [Base Sepolia](https://docs.base.org/network-information/) — Testnet info
- [Circle Faucet](https://faucet.circle.com/) — Get testnet USDC
- [Sepolia Faucet](https://sepoliafaucet.com/) — Get testnet ETH

### Community
- [Expo Discord](https://chat.expo.dev/) — Expo community
- [WalletConnect Discord](https://discord.walletconnect.com/) — WalletConnect support
- [React Native Community](https://reactnative.dev/help) — General help

---

## Support

### Getting Help

1. **Check Troubleshooting** (section 11 above)
2. **Search existing issues**: [GitHub Issues](https://github.com/sooth-protocol/sooth-alpha/issues)
3. **Ask in Discord**: [Expo Discord](https://chat.expo.dev/)
4. **File a bug**: [GitHub Issues](https://github.com/sooth-protocol/sooth-alpha/issues/new)

### Reporting Bugs

Include:
- Error message (full stack trace)
- Steps to reproduce
- Device & iOS version
- Metro bundler output
- `.env` file (without sensitive data)

---

## License

MIT
