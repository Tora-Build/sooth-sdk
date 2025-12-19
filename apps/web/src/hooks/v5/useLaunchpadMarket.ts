import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LAUNCHPAD_MARKET_ABI } from '../../config/abis';
import { useAccount } from 'wagmi';
import { useCallback, useEffect, useMemo } from 'react';

export function useLaunchpadMarket(marketAddress?: `0x${string}`) {
    const { address: userAddress } = useAccount();

    // Writes
    const { writeContract: graduateWrite, data: graduateTxHash, isPending: isGraduatePending } = useWriteContract();
    const { writeContract: expireWrite, data: expireTxHash, isPending: isExpirePending } = useWriteContract();
    const { writeContract: refundWrite, data: refundTxHash, isPending: isRefundPending } = useWriteContract();
    const { writeContract: redeemLPWrite, data: redeemLPTxHash, isPending: isRedeemLPPending } = useWriteContract();

    // Wait for graduation transaction
    const { isLoading: isGraduateConfirming, isSuccess: isGraduateSuccess } = useWaitForTransactionReceipt({
        hash: graduateTxHash,
    });

    // Wait for redeemLP transaction
    const { isLoading: isRedeemLPConfirming, isSuccess: isRedeemLPSuccess } = useWaitForTransactionReceipt({
        hash: redeemLPTxHash,
    });

    // Reads - Phase 1: Get market data including creator address
    const { data: marketData, refetch } = useReadContracts({
        contracts: [
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isGraduated' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'graduationThreshold' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'bBase' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'deadline' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'creator' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isLive' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'feesAccrued' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'outcomeToken' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalCreatorDeposit' },
            // V6: Locking
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalLockedProceeds' },
            // V6: LP Token (market IS the LP token)
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalSupply' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalAssets' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalNetAssets' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'reserve' },
            // User-specific reads
            ...(userAddress ? [
                { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'lockedProceeds', args: [userAddress] },
                { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'balanceOf', args: [userAddress] },
            ] : []),
        ],
        query: {
            enabled: !!marketAddress,
            refetchInterval: 5000
        }
    });

    const [
        isGraduated,
        graduationThreshold,
        bBase,
        deadline,
        creator,
        isLive,
        feesAccrued,
        outcomeToken,
        totalCreatorDeposit,
        totalLockedProceeds,
        totalSupply,
        totalAssets,
        totalNetAssets,
        ammReserve,
        lockedProceeds,
        userLpBalance
    ] = marketData?.map(r => r.result) || [];

    // Phase 2: Fetch creator's LP balance (separate query since we need creator address first)
    const creatorAddress = creator as `0x${string}` | undefined;
    const { data: creatorLpData } = useReadContracts({
        contracts: creatorAddress ? [
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'balanceOf', args: [creatorAddress] },
        ] : [],
        query: {
            enabled: !!marketAddress && !!creatorAddress,
            refetchInterval: 5000
        }
    });
    const creatorLpBalance = creatorLpData?.[0]?.result as bigint | undefined;

    // Calculate user's LP value: (userLpBalance * totalNetAssets) / totalSupply
    const userLpValue = useMemo(() => {
        const balance = userLpBalance as bigint | undefined;
        const supply = totalSupply as bigint | undefined;
        const netAssets = totalNetAssets as bigint | undefined;
        if (!balance || !supply || supply === 0n || !netAssets) return 0n;
        return (balance * netAssets) / supply;
    }, [userLpBalance, totalSupply, totalNetAssets]);

    // Calculate user's share percent
    const userSharePercent = useMemo(() => {
        const balance = userLpBalance as bigint | undefined;
        const supply = totalSupply as bigint | undefined;
        if (!balance || !supply || supply === 0n) return 0;
        return Number((balance * 10000n) / supply) / 100;
    }, [userLpBalance, totalSupply]);

    // Refetch when transactions succeed
    useEffect(() => {
        if (isGraduateSuccess || isRedeemLPSuccess) {
            refetch();
        }
    }, [isGraduateSuccess, isRedeemLPSuccess, refetch]);

    // Actions
    const graduate = useCallback(() => {
        if (!marketAddress) return;
        graduateWrite({
            address: marketAddress,
            abi: LAUNCHPAD_MARKET_ABI,
            functionName: 'graduate'
        });
    }, [marketAddress, graduateWrite]);

    const expire = useCallback(() => {
        if (!marketAddress) return;
        expireWrite({
            address: marketAddress,
            abi: LAUNCHPAD_MARKET_ABI,
            functionName: 'expire'
        });
    }, [marketAddress, expireWrite]);

    const claimRefund = useCallback(() => {
        if (!marketAddress) return;
        refundWrite({
            address: marketAddress,
            abi: LAUNCHPAD_MARKET_ABI,
            functionName: 'claimCreatorRefund'
        });
    }, [marketAddress, refundWrite]);

    // V6: Redeem LP tokens for USDC (only when market is not live)
    const redeemLP = useCallback((amount: bigint) => {
        if (!marketAddress) return;
        redeemLPWrite({
            address: marketAddress,
            abi: LAUNCHPAD_MARKET_ABI,
            functionName: 'redeemLP',
            args: [amount]
        });
    }, [marketAddress, redeemLPWrite]);

    // V6: Locking actions (via TraderVault, not direct market calls)
    // Note: useLockedProceeds and claimUnlocked are called via TraderVault, not directly on market

    return {
        // Data
        isGraduated: !!isGraduated,
        graduationThreshold: graduationThreshold as bigint | undefined,
        bBase: bBase as bigint | undefined,
        deadline: deadline ? Number(deadline) : undefined,
        creator: creatorAddress,
        isLive: !!isLive,
        feesAccrued: feesAccrued as bigint | undefined,
        outcomeToken: outcomeToken as `0x${string}` | undefined,
        totalCreatorDeposit: totalCreatorDeposit as bigint | undefined,
        // V6: Locking
        totalLockedProceeds: totalLockedProceeds as bigint | undefined,
        lockedProceeds: lockedProceeds as bigint | undefined,
        // V6: LP Token
        totalSupply: totalSupply as bigint | undefined,
        totalAssets: totalAssets as bigint | undefined,
        totalNetAssets: totalNetAssets as bigint | undefined,
        ammReserve: ammReserve as bigint | undefined,
        userLpBalance: userLpBalance as bigint | undefined,
        userLpValue,
        userSharePercent,
        // V6: Creator LP (for leaderboard)
        creatorLpBalance,

        // Actions
        graduate,
        expire,
        claimCreatorRefund: claimRefund,
        redeemLP,

        // Loading/Tx States
        isGraduatePending: isGraduatePending || isGraduateConfirming,
        graduateTxHash,
        isGraduateSuccess,
        isExpirePending,
        expireTxHash,
        isRefundPending,
        refundTxHash,
        isRedeemLPPending: isRedeemLPPending || isRedeemLPConfirming,
        redeemLPTxHash,
        isRedeemLPSuccess,

        refetch
    };
}
