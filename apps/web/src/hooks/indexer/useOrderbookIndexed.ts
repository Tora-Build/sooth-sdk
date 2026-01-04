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
  return {
    orderId: BigInt(o.orderId),
    owner: o.owner as Address,
    outcome: o.outcome,
    tickLower: o.tickLower,
    tickUpper: o.tickUpper,
    sharesTotal: BigInt(o.liquidity),
    liquidity: BigInt(o.liquidity),
    collateralDepositedWad: BigInt(o.collateralReserved),
    filledShares: BigInt(o.claimedShares),
    pendingShares: BigInt(o.filledShares) - BigInt(o.claimedShares),
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

  // Determine if we should use indexer
  const useIndexer = isChainReady && indexerQuery.data !== null && indexerQuery.data !== undefined;

  // RPC fallback - ONLY enabled when indexer is NOT available
  const rpcFallback = useAllOrdersDirect(useIndexer ? undefined : marketKey);

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
  const filteredRpcOrders = rpcFallback.orders.filter(o => o.active);
  const indexedOrders = indexerOrdersQuery.data ?? [];

  return {
    orderbook: useIndexer ? indexerQuery.data : rpcAggregated,
    orders: useIndexer ? indexedOrders : filteredRpcOrders,
    isLoading: useIndexer ? (indexerQuery.isLoading || indexerOrdersQuery.isLoading) : rpcFallback.isLoading,
    error: useIndexer ? indexerQuery.error : rpcFallback.error,
    refetch: useIndexer ? indexerQuery.refetch : rpcFallback.refetch,
    source: useIndexer ? "indexer" : "rpc",
  };
}
