import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { V9_ABIS } from "../config/abis";
import { useDirectRead, readContractSafe } from "./useDirectRead";

type Address = `0x${string}`;

export interface OnChainMarket {
  address: Address;
  name: string;
  symbol: string;
  creator: Address;
  isGraduated: boolean;
  createdAt: bigint;
  bBase: bigint;
  bCurrent: bigint;
}

/**
 * Hook to fetch all markets from LaunchpadEngine on-chain
 *
 * This replaces the static markets.json config with dynamic on-chain discovery.
 * Markets are fetched from LaunchpadEngine.getMarkets() and enriched with
 * metadata from the markets mapping.
 */
export function useOnChainMarkets() {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const launchpadEngineAddress = deployments?.contracts?.LaunchpadEngine as Address | undefined;

  const query = useDirectRead({
    queryKey: ["v9", "onChainMarkets", chainId, launchpadEngineAddress],
    enabled: !!chainId && !!launchpadEngineAddress,
    chainId,
    refetchInterval: 30_000, // 30 seconds - markets don't change often
    staleTime: 15_000,
    read: async (client) => {
      // Get all market addresses
      const marketAddresses = await readContractSafe<readonly Address[]>(client, {
        address: launchpadEngineAddress!,
        abi: V9_ABIS.LaunchpadEngine,
        functionName: "getMarkets",
      });

      if (!marketAddresses || marketAddresses.length === 0) {
        return [];
      }

      // Fetch market details in parallel
      const marketDetails = await Promise.all(
        marketAddresses.map(async (marketAddress) => {
          try {
            const marketsMapping = await readContractSafe<
              readonly [
                Address, // creator
                bigint,  // bBase
                bigint,  // bCurrent
                bigint,  // creatorDeposit
                bigint,  // feesAccrued
                bigint,  // totalLPSupply
                bigint,  // lpYieldPool
                boolean, // isGraduated
                bigint,  // createdAt (uint64)
                bigint,  // graduatedAt (uint64)
                string,  // name
                string   // symbol
              ]
            >(client, {
              address: launchpadEngineAddress!,
              abi: V9_ABIS.LaunchpadEngine,
              functionName: "markets",
              args: [marketAddress],
            });

            const [
              creator,
              bBase,
              bCurrent,
              _creatorDeposit,
              _feesAccrued,
              _totalLPSupply,
              _lpYieldPool,
              isGraduated,
              createdAt,
              _graduatedAt,
              name,
              symbol,
            ] = marketsMapping;

            return {
              address: marketAddress,
              name,
              symbol,
              creator,
              isGraduated,
              createdAt,
              bBase,
              bCurrent,
            } as OnChainMarket;
          } catch (error) {
            console.warn(`Failed to fetch market ${marketAddress}:`, error);
            return null;
          }
        })
      );

      // Filter out failed fetches
      return marketDetails.filter((m): m is OnChainMarket => m !== null);
    },
  });

  return {
    markets: query.data ?? [],
    marketCount: query.data?.length ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to get just the market count (lighter weight)
 */
export function useOnChainMarketCount() {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const launchpadEngineAddress = deployments?.contracts?.LaunchpadEngine as Address | undefined;

  const query = useDirectRead({
    queryKey: ["v9", "onChainMarketCount", chainId, launchpadEngineAddress],
    enabled: !!chainId && !!launchpadEngineAddress,
    chainId,
    refetchInterval: 30_000,
    staleTime: 15_000,
    read: async (client) => {
      const count = await readContractSafe<bigint>(client, {
        address: launchpadEngineAddress!,
        abi: V9_ABIS.LaunchpadEngine,
        functionName: "getMarketCount",
      });
      return Number(count);
    },
  });

  return {
    count: query.data ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}
