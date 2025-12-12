import { useState, useEffect, useMemo } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { MARKET_V4_ABI } from '../config/abis';
import { useAmmMarket } from './useAmmMarket';

// Types
export interface V4Quote {
    expectedCost: number;       // The cost user pays (or receives if negative)
    fee: number;                // Network fee
    priceImpact: number;        // % impact
    newPriceYes: number;        // New probability
    newPriceNo: number;
    totalCost: number;          // cost + fee
    inputAmount: number;        // The input this quote corresponds to (sync key)
    maxWithSlippage?: number;   // Calculated max cost with slippage
    error?: string;
}

export interface UseV4QuoteResult {
    quote: V4Quote | null;
    isLoading: boolean;
    error: string | null;
}

/**
 * useV4Quote: The strict, single-source-of-truth hook for V4 AMM pricing.
 * Handles debouncing internally.
 * Guarantees that if `quote` is returned, `quote.inputAmount` matches `debouncedShares`.
 */
export function useV4Quote(
    marketId: string,
    outcomeIndex: number,
    shares: string,
    isBuy: boolean,
    feeRate: number = 0.005 // Default 0.5%
): UseV4QuoteResult {
    const { address } = useAccount();
    const { market } = useAmmMarket(marketId);
    const publicClient = usePublicClient();

    // Internal Debounce State
    const [debouncedShares, setDebouncedShares] = useState(shares);
    // Derived state: true immediately when input changes, before effect runs
    const isDebouncing = shares !== debouncedShares;

    // Quote State
    const [quote, setQuote] = useState<V4Quote | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Debounce Effect
    useEffect(() => {
        if (shares === debouncedShares) return;

        const timer = setTimeout(() => {
            setDebouncedShares(shares);
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [shares, debouncedShares]);

    // Calculation Effect
    useEffect(() => {
        // If debouncing (mismatch), don't fetch yet
        if (isDebouncing) return;
        let cancelled = false;

        const calculate = async () => {
            // Reset state
            setError(null);

            // 1. Validation
            const parsedShares = parseFloat(debouncedShares);
            if (isNaN(parsedShares) || parsedShares <= 0 || !market || !market.contractAddress) {
                setQuote(null);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            try {
                const absShares = Math.abs(parsedShares);
                // Safe parsing for decimals
                const sharesBig = parseUnits(absShares.toFixed(18), 18);

                if (!publicClient) throw new Error("No provider");

                // 2. Contract Call
                // Returns (cost, fee, newQYes, newQNo)
                const result = await publicClient.readContract({
                    address: market.contractAddress as `0x${string}`,
                    abi: MARKET_V4_ABI,
                    functionName: 'calculateAMMTradeCost',
                    args: [
                        outcomeIndex,
                        sharesBig,
                        isBuy
                    ]
                }) as [bigint, bigint, bigint, bigint];

                if (cancelled) return;

                const [rawCost, rawFee, newQYes, newQNo] = result;

                // 3. Process Results
                const costFloat = parseFloat(formatUnits(rawCost, 18));
                const feeFloat = parseFloat(formatUnits(rawFee, 18));
                const expectedCostAbs = Math.abs(costFloat);

                // Calc probabilities from Q values (LMSR formula)
                let newProbYes = 0;
                let newProbNo = 0;

                const bVal = Number(formatUnits(market.bParam, 18));
                if (bVal > 0) {
                    const qYesVal = Number(formatUnits(newQYes, 18));
                    const qNoVal = Number(formatUnits(newQNo, 18));

                    const maxQ = Math.max(qYesVal, qNoVal);
                    const expYes = Math.exp((qYesVal - maxQ) / bVal);
                    const expNo = Math.exp((qNoVal - maxQ) / bVal);
                    const sumExp = expYes + expNo;

                    newProbYes = expYes / sumExp;
                    newProbNo = expNo / sumExp;
                }

                // Price Impact
                const impact = 0;

                // Construct Quote
                const totalCost = expectedCostAbs + feeFloat;

                setQuote({
                    expectedCost: expectedCostAbs,
                    fee: feeFloat,
                    priceImpact: impact,
                    newPriceYes: newProbYes,
                    newPriceNo: newProbNo,
                    totalCost: totalCost,
                    inputAmount: parsedShares,
                    // Use a safer max slippage calc? 5% is standard MVP.
                    maxWithSlippage: totalCost * 1.05
                });

            } catch (err: any) {
                if (!cancelled) {
                    console.error("Quote Error:", err);
                    setError(err.message || "Failed to calculate quote");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        calculate();

        return () => { cancelled = true; };
    }, [debouncedShares, market, outcomeIndex, publicClient, isBuy]);

    // -------------------------------------------------------------------------
    // 3. Client-Side Calculation (Instant)
    // -------------------------------------------------------------------------
    const clientQuote = useMemo(() => {
        const sharesVal = parseFloat(shares);
        // We need 'market' object for bParam/qYes/qNo to do client math.
        if (!market || isNaN(sharesVal) || sharesVal <= 0 || !market.bParam) return null;

        try {
            // LMSR Math: Cost = b * ln(exp(q1/b) + exp(q2/b))
            const bVal = Number(formatUnits(market.bParam, 18));
            if (bVal === 0) return null;

            const qYes = Number(formatUnits(market.qYes || 0n, 18));
            const qNo = Number(formatUnits(market.qNo || 0n, 18));

            const costFn = (qy: number, qn: number) => {
                const maxQ = Math.max(qy, qn);
                const expYes = Math.exp((qy - maxQ) / bVal);
                const expNo = Math.exp((qn - maxQ) / bVal);
                return maxQ + bVal * Math.log(expYes + expNo);
            };

            const currentCost = costFn(qYes, qNo);

            // New State
            const delta = sharesVal;
            // outcomeIndex: 0 = YES, 1 = NO
            const qYesDelta = outcomeIndex === 0 ? delta : 0;
            const qNoDelta = outcomeIndex === 1 ? delta : 0;

            // If buying, add shares to state. If selling, subtract.
            // Standard LMSR: q is quantity SOLD.
            // Buy -> q increases. Sell -> q decreases.
            const sign = isBuy ? 1 : -1;

            const nextQYes = qYes + (qYesDelta * sign);
            const nextQNo = qNo + (qNoDelta * sign);

            const newCost = costFn(nextQYes, nextQNo);
            const tradeCost = newCost - currentCost;
            const absTradeCost = Math.abs(tradeCost);

            // Calculate Fee
            const estFee = absTradeCost * feeRate;

            // Probabilities
            const expYes = Math.exp((nextQYes - Math.max(nextQYes, nextQNo)) / bVal);
            const expNo = Math.exp((nextQNo - Math.max(nextQYes, nextQNo)) / bVal);
            const newProbYes = expYes / (expYes + expNo);

            return {
                expectedCost: absTradeCost,
                fee: estFee,
                priceImpact: 0,
                newPriceYes: newProbYes,
                newPriceNo: 1 - newProbYes,
                totalCost: absTradeCost + estFee,
                inputAmount: sharesVal,
                maxWithSlippage: (absTradeCost + estFee) * 1.05
            } as V4Quote;

        } catch (e) {
            return null;
        }
    }, [shares, market, outcomeIndex, isBuy, feeRate]);


    // Return Logic
    const contractQuoteIsFresh = quote && quote.inputAmount === parseFloat(shares);
    const activeQuote = contractQuoteIsFresh ? quote : clientQuote;
    const showLoading = !activeQuote && (isDebouncing || isLoading || parseFloat(shares) > 0);

    return {
        quote: activeQuote || null,
        isLoading: showLoading,
        error
    };
}
