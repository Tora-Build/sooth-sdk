import { useEffect, useState } from 'react';
import { useMarket } from './useMarket';
import { usePublicClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { useDeployments } from './useDeployments';
import { SOOTH_BALANCED_AMM_ABI } from '../config/abis';

/**
 * LMSR (Logarithmic Market Scoring Rule) Trade Quote Calculator
 * 
 * Formula: C(q) = b * ln(e^(qYes/b) + e^(qNo/b))
 * Cost of trade: cost = C(q + Δq) - C(q)
 */

interface TradeQuote {
  // Cost in USDC
  expectedCost: number;
  maxWithSlippage: number;
  
  // Price impact as percentage (0-100)
  priceImpact: number;
  
  // New implied probability after trade (0-1)
  newPriceYes: number;
  newPriceNo: number;
  
  // Fee estimate
  fee: number;
  
  // Total cost including fees
  totalCost: number;
  
  // Suggested slippage tolerance in basis points
  suggestedSlippageBps: number;
  
  // For sells (future use)
  minReceived?: number;
}

export function useTradeQuote(
  marketId: string,
  outcomeIndex: 0 | 1,
  shares: string,
  slippageBps: number = 50
): TradeQuote | null {
  const { market } = useMarket(marketId);
  const publicClient = usePublicClient();
  const deployments = useDeployments();
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  
  // Recompute on inputs
  useEffect(() => {
    let cancelled = false;
    
    const run = async () => {
      if (!market || !shares) {
        if (!cancelled) setQuote(null);
        return;
      }

      const shareAmount = parseFloat(shares);
      if (shareAmount === 0 || isNaN(shareAmount)) {
        if (!cancelled) setQuote(null);
        return;
      }

      // Demo mode keeps previous client-side math
      if (market.mode === 'demo') {
        const demoQuote = computeClientQuote(market, outcomeIndex, shareAmount, slippageBps);
        if (!cancelled) setQuote(demoQuote);
        return;
      }

      // v3: Use client-side calculation for now (AMM costDelta not available in v3)
      // TODO: Use Market.getPrice() for more accurate quotes
      try {
        const clientQuote = computeClientQuote(market, outcomeIndex, shareAmount, slippageBps);
        if (!cancelled) setQuote(clientQuote);
        return;
      } catch (clientErr) {
        console.error('Client-side quote calculation failed', clientErr);
        if (!cancelled) setQuote(null);
        return;
      }

      /* v2 AMM costDelta - disabled for v3
      // Real mode: use on-chain AMM costDelta for exact alignment with wallet prompt
      if (!publicClient) {
        if (!cancelled) setQuote(null);
        return;
      }

      try {
        const b = market.bParam || 0n;
        
        // If bParam is 0, skip on-chain call and use client-side fallback
        // This prevents "LMSR: b = 0" contract revert
        if (b === 0n) {
          throw new Error('bParam is 0, using client-side fallback');
        }
        
        const qYes = market.qYes || 0n;
        const qNo = market.qNo || 0n;
        const sharesBig = parseUnits(shares, 18);
        const ammAddress = deployments.SoothLMSRReal as `0x${string}`;

        // costDelta((qYes, qNo), outcomeIndex, deltaShares, b)
        const result = await publicClient.readContract({
          address: ammAddress,
          abi: SOOTH_BALANCED_AMM_ABI,
          functionName: 'costDelta',
          args: [
            { qYes, qNo },
            outcomeIndex,
            sharesBig,
            b
          ]
        }) as [bigint, { qYes: bigint; qNo: bigint }];

        const pureCost = result[0];
        const newState = result[1];

        // Apply 0.2% fee (aligned with trade hook)
        const FEE_BPS = 20n;
        const BPS = 10000n;
        const costWithFee = sharesBig > 0n
          ? pureCost * (BPS + FEE_BPS) / BPS
          : pureCost * (BPS - FEE_BPS) / BPS;

        const expectedCost = Number(formatUnits(costWithFee, 18));

        // Apply slippage with the same integer math as trade.ts
        let maxCost: bigint;
        const slippage = BigInt(slippageBps);
        if (sharesBig > 0n) {
          maxCost = costWithFee * (BPS + slippage) / BPS;
        } else {
          maxCost = costWithFee * (BPS - slippage) / BPS;
        }
        const maxWithSlippage = Number(formatUnits(maxCost >= 0 ? maxCost : -maxCost, 18));

        // Get new prices from AMM for price impact and post-trade probability
        const [priceYesAfter, priceNoAfter] = await Promise.all([
          publicClient.readContract({
            address: ammAddress,
            abi: SOOTH_BALANCED_AMM_ABI,
            functionName: 'price',
            args: [newState, 0, b]
          }) as Promise<bigint>,
          publicClient.readContract({
            address: ammAddress,
            abi: SOOTH_BALANCED_AMM_ABI,
            functionName: 'price',
            args: [newState, 1, b]
          }) as Promise<bigint>,
        ]);

        const newPriceYes = Number(formatUnits(priceYesAfter, 18));
        const newPriceNo = Number(formatUnits(priceNoAfter, 18));

        const oldPrice = outcomeIndex === 0 ? market.priceYes : market.priceNo;
        const newPrice = outcomeIndex === 0 ? newPriceYes : newPriceNo;
        const priceImpact = Math.abs((newPrice - oldPrice) / oldPrice) * 100;

        // Fee display uses 0.5% default (matches SoothGovernorVault)
        const fee = Math.abs(expectedCost) * 0.005;
        const totalCost = expectedCost; // already includes fee in costWithFee

        let suggestedSlippageBps = 50;
        if (priceImpact > 5) suggestedSlippageBps = 200;
        else if (priceImpact > 2) suggestedSlippageBps = 100;

        if (!cancelled) {
          setQuote({
            expectedCost,
            priceImpact,
            newPriceYes,
            newPriceNo,
            fee,
            totalCost,
            suggestedSlippageBps,
            maxWithSlippage,
          });
        }
      } catch (err) {
        console.error('useTradeQuote on-chain quote failed', err);
        
        // Fallback to client-side calculation to prevent UI flickering
        try {
          const clientQuote = computeClientQuote(market, outcomeIndex, shareAmount, slippageBps);
          if (!cancelled) setQuote(clientQuote);
        } catch (clientErr) {
          console.error('Client-side fallback failed', clientErr);
          if (!cancelled) setQuote(null);
        }
      }
      */
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [market, outcomeIndex, shares, publicClient, slippageBps]);
  
  return quote;
}


/**
 * Calculate LMSR cost function: C(q) = b * ln(e^(qYes/b) + e^(qNo/b))
 */
export function calculateCostFunction(qYes: number, qNo: number, b: number): number {
  // Use log-sum-exp trick for numerical stability
  const maxQ = Math.max(qYes, qNo);
  const expYes = Math.exp((qYes - maxQ) / b);
  const expNo = Math.exp((qNo - maxQ) / b);
  
  return b * (maxQ / b + Math.log(expYes + expNo));
}

// Legacy client-side quote for demo mode (kept for mock markets)
export function computeClientQuote(market: any, outcomeIndex: 0 | 1, shareAmount: number, slippageBps: number): TradeQuote | null {
  const { qYes, qNo, bParam, priceYes, priceNo } = market;

  const b = Number(bParam) / 1e18;
  const currentQYes = Number(qYes) / 1e18;
  const currentQNo = Number(qNo) / 1e18;

  const currentCost = calculateCostFunction(currentQYes, currentQNo, b);
  const newQYes = outcomeIndex === 0 ? currentQYes + shareAmount : currentQYes;
  const newQNo = outcomeIndex === 1 ? currentQNo + shareAmount : currentQNo;
  const newCost = calculateCostFunction(newQYes, newQNo, b);

  const expectedCost = newCost - currentCost;
  const total = Math.exp(newQYes / b) + Math.exp(newQNo / b);
  const newPriceYes = Math.exp(newQYes / b) / total;
  const newPriceNo = Math.exp(newQNo / b) / total;

  const oldPrice = outcomeIndex === 0 ? priceYes : priceNo;
  const newPrice = outcomeIndex === 0 ? newPriceYes : newPriceNo;
  const priceImpact = Math.abs((newPrice - oldPrice) / oldPrice) * 100;

  // Fee is always positive (expense). Cost is signed (- = income, + = expense).
  const fee = Math.abs(expectedCost) * 0.005;
  // Buy: 100 + 0.5 = 100.5 (Pay more)
  // Sell: -100 + 0.5 = -99.5 (Receive less, closer to 0)
  const totalCost = expectedCost + fee;

  // Match trade.ts slippage math (no precision buffer)
  const BPS = 10000;
  const maxWithSlippage = expectedCost > 0
    ? Math.abs(totalCost) * (1 + slippageBps / BPS)
    : Math.abs(totalCost) * (1 - slippageBps / BPS);

  let suggestedSlippageBps = 50;
  if (priceImpact > 5) suggestedSlippageBps = 200;
  else if (priceImpact > 2) suggestedSlippageBps = 100;

  return {
    expectedCost,
    priceImpact,
    newPriceYes,
    newPriceNo,
    fee,
    totalCost,
    suggestedSlippageBps,
    maxWithSlippage,
  };
}
