// Updated: Hold-to-increment functionality
import React, { useState, useRef } from 'react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { useMarket } from '../../../hooks/useMarket';
import { useTrade } from '../../../hooks/useTrade';
import { useTradeQuote } from '../../../hooks/useTradeQuote';
import { TrendingUp, TrendingDown, Info, List, ArrowLeft } from 'lucide-react';
import { TradeForm } from './TradeForm';
import { Drawer } from '../../ui/Drawer';

interface MarketCardProps {
  marketId: string;
}

const MarketCardComponent: React.FC<MarketCardProps> = ({ marketId }) => {
  const { market } = useMarket(marketId);
  const { trade, isPending } = useTrade(marketId);
  const [amount, setAmount] = useState('1');
  const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(0);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [slippageBps, setSlippageBps] = useState(50);
  const [showSlippageSelector, setShowSlippageSelector] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const incrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const decrementIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const quote = useTradeQuote(
    marketId, 
    selectedOutcome, 
    tradeMode === 'buy' 
      ? (amount || '1') 
      : `-${amount || '1'}`,
    slippageBps
  );

  if (!market) return null;

  // Drawer handler
  const handleCloseAdvanced = () => setShowAdvanced(false);

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const tradeAmount = tradeMode === 'buy' ? amount : `-${amount}`;
    await trade(selectedOutcome, tradeAmount, slippageBps);
    setAmount('1');
  };

  let priceYesPercent = (market.priceYes * 100).toFixed(1);
  let priceNoPercent = (market.priceNo * 100).toFixed(1);

  if (market.status === 'settled' && market.winningOutcome) {
    if (market.winningOutcome === 'YES') {
      priceYesPercent = '100.0';
      priceNoPercent = '0.0';
    } else {
      priceYesPercent = '0.0';
      priceNoPercent = '100.0';
    }
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  // Determine which prices to show based on whether user is trading
  const hasValidAmount = quote && parseFloat(amount) > 0;
  const displayYesPrice = hasValidAmount ? (quote.newPriceYes * 100).toFixed(1) : priceYesPercent;
  const displayNoPrice = hasValidAmount ? (quote.newPriceNo * 100).toFixed(1) : priceNoPercent;

  // Check if user has shares to sell
  const userYesShares = market.userYesShares || 0;
  const userNoShares = market.userNoShares || 0;
  const canSell = selectedOutcome === 0 ? userYesShares > 0 : userNoShares > 0;
  const maxSellAmount = selectedOutcome === 0 ? userYesShares : userNoShares;

  // Calculate virtual liquidity
  const virtualLiquidity = Number(market.bParam) / 1e18;

  // Increment/Decrement handlers (defined after maxSellAmount)
  const handleIncrement = () => {
    setAmount(prev => {
      const newAmount = parseFloat(prev || '1') + 1;
      if (tradeMode === 'sell' && newAmount > maxSellAmount) {
        return String(maxSellAmount);
      }
      return String(newAmount);
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
  
  // Risk level from market config (set by risk manager)
  const getRiskLevelDisplay = (level?: string): { label: string; color: string } => {
    switch (level?.toUpperCase()) {
      case 'LOW':
        return { label: 'Low', color: 'text-emerald-400' };
      case 'MEDIUM':
        return { label: 'Medium', color: 'text-yellow-400' };
      case 'HIGH':
        return { label: 'High', color: 'text-red-400' };
      default:
        return { label: 'Not Set', color: 'text-slate-400' };
    }
  };
  const riskLevel = getRiskLevelDisplay(market.riskLevel);

  return (
    <Card className="flex flex-col h-full hover:border-indigo-500/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-heading font-semibold text-xl text-white mb-2 line-clamp-2 flex-1">
              <span className="text-slate-500 mr-2">#{market.id_numeric || market.id}</span>
              {market.question}
            </h3>
            <Button
              variant="info"
              size="sm"
              onClick={() => setShowAdvanced(true)}
              className="ml-2 h-6 px-2 text-[10px] gap-1"
              title="Orderbook: Place Limit Orders"
            >
              <TrendingUp size={12} />
              <span>Orderbook</span>
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="outline" className="text-[10px]">
              {market.adjudicatorLabel}
            </Badge>
            <Badge 
              variant={market.status === 'trading' ? 'success' : 'outline'}
              className={`text-[10px] ${
                market.status === 'settled' && market.winningOutcome === 'YES' ? 'border-emerald-500 text-emerald-400' :
                market.status === 'settled' && market.winningOutcome === 'NO' ? 'border-rose-500 text-rose-400' : ''
              }`}
            >
              {market.status}
              {market.status === 'settled' && market.winningOutcome && ` - ${market.winningOutcome}`}
            </Badge>
          </div>
          {/* Liquidity and Adjudicator on same line */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-[10px]">
            {market.adjudicatorId && (
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Adjudicator:</span>
                {market.mode === 'demo' ? (
                  <span className="font-mono text-slate-500 flex items-center gap-1">
                    {market.adjudicatorId.slice(0, 6)}...{market.adjudicatorId.slice(-4)}
                  </span>
                ) : (
                  <a
                    href={`https://sepolia.basescan.org/address/${market.adjudicatorId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                  >
                    {market.adjudicatorId.slice(0, 6)}...{market.adjudicatorId.slice(-4)}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Buy/Sell + YES/NO Toggles */}
      <div className="mb-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTradeMode('buy')}
            className={`h-11 rounded-lg border-2 font-bold text-white transition-all ${
              tradeMode === 'buy' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 hover:border-emerald-500/30'
            }`}
          >BUY</button>
          <button
            onClick={() => setTradeMode('sell')}
            className={`h-11 rounded-lg border-2 font-bold text-white transition-all ${
              tradeMode === 'sell' ? 'border-rose-500 bg-rose-500/10' : 'border-slate-800 hover:border-rose-500/30'
            }`}
          >SELL</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSelectedOutcome(0)}
            className={`h-11 rounded-lg border-2 font-bold text-white transition-all ${
              selectedOutcome === 0 ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 hover:border-emerald-500/30'
            }`}
          >YES</button>
          <button
            onClick={() => setSelectedOutcome(1)}
            className={`h-11 rounded-lg border-2 font-bold text-white transition-all ${
              selectedOutcome === 1 ? 'border-rose-500 bg-rose-500/10' : 'border-slate-800 hover:border-rose-500/30'
            }`}
          >NO</button>
        </div>
      </div>

      {/* Quote Preview */}
      {quote && (
        <div className="mb-4 space-y-3">
          {/* Market Info Bar */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800">
            <div>
              <div className="text-xs text-slate-500">Market Price</div>
              <div className="text-lg font-bold text-white font-mono">
                {(selectedOutcome === 0 
                  ? (hasValidAmount ? quote.newPriceYes : market.priceYes) 
                  : (hasValidAmount ? quote.newPriceNo : market.priceNo)
                ).toFixed(2)} <span className="text-sm text-indigo-400">USDC</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 flex items-center gap-1 cursor-help" title="Unified Liquidity: Combined depth from AMM and Limit Orders">
                Liquidity <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1 rounded border border-indigo-500/20">Unified</span> <Info size={10} />
              </div>
              <div className="text-sm font-mono text-slate-300">
                ${virtualLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Probability Bar */}
          <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500">YES Probability</span>
              <div className="flex items-center gap-2 text-sm font-mono">
                <span className="text-slate-400">{(market.priceYes * 100).toFixed(0)}%</span>
                <span className="text-slate-600">→</span>
                <span className="text-white">{(quote.newPriceYes * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                style={{ width: `${quote.newPriceYes * 100}%` }}
              />
            </div>
          </div>

          {/* Order Summary */}
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Cost per share</span>
              <span className="font-mono text-white">
                {formatCurrency(Math.abs(quote.totalCost) / Math.max(parseFloat(amount || '1'), 1))}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Fee + Slippage</span>
              <span className="font-mono text-slate-400">
                {formatCurrency(quote.fee)} + {(slippageBps / 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-sm border-t border-slate-800 pt-1.5">
              <span className="text-slate-400 font-medium">{tradeMode === 'buy' ? 'Max Total' : 'Min Received'}</span>
              <span className="font-mono font-bold text-white">{formatCurrency(quote.maxWithSlippage)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Trade */}
      <div className="mt-auto space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-500">Shares</label>
            {tradeMode === 'sell' && (
              <span className="text-xs text-slate-500">
                Max: {maxSellAmount.toFixed(2)}
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
              className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-12 py-2 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
              placeholder="1"
              min="1"
              step="1"
              disabled={market.status !== 'trading'}
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
        </div>

        {/* Slippage Selector */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-500">Slippage Tolerance</label>
            <button
              onClick={() => setShowSlippageSelector(!showSlippageSelector)}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <Info size={12} />
              {(slippageBps / 100).toFixed(1)}%
            </button>
          </div>
          
          {showSlippageSelector && (
            <div className="grid grid-cols-4 gap-2">
              {[10, 50, 100, 200].map(bps => (
                <button
                  key={bps}
                  onClick={() => {
                    setSlippageBps(bps);
                    setShowSlippageSelector(false);
                  }}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    slippageBps === bps
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {(bps / 100).toFixed(1)}%
                </button>
              ))}
            </div>
          )}
        </div>
        
        <Button
          onClick={handleTrade}
          disabled={
            isPending || 
            market.status !== 'trading' || 
            !amount || 
            parseFloat(amount) <= 0 ||
            (tradeMode === 'sell' && !canSell) ||
            (tradeMode === 'sell' && parseFloat(amount) > maxSellAmount)
          }
          className={`w-full ${
            selectedOutcome === 0
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-rose-600 hover:bg-rose-700'
          }`}
        >
          {isPending ? 'Trading...' : `${tradeMode === 'buy' ? 'Buy' : 'Sell'} ${selectedOutcome === 0 ? 'YES' : 'NO'}`}
        </Button>
      </div>


      {/* Advanced Trading Drawer */}
      <Drawer
        isOpen={showAdvanced}
        onClose={handleCloseAdvanced}
        title="Orderbook"
        className="w-full max-w-lg border-l border-slate-800"
      >
        <div className="mb-6">
          <h3 className="font-heading font-semibold text-lg text-white mb-1">
            {market?.question}
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-500">
             <span>#{market?.id_numeric || market?.id}</span>
             <span>•</span>
             <span>Liquidity: ${(Number(market?.bParam) / 1e18).toLocaleString()}</span>
          </div>
        </div>
        
        <TradeForm marketId={marketId} />
      </Drawer>
    </Card>
  );
};

// Memoize to prevent unnecessary re-renders
export const MarketCard = React.memo(MarketCardComponent);
