import { useOnChainMarkets } from "./useOnChainMarkets";
import { useMemo } from "react";

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

/**
 * Legacy hook wrapper for V10 on-chain discovery.
 * Replaces the old LaunchpadFactory-based logic with LaunchpadEngine-based logic.
 */
export function useLaunchpadMarkets() {
    const { markets: onChainMarkets, isLoading, refetch, error } = useOnChainMarkets();

    const markets: LaunchpadMarketData[] = useMemo(() => {
        return onChainMarkets.map((m) => ({
            address: m.address,
            name: m.name,
            symbol: m.symbol,
            creator: m.creator,
            isGraduated: m.isGraduated,
            bValue: m.bBase, // Map bBase to bValue
            liquidityB: m.bCurrent, // Map bCurrent to liquidityB
            // createdAt: m.createdAt, // Optional
            chainId: undefined, // Will be filled by the hook or consumer if needed
            // deadline is not in the markets mapping, would need TruthMarket read.
            // For discovery, we can leave it undefined or use a default.
            deadline: 0,
        }));
    }, [onChainMarkets]);

    if (error) {
        console.error("useLaunchpadMarkets discovery error:", error);
    }

    return {
        markets,
        isLoading,
        refetch
    };
}
