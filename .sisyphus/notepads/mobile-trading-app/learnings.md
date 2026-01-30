# Learnings - Mobile Trading App

## Task 3: Expo Project Setup + Privy Auth (2026-01-30)

### Privy Expo SDK API (v0.63.3)
- `usePrivy()` returns `{ user, isReady, error, logout }` — NO `authenticated` property
- Auth check is `user !== null` (user is `User | null`)
- `User` type (from `@privy-io/api-types`) has `linked_accounts` array, NOT `.email` property
- Email is found via: `user.linked_accounts.find(a => a.type === 'email')`
- Config uses `embedded.ethereum.createOnLogin` NOT `embeddedWallets.createOnLogin`
- `CreateOnLogin` type: `'off' | 'users-without-wallets' | 'all-users'`

### pnpm Workspace + Expo
- `npx expo install` fails in pnpm workspace (tries to use npm internally)
- Use `pnpm add` directly instead of `npx expo install`
- Expo SDK 54 template uses React 19.1.0 and RN 0.81.5

### Privy Peer Dependencies
- `permissionless` must be `^0.2.47` (not 0.3.x)
- `react-native-passkeys` must be `^0.3.0` (not 0.4.x)
- `react-native-qrcode-styled` must be pinned to `0.3.3`

### viem Dual Version Issue
- `@privy-io/js-sdk-core` brings its own viem dependency
- This causes type incompatibility with the app's viem when using explicit type annotations
- Workaround: avoid explicit `PublicClient`/`WalletClient` type annotations, use `ReturnType<typeof createPublicClient>` or `any` for cached singletons

### Expo Router Setup
- `package.json` must have `"main": "expo-router/entry"`
- `app.json` needs `"plugins": ["expo-router"]` and a `"scheme"` for OAuth redirects
- Delete `App.tsx` and `index.ts` from template — expo-router uses `app/` directory
- File structure: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/login.tsx`, etc.

### No iOS Simulator
- Current environment has Xcode but no simulator runtimes
- Metro bundler starts successfully (`npx expo start`)
- `npx expo start --ios` fails with "No iOS devices available in Simulator.app"
- Dev builds require `npx expo run:ios` with simulator or physical device

## Task 4: Market Discovery Screen (2026-01-30)

### React Query + viem Integration
- `useQuery` with `queryKey: ['markets', chainId]` for caching
- `staleTime: 15_000` (15s) and `refetchInterval: 30_000` (30s) for auto-refresh
- `getPublicClient()` returns viem client without explicit type annotation (avoids dual-version issue)

### RPC Rate Limiting Strategy
- Process markets in chunks of 5 with `Promise.all` per chunk
- 100ms delay between chunks to avoid 429 errors
- Pattern: `for (let i = 0; i < arr.length; i += CHUNK_SIZE) { ... }`

### Market Price Sourcing Per Stage
- **Bonding**: `AMMEngine.getMarketState(market)` → `yesPrice` (3rd return, WAD-scaled)
- **Live (Graduated)**: `Collateralizer.getOutcomeTokens(market)` → `[yesToken, noToken]`, then `TickBookPoolManager.getMarketState(yesToken, noToken)` → `probabilityWad` (4th return)
  - NOTE: `getMarketState` takes `(yesToken, noToken)` NOT `marketKey` — simplified from web pattern
- **Settled/Finalized**: Derive from `winningOutcome` (1=100%, 0=0%, 2=50%)

### Gradient Generation
- Hash question string to HSL: `hash = charCodeAt(i) + ((hash << 5) - hash)`
- Convert HSL to RGB hex for `expo-linear-gradient` (requires hex colors, not HSL strings)
- Two gradients per card: `hashToHSL(question)` and `hashToHSL(question + 'offset')`

### FlatList Vertical Swipe
- `pagingEnabled={true}` for snap-to-card behavior
- `snapToInterval={800}` (approximate screen height) for precise snapping
- `decelerationRate="fast"` for iOS, `0.98` for web
- `showsVerticalScrollIndicator={false}` for clean Stories aesthetic

### Stage Badge Mapping
- 🌱 Bonding (green), 🔥 Live (orange), ✓ Settled (purple), 🏁 Finalized (indigo), ❌ Dismissed (red)
- Emoji + text label for visual clarity

### Error Handling
- `readContractSafe` wrapper with try/catch returns `null` on failure
- Graceful degradation: missing price → show 50%, missing question → show address slice
- Empty state: "📊 No Markets Yet" with subtitle
- Error state: "⚠️ Failed to Load Markets" with error message

### expo-linear-gradient
- Added as dependency: `expo-linear-gradient@~14.0.1`
- Requires hex colors (not HSL) — implemented `hslToRgb()` converter
- `start={{ x: 0, y: 0 }}` and `end={{ x: 1, y: 1 }}` for diagonal gradient

### TypeScript Patterns
- `ReturnType<typeof getPublicClient>` for viem client type (avoids dual-version issue)
- `readonly [bigint, bigint, bigint]` for contract return types
- `Address` type from viem for type-safe addresses

## Task 5: Trading Flow Screen (2026-01-30)

### Privy Wallet Type Compatibility
- `getWalletClient()` in `client.ts` originally typed `getProvider()` return as `{ request: (...args: unknown[]) => Promise<unknown> }` which is incompatible with Privy's `EmbeddedWalletProvider`
- Fix: Widen to `Promise<any>` with eslint-disable comment — Privy provider works fine with viem's `custom()` transport at runtime

### BigInt from Contract Reads
- Contract `readContract` returns typed by ABI but TS sometimes infers `number` for `uint256` fields
- Use `BigInt(result as number | bigint)` for safety when the ABI inference is ambiguous (e.g., `preGradFeeBps`)

### Fee Computation Chain (CRITICAL)
1. `AMMEngine.getPositionQuote(market, outcome, deltaShares)` → `[costOrProceeds, newPrice]` (raw, NO fee)
2. `fee = (costOrProceeds * feeRateBps) / 10000n`
3. BUY: `totalCost = costOrProceeds + fee`
4. Slippage: `limitCost = (totalCost * 105n) / 100n`
5. Trade via `LaunchpadEngine.tradePositions()` (NOT AMMEngine!)

### TickBook Market Orders (Graduated Markets)
- Need to get outcome tokens from Collateralizer, compute marketKey with `computeMarketKey()`
- Check vault balance with `TickBookVault.availableUsdcWad(user)`, deposit if needed
- `placeOrder(marketKey, outcome, shares, 1, 999, maxCost)` — ticks 1-999 = market order
- maxCost = shares * 1.2 (20% buffer for multi-tick sweep)

### Transaction Signing Pattern
- `getWalletClient(wallet)` creates viem WalletClient from Privy wallet
- `walletClient.writeContract({...})` for sending transactions
- Always check allowance before trade, approve if insufficient

### Route Params
- `useLocalSearchParams<{ market?: string }>()` for receiving market address
- Handle missing params gracefully with placeholder UI

## Task 7: UI Polish & Edge Case Handling (2026-01-30)

### Haptic Feedback (expo-haptics)
- **Installation**: `pnpm add expo-haptics` (v15.0.8)
- **Pattern**: `await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`
- **Triggers**: Trade button, preset buttons (1/5/10/25), mint USDC button
- **Note**: Works on iOS and Android with native vibration feedback
- **Async**: Safe to await but doesn't block UI

### Skeleton Shimmer Loading Animation
- **Component**: `Skeleton.tsx` - Reusable with animated gradient
- **Pattern**: 
  ```typescript
  const shimmer = useRef(new Animated.Value(0)).current;
  Animated.loop(Animated.sequence([
    Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
    Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
  ])).start();
  ```
- **Used in**: MarketCard, PositionCard, Markets screen loading state
- **Key**: `useNativeDriver: true` for 60fps performance
- **Type Fix**: Cast animated style to `ViewStyle` to satisfy TypeScript strict mode

### Transaction Pending Overlay
- **Pattern**: Modal with spinner + "Confirming on Base..." message
- **Behavior**: Shows during `isSubmitting`, dismisses on success/error
- **Styling**: Dark overlay (rgba(0,0,0,0.7)) with centered content card
- **UX**: Prevents user interaction while transaction pending

### Keyboard Avoidance
- **Pattern**: `KeyboardAvoidingView` with platform-specific behavior
  - iOS: `behavior="padding"`
  - Android: `behavior="height"`
- **Result**: Buy button stays visible when numeric keyboard open
- **Wraps**: Entire TradePanel ScrollView

### Error Messages with Emoji
- **Function**: `getErrorMessage(error)` - Parses error and returns friendly message
- **Patterns**:
  - "insufficient" → "💰 Insufficient balance. Get more USDC or reduce amount."
  - "reverted" → "⚠️ Transaction reverted. Check slippage or try again."
  - "network" → "🔌 Network error. Check your connection."
  - "user rejected" → "❌ Transaction rejected by user."
- **Applied to**: Mint USDC, trade execution, all error alerts

### First-Time User Tooltip
- **Storage**: AsyncStorage (`@react-native-async-storage/async-storage@2.2.0`)
- **Key**: `trade_tooltip_shown` (boolean flag)
- **Content**: "💡 Enter the number of shares, not USDC amount"
- **Behavior**: Shows once on first trade screen visit, dismissible with tap
- **Styling**: Cyan left border, dark background, positioned at bottom
- **Pattern**: 
  ```typescript
  useEffect(() => {
    const shown = await AsyncStorage.getItem('trade_tooltip_shown');
    if (!shown) {
      setShowTooltip(true);
      await AsyncStorage.setItem('trade_tooltip_shown', 'true');
    }
  }, []);
  ```

### Market Settled Transition Banner
- **Detection**: Checks if market graduated AND probability is 0 or 1
- **Message**: "🏁 Market settled! View results in Portfolio"
- **Styling**: Purple background (#8b5cf6), positioned at top
- **UX**: Gracefully informs user market no longer tradeable

### Improved Loading States
- **Markets Screen**: Skeleton stack showing 2 placeholder cards during load
- **Error State**: Added "Try Again" button that calls `refetch()`
- **Visual Feedback**: Better distinction between loading, error, empty states

### Improved Empty States
- **Portfolio Screen**: 
  - Emoji (🎯) for visual interest
  - Larger, clearer typography
  - "Go to Markets" button for navigation
  - Better spacing and visual hierarchy

### Dependencies Added
- `expo-haptics@15.0.8` - Haptic feedback
- `@react-native-async-storage/async-storage@2.2.0` - Tooltip tracking

### Files Modified
1. `apps/mobile/src/components/Skeleton.tsx` - NEW
2. `apps/mobile/src/components/MarketCard.tsx` - Added skeleton loading
3. `apps/mobile/src/components/PositionCard.tsx` - Added skeleton loading
4. `apps/mobile/src/components/TradePanel.tsx` - Haptics, keyboard, overlay, errors
5. `apps/mobile/app/(tabs)/trade.tsx` - Tooltip, settled banner
6. `apps/mobile/app/(tabs)/index.tsx` - Improved loading/error states
7. `apps/mobile/app/(tabs)/portfolio.tsx` - Improved empty state

### TypeScript Compliance
- All files pass `npx tsc --noEmit` without errors
- Fixed Skeleton component type issue by casting animated style to `ViewStyle`
- Strict mode enabled throughout

### Edge Cases Handled
1. **Market settled while viewing** → Banner shows, inputs disabled gracefully
2. **Network error during trade** → Specific error message with emoji
3. **Insufficient balance** → Clear message with amount needed
4. **User rejects transaction** → Friendly dismissal message
5. **First-time user** → Non-intrusive tooltip on first visit
6. **Loading states** → Skeleton shimmer provides visual feedback
7. **Empty portfolio** → CTA button to navigate to markets

### Performance Notes
- Skeleton animations use `useNativeDriver: true` for 60fps performance
- Haptic feedback is async but doesn't block UI
- AsyncStorage check is non-blocking (useEffect)
- Modal overlay doesn't re-render during transaction
