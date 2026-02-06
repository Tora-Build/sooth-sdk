import { useQuery } from '@tanstack/react-query';
import { getPublicClient } from '../lib/client';
import { getDeployment, ABIS, computeMarketKey } from '@sooth/sdk-core';
import type { Address } from 'viem';
import { MONAD_TESTNET_CHAIN_ID } from '../lib/config';
import { fetchLaunchpadMarketsFromIndexer, checkIndexerHealth } from '../lib/indexer';

export interface Market {
  address: Address;
  question: string;
  stage: 'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed';
  yesProbability?: number;
  volume?: bigint;
  winningOutcome?: number | null;
  createdAt: bigint;
  deadline?: bigint;
  totalLPSupply?: bigint;
  lpToken?: Address;
}

const CHUNK_SIZE = 5;

async function readContractSafe<T>(
  client: ReturnType<typeof getPublicClient>,
  config: Parameters<ReturnType<typeof getPublicClient>['readContract']>[0]
): Promise<T | null> {
  try {
    return (await client.readContract(config)) as T;
  } catch (e) {
    console.warn(`Contract read failed: ${config.functionName}`, e);
    return null;
  }
}

async function fetchMarketPrice(
  client: ReturnType<typeof getPublicClient>,
  market: Market,
  deployment: ReturnType<typeof getDeployment>
): Promise<number | undefined> {
  if (!deployment) return undefined;

  try {
    if (market.stage === 'bonding') {
      const state = await readContractSafe<readonly [bigint, bigint, bigint]>(client, {
        address: deployment.contracts.AMMEngine as Address,
        abi: ABIS.AMMEngine,
        functionName: 'getMarketState',
        args: [market.address],
      });
      if (state) {
        return Number(state[2]) / 1e18;
      }
    } else if (market.stage === 'live') {
      const tokens = await readContractSafe<readonly [Address, Address]>(client, {
        address: deployment.contracts.Collateralizer as Address,
        abi: ABIS.Collateralizer,
        functionName: 'getOutcomeTokens',
        args: [market.address],
      });

      if (tokens) {
        const marketKey = computeMarketKey(market.address, tokens[0], tokens[1]);
        const marketState = await readContractSafe<readonly [bigint, bigint, bigint, bigint]>(
          client,
          {
            address: deployment.contracts.TickBookPoolManager as Address,
            abi: ABIS.TickBookPoolManager,
            functionName: 'getMarketState',
            args: [marketKey],
          }
        );

        if (marketState) {
          return Number(marketState[3]) / 1e18;
        }
      }
    } else if (market.stage === 'settled' || market.stage === 'finalized') {
      if (market.winningOutcome === 1) return 1.0;
      if (market.winningOutcome === 0) return 0.0;
      if (market.winningOutcome === 2) return 0.5;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function fetchMarketsFromRPC(): Promise<Market[]> {
  const client = getPublicClient(MONAD_TESTNET_CHAIN_ID);
  const deployment = getDeployment(MONAD_TESTNET_CHAIN_ID);

  if (!deployment) {
    throw new Error(`No deployment found for chain ${MONAD_TESTNET_CHAIN_ID}`);
  }

  const launchpadEngine = deployment.contracts.LaunchpadEngine as Address;

  const marketAddresses = await readContractSafe<readonly Address[]>(client, {
    address: launchpadEngine,
    abi: ABIS.LaunchpadEngine,
    functionName: 'getMarkets',
  });

  if (!marketAddresses || marketAddresses.length === 0) {
    return [];
  }

  const marketDetails: Market[] = [];

  for (let i = 0; i < marketAddresses.length; i += CHUNK_SIZE) {
    const chunk = marketAddresses.slice(i, i + CHUNK_SIZE);

    const chunkResults = await Promise.all(
      chunk.map(async (marketAddress) => {
        try {
          const marketsMapping = await readContractSafe<
            readonly [
              Address,
              Address,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              boolean,
              bigint,
              bigint
            ]
          >(client, {
            address: launchpadEngine,
            abi: ABIS.LaunchpadEngine,
            functionName: 'markets',
            args: [marketAddress],
          });

           if (!marketsMapping) return null;

           const [, lpToken, , , , , totalLPSupply, , isGraduated, createdAt] = marketsMapping;

          const [question, isSettled, isFinalized, trialState, winOutcome, deadline] = await Promise.all([
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
            readContractSafe<bigint>(client, {
              address: marketAddress,
              abi: ABIS.TruthMarket,
              functionName: 'deadline',
            }).catch(() => null),
          ]);

           const isDismissed = trialState ? trialState[1] : false;

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
             winningOutcome:
               (isSettled || isFinalized) && winOutcome !== null ? Number(winOutcome) : undefined,
             deadline: deadline ?? undefined,
             totalLPSupply,
             lpToken: lpToken as Address,
           };

          market.yesProbability = await fetchMarketPrice(client, market, deployment);

          return market;
        } catch {
          return null;
        }
      })
    );

    marketDetails.push(...chunkResults.filter((m): m is Market => m !== null));

    if (i + CHUNK_SIZE < marketAddresses.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return marketDetails.sort((a, b) => Number(b.createdAt - a.createdAt));
}

async function fetchMarketsFromIndexer(): Promise<Market[]> {
  const indexerMarkets = await fetchLaunchpadMarketsFromIndexer();
  const client = getPublicClient(MONAD_TESTNET_CHAIN_ID);
  const deployment = getDeployment(MONAD_TESTNET_CHAIN_ID);

  const marketsWithData = await Promise.all(
    indexerMarkets.map(async (m) => {
      let stage: Market['stage'];
      if (m.isDismissed) {
        stage = 'dismissed';
      } else if (m.isGraduated) {
        stage = 'live';
      } else {
        stage = 'bonding';
      }

      const [question, deadline] = await Promise.all([
        m.name
          ? Promise.resolve(m.name)
          : readContractSafe<string>(client, {
              address: m.address,
              abi: ABIS.TruthMarket,
              functionName: 'question',
            }),
        readContractSafe<bigint>(client, {
          address: m.address,
          abi: ABIS.TruthMarket,
          functionName: 'deadline',
        }),
      ]);

       const market: Market = {
         address: m.address,
         question: question || m.symbol || m.address.slice(2, 10).toUpperCase(),
         stage,
         createdAt: BigInt(m.createdAt),
         winningOutcome: undefined,
         deadline: deadline ?? undefined,
         totalLPSupply: BigInt(m.totalLPSupply),
         lpToken: undefined,
       };

      market.yesProbability = await fetchMarketPrice(client, market, deployment);
      return market;
    })
  );

  return marketsWithData;
}

export function useMarkets() {
  return useQuery({
    queryKey: ['markets', MONAD_TESTNET_CHAIN_ID],
    queryFn: async () => {
      const indexerHealthy = await checkIndexerHealth();

      if (indexerHealthy) {
        try {
          return await fetchMarketsFromIndexer();
        } catch (e) {
          console.warn('Indexer fetch failed, falling back to RPC:', e);
        }
      }

      return await fetchMarketsFromRPC();
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
