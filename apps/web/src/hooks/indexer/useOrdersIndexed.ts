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

  const rpcOrdersQuery = useQuery({
    queryKey: ["rpc", "orderDetails", chainId, marketKey, indexerQuery.data?.map(o => o.orderId).join(",")],
    enabled: !!indexerQuery.data?.length && !!publicClient && !!tickBookManagerAddress && !!marketKey,
    queryFn: async () => {
      const orderIds = indexerQuery.data!.map(o => BigInt(o.orderId));
      if (!orderIds.length) return [];

      const contracts = orderIds.flatMap(orderId => [
        {
          address: tickBookManagerAddress!,
          abi: ABIS.TickBookPoolManager,
          functionName: "getOrder",
          args: [marketKey!, orderId],
        },
        {
          address: tickBookManagerAddress!,
          abi: ABIS.TickBookPoolManager,
          functionName: "getPendingFills",
          args: [marketKey!, orderId],
        },
      ]);

      const results = await publicClient!.multicall({
        contracts,
        allowFailure: true,
      });

      const orders: RangeOrder[] = [];
      for (let i = 0; i < orderIds.length; i++) {
        const orderResult = results[i * 2];
        const fillsResult = results[i * 2 + 1];

        if (orderResult.status === "success" && orderResult.result) {
          const order = orderResult.result as any;
          if (!order.active) continue;

          const pendingFills = fillsResult.status === "success"
            ? (fillsResult.result as [bigint, bigint])
            : [0n, 0n];

          const sharesTotal = order.sharesTotal ?? order.liquidity ?? 0n;
          const ticksInRange = BigInt(Math.max(1, order.tickUpper - order.tickLower + 1));

          orders.push({
            orderId: orderIds[i],
            owner: order.owner,
            outcome: order.outcome,
            tickLower: order.tickLower,
            tickUpper: order.tickUpper,
            sharesTotal,
            liquidity: sharesTotal / ticksInRange,
            collateralDepositedWad: order.collateralDepositedWad ?? 0n,
            filledShares: order.filledShares ?? 0n,
            pendingShares: pendingFills[0],
            pendingUsdc: pendingFills[1],
            collateralUsedWad: order.collateralUsedWad ?? 0n,
            active: true,
          });
        }
      }

      return orders;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const useIndexer = USE_INDEXER && isChainReady && (indexerQuery.data?.length ?? 0) > 0;
  const ordersFromIndexer = rpcOrdersQuery.data ?? [];

  const rpcQuery = useUserOrdersDirect(
    useIndexer ? undefined : marketKey,
    useIndexer ? undefined : userAddress
  );

  const finalOrders = useIndexer ? ordersFromIndexer : rpcQuery.orders.filter(o => o.active);

  return {
    orders: finalOrders,
    isLoading: useIndexer 
      ? (indexerQuery.isLoading || rpcOrdersQuery.isLoading)
      : rpcQuery.isLoading,
    error: useIndexer ? indexerQuery.error : rpcQuery.error,
    refetch: useIndexer 
      ? () => { indexerQuery.refetch(); rpcOrdersQuery.refetch(); }
      : rpcQuery.refetch,
    source: useIndexer ? "indexer" as const : "rpc" as const,
  };
}
