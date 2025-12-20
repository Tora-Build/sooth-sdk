import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { MARKET_V4_ABI } from '../../config/abis';
import { useChainStore } from '../../store/useChainStore';

export interface LaunchpadTradeQuote {
    expectedCost: number;
    maxWithSlippage: number;
    priceImpact: number;
    newPriceYes: number;
    newPriceNo: number;
    fee: number;
    totalCost: number;
    inputAmount: number;
}

export function useLaunchpadTradeQuote(
    marketAddress: `0x${string}` | undefined,
    outcomeIndex: 0 | 1,
    shares: string,
    slippageBps: number = 50,
    currentB: bigint = 0n // Needed for price impact calc
) {
    const { selectedChainId } = useChainStore();
    const publicClient = usePublicClient({ chainId: Number(selectedChainId) });
    const [quote, setQuote] = useState<LaunchpadTradeQuote | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!marketAddress || !shares || parseFloat(shares) === 0 || !publicClient) {
                if (!cancelled) setQuote(null);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const isSell = shares.startsWith('-');
                const absSharesStr = shares.replace(/^-/, '');
                const shareAmountBig = parseUnits(absSharesStr, 18);
                const isBuy = !isSell;

                // 1. Calculate Cost via Contract
                // V6.1: Direct swap - uses calculateAMMTradeCost on the market itself
                const result = await publicClient.readContract({
                    address: marketAddress,
                    abi: MARKET_V4_ABI,
                    functionName: 'calculateAMMTradeCost',
                    args: [outcomeIndex, shareAmountBig, isBuy]
                }).catch(err => {
                    // Gracefully handle "no data" or "0x" errors which happen on wrong chain
                    if (err.message?.includes('returned no data') || err.message?.includes('0x')) {
                        return null;
                    }
                    throw err;
                }) as [bigint, bigint, bigint, bigint] | null;

                if (!result) {
                    if (!cancelled) setQuote(null);
                    return;
                }

                const [rawCost, rawFee, newQYes, newQNo] = result;

                const costFloat = parseFloat(formatUnits(rawCost, 18));
                const feeFloat = parseFloat(formatUnits(rawFee, 18));
                const expectedCost = Math.abs(costFloat);
                const fee = feeFloat;

                // 2. Calculate Prices & Impact
                // Current Price is implied from PREVIOUS state. But we only have NEXT state (newQYes/No).
                // Or we assume 50/50 initially if we don't fetch current state.
                // Better: Use newQ to get NEW price.
                const bVal = Number(formatUnits(currentB || 1000000000000000000n, 18)); // Default 1 if 0
                const qYesNum = parseFloat(formatUnits(newQYes, 18));
                const qNoNum = parseFloat(formatUnits(newQNo, 18));

                let newPriceYes = 0.5;
                if (bVal > 0) {
                    const expYes = Math.exp(qYesNum / bVal);
                    const expNo = Math.exp(qNoNum / bVal);
                    newPriceYes = expYes / (expYes + expNo);
                }
                const newPriceNo = 1 - newPriceYes;

                // Impact is rough diff from 0.5 (if uniform) or previous. 
                // Getting pure previous price requires fetching qYes/qNo BEFORE trade which adds RPC load.
                // We'll skip precise impact for now or approximate.
                const priceImpact = 0; // TODO: Fetch current Qs for accurate impact

                // 3. Slippage Params - MUST include fee in the calculation!
                const BPS = 10000;
                let maxCostParam = 0;
                let minReceivedParam = undefined;

                if (costFloat > 0) { // Buy
                    // Total cost = cost + fee (for buys)
                    const totalCostWithFee = costFloat + feeFloat;
                    // maxCost must cover cost + fee + slippage tolerance
                    maxCostParam = totalCostWithFee * (1 + (slippageBps + 10) / BPS);
                } else { // Sell
                    // For sells: cost is negative (we receive money)
                    // Net proceeds = abs(cost) - fee
                    const netProceeds = Math.abs(costFloat) - feeFloat;
                    // Apply slippage: we accept (netProceeds * (1 - slippage))
                    minReceivedParam = netProceeds * (1 - (slippageBps + 10) / BPS);
                    // maxCost is negative for sells (min we accept)
                    maxCostParam = -minReceivedParam;
                }

                if (!cancelled) {
                    setQuote({
                        expectedCost,
                        maxWithSlippage: Math.abs(maxCostParam),
                        priceImpact,
                        newPriceYes,
                        newPriceNo,
                        fee,
                        totalCost: expectedCost + fee,
                        inputAmount: parseFloat(shares)
                    });
                }
            } catch (err: any) {
                console.error("Quote Error", err);
                if (!cancelled) setError(err.message || 'Failed to quote');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        run();

        return () => { cancelled = true; };
    }, [marketAddress, outcomeIndex, shares, publicClient, slippageBps, currentB]);

    return { quote, isLoading, error };
}
