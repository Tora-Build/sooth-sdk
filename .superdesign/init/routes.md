# Routes - Sooth Lite PWA

## Route Structure

| Path | Component | Layout | Description |
|------|-----------|--------|-------------|
| `/` | Home | App + BottomNav | Markets list, trending section |
| `/trade/:marketId` | Trade | App (no nav) | Trading interface for specific market |
| `/search` | Placeholder | App + BottomNav | Search markets (coming soon) |
| `/portfolio` | Placeholder | App + BottomNav | User portfolio (coming soon) |
| `/profile` | Placeholder | App + BottomNav | User profile (coming soon) |

## Page Components

### Home (`/`)
**Path**: `apps/lite/src/pages/Home.tsx`

Markets listing page with:
- Sticky header with logo and connect button
- Trending markets section
- List of MarketCard components
- Loading and error states

### Trade (`/trade/:marketId`)
**Path**: `apps/lite/src/pages/Trade.tsx`

Trading interface with:
- Hero image from market
- Market question title
- YES/NO outcome selection buttons
- Amount input with quick-select chips
- Cost breakdown card
- Buy button (fixed at bottom)

## Navigation Flow

```
Home (/) 
  ├── Click MarketCard → Trade (/trade/:id)
  │     └── Back arrow → Home (/)
  ├── Bottom Nav: Search → /search
  ├── Bottom Nav: Portfolio → /portfolio
  └── Bottom Nav: Profile → /profile
```
