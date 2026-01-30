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
