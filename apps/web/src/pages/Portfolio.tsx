import { Wallet, History, ShieldCheck, Clock } from 'lucide-react';
import { TradingAccountCard } from '../components/features/portfolio/TradingAccountCard';
import { WalletSummaryCard } from '../components/features/portfolio/WalletSummaryCard';
import { LPPositionsCard } from '../components/features/portfolio/LPPositionsCard';
import { VaultPositionsCard } from '../components/features/portfolio/VaultPositionsCard';
// OrderbookTokensCard removed - wallet ERC1155 tokens ignored for now (OB uses Trading Account)
import { ActiveOrdersCard } from '../components/features/portfolio/ActiveOrdersCard';
import { PendingUnlocks } from '../components/features/trader/PendingUnlocks';
import { ActivityLog } from '../components/features/ActivityLog';
import { useAccount } from 'wagmi';
import { useLockedFunds } from '../hooks/useLockedFunds';
import { formatCurrency } from '../utils/format';
import { formatUnits } from 'viem';

export const Portfolio = () => {
  const { isConnected } = useAccount();
  const { locked, claimable, available, total, hasClaimable, claim, isClaiming, decimals } = useLockedFunds();

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
    <div className="space-y-12 pb-24 max-w-6xl mx-auto pt-8 px-4">
      {/* Portfolio Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm">
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Total Equity</p>
          <p className="text-2xl font-bold text-white font-mono">{formatCurrency(parseFloat(formatUnits(total, decimals || 18)))}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock size={32} className="text-amber-400" />
          </div>
          <p className="text-[10px] text-amber-500/70 uppercase font-black tracking-widest mb-1">Total Locked</p>
          <p className="text-2xl font-bold text-amber-400 font-mono">{formatCurrency(parseFloat(formatUnits(locked, decimals || 18)))}</p>
          <p className="text-[9px] text-slate-500 mt-1 font-medium">Proceeds in 24h cooling period</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] text-emerald-500/70 uppercase font-black tracking-widest mb-1">Claimable Now</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono">{formatCurrency(parseFloat(formatUnits(claimable, decimals || 18)))}</p>
          </div>
          {hasClaimable && (
            <button
              onClick={claim}
              disabled={isClaiming}
              className="mt-2 py-1.5 rounded-lg bg-emerald-500 text-slate-900 font-black text-[9px] hover:bg-emerald-400 transition-all uppercase tracking-widest"
            >
              {isClaiming ? 'Claiming...' : 'Claim All'}
            </button>
          )}
        </div>
      </div>

      {/* Domain Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        
        {/* Domain A: Trading Account (Unified) */}
        <div className="flex flex-col gap-6 animate-fade-in-up">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                <ShieldCheck size={16} className="text-indigo-400" />
            </div>
            <div>
                <h2 className="font-black text-white uppercase tracking-[0.25em] text-[11px] leading-none">Trading Account</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-[9px] text-indigo-400/50 font-bold uppercase tracking-widest">Universal Vault</p>
                  <span className="w-1 h-1 rounded-full bg-indigo-500/30" />
                  <p className="text-[9px] text-indigo-400/50 font-bold uppercase tracking-widest">V7 Dual-Engine</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-5">
            <TradingAccountCard />
            <VaultPositionsCard />
            <ActiveOrdersCard />
          </div>
            </div>

        {/* Domain B: Wallet & Liquidity */}
        <div className="flex flex-col gap-6 animate-fade-in-up stagger-1">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                <Wallet size={16} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="font-black text-white uppercase tracking-[0.25em] text-[11px] leading-none">Wallet & Liquidity</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-[9px] text-emerald-400/50 font-bold uppercase tracking-widest">Self-Custody</p>
                  <span className="w-1 h-1 rounded-full bg-emerald-500/30" />
                  <p className="text-[9px] text-emerald-400/50 font-bold uppercase tracking-widest">LP Equity</p>
                  <span className="w-1 h-1 rounded-full bg-emerald-500/30" />
                  <p className="text-[9px] text-emerald-400/50 font-bold uppercase tracking-widest">AMM Rewards</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <WalletSummaryCard />
            <LPPositionsCard />
            <PendingUnlocks />
          </div>
        </div>

      </div>

      {/* Global History */}
      <div className="pt-12 mt-8 border-t border-slate-800/50 animate-fade-in-up stagger-2">
        <div className="flex items-center justify-between px-1 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <History size={16} className="text-slate-400" />
            </div>
            <div>
              <h2 className="font-black text-slate-200 uppercase tracking-[0.25em] text-[11px] leading-none">Activity History</h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1.5">Global Transaction & Trade Log</p>
            </div>
          </div>
          <div className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">
            Last 50 Events
      </div>
        </div>
        <div className="max-w-4xl mx-auto">
          <ActivityLog />
        </div>
      </div>
    </div>
  );
};
