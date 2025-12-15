import { Wallet, TrendingUp, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TradingAccountCard } from '../components/features/portfolio/TradingAccountCard';
import { ActivePositionsCard } from '../components/features/portfolio/ActivePositionsCard';
import { PendingUnlocks } from '../components/features/trader/PendingUnlocks';
import { Card } from '../components/ui/Card';
import { useAccount } from 'wagmi';
import { Link } from 'react-router-dom';

export const Portfolio = () => {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-900/50 border border-slate-700 flex items-center justify-center">
          <Wallet className="w-8 h-8 text-slate-600" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-slate-400 mb-6">
          Connect a wallet to view your portfolio and positions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Portfolio</h1>
          <p className="text-slate-400 text-sm">Manage your positions and funds</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-cyan-500/20">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
              <Wallet className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white tabular-nums">$0.00</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Total Value</div>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-emerald-500/20">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400 tabular-nums flex items-center gap-2">
                +$0.00
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Unrealized P&L</div>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-amber-500/20">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white tabular-nums">$0.00</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Pending Unlock</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <TradingAccountCard />
        </div>
        <div className="lg:col-span-3">
          <ActivePositionsCard />
        </div>
      </div>

      {/* Pending Unlocks */}
      <Card className="p-6">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          Pending Unlocks
        </h3>
        <PendingUnlocks />
      </Card>

      {/* Activity */}
      <Card className="p-6">
        <h3 className="font-bold text-white mb-4">Recent Activity</h3>
        <div className="text-center py-12 text-slate-500 font-mono text-sm">
          // activity_log.fetch()
        </div>
      </Card>
    </div>
  );
};

