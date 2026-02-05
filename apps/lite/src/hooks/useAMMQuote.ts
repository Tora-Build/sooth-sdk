import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPublicClient } from '../lib/client';
import { getDeployment, ABIS } from '@sooth/sdk-core';
import { formatUnits, parseUnits } from 'viem';
import { MONAD_TESTNET_CHAIN_ID } from '../lib/config';

type Address = `0x${string}`;

export interface AMMQuoteResult {
  deltaShares: bigint;
  cost: bigint;
  fee: bigint;
  feeRateBps: number;
  totalCost: bigint;
  limitCost: bigint;
  newYesPrice: number;
  newNoPrice: number;
  priceImpact: number;
  costFormatted: string;
  feeFormatted: string;
  isLoading: boolean;
  error: Error | null;
}

const EMPTY_QUOTE: AMMQuoteResult = {
  deltaShares: 0n,
  cost: 0n,
  fee: 0n,
  feeRateBps: 500,
  totalCost: 0n,
  limitCost: 0n,
  newYesPrice: 0.5,
  newNoPrice: 0.5,
  priceImpact: 0,
  costFormatted: '0.00',
  feeFormatted: '0.00',
  isLoading: false,
  error: null,
};

export function useAMMQuote(
  marketAddress: Address | undefined,
  sharesInput: string,
  outcome: 0 | 1,
  currentYesPrice: number
): AMMQuoteResult {
  const deployment = getDeployment(MONAD_TESTNET_CHAIN_ID);
  const ammEngine = deployment?.contracts.AMMEngine as Address | undefined;
  const launchpadEngine = deployment?.contracts.LaunchpadEngine as Address | undefined;

  const sharesWad = useMemo(() => {
    const raw = (sharesInput ?? '').trim();
    if (!raw || /e/i.test(raw)) return 0n;
    try {
      return parseUnits(raw, 18);
    } catch {
      return 0n;
    }
  }, [sharesInput]);

  const { data: feeRateBps } = useQuery({
    queryKey: ['fee-rate-bps', marketAddress, MONAD_TESTNET_CHAIN_ID],
    queryFn: async () => {
      if (!launchpadEngine || !marketAddress) return 500n;
      const client = getPublicClient(MONAD_TESTNET_CHAIN_ID);

      const marketData = await client.readContract({
        address: launchpadEngine,
        abi: ABIS.LaunchpadEngine,
        functionName: 'markets',
        args: [marketAddress],
      });
      const isGraduated = (marketData as readonly unknown[])[8] as boolean;

      const fnName = isGraduated ? 'postGradFeeBps' : 'preGradFeeBps';
      const bps = await client.readContract({
        address: launchpadEngine,
        abi: ABIS.LaunchpadEngine,
        functionName: fnName,
      });
      return BigInt(bps as number | bigint);
    },
    enabled: !!launchpadEngine && !!marketAddress,
    staleTime: 60_000,
  });

  const {
    data: quoteData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['amm-quote', marketAddress, outcome, sharesWad.toString(), MONAD_TESTNET_CHAIN_ID],
    queryFn: async () => {
      if (!ammEngine || !marketAddress) return null;
      const client = getPublicClient(MONAD_TESTNET_CHAIN_ID);
      const result = await client.readContract({
        address: ammEngine,
        abi: ABIS.AMMEngine,
        functionName: 'getPositionQuote',
        args: [marketAddress, outcome, sharesWad],
      });
      return result as readonly [bigint, bigint];
    },
    enabled: !!ammEngine && !!marketAddress && sharesWad > 0n,
    staleTime: 5_000,
  });

  return useMemo(() => {
    if (!quoteData || sharesWad <= 0n) {
      return { ...EMPTY_QUOTE, isLoading, error: error as Error | null };
    }

    const [costOrProceeds, newPrice] = quoteData;
    const bps = feeRateBps ?? 500n;
    const fee = (costOrProceeds * bps) / 10000n;
    const totalCost = costOrProceeds + fee;
    const limitCost = (totalCost * 105n) / 100n;

    const newYesPrice = Number(newPrice) / 1e18;
    const newNoPrice = 1 - newYesPrice;

    const currentPrice = outcome === 1 ? currentYesPrice : 1 - currentYesPrice;
    const targetNewPrice = outcome === 1 ? newYesPrice : newNoPrice;
    let priceImpact = 0;
    if (currentPrice > 0) {
      priceImpact = ((targetNewPrice - currentPrice) / currentPrice) * 100;
      priceImpact = Math.max(-99.99, Math.min(99.99, priceImpact));
    }

    const fmtWad = (val: bigint) => {
      const abs = val < 0n ? -val : val;
      const num = Number(formatUnits(abs, 18));
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return {
      deltaShares: sharesWad,
      cost: costOrProceeds,
      fee,
      feeRateBps: Number(bps),
      totalCost,
      limitCost,
      newYesPrice,
      newNoPrice,
      priceImpact,
      costFormatted: fmtWad(totalCost),
      feeFormatted: fmtWad(fee),
      isLoading: false,
      error: null,
    };
  }, [quoteData, sharesWad, feeRateBps, outcome, currentYesPrice, isLoading, error]);
}
