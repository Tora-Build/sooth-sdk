import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import {
  SoothPostActionABI,
  SOOTH_POST_ACTION_ADDRESS,
  lensPublicClient,
} from '../lib/soothAction';

export interface SoothMarketData {
  resolver: Address;
  deadline: bigint;
  b: bigint;
  qYes: bigint;
  qNo: bigint;
  totalCollateral: bigint;
  winningOutcome: number;
  resolved: boolean;
  paused: boolean;
  feeBps: number;
  yesProbability: number;
}

type MarketTuple = readonly [
  Address,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  number,
  boolean,
  boolean,
  number,
];

function lmsrYesProbability(qYes: bigint, qNo: bigint, b: bigint): number {
  if (b <= 0n) {
    return 0.5;
  }

  const qYesNorm = Number(qYes) / Number(b);
  const qNoNorm = Number(qNo) / Number(b);

  if (!Number.isFinite(qYesNorm) || !Number.isFinite(qNoNorm)) {
    return 0.5;
  }

  const eYes = Math.exp(qYesNorm);
  const eNo = Math.exp(qNoNorm);
  const denominator = eYes + eNo;

  if (!Number.isFinite(denominator) || denominator === 0) {
    return 0.5;
  }

  return eYes / denominator;
}

export function useSoothMarket(feed: Address | undefined, postId: bigint | undefined) {
  return useQuery({
    queryKey: ['sooth-market', feed, postId?.toString() ?? null],
    queryFn: async (): Promise<SoothMarketData> => {
      if (!feed || postId === undefined) {
        throw new Error('Missing feed or postId');
      }

      const market = (await lensPublicClient.readContract({
        address: SOOTH_POST_ACTION_ADDRESS,
        abi: SoothPostActionABI,
        functionName: 'markets',
        args: [feed, postId],
      })) as MarketTuple;

      const [resolver, deadline, b, qYes, qNo, totalCollateral, winningOutcome, resolved, paused, feeBps] =
        market;

      return {
        resolver,
        deadline,
        b,
        qYes,
        qNo,
        totalCollateral,
        winningOutcome: Number(winningOutcome),
        resolved,
        paused,
        feeBps: Number(feeBps),
        yesProbability: lmsrYesProbability(qYes, qNo, b),
      };
    },
    enabled: Boolean(feed) && postId !== undefined,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}
