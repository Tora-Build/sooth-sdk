import React from 'react';
import { MarketRegistry } from './components/MarketRegistry';
import { LaunchpadMarket } from './types';

export default function App() {
  const handleTrade = (market: LaunchpadMarket) => {
    console.log('Trade clicked for market:', market.address);
    // TODO: T11 trading modal
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-300 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-500 font-heading">
            sooth.market
          </h1>
          <p className="text-lg md:text-xl text-slate-400">
            Pro trading registry
          </p>
        </header>
        
        <main className="w-full">
          <MarketRegistry onTrade={handleTrade} />
        </main>
      </div>
    </div>
  );
}
