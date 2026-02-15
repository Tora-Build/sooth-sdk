import { useSearchParams } from 'react-router-dom';
import { OrderBook } from '../components/OrderBook';
import { useOrderBook, useMarketInfo, MARKETS } from '../hooks/useSoothBook';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export function MarketPage() {
  const [searchParams] = useSearchParams();
  const marketKeyParam = searchParams.get('key') || MARKETS[0]?.marketKey;
  const marketKey = marketKeyParam as `0x${string}`;
  const knownMarket = MARKETS.find(m => m.marketKey === marketKey);

  const { data: orderbook, isLoading: bookLoading } = useOrderBook(marketKey);
  const { data: info, isLoading: infoLoading } = useMarketInfo(marketKey);

  const question = knownMarket?.question || `Market ${marketKey.slice(0, 10)}...`;
  const isLoading = bookLoading || infoLoading;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <a href="/" className="inline-flex items-center gap-1.5 text-sm text-[#888] hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Back
          </a>
          <h1 className="text-2xl font-bold mb-2">{question}</h1>
          {info && (
            <div className="flex items-center gap-4 text-sm text-[#888]">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${info.active && !info.finalized ? 'bg-[#00d4aa]/10 text-[#00d4aa]' : 'bg-[#e01b24]/10 text-[#e01b24]'}`}>
                {info.finalized ? (info.outcome === 1 ? 'YES Won' : info.outcome === 0 ? 'NO Won' : 'Invalid') : 'Active'}
              </span>
              <span className="font-mono">
                TVL: {(Number(info.backing) / 1e18).toFixed(2)} USDC
              </span>
            </div>
          )}
        </div>

        {/* Price display */}
        {orderbook && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-[#00d4aa]/10 border border-[#00d4aa]/30 rounded-2xl p-4 text-center">
              <div className="text-xs font-bold text-[#00d4aa]/60 uppercase tracking-wide mb-1">YES</div>
              <div className="text-3xl font-bold font-mono text-[#00d4aa]">
                {orderbook.yesPrice > 0 ? (orderbook.yesPrice * 100).toFixed(1) : '--'}¢
              </div>
            </div>
            <div className="bg-[#e01b24]/10 border border-[#e01b24]/30 rounded-2xl p-4 text-center">
              <div className="text-xs font-bold text-[#e01b24]/60 uppercase tracking-wide mb-1">NO</div>
              <div className="text-3xl font-bold font-mono text-[#e01b24]">
                {orderbook.noPrice > 0 ? (orderbook.noPrice * 100).toFixed(1) : '--'}¢
              </div>
            </div>
          </div>
        )}

        {/* Order Book */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#00d4aa] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orderbook ? (
          <OrderBook
            yesBids={orderbook.yesBids}
            noBids={orderbook.noBids}
          />
        ) : (
          <div className="text-center py-12 text-[#555]">Failed to load orderbook</div>
        )}

        {/* Market info */}
        <div className="mt-6 bg-[#1a1a1b] rounded-2xl border border-[#333] p-4 space-y-2">
          <h3 className="text-xs font-bold text-[#888] uppercase tracking-wide mb-3">Contract Info</h3>
          <InfoRow label="SoothBook" value="0x9a99...2aB8" href={`https://sepolia.basescan.org/address/0x9a992959490578c8f171C25BC8615E9Cc1AA2aB8`} />
          {knownMarket && (
            <>
              <InfoRow label="YES Token" value={`${knownMarket.yesToken.slice(0, 6)}...${knownMarket.yesToken.slice(-4)}`} href={`https://sepolia.basescan.org/address/${knownMarket.yesToken}`} />
              <InfoRow label="NO Token" value={`${knownMarket.noToken.slice(0, 6)}...${knownMarket.noToken.slice(-4)}`} href={`https://sepolia.basescan.org/address/${knownMarket.noToken}`} />
            </>
          )}
          <InfoRow label="Network" value="Base Sepolia" />
          <InfoRow label="Model" value="4-Atomic (buyYes, buyNo, mint, merge)" />
        </div>
      </div>
    </div>
  );
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
