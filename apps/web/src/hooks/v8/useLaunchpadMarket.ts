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

    const launchpadEngineAddress = deployments?.contracts
        ?.LaunchpadEngine as `0x${string}` | undefined;

    const { data, isLoading, error, refetch } = useReadContracts({
        contracts: [
            // Market state struct (contains creator, initialBBase, feesAccrued, lpSupply, lpYieldPool)
            {
            \n                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "getMarketState",
                args: marketAddress ? [marketAddress] : undefined,
                chainId: selectedChainId,
            },
            // Graduation progress (returns currentBBase, threshold, isGraduated)
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "getGraduationProgress",
                args: marketAddress ? [marketAddress] : undefined,
                chainId: selectedChainId,
            },
            // User LP balance (if connected)
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "getLPBalance",
                args: marketAddress && userAddress ? [marketAddress, userAddress] : undefined,
                chainId: selectedChainId,
            },
            // Pre-graduation fee
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "preGradFeeBps",
                chainId: selectedChainId,
            },
            // Post-graduation fee
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "postGradFeeBps",
                chainId: selectedChainId,
            },
            // Graduation multiplier
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "graduationMultiplier",
                chainId: selectedChainId,
            },
        ],
        query: {
            enabled: !!marketAddress && !!launchpadEngineAddress && !!selectedChainId,
            refetchInterval: 30000, // Refetch every 30s
            staleTime: 10000, // Consider data stale after 10s
        },
    });

    const launchpadData = useMemo(() => {
        if (!data || !marketAddress) return null;

        const [
            marketStateResult,
            bBaseResult,
            isGraduatedResult,
            lpBalanceResult,
            preGradFeeResult,
            postGradFeeResult,
            gradMultiplierResult,
            creatorSplitResult,
        ] = data;

        // Check if critical reads failed
        if (
            marketStateResult.status === "failure" ||
            bBaseResult.status === "failure"
        ) {
            return null;
        }

        // Parse market state struct
        // struct MarketState { address creator; uint256 initialBBase; uint256 feesAccrued; uint256 lpSupply; uint256 lpYieldPool; }
        const marketState = marketStateResult.result as readonly [
            `0x${string}`, // creator
            bigint, // initialBBase
            bigint, // feesAccrued
            bigint, // lpSupply
            bigint  // lpYieldPool
        ];

        const [creator, initialBBase, feesAccrued, lpSupply, lpYieldPool] = marketState;

        const bBase = bBaseResult.result as bigint;
        const isGraduated =
            isGraduatedResult.status === "success"
                ? (isGraduatedResult.result as boolean)
                : false;
        const userLpBalance =
            lpBalanceResult.status === "success"
                ? (lpBalanceResult.result as bigint)
                : 0n;
        const preGradFeeBps =
            preGradFeeResult.status === "success"
                ? (preGradFeeResult.result as bigint)
                : 500n; // Default 5%
        const postGradFeeBps =
            postGradFeeResult.status === "success"
                ? (postGradFeeResult.result as bigint)
                : 100n; // Default 1%
        const graduationMultiplier =
            gradMultiplierResult.status === "success"
                ? (gradMultiplierResult.result as bigint)
                : 2n; // Default 2x
        const creatorFeeSplitBps =
            creatorSplitResult.status === "success"
                ? (creatorSplitResult.result as bigint)
                : 5000n; // Default 50%

        // Calculate graduation threshold
        const graduationThreshold = initialBBase * graduationMultiplier;

        // Calculate graduation progress (0-100%)
        const graduationProgress = initialBBase > 0n
            ? Number((bBase * 10000n) / graduationThreshold) / 100
            : 0;

        // Current fee rate
        const currentFeeBps = isGraduated ? postGradFeeBps : preGradFeeBps;

        return {
            address: marketAddress,
            creator,
            initialBBase,
            currentBBase: bBase,
            feesAccrued,
            lpSupply,
            lpYieldPool,
            isGraduated,
            graduationThreshold,
            graduationProgress: Math.min(100, graduationProgress),
            userLpBalance,
            preGradFeeBps,
            postGradFeeBps,
            currentFeeBps,
            graduationMultiplier,
            creatorFeeSplitBps,
            // Helper flags
            canGraduate: bBase >= graduationThreshold && !isGraduated,
            hasLpTokens: userLpBalance > 0n,
            hasAccruedFees: feesAccrued > 0n,
        };
    }, [data, marketAddress]);

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
