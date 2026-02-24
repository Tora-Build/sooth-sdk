import React from 'react';
import type { LaunchpadMarket } from '../types';

interface StatsRowProps {
  markets?: LaunchpadMarket[];
}

export function StatsRow({ markets }: StatsRowProps) {
  const isLoading = markets === undefined;

  const graduatedCount = markets ? markets.filter((m) => m.isGraduated).length : 0;
  
  const totalDeposits = markets
    ? markets.reduce((acc, m) => acc + (parseFloat(m.deposit) || 0) / 1e6, 0)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

      <div className="bg-zinc-900/50 border border-zinc-800/50 backdrop-blur rounded-xl p-6">
        <h3 className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-3">
          Graduated Markets
        </h3>
        {isLoading ? (
          <div className="h-8 w-24 bg-zinc-800/50 animate-pulse rounded skeleton-box" />
        ) : (
          <div className="text-3xl font-mono text-zinc-100">{graduatedCount}</div>
        )}
      </div>


      <div className="bg-zinc-900/50 border border-zinc-800/50 backdrop-blur rounded-xl p-6">
        <h3 className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-3">
          Total Deposits
        </h3>
        {isLoading ? (
          <div className="h-8 w-24 bg-zinc-800/50 animate-pulse rounded skeleton-box" />
        ) : (
          <div className="text-3xl font-mono text-cyan-400">
            ${totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}
      </div>


      <div className="bg-zinc-900/50 border border-zinc-800/50 backdrop-blur rounded-xl p-6">
        <h3 className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-3">
          Protocol Nodes
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-mono text-zinc-100">1</span>
          <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider">
            Base Sepolia
          </span>
        </div>
      </div>
    </div>
  );
}
