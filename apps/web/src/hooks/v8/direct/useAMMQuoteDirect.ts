/**
 * useAMMQuoteDirect - Real-time trade quote calculation per V8.2 API
 * 
 * V8.2 uses dual-balance model with explicit outcome parameter:
 * - getPositionQuote(market, outcome, deltaShares) -> (cost, newPrice)
 * - outcome: 0 = YES, 1 = NO
 * - deltaShares: positive = buy, negative = sell
 */
import { useMemo } from 'react';
import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V8_ABIS } from "../../../config/abis";
import { useV8DirectRead } from "./useV8DirectRead";
import { useLaunchpadMarketDirect } from "./useLaunchpadMarketDirect";
import { useAmmMarketDirect } from "./useAmmMarketDirect";

type Address = `0x${string}`;

interface AMMQuoteResult {
  // Input
  deltaShares: bigint;
  isBuy: boolean;
  outcome: 0 | 1; // 0 = YES, 1 = NO

  // Quote results
  cost: bigint;              // Total cost in USDC (WAD)
  fee: bigint;               // Fee amount (WAD)
  feeRate: number;           // Fee rate in BPS (500 or 100)
  netCost: bigint;           // Cost without fee (WAD)
  newYesPrice: number;       // New YES probability after trade
  newNoPrice: number;        // New NO probability after trade
  priceImpact: number;       // Price impact percentage

  // Display helpers
  costFormatted: string;
  feeFormatted: string;
  sharesFormatted: string;

  // Status
  isLoading: boolean;
  error: Error | null;
}

export function useAMMQuoteDirect(
  marketAddress: Address | undefined,
  shares: number,
  outcome: 0 | 1 = 0,
  isBuy: boolean = true
): AMMQuoteResult {
  const { selectedChainId } = useChainStore();
  const deployments = useDeployments();
  const chainId = selectedChainId ? Number(selectedChainId) : undefined;

  const ammEngineAddress = deployments?.contracts?.AMMEngine as Address | undefined;
  const launchpad = useLaunchpadMarketDirect(marketAddress);
  const amm = useAmmMarketDirect(marketAddress);

  const isLoadingLaunchpad = launchpad.isLoading;
  const isLoadingAmm = amm.isLoading;

  const sharesWad = BigInt(Math.floor(shares * 1e18));
  const isAmmInitialized = (amm.amm?.liquidity ?? 0n) > 0n;

  // V8.2 Position Model:
  // - deltaShares > 0 = buy shares
  // - deltaShares < 0 = sell shares
  // - outcome specifies which side (YES or NO)
  const deltaShares = isBuy ? sharesWad : -sharesWad;

  // Use the direct read hook to call getPositionQuote
  const { data: quoteData, isLoading: quoteLoading, error } = useV8DirectRead<readonly [bigint, bigint]>({
    queryKey: ['amm-quote', marketAddress, outcome, deltaShares.toString(), chainId],
    enabled: !!marketAddress && !!ammEngineAddress && !!chainId && sharesWad > 0n && isAmmInitialized,
    chainId,
    read: async (client) => {
      try {
        // V8.2 API: getPositionQuote(market, outcome, deltaShares)
        const result = await client.readContract({
          address: ammEngineAddress!,
          abi: V8_ABIS.AMMEngine,
          functionName: 'getPositionQuote',
          args: [marketAddress!, outcome, deltaShares]
        }) as readonly [bigint, bigint];
        return result;
      } catch (err: any) {
        throw err;
      }
    }
  });

  const quote = useMemo(() => {
    if (!quoteData || !marketAddress || shares <= 0) {
      return {
        deltaShares: 0n,
        isBuy,
        outcome,
        cost: 0n,
        fee: 0n,
        feeRate: 500,
        netCost: 0n,
        newYesPrice: amm.amm?.yesProbability ?? 0.5,
        newNoPrice: amm.amm?.noProbability ?? 0.5,
        priceImpact: 0,
        costFormatted: '$0.00',
        feeFormatted: '$0.00',
        sharesFormatted: '0',
        isLoading: isLoadingLaunchpad || isLoadingAmm || quoteLoading,
        error: error as Error | null,
      };
    }

    // getPositionQuote returns (uint256 cost, uint256 newPrice)
    const [cost, newPrice] = quoteData as readonly [bigint, bigint];

    const feeRate = Number(launchpad.launchpad?.currentFeeBps ?? 500n);
    const absNetCost = cost < 0n ? -cost : cost;
    const fee = isBuy ? (absNetCost * BigInt(feeRate)) / 10000n : 0n; // No fees on sells

    // totalCost is what the user actually pays (or receives)
    const totalCost = cost + fee;

    const newYesPrice = Number(newPrice) / 1e18;
    const newNoPrice = 1 - newYesPrice;

    // Price impact calculation
    // For YES trades: compare YES price before vs after
    // For NO trades: compare NO price before vs after
    const currentPrice = outcome === 0 
      ? (amm.amm?.yesProbability ?? 0.5) 
      : (amm.amm?.noProbability ?? 0.5);
    const targetNewPrice = outcome === 0 ? newYesPrice : newNoPrice;
    
    // Price impact: how much does the price move as a percentage
    // Positive = price increases, Negative = price decreases
    // For buys: price should increase (positive impact)
    // For sells: price should decrease (negative impact)
    let priceImpact = 0;
    if (currentPrice > 0) {
      priceImpact = ((targetNewPrice - currentPrice) / currentPrice) * 100;
      // Cap at reasonable values to avoid display bugs from edge cases
      priceImpact = Math.max(-99.99, Math.min(99.99, priceImpact));
    }

    const fmtCost = (valWad: bigint) => {
      const val = Number(valWad) / 1e18;
      if (val === 0) return '$0.00';
      if (Math.abs(val) < 0.01) return `$${val.toFixed(4)}`;
      return `$${val.toFixed(2)}`;
    };

    return {
      deltaShares,
      isBuy,
      outcome,
      cost: totalCost,
      fee,
      feeRate,
      netCost: cost,
      newYesPrice,
      newNoPrice,
      priceImpact,
      costFormatted: fmtCost(totalCost),
      feeFormatted: fmtCost(fee),
      sharesFormatted: shares.toLocaleString(),
      isLoading: false,
      error: null,
    };
  }, [quoteData, launchpad.launchpad, amm.amm, shares, outcome, isBuy, quoteLoading, error, isLoadingLaunchpad, isLoadingAmm]);

  return quote;
}

