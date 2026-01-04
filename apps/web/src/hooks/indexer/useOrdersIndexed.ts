import { useQuery } from "@tanstack/react-query";
import { useChainStore } from "../../store/useChainStore";
import { fetchFromIndexer, checkChainReady, USE_INDEXER } from "./config";
import { useUserOrdersDirect, RangeOrder } from "../useUserOrdersDirect";
import { useDeployments } from "../useDeployments";
import { useDirectRead, readContractSafe } from "../useDirectRead";
import { V996_ABIS } from "../../config/abis";

type Address = `0x${string}`;

interface IndexedOrder {
  id: string;
  chainId: number;
  orderId: string; // bigint as string from API
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
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert indexed order to RangeOrder format
 */
function toRangeOrder(indexed: IndexedOrder): RangeOrder {
  return {
    orderId: BigInt(indexed.orderId),
    owner: indexed.owner as Address,
    outcome: indexed.outcome,
    tickLower: indexed.tickLower,
    tickUpper: indexed.tickUpper,
    sharesTotal: BigInt(indexed.liquidity),
    liquidity: BigInt(indexed.liquidity),
    collateralDepositedWad: BigInt(indexed.collateralReserved),
    filledShares: BigInt(indexed.claimedShares),
    pendingShares: BigInt(indexed.filledShares) - BigInt(indexed.claimedShares),
    collateralUsedWad: BigInt(indexed.collateralUsed),
    active: indexed.status === "active",
    createdAt: indexed.createdAt ? Math.floor(new Date(indexed.createdAt).getTime() / 1000) : undefined,
  };
}

/**
 * Hook to fetch user's orders - uses indexer with RPC fallback (per-chain readiness)
 */
export function useOrdersIndexed(
  marketKey: `0x${string}` | undefined,
  userAddress: Address | undefined
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const poolManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  // Check if this specific chain is ready FIRST
  const chainReadyQuery = useQuery({
    queryKey: ["indexer", "chainReady", chainId],
    enabled: USE_INDEXER && !!chainId,
    queryFn: () => checkChainReady(chainId),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const isChainReady = chainReadyQuery.data === true;

  // Indexer query - only enabled if chain is ready
  const indexerQuery = useQuery({
    queryKey: ["indexer", "userOrders", chainId, marketKey, userAddress],
    enabled: USE_INDEXER && isChainReady && !!marketKey && !!userAddress && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<IndexedOrder[]>(
        `/orders/${chainId}/${marketKey}/${userAddress}`
      );
      if (!data) return null;
      // Filter to only active orders
      return data.filter(o => o.status === "active").map(toRangeOrder);
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: false,
  });

  // Determine if we should use indexer
  const useIndexer = isChainReady && indexerQuery.data !== null && indexerQuery.data !== undefined;
  const indexerOrders = indexerQuery.data ?? [];

  // RPC fallback - ONLY enabled when indexer is NOT available
  const rpcFallback = useUserOrdersDirect(
    useIndexer ? undefined : marketKey,
    useIndexer ? undefined : userAddress
  );

  // Filter RPC results to only active orders
  const filteredRpcOrders = rpcFallback.orders.filter(o => o.active);

  // Fetch pending fills from RPC for indexer orders (indexer may not track fills accurately)
  const pendingFillsQuery = useDirectRead({
    queryKey: ["v9", "pendingFillsForIndexer", chainId, poolManagerAddress, marketKey, indexerOrders.map(o => o.orderId.toString()).join(",")],
    enabled: useIndexer && !!poolManagerAddress && !!marketKey && indexerOrders.length > 0,
    chainId,
    read: async (client) => {
      const fillsMap = new Map<string, { pendingShares: bigint; filledShares: bigint }>();
      
      for (const order of indexerOrders) {
        try {
          const [pendingResult, orderResult] = await Promise.all([
            readContractSafe<readonly [bigint, bigint]>(client, {
              address: poolManagerAddress!,
              abi: V996_ABIS.TickBookPoolManager,
              functionName: "getPendingFills",
              args: [marketKey!, order.orderId],
            }),
            readContractSafe<{ filledShares: bigint }>(client, {
              address: poolManagerAddress!,
              abi: V996_ABIS.TickBookPoolManager,
              functionName: "getOrder",
              args: [marketKey!, order.orderId],
            }),
          ]);
          
          fillsMap.set(order.orderId.toString(), {
            pendingShares: pendingResult?.[0] ?? 0n,
            filledShares: orderResult?.filledShares ?? 0n,
          });
        } catch {
          // Keep indexer values if RPC fails
        }
      }
      
      return fillsMap;
    },
  });

  // Merge RPC pending fills into indexer orders
  const mergedIndexerOrders = indexerOrders.map(order => {
    const rpcFills = pendingFillsQuery.data?.get(order.orderId.toString());
    if (rpcFills) {
      return {
        ...order,
        filledShares: rpcFills.filledShares,
        pendingShares: rpcFills.pendingShares,
      };
    }
    return order;
  });

  return {
    orders: useIndexer ? mergedIndexerOrders : filteredRpcOrders,
    isLoading: useIndexer ? (indexerQuery.isLoading || pendingFillsQuery.isLoading) : rpcFallback.isLoading,
    error: useIndexer ? indexerQuery.error : rpcFallback.error,
    refetch: useIndexer ? indexerQuery.refetch : rpcFallback.refetch,
    source: useIndexer ? "indexer" : "rpc",
  };
}
