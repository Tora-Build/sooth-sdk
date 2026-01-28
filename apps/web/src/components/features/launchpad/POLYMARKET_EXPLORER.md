# PolymarketExplorer Component

Browse and import prediction markets from Polymarket's Gamma API.

## Overview

The PolymarketExplorer component provides a searchable, filterable interface for browsing Polymarket events. Users can explore markets across multiple categories, view detailed statistics, and optionally import market data into the Sooth Launchpad form.

## Features

- **Multi-category browsing**: Politics, Sports, Crypto, World, Pop Culture, Economy
- **Search**: Filter events by question text
- **Sorting**: 24h Volume, Total Volume, Liquidity, Markets count, End Date
- **Collapsible market breakdown**: View per-market probabilities, volume, and liquidity
- **Two display modes**: Full page layout with side panel, or compact drawer mode
- **Market import**: One-click import to Launchpad with smart defaults

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ PolymarketExplorer                                          │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│ │ Event List (left)       │ │ MarketDetailsPanel (right)  │ │
│ │ ┌─────────────────────┐ │ │ ┌─────────────────────────┐ │ │
│ │ │ Search + Sort       │ │ │ │ Event Image + Time      │ │ │
│ │ ├─────────────────────┤ │ │ ├─────────────────────────┤ │ │
│ │ │ Category Filters    │ │ │ │ Title + Tags            │ │ │
│ │ ├─────────────────────┤ │ │ ├─────────────────────────┤ │ │
│ │ │ MarketCard          │ │ │ │ Stats Grid (Vol/Liq)    │ │ │
│ │ │ MarketCard          │ │ │ ├─────────────────────────┤ │ │
│ │ │ MarketCard          │ │ │ │ Markets (collapsible)   │ │ │
│ │ │ ...                 │ │ │ ├─────────────────────────┤ │ │
│ │ └─────────────────────┘ │ │ │ Resolution Rules        │ │ │
│ └─────────────────────────┘ │ └─────────────────────────┘ │ │
└─────────────────────────────────────────────────────────────┘
```

## API Integration

### Endpoint
```
/api/polymarket/events
```

Proxied through Vite dev server to `https://gamma-api.polymarket.com/events`.

### Vite Proxy Config
```typescript
// apps/web/vite.config.ts
proxy: {
  '/api/polymarket': {
    target: 'https://gamma-api.polymarket.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/polymarket/, ''),
    secure: true,
  },
}
```

### Query Parameters
```typescript
const url = `/api/polymarket/events?tag_id=${categoryId}&active=true&closed=false&order=volume24hr&ascending=false&limit=${limit}`;
```

## Data Model

### Polymarket API Hierarchy

```
Event (top-level entity)
├── id, title, slug
├── endDate, liquidity, volume, volume24hr
├── image, tags[]
└── markets[] (binary outcomes within event)
    ├── id, question, description
    ├── outcomePrices: ["0.65", "0.35"]  // [YES, NO] as strings
    ├── outcomes: ["Yes", "No"]
    ├── volume, volumeNum, volume24hr
    └── liquidity, liquidityNum
```

### Normalized Market (internal)

```typescript
interface NormalizedMarket {
  id: string;
  question: string;
  yesPrice: number;      // 0-100 (first market's YES probability)
  noPrice: number;       // 0-100 (first market's NO probability)
  volume: number;        // Total event volume in USD
  volume24h: number;     // 24h event volume in USD
  liquidity: number;     // Total event liquidity in USD
  endDate: string;       // ISO date string
  endDateTs: number;     // Timestamp for sorting
  status: 'active' | 'closed' | 'pending';
  url: string;           // Direct Polymarket link
  category: CategoryKey;
  categoryLabel: string;
  description: string | null;  // Resolution rules from first market
  rawData: PolymarketEvent;    // Original API response
}
```

### Event vs Market Distinction

| Term | API Entity | UI Display |
|------|-----------|------------|
| Event | Top-level | Card in list, side panel |
| Market | Nested in event | Collapsible breakdown section |

**Example:**
- Event: "Nevada Senate Election 2024"
- Markets: "Democrat wins" (45%), "Republican wins" (52%), "Third party wins" (3%)

## Component Props

```typescript
interface PolymarketExplorerProps {
  /** Called when user clicks "Use" button. Omit to hide Use buttons. */
  onSelectMarket?: (data: PolymarketSelectData) => void;

  /** Compact mode for drawer view (no side panel) */
  compact?: boolean;
}

interface PolymarketSelectData {
  question: string;
  category: string;           // Mapped to Sooth category
  expiration: string | null;  // ISO datetime-local format
  daysUntilExpiration: number | null;
  liquidity: number;
  volume24h: number;
  yesPrice: number;           // 0-100
  polymarketUrl: string;
  description: string | null; // Resolution rules
}
```

## Categories

```typescript
const CATEGORIES = {
  politics:   { id: '2',      label: 'Politics',    color: 'blue' },
  sports:     { id: '1',      label: 'Sports',      color: 'emerald' },
  crypto:     { id: '21',     label: 'Crypto',      color: 'orange' },
  world:      { id: '101970', label: 'World',       color: 'violet' },
  popCulture: { id: '596',    label: 'Pop Culture', color: 'pink' },
  economy:    { id: '100328', label: 'Economy',     color: 'amber' },
};

// Mapping to Sooth categories
const CATEGORY_TO_SOOTH = {
  politics: 'politics',
  sports: 'sports',
  crypto: 'crypto',
  world: 'custom',
  popCulture: 'custom',
  economy: 'custom',
};
```

## Sort Options

| Field | Label | Default Direction | Description |
|-------|-------|-------------------|-------------|
| volume24h | 24h Volume | desc | Recent trading activity |
| volume | Total Volume | desc | All-time trading volume |
| liquidity | Liquidity | desc | Current market depth |
| marketsCount | Markets | desc | Number of outcomes |
| endDate | End Date | asc | Time until resolution |

## Display Format

### Event List (MarketCard)

```
┌─────────────────────────────────────────────────────────────┐
│ [Politics] Will Trump win the 2024 election?                │
│                                                             │
│ 24h: $4.39M  Vol: $52.8M  Liq: $52.8K  3d  [2 mkts]  ↗     │
└─────────────────────────────────────────────────────────────┘
```

### Market Breakdown (expanded)

```
┌─────────────────────────────────────────────────────────────┐
│ [1] Market                                            ▼     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ "Trump wins"                                            │ │
│ │ [████████████░░░░░░░░] 65%                              │ │
│ │ Vol: $4.2M  Liq: $52K                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ "Biden wins"                                            │ │
│ │ [███████░░░░░░░░░░░░░] 35%                              │ │
│ │ Vol: $3.1M  Liq: $48K                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Full Page Mode

```tsx
// pages/ExploreExternalMarkets.tsx
import { PolymarketExplorer } from '../components/features/launchpad/PolymarketExplorer';

export const ExploreExternalMarkets = () => {
  return <PolymarketExplorer />;
};
```

### Drawer Mode with Import

```tsx
// pages/Launchpad.tsx
import { PolymarketExplorer, PolymarketSelectData } from '../components/features/launchpad/PolymarketExplorer';

const handlePolymarketSelect = (data: PolymarketSelectData) => {
  // Smart expiration mode derivation
  let expirationMode = 'open';
  if (data.daysUntilExpiration !== null) {
    if (data.daysUntilExpiration >= 6 && data.daysUntilExpiration <= 8) {
      expirationMode = '7d';
    } else if (data.daysUntilExpiration >= 28 && data.daysUntilExpiration <= 32) {
      expirationMode = '30d';
    } else if (data.expiration) {
      expirationMode = 'custom';
    }
  }

  // Smart liquidity: 0.1% of Polymarket, clamped $100-$5000
  const suggestedLiquidity = Math.max(100, Math.min(5000,
    Math.round(data.liquidity * 0.001)
  ));

  setForm({
    question: data.question,
    category: data.category,
    expirationMode,
    initialLiquidity: suggestedLiquidity.toString()
  });
};

<Drawer isOpen={showPolymarket} onClose={() => setShowPolymarket(false)}>
  <PolymarketExplorer
    onSelectMarket={handlePolymarketSelect}
    compact
  />
</Drawer>
```

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/explore-markets` | ExploreExternalMarkets | Full page Polymarket browser |
| `/create` | Launchpad | Includes drawer with compact mode |

## State Management

```typescript
// Main state
const [allMarkets, setAllMarkets] = useState<NormalizedMarket[]>([]);
const [selectedMarket, setSelectedMarket] = useState<NormalizedMarket | null>(null);
const [marketsExpanded, setMarketsExpanded] = useState(false);

// Filters
const [searchTerm, setSearchTerm] = useState('');
const [selectedCategories, setSelectedCategories] = useState<Set<CategoryKey>>(
  new Set(Object.keys(CATEGORIES))
);

// Sort
const [sortField, setSortField] = useState<SortField>('volume24h');
const [sortDir, setSortDir] = useState<SortDirection>('desc');
```

## Helper Functions

### formatVolume
```typescript
function formatVolume(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}
```

### formatDate
```typescript
function formatDate(dateStr: string): string {
  // Returns: "Today", "Tomorrow", "3d", "2w", "Jan 15"
}
```

### formatTimeRemaining
```typescript
function formatTimeRemaining(endDateTs: number): { text: string; urgent: boolean } {
  // Returns: { text: "3d 5h", urgent: false }
  // urgent: true when <= 3 days or <= 24 hours
}
```

### getActivityLevel
```typescript
function getActivityLevel(volume24h: number, liquidity: number): { label: string; color: string } {
  const ratio = volume24h / liquidity;
  if (ratio > 0.5) return { label: 'Very High', color: 'text-emerald-400' };
  if (ratio > 0.2) return { label: 'High', color: 'text-cyan-400' };
  if (ratio > 0.05) return { label: 'Moderate', color: 'text-amber-400' };
  return { label: 'Low', color: 'text-slate-400' };
}
```

## Design Decisions

### Why hide probability for multi-market events?
Multi-market events (e.g., elections with 3+ candidates) don't have a single YES/NO probability. Showing the first market's probability would be misleading. Instead, users expand the collapsible section to see each market's probability.

### Why collapsible for all events?
Consistency. Even single-market events use the collapsible pattern, showing the market's question, probability bar, volume, and liquidity when expanded.

### Why label format "24h: $X Vol: $X Liq: $X"?
Explicit labels prevent confusion between different volume metrics. Users can quickly distinguish 24h activity from total lifetime volume.

## Dependencies

- `lucide-react`: Icons (Search, RefreshCw, ExternalLink, Clock, Filter, etc.)
- `react-hot-toast`: Toast notifications for import feedback
- `../../../lib/utils`: `cn()` utility for className merging

## Files

```
apps/web/src/
├── components/features/launchpad/
│   ├── PolymarketExplorer.tsx     # Main component
│   └── POLYMARKET_EXPLORER.md     # This documentation
├── pages/
│   ├── ExploreExternalMarkets.tsx # Full page route
│   └── Launchpad.tsx              # Drawer integration
└── vite.config.ts                 # API proxy config
```

---

*Last updated: 2026-01-10*
