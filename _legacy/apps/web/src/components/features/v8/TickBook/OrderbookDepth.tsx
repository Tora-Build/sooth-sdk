import React, { useMemo } from 'react';
import { formatUnits } from 'viem';

interface Tick {
  index: number;
  yesDepth: bigint;
  noDepth: bigint;
}

interface OrderbookDepthProps {
  bids: Tick[];
  asks: Tick[];
}

export const OrderbookDepth: React.FC<OrderbookDepthProps> = ({ bids, asks }) => {
  const chartData = useMemo(() => {
    // Cumulative depth for bids (sorted by index descending)
    let bidTotal = 0n;
    const bidSeries = bids.map(b => {
      bidTotal += b.yesDepth;
      return {
        price: b.index / 10000,
        total: Number(formatUnits(bidTotal, 18))
      };
    });

    // Cumulative depth for asks (sorted by index ascending)
    let askTotal = 0n;
    const askSeries = asks.map(a => {
      askTotal += a.noDepth;
      return {
        price: a.index / 10000,
        total: Number(formatUnits(askTotal, 18))
      };
    });

    const maxTotal = Math.max(
      Number(formatUnits(bidTotal, 18)),
      Number(formatUnits(askTotal, 18)),
      1 // avoid div by 0
    );

    return { bidSeries, askSeries, maxTotal };
  }, [bids, asks]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Market Depth</h4>
        <div className="flex gap-4 text-[9px] font-mono">
          <span className="text-emerald-500">BIDS: {formatUnits(bids.reduce((acc, b) => acc + b.yesDepth, 0n), 18).split('.')[0]}</span>
          <span className="text-rose-500">ASKS: {formatUnits(asks.reduce((acc, a) => acc + a.noDepth, 0n), 18).split('.')[0]}</span>
        </div>
      </div>

      <div className="flex-1 relative bg-slate-950/50 rounded-lg border border-slate-900 overflow-hidden flex items-end">
        {/* Bids Mountain (Left) */}
        <div className="flex-1 h-full flex items-end justify-end">
          {chartData.bidSeries.map((point, i) => (
            <div
              key={i}
              className="bg-emerald-500/20 border-t border-emerald-500/50"
              style={{
                width: `${100 / chartData.bidSeries.length}%`,
                height: `${(point.total / chartData.maxTotal) * 100}%`,
              }}
              title={`Price: ${point.price.toFixed(4)}, Total: ${point.total.toFixed(2)}`}
            />
          ))}
        </div>

        {/* Asks Mountain (Right) */}
        <div className="flex-1 h-full flex items-end justify-start border-l border-slate-800">
          {chartData.askSeries.map((point, i) => (
            <div
              key={i}
              className="bg-rose-500/20 border-t border-rose-500/50"
              style={{
                width: `${100 / chartData.askSeries.length}%`,
                height: `${(point.total / chartData.maxTotal) * 100}%`,
              }}
              title={`Price: ${point.price.toFixed(4)}, Total: ${point.total.toFixed(2)}`}
            />
          ))}
        </div>

        {/* Center Line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/10" />
      </div>
    </div>
  );
};

