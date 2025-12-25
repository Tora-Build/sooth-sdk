import { useReadContracts } from "wagmi";
import { useMemo } from "react";
import { V8_ABIS } from "../../config/abis";
import { useChainStore } from "../../store/useChainStore";
import { useDeployments } from "../useDeployments";
import { useAccount } from "wagmi";

/**
 * Hook to fetch LaunchpadEngine state for a market
 * 
 * @param marketAddress - Address of the TruthMarket contract
 * @returns LaunchpadEngine data including liquidity, graduation status, LP positions, fees
 */
export function useLaunchpadMarket(marketAddress: `0x${string}` | undefined) {
    const { selectedChainId } = useChainStore();
    const { address: userAddress } = useAccount();
    const deployments = useDeployments();
    const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);

    const launchpadEngineAddress = deployments?.contracts
        ?.LaunchpadEngine as `0x${string}` | undefined;

    // Market reads (lightweight mapping state + graduation)
    const readMarket = useReadContracts({
        contracts: [
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "markets",
                args: marketAddress ? [marketAddress] : undefined,
                chainId,
            },
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "getGraduationProgress",
                args: marketAddress ? [marketAddress] : undefined,
                chainId,
            },
        ],
        query: {
            enabled: !!marketAddress && !!launchpadEngineAddress && !!selectedChainId,
            refetchInterval: 30000,
            staleTime: 10000,
        },
    });

    // LP Balance (separate optional read)
    const readLpBalance = useReadContracts({
        contracts: [
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "getLPBalance",
                args: marketAddress && userAddress ? [marketAddress, userAddress] : undefined,
                chainId,
            },
        ],
        query: {
            enabled: !!marketAddress && !!launchpadEngineAddress && !!selectedChainId && !!userAddress,
            refetchInterval: 30000,
            staleTime: 10000,
        },
    });

    // Param reads (fees + multiplier)
    const readParams = useReadContracts({
        contracts: [
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "preGradFeeBps",
                chainId,
            },
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "postGradFeeBps",
                chainId,
            },
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "graduationMultiplier",
                chainId,
            },
        ],
        query: {
            enabled: !!launchpadEngineAddress && !!selectedChainId,
            refetchInterval: false,
            staleTime: Infinity,
        },
    });

    const dataMarket = readMarket.data;
    const dataParams = readParams.data;
    const dataLpBalance = readLpBalance.data;
    const isLoading = readMarket.isLoading;
    const error = readMarket.error || readParams.error;
    const refetch = async () => {
        await Promise.all([readMarket.refetch(), readParams.refetch(), readLpBalance.refetch()]);
    };

    const launchpadData = useMemo(() => {
        if (!dataMarket || !marketAddress) return null;

        const marketResults = dataMarket as any[];
        const marketStateResult = marketResults[0];
        const graduationProgressResult = marketResults[1];
        const lpBalanceResult = (dataLpBalance as any[] | undefined)?.[0];

        const preGradFeeResult = (dataParams as any[] | undefined)?.[0];
        const postGradFeeResult = (dataParams as any[] | undefined)?.[1];
        const gradMultiplierResult = (dataParams as any[] | undefined)?.[2];

        // Check if critical reads failed
        if (marketStateResult?.status === "failure" || graduationProgressResult?.status === "failure") {
            return null;
        }

        // markets(market) -> (creator, bBase, bCurrent, creatorDeposit, feesAccrued, totalLPSupply, lpYieldPool, isGraduated, createdAt, graduatedAt)
        const marketState = marketStateResult.result as readonly [
            `0x${string}`,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            boolean,
            bigint,
            bigint
        ];
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

        // getGraduationProgress(market) -> (feesAccrued, threshold, progressBps)
        const graduationProgressTuple = graduationProgressResult.result as readonly [bigint, bigint, bigint];
        const [feesAccrued, graduationThreshold, progressBps] = graduationProgressTuple;

        const userLpBalance =
            lpBalanceResult?.status === "success"
                ? (lpBalanceResult.result as bigint)
                : 0n;
        const preGradFeeBps =
            preGradFeeResult?.status === "success"
                ? (preGradFeeResult.result as bigint)
                : 500n; // Default 5%
        const postGradFeeBps =
            postGradFeeResult?.status === "success"
                ? (postGradFeeResult.result as bigint)
                : 100n; // Default 1%
        const graduationMultiplier =
            gradMultiplierResult?.status === "success"
                ? (gradMultiplierResult.result as bigint)
                : 2n; // Default 2x

        // progressBps is already 0-10000
        const graduationProgress = Number(progressBps) / 100;

        // Current fee rate
        const currentFeeBps = isGraduated ? postGradFeeBps : preGradFeeBps;

        return {
            address: marketAddress,
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
            graduationProgress: Math.min(100, graduationProgress),
            userLpBalance,
            preGradFeeBps,
            postGradFeeBps,
            currentFeeBps,
            graduationMultiplier,
            // Helper flags
            canGraduate: progressBps >= 10000n && !isGraduated,
            hasLpTokens: userLpBalance > 0n,
            hasAccruedFees: (feesAccrued ?? feesAccruedFromMarket) > 0n,
        };
    }, [dataMarket, dataParams, dataLpBalance, marketAddress]);

    return {
        launchpad: launchpadData,
        isLoading,
        error,
        refetch,
    };
}

/**
 * Type definition for LaunchpadMarket data
 */
export type LaunchpadMarketData = NonNullable<
    ReturnType<typeof useLaunchpadMarket>["launchpad"]
>;
