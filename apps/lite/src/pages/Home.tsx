import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';
import { BarChart3, Settings2, ChevronDown } from 'lucide-react';
import { useMarkets } from '../hooks/useMarkets';
import { useUSDCBalance } from '../hooks';
import { FeedCard } from '../components/FeedCard';

export function Home() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { data: markets, isLoading, error } = useMarkets();
  const { balanceFormatted } = useUSDCBalance(address);

  return (
    <div className="h-screen w-full flex flex-col bg-mesh text-slate-100 overflow-hidden relative">
      <header className="shrink-0 pt-14 px-6 flex items-center justify-between absolute top-0 w-full z-50 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="w-10 h-10 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20">
            <BarChart3 className="w-5 h-5 text-cyan-400 animate-glow-pulse" />
          </div>
          <span className="text-2xl font-bold tracking-tight font-heading text-white">pulse</span>
        </div>
        <button
          onClick={() => open()}
          className="w-10 h-10 flex items-center justify-center rounded-full glass-panel pointer-events-auto active:scale-90 transition-transform"
        >
          <Settings2 className="w-5 h-5 text-white/70" />
        </button>
      </header>

      {isConnected && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="px-5 py-2 glass-panel rounded-full shadow-2xl flex items-center gap-3 border border-white/10">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span className="text-[14px] font-bold text-white tracking-wide">
              ${balanceFormatted || '0.00'}
            </span>
            <ChevronDown className="w-4 h-4 text-white/40" />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto snap-container">
        {isLoading ? (
          <div className="h-screen flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="h-screen flex flex-col items-center justify-center px-6 text-center">
            <p className="text-rose-400 font-bold mb-2">Failed to load markets</p>
            <p className="text-white/40 text-sm">{error.message}</p>
          </div>
        ) : !markets || markets.length === 0 ? (
          <div className="h-screen flex flex-col items-center justify-center px-6 text-center">
            <BarChart3 className="w-16 h-16 text-cyan-400/50 mb-4" />
            <p className="text-white font-bold text-lg mb-2">No markets yet</p>
            <p className="text-white/40 text-sm">Check back soon for prediction markets</p>
          </div>
        ) : (
          markets.map((market) => <FeedCard key={market.address} market={market} />)
        )}
      </main>
    </div>
  );
}
