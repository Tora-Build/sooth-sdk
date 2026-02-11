import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import type { Address } from 'viem';
import { MONAD_MAINNET_CHAIN_ID } from '../lib/config';
import { useMarkets, type Market } from './useMarkets';
import { checkIndexerHealth } from '../lib/indexer';

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

export function usePositions() {
  const { address } = useAccount();
  const { data: markets } = useMarkets();

  return useQuery({
    queryKey: ['positions', MONAD_MAINNET_CHAIN_ID, address, markets?.map((m) => m.address)],
    queryFn: async () => {
      // Check if indexer is healthy
      const indexerHealthy = await checkIndexerHealth();
      if (!indexerHealthy) {
        console.warn('Indexer not available, returning empty positions');
        return [];
      }
      return fetchPositionsFromIndexer(markets ?? [], address as Address);
    },
    enabled: !!address && !!markets && markets.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

