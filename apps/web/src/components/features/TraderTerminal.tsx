import React, { useState, useMemo } from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { useChainStore } from '../../store/useChainStore';
import { useContent } from '../../hooks/useContent';
import { TradingAccountCard } from './portfolio/TradingAccountCard';
import { ActivePositionsCard } from './portfolio/ActivePositionsCard';
import { AmmMarketCard as MarketCard } from './trader/AmmMarketCard';
import { SearchBar } from './trader/SearchBar';
import { MarketFilters, SortOption, FilterOption } from './trader/MarketFilters';
import { MarketSkeleton } from './trader/MarketSkeleton';
import { searchMarkets, filterMarkets, sortMarkets } from '../../utils/marketUtils';

export const TraderTerminal: React.FC = () => {
  const { t } = useContent();
  const { markets, mode } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('status');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Filter markets based on current mode and chain
  const modeFilteredMarkets = useMemo(() => markets.filter(m => {
    // 1. Filter by Mode
    if (m.mode !== mode) return false;

    // 2. For Real mode, filter by Chain ID
    if (mode === 'real') {
      // If market has a chainId, it MUST match the selected chain
      if (m.chainId !== undefined && m.chainId !== selectedChainId) {
        return false;
      }
      // If market has NO chainId (legacy), only show on Default Chain (Base Sepolia)
      if (m.chainId === undefined && selectedChainId !== 84532) {
        return false;
      }
    }

    return true;
  }), [markets, mode, selectedChainId]);

  // Apply search, filter, and sort
  const processedMarkets = useMemo(() => {
    let result = modeFilteredMarkets;
    result = searchMarkets(result, searchQuery);
    result = filterMarkets(result, filterBy);
    result = sortMarkets(result, sortBy);
    return result;
  }, [modeFilteredMarkets, searchQuery, filterBy, sortBy]);

  // Loading state (simulated for demo, would be real in production)
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <MarketSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  // Empty state - no markets in this mode
  if (modeFilteredMarkets.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-slate-600" />
        </div>
        <h3 className="text-xl font-heading font-semibold text-white mb-2">
          {t('trading.noMarkets')}
        </h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          {t('trading.noMarketsDesc')}
        </p>
      </div>
    );
  }

  // Empty search/filter results
  if (processedMarkets.length === 0) {
    return (
      <div className="space-y-6">

        {/* Header with controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-2xl font-heading font-bold text-white mb-1">{t('trading.markets')}</h2>
            <p className="text-slate-400 text-sm">
              {modeFilteredMarkets.length} {mode === 'real' ? 'live' : 'demo'} market{modeFilteredMarkets.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <MarketFilters
              sortBy={sortBy}
              onSortChange={setSortBy}
              filterBy={filterBy}
              onFilterChange={setFilterBy}
            />
          </div>
        </div>

        {/* No results message */}
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🔍</span>
          </div>
          <p className="text-slate-400 text-sm">{t('trading.noResults')}</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterBy('all');
            }}
            className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {t('trading.clearFilters')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Portfolio Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Trading Account (2 Cols -> 40%) */}
        <div className="lg:col-span-2 h-full">
          <TradingAccountCard />
        </div>
        {/* Right: Active Positions (3 Cols -> 60%) */}
        <div className="lg:col-span-3 h-full">
          <ActivePositionsCard />
        </div>
      </div>

      <div className="h-px bg-slate-800/50 w-full" />

      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-white mb-1">{t('trading.markets')}</h2>
          <p className="text-slate-400 text-sm">
            {processedMarkets.length} of {modeFilteredMarkets.length} {mode === 'real' ? 'live' : 'demo'} {modeFilteredMarkets.length === 1 ? 'market' : 'markets'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <MarketFilters
            sortBy={sortBy}
            onSortChange={setSortBy}
            filterBy={filterBy}
            onFilterChange={setFilterBy}
          />
        </div>
      </div>



      {/* Market Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {processedMarkets.map(market => (
          <MarketCard key={market.id} marketId={market.id} />
        ))}
      </div>
    </div>
  );
};
