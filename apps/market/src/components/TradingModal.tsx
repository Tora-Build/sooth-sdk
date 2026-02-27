import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Loader2, Wallet, ChevronDown } from 'lucide-react';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { useAccount, useSwitchChain } from 'wagmi';
import { keccak256, encodePacked, Address } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { LaunchpadMarket, getMarketStatus } from '../types';
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

const STATUS_COLORS: Record<string, string> = {
  live: 'text-emerald-400',
  settled: 'text-zinc-400',
  dismissed: 'text-zinc-400',
  finalized: 'text-blue-400',
};

function formatCents(price: number): string {
  return `${(price * 100).toFixed(1)}¢`;
}

// ── Component ──────────────────────────────────────────────────────────

export function TradingModal({ market, onClose }: TradingModalProps) {
  const [activeTab, setActiveTab] = useState<'trade' | 'mint' | 'wallet'>('trade');
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

  const { placeOrder, cancelOrder, isPending, availableBalance, refetchBalance } = useOrderbookTrade(
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
  const [tradeAmount, setTradeAmount] = useState('10');
  const [isPriceTouched, setIsPriceTouched] = useState(false);


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
    // Buy: cost = price * amount
    // Sell (escrow): collateral = (1 - price) * amount
    return isBuying ? priceNum * amountNum : (1 - priceNum) * amountNum;
  }, [priceNum, amountNum, isBuying]);

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

  // Determine sell mode: escrow (burn tokens) vs short (USDC collateral)
  const relevantTokenBalance = isYes ? (yesShares ?? 0n) : (noShares ?? 0n);
  const relevantTokenBalanceNum = Number(relevantTokenBalance) / 1e18;
  const isEscrowSell = !isBuying && relevantTokenBalance > 0n;

  // MAX button
  const handleMax = useCallback(() => {
    if (!isBuying && relevantTokenBalance > 0n) {
      // Escrow sell: max shares = token balance
      const maxShares = Math.floor(relevantTokenBalanceNum);
      if (maxShares > 0) setTradeAmount(maxShares.toString());
    } else {
      // Buy or short sell: max shares = USDC balance / effective price
      const bal = Number(availableBalance) / 1e18;
      const effectivePrice = isBuying ? priceNum : (1 - priceNum);
      if (effectivePrice > 0) {
        const maxShares = Math.floor(bal / effectivePrice);
        if (maxShares > 0) setTradeAmount(maxShares.toString());
      }
    }
  }, [availableBalance, priceNum, isBuying, relevantTokenBalance, relevantTokenBalanceNum]);

  const yesFormatted = yesShares !== undefined ? (Number(yesShares) / 1e18).toFixed(2) : '0.00';
  const noFormatted = noShares !== undefined ? (Number(noShares) / 1e18).toFixed(2) : '0.00';
  const hasShares = (yesShares !== undefined && yesShares > 0n) || (noShares !== undefined && noShares > 0n);

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
  /** Convert a YES-price to display price for the active outcome */
  const obPrice = (yesPrice: number) => isYes ? yesPrice : 1 - yesPrice;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="w-full max-w-5xl bg-zinc-900/80 border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
          style={{ backdropFilter: 'blur(16px)', boxShadow: '0 24px 64px -16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)' }}
        >
          {/* Header */}
          <div className="relative border-b border-white/[0.04] px-6 py-4 flex-shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-zinc-50 leading-snug line-clamp-2 tracking-tight">
                  {market.question || market.name || 'Unnamed Market'}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-zinc-500">
                  <span>{marketChainName}</span>
                  <span className={cn('uppercase tracking-wider', STATUS_COLORS[marketStatus] || 'text-zinc-400')}>
                    {marketStatus}
                  </span>
                  <span title={market.address} className="text-zinc-600">{shortAddr(market.address)}</span>
                  {instance && (
                    <span className="text-zinc-600">{instance.id}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isConnected && isWrongChain && marketChainId && (
                  <button
                    onClick={() => switchChain({ chainId: marketChainId })}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    <ChevronDown className="w-3 h-3" />
                    {marketChainName}
                  </button>
                )}
                <button
                  onClick={() => isConnected ? open({ view: 'Account' }) : open()}
                  className="flex items-center gap-1.5 bg-zinc-800/60 border border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.1] px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-all"
                >
                  {isConnected ? (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      {shortAddr(address!)}
                    </>
                  ) : (
                    <>
                      <Wallet className="w-3 h-3" />
                      <span className="font-sans font-medium">Connect</span>
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-white/[0.04] transition-colors"
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* Left Column: Orderbook + Chart + Orders */}
            <div className="w-full md:w-[60%] border-r border-white/[0.04] p-4 flex flex-col gap-6 overflow-y-auto no-scrollbar">
              {/* Orderbook */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-0">
                {/* Bids column */}
                <div className="flex flex-col">
                  <div className="flex justify-between items-center px-2.5 pb-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Size</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Bid</span>
                  </div>
                  <div className="overflow-y-auto no-scrollbar h-[260px]">
                    {isLoading ? (
                      <div className="space-y-1 p-2">
                        {[...Array(6)].map((_, i) => <div key={i} className="h-[22px] skeleton rounded w-full" />)}
                      </div>
                    ) : visibleBids.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-zinc-700 text-[11px] font-mono">Empty</div>
                    ) : (
                      <div className="flex flex-col">
                        {visibleBids.map((bid, i) => {
                          const size = parseFloat(bid.amount);
                          const depthPct = (size / obBidMax) * 100;
                          return (
                            <button
                              key={`bid-${bid.tick}-${i}`}
                              onClick={() => handleOrderbookClick(bid)}
                              className="relative flex justify-between items-center px-2.5 py-[3px] hover:bg-emerald-500/[0.06] transition-colors group"
                            >
                              <div
                                className="absolute inset-y-0 right-0 bg-emerald-500/[0.08]"
                                style={{ width: `${depthPct}%` }}
                              />
                              <span className="relative text-[11px] font-mono text-zinc-400 tabular-nums">{size.toFixed(1)}</span>
                              <span className="relative text-[11px] font-mono text-emerald-400/90 tabular-nums group-hover:text-emerald-300">{formatCents(obPrice(bid.yesPrice))}</span>
                            </button>
                          );
                        })}
                        {obBids.length > 12 && (
                          <div className="px-2.5 py-1 text-[10px] text-zinc-700 font-mono text-center">
                            +{obBids.length - 12} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Center divider — Mid / Spread */}
                <div className="flex flex-col items-center justify-start pt-6 px-2 gap-3 border-x border-white/[0.03] min-w-[72px]">
                  {midPrice !== null && (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">Mid</span>
                      <span className="text-xs font-mono text-zinc-200 tabular-nums">{formatCents(isYes ? midPrice : 1 - midPrice)}</span>
                    </div>
                  )}
                  {spread !== null && (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">Spread</span>
                      <span className="text-[11px] font-mono text-zinc-500 tabular-nums">{formatCents(spread)}</span>
                    </div>
                  )}
                </div>

                {/* Asks column */}
                <div className="flex flex-col">
                  <div className="flex justify-between items-center px-2.5 pb-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Ask</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Size</span>
                  </div>
                  <div className="overflow-y-auto no-scrollbar h-[260px]">
                    {isLoading ? (
                      <div className="space-y-1 p-2">
                        {[...Array(6)].map((_, i) => <div key={i} className="h-[22px] skeleton rounded w-full" />)}
                      </div>
                    ) : visibleAsks.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-zinc-700 text-[11px] font-mono">Empty</div>
                    ) : (
                      <div className="flex flex-col">
                        {visibleAsks.map((ask, i) => {
                          const size = parseFloat(ask.amount);
                          const depthPct = (size / obAskMax) * 100;
                          return (
                            <button
                              key={`ask-${ask.tick}-${i}`}
                              onClick={() => handleOrderbookClick(ask)}
                              className="relative flex justify-between items-center px-2.5 py-[3px] hover:bg-rose-500/[0.06] transition-colors group"
                            >
                              <div
                                className="absolute inset-y-0 left-0 bg-rose-500/[0.08]"
                                style={{ width: `${depthPct}%` }}
                              />
                              <span className="relative text-[11px] font-mono text-rose-400/90 tabular-nums group-hover:text-rose-300">{formatCents(obPrice(ask.yesPrice))}</span>
                              <span className="relative text-[11px] font-mono text-zinc-400 tabular-nums">{size.toFixed(1)}</span>
                            </button>
                          );
                        })}
                        {obAsks.length > 12 && (
                          <div className="px-2.5 py-1 text-[10px] text-zinc-700 font-mono text-center">
                            +{obAsks.length - 12} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Position summary */}
              {hasShares && (
                <div className="flex items-center gap-4 px-1 text-[11px] font-mono">
                  <span className="text-zinc-600 uppercase tracking-wider">Position</span>
                  <span className="text-emerald-400/80">{yesFormatted} YES</span>
                  <span className="text-rose-400/80">{noFormatted} NO</span>
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
            <div className="w-full md:w-[40%] flex flex-col">
              <div className="flex px-4 pt-1 border-b border-white/[0.04]">
                {(['trade', 'mint', 'wallet'] as const).map((tab) => (
                  <button
                    key={tab}
                    className={cn(
                      'px-4 py-2.5 text-[12px] font-medium uppercase tracking-wider border-b-2 transition-colors',
                      activeTab === tab
                        ? 'border-amber-500/80 text-zinc-100'
                        : 'border-transparent text-zinc-600 hover:text-zinc-400',
                    )}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'mint' ? 'Mint / Merge' : tab === 'wallet' ? 'Wallet' : tab}
                  </button>
                ))}
              </div>

              <div className="p-4 flex-1 overflow-y-auto no-scrollbar">
                {activeTab === 'trade' && (
                  <div className="flex flex-col gap-3">
                    {/* Unified outcome + direction selector */}
                    <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-950/80 rounded-xl border border-white/[0.04]">
                      {([
                        { key: 'buy_yes' as const, label: 'Buy YES', color: 'emerald' },
                        { key: 'sell_yes' as const, label: 'Sell YES', color: 'emerald' },
                        { key: 'buy_no' as const, label: 'Buy NO', color: 'rose' },
                        { key: 'sell_no' as const, label: 'Sell NO', color: 'rose' },
                      ]).map(({ key, label, color }) => (
                        <button
                          key={key}
                          onClick={() => setAction(key)}
                          className={cn(
                            'py-2 text-[11px] font-semibold rounded-lg transition-all tracking-wide',
                            action === key
                              ? color === 'emerald'
                                ? 'bg-emerald-500/15 text-emerald-400 shadow-sm'
                                : 'bg-rose-500/15 text-rose-400 shadow-sm'
                              : 'text-zinc-600 hover:text-zinc-400',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Price */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                          Limit Price
                        </label>
                        <span className={cn(
                          'text-sm font-mono tabular-nums font-medium',
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
                          'w-full h-1 rounded-full appearance-none cursor-pointer',
                          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-900 [&::-webkit-slider-thumb]:shadow-sm',
                          isYes
                            ? 'bg-zinc-800 [&::-webkit-slider-thumb]:bg-emerald-400'
                            : 'bg-zinc-800 [&::-webkit-slider-thumb]:bg-rose-400',
                        )}
                      />
                      <div className="flex justify-between text-[9px] font-mono text-zinc-700">
                        <span>1¢</span><span>50¢</span><span>99.9¢</span>
                      </div>
                      {bestPriceDisplay !== null && (
                        <button
                          onClick={() => {
                            setTradePrice(bestPriceDisplay.toFixed(3));
                            setIsPriceTouched(true);
                          }}
                          className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors"
                        >
                          Best {isBuying ? 'ask' : 'bid'}:
                          <span className="text-zinc-400">{formatCents(bestPriceDisplay)}</span>
                        </button>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Shares</label>
                        <button
                          onClick={handleMax}
                          disabled={isPending}
                          className="text-[10px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors tabular-nums"
                        >
                          {!isBuying && relevantTokenBalance > 0n
                            ? `${relevantTokenBalanceNum.toFixed(0)} ${isYes ? 'YES' : 'NO'}`
                            : `${(Number(availableBalance) / 1e18).toFixed(2)} USDC`
                          }
                          <span className="ml-1 text-amber-500/70">MAX</span>
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(e.target.value)}
                        placeholder="0"
                        className={cn(
                          'w-full bg-zinc-950/80 border border-white/[0.05] rounded-lg px-3 py-2.5 text-zinc-100 font-mono text-base focus:outline-none transition-colors placeholder:text-zinc-700',
                          isYes ? 'focus:border-emerald-500/40' : 'focus:border-rose-500/40',
                        )}
                        disabled={isPending}
                      />
                    </div>

                    {/* Order summary */}
                    {estimatedCost !== null && amountNum > 0 && (
                      <div className="flex flex-col gap-1 py-2 border-t border-white/[0.03]">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                            {isBuying ? 'Total Cost' : isEscrowSell ? 'Tokens Burned' : 'Collateral'}
                          </span>
                          <span className="text-[13px] font-mono text-zinc-200 tabular-nums">
                            {isEscrowSell
                              ? `${amountNum} ${isYes ? 'YES' : 'NO'}`
                              : `$${estimatedCost.toFixed(2)}`
                            }
                          </span>
                        </div>
                        {isBuying && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-700">Payout if correct</span>
                            <span className="text-[11px] font-mono text-zinc-500 tabular-nums">${amountNum.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sell mode indicator */}
                    {!isBuying && (
                      <div className={cn(
                        'text-[10px] font-mono px-2.5 py-1.5 rounded-lg border leading-relaxed',
                        isEscrowSell
                          ? 'text-cyan-400/80 bg-cyan-950/20 border-cyan-900/20'
                          : 'text-amber-400/80 bg-amber-950/20 border-amber-900/20',
                      )}>
                        {isEscrowSell
                          ? `Burns ${isYes ? 'YES' : 'NO'} tokens as collateral. Fills auto-merge to USDC.`
                          : `Short sell with USDC collateral. No tokens required.`
                        }
                      </div>
                    )}

                    {/* CTA */}
                    {!isConnected ? (
                      <button
                        onClick={() => open()}
                        className="w-full py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        Connect Wallet
                      </button>
                    ) : isWrongChain ? (
                      <button
                        onClick={() => marketChainId && switchChain({ chainId: marketChainId })}
                        className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-semibold transition-all active:scale-[0.98]"
                      >
                        Switch to {marketChainName}
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          if (!tradeAmount || Number(tradeAmount) <= 0) return;
                          const ok = await placeOrder(tradeOutcome, priceForHook.toFixed(3), tradeAmount, isBuying);
                          if (ok) {
                            setTradeAmount('10');
                            refetchBalance();
                          }
                        }}
                        disabled={!tradeAmount || Number(tradeAmount) <= 0 || isPending}
                        className={cn(
                          'w-full py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed',
                          isBuying
                            ? isYes
                              ? 'bg-emerald-500/90 hover:bg-emerald-500 text-zinc-950'
                              : 'bg-rose-500/90 hover:bg-rose-500 text-white'
                            : 'bg-zinc-200 hover:bg-white text-zinc-900',
                        )}
                      >
                        {isPending
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <>
                              {isBuying ? 'Buy' : 'Sell'} {isYes ? 'YES' : 'NO'}
                              {estimatedCost !== null && !isEscrowSell && (
                                <span className="opacity-60 font-mono text-[11px] ml-1">${estimatedCost.toFixed(2)}</span>
                              )}
                            </>
                        }
                      </button>
                    )}
                  </div>
                )}

                {activeTab === 'mint' && <MintMergePanel market={market} />}

                {activeTab === 'wallet' && (
                  <div className="flex flex-col gap-4">
                    {!isConnected ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <p className="text-zinc-500 text-sm">Connect wallet to view balances</p>
                        <button
                          onClick={() => open()}
                          className="flex items-center gap-2 bg-zinc-100 hover:bg-white text-zinc-900 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          Connect
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1 py-3 border-b border-white/[0.04]">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">USDC</span>
                          <span className="text-sm font-mono text-zinc-300">
                            ${(Number(availableBalance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 py-3 border-b border-white/[0.04]">
                          <span className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-wider">YES</span>
                          <span className="text-sm font-mono text-zinc-300">{yesFormatted}</span>
                        </div>
                        <div className="flex flex-col gap-1 py-3 border-b border-white/[0.04]">
                          <span className="text-[10px] font-bold text-rose-400/70 uppercase tracking-wider">NO</span>
                          <span className="text-sm font-mono text-zinc-300">{noFormatted}</span>
                        </div>
                      </div>
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
