import { useQuery } from "@tanstack/react-query";
import { useChainStore } from "../../store/useChainStore";
import { fetchFromIndexer, USE_INDEXER } from "./config";
import { useUserOrdersDirect, RangeOrder } from "../useUserOrdersDirect";

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
  };
}

/**
 * Hook to fetch user's orders - uses indexer with RPC fallback
 */
export function useOrdersIndexed(
  marketKey: `0x${string}` | undefined,
  userAddress: Address | undefined
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);

  // RPC fallback hook
  const rpcFallback = useUserOrdersDirect(marketKey, userAddress);

  // Indexer query
  const indexerQuery = useQuery({
    queryKey: ["indexer", "userOrders", chainId, marketKey, userAddress],
    enabled: USE_INDEXER && !!marketKey && !!userAddress && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<IndexedOrder[]>(
        `/orders/${chainId}/${marketKey}/${userAddress}`
      );
      if (!data) return null;
      return data.map(toRangeOrder);
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: false, // Don't retry indexer - fall back to RPC
  });

  // Use indexer data if available, otherwise fall back to RPC
  const useIndexer = indexerQuery.data !== null && indexerQuery.data !== undefined;

  return {
    orders: useIndexer ? indexerQuery.data : rpcFallback.orders,
    isLoading: useIndexer ? indexerQuery.isLoading : rpcFallback.isLoading,
    error: useIndexer ? indexerQuery.error : rpcFallback.error,
    refetch: useIndexer ? indexerQuery.refetch : rpcFallback.refetch,
    source: useIndexer ? "indexer" : "rpc",
  };
}
