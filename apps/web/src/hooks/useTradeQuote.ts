import { useEffect, useState } from 'react';
import { useMarket } from './useMarket';
import { usePublicClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { useDeployments } from './useDeployments';
import { MARKET_V4_ABI } from '../config/abis';

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

  // Input amount this quote is for (to sync with UI)
  inputAmount: number;
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



      // V4: Use on-chain calculation
      // Removed legacy V3 client-side block that was preventing V4 execution

      // Real mode: Use on-chain V4 calculation
      if (!publicClient || !market?.contractAddress) {
        if (!cancelled) setQuote(null);
        return;
      }

      // Skip contract calls for placeholder/demo addresses (0x00...00b1 pattern)
      const isPlaceholderAddress = market.contractAddress.match(/^0x0{38}[a-f0-9]{2}$/i);
      if (isPlaceholderAddress) {
        // Use client-side quote for demo markets with placeholder addresses
        const demoQuote = computeClientQuote(market, outcomeIndex, shareAmount, slippageBps);
        if (!cancelled) setQuote(demoQuote);
        return;
      }

      // Capture market address to satisfy TS in closure
      const marketAddress = market.contractAddress as `0x${string}`;

      try {
        // Use raw string for BigInt conversion to avoid float precision issues
        const isSell = shares.startsWith('-');
        const absSharesStr = shares.replace(/^-/, '');
        const shareAmountBig = parseUnits(absSharesStr, 18);
        const isBuy = !isSell;

        // Calculate AMM Cost if cost matches
        const result = await publicClient.readContract({
          address: market.contractAddress as `0x${string}`,
          abi: MARKET_V4_ABI,
          functionName: 'calculateAMMTradeCost',
          args: [
            outcomeIndex,
            shareAmountBig,
            isBuy
          ]
        }) as [bigint, bigint, bigint, bigint]; // V4: Returns (cost, fee, newQYes, newQNo)

        const [rawCost, rawFee, newQYes, newQNo] = result;

        // Cost is usually positive for buy. Fee is positive.
        // Total cost = rawCost + rawFee
        const costFloat = parseFloat(formatUnits(rawCost, 18));
        const feeFloat = parseFloat(formatUnits(rawFee, 18));

        // Cost might be negative if sell (receiving output)
        const expectedCost = Math.abs(costFloat);
        const fee = feeFloat;

        // Calculate Price Impact for continuous LMSR
        const oldPriceYes = market.priceYes || 0.5;

        // For continuous LMSR, p_yes = exp(qYes/b) / (exp(qYes/b) + exp(qNo/b))
        // Fetch b from market for accurate calculation
        const bVal = market.bParam ? Number(formatUnits(BigInt(market.bParam.toString()), 18)) : 10000;

        const qYesNum = parseFloat(formatUnits(newQYes, 18));
        const qNoNum = parseFloat(formatUnits(newQNo, 18));

        // LMSR softmax formula
        let newPriceYesCalculated = 0.5;
        if (bVal > 0) {
          const expYes = Math.exp(qYesNum / bVal);
          const expNo = Math.exp(qNoNum / bVal);
          newPriceYesCalculated = expYes / (expYes + expNo);
          // Clamp to valid range
          newPriceYesCalculated = Math.max(0.001, Math.min(0.999, newPriceYesCalculated));
        }
        const newPriceNoCalculated = 1 - newPriceYesCalculated;

        const priceImpact = oldPriceYes > 0
          ? Math.abs(newPriceYesCalculated - oldPriceYes) / oldPriceYes
          : 0;

        // Slippage
        const BPS = 10000;
        const maxWithSlippage = isBuy
          ? expectedCost * (1 + (slippageBps + 50) / BPS)
          : Number(rawCost) * (1 - (slippageBps + 50) / BPS);

        // executeAMMTrade returns `cost`. 
        // If buy: positive cost (user pays).
        // If sell: negative cost (user receives).

        // maxCost arg for tradeAMM:
        // If buy: positive max amount to pay
        // If sell: negative min amount to receive (e.g. -90 means must receive at least 90)

        // Correction for maxWithSlippage logic:
        // We need `maxWithSlippage` to pass to `tradeAMM` as `maxCost`.
        // If buy (cost > 0): maxCost = expectedCost * 1.05
        // If sell (cost < 0): maxCost = -(|expectedCost| * 0.95) = expectedCost * 0.95 (keeping sign)

        let maxCostParam = 0;
        let minReceivedParam = undefined;

        if (costFloat > 0) {
          // Buying
          maxCostParam = costFloat * (1 + (slippageBps + 10) / BPS); // +0.1% buffer
        } else {
          // Selling
          // Cost is negative (e.g. -100). We want to receive at least 99.
          // maxCost param should be -99.
          // so maxCost = costFloat * (1 - slippage) ?
          // -100 * (1 - 0.01) = -99. Correct. 
          // Wait, if slippage is 5% -> 0.05.
          // -100 * 0.95 = -95. Correct.
          maxCostParam = costFloat * (1 - (slippageBps + 10) / BPS);
          minReceivedParam = Math.abs(maxCostParam);
        }

        if (!cancelled) {
          setQuote({
            expectedCost,
            priceImpact,
            newPriceYes: newPriceYesCalculated,
            newPriceNo: newPriceNoCalculated,
            fee,
            totalCost: expectedCost + fee,
            suggestedSlippageBps: 50,
            maxWithSlippage: Math.abs(maxCostParam), // UI usually wants positive number
            minReceived: minReceivedParam,
            inputAmount: parseFloat(shares)
          });
        }
      } catch (err) {
        console.warn('useTradeQuote V4 call failed, falling back to client-side est.', err);

        // Fallback: Use robust client-side LMSR calculation
        // This ensures meaningful numbers even if on-chain simulation fails temporarily
        if (market) {
          const clientQuote = computeClientQuote(market, outcomeIndex, parseFloat(shares), slippageBps);
          if (!cancelled && clientQuote) {
            setQuote(clientQuote);
          }
        }
      }
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
    inputAmount: shareAmount
  };
}
