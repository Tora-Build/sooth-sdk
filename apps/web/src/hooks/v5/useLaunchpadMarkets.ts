import { usePublicClient, useReadContract } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { LAUNCHPAD_FACTORY_ABI, LAUNCHPAD_MARKET_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI } from '../../config/abis';
import { useDeployments } from '../useDeployments';
import { decodeEventLog, parseAbiItem } from 'viem';
import { useReadContracts } from 'wagmi';
import { useMemo } from 'react';

export interface LaunchpadMarketData {
    address: `0x${string}`;
    name: string;
    symbol: string;
    bValue: bigint;
    creator: `0x${string}`;
    // Dynamic data
    isGraduated?: boolean;
    deadline?: number;
    liquidityB?: bigint;
}

export function useLaunchpadMarkets() {
    const { config } = useDeployments();
    // @ts-ignore
    const factoryAddress = config?.contracts?.LaunchpadFactory as `0x${string}` | undefined;
    
    // V6 Check: Verify factory has protocolConfig (V6 factories have this, V5 don't)
    const { data: protocolConfigAddress } = useReadContract({
        address: factoryAddress,
        abi: LAUNCHPAD_FACTORY_ABI,
        functionName: 'protocolConfig',
        query: { enabled: !!factoryAddress }
    });
    
    const isV6Factory = useMemo(() => {
        return !!protocolConfigAddress && protocolConfigAddress !== '0x0000000000000000000000000000000000000000';
    }, [protocolConfigAddress]);
    
    // 1. Fetch Market Addresses from Factory (only if V6 factory)
    const { data: marketAddresses, refetch } = useReadContract({
        address: factoryAddress,
        abi: LAUNCHPAD_FACTORY_ABI,
        functionName: 'getAllMarkets',
        query: { enabled: !!factoryAddress && isV6Factory, refetchInterval: 5000 }
    });


    const addresses = (marketAddresses as `0x${string}`[]) || [];

    // 2. Fetch Market Factory Address (to verify V6)
    const { data: marketFactoriesData } = useReadContracts({
        contracts: addresses.map(addr => ({
            address: addr,
            abi: LAUNCHPAD_MARKET_ABI,
            functionName: 'factory'
        })),
        query: { enabled: addresses.length > 0 && isV6Factory }
    });

    // 3. Filter to only V6 markets (markets whose factory has protocolConfig)
    const v6MarketAddresses = useMemo(() => {
        if (!marketFactoriesData || !addresses.length) return [];
        return addresses.filter((addr, i) => {
            const marketFactory = marketFactoriesData[i]?.result as `0x${string}` | undefined;
            // Only include markets from the configured V6 factory
            return marketFactory && marketFactory.toLowerCase() === factoryAddress?.toLowerCase();
        });
    }, [addresses, marketFactoriesData, factoryAddress]);

    // 4. Fetch Market Details (OutcomeToken, Graduated, Deadline) - only for V6 markets
    const { data: marketData, isLoading: isLoadingMarketData } = useReadContracts({
        contracts: v6MarketAddresses.flatMap(addr => [
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'outcomeToken' },
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isGraduated' },
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'deadline' }
        ]),
        query: { enabled: v6MarketAddresses.length > 0, refetchInterval: 5000 } // Refetch every 5s to catch graduation
    });

    // 5. Extract Token Addresses to fetch Name/Symbol from LaunchpadOutcomeToken
    // LaunchpadOutcomeToken has name/symbol as public state variables, not ERC20 functions
    const tokenCalls = v6MarketAddresses.flatMap((_, i) => {
        const tokenAddr = marketData?.[i * 3]?.result as `0x${string}` | undefined;
        // If tokenAddr is valid (non-zero), use it. Else undefined.
        // Flattening 2 calls per market.
        const effectiveAddr = (tokenAddr && tokenAddr !== '0x0000000000000000000000000000000000000000') ? tokenAddr : undefined;
        return [
            { address: effectiveAddr, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'name' },
            { address: effectiveAddr, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'symbol' }
        ];
    });

    const { data: tokenData, isLoading: isLoadingTokenData } = useReadContracts({
        contracts: tokenCalls,
        query: { enabled: !!marketData && v6MarketAddresses.length > 0, refetchInterval: 5000 }
    });

    // DEBUG: Log token data status (commented out for production)
    // console.log('[useLaunchpadMarkets] addresses:', addresses.length);
    // console.log('[useLaunchpadMarkets] marketData:', marketData?.map((m, i) => ({
    //     idx: i,
    //     fn: i % 3 === 0 ? 'outcomeToken' : i % 3 === 1 ? 'isGraduated' : 'deadline',
    //     result: m.result
    // })));
    // console.log('[useLaunchpadMarkets] tokenData:', tokenData?.map((t, i) => ({
    //     idx: i,
    //     fn: i % 2 === 0 ? 'name' : 'symbol',
    //     result: t.result,
    //     error: t.error
    // })));

    // 6. Transform and Merge (only V6 markets)
    const markets: LaunchpadMarketData[] = v6MarketAddresses.map((addr, i) => {
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
            bValue: 0n,
            creator: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            isGraduated: !!isGraduated,
            deadline: typeof deadline === 'bigint' ? Number(deadline) : Number(deadline || 0)
        };
    }).reverse(); // Show newest first

    return {
        markets,
        isLoading: isLoadingMarketData || isLoadingTokenData,
        refetch
    };
}
