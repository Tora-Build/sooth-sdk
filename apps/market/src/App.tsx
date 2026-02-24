import React, { useState } from 'react';
import { MarketRegistry } from './components/MarketRegistry';
import { StatsRow } from './components/StatsRow';
import { EcosystemCards } from './components/EcosystemCards';
import { TradingModal } from './components/TradingModal';
import { WalletButton } from './components/WalletButton';
import { useLaunchpadMarkets } from './hooks/indexer/useLaunchpadMarkets';
import type { LaunchpadMarket } from './types';

function ChainDot({ name, color, delay = '0s' }: { name: string; color: string; delay?: string }) {
  const colors: Record<string, { outer: string; inner: string }> = {
    blue: { outer: 'bg-blue-400', inner: 'bg-blue-500' },
    purple: { outer: 'bg-purple-400', inner: 'bg-purple-500' },
    amber: { outer: 'bg-amber-400', inner: 'bg-amber-500' },
  };
  const c = colors[color] ?? colors.amber;
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.outer} opacity-75`} style={{ animationDelay: delay }} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${c.inner}`} />
      </span>
      {name}
    </div>
  );
}

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
                Cross-Chain Registry Terminal
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <ChainDot name="Base Sepolia" color="blue" delay="0s" />
            <ChainDot name="Monad Testnet" color="purple" delay="0.5s" />
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col gap-8">
        <StatsRow markets={isLoading ? undefined : markets} />
        <MarketRegistry onTrade={handleTrade} />
        <EcosystemCards />
      </main>

      {selectedMarket && (
        <TradingModal market={selectedMarket} onClose={() => setSelectedMarket(null)} />
      )}
    </div>
  );
}
