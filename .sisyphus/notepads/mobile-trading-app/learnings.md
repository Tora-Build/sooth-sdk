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
