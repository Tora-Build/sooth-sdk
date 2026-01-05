import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { V10_ABIS } from "../config/abis";
import { useDirectRead, readContractSafe } from "./useDirectRead";

type Address = `0x${string}`;

export interface PendingFill {
  orderId: bigint;
  filledShares: bigint;
  filledUsdc: bigint;
  outcome: 0 | 1;
  isClaimed: boolean;
}

// Batch size and delay to avoid RPC rate limits (429)
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 100;

/**
 * Hook to get pending fills for a user's orders
 *
 * Uses chunked Promise.all with delays to avoid RPC rate limits.
 * Does NOT use multicall3 (not supported on Arc/Monad/Base testnets).
 */
export function usePendingFills(
  marketKey: `0x${string}` | undefined,
  orderIds: bigint[]
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const poolManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  const query = useDirectRead({
    queryKey: ["v9", "pendingFills", chainId, poolManagerAddress, marketKey, orderIds.map(String).join(",")],
    enabled: !!chainId && !!poolManagerAddress && !!marketKey && orderIds.length > 0,
    chainId,
    read: async (client) => {
      const fills: PendingFill[] = [];

      // Chunked Promise.all to avoid RPC rate limits
      for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
        const batch = orderIds.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (orderId) => {
            try {
              const result = await readContractSafe<readonly [bigint, bigint]>(client, {
                address: poolManagerAddress!,
                abi: V10_ABIS.TickBookPoolManager,
                functionName: "getPendingFills",
                args: [marketKey!, orderId],
              });

              const filledShares = result?.[0] ?? 0n;
              const filledUsdc = result?.[1] ?? 0n;

              if (filledShares > 0n) {
                return {
                  orderId,
                  filledShares,
                  filledUsdc,
                  outcome: 0 as const,
                  isClaimed: false,
                };
              }
              return null;
            } catch {
              return null;
            }
          })
        );

        for (const result of batchResults) {
          if (result) fills.push(result);
        }

        // Rate limit delay between batches
        if (i + BATCH_SIZE < orderIds.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      return fills;
    },
  });

  const fills = query.data ?? [];
  const totalClaimableShares = fills.reduce((sum, f) => sum + (f?.filledShares ?? 0n), 0n);
  const totalClaimableUsdc = fills.reduce((sum, f) => sum + (f?.filledUsdc ?? 0n), 0n);
  const hasClaimable = fills.length > 0;

  return {
    fills,
    totalClaimableShares,
    totalClaimableUsdc,
    hasClaimable,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
