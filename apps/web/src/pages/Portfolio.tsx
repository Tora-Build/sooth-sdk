import { Wallet, History, ShieldCheck } from 'lucide-react';
import { TradingAccountCard } from '../components/features/portfolio/TradingAccountCard';
import { WalletSummaryCard } from '../components/features/portfolio/WalletSummaryCard';
import { LPPositionsCard } from '../components/features/portfolio/LPPositionsCard';
import { VaultPositionsCard } from '../components/features/portfolio/VaultPositionsCard';
// OrderbookTokensCard removed - wallet ERC1155 tokens ignored for now (OB uses Trading Account)
import { ActiveOrdersCard } from '../components/features/portfolio/ActiveOrdersCard';
import { PendingUnlocks } from '../components/features/trader/PendingUnlocks';
import { ActivityLog } from '../components/features/ActivityLog';
import { useAccount } from 'wagmi';

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
    <div className="space-y-12 pb-24 max-w-6xl mx-auto pt-8 px-4">
      {/* Domain Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        
        {/* Domain A: Orderbook Account (Custodial) */}
        <div className="flex flex-col gap-6 animate-fade-in-up">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                <ShieldCheck size={16} className="text-indigo-400" />
            </div>
            <div>
                <h2 className="font-black text-white uppercase tracking-[0.25em] text-[11px] leading-none">Orderbook Account</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-[9px] text-indigo-400/50 font-bold uppercase tracking-widest">Custodial Vault</p>
                  <span className="w-1 h-1 rounded-full bg-indigo-500/30" />
                  <p className="text-[9px] text-indigo-400/50 font-bold uppercase tracking-widest">Isolated Margin</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">System Online</span>
            </div>
          </div>
          
          <div className="space-y-5">
            <TradingAccountCard />
            <VaultPositionsCard />
            <ActiveOrdersCard />
          </div>
            </div>

        {/* Domain B: Wallet & AMM (Direct) */}
        <div className="flex flex-col gap-6 animate-fade-in-up stagger-1">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                <Wallet size={16} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="font-black text-white uppercase tracking-[0.25em] text-[11px] leading-none">Wallet & AMM</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-[9px] text-emerald-400/50 font-bold uppercase tracking-widest">Direct Ownership</p>
                  <span className="w-1 h-1 rounded-full bg-emerald-500/30" />
                  <p className="text-[9px] text-emerald-400/50 font-bold uppercase tracking-widest">LP Provisioning</p>
            </div>
          </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Mainnet Assets</span>
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
