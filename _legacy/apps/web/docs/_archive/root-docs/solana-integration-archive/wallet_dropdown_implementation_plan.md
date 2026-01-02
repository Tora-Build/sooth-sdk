# Wallet Connection Dropdown

## Objective
Add a dropdown menu to the "Connect Wallet" button showing two options:
1. **EVM Wallets** - Opens AppKit modal for MetaMask, WalletConnect, etc.
2. **Phantom** - Directly connects Phantom wallet for Solana

## Changes Required

### [`Navbar.tsx`](file:///Users/danieltang/Desktop/Coding/GitHub/sooth-alpha/apps/web/src/components/layout/Navbar.tsx)

1. **Add imports:**
   - `useWallet` from `@solana/wallet-adapter-react`
   - `ChevronDown` icon from Lucide

2. **Add state:**
   - `isWalletDropdownOpen` boolean state

3. **Add handlers:**
   - `handleConnectEVM()` - Calls `open()` to show AppKit modal
   - `handleConnectPhantom()` - Finds Phantom wallet and calls `select()`

4. **Update Connect Wallet button (lines 101-107):**
   - Wrap in `<div className="relative">`
   - Add `ChevronDown` icon that rotates when open
   - Add dropdown menu showing 2 options

## Implementation
- Keep existing connected state button unchanged
- Only modify the disconnected button to show dropdown
- Use backdrop click-away to close dropdown
