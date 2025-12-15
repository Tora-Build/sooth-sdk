import { Link } from 'react-router-dom';
import { Flame, TrendingUp, Zap, ChevronRight } from 'lucide-react';
import { Card } from '../../ui/Card';
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
  // Sort by bonding status (non-graduated first) and take top 5
  const trendingMarkets = [...markets]
    .filter(m => !m.isGraduated)
    .slice(0, 5);

  if (trendingMarkets.length === 0) {
    return null;
  }

  return (
    <Card className="p-6 border-fuchsia-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-fuchsia-950/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-white flex items-center gap-2">
          <Flame className="w-5 h-5 text-fuchsia-400" />
          Trending Now
        </h2>
        <Badge className="text-[10px] bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/50 animate-pulse">
          LIVE
        </Badge>
      </div>

      <div className="space-y-2">
        {trendingMarkets.map((market, index) => (
          <TrendingRow key={market.address} market={market} rank={index + 1} />
        ))}
      </div>

      {markets.filter(m => !m.isGraduated).length > 5 && (
        <Link
          to="/markets?filter=bonding"
          className="mt-4 flex items-center justify-center gap-2 py-2 text-sm text-fuchsia-400 hover:text-fuchsia-300 transition-colors"
        >
          View all bonding markets
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </Card>
  );
};

const TrendingRow = ({ market, rank }: { market: Market; rank: number }) => {
  const rankColors = {
    1: 'text-amber-400 bg-amber-500/20',
    2: 'text-slate-300 bg-slate-500/20',
    3: 'text-amber-600 bg-amber-600/20',
  };

  return (
    <Link
      to={`/market/${market.address}`}
      className="group flex items-center gap-4 p-3 rounded-lg hover:bg-slate-800/50 transition-colors"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
        rankColors[rank as keyof typeof rankColors] || 'text-slate-400 bg-slate-800'
      }`}>
        {rank}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate group-hover:text-cyan-400 transition-colors">
          {market.name}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-mono">{market.symbol}</span>
          <span>•</span>
          <span className="text-cyan-400">Bonding</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-sm font-mono text-white">--</div>
          <div className="text-[10px] text-slate-500">volume</div>
        </div>
        <TrendingUp className="w-4 h-4 text-emerald-400" />
      </div>
    </Link>
  );
};

