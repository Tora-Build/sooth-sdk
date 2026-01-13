import { ABIS } from "../config/abis";
import { useChainStore } from "../store/useChainStore";
import { readContractSafe, useDirectRead } from "./useDirectRead";
import { useDeployments } from "./useDeployments";

type Address = `0x${string}`;

type PendingRefundsData = {
  pendingRefundsWad: bigint;
};

type UsePendingRefundsResult = {
  pendingRefundsWad: bigint;
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
};

export function usePendingRefunds(
  userAddress: Address | undefined,
  marketKey: `0x${string}` | undefined
): UsePendingRefundsResult {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const poolManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  const query = useDirectRead<PendingRefundsData>({
    queryKey: ["pendingRefunds", chainId, poolManagerAddress, userAddress, marketKey],
    enabled: !!chainId && !!poolManagerAddress && !!userAddress && !!marketKey,
    chainId,
    read: async (client) => {
      const pendingRefundsWad = (await readContractSafe<bigint>(client, {
        address: poolManagerAddress!,
        abi: ABIS.TickBookPoolManager,
        functionName: "getPendingRefunds",
        args: [userAddress!, marketKey!],
      })) ?? 0n;

      return { pendingRefundsWad };
    },
  });

  return {
    pendingRefundsWad: query.data?.pendingRefundsWad ?? 0n,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
