import { useState, useMemo } from 'react';
import { Zap } from 'lucide-react';
import { MarketCard, MarketHeader } from '../../components/features/v8';
import marketsConfig from '../../config/markets.json';
import { useChainStore } from '../../store/useChainStore';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'politics', label: 'Politics' },
  { id: 'science', label: 'Science' },
  { id: 'sports', label: 'Sports' },
];

export const Markets = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);

  // Get V8 markets from config for the current chain
  const allMarkets = useMemo(() => {
    return marketsConfig.markets?.filter(m =>
      m.chainId === chainId && m.version.startsWith('v')
    ) || [];
  }, [chainId]);

  // Filter by search and category
  const filteredMarkets = useMemo(() => {
    return allMarkets.filter(m => {
      const matchesSearch = !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.symbol.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = category === 'all' ||
        m.category?.toLowerCase() === category.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [allMarkets, search, category]);

  // Generate category counts
  const categoriesWithCounts = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      count: cat.id === 'all'
        ? allMarkets.length
        : allMarkets.filter(m => m.category?.toLowerCase() === cat.id).length
    }));
  }, [allMarkets]);

  return (
    <div className="space-y-8">
      <MarketHeader
        title="Markets"
        subtitle="Trade on the bonding curve AMM — all markets from early stage to graduation"
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        categories={categoriesWithCounts}
        marketCount={filteredMarkets.length}
      />

      {/* Market Grid */}
      {filteredMarkets.length === 0 ? (
        <EmptyState search={search} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.map(market => (
            <MarketCard
              key={market.contractAddress}
              address={market.contractAddress as `0x${string}`}
              name={market.name}
              symbol={market.symbol}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ search }: { search?: string }) => (
  <div className="text-center py-20">
    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-900/50 border border-dashed border-slate-700 flex items-center justify-center">
      <Zap className="w-8 h-8 text-slate-600" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">
      {search ? 'No markets found' : 'No V8 Markets Yet'}
    </h3>
    <p className="text-slate-400 mb-6 max-w-md mx-auto">
      {search
        ? `No markets match "${search}". Try a different search term.`
        : 'V8 markets will appear here once deployed.'
      }
    </p>
  </div>
);

export default Markets;
