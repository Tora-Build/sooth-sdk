import React from 'react';
import { Card } from '../../ui/Card';
import { Wallet, Coins, Clock, Zap, RefreshCw } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useActivePositions } from '../../../hooks/useActivePositions';
import { useLPPositions } from '../../../hooks/useLPPositions';
import { useLockedFunds } from '../../../hooks/useLockedFunds';
import { formatCurrency } from '../../../utils/format';
import { formatUnits } from 'viem';

export const WalletSummaryCard: React.FC = () => {
  const { isConnected } = useAccount();

  // Wallet side data (No longer includes outcome tokens, those are in Orderbook domain)
  const { totalLPValueFormatted, isLoading: lpLoading, refetch: refetchLP } = useLPPositions();
  const { locked, lockedFormatted, isLoading: lockLoading, refetch: refetchLocked, decimals } = useLockedFunds();

  const handleRefresh = () => {
    refetchLP();
    refetchLocked();
  };

  const lpValueNum = parseFloat(totalLPValueFormatted || '0');
  const lockedValueNum = parseFloat(formatUnits(locked, decimals || 18)); 
  
  const totalWalletValue = lpValueNum + lockedValueNum;
  const isLoading = lpLoading || lockLoading;

  if (!isConnected) {
    return (
      <Card className="h-full border-slate-800 bg-slate-900/50 p-6 flex flex-col items-center justify-center text-center backdrop-blur-sm">
        <Wallet className="w-10 h-10 text-slate-600 mb-3" />
        <h3 className="text-sm font-medium text-slate-400">Connect Wallet</h3>
        <p className="text-xs text-slate-500 mt-1">Access your direct holdings</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col border-emerald-500/20 bg-emerald-950/30 backdrop-blur-xl shadow-2xl overflow-visible relative">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -translate-y-4 translate-x-4 pointer-events-none" />

      <div className="p-4 flex flex-col space-y-4 relative z-10">

        {/* Header: Overview */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <div className="text-xs text-emerald-400/80 uppercase tracking-widest font-bold flex items-center gap-1.5">
              Wallet & Liquidity
              <button
                onClick={handleRefresh}
                className="text-slate-600 hover:text-emerald-400 transition-colors"
                title="Refresh Balances"
              >
                <RefreshCw size={10} />
              </button>
            </div>
            <div className="text-xs text-slate-500 font-medium flex items-center gap-1" title="Connected Status">
              <Zap size={9} className="text-emerald-500" />
              Direct
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Total Value Big Number */}
            <div className="text-3xl font-bold text-white font-mono tracking-tighter drop-shadow-lg leading-none">
              {isLoading && totalWalletValue === 0 ? '--' : formatCurrency(totalWalletValue)}
            </div>

            {/* Sub-header or minor info */}
            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
              Direct Assets • Self-Custody
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-2 gap-1.5">

          {/* LP Value */}
          <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10 backdrop-blur-md">
            <div className="text-xs text-blue-400/60 uppercase tracking-widest font-bold mb-0.5 flex items-center gap-1">
              <Zap size={9} /> LP Value
            </div>
            <div className="text-base font-mono font-bold text-blue-400 leading-none">
              {formatCurrency(lpValueNum)}
            </div>
          </div>

          {/* Pending Unlocks */}
          <div className="p-2.5 rounded-lg bg-slate-500/5 border border-slate-500/10 backdrop-blur-md">
            <div className="text-xs text-slate-400/60 uppercase tracking-widest font-bold mb-0.5 flex items-center gap-1">
              <Clock size={9} /> Pending Unlocks
            </div>
            <div className="text-base font-mono font-bold text-slate-400 leading-none">
              {lockedFormatted}
            </div>
          </div>
        </div>

      </div>
    </Card>
  );
};
