import { useReadContracts } from "wagmi";
import { useMemo } from "react";
import { V8_ABIS } from "../../config/abis";
import { useChainStore } from "../../store/useChainStore";
import { useDeployments } from "../useDeployments";

/**
 * Hook to fetch AMMEngine state for a market
 * 
 * @param marketAddress - Address of the TruthMarket contract
 * @returns AMM state including quantities, prices, and trade calculations
 */
export function useAmmMarket(marketAddress: `0x${string}` | undefined) {
    const { selectedChainId } = useChainStore();
    const deployments = useDeployments();

    const ammEngineAddress = deployments?.contracts
        ?.AMMEngine as `0x${string}` | undefined;

    const { data, isLoading, error, refetch } = useReadContracts({
        contracts: [
            // Market state (qYes, qNo, b)
            {
                address: ammEngineAddress,
                abi: V8_ABIS.AMMEngine,
                functionName: "getMarketState",
                args: marketAddress ? [marketAddress] : undefined,
                chainId: selectedChainId,
            },
            // YES price
            {
                address: ammEngineAddress,
                abi: V8_ABIS.AMMEngine,
                functionName: "getPrice",
                args: marketAddress ? [marketAddress, 1] : undefined, // 1 = YES
                chainId: selectedChainId,
            },
            // NO price
            {
                address: ammEngineAddress,
                abi: V8_ABIS.AMMEngine,
                functionName: "getPrice",
                args: marketAddress ? [marketAddress, 0] : undefined, // 0 = NO
                chainId: selectedChainId,
            },
        ],
        query: {
            enabled: !!marketAddress && !!ammEngineAddress && !!selectedChainId,
            refetchInterval: 10000, // Refetch every 10s (prices change frequently)
            staleTime: 5000, // Consider data stale after 5s
        },
    });

    const ammData = useMemo(() => {
        if (!data || !marketAddress) return null;

        const [marketStateResult, yesPriceResult, noPriceResult] = data;

        // Check if critical reads failed
        if (marketStateResult.status === "failure") {
            return null;
        }

        // Parse market state struct
        // struct MarketState { int256 qYes; int256 qNo; uint256 b; }
        const marketState = marketStateResult.result as readonly [
            bigint, // qYes
            bigint, // qNo
            bigint  // b
        ];

        const [qYes, qNo, b] = marketState;

        const yesPrice =
            yesPriceResult.status === "success"
                ? (yesPriceResult.result as bigint)
                : 0n;
        const noPrice =
            noPriceResult.status === "success"
                ? (noPriceResult.result as bigint)
                : 0n;

        // Calculate probability (price is in WAD, so divide by 1e18)
        const yesProbability = Number(yesPrice) / 1e18;
        const noProbability = Number(noPrice) / 1e18;

        // Calculate liquidity depth (b parameter)
        const liquidityDepth = Number(b) / 1e18;

        return {
            address: marketAddress,
            qYes,
            qNo,
            b,
            yesPrice,
            noPrice,
            yesProbability,
            noProbability,
            liquidityDepth,
            // Helper flags
            hasLiquidity: b > 0n,
            isBalanced: Math.abs(yesProbability - 0.5) < 0.1, // Within 10% of 50/50
        };
    }, [data, marketAddress]);

    return {
        amm: ammData,
        isLoading,
        error,
        refetch,
    };
}

/**
 * Hook to calculate trade cost for a given trade
 * 
 * @param marketAddress - Address of the TruthMarket contract
 * @param outcome - 0 for NO, 1 for YES
 * @param deltaShares - Amount of shares to trade (positive for buy, negative for sell)
 * @returns Trade cost calculation
 */
export function useAmmTradeCost(
    marketAddress: `0x${string}` | undefined,
    outcome: 0 | 1,
    deltaShares: bigint
) {
    const { selectedChainId } = useChainStore();
    const deployments = useDeployments();

    const ammEngineAddress = deployments?.contracts
        ?.AMMEngine as `0x${string}` | undefined;

    const { data, isLoading, error } = useReadContracts({
        contracts: [
            {
                address: ammEngineAddress,
                abi: V8_ABIS.AMMEngine,
                functionName: "calculateCost",
                args: marketAddress && deltaShares !== 0n
                    ? [marketAddress, outcome, deltaShares]
                    : undefined,
                chainId: selectedChainId,
            },
        ],
        query: {
            enabled: !!marketAddress && !!ammEngineAddress && !!selectedChainId && deltaShares !== 0n,
            refetchInterval: false, // Don't auto-refetch (user-initiated)
            staleTime: 1000, // Consider stale after 1s
        },
    });

    const costData = useMemo(() => {
        if (!data || !marketAddress || deltaShares === 0n) return null;

        const [costResult] = data;

        if (costResult.status === "failure") {
            return null;
        }

        const cost = costResult.result as bigint;

        return {
            cost,
            costUsd: Number(cost) / 1e6, // USDC has 6 decimals
            isBuy: deltaShares > 0n,
            isSell: deltaShares < 0n,
        };
    }, [data, marketAddress, deltaShares]);

    return {
        cost: costData,
        isLoading,
        error,
    };
}

/**
 * Type definitions
 */
export type AmmMarketData = NonNullable<
    ReturnType<typeof useAmmMarket>["amm"]
>;

export type AmmTradeCostData = NonNullable<
    ReturnType<typeof useAmmTradeCost>["cost"]
>;
