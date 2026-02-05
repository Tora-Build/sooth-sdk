# WalletConnect Debug Log Capture

> This document is for capturing the exact console output sequence when connecting a wallet.
> Replace the placeholder content below with actual Metro bundler logs.

## How to Capture

1. Start the app: `cd apps/mobile && npx expo start --dev-client`
2. Open the app on your device
3. Clear the Metro console
4. Tap "Connect Wallet"
5. Select a wallet (Uniswap or MetaMask)
6. Approve connection in wallet app
7. Return to Sooth app
8. Copy all logs from Metro console below

---

## Diagnostic Info

- **Date/Time:** (fill in)
- **Device:** (e.g., iPhone 15 Pro, iOS 17.2)
- **Wallet App:** (e.g., Uniswap Wallet v1.x.x)
- **Expo SDK:** (check package.json)
- **AppKit Version:** (check package.json)

---

## Expected Log Categories

The diagnostic instrumentation logs with these prefixes:

- `[APPKIT]` - AppKit events and initialization
- `[WAGMI]` - useAccount() hook state changes
- `[AUTH]` - Authentication gate decisions
- `[STORAGE]` - AsyncStorage operations
- `[DEEPLINK]` - (future) Deep link handling

---

## Console Output

```
(Paste Metro bundler logs here)
```

---

## Observations

### Point of Divergence

> Note the specific log entry where `CONNECT_SUCCESS` fires but `useAccount.isConnected` stays false.

```
(Identify the relevant log entries)
```

### State Timeline

| Time | Event | isConnected | eventConnected | Address |
|------|-------|-------------|----------------|---------|
| | | | | |

---

## Hypotheses

Based on the logs, the likely cause is:

1. [ ] AppKit fires CONNECT_SUCCESS before wagmi adapter syncs
2. [ ] Storage persistence issue causing state loss
3. [ ] Event subscription timing issue
4. [ ] Deep link return not triggering state refresh
5. [ ] Other: _____

---

## Next Steps

- [ ] Analyze the divergence point
- [ ] Check if wagmi adapter is receiving connection events
- [ ] Investigate storage consistency
