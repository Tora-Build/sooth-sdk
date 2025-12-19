import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useState, useCallback, useMemo } from 'react';
import { TRADER_VAULT_V4_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { formatUnits } from 'viem';

export interface UseLockedFundsResult {
    // Raw values (wei)
    locked: bigint;
    claimable: bigint;
    available: bigint;
    pending: bigint;
    total: bigint;

    // State
    nextUnlockAmount: bigint;
    nextUnlockTimestamp: number;

    // Formatted values (USD string)
    lockedFormatted: string;
    claimableFormatted: string;
    availableFormatted: string;
    pendingFormatted: string;
    totalFormatted: string;
    nextUnlockFormatted: string;
    timeRemaining: string;

    // State
    isLoading: boolean;
    isClaiming: boolean;
    hasClaimable: boolean;

    // Action
    claim: () => Promise<void>;
    refetch: () => void;
}

export function useLockedFunds(): UseLockedFundsResult {
    const { address } = useAccount();
    const { config } = useDeployments();
    const contracts = config.contracts;
    const [isClaiming, setIsClaiming] = useState(false);

    const traderVault = contracts?.SoothTraderVault as `0x${string}` | undefined;

    // Fetch locked balance
    const { data: lockedData, isLoading: lockedLoading, refetch: refetchLocked } = useReadContract({
        address: traderVault,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'lockedBalance',
        args: address ? [address] : undefined,
        query: { enabled: !!address && !!traderVault },
    });

    // Fetch claimable balance
    const { data: claimableData, isLoading: claimableLoading, refetch: refetchClaimable } = useReadContract({
        address: traderVault,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'claimableBalance',
        args: address ? [address] : undefined,
        query: { enabled: !!address && !!traderVault },
    });

    // Fetch available balance
    const { data: availableData, isLoading: availableLoading, refetch: refetchAvailable } = useReadContract({
        address: traderVault,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'availableBalance',
        args: address ? [address] : undefined,
        query: { enabled: !!address && !!traderVault },
    });

    // Fetch pending balance
    const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useReadContract({
        address: traderVault,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'pendingBalance',
        args: address ? [address] : undefined,
        query: { enabled: !!address && !!traderVault },
    });

    // Fetch total balance
    const { data: totalData, isLoading: totalLoading, refetch: refetchTotal } = useReadContract({
        address: traderVault,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'totalBalance',
        args: address ? [address] : undefined,
        query: { enabled: !!address && !!traderVault },
    });

    // Fetch next unlock (amount, timestamp)
    const { data: nextUnlockData, refetch: refetchUnlock } = useReadContract({
        address: traderVault,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'nextUnlock',
        args: address ? [address] : undefined,
        query: { enabled: !!address && !!traderVault },
    });

    // Claim transaction
    const { writeContractAsync, data: claimTxHash } = useWriteContract();

    const { isLoading: isConfirming } = useWaitForTransactionReceipt({
        hash: claimTxHash,
    });

    // Parse values
    const locked = (lockedData as bigint) ?? 0n;
    const claimable = (claimableData as bigint) ?? 0n;
    const available = (availableData as bigint) ?? 0n;
    const pending = (pendingData as bigint) ?? 0n;
    const total = (totalData as bigint) ?? 0n;

    // Parse Next Unlock
    const nextUnlockAmount = nextUnlockData ? (nextUnlockData as [bigint, bigint])[0] : 0n;
    const nextUnlockTimestamp = nextUnlockData ? Number((nextUnlockData as [bigint, bigint])[1]) : 0;

    // Calculate time remaining
    const nowSeconds = Math.floor(Date.now() / 1000);
    const secondsRemaining = Math.max(0, nextUnlockTimestamp - nowSeconds);

    const formatTimeRemaining = () => {
        if (secondsRemaining <= 0) return 'Ready';
        const hours = Math.floor(secondsRemaining / 3600);
        const minutes = Math.floor((secondsRemaining % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    // Format values (6 decimals for USDC)
    const USDC_DECIMALS = 6;
    const formatUSD = (value: bigint) => {
        const num = parseFloat(formatUnits(value, USDC_DECIMALS));
        return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    const lockedFormatted = formatUSD(locked);
    const claimableFormatted = formatUSD(claimable);
    const availableFormatted = formatUSD(available);
    const pendingFormatted = formatUSD(pending);
    const totalFormatted = formatUSD(total);
    const nextUnlockFormatted = formatUSD(nextUnlockAmount);
    const timeRemaining = formatTimeRemaining();

    const hasClaimable = claimable > 0n;
    const isLoading = lockedLoading || claimableLoading || availableLoading || pendingLoading || totalLoading;

    // Refetch all balances
    const refetch = useCallback(() => {
        refetchLocked();
        refetchClaimable();
        refetchAvailable();
        refetchPending();
        refetchTotal();
        refetchUnlock();
    }, [refetchLocked, refetchClaimable, refetchAvailable, refetchPending, refetchTotal, refetchUnlock]);

    // Claim action
    const claim = useCallback(async () => {
        if (!traderVault || !address) return;

        setIsClaiming(true);
        try {
            await writeContractAsync({
                address: traderVault,
                abi: TRADER_VAULT_V4_ABI,
                functionName: 'claimUnlocked',
            });
            // Refetch after successful claim
            setTimeout(() => refetch(), 2000);
        } catch (error) {
            console.error('Claim failed:', error);
            throw error;
        } finally {
            setIsClaiming(false);
        }
    }, [traderVault, address, writeContractAsync, refetch]);

    return useMemo(() => ({
        locked,
        claimable,
        available,
        pending,
        total,
        nextUnlockAmount,
        nextUnlockTimestamp,
        lockedFormatted,
        claimableFormatted,
        availableFormatted,
        pendingFormatted,
        totalFormatted,
        nextUnlockFormatted,
        timeRemaining,
        isLoading,
        isClaiming: isClaiming || isConfirming,
        hasClaimable,
        claim,
        refetch,
    }), [
        locked, claimable, available, pending, total, nextUnlockAmount, nextUnlockTimestamp,
        lockedFormatted, claimableFormatted, availableFormatted, pendingFormatted, totalFormatted, nextUnlockFormatted, timeRemaining,
        isLoading, isClaiming, isConfirming, hasClaimable, claim, refetch
    ]);
}
