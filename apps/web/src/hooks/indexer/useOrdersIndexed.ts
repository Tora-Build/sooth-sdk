import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";

import { ABIS } from "../../config/abis";
import { addJitter } from "../../lib/polling";
import { useChainStore } from "../../store/useChainStore";
import { useDeployments } from "../useDeployments";
import { RangeOrder, useUserOrdersDirect } from "../useUserOrdersDirect";
import { checkChainReady, fetchFromIndexer, USE_INDEXER } from "./config";

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

type UseOrdersIndexedResult = {
  orders: RangeOrder[];
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  source: "indexer" | "rpc";
};

/**
 * Hybrid approach: indexer for order list (no block limit), RPC for pending fills (accumulator accuracy)
 */
export function useOrdersIndexed(
  marketKey: `0x${string}` | undefined,
  userAddress: Address | undefined
): UseOrdersIndexedResult {
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
    refetchInterval: addJitter(30_000),
  });

  const isChainReady = chainReadyQuery.data === true;

  const indexerQuery = useQuery({
    queryKey: ["indexer", "userOrders", chainId, marketKey, userAddress],
    enabled: USE_INDEXER && isChainReady && !!marketKey && !!userAddress && !!chainId,
    queryFn: async () => {
      const userOrders = await fetchFromIndexer<IndexedOrder[]>(
        `/orders/${chainId}/${marketKey}/${userAddress}?status=all`
      );
      return userOrders ?? [];
    },
    staleTime: 5_000,
    refetchInterval: addJitter(10_000),
    retry: false,
  });

  const rpcOrdersQuery = useQuery({
    queryKey: ["rpc", "orderDetails", chainId, marketKey, indexerQuery.data?.map(o => o.orderId).join(",")],
    enabled: !!indexerQuery.data?.length && !!publicClient && !!tickBookManagerAddress && !!marketKey,
    queryFn: async () => {
      const orderIds = (indexerQuery.data ?? []).map((order) => BigInt(order.orderId));
      if (orderIds.length === 0) return [];

      const contracts = orderIds.flatMap((orderId) => [
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
          const order = orderResult.result as Omit<RangeOrder, "orderId" | "pendingShares" | "pendingUsdc" | "createdAt">;
          const [pendingShares, pendingUsdc] = fillsResult.status === "success"
            ? (fillsResult.result as [bigint, bigint])
            : [0n, 0n];

          orders.push({
            orderId: orderIds[i],
            ...order,
            pendingShares,
            pendingUsdc,
          });
        }
      }

      return orders;
    },
    staleTime: 5_000,
    refetchInterval: addJitter(10_000),
  });

  const useIndexer = USE_INDEXER && isChainReady && (indexerQuery.data?.length ?? 0) > 0;
  const ordersFromIndexer = rpcOrdersQuery.data ?? [];

  const rpcQuery = useUserOrdersDirect(
    useIndexer ? undefined : marketKey,
    useIndexer ? undefined : userAddress
  );

  const finalOrders = useIndexer ? ordersFromIndexer : rpcQuery.orders;

  return {
    orders: finalOrders,
    isLoading: useIndexer 
      ? (indexerQuery.isLoading || rpcOrdersQuery.isLoading)
      : rpcQuery.isLoading,
    error: useIndexer ? indexerQuery.error : rpcQuery.error,
    refetch: useIndexer
      ? () => Promise.all([indexerQuery.refetch(), rpcOrdersQuery.refetch()])
      : rpcQuery.refetch,
    source: useIndexer ? "indexer" as const : "rpc" as const,
  };
}
