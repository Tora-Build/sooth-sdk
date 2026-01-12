import React, { useRef, useEffect, useMemo } from 'react';
import { formatUnits } from 'viem';
import { cn } from '../../../lib/utils';

interface Tick {
  index: number;
  yesDepth: bigint;
  noDepth: bigint;
}

interface TickLadderProps {
  currentTick: number;
  bids: Tick[];
  asks: Tick[];
  onTickClick?: (tick: number, side: 'buy' | 'sell') => void;
}

export const TickLadder: React.FC<TickLadderProps> = ({
  currentTick,
  bids,
  asks,
  onTickClick
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate a range of ticks around currentTick
  // Let's show 25 ticks above and 25 ticks below
  const ladderTicks = useMemo(() => {
    const ticks = [];
    const range = 25;
    for (let i = currentTick + range; i >= currentTick - range; i--) {
      if (i < 0 || i > 9999) continue;
      
      const bidData = bids.find(b => b.index === i);
      const askData = asks.find(a => a.index === i);
      
      ticks.push({
        index: i,
        price: i / 10000,
        yesDepth: bidData?.yesDepth ?? 0n,
        noDepth: askData?.noDepth ?? 0n,
        isCurrent: i === currentTick
      });
    }
    return ticks;
  }, [currentTick, bids, asks]);

  // Auto-scroll to center on currentTick
  useEffect(() => {
    if (scrollRef.current) {
      const centerRow = scrollRef.current.querySelector('[data-current="true"]');
      if (centerRow) {
        centerRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [currentTick]);

  const formatLiquidity = (val: bigint) => {
    const num = Number(formatUnits(val, 18));
    if (num === 0) return '';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toFixed(0);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="grid grid-cols-3 bg-slate-900/80 border-b border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-widest py-2 px-3 text-center">
        <span>YES Depth</span>
        <span>Price (Tick)</span>
        <span>NO Depth</span>
      </div>

      {/* Rows */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto no-scrollbar scroll-smooth"
      >
        {ladderTicks.map((tick) => (
          <div
            key={tick.index}
            data-current={tick.isCurrent}
            className={cn(
              "grid grid-cols-3 text-xs border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors group cursor-pointer",
              tick.isCurrent && "bg-cyan-500/10 border-y border-cyan-500/30"
            )}
          >
            {/* YES Side (Bids) */}
            <div 
              onClick={() => onTickClick?.(tick.index, 'buy')}
              className="py-1 px-3 text-emerald-400 font-mono text-right relative overflow-hidden"
            >
              {tick.yesDepth > 0n && (
                <div 
                  className="absolute inset-y-0 right-0 bg-emerald-500/5 transition-all"
                  style={{ width: `${Math.min(100, Number(tick.yesDepth / 10n ** 18n) / 10)}%` }}
                />
              )}
              <span className="relative z-10">{formatLiquidity(tick.yesDepth)}</span>
            </div>

            {/* Price/Tick */}
            <div className="py-1 px-2 text-center border-x border-slate-800/50 flex flex-col items-center justify-center">
              <span className={cn(
                "font-bold",
                tick.isCurrent ? "text-cyan-400" : "text-slate-300"
              )}>
                {tick.price.toFixed(4)}
              </span>
              <span className="text-xs text-slate-600 font-mono">#{tick.index}</span>
            </div>

            {/* NO Side (Asks) */}
            <div 
              onClick={() => onTickClick?.(tick.index, 'sell')}
              className="py-1 px-3 text-rose-400 font-mono text-left relative overflow-hidden"
            >
              {tick.noDepth > 0n && (
                <div 
                  className="absolute inset-y-0 left-0 bg-rose-500/5 transition-all"
                  style={{ width: `${Math.min(100, Number(tick.noDepth / 10n ** 18n) / 10)}%` }}
                />
              )}
              <span className="relative z-10">{formatLiquidity(tick.noDepth)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="bg-slate-900/50 border-t border-slate-800 p-2 text-xs text-slate-500 flex justify-between items-center">
        <span>BITMAP: ACTIVE</span>
        <div className="flex gap-2">
          <span className="text-emerald-500/50">● BUY</span>
          <span className="text-rose-500/50">● SELL</span>
        </div>
      </div>
    </div>
  );
};

