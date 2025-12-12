# Sooth dApp

Frontend application for Sooth Protocol prediction markets.

## Tech Stack

- **Framework:** Vite + React 18
- **State:** Zustand
- **Web3:** Wagmi v2 + Viem
- **Styling:** Tailwind CSS

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# Opens at http://localhost:5173

# Build for production
npm run build
```

## Environment Variables

Create `.env.local`:

```env
VITE_RPC_URL=https://sepolia.base.org
VITE_CHAIN_ID=84532
```

## Project Structure

```
src/
  components/       # React components
    MarketCard.tsx
    Orderbook.tsx
    TradePanel.tsx
    Portfolio.tsx
  hooks/            # Custom hooks
    useMarket.ts
    useTrade.ts
    useOrderbook.ts
  stores/           # Zustand stores
    chainStore.ts
    marketStore.ts
  config/           # Configuration
    abis/           # Contract ABIs
    deployments.ts  # Contract addresses
  pages/            # Page components
  utils/            # Utility functions
```

## Features

| Feature           | Status           |
| ----------------- | ---------------- |
| AMM Trading       | ✅ Complete      |
| Portfolio Display | ✅ Complete      |
| Orderbook Display | ✅ Complete      |
| Limit Orders      | ⚠️ Needs Testing |
| LP Dashboard      | ⚠️ Needs Testing |

## Known Issues

- [ ] Stale balances after trade (refetch timing)
- [ ] Mobile wallet connect is flaky
- [ ] No error boundaries implemented

## Development Notes

### Importing from SDK

Once `@sooth/sdk` is properly linked:

```typescript
import { SOOTH_MARKET_ABI } from "@sooth/sdk/abis";
import { deployments } from "@sooth/sdk/config";
```

### Contract Integration Docs

See `docs/contract-integration/` for:

- ABI references
- Contract interfaces
- Integration guides
