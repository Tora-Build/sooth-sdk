import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { ABIS } from "../config/abis";
import { useDirectRead, readContractSafe } from "./useDirectRead";
import { DEFAULT_CHAIN_ID } from "../lib/chains";
import { getPollingInterval } from "../lib/polling";

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
  const parsedChainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const chainId = Number.isFinite(parsedChainId) ? parsedChainId : DEFAULT_CHAIN_ID;
  const deployments = useDeployments();
  const launchpadEngineAddress = deployments?.contracts?.LaunchpadEngine as Address | undefined;

  const query = useDirectRead({
    queryKey: ["v10", "onChainMarkets", chainId, launchpadEngineAddress],
    enabled: !!chainId && !!launchpadEngineAddress && !isNaN(chainId),
    chainId,
    refetchInterval: getPollingInterval(chainId, 'slow'),
    staleTime: 15_000,
    read: async (client) => {
      if (!launchpadEngineAddress) return [];

      // Get all market addresses
      const marketAddresses = await readContractSafe<readonly Address[]>(client, {
        address: launchpadEngineAddress,
        abi: ABIS.LaunchpadEngine,
        functionName: "getMarkets",
      }).catch(err => {
        console.error("Failed to fetch market addresses:", err);
        return [] as readonly Address[];
      });

      if (!marketAddresses || marketAddresses.length === 0) {
        return [];
      }

      // Process markets in chunks to avoid 429 rate limiting
      const CHUNK_SIZE = 5;
      const marketDetails: OnChainMarket[] = [];

      for (let i = 0; i < marketAddresses.length; i += CHUNK_SIZE) {
        const chunk = marketAddresses.slice(i, i + CHUNK_SIZE);

        const chunkResults = await Promise.all(
          chunk.map(async (marketAddress) => {
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
                ]
              >(client, {
                address: launchpadEngineAddress!,
                abi: ABIS.LaunchpadEngine,
                functionName: "markets",
                args: [marketAddress],
              });

              if (!marketsMapping) return null;

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
              ] = marketsMapping;

              const symbol = marketAddress.slice(2, 10).toUpperCase();

              let question = symbol;
              try {
                const q = await readContractSafe<string>(client, {
                  address: marketAddress as Address,
                  abi: ABIS.TruthMarket,
                  functionName: "question",
                });
                if (q) question = q;
              } catch {}

              return {
                address: marketAddress,
                name: question,
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

        // Add valid results from this chunk
        marketDetails.push(...chunkResults.filter((m): m is OnChainMarket => m !== null));

        // Small delay between chunks to be nice to the RPC
        if (i + CHUNK_SIZE < marketAddresses.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return marketDetails;
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
    refetchInterval: getPollingInterval(chainId, 'slow'),
    staleTime: 15_000,
    read: async (client) => {
      const count = await readContractSafe<bigint>(client, {
        address: launchpadEngineAddress!,
        abi: ABIS.LaunchpadEngine,
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
