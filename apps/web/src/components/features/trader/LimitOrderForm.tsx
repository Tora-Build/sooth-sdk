import React, { useState, useRef, useEffect } from 'react';
import { useOrderbookTrade } from '../../../hooks/useOrderbookTrade';
import { useContent } from '../../../hooks/useContent';
import { Button } from '../../ui/Button';
import { cn } from '../../../lib/utils';
import { useAmmMarket } from '../../../hooks/useAmmMarket';
import { useAmmMarketByAddress } from '../../../hooks/useAmmMarketByAddress';
import { useOrderbook } from '../../../hooks/useOrderbook';
import { parseUnits, formatUnits } from 'viem';
import toast from 'react-hot-toast';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { ERC20_ABI } from '../../../config/abis';
import { useDeployments } from '../../../hooks/useDeployments';
import { logger } from '../../../lib/logger';

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
  const { config } = useDeployments();
  const deployments = config.contracts;
  const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;

  // Detect if marketId is an address (0x...) or a config ID
  const isAddressFormat = marketId?.startsWith('0x') && marketId.length === 42;

  // V4: Use internal shares for Spot Sell availability
  const {
    placeOrder,
    placeSpotOrder,
    executeHybridSell,
    isPending: isLimitPending,
    availableBalance,
    // internalYesShares/NoShares removed from hook
  } = useOrderbookTrade(marketId);
  const isPending = isLimitPending;

  // Use useAmmMarketByAddress for dynamic V5 markets, useAmmMarket for config-based V4
  const { amm: configAmmMarket } = useAmmMarket(isAddressFormat ? undefined : (marketId as `0x${string}`));
  const { market: addressMarket } = useAmmMarketByAddress(
    isAddressFormat ? (marketId as `0x${string}`) : undefined
  );
  const market = isAddressFormat ? addressMarket : (configAmmMarket ? { priceYes: configAmmMarket.yesProbability, priceNo: configAmmMarket.noProbability, bParam: 0n, status: 'trading' } : undefined);

  const { bids, asks, userYesShares: obYes, userNoShares: obNo } = useOrderbook(marketId);

  const { writeContractAsync } = useWriteContract();

  // Note: USDC Approval is NOT needed for Trading (V4 uses Internal Vault Balance).
  // Users must Deposit USDC into the Vault first.

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

  // Determine Sell Mode

  // AMM Shares (Source: market object) - NOT USED FOR ORDERBOOK
  const ammShares = 0;

  // Orderbook Shares (Source: useOrderbook hook) - TRADING ACCOUNT ONLY
  const userVaultShares = outcome === 0 ? obYes : obNo;

  // Only count vault shares for trading
  const userTokenShares = userVaultShares;

  // Display Locked Amount - V4.6: Always 0 (no locked shares)
  const userLockedShares = 0;

  // Spot Sell Availability: Can only Spot Sell shares in the Vault
  const isSpotSell = orderType === 'sell' && userTokenShares >= amountNum;
  const isHybridSell = orderType === 'sell' && userTokenShares > 0 && userTokenShares < amountNum;

  const sharesToSpotSell = isHybridSell ? userTokenShares : (isSpotSell ? amountNum : 0);
  const sharesToShortSell = isHybridSell ? (amountNum - userTokenShares) : (!isSpotSell && orderType === 'sell' ? amountNum : 0);

  // Buy Max: How many shares can user afford with vault USDC?
  const usdcBalanceNum = parseFloat(formatUnits(availableBalance || 0n, 18));
  const buyMax = priceNum > 0 ? (usdcBalanceNum / priceNum) : 0;

  // Cost & Proceeds Display
  let totalCost = 0;
  let totalProceeds = 0;
  if (orderType === 'buy') {
    totalCost = priceNum * amountNum;
  } else {
    // Sell Side: Only Short/Hybrid portion costs USDC (Collateral)
    const shortCost = (1 - priceNum) * sharesToShortSell;
    totalCost = shortCost;
    // For Spot Sell: user receives price * shares
    totalProceeds = priceNum * amountNum;
  }

  const costPerShare = amountNum > 0 ? (totalCost / amountNum) : 0;

  const isValidPrice = priceNum > 0 && priceNum < 1;

  // Handicap Logic
  const isBuyingYes = (orderType === 'buy' && outcome === 0) || (orderType === 'sell' && outcome === 1);
  const bestAsk = asks[0] ? parseFloat(asks[0].yesPrice) : null;
  const bestBid = bids[0] ? parseFloat(bids[0].yesPrice) : null;

  let bestBookPrice = isBuyingYes ? bestAsk : bestBid;
  if (bestBookPrice !== null && outcome === 1) {
    bestBookPrice = 1 - bestBookPrice;
  }

  const isCrossingBook = bestBookPrice !== null && (
    orderType === 'buy' ? priceNum >= bestBookPrice : priceNum <= bestBookPrice
  );

  const handlePlaceOrder = async () => {
    // Check Internal Balance
    const requiredCost = parseUnits(totalCost.toFixed(6), 18);
    const hasEnough = (availableBalance || 0n) >= requiredCost;

    if (totalCost > 0 && !hasEnough) {
      toast.error("Insufficient USDC in Trading Vault. Please Deposit.");
      return;
    }

    if (!amount || !price || !isValidPrice) {
      return;
    }

    // Strict Orderbook Logic - No AMM Routing
    if (orderType === 'buy') {
      try {
        await placeOrder(outcome, price, amount, true);
      } catch (e) {
        logger.order.error('Buy Order Error', e);
      }
    } else {
      // Sell Side - Route to correct function based on sell type
      try {
        if (isSpotSell) {
          // Pure spot sell - use placeSpotOrder
          await placeSpotOrder(outcome, price, amount);
        } else if (isHybridSell) {
          // Hybrid sell (partial spot + partial short)
          await executeHybridSell(outcome, price, amount);
        } else {
          // Pure short sell - use placeOrder with isBuy=false
          await placeOrder(outcome, price, amount, false);
        }
      } catch (e) {
        logger.order.error('Sell Order Error', e);
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
  const handlePriceInc = () => setPrice(p => Math.min(0.99, (parseFloat(p || '0.5') + 0.01)).toFixed(4));
  const handlePriceDec = () => setPrice(p => Math.max(0.01, (parseFloat(p || '0.5') - 0.01)).toFixed(4));
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
      setPrice(currentHandicap.toFixed(4));
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
    if (isSpotSell) {
      return false;
    }

    // Buy / Short Sell / Hybrid: Require Vault USDC for the UNCOVERED portion
    const requiredCollateral = parseUnits(totalCost.toFixed(6), 18);

    // V4: Use Internal Vault Balance (availableBalance)
    const hasEnoughUSDC = (availableBalance || 0n) >= requiredCollateral;
    return !hasEnoughUSDC;

  }, [orderType, totalCost, amountNum, availableBalance, isSpotSell, isHybridSell]);

  // Only disable if pending
  const isActionDisabled = isDisabled || insufficientBalance;

  // Helper text for badge
  let badgeText = isCrossingBook
    ? "⚡ Executing against Orderbook. You will be refunded any price improvement."
    : t('trading.passiveOrder');

  let badgeColor = isCrossingBook ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10";

  // Info badges for Sell orders
  if (orderType === 'sell') {
    if (isSpotSell) {
      // Fully covered by OB shares (Vault)
      badgeText = `✅ Spot Sell: Using your ${amountNum} orderbook shares. No collateral needed.`;
      badgeColor = "text-emerald-400 bg-emerald-500/10";
    } else if (isHybridSell) {
      // Partial coverage
      badgeText = `⚠️ Hybrid Sell: ${sharesToSpotSell.toFixed(0)} shares from orderbook + ${sharesToShortSell.toFixed(0)} short sold (requires ${((1 - priceNum) * sharesToShortSell).toFixed(2)} USDC collateral).`;
      badgeColor = "text-slate-400 bg-slate-500/10";
    } else if (sharesToShortSell > 0) {
      // Full short sell
      badgeText = `⚠️ Short Sell: Requires ${totalCost.toFixed(2)} USDC collateral (${((1 - priceNum) * 100).toFixed(0)}% of ${amountNum} shares).`;
      badgeColor = "text-slate-400 bg-slate-500/10";
    }
  }

  const getButtonText = () => {
    // Default Button Text
    const action = orderType === 'buy' ? t('trading.buy') : t('trading.sell');
    const outcomeText = outcome === 0 ? t('common.yes') : t('common.no');

    if (insufficientBalance) {
      if (orderType === 'buy') {
        return t('trading.insufficientBalance', { amount: (Number(availableBalance || 0n) / 1e18).toFixed(0) });
      } else {
        // Short Sell Checks (Spot Sell bypasses this via insufficientBalance=false)
        return "Insufficient USDC (Collateral)";
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
            {(currentMarketPrice ?? 0.5).toFixed(4)} <span className="text-sm text-cyan-400">{t('common.usdc')}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">{t('trading.bestPrice')}</div>
          <div className="text-lg font-bold text-emerald-400 font-mono">
            {currentHandicap?.toFixed(4) || '—'} <span className="text-sm text-emerald-600/70">{t('common.usdc')}</span>
          </div>
        </div>
        <div className="col-span-2 flex justify-between pt-2 border-t border-slate-800/50 text-xs text-slate-500 font-mono">
          <span>LQ: ${ammLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span>Depth: {orderbookDepth} offers</span>
        </div>
      </div>

      {/* Buy/Sell Selector */}
      <div className="grid grid-cols-2 gap-2" >
        <button
          onClick={() => setOrderType('buy')}
          className={cn(
            "py-2 rounded-lg font-bold text-sm transition-all",
            orderType === 'buy'
              ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
              : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
          )}
        >
          {t('trading.buy')}
        </button>
        <button
          onClick={() => setOrderType('sell')}
          className={cn(
            "py-2 rounded-lg font-bold text-sm transition-all",
            orderType === 'sell'
              ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400'
              : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
          )}
        >
          {t('trading.sell')}
        </button>
      </div>

      {/* Outcome Selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleOutcomeChange(0)}
          className={cn(
            "p-2 rounded-lg border-2 text-center transition-all",
            outcome === 0
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-slate-700/50 bg-emerald-500/5 hover:border-emerald-500/50'
          )}
        >
          <div className="text-xs text-emerald-400 uppercase tracking-wider mb-0.5 font-bold">{t('common.yes')}</div>
          <div className="text-sm font-medium text-white tabular-nums">
            {((market?.priceYes ?? 0.5) * 100).toFixed(1)}%
          </div>
        </button>
        <button
          onClick={() => handleOutcomeChange(1)}
          className={cn(
            "p-2 rounded-lg border-2 text-center transition-all",
            outcome === 1
              ? 'border-rose-500 bg-rose-500/10'
              : 'border-slate-700/50 bg-rose-500/5 hover:border-rose-500/50'
          )}
        >
          <div className="text-xs text-rose-400 uppercase tracking-wider mb-0.5 font-bold">{t('common.no')}</div>
          <div className="text-sm font-medium text-white tabular-nums">
            {((1 - (market?.priceYes ?? 0.5)) * 100).toFixed(1)}%
          </div>
        </button>
      </div>

      {/* Price Input (Limit Order) */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{t('trading.yourPrice')}</span>
          <span>0.01 – 0.99</span>
        </div>
        <div className="relative h-12">
          <button
            onMouseDown={startPriceDec} onMouseUp={stopPriceDec} onMouseLeave={stopPriceDec} aria-label="Decrease price"
            onTouchStart={startPriceDec} onTouchEnd={stopPriceDec}
            className="absolute left-0 top-0 h-full w-12 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-l-lg z-10 select-none"
            type="button"
          >
            <span className="text-lg font-bold">−</span>
          </button>
          <input
            type="number"
            value={price}
            onChange={(e) => handlePriceChange(e.target.value)}
            className="w-full h-full bg-slate-950/50 border border-slate-800 rounded-lg px-14 text-lg font-mono text-center text-white focus:outline-none focus:border-cyan-500"
            min="0.01" max="0.99" step="0.01"
          />
          <button
            onMouseDown={startPriceInc} onMouseUp={stopPriceInc} onMouseLeave={stopPriceInc} aria-label="Increase price"
            onTouchStart={startPriceInc} onTouchEnd={stopPriceInc}
            className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-r-lg z-10 select-none"
            type="button"
          >
            <span className="text-lg font-bold">+</span>
          </button>
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
            onMouseDown={startDecrement} onMouseUp={stopDecrement} onMouseLeave={stopDecrement} aria-label="Decrease quantity"
            onTouchStart={startDecrement} onTouchEnd={stopDecrement}
            className="absolute left-0 top-0 h-full w-12 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-l-lg z-10 select-none"
            type="button"
          >
            <span className="text-lg font-bold">−</span>
          </button>
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
            className="w-full h-full bg-slate-950/50 border border-slate-800 rounded-lg px-14 text-lg font-mono text-center text-white focus:outline-none focus:border-cyan-500"
            min="1" step="1"
          />
          <button
            onMouseDown={startIncrement} onMouseUp={stopIncrement} onMouseLeave={stopIncrement} aria-label="Increase quantity"
            onTouchStart={startIncrement} onTouchEnd={stopIncrement}
            className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-r-lg z-10 select-none"
            type="button"
          >
            <span className="text-lg font-bold">+</span>
          </button>
        </div>

        {/* Balance / Locked Display */}
        <div className="flex flex-col items-end mt-1.5 gap-0.5">
          {/* Context-aware Max Display */}
          <div
            className="text-xs text-slate-500 flex items-center gap-1 cursor-pointer hover:text-slate-300 transition-colors"
            onClick={() => setAmount(orderType === 'buy' ? Math.floor(buyMax).toString() : userTokenShares.toString())}
            title={orderType === 'buy' ? "Max affordable with USDC" : "Max shares you own"}
          >
            <span>Max:</span>
            <span className={cn("font-mono font-bold", orderType === 'buy' ? "text-cyan-400" : "text-emerald-400")}>
              {orderType === 'buy' ? buyMax.toLocaleString(undefined, { maximumFractionDigits: 0 }) : userTokenShares.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">
            {orderType === 'buy' ? t('trading.costPerShare') : (isSpotSell ? 'Price per Share' : 'Collateral / Share')}
          </span>
          <span className="font-mono text-white">{ (orderType === 'sell' && isSpotSell) ? priceNum.toFixed(4) : costPerShare.toFixed(4)} {t('common.usdc')}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-slate-800 pt-1.5">
          <span className="text-slate-400 font-medium">
            {orderType === 'buy' ? t('trading.totalCost') : (isSpotSell ? 'Est. Proceeds' : 'Required Collateral')}
          </span>
          <span className={cn("font-mono font-bold", (orderType === 'sell' && isSpotSell) ? "text-emerald-400" : "text-white")}>
            {(orderType === 'sell' && isSpotSell) ? totalProceeds.toFixed(2) : totalCost.toFixed(2)} {t('common.usdc')}
          </span>
        </div>
      </div>

      {/* Action Button */}
      <Button
        onClick={handlePlaceOrder}
        disabled={isActionDisabled}
        isLoading={isPending} // Removed isApproving
        className={cn("w-full h-12 font-bold",
          isActionDisabled ? "bg-slate-700" : orderType === 'buy' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
        )}
      >
        {getButtonText()}
      </Button>

      {/* Footer */}
      <div className="text-center text-xs text-slate-600">
        {badgeText}
      </div>
    </div>
  );
};
