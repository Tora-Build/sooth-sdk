import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import {
  SoothPostActionABI,
  SOOTH_POST_ACTION_ADDRESS,
  lensPublicClient,
} from '../lib/soothAction';

export interface SoothPositionData {
  yesShares: bigint;
  noShares: bigint;
}

type PositionTuple = readonly [bigint, bigint];

export function useSoothPosition(
  feed: Address | undefined,
  postId: bigint | undefined,
  user: Address | undefined,
) {
  return useQuery({
    queryKey: ['sooth-position', feed, postId?.toString() ?? null, user ?? null],
    queryFn: async (): Promise<SoothPositionData> => {
      if (!feed || postId === undefined || !user) {
        throw new Error('Missing feed, postId, or user');
      }

      const [yesShares, noShares] = (await lensPublicClient.readContract({
        address: SOOTH_POST_ACTION_ADDRESS,
        abi: SoothPostActionABI,
        functionName: 'positions',
        args: [feed, postId, user],
      })) as PositionTuple;

      return { yesShares, noShares };
    },
    enabled: Boolean(feed) && postId !== undefined && Boolean(user),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
