import React, { useMemo, useEffect } from 'react';
import { usePublicClient, useReadContract, useChainId } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { LAUNCHPAD_FACTORY_ABI, LAUNCHPAD_MARKET_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI } from '../../config/abis';
import { useDeployments } from '../useDeployments';
import { decodeEventLog, parseAbiItem } from 'viem';
import { useReadContracts } from 'wagmi';

export interface LaunchpadMarketData {
    address: `0x${string}`;
    name: string;
    symbol: string;
    outcomeToken?: `0x${string}`;
    bValue: bigint;
    creator: `0x${string}`;
    // Dynamic data
    isGraduated?: boolean;
    deadline?: number;
    liquidityB?: bigint;
    chainId?: number;
}

export function useLaunchpadMarkets() {
    const { config } = useDeployments();
    const chainId = useChainId(); // Get chainId from wagmi (top-level hook call)
    // @ts-ignore
    const factoryAddress = config?.contracts?.LaunchpadFactory as `0x${string}` | undefined;
    
    // 1. Fetch Market Addresses from Factory
    const { data: marketAddresses, refetch } = useReadContract({
        address: factoryAddress,
        abi: LAUNCHPAD_FACTORY_ABI,
        functionName: 'getAllMarkets',
        query: { enabled: !!factoryAddress, refetchInterval: 30000 } // Reduced frequency to 30s
    });
    
    const addresses = (marketAddresses as `0x${string}`[]) || [];

    // 2. V6 Check: Verify each market is V6 by checking for V6-only functions
    // Always call useMemo hooks - they're hooks themselves and must be called unconditionally
    const v6CheckContracts = useMemo(() => {
        if (!addresses.length) return [];
        return addresses.map(addr => ({
            address: addr,
            abi: LAUNCHPAD_MARKET_ABI,
            functionName: 'totalLockedProceeds' as const // V6-only function
        }));
    }, [addresses]);
    
    const { data: v6CheckData } = useReadContracts({
        contracts: v6CheckContracts,
        query: { enabled: addresses.length > 0 }
    });
    
    // Also check lpVault as backup
    const lpVaultContracts = useMemo(() => {
        if (!addresses.length) return [];
        return addresses.map(addr => ({
            address: addr,
            abi: LAUNCHPAD_MARKET_ABI,
            functionName: 'lpVault' as const
        }));
    }, [addresses]);
    
    const { data: lpVaultData } = useReadContracts({
        contracts: lpVaultContracts,
        query: { enabled: addresses.length > 0 }
    });

    // Filter to only V6 markets
    // V6 markets have totalLockedProceeds() function (V5 don't) AND lpVault() returns address(0)
    const v6MarketAddresses = useMemo(() => {
        if (!addresses.length) return [];
        
        const filtered = addresses.filter((addr, i) => {
            // Primary check: V6 markets have totalLockedProceeds() function
            const v6CheckResult = v6CheckData?.[i];
            if (v6CheckResult?.error) {
                // Function doesn't exist = V5 market
                return false;
            }
            if (v6CheckResult?.result === undefined && v6CheckResult?.status !== 'success') {
                // Still loading or failed
                return false;
            }
            
            // Secondary check: V6 markets have lpVault() returning address(0)
            const lpVaultResult = lpVaultData?.[i];
            if (lpVaultResult?.error) {
                // lpVault() call failed, might be V5
                return false;
            }
            const zeroAddress = '0x0000000000000000000000000000000000000000' as `0x${string}`;
            const lpVault = lpVaultResult?.result as `0x${string}` | undefined;
            if (lpVault && lpVault.toLowerCase() !== zeroAddress.toLowerCase()) {
                // lpVault returns non-zero = V5 market
                return false;
            }
            
            // Both checks passed = V6 market
            return true;
        });
        
        return filtered;
    }, [addresses, v6CheckData, lpVaultData]);

    // 3. Fetch Market Details (OutcomeToken, Graduated, Deadline) - only V6 markets
    const marketDetailContracts = useMemo(() => {
        return v6MarketAddresses.flatMap(addr => [
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'outcomeToken' as const },
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isGraduated' as const },
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'deadline' as const }
        ]);
    }, [v6MarketAddresses]);
    
    const { data: marketData, isLoading: isLoadingMarketData } = useReadContracts({
        contracts: marketDetailContracts,
        query: { enabled: v6MarketAddresses.length > 0, refetchInterval: 20000 } // Refetch every 20s to catch graduation
    });

    // 4. Extract Token Addresses to fetch Name/Symbol from LaunchpadOutcomeToken
    // LaunchpadOutcomeToken has name/symbol as public state variables, not ERC20 functions
    const tokenCalls = useMemo(() => {
        if (!v6MarketAddresses.length || !marketData) return [];
        return v6MarketAddresses.flatMap((_, i) => {
        const tokenAddr = marketData?.[i * 3]?.result as `0x${string}` | undefined;
        // If tokenAddr is valid (non-zero), use it. Else undefined.
        // Flattening 2 calls per market.
        const effectiveAddr = (tokenAddr && tokenAddr !== '0x0000000000000000000000000000000000000000') ? tokenAddr : undefined;
        return [
            { address: effectiveAddr, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'name' },
            { address: effectiveAddr, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'symbol' }
        ];
    });
    }, [v6MarketAddresses, marketData]);

    const { data: tokenData, isLoading: isLoadingTokenData } = useReadContracts({
        contracts: tokenCalls,
        query: { enabled: tokenCalls.length > 0, refetchInterval: 60000 } // Metadata like name/symbol doesn't change
    });

    // 5. Transform and Merge (only V6 markets)
    const markets: LaunchpadMarketData[] = v6MarketAddresses.map((addr, i) => {
        const outcomeTokenAddr = marketData?.[i * 3]?.result as `0x${string}` | undefined;
        const isGraduated = marketData?.[i * 3 + 1]?.result as boolean;
        const deadline = marketData?.[i * 3 + 2]?.result as unknown; // Cast unknown first to be safe

        // Token data - handle loading vs error states
        // If still loading, use empty string to trigger skeleton
        // If loaded but empty/error, use fallback text to avoid stuck loading state
        const nameResult = tokenData?.[i * 2];
        const symbolResult = tokenData?.[i * 2 + 1];

        const name = (nameResult?.result as string) || (isLoadingTokenData ? '' : 'Unknown Market');
        const symbol = (symbolResult?.result as string) || (isLoadingTokenData ? '' : '???');

        return {
            address: addr,
            name: name,
            symbol: symbol,
            outcomeToken: outcomeTokenAddr || '0x0000000000000000000000000000000000000000' as `0x${string}`,
            bValue: 0n,
            creator: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            isGraduated: !!isGraduated,
            deadline: typeof deadline === 'bigint' ? Number(deadline) : Number(deadline || 0),
            chainId: chainId
        };
    }).reverse(); // Show newest first

    return {
        markets,
        isLoading: isLoadingMarketData || isLoadingTokenData,
        refetch
    };
}
