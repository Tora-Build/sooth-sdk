/**
 * UserOrdersPanel - Order management panel for TickBook
 * 
 * Displays user's active orders (range and spot sells) with
 * claim, cancel, and batch operation capabilities.
 */
import React, { useState, useMemo } from 'react';
import { Loader2, BarChart3, BookOpen, HelpCircle } from 'lucide-react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import toast from 'react-hot-toast';

import { cn } from '../../../lib/utils';
import { logger } from '../../../lib/logger';
import { Tooltip } from '../../ui/Tooltip';
import { ClaimFillsButton } from '../ClaimFillsButton';
import { ABIS } from '../../../config/abis';
import type { RangeOrder } from '../../../hooks';
import type { SpotSellOrderIndexed } from '../../../hooks/indexer';

// ============================================================================
// Types
// ============================================================================
export interface UserOrdersPanelProps {
  orders: RangeOrder[];
  spotSells?: SpotSellOrderIndexed[];
  marketKey: `0x${string}` | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  contracts: Record<string, string>;
  chainId: number;
  viewOutcome: 'yes' | 'no';
  yesShares?: bigint;
  noShares?: bigint;
  onCancelSpotSell?: (sellId: bigint) => Promise<{ sharesReturned: bigint; txHash: `0x${string}` } | null>;
  pendingRefundsWad?: bigint;
}

type OrderSort = 'newest' | 'price' | 'fill' | 'created';
type OrdersGroup = 'orders' | 'spot';
type OrderFilter = 'all' | 'claimable' | 'open' | 'filled';

const MAX_BATCH_SIZE = 50;
const ONE_SHARE_WAD = 10n ** 18n;

// ============================================================================
// Helpers
// ============================================================================
function formatUsdWad(
  amountWad: bigint,
  decimals: number = 18,
  displayDecimals: number = 2
): string {
  const scale = 10n ** BigInt(decimals);
  const whole = amountWad / scale;
  const frac = amountWad % scale;

  const fracScale = 10n ** BigInt(displayDecimals);
  const fracDisplay = (frac * fracScale) / scale;

  return `${whole.toString()}.${fracDisplay.toString().padStart(displayDecimals, '0')}`;
}

function getFillPercent(order: RangeOrder): number {
  const totalFilled = order.filledShares + order.pendingShares;
  const capped = totalFilled > order.sharesTotal ? order.sharesTotal : totalFilled;
  if (order.sharesTotal === 0n) return 0;
  return Number((capped * 10000n) / order.sharesTotal) / 100;
}

function isEffectivelyFilled(order: RangeOrder): boolean {
  const totalFilled = order.filledShares + order.pendingShares;
  if (order.sharesTotal === 0n) return false;
  const fillPct = (totalFilled * 100n) / order.sharesTotal;
  const unfilled = order.sharesTotal > totalFilled ? order.sharesTotal - totalFilled : 0n;
  return fillPct >= 99n || unfilled < ONE_SHARE_WAD;
}

// ============================================================================
// Component
// ============================================================================
export function UserOrdersPanel({
  orders,
  spotSells,
  marketKey,
  isLoading,
  onRefresh,
  contracts,
  chainId,
  viewOutcome,
  yesShares,
  noShares,
  onCancelSpotSell,
  pendingRefundsWad,
}: UserOrdersPanelProps): JSX.Element {
  const { writeContractAsync } = useWriteContract();
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [group, setGroup] = useState<OrdersGroup>('orders');
  const [sortBy, setSortBy] = useState<OrderSort>('newest');
  const [filter, setFilter] = useState<OrderFilter>('all');

  const userSpotSells = useMemo(() => {
    const addr = userAddress?.toLowerCase();
    if (!addr || !spotSells) return [];

    return spotSells
      .filter((s) => s.active && s.owner.toLowerCase() === addr)
      .sort((a, b) => Number(b.sellId - a.sellId));
  }, [spotSells, userAddress]);

  const activeOrders = orders.filter((order) => order.active);

  // Categorize orders for filter counts
  const claimableFilterOrders = activeOrders.filter((order) => order.pendingShares > 0n);
  const filledOrders = activeOrders.filter((order) => isEffectivelyFilled(order));
  const openOrders = activeOrders.filter((order) => !isEffectivelyFilled(order));

  // Apply filter
  const filteredOrders = activeOrders.filter((order) => {
    switch (filter) {
      case 'claimable':
        return order.pendingShares > 0n;
      case 'filled':
        return isEffectivelyFilled(order);
      case 'open':
        return !isEffectivelyFilled(order);
      default:
        return true;
    }
  });

  // Sort orders
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return a.tickLower - b.tickLower;
      case 'fill':
        return getFillPercent(b) - getFillPercent(a);
      case 'created':
        if (a.createdAt && b.createdAt) return b.createdAt - a.createdAt;
        return Number(b.orderId - a.orderId);
      default:
        return Number(b.orderId - a.orderId);
    }
  });

  const claimableOrders = activeOrders
    .filter((order) => order.pendingShares > 0n)
    .slice(0, MAX_BATCH_SIZE);

  const cancelableOrders = openOrders.slice(0, MAX_BATCH_SIZE);

  // Batch cancel handler
  const handleBatchCancel = async () => {
    if (!marketKey || openOrders.length === 0) return;
    if (!contracts.TickBookPoolManager) {
      toast.error('TickBookPoolManager not deployed');
      return;
    }

    setActionInProgress('batch-cancel');
    const toastId = toast.loading(`Cancelling ${openOrders.length} order(s)...`);

    try {
      let targetOrderIds = openOrders.map(o => o.orderId);

      // Pre-flight check: Verify orders are active on-chain
      if (publicClient && userAddress) {
        const results = await publicClient.multicall({
          contracts: targetOrderIds.map(id => ({
            address: contracts.TickBookPoolManager as `0x${string}`,
            abi: ABIS.TickBookPoolManager,
            functionName: 'getOrder',
            args: [marketKey, id]
          }))
        });

        const activeIds: bigint[] = [];
        results.forEach((res, idx) => {
          if (res.status === 'success' && (res.result as any).active) {
            activeIds.push(targetOrderIds[idx]);
          }
        });

        if (activeIds.length === 0) {
          toast.error('All selected orders are already inactive', { id: toastId });
          onRefresh();
          return;
        }

        if (activeIds.length < targetOrderIds.length) {
          logger.cancel.warn(`Filtered ${targetOrderIds.length - activeIds.length} inactive orders`);
          targetOrderIds = activeIds;
        }
      }

      logger.cancel.log('Calling batchCancelOrders:', { marketKey, orderIds: targetOrderIds.map(id => id.toString()) });

      // Simulate first to catch specific errors
      if (publicClient && userAddress) {
        try {
          await publicClient.simulateContract({
            account: userAddress,
            address: contracts.TickBookPoolManager as `0x${string}`,
            abi: ABIS.TickBookPoolManager,
            functionName: 'batchCancelOrders',
            args: [marketKey, targetOrderIds],
            gas: BigInt(200000 + openOrders.length * 150000),
          });
        } catch (simError: any) {
          logger.cancel.error('Simulation failed:', simError);
          const reason = simError.cause?.reason || simError.shortMessage || simError.message || 'Simulation failed';

          if (reason.includes('OrderNotActive')) {
            toast.error('Some orders are no longer active. Refreshing...', { id: toastId });
            onRefresh();
            return;
          }

          logger.cancel.warn('Simulation failed, attempting forced execution:', simError);
        }
      }

      const hash = await writeContractAsync({
        address: contracts.TickBookPoolManager as `0x${string}`,
        abi: ABIS.TickBookPoolManager,
        functionName: 'batchCancelOrders',
        args: [marketKey, targetOrderIds],
        gas: BigInt(500000 + openOrders.length * 200000),
      });

      toast.loading('Waiting for confirmation...', { id: toastId });

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
        if (receipt.status === 'reverted') {
          toast.error('Transaction reverted', { id: toastId, duration: 5000 });
          setActionInProgress(null);
          return;
        }
      }

      // Also claim any pending refunds
      try {
        const pendingRefunds = await publicClient?.readContract({
          address: contracts.TickBookPoolManager as `0x${string}`,
          abi: ABIS.TickBookPoolManager,
          functionName: 'getPendingRefunds',
          args: [userAddress, marketKey],
        }) as bigint | undefined;

        if (pendingRefunds && pendingRefunds > 0n) {
          await writeContractAsync({
            address: contracts.TickBookPoolManager as `0x${string}`,
            abi: ABIS.TickBookPoolManager,
            functionName: 'claimPooledRefunds',
            args: [marketKey],
          });
        }
      } catch (refundErr) {
        logger.cancel.warn('Refund claim failed (non-blocking):', refundErr);
      }

      toast.success(`Cancelled ${openOrders.length} order(s)`, { id: toastId, duration: 5000 });
      onRefresh();
    } catch (e: any) {
      logger.cancel.error('Error:', e);
      const msg = e?.cause?.reason || e?.shortMessage || e?.message || 'Batch cancel failed';
      toast.error(msg, { id: toastId, duration: 5000 });
    } finally {
      setActionInProgress(null);
    }
  };


  const handleCancelOrder = async (orderId: bigint, isClose: boolean = false) => {
    if (!marketKey) return;
    if (!contracts.TickBookPoolManager) {
      toast.error('TickBookPoolManager not deployed');
      return;
    }
    setActionInProgress(`cancel-${orderId.toString()}`);
    const actionLabel = isClose ? 'Closing' : 'Cancelling';
    const successLabel = isClose ? 'closed' : 'cancelled';
    const toastId = toast.loading(`${actionLabel} order...`);
    try {
      logger.cancel.log('Calling cancelOrder:', { marketKey, orderId: orderId.toString(), poolManager: contracts.TickBookPoolManager });

      let hash: `0x${string}`;
      try {
        hash = await writeContractAsync({
          address: contracts.TickBookPoolManager as `0x${string}`,
          abi: ABIS.TickBookPoolManager,
          functionName: 'cancelOrder',
          args: [marketKey, orderId]
        });
      } catch (simError: any) {
        logger.cancel.error('Simulation/wallet error:', simError);
        const simMsg = simError?.cause?.reason || simError?.shortMessage || simError?.message || 'Transaction failed';
        toast.error(simMsg, { id: toastId, duration: 5000 });
        setActionInProgress(null);
        return;
      }
      logger.cancel.log('TX submitted:', hash);

      toast.loading('Waiting for confirmation...', { id: toastId });

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        logger.cancel.log('TX receipt:', receipt.status, receipt);
        if (receipt.status === 'reverted') {
          toast.error('Transaction reverted on-chain', { id: toastId });
          return;
        }
      }

      toast.success(`Order ${successLabel}! TX: ${hash.slice(0, 10)}...`, { id: toastId, duration: 5000 });
      logger.cancel.log('Success! Refreshing...');
      onRefresh();
    } catch (e: any) {
      logger.cancel.error('Error:', e);
      const msg = e?.cause?.reason || e?.shortMessage || e?.message || `${actionLabel} failed`;
      toast.error(msg, { id: toastId, duration: 5000 });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleClaimFills = async (orderId: bigint) => {
    if (!marketKey) return;
    if (!contracts.TickBookPoolManager) {
      toast.error('TickBookPoolManager not deployed');
      return;
    }

    logger.claim.log('Calling claimFills:', { marketKey, orderId: orderId.toString(), poolManager: contracts.TickBookPoolManager });

    setActionInProgress(`claim-${orderId.toString()}`);
    const toastId = toast.loading('Claiming fills...');
    try {

      let hash: `0x${string}`;
      try {
        hash = await writeContractAsync({
          address: contracts.TickBookPoolManager as `0x${string}`,
          abi: ABIS.TickBookPoolManager,
          functionName: 'claimFills',
          args: [marketKey, orderId]
        });
      } catch (simError: any) {
        logger.claim.error('Simulation/wallet error:', simError);
        const simMsg = simError?.cause?.reason || simError?.shortMessage || simError?.message || 'Transaction failed';
        toast.error(simMsg, { id: toastId, duration: 5000 });
        setActionInProgress(null);
        return;
      }
      logger.claim.log('TX submitted:', hash);

      toast.loading('Waiting for confirmation...', { id: toastId });
      logger.claim.log('Waiting for receipt...');

      if (publicClient) {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
          logger.claim.log('TX receipt:', receipt.status, receipt);
          if (receipt.status === 'reverted') {
            toast.error('Transaction reverted on-chain', { id: toastId, duration: 5000 });
            setActionInProgress(null);
            return;
          }
        } catch (receiptError: any) {
          logger.claim.error('Receipt error:', receiptError);
          toast.error(`Receipt error: ${receiptError?.message || 'Unknown'}`, { id: toastId, duration: 5000 });
          setActionInProgress(null);
          return;
        }
      } else {
        logger.claim.warn('No publicClient - cannot wait for receipt');
      }

      toast.success(`Fills claimed! TX: ${hash.slice(0, 10)}...`, { id: toastId, duration: 5000 });
      logger.claim.log('Success! Refreshing...');
      onRefresh();
    } catch (e: any) {
      logger.claim.error('Outer error:', e);
      const msg = e?.cause?.reason || e?.shortMessage || e?.message || 'Claim failed';
      toast.error(msg, { id: toastId, duration: 5000 });
    } finally {
      logger.claim.log('Finally block - clearing action');
      setActionInProgress(null);
    }
  };

  async function handleClaimRefunds(): Promise<void> {
    if (!marketKey || !pendingRefundsWad || pendingRefundsWad === 0n) return;
    if (!contracts.TickBookPoolManager) {
      toast.error('TickBookPoolManager not deployed');
      return;
    }

    setActionInProgress('claim-refunds');
    const toastId = toast.loading('Claiming refunds...');
    try {
      const hash = await writeContractAsync({
        address: contracts.TickBookPoolManager as `0x${string}`,
        abi: ABIS.TickBookPoolManager,
        functionName: 'claimPooledRefunds',
        args: [marketKey],
      });

      toast.loading('Waiting for confirmation...', { id: toastId });
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
        if (receipt.status === 'reverted') {
          toast.error('Transaction reverted', { id: toastId });
          return;
        }
      }

      toast.success(`Refunds claimed: $${formatUsdWad(pendingRefundsWad)}`, { id: toastId });
      onRefresh();
    } catch (e: any) {
      const msg = e?.cause?.reason || e?.shortMessage || e?.message || 'Claim refunds failed';
      toast.error(msg, { id: toastId });
    } finally {
      setActionInProgress(null);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            YOUR <span className={viewOutcome === 'yes' ? 'text-emerald-400' : 'text-rose-400'}>{viewOutcome === 'yes' ? 'YES' : 'NO'}</span> ORDERS
          </span>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          YOUR ORDERS <span className="text-slate-600">({activeOrders.length + userSpotSells.length})</span>
        </span>
        <div className="flex items-center gap-2">
          {/* Batch Actions based on Group and Filter */}
          {group === 'orders' && (
            <>
              {filter !== 'claimable' && (
                <button
                  onClick={handleBatchCancel}
                  disabled={cancelableOrders.length === 0 || actionInProgress === 'batch-cancel'}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold transition-all border',
                    cancelableOrders.length === 0 || actionInProgress === 'batch-cancel'
                      ? 'bg-slate-800/50 text-slate-600 border-slate-700/50 cursor-not-allowed'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                  )}
                  title="Cancel orders that are not fully filled"
                >
                  {actionInProgress === 'batch-cancel' ? <Loader2 size={10} className="animate-spin" /> : null}
                  Cancel ({cancelableOrders.length})
                </button>
              )}
              <ClaimFillsButton
                marketKey={marketKey}
                orderIds={claimableOrders.map(o => o.orderId)}
                compact
                label={`Claim (${claimableOrders.length})`}
                variant="filled"
                disabled={claimableOrders.length === 0}
                onSuccess={onRefresh}
              />
            </>
          )}

          {(pendingRefundsWad ?? 0n) > 0n && (
            <button
              onClick={handleClaimRefunds}
              disabled={actionInProgress === 'claim-refunds'}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold transition-all border bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
            >
              {actionInProgress === 'claim-refunds' && <Loader2 size={10} className="animate-spin" />}
              Refund ${formatUsdWad(pendingRefundsWad ?? 0n)}
            </button>
          )}
          <Tooltip
            content="Spot sells are asks backed by shares you already own. If you only own some of what you're selling, the app may do a hybrid sell (spot + short), often as 2 transactions. Spot sells cancel one-by-one; Cancel All / Claim All only apply to Orders."
            position="bottom"
          >
            <button type="button" className="p-1 hover:bg-slate-800 rounded transition-colors" aria-label="Hint">
              <HelpCircle className="w-4 h-4 text-slate-500" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Filter & Sort Row */}
      <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
        {/* Group toggle */}
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setGroup('orders')}
            className={cn(
              "px-2 py-1 rounded-md font-medium transition-colors",
              group === 'orders' ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Range ({activeOrders.length})
          </button>
          <button
            onClick={() => setGroup('spot')}
            className={cn(
              "px-2 py-1 rounded-md font-medium transition-colors",
              group === 'spot' ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Spot ({userSpotSells.length})
          </button>
        </div>

        {group === 'orders' && (
          <>
            {/* Filter dropdown */}
            <div className="flex items-center gap-1">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as OrderFilter)}
                className="bg-slate-800/50 border-none rounded px-2 py-1 text-slate-300 text-xs focus:ring-0"
              >
                <option value="all">All ({activeOrders.length})</option>
                <option value="claimable">Claimable ({claimableFilterOrders.length})</option>
                <option value="open">Open ({openOrders.length})</option>
                <option value="filled">Filled ({filledOrders.length})</option>
              </select>
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-slate-600">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as OrderSort)}
                className="bg-slate-800/50 border-none rounded px-2 py-1 text-slate-300 text-xs focus:ring-0"
              >
                <option value="newest">Order ID</option>
                <option value="created">Created</option>
                <option value="price">Price</option>
                <option value="fill">Fill %</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* Summary Cards - Shows vault internal positions */}
      {(yesShares !== undefined || noShares !== undefined) && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="py-1.5 px-2 rounded-lg bg-emerald-950/10 border border-emerald-900/20">
            <div className="text-xs text-emerald-500/80 uppercase font-bold">YES Position</div>
            <div className="text-sm font-mono font-bold text-white">
              {parseFloat(formatUnits(yesShares ?? 0n, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="py-1.5 px-2 rounded-lg bg-rose-950/10 border border-rose-900/20">
            <div className="text-xs text-rose-500/80 uppercase font-bold">NO Position</div>
            <div className="text-sm font-mono font-bold text-white">
              {parseFloat(formatUnits(noShares ?? 0n, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      )}

      {group === 'orders' ? (
        sortedOrders.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No active orders</p>
            <p className="text-xs text-slate-600">Place a limit order to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="space-y-1 min-w-[480px]">
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800/50">
                <span className="shrink-0 w-10">ID</span>
                <span className="shrink-0 w-10">Side</span>
                <span className="shrink-0 w-24">Price</span>
                <span className="shrink-0 w-12">Size</span>
                <span className="shrink-0 w-16">Fill</span>
                <div className="flex-1" />
                <span className="shrink-0 text-right">Action</span>
              </div>
              {sortedOrders.map((order) => {
                const fillPercent = getFillPercent(order);
                const isYesOrder = order.outcome === 1;
                const isBuy = (viewOutcome === 'yes' && isYesOrder) || (viewOutcome === 'no' && !isYesOrder);
                const orderId = order.orderId.toString();
                const isFullyFilled = isEffectivelyFilled(order);
                const hasPendingFills = order.pendingShares > 0n || (order.pendingUsdc ?? 0n) > 0n;

                // Calculate display price
                const lower = order.tickLower / 10;
                const upper = order.tickUpper / 10;
                let displayPrice = "";
                if (viewOutcome === 'yes') {
                  if (isYesOrder) {
                    displayPrice = lower === upper ? `${lower.toFixed(1)}¢` : `${lower.toFixed(1)}-${upper.toFixed(1)}¢`;
                  } else {
                    const invLow = 100 - upper;
                    const invHigh = 100 - lower;
                    displayPrice = invLow === invHigh ? `${invLow.toFixed(1)}¢` : `${invLow.toFixed(1)}-${invHigh.toFixed(1)}¢`;
                  }
                } else {
                  if (!isYesOrder) {
                    displayPrice = lower === upper ? `${lower.toFixed(1)}¢` : `${lower.toFixed(1)}-${upper.toFixed(1)}¢`;
                  } else {
                    const invLow = 100 - upper;
                    const invHigh = 100 - lower;
                    displayPrice = invLow === invHigh ? `${invLow.toFixed(1)}¢` : `${invLow.toFixed(1)}-${invHigh.toFixed(1)}¢`;
                  }
                }

                return (
                  <div
                    key={orderId}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border transition-all",
                      isFullyFilled ? "bg-slate-900/30 border-slate-800/30 opacity-50" : "bg-slate-900/50 border-slate-800/50 hover:border-slate-700"
                    )}
                  >
                    <span className="shrink-0 w-10 text-xs font-mono text-slate-500">#{orderId}</span>

                    <span className={cn(
                      "shrink-0 w-10 py-0.5 rounded text-xs font-bold text-center uppercase",
                      isBuy ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    )}>
                      {isBuy ? 'Buy' : 'Sell'}
                    </span>

                    <span className="shrink-0 w-24 text-xs font-mono font-medium text-white">{displayPrice}</span>

                    <span className="shrink-0 w-12 text-xs font-mono text-slate-400">
                      {parseFloat(formatUnits(order.sharesTotal, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>

                    {/* Fill Progress Bar */}
                    <div className="shrink-0 w-16 flex items-center gap-1">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isFullyFilled ? "bg-emerald-500" :
                              fillPercent > 0 ? "bg-slate-500" :
                                "bg-slate-600"
                          )}
                          style={{ width: `${Math.min(fillPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-7 text-right">{Math.round(fillPercent)}%</span>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    <div className="shrink-0 flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleClaimFills(order.orderId)}
                        disabled={actionInProgress === `claim-${orderId}` || !hasPendingFills}
                        className={cn(
                          "h-5 px-2 rounded text-xs font-bold border transition-colors flex items-center justify-center",
                          hasPendingFills
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                            : "bg-slate-800/30 text-slate-600 border-slate-700/30 cursor-not-allowed"
                        )}
                        title={isFullyFilled ? "Claim fills & close order" : "Claim pending fills"}
                      >
                        {actionInProgress === `claim-${orderId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Claim'}
                      </button>
                      {!isFullyFilled && (
                        <button
                          onClick={() => handleCancelOrder(order.orderId, false)}
                          disabled={actionInProgress === `cancel-${orderId}`}
                          className={cn(
                            "h-5 px-2 rounded text-xs font-bold border transition-colors flex items-center justify-center",
                            "bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30"
                          )}
                          title="Cancel order and return unused collateral"
                        >
                          {actionInProgress === `cancel-${orderId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        userSpotSells.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No active spot sells</p>
            <p className="text-xs text-slate-600">Sell shares you already own to post an ask</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="space-y-1 min-w-[400px]">
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800/50">
                <span className="shrink-0 w-10">ID</span>
                <span className="shrink-0 w-10">Token</span>
                <span className="shrink-0 w-24">Price</span>
                <span className="shrink-0 w-16">Size</span>
                <div className="flex-1" />
                <span className="shrink-0 text-right">Action</span>
              </div>
              {userSpotSells.map((s) => {
                const lower = s.tickLower / 10;
                const upper = s.tickUpper / 10;
                const remaining = s.sharesTotal > s.sharesFilled ? s.sharesTotal - s.sharesFilled : 0n;
                const sellOutcomeLabel = s.outcome === 1 ? 'YES' : 'NO';
                const cancelKey = `spotsell-cancel-${s.sellId.toString()}`;
                const isCancelling = actionInProgress === cancelKey;

                return (
                  <div
                    key={s.sellId.toString()}
                    className="flex items-center gap-2 p-2 rounded-lg border bg-slate-900/40 border-slate-800/40"
                  >
                    <span className="shrink-0 w-10 text-xs font-mono text-slate-500">#{s.sellId.toString()}</span>
                    <span className={cn("shrink-0 w-10 text-xs font-bold uppercase", s.outcome === 1 ? "text-emerald-400" : "text-rose-400")}>{sellOutcomeLabel}</span>
                    <span className="shrink-0 w-24 text-[11px] font-mono font-medium text-white">
                      {lower === upper ? `${lower.toFixed(1)}¢` : `${lower.toFixed(1)}-${upper.toFixed(1)}¢`}
                    </span>
                    <span className="shrink-0 w-16 text-xs font-mono text-slate-400">
                      {parseFloat(formatUnits(remaining, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <div className="flex-1" />
                    <div className="shrink-0 flex items-center justify-end">
                      <button
                        onClick={async () => {
                          if (!onCancelSpotSell) return;
                          setActionInProgress(cancelKey);
                          try {
                            await onCancelSpotSell(s.sellId);
                            onRefresh();
                          } finally {
                            setActionInProgress(null);
                          }
                        }}
                        disabled={!onCancelSpotSell || isCancelling}
                        className={cn(
                          "h-5 px-2 rounded text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 transition-colors flex items-center justify-center",
                          (!onCancelSpotSell || isCancelling) && "opacity-60 cursor-not-allowed hover:bg-rose-500/20"
                        )}
                        title="Cancel spot sell"
                      >
                        {isCancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Cancel'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default UserOrdersPanel;
