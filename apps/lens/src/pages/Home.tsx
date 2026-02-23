import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';

import { Rss, Wallet, Loader2 } from 'lucide-react';
import { useLensFeed } from '../hooks/useLensFeed';
import { SnapMarketCard } from '../components/SnapMarketCard';
import { useShowcase } from '../hooks/useShowcase';

export function Home() {
  const { open } = useAppKit();

  const { isConnected } = useAccount();
  const { data: posts, isLoading, error } = useLensFeed('sooth-market');
  const inShowcase = useShowcase();

  return (
    <div className={`${inShowcase ? 'h-full' : 'h-dvh'} w-full flex flex-col bg-mesh text-white overflow-hidden relative`}>
      {/* Decorative glow orbs — depth layer behind content */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-[#00d4aa]/10 rounded-full blur-[120px] mix-blend-screen opacity-30 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#836ef9]/10 rounded-full blur-[120px] mix-blend-screen opacity-20 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#e01b24]/5 rounded-full blur-[100px] mix-blend-screen opacity-20 pointer-events-none" />
      <header className="shrink-0 pt-4 px-6 flex items-center justify-end absolute top-0 w-full z-50 pointer-events-none">
        <button
          onClick={() => open()}
          className="h-10 flex items-center justify-center pointer-events-auto active:scale-90 transition-transform"
          aria-label={isConnected ? "Open wallet profile" : "Connect wallet"}
        >
          <Wallet className={`w-6 h-6 ${isConnected ? 'text-[#00d4aa]' : 'text-[#888]'}`} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto snap-container">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-[#00d4aa] animate-spin" />
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center px-6 text-center">
            <p className="text-[#e01b24] font-bold mb-2">Failed to load markets</p>
            <p className="text-[#888] text-sm">{(error as Error).message}</p>
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-6 text-center">
            <Rss className="w-16 h-16 text-[#00d4aa]/50 mb-4" />
            <p className="text-white font-bold text-lg mb-2">No sooth markets yet</p>
            <p className="text-[#888] text-sm">Check back soon for prediction markets</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="snap-card">
              <SnapMarketCard post={post} />
            </div>
          ))
        )}
      </main>


    </div>
  );
}
