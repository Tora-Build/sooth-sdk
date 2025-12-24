# Solana Frontend Integration Guide

## Architecture Overview

The frontend now supports both **EVM chains** (Base Sepolia, MegaETH) and **Solana chains** (Devnet) with separate hook implementations:

### EVM Hooks (`wagmi`-based)
- `useMarket` - Reads from EVM contracts via `useReadContracts`
- `useTrade` - Executes trades through TraderVaultV3
- `useTraderVault` - Manages deposits/withdrawals/orders on EVM
- `useOrderbook` - EVM orderbook operations

### Solana Hooks (`@coral-xyz/anchor`-based)
- `useSolanaProgram` - Anchor program provider
- `useSolanaMarket` - Fetches market data from Solana program
- `useSolanaPosition` - Fetches user position
- `useSolanaTrade` - Executes AMM trades on Solana
- `useSolanaTraderVault` - Balance, deposit, withdraw operations
- `useSolanaOrderbook` - Limit order create/cancel/fetch

## Chain Detection

The `useChainStore` now includes:

```typescript
// Check chain type
const { isSolana, isEVM, selectedChainId } = useChainStore();

if (isSolana()) {
  // Use Solana hooks
} else {
  // Use EVM hooks
}
```

## Updated Hooks

### ✅ useMarket - Chain Abstraction Complete

The `useMarket` hook now automatically routes to the correct implementation:

```typescript
// Usage remains the same
const { market, isLoading, refetch } = useMarket(marketId);

// Internally routes to:
// - useEVMMarket() when on Base/MegaETH
// - useSolanaMarket() when on Solana Devnet
```

### 📝 useTrade & useTraderVault - Direct Hook Usage

For trading and vault operations, use conditional rendering in components:

```typescript
function TradingComponent({ marketId }) {
  const { isSolana } = useChainStore();
  
  if (isSolana()) {
    // Solana implementation
    const { mutate: trade } = useSolanaTrade(Number(marketId));
    const { data: balance } = useSolanaUserBalance();
    
    const handleTrade = () => {
      trade({
        outcome: 0,
        shares: '100',
        isBuy: true,
        maxCost: '65',
      });
    };
    
    return <button onClick={handleTrade}>Buy YES (Solana)</button>;
  }
  
  // EVM implementation
  const { trade } = useTrade(marketId);
  
  return <button onClick={() => trade(0, '100', 50)}>Buy YES (EVM)</button>;
}
```

## Component Integration Patterns

### Pattern 1: Conditional Hook Usage

```typescript
function Portfolio() {
  const { isSolana } = useChainStore();
  
  if (isSolana()) {
    const { data: balance } = useSolanaUserBalance();
    const { mutate: deposit } = useSolanaDeposit();
    const { mutate: withdraw } = useSolanaWithdraw();
    
    return (
      <div>
        <p>Balance: {balance?.freeBalance} USDC</p>
        <button onClick={() => deposit('100')}>Deposit</button>
        <button onClick={() => withdraw('50')}>Withdraw</button>
      </div>
    );
  }
  
  // EVM implementation
  const { 
    availableBalance, 
    deposit, 
    withdraw 
  } = useTraderVault();
  
  return <div>{/* EVM UI */}</div>;
}
```

### Pattern 2: Unified Data Shape

Create adapter functions to normalize data between chains:

```typescript
function useAccountBalance() {
  const { isSolana } = useChainStore();
  
  if (isSolana()) {
    const { data } = useSolanaUserBalance();
    return {
      available: data?.freeBalance || '0',
      locked: data?.lockedBalance || '0',
      total: data?.total || '0',
    };
  }
  
  const { availableBalance, pendingBalance, totalBalance } = useTraderVault();
  return {
    available: availableBalance.toString(),
    locked: pendingBalance.toString(),
    total: totalBalance.toString(),
  };
}
```

## Key Differences to Handle

| Feature | EVM | Solana |
|---------|-----|--------|
| **Market ID** | String (e.g., "btc-dec31") | Number (e.g., 2) |
| **Decimals** | 18 (WAD) | 6 (USDC) for balances, WAD for shares |
| **Transaction Confirmation** | `waitForTransactionReceipt` | Built into Anchor RPC |
| **Account Initialization** | Automatic | Requires explicit initialization (balance, position PDAs) |
| **Wallet** | wagmi + Reown | `@solana/wallet-adapter-react` |

## UI Component Updates Needed

### 1. Portfolio Summary
- Add chain detection
- Show Solana balance when on Solana Devnet
- Handle different account initialization flows

### 2. Trader Terminal
- Conditional rendering for buy/sell buttons
- Handle different market ID formats
- Show appropriate transaction status

### 3. Orderbook Panel
- Fetch orders from Solana program when on Solana
- Display create/cancel order UI
- Handle different order ID types (bigint vs BN)

## Testing Checklist

- [ ] Switch chain selector to Solana Devnet
- [ ] Connect Phantom wallet
- [ ] Initialize user balance account
- [ ] Deposit mock USDC
- [ ] View market data (Market ID 2)
- [ ] Execute AMM trade
- [ ] Create limit order
- [ ] Cancel limit order
- [ ] Withdraw funds

## Next Steps

1. **Update Portfolio Component** (`src/components/Portfolio.tsx`)
2. **Update Trader Terminal** (`src/components/TraderTerminal.tsx`)
3. **Update Orderbook Panel** (`src/components/OrderbookPanel.tsx`)
4. **Add Account Initialization Flow** - Prompt users to initialize balance/position accounts
5. **Test Full Flow** - End-to-end testing with Phantom wallet

## Deployment Addresses (Devnet)

```typescript
// Already configured in src/config/solana/program.ts
{
  programId: '23pTwMDF5Y9FFjnaqr2411cXVN2qfYmvuHMmsaeHVPmG',
  usdcMint: 'CFpH3GfG5omFAPf44NnhUC2ivL35aL3dd2wqQrSJEmos',
  traderVaultV2: '6Tw72bGYp7QXGiPQRfJgXsGbTjypN3sjizU8GPR17rfe',
  governorVaultV2: 'EyrUhv4Dfy7REq2Q3HmC3boSpC8WtRwmvwnVwx4s17E9',
}
```
