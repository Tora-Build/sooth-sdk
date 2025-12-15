// MarketCard.tsx - Full AMM trading experience inline (V5 Launchpad style)
import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Clock, TrendingUp, TrendingDown, Zap, Info, Loader2 } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { useLaunchpadMarket } from '../../../hooks/v5/useLaunchpadMarket';
import { useAmmMarketByAddress } from '../../../hooks/useAmmMarketByAddress';
import { useLaunchpadTradeQuote } from '../../../hooks/v5/useLaunchpadTradeQuote';
import { useTraderVault } from '../../../hooks/useTraderVault';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';

interface MarketCardProps {
  address: `0x${string}`;
  name: string;
  symbol: string;
  isGraduated: boolean;
  deadline?: number;
}

const SLIPPAGE_OPTIONS = [10, 50, 100, 200]; // 0.1%, 0.5%, 1%, 2%

export const MarketCard = ({ address, name, symbol, isGraduated, deadline }: MarketCardProps) => {
  const { isConnected } = useAccount();
  const { bBase, graduationThreshold, feesAccrued } = useLaunchpadMarket(address);
  const { market, isLoading: marketLoading } = useAmmMarketByAddress(address, {
    address,
    name,
    symbol,
    isGraduated,
    deadline,
  });
  const { executeAMMTrade, availableBalance, isPending: isVaultPending } = useTraderVault();

  // Trade state
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(0);
  const [amount, setAmount] = useState('10');
  const [slippageBps, setSlippageBps] = useState(100); // 1% default
  const [showSlippageSelector, setShowSlippageSelector] = useState(false);
  const [showTrading, setShowTrading] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Increment/Decrement refs
  const incrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const decrementIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Quote
  const sharesInput = tradeMode === 'buy' ? amount : `-${amount}`;
  const { quote, isLoading: quoteLoading } = useLaunchpadTradeQuote(
    address,
    selectedOutcome,
    sharesInput,
    slippageBps,
    bBase || 0n
  );

  const priceYes = market?.priceYes ?? 0.5;
  const priceNo = 1 - priceYes;
  
  const isExpired = deadline && Date.now() / 1000 > Number(deadline) && !isGraduated;
  
  const graduationProgress = bBase && graduationThreshold && graduationThreshold > 0n
    ? Math.min(100, Number((bBase * 100n) / graduationThreshold))
    : 0;

  const liquidity = bBase ? Number(bBase) / 1e18 : 0;

  // User's shares for sell mode
  const userYesShares = market?.userYesShares || 0;
  const userNoShares = market?.userNoShares || 0;
  const maxSellAmount = selectedOutcome === 0 ? userYesShares : userNoShares;
  const canSell = maxSellAmount > 0;

  // Amount parsing
  const amountNum = parseFloat(amount) || 0;

  // Cost per share calculation - use totalCost (includes fee) for accuracy
  // Only calculate when we have a valid quote with matching input
  const costPerShare = quote && amountNum > 0 && Math.abs(quote.inputAmount) === amountNum
    ? quote.totalCost / amountNum 
    : null; // null means show '--' while loading

  // Handlers
  const handleIncrement = () => {
    setAmount(prev => {
      const newVal = parseFloat(prev || '1') + 1;
      // Cap at max sell amount when selling
      if (tradeMode === 'sell' && newVal > maxSellAmount) {
        return String(Math.floor(maxSellAmount));
      }
      return String(newVal);
    });
  };

  const handleDecrement = () => {
    setAmount(prev => String(Math.max(1, parseFloat(prev || '1') - 1)));
  };

  const startIncrement = () => {
    handleIncrement();
    incrementIntervalRef.current = setInterval(handleIncrement, 100);
  };

  const startDecrement = () => {
    handleDecrement();
    decrementIntervalRef.current = setInterval(handleDecrement, 100);
  };

  const stopIncrement = () => {
    if (incrementIntervalRef.current) {
      clearInterval(incrementIntervalRef.current);
      incrementIntervalRef.current = null;
    }
  };

  const stopDecrement = () => {
    if (decrementIntervalRef.current) {
      clearInterval(decrementIntervalRef.current);
      decrementIntervalRef.current = null;
    }
  };

  const handleSetMax = () => {
    if (tradeMode === 'sell' && maxSellAmount > 0) {
      setAmount(String(Math.floor(maxSellAmount)));
    }
  };

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0 || !quote) return;
    setIsPending(true);
    try {
      const limitParam = tradeMode === 'buy'
        ? quote.maxWithSlippage.toString()
        : (-quote.maxWithSlippage).toString();
      await executeAMMTrade(address, selectedOutcome, sharesInput, limitParam);
      setAmount('10');
    } catch (err) {
      console.error('Trade failed:', err);
    } finally {
      setIsPending(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  // Only show quote data when it matches the current input to prevent stale display
  const hasValidQuote = quote && amountNum > 0 && Math.abs(quote.inputAmount) === amountNum;
  const displayPriceYes = hasValidQuote ? quote.newPriceYes : priceYes;
  const displayPriceNo = hasValidQuote ? quote.newPriceNo : priceNo;

  // Check if sell amount exceeds holdings
  const exceedsHoldings = tradeMode === 'sell' && amountNum > maxSellAmount;

  return (
    <Card className="group flex flex-col h-full p-5 hover:border-cyan-500/50 transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 pr-3">
          <Link to={`/market/${address}`}>
            <h3 className="font-bold text-white text-lg leading-tight line-clamp-2 hover:text-cyan-400 transition-colors">
              {name}
            </h3>
          </Link>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="font-mono text-xs text-slate-500">{symbol}</span>
            {isGraduated ? (
              <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                🎓 Graduated
              </Badge>
            ) : isExpired ? (
              <Badge className="text-[10px] bg-red-500/20 text-red-400 border-red-500/50">
                ⏰ Expired
              </Badge>
            ) : (
              <Badge className="text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
                🔥 Bonding
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Bonding Progress (only for non-graduated) */}
      {!isGraduated && !isExpired && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Progress</span>
            <span className="text-xs font-mono text-cyan-400">{graduationProgress.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${graduationProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Probability Display */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => { setSelectedOutcome(0); setShowTrading(true); }}
          className={`p-3 rounded-lg border-2 text-left transition-all ${
            selectedOutcome === 0 && showTrading
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-slate-700/50 bg-emerald-500/5 hover:border-emerald-500/50'
          }`}
        >
          <div className="text-[10px] text-emerald-400 uppercase tracking-wider mb-0.5">YES</div>
          <div className="text-xl font-bold text-white tabular-nums flex items-baseline gap-1">
            {(priceYes * 100).toFixed(1)}%
            {hasValidQuote && selectedOutcome === 0 && (
              <span className={`text-sm ${quote.newPriceYes >= priceYes ? 'text-emerald-400' : 'text-rose-400'}`}>
                → {(quote.newPriceYes * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => { setSelectedOutcome(1); setShowTrading(true); }}
          className={`p-3 rounded-lg border-2 text-left transition-all ${
            selectedOutcome === 1 && showTrading
              ? 'border-rose-500 bg-rose-500/10'
              : 'border-slate-700/50 bg-rose-500/5 hover:border-rose-500/50'
          }`}
        >
          <div className="text-[10px] text-rose-400 uppercase tracking-wider mb-0.5">NO</div>
          <div className="text-xl font-bold text-white tabular-nums flex items-baseline gap-1">
            {(priceNo * 100).toFixed(1)}%
            {hasValidQuote && selectedOutcome === 1 && (
              <span className={`text-sm ${quote.newPriceNo >= priceNo ? 'text-emerald-400' : 'text-rose-400'}`}>
                → {(quote.newPriceNo * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Probability Bar */}
      <div className="h-1.5 rounded-full overflow-hidden flex mb-3">
        <div
          className="bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
          style={{ width: `${displayPriceYes * 100}%` }}
        />
        <div
          className="bg-gradient-to-r from-rose-400 to-rose-500 transition-all"
          style={{ width: `${displayPriceNo * 100}%` }}
        />
      </div>

      {/* Trading Panel (Expandable) */}
      {showTrading && (
        <div className="space-y-3 pt-3 border-t border-slate-800">
          {/* Buy/Sell Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTradeMode('buy')}
              className={`py-2 rounded-lg font-bold text-sm transition-all ${
                tradeMode === 'buy'
                  ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                  : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setTradeMode('sell')}
              className={`py-2 rounded-lg font-bold text-sm transition-all ${
                tradeMode === 'sell'
                  ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400'
                  : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              Sell
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-500">Shares</label>
              {tradeMode === 'sell' ? (
                <button 
                  onClick={handleSetMax}
                  className="text-xs text-slate-500 font-mono hover:text-cyan-400 transition-colors"
                  title="Click to set max"
                >
                  Max: <span className="text-emerald-400">{maxSellAmount.toFixed(2)}</span>
                </button>
              ) : (
                <span className="text-xs text-slate-500 font-mono">
                  Bal: ${(Number(availableBalance) / 1e18).toFixed(0)}
                </span>
              )}
            </div>
            <div className="relative">
              <button
                onMouseDown={startDecrement}
                onMouseUp={stopDecrement}
                onMouseLeave={stopDecrement}
                onTouchStart={startDecrement}
                onTouchEnd={stopDecrement}
                className="absolute left-0 top-0 h-full px-3 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-l-lg transition-colors z-10 select-none"
                type="button"
              >
                <span className="text-lg font-bold">−</span>
              </button>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={tradeMode === 'sell' ? maxSellAmount : undefined}
                className={`w-full bg-slate-900/50 border rounded-lg px-12 py-2 text-sm text-white text-center focus:outline-none transition-colors ${
                  exceedsHoldings 
                    ? 'border-rose-500 focus:border-rose-400' 
                    : 'border-slate-700 focus:border-cyan-500'
                }`}
                placeholder="10"
                min="1"
                step="1"
              />
              <button
                onMouseDown={startIncrement}
                onMouseUp={stopIncrement}
                onMouseLeave={stopIncrement}
                onTouchStart={startIncrement}
                onTouchEnd={stopIncrement}
                className="absolute right-0 top-0 h-full px-3 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-r-lg transition-colors z-10 select-none"
                type="button"
              >
                <span className="text-lg font-bold">+</span>
              </button>
            </div>
            {exceedsHoldings && (
              <p className="text-[10px] text-rose-400 mt-1">
                Exceeds holdings ({maxSellAmount.toFixed(2)} available)
              </p>
            )}
          </div>

          {/* Quick Amounts */}
          <div className="grid grid-cols-4 gap-1">
            {[10, 50, 100, 500].map(val => (
              <button
                key={val}
                onClick={() => setAmount(String(val))}
                className={`py-1 text-[10px] font-mono rounded transition-all ${
                  amount === String(val)
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'bg-slate-800/50 text-slate-500 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {val}
              </button>
            ))}
          </div>

          {/* Quote Summary */}
          <div className="p-2 bg-slate-800/30 rounded-lg space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Cost / Share</span>
              <span className="font-mono text-white">
                {costPerShare !== null ? formatCurrency(costPerShare) : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{tradeMode === 'buy' ? 'Est. Total' : 'Est. Return'}</span>
              <span className="font-mono text-white">
                {quote && Math.abs(quote.inputAmount) === amountNum ? formatCurrency(quote.totalCost) : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Fee</span>
              <span className="font-mono text-slate-400">
                {quote && Math.abs(quote.inputAmount) === amountNum ? formatCurrency(quote.fee) : '--'}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-700/50 pt-1">
              <span className="text-slate-400 font-medium">{tradeMode === 'buy' ? 'Max Total' : 'Min Received'}</span>
              <span className="font-mono font-bold text-white">
                {quote && Math.abs(quote.inputAmount) === amountNum ? formatCurrency(quote.maxWithSlippage) : '--'}
              </span>
            </div>
          </div>

          {/* Slippage Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-500">Slippage Tolerance</label>
              <button
                onClick={() => setShowSlippageSelector(!showSlippageSelector)}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <Info size={10} />
                {(slippageBps / 100).toFixed(1)}%
              </button>
            </div>

            {showSlippageSelector && (
              <div className="grid grid-cols-4 gap-1">
                {SLIPPAGE_OPTIONS.map(bps => (
                  <button
                    key={bps}
                    onClick={() => {
                      setSlippageBps(bps);
                      setShowSlippageSelector(false);
                    }}
                    className={`py-1.5 text-[10px] font-mono rounded transition-colors ${
                      slippageBps === bps
                        ? 'bg-cyan-500 text-black font-bold'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {(bps / 100).toFixed(1)}%
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trade Button */}
          {!isConnected ? (
            <Button className="w-full py-2 text-sm bg-indigo-600 hover:bg-indigo-500">
              Connect Wallet
            </Button>
          ) : (
            <Button
              onClick={handleTrade}
              disabled={
                isPending || 
                isVaultPending || 
                !quote || 
                parseFloat(amount) <= 0 || 
                exceedsHoldings ||
                (tradeMode === 'sell' && !canSell)
              }
              className={`w-full py-2 text-sm font-bold ${
                selectedOutcome === 0
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-rose-600 hover:bg-rose-500'
              } ${(exceedsHoldings || (tradeMode === 'sell' && !canSell)) ? 'opacity-50' : ''}`}
            >
              {isPending || isVaultPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Processing...
                </span>
              ) : tradeMode === 'sell' && !canSell ? (
                `No ${selectedOutcome === 0 ? 'YES' : 'NO'} shares to sell`
              ) : exceedsHoldings ? (
                'Insufficient shares'
              ) : (
                `${tradeMode === 'buy' ? 'Buy' : 'Sell'} ${selectedOutcome === 0 ? 'YES' : 'NO'}`
              )}
            </Button>
          )}
        </div>
      )}

      {/* Footer Stats */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800 mt-auto">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span className="font-mono">${liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
        
        {deadline && !isGraduated && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            <span>{new Date(Number(deadline) * 1000).toLocaleDateString()}</span>
          </div>
        )}
        
        {!showTrading ? (
          <button
            onClick={() => setShowTrading(true)}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <TrendingUp className="w-3 h-3" />
            <span>Trade</span>
          </button>
        ) : (
          <button
            onClick={() => setShowTrading(false)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            <span>Collapse</span>
          </button>
        )}
      </div>
    </Card>
  );
};
