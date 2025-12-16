# Markets Page UI Specification

> Reference document for Markets page terminology, labels, and calculations.
> Part of the V5 Launchpad frontend.

---

## 1. Component Structure

```
Markets (page)
├── Hero Stats Bar
│   ├── Active Markets (count)
│   ├── Bonding (count)
│   ├── Graduated (count)
│   └── 24h Volume (placeholder)
├── TrendingLeaderboard
│   └── TrendingRow[] (top 5 bonding markets)
├── Filter Bar
│   ├── Filter Toggle (All / Bonding / Graduated)
│   └── Create Market Button
└── Market Grid
    └── MarketCard[] (filterable)
```

---

## 2. Hero Stats Bar

| Label | Variable | Source |
|-------|----------|--------|
| **Active Markets** | `markets?.length` | `useLaunchpadMarkets()` |
| **Bonding** | Count where `!isGraduated` | Filtered from markets |
| **Graduated** | Count where `isGraduated` | Filtered from markets |
| **24h Volume** | `--` | Placeholder (not yet implemented) |

---

## 3. TrendingLeaderboard

### Display Logic
- Shows top 5 non-graduated (bonding) markets
- Sorted by creation order (newest first after `.reverse()`)
- Hidden if no bonding markets exist

### TrendingRow Columns

| Element | Source | Notes |
|---------|--------|-------|
| **Rank** | Index + 1 | Gold/Silver/Bronze styling for 1-3 |
| **Name** | `market.name` | Truncated with ellipsis |
| **Symbol** | `market.symbol` | Font-mono |
| **Status** | "Bonding" | Static for trending |
| **Volume** | `--` | Placeholder |

---

## 4. Filter Bar

| Element | Variable | Options |
|---------|----------|---------|
| **Filter Toggle** | `filter` | `'all'`, `'bonding'`, `'graduated'` |
| **Create Market** | Link | Routes to `/create` |

---

## 5. MarketCard

### Props

| Prop | Type | Description |
|------|------|-------------|
| `address` | `0x${string}` | Market contract address |
| `name` | `string` | From OutcomeToken name() |
| `symbol` | `string` | From OutcomeToken symbol() |
| `isGraduated` | `boolean` | Graduation status |
| `deadline` | `number?` | Unix timestamp |

### Sections

#### Header
- Name (clickable → `/market/:address`)
- Symbol badge
- Status badge: 🎓 Graduated / 🔥 Bonding / ⏰ Expired

#### Bonding Progress (if not graduated)
- Progress percentage: `(bBase / graduationThreshold) * 100`
- Progress bar with gradient fill

#### Probability Display
- YES button: `(priceYes * 100).toFixed(1)%`
- NO button: `(priceNo * 100).toFixed(1)%`
- Clicking either opens trading panel

#### Trading Panel (expandable)
- Buy/Sell toggle
- YES/NO toggle
- Amount input with +/- buttons
- Quick amount buttons: 10, 50, 100, 500
- Quote summary: Cost/Share, Est. Total, Fee, Max Total
- Slippage selector: 0.1%, 0.5%, 1%, 2%
- Execute button

#### Footer Stats
- Liquidity: `$${bBase / 1e18}`
- Deadline (if not graduated)
- Trade/Collapse toggle

---

## 6. Data Integration

### useLaunchpadMarkets Hook

```typescript
interface LaunchpadMarketData {
  address: `0x${string}`;
  name: string;
  symbol: string;
  bValue: bigint;
  creator: `0x${string}`;
  isGraduated?: boolean;
  deadline?: number;
  liquidityB?: bigint;
}
```

### useLaunchpadTradeQuote Hook

```typescript
interface Quote {
  inputAmount: number;
  expectedCost: number;
  totalCost: number;
  fee: number;
  maxWithSlippage: number;
  newPriceYes: number;
  newPriceNo: number;
}
```

---

## 7. Files

| File | Purpose |
|------|---------|
| `pages/Markets.tsx` | Main markets list page |
| `components/features/market/MarketCard.tsx` | Individual market with inline trading |
| `components/features/market/TrendingLeaderboard.tsx` | Top bonding markets display |
| `hooks/v5/useLaunchpadMarkets.ts` | Fetch all markets from factory |
| `hooks/v5/useLaunchpadTradeQuote.ts` | Calculate trade quotes |

---

*Last updated: 2025-12-15*
