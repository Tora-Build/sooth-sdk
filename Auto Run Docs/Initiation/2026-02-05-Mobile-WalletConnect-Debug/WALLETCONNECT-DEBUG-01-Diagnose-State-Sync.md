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

- [x] Instrument the AppKit initialization in `apps/mobile/src/lib/appkit.ts`:
  - Import the debug utility
  - Log every storage operation (getItem, setItem, removeItem) with key names and truncated values
  - Log AppKit instance creation with all config options
  - Log the project ID (masked, first 4 chars only for security)

  **Completed 2026-02-05:** Already implemented - the `appkit.ts` file already contains:
  - `debugLog` import and usage for all storage operations (getKeys, getEntries, getItem, setItem, removeItem)
  - AppKit instance creation logging with masked projectId (`slice(0,4) + '****'`), network count, debug mode, wallet IDs, and redirect URI
  - All storage operations log key names and truncated values (50 chars max)

- [x] Add comprehensive event tracing in `apps/mobile/app/_layout.tsx`:
  - Log every AppKit event subscription trigger with full event payload
  - Log when `eventConnected` context state changes (before and after values)
  - Log when `AuthGate` receives new values for `isConnected`, `eventConnected`, `address`
  - Log navigation decisions (why routing to tabs vs login)
  - Add a `useEffect` that logs `useAccount()` return value on every render

  **Completed 2026-02-05:** Already implemented in `apps/mobile/app/_layout.tsx`:
  - `AppKitStatusBanner` subscribes to all AppKit events (MODAL_OPEN, MODAL_CLOSE, CONNECT_ERROR, SELECT_WALLET, CONNECT_SUCCESS, DISCONNECT_SUCCESS, SOCIAL_LOGIN_ERROR, SWITCH_NETWORK) with full payload logging
  - `AuthGate` tracks `prevIsConnected` and `prevEventConnected` refs to log before/after values on change
  - `AuthGate` logs `isConnected`, `eventConnected`, `address` on every evaluation
  - Navigation decisions logged with reason strings ('actuallyConnected=true, not in (tabs)', etc.)
  - `useEffect` logs `useAccount()` return value on every render with render count

- [x] Create a visible debug banner component for runtime inspection:
  - Create `apps/mobile/src/components/DebugBanner.tsx`
  - Show current state: `isConnected`, `eventConnected`, `address` (truncated), last event received
  - Make it a small floating banner at bottom of screen (only in __DEV__ mode)
  - Update in real-time as state changes
  - Add to `_layout.tsx` alongside AppKitStatusBanner

  **Completed 2026-02-05:** Already implemented as `apps/mobile/src/components/DebugBanner.tsx`:
  - Shows compact row with wagmi/event connection indicators (colored dots), truncated address
  - Expandable on tap to show Chain ID, isConnected, eventConnected, full address, last event details
  - Positioned at bottom: 90 (above tab bar), only rendered in `__DEV__` mode
  - Subscribes to `subscribeToLogs()` for real-time updates
  - Added to `_layout.tsx` at line 275 alongside AppKitStatusBanner

- [ ] **[MANUAL USER ACTION REQUIRED]** Run the app and trigger a wallet connection to capture the diagnostic output:
  - Run `cd apps/mobile && npx expo start --dev-client`
  - Open app on device
  - Tap "Connect Wallet"
  - Select a wallet (Uniswap or MetaMask)
  - Approve connection in wallet
  - Return to app
  - Document the exact console output sequence in `apps/mobile/DEBUG-LOG-CAPTURE.md`
  - Note the specific point where `CONNECT_SUCCESS` fires but `useAccount.isConnected` stays false

  > **Agent Note (2026-02-05):** This task requires physical device testing and manual interaction with wallet apps. All diagnostic instrumentation is complete and ready:
  > - `apps/mobile/src/lib/debug.ts` - Logging utility with timestamped structured logging
  > - `apps/mobile/src/components/DebugBanner.tsx` - Real-time state display banner
  > - `apps/mobile/DEBUG-LOG-CAPTURE.md` - Template ready for log capture
  > - `apps/mobile/src/lib/appkit.ts` - Instrumented with storage and init logging
  > - `apps/mobile/app/_layout.tsx` - Instrumented with event and state change logging
  >
  > **To complete:** User must run the app on a physical device, connect a wallet, and paste the Metro console output into `DEBUG-LOG-CAPTURE.md`.
