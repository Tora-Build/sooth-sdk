import React, { useState, useRef, useEffect } from 'react';
import { useLimitOrder } from '../../../hooks/useLimitOrder';
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
  const { placeOrder, isPending, availableBalance } = useLimitOrder(marketId);
  const { market } = useMarket(marketId);
  const { orders } = useOrderbook(marketId);
  
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

  // Collateral = price for buy, (1-price) for sell
  const collateralPerShare = orderType === 'sell' ? (1 - priceNum) : priceNum;
  const collateralTotal = collateralPerShare * amountNum;

  const isValidPrice = priceNum > 0 && priceNum < 1;
  
  // Crossing = would execute immediately (not allowed for limit orders)
  const isCrossing = currentMarketPrice 
    ? (orderType === 'buy' ? priceNum >= currentMarketPrice : priceNum <= currentMarketPrice)
    : false;

  const handlePlaceOrder = () => {
    if (!amount || !price || !isValidPrice || isCrossing) return;
    
    if (orderType === 'sell') {
      placeOrder(outcome, price, amount);
    } else {
      const oppositeOutcome = outcome === 0 ? 1 : 0;
      const invertedPrice = (1 - priceNum).toFixed(18);
      placeOrder(oppositeOutcome, invertedPrice, amount);
    }
  };

  // Amount controls
  const handleIncrement = () => setAmount(prev => String(parseFloat(prev || '1') + 1));
  const handleDecrement = () => setAmount(prev => String(Math.max(1, parseFloat(prev || '1') - 1)));
  const startIncrement = () => { handleIncrement(); incrementIntervalRef.current = setInterval(handleIncrement, 100); };
  const startDecrement = () => { handleDecrement(); decrementIntervalRef.current = setInterval(handleDecrement, 100); };
  const stopIncrement = () => { if (incrementIntervalRef.current) { clearInterval(incrementIntervalRef.current); incrementIntervalRef.current = null; } };
  const stopDecrement = () => { if (decrementIntervalRef.current) { clearInterval(decrementIntervalRef.current); decrementIntervalRef.current = null; } };

  // Clamp price
  const handlePriceChange = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) setPrice(val);
    else if (num < 0.01) setPrice('0.01');
    else if (num > 0.99) setPrice('0.99');
    else setPrice(val);
  };

  // Default price slightly passive
  useEffect(() => {
    if (currentMarketPrice && !price) {
      const defaultPrice = orderType === 'buy' 
        ? Math.max(0.01, currentMarketPrice - 0.05)
        : Math.min(0.99, currentMarketPrice + 0.05);
      setPrice(defaultPrice.toFixed(2));
    }
  }, [currentMarketPrice, orderType]);

  const ammLiquidity = market?.bParam ? parseFloat(formatUnits(market.bParam, 18)) : 0;
  const orderbookDepth = (orders?.yes?.length || 0) + (orders?.no?.length || 0);
  const isDisabled = !amount || !isValidPrice || isCrossing || isPending || market?.status !== 'trading';
  const insufficientBalance = collateralTotal > 0 && (availableBalance || 0n) < parseUnits(collateralTotal.toFixed(6), 18);

  return (
    <div className="space-y-4">
      {/* Market Info Bar */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800">
        <div>
          <div className="text-xs text-slate-500">Market Price</div>
          <div className="text-lg font-bold text-white font-mono">
            {currentMarketPrice?.toFixed(2) || '—'} <span className="text-sm text-indigo-400">USDC</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Liquidity</div>
          <div className="text-sm font-mono text-slate-300">
            ${ammLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })} AMM · {orderbookDepth} orders
          </div>
        </div>
      </div>

      {/* Buy/Sell + YES/NO Toggles */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setOrderType('buy')}
          className={cn("h-11 rounded-lg border-2 font-bold text-white transition-all",
            orderType === 'buy' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 hover:border-emerald-500/30'
          )}
        >BUY</button>
        <button
          onClick={() => setOrderType('sell')}
          className={cn("h-11 rounded-lg border-2 font-bold text-white transition-all",
            orderType === 'sell' ? 'border-rose-500 bg-rose-500/10' : 'border-slate-800 hover:border-rose-500/30'
          )}
        >SELL</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleOutcomeChange(0)}
          className={cn("h-11 rounded-lg border-2 font-bold text-white transition-all",
            outcome === 0 ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 hover:border-emerald-500/30'
          )}
        >YES</button>
        <button
          onClick={() => handleOutcomeChange(1)}
          className={cn("h-11 rounded-lg border-2 font-bold text-white transition-all",
            outcome === 1 ? 'border-rose-500 bg-rose-500/10' : 'border-slate-800 hover:border-rose-500/30'
          )}
        >NO</button>
      </div>

      {/* Price Input */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Your Price (USDC)</span>
          <span>0.01 – 0.99</span>
        </div>
        <div className="relative h-12">
          <button
            onClick={() => setPrice(Math.max(0.01, priceNum - 0.01).toFixed(2))}
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
            onClick={() => setPrice(Math.min(0.99, priceNum + 0.01).toFixed(2))}
            className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-r-lg z-10"
            type="button"
          >+</button>
        </div>
        {/* Price validation message */}
        {price && currentMarketPrice && (
          <div className={cn("text-xs mt-1.5 px-2 py-1 rounded",
            isCrossing ? "text-red-400 bg-red-500/10" : "text-emerald-400 bg-emerald-500/10"
          )}>
            {isCrossing
              ? `⛔ Must be ${orderType === 'buy' ? 'below' : 'above'} ${currentMarketPrice.toFixed(2)}`
              : "✓ Passive order"}
          </div>
        )}
      </div>

      {/* Shares Input */}
      <div>
        <div className="text-xs text-slate-500 mb-1">Shares</div>
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
          <span className="text-slate-500">Collateral per share</span>
          <span className="font-mono text-white">{collateralPerShare.toFixed(2)} USDC</span>
        </div>
        <div className="flex justify-between text-sm border-t border-slate-800 pt-1.5">
          <span className="text-slate-400 font-medium">Total Collateral</span>
          <span className="font-mono font-bold text-white">{collateralTotal.toFixed(2)} USDC</span>
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
        {insufficientBalance 
          ? `Insufficient Balance (${(Number(availableBalance || 0n) / 1e18).toFixed(0)} USDC)`
          : `${orderType === 'buy' ? 'Buy' : 'Sell'} ${outcome === 0 ? 'YES' : 'NO'}`
        }
      </Button>

      {/* Footer */}
      <div className="text-center text-[10px] text-slate-600">
        📋 Limit orders wait in orderbook until filled
      </div>
    </div>
  );
};
