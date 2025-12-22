# Activity Log UI Specification

> Reference document for Activity Log terminology, labels, and data structure.
> Aligned with `.agent/KNOWLEDGE.md` as the canonical source of truth.
> **V7 integration note**: Activity should reflect both dual-engine trading (AMM + OB) and staged V7 lifecycle/settlement actions.

---

## 1. Component Structure

```
ActivityLog
├── Header
│   ├── Title
│   └── Filter Buttons
└── Activity List
    └── ActivityItem (per entry)
```

---

## 2. Header

| Element | Translation Key | Text |
|---------|----------------|------|
| **Icon** | - | Activity icon (Lucide) |
| **Title** | `activity.title` | "Activity Log" |

### Filter Buttons

| Filter | Translation Key | Types Included |
|--------|----------------|----------------|
| **All** | `activity.filterAll` | All types |
| **Trade** | `activity.filterTrade` | `type === 'trade'` |
| **LP** | `activity.filterLP` | `type === 'liquidity'` |
| **Resolve** | `activity.filterSettle` | `type === 'settle' \|\| type === 'dispute'` |
| **System** | `activity.filterSystem` | `type === 'lock' \|\| type === 'settlement_root' \|\| type === 'admin'` |

---

## 3. Activity Item

### Indicator Colors

| Type | Color |
|------|-------|
| `trade` | Emerald (green) |
| `orderbook` | Teal (cyan) |
| `settle` | Indigo (blue) |
| `dispute` | Rose (red) |
| `liquidity` | Amber (yellow) |
| `lock` | Orange (amber/rose blend) |
| `settlement_root` | Violet (purple) |
| `admin` | Slate (gray) |

### Display Elements

| Element | Data Source |
|---------|-------------|
| **Description** | `item.description` |
| **Time** | `item.time` (formatted) |
| **Market** | `item.market` |
| **View TX Link** | `${explorerUrl}/tx/${item.hash}` |

---

## 4. Data Structure (ActivityItem)

```typescript
interface ActivityItem {
  id: string;           // Unique identifier
  // NOTE: "settle" here corresponds to market resolution (Settled event / finalizeResolution()).
  type: 'trade' | 'orderbook' | 'liquidity' | 'lock' | 'settle' | 'dispute' | 'settlement_root' | 'admin';
  description: string;  // Human-readable description
  market: string;       // Market name
  marketAddress?: `0x${string}`; // Optional (real mode)
  time: string;         // Formatted time
  timestamp: number;    // Unix timestamp
  hash?: string;        // Transaction hash (optional)
  mode: 'demo' | 'real';
  chainId?: number;     // For real mode
  metadata?: Record<string, unknown>; // Optional structured details for drilldowns
}
```

---

## 5. Filtering Logic

```typescript
// Filter by mode and chain
const allActivities = activities.filter(item => 
  item.mode === mode && 
  (item.mode === 'demo' || item.chainId === undefined || item.chainId === selectedChainId)
);

// Filter by type
const displayActivities = allActivities.filter(item => {
  if (filter === 'all') return true;
  if (filter === 'settle') return item.type === 'settle' || item.type === 'dispute';
  return item.type === filter;
});
```

---

## 6. Empty States

| Condition | Translation Key | Text |
|-----------|----------------|------|
| No activities at all | `activity.noActivity` | "No activity yet" |
| No activities with filter | `activity.noActivityFilter` | "No matching activity" |

---

## 7. Data Sources

| Data | Source |
|------|--------|
| Activities | `useActivityStore()` |
| Current Mode | `useMarketStore().mode` |
| Selected Chain | `useChainStore().selectedChainId` |
| Chain Config | `getChainById(selectedChainId)` |
| Explorer URL | `chain.explorerUrl` |

---

## 8. Adding Activities

Activities are added via `useActivityStore.getState().addActivity()`:

```typescript
// Trade activity
addActivity({
  type: 'trade',
  market: 'BTC 7-day TWAP >= $100k',
  description: 'Bought 10 YES shares at $0.52',
  mode: 'real',
  hash: '0x123...',
  chainId: 84532,
  timestamp: Date.now()
});

// Orderbook activity
addActivity({
  type: 'orderbook',
  market: 'BTC 7-day TWAP >= $100k',
  description: 'Placed limit bid: 100 YES @ $0.48',
  mode: 'real',
  hash: '0xabc...',
  chainId: 84532,
  timestamp: Date.now()
});

// Liquidity activity
addActivity({
  type: 'liquidity',
  market: 'USDC Vault',
  description: 'Deposited 1000 USDC',
  mode: 'real',
  hash: '0x456...',
  chainId: 84532,
  timestamp: Date.now()
});

// Locking activity (V7 lock-on-sell)
addActivity({
  type: 'lock',
  market: 'BTC 7-day TWAP >= $100k',
  description: 'Sell proceeds locked: $23.19 (unlocks in 24h)',
  mode: 'real',
  hash: '0xdef...',
  chainId: 84532,
  timestamp: Date.now()
});

// Settlement activity
addActivity({
  type: 'settle',
  market: 'UN Confirms Alien Life',
  description: 'Market resolved: YES wins',
  mode: 'real',
  hash: '0x789...',
  chainId: 84532,
  timestamp: Date.now()
});

// Settlement root activity (V7 Stage 2/3)
addActivity({
  type: 'settlement_root',
  market: 'UN Confirms Alien Life',
  description: 'Settlement root published (batch 0x…); claim available',
  mode: 'real',
  hash: '0x999...',
  chainId: 84532,
  timestamp: Date.now()
});
```

---

## 9. V7 Event → Activity Mapping (Recommended)

> This is a mapping for `ActivityListener.tsx` / indexers. Not all events may be wired in UI yet.

- **AMM trades**
  - `LaunchpadMarket.TradeAMM` → `type: 'trade'`
- **Orderbook**
  - `OrderCreated` → `type: 'orderbook'` (“Placed bid/ask…”)
  - `OrderMatched` → `type: 'orderbook'` (“Filled …”)
  - `OrderCancelled` → `type: 'orderbook'` (“Cancelled order …”)
- **Proceeds locking**
  - `LaunchpadMarket.Locked` → `type: 'lock'`
  - `LaunchpadMarket.Claimed` / `TraderVault.Unlocked` → `type: 'lock'`
  - `LaunchpadMarket.claimLockedOnMarketEnd` (via `Claimed` event) → `type: 'lock'` (“Claimed locked proceeds (market ended)”)
- **Lifecycle**
  - `MarketGraduated` → `type: 'admin'` (or `liquidity` if you prefer)
  - `MarketExpired` / `MarketLiquidated` → `type: 'admin'`
  - `LpTokensRedeemed` → `type: 'liquidity'`
- **Settlement**
  - `SoothManualAdjudicator.Resolved` / `SoothOptimisticAdjudicator.Finalized` → `type: 'settle'`
  - `SoothOptimisticAdjudicator.Disputed` → `type: 'dispute'`
- **Settlement roots**
  - `SoothSettlementRootSink.RootSubmitted` → `type: 'settlement_root'`
  - `TraderVault.SettlementClaimed` → `type: 'settlement_root'`

---

## 10. Files

| File | Purpose |
|------|---------|
| `ActivityLog.tsx` | Main display component |
| `ActivityListener.tsx` | Event listener for auto-adding |
| `store/useActivityStore.ts` | Zustand store for activities |

---

## 11. Translation Keys

| Key | English Text |
|-----|--------------|
| `activity.title` | "Activity Log" |
| `activity.filterAll` | "All" |
| `activity.filterTrade` | "Trade" |
| `activity.filterLP` | "LP" |
| `activity.filterSettle` | "Settle" |
| `activity.filterSystem` | "System" |
| `activity.noActivity` | "No activity yet" |
| `activity.noActivityFilter` | "No matching activity" |
| `activity.viewTx` | "View TX" |

---

*Last updated: 2025-12-22 (V7 activity taxonomy + settlement roots)*
