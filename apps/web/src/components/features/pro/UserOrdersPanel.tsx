import { useEffect, useMemo, useState } from 'react';
import { Loader2, BarChart3, BookOpen, HelpCircle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import toast from 'react-hot-toast';

import { cn } from '../../../lib/utils';
import { Tooltip } from '../../ui/Tooltip';
import { useSoothBookFeed } from '../../../hooks/useSoothBookFeed';
import type { FeedItem } from '../../../hooks/useSoothBookFeed';

type OrderSort = 'newest' | 'price' | 'fill';
type OrdersGroup = 'open' | 'history';
type SortDirection = 'asc' | 'desc';

const MAX_BATCH_SIZE = 50;

type StoredOrder = {
  id: string;
  marketAddress: `0x${string}`;
  marketName: string;
  outcome: 0 | 1;
  price: number;
  amount: number;
  fillPct: number;
  timestamp: number;
  isBuy: boolean;
};

export interface UserOrdersPanelProps {
  marketId: `0x${string}`;
  marketKey: `0x${string}` | undefined;
  soothBookAddress: `0x${string}` | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  chainId: number;
  viewOutcome: 'yes' | 'no';
  onCancelOrder?: (orderId: string) => Promise<boolean>;
}

function formatOrderId(orderId: string): string {
  if (!/^\d+$/.test(orderId)) return '—';
  if (orderId.length <= 12) return orderId;
  return `${orderId.slice(0, 6)}...${orderId.slice(-4)}`;
}

function isCanonicalOrderId(orderId?: string): orderId is string {
  return Boolean(orderId && /^\d+$/.test(orderId));
}

function toLegacyOrderId(side: 'YES' | 'NO', tick: string): string {
  return `${side === 'YES' ? '1' : '0'}:${tick}`;
}

function getHistoryOrderId(item: FeedItem): string | null {
  if (isCanonicalOrderId(item.orderId)) return item.orderId;
  if (isCanonicalOrderId(item.makerOrderId)) return item.makerOrderId;
  return null;
}

function orderSortValue(order: StoredOrder, sortBy: OrderSort): number {
  if (sortBy === 'price') return order.price;
  if (sortBy === 'fill') return order.fillPct;
  if (sortBy === 'newest') {
    const idNum = Number(order.id);
    return Number.isFinite(idNum) ? idNum : order.timestamp;
  }
  return 0;
}

function toDisplayPrice(order: StoredOrder, viewOutcome: 'yes' | 'no'): string {
  const yesPriceCents = order.price * 100;
  if (viewOutcome === 'yes') {
    return `${yesPriceCents.toFixed(1)}¢`;
  }
  return `${(100 - yesPriceCents).toFixed(1)}¢`;
}

export function UserOrdersPanel({
  marketId,
  marketKey,
  soothBookAddress,
  isLoading,
  onRefresh,
  chainId,
  viewOutcome,
  onCancelOrder,
}: UserOrdersPanelProps): JSX.Element {
  const { address: userAddress } = useAccount();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [group, setGroup] = useState<OrdersGroup>('open');
  const [sortBy, setSortBy] = useState<OrderSort>('newest');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const { feed, refresh } = useSoothBookFeed(soothBookAddress, marketKey);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeOrdersList = useMemo(() => {
    const userLower = userAddress?.toLowerCase();
    if (!userLower) return [];

    const toLegacyKey = (side: 'YES' | 'NO', tick: string) => toLegacyOrderId(side, tick);
    const keyForPlaced = (item: { side: 'YES' | 'NO'; tick: string; orderId?: string }) => {
      if (isCanonicalOrderId(item.orderId)) return item.orderId;
      return toLegacyKey(item.side, item.tick);
    };

    const cancelledKeys = new Set<string>();
    const filledAmounts = new Map<string, bigint>();

    for (const item of feed) {
      if (item.type === 'cancelled' && item.who.toLowerCase() === userLower) {
        if (isCanonicalOrderId(item.orderId)) {
          cancelledKeys.add(item.orderId);
        }
      }
      if (item.type === 'filled' && item.maker?.toLowerCase() === userLower && item.makerSide && item.makerTick) {
        if (!isCanonicalOrderId(item.makerOrderId)) continue;
        const key = item.makerOrderId;
        filledAmounts.set(key, (filledAmounts.get(key) ?? 0n) + item.amount);
      }
    }

    const placed = new Map<string, { id: string; outcome: 0 | 1; price: number; amount: bigint; timestamp: number; isBuy: boolean }>();
    for (const item of feed) {
      if (item.type !== 'placed') continue;
      if (item.who.toLowerCase() !== userLower) continue;
      if (!isCanonicalOrderId(item.orderId)) continue;
      const side = item.side === 'YES' ? 1 : 0;
      const key = keyForPlaced(item);
      if (cancelledKeys.has(key)) continue;
      const existing = placed.get(key);
      const totalAmount = (existing?.amount ?? 0n) + item.amount;
      placed.set(key, {
        id: key,
        outcome: side as 0 | 1,
        price: side === 1 ? Number(item.tick) / 1000 : (1000 - Number(item.tick)) / 1000,
        amount: totalAmount,
        timestamp: Number(item.block),
        isBuy: true,
      });
    }

    for (const [key, filled] of filledAmounts) {
      const order = placed.get(key);
      if (!order) continue;
      order.amount = order.amount > filled ? order.amount - filled : 0n;
      if (order.amount <= 0n) placed.delete(key);
    }

    return Array.from(placed.values()).map((o) => ({
      ...o,
      marketAddress: marketId,
      marketName: marketId.slice(0, 10) + '...',
      amount: Number(formatUnits(o.amount, 18)),
    }));
  }, [feed, userAddress, marketId]);

  const initialOpenOrderStats = useMemo(() => {
    const userLower = userAddress?.toLowerCase();
    if (!userLower) return new Map<string, bigint>();
    const totals = new Map<string, bigint>();
    for (const item of feed) {
      if (item.type !== 'placed') continue;
      if (item.who.toLowerCase() !== userLower) continue;
      if (!isCanonicalOrderId(item.orderId)) continue;
      totals.set(item.orderId, (totals.get(item.orderId) ?? 0n) + item.amount);
    }
    return totals;
  }, [feed, userAddress]);

  const openOrders = activeOrdersList;

  const sortedOrders = [...openOrders]
    .map((order) => {
      const initial = initialOpenOrderStats.get(order.id) ?? 0n;
      const remaining = parseFloat(order.amount.toString());
      const initialFloat = Number(formatUnits(initial, 18));
      const fillPct = initialFloat > 0 ? ((initialFloat - remaining) / initialFloat) * 100 : 0;
      return { ...order, fillPct: Math.max(0, Math.min(100, fillPct)) };
    })
    .sort((a, b) => {
      const base = orderSortValue(a, sortBy) - orderSortValue(b, sortBy);
      return sortDirection === 'asc' ? base : -base;
    });

  const selectedCancelableOrderIds = useMemo(
    () => selectedOrderIds.filter((id) => openOrders.some((order) => order.id === id)).slice(0, MAX_BATCH_SIZE),
    [selectedOrderIds, openOrders],
  );

  const userFeed = useMemo(() => {
    const userLower = userAddress?.toLowerCase();
    if (!userLower) return [];
    return feed.filter((item) => item.who.toLowerCase() === userLower);
  }, [feed, userAddress]);

  const displayFeed = useMemo(
    () => userFeed.filter((item) => getHistoryOrderId(item) !== null),
    [userFeed],
  );

  const sortedHistory = useMemo(() => {
    const parsedRows = displayFeed.map((item) => {
      const orderId = getHistoryOrderId(item) ?? '';
      const amount = parseFloat(formatUnits(item.amount, 18));
      const yesTick = item.tick.includes('/') ? Number(item.tick.split('/')[0]) : Number(item.tick);
      const price = Number.isFinite(yesTick) && yesTick > 0 ? yesTick / 1000 : 0;
      return {
        item,
        orderId,
        amount,
        price,
        timestamp: Number(item.block),
        sortId: Number(orderId),
      };
    });

    return parsedRows.sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price;
      if (sortBy === 'fill') return b.amount - a.amount;
      const aId = Number.isFinite(a.sortId) ? a.sortId : a.timestamp;
      const bId = Number.isFinite(b.sortId) ? b.sortId : b.timestamp;
      return bId - aId;
    });
  }, [displayFeed, sortBy, sortDirection]);

  useEffect(() => {
    setSelectedOrderIds((prev) => prev.filter((id) => openOrders.some((order) => order.id === id)));
  }, [openOrders]);

  const handleBatchCancel = async () => {
    if (!onCancelOrder || selectedCancelableOrderIds.length === 0) return;
    setActionInProgress('batch-cancel');
    const toastId = toast.loading(`Cancelling ${selectedCancelableOrderIds.length} order(s)...`);
    try {
      let cancelled = 0;
      for (const orderId of selectedCancelableOrderIds) {
        const ok = await onCancelOrder(orderId);
        if (ok) cancelled += 1;
      }
      if (cancelled > 0) {
        toast.success(`Cancelled ${cancelled} order(s)`, { id: toastId, duration: 5000 });
        setSelectedOrderIds([]);
      } else {
        toast.error('No orders cancelled', { id: toastId, duration: 5000 });
      }
      onRefresh();
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch cancel failed';
      toast.error(message, { id: toastId, duration: 5000 });
    } finally {
      setActionInProgress(null);
    }
  };

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) => (prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]));
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = sortedOrders.map((order) => order.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedOrderIds.includes(id));
    if (allSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!onCancelOrder) return;
    setActionInProgress(`cancel-${orderId}`);
    const toastId = toast.loading('Cancelling order...');
    try {
      const ok = await onCancelOrder(orderId);
      if (ok) {
        toast.success('Order cancelled!', { id: toastId, duration: 5000 });
      } else {
        toast.error('Cancel failed', { id: toastId, duration: 5000 });
      }
      onRefresh();
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cancel failed';
      toast.error(message, { id: toastId, duration: 5000 });
    } finally {
      setActionInProgress(null);
    }
  };

  void chainId;

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
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          YOUR <span className={viewOutcome === 'yes' ? 'text-emerald-400' : 'text-rose-400'}>{viewOutcome === 'yes' ? 'YES' : 'NO'}</span> ORDERS
        </span>
        <div className="flex items-center gap-2">
          {group === 'open' && (
            <button
              onClick={handleBatchCancel}
              disabled={selectedCancelableOrderIds.length === 0 || actionInProgress === 'batch-cancel' || !onCancelOrder}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold transition-all border',
                selectedCancelableOrderIds.length === 0 || actionInProgress === 'batch-cancel' || !onCancelOrder
                  ? 'bg-slate-800/50 text-slate-600 border-slate-700/50 cursor-not-allowed'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
              )}
              title="Cancel selected orders"
            >
              {actionInProgress === 'batch-cancel' ? <Loader2 size={10} className="animate-spin" /> : null}
              Cancel Selected ({selectedCancelableOrderIds.length})
            </button>
          )}
          <Tooltip
            content="Active orders are reconstructed from on-chain OrderPlaced, OrderFilled, and OrderCancelled events."
            position="bottom"
          >
            <button type="button" className="p-1 hover:bg-slate-800 rounded transition-colors" aria-label="Hint">
              <HelpCircle className="w-4 h-4 text-slate-500" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setGroup('open')}
            className={cn(
              'px-2 py-1 rounded-md font-medium transition-colors',
              group === 'open' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            Open ({openOrders.length})
          </button>
          <button
            onClick={() => setGroup('history')}
            className={cn(
              'px-2 py-1 rounded-md font-medium transition-colors',
              group === 'history' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            History ({displayFeed.length})
          </button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <span className="text-slate-600">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as OrderSort)}
            className="bg-slate-800/50 border-none rounded px-2 py-1 text-slate-300 text-xs focus:ring-0"
          >
            <option value="newest">ID</option>
            <option value="price">Price</option>
            <option value="fill">Fill %</option>
          </select>
          <select
            value={sortDirection}
            onChange={(e) => setSortDirection(e.target.value as SortDirection)}
            className="bg-slate-800/50 border-none rounded px-2 py-1 text-slate-300 text-xs focus:ring-0"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
      </div>

      {group === 'open' ? (
        sortedOrders.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No open orders</p>
            <p className="text-xs text-slate-600">Place a limit order to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="space-y-1 min-w-[480px]">
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800/50">
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="shrink-0 w-4 h-4 rounded border border-slate-600 bg-slate-900 text-[10px] leading-none text-slate-400 hover:border-slate-400"
                  title="Select all visible open orders"
                >
                  {sortedOrders.length > 0 && sortedOrders.every((order) => selectedOrderIds.includes(order.id)) ? '✓' : ''}
                </button>
                <span className="shrink-0 w-10">ID</span>
                <span className="shrink-0 w-10">Side</span>
                <span className="shrink-0 w-24">Price</span>
                <span className="shrink-0 w-12">Size</span>
                <span className="shrink-0 w-16">Fill</span>
                <div className="flex-1" />
                <span className="shrink-0 text-right">Action</span>
              </div>
              {sortedOrders.map((order) => {
                const orderId = order.id;
                const sideIsYes = order.outcome === 1;
                const isBuy = viewOutcome === 'yes' ? sideIsYes : !sideIsYes;

                return (
                  <div
                    key={orderId}
                    className="flex items-center gap-2 p-2 rounded-lg border transition-all bg-slate-900/50 border-slate-800/50 hover:border-slate-700"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSelectOrder(orderId)}
                      className="shrink-0 w-4 h-4 rounded border border-slate-600 bg-slate-900 text-[10px] leading-none text-slate-300 hover:border-slate-400"
                      title="Select order"
                    >
                      {selectedOrderIds.includes(orderId) ? '✓' : ''}
                    </button>
                    <span className="shrink-0 w-10 text-xs font-mono text-slate-500" title={orderId}>{formatOrderId(orderId)}</span>

                    <span className={cn(
                      'shrink-0 w-10 py-0.5 rounded text-xs font-bold text-center uppercase',
                      isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    )}>
                      {isBuy ? 'Buy' : 'Sell'}
                    </span>

                    <span className="shrink-0 w-24 text-xs font-mono font-medium text-white">{toDisplayPrice(order, viewOutcome)}</span>

                    <span className="shrink-0 w-12 text-xs font-mono text-slate-400">{order.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>

                    <div className="shrink-0 w-16 flex items-center gap-1">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all bg-slate-600" style={{ width: `${order.fillPct.toFixed(0)}%` }} />
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-7 text-right">{order.fillPct.toFixed(0)}%</span>
                    </div>

                    <div className="flex-1" />

                    <div className="shrink-0 flex items-center justify-end">
                      <button
                        onClick={() => void handleCancelOrder(orderId)}
                        disabled={actionInProgress === `cancel-${orderId}` || !onCancelOrder}
                        className={cn(
                          'h-5 px-2 rounded text-xs font-bold border transition-colors flex items-center justify-center',
                          'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30',
                          (!onCancelOrder || actionInProgress === `cancel-${orderId}`) && 'opacity-60 cursor-not-allowed hover:bg-rose-500/20'
                        )}
                        title="Cancel order and return unused collateral"
                      >
                        {actionInProgress === `cancel-${orderId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Cancel'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        displayFeed.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No activity yet</p>
            <p className="text-xs text-slate-600">Place orders to see your trading history</p>
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
              {sortedHistory.map(({ item, orderId, amount }) => {
                const isYes = item.side === 'YES';

                return (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border bg-slate-900/40 border-slate-800/40">
                    <span className="shrink-0 w-10 text-xs font-mono text-slate-500" title={orderId}>{formatOrderId(orderId)}</span>
                    <span className={cn('shrink-0 w-10 text-xs font-bold uppercase', isYes ? 'text-emerald-400' : 'text-rose-400')}>{item.side}</span>
                    <span className="shrink-0 w-24 text-[11px] font-mono font-medium text-white">{item.tick}</span>
                    <span className="shrink-0 w-16 text-xs font-mono text-slate-400">{amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <div className="flex-1" />
                    <div className="shrink-0 flex items-center justify-end">
                      <button
                        disabled
                        className="h-5 px-2 rounded text-xs font-bold bg-slate-800/30 text-slate-600 border border-slate-700/30 cursor-not-allowed transition-colors flex items-center justify-center"
                        title="Feed events are historical and cannot be cancelled"
                      >
                        Cancel
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
