import { useReadContract, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { V8_ABIS } from '../../config/abis';

export interface LockEntry {
    amount: bigint;
    expiry: bigint;
    market: `0x${string}`;
    amountFormatted: string;
    expiryDate: Date;
    isUnlocked: boolean;
    timeUntilUnlock: number; // milliseconds
}

export interface LockQueueData {
    entries: LockEntry[];
    totalLocked: bigint;
    totalLockedFormatted: string;
    unlockedCount: number;
    lockedCount: number;
    isLoading: boolean;
    error: Error | null;
}

/**
 * Hook to fetch the full lock queue for the user
 */
export function useLockQueue(
    ammEngineAddress: `0x${string}` | undefined
): LockQueueData {
    const { address } = useAccount();

    const { data, isLoading, error } = useReadContract({
        address: ammEngineAddress,
        abi: V8_ABIS.AMMEngine,
        functionName: 'getLockQueue',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address && !!ammEngineAddress,
            refetchInterval: 15000,
        },
    });

    const now = Date.now();
    const rawEntries = (data as Array<{ amount: bigint; expiry: bigint; market: `0x${string}` }>) ?? [];

    const entries: LockEntry[] = rawEntries.map((entry) => {
        const expiryMs = Number(entry.expiry) * 1000;
        const isUnlocked = now >= expiryMs;
        const timeUntilUnlock = Math.max(0, expiryMs - now);

        return {
            amount: entry.amount,
            expiry: entry.expiry,
            market: entry.market,
            amountFormatted: formatUnits(entry.amount, 18),
            expiryDate: new Date(expiryMs),
            isUnlocked,
            timeUntilUnlock,
        };
    });

    const totalLocked = Array.isArray(entries) ? entries.reduce((sum, entry) => sum + entry.amount, 0n) : 0n;
    const unlockedCount = entries.filter((e) => e.isUnlocked).length;
    const lockedCount = entries.length - unlockedCount;

    return {
        entries,
        totalLocked,
        totalLockedFormatted: formatUnits(totalLocked, 18),
        unlockedCount,
        lockedCount,
        isLoading,
        error: error as Error | null,
    };
}
