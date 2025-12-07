import React, { useState, useRef, useEffect } from 'react';
import { useLimitOrder } from '../../../hooks/useLimitOrder';
import { useTrade } from '../../../hooks/useTrade';
import { useContent } from '../../../hooks/useContent';
import { Button } from '../../ui/Button';
import { cn } from '../../../lib/utils';
import { useMarket } from '../../../hooks/useMarket';
import { useOrderbook } from '../../../hooks/useOrderbook';
import { parseUnits, formatUnits } from 'viem';

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
  const { t } = useContent();
  const { placeOrder, isPending: isLimitPending, availableBalance } = useLimitOrder(marketId);
  const { trade, isPending: isTradePending } = useTrade(marketId);
  const isPending = isLimitPending || isTradePending;
  
  const { market } = useMarket(marketId);
  const { bids, asks } = useOrderbook(marketId);
  
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [outcome, setOutcome] = useState<0 | 1>(propOutcome);
  const [amount, setAmount] = useState('10');
  const [price, setPrice] = useState('');
  const incrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const decrementIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleOutcomeChange = (newOutcome: 0 | 1) => {
    setOutcome(newOutcome);
    onOutcomeChange?.(newOutcome);
  };

  const currentMarketPrice = outcome === 0 ? market?.priceYes : market?.priceNo;
  const priceNum = parseFloat(price) || 0;
  const amountNum = parseFloat(amount) || 0;

  // V3 Unified Orderbook: You pay price * amount for your order
  const costPerShare = priceNum;
  const totalCost = costPerShare * amountNum;

  const isValidPrice = priceNum > 0 && priceNum < 1;
  
  // Define Handicap Variables needed for Routing Logic
  const isBuyingYes = (orderType === 'buy' && outcome === 0) || (orderType === 'sell' && outcome === 1);
  const bestAsk = asks[0] ? parseFloat(asks[0].yesPrice) : null;
  const bestBid = bids[0] ? parseFloat(bids[0].yesPrice) : null;

  // Best Available Price on the BOOK (for comparison)
  // If Buying YES, we want Lowest Ask. If Selling YES, we want Highest Bid.
  // Note: bestAsk/bestBid are always in YES terms from hook.
  let bestBookPrice = isBuyingYes ? bestAsk : bestBid; 
  
  // Transform Book Price to User View if needed (NO view)
  if (bestBookPrice !== null && outcome === 1) {
    bestBookPrice = 1 - bestBookPrice;
  }

  // 2. Check Crossing
  // - Crossing AMM: Price crosses current AMM q-price
  // - Crossing Book: Price crosses Best Ask (Buy) or Best Bid (Sell)
  
  const isCrossingAMM = currentMarketPrice 
    ? (orderType === 'buy' ? priceNum >= currentMarketPrice : priceNum <= currentMarketPrice)
    : false;
    
  // Note: bestBookPrice is already set to the relevant side (Ask for Buy, Bid for Sell)
  const isCrossingBook = bestBookPrice !== null && (
     orderType === 'buy' ? priceNum >= bestBookPrice : priceNum <= bestBookPrice
  );

  const isCrossing = isCrossingAMM || isCrossingBook;

  // Use AMM if crossing AND (Book Empty OR AMM Price is Better for user)
  const ammIsBetter = bestBookPrice === null || (
     currentMarketPrice !== undefined && (
       orderType === 'buy' ? currentMarketPrice < bestBookPrice : currentMarketPrice > bestBookPrice
     )
  );

  const handlePlaceOrder = async () => {
    if (!amount || !price || !isValidPrice) return;
    
    // Router Logic
    // 1. If crossing AMM and AMM is better -> Trade
    if (isCrossingAMM && ammIsBetter) {
       const tradeAmount = orderType === 'buy' ? amount : `-${amount}`;
       await trade(outcome, tradeAmount); 
    } 
    // 2. Otherwise (Crossing Book OR Passive) -> Place Order
    // The contract _tryMatch will handle immediate execution if it crosses the book.
    else {
       if (orderType === 'buy') {
         await placeOrder(outcome, price, amount);
       } else {
         const oppositeOutcome = outcome === 0 ? 1 : 0;
         const invertedPrice = (1 - priceNum).toFixed(18);
         await placeOrder(oppositeOutcome, invertedPrice, amount);
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
  const willRouteToAMM = isCrossingAMM && ammIsBetter;

  const orderbookDepth = bids.length + asks.length;
  const isDisabled = !amount || !isValidPrice || isPending || market?.status !== 'trading';
  
  const insufficientBalance = React.useMemo(() => {
    if (!totalCost && !amountNum) return false;
    
    if (orderType === 'buy') {
        // Buy always needs USDC
        return (availableBalance || 0n) < parseUnits(totalCost.toFixed(6), 18);
    } else {
        // Sell Logic
        // 1. Must have enough SHARES to sell (prevent naked shorting via Sell tab)
        const userShares = outcome === 0 ? (market?.userYesShares || 0) : (market?.userNoShares || 0);
        if (userShares < amountNum) return true;

        // 2. If routing to Orderbook (Limit Sell), contract technically requires USDC collateral
        // But user requested to remove this UI restriction.
        // We only enforce Share ownership.
        return false;
    }
  }, [orderType, outcome, totalCost, amountNum, availableBalance, market?.userYesShares, market?.userNoShares, willRouteToAMM, priceNum]);

  // Helper text for badge
  const badgeText = (willRouteToAMM) 
      ? t('trading.smartRouteAMM')
      : (isCrossingBook ? t('trading.matchOrderbook') : t('trading.passiveOrder'));
      
  const badgeColor = (willRouteToAMM)
      ? "text-blue-400 bg-blue-500/10"
      : (isCrossingBook ? "text-indigo-400 bg-indigo-500/10" : "text-emerald-400 bg-emerald-500/10");

  const getButtonText = () => {
      if (insufficientBalance) {
          if (orderType === 'buy') {
              return t('trading.insufficientBalance', { amount: (Number(availableBalance || 0n) / 1e18).toFixed(0) });
          } else {
              // Sell checks
              const ownShares = outcome === 0 ? (market?.userYesShares || 0) : (market?.userNoShares || 0);
              const name = outcome === 0 ? t('common.yes') : t('common.no');
              
              if (ownShares < amountNum) {
                 return t('trading.insufficientShares', { outcome: name, amount: ownShares.toFixed(2) });
              }
              
              if (!willRouteToAMM) {
                   const limitSellCostPerShare = 1 - priceNum;
                   const limitSellTotalCost = limitSellCostPerShare * amountNum;
                   return t('trading.needCollateral', { amount: limitSellTotalCost.toFixed(2) });
              }
          }
      }
      const action = orderType === 'buy' ? t('trading.buy') : t('trading.sell');
      const outcomeText = outcome === 0 ? t('common.yes') : t('common.no');
      return `${action} ${outcomeText}`;
  };

  return (
    <div className="space-y-4">
      {/* Market Info Bar */}
      <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-slate-950/50 border border-slate-800">
        <div>
          <div className="text-xs text-slate-500">{t('trading.marketPrice')}</div>
          <div className="text-lg font-bold text-white font-mono">
            {currentMarketPrice?.toFixed(2) || '—'} <span className="text-sm text-indigo-400">{t('common.usdc')}</span>
          </div>
        </div>
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
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2">
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

      {/* Price Input */}
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

      {/* Shares Input */}
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
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-full bg-slate-950/50 border border-slate-800 rounded-lg px-14 text-lg font-mono text-center text-white focus:outline-none focus:border-indigo-500"
            min="1" step="1"
          />
          <button
            onMouseDown={startIncrement} onMouseUp={stopIncrement} onMouseLeave={stopIncrement}
            className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-r-lg z-10"
            type="button"
          >+</button>
        </div>
      </div>

      {/* Order Summary */}
      <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">{t('trading.costPerShare')}</span>
          <span className="font-mono text-white">{costPerShare.toFixed(2)} {t('common.usdc')}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-slate-800 pt-1.5">
          <span className="text-slate-400 font-medium">{t('trading.totalCost')}</span>
          <span className="font-mono font-bold text-white">{totalCost.toFixed(2)} {t('common.usdc')}</span>
        </div>
      </div>

      {/* Action Button */}
      <Button
        onClick={handlePlaceOrder}
        disabled={isDisabled || insufficientBalance}
        isLoading={isPending}
        className={cn("w-full h-12 font-bold",
          isDisabled || insufficientBalance ? "bg-slate-700" : orderType === 'buy' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
        )}
      >
        {getButtonText()}
      </Button>

      {/* Footer */}
      <div className="text-center text-[10px] text-slate-600">
        {badgeText}
      </div>
    </div>
  );
};
