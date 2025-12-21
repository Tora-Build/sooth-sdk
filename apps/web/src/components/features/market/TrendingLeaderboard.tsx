import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { Badge } from '../../ui/Badge';

interface Market {
  address: string;
  name: string;
  symbol: string;
  isGraduated: boolean;
  deadline?: number;
}

interface TrendingLeaderboardProps {
  markets: Market[];
}

export const TrendingLeaderboard = ({ markets }: TrendingLeaderboardProps) => {
  // Take top 3 bonding markets
  const trendingMarkets = [...markets]
    .filter(m => !m.isGraduated)
    .slice(0, 3);

  if (trendingMarkets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-bold text-white flex items-center gap-2 text-sm">
          <Flame className="w-4 h-4 text-fuchsia-400" />
          Trending Now
        </h2>
        <Badge className="text-[9px] bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/50 animate-pulse">
          LIVE
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {trendingMarkets.map((market, index) => (
          <TrendingCard key={market.address} market={market} rank={index + 1} />
        ))}
      </div>
    </div>
  );
};

const TrendingCard = ({ market, rank }: { market: Market; rank: number }) => {
  const rankColors = {
    1: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    2: 'text-slate-300 border-slate-500/30 bg-slate-500/10',
    3: 'text-amber-600 border-amber-600/30 bg-amber-600/10',
  };

  return (
    <Link
      to={`/market/${market.address}`}
      className="group block p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-fuchsia-500/40 hover:bg-slate-800/50 transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs border ${
          rankColors[rank as keyof typeof rankColors] || 'text-slate-400 border-slate-700 bg-slate-800'
        }`}>
          {rank}
        </div>
        <Badge className="text-[8px] bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
          Bonding
        </Badge>
      </div>
      
      <div className="font-medium text-white text-sm truncate group-hover:text-cyan-400 transition-colors mb-1">
        {market.name}
      </div>
      <div className="text-xs text-slate-500 font-mono">
        {market.symbol}
      </div>
    </Link>
  );
};

