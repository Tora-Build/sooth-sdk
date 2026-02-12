# Layouts - Sooth Lite PWA

## App Shell
**Path**: `apps/lite/src/App.tsx`

Root layout with routing and conditional bottom navigation.

```tsx
import { Routes, Route, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { Trade } from './pages/Trade';
import { BottomNav } from './components/BottomNav';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center bg-black pb-16">
      <p className="text-zinc-500">{title} - Coming Soon</p>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const showNav = !location.pathname.startsWith('/trade/');

  return (
    <div className="h-full w-full bg-black">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trade/:marketId" element={<Trade />} />
        <Route path="/search" element={<Placeholder title="Search" />} />
        <Route path="/portfolio" element={<Placeholder title="Portfolio" />} />
        <Route path="/profile" element={<Placeholder title="Profile" />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  );
}
```

## Layout Patterns

### Header Pattern
Sticky header with blur backdrop, safe area padding for mobile notch.

```tsx
<header className="sticky top-0 z-30 bg-black/90 backdrop-blur-xl border-b border-white/5">
  <div className="flex items-center justify-between px-4 pt-14 pb-4">
    {/* Logo + title left, button right */}
  </div>
</header>
```

### Bottom Nav Pattern
Fixed at bottom with glass effect, hidden on detail pages.

```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-t border-white/5">
  <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
    {/* Nav items */}
  </div>
</nav>
```

### Detail Page Pattern (Trade)
Hero image at top with gradient overlay, content slides up over it.

```tsx
<div className="h-full w-full flex flex-col bg-black">
  {/* Hero image with gradient */}
  <div className="relative h-48 overflow-hidden">
    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black" />
    {/* Back button overlay */}
  </div>
  
  {/* Content that slides over hero */}
  <div className="flex-1 overflow-y-auto -mt-8 relative z-10">
    <div className="bg-black rounded-t-3xl min-h-full">
      <div className="p-5 space-y-5">
        {/* Content */}
      </div>
    </div>
  </div>
  
  {/* Fixed bottom CTA */}
  <div className="p-4 pb-8 bg-black border-t border-zinc-900">
    <button className="w-full py-4 rounded-2xl ...">
      Buy
    </button>
  </div>
</div>
```
