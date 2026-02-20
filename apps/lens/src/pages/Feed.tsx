import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { Rss, Loader2, Plus, Wallet } from "lucide-react";
import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';
import { useLensFeed } from "../hooks/useLensFeed";
import { LensPostCard } from "../components/LensPostCard";
import { useShowcase } from "../hooks/useShowcase";
import { IS_TESTNET } from "../lib/lensConfig";

const FILTERS = [
  { label: "All", tag: undefined },
  { label: "Sooth", tag: "sooth-market" },
  { label: "Markets", tag: "sooth-market" },
  { label: "DeFi", tag: "defi" },
] as const;

export function Feed() {
  const [activeFilter, setActiveFilter] = useState(0);
  const navigate = useNavigate();
  const { open } = useAppKit();
  const { isConnected } = useAccount();
  const tag = FILTERS[activeFilter].tag;
  const { data: posts, isLoading, error } = useLensFeed(tag);
  const inShowcase = useShowcase();

  return (
    <div className={`${inShowcase ? "h-full" : "h-dvh"} w-full flex flex-col bg-[#1a1a1b] text-white overflow-hidden relative`}>
      {/* Header */}
      <header className="shrink-0 border-b border-[#2d2d2e]">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <Rss className="w-5 h-5 text-[#00d4aa]" />
          <h1 className="text-lg font-bold">Lens Feed</h1>
          <span className="text-xs text-[#888] ml-auto">{IS_TESTNET ? 'Lens Testnet' : 'Lens Chain'}</span>
          <button
            onClick={() => open()}
            className="h-10 flex items-center justify-center active:scale-90 transition-transform"
            aria-label={isConnected ? "Open wallet profile" : "Connect wallet"}
          >
            <Wallet className={`w-5 h-5 ${isConnected ? 'text-[#00d4aa]' : 'text-[#888]'}`} />
          </button>
        </div>

        {/* Filter chips */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setActiveFilter(i)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all shrink-0 ${
                i === activeFilter
                  ? "bg-[#00d4aa] text-[#1a1a1b]"
                  : "bg-[#2d2d2e] text-[#888] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#00d4aa] animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <p className="text-[#e01b24] font-bold mb-2">Failed to load feed</p>
            <p className="text-[#888] text-sm">{(error as Error).message}</p>
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <Rss className="w-12 h-12 text-[#00d4aa]/30 mb-4" />
            <p className="text-white font-bold mb-1">No posts yet</p>
            <p className="text-[#888] text-sm">
              {tag ? `No posts tagged #${tag}` : "The feed is empty"}
            </p>
          </div>
        ) : (
          <div>
            {posts.map((post) => (
              <LensPostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={() => navigate('/create')}
        className="absolute right-4 z-40 size-12 rounded-full bg-[#00d4aa] text-[#1a1a1b] flex items-center justify-center shadow-lg shadow-black/40 active:scale-95 transition-transform"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
        aria-label="Create market"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
