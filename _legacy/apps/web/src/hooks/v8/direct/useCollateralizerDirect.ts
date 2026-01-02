import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V8_ABIS } from "../../../config/abis";
import { useV8DirectRead, readContractSafe } from "./useV8DirectRead";

type Address = `0x${string}`;

export function useCollateralizerDirect(marketAddress: Address | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const collateralizerAddress = deployments?.contracts?.Collateralizer as Address | undefined;

  const query = useV8DirectRead({
    queryKey: ["v8", "collateralizerDirect", chainId, collateralizerAddress, marketAddress],
    enabled: !!marketAddress && !!chainId && !!collateralizerAddress,
    chainId,
    read: async (client) => {
      const [tokens, totalCollateral] = await Promise.all([
        readContractSafe<readonly [Address, Address]>(client, {
          address: collateralizerAddress!,
          abi: V8_ABIS.Collateralizer,
          functionName: "getOutcomeTokens",
          args: [marketAddress!],
        }),
        readContractSafe<bigint>(client, {
          address: collateralizerAddress!,
          abi: V8_ABIS.Collateralizer,
          functionName: "getTotalCollateral",
          args: [marketAddress!],
        }),
      ]);

      const [yesToken, noToken] = tokens;
      return {
        address: marketAddress!,
        yesToken,
        noToken,
        yesBalance: 0n,
        noBalance: 0n,
        totalCollateral,
        completeSetBalance: 0n,
        hasYesTokens: false,
        hasNoTokens: false,
        hasCompleteSets: false,
        canMerge: false,
      };
    },
  });

  return {
    collateralizer: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
