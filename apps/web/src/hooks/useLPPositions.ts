import { useAccount, useReadContracts } from 'wagmi';
import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { LAUNCHPAD_MARKET_ABI } from '../config/abis';
import { useLaunchpadMarkets } from './v5/useLaunchpadMarkets';

export interface LPPosition {
    marketAddress: `0x${string}`;
    marketName: string;
    lpBalance: bigint;
    lpBalanceFormatted: string;
    estimatedValue: bigint;
    estimatedValueFormatted: string;
    totalSupply: bigint;
    sharePercent: number;
    totalAssets: bigint;
    isGraduated: boolean;
    isLive: boolean;
}

export function useLPPositions() {
    const { address: userAddress } = useAccount();
    const { markets, isLoading: marketsLoading } = useLaunchpadMarkets();

    // Build contract calls for all markets
    const lpContracts = useMemo(() => {
        if (!markets?.length || !userAddress) return [];
        
        return markets.flatMap(market => [
            // LP balance
            { address: market.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'balanceOf' as const, args: [userAddress] },
            // Total supply
            { address: market.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalSupply' as const },
            // Total assets (TVL)
            { address: market.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalAssets' as const },
            // isLive
            { address: market.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isLive' as const },
        ]);
    }, [markets, userAddress]);

    const { data: lpData, isLoading: lpDataLoading, refetch } = useReadContracts({
        contracts: lpContracts,
        query: {
            enabled: lpContracts.length > 0,
            refetchInterval: 10000,
        }
    });

    // LP tokens are 18 decimals (ERC20), USDC values are 6 decimals
    const LP_TOKEN_DECIMALS = 18;
    const USDC_DECIMALS = 6;
    
    // Process LP positions
    const positions: LPPosition[] = useMemo(() => {
        if (!markets?.length || !lpData) return [];

        return markets.map((market, i) => {
            const baseIdx = i * 4;
            const lpBalance = (lpData[baseIdx]?.result as bigint) || 0n;
            const totalSupply = (lpData[baseIdx + 1]?.result as bigint) || 0n;
            const totalAssets = (lpData[baseIdx + 2]?.result as bigint) || 0n;
            const isLive = lpData[baseIdx + 3]?.result as boolean;

            // Calculate estimated value: (lpBalance * totalAssets) / totalSupply
            const estimatedValue = totalSupply > 0n
                ? (lpBalance * totalAssets) / totalSupply
                : 0n;

            // Calculate share percent
            const sharePercent = totalSupply > 0n
                ? Number((lpBalance * 10000n) / totalSupply) / 100
                : 0;

            return {
                marketAddress: market.address,
                marketName: market.name || 'Unknown Market',
                lpBalance,
                lpBalanceFormatted: formatUnits(lpBalance, LP_TOKEN_DECIMALS),
                estimatedValue,
                estimatedValueFormatted: formatUnits(estimatedValue, USDC_DECIMALS),
                totalSupply,
                sharePercent,
                totalAssets,
                isGraduated: market.isGraduated || false,
                isLive: !!isLive,
            };
        }).filter(p => p.lpBalance > 0n); // Only show positions with LP tokens
    }, [markets, lpData]);

    // Total LP value across all markets
    const totalLPValue = useMemo(() => {
        return positions.reduce((acc, p) => acc + p.estimatedValue, 0n);
    }, [positions]);

    const totalLPValueFormatted = formatUnits(totalLPValue, USDC_DECIMALS);

    return {
        positions,
        totalLPValue,
        totalLPValueFormatted,
        isLoading: marketsLoading || lpDataLoading,
        refetch,
    };
}
