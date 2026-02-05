import { useState } from 'react';
import { Search as SearchIcon, TrendingUp, Zap, Globe, Cpu, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMarkets } from '../hooks/useMarkets';

const CATEGORIES = [
  { id: 'crypto', label: 'Crypto', icon: DollarSign, color: 'text-amber-400' },
  { id: 'tech', label: 'Tech', icon: Cpu, color: 'text-cyan-400' },
  { id: 'politics', label: 'Politics', icon: Globe, color: 'text-indigo-400' },
  { id: 'sports', label: 'Sports', icon: Zap, color: 'text-emerald-400' },
];

const TRENDING = [
  'Bitcoin $100k',
  'AI Regulation',
  'ETH ETF',
  'Fed Rate Cut',
  'Trump 2024',
];

export function Search() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { data: markets } = useMarkets();

  const filteredMarkets = markets?.filter((m) =>
    m.question.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="h-full w-full flex flex-col bg-mesh text-slate-100">
      <header className="shrink-0 pt-14 px-6 pb-4">
        <h1 className="text-2xl font-bold font-heading text-white mb-4">Discover</h1>
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets..."
            className="w-full pl-12 pr-4 py-4 rounded-2xl glass-panel border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-32">
        {query ? (
          <div className="space-y-3">
            <p className="text-[11px] text-white/40 uppercase font-bold tracking-widest mb-4">
              Results
            </p>
            {filteredMarkets && filteredMarkets.length > 0 ? (
              filteredMarkets.map((market) => (
                <button
                  key={market.address}
                  onClick={() => navigate(`/trade/${market.address}`)}
                  className="w-full p-4 rounded-2xl glass-panel text-left hover:bg-white/5 transition-colors"
                >
                  <p className="text-white font-medium line-clamp-2">{market.question}</p>
                  <p className="text-cyan-400 text-sm font-bold mt-2">
                    {Math.round((market.yesProbability ?? 0.5) * 100)}% YES
                  </p>
                </button>
              ))
            ) : (
              <p className="text-white/40 text-center py-8">No markets found</p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="text-[11px] text-white/40 uppercase font-bold tracking-widest mb-4">
                Categories
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map(({ id, label, icon: Icon, color }) => (
                  <button
                    key={id}
                    className="p-5 rounded-2xl glass-panel flex items-center gap-3 hover:bg-white/5 transition-colors"
                  >
                    <Icon className={`w-6 h-6 ${color}`} />
                    <span className="text-white font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-fuchsia-400" />
                <p className="text-[11px] text-white/40 uppercase font-bold tracking-widest">
                  Trending
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TRENDING.map((term) => (
                  <button
                    key={term}
                    onClick={() => setQuery(term)}
                    className="px-4 py-2 rounded-full glass-panel text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
