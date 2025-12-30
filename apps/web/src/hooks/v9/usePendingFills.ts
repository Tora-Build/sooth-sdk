import { useChainStore } from "../../store/useChainStore";
import { useDeployments } from "../useDeployments";
import { V9_ABIS } from "../../config/abis";
import { useV8DirectRead, readContractSafe } from "../v8/direct/useV8DirectRead";

type Address = `0x${string}`;

export interface PendingFill {
  orderId: bigint;
  filledShares: bigint;
  filledUsdc: bigint;
  outcome: 0 | 1;
  isClaimed: boolean;
}

/**
 * Hook to get pending fills for a user's orders
 *
 * Pending fills are orders that have been matched but not yet claimed.
 * Users can batch claim all fills at once.
 */
export function usePendingFills(
  marketKey: `0x${string}` | undefined,
  orderIds: bigint[]
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const poolManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  const query = useV8DirectRead({
    queryKey: ["v9", "pendingFills", chainId, poolManagerAddress, marketKey, orderIds.map(String).join(",")],
    enabled: !!chainId && !!poolManagerAddress && !!marketKey && orderIds.length > 0,
    chainId,
    read: async (client) => {
      const fills: PendingFill[] = [];

      for (const orderId of orderIds) {
        try {
          const fill = await readContractSafe<{
            filledShares: bigint;
            filledUsdc: bigint;
            outcome: number;
            isClaimed: boolean;
          }>(client, {
            address: poolManagerAddress!,
            abi: V9_ABIS.TickBookPoolManager,
            functionName: "getPendingFills",
            args: [marketKey!, orderId],
          });

          if (fill.filledShares > 0n && !fill.isClaimed) {
            fills.push({
              orderId,
              filledShares: fill.filledShares,
              filledUsdc: fill.filledUsdc,
              outcome: fill.outcome as 0 | 1,
              isClaimed: fill.isClaimed,
            });
          }
        } catch {
          // Order may not exist or have no fills
        }
      }

      return fills;
    },
  });

  const totalClaimableShares = query.data?.reduce((sum, f) => sum + f.filledShares, 0n) ?? 0n;
  const totalClaimableUsdc = query.data?.reduce((sum, f) => sum + f.filledUsdc, 0n) ?? 0n;
  const hasClaimable = (query.data?.length ?? 0) > 0;

  return {
    fills: query.data ?? [],
    totalClaimableShares,
    totalClaimableUsdc,
    hasClaimable,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
