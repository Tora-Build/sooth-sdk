import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LAUNCHPAD_MARKET_ABI } from '../../config/abis';
import { useAccount } from 'wagmi';
import { useCallback, useEffect } from 'react';

export function useLaunchpadMarket(marketAddress?: `0x${string}`) {
    const { address: userAddress } = useAccount();

    // Writes
    const { writeContract: graduateWrite, data: graduateTxHash, isPending: isGraduatePending } = useWriteContract();
    const { writeContract: expireWrite, data: expireTxHash, isPending: isExpirePending } = useWriteContract();
    const { writeContract: refundWrite, data: refundTxHash, isPending: isRefundPending } = useWriteContract();

    // Wait for graduation transaction
    const { isLoading: isGraduateConfirming, isSuccess: isGraduateSuccess } = useWaitForTransactionReceipt({
        hash: graduateTxHash,
    });

    // Reads
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
            // V6: Locking
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalLockedProceeds' },
            ...(userAddress ? [{ address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'lockedProceeds', args: [userAddress] }] : []),
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
        totalLockedProceeds,
        lockedProceeds
    ] = marketData?.map(r => r.result) || [];

    // Refetch when graduation transaction succeeds
    useEffect(() => {
        if (isGraduateSuccess) {
            refetch();
        }
    }, [isGraduateSuccess, refetch]);

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

    // V6: Locking actions (via TraderVault, not direct market calls)
    // Note: useLockedProceeds and claimUnlocked are called via TraderVault, not directly on market

    return {
        // Data
        isGraduated: !!isGraduated,
        graduationThreshold: graduationThreshold as bigint | undefined,
        bBase: bBase as bigint | undefined,
        deadline: deadline ? Number(deadline) : undefined,
        creator: creator as `0x${string}` | undefined,
        isLive: !!isLive,
        feesAccrued: feesAccrued as bigint | undefined,
        outcomeToken: outcomeToken as `0x${string}` | undefined,
        // V6: Locking
        totalLockedProceeds: totalLockedProceeds as bigint | undefined,
        lockedProceeds: lockedProceeds as bigint | undefined,

        // Actions
        graduate,
        expire,
        claimCreatorRefund: claimRefund,

        // Loading/Tx States
        isGraduatePending: isGraduatePending || isGraduateConfirming,
        graduateTxHash,
        isGraduateSuccess,
        isExpirePending,
        expireTxHash,
        isRefundPending,
        refundTxHash,

        refetch
    };
}
