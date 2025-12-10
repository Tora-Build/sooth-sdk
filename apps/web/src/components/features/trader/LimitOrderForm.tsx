import React, { useState, useRef, useEffect } from 'react';
import { useLimitOrder } from '../../../hooks/useLimitOrder';
import { useTrade } from '../../../hooks/useTrade';
import { useContent } from '../../../hooks/useContent';
import { Button } from '../../ui/Button';
import { cn } from '../../../lib/utils';
import { useMarket } from '../../../hooks/useMarket';
import { useOrderbook } from '../../../hooks/useOrderbook';
import { parseUnits, formatUnits } from 'viem';
import toast from 'react-hot-toast';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { OUTCOME_TOKEN_ABI } from '../../../config/abis';
import { useDeployments } from '../../../hooks/useDeployments';

interface LimitOrderFormProps {
  marketId: string;
  selectedOutcome?: 0 | 1;
  onOutcomeChange?: (outcome: 0 | 1) => void;
}

export const LimitOrderForm: React.FC<LimitOrderFormProps> = ({
  marketId,
  selectedOutcome: propOutcome = 0,
  onOutcomeChange
}) => {
  const { address } = useAccount();
  const { t } = useContent();
  const deployments = useDeployments();
  const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;

  const { placeOrder, placeSpotOrder, isPending: isLimitPending, availableBalance } = useLimitOrder(marketId);
  const { trade, isPending: isTradePending } = useTrade(marketId);
  const isPending = isLimitPending || isTradePending;

  const { market } = useMarket(marketId);
  const { bids, asks } = useOrderbook(marketId);

  const { writeContractAsync } = useWriteContract();

  // Check Approval
  const outcomeTokenAddress = market?.outcomeTokenAddress as `0x${string}`;

  const { data: isApproved, refetch: refetchApproval } = useReadContract({
    address: outcomeTokenAddress,
    abi: OUTCOME_TOKEN_ABI,
    functionName: 'isApprovedForAll',
    args: [address || '0x0', traderVaultAddress],
    query: {
      enabled: !!address && !!outcomeTokenAddress && !!traderVaultAddress
    }
  });

  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [outcome, setOutcome] = useState<0 | 1>(propOutcome);
  const [amount, setAmount] = useState('10');
  const [price, setPrice] = useState('');
  const incrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const decrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const handleOutcomeChange = (newOutcome: 0 | 1) => {
    setOutcome(newOutcome);
    onOutcomeChange?.(newOutcome);
  };

  const currentMarketPrice = outcome === 0 ? market?.priceYes : market?.priceNo;
  const priceNum = parseFloat(price) || 0;
  const amountNum = parseFloat(amount) || 0;

  // Determine Sell Mode
  // AMM Shares cannot be Limit Sold (Link failure). Only Token Shares can be Spot Sold.
  const userTokenShares = outcome === 0 ? (market?.userYesOutcomeTokens || 0) : (market?.userNoOutcomeTokens || 0);

  const isSpotSell = orderType === 'sell' && userTokenShares >= amountNum;
  const isHybridSell = orderType === 'sell' && userTokenShares > 0 && userTokenShares < amountNum;

  // V3 Unified Orderbook:
  // Buy: You pay Price * Amount
  // Spot Sell: You pay Shares (Collateral). No USDC cost.
  // Short Sell: You pay (1 - Price) * Amount as USDC Collateral
  // Hybrid Sell: Spot part pays shares, Short part pays collateral

  const sharesToSpotSell = isHybridSell ? userTokenShares : (isSpotSell ? amountNum : 0);
  const sharesToShortSell = isHybridSell ? (amountNum - userTokenShares) : (!isSpotSell && orderType === 'sell' ? amountNum : 0);

  // Cost Per Share Display (Weighted Average for Hybrid?)
  // Spot part = 0 USDC. Short part = (1 - Price) USDC.
  // totalCost = ShortPart * (1 - Price)
  // costPerShare = totalCost / amountNum

  let totalCost = 0;
  if (orderType === 'buy') {
    totalCost = priceNum * amountNum;
  } else {
    // Sell Side
    const shortCost = (1 - priceNum) * sharesToShortSell;
    totalCost = shortCost; // Spot part costs 0 USDC
  }

  const costPerShare = amountNum > 0 ? (totalCost / amountNum) : 0;

  const isValidPrice = priceNum > 0 && priceNum < 1;

  // Handicap Logic (For Price Display Reference Only - No Auto Routing)
  const isBuyingYes = (orderType === 'buy' && outcome === 0) || (orderType === 'sell' && outcome === 1);
  const bestAsk = asks[0] ? parseFloat(asks[0].yesPrice) : null;
  const bestBid = bids[0] ? parseFloat(bids[0].yesPrice) : null;

  let bestBookPrice = isBuyingYes ? bestAsk : bestBid;
  if (bestBookPrice !== null && outcome === 1) {
    bestBookPrice = 1 - bestBookPrice;
  }

  // Note: bestBookPrice is already set to the relevant side (Ask for Buy, Bid for Sell)
  const isCrossingBook = bestBookPrice !== null && (
    orderType === 'buy' ? priceNum >= bestBookPrice : priceNum <= bestBookPrice
  );

  const needsApproval = (isSpotSell || isHybridSell) && !isApproved;

  const handleApprove = async () => {
    if (!outcomeTokenAddress || !traderVaultAddress) {
      toast.error("Missing token or vault address for approval.");
      return;
    }
    setIsApproving(true);
    try {
      await writeContractAsync({
        address: outcomeTokenAddress,
        abi: OUTCOME_TOKEN_ABI,
        functionName: 'setApprovalForAll',
        args: [traderVaultAddress, true],
      });
      toast.success("Approval successful!");
      refetchApproval(); // Refetch approval status after successful approval
    } catch (error) {
      console.error("Approval failed:", error);
      toast.error("Approval failed. Please try again.");
    } finally {
      setIsApproving(false);
    }
  };

  const handlePlaceOrder = async () => {
    console.log('handlePlaceOrder Triggered', {
      step: 'start',
      needsApproval,
      approved: isApproved,
      amount,
      price,
      isValidPrice,
      orderType
    });

    if (needsApproval) {
      console.log('handlePlaceOrder: Needs Approval, calling handleApprove');
      await handleApprove();
      return;
    }

    if (!amount || !price || !isValidPrice) {
      console.warn('handlePlaceOrder: Validation Failed', { amount, price, isValidPrice });
      return;
    }

    console.log('handlePlaceOrder: Validation Passed, Proceeding to execution');

    // Strict Orderbook Logic - No AMM Routing
    if (orderType === 'buy') {
      console.log('handlePlaceOrder: Executing Buy Order');
      try {
        await placeOrder(outcome, price, amount, true);
        console.log('handlePlaceOrder: Buy Order function returned');
      } catch (e) {
        console.error('handlePlaceOrder: Buy Order Error', e);
      }
    } else {
      // Sell Side
      if (isSpotSell) {
        // Fully covered by shares
        await placeSpotOrder(outcome, price, amount);
      } else if (isHybridSell) {
        // Mixed: Spot Sell Available Shares -> Short Sell Remaining
        // Note: Sequential execution. Ideally would be batched.

        // 1. Spot Sell
        const spotAmountStr = sharesToSpotSell.toString();
        const toastId = toast.loading('Executing Part 1: Spot Sell (' + spotAmountStr + ')');
        try {
          await placeSpotOrder(outcome, price, spotAmountStr);
          toast.success('Part 1 Complete', { id: toastId });
        } catch (e) {
          toast.error('Spot Sell Failed', { id: toastId });
          return;
        }

        // 2. Short Sell
        const shortAmountStr = sharesToShortSell.toString();
        const toastId2 = toast.loading('Executing Part 2: Short Sell (' + shortAmountStr + ')');
        try {
          await placeOrder(outcome, price, shortAmountStr, false);
          toast.success('Part 2 Complete', { id: toastId2 });
        } catch (e) {
          toast.error('Short Sell Failed', { id: toastId2 });
        }

      } else {
        // No shares -> Full Short Sell
        await placeOrder(outcome, price, amount, false);
      }
    }
  };


  // ... (Amount/Price controls remain same) ...
  // Removing redundant variable declarations to ensure code compiles (handled in previous step, but ensuring standard structure)
  const handleIncrement = () => setAmount(prev => String(parseFloat(prev || '1') + 1));
  const handleDecrement = () => setAmount(prev => String(Math.max(1, parseFloat(prev || '1') - 1)));
  const startIncrement = () => { handleIncrement(); incrementIntervalRef.current = setInterval(handleIncrement, 100); };
  const startDecrement = () => { handleDecrement(); decrementIntervalRef.current = setInterval(handleDecrement, 100); };
  const stopIncrement = () => { if (incrementIntervalRef.current) { clearInterval(incrementIntervalRef.current); incrementIntervalRef.current = null; } };
  const stopDecrement = () => { if (decrementIntervalRef.current) { clearInterval(decrementIntervalRef.current); decrementIntervalRef.current = null; } };

  const priceIncRef = useRef<NodeJS.Timeout | null>(null);
  const priceDecRef = useRef<NodeJS.Timeout | null>(null);
  const handlePriceInc = () => setPrice(p => Math.min(0.99, (parseFloat(p || '0.5') + 0.01)).toFixed(2));
  const handlePriceDec = () => setPrice(p => Math.max(0.01, (parseFloat(p || '0.5') - 0.01)).toFixed(2));
  const startPriceInc = () => { handlePriceInc(); priceIncRef.current = setInterval(handlePriceInc, 100); };
  const startPriceDec = () => { handlePriceDec(); priceDecRef.current = setInterval(handlePriceDec, 100); };
  const stopPriceInc = () => { if (priceIncRef.current) clearInterval(priceIncRef.current); };
  const stopPriceDec = () => { if (priceDecRef.current) clearInterval(priceDecRef.current); };

  const handlePriceChange = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) setPrice(val);
    else if (num < 0.01) setPrice('0.01');
    else if (num > 0.99) setPrice('0.99');
    else setPrice(val);
  };

  // Note: isBuyingYes, bestAsk, bestBid are defined at component scope above.

  // If orderbook empty, fallback to AMM price for reference, but prefer book
  let currentHandicap = isBuyingYes
    ? (bestAsk !== null ? bestAsk : null)
    : (bestBid !== null ? bestBid : null);

  // If we have a book price, check if logic inversion is needed for display
  if (currentHandicap !== null && outcome === 1) {
    currentHandicap = 1 - currentHandicap;
  }

  // Final fallback to AMM price if book is empty
  if (currentHandicap === null) {
    currentHandicap = currentMarketPrice || 0.5; // Default fallback to 0.5 if Price undefined
  }

  // Default price logic
  useEffect(() => {
    if (currentHandicap) {
      setPrice(currentHandicap.toFixed(2));
    }
  }, [currentHandicap, orderType, outcome]);

  const ammLiquidity = market?.bParam ? parseFloat(formatUnits(market.bParam, 18)) : 0;
  // REMOVED AMM Routing logic (willRouteToAMM = false always for Limit Order Form)
  const willRouteToAMM = false;

  const orderbookDepth = bids.length + asks.length;
  // Note: isPending is defined above
  const isDisabled = !amount || !isValidPrice || isPending || market?.status !== 'trading';

  // Only disable if user needs to approve AND is currently approving
  // We allow clicking "Approve Manager" so don't disable if needsApproval is true
  const insufficientBalance = React.useMemo(() => {
    if (!totalCost && !amountNum) return false;

    // Spot Sell: Check Shares (already checked via isSpotSell flag logic)
    if (isSpotSell) return false; // We have shares logic above sets isSpotSell=true only if we have shares.

    // Buy / Short Sell / Hybrid: Require USDC Collateral for the UNCOVERED portion
    // totalCost correctly calculates only the Short portion cost
    // So logic holds: availableBalance >= totalCost.

    const requiredCollateral = parseUnits(totalCost.toFixed(6), 18);
    const hasEnoughUSDC = (availableBalance || 0n) >= requiredCollateral;
    return !hasEnoughUSDC;

  }, [orderType, totalCost, amountNum, availableBalance, isSpotSell, isHybridSell]);

  // Only disable if user needs to approve AND is currently approving
  // We allow clicking "Approve Manager" so don't disable if needsApproval is true
  const isActionDisabled = isDisabled || insufficientBalance || (needsApproval && isApproving);

  // Helper text for badge
  const badgeText = isCrossingBook
    ? "⚡ Executing against Orderbook. You will be refunded any price improvement."
    : "⏳ Limit orders wait in orderbook until filled.";

  const badgeColor = isCrossingBook ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10";

  // Check balance for buy logic above (omitted for brevity)

  const getButtonText = () => {
    if (needsApproval) {
      return isApproving ? "Approving..." : "Approve Manager";
    }

    // Default Button Text
    const action = orderType === 'buy' ? t('trading.buy') : t('trading.sell');
    const outcomeText = outcome === 0 ? t('common.yes') : t('common.no');

    if (insufficientBalance) {
      if (orderType === 'buy') {
        return t('trading.insufficientBalance', { amount: (Number(availableBalance || 0n) / 1e18).toFixed(0) });
      } else {
        // Short Sell Checks (Spot Sell bypasses this via insufficientBalance=false)
        return t('trading.needCollateral', { amount: totalCost.toFixed(2) });
      }
    }

    if (orderType === 'sell') {
      // 1. Spot Sell (Backed by Token Shares)
      if (isSpotSell) {
        return `${action} ${outcomeText} (Spot)`;
      }
      // 2. Hybrid Sell (Partial Spot, Partial Short)
      if (isHybridSell) {
        return `${action} ${outcomeText} (Hybrid)`;
      }
      // 3. Short Sell (Backed by Collateral)
      return `${action} ${outcomeText} (Short)`;
    }

    return `${action} ${outcomeText}`;
  };

  return (
    <div className="space-y-4">


      {/* Market Info Bar */}
      <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-slate-950/50 border border-slate-800">
        <div>
          <div className="text-xs text-slate-500">{t('trading.marketPrice')}</div>
          <div className="text-lg font-bold text-white font-mono">
            {(currentMarketPrice ?? 0.5).toFixed(2)} <span className="text-sm text-indigo-400">{t('common.usdc')}</span>
          </div>
        </div >
        <div className="text-right">
          <div className="text-xs text-slate-500">{t('trading.bestPrice')}</div>
          <div className="text-lg font-bold text-emerald-400 font-mono">
            {currentHandicap?.toFixed(2) || '—'} <span className="text-sm text-emerald-600/70">{t('common.usdc')}</span>
          </div>
        </div>
        <div className="col-span-2 flex justify-between pt-2 border-t border-slate-800/50 text-[10px] text-slate-500 font-mono">
          <span>LQ: ${ammLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span>Depth: {orderbookDepth} offers</span>
        </div>
      </div >

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2" >
        <button
          onClick={() => setOrderType('buy')}
          className={cn("h-11 rounded-lg border-2 font-bold text-white transition-all",
            orderType === 'buy' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 hover:border-emerald-500/30'
          )}
        >{t('trading.buy').toUpperCase()}</button>
        <button
          onClick={() => setOrderType('sell')}
          className={cn("h-11 rounded-lg border-2 font-bold text-white transition-all",
            orderType === 'sell' ? 'border-rose-500 bg-rose-500/10' : 'border-slate-800 hover:border-rose-500/30'
          )}
        >{t('trading.sell').toUpperCase()}</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleOutcomeChange(0)}
          className={cn("h-11 rounded-lg border-2 font-bold text-white transition-all",
            outcome === 0 ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 hover:border-emerald-500/30'
          )}
        >{t('common.yes')}</button>
        <button
          onClick={() => handleOutcomeChange(1)}
          className={cn("h-11 rounded-lg border-2 font-bold text-white transition-all",
            outcome === 1 ? 'border-rose-500 bg-rose-500/10' : 'border-slate-800 hover:border-rose-500/30'
          )}
        >{t('common.no')}</button>
      </div>

      {/* Price Input (Limit Order) */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{t('trading.yourPrice')}</span>
          <span>0.01 – 0.99</span>
        </div>
        <div className="relative h-12">
          <button
            onMouseDown={startPriceDec} onMouseUp={stopPriceDec} onMouseLeave={stopPriceDec}
            className="absolute left-0 top-0 h-full w-12 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-l-lg z-10"
            type="button"
          >−</button>
          <input
            type="number"
            value={price}
            onChange={(e) => handlePriceChange(e.target.value)}
            className="w-full h-full bg-slate-950/50 border border-slate-800 rounded-lg px-14 text-lg font-mono text-center text-white focus:outline-none focus:border-indigo-500"
            min="0.01" max="0.99" step="0.01"
          />
          <button
            onMouseDown={startPriceInc} onMouseUp={stopPriceInc} onMouseLeave={stopPriceInc}
            className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-r-lg z-10"
            type="button"
          >+</button>
        </div>
        {/* Price validation message */}
        {price && currentMarketPrice && (
          <div className={cn("text-xs mt-1.5 px-2 py-1 rounded", badgeColor)}>
            {badgeText}
          </div>
        )}
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-1">{t('trading.shares')}</div>
        <div className="relative h-12">
          <button
            onMouseDown={startDecrement} onMouseUp={stopDecrement} onMouseLeave={stopDecrement}
            className="absolute left-0 top-0 h-full w-12 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-l-lg z-10"
            type="button"
          >−</button>
          <input
            type="number"
            value={amount}
            onChange={(e) => {
              const val = e.target.value;
              // Only allow positive integers (no decimals)
              if (!val || /^\d*$/.test(val)) {
                setAmount(val);
              }
            }}
            className="w-full h-full bg-slate-950/50 border border-slate-800 rounded-lg px-14 text-lg font-mono text-center text-white focus:outline-none focus:border-indigo-500"
            min="1" step="1"
          />
          <button
            onMouseDown={startIncrement} onMouseUp={stopIncrement} onMouseLeave={stopIncrement}
            className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-r-lg z-10"
            type="button"
          >+</button>
        </div>

        {/* Spot Balance Display */}
        <div className="flex justify-end mt-1">
          <span className="text-[10px] text-slate-500">
            Spot Balance: <span className="font-mono text-emerald-400 font-bold">{outcome === 0 ? market?.userYesOutcomeTokens : market?.userNoOutcomeTokens}</span>
          </span>
        </div>
      </div>

      {/* Order Summary */}
      <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">
            {orderType === 'buy' ? t('trading.costPerShare') : 'Collateral / Share'}
          </span>
          <span className="font-mono text-white">{costPerShare.toFixed(2)} {t('common.usdc')}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-slate-800 pt-1.5">
          <span className="text-slate-400 font-medium">
            {orderType === 'buy' ? t('trading.totalCost') : 'Required Collateral'}
          </span>
          <span className="font-mono font-bold text-white">{totalCost.toFixed(2)} {t('common.usdc')}</span>
        </div>
      </div>

      {/* Action Button */}
      <Button
        onClick={handlePlaceOrder}
        disabled={isActionDisabled}
        isLoading={isPending || isApproving}
        className={cn("w-full h-12 font-bold",
          isActionDisabled ? "bg-slate-700" : orderType === 'buy' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
        )}
      >
        {getButtonText()}
      </Button>{/* Footer */}
      <div className="text-center text-[10px] text-slate-600">
        {badgeText}
      </div>
    </div >
  );
};
