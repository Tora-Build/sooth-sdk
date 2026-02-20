import { useState, useEffect, useRef, useCallback } from 'react';
import { Drawer } from 'vaul';
import { Loader2, CheckCircle, AlertCircle, Minus, Plus } from 'lucide-react';
import { useAccount, useWalletClient } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { formatUnits, type Address } from 'viem';
import {
  useLensAuth,
  useSoothMarket,
  useSoothQuote,
  useSoothPosition,
  useWGHOBalance,
} from '../hooks';
import { useSoothTrade } from '../hooks/useSoothTrade';
import { OUTCOME } from '../lib/soothAction';

interface SoothTradeDrawerProps {
  postIdStr: string;
  feedAddress: string;
  question: string;
  isOpen: boolean;
  onClose: () => void;
  initialOutcome?: 0 | 1;
}

export function SoothTradeDrawer({ postIdStr, feedAddress, question, isOpen, onClose, initialOutcome = 1 }: SoothTradeDrawerProps) {
  const { isConnected } = useAccount();
  const { open: openWallet } = useAppKit();
  const auth = useLensAuth();
  const { data: walletClient } = useWalletClient();

  const feed = feedAddress ? (feedAddress as Address) : undefined;
  const postIdBig = (() => { try { return BigInt(postIdStr); } catch { return undefined; } })();
  const market = useSoothMarket(feed, postIdBig);
  const yesPercent = Math.round((market.data?.yesProbability ?? 0.5) * 100);
  const noPercent = 100 - yesPercent;

  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [outcome, setOutcome] = useState<0 | 1>(initialOutcome);
  const [shares, setShares] = useState('10');
  const [resolveOutcome, setResolveOutcome] = useState<0 | 1 | 2>(1);
  const [showResolveConfirm, setShowResolveConfirm] = useState(false);
  const trade = useSoothTrade();
  const { address } = useAccount();

  const sharesWad = BigInt(shares || '0') * 10n ** 18n;
  const quote = useSoothQuote(feed, postIdBig, activeTab, outcome, sharesWad);
  const quoteCost = quote.data?.total ?? 0n;
  const quoteCostFormatted = parseFloat(formatUnits(quoteCost, 18)).toFixed(4);
  const maxCost = quoteCost > 0n ? quoteCost * 110n / 100n : 0n;
  const quoteProceeds = quote.data?.proceeds ?? 0n;
  const quoteProceedsFormatted = parseFloat(formatUnits(quoteProceeds, 18)).toFixed(4);

  const position = useSoothPosition(
    feed,
    postIdBig,
    auth.lensAccount ? (auth.lensAccount as Address) : undefined,
  );

  const wgho = useWGHOBalance(auth.lensAccount ? (auth.lensAccount as Address) : undefined);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopHold = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  const startHold = useCallback((increment: boolean) => {
    setShares(prev => {
      const current = parseInt(prev || '0');
      return increment ? String(current + 1) : String(Math.max(1, current - 1));
    });
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setShares(prev => {
          const current = parseInt(prev || '0');
          return increment ? String(current + 1) : String(Math.max(1, current - 1));
        });
      }, 80);
    }, 300);
  }, []);

  useEffect(() => {
    if (isOpen) {
      trade.reset();
      setShares('10');
      setOutcome(initialOutcome);
    }
  }, [isOpen, initialOutcome, trade.reset]);

  useEffect(() => {
    return () => stopHold();
  }, [stopHold]);

  const handleBuy = async () => {
    if (!auth.sessionClient || !auth.lensAccount || !walletClient) return;
    await trade.executeTrade({
      postIdStr,
      action: 'buy',
      outcome,
      shares: sharesWad,
      maxCost,
      sessionClient: auth.sessionClient,
      lensAccount: auth.lensAccount,
      walletClient,
    });
  };

  const handleSell = async () => {
    if (!auth.sessionClient || !auth.lensAccount || !walletClient) return;
    await trade.executeTrade({
      postIdStr,
      action: 'sell',
      outcome,
      shares: sharesWad,
      sessionClient: auth.sessionClient,
      lensAccount: auth.lensAccount,
      walletClient,
    });
  };

  const handleResolve = async () => {
    if (!auth.sessionClient || !auth.lensAccount || !walletClient) return;
    await trade.executeTrade({
      postIdStr,
      action: 'resolve',
      outcome: resolveOutcome,
      sessionClient: auth.sessionClient,
      lensAccount: auth.lensAccount,
      walletClient,
    });
    setShowResolveConfirm(false);
  };

  const handleRedeem = async () => {
    if (!auth.sessionClient || !auth.lensAccount || !walletClient) return;
    await trade.executeTrade({
      postIdStr,
      action: 'redeem',
      sessionClient: auth.sessionClient,
      lensAccount: auth.lensAccount,
      walletClient,
    });
  };

  const isTrading = trade.status === 'approving' || trade.status === 'executing';

  const getButtonText = () => {
    if (trade.status === 'approving') return 'Approving WGHO...';
    if (trade.status === 'executing') return 'Confirming...';
    if (trade.status === 'success') return 'Trade Successful!';
    if (trade.status === 'error') return 'Try Again';
    if (activeTab === 'sell') return `Sell ${outcome === 1 ? 'YES' : 'NO'} Shares`;
    return `Buy ${outcome === 1 ? 'YES' : 'NO'} Shares`;
  };

  const userSharesForOutcome = activeTab === 'sell' && position.data
    ? (outcome === 1 ? position.data.yesShares : position.data.noShares)
    : 0n;
  const maxSharesFormatted = parseFloat(formatUnits(userSharesForOutcome, 18)).toFixed(2);
  const canSell = userSharesForOutcome > 0n;

  const feeFormatted = quote.data?.fee
    ? parseFloat(formatUnits(quote.data.fee, 18)).toFixed(4)
    : '0.0000';

  const hasPosition = position.data && (position.data.yesShares > 0n || position.data.noShares > 0n);
  const yesSharesFormatted = position.data ? parseFloat(formatUnits(position.data.yesShares, 18)).toFixed(2) : '0';
  const noSharesFormatted = position.data ? parseFloat(formatUnits(position.data.noShares, 18)).toFixed(2) : '0';

  // Resolve/Redeem logic
  const isCreator = market.data?.resolver === address;
  const isResolved = market.data?.resolved ?? false;
  const winningOutcome = market.data?.winningOutcome ?? -1;
  
  const isWinner = position.data && (
    (winningOutcome === Number(OUTCOME.YES) && position.data.yesShares > 0n) ||
    (winningOutcome === Number(OUTCOME.NO) && position.data.noShares > 0n)
  );
  
  const winningShares = position.data && winningOutcome === Number(OUTCOME.YES)
    ? position.data.yesShares
    : position.data && winningOutcome === Number(OUTCOME.NO)
      ? position.data.noShares
      : 0n;
  
  const winningSharesFormatted = parseFloat(formatUnits(winningShares, 18)).toFixed(2);
  const isInvalidOutcome = winningOutcome === Number(OUTCOME.INVALID);
  const canRedeem = isResolved && (isWinner || isInvalidOutcome);

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1a1a1b] rounded-t-[32px] outline-none border-t border-[#333] max-h-[85%] flex flex-col"
          aria-describedby={undefined}
        >
          <div className="mx-auto w-12 h-1.5 rounded-full bg-[#333] mt-3 mb-2 shrink-0" />

          <div className="sticky top-0 bg-[#1a1a1b] z-10 px-6 py-3 border-b border-[#333] shrink-0">
            <Drawer.Title className="text-base font-bold text-white truncate w-full mb-3">
              {question}
            </Drawer.Title>
            {isResolved ? (
              <div className="text-sm font-semibold px-3 py-2 rounded-lg bg-[#2d2d2e] text-center">
                <span className="text-[#888]">Resolved: </span>
                <span className={
                  winningOutcome === Number(OUTCOME.YES) ? 'text-[#00d4aa]' :
                  winningOutcome === Number(OUTCOME.NO) ? 'text-[#e01b24]' :
                  'text-[#888]'
                }>
                  {winningOutcome === Number(OUTCOME.YES) ? 'YES' :
                   winningOutcome === Number(OUTCOME.NO) ? 'NO' :
                   'INVALID'}
                </span>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('buy')}
                  className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === 'buy'
                      ? 'bg-[#00d4aa] text-[#1a1a1b]'
                      : 'bg-[#2d2d2e] text-[#888] hover:text-white'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setActiveTab('sell')}
                  className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === 'sell'
                      ? 'bg-[#e01b24] text-white'
                      : 'bg-[#2d2d2e] text-[#888] hover:text-white'
                  }`}
                >
                  Sell
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!isConnected ? (
              <button
                onClick={() => openWallet()}
                className="w-full py-4 rounded-2xl font-bold text-base bg-[#00d4aa] text-[#1a1a1b]"
              >
                Connect Wallet
              </button>
            ) : !auth.isAuthenticated ? (
              auth.missingLensAccountMessage ? (
                <div className="p-4 bg-[#2d2d2e] rounded-2xl border border-[#444] text-center">
                  <p className="text-[#888] text-sm mb-2">{auth.missingLensAccountMessage}</p>
                  <a
                    href="https://onboarding.lens.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm font-semibold text-[#00d4aa] underline"
                  >
                    Create a Lens account →
                  </a>
                </div>
              ) : (
                <button
                  onClick={() => auth.login()}
                  className="w-full py-4 rounded-2xl font-bold text-base bg-[#00d4aa] text-[#1a1a1b]"
                >
                  Sign into Lens
                </button>
              )
             ) : (
               <>
                 {isResolved ? (
                   <>
                     {isWinner ? (
                       <div className="space-y-4">
                         <div className="bg-[#00d4aa]/10 border border-[#00d4aa]/30 rounded-2xl p-4 text-center">
                           <p className="text-[#00d4aa] font-semibold mb-2">You Won!</p>
                           <p className="text-white text-sm">Redeem {winningSharesFormatted} WGHO</p>
                         </div>
                       </div>
                     ) : isInvalidOutcome ? (
                       <div className="space-y-4">
                         <div className="bg-[#888]/10 border border-[#888]/30 rounded-2xl p-4 text-center">
                           <p className="text-[#888] font-semibold mb-2">Market Resolved as INVALID</p>
                           <p className="text-white text-sm">Redeem your shares for their cost</p>
                         </div>
                       </div>
                     ) : (
                       <div className="bg-[#e01b24]/10 border border-[#e01b24]/30 rounded-2xl p-4 text-center">
                         <p className="text-[#e01b24] font-semibold">Market Resolved</p>
                         <p className="text-[#888] text-sm mt-1">You lost on this market</p>
                       </div>
                     )}
                   </>
                 ) : isCreator ? (
                   <div className="space-y-4 bg-[#2d2d2e] rounded-2xl border border-[#444] p-4">
                     <div>
                       <h3 className="text-white font-semibold mb-3">Resolve Market</h3>
                       <p className="text-[#888] text-xs mb-4">This action is irreversible</p>
                       <div className="space-y-2">
                         <button
                           onClick={() => setResolveOutcome(1)}
                           className={`w-full p-3 rounded-lg border-2 transition-all text-sm font-semibold ${
                             resolveOutcome === 1
                               ? 'bg-[#00d4aa]/20 border-[#00d4aa] text-[#00d4aa]'
                               : 'bg-[#1a1a1b] border-[#444] text-[#888] hover:border-[#00d4aa]'
                           }`}
                         >
                           YES
                         </button>
                         <button
                           onClick={() => setResolveOutcome(0)}
                           className={`w-full p-3 rounded-lg border-2 transition-all text-sm font-semibold ${
                             resolveOutcome === 0
                               ? 'bg-[#e01b24]/20 border-[#e01b24] text-[#e01b24]'
                               : 'bg-[#1a1a1b] border-[#444] text-[#888] hover:border-[#e01b24]'
                           }`}
                         >
                           NO
                         </button>
                         <button
                           onClick={() => setResolveOutcome(2)}
                           className={`w-full p-3 rounded-lg border-2 transition-all text-sm font-semibold ${
                             resolveOutcome === 2
                               ? 'bg-[#888]/20 border-[#888] text-[#888]'
                               : 'bg-[#1a1a1b] border-[#444] text-[#888] hover:border-[#888]'
                           }`}
                         >
                           INVALID
                         </button>
                       </div>
                     </div>
                     <button
                       onClick={() => setShowResolveConfirm(true)}
                       disabled={isTrading}
                       className="w-full py-3 rounded-lg bg-[#e01b24] text-white font-semibold hover:bg-[#c01620] disabled:opacity-50 transition-all"
                     >
                       Resolve Market
                     </button>
                   </div>
                 ) : activeTab === 'buy' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setOutcome(1)}
                        disabled={isTrading}
                        className={`p-3 rounded-2xl border-2 transition-all ${outcome === 1
                          ? 'bg-[#00d4aa]/20 border-[#00d4aa]'
                          : 'bg-[#2d2d2e] border-[#444] hover:border-[#00d4aa]'
                        } ${isTrading ? 'opacity-50' : ''}`}
                      >
                        <div className={`text-xs font-bold uppercase tracking-wide ${outcome === 1 ? 'text-[#00d4aa]' : 'text-[#888]'}`}>
                          YES
                        </div>
                        <div className={`text-2xl font-bold tabular-nums font-mono ${outcome === 1 ? 'text-white' : 'text-[#888]'}`}>
                          {yesPercent}%
                        </div>
                      </button>

                      <button
                        onClick={() => setOutcome(0)}
                        disabled={isTrading}
                        className={`p-3 rounded-2xl border-2 transition-all ${outcome === 0
                          ? 'bg-[#e01b24]/20 border-[#e01b24]'
                          : 'bg-[#2d2d2e] border-[#444] hover:border-[#e01b24]'
                        } ${isTrading ? 'opacity-50' : ''}`}
                      >
                        <div className={`text-xs font-bold uppercase tracking-wide ${outcome === 0 ? 'text-[#e01b24]' : 'text-[#888]'}`}>
                          NO
                        </div>
                        <div className={`text-2xl font-bold tabular-nums font-mono ${outcome === 0 ? 'text-white' : 'text-[#888]'}`}>
                          {noPercent}%
                        </div>
                      </button>
                    </div>

                    {hasPosition && (
                      <div className="text-xs text-[#888] text-center">
                        Your Position: {yesSharesFormatted} YES / {noSharesFormatted} NO shares
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[#888] text-sm font-medium">Shares</span>
                        <span className="text-[#00d4aa] text-xs font-mono font-bold">≈ {quoteCostFormatted} WGHO</span>
                      </div>
                      <div className="flex items-center bg-[#2d2d2e] rounded-2xl border border-[#444] overflow-hidden select-none">
                        <button
                          onMouseDown={() => startHold(false)}
                          onMouseUp={stopHold}
                          onMouseLeave={stopHold}
                          onTouchStart={() => startHold(false)}
                          onTouchEnd={stopHold}
                          disabled={isTrading || parseInt(shares || '0') <= 1}
                          className="px-5 py-3 text-[#888] hover:text-white hover:bg-[#444] disabled:opacity-30 transition-all active:bg-[#555]"
                          aria-label="Decrease shares"
                        >
                          <Minus className="w-6 h-6" />
                        </button>
                        <input
                          type="number"
                          value={shares}
                          onChange={(e) => setShares(e.target.value)}
                          disabled={isTrading}
                          className="flex-1 py-3 bg-transparent text-white text-2xl font-bold font-mono text-center focus:outline-none disabled:opacity-50 min-w-0"
                          placeholder="0"
                          aria-label="Number of shares"
                        />
                        <button
                          onMouseDown={() => startHold(true)}
                          onMouseUp={stopHold}
                          onMouseLeave={stopHold}
                          onTouchStart={() => startHold(true)}
                          onTouchEnd={stopHold}
                          disabled={isTrading}
                          className="px-5 py-3 text-[#888] hover:text-white hover:bg-[#444] disabled:opacity-30 transition-all active:bg-[#555]"
                          aria-label="Increase shares"
                        >
                          <Plus className="w-6 h-6" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#2d2d2e] rounded-2xl border border-[#444] overflow-hidden">
                      <div className="bg-[#1a1a1b] px-4 py-2 border-b border-[#444]">
                        <span className="text-[#888] text-xs font-bold uppercase tracking-wide">Order Summary</span>
                      </div>
                      <div className="p-3 space-y-1.5">
                        {auth.isAuthenticated && wgho.data && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-[#888]">Balance</span>
                              <span className="text-[#00d4aa] font-mono font-bold">{wgho.data.balanceFormatted} WGHO</span>
                            </div>
                            <div className="h-px bg-[#444] my-0.5" />
                          </>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-[#888]">Cost</span>
                          <span className="text-white font-mono">{quoteCostFormatted} WGHO</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#888]">Fee</span>
                          <span className="text-[#7c7c7c] font-mono">{feeFormatted} WGHO</span>
                        </div>
                        <div className="h-px bg-[#444] my-0.5" />
                        <div className="flex justify-between items-center">
                          <span className="text-white font-bold">Total</span>
                          <span className="text-white font-bold font-mono text-xl">{quoteCostFormatted} WGHO</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {hasPosition && (
                      <div className="text-xs text-[#888] text-center">
                        Your Position: {yesSharesFormatted} YES / {noSharesFormatted} NO shares
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setOutcome(1)}
                        disabled={isTrading}
                        className={`p-3 rounded-2xl border-2 transition-all ${outcome === 1
                          ? 'bg-[#00d4aa]/20 border-[#00d4aa]'
                          : 'bg-[#2d2d2e] border-[#444] hover:border-[#00d4aa]'
                        } ${isTrading ? 'opacity-50' : ''}`}
                      >
                        <div className={`text-xs font-bold uppercase tracking-wide ${outcome === 1 ? 'text-[#00d4aa]' : 'text-[#888]'}`}>
                          YES
                        </div>
                        <div className={`text-2xl font-bold tabular-nums font-mono ${outcome === 1 ? 'text-white' : 'text-[#888]'}`}>
                          {yesPercent}%
                        </div>
                      </button>

                      <button
                        onClick={() => setOutcome(0)}
                        disabled={isTrading}
                        className={`p-3 rounded-2xl border-2 transition-all ${outcome === 0
                          ? 'bg-[#e01b24]/20 border-[#e01b24]'
                          : 'bg-[#2d2d2e] border-[#444] hover:border-[#e01b24]'
                        } ${isTrading ? 'opacity-50' : ''}`}
                      >
                        <div className={`text-xs font-bold uppercase tracking-wide ${outcome === 0 ? 'text-[#e01b24]' : 'text-[#888]'}`}>
                          NO
                        </div>
                        <div className={`text-2xl font-bold tabular-nums font-mono ${outcome === 0 ? 'text-white' : 'text-[#888]'}`}>
                          {noPercent}%
                        </div>
                      </button>
                    </div>

                    {!canSell && (
                      <div className="text-xs text-[#888] text-center bg-[#2d2d2e] rounded-2xl p-3">
                        No {outcome === 1 ? 'YES' : 'NO'} shares to sell
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[#888] text-sm font-medium">Shares</span>
                        <span className="text-[#e01b24] text-xs font-mono font-bold">Max: {maxSharesFormatted}</span>
                      </div>
                      <div className="flex items-center bg-[#2d2d2e] rounded-2xl border border-[#444] overflow-hidden select-none">
                        <button
                          onMouseDown={() => startHold(false)}
                          onMouseUp={stopHold}
                          onMouseLeave={stopHold}
                          onTouchStart={() => startHold(false)}
                          onTouchEnd={stopHold}
                          disabled={isTrading || parseInt(shares || '0') <= 1 || !canSell}
                          className="px-5 py-3 text-[#888] hover:text-white hover:bg-[#444] disabled:opacity-30 transition-all active:bg-[#555]"
                          aria-label="Decrease shares"
                        >
                          <Minus className="w-6 h-6" />
                        </button>
                        <input
                          type="number"
                          value={shares}
                          onChange={(e) => setShares(e.target.value)}
                          disabled={isTrading || !canSell}
                          className="flex-1 py-3 bg-transparent text-white text-2xl font-bold font-mono text-center focus:outline-none disabled:opacity-50 min-w-0"
                          placeholder="0"
                          aria-label="Number of shares"
                        />
                        <button
                          onMouseDown={() => startHold(true)}
                          onMouseUp={stopHold}
                          onMouseLeave={stopHold}
                          onTouchStart={() => startHold(true)}
                          onTouchEnd={stopHold}
                          disabled={isTrading || !canSell}
                          className="px-5 py-3 text-[#888] hover:text-white hover:bg-[#444] disabled:opacity-30 transition-all active:bg-[#555]"
                          aria-label="Increase shares"
                        >
                          <Plus className="w-6 h-6" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#2d2d2e] rounded-2xl border border-[#444] overflow-hidden">
                      <div className="bg-[#1a1a1b] px-4 py-2 border-b border-[#444]">
                        <span className="text-[#888] text-xs font-bold uppercase tracking-wide">Order Summary</span>
                      </div>
                      <div className="p-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#888]">Proceeds</span>
                          <span className="text-white font-mono">{quoteProceedsFormatted} WGHO</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#888]">Fee</span>
                          <span className="text-[#7c7c7c] font-mono">{feeFormatted} WGHO</span>
                        </div>
                        <div className="h-px bg-[#444] my-0.5" />
                        <div className="flex justify-between items-center">
                          <span className="text-white font-bold">Net Proceeds</span>
                          <span className="text-white font-bold font-mono text-xl">{quoteProceedsFormatted} WGHO</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {trade.error && (
                  <div className="bg-[#e01b24]/10 border border-[#e01b24]/30 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[#e01b24] flex-shrink-0 mt-0.5" />
                    <p className="text-[#e01b24] text-sm font-medium">{trade.error}</p>
                  </div>
                )}
              </>
            )}
          </div>

           {isConnected && auth.isAuthenticated && (
             <div className="p-4 bg-[#1a1a1b] border-t border-[#333] shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
               {isResolved && canRedeem ? (
                 <button
                   onClick={handleRedeem}
                   disabled={isTrading}
                   className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 active:scale-95 ${
                     trade.status === 'success'
                       ? 'bg-[#00d4aa] text-[#1a1a1b]'
                       : trade.status === 'error'
                         ? 'bg-[#e01b24] text-white'
                         : 'bg-[#00d4aa] text-[#1a1a1b]'
                   } disabled:opacity-50`}
                 >
                   {isTrading && <Loader2 className="w-5 h-5 animate-spin" />}
                   {trade.status === 'success' && <CheckCircle className="w-5 h-5" />}
                   {trade.status === 'error' && <AlertCircle className="w-5 h-5" />}
                   {trade.status === 'approving' ? 'Approving...' :
                    trade.status === 'executing' ? 'Confirming...' :
                    trade.status === 'success' ? 'Redeemed!' :
                    trade.status === 'error' ? 'Try Again' :
                    `Redeem ${winningSharesFormatted} WGHO`}
                 </button>
               ) : !isResolved ? (
                 <button
                   onClick={activeTab === 'buy' ? handleBuy : handleSell}
                   disabled={isTrading || sharesWad <= 0n || (activeTab === 'sell' && !canSell)}
                   className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 active:scale-95 ${
                     trade.status === 'success'
                       ? 'bg-[#00d4aa] text-[#1a1a1b]'
                       : trade.status === 'error'
                         ? 'bg-[#e01b24] text-white'
                         : activeTab === 'buy'
                           ? outcome === 1
                             ? 'bg-[#00d4aa] text-[#1a1a1b]'
                             : 'bg-[#e01b24] text-white'
                           : 'bg-[#e01b24] text-white'
                   } disabled:opacity-50`}
                 >
                   {isTrading && <Loader2 className="w-5 h-5 animate-spin" />}
                   {trade.status === 'success' && <CheckCircle className="w-5 h-5" />}
                   {trade.status === 'error' && <AlertCircle className="w-5 h-5" />}
                   {getButtonText()}
                 </button>
               ) : null}
             </div>
           )}

           {showResolveConfirm && (
             <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-end">
               <div className="w-full bg-[#1a1a1b] rounded-t-[32px] border-t border-[#333] p-6 space-y-4">
                 <div>
                   <h3 className="text-white font-bold text-lg mb-2">Confirm Resolution</h3>
                   <p className="text-[#888] text-sm">
                     You are about to resolve this market as <span className={
                       resolveOutcome === 1 ? 'text-[#00d4aa]' :
                       resolveOutcome === 0 ? 'text-[#e01b24]' :
                       'text-[#888]'
                     }>
                       {resolveOutcome === 1 ? 'YES' : resolveOutcome === 0 ? 'NO' : 'INVALID'}
                     </span>. This action cannot be undone.
                   </p>
                 </div>
                 <div className="flex gap-3">
                   <button
                     onClick={() => setShowResolveConfirm(false)}
                     disabled={isTrading}
                     className="flex-1 py-3 rounded-lg bg-[#2d2d2e] text-white font-semibold hover:bg-[#3d3d3e] disabled:opacity-50 transition-all"
                   >
                     Cancel
                   </button>
                   <button
                     onClick={handleResolve}
                     disabled={isTrading}
                     className="flex-1 py-3 rounded-lg bg-[#e01b24] text-white font-semibold hover:bg-[#c01620] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                   >
                     {isTrading && <Loader2 className="w-4 h-4 animate-spin" />}
                     Confirm
                   </button>
                 </div>
               </div>
             </div>
           )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
