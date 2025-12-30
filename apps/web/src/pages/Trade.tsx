/**
 * Trade Page - AMM Trader Interface
 * 
 * Simple, approachable trading for retail users expressing opinions or hedging risk.
 * Features: Quick trade buttons, large probability display, educational tooltips
 */
import { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { TrendingUp, Zap, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useChainStore } from '../store/useChainStore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SimpleTradingPanel, MarketHeader, GraduationProgress } from '../components/features/v8';
import { MarketStats } from '../components/features/v8/MarketStats';
import { LPHolders } from '../components/features/v8/LPHolders';
import { useAmmMarketDirect, useTruthMarketDirect, useLaunchpadMarketDirect } from '../hooks/v8';
import marketsConfig from '../config/markets.json';
import uiContent from '../config/ui-content.json';
import { cn } from '../lib/utils';

const { trade: content } = uiContent;

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'politics', label: 'Politics' },
  { id: 'science', label: 'Science' },
  { id: 'sports', label: 'Sports' },
];

// Market chip for horizontal scroll
interface MarketChipProps {
  market: typeof marketsConfig.markets[0];
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
          {isGraduated && <Zap className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
        </div>
        <div className="text-[10px] text-slate-500 truncate">{market.name.slice(0, 25)}</div>
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

  // Filter V8 markets for current chain
  const v8Markets = useMemo(() => {
    return marketsConfig.markets.filter(m =>
      m.version.startsWith('v') && m.chainId === chainId
    );
  }, [chainId]);

  // Apply search and category filters
  const filteredMarkets = useMemo(() => {
    return v8Markets.filter(m => {
      const matchesSearch = search === '' ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.symbol.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'all' ||
        (m as any).category?.toLowerCase() === category.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [v8Markets, search, category]);

  // Get category counts based on actual market categories
  const categoriesWithCounts = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      count: cat.id === 'all'
        ? v8Markets.length
        : v8Markets.filter(m => (m as any).category?.toLowerCase() === cat.id.toLowerCase()).length
    }));
  }, [v8Markets]);

  // Handle URL-based market selection or auto-select first market
  useEffect(() => {
    if (marketId) {
      setSelectedMarketAddress(marketId);
    } else if (filteredMarkets.length > 0 && !selectedMarketAddress) {
      setSelectedMarketAddress(filteredMarkets[0].contractAddress);
    }
  }, [marketId, filteredMarkets, selectedMarketAddress]);

  // Find selected market
  const selectedMarket = useMemo(() => {
    if (selectedMarketAddress) {
      return filteredMarkets.find(m => m.contractAddress.toLowerCase() === selectedMarketAddress.toLowerCase()) || filteredMarkets[0];
    }
    return filteredMarkets[0];
  }, [selectedMarketAddress, filteredMarkets]);

  // Get market data
  const { market: truth } = useTruthMarketDirect(selectedMarket?.contractAddress as `0x${string}`);
  const { launchpad, isLoading: isLoadingLaunchpad } = useLaunchpadMarketDirect(selectedMarket?.contractAddress as `0x${string}`);

  const handleSelectMarket = (market: typeof v8Markets[0]) => {
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
        title="AMM"
        hint="Automated Market Maker for casual traders. Buy or sell YES/NO tokens instantly with always-available liquidity. During the bonding phase, every trade earns you LP tokens as rewards. Perfect for expressing quick opinions or hedging your positions without worrying about order matching."
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        categories={categoriesWithCounts}
        marketCount={filteredMarkets.length}
      />

      {/* Horizontal Market Scroll - matches Pro page layout */}
      {filteredMarkets.length === 0 ? (
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
                key={market.id}
                market={market}
                isSelected={selectedMarket?.id === market.id}
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
            {/* Market Header Card */}
            <Card className="p-4">
              {/* Row 1: Title + Badges */}
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-bold text-white">{selectedMarket.name}</h2>
                {/* Top Right Badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Deadline Badge */}
                  <div className="px-2 py-0.5 rounded text-xs font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedMarket.deadline ? new Date(selectedMarket.deadline * 1000).toLocaleDateString() : 'Open-end'}
                  </div>
                  {/* Status Badge - Graduated or Bonding */}
                  {launchpad?.isGraduated ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Graduated
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      Bonding
                    </span>
                  )}
                </div>
              </div>
              {/* Row 2: Description (full width) */}
              <p className="text-sm text-slate-400 mt-2">{selectedMarket.description}</p>
              {/* Row 3: Contract Addresses (full width) */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500">
                {/* Market Address */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-600">Market:</span>
                  <span className="font-mono text-slate-500">
                    {selectedMarket.contractAddress.slice(0, 6)}...{selectedMarket.contractAddress.slice(-4)}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(selectedMarket.contractAddress)}
                    className="text-slate-600 hover:text-slate-400 transition-colors"
                    title="Copy market address"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                {/* Adjudicator Address */}
                {truth?.adjudicator && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600">Adjudicator:</span>
                    <span className="font-mono text-slate-500">
                      {truth.adjudicator.slice(0, 6)}...{truth.adjudicator.slice(-4)}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(truth.adjudicator)}
                      className="text-slate-600 hover:text-slate-400 transition-colors"
                      title="Copy adjudicator address"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                )}
                {/* Guardian Address */}
                {truth?.guardian && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600">Guardian:</span>
                    <span className="font-mono text-slate-500">
                      {truth.guardian.slice(0, 6)}...{truth.guardian.slice(-4)}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(truth.guardian)}
                      className="text-slate-600 hover:text-slate-400 transition-colors"
                      title="Copy guardian address"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </Card>

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
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
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
