/**
 * LiquidityMap - Visual liquidity depth chart for TickBook orderbook
 * 
 * Shows bid/ask liquidity distribution across price ticks with
 * animated pixel blocks. Displays current price indicators for
 * both AMM and TickBook prices.
 */
import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { formatUnits, parseUnits } from 'viem';
import { cn } from '../../../lib/utils';
import type { SpotSellOrderIndexed } from '../../../hooks/indexer';

// ============================================================================
// Types
// ============================================================================
export interface TickData {
  tick: number;
  liquidity: bigint;
}

export interface LiquidityMapProps {
  tickBook: {
    bids: TickData[];
    asks: TickData[];
    activeLiquidityNo?: bigint;
    activeLiquidityYes?: bigint;
  } | null;
  allOrders?: Array<{
    orderId: bigint;
    outcome: number;
    tickLower: number;
    tickUpper: number;
    sharesTotal: bigint;
    liquidity: bigint;
    filledShares: bigint;
    pendingShares: bigint;
    active: boolean;
  }>;
  spotSells?: SpotSellOrderIndexed[];
  currentProb: number;
  ammProb: number;
  isLoading: boolean;
  viewOutcome: 'yes' | 'no';
}

// ============================================================================
// Component
// ============================================================================
export const LiquidityMap = ({ 
  tickBook, 
  allOrders, 
  spotSells, 
  currentProb, 
  ammProb, 
  isLoading, 
  viewOutcome 
}: LiquidityMapProps) => {

  // Build liquidity buckets for visualization (150 columns for slightly larger squares)
  // TickBookV2 uses continuous range orders - show uniform liquidity across ranges
  const { buckets, lowestBoundary, highestBoundary, totalLiquidity, maxLiquidity, hasYesLiq, hasNoLiq } = useMemo(() => {
    const numBuckets = 150;
    const bucketData: { price: number; yesLiq: bigint; noLiq: bigint; minActualPrice: number | null; maxActualPrice: number | null }[] = [];

    // Initialize empty buckets
    for (let i = 0; i < numBuckets; i++) {
      bucketData.push({
        price: ((i + 1) * 100) / numBuckets, // 1.25% to 100% (synthetic, for fallback)
        yesLiq: 0n,
        noLiq: 0n,
        minActualPrice: null, // Track actual tick prices of orders in this bucket
        maxActualPrice: null,
      });
    }

    // Use active liquidity from market state
    const activeLiqYes = tickBook?.activeLiquidityYes ?? 0n;
    const activeLiqNo = tickBook?.activeLiquidityNo ?? 0n;

    // Get boundary ticks
    const bids = tickBook?.bids ?? [];
    const asks = tickBook?.asks ?? [];

    let lowestBoundary = 100;
    let highestBoundary = 0;
    let totalLiq = 0n;

    if (allOrders && allOrders.length > 0) {
      for (const order of allOrders) {
        if (!order.active) continue;
        const isYesOrder = order.outcome === 1;

        let lowPercent = order.tickLower / 10;
        let highPercent = order.tickUpper / 10;

        if (!isYesOrder) {
          const invLow = 100 - highPercent;
          const invHigh = 100 - lowPercent;
          lowPercent = invLow;
          highPercent = invHigh;
        }

        const startBucket = Math.max(0, Math.floor((lowPercent / 100) * numBuckets));
        const endBucket = Math.min(numBuckets - 1, Math.floor((highPercent / 100) * numBuckets));
        const rangeSize = Math.max(1, endBucket - startBucket + 1);

        const totalFilled = order.filledShares + order.pendingShares;
        const remainingLiq = order.sharesTotal > totalFilled
          ? order.sharesTotal - totalFilled
          : 0n;

        if (remainingLiq === 0n) continue;

        const liqPerBucket = remainingLiq / BigInt(rangeSize);

        for (let b = startBucket; b <= endBucket; b++) {
          if (isYesOrder) {
            bucketData[b].yesLiq += liqPerBucket;
          } else {
            bucketData[b].noLiq += liqPerBucket;
          }
          if (bucketData[b].minActualPrice === null || lowPercent < bucketData[b].minActualPrice) {
            bucketData[b].minActualPrice = lowPercent;
          }
          if (bucketData[b].maxActualPrice === null || highPercent > bucketData[b].maxActualPrice) {
            bucketData[b].maxActualPrice = highPercent;
          }
        }

        totalLiq += remainingLiq;
        lowestBoundary = Math.min(lowestBoundary, lowPercent);
        highestBoundary = Math.max(highestBoundary, highPercent);
      }
    }

    if (spotSells && spotSells.length > 0) {
      for (const s of spotSells) {
        if (!s.active) continue;

        const remaining = s.sharesTotal > s.sharesFilled ? s.sharesTotal - s.sharesFilled : 0n;
        if (remaining === 0n) continue;

        const sellIsYes = s.outcome === 1;

        let lowPercent = s.tickLower / 10;
        let highPercent = s.tickUpper / 10;

        if (!sellIsYes) {
          const invLow = 100 - highPercent;
          const invHigh = 100 - lowPercent;
          lowPercent = invLow;
          highPercent = invHigh;
        }

        const startBucket = Math.max(0, Math.floor((lowPercent / 100) * numBuckets));
        const endBucket = Math.min(numBuckets - 1, Math.floor((highPercent / 100) * numBuckets));
        const rangeSize = Math.max(1, endBucket - startBucket + 1);
        const liqPerBucket = remaining / BigInt(rangeSize);

        for (let b = startBucket; b <= endBucket; b++) {
          if (sellIsYes) {
            bucketData[b].noLiq += liqPerBucket;
          } else {
            bucketData[b].yesLiq += liqPerBucket;
          }
          if (bucketData[b].minActualPrice === null || lowPercent < bucketData[b].minActualPrice) {
            bucketData[b].minActualPrice = lowPercent;
          }
          if (bucketData[b].maxActualPrice === null || highPercent > bucketData[b].maxActualPrice) {
            bucketData[b].maxActualPrice = highPercent;
          }
        }

        totalLiq += remaining;
        lowestBoundary = Math.min(lowestBoundary, lowPercent);
        highestBoundary = Math.max(highestBoundary, highPercent);
      }
    }

    if (totalLiq === 0n && (activeLiqYes > 0n || activeLiqNo > 0n)) {
      const yesPerBucket = activeLiqYes / BigInt(numBuckets);
      const noPerBucket = activeLiqNo / BigInt(numBuckets);
      for (let b = 0; b < numBuckets; b++) {
        bucketData[b].yesLiq = yesPerBucket;
        bucketData[b].noLiq = noPerBucket;
      }
      totalLiq = activeLiqYes + activeLiqNo;
      lowestBoundary = 0;
      highestBoundary = 100;
    }

    const buckets = bucketData.map(b => ({
      price: b.minActualPrice ?? b.price,
      maxPrice: b.maxActualPrice,
      liquidity: b.yesLiq + b.noLiq,
      side: (b.yesLiq > b.noLiq ? 'yes' : b.noLiq > 0n ? 'no' : 'none') as 'yes' | 'no' | 'none',
    }));

    // Find max liquidity for normalization
    const rawMaxLiq = buckets.reduce((max, b) => b.liquidity > max ? b.liquidity : max, 0n);

    // Minimal Y-axis scale (e.g., 50 shares) to prevent noise from looking significant
    const minScale = parseUnits('50', 18);
    const maxLiq = rawMaxLiq > minScale ? rawMaxLiq : minScale;

    const hasYesLiq = activeLiqYes > 0n || bucketData.some(b => b.yesLiq > 0n);
    const hasNoLiq = activeLiqNo > 0n || bucketData.some(b => b.noLiq > 0n);

    return {
      buckets: buckets.map(b => ({
        ...b,
        normalized: maxLiq > 0n ? Number((b.liquidity * 100n) / maxLiq) / 100 : 0
      })),
      // Show range bounds instead of bid/ask
      lowestBoundary,
      highestBoundary,
      totalLiquidity: totalLiq,
      maxLiquidity: maxLiq,
      hasYesLiq,
      hasNoLiq,
    };
  }, [tickBook, allOrders, spotSells, currentProb, ammProb]);

  const displayBuckets = useMemo(() => {
    if (viewOutcome === 'yes') return buckets;
    return [...buckets].reverse().map(b => ({
      ...b,
      price: 100 - b.price,
      maxPrice: b.maxPrice !== null ? 100 - b.maxPrice : null,
    }));
  }, [buckets, viewOutcome]);

  const displayProb = viewOutcome === 'yes' ? currentProb : (1 - currentProb);
  const displayAmmProb = viewOutcome === 'yes' ? ammProb : (1 - ammProb);
  const hasRealData = (tickBook?.bids?.length ?? 0) > 0 || (tickBook?.asks?.length ?? 0) > 0 || (allOrders?.filter(o => o.active)?.length ?? 0) > 0;
  const hasSpotSells = (spotSells?.filter(s => s.active)?.length ?? 0) > 0;
  const hasAnyData = hasRealData || hasSpotSells;

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

        {/* Price Indicators (Light Bars) */}
        {!isLoading && (
          <>
            {/* AMM Price Indicator - Slightly Grey 'Stealth' bar */}
            <div
              className="absolute top-0 bottom-0 w-[1px] bg-slate-400/60 z-10 pointer-events-none"
              style={{ left: `${displayAmmProb * 100}%` }}
            />
            {/* TickBook Price Indicator - Yellow/Amber solid bar */}
            <div
              className="absolute top-0 bottom-0 w-[1.5px] bg-cyan-400 z-20 pointer-events-none shadow-[0_0_10px_rgba(34,211,238,0.4)]"
              style={{ left: `calc(${displayProb * 100}% - 0.75px)` }}
            />
          </>
        )}



        {/* Y-Axis Depth Scale */}
        <div className="absolute left-0 top-2 bottom-3 flex flex-col justify-between items-end pr-1 border-r border-slate-800/50 pointer-events-none z-20 w-8">
          <div className="text-[7px] text-slate-500 font-mono flex items-center gap-1">
            {totalLiquidity > 0n ? parseFloat(formatUnits(maxLiquidity, 18)).toFixed(0) : '0'}
            <div className="w-1.5 h-[1px] bg-slate-800" />
          </div>
          <div className="text-[7px] text-slate-500 font-mono flex items-center gap-1">
            {(parseFloat(formatUnits(maxLiquidity, 18)) / 2).toFixed(0)}
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
              // Ensure even tiny liquidity shows at least one dimmed block
              const blocks = bucket.liquidity > 0n ? Math.max(1, Math.ceil(bucket.normalized * 12)) : 0;
              const hasLiquidity = bucket.liquidity > 0n;

              const isYesLiq = bucket.side === 'yes';
              const isNoLiq = bucket.side === 'no';

              const isGreen = viewOutcome === 'yes' ? isYesLiq : isNoLiq;
              const isRed = viewOutcome === 'yes' ? isNoLiq : isYesLiq;

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
                          {viewOutcome === 'yes' 
                            ? ((col / 150) * 100).toFixed(0)
                            : (100 - (col / 150) * 100).toFixed(0)}%
                        </div>
                        <div className={cn("text-[11px] font-bold whitespace-nowrap", isGreen ? "text-emerald-400" : "text-rose-400")}>
                          {isGreen ? 'Buy' : 'Sell'} {(() => {
                            const val = Number(formatUnits(bucket.liquidity, 18));
                            if (val === 0 && bucket.liquidity > 0n) return '< 0.0001';
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

                  {/* Blocks with staggered entrance animation */}
                  {hasLiquidity && [...Array(blocks)].map((_, blockIdx) => {
                    const intensity = (blockIdx + 1) / blocks;
                    // Staggered delay: column * 5ms + block * 30ms for cascade effect
                    const animDelay = col * 5 + blockIdx * 30;
                    return (
                      <div
                        key={blockIdx}
                        className={cn(
                          "w-full aspect-square rounded-[2px] transition-all duration-200",
                          isGreen ? (intensity > 0.7 ? 'bg-emerald-400' : intensity > 0.4 ? 'bg-emerald-500' : 'bg-emerald-700')
                            : isRed ? (intensity > 0.7 ? 'bg-rose-400' : intensity > 0.4 ? 'bg-rose-500' : 'bg-rose-700')
                              : "bg-slate-800",
                          "group-hover:ring-1 group-hover:ring-white/30",
                          "group-hover:scale-110 hover:shadow-lg",
                          isGreen && "group-hover:shadow-emerald-500/30",
                          isRed && "group-hover:shadow-rose-500/30",
                          "animate-[slideInUp_0.3s_ease-out_forwards]",
                          "opacity-0" // Start hidden, animation reveals
                        )}
                        style={{
                          animationDelay: `${animDelay}ms`,
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(() => {
        const ammCents = displayAmmProb * 100;
        const proCents = displayProb * 100;
        const diff = Math.abs(proCents - ammCents);
        const hasArb = diff > 2;
        return (
          <div className="flex items-center justify-between mt-2 text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">AMM</span>
                <span className="font-mono font-bold text-white">{ammCents.toFixed(1)}¢</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">DIFF</span>
                <span className={cn("font-mono font-bold", hasArb ? "text-yellow-400" : "text-slate-500")}>{diff.toFixed(1)}¢</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Low</span>
                <span className="font-mono text-white">{lowestBoundary === 100 && !hasRealData ? '—' : `${lowestBoundary.toFixed(1)}¢`}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">High</span>
                <span className="font-mono text-white">{highestBoundary === 0 && !hasRealData ? '—' : `${highestBoundary.toFixed(1)}¢`}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Liq</span>
                <span className="font-mono text-amber-400">{parseFloat(formatUnits(totalLiquidity, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default LiquidityMap;
