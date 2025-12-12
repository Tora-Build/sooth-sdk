import React from 'react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { useVault } from '../../../hooks/useVault';
import { useMarketStore } from '../../../store/useMarketStore';
import { useChainStore } from '../../../store/useChainStore';
import { allowedChains } from '../../../lib/chains';
import { formatUnits } from 'viem';

export const VaultStats: React.FC = () => {
  const { totalAssets, totalLocked, sharePrice, apy, isLoading } = useVault();
  const { mode } = useMarketStore();
  const { selectedChainId } = useChainStore();

  const chainLabel = allowedChains.find((c) => c.id === selectedChainId)?.displayName || 'Unknown network';

  const formatCurrency = (val: bigint) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(parseFloat(formatUnits(val, 18)));

  return (
    <Card variant="premium" className="bg-gradient-to-br from-indigo-900/20 to-slate-900/50 border-indigo-500/20">
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-heading font-bold text-2xl text-white">Governor Vault</h3>
            <span className="text-sm text-slate-400">({mode === 'demo' ? 'Demo' : chainLabel})</span>
          </div>
          <p className="text-slate-400 text-sm">
            LP liquidity pool providing depth to all prediction markets.
          </p>
        </div>
        <Badge variant="live" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1">
          APY: {apy}%
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 transition-all duration-200 group">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1 group-hover:text-indigo-400 transition-colors">TVL</div>
          <div className="text-xl font-mono font-medium text-white">
            {isLoading ? '...' : formatCurrency(totalAssets)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 transition-all duration-200 group">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1 group-hover:text-indigo-400 transition-colors">Share Price</div>
          <div className="text-xl font-mono font-medium text-white">
            {isLoading ? '...' : sharePrice.toFixed(4)} USDC
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 transition-all duration-200 group">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1 group-hover:text-indigo-400 transition-colors">Available to Withdraw</div>
          <div className="text-xl font-mono font-medium text-blue-400">
            {isLoading ? '...' : formatCurrency(totalAssets - (totalLocked || 0n))}
          </div>
        </div>
      </div>
    </Card>
  );
};
