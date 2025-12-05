import React from 'react';
import { Card } from '../../ui/Card';
import { useMarket } from '../../../hooks/useMarket';

interface MarketChartProps {
  marketId: string;
}

export const MarketChart: React.FC<MarketChartProps> = ({ marketId }) => {
  const { market } = useMarket(marketId);
  const probYes = (market?.priceYes || 0.5) * 100;

  return (
    <Card className="h-[300px] flex flex-col relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/50 z-10" />
      
      {/* Header */}
      <div className="relative z-20 flex justify-between items-start">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">Implied Probability</div>
          <div className="text-3xl font-bold text-white flex items-baseline gap-2">
            {probYes.toFixed(1)}%
            <span className="text-sm font-normal text-emerald-400">+2.4%</span>
          </div>
        </div>
        <div className="flex gap-2">
          {['1H', '1D', '1W', 'ALL'].map((tf) => (
            <button 
              key={tf}
              className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${tf === '1D' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Visual (Placeholder) */}
      <div className="flex-1 mt-4 relative">
        {/* Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-slate-600">
          <div className="border-t border-slate-800/50 w-full pt-1">0.80</div>
          <div className="border-t border-slate-800/50 w-full pt-1">0.60</div>
          <div className="border-t border-slate-800/50 w-full pt-1">0.40</div>
          <div className="border-t border-slate-800/50 w-full pt-1">0.20</div>
        </div>

        {/* Line */}
        <svg className="absolute inset-0 w-full h-full z-10 overflow-visible" preserveAspectRatio="none">
          <path
            d="M0,150 C100,140 200,160 300,100 C400,40 500,80 600,60"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            className="drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          />
          <path
            d="M0,150 C100,140 200,160 300,100 C400,40 500,80 600,60 V300 H0 Z"
            fill="url(#gradient)"
            opacity="0.2"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </Card>
  );
};
