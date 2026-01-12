/**
 * Trade Page - AMM Trader Interface
 * 
 * Simple, approachable trading for retail users expressing opinions or hedging risk.
 * Features: Quick trade buttons, large probability display, educational tooltips
 * 
 * V9.9.6: Now uses on-chain market discovery via useOnChainMarkets hook
 */
import { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { TrendingUp, Zap, Clock, ChevronLeft, ChevronRight, Loader2, BarChart3, Check } from 'lucide-react';
import { useChainStore } from '../store/useChainStore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { MarketHeader, GraduationProgress, MarketStats, LPHolders } from '../components/features';
import { SimpleTradingPanel } from '../components/features/SimpleTradingPanel';
import { MarketDetailHeader } from '../components/features/launchpad/MarketDetailHeader';
import { useAmmMarketDirect, useTruthMarketDirect, useLaunchpadMarketDirect, useOnChainMarkets } from '../hooks';
import marketsConfig from '../config/markets.json';
import uiContent from '../config/ui-content.json';
import { cn } from '../lib/utils';

// Type for static market config (for UI metadata fallback)
interface StaticMarket {
  id: string;
  contractAddress: string;
  name: string;
  symbol: string;
  description?: string;
  category?: string;
  imageUrl?: string | null;
}
const staticMarkets = (marketsConfig.markets || []) as StaticMarket[];

const { trade: content } = uiContent;

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'sports', label: 'Sports' },
  { id: 'cultures', label: 'Cultures' },
  { id: 'others', label: 'Others' },
];

// Market chip for horizontal scroll
interface MarketChipProps {
  market: {
    contractAddress: string;
    name: string;
    symbol: string;
    category?: string;
  };
  isSelected: boolean;
  onSelect: () => void;
}

const MarketChip: React.FC<MarketChipProps> = ({ market, isSelected, onSelect }) => {
  const { amm, isLoading } = useAmmMarketDirect(market.contractAddress as `0x${string}`);
  const { launchpad } = useLaunchpadMarketDirect(market.contractAddress as `0x${string}`);
  const probability = amm?.yesProbability ?? 0.5;
  const isGraduated = launchpad?.isGraduated ?? false;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all min-w-[200px]",
        isSelected
          ? "bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10"
          : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
      )}
    >
      {/* Symbol badge */}
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
        isSelected
          ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
          : "bg-slate-800 text-slate-400"
      )}>
        {market.symbol.slice(0, 2)}
      </div>

      {/* Name */}
      <div className="text-left min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm truncate">{market.symbol}</span>
          {isGraduated 
            ? <BarChart3 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            : <Zap className="w-3 h-3 text-cyan-400 flex-shrink-0" />
          }
        </div>
        <div className="text-xs text-slate-500 truncate">{market.name.slice(0, 25)}</div>
      </div>

      {/* Probability */}
      <span className={cn(
        "text-sm font-bold tabular-nums flex-shrink-0",
        probability > 0.501 ? "text-emerald-400" : probability < 0.499 ? "text-rose-400" : "text-slate-400"
      )}>
        {isLoading ? '—' : `${(probability * 100).toFixed(0)}%`}
      </span>
    </button>
  );
};

export const Trade = () => {
  const { marketId } = useParams<{ marketId?: string }>();
  const navigate = useNavigate();
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);

  // Search and filter state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedMarketAddress, setSelectedMarketAddress] = useState<string | null>(null);

  // Scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);

  // V9.9.6: On-chain market discovery (shows ALL markets, not just graduated)
  const { markets: onChainMarkets, isLoading: isLoadingMarkets } = useOnChainMarkets();

  // Merge on-chain markets with static config and localStorage metadata
  const allMarkets = useMemo(() => {
    return onChainMarkets.map(m => {
      const staticMarket = staticMarkets.find(
        s => s.contractAddress.toLowerCase() === m.address.toLowerCase()
      );

      // Check localStorage for metadata saved during Launchpad creation
      let localMeta: { category?: string; name?: string } | null = null;
      try {
        const stored = localStorage.getItem(`market_meta_${m.address.toLowerCase()}`);
        if (stored) localMeta = JSON.parse(stored);
      } catch { /* ignore parse errors */ }

      return {
        contractAddress: m.address,
        id: staticMarket?.id || m.address,
        name: staticMarket?.name || localMeta?.name || m.name || 'Unknown Market',
        symbol: staticMarket?.symbol || m.symbol || '???',
        category: (staticMarket as any)?.category || localMeta?.category || 'others',
        description: staticMarket?.description,
        imageUrl: staticMarket?.imageUrl,
        isGraduated: m.isGraduated,
        creator: m.creator,
        createdAt: m.createdAt,
      };
    });
  }, [onChainMarkets]);

  // Apply search and category filters
  const filteredMarkets = useMemo(() => {
    return allMarkets.filter(m => {
      const matchesSearch = search === '' ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.symbol.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'all' ||
        m.category?.toLowerCase() === category.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [allMarkets, search, category]);

  // Get category counts based on actual market categories
  const categoriesWithCounts = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      count: cat.id === 'all'
        ? allMarkets.length
        : allMarkets.filter(m => m.category?.toLowerCase() === cat.id.toLowerCase()).length
    }));
  }, [allMarkets]);

  useEffect(() => {
    setSelectedMarketAddress(null);
    if (marketId) {
      navigate('/trade');
    }
  }, [chainId, marketId, navigate]);

  // Handle URL-based market selection or auto-select first market
  useEffect(() => {
    if (marketId) {
      setSelectedMarketAddress(marketId);
    } else if (filteredMarkets.length > 0 && !selectedMarketAddress) {
      setSelectedMarketAddress(filteredMarkets[0].contractAddress);
    }
  }, [marketId, filteredMarkets, selectedMarketAddress]);

  // Reset selection when current market is not in filtered list (e.g., category change)
  useEffect(() => {
    if (selectedMarketAddress && filteredMarkets.length > 0 && 
        !filteredMarkets.some(m => m.contractAddress.toLowerCase() === selectedMarketAddress.toLowerCase())) {
      setSelectedMarketAddress(null);
    }
  }, [filteredMarkets, selectedMarketAddress]);

  const selectedMarket = useMemo(() => {
    if (filteredMarkets.length === 0) return null;
    
    if (selectedMarketAddress) {
      const found = filteredMarkets.find(m => m.contractAddress.toLowerCase() === selectedMarketAddress.toLowerCase());
      if (found) return found;
    }
    return filteredMarkets[0];
  }, [selectedMarketAddress, filteredMarkets]);

  // Get market data
  const { market: truth } = useTruthMarketDirect(selectedMarket?.contractAddress as `0x${string}`);
  const { launchpad, isLoading: isLoadingLaunchpad } = useLaunchpadMarketDirect(selectedMarket?.contractAddress as `0x${string}`);

  const handleSelectMarket = (market: typeof allMarkets[0]) => {
    setSelectedMarketAddress(market.contractAddress);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Unified Header */}
      <MarketHeader
        title="Trading on LMSR AMM"
        hint="LMSR (Logarithmic Market Scoring Rule) provides instant liquidity at any size. During bonding phase, every trade earns LP tokens. After graduation, LP holders earn from trading fees. Simple interface for quick predictions - no order matching needed."
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        categories={categoriesWithCounts}
        marketCount={filteredMarkets.length}
      />

      {/* Horizontal Market Scroll - matches Pro page layout */}
      {isLoadingMarkets ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
          <span className="ml-2 text-slate-400">Discovering markets...</span>
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <p className="text-sm">No markets found</p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {/* Left scroll button */}
          <button
            onClick={() => scroll('left')}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center hover:bg-slate-800 hover:border-slate-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-400" />
          </button>

          {/* Scrollable container */}
          <div
            ref={scrollRef}
            className="flex-1 flex gap-3 overflow-x-auto scrollbar-hide py-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {filteredMarkets.map(market => (
              <MarketChip
                key={market.contractAddress}
                market={market}
                isSelected={selectedMarket?.contractAddress === market.contractAddress}
                onSelect={() => handleSelectMarket(market)}
              />
            ))}
          </div>

          {/* Right scroll button */}
          <button
            onClick={() => scroll('right')}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center hover:bg-slate-800 hover:border-slate-600 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      )}

      {/* Main Content Grid */}
      {selectedMarket && (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          {/* Left Column: Trading Panel (60%) */}
          <div className="lg:col-span-6 space-y-4">
            {/* Premium Market Header */}
            <MarketDetailHeader
              name={truth?.question || selectedMarket.name}
              description={selectedMarket.description}
              symbol={selectedMarket.symbol}
              address={selectedMarket.contractAddress}
              creator={truth?.creator || selectedMarket.creator || '0x0'}
              adjudicator={truth?.adjudicator}
              deadline={truth?.deadline}
              isGraduated={launchpad?.isGraduated || false}
              isExpired={Boolean(truth?.deadline && (Date.now() / 1000 > truth.deadline))}
              isLive={truth?.isLive ?? false}
              chainId={chainId}
            />

                            {/* Trading Panel - wrapped in Card for consistent styling */}
            <Card className="bg-slate-950/50 border-slate-800 p-0 overflow-hidden">
              <SimpleTradingPanel
                address={selectedMarket.contractAddress as `0x${string}`}
                isGraduated={launchpad?.isGraduated}
                isSettled={truth?.isSettled ?? false}
              />
            </Card>

            {/* Quick Links */}
            {launchpad?.isGraduated && (
              <div className="flex items-center justify-end text-sm">
                <Link
                  to={`/pro/${selectedMarket.contractAddress}`}
                  className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" />
                  {content.panel.goPro}
                </Link>
              </div>
            )}
          </div>

          {/* Right Column: Graduation Progress, LP & Stats (40%) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Graduation Progress */}
            {!isLoadingLaunchpad && launchpad && (
              <GraduationProgress
                feesAccrued={launchpad.feesAccrued ?? 0n}
                graduationThreshold={launchpad.graduationThreshold ?? 0n}
                graduationProgress={launchpad.graduationProgress}
                isGraduated={launchpad.isGraduated}
                canGraduate={launchpad.canGraduate}
              />
            )}

            {!isLoadingLaunchpad && (
              <>
                <LPHolders marketAddress={selectedMarket.contractAddress as `0x${string}`} />
                <MarketStats marketAddress={selectedMarket.contractAddress as `0x${string}`} />
              </>
            )}

            {/* Educational Link */}
            <div className="text-center">
              <Link
                to="/about"
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {content.education}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trade;
