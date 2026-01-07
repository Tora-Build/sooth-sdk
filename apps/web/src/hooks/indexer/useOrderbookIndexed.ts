import { useQuery } from "@tanstack/react-query";
import { useChainStore } from "../../store/useChainStore";
import { fetchFromIndexer, checkChainReady, USE_INDEXER } from "./config";
import { useAllOrdersDirect, RangeOrder } from "../useAllOrdersDirect";

type Address = `0x${string}`;

interface IndexedTickLiquidity {
  id: string;
  chainId: number;
  marketKey: string;
  outcome: number;
  tick: number;
  totalLiquidity: string;
  orderCount: number;
  updatedAt: string;
}

interface IndexedOrder {
  id: string;
  chainId: number;
  orderId: string;
  marketKey: string;
  owner: string;
  outcome: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  collateralReserved: string;
  status: string;
  filledShares: string;
  claimedShares: string;
  collateralUsed: string;
  pendingShares: string;
  pendingUsdc: string;
  fillGrowthLastX128: string;
  calculatedPendingFromGrowth: string;
}

interface OrderbookResponse {
  yes: IndexedTickLiquidity[];
  no: IndexedTickLiquidity[];
}

export interface TickData {
  tick: number;
  liquidity: bigint;
  orderCount: number;
}

function indexedToRangeOrder(o: IndexedOrder): RangeOrder {
  const sharesTotal = BigInt(o.liquidity);
  const claimedShares = BigInt(o.claimedShares);
  const pendingShares = BigInt(o.pendingShares);
  const totalFilled = claimedShares + pendingShares;
  const restingShares = sharesTotal > totalFilled ? sharesTotal - totalFilled : 0n;
  const ticksInRange = BigInt(Math.max(1, o.tickUpper - o.tickLower + 1));
  const density = restingShares / ticksInRange;
  
  return {
    orderId: BigInt(o.orderId),
    owner: o.owner as Address,
    outcome: o.outcome,
    tickLower: o.tickLower,
    tickUpper: o.tickUpper,
    sharesTotal,
    liquidity: density,
    collateralDepositedWad: BigInt(o.collateralReserved),
    filledShares: claimedShares,
    pendingShares: pendingShares,
    collateralUsedWad: BigInt(o.collateralUsed),
    active: o.status === "active",
  };
}

/**
 * Hook to fetch orderbook depth - uses indexer with RPC fallback (per-chain readiness)
 */
export function useOrderbookIndexed(marketKey: `0x${string}` | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);

  // Check if this specific chain is ready FIRST
  const chainReadyQuery = useQuery({
    queryKey: ["indexer", "chainReady", chainId],
    enabled: USE_INDEXER && !!chainId,
    queryFn: () => checkChainReady(chainId),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const isChainReady = chainReadyQuery.data === true;

  // Indexer query - gets pre-aggregated tick liquidity
  const indexerQuery = useQuery({
    queryKey: ["indexer", "orderbook", chainId, marketKey],
    enabled: USE_INDEXER && isChainReady && !!marketKey && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<OrderbookResponse>(
        `/orderbook/${chainId}/${marketKey}`
      );
      if (!data) return null;

      return {
        yes: data.yes.map((t) => ({
          tick: t.tick,
          liquidity: BigInt(t.totalLiquidity),
          orderCount: t.orderCount,
        })),
        no: data.no.map((t) => ({
          tick: t.tick,
          liquidity: BigInt(t.totalLiquidity),
          orderCount: t.orderCount,
        })),
      };
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: false,
  });

  // Indexer query for all active orders (for LiquidityMap rendering)
  const indexerOrdersQuery = useQuery({
    queryKey: ["indexer", "allOrders", chainId, marketKey],
    enabled: USE_INDEXER && isChainReady && !!marketKey && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<IndexedOrder[]>(
        `/orders/${chainId}/${marketKey}`
      );
      if (!data) return [];
      return data.map(indexedToRangeOrder);
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: false,
  });

  const indexerOrderbook = indexerQuery.data ?? null;
  const indexedOrders = indexerOrdersQuery.data ?? [];
  const indexerHasTicks =
    (indexerOrderbook?.yes?.length ?? 0) + (indexerOrderbook?.no?.length ?? 0) > 0;
  const indexerHasOrders = indexedOrders.length > 0;

  // Use indexer only if it actually has data. This prevents the UI from going blank
  // when the indexer is running but hasn't indexed the market yet.
  const useIndexer = USE_INDEXER && isChainReady && (indexerHasTicks || indexerHasOrders);

  // We still need RPC orders if the indexer has no orders (LiquidityMap relies on ranges).
  const needRpcOrders = !!marketKey && (!useIndexer || !indexerHasOrders);
  const rpcFallback = useAllOrdersDirect(needRpcOrders ? marketKey : undefined);

  // Aggregate RPC orders into tick data
  const aggregateOrdersToTicks = (orders: RangeOrder[]): { yes: TickData[]; no: TickData[] } => {
    const yesMap = new Map<number, { liquidity: bigint; count: number }>();
    const noMap = new Map<number, { liquidity: bigint; count: number }>();

    for (const order of orders) {
      if (!order.active) continue; // Skip inactive orders
      const map = order.outcome === 1 ? yesMap : noMap;
      for (let tick = order.tickLower; tick <= order.tickUpper; tick++) {
        const existing = map.get(tick) || { liquidity: 0n, count: 0 };
        map.set(tick, {
          liquidity: existing.liquidity + order.liquidity,
          count: existing.count + 1,
        });
      }
    }

    const toArray = (map: Map<number, { liquidity: bigint; count: number }>) =>
      Array.from(map.entries())
        .filter(([_, v]) => v.liquidity > 0n)
        .map(([tick, v]) => ({ tick, liquidity: v.liquidity, orderCount: v.count }));

    return {
      yes: toArray(yesMap).sort((a, b) => a.tick - b.tick),
      no: toArray(noMap).sort((a, b) => b.tick - a.tick),
    };
  };

  const rpcAggregated = aggregateOrdersToTicks(rpcFallback.orders);
  const filteredRpcOrders = rpcFallback.orders.filter((o) => o.active);

  // If indexer has orders but no tick aggregation, derive it from the indexed orders.
  const derivedIndexerOrderbook = aggregateOrdersToTicks(indexedOrders);
  const effectiveOrderbook = useIndexer
    ? (indexerHasTicks ? indexerOrderbook : derivedIndexerOrderbook)
    : rpcAggregated;

  const effectiveOrders = indexerHasOrders ? indexedOrders : filteredRpcOrders;

  return {
    orderbook: effectiveOrderbook,
    orders: effectiveOrders,
    isLoading: useIndexer
      ? (indexerQuery.isLoading || indexerOrdersQuery.isLoading || (needRpcOrders && rpcFallback.isLoading))
      : rpcFallback.isLoading,
    error: useIndexer ? (indexerQuery.error ?? indexerOrdersQuery.error) : rpcFallback.error,
    refetch: useIndexer ? indexerQuery.refetch : rpcFallback.refetch,
    source: useIndexer ? "indexer" : "rpc",
  };
}
