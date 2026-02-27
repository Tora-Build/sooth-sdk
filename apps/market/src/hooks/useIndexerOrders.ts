import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import { fetchFromIndexer } from './indexer/config';

/** Raw order from /v12/orders endpoint */
type IndexerOrder = {
  id: string;
  chainId: number;
  marketKey: string;
  side: number;        // 0=NO, 1=YES
  tick: number;
  maker: string;
  amount: string;       // WAD
  escrow: boolean;
  status: string;       // 'active' | 'cancelled' | 'filled'
  filledAmount: string; // WAD
  createdAt: string;
  blockNumber: string;
  txHash: string;
};

/** Raw activity from /v12/activity endpoint */
type IndexerActivity = {
  type: 'fill' | 'order' | 'mint_merge';
  timestamp: string;
  data: {
    id: string;
    chainId: number;
    marketKey: string;
    // fill fields
    takerSide?: number;
    yesTick?: number;
    noTick?: number;
    taker?: string;
    maker?: string;
    amount?: string;
    surplus?: string;
    // order fields
    side?: number;
    tick?: number;
    escrow?: boolean;
    status?: string;
    filledAmount?: string;
    createdAt?: string;
    blockNumber?: string;
    txHash?: string;
    // mint_merge fields
    user?: string;
    action?: string;
    timestamp?: string;
  };
};

export type OpenOrder = {
  id: string;
  outcome: 0 | 1;
  yesPrice: number;
  amount: number;
  fillPct: number;
  timestamp: number;
  isBuy: boolean;
  marketAddress: `0x${string}`;
  marketName: string;
};

export type HistoryRow = {
  key: string;
  type: 'placed' | 'filled' | 'cancelled';
  side: 'YES' | 'NO';
  orderId: string;
  orderRef: string;
  amount: number;
  yesPrice: number;
  refundAmountWad: bigint | null;
  timestamp: number;
  sortKey: number;
};

function clampUnit(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampPercent(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function orderToOpen(order: IndexerOrder, marketId: `0x${string}`): OpenOrder {
  const initial = Number(formatUnits(BigInt(order.amount), 18));
  const filled = Number(formatUnits(BigInt(order.filledAmount), 18));
  const remaining = Math.max(0, initial - filled);
  const fillPct = initial > 0 ? ((initial - remaining) / initial) * 100 : 0;
  const yesPrice = order.side === 1
    ? clampUnit(order.tick / 1000)
    : clampUnit((1000 - order.tick) / 1000);

  return {
    id: order.id,
    outcome: order.side as 0 | 1,
    yesPrice,
    amount: remaining,
    fillPct: clampPercent(fillPct),
    timestamp: Number(order.blockNumber),
    isBuy: true,
    marketAddress: marketId,
    marketName: `${marketId.slice(0, 10)}...`,
  };
}

function activityToHistory(act: IndexerActivity): HistoryRow | null {
  const d = act.data;
  if (act.type === 'mint_merge') return null;

  if (act.type === 'order') {
    const side: 'YES' | 'NO' = d.side === 1 ? 'YES' : 'NO';
    const yesPrice = d.side === 1
      ? clampUnit((d.tick ?? 0) / 1000)
      : clampUnit((1000 - (d.tick ?? 0)) / 1000);
    const status = d.status ?? 'active';
    const type = status === 'cancelled' ? 'cancelled' as const : 'placed' as const;

    let refundAmountWad: bigint | null = null;
    if (status === 'cancelled' && !d.escrow && d.tick != null) {
      const tick = BigInt(d.tick);
      const amt = BigInt(d.amount ?? '0');
      refundAmountWad = (tick * amt) / 1000n;
    }

    return {
      key: d.id,
      type,
      side,
      orderId: d.id,
      orderRef: d.txHash ?? d.id,
      amount: Number(formatUnits(BigInt(d.amount ?? '0'), 18)),
      yesPrice,
      refundAmountWad,
      timestamp: Number(d.blockNumber ?? '0'),
      sortKey: Number(d.blockNumber ?? '0') * 10_000,
    };
  }

  if (act.type === 'fill') {
    const takerSide = d.takerSide ?? 0;
    const side: 'YES' | 'NO' = takerSide === 1 ? 'YES' : 'NO';
    const yesTick = d.yesTick ?? 0;
    const yesPrice = clampUnit(yesTick / 1000);
    const surplus = d.surplus ? BigInt(d.surplus) : null;

    return {
      key: d.id,
      type: 'filled',
      side,
      orderId: '',
      orderRef: d.txHash ?? d.id,
      amount: Number(formatUnits(BigInt(d.amount ?? '0'), 18)),
      yesPrice,
      refundAmountWad: surplus && surplus > 0n ? surplus : null,
      timestamp: Number(d.blockNumber ?? '0'),
      sortKey: Number(d.blockNumber ?? '0') * 10_000,
    };
  }

  return null;
}

export function useIndexerOrders(
  chainId: number | undefined,
  marketKey: `0x${string}` | undefined,
  marketId: `0x${string}`,
  owner: `0x${string}` | undefined,
) {
  const ownerLower = owner?.toLowerCase();

  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['indexer-orders', chainId, marketKey, ownerLower],
    queryFn: async () => {
      if (!chainId || !marketKey) return [] as IndexerOrder[];
      const params = ownerLower ? `?maker=${ownerLower}` : '';
      const orders = await fetchFromIndexer<IndexerOrder[]>(`/v12/orders/${chainId}/${marketKey}${params}`);
      return orders ?? [];
    },
    enabled: !!chainId && !!marketKey && !!ownerLower,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const { data: activityData, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['indexer-activity', chainId, marketKey, ownerLower],
    queryFn: async () => {
      if (!chainId || !marketKey) return [] as IndexerActivity[];
      const params = ownerLower ? `?maker=${ownerLower}&limit=200` : '?limit=200';
      const activity = await fetchFromIndexer<IndexerActivity[]>(`/v12/activity/${chainId}/${marketKey}${params}`);
      return activity ?? [];
    },
    enabled: !!chainId && !!marketKey && !!ownerLower,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const openOrders: OpenOrder[] = (ordersData ?? [])
    .filter((o) => o.status === 'active')
    .map((o) => orderToOpen(o, marketId));

  const historyRows: HistoryRow[] = (activityData ?? [])
    .map(activityToHistory)
    .filter((r): r is HistoryRow => r !== null);

  const refresh = async () => {
    await Promise.all([refetchOrders(), refetchActivity()]);
  };

  return {
    openOrders,
    historyRows,
    isLoading: ordersLoading || activityLoading,
    refresh,
  };
}
