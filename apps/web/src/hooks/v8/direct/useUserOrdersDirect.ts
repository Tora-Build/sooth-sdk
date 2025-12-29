import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V9_ABIS } from "../../../config/abis";
import { useV8DirectRead, readContractSafe } from "./useV8DirectRead";

type Address = `0x${string}`;

export interface RangeOrder {
  orderId: bigint;
  owner: Address;
  outcome: number;
  tickLower: number;
  tickUpper: number;
  sharesTotal: bigint;
  liquidity: bigint;
  collateralDepositedWad: bigint;
  filledShares: bigint;
  collateralUsedWad: bigint;
  active: boolean;
}

/**
 * Hook to fetch user's orders from TickBookPoolManager (V9 Architecture)
 */
export function useUserOrdersDirect(
  marketKey: `0x${string}` | undefined,
  userAddress: Address | undefined
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const tickBookManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  const query = useV8DirectRead({
    queryKey: ["v9", "userOrders", chainId, tickBookManagerAddress, marketKey, userAddress],
    enabled: !!marketKey && !!userAddress && !!chainId && !!tickBookManagerAddress,
    chainId,
    read: async (client) => {
      // Get user's order IDs from TickBookPoolManager
      const orderIds = await readContractSafe<bigint[]>(client, {
        address: tickBookManagerAddress!,
        abi: V9_ABIS.TickBookPoolManager,
        functionName: "getUserOrders",
        args: [marketKey!, userAddress!],
      });

      if (!orderIds || orderIds.length === 0) {
        return [];
      }

      // Fetch each order's details + pending fills
      const orders: RangeOrder[] = [];
      for (const orderId of orderIds) {
        const [order, pendingFills] = await Promise.all([
          readContractSafe<{
            owner: Address;
            outcome: number;
            tickLower: number;
            tickUpper: number;
            sharesTotal: bigint;
            liquidity: bigint;
            collateralDepositedWad: bigint;
            filledShares: bigint;
            collateralUsedWad: bigint;
            active: boolean;
          }>(client, {
            address: tickBookManagerAddress!,
            abi: V9_ABIS.TickBookPoolManager,
            functionName: "getOrder",
            args: [marketKey!, orderId],
          }),
          readContractSafe<readonly [bigint, bigint]>(client, {
            address: tickBookManagerAddress!,
            abi: V9_ABIS.TickBookPoolManager,
            functionName: "getPendingFills",
            args: [marketKey!, orderId],
          }),
        ]);

        if (order) {
          const pendingShares = pendingFills?.[0] ?? 0n;
          const totalFilledShares = order.filledShares + pendingShares;

          orders.push({
            orderId,
            ...order,
            filledShares: totalFilledShares,
          });
        }
      }

      return orders;
    },
  });

  return {
    orders: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

