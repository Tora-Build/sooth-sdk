/**
 * LiquidityMap - Visual liquidity depth chart for SoothBook orderbook
 * 
 * Shows bid/ask liquidity distribution across price ticks with
 * animated pixel blocks. Displays current price indicators for
 * both AMM and SoothBook prices.
 */
import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { formatUnits, parseUnits } from 'viem';
import { cn } from '../../../lib/utils';

// ============================================================================
// Types
// ============================================================================
export interface TickData {
  tick: number;
  liquidity: bigint;
}

export interface V12Order {
  id: string;
  yesPrice: string;
  amount: string;
  side: 'bid' | 'ask';
}

export interface LiquidityMapProps {
  bids?: V12Order[];
  asks?: V12Order[];
  currentProb: number;
  ammProb: number;
  isLoading: boolean;
  viewOutcome: 'yes' | 'no';
}

// ============================================================================
// Component
// ============================================================================
export const LiquidityMap = ({ 
  bids,
  asks,
  currentProb, 
  ammProb, 
  isLoading, 
  viewOutcome 
}: LiquidityMapProps) => {
  const blockUnit = parseUnits('20', 18);
  // Build liquidity buckets for visualization (150 columns for slightly larger squares)
  const { buckets, totalLiquidity, bestBuyBoundary, bestSellBoundary } = useMemo(() => {
    const numBuckets = 150;
    const bucketData: { price: number; yesLiq: bigint; noLiq: bigint }[] = [];

    // Initialize empty buckets
    for (let i = 0; i < numBuckets; i++) {
      bucketData.push({
        price: ((i + 1) * 100) / numBuckets, // 1.25% to 100% (synthetic, for fallback)
        yesLiq: 0n,
        noLiq: 0n,
      });
    }

    let totalLiq = 0n;
    let bestBuyBoundary = 0;
    let bestSellBoundary = 100;
    let hasBuyBoundary = false;
    let hasSellBoundary = false;

    const allLevels = [...(bids ?? []), ...(asks ?? [])];
    for (const level of allLevels) {
      const yesPrice = Number(level.yesPrice);
      if (!Number.isFinite(yesPrice)) continue;
      const pricePercent = yesPrice * 100;
      if (pricePercent < 0 || pricePercent > 100) continue;

      let amountWad = 0n;
      try {
        amountWad = parseUnits(level.amount || '0', 18);
      } catch {
        amountWad = 0n;
      }
      if (amountWad <= 0n) continue;

      const bucketIndex = Math.max(0, Math.min(numBuckets - 1, Math.floor((pricePercent / 100) * numBuckets)));
      if (level.side === 'bid') {
        bucketData[bucketIndex].yesLiq += amountWad;
      } else {
        bucketData[bucketIndex].noLiq += amountWad;
      }

      totalLiq += amountWad;
      if (level.side === 'bid') {
        bestBuyBoundary = Math.max(bestBuyBoundary, pricePercent);
        hasBuyBoundary = true;
      } else {
        bestSellBoundary = Math.min(bestSellBoundary, pricePercent);
        hasSellBoundary = true;
      }
    }

    if (totalLiq === 0n) {
      bestBuyBoundary = 0;
      bestSellBoundary = 100;
      hasBuyBoundary = false;
      hasSellBoundary = false;
    }

    const buckets = bucketData.map(b => ({
      price: b.price,
      yesLiq: b.yesLiq,
      noLiq: b.noLiq,
      liquidity: b.yesLiq + b.noLiq,
    }));

    return {
      buckets,
      totalLiquidity: totalLiq,
      bestBuyBoundary: hasBuyBoundary ? bestBuyBoundary : null,
      bestSellBoundary: hasSellBoundary ? bestSellBoundary : null,
    };
  }, [asks, bids]);

  const displayBuckets = useMemo(() => {
    if (viewOutcome === 'yes') return buckets;
    return [...buckets].reverse().map(b => ({
      ...b,
      yesLiq: b.noLiq,
      noLiq: b.yesLiq,
      price: 100 - b.price,
    }));
  }, [buckets, viewOutcome]);

  const displayProb = viewOutcome === 'yes' ? currentProb : (1 - currentProb);
  const displayAmmProb = viewOutcome === 'yes' ? ammProb : (1 - ammProb);
  const hasRealData = (bids?.length ?? 0) > 0 || (asks?.length ?? 0) > 0;
  const hasAnyData = hasRealData;
  const displayBestBuy = hasRealData
    ? (viewOutcome === 'yes'
      ? bestBuyBoundary
      : (bestSellBoundary !== null ? 100 - bestSellBoundary : null))
    : null;
  const displayBestSell = hasRealData
    ? (viewOutcome === 'yes'
      ? bestSellBoundary
      : (bestBuyBoundary !== null ? 100 - bestBuyBoundary : null))
    : null;

  return (
    <div className="relative">
      {/* Price scale */}
      <div className="flex justify-between text-xs text-slate-600 font-mono mb-1 px-1">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>

      {/* Pixel depth chart */}
      <div className="relative h-32 flex items-end gap-0 bg-slate-950 rounded-lg p-2">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : !hasAnyData ? (
          // No liquidity - simple empty state
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm text-slate-500">No orders yet</span>
          </div>
        ) : (
          null
        )}

        {!isLoading && displayProb > 0 && displayProb < 1 && (
          <div
            className="absolute top-0 bottom-0 w-[1.5px] bg-cyan-400 z-20 pointer-events-none shadow-[0_0_10px_rgba(34,211,238,0.4)]"
            style={{ left: `calc(${displayProb * 100}% - 0.75px)` }}
          />
        )}



        {/* Y-Axis Depth Scale */}
        <div className="absolute left-0 top-2 bottom-3 flex flex-col justify-between items-end pr-1 border-r border-slate-800/50 pointer-events-none z-20 w-8">
          <div className="text-[7px] text-slate-500 font-mono flex items-center gap-1">
            {totalLiquidity > 0n ? parseFloat(formatUnits(blockUnit * 12n, 18)).toFixed(0) : '0'}
            <div className="w-1.5 h-[1px] bg-slate-800" />
          </div>
          <div className="text-[7px] text-slate-500 font-mono flex items-center gap-1">
            {(parseFloat(formatUnits(blockUnit * 6n, 18))).toFixed(0)}
            <div className="w-1.5 h-[1px] bg-slate-800" />
          </div>
          <div className="text-[7px] text-slate-500 font-mono flex items-center gap-1">
            0
            <div className="w-1.5 h-[1px] bg-slate-800" />
          </div>
        </div>

        {!isLoading && hasAnyData && (
          <div className="flex-1 h-full flex items-end gap-[1px] pl-8">
            {displayBuckets.map((bucket, col) => {
              const hasLiquidity = bucket.liquidity > 0n;
              const totalBlocks = bucket.liquidity > 0n
                ? Math.max(1, Math.min(12, Number((bucket.liquidity + blockUnit - 1n) / blockUnit)))
                : 0;
              let greenBlocks = 0;
              let redBlocks = 0;
              if (hasLiquidity && totalBlocks > 0) {
                greenBlocks = Number((bucket.yesLiq * BigInt(totalBlocks)) / (bucket.liquidity || 1n));
                redBlocks = totalBlocks - greenBlocks;
                if (bucket.yesLiq > 0n && greenBlocks === 0) {
                  greenBlocks = 1;
                  redBlocks = Math.max(0, totalBlocks - 1);
                }
                if (bucket.noLiq > 0n && redBlocks === 0) {
                  redBlocks = 1;
                  greenBlocks = Math.max(0, totalBlocks - 1);
                }
              }

              return (
                <div
                  key={col}
                  className={cn(
                    "flex-1 flex flex-col justify-end gap-[2px] relative group h-full pb-1",
                    hasLiquidity && "cursor-pointer"
                  )}
                >
                  {hasLiquidity && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none">
                      <div className="bg-slate-900 border-2 border-slate-700/50 rounded-xl px-3 py-2 text-center shadow-2xl backdrop-blur-md">
                        <div className="font-mono font-bold text-white text-xs mb-1">
                          {bucket.price.toFixed(1)}%
                        </div>
                        <div className="text-[11px] font-bold whitespace-nowrap text-emerald-400">
                          Buy {(() => {
                            const val = Number(formatUnits(bucket.yesLiq, 18));
                            if (val === 0 && bucket.yesLiq > 0n) return '< 0.0001';
                            if (val < 0.1) return val.toFixed(4);
                            return val.toLocaleString(undefined, { maximumFractionDigits: 3 });
                          })()} {viewOutcome.toUpperCase()}
                        </div>
                        <div className="text-[11px] font-bold whitespace-nowrap text-rose-400">
                          Sell {(() => {
                            const val = Number(formatUnits(bucket.noLiq, 18));
                            if (val === 0 && bucket.noLiq > 0n) return '< 0.0001';
                            if (val < 0.1) return val.toFixed(4);
                            return val.toLocaleString(undefined, { maximumFractionDigits: 3 });
                          })()} {viewOutcome.toUpperCase()}
                        </div>
                        <div className="text-[8px] text-slate-500 mt-1 uppercase tracking-tighter">
                          {((bucket.liquidity * 100n) / (totalLiquidity || 1n)).toString()}% of Depth
                        </div>
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-800" />
                    </div>
                  )}

                  {hasLiquidity && [...Array(redBlocks)].map((_, blockIdx) => {
                    const intensity = (blockIdx + 1) / Math.max(1, redBlocks);
                    return (
                      <div
                        key={`r-${blockIdx}`}
                        className={cn(
                          "w-full aspect-square rounded-[2px] transition-all duration-200",
                          intensity > 0.7 ? 'bg-rose-400' : intensity > 0.4 ? 'bg-rose-500' : 'bg-rose-700',
                          "group-hover:ring-1 group-hover:ring-white/30",
                          "group-hover:scale-110 hover:shadow-lg",
                          "group-hover:shadow-rose-500/30"
                        )}
                      />
                    );
                  })}
                  {hasLiquidity && [...Array(greenBlocks)].map((_, blockIdx) => {
                    const intensity = (blockIdx + 1) / Math.max(1, greenBlocks);
                    return (
                      <div
                        key={`g-${blockIdx}`}
                        className={cn(
                          "w-full aspect-square rounded-[2px] transition-all duration-200",
                          intensity > 0.7 ? 'bg-emerald-400' : intensity > 0.4 ? 'bg-emerald-500' : 'bg-emerald-700',
                          "group-hover:ring-1 group-hover:ring-white/30",
                          "group-hover:scale-110 hover:shadow-lg",
                          "group-hover:shadow-emerald-500/30"
                        )}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-slate-500">AMM</span>
            <span className="font-mono font-bold text-white">{(displayAmmProb * 100).toFixed(1)}¢</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">DIFF</span>
            <span className={cn(
              'font-mono font-bold',
              hasRealData && Math.abs(displayProb - displayAmmProb) * 100 > 2 ? 'text-yellow-400' : 'text-slate-500'
            )}>
              {hasRealData ? `${(Math.abs(displayProb - displayAmmProb) * 100).toFixed(1)}¢` : '—'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Best Buy</span>
            <span className="font-mono text-white">
              {displayBestBuy !== null ? `${displayBestBuy.toFixed(1)}¢` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Best Sell</span>
            <span className="font-mono text-white">
              {displayBestSell !== null ? `${displayBestSell.toFixed(1)}¢` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Liq</span>
            <span className="font-mono text-amber-400">{parseFloat(formatUnits(totalLiquidity, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiquidityMap;
