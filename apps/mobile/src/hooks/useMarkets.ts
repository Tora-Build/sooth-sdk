import { useQuery } from '@tanstack/react-query';
import { getPublicClient } from '../lib/client';
import { getDeployment, ABIS } from '@sooth/sdk-core';
import type { Address } from 'viem';

export interface Market {
  address: Address;
  question: string;
  stage: 'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed';
  yesProbability?: number;
  volume?: bigint;
  winningOutcome?: number | null;
  createdAt: bigint;
}

const BASE_SEPOLIA_CHAIN_ID = 84532;
const CHUNK_SIZE = 5;

/**
 * Read contract safely with error handling
 */
async function readContractSafe<T>(
  client: ReturnType<typeof getPublicClient>,
  config: any
): Promise<T | null> {
  try {
    return (await client.readContract(config)) as T;
  } catch (error) {
    console.warn(`[readContractSafe] Error:`, error);
    return null;
  }
}

/**
 * Fetch market price based on stage
 */
async function fetchMarketPrice(
  client: ReturnType<typeof getPublicClient>,
  market: Market,
  deployment: any
): Promise<number | undefined> {
  try {
    if (market.stage === 'bonding') {
      // Bonding: read from AMMEngine.getMarketState()
      const state = await readContractSafe<readonly [bigint, bigint, bigint]>(client, {
        address: deployment.contracts.AMMEngine as Address,
        abi: ABIS.AMMEngine,
        functionName: 'getMarketState',
        args: [market.address],
      });
      if (state) {
        const yesPrice = state[2]; // 3rd return value
        return Number(yesPrice) / 1e18;
      }
    } else if (market.stage === 'live') {
      // Graduated: read from TickBookPoolManager via Collateralizer tokens
      try {
        const tokens = await readContractSafe<readonly [Address, Address]>(client, {
          address: deployment.contracts.Collateralizer as Address,
          abi: ABIS.Collateralizer,
          functionName: 'getOutcomeTokens',
          args: [market.address],
        });

        if (tokens) {
          const yesToken = tokens[0];
          const noToken = tokens[1];

          // Compute marketKey = keccak256(abi.encode(yesToken, noToken))
          // For now, use a simplified approach: read from TickBookPoolManager
          const marketState = await readContractSafe<readonly [bigint, bigint, bigint, bigint]>(
            client,
            {
              address: deployment.contracts.TickBookPoolManager as Address,
              abi: ABIS.TickBookPoolManager,
              functionName: 'getMarketState',
              args: [yesToken, noToken],
            }
          );

          if (marketState) {
            const probabilityWad = marketState[3]; // 4th return value
            return Number(probabilityWad) / 1e18;
          }
        }
      } catch (e) {
        console.warn(`[fetchMarketPrice] Failed to fetch live market price:`, e);
      }
    } else if (market.stage === 'settled' || market.stage === 'finalized') {
      // Settled/Finalized: derive from winningOutcome
      if (market.winningOutcome === 1) return 1.0;
      if (market.winningOutcome === 0) return 0.0;
      if (market.winningOutcome === 2) return 0.5;
    }
  } catch (error) {
    console.warn(`[fetchMarketPrice] Error for market ${market.address}:`, error);
  }

  return undefined;
}

/**
 * Hook to fetch all markets from LaunchpadEngine on Base Sepolia
 */
export function useMarkets() {
  return useQuery({
    queryKey: ['markets', BASE_SEPOLIA_CHAIN_ID],
    queryFn: async () => {
      const client = getPublicClient();
      const deployment = getDeployment(BASE_SEPOLIA_CHAIN_ID);

      if (!deployment) {
        throw new Error(`No deployment found for chain ${BASE_SEPOLIA_CHAIN_ID}`);
      }

      const launchpadEngine = deployment.contracts.LaunchpadEngine as Address;

      // Get all market addresses
      const marketAddresses = await readContractSafe<readonly Address[]>(client, {
        address: launchpadEngine,
        abi: ABIS.LaunchpadEngine,
        functionName: 'getMarkets',
      });

      if (!marketAddresses || marketAddresses.length === 0) {
        return [];
      }

      const marketDetails: Market[] = [];

      // Process in chunks to avoid RPC rate limits
      for (let i = 0; i < marketAddresses.length; i += CHUNK_SIZE) {
        const chunk = marketAddresses.slice(i, i + CHUNK_SIZE);

        const chunkResults = await Promise.all(
          chunk.map(async (marketAddress) => {
            try {
              // Fetch market metadata from LaunchpadEngine
              const marketsMapping = await readContractSafe<
                readonly [
                  Address, // creator
                  Address, // lpToken
                  bigint, // bBase
                  bigint, // bCurrent
                  bigint, // creatorDeposit
                  bigint, // feesAccrued
                  bigint, // totalLPSupply
                  bigint, // lpYieldPool
                  boolean, // isGraduated
                  bigint, // createdAt
                  bigint // graduatedAt
                ]
              >(client, {
                address: launchpadEngine,
                abi: ABIS.LaunchpadEngine,
                functionName: 'markets',
                args: [marketAddress],
              });

              if (!marketsMapping) return null;

              const [, , , , , , , , isGraduated, createdAt] = marketsMapping;

              // Fetch question and settlement state
              const [question, isSettled, isFinalized, trialState, winOutcome] = await Promise.all([
                readContractSafe<string>(client, {
                  address: marketAddress,
                  abi: ABIS.TruthMarket,
                  functionName: 'question',
                }).catch(() => marketAddress.slice(2, 10).toUpperCase()),
                readContractSafe<boolean>(client, {
                  address: marketAddress,
                  abi: ABIS.TruthMarket,
                  functionName: 'isSettled',
                }).catch(() => false),
                readContractSafe<boolean>(client, {
                  address: marketAddress,
                  abi: ABIS.TruthMarket,
                  functionName: 'isFinalized',
                }).catch(() => false),
                readContractSafe<readonly [bigint, boolean, bigint]>(client, {
                  address: launchpadEngine,
                  abi: ABIS.LaunchpadEngine,
                  functionName: 'trialStates',
                  args: [marketAddress],
                }).catch(() => null),
                readContractSafe<number>(client, {
                  address: marketAddress,
                  abi: ABIS.TruthMarket,
                  functionName: 'winningOutcome',
                }).catch(() => null),
              ]);

              const isDismissed = trialState ? trialState[1] : false;

              // Determine stage
              let stage: Market['stage'];
              if (isDismissed) {
                stage = 'dismissed';
              } else if (isFinalized) {
                stage = 'finalized';
              } else if (isSettled) {
                stage = 'settled';
              } else if (isGraduated) {
                stage = 'live';
              } else {
                stage = 'bonding';
              }

              const market: Market = {
                address: marketAddress,
                question: (question as string) || marketAddress.slice(2, 10).toUpperCase(),
                stage,
                createdAt,
                winningOutcome: (isSettled || isFinalized) && winOutcome !== null ? Number(winOutcome) : undefined,
              };

              // Fetch price
              market.yesProbability = await fetchMarketPrice(client, market, deployment);

              return market;
            } catch (error) {
              console.warn(`[useMarkets] Failed to fetch market ${marketAddress}:`, error);
              return null;
            }
          })
        );

        marketDetails.push(...chunkResults.filter((m): m is Market => m !== null));

        // Small delay between chunks
        if (i + CHUNK_SIZE < marketAddresses.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Sort by most recent first
      return marketDetails.sort((a, b) => Number(b.createdAt - a.createdAt));
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
