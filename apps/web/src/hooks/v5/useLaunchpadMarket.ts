import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LAUNCHPAD_MARKET_ABI } from '../../config/abis';
import { useAccount } from 'wagmi';
import { useCallback } from 'react';

export function useLaunchpadMarket(marketAddress?: `0x${string}`) {
    const { address: userAddress } = useAccount();

    // Writes
    const { writeContract: graduateWrite, data: graduateTxHash, isPending: isGraduatePending } = useWriteContract();
    const { writeContract: expireWrite, data: expireTxHash, isPending: isExpirePending } = useWriteContract();
    const { writeContract: refundWrite, data: refundTxHash, isPending: isRefundPending } = useWriteContract();

    // Reads
    const { data: marketData, refetch } = useReadContracts({
        contracts: [
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isGraduated' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'graduationThreshold' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'bBase' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'deadline' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'creator' },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isLive' },
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
        isLive
    ] = marketData?.map(r => r.result) || [];

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
            functionName: 'claimRefund'
        });
    }, [marketAddress, refundWrite]);

    return {
        // Data
        isGraduated: !!isGraduated,
        graduationThreshold: graduationThreshold as bigint | undefined,
        bBase: bBase as bigint | undefined,
        deadline: deadline ? Number(deadline) : undefined,
        creator: creator as `0x${string}` | undefined,
        isLive: !!isLive,

        // Actions
        graduate,
        expire,
        claimRefund,

        // Loading/Tx States
        isGraduatePending,
        graduateTxHash,
        isExpirePending,
        expireTxHash,
        isRefundPending,
        refundTxHash,

        refetch
    };
}
