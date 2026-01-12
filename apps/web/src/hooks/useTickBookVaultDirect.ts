import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { ABIS } from "../config/abis";
import { useDirectRead, readContractSafe } from "./useDirectRead";

type Address = `0x${string}`;

export function useTickBookVaultDirect(userAddress: Address | undefined, marketAddress: Address | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const vaultAddress = deployments?.contracts?.TickBookVault as Address | undefined;

  const query = useDirectRead({
    queryKey: ["v8", "tickBookVaultDirect", chainId, vaultAddress, userAddress, marketAddress],
    enabled: !!chainId && !!vaultAddress && !!userAddress,
    chainId,
    read: async (client) => {
      const [availableWad, reservedWad] = await Promise.all([
        readContractSafe<bigint>(client, {
          address: vaultAddress!,
          abi: ABIS.TickBookVault,
          functionName: "availableUsdcWad",
          args: [userAddress!],
        }),
        readContractSafe<bigint>(client, {
          address: vaultAddress!,
          abi: ABIS.TickBookVault,
          functionName: "reservedUsdcWad",
          args: [userAddress!],
        }),
      ]);

      let yesInternal = 0n;
      let noInternal = 0n;
      let yesLocked = 0n;
      let noLocked = 0n;

      if (marketAddress) {
        const [outcomes, yesLockedResult, noLockedResult] = await Promise.all([
          readContractSafe<readonly [bigint, bigint]>(client, {
            address: vaultAddress!,
            abi: ABIS.TickBookVault,
            functionName: "getInternalOutcomes",
            args: [marketAddress!, userAddress!],
          }),
          readContractSafe<bigint>(client, {
            address: vaultAddress!,
            abi: ABIS.TickBookVault,
            functionName: "getLockedOutcome",
            args: [marketAddress!, userAddress!, 1],
          }),
          readContractSafe<bigint>(client, {
            address: vaultAddress!,
            abi: ABIS.TickBookVault,
            functionName: "getLockedOutcome",
            args: [marketAddress!, userAddress!, 0],
          }),
        ]);
        yesInternal = outcomes[0];
        noInternal = outcomes[1];
        yesLocked = yesLockedResult;
        noLocked = noLockedResult;
      }

      return {
        availableUsdcWad: availableWad,
        reservedUsdcWad: reservedWad,
        yesInternal,
        noInternal,
        yesLocked,
        noLocked,
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

