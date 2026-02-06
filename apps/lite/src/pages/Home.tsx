import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';
import { BarChart3, Wallet } from 'lucide-react';
import { useMarkets } from '../hooks/useMarkets';
import { useUSDCBalance } from '../hooks';
import { FeedCard } from '../components/FeedCard';

export function Home() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { data: markets, isLoading, error } = useMarkets();
  const { balanceFormatted } = useUSDCBalance(address);

  return (
    <div className="h-screen w-full flex flex-col bg-mesh text-white overflow-hidden relative">
      <header className="shrink-0 pt-4 px-6 flex items-center justify-between absolute top-0 w-full z-50 pointer-events-none">
        <div />
        {isConnected ? (
          <button
            onClick={() => open()}
            className="px-3 py-2 flex items-center gap-2 rounded-lg glass-panel pointer-events-auto active:scale-95 transition-transform"
          >
            <div className="w-2 h-2 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="text-[13px] font-bold text-[#00d4aa]">
              ${balanceFormatted || '0.00'}
            </span>
          </button>
        ) : (
          <button
            onClick={() => open()}
            className="w-10 h-10 flex items-center justify-center rounded-lg glass-panel pointer-events-auto active:scale-90 transition-transform"
          >
            <Wallet className="w-5 h-5 text-[#888]" />
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto snap-container">
        {isLoading ? (
          <div className="h-screen flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-[#00d4aa] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="h-screen flex flex-col items-center justify-center px-6 text-center">
            <p className="text-[#e01b24] font-bold mb-2">Failed to load markets</p>
            <p className="text-[#888] text-sm">{error.message}</p>
          </div>
        ) : !markets || markets.length === 0 ? (
          <div className="h-screen flex flex-col items-center justify-center px-6 text-center">
            <BarChart3 className="w-16 h-16 text-[#00d4aa]/50 mb-4" />
            <p className="text-white font-bold text-lg mb-2">No markets yet</p>
            <p className="text-[#888] text-sm">Check back soon for prediction markets</p>
          </div>
        ) : (
          markets.map((market) => <FeedCard key={market.address} market={market} />)
        )}
      </main>
    </div>
  );
}
