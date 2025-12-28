import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V8_ABIS } from "../../../config/abis";
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
 * Hook to fetch user's orders from TickBookV2
 */
export function useUserOrdersDirect(
  marketKey: `0x${string}` | undefined,
  userAddress: Address | undefined
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const tickBookAddress = deployments?.contracts?.TickBook as Address | undefined;

  const query = useV8DirectRead({
    queryKey: ["v8", "userOrders", chainId, tickBookAddress, marketKey, userAddress],
    enabled: !!marketKey && !!userAddress && !!chainId && !!tickBookAddress,
    chainId,
    read: async (client) => {
      // Get user's order IDs
      const orderIds = await readContractSafe<bigint[]>(client, {
        address: tickBookAddress!,
        abi: V8_ABIS.TickBook,
        functionName: "getUserOrders",
        args: [marketKey!, userAddress!],
      });

      if (!orderIds || orderIds.length === 0) {
        return [];
      }

      // Fetch each order's details
      const orders: RangeOrder[] = [];
      for (const orderId of orderIds) {
        const order = await readContractSafe<{
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
          address: tickBookAddress!,
          abi: V8_ABIS.TickBook,
          functionName: "getOrder",
          args: [marketKey!, orderId],
        });

        if (order) {
          orders.push({
            orderId,
            ...order,
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

