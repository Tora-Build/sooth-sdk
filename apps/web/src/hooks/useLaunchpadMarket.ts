import { useReadContracts, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useMemo, useCallback, useEffect } from "react";
import { ABIS, ERC20_ABI } from "../config/abis";
import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { useAccount } from "wagmi";
import { maxUint256 } from "viem";
import { getPollingInterval } from "../lib/polling";

/**
 * Hook to fetch LaunchpadEngine state for a market and handle market operations
 * 
 * @param marketAddress - Address of the TruthMarket contract
 * @returns LaunchpadEngine data and write functions
 */
export function useLaunchpadMarket(marketAddress?: `0x${string}`) {
    const { selectedChainId } = useChainStore();
    const { address: userAddress } = useAccount();
    const deployments = useDeployments();
    const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);

    const launchpadEngineAddress = deployments?.contracts
        ?.LaunchpadEngine as `0x${string}` | undefined;
    const usdcAddress = deployments?.contracts?.MockUSDC as `0x${string}` | undefined;

    // Writes
    const { writeContract, data: txHash, isPending: isWritePending, error: writeError } = useWriteContract();
    const { writeContract: writeApprove, data: approveTxHash, isPending: isApproveWritePending } = useWriteContract();

    // Transaction Status
    const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({
        hash: txHash,
    });
    const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
        hash: approveTxHash,
    });

    const isPending = isWritePending || isConfirming;
    const isApprovePending = isApproveWritePending || isApproveConfirming;

    // USDC Allowance & Balance
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: userAddress && launchpadEngineAddress ? [userAddress, launchpadEngineAddress] : undefined,
        query: {
            enabled: !!userAddress && !!launchpadEngineAddress && !!usdcAddress,
        }
    });

    const { data: usdcBalance } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: userAddress ? [userAddress] : undefined,
        query: { enabled: !!userAddress && !!usdcAddress }
    });

    // Market reads (lightweight mapping state + graduation)
    const readMarket = useReadContracts({
        contracts: [
            {
                address: launchpadEngineAddress,
                abi: ABIS.LaunchpadEngine,
                functionName: "getMarketState",
                args: marketAddress ? [marketAddress] : undefined,
                chainId,
            },
            {
                address: launchpadEngineAddress,
                abi: ABIS.LaunchpadEngine,
                functionName: "markets",
                args: marketAddress ? [marketAddress] : undefined,
                chainId,
            },
            {
                address: launchpadEngineAddress,
                abi: ABIS.LaunchpadEngine,
                functionName: "getGraduationProgress",
                args: marketAddress ? [marketAddress] : undefined,
                chainId,
            },
        ],
        query: {
            enabled: !!marketAddress && !!launchpadEngineAddress && !!selectedChainId,
            refetchInterval: getPollingInterval(chainId, 'slow'),
            staleTime: 10000,
        },
    });

    // LP Balance (separate optional read)
    const readLpBalance = useReadContracts({
        contracts: [
            {
                address: launchpadEngineAddress,
                abi: ABIS.LaunchpadEngine,
                functionName: "getLPBalance",
                args: marketAddress && userAddress ? [marketAddress, userAddress] : undefined,
                chainId,
            },
        ],
        query: {
            enabled: !!marketAddress && !!launchpadEngineAddress && !!selectedChainId && !!userAddress,
            refetchInterval: getPollingInterval(chainId, 'slow'),
            staleTime: 10000,
        },
    });

    // Param reads (fees + multiplier)
    const readParams = useReadContracts({
        contracts: [
            {
                address: launchpadEngineAddress,
                abi: ABIS.LaunchpadEngine,
                functionName: "preGradFeeBps",
                chainId,
            },
            {
                address: launchpadEngineAddress,
                abi: ABIS.LaunchpadEngine,
                functionName: "postGradFeeBps",
                chainId,
            },
            {
                address: launchpadEngineAddress,
                abi: ABIS.LaunchpadEngine,
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

    const refetch = useCallback(async () => {
        await Promise.all([readMarket.refetch(), readParams.refetch(), readLpBalance.refetch(), refetchAllowance()]);
    }, [readMarket, readParams, readLpBalance, refetchAllowance]);

    useEffect(() => {
        if (isConfirmed || isApproveConfirmed) refetch();
    }, [isConfirmed, isApproveConfirmed, refetch]);

    // -------------------------------------------------------------------------
    // WRITE FUNCTIONS
    // -------------------------------------------------------------------------

    const createMarket = useCallback((
        question: string,
        startTime: bigint,
        deadline: bigint,
        adjudicator: `0x${string}`,
        guardian: `0x${string}`,
        initialLiquidity: bigint,
        symbol: string
    ) => {
        if (!launchpadEngineAddress) return;
        writeContract({
            address: launchpadEngineAddress,
            abi: ABIS.LaunchpadEngine,
            functionName: "createMarket",
            args: [question, startTime, deadline, adjudicator, guardian, initialLiquidity, symbol],
        });
    }, [launchpadEngineAddress, writeContract]);

    const approveUSDC = useCallback(() => {
        if (!usdcAddress || !launchpadEngineAddress) return;
        writeApprove({
            address: usdcAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [launchpadEngineAddress, maxUint256]
        });
    }, [usdcAddress, launchpadEngineAddress, writeApprove]);

    const redeemLP = useCallback((amount: bigint) => {
        if (!launchpadEngineAddress || !marketAddress) return;
        writeContract({
            address: launchpadEngineAddress,
            abi: ABIS.LaunchpadEngine,
            functionName: 'redeemLP',
            args: [marketAddress, amount]
        });
    }, [launchpadEngineAddress, marketAddress, writeContract]);

    const launchpadData = useMemo(() => {
        if (!dataMarket || !marketAddress) return null;

        const marketResults = dataMarket as any[];
        const marketStateDetailedResult = marketResults[0];
        const marketsMappingResult = marketResults[1];
        const graduationProgressResult = marketResults[2];
        const lpBalanceResult = (dataLpBalance as any[] | undefined)?.[0];

        const preGradFeeResult = (dataParams as any[] | undefined)?.[0];
        const postGradFeeResult = (dataParams as any[] | undefined)?.[1];
        const gradMultiplierResult = (dataParams as any[] | undefined)?.[2];

        // Check if critical reads failed
        if (marketStateDetailedResult?.status === "failure" || marketsMappingResult?.status === "failure" || graduationProgressResult?.status === "failure") {
            return null;
        }

        // getMarketState(market) -> (creator, bBase, bCurrent, totalLPSupply, isGraduated, floorValue)
        const detailedState = marketStateDetailedResult.result as readonly [
            `0x${string}`,
            bigint,
            bigint,
            bigint,
            boolean,
            bigint
        ];
        const [
            creator,
            bBase,
            bCurrent,
            totalLPSupply,
            isGraduated,
            floorValue,
        ] = detailedState;

        // markets(market) -> (creator, bBase, bCurrent, creatorDeposit, feesAccrued, totalLPSupply, lpYieldPool, isGraduated, createdAt, graduatedAt)
        const marketState = marketsMappingResult.result as readonly [
            `0x${string}`, // creator
            bigint,        // bBase
            bigint,        // bCurrent
            bigint,        // creatorDeposit
            bigint,        // feesAccrued
            bigint,        // totalLPSupply
            bigint,        // lpYieldPool
            boolean,       // isGraduated
            bigint,        // createdAt (uint64)
            bigint,        // graduatedAt (uint64)
            string,        // name
            string         // symbol
        ];
        const [
            _c, _bB, _bC,
            creatorDeposit,
            feesAccruedFromMarket,
            _tLS,
            lpYieldPool,
            _iG,
            _cA,
            _gA,
            name,
            symbol
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
            name,
            symbol,
            initialBBase: bBase,
            currentBBase: bCurrent,
            feesAccrued: feesAccrued ?? feesAccruedFromMarket,
            lpSupply: totalLPSupply,
            floorValue,
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
        createMarket,
        approveUSDC,
        redeemLP,
        isPending,
        isApprovePending,
        isConfirmed,
        txHash,
        writeError,
        allowance,
        usdcBalance,
        deployedMarketAddress: marketAddress
    };
}

/**
 * Type definition for LaunchpadMarket data
 */
export type LaunchpadMarketData = NonNullable<
    ReturnType<typeof useLaunchpadMarket>["launchpad"]
>;
