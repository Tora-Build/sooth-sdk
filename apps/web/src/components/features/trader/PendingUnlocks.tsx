import React from 'react';
import { Clock, TrendingUp, Lock, CheckCircle2, Timer } from 'lucide-react';
import { useLockedFunds, LockEntry } from '../../../hooks/useLockedFunds';
import { useMarketStore } from '../../../store/useMarketStore';
import { formatUnits } from 'viem';
import { cn } from '../../../lib/utils';
import { PortfolioCard } from '../portfolio/PortfolioCard';

const LockEntryItem: React.FC<{ entry: LockEntry, decimals: number }> = ({ entry, decimals }) => {
  const formatUSD = (val: bigint) => {
    const num = parseFloat(formatUnits(val, decimals));
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return 'Ready';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className={cn(
      "flex items-center justify-between p-2.5 rounded-lg border transition-all",
      entry.isClaimable 
        ? "bg-emerald-500/5 border-emerald-500/20" 
        : "bg-slate-900/40 border-slate-800/50"
    )}>
      <div className="flex items-center gap-2">
        <div className={cn(
          "p-1 rounded",
          entry.isClaimable ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800/50 text-slate-500"
        )}>
          {entry.isClaimable ? <CheckCircle2 size={12} /> : <Timer size={12} />}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-mono font-bold text-white flex items-center gap-1.5">
            {formatUSD(entry.amount)}
            {entry.marketName && (
              <span className="text-[9px] font-mono text-slate-500 font-normal truncate max-w-[80px]">
                ({entry.marketName})
              </span>
            )}
          </div>
          <div className={cn(
            "text-[8px] uppercase tracking-tighter font-black",
            entry.isClaimable ? "text-emerald-500/60" : "text-slate-500"
          )}>
            {entry.isClaimable ? 'Available' : 'Locked'}
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className={cn(
          "text-[10px] font-bold",
          entry.isClaimable ? "text-emerald-400" : "text-amber-400/80"
        )}>
          {entry.isClaimable ? 'Ready' : formatTime(entry.timeRemaining)}
        </div>
        {!entry.isClaimable && (
          <div className="text-[8px] text-slate-600 font-mono leading-none">
            {new Date(entry.unlockTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Component to display and claim pending unlocked funds
 * V4.6: Sell proceeds are locked for 24h before they can be withdrawn (Lock-on-Sell)
 * Uses useLockedFunds hook for global TraderVault locked proceeds
 */
export const PendingUnlocks: React.FC = () => {
  const { mode } = useMarketStore();
  const { lockedFormatted, hasClaimable, claim, isClaiming, entries, decimals } = useLockedFunds();

  return (
    <PortfolioCard
        title="Pending Unlocks"
        icon={<Clock size={16} className="text-emerald-400" />}
        variant="emerald"
        badge={
            <div className="text-xs font-black text-emerald-400 font-mono">
                {lockedFormatted}
            </div>
        }
        itemCount={entries.length}
        emptyState={
            <div className="py-6 text-center flex flex-col items-center justify-center opacity-40">
                <Lock size={24} className="text-slate-600 mb-1" />
                <p className="text-[10px] font-mono">// no_pending_unlocks</p>
            </div>
        }
    >
        <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/10 mb-2">
            <p className="text-[9px] text-emerald-400/60 font-mono leading-tight">
                Funds from AMM sells are held for 24h to ensure settlement finality.
            </p>
        </div>
        {hasClaimable && (
            <button
                onClick={claim}
                disabled={isClaiming || mode === 'demo'}
                className="w-full py-2 rounded-lg bg-emerald-500 text-slate-900 font-black text-[10px] hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 uppercase tracking-widest mb-2"
            >
                <TrendingUp size={12} />
                {isClaiming ? 'Claiming...' : `Claim All`}
            </button>
        )}
        {entries.map((entry, idx) => (
            <LockEntryItem key={idx} entry={entry} decimals={decimals} />
        ))}
        {mode === 'demo' && entries.length > 0 && (
            <div className="p-2 rounded bg-amber-500/5 border border-amber-500/10 text-center">
                <p className="text-[9px] text-amber-400/60 font-mono italic">
                    💡 Demo Mode: Proceeds from AMM sells unlock after 24h
                </p>
            </div>
        )}
    </PortfolioCard>
  );
};
