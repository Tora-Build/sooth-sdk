# Components Inventory - Sooth Lite PWA

## Framework
- **Framework**: React 18
- **Build**: Vite
- **CSS**: Tailwind CSS 3.4
- **Icons**: lucide-react
- **Routing**: react-router-dom v7

## Shared UI Components

### BottomNav
**Path**: `apps/lite/src/components/BottomNav.tsx`

Fixed bottom navigation bar with 4 tabs.

```tsx
import { NavLink } from 'react-router-dom';
import { Home, Search, Wallet, User } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Markets' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/portfolio', icon: Wallet, label: 'Portfolio' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-t border-white/5">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                isActive ? 'text-white' : 'text-zinc-500'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
```

### MarketCard
**Path**: `apps/lite/src/components/MarketCard.tsx`

Card component for displaying prediction markets with image, question, and YES/NO buttons.

```tsx
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { Market } from '../hooks/useMarkets';
import { getMarketImage } from '../lib/images';

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const navigate = useNavigate();
  const probability = market.yesProbability ?? 0.5;
  const yesPercent = Math.round(probability * 100);
  const imageUrl = getMarketImage(market.question, market.address);

  const handleClick = () => {
    navigate(`/trade/${market.address}`);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full bg-zinc-900 rounded-2xl overflow-hidden text-left transition-transform active:scale-[0.98] hover:bg-zinc-800/80"
    >
      <div className="relative h-36 overflow-hidden">
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent" />
        
        {market.stage === 'bonding' && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-amber-500/90 rounded text-[10px] font-bold text-black uppercase tracking-wide">
            New
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-white leading-snug line-clamp-2 text-[15px]">
          {market.question}
        </h3>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-emerald-500 font-bold text-lg tabular-nums">{yesPercent}%</span>
              <span className="text-zinc-500 text-sm">Yes</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-zinc-500 text-xs">
            <Users className="w-3.5 h-3.5" />
            <span>--</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/trade/${market.address}`);
            }}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-semibold text-sm transition-colors hover:bg-emerald-500/20"
          >
            Yes {yesPercent}¢
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/trade/${market.address}`);
            }}
            className="flex-1 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-semibold text-sm transition-colors hover:bg-rose-500/20"
          >
            No {100 - yesPercent}¢
          </button>
        </div>
      </div>
    </button>
  );
}
```

### SearchSheet
**Path**: `apps/lite/src/components/SearchSheet.tsx`

Bottom sheet drawer for searching markets (using vaul).
