import React, { useState, useMemo } from 'react';
import { TrendingUp, Sparkles, Plus } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { useChainStore } from '../../store/useChainStore';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useContent } from '../../hooks/useContent';
import { TradingAccountCard } from './portfolio/TradingAccountCard';
import { ActivePositionsCard } from './portfolio/ActivePositionsCard';
import { AmmMarketCard as MarketCard } from './trader/AmmMarketCard';
import { LaunchpadMarketCard } from './trader/LaunchpadMarketCard';
import { CreateMarketDrawer } from './trader/CreateMarketDrawer';
import { SearchBar } from './trader/SearchBar';
import { MarketFilters, SortOption, FilterOption } from './trader/MarketFilters';
import { MarketSkeleton } from './trader/MarketSkeleton';
import { searchMarkets, filterMarkets, sortMarkets } from '../../utils/marketUtils';
import { useLaunchpadMarkets } from '../../hooks/v5/useLaunchpadMarkets';

export const TraderTerminal: React.FC = () => {
  const { t } = useContent();
  const { markets, mode } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('status');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateMarket, setShowCreateMarket] = useState(false);

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

  // Fetch dynamic markets
  const { markets: launchpadMarkets, isLoading: isLaunchpadLoading } = useLaunchpadMarkets();

  // Total markets count (Static + Dynamic)
  const totalMarketsCount = modeFilteredMarkets.length + (mode === 'real' ? launchpadMarkets.length : 0);

  // Loading state (simulated for demo, would be real in production)
  if (isLoading || isLaunchpadLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <MarketSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  // Empty state - no markets in this mode AND no launchpad markets
  if (totalMarketsCount === 0) {
    // Even if empty, for Real mode, we want to show the "Create Market" card as a call to action
    // instead of a dead end.
    if (mode === 'real') {
      return (
        <div className="space-y-8">

          {/* Portfolio Section (Restored) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 h-full">
              <TradingAccountCard />
            </div>
            <div className="lg:col-span-3 h-full">
              <ActivePositionsCard />
            </div>
          </div>

          <div className="h-px bg-slate-800/50 w-full" />

          {/* Header with controls (minimal) */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <h2 className="text-2xl font-heading font-bold text-white mb-1">{t('trading.markets')}</h2>
              <p className="text-slate-400 text-sm">
                No active markets found. Be the first to launch one!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button
              onClick={() => setShowCreateMarket(true)}
              className="relative group min-h-[280px] rounded-xl border-2 border-dashed border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/30 transition-all duration-300 flex flex-col items-center justify-center gap-4 text-center p-6"
            >
              <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                <Plus className="w-8 h-8 text-slate-400 group-hover:text-blue-400 transition-colors" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-300 group-hover:text-white transition-colors">Create Market</h3>
                <p className="text-sm text-slate-500 group-hover:text-slate-400 mt-2">
                  Launch your own prediction market on the bonding curve.
                </p>
              </div>
            </button>
          </div>
        </div>
      )
    }

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

  // Empty search/filter results (only if NO static AND NO dynamic markets match)
  if (processedMarkets.length === 0 && (mode !== 'real' || launchpadMarkets.length === 0)) {
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

        {/* Launchpad Markets (from V5 Hook) */}
        {mode === 'real' && <LaunchpadMarketList markets={launchpadMarkets} />}


        {processedMarkets.map(market => (
          <MarketCard key={market.id} marketId={market.id} />
        ))}

        {/* Create New Market Card - Always appears last */}
        <button
          onClick={() => setShowCreateMarket(true)}
          className="relative group min-h-[280px] rounded-xl border-2 border-dashed border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/30 transition-all duration-300 flex flex-col items-center justify-center gap-4 text-center p-6"
        >
          <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
            <Plus className="w-8 h-8 text-slate-400 group-hover:text-blue-400 transition-colors" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-300 group-hover:text-white transition-colors">Create Market</h3>
            <p className="text-sm text-slate-500 group-hover:text-slate-400 mt-2">
              Launch your own prediction market on the bonding curve.
            </p>
          </div>
        </button>
      </div>

      {/* Create Market Drawer */}
      <CreateMarketDrawer
        isOpen={showCreateMarket}
        onClose={() => setShowCreateMarket(false)}
      />
    </div>
  );
};

// Internal component to list Launchpad markets using full trading cards
const LaunchpadMarketList = ({ markets }: { markets: any[] }) => {
  if (!markets || markets.length === 0) return null;

  return (
    <>
      {markets.map(m => (
        <LaunchpadMarketCard
          key={m.address}
          marketAddress={m.address as `0x${string}`}
          marketMeta={{
            address: m.address,
            name: m.name,
            symbol: m.symbol,
            isGraduated: m.isGraduated,
            deadline: m.deadline,
          }}
        />
      ))}
    </>
  );
}
