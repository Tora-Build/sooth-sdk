import { usePublicClient, useReadContracts } from 'wagmi';
import { useMemo, useState, useEffect } from 'react';
import { LAUNCHPAD_MARKET_ABI, ERC20_ABI } from '../config/abis';
import { parseAbiItem, getAddress } from 'viem';

export interface LPHolder {
    address: `0x${string}`;
    balance: bigint;
}

/**
 * Hook to discover and fetch LP token holders for a Launchpad market
 * Uses Transfer events to find holders, then queries their current balances
 */
export function useLPHolders(marketAddress?: `0x${string}`, creatorAddress?: `0x${string}`) {
    const publicClient = usePublicClient();
    const [holderAddresses, setHolderAddresses] = useState<`0x${string}`[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(false);

    // Fetch Transfer events to discover LP holders
    useEffect(() => {
        if (!marketAddress || !publicClient) return;

        const fetchHolders = async () => {
            setIsLoadingEvents(true);
            try {
                // Get Transfer events (ERC20 standard)
                const currentBlock = await publicClient.getBlockNumber();
                // Base Sepolia often has a 50k block limit for getLogs
                const fromBlock = currentBlock > 40000n ? currentBlock - 40000n : 0n;

                const logs = await publicClient.getLogs({
                    address: marketAddress,
                    event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                    fromBlock,
                    toBlock: 'latest',
                });

                // Extract unique "to" addresses
                const uniqueHolders = new Set<string>();
                
                // Always add creator
                if (creatorAddress) {
                    uniqueHolders.add(creatorAddress.toLowerCase());
                }

                logs.forEach(log => {
                    const to = log.args.to as string;
                    if (to && to !== '0x0000000000000000000000000000000000000000') {
                        uniqueHolders.add(to.toLowerCase());
                    }
                });

                setHolderAddresses(Array.from(uniqueHolders).map(addr => getAddress(addr)));
            } catch (error) {
                console.error('Error fetching LP holders:', error);
                // Fallback: at least show creator
                if (creatorAddress) {
                    setHolderAddresses([getAddress(creatorAddress)]);
                }
            } finally {
                setIsLoadingEvents(false);
            }
        };

        fetchHolders();
    }, [marketAddress, publicClient, creatorAddress]);

    // Build contract calls to fetch balances
    const balanceContracts = useMemo(() => {
        if (!marketAddress || !holderAddresses.length) return [];
        return holderAddresses.map(addr => ({
            address: marketAddress,
            abi: ERC20_ABI, // Use standard ERC20 for better compatibility
            functionName: 'balanceOf' as const,
            args: [addr],
        }));
    }, [marketAddress, holderAddresses]);

    const { data: balanceData, isLoading: isLoadingBalances, refetch } = useReadContracts({
        contracts: balanceContracts,
        query: {
            enabled: balanceContracts.length > 0,
            refetchInterval: 10000,
        }
    });

    // Combine addresses with balances, filter out zero balances, sort by balance
    const holders: LPHolder[] = useMemo(() => {
        if (!balanceData) return [];
        
        return holderAddresses
            .map((addr, i) => ({
                address: addr,
                balance: (balanceData[i]?.result as bigint) || 0n,
            }))
            .filter(h => h.balance > 0n)
            .sort((a, b) => (b.balance > a.balance ? 1 : -1)); // Descending by balance
    }, [holderAddresses, balanceData]);

    return {
        holders,
        isLoading: isLoadingEvents || isLoadingBalances,
        refetch,
    };
}
