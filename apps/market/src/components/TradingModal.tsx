import React, { useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { keccak256, encodePacked, Address } from 'viem';
import { LaunchpadMarket, getMarketStatus, MarketStatus } from '../types';
import { useOrderbook } from '../hooks/useOrderbook';
import { useSoothBookMarket, useSoothBookBalance } from '../hooks/useSoothBook';
import { useOrderbookTrade } from '../hooks/useOrderbookTrade';
import { BuySellPanel } from './BuySellPanel';
import { MintMergePanel } from './MintMergePanel';

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
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs w-fit">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
        Live
      </div>
    );
  }
  if (status === 'settled' || status === 'dismissed') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 text-xs w-fit">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-400"></div>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs w-fit">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
      Finalized
    </div>
  );
}

export function TradingModal({ market, onClose }: TradingModalProps) {
  const [activeTab, setActiveTab] = useState<'trade' | 'mint' | 'manage'>('trade');
  const marketStatus = getMarketStatus(market);
  
  const marketKey = useMemo(() => {
    return keccak256(encodePacked(['address'], [market.address as Address]));
  }, [market.address]);

  const { bids, asks, isLoading } = useOrderbook(marketKey);
  const { yesPrice, noPrice, bestYesTick, bestNoTick, isActive } = useSoothBookMarket(market.address);

  const { isConnected } = useAccount();
  const { cancel, redeem, state } = useOrderbookTrade(market.address);
  const { yesShares, noShares } = useSoothBookBalance(market.address);

  const [cancelSide, setCancelSide] = useState<'yes' | 'no'>('yes');
  const [cancelTick, setCancelTick] = useState<string>('');

  const handleCancel = async () => {
    const tickNum = parseInt(cancelTick, 10);
    if (isNaN(tickNum) || tickNum < 1 || tickNum > 999) return;
    await cancel(cancelSide === 'yes' ? 1 : 0, tickNum);
    if (!state.error) {
      setCancelTick('');
    }
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

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto pt-16 pb-16 px-4"
      onClick={handleBackdropClick}
    >
      <div className="max-w-5xl mx-auto glass-panel relative flex flex-col md:flex-row shadow-2xl overflow-hidden rounded-xl">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 border-r border-zinc-800/50 p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-heading font-bold text-white line-clamp-2" title={market.question || market.name}>
              {market.question || market.name || 'Unnamed Market'}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400 font-mono">
              <div className="flex flex-col">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Address</span>
                <span title={market.address}>{shortAddr(market.address)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Deployer</span>
                <span title={market.creator}>{shortAddr(market.creator)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Status</span>
                <div className="mt-0.5">{renderBadge(marketStatus)}</div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-[300px]">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">Orderbook</h3>
            <div className="grid grid-cols-2 gap-4 flex-1">
              <div className="flex flex-col bg-zinc-900/30 rounded-lg border border-zinc-800/50">
                <div className="flex justify-between items-center px-3 py-2 border-b border-zinc-800/50 text-xs font-semibold text-zinc-500 uppercase">
                  <span>Size (YES)</span>
                  <span>Tick</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 no-scrollbar max-h-[400px]">
                  {isLoading ? (
                    <div className="space-y-2">
                      <div className="h-6 skeleton-box rounded w-full"></div>
                      <div className="h-6 skeleton-box rounded w-full"></div>
                      <div className="h-6 skeleton-box rounded w-full"></div>
                    </div>
                  ) : bids.length === 0 ? (
                    <div className="text-center py-8 text-zinc-600 text-sm">No bids</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {bids.map((bid, i) => (
                        <div key={`bid-${bid.tick}-${i}`} className="flex justify-between items-center text-sm font-mono px-1 py-1 hover:bg-zinc-800/30 rounded">
                          <span className="text-emerald-400">{parseFloat(bid.amount).toFixed(2)}</span>
                          <span className="text-zinc-300">{(bid.tick / 10).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col bg-zinc-900/30 rounded-lg border border-zinc-800/50">
                <div className="flex justify-between items-center px-3 py-2 border-b border-zinc-800/50 text-xs font-semibold text-zinc-500 uppercase">
                  <span>Tick</span>
                  <span>Size (NO)</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 no-scrollbar max-h-[400px]">
                  {isLoading ? (
                    <div className="space-y-2">
                      <div className="h-6 skeleton-box rounded w-full"></div>
                      <div className="h-6 skeleton-box rounded w-full"></div>
                      <div className="h-6 skeleton-box rounded w-full"></div>
                    </div>
                  ) : asks.length === 0 ? (
                    <div className="text-center py-8 text-zinc-600 text-sm">No asks</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {asks.map((ask, i) => (
                        <div key={`ask-${ask.tick}-${i}`} className="flex justify-between items-center text-sm font-mono px-1 py-1 hover:bg-zinc-800/30 rounded">
                          <span className="text-zinc-300">{(ask.tick / 10).toFixed(1)}%</span>
                          <span className="text-rose-400">{parseFloat(ask.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full md:w-[380px] flex flex-col">
          <div className="flex border-b border-zinc-800/50 pt-2 px-2">
            <button 
              className={`flex-1 px-4 py-3 text-sm font-semibold tracking-wide border-b-2 transition-colors ${activeTab === 'trade' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
              onClick={() => setActiveTab('trade')}
            >
              Trade
            </button>
            <button 
              className={`flex-1 px-4 py-3 text-sm font-semibold tracking-wide border-b-2 transition-colors ${activeTab === 'mint' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
              onClick={() => setActiveTab('mint')}
            >
              Mint & Merge
            </button>
            <button 
              className={`flex-1 px-4 py-3 text-sm font-semibold tracking-wide border-b-2 transition-colors ${activeTab === 'manage' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
              onClick={() => setActiveTab('manage')}
            >
              Manage
            </button>
          </div>
          <div className="flex-1 p-6 relative min-h-[400px]">
            {activeTab === 'trade' && (
              <BuySellPanel market={market} />
            )}
            {activeTab === 'mint' && (
              <MintMergePanel market={market} />
            )}
            {activeTab === 'manage' && (
              <div className="flex flex-col gap-5 h-full relative">
                {!isConnected ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                    <p className="font-sans">Connect wallet to manage</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-5 gap-4">
                      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Cancel Order</h3>
                      
                      <div className="flex p-1 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                        <button
                          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all font-sans ${
                            cancelSide === 'yes'
                              ? 'bg-amber-500/10 text-amber-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          onClick={() => setCancelSide('yes')}
                        >
                          YES
                        </button>
                        <button
                          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all font-sans ${
                            cancelSide === 'no'
                              ? 'bg-amber-500/10 text-amber-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          onClick={() => setCancelSide('no')}
                        >
                          NO
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-zinc-400 uppercase font-sans tracking-wider ml-1">
                          Tick (1-999)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          step="1"
                          value={cancelTick}
                          onChange={(e) => setCancelTick(e.target.value)}
                          placeholder="e.g. 500"
                          className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-lg px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder:text-zinc-600"
                          disabled={state.isPending}
                        />
                      </div>

                      <button
                        onClick={handleCancel}
                        disabled={!cancelTick || state.isPending}
                        className="w-full mt-2 py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-sans font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                      >
                        {state.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cancel Order'}
                      </button>
                      
                      {state.error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-sans mt-1 break-words">
                          {state.error}
                        </div>
                      )}
                      {state.txHash && !state.error && !state.isPending && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm font-sans mt-1 break-words">
                          Success! TX: <span className="font-mono">{state.txHash.slice(0, 8)}...{state.txHash.slice(-6)}</span>
                        </div>
                      )}
                    </div>

                    {['settled', 'finalized'].includes(marketStatus) && (
                      <div className="flex flex-col bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-5 gap-4">
                        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Redeem Shares</h3>
                        <div className="flex justify-between items-center text-sm font-mono text-zinc-300">
                          <span>YES: {yesFormatted}</span>
                          <span>NO: {noFormatted}</span>
                        </div>
                        <button
                          onClick={handleRedeem}
                          disabled={!canRedeem || state.isPending}
                          className="w-full py-3 px-4 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-sans font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {state.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : marketStatus === 'finalized' ? 'Redeem Winnings' : 'Waiting for Finalization...'}
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
    </div>
  );
}
