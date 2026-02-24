import React from 'react';
import type { LaunchpadMarket } from '../types';

interface StatsRowProps {
  markets?: LaunchpadMarket[];
}

export function StatsRow({ markets }: StatsRowProps) {
  const isLoading = markets === undefined;

  const totalMarkets = markets ? markets.length : 0;
  
  const totalDeposits = markets
    ? markets.reduce((acc, m) => acc + (parseFloat(m.deposit) || 0) / 1e6, 0)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

      <div className="relative group glass-panel p-8 rounded-lg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-4">Total Markets Indexed</div>
        {isLoading ? (
          <div className="h-10 w-24 bg-zinc-800/50 rounded skeleton-box" />
        ) : (
          <div className="text-4xl md:text-5xl font-mono text-zinc-100 tracking-tight">{totalMarkets}</div>
        )}
      </div>

      <div className="relative group glass-panel p-8 rounded-lg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-4">Total Deposits (USDC)</div>
        {isLoading ? (
          <div className="h-10 w-32 bg-zinc-800/50 rounded skeleton-box" />
        ) : (
          <div className="text-4xl md:text-5xl font-mono text-amber-500 tracking-tight">
            ${totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}
      </div>

      <div className="relative group glass-panel p-8 rounded-lg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-4">Active Protocol Nodes</div>
        <div className="flex items-center gap-4">
          <div className="text-4xl md:text-5xl font-mono text-zinc-100 tracking-tight">2</div>
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Base Sepolia
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Monad Testnet
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
