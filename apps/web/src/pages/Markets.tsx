import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, TrendingUp, Zap, Clock } from 'lucide-react';
import { useLaunchpadMarkets } from '../hooks/v5/useLaunchpadMarkets';
import { useChainStore } from '../store/useChainStore';
import { MarketCard } from '../components/features/market/MarketCard';
import { TrendingLeaderboard } from '../components/features/market/TrendingLeaderboard';
import { Card } from '../components/ui/Card';

export const Markets = () => {
  const { selectedChainId } = useChainStore();
  const { markets, isLoading } = useLaunchpadMarkets();
  const [filter, setFilter] = useState<'all' | 'bonding' | 'graduated'>('all');
  
  const filteredMarkets = useMemo(() => {
    if (!markets) return [];
    if (filter === 'all') return markets;
    if (filter === 'bonding') return markets.filter(m => !m.isGraduated);
    if (filter === 'graduated') return markets.filter(m => m.isGraduated);
    return markets;
  }, [markets, filter]);

  return (
    <div className="space-y-8">
      {/* Hero Stats Bar */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-magenta-500/5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-magenta-500/10 rounded-full blur-3xl" />
        
        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            icon={<Zap className="w-5 h-5" />}
            label="Active Markets"
            value={markets?.length || 0}
            accent="cyan"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Bonding"
            value={markets?.filter(m => !m.isGraduated).length || 0}
            accent="magenta"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Graduated"
            value={markets?.filter(m => m.isGraduated).length || 0}
            accent="emerald"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="24h Volume"
            value="$--"
            accent="amber"
          />
        </div>
      </div>

      {/* Trending Leaderboard */}
      <TrendingLeaderboard markets={markets || []} />

      {/* Filter + Create */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Markets</h2>
          <div className="flex items-center gap-1 ml-4 p-1 bg-slate-900/50 rounded-lg border border-slate-800">
            {(['all', 'bonding', 'graduated'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  filter === f
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        <Link
          to="/create"
          className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-bold text-sm rounded-lg transition-all hover:shadow-lg hover:shadow-cyan-500/25"
        >
          <Plus className="w-4 h-4" />
          <span>Create Market</span>
        </Link>
      </div>

      {/* Market Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-80 rounded-xl bg-slate-900/50 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.map(market => (
            <MarketCard
              key={market.address}
              address={market.address as `0x${string}`}
              name={market.name}
              symbol={market.symbol}
              isGraduated={market.isGraduated}
              deadline={market.deadline}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ 
  icon, 
  label, 
  value, 
  accent 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
  accent: 'cyan' | 'magenta' | 'emerald' | 'amber';
}) => {
  const accentClasses = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    magenta: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  };

  return (
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-xl border ${accentClasses[accent]}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
        <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
};

const EmptyState = () => (
  <div className="text-center py-20">
    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-900/50 border border-dashed border-slate-700 flex items-center justify-center">
      <Zap className="w-8 h-8 text-slate-600" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">No Markets Yet</h3>
    <p className="text-slate-400 mb-6 max-w-md mx-auto">
      Be the first to create a prediction market on this chain.
    </p>
    <Link
      to="/create"
      className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all"
    >
      <Plus className="w-5 h-5" />
      Create Market
    </Link>
  </div>
);

