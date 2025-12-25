import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V8_ABIS } from "../../../config/abis";
import { useV8DirectRead, readContractSafe } from "./useV8DirectRead";

type Address = `0x${string}`;

export function useLaunchpadMarketDirect(marketAddress: Address | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const launchpadEngineAddress = deployments?.contracts?.LaunchpadEngine as Address | undefined;

  const query = useV8DirectRead({
    queryKey: ["v8", "launchpadMarketDirect", chainId, launchpadEngineAddress, marketAddress],
    enabled: !!marketAddress && !!chainId && !!launchpadEngineAddress,
    chainId,
    read: async (client) => {
      const [marketState, graduationProgress, preGradFeeBps, postGradFeeBps, graduationMultiplier] =
        await Promise.all([
          readContractSafe<
            readonly [
              Address,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              boolean,
              bigint,
              bigint
            ]
          >(client, {
            address: launchpadEngineAddress!,
            abi: V8_ABIS.LaunchpadEngine,
            functionName: "markets",
            args: [marketAddress!],
          }),
          readContractSafe<readonly [bigint, bigint, bigint]>(client, {
            address: launchpadEngineAddress!,
            abi: V8_ABIS.LaunchpadEngine,
            functionName: "getGraduationProgress",
            args: [marketAddress!],
          }),
          readContractSafe<bigint>(client, { address: launchpadEngineAddress!, abi: V8_ABIS.LaunchpadEngine, functionName: "preGradFeeBps" }),
          readContractSafe<bigint>(client, { address: launchpadEngineAddress!, abi: V8_ABIS.LaunchpadEngine, functionName: "postGradFeeBps" }),
          readContractSafe<bigint>(client, { address: launchpadEngineAddress!, abi: V8_ABIS.LaunchpadEngine, functionName: "graduationMultiplier" }),
        ]);

      const [
        creator,
        bBase,
        bCurrent,
        creatorDeposit,
        feesAccruedFromMarket,
        totalLPSupply,
        lpYieldPool,
        isGraduated,
      ] = marketState;
      const [feesAccrued, graduationThreshold, progressBps] = graduationProgress;
      const graduationProgressPct = Math.min(100, Number(progressBps) / 100);
      const currentFeeBps = isGraduated ? postGradFeeBps : preGradFeeBps;

      const result = {
        address: marketAddress!,
        creator,
        initialBBase: bBase,
        currentBBase: bCurrent,
        feesAccrued: feesAccrued ?? feesAccruedFromMarket,
        lpSupply: totalLPSupply,
        floorValue: 0n,
        lpYieldPool,
        creatorDeposit,
        isGraduated,
        graduationThreshold,
        graduationProgress: graduationProgressPct,
        userLpBalance: 0n,
        preGradFeeBps,
        postGradFeeBps,
        currentFeeBps,
        graduationMultiplier,
        canGraduate: progressBps >= 10000n && !isGraduated,
        hasLpTokens: false,
        hasAccruedFees: (feesAccrued ?? feesAccruedFromMarket) > 0n,
      };
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useLaunchpadMarketDirect.ts:return',message:'Launchpad data loaded',data:{marketAddress,creator,bBase:bBase?.toString(),bCurrent:bCurrent?.toString(),isGraduated,currentFeeBps:currentFeeBps?.toString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      return result;
    },
  });

  return {
    launchpad: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
