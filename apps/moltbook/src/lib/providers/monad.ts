import { MONAD_MAINNET_CHAIN_ID } from '../config';
import {
  fetchLaunchpadMarketsFromIndexer,
  checkIndexerHealth,
  type IndexerLaunchpadMarket,
} from '../indexer';
import { getPublicClient } from '../client';
import { getDeployment, ABIS, computeMarketKey } from '@sooth/sdk-core';
import type { Address } from 'viem';
import { getDisplayQuestion } from '../questionOverrides';
import type { Provider, Market } from './types';

const CHUNK_SIZE = 2;

/**
 * Markets to hide from the UI (e.g. settled with wrong outcome, test markets).
 * Key: lowercase market address.
 */
const HIDDEN_MARKETS: Set<string> = new Set([
  '0x6fc49bbcd4666684404325cac3492be5795074cf', // junk "test" market created during deploy script testing
]);

async function readContractSafe<T>(
  client: ReturnType<typeof getPublicClient>,
  config: Parameters<ReturnType<typeof getPublicClient>['readContract']>[0]
): Promise<T | null> {
  try {
    const result = (await client.readContract(config)) as T;
    return result;
  } catch (e) {
    console.warn(`Contract read failed: ${config.functionName} on ${config.address}`, e);
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
            address: deployment.contracts.SoothBook as Address,
            abi: ABIS.SoothBook,
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
  const client = getPublicClient(MONAD_MAINNET_CHAIN_ID);
  const deployment = getDeployment(MONAD_MAINNET_CHAIN_ID);

  if (!deployment) {
    throw new Error(`No deployment found for chain ${MONAD_MAINNET_CHAIN_ID}`);
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

          const [question, isSettled, isFinalized, trialState, winOutcome, deadline] =
            await Promise.all([
              readContractSafe<string>(client, {
                address: marketAddress,
                abi: ABIS.TruthMarket,
                functionName: 'question',
              }),
              readContractSafe<boolean>(client, {
                address: marketAddress,
                abi: ABIS.TruthMarket,
                functionName: 'isSettled',
              }),
              readContractSafe<boolean>(client, {
                address: marketAddress,
                abi: ABIS.TruthMarket,
                functionName: 'isFinalized',
              }),
              readContractSafe<readonly [bigint, boolean, bigint]>(client, {
                address: launchpadEngine,
                abi: ABIS.LaunchpadEngine,
                functionName: 'trialStates',
                args: [marketAddress],
              }),
              readContractSafe<number>(client, {
                address: marketAddress,
                abi: ABIS.TruthMarket,
                functionName: 'winningOutcome',
              }),
              readContractSafe<bigint>(client, {
                address: marketAddress,
                abi: ABIS.TruthMarket,
                functionName: 'deadline',
              }),
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
            question: getDisplayQuestion(
              marketAddress,
              (question as string) || marketAddress.slice(2, 10).toUpperCase()
            ),
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
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return marketDetails
    .filter((m) => !HIDDEN_MARKETS.has(m.address.toLowerCase()))
    .sort((a, b) => Number(b.createdAt - a.createdAt));
}

async function fetchMarketsFromIndexer(): Promise<Market[]> {
  const indexerMarkets = await fetchLaunchpadMarketsFromIndexer();
  if (indexerMarkets.length === 0) return [];

  // Detect stale indexer: if ALL non-settled markets have yesProbability === 0.5, prices are likely stale
  const activePrices = indexerMarkets
    .filter((m) => !m.isSettled && !m.isFinalized && !m.isDismissed)
    .map((m) => m.yesProbability);
  const allDefault =
    activePrices.length > 1 && activePrices.every((p) => p === 0.5 || p === null);

  const markets: Market[] = indexerMarkets
    .filter((m) => !HIDDEN_MARKETS.has(m.address.toLowerCase()))
    .map((m) => {
      const question = getDisplayQuestion(
        m.address,
        m.name || m.symbol || m.address.slice(2, 10).toUpperCase()
      );
      const isSettled = m.isSettled ?? false;
      const isFinalized = m.isFinalized ?? false;
      const winOutcome = m.winningOutcome;

      let stage: Market['stage'];
      if (m.isDismissed) {
        stage = 'dismissed';
      } else if (isFinalized) {
        stage = 'finalized';
      } else if (isSettled) {
        stage = 'settled';
      } else if (m.isGraduated) {
        stage = 'live';
      } else {
        stage = 'bonding';
      }

      // Use indexer's yesProbability directly
      let yesProbability = m.yesProbability ?? undefined;

      // For settled/finalized, override with outcome-based price
      if (stage === 'settled' || stage === 'finalized') {
        if (winOutcome === 1) yesProbability = 1.0;
        else if (winOutcome === 0) yesProbability = 0.0;
        else if (winOutcome === 2) yesProbability = 0.5;
      }

      return {
        address: m.address,
        question,
        stage,
        createdAt: BigInt(m.createdAt),
        winningOutcome: (isSettled || isFinalized) && winOutcome != null ? winOutcome : undefined,
        deadline: m.deadline ? BigInt(m.deadline) : undefined,
        totalLPSupply: BigInt(m.totalLPSupply),
        lpToken: undefined,
        yesProbability,
      };
    });

  // If indexer prices look stale, enrich with RPC price reads
  if (allDefault) {
    console.warn('Indexer prices look stale (all 0.5), fetching prices from RPC...');
    const client = getPublicClient(MONAD_MAINNET_CHAIN_ID);
    const deployment = getDeployment(MONAD_MAINNET_CHAIN_ID);

    if (deployment) {
      await Promise.all(
        markets.map(async (market) => {
          if (
            market.stage === 'settled' ||
            market.stage === 'finalized' ||
            market.stage === 'dismissed'
          )
            return;
          try {
            const price = await fetchMarketPrice(client, market, deployment);
            if (price !== undefined) {
              market.yesProbability = price;
            }
          } catch {
            // Keep indexer default
          }
        })
      );
    }
  }

  return markets;
}

/**
 * Monad provider - fetches markets from Monad chain via indexer or RPC
 */
export class MonadProvider implements Provider {
  name = 'Monad';
  chainId = MONAD_MAINNET_CHAIN_ID;

  async fetchMarkets(): Promise<Market[]> {
    const indexerHealthy = await this.checkHealth();

    if (indexerHealthy) {
      try {
        return await fetchMarketsFromIndexer();
      } catch (e) {
        console.warn('Indexer fetch failed, falling back to RPC:', e);
      }
    }

    return await fetchMarketsFromRPC();
  }

  async fetchMarket(marketId: string): Promise<Market | null> {
    const markets = await this.fetchMarkets();
    return markets.find((m) => m.address.toLowerCase() === marketId.toLowerCase()) || null;
  }

  async checkHealth(): Promise<boolean> {
    return await checkIndexerHealth();
  }
}
