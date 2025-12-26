import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V8_ABIS } from "../../../config/abis";
import { useV8DirectRead, readContractSafe } from "./useV8DirectRead";

type Address = `0x${string}`;

export function useAmmMarketDirect(marketAddress: Address | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const ammEngineAddress = deployments?.contracts?.AMMEngine as Address | undefined;

  const query = useV8DirectRead({
    queryKey: ["v8", "ammMarketDirect", chainId, ammEngineAddress, marketAddress],
    enabled: !!marketAddress && !!chainId && !!ammEngineAddress,
    chainId,
    read: async (client) => {
      // Important: `getMarketState()` reverts if the market isn't initialized yet.
      // We first read `getLiquidity()` (does NOT revert) to detect initialization.
      const liquidity = await readContractSafe<bigint>(client, {
        address: ammEngineAddress!,
        abi: V8_ABIS.AMMEngine,
        functionName: "getLiquidity",
        args: [marketAddress!],
      });

      const WAD = 10n ** 18n;
      const isInitialized = liquidity > 0n;

      let qYes = 0n;
      let qNo = 0n;
      let yesPrice = WAD / 2n;

      if (isInitialized) {
        const state = await readContractSafe<readonly [bigint, bigint, bigint]>(client, {
          address: ammEngineAddress!,
          abi: V8_ABIS.AMMEngine,
          functionName: "getMarketState",
          args: [marketAddress!],
        });
        [qYes, qNo, yesPrice] = state;
      }

      const noPrice = yesPrice <= WAD ? WAD - yesPrice : 0n;
      const yesProbability = Number(yesPrice) / 1e18;
      const noProbability = Number(noPrice) / 1e18;
      return {
        address: marketAddress!,
        liquidity,
        isInitialized,
        qYes,
        qNo,
        yesPrice,
        noPrice,
        yesProbability,
        noProbability,
        hasLiquidity: qYes > 0n || qNo > 0n,
        isBalanced: Math.abs(yesProbability - 0.5) < 0.1,
      };
    },
  });

  return {
    amm: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
