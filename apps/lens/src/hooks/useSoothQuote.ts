import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import {
  SoothPostActionABI,
  SOOTH_POST_ACTION_ADDRESS,
  lensPublicClient,
} from '../lib/soothAction';

export type SoothQuoteAction = 'buy' | 'sell';

export interface SoothQuoteData {
  action: SoothQuoteAction;
  fee: bigint;
  total: bigint;
  cost?: bigint;
  proceeds?: bigint;
}

type BuyQuoteTuple = readonly [bigint, bigint, bigint];
type SellQuoteTuple = readonly [bigint, bigint, bigint];

export function useSoothQuote(
  feed: Address | undefined,
  postId: bigint | undefined,
  action: SoothQuoteAction,
  outcome: number,
  shares: bigint,
) {
  return useQuery({
    queryKey: ['sooth-quote', feed, postId?.toString() ?? null, action, outcome, shares.toString()],
    queryFn: async (): Promise<SoothQuoteData> => {
      if (!feed || postId === undefined || shares <= 0n) {
        throw new Error('Missing feed/postId or invalid share amount');
      }

      if (action === 'buy') {
        const [cost, fee, total] = (await lensPublicClient.readContract({
          address: SOOTH_POST_ACTION_ADDRESS,
          abi: SoothPostActionABI,
          functionName: 'quoteBuy',
          args: [feed, postId, outcome, shares],
        })) as BuyQuoteTuple;

        return { action, cost, fee, total };
      }

      const [proceeds, fee, total] = (await lensPublicClient.readContract({
        address: SOOTH_POST_ACTION_ADDRESS,
        abi: SoothPostActionABI,
        functionName: 'quoteSell',
        args: [feed, postId, outcome, shares],
      })) as SellQuoteTuple;

      return { action, proceeds, fee, total };
    },
    enabled: Boolean(feed) && postId !== undefined && shares > 0n,
    staleTime: 5_000,
  });
}
