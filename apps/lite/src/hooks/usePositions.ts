import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { getPublicClient } from '../lib/client';
import { getDeployment, ABIS } from '@sooth/sdk-core';
import type { Address } from 'viem';
import { MONAD_TESTNET_CHAIN_ID } from '../lib/config';
import { useMarkets, type Market } from './useMarkets';

export interface Position {
  market: Market;
  yesShares: bigint;
  noShares: bigint;
  totalShares: bigint;
  valueUsd: number;
}

async function fetchPositions(
  markets: Market[],
  userAddress: Address
): Promise<Position[]> {
  const client = getPublicClient(MONAD_TESTNET_CHAIN_ID);
  const deployment = getDeployment(MONAD_TESTNET_CHAIN_ID);

  if (!deployment) return [];

  const ammEngine = deployment.contracts.AMMEngine as Address;

  const positions: Position[] = [];

  for (const market of markets) {
    if (market.stage !== 'bonding') continue;

    try {
      const result = await client.readContract({
        address: ammEngine,
        abi: ABIS.AMMEngine,
        functionName: 'getPosition',
        args: [market.address, userAddress],
      });

      const [yesShares, noShares] = result as readonly [bigint, bigint];

      if (yesShares > 0n || noShares > 0n) {
        const yesValue = Number(yesShares) / 1e18 * (market.yesProbability ?? 0.5);
        const noValue = Number(noShares) / 1e18 * (1 - (market.yesProbability ?? 0.5));

        positions.push({
          market,
          yesShares,
          noShares,
          totalShares: yesShares + noShares,
          valueUsd: yesValue + noValue,
        });
      }
    } catch {
      continue;
    }
  }

  return positions;
}

export function usePositions() {
  const { address } = useAccount();
  const { data: markets } = useMarkets();

  return useQuery({
    queryKey: ['positions', MONAD_TESTNET_CHAIN_ID, address, markets?.map((m) => m.address)],
    queryFn: () => fetchPositions(markets ?? [], address as Address),
    enabled: !!address && !!markets && markets.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
