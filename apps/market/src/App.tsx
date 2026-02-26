import React, { useState } from 'react';
import { MarketRegistry } from './components/MarketRegistry';
import { StatsRow } from './components/StatsRow';
import { Navbar } from './components/Navbar';
import { TradingModal } from './components/TradingModal';
import { useLaunchpadMarkets } from './hooks/indexer/useLaunchpadMarkets';
import type { LaunchpadMarket } from './types';

export default function App() {
  const [selectedMarket, setSelectedMarket] = useState<LaunchpadMarket | null>(null);
  const { markets, isLoading } = useLaunchpadMarkets();

  const handleTrade = (market: LaunchpadMarket) => {
    setSelectedMarket(market);
  };

  return (
    <div className="relative z-10 min-h-screen text-zinc-100 font-sans">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col gap-12">
        <StatsRow markets={isLoading ? undefined : markets} />
        <MarketRegistry onTrade={handleTrade} />
      </main>

      {selectedMarket && (
        <TradingModal market={selectedMarket} onClose={() => setSelectedMarket(null)} />
      )}
    </div>
  );
}
