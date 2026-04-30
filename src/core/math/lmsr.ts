/**
 * Canonical LMSR Math for Sooth Protocol (Continuous)
 * Implements log-sum-exp with overflow protection.
 *
 * All math is number-based (NOT BigInt) because it relies on Math.exp/Math.log.
 */

/**
 * Calculate LMSR Cost function C(q)
 * C = b * ln(sum(exp(q_i / b)))
 * Robust: M + b * ln(sum(exp((q_i - M) / b)))
 */
export function calculateLMSRCost(qYes: number, qNo: number, b: number): number {
  if (b === 0) return 0;
  const maxQ = Math.max(qYes, qNo);
  const sumExp = Math.exp((qYes - maxQ) / b) + Math.exp((qNo - maxQ) / b);
  return maxQ + b * Math.log(sumExp);
}

/**
 * Calculate Trade Cost and Price Impact using LMSR.
 *
 * @deprecated Use {@link getQuoteForOutcome} instead, which handles contract outcome encoding.
 *
 * WARNING: outcomeIndex here is LMSR-internal:
 *   0 = modifies qYes position
 *   1 = modifies qNo position
 * This is the INVERSE of contract outcome encoding (contract: 0=NO, 1=YES).
 */
export function getLMSRQuote(
  currentQYes: number,
  currentQNo: number,
  bParam: number,
  shareAmount: number,
  outcomeIndex: 0 | 1,
) {
  const currentCost = calculateLMSRCost(currentQYes, currentQNo, bParam);

  const delta = shareAmount;
  const newQYes = outcomeIndex === 0 ? currentQYes + delta : currentQYes;
  const newQNo = outcomeIndex === 1 ? currentQNo + delta : currentQNo;

  const newCost = calculateLMSRCost(newQYes, newQNo, bParam);
  const expectedCost = newCost - currentCost;

  const maxNew = Math.max(newQYes, newQNo);
  const expYes = Math.exp((newQYes - maxNew) / bParam);
  const expNo = Math.exp((newQNo - maxNew) / bParam);
  const sumExp = expYes + expNo;

  const newPriceYes = expYes / sumExp;
  const newPriceNo = expNo / sumExp;

  return {
    expectedCost,
    newPriceYes,
    newPriceNo,
    newQYes,
    newQNo,
  };
}

/**
 * Contract-encoding-aware LMSR quote wrapper.
 *
 * Maps contract outcome encoding (0=NO, 1=YES) to LMSR internal indices.
 * Use this instead of getLMSRQuote for all application-level code.
 *
 * @param params - Market state: currentQYes, currentQNo, b, delta (positive=buy, negative=sell)
 * @param contractOutcome - Contract outcome encoding: 0=NO, 1=YES
 * @returns cost and newPrice for the requested outcome
 */
export function getQuoteForOutcome(
  params: {
    currentQYes: number;
    currentQNo: number;
    b: number;
    delta: number;
  },
  contractOutcome: 0 | 1,
): { cost: number; newPrice: number } {
  // Contract encoding: 0=NO, 1=YES
  // LMSR internal: outcomeIndex 0=qYes modification, 1=qNo modification
  // So contract YES (1) → LMSR index 0, contract NO (0) → LMSR index 1
  const lmsrIndex: 0 | 1 = contractOutcome === 1 ? 0 : 1;

  const quote = getLMSRQuote(
    params.currentQYes,
    params.currentQNo,
    params.b,
    params.delta,
    lmsrIndex,
  );

  const newPrice = contractOutcome === 1 ? quote.newPriceYes : quote.newPriceNo;

  return {
    cost: quote.expectedCost,
    newPrice,
  };
}
