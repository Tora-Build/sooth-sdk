import React from 'react';
import { formatUnits } from 'viem';
import { useTraderVault } from '../../hooks/useTraderVault';
import { useMarketStore } from '../../store/useMarketStore';

export const PortfolioSummary: React.FC = () => {
  const { mode } = useMarketStore();
  const { 
    userUsdcBalance, 
    availableBalance, 
    pendingBalance, 
    totalBalance, 
    decimals 
  } = useTraderVault();

  const formatValue = (value: bigint) => {
    return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
      <h3 className="text-lg font-heading font-semibold text-white mb-4">Portfolio Summary</h3>
      
      <div className="space-y-4">
        {/* Wallet Balance */}
        <div className="flex justify-between items-center p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
          <span className="text-slate-400 text-sm">Wallet Balance</span>
          <span className="text-white font-medium font-mono">
            {formatValue(userUsdcBalance)} <span className="text-slate-500 text-xs">USDC</span>
          </span>
        </div>

        {/* Available in Vault */}
        <div className="flex justify-between items-center p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
          <span className="text-slate-400 text-sm">Available to Trade</span>
          <span className="text-emerald-400 font-medium font-mono">
            {formatValue(availableBalance)} <span className="text-emerald-500/50 text-xs">USDC</span>
          </span>
        </div>

        {/* Pending / Locked */}
        <div className="flex justify-between items-center p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
          <span className="text-slate-400 text-sm">Pending / Locked</span>
          <span className="text-amber-400 font-medium font-mono">
            {formatValue(pendingBalance)} <span className="text-amber-500/50 text-xs">USDC</span>
          </span>
        </div>

        {/* Total Value */}
        <div className="pt-2 border-t border-slate-800">
          <div className="flex justify-between items-center">
            <span className="text-slate-300 font-medium">Total Vault Value</span>
            <span className="text-white font-bold font-mono text-lg">
              {formatValue(totalBalance)} <span className="text-slate-500 text-sm font-sans">USDC</span>
            </span>
          </div>
        </div>
      </div>
      
      {mode === 'demo' && (
        <div className="mt-4 text-xs text-center text-slate-500 bg-slate-800/30 py-1.5 rounded">
          Demo Mode • Virtual Funds
        </div>
      )}
    </div>
  );
};
