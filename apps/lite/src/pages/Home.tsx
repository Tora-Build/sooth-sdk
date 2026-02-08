import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';
import { BarChart3, Wallet } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useMarkets } from '../hooks/useMarkets';
import { FeedCard } from '../components/FeedCard';

export function Home() {
  const { open } = useAppKit();
  const { isConnected } = useAccount();
  const { data: markets, isLoading, error } = useMarkets();
  const [searchParams] = useSearchParams();
  const marketIdParam = searchParams.get('marketId');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (marketIdParam && markets && containerRef.current) {
      const element = document.getElementById(`market-${marketIdParam}`);
      if (element) {
        element.scrollIntoView({ behavior: 'auto' });
      }
    }
  }, [marketIdParam, markets]);

  return (
    <div className="h-screen w-full flex flex-col bg-mesh text-white overflow-hidden relative">
      <header className="shrink-0 pt-4 px-6 flex items-center justify-between absolute top-0 w-full z-50 pointer-events-none">
        <div />
        <button
          onClick={() => open()}
          className="h-10 flex items-center justify-center pointer-events-auto active:scale-90 transition-transform"
          aria-label={isConnected ? "Open wallet profile" : "Connect wallet"}
        >
          <Wallet className={`w-6 h-6 ${isConnected ? 'text-[#00d4aa]' : 'text-[#888]'}`} />
        </button>
      </header>

      <main
        ref={containerRef}
        className="flex-1 overflow-y-auto snap-container"
      >
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
          markets.map((market) => (
            <div key={market.address} id={`market-${market.address}`} className="snap-card">
              <FeedCard market={market} isSelected={market.address === marketIdParam} />
            </div>
          ))
        )}
      </main>
    </div>
  );
}
