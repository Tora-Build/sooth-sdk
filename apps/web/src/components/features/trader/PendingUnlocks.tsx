import React from 'react';
import { Card } from '../../ui/Card';
import { Clock, TrendingUp } from 'lucide-react';
import { useLockedFunds } from '../../../hooks/useLockedFunds';
import { useMarketStore } from '../../../store/useMarketStore';

/**
 * Component to display and claim pending unlocked funds
 * V4.6: Sell proceeds are locked for 24h before they can be withdrawn (Lock-on-Sell)
 * Uses useLockedFunds hook for global TraderVault locked proceeds
 */
export const PendingUnlocks: React.FC = () => {
  const { mode } = useMarketStore();
  const { locked, lockedFormatted, hasClaimable, claim, isClaiming } = useLockedFunds();

  // Don't show if no locked proceeds
  if (!locked || locked === 0n) {
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
                {lockedFormatted}
              </span>
            </div>
            
            <p className="text-xs text-slate-400">
              {mode === 'demo' 
                ? 'Funds from sells are locked for 24 hours' 
                : 'Proceeds from sells unlock after 24 hours'}
            </p>
          </div>
        </div>

        <button
          onClick={claim}
          disabled={!hasClaimable || isClaiming || mode === 'demo'}
          className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-medium text-sm hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          title={mode === 'demo' ? 'Demo mode - no actual claiming' : (hasClaimable ? 'Claim unlocked funds' : 'No funds ready to claim yet')}
        >
          <TrendingUp size={14} />
          {isClaiming ? 'Claiming...' : (hasClaimable ? 'Claim Now' : 'Locked')}
        </button>
      </div>

      {mode === 'demo' && (
        <div className="mt-3 pt-3 border-t border-amber-500/20">
          <p className="text-xs text-amber-400/60">
            💡 Demo Mode: In production, you can claim funds after the 24h lock period
          </p>
        </div>
      )}
    </Card>
  );
};
