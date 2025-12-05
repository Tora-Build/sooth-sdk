import React from 'react';
import { useMarket } from '../../../hooks/useMarket';
import { Card } from '../../ui/Card';
import { cn } from '../../../lib/utils';

interface PositionCardProps {
  marketId: string;
}

export const PositionCard: React.FC<PositionCardProps> = ({ marketId }) => {
  const { market } = useMarket(marketId);

  const hasPosition = (market?.userYesShares || 0) > 0 || (market?.userNoShares || 0) > 0;
  
  const yesValue = (market?.userYesShares || 0) * (market?.priceYes || 0);
  const noValue = (market?.userNoShares || 0) * (market?.priceNo || 0);
  const totalValue = yesValue + noValue;

  if (!hasPosition) {
    return (
      <Card className="bg-slate-900/30 border-dashed border-slate-800 flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
          <span className="text-2xl">👻</span>
        </div>
        <p className="text-sm text-slate-400 font-medium">No active positions</p>
        <p className="text-xs text-slate-600 mt-1">Trade to see your portfolio here</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-lg">My Position</h3>
        <div className="text-right">
          <div className="text-xs text-slate-500">Total Value</div>
          <div className="text-xl font-bold text-white font-mono">${totalValue.toFixed(2)}</div>
        </div>
      </div>
      
      <div className="space-y-2">
        {/* YES Position */}
        {(market?.userYesShares || 0) > 0 && (
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-emerald-500" />
                <div className="font-bold text-emerald-400 text-sm">YES</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-white font-mono">${yesValue.toFixed(2)}</div>
                <div className="text-xs text-slate-500">{market?.userYesShares?.toFixed(2)} shares</div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Current Price</span>
              <span className="font-mono">${(market?.priceYes || 0).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* NO Position */}
        {(market?.userNoShares || 0) > 0 && (
          <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-rose-500" />
                <div className="font-bold text-rose-400 text-sm">NO</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-white font-mono">${noValue.toFixed(2)}</div>
                <div className="text-xs text-slate-500">{market?.userNoShares?.toFixed(2)} shares</div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Current Price</span>
              <span className="font-mono">${(market?.priceNo || 0).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
