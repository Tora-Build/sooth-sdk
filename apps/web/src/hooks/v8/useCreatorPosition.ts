import { useReadContracts } from "wagmi";
import { useMemo } from "react";
import { V8_ABIS } from "../../config/abis";
import { useChainStore } from "../../store/useChainStore";
import { useDeployments } from "../useDeployments";
import { useAccount } from "wagmi";

/**
 * Hook to fetch creator's LP position and earnings for a market
 * 
 * @param marketAddress - Address of the TruthMarket contract
 * @returns Creator position data including LP tokens, fees, and yield
 */
export function useCreatorPosition(marketAddress: `0x${string}` | undefined) {
    const { selectedChainId } = useChainStore();
    const { address: userAddress } = useAccount();
    const deployments = useDeployments();

    const launchpadEngineAddress = deployments?.contracts
        ?.LaunchpadEngine as `0x${string}` | undefined;

    const { data, isLoading, error, refetch } = useReadContracts({
        contracts: [
            // Market state (includes creator address)
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "markets",
                args: marketAddress ? [marketAddress] : undefined,
                chainId: selectedChainId,
            },
            // Creator's LP balance
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "lpBalances",
                args: marketAddress && userAddress ? [marketAddress, userAddress] : undefined,
                chainId: selectedChainId,
            },
            // Current bBase (for calculating LP value)
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "getBBase",
                args: marketAddress ? [marketAddress] : undefined,
                chainId: selectedChainId,
            },
            // Graduation status
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "isGraduated",
                args: marketAddress ? [marketAddress] : undefined,
                chainId: selectedChainId,
            },
        ],
        query: {
            enabled: !!marketAddress && !!launchpadEngineAddress && !!userAddress && !!selectedChainId,
            refetchInterval: 30000, // Refetch every 30s
            staleTime: 10000, // Consider data stale after 10s
        },
    });

    const creatorData = useMemo(() => {
        if (!data || !marketAddress || !userAddress) return null;

        const [marketStateResult, lpBalanceResult, bBaseResult, isGraduatedResult] = data;

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

        // Check if user is the creator
        const isCreator = creator.toLowerCase() === userAddress.toLowerCase();

        if (!isCreator) {
            return {
                address: marketAddress,
                isCreator: false,
                creator,
                lpBalance: 0n,
                lpShare: 0,
                feesAccrued: 0n,
                lpYieldPool: 0n,
                claimableYield: 0n,
                initialBBase: 0n,
                currentBBase: 0n,
                isGraduated: false,
            };
        }

        const lpBalance =
            lpBalanceResult.status === "success"
                ? (lpBalanceResult.result as bigint)
                : 0n;
        const currentBBase = bBaseResult.result as bigint;
        const isGraduated =
            isGraduatedResult.status === "success"
                ? (isGraduatedResult.result as boolean)
                : false;

        // Calculate LP share (percentage of total supply)
        const lpShare = lpSupply > 0n
            ? Number((lpBalance * 10000n) / lpSupply) / 100
            : 0;

        // Calculate claimable yield (proportional to LP balance)
        const claimableYield = lpSupply > 0n
            ? (lpYieldPool * lpBalance) / lpSupply
            : 0n;

        // Calculate total earnings (fees + yield)
        const totalEarnings = feesAccrued + lpYieldPool;

        // Calculate creator's share of fees (based on creatorFeeSplitBps, typically 50%)
        // This is an approximation - actual calculation happens on-chain
        const estimatedCreatorFees = feesAccrued / 2n; // Assuming 50% split

        return {
            address: marketAddress,
            isCreator: true,
            creator,
            lpBalance,
            lpShare,
            lpSupply,
            feesAccrued,
            lpYieldPool,
            claimableYield,
            totalEarnings,
            estimatedCreatorFees,
            initialBBase,
            currentBBase,
            isGraduated,
            // Helper flags
            hasLpTokens: lpBalance > 0n,
            hasClaimableYield: claimableYield > 0n,
            hasEarnings: totalEarnings > 0n,
        };
    }, [data, marketAddress, userAddress]);

    return {
        position: creatorData,
        isLoading,
        error,
        refetch,
    };
}

/**
 * Hook to check if user is creator of a market
 * 
 * @param marketAddress - Address of the TruthMarket contract
 * @returns Boolean indicating if user is the creator
 */
export function useIsCreator(marketAddress: `0x${string}` | undefined) {
    const { address: userAddress } = useAccount();
    const { selectedChainId } = useChainStore();
    const deployments = useDeployments();

    const launchpadEngineAddress = deployments?.contracts
        ?.LaunchpadEngine as `0x${string}` | undefined;

    const { data, isLoading } = useReadContracts({
        contracts: [
            {
                address: launchpadEngineAddress,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: "markets",
                args: marketAddress ? [marketAddress] : undefined,
                chainId: selectedChainId,
            },
        ],
        query: {
            enabled: !!marketAddress && !!launchpadEngineAddress && !!userAddress && !!selectedChainId,
            refetchInterval: false, // Creator doesn't change
            staleTime: Infinity,
        },
    });

    const isCreator = useMemo(() => {
        if (!data || !userAddress) return false;

        const [marketStateResult] = data;

        if (marketStateResult.status === "failure") return false;

        const marketState = marketStateResult.result as readonly [`0x${string}`, bigint, bigint, bigint, bigint];
        const [creator] = marketState;

        return creator.toLowerCase() === userAddress.toLowerCase();
    }, [data, userAddress]);

    return {
        isCreator,
        isLoading,
    };
}

/**
 * Type definitions
 */
export type CreatorPositionData = NonNullable<
    ReturnType<typeof useCreatorPosition>["position"]
>;
