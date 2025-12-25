import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V8_ABIS } from "../../../config/abis";
import { useV8DirectRead, readContractSafe } from "./useV8DirectRead";

type Address = `0x${string}`;

import { useAccount } from "wagmi";

export function useLaunchpadMarketDirect(marketAddress: Address | undefined) {
  const { selectedChainId } = useChainStore();
  const { address: userAddress } = useAccount();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const launchpadEngineAddress = deployments?.contracts?.LaunchpadEngine as Address | undefined;

  const query = useV8DirectRead({
    queryKey: ["v8", "launchpadMarketDirect", chainId, launchpadEngineAddress, marketAddress, userAddress],
    enabled: !!marketAddress && !!chainId && !!launchpadEngineAddress,
    chainId,
    read: async (client) => {
      const reads = [
        readContractSafe<
          readonly [
            Address,
            bigint,
            bigint,
            bigint,
            boolean,
            bigint
          ]
        >(client, {
          address: launchpadEngineAddress!,
          abi: V8_ABIS.LaunchpadEngine,
          functionName: "getMarketState",
          args: [marketAddress!],
        }),
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
      ];

      // Add user LP balance read if user connected
      if (userAddress) {
        reads.push(
          readContractSafe<bigint>(client, {
            address: launchpadEngineAddress!,
            abi: V8_ABIS.LaunchpadEngine,
            functionName: "lpBalances",
            args: [marketAddress!, userAddress],
          })
        );
      }

      const results = await Promise.all(reads);

      const [marketStateDetailed, marketsMapping, graduationProgress, preGradFeeBps, postGradFeeBps, graduationMultiplier] = results as any;
      const userLpBalance = userAddress ? results[6] as bigint : 0n;

      const [
        creator,
        bBase,
        bCurrent,
        totalLPSupply,
        isGraduated,
        floorValue
      ] = marketStateDetailed;

      const [
        _c, _bB, _bC,
        creatorDeposit,
        feesAccruedFromMarket,
        _tLS,
        lpYieldPool,
        _iG,
      ] = marketsMapping;

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
        floorValue: floorValue,
        lpYieldPool,
        creatorDeposit,
        isGraduated,
        graduationThreshold,
        graduationProgress: graduationProgressPct,
        userLpBalance: userLpBalance ?? 0n,
        preGradFeeBps,
        postGradFeeBps,
        currentFeeBps,
        graduationMultiplier,
        canGraduate: progressBps >= 10000n && !isGraduated,
        hasLpTokens: (userLpBalance ?? 0n) > 0n,
        hasAccruedFees: (feesAccrued ?? feesAccruedFromMarket) > 0n,
      };

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
