# V8 Frontend Architecture Specification

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Draft

---

## Overview

This document provides the high-level architecture for the V8 frontend, including routing, shared components, state management, and integration patterns.

---

## Page Structure

### Route Map

```
/
├── /markets                          # Market list (all markets)
│   └── /:marketId
│       ├── /amm                      # AMM Trading Terminal
│       ├── /orderbook                # Orderbook Trading Terminal
│       ├── /operator                 # Operator Console (creator/adjudicator/guardian)
│       └── /info                     # Market Details & Stats
│
├── /portfolio                        # User's positions across all markets
│   ├── /amm-positions               # AMM positions (non-transferable)
│   ├── /orderbook-positions         # Orderbook tokens (ERC20)
│   └── /liquidity                   # LP positions (creator stakes)
│
├── /create                          # Create new market
└── /docs                            # Documentation & guides
```

---

## Shared Components

### 1. Market Header

**Component**: `MarketHeader.tsx`  
**Used In**: All market pages

**Props**:
```typescript
interface MarketHeaderProps {
  marketAddress: string;
  showNavigation?: boolean;
}
```

**Display**:
```
┌─────────────────────────────────────────────┐
│ Will ETH > $5000 by EOY?                    │
│ Deadline: Dec 31, 2025 23:59 UTC           │
│ Status: 🟢 Live                             │
│                                             │
│ Current Probability: 54.5%                  │
│ [YES 54.5%] [NO 45.5%]                     │
│                                             │
│ Navigation: [AMM] [Orderbook] [Info]       │
└─────────────────────────────────────────────┘
```

**Data Sources**:
- `TruthMarket.question()`
- `TruthMarket.deadline()`
- `TruthMarket.isLive()`, `isSettled()`
- Current price from active venue (AMM or Orderbook)

### 2. Wallet Connection

**Component**: `WalletButton.tsx`  
**Location**: Top navigation

**States**:
- Not connected: "Connect Wallet"
- Connected: "0x1234...5678 | 1,234.56 USDC"
- Wrong network: "Switch to Base Sepolia"

**Integration**: Uses `@reown/appkit`

### 3. Chain Selector

**Component**: `ChainSelector.tsx`  
**Location**: Top navigation

**Supported Chains** (from `deployments.json`):
- Base Sepolia (84532)
- BNB Testnet (97)
- Monad Testnet (10143)

**Display**: Dropdown with chain logos

### 4. Transaction Toast

**Component**: `TransactionToast.tsx`  
**Global**: Via toast provider

**States**:
- Pending: "Transaction pending..." (spinner)
- Success: "Transaction confirmed!" (checkmark)
- Error: "Transaction failed: [reason]" (X)

**Actions**: "View on Explorer" link

---

## State Management

### Global State (Zustand)

**Store**: `useAppStore.ts`

```typescript
interface AppState {
  // Chain
  selectedChainId: number;
  setChainId: (chainId: number) => void;
  
  // User
  connectedAddress: string | null;
  usdcBalance: bigint;
  
  // UI
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}
```

### Contract State (Wagmi)

**Hooks**: Use wagmi's built-in caching

- `useReadContract` - Single contract read
- `useReadContracts` - Batch reads
- `useWriteContract` - Contract writes
- `useWatchContractEvent` - Event listening

**Cache Strategy**:
- Market data: 10s TTL
- User positions: 5s TTL
- Quotes: No cache (real-time)

---

## Contract Integration

### ABI Management

**File**: `apps/web/src/config/abis.ts`

```typescript
export const ABIS = {
  TruthMarket: [...],
  AMMEngine: [...],
  TickBook: [...],
  Collateralizer: [...],
  OutcomeToken: [...],
} as const;
```

**Usage**:
```typescript
import { ABIS } from '@/config/abis';

const { data } = useReadContract({
  address: marketAddress,
  abi: ABIS.TruthMarket,
  functionName: 'isLive',
});
```

### Deployment Config

**File**: `apps/web/src/config/deployments.json`

```json
{
  "version": "8.0.0",
  "networks": {
    "84532": {
      "name": "Base Sepolia",
      "rpcUrl": "https://sepolia.base.org",
      "contracts": {
        "Collateralizer": "0x...",
        "TickBook": "0x..."
      }
    }
  }
}
```

**Hook**: `useDeployments(chainId)`

```typescript
const { contracts } = useDeployments(selectedChainId);
const collateralizerAddress = contracts.Collateralizer;
```

---

## Data Flow

### Market Data Flow

```
User Action
    ↓
Component
    ↓
Hook (useAMMMarket, useOrderbook)
    ↓
wagmi (useReadContract)
    ↓
RPC Provider
    ↓
Smart Contract
    ↓
Return Data
    ↓
Hook (transform to UI format)
    ↓
Component (render)
```

### Transaction Flow

```
User Action (Click "Buy")
    ↓
Component (validate inputs)
    ↓
Hook (useTrade)
    ↓
wagmi (useWriteContract)
    ↓
Wallet (user signs)
    ↓
RPC Provider (broadcast)
    ↓
Smart Contract (execute)
    ↓
Transaction Receipt
    ↓
Event Listener (useWatchContractEvent)
    ↓
Refresh Data (invalidate cache)
    ↓
Component (update UI)
```

---

## Hook Architecture

### Naming Convention

- `use[Domain][Action]` - e.g., `useAMMTrade`, `useOrderbookQuote`
- `use[Entity]` - e.g., `useMarket`, `usePosition`

### Standard Hook Pattern

```typescript
export function useAMMMarket(marketAddress: string) {
  const { selectedChainId } = useAppStore();
  
  // Read contract data
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      {
        address: ammEngineAddress,
        abi: ABIS.AMMEngine,
        functionName: 'getLiquidity',
        args: [marketAddress],
        chainId: selectedChainId,
      },
      {
        address: ammEngineAddress,
        abi: ABIS.AMMEngine,
        functionName: 'getMarketState',
        args: [marketAddress],
        chainId: selectedChainId,
      },
    ],
  });
  
  // Transform data
  const liquidity = data?.[0].result;
  const [qYes, qNo, price] = data?.[1].result || [];
  
  return {
    liquidity,
    qYes,
    qNo,
    price,
    isLoading,
    error,
    refetch,
  };
}
```

---

## Styling Architecture

### Design System

**File**: `apps/web/src/styles/design-system.css`

```css
:root {
  /* Colors */
  --color-primary: #8B5CF6;      /* Purple */
  --color-success: #10B981;      /* Green */
  --color-danger: #EF4444;       /* Red */
  --color-warning: #F59E0B;      /* Yellow */
  --color-info: #3B82F6;         /* Blue */
  
  /* Gradients */
  --gradient-primary: linear-gradient(135deg, #8B5CF6, #EC4899);
  --gradient-success: linear-gradient(135deg, #10B981, #059669);
  --gradient-danger: linear-gradient(135deg, #EF4444, #DC2626);
  
  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  
  /* Typography */
  --font-mono: 'JetBrains Mono', monospace;
  --font-sans: 'Inter', sans-serif;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}
```

### Component Styling

**Pattern**: CSS Modules

```typescript
// Component.tsx
import styles from './Component.module.css';

export function Component() {
  return <div className={styles.container}>...</div>;
}
```

```css
/* Component.module.css */
.container {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
}
```

---

## Error Handling

### Error Boundary

**Component**: `ErrorBoundary.tsx`

**Catches**:
- Component render errors
- Hook errors
- Async errors

**Display**:
```
┌─────────────────────────────────────┐
│ ⚠️ Something went wrong             │
│                                     │
│ [Error details]                     │
│                                     │
│ [Reload Page] [Report Issue]       │
└─────────────────────────────────────┘
```

### Contract Error Handling

**Pattern**:
```typescript
try {
  await writeContract({...});
} catch (error) {
  if (error.message.includes('user rejected')) {
    toast.error('Transaction cancelled');
  } else if (error.message.includes('insufficient funds')) {
    toast.error('Insufficient balance');
  } else {
    toast.error(`Transaction failed: ${error.message}`);
  }
}
```

---

## Performance Optimization

### Code Splitting

```typescript
// Lazy load heavy components
const OrderbookChart = lazy(() => import('./OrderbookChart'));

// Use in component
<Suspense fallback={<Spinner />}>
  <OrderbookChart />
</Suspense>
```

### Memoization

```typescript
// Expensive calculations
const quote = useMemo(() => {
  return calculateQuote(amount, price);
}, [amount, price]);

// Callback stability
const handleTrade = useCallback(() => {
  executeTrade(amount);
}, [amount]);
```

### Virtual Lists

**For**: Orderbook tick ladder (10,000 ticks)

**Library**: `react-window`

```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={ticks.length}
  itemSize={32}
>
  {({ index, style }) => (
    <TickRow tick={ticks[index]} style={style} />
  )}
</FixedSizeList>
```

---

## Testing Strategy

### Unit Tests (Vitest)

**Test**: Hooks, utilities, calculations

```typescript
describe('useAMMQuote', () => {
  it('calculates cost correctly', () => {
    const { result } = renderHook(() => 
      useAMMQuote(marketAddress, 100n)
    );
    expect(result.current.cost).toBe(expectedCost);
  });
});
```

### Integration Tests (Testing Library)

**Test**: Component interactions

```typescript
describe('AMMTradingPanel', () => {
  it('executes buy trade', async () => {
    render(<AMMTradingPanel marketAddress={address} />);
    
    await userEvent.type(screen.getByPlaceholderText('Enter amount'), '100');
    await userEvent.click(screen.getByText('Buy YES'));
    
    expect(mockWriteContract).toHaveBeenCalled();
  });
});
```

### E2E Tests (Playwright)

**Test**: Full user journeys

```typescript
test('complete trading flow', async ({ page }) => {
  await page.goto('/markets/0x.../amm');
  await page.fill('[placeholder="Enter amount"]', '100');
  await page.click('text=Buy YES');
  await page.click('text=Confirm');
  await expect(page.locator('text=Transaction confirmed')).toBeVisible();
});
```

---

## Deployment

### Build Process

```bash
# Development
npm run dev          # Start dev server

# Production
npm run build        # Build for production
npm run preview      # Preview production build
```

### Environment Variables

**File**: `.env`

```bash
VITE_WALLETCONNECT_PROJECT_ID=xxx
VITE_ALCHEMY_API_KEY=xxx
VITE_DEFAULT_CHAIN_ID=84532
```

### CI/CD

**GitHub Actions**:
1. Lint check
2. Type check
3. Unit tests
4. Build
5. Deploy to Vercel

---

## Documentation

### Component Documentation

**Pattern**: JSDoc comments

```typescript
/**
 * AMM Trading Panel
 * 
 * Provides buy/sell interface for AMM trading with real-time quotes.
 * 
 * @param marketAddress - Address of the market contract
 * @param onTradeComplete - Callback after successful trade
 * 
 * @example
 * <AMMTradingPanel 
 *   marketAddress="0x..." 
 *   onTradeComplete={() => refetch()}
 * />
 */
export function AMMTradingPanel({ marketAddress, onTradeComplete }: Props) {
  // ...
}
```

### Hook Documentation

**Pattern**: README per hook directory

```markdown
# useAMMMarket

Fetches AMM market state including liquidity, quantities, and price.

## Usage

```typescript
const { liquidity, qYes, qNo, price } = useAMMMarket(marketAddress);
```

## Returns

- `liquidity`: Liquidity parameter (b)
- `qYes`: YES quantity
- `qNo`: NO quantity  
- `price`: Current probability
```

---

## Migration from V7

### Breaking Changes

1. **No TraderVault**: Direct USDC transfers
2. **Separate Pages**: AMM and Orderbook split
3. **New ABIs**: All contracts updated
4. **New Hooks**: Complete rewrite

### Migration Checklist

- [ ] Update all contract addresses
- [ ] Replace TraderVault hooks with direct token hooks
- [ ] Split trading UI into AMM and Orderbook pages
- [ ] Update all ABIs to V8
- [ ] Test all user flows
- [ ] Update documentation

---

## Future Enhancements

### Phase 2 (Post-Launch)

- [ ] WebSocket for real-time orderbook updates
- [ ] Advanced charting (TradingView integration)
- [ ] Mobile app (React Native)
- [ ] Portfolio analytics dashboard
- [ ] Social features (leaderboard, sharing)

### Phase 3 (Advanced)

- [ ] Gasless transactions (account abstraction)
- [ ] Cross-chain trading
- [ ] Automated market making (AMM LP strategies)
- [ ] API for third-party integrations

---

**Last Updated**: 2025-12-23  
**Next Review**: Before V8 frontend implementation kickoff
