import { useReadContracts } from "wagmi";
import { useMemo } from "react";
import { V8_ABIS } from "../../config/abis";
import { useChainStore } from "../../store/useChainStore";
import { useDeployments } from "../useDeployments";
import { useAccount } from "wagmi";
import { ERC20_ABI } from "../../config/abis";

/**
 * Hook to fetch Collateralizer state for a market
 * 
 * @param marketAddress - Address of the TruthMarket contract
 * @returns Collateralizer data including outcome tokens and balances
 */
export function useCollateralizer(marketAddress: `0x${string}` | undefined) {
    const { selectedChainId } = useChainStore();
    const { address: userAddress } = useAccount();
    const deployments = useDeployments();

    const collateralizerAddress = deployments?.contracts
        ?.Collateralizer as `0x${string}` | undefined;

    const { data, isLoading, error, refetch } = useReadContracts({
        contracts: [
            // Get outcome tokens
            {
                address: collateralizerAddress,
                abi: V8_ABIS.Collateralizer,
                functionName: "getOutcomeTokens",
                args: marketAddress ? [marketAddress] : undefined,
                chainId: selectedChainId,
            },
            // Get user balances (if connected)
            {
                address: collateralizerAddress,
                abi: V8_ABIS.Collateralizer,
                functionName: "getBalances",
                args: marketAddress && userAddress ? [marketAddress, userAddress] : undefined,
                chainId: selectedChainId,
            },
            // Get total collateral
            {
                address: collateralizerAddress,
                abi: V8_ABIS.Collateralizer,
                functionName: "getTotalCollateral",
                args: marketAddress ? [marketAddress] : undefined,
                chainId: selectedChainId,
            },
        ],
        query: {
            enabled: !!marketAddress && !!collateralizerAddress && !!selectedChainId,
            refetchInterval: 30000, // Refetch every 30s
            staleTime: 10000, // Consider data stale after 10s
        },
    });

    const collateralizerData = useMemo(() => {
        if (!data || !marketAddress) return null;

        const [tokensResult, balancesResult, totalCollateralResult] = data;

        // Check if critical reads failed
        if (tokensResult.status === "failure") {
            return null;
        }

        // Parse outcome tokens
        const tokens = tokensResult.result as readonly [`0x${string}`, `0x${string}`];
        const [yesToken, noToken] = tokens;

        // Parse user balances
        const balances =
            balancesResult.status === "success"
                ? (balancesResult.result as readonly [bigint, bigint])
                : [0n, 0n];
        const [yesBalance, noBalance] = balances;

        // Parse total collateral
        const totalCollateral =
            totalCollateralResult.status === "success"
                ? (totalCollateralResult.result as bigint)
                : 0n;

        // Calculate user's total position value (min of YES and NO)
        const completeSetBalance = yesBalance < noBalance ? yesBalance : noBalance;

        return {
            address: marketAddress,
            yesToken,
            noToken,
            yesBalance,
            noBalance,
            totalCollateral,
            completeSetBalance,
            // Helper flags
            hasYesTokens: yesBalance > 0n,
            hasNoTokens: noBalance > 0n,
            hasCompleteSets: completeSetBalance > 0n,
            canMerge: completeSetBalance > 0n,
        };
    }, [data, marketAddress]);

    return {
        collateralizer: collateralizerData,
        isLoading,
        error,
        refetch,
    };
}

/**
 * Hook to fetch outcome token metadata
 * 
 * @param tokenAddress - Address of the OutcomeToken contract
 * @returns Token metadata including name and symbol
 */
export function useOutcomeToken(tokenAddress: `0x${string}` | undefined) {
    const { selectedChainId } = useChainStore();

    const { data, isLoading, error } = useReadContracts({
        contracts: [
            {
                address: tokenAddress,
                abi: V8_ABIS.OutcomeToken,
                functionName: "name",
                chainId: selectedChainId,
            },
            {
                address: tokenAddress,
                abi: V8_ABIS.OutcomeToken,
                functionName: "symbol",
                chainId: selectedChainId,
            },
            {
                address: tokenAddress,
                abi: V8_ABIS.OutcomeToken,
                functionName: "market",
                chainId: selectedChainId,
            },
        ],
        query: {
            enabled: !!tokenAddress && !!selectedChainId,
            refetchInterval: false, // Metadata doesn't change
            staleTime: Infinity,
        },
    });

    const tokenData = useMemo(() => {
        if (!data || !tokenAddress) return null;

        const [nameResult, symbolResult, marketResult] = data;

        if (
            nameResult.status === "failure" ||
            symbolResult.status === "failure"
        ) {
            return null;
        }

        const name = nameResult.result as string;
        const symbol = symbolResult.result as string;
        const market =
            marketResult.status === "success"
                ? (marketResult.result as `0x${string}`)
                : undefined;

        return {
            address: tokenAddress,
            name,
            symbol,
            market,
        };
    }, [data, tokenAddress]);

    return {
        token: tokenData,
        isLoading,
        error,
    };
}

/**
 * Type definitions
 */
export type CollateralizerData = NonNullable<
    ReturnType<typeof useCollateralizer>["collateralizer"]
>;

export type OutcomeTokenData = NonNullable<
    ReturnType<typeof useOutcomeToken>["token"]
>;
