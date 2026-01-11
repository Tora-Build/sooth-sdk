import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useChainId } from 'wagmi';
import { useState, useCallback, useMemo } from 'react';
import { TRADER_VAULT_V4_ABI, LAUNCHPAD_MARKET_ABI, ERC20_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useLaunchpadMarkets } from './useLaunchpadMarkets';
import { formatUnits } from 'viem';
import { getPollingInterval } from '../lib/polling';
import toast from 'react-hot-toast';

export interface UseLockedFundsResult {
    // Raw values (wei)
    locked: bigint;
    claimable: bigint;
    available: bigint;
    pending: bigint;
    total: bigint;
    vaultLocked: bigint;
    marketLocked: bigint;
    decimals: number;

    // State
    nextUnlockAmount: bigint;
    nextUnlockTimestamp: number;
    entries: LockEntry[];

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

export interface LockEntry {
    amount: bigint;
    unlockTime: number;
    isClaimable: boolean;
    timeRemaining: number;
    marketAddress?: `0x${string}`;
    marketName?: string;
}

export function useLockedFunds(): UseLockedFundsResult {
    const { address } = useAccount();
    const { config } = useDeployments();
    const chainId = useChainId();
    const contracts = config.contracts;
    const [isClaiming, setIsClaiming] = useState(false);
    const publicClient = usePublicClient({ chainId });

    const traderVault = contracts?.SoothTraderVault as `0x${string}` | undefined;
    const { markets, isLoading: marketsLoading } = useLaunchpadMarkets();

    const uniqueMarkets = useMemo(() => {
        const list: { address: `0x${string}`, name: string }[] = [];
        const seen = new Set<string>();

        if (markets) {
            markets.forEach(m => {
                if (m.address && !seen.has(m.address.toLowerCase())) {
                    seen.add(m.address.toLowerCase());
                    list.push({ address: m.address, name: m.name });
                }
            });
        }

        return list;
    }, [markets]);

    // 2. Build contract calls
    const lockContracts = useMemo(() => {
        if (!address) return [];
        
        const calls: any[] = [];
        
        // TraderVault calls (Global / Legacy)
        if (traderVault) {
            calls.push(
                { address: traderVault, abi: TRADER_VAULT_V4_ABI, functionName: 'lockedBalance', args: [address], chainId },
                { address: traderVault, abi: TRADER_VAULT_V4_ABI, functionName: 'claimableBalance', args: [address], chainId },
                { address: traderVault, abi: TRADER_VAULT_V4_ABI, functionName: 'availableBalance', args: [address], chainId },
                { address: traderVault, abi: TRADER_VAULT_V4_ABI, functionName: 'pendingBalance', args: [address], chainId },
                { address: traderVault, abi: TRADER_VAULT_V4_ABI, functionName: 'totalBalance', args: [address], chainId },
                { address: traderVault, abi: TRADER_VAULT_V4_ABI, functionName: 'nextUnlock', args: [address], chainId },
                { address: traderVault, abi: TRADER_VAULT_V4_ABI, functionName: 'getLockEntries', args: [address], chainId }
            );
        }

        // Individual Market calls
        uniqueMarkets.forEach(market => {
            calls.push(
                { address: market.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'lockedBalance', args: [address], chainId },
                { address: market.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'claimableBalance', args: [address], chainId },
                { address: market.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'nextUnlock', args: [address], chainId },
                { address: market.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'getLockEntries', args: [address], chainId }
            );
        });

        return calls;
    }, [address, traderVault, uniqueMarkets, chainId]);

    const { data: lockData, isLoading: lockDataLoading, refetch } = useReadContracts({
        contracts: [
            ...lockContracts,
            { address: contracts?.MockUSDC as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals', chainId }
        ],
        query: { 
            enabled: !!address && lockContracts.length > 0 && !!contracts?.MockUSDC,
            refetchInterval: getPollingInterval(chainId, 'slow'),
            staleTime: 10000,
        }
    });

    const { writeContractAsync } = useWriteContract();

    // 3. Aggregate Results
    const aggregated = useMemo(() => {
        let totalLocked = 0n;
        let totalClaimable = 0n;
        let available = 0n;
        let pending = 0n;
        let total = 0n;
        let vaultLocked = 0n;
        let marketLocked = 0n;
        let allEntries: LockEntry[] = [];
        let assetDecimals = 18;
        
        // Basic safety check for array existence and length
        if (!lockData || !address) return { 
            locked: 0n, claimable: 0n, available: 0n, pending: 0n, total: 0n, 
            vaultLocked: 0n, marketLocked: 0n,
            nextUnlockAmount: 0n, nextUnlockTimestamp: 0, entries: [],
            decimals: 18
        };

        // Last entry is decimals
        assetDecimals = Number(lockData[lockData.length - 1]?.result || 6);

        let cursor = 0;
        const now = Math.floor(Date.now() / 1000);

        // Process TraderVault results
        if (traderVault && lockData.length >= 8) {
            vaultLocked = (lockData[cursor++]?.result as bigint) || 0n;
            const vaultClaimable = (lockData[cursor++]?.result as bigint) || 0n;
            available = (lockData[cursor++]?.result as bigint) || 0n;
            pending = (lockData[cursor++]?.result as bigint) || 0n;
            total = (lockData[cursor++]?.result as bigint) || 0n;
            
            totalLocked += vaultLocked;
            totalClaimable += vaultClaimable;
            
            // Skip Next Unlock result
            cursor++;
            
            // Entries
            const entriesRes = lockData[cursor++]?.result as [bigint[], bigint[]] | undefined;
            if (entriesRes && Array.isArray(entriesRes[0])) {
                entriesRes[0].forEach((amt, i) => {
                    const time = Number(entriesRes[1][i]);
                    allEntries.push({
                        amount: amt,
                        unlockTime: time,
                        isClaimable: time <= now,
                        timeRemaining: Math.max(0, time - now),
                        marketName: 'Global Vault'
                    });
                });
            }
        }

        // Process Market results
        uniqueMarkets.forEach(market => {
            // Check if we have enough data left in array (excluding the decimals entry at the end)
            if (cursor + 4 >= lockData.length) return;

            const mLocked = (lockData[cursor++]?.result as bigint) || 0n;
            const marketClaimable = (lockData[cursor++]?.result as bigint) || 0n;

            // Skip Next Unlock
            cursor++;
            
            const marketEntries = lockData[cursor++]?.result as [bigint[], bigint[]] | undefined;

            totalLocked += mLocked;
            marketLocked += mLocked;
            totalClaimable += marketClaimable;

            if (marketEntries && Array.isArray(marketEntries[0])) {
                marketEntries[0].forEach((amt, i) => {
                    const time = Number(marketEntries[1][i]);
                    allEntries.push({
                        amount: amt,
                        unlockTime: time,
                        isClaimable: time <= now,
                        timeRemaining: Math.max(0, time - now),
                        marketAddress: market.address,
                        marketName: market.name
                    });
                });
            }
        });

        // Final sort and find next unlock
        allEntries.sort((a, b) => a.unlockTime - b.unlockTime);
        const nextEntry = allEntries.find(e => !e.isClaimable);

        // Adjusted total balance: Vault (Available+Pending) + All Locked Proceeds (Vault + Market)
        return {
            locked: totalLocked,
            claimable: totalClaimable,
            available,
            pending,
            total: total + vaultLocked + marketLocked,
            vaultLocked,
            marketLocked,
            nextUnlockAmount: nextEntry?.amount || 0n,
            nextUnlockTimestamp: nextEntry?.unlockTime || 0,
            entries: allEntries,
            decimals: assetDecimals
        };
    }, [lockData, address, traderVault, uniqueMarkets]);

    // 4. Claim Action (Aggregated)
    const claim = useCallback(async () => {
        if (!address || !publicClient || !traderVault) return;
        setIsClaiming(true);

        const toastId = toast.loading('Claiming unlocked proceeds...');
        try {
            // Find all targets with claimable funds
            const targets: { address: `0x${string}`, name: string, isGlobal: boolean }[] = [];
            
            // Check TraderVault (Global)
            const tvClaimable = aggregated.entries
                .filter(e => e.marketName === 'Global Vault' && e.isClaimable)
                .reduce((sum, e) => sum + e.amount, 0n);
            
            if (tvClaimable > 0n) {
                targets.push({ address: traderVault, name: 'Global Vault', isGlobal: true });
            }

            // Check Markets
            uniqueMarkets.forEach(market => {
                const mClaimable = aggregated.entries
                    .filter(e => e.marketAddress === market.address && e.isClaimable)
                    .reduce((sum, e) => sum + e.amount, 0n);
                
                if (mClaimable > 0n) {
                    targets.push({ address: market.address, name: market.name, isGlobal: false });
                }
            });

            if (targets.length === 0) {
                toast.error('Nothing to claim yet', { id: toastId });
                setIsClaiming(false);
                return;
            }

            // Execute claims sequentially via TraderVault
            for (const target of targets) {
                toast.loading(`Claiming from ${target.name}...`, { id: toastId });
                
                const hash = await writeContractAsync({
                    address: traderVault,
                    abi: TRADER_VAULT_V4_ABI,
                    functionName: 'claimUnlocked',
                    args: target.isGlobal ? [] : [target.address],
                });
                await publicClient.waitForTransactionReceipt({ hash });
            }

            toast.success('All claimable proceeds collected!', { id: toastId });
            setTimeout(() => refetch(), 2000);
        } catch (error: any) {
            console.error('Claim failed:', error);
            toast.error(error.message?.split('\n')[0] || 'Claim failed', { id: toastId });
        } finally {
            setIsClaiming(false);
        }
    }, [address, traderVault, uniqueMarkets, aggregated.entries, writeContractAsync, publicClient, refetch]);

    // Format values using dynamic decimals
    const formatUSD = (value: bigint) => {
        const num = parseFloat(formatUnits(value, aggregated.decimals));
        return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    const lockedFormatted = formatUSD(aggregated.locked);
    const claimableFormatted = formatUSD(aggregated.claimable);
    const availableFormatted = formatUSD(aggregated.available);
    const pendingFormatted = formatUSD(aggregated.pending);
    const totalFormatted = formatUSD(aggregated.total);
    const nextUnlockFormatted = formatUSD(aggregated.nextUnlockAmount);
    
    const nowSeconds = Math.floor(Date.now() / 1000);
    const secondsRemaining = Math.max(0, aggregated.nextUnlockTimestamp - nowSeconds);
    const timeRemaining = secondsRemaining <= 0 ? 'Ready' : 
        `${Math.floor(secondsRemaining / 3600)}h ${Math.floor((secondsRemaining % 3600) / 60)}m`;

    return useMemo(() => ({
        ...aggregated,
        lockedFormatted,
        claimableFormatted,
        availableFormatted,
        pendingFormatted,
        totalFormatted,
        nextUnlockFormatted,
        timeRemaining,
        isLoading: marketsLoading || lockDataLoading,
        isClaiming,
        hasClaimable: aggregated.claimable > 0n,
        claim,
        refetch,
    }), [
        aggregated, lockedFormatted, claimableFormatted, availableFormatted, 
        pendingFormatted, totalFormatted, nextUnlockFormatted, timeRemaining,
        marketsLoading, lockDataLoading, isClaiming, claim, refetch
    ]);
}
