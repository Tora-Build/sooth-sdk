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
      const [qYes, qNo, yesPrice] = await readContractSafe<readonly [bigint, bigint, bigint]>(client, {
        address: ammEngineAddress!,
        abi: V8_ABIS.AMMEngine,
        functionName: "getMarketState",
        args: [marketAddress!],
      });
      const WAD = 10n ** 18n;
      const noPrice = yesPrice <= WAD ? WAD - yesPrice : 0n;
      const yesProbability = Number(yesPrice) / 1e18;
      const noProbability = Number(noPrice) / 1e18;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAmmMarketDirect.ts:return',message:'AMM market state loaded',data:{marketAddress,ammEngineAddress,qYes:qYes?.toString(),qNo:qNo?.toString(),yesPrice:yesPrice?.toString(),yesProbability,noProbability,hasLiquidity:qYes>0n||qNo>0n},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      return {
        address: marketAddress!,
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
