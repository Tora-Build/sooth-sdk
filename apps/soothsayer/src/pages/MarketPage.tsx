import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SoothBookOrderBook } from '../components/SoothBookOrderBook';
import { SoothBookTradePanel } from '../components/SoothBookTradePanel';
import { useOrderBook, useMarketInfo, MARKETS } from '../hooks/useSoothBook';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';

export function MarketPage() {
  const [searchParams] = useSearchParams();
  const marketKeyParam = searchParams.get('key') || MARKETS[0]?.marketKey;
  const marketKey = marketKeyParam as `0x${string}`;
  const knownMarket = MARKETS.find(m => m.marketKey === marketKey);

  const { data: orderbook, isLoading: bookLoading, refetch } = useOrderBook(marketKey);
  const { data: info, isLoading: infoLoading } = useMarketInfo(marketKey);

  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');
  const [selectedTick, setSelectedTick] = useState<number | undefined>();

  const handleTickSelect = useCallback((side: 'yes' | 'no', tick: number) => {
    setSelectedSide(side);
    setSelectedTick(tick);
  }, []);

  const handleTradeSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  const question = knownMarket?.question || `Market ${marketKey.slice(0, 10)}...`;
  const isLoading = bookLoading || infoLoading;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <a href="/" className="inline-flex items-center gap-1.5 text-sm text-[#888] hover:text-white mb-3">
            <ArrowLeft className="w-4 h-4" /> Back
          </a>
          <h1 className="text-xl sm:text-2xl font-bold mb-2">{question}</h1>
          {info && (
            <div className="flex items-center gap-4 text-sm text-[#888]">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                info.active && !info.finalized
                  ? 'bg-[#00d4aa]/10 text-[#00d4aa]'
                  : 'bg-[#e01b24]/10 text-[#e01b24]'
              }`}>
                {info.finalized ? (info.outcome === 1 ? 'YES Won' : info.outcome === 0 ? 'NO Won' : 'Invalid') : 'Active'}
              </span>
              <span className="font-mono">
                TVL: {(Number(info.backing) / 1e18).toFixed(2)} USDC
              </span>
              <button
                onClick={() => refetch()}
                className="text-[#555] hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${bookLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Main layout: orderbook + trade panel side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          {/* Order Book */}
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-[#00d4aa] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : orderbook ? (
              <SoothBookOrderBook
                yesBids={orderbook.yesBids}
                noBids={orderbook.noBids}
                yesPrice={orderbook.yesPrice}
                noPrice={orderbook.noPrice}
                onTickSelect={handleTickSelect}
              />
            ) : (
              <div className="text-center py-16 text-[#555]">Failed to load orderbook</div>
            )}
          </div>

          {/* Trade Panel */}
          {knownMarket && (
            <SoothBookTradePanel
              marketKey={marketKey}
              collateral={knownMarket.collateral}
              yesToken={knownMarket.yesToken}
              noToken={knownMarket.noToken}
              selectedSide={selectedSide}
              selectedTick={selectedTick}
              onSuccess={handleTradeSuccess}
            />
          )}
        </div>

        {/* Contract info */}
        <div className="mt-6 bg-[#111113] rounded-2xl border border-[#2a2a2d] p-4 space-y-2">
          <h3 className="text-xs font-bold text-[#888] uppercase tracking-wide mb-3">Contract Info</h3>
          <InfoRow label="SoothBook" value="0x9a99...2aB8" href="https://sepolia.basescan.org/address/0x9a992959490578c8f171C25BC8615E9Cc1AA2aB8" />
          {knownMarket && (
            <>
              <InfoRow label="YES Token" value={shorten(knownMarket.yesToken)} href={`https://sepolia.basescan.org/address/${knownMarket.yesToken}`} />
              <InfoRow label="NO Token" value={shorten(knownMarket.noToken)} href={`https://sepolia.basescan.org/address/${knownMarket.noToken}`} />
            </>
          )}
          <InfoRow label="Network" value="Base Sepolia" />
          <InfoRow label="Model" value="4-Atomic (buyYes, buyNo, mint, merge)" />
        </div>
      </div>
    </div>
  );
}

function shorten(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-[#888]">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#00d4aa] font-mono flex items-center gap-1 hover:underline">
          {value} <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-white font-mono">{value}</span>
      )}
    </div>
  );
}
