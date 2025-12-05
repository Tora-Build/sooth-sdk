import React from 'react';
import { Card } from '../../ui/Card';
import { Clock, TrendingUp } from 'lucide-react';
import { useTraderVault } from '../../../hooks/useTraderVault';
import { formatUnits } from 'viem';
import { useMarketStore } from '../../../store/useMarketStore';

/**
 * Component to display and claim pending unlocked funds
 * V3: Sell proceeds are locked for 48h before they can be withdrawn
 */
export const PendingUnlocks: React.FC = () => {
  const { mode } = useMarketStore();
  const { pendingBalance, claimUnlocked, isPending } = useTraderVault();

  const pendingAmount = Number(formatUnits(pendingBalance, 18));

  // Don't show if no pending balance
  if (pendingAmount === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="text-amber-400" size={16} />
            <h3 className="text-sm font-medium text-amber-400">Pending Unlocks</h3>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">
                ${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-slate-400">USDC</span>
            </div>
            
            <p className="text-xs text-slate-400">
              {mode === 'demo' 
                ? 'Funds from sells are locked for 48 hours' 
                : 'Proceeds from sells unlock after 48 hours'}
            </p>
          </div>
        </div>

        <button
          onClick={claimUnlocked}
          disabled={isPending || mode === 'demo'}
          className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-medium text-sm hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          title={mode === 'demo' ? 'Demo mode - no actual claiming' : 'Claim unlocked funds'}
        >
          <TrendingUp size={14} />
          {isPending ? 'Claiming...' : 'Claim Now'}
        </button>
      </div>

      {mode === 'demo' && (
        <div className="mt-3 pt-3 border-t border-amber-500/20">
          <p className="text-xs text-amber-400/60">
            💡 Demo Mode: In production, you can claim funds after the 48h lock period
          </p>
        </div>
      )}
    </Card>
  );
};
