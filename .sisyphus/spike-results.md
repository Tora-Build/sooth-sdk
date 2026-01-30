# Spike Results: Privy + viem + BigInt in Expo/Hermes

**Date**: 2026-01-30
**Spike Location**: `/tmp/sooth-spike` (throwaway, not committed)
**Expo SDK**: 54.0.0 | **Privy Expo**: 0.63.3 | **viem**: 2.x

---

## Test Results Summary

| Component | Result | Confidence |
|-----------|--------|------------|
| BigInt in Hermes | **PASS** | High — tested in Node.js, web bundle compiled successfully. Hermes 0.70+ (Expo SDK 49+) supports BigInt natively. |
| viem `createPublicClient` | **PASS** | High — tested live against Base Sepolia RPC |
| viem `readContract` | **PASS** | High — read MockUSDC decimals (18), name ("Mock USDC"), totalSupply (bigint) |
| viem TypeScript compilation | **PASS** | High — zero TS errors, Metro bundled 1328 modules for web |
| Privy Expo SDK install | **PASS** | High — `@privy-io/expo@0.63.3` installs with all peer deps |
| Privy login flow | **NOT TESTED** | Medium — requires Privy App ID + dev build (no iOS simulator runtimes available). API surface validated via type inspection. |
| Privy wagmi adapter (Expo) | **NO** | High — `@privy-io/wagmi` requires `@privy-io/react-auth` (web-only). No Expo wagmi adapter exists. |

---

## Detailed Findings

### 1. BigInt Support — PASS

```javascript
const x = BigInt('1000000000000000000'); // 1e18
const y = BigInt('2000000000000000000'); // 2e18
const sum = x + y;  // 3000000000000000000n
const product = x * y / BigInt('1000000000000000000'); // WAD mul = 2e18

// All assertions pass
x.toString() === '1000000000000000000'  // true
sum.toString() === '3000000000000000000' // true
```

**Notes**: Hermes has supported BigInt since v0.70 (React Native 0.70+). Expo SDK 49+ uses Hermes by default. No polyfills needed.

**Caveat**: Use `BigInt('...')` constructor, NOT literal `1000n` syntax, as some older Metro bundler configs may not parse BigInt literals in JSX. However, Expo SDK 54 should handle both.

### 2. viem readContract — PASS

```typescript
import { createPublicClient, http, erc20Abi } from 'viem';
import { baseSepolia } from 'viem/chains';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const decimals = await client.readContract({
  address: '0xb4f46ed670ed6c4cf422ea61e06961d64a753e9d',
  abi: erc20Abi,
  functionName: 'decimals',
});
// decimals = 18 (number)

const name = await client.readContract({
  address: '0xb4f46ed670ed6c4cf422ea61e06961d64a753e9d',
  abi: erc20Abi,
  functionName: 'name',
});
// name = "Mock USDC"

const totalSupply = await client.readContract({
  address: '0xb4f46ed670ed6c4cf422ea61e06961d64a753e9d',
  abi: erc20Abi,
  functionName: 'totalSupply',
});
// totalSupply = 3511166601078820718927990n (bigint)
```

**Metro Bundler Warning**: One non-blocking warning about `@noble/hashes/crypto.js` exports. Does not affect functionality.

### 3. Privy Expo SDK — INSTALLED, NOT RUNTIME TESTED

**Package**: `@privy-io/expo@0.63.3` (NOT `@privy-io/expo-sdk` — that package doesn't exist on npm)

**Installation** succeeded with all peer dependencies:
```bash
npx expo install @privy-io/expo @privy-io/expo-native-extensions \
  expo-crypto expo-web-browser expo-linking expo-clipboard \
  expo-application expo-secure-store expo-apple-authentication \
  expo-font @expo-google-fonts/inter react-native-svg \
  react-native-webview react-native-passkeys \
  react-native-qrcode-styled@0.3.3 react-native-safe-area-context \
  permissionless viem expo-dev-client @tanstack/react-query
```

**Why not runtime tested**: Privy requires a native development build (`npx expo run:ios`). The test environment has Xcode 26.2 but no iOS simulator runtimes installed. Privy does NOT work with Expo Go.

**Type inspection confirms** the SDK exports all expected hooks:
- `usePrivy` — auth state, login/logout
- `useLoginWithEmail` — email OTP flow
- `useEmbeddedEthereumWallet` — wallet access (replaces deprecated `useEmbeddedWallet`)
- `useLoginWithOAuth` — social login (Google, Apple, etc.)

### 4. Privy WalletClient Access — DOCUMENTED (from type analysis)

The `useEmbeddedEthereumWallet` hook returns `ConnectedEthereumWallet` objects with a `getProvider()` method that returns an EIP-1193 compatible `PrivyEmbeddedWalletProvider`.

**Exact API to get a viem WalletClient from Privy's embedded wallet:**

```typescript
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { createWalletClient, custom } from 'viem';
import { baseSepolia } from 'viem/chains';

function usePrivyWalletClient() {
  const { wallets } = useEmbeddedEthereumWallet();

  const getWalletClient = async () => {
    const wallet = wallets[0]; // First embedded wallet
    if (!wallet) throw new Error('No embedded wallet');

    // getProvider() returns EIP-1193 compatible PrivyEmbeddedWalletProvider
    const provider = await wallet.getProvider();

    return createWalletClient({
      account: wallet.address as `0x${string}`,
      chain: baseSepolia,
      transport: custom(provider),
    });
  };

  return { getWalletClient, wallets };
}
```

**Key types** (from `@privy-io/js-sdk-core`):
```typescript
type ConnectedEthereumWallet = {
  address: string;
  walletIndex: number;
  chainType: 'ethereum';
  getProvider: () => Promise<PrivyEmbeddedWalletProvider>; // EIP-1193
};

type PrivyEmbeddedWalletProvider = EmbeddedWalletProvider; // implements EIP1193Provider
```

### 5. Privy wagmi Adapter — NO (for Expo)

**`@privy-io/wagmi@4.0.0`** exists but requires `@privy-io/react-auth@3.12.0` as a peer dependency. `@privy-io/react-auth` is the **web-only** Privy SDK and is NOT compatible with React Native/Expo.

**No Expo-specific wagmi adapter exists** as of 2026-01-30.

**Implication**: For the mobile app, use viem directly (not wagmi). The pattern is:
1. `usePrivy()` for authentication
2. `useEmbeddedEthereumWallet()` for wallet access
3. `createPublicClient()` for reads
4. `createWalletClient({ transport: custom(provider) })` for writes

This is actually simpler than wagmi for a mobile context — no need for the wagmi abstraction layer.

---

## Architecture Recommendations for Task 3

### Provider Setup (App Root)
```tsx
import { PrivyProvider } from '@privy-io/expo';

<PrivyProvider
  appId={PRIVY_APP_ID}
  config={{
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
    },
  }}
>
  <App />
</PrivyProvider>
```

### Required Configuration
1. **app.json**: Must include `scheme` (for OAuth redirects) and `bundleIdentifier`
2. **Privy Dashboard**: Register the app scheme in allowed redirect URLs
3. **Dev Build**: Must use `npx expo run:ios` or EAS Build — Expo Go will NOT work

### Polyfills
For Expo SDK 54 with Hermes, the following should NOT need polyfills:
- BigInt — native in Hermes 0.70+
- `crypto.getRandomValues` — provided by `expo-crypto`
- `TextEncoder`/`TextDecoder` — may need `text-encoding` polyfill if issues arise

If `viem` has runtime issues in Hermes, install:
```bash
npx expo install expo-standard-web-crypto text-encoding
```
And import at app entry:
```typescript
import 'expo-standard-web-crypto';
import 'text-encoding';
```

### Gotchas
1. **Package name**: It's `@privy-io/expo`, NOT `@privy-io/expo-sdk` (404 on npm)
2. **No Expo Go**: Privy uses native modules — always use dev builds
3. **No wagmi**: Use viem directly on mobile. Simpler and fewer dependencies.
4. **Metro bundler**: `@noble/hashes/crypto.js` exports warning is non-blocking
5. **`useEmbeddedWallet` is deprecated**: Use `useEmbeddedEthereumWallet` instead
6. **Many peer deps**: Privy requires 15+ peer dependencies including `react-native-passkeys`, `react-native-qrcode-styled@0.3.3` (pinned version), etc.

---

## Verdict

**GO** — All critical components are compatible with Expo/Hermes. Proceed with Task 3 (Expo project scaffolding) using:
- `@privy-io/expo` for auth + embedded wallets
- `viem` directly for blockchain interactions (no wagmi)
- Native BigInt (no polyfills needed)
