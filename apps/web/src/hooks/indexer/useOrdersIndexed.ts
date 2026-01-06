import { useQuery } from "@tanstack/react-query";
import { useChainStore } from "../../store/useChainStore";
import { usePublicClient } from "wagmi";
import { fetchFromIndexer, checkChainReady, USE_INDEXER } from "./config";
import { useDeployments } from "../useDeployments";
import { useUserOrdersDirect, RangeOrder } from "../useUserOrdersDirect";
import { ABIS } from "../../config/abis";

type Address = `0x${string}`;

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

/**
 * Hybrid approach: indexer for order list (no block limit), RPC for pending fills (accumulator accuracy)
 */
export function useOrdersIndexed(
  marketKey: `0x${string}` | undefined,
  userAddress: Address | undefined
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const tickBookManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;
  const publicClient = usePublicClient({ chainId });

  const chainReadyQuery = useQuery({
    queryKey: ["indexer", "chainReady", chainId],
    enabled: USE_INDEXER && !!chainId,
    queryFn: () => checkChainReady(chainId),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const isChainReady = chainReadyQuery.data === true;

  const indexerQuery = useQuery({
    queryKey: ["indexer", "userOrders", chainId, marketKey, userAddress],
    enabled: USE_INDEXER && isChainReady && !!marketKey && !!userAddress && !!chainId,
    queryFn: async () => {
      const allOrders = await fetchFromIndexer<IndexedOrder[]>(
        `/orders/${chainId}/${marketKey}`
      );
      if (!allOrders) return [];
      
      return allOrders.filter(
        o => o.owner.toLowerCase() === userAddress!.toLowerCase() && o.status === "active"
      );
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: false,
  });

  const pendingFillsQuery = useQuery({
    queryKey: ["rpc", "pendingFills", chainId, marketKey, indexerQuery.data?.map(o => o.orderId).join(",")],
    enabled: !!indexerQuery.data?.length && !!publicClient && !!tickBookManagerAddress && !!marketKey,
    queryFn: async () => {
      const orders = indexerQuery.data!;
      if (!orders.length) return new Map<string, [bigint, bigint]>();

      const contracts = orders.map(o => ({
        address: tickBookManagerAddress!,
        abi: ABIS.TickBookPoolManager,
        functionName: "getPendingFills",
        args: [marketKey!, BigInt(o.orderId)],
      }));

      const results = await publicClient!.multicall({
        contracts,
        allowFailure: true,
      });

      const fillsMap = new Map<string, [bigint, bigint]>();
      results.forEach((result, i) => {
        if (result.status === "success") {
          fillsMap.set(orders[i].orderId, result.result as [bigint, bigint]);
        }
      });

      return fillsMap;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const indexedOrders = indexerQuery.data ?? [];
  const pendingFillsMap = pendingFillsQuery.data ?? new Map();
  const useIndexer = USE_INDEXER && isChainReady && indexedOrders.length > 0;

  const ordersFromIndexer: RangeOrder[] = indexedOrders.map(o => {
    const pendingFills = pendingFillsMap.get(o.orderId) ?? [0n, 0n];
    const sharesTotal = BigInt(o.liquidity);
    const ticksInRange = BigInt(Math.max(1, o.tickUpper - o.tickLower + 1));
    
    return {
      orderId: BigInt(o.orderId),
      owner: o.owner as Address,
      outcome: o.outcome,
      tickLower: o.tickLower,
      tickUpper: o.tickUpper,
      sharesTotal,
      liquidity: sharesTotal / ticksInRange,
      collateralDepositedWad: BigInt(o.collateralReserved),
      filledShares: BigInt(o.claimedShares),
      pendingShares: pendingFills[0],
      pendingUsdc: pendingFills[1],
      collateralUsedWad: BigInt(o.collateralUsed),
      active: true,
    };
  });

  const rpcQuery = useUserOrdersDirect(
    useIndexer ? undefined : marketKey,
    useIndexer ? undefined : userAddress
  );

  const finalOrders = useIndexer ? ordersFromIndexer : rpcQuery.orders.filter(o => o.active);

  return {
    orders: finalOrders,
    isLoading: useIndexer 
      ? (indexerQuery.isLoading || pendingFillsQuery.isLoading)
      : rpcQuery.isLoading,
    error: useIndexer ? indexerQuery.error : rpcQuery.error,
    refetch: useIndexer 
      ? () => { indexerQuery.refetch(); pendingFillsQuery.refetch(); }
      : rpcQuery.refetch,
    source: useIndexer ? "indexer" as const : "rpc" as const,
  };
}
