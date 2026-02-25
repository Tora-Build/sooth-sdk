import React, { useMemo, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppKitAccount } from '@reown/appkit/react';
import { keccak256, encodePacked, Address } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { LaunchpadMarket, getMarketStatus, MarketStatus } from '../types';
import { useOrderbook } from '../hooks/useOrderbook';
import { useSoothBookBalance } from '../hooks/useSoothBook';
import { useOrderbookTrade } from '../hooks/useOrderbookTrade';
import { MintMergePanel } from './MintMergePanel';
import { HistoricalPriceCard } from './HistoricalPriceCard';
import { UserOrdersPanel } from './UserOrdersPanel';
import { getInstanceBySoothBook } from '../config/deployments';

interface TradingModalProps {
  market: LaunchpadMarket;
  onClose: () => void;
}

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

export function TradingModal({ market, onClose }: TradingModalProps) {
  const [activeTab, setActiveTab] = useState<'trade' | 'mint' | 'manage'>('trade');
  const marketStatus = getMarketStatus(market);
  
  const marketKey = useMemo(() => {
    return keccak256(encodePacked(['address'], [market.address as Address]));
  }, [market.address]);

  const { bids, asks, isLoading } = useOrderbook(marketKey, market.soothBookAddress);
  const { yesShares, noShares } = useSoothBookBalance(market.address, market.soothBookAddress);

  const { isConnected } = useAppKitAccount();
  const { placeOrder, cancelOrder, redeem, isPending, availableBalance, refetchBalance } = useOrderbookTrade(
    market.address,
    market.soothBookAddress,
  );

  const [cancelSide, setCancelSide] = useState<'yes' | 'no'>('yes');
  const [cancelTick, setCancelTick] = useState<string>('');
  const [tradeOutcome, setTradeOutcome] = useState<0 | 1>(0);
  const [tradeIsBuy, setTradeIsBuy] = useState(true);
  const [tradePrice, setTradePrice] = useState('0.50');
  const [tradeAmount, setTradeAmount] = useState('');
  const [viewOutcome, setViewOutcome] = useState<'yes' | 'no'>('yes');

  const handleCancel = async () => {
    const tickNum = parseInt(cancelTick, 10);
    if (isNaN(tickNum) || tickNum < 1 || tickNum > 999) return;
    const side = cancelSide === 'yes' ? 1 : 0;
    const orderId = `${side}:${tickNum}`;
    await cancelOrder(orderId);
    setCancelTick('');
  };

  const handleRedeem = async () => {
    await redeem();
  };

  const yesFormatted = yesShares !== undefined ? (Number(yesShares) / 1e18).toFixed(2) : '0.00';
  const noFormatted = noShares !== undefined ? (Number(noShares) / 1e18).toFixed(2) : '0.00';
  const hasShares = (yesShares !== undefined && yesShares > 0n) || (noShares !== undefined && noShares > 0n);
  const canRedeem = marketStatus === 'finalized' && hasShares;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
          <div className="relative border-b border-white/[0.04] p-6 pr-14 flex-shrink-0">
            <h2 className="text-xl font-semibold text-zinc-50 leading-snug line-clamp-2">
              {market.question || market.name || 'Unnamed Market'}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Address</span>
                <span className="text-sm font-mono text-zinc-400">{shortAddr(market.address)}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Creator</span>
                <span className="text-sm font-mono text-zinc-400">{shortAddr(market.creator)}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Status</span>
                {renderBadge(marketStatus)}
              </div>
              {market.soothBookAddress && (() => {
                const inst = getInstanceBySoothBook(market.soothBookAddress);
                return inst ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Node</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded">
                      {inst.id}
                    </span>
                  </div>
                ) : null;
              })()}
            </div>

            {market.soothBookAddress && (
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mt-1">
                <span>{getInstanceBySoothBook(market.soothBookAddress)?.chainName ?? 'Unknown Chain'}</span>
                <span>·</span>
                <span>SoothBook</span>
                <a
                  href={`${getInstanceBySoothBook(market.soothBookAddress)?.explorer ?? 'https://sepolia.basescan.org'}/address/${market.soothBookAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-amber-400 transition-colors"
                >
                  {market.soothBookAddress.slice(0, 6)}...{market.soothBookAddress.slice(-4)}
                </a>
              </div>
            )}

            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-50 hover:bg-white/[0.04] rounded-full transition-colors text-2xl leading-none"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* Left Column: Orderbook */}
            <div className="w-full md:w-[60%] border-r border-white/[0.04] p-6 flex flex-col gap-4 overflow-y-auto no-scrollbar">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Orderbook</h3>
              
              <div className="grid grid-cols-2 gap-4 flex-1">
                {/* Bids */}
                <div className="bg-zinc-950/40 rounded-xl border border-white/[0.04] flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-3 border-b border-white/[0.04]">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Size (YES)</span>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Tick</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 no-scrollbar min-h-[200px]">
                    {isLoading ? (
                      <div className="space-y-2 p-2">
                        <div className="h-6 skeleton rounded w-full"></div>
                        <div className="h-6 skeleton rounded w-full"></div>
                        <div className="h-6 skeleton rounded w-full"></div>
                      </div>
                    ) : bids.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">No bids</div>
                    ) : (
                      <div className="flex flex-col">
                        {bids.map((bid, i) => (
                          <div key={`bid-${bid.tick}-${i}`} className="flex justify-between items-center px-2 py-1.5 hover:bg-white/[0.02] rounded-lg transition-colors cursor-default">
                            <span className="text-sm font-mono text-emerald-400 tabular-nums">{parseFloat(bid.amount).toFixed(2)}</span>
                            <span className="text-sm font-mono text-zinc-300 tabular-nums">{(bid.tick / 10).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Asks */}
                <div className="bg-zinc-950/40 rounded-xl border border-white/[0.04] flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-3 border-b border-white/[0.04]">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Tick</span>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Size (NO)</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 no-scrollbar min-h-[200px]">
                    {isLoading ? (
                      <div className="space-y-2 p-2">
                        <div className="h-6 skeleton rounded w-full"></div>
                        <div className="h-6 skeleton rounded w-full"></div>
                        <div className="h-6 skeleton rounded w-full"></div>
                      </div>
                    ) : asks.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">No asks</div>
                    ) : (
                      <div className="flex flex-col">
                        {asks.map((ask, i) => (
                          <div key={`ask-${ask.tick}-${i}`} className="flex justify-between items-center px-2 py-1.5 hover:bg-white/[0.02] rounded-lg transition-colors cursor-default">
                            <span className="text-sm font-mono text-zinc-300 tabular-nums">{(ask.tick / 10).toFixed(1)}%</span>
                            <span className="text-sm font-mono text-rose-400 tabular-nums">{parseFloat(ask.amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2">
                <HistoricalPriceCard
                  chainId={market.chainId ?? 84532}
                  marketKey={marketKey as `0x${string}`}
                  viewOutcome={viewOutcome}
                />
              </div>
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

              <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
                {activeTab === 'trade' && (
                  <div className="flex flex-col gap-5">
                    <div className="flex p-1 bg-zinc-950 rounded-xl border border-white/[0.06]">
                      <button
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tradeIsBuy ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                        onClick={() => setTradeIsBuy(true)}
                      >
                        Buy
                      </button>
                      <button
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${!tradeIsBuy ? 'bg-rose-500/20 text-rose-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                        onClick={() => setTradeIsBuy(false)}
                      >
                        Sell
                      </button>
                    </div>

                    <div className="flex p-1 bg-zinc-950 rounded-xl border border-white/[0.06]">
                      <button
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tradeOutcome === 0 ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        onClick={() => {
                          setTradeOutcome(0);
                          setViewOutcome('yes');
                        }}
                      >
                        YES
                      </button>
                      <button
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tradeOutcome === 1 ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        onClick={() => {
                          setTradeOutcome(1);
                          setViewOutcome('no');
                        }}
                      >
                        NO
                      </button>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Price</label>
                        <span className="text-sm font-mono text-amber-400">{(Number(tradePrice) * 100).toFixed(1)}¢</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="999"
                        step="1"
                        value={Math.round(Number(tradePrice) * 1000)}
                        onChange={(e) => setTradePrice((Number(e.target.value) / 1000).toFixed(3))}
                        className="w-full accent-amber-500"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                        <span>0¢</span><span>50¢</span><span>100¢</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Amount (shares)</label>
                        <span className="text-[11px] font-mono text-zinc-500">
                          Bal: {(Number(availableBalance) / 1e18).toFixed(2)} USDC
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-4 py-3 text-zinc-100 font-mono text-lg focus:outline-none focus:border-white/[0.12] transition-colors placeholder:text-zinc-600"
                        disabled={isPending}
                      />
                    </div>

                    <button
                      onClick={async () => {
                        if (!tradeAmount || Number(tradeAmount) <= 0) return;
                        const ok = await placeOrder(tradeOutcome, tradePrice, tradeAmount, tradeIsBuy);
                        if (ok) {
                          setTradeAmount('');
                          refetchBalance();
                        }
                      }}
                      disabled={!tradeAmount || Number(tradeAmount) <= 0 || isPending}
                      className={`w-full py-3 rounded-xl font-semibold transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                        tradeIsBuy
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                          : 'bg-rose-500 hover:bg-rose-400 text-zinc-50'
                      }`}
                    >
                      {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : `${tradeIsBuy ? 'Buy' : 'Sell'} ${tradeOutcome === 0 ? 'YES' : 'NO'}`}
                    </button>

                    <div className="mt-4 pt-4 border-t border-white/[0.04]">
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
                  </div>
                )}
                {activeTab === 'mint' && <MintMergePanel market={market} />}
                
                {activeTab === 'manage' && (
                  <div className="flex flex-col gap-8">
                    {!isConnected ? (
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                        <p>Connect wallet to manage</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-6">
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
                              className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-4 py-3 text-zinc-100 font-mono text-lg focus:outline-none focus:border-white/[0.12] transition-colors placeholder:text-zinc-600"
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
                          <div className="flex flex-col gap-6 pt-6 border-t border-white/[0.04]">
                            <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Redeem Shares</h3>
                            
                            <div className="flex justify-between items-center px-1">
                              <div className="flex items-baseline gap-2">
                                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">YES Balance</span>
                                <span className="text-sm font-medium text-zinc-300 tabular-nums">{yesFormatted}</span>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">NO Balance</span>
                                <span className="text-sm font-medium text-zinc-300 tabular-nums">{noFormatted}</span>
                              </div>
                            </div>

                            <button
                              onClick={handleRedeem}
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
