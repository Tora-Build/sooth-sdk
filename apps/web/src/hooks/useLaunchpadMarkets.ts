import React, { useMemo, useEffect } from 'react';
import { usePublicClient, useReadContract } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { LAUNCHPAD_FACTORY_ABI, LAUNCHPAD_MARKET_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { decodeEventLog, parseAbiItem } from 'viem';
import { useReadContracts } from 'wagmi';
import { useChainStore } from '../store/useChainStore';

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
    const { selectedChainId } = useChainStore();
    const chainId = typeof selectedChainId === 'number' ? selectedChainId : undefined;
    // @ts-ignore
    const factoryAddress = config?.contracts?.LaunchpadFactory as `0x${string}` | undefined;
    
    // 1. Fetch Market Addresses from Factory
    const { data: marketAddresses, refetch } = useReadContract({
        address: factoryAddress,
        abi: LAUNCHPAD_FACTORY_ABI,
        functionName: 'getAllMarkets',
        chainId,
        query: { enabled: !!factoryAddress && !!chainId, refetchInterval: 30000 }
    });
    
    const addresses = (marketAddresses as `0x${string}`[]) || [];

    // 2. Combined V7 Check + Market Details
    const combinedContracts = useMemo(() => {
        if (!addresses.length) return [];
        return addresses.flatMap(addr => [
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'outcomeToken' as const, chainId },
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isGraduated' as const, chainId },
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'deadline' as const, chainId },
            { address: addr, abi: LAUNCHPAD_MARKET_ABI, functionName: 'adjudicator' as const, chainId }
        ]);
    }, [addresses, chainId]);
    
    const { data: combinedData, isLoading: isLoadingCombined } = useReadContracts({
        contracts: combinedContracts,
        query: { enabled: addresses.length > 0 && !!chainId, refetchInterval: 30000 }
    });

    // Extract details for V7 markets
    const v7Markets = useMemo(() => {
        if (!addresses.length || !combinedData) return [];
        
        return addresses.map((addr, i) => {
            const baseIdx = i * 4;
            const outcomeTokenResult = combinedData[baseIdx];
            const isGraduatedResult = combinedData[baseIdx + 1];
            const deadlineResult = combinedData[baseIdx + 2];
            const adjudicatorResult = combinedData[baseIdx + 3];

            // If we can't even get the outcome token, it's probably not a valid V7 market
            if (!outcomeTokenResult?.result || outcomeTokenResult.error) return null;

            return {
                address: addr,
                outcomeToken: outcomeTokenResult.result as `0x${string}`,
                isGraduated: !!isGraduatedResult?.result,
                deadline: Number(deadlineResult?.result || 0),
                adjudicator: adjudicatorResult?.result as `0x${string}`
            };
        }).filter((m): m is NonNullable<typeof m> => m !== null);
    }, [addresses, combinedData]);

    const v7MarketAddresses = useMemo(() => v7Markets.map(m => m.address), [v7Markets]);

    // 3. Extract Token Addresses to fetch Name/Symbol from LaunchpadOutcomeToken
    const tokenCalls = useMemo(() => {
        if (!v7Markets.length) return [];
        return v7Markets.flatMap(m => {
            const tokenAddr = m.outcomeToken;
            const effectiveAddr = (tokenAddr && tokenAddr !== '0x0000000000000000000000000000000000000000') ? tokenAddr : undefined;
            return [
                { address: effectiveAddr, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'name', chainId },
                { address: effectiveAddr, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'symbol', chainId }
            ];
        });
    }, [v7Markets, chainId]);

    const { data: tokenData, isLoading: isLoadingTokenData } = useReadContracts({
        contracts: tokenCalls,
        query: { enabled: tokenCalls.length > 0 && !!chainId, refetchInterval: 60000 }
    });

    // 4. Transform and Merge
    const markets: LaunchpadMarketData[] = useMemo(() => {
        return v7Markets.map((m, i) => {
            const nameResult = tokenData?.[i * 2];
            const symbolResult = tokenData?.[i * 2 + 1];

            const name = (nameResult?.result as string) || (isLoadingTokenData ? '' : 'Unknown Market');
            const symbol = (symbolResult?.result as string) || (isLoadingTokenData ? '' : '???');

            return {
                ...m,
                name: name,
                symbol: symbol,
                bValue: 0n,
                creator: '0x0000000000000000000000000000000000000000' as `0x${string}`,
                chainId: chainId
            };
        }).reverse();
    }, [v7Markets, tokenData, isLoadingTokenData, chainId]);

    return {
        markets,
        isLoading: (isLoadingCombined || isLoadingTokenData) && markets.length === 0,
        refetch
    };
}
