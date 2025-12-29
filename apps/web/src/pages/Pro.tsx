/**
 * Pro Page - TickBook Trading Terminal
 * 
 * V3 Redesign: Unified header with market list + trading terminal
 * 
 * Features:
 * - Unified header with AMM page (search, categories)
 * - Shows only graduated markets
 * - Click to open trading terminal for selected market
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Zap, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw, ChevronDown, AlertCircle, Loader2, ArrowLeft, BookOpen, TrendingUp, ChevronLeft, ChevronRight, ExternalLink
} from 'lucide-react';
import { useAccount, useChainId, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Button } from '../components/ui/Button';
import { MarketHeader, GraduationProgress } from '../components/features/v8';
import {
  useLaunchpadMarketDirect,
  useCollateralizerDirect,
  useTickBookDirect,
  useTickBookQuoteDirect,
  useTickBookVaultDirect,
  useTokenBalances,
  useUserOrdersDirect,
  useAmmMarketDirect,
  useInvalidateV8Queries,
  RangeOrder
} from '../hooks/v8';
import { useDeployments } from '../hooks/useDeployments';
import { V8_ABIS } from '../config/abis';
import marketsConfig from '../config/markets.json';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { useChainStore } from '../store/useChainStore';

// ============================================================================
// Types
// ============================================================================
type OrderAction = 'buy_yes' | 'sell_yes' | 'buy_no' | 'sell_no';
type OrderType = 'limit' | 'market';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'politics', label: 'Politics' },
  { id: 'science', label: 'Science' },
  { id: 'sports', label: 'Sports' },
];

// ============================================================================
// Liquidity Map Component - Uses real orderbook data
// ============================================================================
interface TickData {
  index: number;
  price: number;
  liquidityNet: bigint;
  liquidityGross: bigint;
}

interface LiquidityMapProps {
  tickBook: {
    bids: TickData[];
    asks: TickData[];
    activeLiquidityNo?: bigint;
    activeLiquidityYes?: bigint;
  } | null;
  currentProb: number;
  ammProb: number;
  isLoading: boolean;
}

const LiquidityMap = ({ tickBook, currentProb, ammProb, isLoading }: LiquidityMapProps) => {
  // Build liquidity buckets for visualization (80 columns = ~1.25% each)
  // TickBookV2 uses continuous range orders - show uniform liquidity across ranges
  const { buckets, lowestBoundary, highestBoundary, totalLiquidity, hasYesLiq, hasNoLiq } = useMemo(() => {
    const numBuckets = 80;
    const buckets: { price: number; liquidity: bigint; side: 'yes' | 'no' | 'none' }[] = [];
    const currentTickPercent = currentProb * 100;

    // Initialize empty buckets
    for (let i = 0; i < numBuckets; i++) {
      buckets.push({
        price: ((i + 1) * 100) / numBuckets, // 1.25% to 100%
        liquidity: 0n,
        side: 'none'
      });
    }

    // Use active liquidity from market state
    const activeLiqYes = tickBook?.activeLiquidityYes ?? 0n;
    const activeLiqNo = tickBook?.activeLiquidityNo ?? 0n;

    // Get boundary ticks
    const bids = tickBook?.bids ?? [];  // YES side boundaries (YES makers)
    const asks = tickBook?.asks ?? [];  // NO side boundaries (NO makers -> YES liquidity)

    let lowestBoundary = 100;
    let highestBoundary = 0;
    let totalLiq = 0n;

    // Process YES side boundaries (YES makers provide NO liquidity to takers)
    for (const tick of bids) {
      const tickPercent = tick.price * 100;
      // Spread liquidity uniformly from this boundary to 100%
      const startBucket = Math.max(0, Math.floor((tickPercent / 100) * numBuckets));
      const endBucket = numBuckets - 1;
      const rangeSize = Math.max(1, endBucket - startBucket + 1);
      const liqPerBucket = tick.liquidityGross / BigInt(rangeSize);

      for (let b = startBucket; b <= endBucket; b++) {
        buckets[b].liquidity += liqPerBucket;
        buckets[b].side = 'no'; // YES makers provide NO liquidity
      }

      totalLiq += tick.liquidityGross;
      lowestBoundary = Math.min(lowestBoundary, tickPercent);
      highestBoundary = Math.max(highestBoundary, 100);
    }

    // Process NO side boundaries (NO makers provide YES liquidity to takers)
    // A NO range order means: takers can BUY YES at any tick in the range
    for (const tick of asks) {
      const tickPercent = tick.price * 100;
      // Spread liquidity uniformly from this boundary to 100%
      // (NO maker's range spans from tickLower up)
      const startBucket = Math.max(0, Math.floor((tickPercent / 100) * numBuckets));
      const endBucket = numBuckets - 1;
      const rangeSize = Math.max(1, endBucket - startBucket + 1);
      const liqPerBucket = tick.liquidityGross / BigInt(rangeSize);

      for (let b = startBucket; b <= endBucket; b++) {
        buckets[b].liquidity += liqPerBucket;
        buckets[b].side = 'yes'; // NO makers provide YES liquidity
      }

      totalLiq += tick.liquidityGross;
      lowestBoundary = Math.min(lowestBoundary, tickPercent);
      highestBoundary = 100;
    }

    // Fallback: If we have active liquidity but couldn't match boundaries, spread across range
    if (totalLiq === 0n && (activeLiqYes > 0n || activeLiqNo > 0n)) {
      // Spread active liquidity across the entire range
      const liqPerBucket = (activeLiqYes + activeLiqNo) / BigInt(numBuckets);
      for (let b = 0; b < numBuckets; b++) {
        buckets[b].liquidity = liqPerBucket;
        buckets[b].side = activeLiqYes > activeLiqNo ? 'yes' : 'no';
      }
      totalLiq = activeLiqYes + activeLiqNo;
      lowestBoundary = 0;
      highestBoundary = 100;
    }

    // Find max liquidity for normalization
    const maxLiq = buckets.reduce((max, b) => b.liquidity > max ? b.liquidity : max, 1n);

    // Determine available liquidity range for display
    const hasYesLiq = activeLiqYes > 0n || buckets.some(b => b.side === 'yes');
    const hasNoLiq = activeLiqNo > 0n || buckets.some(b => b.side === 'no');

    return {
      buckets: buckets.map(b => ({
        ...b,
        normalized: maxLiq > 0n ? Number((b.liquidity * 100n) / maxLiq) / 100 : 0
      })),
      // Show range bounds instead of bid/ask
      lowestBoundary,
      highestBoundary,
      totalLiquidity: totalLiq,
      hasYesLiq,
      hasNoLiq,
    };
  }, [tickBook, currentProb, ammProb]);

  const midPrice = currentProb * 100;
  const hasRealData = (tickBook?.bids?.length ?? 0) > 0 || (tickBook?.asks?.length ?? 0) > 0;

  return (
    <div className="relative">
      {/* Price scale */}
      <div className="flex justify-between text-[9px] text-slate-600 font-mono mb-1 px-1">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>

      {/* Pixel depth chart */}
      <div className="relative h-32 flex items-end gap-[2px] bg-slate-950 rounded-lg p-2">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : !hasRealData ? (
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
              style={{ left: `${ammProb * 100}%` }}
            />
            {/* TickBook Price Indicator - Yellow/Amber solid bar */}
            <div
              className="absolute top-0 bottom-0 w-[1.5px] bg-amber-400 z-20 pointer-events-none shadow-[0_0_10px_rgba(251,191,36,0.4)]"
              style={{ left: `calc(${currentProb * 100}% - 0.75px)` }}
            />
          </>
        )}

        {!isLoading && hasRealData && (
          buckets.map((bucket, col) => {
            const blocks = Math.max(1, Math.ceil(bucket.normalized * 12));
            const hasLiquidity = bucket.liquidity > 0n;

            // Color based on what takers can BUY at this price
            // 'yes' = YES liquidity available (green) 
            // 'no' = NO liquidity available (rose)
            const isYesLiq = bucket.side === 'yes';
            const isNoLiq = bucket.side === 'no';

            return (
              <div
                key={col}
                className={cn(
                  "flex-1 flex flex-col-reverse gap-[2px] relative group",
                  hasLiquidity && "cursor-pointer"
                )}
              >
                {/* Hover tooltip */}
                {hasLiquidity && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] whitespace-nowrap shadow-xl">
                      <div className="font-mono font-bold text-white">{bucket.price.toFixed(1)}%</div>
                      <div className="text-slate-400">
                        {isYesLiq ? 'Buy YES' : 'Buy NO'}:
                        <span className={isYesLiq ? 'text-emerald-400' : 'text-rose-400'}>
                          {' '}{parseFloat(formatUnits(bucket.liquidity, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-700" />
                  </div>
                )}

                {/* Blocks - uniform color across range for single order */}
                {hasLiquidity && [...Array(blocks)].map((_, blockIdx) => {
                  const intensity = 1 - (blockIdx / blocks);
                  let blockColor = 'bg-slate-800';

                  if (isYesLiq) {
                    // YES liquidity = green (takers can buy YES)
                    blockColor = intensity > 0.6 ? 'bg-emerald-400' : intensity > 0.3 ? 'bg-emerald-500' : 'bg-emerald-700';
                  } else if (isNoLiq) {
                    // NO liquidity = rose (takers can buy NO)
                    blockColor = intensity > 0.6 ? 'bg-rose-400' : intensity > 0.3 ? 'bg-rose-500' : 'bg-rose-700';
                  }

                  return (
                    <div
                      key={blockIdx}
                      className={cn(
                        "w-full aspect-square rounded-[1px] transition-all",
                        blockColor,
                        "group-hover:ring-1 group-hover:ring-white/30"
                      )}
                    />
                  );
                })}
              </div>
            );
          })
        )}

        {/* Redundant price indicator removed */}
      </div>

      {/* Intensity legend */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-4 text-[9px] text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-8 h-2 rounded-sm bg-gradient-to-r from-emerald-700 to-emerald-400" />
            <span>YES Liquidity</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-8 h-2 rounded-sm bg-gradient-to-r from-rose-700 to-rose-400" />
            <span>NO Liquidity</span>
          </div>
        </div>
        <div className="text-[9px] text-slate-600">Height = Liquidity at price</div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/50">
        <div className="text-center p-2 rounded-lg bg-slate-950">
          <div className="text-[9px] text-slate-500 uppercase">Range Low</div>
          <div className="text-sm font-mono font-bold text-slate-300">
            {lowestBoundary === 100 && !hasRealData ? '—' : `${lowestBoundary.toFixed(1)}%`}
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-slate-900/30">
          <div className="text-[9px] text-slate-500 uppercase">Range High</div>
          <div className="text-sm font-mono font-bold text-slate-300">
            {highestBoundary === 0 && !hasRealData ? '—' : `${highestBoundary.toFixed(1)}%`}
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-slate-950">
          <div className="text-[9px] text-slate-500 uppercase">Available</div>
          <div className="text-sm font-mono font-bold">
            {hasYesLiq && <span className="text-emerald-400">YES</span>}
            {hasYesLiq && hasNoLiq && <span className="text-slate-500"> / </span>}
            {hasNoLiq && <span className="text-rose-400">NO</span>}
            {!hasYesLiq && !hasNoLiq && <span className="text-slate-500">—</span>}
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-slate-950">
          <div className="text-[9px] text-slate-500 uppercase">Total Liq</div>
          <div className="text-sm font-mono font-bold text-white">
            ${parseFloat(formatUnits(totalLiquidity, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// User Orders Panel - View, Cancel, Claim orders
// ============================================================================
interface UserOrdersPanelProps {
  orders: RangeOrder[];
  marketKey: `0x${string}` | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  contracts: Record<string, string>;
  chainId: number;
}

const UserOrdersPanel = ({ orders, marketKey, isLoading, onRefresh, contracts, chainId }: UserOrdersPanelProps) => {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const activeOrders = orders.filter(o => o.active);
  const hasPartialFills = orders.some(o => o.filledShares > 0n && o.active);

  const handleCancelOrder = async (orderId: bigint) => {
    if (!marketKey) return;
    setActionInProgress(`cancel-${orderId.toString()}`);
    const toastId = toast.loading('Cancelling order...');
    try {
      const hash = await writeContractAsync({
        address: contracts.TickBook as `0x${string}`,
        abi: V8_ABIS.TickBook,
        functionName: 'cancelOrder',
        args: [marketKey, orderId]
      });

      toast.loading('Waiting for confirmation...', { id: toastId });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      toast.success(
        <div className="flex items-center gap-2">
          <span>Order cancelled!</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
      onRefresh();
    } catch (e: any) {
      const msg = e?.cause?.reason || e?.shortMessage || 'Cancel failed';
      toast.error(msg, { id: toastId });
      console.error(e);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleClaimFills = async (orderId: bigint) => {
    if (!marketKey) return;
    setActionInProgress(`claim-${orderId.toString()}`);
    const toastId = toast.loading('Claiming fills...');
    try {
      const hash = await writeContractAsync({
        address: contracts.TickBook as `0x${string}`,
        abi: V8_ABIS.TickBook,
        functionName: 'claimFills',
        args: [marketKey, orderId]
      });

      toast.loading('Waiting for confirmation...', { id: toastId });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      toast.success(
        <div className="flex items-center gap-2">
          <span>Fills claimed!</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
      onRefresh();
    } catch (e: any) {
      const msg = e?.cause?.reason || e?.shortMessage || 'Claim failed';
      toast.error(msg, { id: toastId });
      console.error(e);
    } finally {
      setActionInProgress(null);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Orders</span>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Orders</span>
        <div className="flex items-center gap-2">
          {hasPartialFills && (
            <span className="px-2 py-1 text-[9px] bg-amber-500/20 text-amber-400 rounded-full">Has fills to claim</span>
          )}
          <button onClick={onRefresh} className="p-1 hover:bg-slate-800 rounded transition-colors">
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {activeOrders.length === 0 ? (
        <div className="text-center py-8">
          <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No active orders</p>
          <p className="text-xs text-slate-600">Place a limit order to get started</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {activeOrders.map((order) => {
            const priceRange = order.tickLower === order.tickUpper
              ? `${(order.tickLower / 10).toFixed(1)}%`
              : `${(order.tickLower / 10).toFixed(1)}% – ${(order.tickUpper / 10).toFixed(1)}%`;
            const fillPercent = order.sharesTotal > 0n
              ? Number((order.filledShares * 100n) / order.sharesTotal)
              : 0;
            // outcome=1 → credits YES tokens on fill, outcome=0 → credits NO tokens on fill
            const isYesOrder = order.outcome === 1;
            const hasFills = order.filledShares > 0n;
            const orderId = order.orderId.toString();

            return (
              <div
                key={orderId}
                className={cn(
                  "relative group overflow-hidden rounded-lg border transition-all",
                  isYesOrder
                    ? "bg-emerald-950/10 border-emerald-900/20 hover:border-emerald-500/30"
                    : "bg-rose-950/10 border-rose-900/20 hover:border-rose-500/30"
                )}
              >
                <div className="flex items-center justify-between p-2 pl-3">
                  {/* Left: Info */}
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-8 py-0.5 rounded text-[9px] font-bold text-center",
                      isYesOrder ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    )}>
                      {isYesOrder ? 'YES' : 'NO'}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-white min-w-[100px]">{priceRange}</span>
                    <div className="hidden sm:flex items-center gap-4 text-[10px] text-slate-400 font-mono">
                      <div className="flex gap-1.5">
                        <span className="text-slate-500 uppercase">Total:</span>
                        <span className="text-white">{parseFloat(formatUnits(order.sharesTotal, 18)).toLocaleString()}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-slate-500 uppercase">Fill:</span>
                        <span className={cn(hasFills ? "text-amber-400" : "text-slate-500")}>
                          {parseFloat(formatUnits(order.filledShares, 18)).toLocaleString()} ({fillPercent}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 ml-4">
                    <span className="text-[9px] text-slate-600 font-mono hidden md:inline">#{orderId}</span>
                    {hasFills && (
                      <button
                        onClick={() => handleClaimFills(order.orderId)}
                        disabled={actionInProgress === `claim-${orderId}`}
                        title="Claim Settlements"
                        className={cn(
                          "h-6 px-2.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border",
                          "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        )}
                      >
                        {actionInProgress === `claim-${orderId}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Zap className="w-2.5 h-2.5" />
                            <span>Claim</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleCancelOrder(order.orderId)}
                      disabled={actionInProgress === `cancel-${orderId}`}
                      title="Cancel Order"
                      className={cn(
                        "h-6 px-2.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border",
                        "bg-slate-900 text-slate-500 border-slate-800 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/5"
                      )}
                    >
                      {actionInProgress === `cancel-${orderId}` ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <AlertCircle className="w-2.5 h-2.5 opacity-60" />
                          <span>Cancel</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Micro Fill progress bar at the very bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-800/50">
                  <div
                    className={cn(
                      "h-full transition-all",
                      isYesOrder ? "bg-emerald-500/50" : "bg-rose-500/50"
                    )}
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================
export const Pro = () => {
  const { marketId } = useParams<{ marketId?: string }>();
  const navigate = useNavigate();
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);

  // If marketId is provided, show the trading terminal
  // Otherwise, show the market list
  if (marketId) {
    return <ProTradingTerminal marketId={marketId} />;
  }

  return <ProMarketList chainId={chainId} />;
};

// ============================================================================
// Market List View (Horizontal scroll as part of header)
// ============================================================================
const ProMarketList = ({ chainId }: { chainId: number }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Track which markets are graduated (only these count)
  const [graduatedAddresses, setGraduatedAddresses] = useState<Set<string>>(new Set());

  // Get all V8 markets
  const allMarkets = useMemo(() => {
    return marketsConfig.markets?.filter(m =>
      m.chainId === chainId && m.version.startsWith('v')
    ) || [];
  }, [chainId]);

  // Filter by search and category
  const filteredMarkets = useMemo(() => {
    return allMarkets.filter(m => {
      const matchesSearch = !search || 
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.symbol.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = category === 'all' || 
        (m as any).category?.toLowerCase() === category.toLowerCase();
      
      return matchesSearch && matchesCategory;
    });
  }, [allMarkets, search, category]);

  // Generate category counts - count ALL for now to avoid confusion
  const categoriesWithCounts = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      count: cat.id === 'all' 
        ? allMarkets.length 
        : allMarkets.filter((m: any) => m.category?.toLowerCase() === cat.id).length
    }));
  }, [allMarkets]);

  // Graduated market count for display
  const totalMarketCount = filteredMarkets.length;

  // Callback when a market's graduation status is determined
  const handleMarketGraduationLoaded = React.useCallback((address: string, isGraduated: boolean) => {
    setGraduatedAddresses(prev => {
      const newSet = new Set(prev);
      const addr = address.toLowerCase();
      if (isGraduated) {
        newSet.add(addr);
      } else {
        newSet.delete(addr);
      }
      return newSet;
    });
  }, []);

  // Auto-select first graduated market
  React.useEffect(() => {
    if (!selectedMarketId && graduatedAddresses.size > 0) {
      const firstGraduated = filteredMarkets.find(m => graduatedAddresses.has(m.contractAddress.toLowerCase()));
      if (firstGraduated) {
        setSelectedMarketId(firstGraduated.contractAddress);
      }
    }
  }, [filteredMarkets, selectedMarketId, graduatedAddresses]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleMarketSelect = (market: typeof filteredMarkets[0]) => {
    setSelectedMarketId(market.contractAddress);
  };

  const selectedMarket = filteredMarkets.find(m => m.contractAddress === selectedMarketId) ||
    filteredMarkets.find(m => graduatedAddresses.has(m.contractAddress.toLowerCase()));

  return (
    <div className="space-y-6">
      <MarketHeader
        title="Pro"
        hint="Pro trading uses a continuous range orderbook (TickBookV2) with Uniswap V3-style liquidity. Place limit orders at any price from 0.1% to 99.9% with 0.1% tick precision. Range orders let you provide liquidity across a price range and earn from taker fills. Markets must graduate from AMM before Pro trading unlocks."
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        categories={categoriesWithCounts}
        marketCount={totalMarketCount}
      />

      {/* Horizontal Market Scroll */}
      {filteredMarkets.length === 0 ? (
        <EmptyState search={search} />
      ) : (
        <GraduatedMarketsScroll
          markets={filteredMarkets}
          selectedMarketId={selectedMarketId}
          onSelect={handleMarketSelect}
          scrollRef={scrollRef}
          onScroll={scroll}
          onMarketGraduationLoaded={handleMarketGraduationLoaded}
        />
      )}

      {/* Trading Terminal for selected market */}
      {selectedMarket && (
        <ProTradingTerminal marketId={selectedMarket.contractAddress} embedded />
      )}
    </div>
  );
};

// ============================================================================
// Graduated Markets Scroll - Only shows graduated markets
// ============================================================================
interface GraduatedMarketsScrollProps {
  markets: Array<{
    contractAddress: string;
    name: string;
    symbol: string;
    category?: string;
  }>;
  selectedMarketId: string | null;
  onSelect: (market: any) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: (direction: 'left' | 'right') => void;
  onMarketGraduationLoaded?: (address: string, isGraduated: boolean) => void;
}

const GraduatedMarketsScroll = ({ markets, selectedMarketId, onSelect, scrollRef, onScroll, onMarketGraduationLoaded }: GraduatedMarketsScrollProps) => {
  // Track how many markets have loaded and their graduation status
  const [graduatedCount, setGraduatedCount] = React.useState<number | null>(null);
  const [loadedCount, setLoadedCount] = React.useState(0);

  const handleMarketLoaded = React.useCallback((address: string, isGraduated: boolean) => {
    setLoadedCount(c => c + 1);
    if (isGraduated) {
      setGraduatedCount(c => (c ?? 0) + 1);
    }
    // Report up to parent for count tracking
    onMarketGraduationLoaded?.(address, isGraduated);
  }, [onMarketGraduationLoaded]);

  // Reset counts when markets change
  React.useEffect(() => {
    setGraduatedCount(null);
    setLoadedCount(0);
  }, [markets.length]);

  const allLoaded = loadedCount >= markets.length;
  const hasGraduated = graduatedCount !== null && graduatedCount > 0;

  // Show empty state only if there are truly no markets at all
  if (allLoaded && markets.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-sm">No markets found</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
            {/* Left scroll button */}
            <button
        onClick={() => onScroll('left')}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center hover:bg-slate-800 hover:border-slate-600 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-400" />
            </button>

            {/* Scrollable container */}
            <div
              ref={scrollRef}
        className="flex-1 flex gap-3 overflow-x-auto scrollbar-hide py-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
        {markets.map(market => (
                <ProMarketChip
                  key={market.contractAddress}
                  market={market}
                  isSelected={market.contractAddress === selectedMarketId}
            onClick={() => onSelect(market)}
            onLoaded={(addr: string, isGrad: boolean) => handleMarketLoaded(addr, isGrad)}
                />
              ))}
            </div>

            {/* Right scroll button */}
            <button
        onClick={() => onScroll('right')}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center hover:bg-slate-800 hover:border-slate-600 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
    </div>
  );
};

// ============================================================================
// Market Chip (compact horizontal card)
// ============================================================================
interface ProMarketChipProps {
  market: {
    contractAddress: string;
    name: string;
    symbol: string;
    category?: string;
  };
  isSelected: boolean;
  onClick: () => void;
  onLoaded?: (address: string, isGraduated: boolean) => void;
}

const ProMarketChip = ({ market, isSelected, onClick, onLoaded }: ProMarketChipProps) => {
  const { launchpad, isLoading } = useLaunchpadMarketDirect(market.contractAddress as `0x${string}`);
  const { tickBook } = useTickBookDirect(market.contractAddress as `0x${string}`, undefined, undefined);
  const isCreated = launchpad?.isCreated;
  const isGraduated = launchpad?.isGraduated;
  const isReady = launchpad ? (launchpad.canGraduate || (launchpad.graduationProgress ?? 0) >= 100) : false;
  // effectively graduated if flag is set OR if fees are sufficient (handles stale data)
  const isEffectiveGraduated = !!isCreated && (!!isGraduated || isReady);

  const bookPrice = tickBook?.probability ?? 0.5;
  const hasReportedRef = React.useRef(false);

  // Report graduation status once loaded
  React.useEffect(() => {
    if (!isLoading && !hasReportedRef.current) {
      hasReportedRef.current = true;
      // Only count as graduated if both created AND graduated (or ready)
      onLoaded?.(market.contractAddress, isEffectiveGraduated);
    }
  }, [isLoading, isEffectiveGraduated, onLoaded, market.contractAddress]);

  // Show all markets in Pro list so they can be initialized/viewed
  // if (!isLoading && !isEffectiveGraduated) {
  //   return null;
  // }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all min-w-[200px]",
        isSelected
          ? "bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10"
          : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
      )}
    >
      {/* Symbol badge - rounded-lg like AMM */}
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
        isSelected
          ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
          : "bg-slate-800 text-slate-400"
      )}>
        {market.symbol.slice(0, 2)}
      </div>

      {/* Name */}
      <div className="text-left min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm truncate">{market.symbol}</span>
          <BookOpen className="w-3 h-3 text-amber-400 flex-shrink-0" />
        </div>
        <div className="text-[10px] text-slate-500 truncate">{market.name.slice(0, 25)}</div>
      </div>

      {/* Book Price */}
      <span className={cn(
        "text-sm font-bold tabular-nums flex-shrink-0",
        bookPrice > 0.5 ? "text-emerald-400" : bookPrice < 0.5 ? "text-rose-400" : "text-slate-400"
      )}>
        {isLoading ? '—' : `${(bookPrice * 100).toFixed(0)}%`}
      </span>
    </button>
  );
};

// ============================================================================
// Pro Market Card (shows graduation status)
// ============================================================================
interface ProMarketCardProps {
  market: {
    contractAddress: string;
    name: string;
    symbol: string;
    category?: string;
  };
  onClick: () => void;
}

const ProMarketCard = ({ market, onClick }: ProMarketCardProps) => {
  const { launchpad, isLoading } = useLaunchpadMarketDirect(market.contractAddress as `0x${string}`);
  const isGraduated = launchpad?.isGraduated;

  return (
    <button
      onClick={onClick}
      disabled={!isGraduated && !isLoading}
      className={cn(
        "w-full p-5 rounded-2xl border text-left transition-all",
        isGraduated 
          ? "bg-gradient-to-b from-slate-900/80 to-slate-950/80 border-slate-800/50 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 cursor-pointer"
          : "bg-slate-900/30 border-slate-800/30 cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
            isGraduated 
              ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
              : "bg-slate-800 text-slate-500"
          )}>
            {market.symbol.slice(0, 2)}
          </div>
          <div>
            <div className="font-semibold text-white">{market.symbol}</div>
            <div className="text-xs text-slate-500">{market.category || 'Uncategorized'}</div>
          </div>
        </div>
        
        {/* Status Badge */}
        {isLoading ? (
          <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium">
            Loading...
          </span>
        ) : isGraduated ? (
          <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Graduated
          </span>
        ) : (
          <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-medium">
            Pre-Graduation
          </span>
        )}
      </div>

      <div className="text-sm text-slate-400 line-clamp-2 mb-3">{market.name}</div>

      {!isGraduated && !isLoading && (
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <Zap className="w-3 h-3" />
          Trade on AMM first
        </div>
      )}
    </button>
  );
};

// ============================================================================
// Empty State
// ============================================================================
const EmptyState = ({ search }: { search?: string }) => (
  <div className="text-center py-20">
    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-900/50 border border-dashed border-slate-700 flex items-center justify-center">
      <BookOpen className="w-8 h-8 text-slate-600" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">
      {search ? 'No markets found' : 'No Graduated Markets'}
    </h3>
    <p className="text-slate-400 mb-6 max-w-md mx-auto">
      {search 
        ? `No markets match "${search}". Try a different search term.`
        : 'Pro trading is available for graduated markets. Check the AMM for early-stage markets.'
      }
    </p>
    <Link to="/v8" className="text-amber-400 hover:text-amber-300 text-sm font-medium">
      Browse AMM Markets →
    </Link>
  </div>
);

// ============================================================================
// Trading Terminal
// ============================================================================
// Helper: Get block explorer URL
const getExplorerUrl = (chainId: number, txHash: string) => {
  const explorers: Record<number, string> = {
    84532: 'https://sepolia.basescan.org',
    8453: 'https://basescan.org',
  };
  return `${explorers[chainId] || 'https://sepolia.basescan.org'}/tx/${txHash}`;
};

const ProTradingTerminal = ({ marketId, embedded = false }: { marketId: string; embedded?: boolean }) => {
  const navigate = useNavigate();
  const { isConnected, address: userAddress } = useAccount();
  const chainId = useChainId();
  const { contracts } = useDeployments();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // UI State
  const [action, setAction] = useState<OrderAction>('buy_yes');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [priceMode, setPriceMode] = useState<'single' | 'range'>('range');
  const [priceLow, setPriceLow] = useState('45.0');
  const [priceHigh, setPriceHigh] = useState('55.0');
  const [amount, setAmount] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVaultPanel, setShowVaultPanel] = useState(false);
  const [vaultInput, setVaultInput] = useState('');

  // Slider dragging state
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [isLowDragging, setIsLowDragging] = React.useState(false);
  const [isHighDragging, setIsHighDragging] = React.useState(false);

  // Data
  const { v8Markets, selectedMarket } = useMemo(() => {
    const markets = marketsConfig.markets.filter(m => m.version.startsWith('v') && m.chainId === chainId);
    return {
      v8Markets: markets,
      selectedMarket: markets.find(m =>
        m.contractAddress.toLowerCase() === marketId.toLowerCase() ||
        m.id.toLowerCase() === marketId.toLowerCase()
      )
    };
  }, [marketId, chainId]);

  const marketAddr = selectedMarket?.contractAddress as `0x${string}`;
  const invalidateV8Queries = useInvalidateV8Queries();
  const { launchpad, isLoading: isLoadingLaunchpad } = useLaunchpadMarketDirect(marketAddr);
  const { collateralizer, isLoading: isCollateralizerLoading } = useCollateralizerDirect(marketAddr);
  const { amm } = useAmmMarketDirect(marketAddr);
  const { tickBook, isLoading: isTickBookLoading } = useTickBookDirect(
    marketAddr,
    collateralizer?.yesToken,
    collateralizer?.noToken
  );
  const { vault } = useTickBookVaultDirect(userAddress, marketAddr);
  const { orders: userOrders, isLoading: isOrdersLoading } = useUserOrdersDirect(
    tickBook?.marketKey as `0x${string}`,
    userAddress
  );

  const { balances } = useTokenBalances(useMemo(() => [
    contracts.MockUSDC as `0x${string}`
  ].filter(Boolean) as `0x${string}`[], [contracts.MockUSDC]));

  const { data: usdcDecimals } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: V8_ABIS.OutcomeToken,
    functionName: 'decimals',
    query: { enabled: !!contracts.MockUSDC, staleTime: Infinity },
  });
  const decimals = Number(usdcDecimals ?? 18);

  const walletUsdc = balances[0] ?? 0n;
  const vaultAvailable = vault?.availableUsdcWad ?? 0n;
  const vaultReserved = vault?.reservedUsdcWad ?? 0n;

  // Approval check
  const { data: vaultAllowance } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: V8_ABIS.OutcomeToken,
    functionName: 'allowance',
    args: isConnected && contracts.TickBookVault ? [userAddress!, contracts.TickBookVault as `0x${string}`] : undefined,
    query: { enabled: !!isConnected && !!contracts.TickBookVault && !!contracts.MockUSDC }
  });

  // Derived UI State
  const isBuying = action === 'buy_yes' || action === 'buy_no';
  const isYes = action === 'buy_yes' || action === 'sell_yes';

  const { quote: tbQuote, isLoading: isQuoteLoading } = useTickBookQuoteDirect(
    tickBook?.marketKey as `0x${string}`,
    isYes ? 1 : 0,  // YES=1, NO=0 (V8.13.0 unified semantics)
    amount
  );

  // Custom Slider Drag Logic - Integrated within terminal component
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if ((!isLowDragging && !isHighDragging) || !trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let percent = Math.max(0.1, Math.min(99.9, (x / rect.width) * 100));
    percent = Math.round(percent * 10) / 10;

    // Use current numeric values for bounds
    const curLowNum = parseFloat(priceLow);
    const curHighNum = parseFloat(priceHigh);

    if (isLowDragging) {
      if (priceMode === 'single') {
        setPriceLow(percent.toFixed(1));
        setPriceHigh(percent.toFixed(1));
      } else {
        // Drag LOW: Must not exceed current high. Independent movement.
        setPriceLow(Math.min(percent, curHighNum - 0.1).toFixed(1));
      }
    } else if (isHighDragging) {
      // Drag HIGH: Must not go below current low. Independent movement.
      setPriceHigh(Math.max(percent, curLowNum + 0.1).toFixed(1));
    }
  }, [isLowDragging, isHighDragging, priceMode, priceLow, priceHigh]);

  const handlePointerUp = useCallback(() => {
    setIsLowDragging(false);
    setIsHighDragging(false);
  }, []);

  useEffect(() => {
    if (isLowDragging || isHighDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isLowDragging, isHighDragging, handlePointerMove, handlePointerUp]);

  const needsApproval = useMemo(() => {
    return ((vaultAllowance as bigint) ?? 0n) < parseUnits('1000', decimals);
  }, [vaultAllowance, decimals]);

  // Derived values
  const tickBookProb = tickBook?.probability ?? 0.5;
  const ammProb = amm?.yesProbability ?? 0.5;
  const arbSpread = Math.abs(tickBookProb - ammProb) * 100;
  const hasArb = arbSpread >= 0.5; // Show arb indicator if >= 0.5% difference

  // Use tickBook price as primary (or fall back to AMM if no tickBook data)
  const currentProb = tickBookProb;
  const priceLowNum = parseFloat(priceLow) || 45;
  const priceHighNum = parseFloat(priceHigh) || 55;
  const amountNum = parseFloat(amount) || 0;
  const numTicks = priceMode === 'single' ? 1 : Math.max(1, Math.round((priceHighNum - priceLowNum) * 10) + 1);
  const avgPrice = priceMode === 'single' ? priceLowNum : (priceLowNum + priceHighNum) / 2;
  
  // Calculate required collateral based on action
  
  // For buys: cost to acquire shares
  // For sells: value you receive for selling shares
  const estimatedValue = useMemo(() => {
    if (!amountNum) return 0;
    const p = avgPrice / 100;
    if (action === 'buy_yes') return amountNum * p;
    if (action === 'buy_no') return amountNum * (1 - p);
    if (action === 'sell_yes') return amountNum * p;
    if (action === 'sell_no') return amountNum * (1 - p);
    return 0;
  }, [amountNum, avgPrice, action]);

  const hasEnoughBalance = isBuying 
    ? vaultAvailable >= parseUnits(estimatedValue.toFixed(2), 18)
    : true; // For sells, check if user has enough shares (handled separately)

  // Determine sell type for display purposes
  const sellType = useMemo(() => {
    if (isBuying || !amountNum) return null;
    const shares = isYes ? (vault?.yesInternal ?? 0n) : (vault?.noInternal ?? 0n);
    const needed = parseUnits(amountNum.toFixed(18), 18);
    if (shares >= needed) return 'spot';
    if (shares > 0n && shares < needed) return 'hybrid';
    return 'short';
  }, [isBuying, amountNum, isYes, vault?.yesInternal, vault?.noInternal]);

  // Handlers - with proper transaction tracking
  const handleApprove = async () => {
    setIsSubmitting(true);
    const toastId = toast.loading('Submitting approval...');
    try {
      const hash = await writeContractAsync({
        address: contracts.MockUSDC as `0x${string}`,
        abi: V8_ABIS.OutcomeToken,
        functionName: 'approve',
        args: [contracts.TickBookVault as `0x${string}`, parseUnits('1000000000', decimals)]
      });

      toast.loading('Waiting for confirmation...', { id: toastId });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      invalidateV8Queries();
      toast.success(
        <div className="flex items-center gap-2">
          <span>Vault approved!</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
    } catch (e: any) {
      const msg = e?.cause?.reason || e?.shortMessage || 'Approval failed';
      toast.error(msg, { id: toastId });
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeposit = async () => {
    if (!vaultInput) return;

    // Validate balance before submitting
    const depositWad = parseUnits(vaultInput, decimals);
    if (depositWad > walletUsdc) {
      toast.error(`Insufficient balance. You have $${parseFloat(formatUnits(walletUsdc, decimals)).toLocaleString()} USDC`);
      return;
    }

    setIsSubmitting(true);
    const depositAmt = vaultInput;
    const toastId = toast.loading('Submitting deposit...');
    try {
      const hash = await writeContractAsync({
        address: contracts.TickBookVault as `0x${string}`,
        abi: V8_ABIS.TickBookVault,
        functionName: 'depositUsdc',
        args: [depositWad]
      });

      toast.loading('Waiting for confirmation...', { id: toastId });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      invalidateV8Queries();
      setVaultInput('');
      toast.success(
        <div className="flex items-center gap-2">
          <span>Deposited ${depositAmt}</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
    } catch (e: any) {
      const msg = e?.cause?.reason || e?.shortMessage || 'Deposit failed';
      toast.error(msg, { id: toastId });
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!vaultInput) return;
    setIsSubmitting(true);
    const withdrawAmt = vaultInput;
    const toastId = toast.loading('Submitting withdrawal...');
    try {
      const hash = await writeContractAsync({
        address: contracts.TickBookVault as `0x${string}`,
        abi: V8_ABIS.TickBookVault,
        functionName: 'withdrawUsdc',
        args: [parseUnits(vaultInput, 18)]
      });

      toast.loading('Waiting for confirmation...', { id: toastId });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      invalidateV8Queries();
      setVaultInput('');
      toast.success(
        <div className="flex items-center gap-2">
          <span>Withdrew ${withdrawAmt}</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
    } catch (e: any) {
      const msg = e?.cause?.reason || e?.shortMessage || 'Withdrawal failed';
      toast.error(msg, { id: toastId });
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrade = async () => {
    if (!amount || !tickBook?.marketKey) return;
    setIsSubmitting(true);
    const amountBg = parseUnits(amount, 18);

    // Determine outcome: outcome=1 credits YES, outcome=0 credits NO
    const outcome = isYes ? 1 : 0;
    const isMarketOrder = orderType === 'market';
    const orderDesc = isMarketOrder
      ? `Market ${isBuying ? 'buy' : 'sell'} ${amount} ${isYes ? 'YES' : 'NO'}`
      : `Limit order ${amount} ${isYes ? 'YES' : 'NO'} @ ${priceLow}%`;

    const toastId = toast.loading(isMarketOrder ? 'Executing market order...' : 'Placing order...');

    try {
      let hash: `0x${string}`;

      if (isBuying) {
        // ============= BUY ORDERS =============
        if (isMarketOrder) {
          // Use real-time quote from TickBookV2 if available, otherwise fallback to estimate
          const finalCostWad = tbQuote?.estimatedCost ?? parseUnits(estimatedValue.toFixed(6), 18);
          const maxCost = (finalCostWad * 110n) / 100n; // 10% slippage buffer
          hash = await writeContractAsync({
          address: contracts.TickBook as `0x${string}`,
          abi: V8_ABIS.TickBook,
          functionName: 'executeMarketOrder',
          args: [tickBook.marketKey, outcome, amountBg, maxCost]
        });
      } else {
        const tickLow = Math.round(priceLowNum * 10);
        const tickHigh = priceMode === 'single' ? tickLow : Math.round(priceHighNum * 10);
        const liquidity = amountBg; // TickBookV2 takes total shares across the range
          hash = await writeContractAsync({
          address: contracts.TickBook as `0x${string}`,
          abi: V8_ABIS.TickBook,
          functionName: 'placeRangeOrder',
          args: [tickBook.marketKey, outcome, tickLow, tickHigh, liquidity]
        });
        }
      } else {
        // ============= SELL ORDERS =============
        // Determine sell type based on user's holdings:
        // - Spot Sell: User owns shares (sells existing position)
        // - Short Sell: User doesn't own shares (buys opposite outcome)
        // - Hybrid Sell: User owns some but not all (spot + short combo)

        const userYesInternal = vault?.yesInternal ?? 0n;
        const userNoInternal = vault?.noInternal ?? 0n;
        const userHolding = isYes ? userYesInternal : userNoInternal;

        const hasFullShares = userHolding >= amountBg;
        const hasPartialShares = userHolding > 0n && userHolding < amountBg;
        const hasNoShares = userHolding === 0n;

        if (isMarketOrder) {
          if (hasFullShares) {
            // SPOT SELL: User has all shares, sell them
            const estimatedProceeds = tbQuote?.estimatedCost ?? parseUnits(estimatedValue.toFixed(6), 18);
            const minProceeds = (estimatedProceeds * 90n) / 100n;

            hash = await writeContractAsync({
              address: contracts.TickBook as `0x${string}`,
              abi: V8_ABIS.TickBook,
              functionName: 'executeSpotSell',
              args: [tickBook.marketKey, outcome, amountBg, minProceeds]
            });
          } else if (hasPartialShares) {
            // HYBRID SELL: Spot sell owned shares + short sell remainder
            const estimatedProceeds = tbQuote?.estimatedCost ?? parseUnits(estimatedValue.toFixed(6), 18);
            const minProceeds = (estimatedProceeds * 90n) / 100n;

            hash = await writeContractAsync({
              address: contracts.TickBook as `0x${string}`,
              abi: V8_ABIS.TickBook,
              functionName: 'executeHybridSell',
              args: [tickBook.marketKey, outcome, amountBg, minProceeds]
            });
          } else {
            // SHORT SELL: No shares, buy opposite outcome with USDC
            // "Sell YES" without owning = "Buy NO" → need outcome=0 to get NO tokens
            // "Sell NO" without owning = "Buy YES" → need outcome=1 to get YES tokens
            const oppositeOutcome = isYes ? 0 : 1;
            const finalCostWad = tbQuote?.estimatedCost ?? parseUnits(estimatedValue.toFixed(6), 18);
            const maxCost = (finalCostWad * 110n) / 100n;

            hash = await writeContractAsync({
              address: contracts.TickBook as `0x${string}`,
              abi: V8_ABIS.TickBook,
              functionName: 'executeMarketOrder',
              args: [tickBook.marketKey, oppositeOutcome, amountBg, maxCost]
            });
          }
        } else {
          // LIMIT ORDERS
          const tickLow = Math.round(priceLowNum * 10);
          const tickHigh = priceMode === 'single' ? tickLow : Math.round(priceHighNum * 10);

          if (hasFullShares) {
            // SPOT SELL LIMIT: Place limit order to sell owned shares
            hash = await writeContractAsync({
              address: contracts.TickBook as `0x${string}`,
              abi: V8_ABIS.TickBook,
              functionName: 'placeSpotSellOrder',
              args: [tickBook.marketKey, outcome, tickLow, tickHigh, amountBg]
            });
          } else if (hasNoShares) {
            // SHORT SELL LIMIT: No shares, place limit order to buy opposite outcome
            // This is effectively a limit order to BUY NO (if selling YES)
            const oppositeOutcome = isYes ? 0 : 1;
            hash = await writeContractAsync({
              address: contracts.TickBook as `0x${string}`,
              abi: V8_ABIS.TickBook,
              functionName: 'placeRangeOrder',
              args: [tickBook.marketKey, oppositeOutcome, 1000 - tickHigh, 1000 - tickLow, amountBg]
            });
          } else {
            // HYBRID not supported for limit orders - prompt user
            const sharesFormatted = parseFloat(formatUnits(userHolding, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
            toast.error(`You have ${sharesFormatted} ${isYes ? 'YES' : 'NO'} shares. For limit orders, sell exactly that amount (spot) or enter 0 to short sell.`, { id: toastId });
            setIsSubmitting(false);
            return;
          }
        }
      }

      toast.loading('Waiting for confirmation...', { id: toastId });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      invalidateV8Queries();
      setAmount('');

      toast.success(
        <div className="flex items-center gap-2">
          <span>{isBuying ? (isMarketOrder ? 'Order executed!' : 'Order placed!') : 'Shares sold!'}</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
    } catch (e: any) {
      const msg = e?.cause?.reason || e?.shortMessage || 'Trade failed';
      toast.error(msg, { id: toastId });
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReady = launchpad ? (launchpad.canGraduate || (launchpad.graduationProgress ?? 0) >= 100) : false;

  // Not graduated - show lock screen once launchpad data is loaded
  // Don't wait for tickBook loading since tokens don't exist until graduation
  if (!launchpad?.isGraduated && !isReady && !isLoadingLaunchpad) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-gradient-to-b from-amber-950/20 to-transparent border border-amber-900/30 text-center">
          <Zap className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Pro Trading Locked</h2>
          <p className="text-slate-400 mb-6">This market hasn't graduated yet. Trade on the AMM first.</p>

          {launchpad && (
            <div className="mb-8 text-left bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <GraduationProgress
                feesAccrued={launchpad.feesAccrued ?? 0n}
                graduationThreshold={launchpad.graduationThreshold ?? 0n}
                graduationProgress={launchpad.graduationProgress ?? 0}
                isGraduated={false}
                canGraduate={launchpad.canGraduate ?? false}
              />
            </div>
          )}

          <Button onClick={() => navigate(`/trade/${marketAddr}`)} className="w-full bg-amber-600 hover:bg-amber-500 text-white">
            Go to AMM Trading
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button + Market Info (hidden when embedded) */}
      {!embedded && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/pro')}
            className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm font-bold">
              {selectedMarket?.symbol?.slice(0, 2) || 'PR'}
            </div>
            <div>
              <div className="font-semibold text-white">{selectedMarket?.symbol || 'Select Market'}</div>
              <div className="text-xs text-slate-500">{selectedMarket?.name?.slice(0, 50) || '—'}</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {/* TickBook Price (Primary) - larger, amber */}
            <div className="text-center p-2 rounded-lg bg-slate-950">
              <div className="text-[9px] text-slate-500 uppercase">Book Price</div>
              <div className="text-xl font-mono font-bold text-amber-400">{(tickBookProb * 100).toFixed(1)}%</div>
            </div>
            {/* AMM Price (Secondary) - smaller, grey */}
            <div className="text-center p-2 rounded-lg bg-slate-950">
              <div className="text-[9px] text-slate-500 uppercase">AMM Price</div>
              <div className="text-base font-mono font-medium text-slate-400">
                {(ammProb * 100).toFixed(1)}%
                {hasArb && <span className="ml-1 text-amber-400">⚡</span>}
              </div>
            </div>
            {/* Diff indicator - always show */}
            <div className={cn(
              "text-center p-2 rounded-lg",
              hasArb ? "bg-amber-500/10 border border-amber-500/30" : "bg-slate-950"
            )}>
              <div className={cn("text-[9px] uppercase", hasArb ? "text-amber-500/70" : "text-slate-500")}>Diff</div>
              <div className={cn("text-base font-mono font-bold", hasArb ? "text-amber-400" : "text-slate-500")}>
                {arbSpread.toFixed(1)}%
              </div>
            </div>
            <button onClick={() => invalidateV8Queries()} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <RefreshCw className={cn("w-4 h-4 text-slate-500", isTickBookLoading && "animate-spin")} />
            </button>
          </div>
        </div>
      )}

      {/* Embedded: Compact header with prices */}
      {embedded && (
        <div className="flex items-center gap-3">
          {/* TickBook Price (Primary) - larger, amber */}
          <div className="text-center p-2 rounded-lg bg-slate-950">
            <div className="text-[9px] text-slate-500 uppercase">Book Price</div>
            <div className="text-xl font-mono font-bold text-amber-400">{(tickBookProb * 100).toFixed(1)}%</div>
            </div>
          {/* AMM Price (Secondary) - smaller, grey */}
          <div className="text-center p-2 rounded-lg bg-slate-950">
            <div className="text-[9px] text-slate-500 uppercase">AMM Price</div>
            <div className="text-base font-mono font-medium text-slate-500">
              {(ammProb * 100).toFixed(1)}%
              {hasArb && <span className="ml-1 text-amber-400">⚡</span>}
          </div>
          </div>
          {/* Diff indicator - always show */}
          <div className={cn(
            "text-center p-2 rounded-lg",
            hasArb ? "bg-amber-500/10 border border-amber-500/30" : "bg-slate-950"
          )}>
            <div className={cn("text-[9px] uppercase", hasArb ? "text-amber-500/70" : "text-slate-500")}>Diff</div>
            <div className={cn("text-base font-mono font-bold", hasArb ? "text-amber-400" : "text-slate-500")}>
              {arbSpread.toFixed(1)}%
            </div>
          </div>
          <div className="ml-auto">
            <button onClick={() => invalidateV8Queries()} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <RefreshCw className={cn("w-4 h-4 text-slate-500", isTickBookLoading && "animate-spin")} />
          </button>
          </div>
        </div>
      )}

      {/* Vault Bar */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-slate-400">Vault</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-slate-500">Wallet:</span>
                <span className="ml-2 font-mono text-white">${parseFloat(formatUnits(walletUsdc, decimals)).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500">Available:</span>
                <span className="ml-2 font-mono text-emerald-400">${parseFloat(formatUnits(vaultAvailable, 18)).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500">In Orders:</span>
                <span className="ml-2 font-mono text-amber-400">${parseFloat(formatUnits(vaultReserved, 18)).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setShowVaultPanel(!showVaultPanel)}
            className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            {showVaultPanel ? 'Hide' : 'Manage'} <ChevronDown className={cn("w-4 h-4 transition-transform", showVaultPanel && "rotate-180")} />
          </button>
        </div>

        {showVaultPanel && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-3">
            <div className="relative">
            <input
              type="number"
              placeholder="Amount"
              value={vaultInput}
              onChange={(e) => setVaultInput(e.target.value)}
                className={`w-32 px-3 py-2 pr-12 bg-slate-950 border rounded-lg text-sm font-mono focus:outline-none ${vaultInput && parseUnits(vaultInput || '0', decimals) > walletUsdc
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-slate-700 focus:border-amber-500'
                  }`}
              />
              <button
                type="button"
                onClick={() => setVaultInput(formatUnits(walletUsdc, decimals))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-500 hover:text-amber-400"
              >
                MAX
              </button>
            </div>
            {needsApproval ? (
              <Button onClick={handleApprove} disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-500 text-white text-sm px-4">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve USDC'}
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleDeposit}
                  disabled={!vaultInput || isSubmitting || parseUnits(vaultInput || '0', decimals) > walletUsdc}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4"
                >
                  <ArrowUpRight className="w-4 h-4 mr-1" /> Deposit
                </Button>
                <Button onClick={handleWithdraw} disabled={!vaultInput || isSubmitting} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4">
                  <ArrowDownRight className="w-4 h-4 mr-1" /> Withdraw
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: Orderbook Visualization */}
        <div className="lg:col-span-2 space-y-4">
          {/* Pixel Liquidity Map */}
          <div className="rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Liquidity Map</span>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-emerald-400">◀ YES Bids</span>
                <span className="text-white font-bold">{(tickBookProb * 100).toFixed(1)}%</span>
                <span className="text-rose-400">NO Asks ▶</span>
              </div>
            </div>
            
            <div className="p-4">
              <LiquidityMap
                tickBook={tickBook}
                currentProb={currentProb}
                ammProb={ammProb}
                isLoading={isTickBookLoading}
              />
            </div>
          </div>

          {/* Your Positions */}
          <div className="rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Positions</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                <div className="text-[10px] text-emerald-500 uppercase mb-1">YES Shares</div>
                <div className="text-2xl font-mono font-bold text-white">
                  {parseFloat(formatUnits(vault?.yesInternal ?? 0n, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/30">
                <div className="text-[10px] text-rose-500 uppercase mb-1">NO Shares</div>
                <div className="text-2xl font-mono font-bold text-white">
                  {parseFloat(formatUnits(vault?.noInternal ?? 0n, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>

          {/* Your Orders */}
          <UserOrdersPanel
            orders={userOrders}
            marketKey={tickBook?.marketKey as `0x${string}`}
            isLoading={isOrdersLoading}
            onRefresh={() => invalidateV8Queries()}
            contracts={contracts as any}
            chainId={chainId}
          />
        </div>

          {/* RIGHT: Trading Panel */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/50 overflow-hidden sticky top-4">
              {/* Primary Toggle: YES / NO - subtle underline style */}
              <div className="flex border-b border-slate-800">
                <button
                  onClick={() => setAction(isBuying ? 'buy_yes' : 'sell_yes')}
                  className={cn(
                    "flex-1 py-3 font-bold text-sm uppercase tracking-wider transition-all",
                    isYes 
                      ? "text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5" 
                      : "text-slate-500 hover:text-slate-300 border-b-2 border-transparent"
                  )}
                >
                  YES
                </button>
                <button
                  onClick={() => setAction(isBuying ? 'buy_no' : 'sell_no')}
                  className={cn(
                    "flex-1 py-3 font-bold text-sm uppercase tracking-wider transition-all",
                    !isYes 
                      ? "text-rose-400 border-b-2 border-rose-500 bg-rose-500/5" 
                      : "text-slate-500 hover:text-slate-300 border-b-2 border-transparent"
                  )}
                >
                  NO
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Secondary: BUY/SELL + LIMIT/MARKET */}
                <div className="flex gap-2">
                  {/* Buy/Sell Toggle - contextual colors */}
                <div className="flex-1 flex gap-2 p-1 bg-slate-950/50 rounded-xl">
                    <button
                      onClick={() => setAction(isYes ? 'buy_yes' : 'buy_no')}
                      className={cn(
                      "flex-1 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all border-2",
                        isBuying 
                          ? isYes 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/50 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]"
                        : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
                      )}
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => setAction(isYes ? 'sell_yes' : 'sell_no')}
                      className={cn(
                      "flex-1 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all border-2",
                        !isBuying 
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/50 shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]"
                        : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
                      )}
                    >
                      Sell
                    </button>
                  </div>
                  
                  {/* Limit/Market Toggle - neutral styling */}
                <div className="flex gap-2 p-1 bg-slate-950/50 rounded-xl">
                    <button
                      onClick={() => setOrderType('limit')}
                      className={cn(
                      "flex-1 px-4 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all border-2",
                        orderType === 'limit' 
                        ? isYes
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/50 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]"
                        : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
                      )}
                    >
                      Limit
                    </button>
                    <button
                      onClick={() => setOrderType('market')}
                      className={cn(
                      "flex-1 px-4 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all border-2",
                        orderType === 'market' 
                        ? isYes
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/50 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]"
                        : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
                      )}
                    >
                      Market
                    </button>
                  </div>
                </div>

              {/* Price Input (Limit only) */}
              {orderType === 'limit' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Price</div>
                    <div className="text-[9px] text-slate-600 font-mono">0.1 — 99.9</div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                          step="0.1"
                        value={priceLow}
                          onChange={(e) => setPriceLow(e.target.value)}
                          onBlur={() => {
                            let val = Math.max(0.1, Math.min(99.9, Number(priceLow)));
                            setPriceLow(val.toFixed(1));
                            if (priceMode === 'single') setPriceHigh(val.toFixed(1));
                            else if (val >= priceHighNum) setPriceHigh((val + 0.1).toFixed(1));
                          }}
                        className={cn(
                            "w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-lg font-mono font-bold text-center focus:outline-none transition-all",
                            isYes ? "focus:border-emerald-500/50" : "focus:border-rose-500/50"
                        )}
                      />
                    </div>
                    
                    {priceMode === 'range' && (
                      <>
                          <div className="text-slate-700 font-bold">—</div>
                        <div className="relative flex-1">
                          <input
                            type="number"
                              step="0.1"
                            value={priceHigh}
                            onChange={(e) => setPriceHigh(e.target.value)}
                              onBlur={() => {
                                let val = Math.max(0.1, Math.min(99.9, Number(priceHigh)));
                                setPriceHigh(val.toFixed(1));
                                if (val <= priceLowNum) setPriceLow((val - 0.1).toFixed(1));
                              }}
                            className={cn(
                                "w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-lg font-mono font-bold text-center focus:outline-none transition-all",
                                isYes ? "focus:border-emerald-500/50" : "focus:border-rose-500/50"
                            )}
                          />
                        </div>
                      </>
                    )}
                    </div>
                    
                    <button
                      onClick={() => {
                        if (priceMode === 'single') {
                          setPriceMode('range');
                          setPriceHigh(Math.min(99.9, priceLowNum + 10).toFixed(1));
                        } else {
                          setPriceMode('single');
                          setPriceHigh(priceLow);
                        }
                      }}
                      className={cn(
                        "h-[48px] px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center border-2",
                        priceMode === 'range' 
                          ? isYes 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/50 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]"
                          : "bg-slate-900/50 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700"
                      )}
                    >
                      {priceMode === 'single' ? '± Range' : 'Single'}
                    </button>
                  </div>
                  
                  {/* Slider Control */}
                  <div className="space-y-2 mb-4 px-1">
                    <div
                      ref={trackRef}
                      className="relative h-6 flex items-center group cursor-default"
                    >
                      <div className="absolute inset-x-0 h-1 bg-slate-800/80 rounded-full" />

                      <div 
                        className={cn(
                          "absolute h-1 rounded-full pointer-events-none",
                          isYes
                            ? "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            : "bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                        )}
                        style={priceMode === 'single' 
                          ? { left: '0%', width: `${priceLowNum}%` }
                          : { left: `${priceLowNum}%`, width: `${Math.max(0.2, priceHighNum - priceLowNum)}%` }
                        }
                      />

                      {/* Visual Handles - Now with pointer interaction */}
                      <div
                        onPointerDown={(e) => {
                          e.preventDefault();
                          setIsLowDragging(true);
                        }}
                        className={cn(
                          "absolute w-5 h-5 rounded-full border-2 border-white shadow-[0_0_15px_rgba(0,0,0,0.6)] z-20 transition-transform cursor-grab active:cursor-grabbing hover:scale-110",
                          isYes ? "bg-emerald-500" : "bg-rose-500",
                          isLowDragging && "scale-125"
                        )} 
                        style={{ left: `calc(${priceLowNum}% - 10px)` }} 
                      />
                      {priceMode === 'range' && (
                        <div 
                          onPointerDown={(e) => {
                            e.preventDefault();
                            setIsHighDragging(true);
                          }}
                          className={cn(
                            "absolute w-5 h-5 rounded-full border-2 border-white shadow-[0_0_15px_rgba(0,0,0,0.6)] z-20 transition-transform cursor-grab active:cursor-grabbing hover:scale-110",
                            isYes ? "bg-emerald-200" : "bg-rose-200",
                            isHighDragging && "scale-125"
                          )} 
                          style={{ left: `calc(${priceHighNum}% - 10px)` }}
                        />
                      )}
                    </div>
                    
                    <div className="text-center text-[10px] font-mono">
                      {priceMode === 'single' 
                        ? <span className="text-slate-500">Tick <span className={cn(isYes ? "text-emerald-400" : "text-rose-400")}>{Math.round(priceLowNum * 10)}</span></span>
                        : <span className="text-slate-500"><span className={cn("font-bold", isYes ? "text-emerald-400" : "text-rose-400")}>{numTicks}</span> ticks</span>
                      }
                    </div>
                  </div>

                  {/* Presets Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-6">
                    {(priceMode === 'single' 
                      ? [[25.0], [50.0], [75.0]] 
                      : [[40.0, 60.0], [45.0, 55.0], [48.0, 52.0]]
                    ).map((p, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setPriceLow(p[0].toFixed(1));
                          setPriceHigh((p[1] ?? p[0]).toFixed(1));
                        }}
                        className="py-2 text-[10px] font-mono text-slate-500 hover:text-white bg-slate-900/40 border border-slate-800/50 hover:border-slate-700 rounded-lg transition-all"
                      >
                        {p.length > 1 ? `${p[0]}—${p[1]}` : p[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider">Amount (Shares)</label>
                  <span className="text-[10px] text-slate-600 font-mono">
                    Max: {parseFloat(formatUnits(vaultAvailable, 18)).toLocaleString()}
                  </span>
                </div>
                <input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-xl font-mono font-bold focus:border-amber-500 focus:outline-none"
                />
                {/* Quick amount buttons */}
                <div className="flex gap-2 mt-2">
                  {[100, 500, 1000].map(a => (
                    <button
                      key={a}
                      onClick={() => setAmount(a.toString())}
                      className="flex-1 py-1 text-xs font-mono text-slate-500 hover:text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                {orderType === 'limit' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">
                      {priceMode === 'single' ? 'Price' : 'Price Range'}
                    </span>
                    <span className="font-mono text-amber-400">
                      {priceMode === 'single' 
                        ? priceLowNum.toFixed(1)
                        : `${priceLowNum.toFixed(1)} – ${priceHighNum.toFixed(1)}`}
                    </span>
                  </div>
                )}
                {orderType === 'limit' && priceMode === 'range' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Shares/Tick</span>
                    <span className="font-mono text-slate-300">
                      {amountNum > 0 ? (amountNum / numTicks).toFixed(2) : '–'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    {isBuying ? 'Est. Cost' : sellType === 'spot' ? 'Est. Return' : 'Est. Cost'}
                  </span>
                  <span className={cn(
                    "font-mono",
                    isBuying ? "text-white" : sellType === 'spot' ? "text-emerald-400" : "text-white"
                  )}>
                    {amountNum > 0 
                      ? `${sellType === 'spot' ? '+' : ''}$${estimatedValue.toFixed(2)}`
                      : '–'
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    {isBuying ? 'Available USDC' : `Your ${isYes ? 'YES' : 'NO'} Shares`}
                  </span>
                  <span className={cn("font-mono", hasEnoughBalance ? "text-emerald-400" : "text-rose-400")}>
                    {isBuying 
                      ? `$${parseFloat(formatUnits(vaultAvailable, 18)).toFixed(2)}`
                      : parseFloat(formatUnits(isYes ? (vault?.yesInternal ?? 0n) : (vault?.noInternal ?? 0n), 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })
                    }
                  </span>
                </div>
              </div>

              {/* Insufficient Balance Warning */}
              {amount && isBuying && !hasEnoughBalance && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/30 border border-rose-900/30 text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Insufficient vault balance. <button onClick={() => setShowVaultPanel(true)} className="underline">Deposit more</button></span>
                </div>
              )}
              
              {/* Sell Mode Info (shows what type of sell will execute) */}
              {amount && !isBuying && (() => {
                const shares = isYes ? (vault?.yesInternal ?? 0n) : (vault?.noInternal ?? 0n);
                const needed = parseUnits(amount, 18);
                const hasAll = shares >= needed;
                const hasPartial = shares > 0n && shares < needed;
                const hasNone = shares === 0n;

                if (hasAll) {
                  const neededFmt = parseFloat(formatUnits(needed, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
                  const sharesFmt = parseFloat(formatUnits(shares, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
                  return (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 text-xs">
                      <span>📦 Spot Sell: Selling {neededFmt} of your {sharesFmt} {isYes ? 'YES' : 'NO'} shares</span>
                </div>
                  );
                } else if (hasPartial) {
                  const spotFmt = parseFloat(formatUnits(shares, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
                  const shortFmt = parseFloat(formatUnits(needed - shares, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
                  return (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-950/30 border border-amber-900/30 text-amber-400 text-xs">
                      <span>🔀 Hybrid Sell: {spotFmt} spot + {shortFmt} short ({isYes ? 'NO' : 'YES'} buy)</span>
                    </div>
                  );
                } else if (hasNone) {
                  const neededFmt = parseFloat(formatUnits(needed, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
                  return (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-950/30 border border-blue-900/30 text-blue-400 text-xs">
                      <span>📉 Short Sell: Buying {neededFmt} {isYes ? 'NO' : 'YES'} (equivalent to selling {isYes ? 'YES' : 'NO'})</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Execute Button */}
              <Button
                onClick={handleTrade}
                disabled={!isConnected || !amount || isSubmitting || isTickBookLoading || isCollateralizerLoading || !tickBook?.isActive || (isBuying && !hasEnoughBalance)}
                className={cn(
                  "w-full py-4 text-lg font-bold uppercase tracking-wider rounded-xl transition-all",
                  action === 'buy_yes' && "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-600/25",
                  action === 'buy_no' && "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 shadow-lg shadow-rose-600/25",
                  (action === 'sell_yes' || action === 'sell_no') && "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-600/25",
                  (!isConnected || !amount || isSubmitting || isTickBookLoading || isCollateralizerLoading || !tickBook?.isActive || (isBuying && !hasEnoughBalance)) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : !isConnected ? (
                  'Connect Wallet'
                ) : (isTickBookLoading || isCollateralizerLoading || !tickBook) ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Initializing...
                  </span>
                ) : !tickBook.isActive ? (
                  'TickBook Not Initialized'
                ) : !amount ? (
                  'Enter Amount'
                ) : (
                  `${isBuying ? 'Buy' : 'Sell'} ${isYes ? 'YES' : 'NO'} ${isBuying ? 'with' : 'for'} $${estimatedValue.toFixed(2)}`
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pro;
