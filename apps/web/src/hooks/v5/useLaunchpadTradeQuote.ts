import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { MARKET_V4_ABI } from '../../config/abis';

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
    const publicClient = usePublicClient();
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
                const result = await publicClient.readContract({
                    address: marketAddress,
                    abi: MARKET_V4_ABI,
                    functionName: 'calculateAMMTradeCost',
                    args: [outcomeIndex, shareAmountBig, isBuy]
                }) as [bigint, bigint, bigint, bigint];

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

                // 3. Slippage Params
                const BPS = 10000;
                let maxCostParam = 0;
                let minReceivedParam = undefined;

                if (costFloat > 0) { // Buy
                    maxCostParam = costFloat * (1 + (slippageBps + 10) / BPS);
                } else { // Sell
                    // Cost is negative (e.g. -100). We need at least 99.
                    maxCostParam = costFloat * (1 - (slippageBps + 10) / BPS);
                    minReceivedParam = Math.abs(maxCostParam);
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
