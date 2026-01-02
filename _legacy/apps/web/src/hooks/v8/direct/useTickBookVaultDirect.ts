import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V8_ABIS } from "../../../config/abis";
import { useV8DirectRead, readContractSafe } from "./useV8DirectRead";

type Address = `0x${string}`;

/**
 * Hook to read TickBookVault balances for the Pro page
 * @param userAddress User wallet address
 * @param marketAddress TruthMarket address for internal outcomes
 */
export function useTickBookVaultDirect(userAddress: Address | undefined, marketAddress: Address | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const vaultAddress = deployments?.contracts?.TickBookVault as Address | undefined;

  const query = useV8DirectRead({
    queryKey: ["v8", "tickBookVaultDirect", chainId, vaultAddress, userAddress, marketAddress],
    enabled: !!chainId && !!vaultAddress && !!userAddress,
    chainId,
    read: async (client) => {
      const [availableWad, reservedWad] = await Promise.all([
        readContractSafe<bigint>(client, {
          address: vaultAddress!,
          abi: V8_ABIS.TickBookVault,
          functionName: "availableUsdcWad",
          args: [userAddress!],
        }),
        readContractSafe<bigint>(client, {
          address: vaultAddress!,
          abi: V8_ABIS.TickBookVault,
          functionName: "reservedUsdcWad",
          args: [userAddress!],
        }),
      ]);

      let yesInternal = 0n;
      let noInternal = 0n;
      if (marketAddress) {
        const outcomes = await readContractSafe<readonly [bigint, bigint]>(client, {
          address: vaultAddress!,
          abi: V8_ABIS.TickBookVault,
          functionName: "getInternalOutcomes",
          args: [marketAddress!, userAddress!],
        });
        yesInternal = outcomes[0];
        noInternal = outcomes[1];
      }

      return {
        availableUsdcWad: availableWad,
        reservedUsdcWad: reservedWad,
        yesInternal,
        noInternal,
      };
    },
  });

  return {
    vault: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

