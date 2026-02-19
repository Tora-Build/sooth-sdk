import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import type { Address } from 'viem';
import { MONAD_MAINNET_CHAIN_ID } from '../lib/config';
import { useMarkets, type Market } from './useMarkets';
import { checkIndexerHealth } from '../lib/indexer';
import { getPublicClient } from '../lib/client';
import { getDeployment, ABIS } from '@sooth/sdk-core';

const INDEXER_URL = import.meta.env.VITE_INDEXER_URL || 'http://localhost:42069';

export interface Position {
  market: Market;
  yesShares: bigint;
  noShares: bigint;
  totalShares: bigint;
  valueUsd: number;
  lpBalance: bigint;
}

interface IndexerAMMPosition {
  id: string;
  chainId: number;
  market: string;
  user: string;
  yesShares: string;
  noShares: string;
  updatedAt: string;
}

interface IndexerLPBalance {
  id: string;
  chainId: number;
  market: string;
  user: string;
  balance: string;
}

async function fetchPositionsFromIndexer(
  markets: Market[],
  userAddress: Address
): Promise<Position[]> {
  // Fetch AMM positions and LP balances from indexer in parallel
  const [ammResponse, lpResponse] = await Promise.all([
    fetch(`${INDEXER_URL}/amm-positions/${MONAD_MAINNET_CHAIN_ID}/${userAddress.toLowerCase()}`),
    fetch(`${INDEXER_URL}/lp-balances/${MONAD_MAINNET_CHAIN_ID}/${userAddress.toLowerCase()}`),
  ]);

  if (!ammResponse.ok || !lpResponse.ok) {
    throw new Error('Failed to fetch positions from indexer');
  }

  const ammPositions: IndexerAMMPosition[] = await ammResponse.json();
  const lpBalances: IndexerLPBalance[] = await lpResponse.json();

  // Create lookup maps for O(1) access
  const marketMap = new Map(markets.map((m) => [m.address.toLowerCase(), m]));
  const ammMap = new Map(ammPositions.map((p) => [p.market.toLowerCase(), p]));
  const lpMap = new Map(lpBalances.map((lp) => [lp.market.toLowerCase(), lp]));

  const positions: Position[] = [];

  // Collect all market addresses that have positions
  const marketAddresses = new Set([
    ...ammPositions.map((p) => p.market.toLowerCase()),
    ...lpBalances.map((lp) => lp.market.toLowerCase()),
  ]);

  for (const marketAddr of marketAddresses) {
    const market = marketMap.get(marketAddr);
    if (!market) continue;

    // Skip dismissed markets
    if (market.stage === 'dismissed') continue;

    const ammPos = ammMap.get(marketAddr);
    const lpBal = lpMap.get(marketAddr);

    const yesShares = ammPos ? BigInt(ammPos.yesShares) : 0n;
    const noShares = ammPos ? BigInt(ammPos.noShares) : 0n;
    const lpBalance = lpBal ? BigInt(lpBal.balance) : 0n;

    // Only include if there are actual positions
    if (yesShares > 0n || noShares > 0n || lpBalance > 0n) {
      const yesValue = Number(yesShares) / 1e18 * (market.yesProbability ?? 0.5);
      const noValue = Number(noShares) / 1e18 * (1 - (market.yesProbability ?? 0.5));

      positions.push({
        market,
        yesShares,
        noShares,
        totalShares: yesShares + noShares,
        valueUsd: yesValue + noValue,
        lpBalance,
      });
    }
  }

  return positions;
}

async function fetchPositionsFromRPC(
  markets: Market[],
  userAddress: Address
): Promise<Position[]> {
  const client = getPublicClient(MONAD_MAINNET_CHAIN_ID);
  const deployment = getDeployment(MONAD_MAINNET_CHAIN_ID);
  if (!deployment) return [];

  const ammEngine = deployment.contracts.AMMEngine as Address;
  const positions: Position[] = [];

  // Read positions in chunks to avoid RPC overload
  const CHUNK = 3;
  for (let i = 0; i < markets.length; i += CHUNK) {
    const chunk = markets.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (market) => {
        try {
          const [yesShares, noShares] = await client.readContract({
            address: ammEngine,
            abi: ABIS.AMMEngine,
            functionName: 'getPosition',
            args: [market.address, userAddress],
          }) as [bigint, bigint];

          if (yesShares > 0n || noShares > 0n) {
            const yesValue = Number(yesShares) / 1e18 * (market.yesProbability ?? 0.5);
            const noValue = Number(noShares) / 1e18 * (1 - (market.yesProbability ?? 0.5));
            return {
              market,
              yesShares,
              noShares,
              totalShares: yesShares + noShares,
              valueUsd: yesValue + noValue,
              lpBalance: 0n,
            };
          }
        } catch {
          // Skip failed reads
        }
        return null;
      })
    );
    positions.push(...results.filter((p): p is Position => p !== null));
  }

  return positions;
}

export function usePositions() {
  const { address } = useAccount();
  const { data: markets } = useMarkets();

  return useQuery({
    queryKey: ['positions', MONAD_MAINNET_CHAIN_ID, address, markets?.map((m) => m.address)],
    queryFn: async () => {
      const indexerHealthy = await checkIndexerHealth();

      if (indexerHealthy) {
        try {
          const positions = await fetchPositionsFromIndexer(markets ?? [], address as Address);
          // If indexer returns positions, use them
          if (positions.length > 0) return positions;
        } catch {
          console.warn('Indexer positions failed, falling back to RPC');
        }
      }

      // Fallback: read positions directly from chain
      return fetchPositionsFromRPC(markets ?? [], address as Address);
    },
    enabled: !!address && !!markets && markets.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

