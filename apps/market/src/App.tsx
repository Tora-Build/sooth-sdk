import React, { useState } from 'react';
import { MarketRegistry } from './components/MarketRegistry';
import { StatsRow } from './components/StatsRow';

import { NodesSection } from './components/NodesSection';
import { TradingModal } from './components/TradingModal';
import { WalletButton } from './components/WalletButton';
import { useLaunchpadMarkets } from './hooks/indexer/useLaunchpadMarkets';
import type { LaunchpadMarket } from './types';



export default function App() {
  const [selectedMarket, setSelectedMarket] = useState<LaunchpadMarket | null>(null);
  const { markets, isLoading } = useLaunchpadMarkets();

  const handleTrade = (market: LaunchpadMarket) => {
    setSelectedMarket(market);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 flex items-center justify-center bg-zinc-900 border border-white/10 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
              <div className="w-3 h-3 bg-amber-500 rounded-sm shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-zinc-50 leading-none font-mono">
                SOOTH<span className="text-zinc-500">.MARKET</span>
              </h1>
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
                Sooth Nodes Aggregator
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col gap-8">
        <StatsRow markets={isLoading ? undefined : markets} />
        <NodesSection />
        <MarketRegistry onTrade={handleTrade} />

      </main>

      {selectedMarket && (
        <TradingModal market={selectedMarket} onClose={() => setSelectedMarket(null)} />
      )}
    </div>
  );
}
