# Mobile Trading App - Handoff Document

**Date**: February 1, 2026
**Status**: Implementation Complete, Testing Blocked
**Next Owner**: User (Daniel)

---

## What's Been Done

### ✅ Task 2: SDK-core Extraction (COMPLETE)
All contract ABIs, LMSR math, deployment config, and contract functions extracted from web app to `@sooth/sdk-core`. All ESM imports fixed. Verified working.

**Verification**:
```bash
cd packages/sdk-core && pnpm build  # ✅ SUCCESS
cd apps/web && pnpm build           # ✅ SUCCESS (6.76s)
```

### 🔨 Tasks 3-7: Mobile App (IMPLEMENTED, UNTESTED)
~3000 lines of React Native code written:
- Expo project with Privy auth
- Market discovery (Stories-style UI)
- Trading flow (AMM + TickBook)
- Portfolio with redemption
- UI polish (skeletons, errors, loading)

**All TypeScript compiles without errors.**

---

## What's Blocking

### 🚨 Blocker 1: Privy Dashboard Configuration

**Error**: "Native app ID com.sooth.mobile has not been set as an allowed app identifier"

**What I tried**:
- Verified your Client settings (✅ correct: `com.sooth.mobile`, `sooth`)
- Added `clientId` to PrivyProvider
- Checked dashboard UI (doesn't match docs - no "Mobile" section in Basics tab)

**What you need to do**:
1. Contact Privy support: support@privy.io
2. Share this error: "Native app ID com.sooth.mobile has not been set as an allowed app identifier in the Privy dashboard"
3. Ask them to verify app-level mobile settings (not just Client settings)
4. OR wait 30 minutes for CDN propagation (unlikely to help, but worth trying)

### 🚨 Blocker 2: No iOS Simulator

**Issue**: You requested switching from Android to iOS, but no iOS simulators are configured.

**What you need to do**:
**Option A** (iOS):
```bash
# Open Xcode
open -a Xcode

# Create a simulator:
# Xcode → Window → Devices and Simulators → Simulators → + button
# Choose iPhone 15 Pro or similar
```

**Option B** (Android - was working earlier):
```bash
cd apps/mobile
npx expo start

# Press 'a' to open Android emulator
```

---

## How to Test (Once Unblocked)

### Step 1: Start the App
```bash
cd apps/mobile

# For iOS:
npx expo start --ios

# For Android:
npx expo start --android
```

### Step 2: Test Login (Task 3)
1. App should show login screen
2. Tap "Continue with Email"
3. Enter email → receive code → enter code
4. Should navigate to Markets tab

**Expected**: Login succeeds, shows Markets tab
**If fails**: Share error message with me

### Step 3: Test Market Discovery (Task 4)
1. Should see full-screen market cards
2. Swipe up/down to navigate between markets
3. Each card shows: question, YES/NO price, stage badge
4. Pull down to refresh

**Expected**: Smooth swipe navigation, data loads
**If fails**: Share screenshot + error

### Step 4: Test Trading (Task 5)
1. Navigate to Trade tab
2. Select a bonding-stage market
3. Choose YES or NO
4. Enter shares (e.g., 10)
5. Tap "Buy"
6. Approve USDC (first time only)
7. Confirm trade

**Expected**: Transaction succeeds, balance updates
**If fails**: Share error message

### Step 5: Test Portfolio (Task 6)
1. Navigate to Portfolio tab
2. Should see your positions
3. For finalized markets: "Redeem" button shows
4. For active markets: No redeem button
5. Tap "Redeem" on finalized position

**Expected**: Redemption succeeds, USDC balance increases
**If fails**: Share error message

### Step 6: Test UI Polish (Task 7)
1. Check loading states (skeleton animations)
2. Check error messages (user-friendly)
3. Check empty states (when no data)

**Expected**: Polished UX throughout
**If fails**: Share specific UX issue

---

## Files to Know

### Configuration
- `apps/mobile/.env` - Privy app ID (already set)
- `apps/mobile/app.json` - Bundle ID and scheme (already set)
- `apps/mobile/app/_layout.tsx` - Privy provider config

### Screens
- `apps/mobile/app/login.tsx` - Login screen
- `apps/mobile/app/(tabs)/index.tsx` - Markets tab
- `apps/mobile/app/(tabs)/trade.tsx` - Trading tab
- `apps/mobile/app/(tabs)/portfolio.tsx` - Portfolio tab

### Components
- `apps/mobile/src/components/MarketCard.tsx` - Market display
- `apps/mobile/src/components/TradePanel.tsx` - Trading interface
- `apps/mobile/src/components/PositionCard.tsx` - Portfolio positions
- `apps/mobile/src/components/Skeleton.tsx` - Loading states

### Hooks
- `apps/mobile/src/hooks/useMarkets.ts` - Fetch markets
- `apps/mobile/src/hooks/usePositions.ts` - Fetch positions
- `apps/mobile/src/hooks/useAMMQuote.ts` - Get trade quotes
- `apps/mobile/src/hooks/useUSDCBalance.ts` - Track USDC

---

## Common Issues & Solutions

### Issue: "Metro bundler won't start"
```bash
cd apps/mobile
rm -rf node_modules .expo
pnpm install
npx expo start --clear
```

### Issue: "TypeScript errors"
```bash
cd apps/mobile
npx tsc --noEmit
# Should show no errors
```

### Issue: "Can't connect to Base Sepolia"
- Check internet connection
- RPC might be rate-limiting (app uses batching to avoid this)
- Try again in a few minutes

### Issue: "Transaction fails"
- Check USDC balance (need testnet USDC)
- Check gas (need ETH on Base Sepolia)
- Check slippage (price may have moved)

---

## Getting Testnet Funds

### Base Sepolia ETH (for gas)
1. Go to: https://www.alchemy.com/faucets/base-sepolia
2. Enter your wallet address
3. Request ETH

### Base Sepolia USDC (for trading)
The app has a "Get testnet USDC" button that calls `MockUSDC.mint()` - it's permissionless on testnet.

---

## When to Contact Me

**Contact me if**:
- Login works but app crashes
- Markets load but display incorrectly
- Trading fails with unclear error
- Portfolio doesn't show positions
- Any TypeScript errors appear
- Any runtime errors occur

**Don't contact me for**:
- Privy dashboard config (contact Privy support)
- Simulator setup (follow iOS/Android docs)
- Testnet fund requests (use faucets above)

---

## Success Criteria

**The app is working when**:
✅ Login succeeds
✅ Markets display and swipe works
✅ Can execute a trade
✅ Portfolio shows positions
✅ Can redeem finalized positions

**Then I can**:
- Mark Tasks 3-7 as complete in plan
- Close out the work plan
- Celebrate! 🎉

---

## Documentation

All work documented in `.sisyphus/notepads/mobile-trading-app/`:
- `FINAL-STATUS.md` - Comprehensive status report
- `learnings.md` - Technical solutions and patterns
- `issues.md` - Problems encountered
- `problems.md` - Current blockers
- `HANDOFF.md` - This document

---

**Ready to test once you resolve the blockers!**

**Questions?** Just ask - I'm here to help debug any issues you find.
