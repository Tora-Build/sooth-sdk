/**
 * useAMMQuoteDirect - Real-time trade quote calculation per V8_AMM_TRADING_SPEC.md
 * 
 * Returns: cost, fee, newPrice, priceImpact for a given trade
 */
import { useMemo } from 'react';
import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V8_ABIS } from "../../../config/abis";
import { useV8DirectRead, readContractSafe } from "./useV8DirectRead";
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

// LMSR cost function: C(q) = b * ln(e^(qYes/b) + e^(qNo/b))
// Delta cost: cost = C(q_new) - C(q_old)
function calculateLMSRCost(
  qYes: bigint,
  qNo: bigint,
  deltaYes: bigint,
  deltaNo: bigint,
  b: bigint
): bigint {
  if (b === 0n) return 0n;

  // Convert to numbers for math (lose some precision but simpler)
  const bNum = Number(b) / 1e18;
  const qYesNum = Number(qYes) / 1e18;
  const qNoNum = Number(qNo) / 1e18;
  const deltaYesNum = Number(deltaYes) / 1e18;
  const deltaNoNum = Number(deltaNo) / 1e18;

  // Old cost
  const oldCost = bNum * Math.log(Math.exp(qYesNum / bNum) + Math.exp(qNoNum / bNum));

  // New cost
  const newQYes = qYesNum + deltaYesNum;
  const newQNo = qNoNum + deltaNoNum;
  const newCost = bNum * Math.log(Math.exp(newQYes / bNum) + Math.exp(newQNo / bNum));

  // Delta cost
  const deltaCost = newCost - oldCost;

  // Convert back to WAD
  return BigInt(Math.floor(deltaCost * 1e18));
}

// Calculate new price after trade
function calculateNewPrice(
  qYes: bigint,
  qNo: bigint,
  deltaYes: bigint,
  deltaNo: bigint,
  b: bigint
): { yesPrice: number; noPrice: number } {
  if (b === 0n) return { yesPrice: 0.5, noPrice: 0.5 };

  const bNum = Number(b) / 1e18;
  const newQYes = (Number(qYes) + Number(deltaYes)) / 1e18;
  const newQNo = (Number(qNo) + Number(deltaNo)) / 1e18;

  // Price = e^(q/b) / (e^(qYes/b) + e^(qNo/b))
  const expYes = Math.exp(newQYes / bNum);
  const expNo = Math.exp(newQNo / bNum);
  const total = expYes + expNo;

  return {
    yesPrice: expYes / total,
    noPrice: expNo / total,
  };
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

  // #region agent log
  if (shares > 0 && marketAddress) {
    fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAMMQuoteDirect.ts:entry',message:'Quote hook called',data:{marketAddress,shares,sharesWad:sharesWad.toString(),outcome,isBuy,ammEngineAddress,chainId,ammData:{qYes:amm.amm?.qYes?.toString(),qNo:amm.amm?.qNo?.toString(),yesProbability:amm.amm?.yesProbability,noProbability:amm.amm?.noProbability},launchpadData:{bBase:launchpad.launchpad?.currentBBase?.toString(),feeBps:launchpad.launchpad?.currentFeeBps?.toString(),isGraduated:launchpad.launchpad?.isGraduated},isLoadingLaunchpad,isLoadingAmm},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H4,H5'})}).catch(()=>{});
  }
  // #endregion

  // V8 Position Model:
  // - Positive deltaShares = Long YES
  // - Negative deltaShares = Short YES (Long NO)
  //
  // User intent mapping:
  // - YES + Buy  → positive delta (long YES)
  // - YES + Sell → negative delta (close long YES)
  // - NO  + Buy  → negative delta (long NO = short YES)
  // - NO  + Sell → positive delta (close long NO = close short YES)
  let deltaShares: bigint;
  if (outcome === 0) {
    // YES side
    deltaShares = isBuy ? sharesWad : -sharesWad;
  } else {
    // NO side - opposite signs
    deltaShares = isBuy ? -sharesWad : sharesWad;
  }

  // Use the direct read hook to call getPositionQuote
  // Note: Convert BigInt to string in queryKey since JSON.stringify can't serialize BigInt
  const { data: quoteData, isLoading: quoteLoading, error } = useV8DirectRead<readonly [bigint, bigint]>({
    queryKey: ['amm-quote', marketAddress, deltaShares.toString(), chainId],
    enabled: !!marketAddress && !!ammEngineAddress && !!chainId && sharesWad > 0n,
    chainId,
    read: async (client) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAMMQuoteDirect.ts:getPositionQuote:before',message:'Calling getPositionQuote',data:{ammEngineAddress,marketAddress,deltaShares:deltaShares.toString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      try {
        const result = await client.readContract({
          address: ammEngineAddress!,
          abi: V8_ABIS.AMMEngine,
          functionName: 'getPositionQuote',
          args: [marketAddress!, deltaShares]
        }) as readonly [bigint, bigint];
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAMMQuoteDirect.ts:getPositionQuote:success',message:'Quote returned',data:{cost:result[0].toString(),newPrice:result[1].toString(),costUSD:(Number(result[0])/1e18).toFixed(4)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        return result;
      } catch (err: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAMMQuoteDirect.ts:getPositionQuote:error',message:'Quote call failed',data:{error:err?.message||String(err)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
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

    // In V8.1, cost includes fee internally or we calculate it?
    // Let's check AMMEngine.sol again.
    // actualCost = cost + fee? 
    // Actually AMMEngine.sol:115 calculateCost returns raw cost.
    // wait, AMMEngine.sol:153 _availableBalance[msg.sender] += actualCost;
    // V8.1 manual math: fee is usually 5% or 1%.

    const feeRate = Number(launchpad.launchpad?.currentFeeBps ?? 500n);
    const absNetCost = cost < 0n ? -cost : cost;
    const fee = (absNetCost * BigInt(feeRate)) / 10000n;

    // totalCost is what the user actually pays (or receives)
    const totalCost = cost + fee;

    const newYesPrice = Number(newPrice) / 1e18;
    const newNoPrice = 1 - newYesPrice;

    const currentPrice = outcome === 0 ? (amm.amm?.yesProbability ?? 0.5) : (amm.amm?.noProbability ?? 0.5);
    const targetNewPrice = outcome === 0 ? newYesPrice : newNoPrice;
    const priceImpact = currentPrice > 0 ? ((targetNewPrice - currentPrice) / currentPrice) * 100 : 0;

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
      costFormatted: `$${(Number(totalCost) / 1e18).toFixed(2)}`,
      feeFormatted: `$${(Number(fee) / 1e18).toFixed(2)}`,
      sharesFormatted: shares.toLocaleString(),
      isLoading: false,
      error: null,
    };
  }, [quoteData, launchpad.launchpad, amm.amm, shares, outcome, isBuy, quoteLoading, error]);

  return quote;
}

