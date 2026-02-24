import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { ABIS, ERC20_ABI } from "../config/abis";
import { useDirectRead, readContractSafe } from "./useDirectRead";
import { useCallback } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";

type Address = `0x${string}`;

import { useAccount } from "wagmi";

/**
 * Hook to read Launchpad market state (V9 Architecture)
 */
export function useLaunchpadMarketDirect(marketAddress: Address | undefined) {
  const { selectedChainId } = useChainStore();
  const { address: userAddress } = useAccount();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const launchpadEngineAddress = deployments?.contracts?.LaunchpadEngine as Address | undefined;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

  // V11: Write functions for dismiss and claim refund
  const { writeContract, data: txHash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const isPending = isWritePending || isConfirming;

  const dismissMarket = useCallback(() => {
    if (!launchpadEngineAddress || !marketAddress) return;
    writeContract({
      address: launchpadEngineAddress,
      abi: ABIS.LaunchpadEngine,
      functionName: 'dismissMarket',
      args: [marketAddress]
    });
  }, [launchpadEngineAddress, marketAddress, writeContract]);

  const claimRefund = useCallback(() => {
    if (!launchpadEngineAddress || !marketAddress) return;
    writeContract({
      address: launchpadEngineAddress,
      abi: ABIS.LaunchpadEngine,
      functionName: 'claimRefund',
      args: [marketAddress]
    });
  }, [launchpadEngineAddress, marketAddress, writeContract]);

  const query = useDirectRead({
    queryKey: ["v9", "launchpadMarketDirect", chainId, launchpadEngineAddress, marketAddress, userAddress],
    enabled: !!marketAddress && !!chainId && !!launchpadEngineAddress,
    chainId,
    read: async (client) => {
      // Build the object primarily from the public `markets` mapping
      const marketsMapping = await readContractSafe<
        readonly [
          Address, // creator
          Address, // lpToken
          bigint,  // bBase
          bigint,  // bCurrent
          bigint,  // creatorDeposit
          bigint,  // feesAccrued
          bigint,  // totalLPSupply
          bigint,  // lpYieldPool
          boolean, // isGraduated
          bigint,  // createdAt (uint64)
          bigint,  // graduatedAt (uint64)
        ]
      >(client, {
        address: launchpadEngineAddress!,
        abi: ABIS.LaunchpadEngine,
        functionName: "markets",
        args: [marketAddress!],
      });

      const [
        creator,
        lpToken,
        bBase,
        bCurrent,
        creatorDeposit,
        feesAccruedFromMarket,
        totalLPSupply,
        lpYieldPool,
        isGraduated,
        createdAt,
        graduatedAt,
      ] = marketsMapping;

      const marketSymbol = marketAddress!.slice(2, 10).toUpperCase();
      const marketName = marketSymbol;

      const [preGradFeeBps, postGradFeeBps, graduationMultiplier] = await Promise.all([
        readContractSafe<bigint>(client, { address: launchpadEngineAddress!, abi: ABIS.LaunchpadEngine, functionName: "preGradFeeBps" }),
        readContractSafe<bigint>(client, { address: launchpadEngineAddress!, abi: ABIS.LaunchpadEngine, functionName: "postGradFeeBps" }),
        readContractSafe<bigint>(client, { address: launchpadEngineAddress!, abi: ABIS.LaunchpadEngine, functionName: "graduationMultiplier" }),
      ]);

      const isCreated = creator !== ZERO_ADDRESS;


      const [feesAccrued, graduationThreshold, progressBps] = await readContractSafe<readonly [bigint, bigint, bigint]>(client, {
        address: launchpadEngineAddress!,
        abi: ABIS.LaunchpadEngine,
        functionName: "getGraduationProgress",
        args: [marketAddress!],
      });

      // Calculate effective graduation (handling stale RPC data)
      const isEffectiveGraduated = isGraduated || (!!progressBps && progressBps >= 10000n);
      const currentFeeBps = isEffectiveGraduated ? postGradFeeBps : preGradFeeBps;

      const userLpBalance = userAddress && lpToken !== ZERO_ADDRESS
        ? await readContractSafe<bigint>(client, {
          address: lpToken,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [userAddress],
        })
        : 0n;

      // Best-effort: floorValue requires AMM state; it may revert if AMM isn't initialized.
      let floorValue = 0n;
      try {
        const marketStateDetailed = await readContractSafe<
          readonly [Address, bigint, bigint, bigint, boolean, bigint]
        >(client, {
          address: launchpadEngineAddress!,
          abi: ABIS.LaunchpadEngine,
          functionName: "getMarketState",
          args: [marketAddress!],
        });
        floorValue = marketStateDetailed[5];
      } catch {
        floorValue = 0n;
      }

      const graduationProgressPct = Math.min(100, Number(progressBps) / 100);

      // V11: Read trial state
      let trialEndTime = 0n;
      let isDismissed = false;
      let totalLockedCost = 0n;
      try {
        const trialState = await readContractSafe<readonly [bigint, boolean, bigint]>(client, {
          address: launchpadEngineAddress!,
          abi: ABIS.LaunchpadEngine,
          functionName: "trialStates",
          args: [marketAddress!],
        });
        [trialEndTime, isDismissed, totalLockedCost] = trialState;
      } catch {
        // V11 trial functions may not exist on older contracts
      }

      // V11: Read user's locked cost
      let userLockedCost = 0n;
      if (userAddress) {
        try {
          userLockedCost = await readContractSafe<bigint>(client, {
            address: launchpadEngineAddress!,
            abi: ABIS.LaunchpadEngine,
            functionName: "userLockedCost",
            args: [marketAddress!, userAddress],
          });
        } catch {
          // V11 function may not exist
        }
      }

      // V11: Calculate trial period status
      const now = BigInt(Math.floor(Date.now() / 1000));
      const isInTrialPeriod = trialEndTime > 0n && now < trialEndTime && !isDismissed;
      const trialEnded = trialEndTime > 0n && now >= trialEndTime;
      const canDismiss = trialEnded && !isDismissed && !isEffectiveGraduated;
      const canClaimRefund = isDismissed && userLockedCost > 0n;
      const trialTimeRemaining = trialEndTime > now ? Number(trialEndTime - now) : 0;

      return {
        address: marketAddress!,
        isCreated,
        creator,
        lpToken,
        initialBBase: bBase,
        currentBBase: bCurrent,
        creatorDeposit,
        feesAccrued: feesAccrued ?? feesAccruedFromMarket,
        lpSupply: totalLPSupply,
        lpYieldPool,
        isGraduated: isEffectiveGraduated,
        createdAt,
        graduatedAt,
        name: marketName,
        symbol: marketSymbol,
        floorValue,
        graduationThreshold,
        graduationProgress: graduationProgressPct,
        userLpBalance: userLpBalance ?? 0n,
        preGradFeeBps,
        postGradFeeBps,
        currentFeeBps,
        graduationMultiplier,
        canGraduate: (progressBps ? progressBps >= 10000n : false) && !isEffectiveGraduated,
        hasLpTokens: (userLpBalance ?? 0n) > 0n,
        hasAccruedFees: (feesAccrued ?? feesAccruedFromMarket) > 0n,
        // V11: Trial period data
        trialEndTime: Number(trialEndTime),
        isDismissed,
        totalLockedCost,
        userLockedCost,
        isInTrialPeriod,
        trialEnded,
        canDismiss,
        canClaimRefund,
        trialTimeRemaining,
      };
    },
  });

  return {
    launchpad: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    // V11: Trial period actions
    dismissMarket,
    claimRefund,
    isPending,
    isConfirmed,
    txHash,
  };
}
