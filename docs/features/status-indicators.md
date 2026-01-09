# Status Indicators Feature

**Version**: V10.7  
**Date**: 2026-01-09  
**Status**: ✅ Implemented

---

## Overview

Added real-time status indicators to the footer showing RPC and Indexer health with interactive help tooltip.

---

## Visual Design

### Footer Layout

```
🔵 RPC | 🟢 Block 12,345,678 (synced) [?]
```

**Components:**
- 🔵 **RPC Dot** - Blue when connected, gray when disconnected
- 🟢 **Indexer Dot** - Green (synced) / Yellow (lagging) / Red (offline)
- **Block Number** - Current indexed block with sync lag indicator
- **[?] Help Icon** - Hover to show detailed explanation

---

## Help Tooltip Content

When hovering over the `?` icon:

```
┌─────────────────────────────────────────┐
│ Status Indicators                       │
├─────────────────────────────────────────┤
│                                         │
│ 🟢 Indexer (Green)     CRITICAL         │
│    Historical data for orderbook,       │
│    trades, and market history.          │
│    Without: No orderbook visible        │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ 🔵 RPC (Blue)          IMPORTANT        │
│    Direct blockchain connection for     │
│    live balances and current state.     │
│    Without: Stale wallet data           │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ Colors: 🟢 Synced | 🟡 Lagging | 🔴 Offline │
│                                         │
└─────────────────────────────────────────┘
```

---

## Indicator Priority

| Indicator | Importance | What Breaks Without It |
|-----------|------------|------------------------|
| **🟢 Indexer** | **CRITICAL** | No orderbook, no trade history, no market data |
| 🔵 RPC | Important | No live balances, no current block info |

**Key Insight**: Indexer is more critical than RPC because without it, the app cannot display any orderbook data.

---

## Status Colors

### Indexer
- 🟢 **Green (pulsing)** - Synced (within 10 blocks)
- 🟡 **Yellow** - Lagging (more than 10 blocks behind)
- 🔴 **Red** - Offline (indexer not responding)

### RPC
- 🔵 **Blue** - Connected
- ⚪ **Gray** - Disconnected

---

## Implementation Details

### Files Modified
- `apps/web/src/components/layout/Footer.tsx` - Added help tooltip
- `apps/web/src/hooks/useChainStatus.ts` - RPC status hook
- `apps/web/src/hooks/useIndexerStatus.ts` - Indexer status hook (existing)

### New State
```tsx
const [showStatusHelp, setShowStatusHelp] = useState(false);
```

### Help Button
```tsx
<button
  className="w-4 h-4 rounded-full bg-slate-800..."
  onMouseEnter={() => setShowStatusHelp(true)}
  onMouseLeave={() => setShowStatusHelp(false)}
>
  ?
</button>
```

### Tooltip Positioning
```tsx
<div className="absolute bottom-full right-0 mb-2 w-80 bg-slate-900...">
  {/* Tooltip content */}
</div>
```

---

## User Benefits

1. **Transparency** - Users see exactly what's working and what's not
2. **Debugging** - Clear indication when indexer is lagging or offline
3. **Education** - Help tooltip explains what each indicator means
4. **Confidence** - Green indicators confirm everything is working

---

## Technical Behavior

### Sync Lag Calculation
```tsx
const syncLag = rpcBlock && currentChainStatus 
  ? rpcBlock - currentChainStatus.block.number 
  : null;

const isSynced = syncLag !== null && syncLag < 10;
```

### Status Logic
```tsx
// Indexer color
{
  error ? 'bg-red-500' 
  : isSynced ? 'bg-green-500 animate-pulse'
  : currentChainStatus ? 'bg-yellow-500'
  : 'bg-gray-500'
}

// Block display
{
  error ? 'Indexer offline'
  : isSynced ? `Block ${blockNumber}`
  : syncLag > 0 ? `Block ${blockNumber} (-${syncLag})`
  : `Block ${blockNumber}`
}
```

---

## Example States

### Perfect State
```
🔵 RPC | 🟢 Block 12,345,678
```
Everything working perfectly!

### Lagging State
```
🔵 RPC | 🟡 Block 12,345,000 (-678)
```
Indexer is 678 blocks behind

### Critical State
```
🔵 RPC | 🔴 Indexer offline
```
Indexer is down - orderbook won't load

### Disconnected State
```
⚪ RPC | 🔴 Indexer offline
```
Both systems down - app won't work

---

## Testing

### Manual Test Steps
1. Start frontend: `npm run dev`
2. Open http://localhost:5173
3. Check footer - should show both indicators
4. Hover over `?` icon - tooltip should appear
5. Check colors match current status
6. Stop indexer - dot should turn red
7. Restart indexer - dot should turn green

### Automated Tests
Not yet implemented - consider adding:
- Unit tests for status logic
- E2E tests for tooltip interaction
- Visual regression tests for indicator states

---

## Future Enhancements

1. **Click to expand** - Click `?` for sticky tooltip instead of hover-only
2. **Status history** - Show recent connectivity issues
3. **Network switcher** - Select which chain's status to display
4. **Performance metrics** - Show indexer sync speed, latency
5. **Alert system** - Notify users when status changes
6. **Mobile optimization** - Tooltip positioning for small screens

---

## Related Documentation

- `docs/reviews/v10.7-frontend-validation.md` - Initial UI review
- `apps/web/src/hooks/useChainStatus.ts` - RPC status implementation
- `apps/web/src/hooks/useIndexerStatus.ts` - Indexer status implementation
- `packages/indexer/README.md` - Indexer API documentation

---

## Changelog

**V10.7** (2026-01-09):
- ✅ Added RPC and Indexer status indicators
- ✅ Added interactive help tooltip
- ✅ Added sync lag display
- ✅ Added color-coded status (green/yellow/red)

---

**Built with ❤️ for transparency and user confidence**
