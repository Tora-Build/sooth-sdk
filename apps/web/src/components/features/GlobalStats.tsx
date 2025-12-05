import React from 'react';
import { Card } from '../ui/Card';
import { useProtocolStats } from '../../hooks/useProtocolStats';
import { useMarketStore } from '../../store/useMarketStore';
import { Activity, Database, Lock, Layers } from 'lucide-react';

export const GlobalStats: React.FC = () => {
  const { mode } = useMarketStore();
  const { totalTVL, lockedLiquidity, marketCount, poolCount, isLoading } = useProtocolStats();

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const stats = [
    {
      label: 'Markets',
      value: marketCount,
      subtext: 'Active markets',
      icon: Layers,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10'
    },
    {
      label: poolCount === 1 ? 'Vault' : 'Vaults',
      value: poolCount,
      subtext: 'Unique adjudicator types',
      icon: Database,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10'
    },
    {
      label: 'Total TVL',
      value: (isLoading && !totalTVL) ? '...' : formatCurrency(totalTVL || 0),
      subtext: 'Across all vaults',
      icon: Activity,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10'
    },
    {
      label: 'Locked Liquidity',
      value: (isLoading && !lockedLiquidity) ? '...' : formatCurrency(lockedLiquidity || 0),
      subtext: 'Reserved for positions',
      icon: Lock,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, i) => (
        <Card key={i} className="flex items-center gap-4 p-4 border-slate-800/60 bg-slate-900/40 backdrop-blur-none">
          <div className={`p-3 rounded-xl ${stat.bg}`}>
            <stat.icon className={`w-6 h-6 ${stat.color}`} />
          </div>
          <div>
            <div className="text-2xl font-mono font-bold text-white tracking-tight">
              {stat.value}
            </div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {stat.label}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
