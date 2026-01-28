# UI/UX Patterns & Lessons Learned

This file records UI/UX decisions, patterns, and mistakes to avoid.
AI agents should consult this before making frontend changes.

---

## Color Semantics

### ✅ Prediction Market Colors
| Meaning | Color | Tailwind Class |
|---------|-------|----------------|
| YES / Bullish / Long | Green | `text-emerald-400`, `bg-emerald-500` |
| NO / Bearish / Short | Red/Rose | `text-rose-400`, `bg-rose-500` |
| Neutral / Loading | Slate/Gray | `text-slate-400` |
| Warning / Bonding | Amber/Yellow | `text-amber-400` |
| Success / Graduated | Emerald | `text-emerald-400` |
| Pro / TickBook accent | Amber | `text-amber-400` |
| AMM accent | Cyan | `text-cyan-400` |

### ❌ Pattern: Bar Length vs Color Confusion
- **Date:** 2025-12-29
- **Issue:** Probability bar showing YES (green) 9.5% and NO (red) 90.5%. The red bar is longer (correct), but users may expect "green = good = more".
- **Rule:** In prediction markets, color indicates *side* not *magnitude*. The bar length shows probability, color shows which outcome.
- **Clarification:** A long red bar means "NO is likely" not "something is wrong".

---

## Progress Indicators

### Graduation Progress Bar
- **Pre-graduation (bonding):** Blue-to-purple gradient with shimmer animation
- **Graduated:** Solid emerald gradient
- Shows liquidity progress toward threshold

### Transaction States
| State | Visual |
|-------|--------|
| Pending wallet | Button disabled + spinner |
| Submitted | Loading toast with spinner |
| Confirming | "Confirming..." toast |
| Success | Success toast + auto-refetch |
| Failed | Error toast with reason |

---

## Layout Patterns

### Two-Venue Header (AMM / Pro)
- Unified `MarketHeader` component with:
  - Title with expandable hint tooltip
  - Search bar
  - Category filters with counts
  - Market count badge

### Market Chips (Horizontal Scroll)
- Both AMM and Pro use scrollable market chips
- Flexbox with scroll arrows (not absolute positioning)
- Selected state: accent border + shadow
- AMM: Cyan accent
- Pro: Amber accent

### Trading Terminal Grid
```
Desktop (lg:grid-cols-12):
┌─────────────────────────────┬───────────────────────┐
│ Market Info + Trading Panel │ Graduation Progress   │
│ (col-span-7)                │ LP Holders            │
│                             │ Market Stats          │
│                             │ (col-span-5)          │
└─────────────────────────────┴───────────────────────┘

Mobile: Stack vertically
```

---

## Typography

### Font Sizes by Context
| Context | Size | Class |
|---------|------|-------|
| Page title | xl-2xl | `text-xl` or `text-2xl` |
| Card header | sm-base | `text-sm font-bold` |
| Primary price | xl | `text-xl font-mono font-bold` |
| Secondary price | base | `text-base font-mono` |
| Labels | xs-[10px] | `text-xs` or `text-[10px]` |
| Micro labels | [9px] | `text-[9px] uppercase` |

### Monospace for Numbers
Always use `font-mono` for:
- Prices / probabilities
- Share amounts
- Balances
- Percentages

---

## Interactive States

### Buttons
- **Primary action:** Gradient background (cyan for AMM, amber for Pro)
- **Secondary:** `bg-slate-800 hover:bg-slate-700`
- **Disabled:** `opacity-50 cursor-not-allowed`
- **Loading:** Spinner icon + disabled state

### Inputs
- Dark background: `bg-slate-950`
- Border: `border-slate-700 focus:border-cyan-500`
- Error state: `border-rose-500`

---

## Toast Notifications

### Pattern: Transaction Toasts
```typescript
// 1. Show loading on submission
const toastId = toast.loading('Confirming...');

// 2. Update on success
toast.success('Done!', { id: toastId });

// 3. Or update on error
toast.error('Failed', { id: toastId });
```

### Toast Icons
- Trade: 🔄
- Lock: 🔒
- Claim: 💰
- Error: ❌ (default)
- Success: ✓ (default)

---

## Common Mistakes

### ❌ Showing success before confirmation
- **Wrong:** `onSuccess` callback from `writeContract` = tx submitted, not confirmed
- **Right:** Wait for `useWaitForTransactionReceipt` → `isSuccess`

### ❌ Stale transaction receipt state
- **Date:** 2025-12-29
- **Issue:** `useWaitForTransactionReceipt` returns `isSuccess: true` from previous transaction, causing toast to dismiss immediately
- **Symptom:** "Confirming buy YES..." toast disappears before tx even submitted
- **Fix:** Track the specific `pendingTxHash` in component state, only pass it to `useWaitForTransactionReceipt` when there's an active pending transaction
- **Pattern:**
  ```typescript
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | null>(null);
  const { isSuccess } = useWaitForTransactionReceipt({ hash: pendingTxHash ?? undefined });
  // In onSuccess: setPendingTxHash(hash);
  // In success effect: setPendingTxHash(null);
  ```

### ❌ Stale quote data
- **Issue:** User has page open, price moves, trade fails with slippage
- **Fix:** Fetch fresh quote before executing trade, check for >5% deviation

### ❌ Absolute positioning for scroll buttons
- **Issue:** Overlaps with content on different screen sizes
- **Fix:** Use flexbox with `flex-shrink-0` buttons

### ❌ Not refetching after transactions
- **Issue:** UI shows old data after trade
- **Fix:** Refetch position, AMM, launchpad data on `isTradeSuccess`

### ❌ Wrong metric for graduation progress
- **Date:** 2025-12-29
- **Issue:** GraduationProgress component used `bBase` (initial liquidity) for progress bar, but graduation is based on **fees accrued**
- **Symptom:** Progress showed 50% with $1,000 bBase / $2,000 threshold, but fees were $1,222 (should show 61%)
- **Fix:** Use `feesAccrued` and `graduationThreshold` for progress calculation
- **Rule:** Always verify which metric drives the smart contract logic, not what sounds intuitive

### ❌ Wrong decimal precision for contract values
- **Date:** 2025-12-29
- **Issue:** `getGraduationProgress` returns values in **WAD (18 decimals)**, but component used `formatUnits(x, 6)` assuming USDC
- **Symptom:** Showed "$1,288,668,621,998,348 earned" instead of "$1,288.67"
- **Fix:** Use `formatUnits(x, 18)` for WAD values
- **Rule:** Always verify decimal precision from contract ABI/docs. Common values:
  - USDC: 6 decimals
  - WAD (internal math): 18 decimals
  - BPS (basis points): divide by 100 for percentage

---

## Accessibility Notes

- All interactive elements need visible focus states
- Color should not be the only indicator (use icons/text too)
- Loading states should be announced to screen readers
- Contrast ratios: text on dark bg should be at least 4.5:1

---

*Last updated: 2025-12-29*

