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
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

  const query = useV8DirectRead({
    queryKey: ["v8", "launchpadMarketDirect", chainId, launchpadEngineAddress, marketAddress, userAddress],
    enabled: !!marketAddress && !!chainId && !!launchpadEngineAddress,
    chainId,
    read: async (client) => {
      // NOTE: `getMarketState()` can revert if the AMM isn't initialized for this market yet
      // (because LaunchpadEngine computes floor value by calling AMMEngine.getMarketState()).
      // To keep the UI resilient, we build the object primarily from the public `markets` mapping
      // (which never reverts and returns zeroed struct for unknown markets).

      const marketsMapping = await readContractSafe<
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
      });

      const [
        creator,
        bBase,
        bCurrent,
        creatorDeposit,
        feesAccruedFromMarket,
        totalLPSupply,
        lpYieldPool,
        isGraduated,
        createdAt,
        graduatedAt
      ] = marketsMapping;

      const [preGradFeeBps, postGradFeeBps, graduationMultiplier] = await Promise.all([
        readContractSafe<bigint>(client, { address: launchpadEngineAddress!, abi: V8_ABIS.LaunchpadEngine, functionName: "preGradFeeBps" }),
        readContractSafe<bigint>(client, { address: launchpadEngineAddress!, abi: V8_ABIS.LaunchpadEngine, functionName: "postGradFeeBps" }),
        readContractSafe<bigint>(client, { address: launchpadEngineAddress!, abi: V8_ABIS.LaunchpadEngine, functionName: "graduationMultiplier" }),
      ]);

      const isCreated = creator !== ZERO_ADDRESS;
      const currentFeeBps = isGraduated ? postGradFeeBps : preGradFeeBps;

      const [feesAccrued, graduationThreshold, progressBps] = await readContractSafe<readonly [bigint, bigint, bigint]>(client, {
        address: launchpadEngineAddress!,
        abi: V8_ABIS.LaunchpadEngine,
        functionName: "getGraduationProgress",
        args: [marketAddress!],
      });

      const userLpBalance = userAddress
        ? await readContractSafe<bigint>(client, {
            address: launchpadEngineAddress!,
            abi: V8_ABIS.LaunchpadEngine,
            functionName: "lpBalances",
            args: [marketAddress!, userAddress],
          })
        : 0n;

      // Best-effort: floorValue requires AMM state; it may revert if AMM isn't initialized.
      let floorValue = 0n;
      try {
        const marketStateDetailed = await readContractSafe<
          readonly [Address, bigint, bigint, bigint, boolean, bigint]
        >(client, {
          address: launchpadEngineAddress!,
          abi: V8_ABIS.LaunchpadEngine,
          functionName: "getMarketState",
          args: [marketAddress!],
        });
        floorValue = marketStateDetailed[5];
      } catch {
        floorValue = 0n;
      }

      const graduationProgressPct = Math.min(100, Number(progressBps) / 100);

      return {
        address: marketAddress!,
        isCreated,
        creator,
        initialBBase: bBase,
        currentBBase: bCurrent,
        creatorDeposit,
        feesAccrued: feesAccrued ?? feesAccruedFromMarket,
        lpSupply: totalLPSupply,
        lpYieldPool,
        isGraduated,
        createdAt,
        graduatedAt,
        floorValue,
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
    },
  });

  return {
    launchpad: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
