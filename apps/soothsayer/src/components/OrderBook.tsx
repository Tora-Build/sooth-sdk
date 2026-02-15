import { useMemo } from 'react';

export interface OrderLevel {
  tick: number;      // 1-999
  price: number;     // tick/1000
  amount: bigint;    // shares at this tick
  count: number;     // number of orders
}

interface OrderBookProps {
  yesBids: OrderLevel[];
  noBids: OrderLevel[];
  maxLevels?: number;
}

export function OrderBook({ yesBids, noBids, maxLevels = 10 }: OrderBookProps) {
  const { yesLevels, noLevels, maxAmount } = useMemo(() => {
    // Sort YES bids descending (best bid first)
    const sortedYes = [...yesBids].sort((a, b) => b.tick - a.tick).slice(0, maxLevels);
    // Sort NO bids descending (best bid first)
    const sortedNo = [...noBids].sort((a, b) => b.tick - a.tick).slice(0, maxLevels);

    const allAmounts = [...sortedYes, ...sortedNo].map(l => Number(l.amount));
    const max = Math.max(...allAmounts, 1);

    return { yesLevels: sortedYes, noLevels: sortedNo, maxAmount: max };
  }, [yesBids, noBids, maxLevels]);

  const bestYes = yesLevels[0];
  const bestNo = noLevels[0];
  const canMatch = bestYes && bestNo && (bestYes.tick + bestNo.tick >= 1000);
  const impliedPrice = bestYes ? (bestYes.price * 100).toFixed(1) : '--';

  return (
    <div className="bg-[#1a1a1b] rounded-2xl border border-[#333] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#333] flex items-center justify-between">
        <span className="text-xs font-bold text-[#888] uppercase tracking-wide">Order Book</span>
        <div className="flex items-center gap-2">
          {canMatch && (
            <span className="text-[10px] font-bold text-[#00d4aa] bg-[#00d4aa]/10 px-2 py-0.5 rounded-full">
              MATCHABLE
            </span>
          )}
          <span className="text-xs font-mono text-white font-bold">{impliedPrice}%</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 px-4 py-1.5 text-[10px] font-bold text-[#555] uppercase tracking-wider border-b border-[#222]">
        <span>Size</span>
        <span className="text-center">Price</span>
        <span className="text-right">Size</span>
      </div>

      {/* Book */}
      <div className="relative">
        {/* YES bids (green, left side) */}
        <div className="border-b border-[#333]">
          <div className="px-4 py-1 text-[10px] font-bold text-[#00d4aa]/60 uppercase tracking-wider">
            YES Bids
          </div>
          {yesLevels.length === 0 ? (
            <div className="px-4 py-3 text-xs text-[#555] text-center">No bids</div>
          ) : (
            yesLevels.map((level) => (
              <div key={`yes-${level.tick}`} className="relative px-4 py-1 flex items-center">
                {/* Bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-[#00d4aa]/10"
                  style={{ width: `${(Number(level.amount) / maxAmount) * 100}%` }}
                />
                <div className="relative grid grid-cols-3 w-full text-xs font-mono">
                  <span className="text-[#00d4aa] font-bold">
                    {formatAmount(level.amount)}
                  </span>
                  <span className="text-center text-white">
                    {(level.price * 100).toFixed(1)}¢
                  </span>
                  <span className="text-right text-[#555]">
                    {level.count > 1 ? `${level.count}` : ''}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Spread indicator */}
        {bestYes && bestNo && (
          <div className="px-4 py-1.5 bg-[#111] border-y border-[#333] flex items-center justify-between">
            <span className="text-[10px] text-[#555]">Spread</span>
            <span className="text-xs font-mono text-[#888]">
              {((1000 - bestYes.tick - bestNo.tick) / 10).toFixed(1)}%
            </span>
          </div>
        )}

        {/* NO bids (red, right side) */}
        <div>
          <div className="px-4 py-1 text-[10px] font-bold text-[#e01b24]/60 uppercase tracking-wider">
            NO Bids
          </div>
          {noLevels.length === 0 ? (
            <div className="px-4 py-3 text-xs text-[#555] text-center">No bids</div>
          ) : (
            noLevels.map((level) => (
              <div key={`no-${level.tick}`} className="relative px-4 py-1 flex items-center">
                {/* Bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-[#e01b24]/10"
                  style={{ width: `${(Number(level.amount) / maxAmount) * 100}%` }}
                />
                <div className="relative grid grid-cols-3 w-full text-xs font-mono">
                  <span className="text-[#555]">
                    {level.count > 1 ? `${level.count}` : ''}
                  </span>
                  <span className="text-center text-white">
                    {(level.price * 100).toFixed(1)}¢
                  </span>
                  <span className="text-right text-[#e01b24] font-bold">
                    {formatAmount(level.amount)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatAmount(amount: bigint): string {
  const num = Number(amount) / 1e18;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  if (num >= 1) return num.toFixed(0);
  return num.toFixed(2);
}
