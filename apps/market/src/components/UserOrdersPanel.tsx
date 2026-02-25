import { useEffect, useMemo, useState } from 'react';
import { Loader2, BarChart3, BookOpen, HelpCircle } from 'lucide-react';
import { useAppKitAccount } from '@reown/appkit/react';
import { formatUnits } from 'viem';
import toast from 'react-hot-toast';

import { cn } from '../lib/utils';
import { Tooltip } from './ui/Tooltip';
import { useSoothBookFeed } from '../hooks/useSoothBookFeed';
import type { FeedItem } from '../hooks/useSoothBookFeed';

type OrderSort = 'newest' | 'price' | 'fill';
type OrdersGroup = 'open' | 'history';
type SortDirection = 'asc' | 'desc';
const MAX_BATCH_SIZE = 50;
const HISTORY_PAGE_SIZE = 50;

type StoredOrder = {
  id: string;
  marketAddress: `0x${string}`;
  marketName: string;
  outcome: 0 | 1;
  yesPrice: number;
  amount: number;
  fillPct: number;
  timestamp: number;
  isBuy: boolean;
};

type OpenOrderAccumulator = {
  id: string;
  outcome: 0 | 1;
  yesPrice: number;
  initialAmount: bigint;
  remainingAmount: bigint;
  timestamp: number;
};

type HistoryRow = {
  key: string;
  item: FeedItem;
  side: 'YES' | 'NO';
  orderId: string;
  orderRef: string;
  amount: number;
  yesPrice: number;
  refundAmountWad: bigint | null;
  timestamp: number;
  sortKey: number;
};

export interface UserOrdersPanelProps {
  marketId: `0x${string}`;
  marketKey: `0x${string}` | undefined;
  soothBookAddress: `0x${string}` | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  chainId: number;
  viewOutcome: 'yes' | 'no';
  onCancelOrder?: (orderId: string, options?: { silent?: boolean }) => Promise<boolean>;
}

function formatOrderId(orderId: string): string {
  if (!orderId) return '—';
  if (orderId.length <= 12) return orderId;
  return `${orderId.slice(0, 6)}...${orderId.slice(-4)}`;
}

function isCanonicalOrderId(orderId?: string): orderId is string {
  return Boolean(orderId && /^\d+$/.test(orderId));
}

function getTxHashFromFeedItem(item: FeedItem): string | null {
  const [txHash] = item.id.split('-');
  return /^0x[a-fA-F0-9]{64}$/.test(txHash) ? txHash : null;
}

function getHistoryOrderRef(item: FeedItem): string {
  const txHash = getTxHashFromFeedItem(item);
  if (txHash) return txHash;
  return `block-${item.block.toString()}-${item.logIndex}`;
}

function parseTickToBigInt(tick: string): bigint | null {
  const parsed = Number.parseInt(tick, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return BigInt(parsed);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getYesPriceFromSingleTick(side: 'YES' | 'NO', tick: string): number {
  const parsedTick = Number(tick);
  if (!Number.isFinite(parsedTick)) return 0;
  const yesPrice = side === 'YES' ? parsedTick / 1000 : (1000 - parsedTick) / 1000;
  return clampUnit(yesPrice);
}

function getYesPriceForHistory(item: FeedItem, side: 'YES' | 'NO'): number {
  if (item.tick.includes('/')) {
    const [yesRaw, noRaw] = item.tick.split('/');
    const yesTick = Number(yesRaw);
    const noTick = Number(noRaw);
    if (side === 'YES') {
      if (!Number.isFinite(yesTick)) return 0;
      return clampUnit(yesTick / 1000);
    }
    if (!Number.isFinite(noTick)) return 0;
    return clampUnit((1000 - noTick) / 1000);
  }
  return getYesPriceFromSingleTick(side, item.tick);
}

function formatDisplayPriceFromOutcome(yesPrice: number, viewOutcome: 'yes' | 'no'): string {
  const cents = viewOutcome === 'yes' ? yesPrice * 100 : (1 - yesPrice) * 100;
  return `${cents.toFixed(1)}¢`;
}

function formatRefundAmount(refundAmountWad: bigint | null): string {
  if (!refundAmountWad || refundAmountWad <= 0n) return '—';
  const value = Number(formatUnits(refundAmountWad, 18));
  if (!Number.isFinite(value)) return '—';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getLevelKey(side: 'YES' | 'NO', tick: string): string {
  const sideCode = side === 'YES' ? 1 : 0;
  return `${sideCode}:${tick}`;
}

function getPlacedSignature(item: FeedItem): string | null {
  if (item.type !== 'placed') return null;
  const txHash = getTxHashFromFeedItem(item);
  if (!txHash) return null;
  return `${txHash}:${item.who.toLowerCase()}:${item.side}:${item.tick}:${item.amount.toString()}`;
}

function getCancelledSignature(item: FeedItem): string | null {
  if (item.type !== 'cancelled') return null;
  const txHash = getTxHashFromFeedItem(item);
  if (!txHash) return null;
  return `${txHash}:${item.who.toLowerCase()}:${item.side}:${item.tick}:${item.amount.toString()}`;
}

function getMakerFillSignature(item: FeedItem): string | null {
  if (item.type !== 'filled' || !item.maker || !item.makerSide || !item.makerTick) return null;
  const txHash = getTxHashFromFeedItem(item);
  if (!txHash) return null;
  return `${txHash}:${item.maker.toLowerCase()}:${item.makerSide}:${item.makerTick}:${item.amount.toString()}`;
}

function getTakerFillSignature(item: FeedItem): string | null {
  if (item.type !== 'filled') return null;
  const txHash = getTxHashFromFeedItem(item);
  if (!txHash) return null;
  return `${txHash}:${item.who.toLowerCase()}:${item.side}:${item.tick}:${item.amount.toString()}`;
}

function orderSortValue(order: StoredOrder, sortBy: OrderSort): number {
  if (sortBy === 'price') return order.yesPrice;
  if (sortBy === 'fill') return order.fillPct;
  if (sortBy === 'newest') {
    const idNum = Number(order.id);
    return Number.isFinite(idNum) ? idNum : order.timestamp;
  }
  return 0;
}

function toHistoryEventLabel(type: FeedItem['type']): string {
  if (type === 'placed') return 'Placed';
  if (type === 'filled') return 'Filled';
  return 'Cancelled';
}

function toHistoryEventClasses(type: FeedItem['type']): string {
  if (type === 'placed') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  if (type === 'filled') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
}

function buildOpenOrders(feed: FeedItem[], userLower: string | undefined, marketId: `0x${string}`): StoredOrder[] {
  if (!userLower) return [];

  const cancelledByKey = new Map<string, bigint>();
  const filledByKey = new Map<string, bigint>();
  const canonicalPlacedSignatures = new Set<string>();
  const canonicalCancelledSignatures = new Set<string>();
  const canonicalMakerFillSignatures = new Set<string>();

  for (const item of feed) {
    if (item.type === 'placed' && item.who.toLowerCase() === userLower && isCanonicalOrderId(item.orderId)) {
      const signature = getPlacedSignature(item);
      if (signature) canonicalPlacedSignatures.add(signature);
      continue;
    }
    if (item.type === 'cancelled' && item.who.toLowerCase() === userLower && isCanonicalOrderId(item.orderId)) {
      const signature = getCancelledSignature(item);
      if (signature) canonicalCancelledSignatures.add(signature);
      continue;
    }
    if (item.type === 'filled' && item.maker?.toLowerCase() === userLower && isCanonicalOrderId(item.makerOrderId)) {
      const signature = getMakerFillSignature(item);
      if (signature) canonicalMakerFillSignatures.add(signature);
    }
  }

  for (const item of feed) {
    if (item.type === 'cancelled' && item.who.toLowerCase() === userLower) {
      if (!isCanonicalOrderId(item.orderId)) {
        const signature = getCancelledSignature(item);
        if (signature && canonicalCancelledSignatures.has(signature)) continue;
      }
      const key = isCanonicalOrderId(item.orderId)
        ? item.orderId
        : getLevelKey(item.side, item.tick);
      cancelledByKey.set(key, (cancelledByKey.get(key) ?? 0n) + item.amount);
      continue;
    }

    if (item.type === 'filled' && item.maker?.toLowerCase() === userLower) {
      if (!isCanonicalOrderId(item.makerOrderId)) {
        const signature = getMakerFillSignature(item);
        if (signature && canonicalMakerFillSignatures.has(signature)) continue;
      }
      const key = isCanonicalOrderId(item.makerOrderId)
        ? item.makerOrderId
        : (item.makerSide && item.makerTick ? getLevelKey(item.makerSide, item.makerTick) : undefined);
      if (!key) continue;
      filledByKey.set(key, (filledByKey.get(key) ?? 0n) + item.amount);
    }
  }

  const placedByKey = new Map<string, OpenOrderAccumulator>();

  for (const item of feed) {
    if (item.type !== 'placed') continue;
    if (item.who.toLowerCase() !== userLower) continue;
    if (!isCanonicalOrderId(item.orderId)) {
      const signature = getPlacedSignature(item);
      if (signature && canonicalPlacedSignatures.has(signature)) continue;
    }
    const key = isCanonicalOrderId(item.orderId)
      ? item.orderId
      : getLevelKey(item.side, item.tick);

    const existing = placedByKey.get(key);
    const initialAmount = (existing?.initialAmount ?? 0n) + item.amount;
    const remainingAmount = (existing?.remainingAmount ?? 0n) + item.amount;

    placedByKey.set(key, {
      id: key,
      outcome: item.side === 'YES' ? 1 : 0,
      yesPrice: getYesPriceFromSingleTick(item.side, item.tick),
      initialAmount,
      remainingAmount,
      timestamp: Math.max(existing?.timestamp ?? 0, Number(item.block)),
    });
  }

  for (const [key, filledAmount] of filledByKey) {
    const order = placedByKey.get(key);
    if (!order) continue;
    order.remainingAmount = order.remainingAmount > filledAmount ? order.remainingAmount - filledAmount : 0n;
    if (order.remainingAmount <= 0n) placedByKey.delete(key);
  }

  for (const [key, cancelledAmount] of cancelledByKey) {
    const order = placedByKey.get(key);
    if (!order) continue;
    order.remainingAmount = order.remainingAmount > cancelledAmount ? order.remainingAmount - cancelledAmount : 0n;
    if (order.remainingAmount <= 0n) placedByKey.delete(key);
  }

  return Array.from(placedByKey.values()).map((order) => {
    const initialFloat = Number(formatUnits(order.initialAmount, 18));
    const remainingFloat = Number(formatUnits(order.remainingAmount, 18));
    const fillPct = initialFloat > 0 ? ((initialFloat - remainingFloat) / initialFloat) * 100 : 0;

    return {
      id: order.id,
      marketAddress: marketId,
      marketName: `${marketId.slice(0, 10)}...`,
      outcome: order.outcome,
      yesPrice: order.yesPrice,
      amount: remainingFloat,
      fillPct: clampPercent(fillPct),
      timestamp: order.timestamp,
      isBuy: true,
    };
  });
}

function buildHistoryRows(feed: FeedItem[], userLower: string | undefined): HistoryRow[] {
  if (!userLower) return [];

  const placedEscrowByOrderId = new Map<string, boolean>();
  const placedEscrowByLevel = new Map<string, boolean | 'mixed'>();
  for (const item of feed) {
    if (item.type !== 'placed') continue;
    if (item.who.toLowerCase() !== userLower) continue;

    const escrow = Boolean(item.escrow);
    if (isCanonicalOrderId(item.orderId)) {
      placedEscrowByOrderId.set(item.orderId, escrow);
      continue;
    }

    const key = getLevelKey(item.side, item.tick);
    const existing = placedEscrowByLevel.get(key);
    if (existing === undefined) {
      placedEscrowByLevel.set(key, escrow);
    } else if (existing !== escrow) {
      placedEscrowByLevel.set(key, 'mixed');
    }
  }

  const deduped = new Map<string, { row: HistoryRow; canonical: boolean }>();

  for (const item of feed) {
    const isUserEvent = item.who.toLowerCase() === userLower;
    const isMakerEvent = item.type === 'filled' && item.maker?.toLowerCase() === userLower;
    if (!isUserEvent && !isMakerEvent) continue;

    const isMakerFill = item.type === 'filled' && isMakerEvent && item.makerSide !== undefined;
    const side: 'YES' | 'NO' = isMakerFill ? item.makerSide! : item.side;
    const orderId = item.type === 'filled'
      ? (isMakerFill && isCanonicalOrderId(item.makerOrderId) ? item.makerOrderId : '')
      : (isCanonicalOrderId(item.orderId) ? item.orderId : '');
    const levelKey = getLevelKey(side, item.tick.includes('/') ? item.tick.split('/')[0] : item.tick);

    const dedupeKey = item.type === 'placed'
      ? (getPlacedSignature(item) ?? item.id)
      : item.type === 'cancelled'
        ? (getCancelledSignature(item) ?? item.id)
        : isMakerFill
          ? (getMakerFillSignature(item) ?? item.id)
          : (getTakerFillSignature(item) ?? item.id);

    const canonical = item.type === 'filled'
      ? (isMakerFill && isCanonicalOrderId(item.makerOrderId))
      : isCanonicalOrderId(item.orderId);

    let refundAmountWad: bigint | null = null;
    if (item.type === 'filled' && isUserEvent) {
      refundAmountWad = item.surplus && item.surplus > 0n ? item.surplus : null;
    } else if (item.type === 'cancelled') {
      const tick = parseTickToBigInt(item.tick);
      const escrowForOrder = orderId
        ? placedEscrowByOrderId.get(orderId)
        : placedEscrowByLevel.get(levelKey);
      if (tick !== null && escrowForOrder === false) {
        refundAmountWad = (tick * item.amount) / 1000n;
      }
    }

    const nextRow: HistoryRow = {
      key: item.id,
      item,
      side,
      orderId,
      orderRef: getHistoryOrderRef(item),
      amount: Number(formatUnits(item.amount, 18)),
      yesPrice: getYesPriceForHistory(item, side),
      refundAmountWad,
      timestamp: Number(item.block),
      sortKey: Number(item.block) * 10_000 + item.logIndex,
    };

    const existing = deduped.get(dedupeKey);
    if (!existing || (canonical && !existing.canonical)) {
      deduped.set(dedupeKey, { row: nextRow, canonical });
    }
  }

  return Array.from(deduped.values()).map((entry) => entry.row);
}

type PanelHeaderProps = {
  group: OrdersGroup;
  onBatchCancel: () => void;
  selectedCancelableCount: number;
  batchCancelBusy: boolean;
  canCancel: boolean;
  viewOutcome: 'yes' | 'no';
};

function PanelHeader({
  group,
  onBatchCancel,
  selectedCancelableCount,
  batchCancelBusy,
  canCancel,
  viewOutcome,
}: PanelHeaderProps): JSX.Element {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
        YOUR <span className={viewOutcome === 'yes' ? 'text-emerald-400' : 'text-rose-400'}>{viewOutcome === 'yes' ? 'YES' : 'NO'}</span> ORDERS
      </span>
      <div className="flex items-center gap-2">
        {group === 'open' && (
          <button
            onClick={onBatchCancel}
            disabled={selectedCancelableCount === 0 || batchCancelBusy || !canCancel}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold transition-all border',
              selectedCancelableCount === 0 || batchCancelBusy || !canCancel
                ? 'bg-zinc-800/50 text-zinc-600 border-zinc-700/50 cursor-not-allowed'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
            )}
            title="Cancel selected orders"
          >
            {batchCancelBusy ? <Loader2 size={10} className="animate-spin" /> : null}
            Cancel Selected ({selectedCancelableCount})
          </button>
        )}
        <Tooltip content="Active orders are reconstructed from on-chain OrderPlaced, OrderFilled, and OrderCancelled events." position="bottom">
          <button type="button" className="p-1 hover:bg-zinc-800 rounded transition-colors" aria-label="Hint">
            <HelpCircle className="w-4 h-4 text-zinc-500" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

type PanelControlsProps = {
  group: OrdersGroup;
  setGroup: (group: OrdersGroup) => void;
  openCount: number;
  historyCount: number;
  sortBy: OrderSort;
  setSortBy: (sortBy: OrderSort) => void;
  sortDirection: SortDirection;
  setSortDirection: (direction: SortDirection) => void;
};

function PanelControls({
  group,
  setGroup,
  openCount,
  historyCount,
  sortBy,
  setSortBy,
  sortDirection,
  setSortDirection,
}: PanelControlsProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
      <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
        <button
          onClick={() => setGroup('open')}
          className={cn('px-2 py-1 rounded-md font-medium transition-colors', group === 'open' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300')}
        >
          Open ({openCount})
        </button>
        <button
          onClick={() => setGroup('history')}
          className={cn('px-2 py-1 rounded-md font-medium transition-colors', group === 'history' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300')}
        >
          History ({historyCount})
        </button>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <span className="text-zinc-600">Sort:</span>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as OrderSort)}
          className="bg-zinc-800/50 border-none rounded px-2 py-1 text-zinc-300 text-xs focus:ring-0"
        >
          <option value="newest">ID</option>
          <option value="price">Price</option>
          <option value="fill">Fill %</option>
        </select>
        <select
          value={sortDirection}
          onChange={(event) => setSortDirection(event.target.value as SortDirection)}
          className="bg-zinc-800/50 border-none rounded px-2 py-1 text-zinc-300 text-xs focus:ring-0"
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </div>
    </div>
  );
}

type OpenOrdersTableProps = {
  orders: StoredOrder[];
  selectedOrderIds: string[];
  viewOutcome: 'yes' | 'no';
  actionInProgress: string | null;
  onToggleSelectOrder: (orderId: string) => void;
  onToggleSelectAllVisible: () => void;
  onCancelOrder: (orderId: string) => Promise<void>;
  canCancel: boolean;
};

function OpenOrdersTable({
  orders,
  selectedOrderIds,
  viewOutcome,
  actionInProgress,
  onToggleSelectOrder,
  onToggleSelectAllVisible,
  onCancelOrder,
  canCancel,
}: OpenOrdersTableProps): JSX.Element {
  if (orders.length === 0) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">No open orders</p>
        <p className="text-xs text-zinc-600">Place a limit order to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="space-y-1 min-w-[480px]">
        <div className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800/50">
          <button
            type="button"
            onClick={onToggleSelectAllVisible}
            className="shrink-0 w-4 h-4 rounded border border-zinc-600 bg-zinc-900 text-[10px] leading-none text-zinc-400 hover:border-zinc-400"
            title="Select all visible open orders"
          >
            {orders.length > 0 && orders.every((order) => selectedOrderIds.includes(order.id)) ? '✓' : ''}
          </button>
          <span className="shrink-0 w-10">ID</span>
          <span className="shrink-0 w-10">Side</span>
          <span className="shrink-0 w-24">Price</span>
          <span className="shrink-0 w-12">Size</span>
          <span className="shrink-0 w-16">Fill</span>
          <div className="flex-1" />
          <span className="shrink-0 text-right">Action</span>
        </div>

        {orders.map((order) => {
          const orderId = order.id;
          const sideIsYes = order.outcome === 1;
          const isBuy = viewOutcome === 'yes' ? sideIsYes : !sideIsYes;

          return (
            <div key={orderId} className="flex items-center gap-2 p-2 rounded-lg border transition-all bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700">
              <button
                type="button"
                onClick={() => onToggleSelectOrder(orderId)}
                className="shrink-0 w-4 h-4 rounded border border-zinc-600 bg-zinc-900 text-[10px] leading-none text-zinc-300 hover:border-zinc-400"
                title="Select order"
              >
                {selectedOrderIds.includes(orderId) ? '✓' : ''}
              </button>
              <span className="shrink-0 w-10 text-xs font-mono text-zinc-500 truncate" title={orderId}>
                {formatOrderId(orderId)}
              </span>

              <span
                className={cn(
                  'shrink-0 w-10 py-0.5 rounded text-xs font-bold text-center uppercase',
                  isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                )}
              >
                {isBuy ? 'Buy' : 'Sell'}
              </span>

              <span className="shrink-0 w-24 text-xs font-mono font-medium text-white">
                {formatDisplayPriceFromOutcome(order.yesPrice, viewOutcome)}
              </span>

              <span className="shrink-0 w-12 text-xs font-mono text-zinc-400">
                {order.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>

              <div className="shrink-0 w-16 flex items-center gap-1">
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all bg-zinc-600" style={{ width: `${order.fillPct.toFixed(0)}%` }} />
                </div>
                <span className="text-xs font-mono text-zinc-400 w-7 text-right">{order.fillPct.toFixed(0)}%</span>
              </div>

              <div className="flex-1" />

              <div className="shrink-0 flex items-center justify-end">
                <button
                  onClick={() => void onCancelOrder(orderId)}
                  disabled={actionInProgress === `cancel-${orderId}` || !canCancel}
                  className={cn(
                    'h-5 px-2 rounded text-xs font-bold border transition-colors flex items-center justify-center',
                    'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30',
                    (!canCancel || actionInProgress === `cancel-${orderId}`) && 'opacity-60 cursor-not-allowed hover:bg-rose-500/20'
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
  );
}

type HistoryTableProps = {
  rows: HistoryRow[];
  viewOutcome: 'yes' | 'no';
};

function HistoryTable({ rows, viewOutcome }: HistoryTableProps): JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="text-center py-8">
        <BookOpen className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">No activity yet</p>
        <p className="text-xs text-zinc-600">Place orders to see your trading history</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="space-y-1 min-w-[560px]">
        <div className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800/50">
          <span className="shrink-0 w-10">ID</span>
          <span className="shrink-0 w-10">Side</span>
          <span className="shrink-0 w-24">Price</span>
          <span className="shrink-0 w-12">Size</span>
          <span className="shrink-0 w-20">Refund</span>
          <div className="flex-1" />
          <span className="shrink-0 text-right">Event</span>
        </div>

        {rows.map(({ key, item, side, orderId, orderRef, amount, yesPrice, refundAmountWad }) => {
          const sideIsYes = side === 'YES';
          const isBuy = viewOutcome === 'yes' ? sideIsYes : !sideIsYes;

          return (
            <div key={key} className="flex items-center gap-2 p-2 rounded-lg border bg-zinc-900/40 border-zinc-800/40">
              <span className="shrink-0 w-10 text-xs font-mono text-zinc-500 truncate" title={orderId || orderRef}>
                {orderId ? formatOrderId(orderId) : formatOrderId(orderRef)}
              </span>
              <span
                className={cn(
                  'shrink-0 w-10 py-0.5 rounded text-xs font-bold text-center uppercase',
                  isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                )}
              >
                {isBuy ? 'Buy' : 'Sell'}
              </span>
              <span className="shrink-0 w-24 text-xs font-mono font-medium text-white">{formatDisplayPriceFromOutcome(yesPrice, viewOutcome)}</span>
              <span className="shrink-0 w-12 text-xs font-mono text-zinc-400">{amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span className={cn('shrink-0 w-20 text-xs font-mono', refundAmountWad && refundAmountWad > 0n ? 'text-emerald-300' : 'text-zinc-500')}>
                {formatRefundAmount(refundAmountWad)}
              </span>
              <div className="flex-1" />
              <span className={cn('shrink-0 h-5 px-2 rounded text-[10px] font-bold border inline-flex items-center', toHistoryEventClasses(item.type))}>
                {toHistoryEventLabel(item.type)}
              </span>
            </div>
          );
        })}
        <div className="px-2 pt-1 text-[10px] text-zinc-500">
          Refund Amt = taker surplus on fills, or returned collateral on non-escrow cancels.
        </div>
      </div>
    </div>
  );
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
  const { address: userAddress } = useAppKitAccount();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [group, setGroup] = useState<OrdersGroup>('open');
  const [sortBy, setSortBy] = useState<OrderSort>('newest');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [historyPage, setHistoryPage] = useState(1);

  const { feed, refresh, isLoading: isFeedLoading } = useSoothBookFeed(soothBookAddress, marketKey, { owner: userAddress as `0x${string}` | undefined });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const userLower = userAddress?.toLowerCase();

  const openOrders = useMemo(() => buildOpenOrders(feed, userLower, marketId), [feed, userLower, marketId]);

  const sortedOpenOrders = useMemo(() => {
    return [...openOrders].sort((a, b) => {
      const base = orderSortValue(a, sortBy) - orderSortValue(b, sortBy);
      return sortDirection === 'asc' ? base : -base;
    });
  }, [openOrders, sortBy, sortDirection]);

  const historyRows = useMemo(() => buildHistoryRows(feed, userLower), [feed, userLower]);
  const sortedHistoryRows = useMemo(() => {
    return [...historyRows].sort((a, b) => {
      let base = 0;
      if (sortBy === 'price') {
        base = a.yesPrice - b.yesPrice;
      } else if (sortBy === 'fill') {
        base = a.amount - b.amount;
      } else {
        base = a.sortKey - b.sortKey;
      }
      return sortDirection === 'asc' ? base : -base;
    });
  }, [historyRows, sortBy, sortDirection]);
  const totalHistoryPages = Math.max(1, Math.ceil(sortedHistoryRows.length / HISTORY_PAGE_SIZE));
  const pagedHistoryRows = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return sortedHistoryRows.slice(start, start + HISTORY_PAGE_SIZE);
  }, [sortedHistoryRows, historyPage]);
  const selectedCancelableOrderIds = useMemo(
    () => selectedOrderIds.filter((id) => openOrders.some((order) => order.id === id)).slice(0, MAX_BATCH_SIZE),
    [selectedOrderIds, openOrders]
  );

  useEffect(() => {
    setSelectedOrderIds((prev) => prev.filter((id) => openOrders.some((order) => order.id === id)));
  }, [openOrders]);

  useEffect(() => {
    setHistoryPage(1);
  }, [sortBy, sortDirection]);

  useEffect(() => {
    setHistoryPage((prev) => Math.min(prev, totalHistoryPages));
  }, [totalHistoryPages]);

  const handleBatchCancel = async () => {
    if (!onCancelOrder || selectedCancelableOrderIds.length === 0) return;

    setActionInProgress('batch-cancel');
    const toastId = toast.loading(`Cancelling ${selectedCancelableOrderIds.length} order(s)...`);

    try {
      let cancelled = 0;
      for (const orderId of selectedCancelableOrderIds) {
        const ok = await onCancelOrder(orderId, { silent: true });
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

  const handleCancelOrder = async (orderId: string) => {
    if (!onCancelOrder) return;

    setActionInProgress(`cancel-${orderId}`);

    try {
      await onCancelOrder(orderId);

      onRefresh();
      await refresh();
    } catch {
      // onCancelOrder already handles user-visible error toasts.
    } finally {
      setActionInProgress(null);
    }
  };

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) => (prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]));
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = sortedOpenOrders.map((order) => order.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedOrderIds.includes(id));

    if (allSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  void chainId;

  const panelLoading = isLoading || (isFeedLoading && feed.length === 0);

  if (panelLoading) {
    return (
      <div className="rounded-2xl bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            YOUR <span className={viewOutcome === 'yes' ? 'text-emerald-400' : 'text-rose-400'}>{viewOutcome === 'yes' ? 'YES' : 'NO'}</span> ORDERS
          </span>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 p-4">
      <PanelHeader
        group={group}
        onBatchCancel={handleBatchCancel}
        selectedCancelableCount={selectedCancelableOrderIds.length}
        batchCancelBusy={actionInProgress === 'batch-cancel'}
        canCancel={Boolean(onCancelOrder)}
        viewOutcome={viewOutcome}
      />

      <PanelControls
        group={group}
        setGroup={setGroup}
        openCount={openOrders.length}
        historyCount={historyRows.length}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortDirection={sortDirection}
        setSortDirection={setSortDirection}
      />

      {group === 'open' ? (
        <OpenOrdersTable
          orders={sortedOpenOrders}
          selectedOrderIds={selectedOrderIds}
          viewOutcome={viewOutcome}
          actionInProgress={actionInProgress}
          onToggleSelectOrder={toggleSelectOrder}
          onToggleSelectAllVisible={toggleSelectAllVisible}
          onCancelOrder={handleCancelOrder}
          canCancel={Boolean(onCancelOrder)}
        />
      ) : (
        <div className="space-y-3">
          <HistoryTable rows={pagedHistoryRows} viewOutcome={viewOutcome} />
          {totalHistoryPages > 1 ? (
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-zinc-500">
                Showing {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}-{Math.min(historyPage * HISTORY_PAGE_SIZE, sortedHistoryRows.length)} of {sortedHistoryRows.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  className={cn(
                    'px-2 py-1 rounded border transition-colors',
                    historyPage === 1
                      ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                      : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800/60'
                  )}
                >
                  Prev
                </button>
                <span className="text-zinc-400">Page {historyPage}/{totalHistoryPages}</span>
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                  disabled={historyPage === totalHistoryPages}
                  className={cn(
                    'px-2 py-1 rounded border transition-colors',
                    historyPage === totalHistoryPages
                      ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                      : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800/60'
                  )}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default UserOrdersPanel;
