# Solana Integration Attempt - Complete Record
**Date**: 2025-12-07  
**Status**: ❌ Removed due to StandardWalletAdapter compatibility issues  
**Recovery**: Use this document to restore Solana support later

---

## Summary
Attempted full Solana integration with Phantom wallet support alongside existing EVM infrastructure. Successfully implemented UI components and split button design, but blocked by wallet adapter connection errors.

---

## What Was Implemented

### 1. **Split Button UI** ✅ (Working)
**File**: `src/components/layout/Navbar.tsx`

```typescript
// Split button with primary EVM action + Solana dropdown
<div className="relative flex">
  {/* Primary Action - Connect EVM */}
  <button
    onClick={handleConnectEVM}
    className="btn-primary text-xs sm:text-sm py-1.5 pl-3 pr-2 sm:pl-4 sm:pr-3 whitespace-nowrap rounded-r-none border-r border-indigo-500"
  >
    Connect <span className="hidden sm:inline">Wallet</span>
  </button>
  
  {/* Secondary Action - Dropdown Toggle */}
  <button
    onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
    className="btn-primary px-1.5 sm:px-2 rounded-l-none border-l-0"
  >
    <ChevronDown size={14} className={cn("transition-transform", isWalletDropdownOpen && "rotate-180")} />
  </button>

  {/* Dropdown Menu showing Phantom option */}
  {isWalletDropdownOpen && (
    <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50">
      <button onClick={handleConnectPhantom}>
        Phantom (Solana)
      </button>
    </div>
  )}
</div>
```

**Design Pattern**: Material Design split button
- Left: Primary action (EVM) - one-click
- Right: Secondary actions dropdown (Phantom)

---

### 2. **Solana Provider Setup** ✅
**File**: `src/components/providers/SolanaProvider.tsx`

```typescript
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';

export const SolanaProvider = ({ children }) => {
  const endpoint = 'https://api.devnet.solana.com';
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
};
```

**Integration**: `main.tsx` wrapped App with `<SolanaProvider>`

---

### 3. **Chain Store Updates**
**File**: `src/store/useChainStore.ts`

Added Solana chain type support:
```typescript
export type ChainType = 'evm' | 'solana';
export const SOLANA_DEVNET_ID = 'solana-devnet';
```

---

### 4. **Chains Configuration**
**File**: `src/lib/chains.ts`

Added Solana Devnet to `allowedChains`:
```typescript
{
  id: 'devnet',
  type: 'solana',
  name: 'Solana Devnet',
  displayName: 'Solana Devnet',
  rpcUrl: 'https://api.devnet.solana.com',
  explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
  icon: '🟣',
  nativeCurrency: {
    name: 'Solana',
    symbol: 'SOL',
    decimals: 9,
  },
}
```

**Note**: Later removed from `allowedChains` to hide from chain selector

---

## Connection Attempts & Blockers

### Attempt 1: Direct `window.phantom.solana.connect()`
```typescript
const provider = window.phantom.solana;
await provider.connect();
```
**Result**: ❌ Showed EVM networks (Base Sepolia/MegaETH) instead of Solana  
**Reason**: Phantom has dual EVM+Solana support, defaulted to EVM

---

### Attempt 2: `phantom.adapter.connect()`
```typescript
const phantom = wallets.find(w => w.adapter.name === 'Phantom');
await phantom.adapter.connect();
```
**Result**: ❌ No popup, silent failure  
**Reason**: StandardWalletAdapter doesn't trigger UI popup

---

### Attempt 3: Wallet Adapter `select()`
```typescript
await select(phantom.adapter.name);
```
**Result**: ❌ "WalletConnectionError: Unexpected error"  
**Error**: `StandardWalletAdapter._StandardWalletAdapter_connect2`  
**Reason**: Compatibility issue with Phantom's Wallet Standard implementation

---

## Root Cause Analysis

**Problem**: Phantom is detected as a `StandardWalletAdapter` (Wallet Standard v1.0) instead of legacy `PhantomWalletAdapter`.

**Why**: When both Standard Wallet protocol and legacy adapter are present, the wallet adapter library prioritizes Standard Wallet, which has compatibility issues with current implementation.

**Evidence**:
- Console log: `phantom.adapter.constructor.name === 'StandardWalletAdapter'`
- Error originates from `@solana/wallet-adapter-react` internal Standard Wallet connection logic
- Browser shows warning: "Phantom was registered as a Standard Wallet. The Wallet Adapter for Phantom can be removed from your app."

---

## Files Modified (To Be Reverted)

1. **src/main.tsx**
   - Added `SolanaProvider` wrapper
   - Removed Solana from AppKit config

2. **src/components/providers/SolanaProvider.tsx**
   - NEW FILE (to be deleted)

3. **src/components/layout/Navbar.tsx**
   - Added split button UI
   - Added `useWallet` hook
   - Added `handleConnectPhantom` function
   - Added Phantom dropdown menu

4. **src/lib/chains.ts**
   - Added Solana chain configuration
   - Later removed from `allowedChains` array

5. **src/store/useChainStore.ts**
   - Added Solana chain type support

6. **src/components/features/PortfolioSummary.tsx**
   - Temporarily added Solana hooks (already reverted)

7. **src/components/features/TradingAccountCard.tsx**
   - Temporarily added Solana hooks (already reverted)

8. **src/components/features/WalletStatus.tsx**
   - Created then removed (already deleted)

---

## Future Recovery Instructions

### Option A: Wait for Library Updates
Monitor these packages for Wallet Standard improvements:
- `@solana/wallet-adapter-react`
- `@solana/wallet-adapter-base`
- `@solana/wallet-standard`

### Option B: Custom Phantom Integration
Bypass wallet adapter entirely:

```typescript
// Direct Phantom connection (no adapter)
const connectPhantom = async () => {
  if (window.phantom?.solana) {
    const provider = window.phantom.solana;
    const response = await provider.connect();
    
    // Manually manage connection state
    setPhantomWallet({
      publicKey: response.publicKey.toString(),
      connected: true
    });
  }
};
```

**Pros**: Direct control, no adapter issues  
**Cons**: Manual state management, no auto-reconnect

### Option C: Use Only Legacy Adapters
Force legacy adapter usage:

```typescript
// In SolanaProvider, only use PhantomWalletAdapter
const wallets = useMemo(() => [
  new PhantomWalletAdapter(),
  // Explicitly exclude StandardWalletAdapter
], []);
```

May require library configuration to disable Standard Wallet detection.

---

## Recommended Restoration Approach

When Solana support is ready to be restored:

1. **Start with Option B (Custom Integration)**
   - Simplest, most direct
   - Test connection stability first

2. **If successful, enhance with**:
   - Auto-reconnect logic
   - Connection state persistence
   - Proper error handling

3. **Once stable, consider**:
   - Migrating to fixed wallet adapter (if available)
   - Adding Solflare support
   - Implementing wallet switching

---

## Split Button Design (Keep This)

The split button UI pattern is solid and can be reused:

**Current**: Left = EVM, Right = (removed)  
**Future**: Left = EVM, Right = Solana options

**Pattern**:
```
┌─────────────────┬──┐
│ Connect Wallet  │▼ │
└─────────────────┴──┘
  Primary Action   Secondary Menu
```

This UI framework is ready for Solana when the connection method is fixed.

---

## Git Commit References

All Solana-related changes can be found in commits from 2025-12-07:
- Initial Solana integration
- Split button implementation
- Connection debugging attempts
- Clean removal (this commit)

Use `git log --since="2025-12-07" --grep="Solana"` to find relevant commits.

---

## Dependencies to Remove

After cleanup, these dependencies may not be needed:
- `@solana/wallet-adapter-react` (unless used elsewhere)
- `@solana/wallet-adapter-wallets`
- `@solana/wallet-adapter-base`

Check if any other parts of the app still reference Solana hooks/contracts before removing.
