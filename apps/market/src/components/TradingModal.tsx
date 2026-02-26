import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Loader2, Wallet, ChevronDown } from 'lucide-react';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { useAccount, useSwitchChain } from 'wagmi';
import { keccak256, encodePacked, Address } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { LaunchpadMarket, getMarketStatus, MarketStatus } from '../types';
import { useOrderbook, OrderLevel } from '../hooks/useOrderbook';
import { useSoothBookBalance } from '../hooks/useSoothBook';
import { useOrderbookTrade } from '../hooks/useOrderbookTrade';
import { MintMergePanel } from './MintMergePanel';
import { HistoricalPriceCard } from './HistoricalPriceCard';
import { UserOrdersPanel } from './UserOrdersPanel';
import { getInstanceBySoothBook } from '../config/deployments';
import { cn } from '../lib/utils';

// ── Types ──────────────────────────────────────────────────────────────

type OrderAction = 'buy_yes' | 'sell_yes' | 'buy_no' | 'sell_no';

interface TradingModalProps {
  market: LaunchpadMarket;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function renderBadge(status: MarketStatus) {
  if (status === 'live') {
    return (
      <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
        Live
      </span>
    );
  }
  if (status === 'settled' || status === 'dismissed') {
    return (
      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
        {status}
      </span>
    );
  }
  return (
    <span className="text-[11px] font-mono uppercase tracking-wider text-blue-400">
      Finalized
    </span>
  );
}

/** Format a 0-1 price as cents string, e.g. 0.509 -> "50.9¢" */
function formatCents(price: number): string {
  return `${(price * 100).toFixed(1)}¢`;
}

// ── Component ──────────────────────────────────────────────────────────

export function TradingModal({ market, onClose }: TradingModalProps) {
  const [activeTab, setActiveTab] = useState<'trade' | 'mint' | 'manage'>('trade');
  const marketStatus = getMarketStatus(market);

  const marketKey = useMemo(() => {
    return keccak256(encodePacked(['address'], [market.address as Address]));
  }, [market.address]);

  const { bids, asks, isLoading } = useOrderbook(marketKey, market.soothBookAddress);
  const { yesShares, noShares } = useSoothBookBalance(market.address, market.soothBookAddress);

  const { isConnected, address } = useAppKitAccount();
  const { open } = useAppKit();
  const { chainId: walletChainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const { placeOrder, cancelOrder, redeem, isPending, availableBalance, refetchBalance } = useOrderbookTrade(
    market.address,
    market.soothBookAddress,
  );

  // Resolve the market's chain
  const instance = market.soothBookAddress ? getInstanceBySoothBook(market.soothBookAddress) : undefined;
  const marketChainId = instance?.chainId ?? market.chainId;
  const marketChainName = instance?.chainName ?? 'Unknown';
  const isWrongChain = isConnected && walletChainId !== marketChainId;

  // ── Compound action state (like demo Pro page) ───────────────────────
  const [action, setAction] = useState<OrderAction>('buy_yes');
  const isYes = action === 'buy_yes' || action === 'sell_yes';
  const isBuying = action === 'buy_yes' || action === 'buy_no';
  const viewOutcome: 'yes' | 'no' = isYes ? 'yes' : 'no';
  // Map to the outcome param for placeOrder hook (0=YES, 1=NO per hook convention)
  const tradeOutcome: 0 | 1 = isYes ? 0 : 1;

  const [tradePrice, setTradePrice] = useState('0.50');
  const [tradeAmount, setTradeAmount] = useState('1');
  const [isPriceTouched, setIsPriceTouched] = useState(false);

  const [cancelSide, setCancelSide] = useState<'yes' | 'no'>('yes');
  const [cancelTick, setCancelTick] = useState<string>('');

  // ── Best prices from orderbook ───────────────────────────────────────
  const bestBidYes = useMemo(() => {
    if (bids.length === 0) return 0;
    return bids[0].yesPrice;
  }, [bids]);

  const bestAskYes = useMemo(() => {
    if (asks.length === 0) return 0;
    return asks[0].yesPrice;
  }, [asks]);

  // Auto-set price to best available when switching action or market
  useEffect(() => {
    setIsPriceTouched(false);
  }, [action, marketKey]);

  useEffect(() => {
    if (isPriceTouched) return;

    let defaultYesPrice = 0.5;
    if (isBuying) {
      defaultYesPrice = isYes
        ? (bestAskYes > 0 ? bestAskYes : defaultYesPrice)
        : (bestBidYes > 0 ? bestBidYes : defaultYesPrice);
    } else {
      defaultYesPrice = isYes
        ? (bestBidYes > 0 ? bestBidYes : defaultYesPrice)
        : (bestAskYes > 0 ? bestAskYes : defaultYesPrice);
    }

    // Display price in context of selected outcome
    const displayPrice = isYes ? defaultYesPrice : (1 - defaultYesPrice);
    const clampedCents = Math.max(0.1, Math.min(99.9, displayPrice * 100));
    setTradePrice((clampedCents / 100).toFixed(3));
  }, [action, isBuying, isPriceTouched, isYes, bestAskYes, bestBidYes]);

  // Price as displayed is outcome-relative; convert to YES-equivalent for the hook
  const priceForHook = useMemo(() => {
    const p = Number(tradePrice);
    return isYes ? p : 1 - p;
  }, [tradePrice, isYes]);

  // Cost estimate
  const priceNum = Number(tradePrice);
  const amountNum = Number(tradeAmount);
  const estimatedCost = useMemo(() => {
    if (!Number.isFinite(priceNum) || !Number.isFinite(amountNum) || amountNum <= 0) return null;
    return priceNum * amountNum;
  }, [priceNum, amountNum]);

  // Spread calculation
  const spread = useMemo(() => {
    if (bids.length === 0 || asks.length === 0) return null;
    return Math.abs(bids[0].yesPrice - asks[0].yesPrice);
  }, [bids, asks]);

  const midPrice = useMemo(() => {
    if (bids.length > 0 && asks.length > 0) return (bids[0].yesPrice + asks[0].yesPrice) / 2;
    if (bids.length > 0) return bids[0].yesPrice;
    if (asks.length > 0) return asks[0].yesPrice;
    return null;
  }, [bids, asks]);

  // Best price for display in the current outcome context
  const bestPriceDisplay = useMemo(() => {
    if (isYes) {
      return isBuying
        ? (bestAskYes > 0 ? bestAskYes : null)
        : (bestBidYes > 0 ? bestBidYes : null);
    }
    // NO context: invert YES prices
    return isBuying
      ? (bestBidYes > 0 ? 1 - bestBidYes : null)
      : (bestAskYes > 0 ? 1 - bestAskYes : null);
  }, [isYes, isBuying, bestBidYes, bestAskYes]);

  // Max depth for depth bars
  const maxBidSize = useMemo(() => {
    if (bids.length === 0) return 1;
    return Math.max(...bids.map(b => parseFloat(b.amount)));
  }, [bids]);

  const maxAskSize = useMemo(() => {
    if (asks.length === 0) return 1;
    return Math.max(...asks.map(a => parseFloat(a.amount)));
  }, [asks]);

  // Click-to-fill: clicking an orderbook level sets the price
  const handleOrderbookClick = useCallback((level: OrderLevel) => {
    const displayP = isYes ? level.yesPrice : 1 - level.yesPrice;
    setTradePrice(displayP.toFixed(3));
    setIsPriceTouched(true);
  }, [isYes]);

  // MAX button
  const handleMax = useCallback(() => {
    const bal = Number(availableBalance) / 1e18;
    if (isBuying && priceNum > 0) {
      const maxShares = Math.floor(bal / priceNum);
      if (maxShares > 0) setTradeAmount(maxShares.toString());
    } else {
      const shares = isYes ? yesShares : noShares;
      if (shares !== undefined && shares > 0n) {
        const formatted = Math.floor(Number(shares) / 1e18);
        if (formatted > 0) setTradeAmount(formatted.toString());
      }
    }
  }, [availableBalance, priceNum, isBuying, isYes, yesShares, noShares]);

  const handleCancel = async () => {
    const tickNum = parseInt(cancelTick, 10);
    if (isNaN(tickNum) || tickNum < 1 || tickNum > 999) return;
    const side = cancelSide === 'yes' ? 1 : 0;
    const orderId = `${side}:${tickNum}`;
    await cancelOrder(orderId);
    setCancelTick('');
  };

  const yesFormatted = yesShares !== undefined ? (Number(yesShares) / 1e18).toFixed(2) : '0.00';
  const noFormatted = noShares !== undefined ? (Number(noShares) / 1e18).toFixed(2) : '0.00';
  const hasShares = (yesShares !== undefined && yesShares > 0n) || (noShares !== undefined && noShares > 0n);
  const canRedeem = marketStatus === 'finalized' && hasShares;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Outcome-relative orderbook: flip sides when viewing NO
  // bids = YES buyers, asks = NO buyers (always in YES terms from hook)
  // When viewing YES: left = bids (YES buyers), right = asks (NO buyers / YES sellers)
  // When viewing NO:  left = asks (NO buyers = NO bids), right = bids (YES buyers = NO sellers)
  const obBids = isYes ? bids : asks;
  const obAsks = isYes ? asks : bids;
  const obBidMax = isYes ? maxBidSize : maxAskSize;
  const obAskMax = isYes ? maxAskSize : maxBidSize;
  const visibleBids = obBids.slice(0, 12);
  const visibleAsks = obAsks.slice(0, 12);
  const obLabel = isYes ? 'YES' : 'NO';
  const obLabelOpp = isYes ? 'NO' : 'YES';
  /** Convert a YES-price to display price for the active outcome */
  const obPrice = (yesPrice: number) => isYes ? yesPrice : 1 - yesPrice;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-full max-w-5xl surface-card rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="relative border-b border-white/[0.04] px-6 py-4 flex-shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-zinc-50 leading-snug line-clamp-2">
                  {market.question || market.name || 'Unnamed Market'}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-zinc-500">
                  <span>{marketChainName}</span>
                  <span className="text-zinc-700">·</span>
                  {renderBadge(marketStatus)}
                  <span className="text-zinc-700">·</span>
                  <span title={market.address}>{shortAddr(market.address)}</span>
                  {instance && (
                    <>
                      <span className="text-zinc-700">·</span>
                      <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[10px]">
                        {instance.id}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Wallet + Chain area */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {isConnected && isWrongChain && marketChainId && (
                  <button
                    onClick={() => switchChain({ chainId: marketChainId })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 border border-amber-500/25 text-amber-400 hover:bg-amber-500/25 transition-colors"
                  >
                    <ChevronDown className="w-3 h-3" />
                    Switch to {marketChainName}
                  </button>
                )}
                <button
                  onClick={() => isConnected ? open({ view: 'Account' }) : open()}
                  className="flex items-center gap-2 bg-zinc-900 border border-white/[0.06] text-zinc-300 hover:border-white/[0.12] hover:text-zinc-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                >
                  {isConnected ? (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="font-mono">{shortAddr(address!)}</span>
                    </>
                  ) : (
                    <>
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Connect</span>
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-50 hover:bg-white/[0.04] rounded-full transition-colors text-lg leading-none"
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* Left Column: Orderbook + Chart + Orders */}
            <div className="w-full md:w-[60%] border-r border-white/[0.04] p-5 flex flex-col gap-3 overflow-y-auto no-scrollbar">
              {/* Orderbook header with spread */}
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Orderbook</h3>
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  {midPrice !== null && (
                    <span className="text-zinc-400">
                      Mid <span className="text-zinc-200">{formatCents(isYes ? midPrice : 1 - midPrice)}</span>
                    </span>
                  )}
                  {spread !== null && (
                    <span className="text-zinc-500">
                      Spread <span className="text-zinc-400">{formatCents(spread)}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Bids side (outcome-relative) */}
                <div className="bg-zinc-950/40 rounded-xl border border-white/[0.04] flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center px-3 py-2 border-b border-white/[0.04]">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Size ({obLabel})</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Price</span>
                  </div>
                  <div className="overflow-y-auto no-scrollbar h-[280px]">
                    {isLoading ? (
                      <div className="space-y-1.5 p-2">
                        {[...Array(5)].map((_, i) => <div key={i} className="h-5 skeleton rounded w-full" />)}
                      </div>
                    ) : visibleBids.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-zinc-600 text-xs">No bids</div>
                    ) : (
                      <div className="flex flex-col">
                        {visibleBids.map((bid, i) => {
                          const size = parseFloat(bid.amount);
                          const depthPct = (size / obBidMax) * 100;
                          return (
                            <button
                              key={`bid-${bid.tick}-${i}`}
                              onClick={() => handleOrderbookClick(bid)}
                              className="relative flex justify-between items-center px-3 py-1 hover:bg-white/[0.03] transition-colors text-left group"
                            >
                              <div
                                className="absolute inset-y-0 right-0 bg-emerald-500/[0.07] transition-all"
                                style={{ width: `${depthPct}%` }}
                              />
                              <span className="relative text-xs font-mono text-emerald-400 tabular-nums">{size.toFixed(1)}</span>
                              <span className="relative text-xs font-mono text-zinc-300 tabular-nums group-hover:text-white">{formatCents(obPrice(bid.yesPrice))}</span>
                            </button>
                          );
                        })}
                        {obBids.length > 12 && (
                          <div className="px-3 py-1 text-[10px] text-zinc-600 font-mono text-center">
                            +{obBids.length - 12} more levels
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Asks side (outcome-relative) */}
                <div className="bg-zinc-950/40 rounded-xl border border-white/[0.04] flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center px-3 py-2 border-b border-white/[0.04]">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Price</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Size ({obLabelOpp})</span>
                  </div>
                  <div className="overflow-y-auto no-scrollbar h-[280px]">
                    {isLoading ? (
                      <div className="space-y-1.5 p-2">
                        {[...Array(5)].map((_, i) => <div key={i} className="h-5 skeleton rounded w-full" />)}
                      </div>
                    ) : visibleAsks.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-zinc-600 text-xs">No asks</div>
                    ) : (
                      <div className="flex flex-col">
                        {visibleAsks.map((ask, i) => {
                          const size = parseFloat(ask.amount);
                          const depthPct = (size / obAskMax) * 100;
                          return (
                            <button
                              key={`ask-${ask.tick}-${i}`}
                              onClick={() => handleOrderbookClick(ask)}
                              className="relative flex justify-between items-center px-3 py-1 hover:bg-white/[0.03] transition-colors text-left group"
                            >
                              <div
                                className="absolute inset-y-0 left-0 bg-rose-500/[0.07] transition-all"
                                style={{ width: `${depthPct}%` }}
                              />
                              <span className="relative text-xs font-mono text-zinc-300 tabular-nums group-hover:text-white">{formatCents(obPrice(ask.yesPrice))}</span>
                              <span className="relative text-xs font-mono text-rose-400 tabular-nums">{size.toFixed(1)}</span>
                            </button>
                          );
                        })}
                        {obAsks.length > 12 && (
                          <div className="px-3 py-1 text-[10px] text-zinc-600 font-mono text-center">
                            +{obAsks.length - 12} more levels
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Position summary */}
              {hasShares && (
                <div className="flex items-center gap-4 px-1 py-1.5 text-[11px] font-mono">
                  <span className="text-zinc-500 uppercase tracking-wider">Position</span>
                  <span className="text-emerald-400">{yesFormatted} YES</span>
                  <span className="text-rose-400">{noFormatted} NO</span>
                </div>
              )}

              {/* Historical price chart */}
              <HistoricalPriceCard
                chainId={market.chainId ?? 84532}
                marketKey={marketKey as `0x${string}`}
                viewOutcome={viewOutcome}
              />

              {/* Open orders */}
              <UserOrdersPanel
                marketId={market.address as `0x${string}`}
                marketKey={marketKey as `0x${string}`}
                soothBookAddress={market.soothBookAddress as `0x${string}` | undefined}
                isLoading={false}
                onRefresh={() => {}}
                chainId={market.chainId ?? 84532}
                viewOutcome={viewOutcome}
                onCancelOrder={cancelOrder}
              />
            </div>

            {/* Right Column: Trading Panels */}
            <div className="w-full md:w-[40%] flex flex-col bg-black/20">
              <div className="flex px-4 pt-2 border-b border-white/[0.04]">
                <button
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'trade'
                      ? 'border-amber-500 text-zinc-50'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                  onClick={() => setActiveTab('trade')}
                >
                  Trade
                </button>
                <button
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'mint'
                      ? 'border-amber-500 text-zinc-50'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                  onClick={() => setActiveTab('mint')}
                >
                  Mint / Merge
                </button>
                <button
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'manage'
                      ? 'border-amber-500 text-zinc-50'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                  onClick={() => setActiveTab('manage')}
                >
                  Manage
                </button>
              </div>

              <div className="p-5 flex-1 overflow-y-auto no-scrollbar">
                {activeTab === 'trade' && (
                  <div className="flex flex-col gap-4">
                    {/* YES / NO toggle (ABOVE buy/sell — controls everything) */}
                    <div className="flex border-b border-white/[0.04]">
                      <button
                        className={cn(
                          'flex-1 py-2.5 text-sm font-semibold transition-all border-b-2',
                          isYes
                            ? 'border-emerald-500 text-emerald-400 bg-emerald-500/[0.05]'
                            : 'border-transparent text-zinc-500 hover:text-zinc-300',
                        )}
                        onClick={() => setAction(isBuying ? 'buy_yes' : 'sell_yes')}
                      >
                        YES
                      </button>
                      <button
                        className={cn(
                          'flex-1 py-2.5 text-sm font-semibold transition-all border-b-2',
                          !isYes
                            ? 'border-rose-500 text-rose-400 bg-rose-500/[0.05]'
                            : 'border-transparent text-zinc-500 hover:text-zinc-300',
                        )}
                        onClick={() => setAction(isBuying ? 'buy_no' : 'sell_no')}
                      >
                        NO
                      </button>
                    </div>

                    {/* Buy / Sell toggle */}
                    <div className="flex p-1 bg-zinc-950 rounded-xl border border-white/[0.06]">
                      <button
                        className={cn(
                          'flex-1 py-2 text-sm font-semibold rounded-lg transition-all',
                          isBuying ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300',
                        )}
                        onClick={() => setAction(isYes ? 'buy_yes' : 'buy_no')}
                      >
                        Buy
                      </button>
                      <button
                        className={cn(
                          'flex-1 py-2 text-sm font-semibold rounded-lg transition-all',
                          !isBuying ? 'bg-rose-500/20 text-rose-400' : 'text-zinc-500 hover:text-zinc-300',
                        )}
                        onClick={() => setAction(isYes ? 'sell_yes' : 'sell_no')}
                      >
                        Sell
                      </button>
                    </div>

                    {/* Price */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                          {isYes ? 'YES' : 'NO'} Price
                        </label>
                        <span className={cn(
                          'text-sm font-mono tabular-nums',
                          isYes ? 'text-emerald-400' : 'text-rose-400',
                        )}>
                          {formatCents(Number(tradePrice))}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="999"
                        step="1"
                        value={Math.round(Number(tradePrice) * 1000)}
                        onChange={(e) => {
                          setTradePrice((Number(e.target.value) / 1000).toFixed(3));
                          setIsPriceTouched(true);
                        }}
                        className={cn(
                          'w-full',
                          isYes ? 'accent-emerald-500' : 'accent-rose-500',
                        )}
                      />
                      <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                        <span>0¢</span><span>50¢</span><span>100¢</span>
                      </div>
                      {bestPriceDisplay !== null && (
                        <button
                          onClick={() => {
                            setTradePrice(bestPriceDisplay.toFixed(3));
                            setIsPriceTouched(true);
                          }}
                          className="flex items-center gap-1.5 px-1 text-[11px] font-mono text-zinc-500 hover:text-amber-400 transition-colors"
                        >
                          Best {isBuying ? 'ask' : 'bid'}:
                          <span className="text-zinc-300">{formatCents(bestPriceDisplay)}</span>
                          <span className="text-zinc-600 text-[10px]">click to use</span>
                        </button>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Amount (shares)</label>
                        <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                          {isBuying
                            ? `Bal: ${(Number(availableBalance) / 1e18).toFixed(2)} USDC`
                            : `${isYes ? 'YES' : 'NO'}: ${isYes ? yesFormatted : noFormatted}`
                          }
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={tradeAmount}
                          onChange={(e) => setTradeAmount(e.target.value)}
                          placeholder="0"
                          className={cn(
                            'w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-4 py-2.5 text-zinc-100 font-mono text-lg focus:outline-none transition-colors placeholder:text-zinc-600 pr-16',
                            isYes ? 'focus:border-emerald-500/50' : 'focus:border-rose-500/50',
                          )}
                          disabled={isPending}
                        />
                        <button
                          onClick={handleMax}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-2 py-1 rounded-lg transition-colors"
                          disabled={isPending}
                        >
                          MAX
                        </button>
                      </div>
                    </div>

                    {/* Cost estimate */}
                    {estimatedCost !== null && amountNum > 0 && (
                      <div className="flex justify-between items-center px-1 py-1.5 bg-zinc-950/60 rounded-lg border border-white/[0.03]">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">{isBuying ? 'Est. Cost' : 'Est. Proceeds'}</span>
                        <span className="text-sm font-mono text-zinc-200 tabular-nums">
                          {estimatedCost.toFixed(2)} USDC
                        </span>
                      </div>
                    )}

                    {/* Sell info */}
                    {!isBuying && (
                      <div className="text-[11px] font-mono text-zinc-500 px-1">
                        Selling burns your {isYes ? 'YES' : 'NO'} tokens via escrow
                      </div>
                    )}

                    {/* Place order button */}
                    {!isConnected ? (
                      <button
                        onClick={() => open()}
                        className="w-full py-3 rounded-xl bg-zinc-200 hover:bg-white text-zinc-900 font-semibold transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Wallet className="w-4 h-4" />
                        Connect Wallet
                      </button>
                    ) : isWrongChain ? (
                      <button
                        onClick={() => marketChainId && switchChain({ chainId: marketChainId })}
                        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        Switch to {marketChainName}
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          if (!tradeAmount || Number(tradeAmount) <= 0) return;
                          // priceForHook is always YES-equivalent for the hook
                          const ok = await placeOrder(tradeOutcome, priceForHook.toFixed(3), tradeAmount, isBuying);
                          if (ok) {
                            setTradeAmount('1');
                            refetchBalance();
                          }
                        }}
                        disabled={!tradeAmount || Number(tradeAmount) <= 0 || isPending}
                        className={cn(
                          'w-full py-3 rounded-xl font-semibold transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed',
                          isYes
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-zinc-950'
                            : 'bg-rose-600 hover:bg-rose-500 text-zinc-50',
                        )}
                      >
                        {isPending
                          ? <Loader2 className="w-5 h-5 animate-spin" />
                          : `${isBuying ? 'Buy' : 'Sell'} ${isYes ? 'YES' : 'NO'}${estimatedCost !== null ? ` · $${estimatedCost.toFixed(2)}` : ''}`
                        }
                      </button>
                    )}
                  </div>
                )}

                {activeTab === 'mint' && <MintMergePanel market={market} />}

                {activeTab === 'manage' && (
                  <div className="flex flex-col gap-8">
                    {!isConnected ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <p className="text-zinc-500 text-sm">Connect wallet to manage</p>
                        <button
                          onClick={() => open()}
                          className="flex items-center gap-2 bg-zinc-200 hover:bg-white text-zinc-900 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                        >
                          <Wallet className="w-4 h-4" />
                          Connect Wallet
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-5">
                          <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Cancel Order</h3>

                          <div className="flex p-1 bg-zinc-950 rounded-xl border border-white/[0.06]">
                            <button
                              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                                cancelSide === 'yes'
                                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                              onClick={() => setCancelSide('yes')}
                            >
                              YES
                            </button>
                            <button
                              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                                cancelSide === 'no'
                                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                              onClick={() => setCancelSide('no')}
                            >
                              NO
                            </button>
                          </div>

                          <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 px-1">
                              Tick (1-999)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="999"
                              step="1"
                              value={cancelTick}
                              onChange={(e) => setCancelTick(e.target.value)}
                              placeholder="500"
                              className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-4 py-2.5 text-zinc-100 font-mono text-lg focus:outline-none focus:border-white/[0.12] transition-colors placeholder:text-zinc-600"
                              disabled={isPending}
                            />
                          </div>

                          <button
                            onClick={handleCancel}
                            disabled={!cancelTick || isPending}
                            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cancel Order'}
                          </button>
                        </div>

                        {['settled', 'finalized'].includes(marketStatus) && (
                          <div className="flex flex-col gap-5 pt-5 border-t border-white/[0.04]">
                            <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Redeem Shares</h3>

                            <div className="flex justify-between items-center px-1">
                              <div className="flex items-baseline gap-2">
                                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">YES</span>
                                <span className="text-sm font-medium text-zinc-300 tabular-nums">{yesFormatted}</span>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">NO</span>
                                <span className="text-sm font-medium text-zinc-300 tabular-nums">{noFormatted}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => redeem()}
                              disabled={!canRedeem || isPending}
                              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : marketStatus === 'finalized' ? 'Redeem Winnings' : 'Waiting for Finalization...'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
