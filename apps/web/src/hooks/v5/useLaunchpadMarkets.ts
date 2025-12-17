import { usePublicClient, useReadContract } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { LAUNCHPAD_FACTORY_ABI, LAUNCHPAD_MARKET_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI } from '../../config/abis';
import { useDeployments } from '../useDeployments';
import { decodeEventLog, parseAbiItem } from 'viem';
import { useReadContracts } from 'wagmi';

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
    // 1. Fetch Market Addresses from Factory
    const { data: marketAddresses, refetch } = useReadContract({
        address: factoryAddress,
        abi: LAUNCHPAD_FACTORY_ABI,
        functionName: 'getAllMarkets',
        query: { enabled: !!factoryAddress, refetchInterval: 5000 }
    });


    const addresses = (marketAddresses as `0x${string}`[]) || [];

    // 2. Fetch Market Details (OutcomeToken, Graduated, Deadline)
    const { data: marketData, isLoading: isLoadingMarketData } = useReadContracts({
        contracts: addresses.flatMap(addr => [
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'outcomeToken' },
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isGraduated' },
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'deadline' }
        ]),
        query: { enabled: addresses.length > 0, refetchInterval: 5000 } // Refetch every 5s to catch graduation
    });

    // 3. Extract Token Addresses to fetch Name/Symbol from LaunchpadOutcomeToken
    // LaunchpadOutcomeToken has name/symbol as public state variables, not ERC20 functions
    const tokenCalls = addresses.flatMap((_, i) => {
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
        query: { enabled: !!marketData && addresses.length > 0, refetchInterval: 5000 }
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

    // 4. Transform and Merge
    const markets: LaunchpadMarketData[] = addresses.map((addr, i) => {
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
