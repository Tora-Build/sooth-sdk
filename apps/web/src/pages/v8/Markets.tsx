import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Zap } from 'lucide-react';
import { MarketCard } from '../../components/features/v8';
import marketsConfig from '../../config/markets.json';
import { useChainStore } from '../../store/useChainStore';

export const Markets = () => {
  const [filter, setFilter] = useState<'all' | 'live'>('all');
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);

  // Get V8 markets from config for the current chain
  const markets = useMemo(() => {
    return marketsConfig.markets?.filter(m =>
      m.chainId === chainId && m.version.startsWith('v8')
    ) || [];
  }, [chainId]);

  const getFilterLabel = (f: 'all' | 'live') => {
    if (f === 'all') return `All (${markets.length})`;
    if (f === 'live') return `Live (${markets.length})`;
    return f;
  };

  return (
    <div className="space-y-8">
      {/* Filter + Create */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-white tracking-tight">V8 Markets</h2>
          <div className="flex items-center gap-1 ml-4 p-1 bg-slate-900/50 rounded-lg border border-slate-800">
            {(['all', 'live'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filter === f
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                {getFilterLabel(f)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Market Grid */}
      {markets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map(market => (
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

const EmptyState = () => (
  <div className="text-center py-20">
    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-900/50 border border-dashed border-slate-700 flex items-center justify-center">
      <Zap className="w-8 h-8 text-slate-600" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">No V8 Markets Yet</h3>
    <p className="text-slate-400 mb-6 max-w-md mx-auto">
      V8 markets will appear here once deployed.
    </p>
  </div>
);

export default Markets;
