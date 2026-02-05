# Phase 01: Diagnose AppKit-Wagmi State Synchronization

This phase creates a comprehensive diagnostic instrument to trace exactly where the WalletConnect connection state diverges between AppKit events and wagmi/useAccount. By the end of this phase, we'll have clear console logs showing the exact sequence of events and state changes, which will reveal whether the issue is in AppKit, wagmi adapter, or the app's state management.

## Tasks

- [x] Create a diagnostic logging utility for the mobile app:
  - Create `apps/mobile/src/lib/debug.ts` with timestamped structured logging
  - Export `debugLog(category: string, event: string, data?: object)` function
  - Categories: 'APPKIT', 'WAGMI', 'AUTH', 'STORAGE', 'DEEPLINK'
  - Each log should include: timestamp, category, event name, and JSON-serialized data
  - Logs should be visible in Metro bundler console

  **Completed 2026-02-05:** Created `apps/mobile/src/lib/debug.ts` with:
  - `debugLog()` function with timestamped, category-prefixed logging
  - In-memory log buffer with max 100 entries
  - Subscriber pattern for real-time updates (`subscribeToLogs()`)
  - Helper functions: `getRecentLogs()`, `getLastLog()`, `clearLogs()`
  - Value truncation for readability and security (masks keys/secrets)

- [ ] Instrument the AppKit initialization in `apps/mobile/src/lib/appkit.ts`:
  - Import the debug utility
  - Log every storage operation (getItem, setItem, removeItem) with key names and truncated values
  - Log AppKit instance creation with all config options
  - Log the project ID (masked, first 4 chars only for security)

- [ ] Add comprehensive event tracing in `apps/mobile/app/_layout.tsx`:
  - Log every AppKit event subscription trigger with full event payload
  - Log when `eventConnected` context state changes (before and after values)
  - Log when `AuthGate` receives new values for `isConnected`, `eventConnected`, `address`
  - Log navigation decisions (why routing to tabs vs login)
  - Add a `useEffect` that logs `useAccount()` return value on every render

- [ ] Create a visible debug banner component for runtime inspection:
  - Create `apps/mobile/src/components/DebugBanner.tsx`
  - Show current state: `isConnected`, `eventConnected`, `address` (truncated), last event received
  - Make it a small floating banner at bottom of screen (only in __DEV__ mode)
  - Update in real-time as state changes
  - Add to `_layout.tsx` alongside AppKitStatusBanner

- [ ] Run the app and trigger a wallet connection to capture the diagnostic output:
  - Run `cd apps/mobile && npx expo start --dev-client`
  - Open app on device
  - Tap "Connect Wallet"
  - Select a wallet (Uniswap or MetaMask)
  - Approve connection in wallet
  - Return to app
  - Document the exact console output sequence in `apps/mobile/DEBUG-LOG-CAPTURE.md`
  - Note the specific point where `CONNECT_SUCCESS` fires but `useAccount.isConnected` stays false
