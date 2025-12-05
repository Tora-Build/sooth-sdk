import React, { useState, useMemo } from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { useChainStore } from '../../store/useChainStore';
import { MarketCard } from './trader/MarketCard';
import { SearchBar } from './trader/SearchBar';
import { MarketFilters, SortOption, FilterOption } from './trader/MarketFilters';
import { MarketSkeleton } from './trader/MarketSkeleton';
import { TradingVaultManager } from './trader/TradingVaultManager';
import { searchMarkets, filterMarkets, sortMarkets } from '../../utils/marketUtils';

export const TraderTerminal: React.FC = () => {
  const { markets, mode } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('status');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [isLoading, setIsLoading] = useState(false);
  
  // Filter markets based on current mode and chain
  // Filter markets based on current mode and chain
  const modeFilteredMarkets = markets.filter(m => {
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
  });
  
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
          No markets available
        </h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Markets will appear here once deployed on-chain.
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
            <h2 className="text-2xl font-heading font-bold text-white mb-1">Markets</h2>
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
          <p className="text-slate-400 text-sm">No markets match your search or filters.</p>
          <button 
            onClick={() => {
              setSearchQuery('');
              setFilterBy('all');
            }}
            className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Clear filters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-white mb-1">Markets</h2>
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

      {/* Market Statistics Bar */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-emerald-400" />
            <span className="text-[10px] text-slate-500 uppercase">Active</span>
          </div>
          <div className="text-lg font-bold text-white">
            {modeFilteredMarkets.filter(m => m.status === 'trading').length}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase mb-1">Cooldown</div>
          <div className="text-lg font-bold text-white">
            {modeFilteredMarkets.filter(m => m.status === 'cooldown').length}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase mb-1">Settled</div>
          <div className="text-lg font-bold text-white">
            {modeFilteredMarkets.filter(m => m.status === 'settled').length}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 hidden md:block">
          <div className="text-[10px] text-slate-500 uppercase mb-1">Volume</div>
          <div className="text-lg font-bold text-white">$0</div>
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
