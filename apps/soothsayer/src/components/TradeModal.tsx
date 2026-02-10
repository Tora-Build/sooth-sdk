import { useState, useEffect, useRef, useCallback } from 'react';
import { Drawer } from 'vaul';
import { Loader2, CheckCircle, AlertCircle, ExternalLink, Coins, Minus, Plus, Info } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useAMMQuote, useAMMTrade, useUSDCBalance } from '../hooks';
import { useHaptics } from '../hooks/useHaptics';
import { parseTextWithLinks } from '../lib/utils';
import type { Market } from '../hooks/useMarkets';

type Outcome = 0 | 1;

interface TradeModalProps {
  market: Market;
  initialOutcome: Outcome;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToProfile: () => void;
}

export function TradeModal({ market, initialOutcome, isOpen, onClose, onNavigateToProfile }: TradeModalProps) {
  const { address, isConnected } = useAccount();
  const { open: openWallet } = useAppKit();
  const { balance: usdcBalanceRaw, balanceFormatted: usdcBalance } = useUSDCBalance(address);
  const { status, error, executeTrade, reset } = useAMMTrade();
  const haptics = useHaptics();

  const [outcome, setOutcome] = useState<Outcome>(initialOutcome);
  const [amount, setAmount] = useState('10');
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setOutcome(initialOutcome);
  }, [initialOutcome]);

  useEffect(() => {
    if (isOpen) {
      reset();
      setAmount('10');
      setShowHint(false);
    }
  }, [isOpen, reset]);

  // Reset status on input change after success
  useEffect(() => {
    if (status === 'success') {
      reset();
    }
  }, [amount, outcome, reset]);

  const quote = useAMMQuote(
    market.address,
    amount,
    outcome,
    market.yesProbability ?? 0.5,
    market.stage !== 'bonding' // isGraduated: true for live, settled, finalized stages
  );

  const handleBuy = async () => {
    if (!isConnected) {
      openWallet();
      return;
    }

    if (quote.deltaShares <= 0n) return;

    haptics.medium();
    await executeTrade(market.address, outcome, quote.deltaShares, quote.limitCost);
  };

  const handleClose = () => {
    haptics.light();
    onClose();
  };

  const handleFaucetClick = () => {
    haptics.light();
    onClose();
    onNavigateToProfile();
  };

  const isTrading = status === 'checking' || status === 'approving' || status === 'trading';

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopHold = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  const startHold = useCallback((increment: boolean) => {
    haptics.light();
    setAmount(prev => {
      const current = parseInt(prev || '0');
      return increment ? String(current + 1) : String(Math.max(1, current - 1));
    });
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        haptics.selection();
        setAmount(prev => {
          const current = parseInt(prev || '0');
          return increment ? String(current + 1) : String(Math.max(1, current - 1));
        });
      }, 80);
    }, 300);
  }, [haptics]);

  useEffect(() => {
    return () => stopHold();
  }, [stopHold]);

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (status === 'checking') return 'Checking...';
    if (status === 'approving') return 'Approving USDC...';
    if (status === 'trading') return 'Confirming...';
    if (status === 'success') return 'Trade Successful!';
    if (status === 'error') return 'Try Again';
    return `Buy ${outcome === 1 ? 'Yes' : 'No'} Shares`;
  };

  const probability = market.yesProbability ?? 0.5;
  const yesPercent = (probability * 100).toFixed(1);
  const noPercent = (100 - probability * 100).toFixed(1);

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && handleClose()} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1a1a1b] rounded-t-[32px] outline-none border-t border-[#333] max-h-[95vh] flex flex-col"
          aria-describedby={undefined}
        >
          <div className="mx-auto w-12 h-1.5 rounded-full bg-[#333] mt-3 mb-2 shrink-0" />

          <div className="sticky top-0 bg-[#1a1a1b] z-10 px-6 py-3 border-b border-[#333] shrink-0">
            <Drawer.Title className="text-base font-bold text-white truncate w-full">
              {parseTextWithLinks(market.question)}
            </Drawer.Title>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {isConnected && usdcBalanceRaw === 0n && (
              <button
                onClick={handleFaucetClick}
                className="w-full p-4 bg-[#e01b24]/10 border border-[#e01b24]/30 rounded-xl flex items-center gap-3 active:scale-95 transition-transform"
              >
                <Coins className="w-5 h-5 text-[#e01b24] shrink-0" />
                <span className="text-sm font-bold text-[#e01b24] text-left">
                  Need USDC? Tap for free test tokens!
                </span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { haptics.light(); setOutcome(1); }}
                disabled={isTrading}
                className={`p-3 rounded-2xl border-2 transition-all ${outcome === 1
                  ? 'bg-[#00d4aa]/20 border-[#00d4aa]'
                  : 'bg-[#2d2d2e] border-[#444] hover:border-[#00d4aa]'
                  } ${isTrading ? 'opacity-50' : ''}`}
              >
                <div className={`text-xs font-bold uppercase tracking-wide ${outcome === 1 ? 'text-[#00d4aa]' : 'text-[#888]'}`}>
                  Yes
                </div>
                <div className={`text-2xl font-bold tabular-nums font-mono ${outcome === 1 ? 'text-white' : 'text-[#888]'}`}>
                  {yesPercent}¢
                </div>
              </button>

              <button
                onClick={() => { haptics.light(); setOutcome(0); }}
                disabled={isTrading}
                className={`p-3 rounded-2xl border-2 transition-all ${outcome === 0
                  ? 'bg-[#e01b24]/20 border-[#e01b24]'
                  : 'bg-[#2d2d2e] border-[#444] hover:border-[#e01b24]'
                  } ${isTrading ? 'opacity-50' : ''}`}
              >
                <div className={`text-xs font-bold uppercase tracking-wide ${outcome === 0 ? 'text-[#e01b24]' : 'text-[#888]'}`}>
                  No
                </div>
                <div className={`text-2xl font-bold tabular-nums font-mono ${outcome === 0 ? 'text-white' : 'text-[#888]'}`}>
                  {noPercent}¢
                </div>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#888] text-sm font-medium">Shares</span>
                <span className="text-[#00d4aa] text-xs font-mono font-bold">≈ ${quote.costFormatted}</span>
              </div>
              <div className="flex items-center bg-[#2d2d2e] rounded-2xl border border-[#444] overflow-hidden select-none">
                <button
                  onMouseDown={() => startHold(false)}
                  onMouseUp={stopHold}
                  onMouseLeave={stopHold}
                  onTouchStart={() => startHold(false)}
                  onTouchEnd={stopHold}
                  disabled={isTrading || parseInt(amount || '0') <= 1}
                  className="px-5 py-3 text-[#888] hover:text-white hover:bg-[#444] disabled:opacity-30 transition-all active:bg-[#555]"
                  aria-label="Decrease amount"
                >
                  <Minus className="w-6 h-6" />
                </button>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isTrading}
                  className="flex-1 py-3 bg-transparent text-white text-2xl font-bold font-mono text-center focus:outline-none disabled:opacity-50 min-w-0"
                  placeholder="0"
                  aria-label="Trade amount in shares"
                />
                <button
                  onMouseDown={() => startHold(true)}
                  onMouseUp={stopHold}
                  onMouseLeave={stopHold}
                  onTouchStart={() => startHold(true)}
                  onTouchEnd={stopHold}
                  disabled={isTrading}
                  className="px-5 py-3 text-[#888] hover:text-white hover:bg-[#444] disabled:opacity-30 transition-all active:bg-[#555]"
                  aria-label="Increase amount"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="bg-[#2d2d2e] rounded-2xl border border-[#444] overflow-hidden">
              <div className="bg-[#1a1a1b] px-4 py-2 border-b border-[#444] flex items-center justify-between">
                <span className="text-[#888] text-xs font-bold uppercase tracking-wide">Order Summary</span>
                <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border backdrop-blur-sm ${market.stage === 'bonding' ? 'bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/30' :
                  (market.stage === 'live' || market.stage === 'finalized') ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40' :
                    market.stage === 'settled' ? 'bg-[#ffd700]/10 text-[#ffd700] border-[#ffd700]/30' :
                      'bg-[#e01b24]/10 text-[#e01b24] border-[#e01b24]/30'
                  }`}>
                  {market.stage === 'live' ? 'Graduated' : market.stage}
                </span>
              </div>
              <div className="p-3 space-y-1.5">
                {isConnected && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#888]">Balance</span>
                      <span className="text-[#00d4aa] font-mono font-bold">{usdcBalance} USDC</span>
                    </div>
                    <div className="h-px bg-[#444] my-0.5" />
                  </>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[#888]">Avg Price</span>
                  <span className="text-white font-mono">
                    {quote.deltaShares > 0n
                      ? ((Number(quote.totalCost) / Number(quote.deltaShares)) * 100).toFixed(1)
                      : '0.0'}¢
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-[#888] flex items-center gap-1.5">
                      Fee ({quote.feeRateBps / 100}%)
                      {market.stage === 'bonding' && (
                        <>
                          <span className="text-[#00d4aa]"> → LP</span>
                          <button
                            onClick={() => setShowHint(!showHint)}
                            className="focus:outline-none flex items-center ml-1"
                            aria-label="Fee information"
                          >
                            <Info className="w-4 h-4 text-[#00d4aa]/70 hover:text-[#00d4aa]" />
                          </button>
                        </>
                      )}
                    </span>
                    <span className="text-[#7c7c7c] font-mono">{quote.feeFormatted}</span>
                  </div>
                  {showHint && (
                    <p className="text-[11px] text-[#00d4aa]/90 leading-relaxed bg-[#00d4aa]/5 p-2 rounded-2xl border border-[#00d4aa]/20 animate-in fade-in zoom-in-95 duration-200">
                      Trading fees earn you LP tokens during bonding. After graduation, LP holders earn from fees.
                    </p>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#888]">Potential Return</span>
                  <span className="text-[#00d4aa] font-mono font-bold">
                    {parseFloat(amount || '0') > 0
                      ? `+${(parseFloat(amount) - parseFloat(quote.costFormatted.replace(/,/g, ''))).toFixed(2)}`
                      : '--'}
                  </span>
                </div>
                <div className="h-px bg-[#444] my-0.5" />
                <div className="flex justify-between items-center">
                  <span className="text-white font-bold">Total</span>
                  <span className="text-white font-bold font-mono text-xl">${quote.costFormatted}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-[#e01b24]/10 border border-[#e01b24]/30 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#e01b24] flex-shrink-0 mt-0.5" />
                <p className="text-[#e01b24] text-sm font-medium">{error}</p>
              </div>
            )}

            <a
              href={`https://testnet.monadexplorer.com/address/${market.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#555] hover:text-[#00d4aa] transition-colors"
            >
              View Contract <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="p-4 bg-[#1a1a1b] border-t border-[#333] shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <button
              onClick={handleBuy}
              disabled={isTrading || (isConnected && quote.deltaShares <= 0n) || market.stage === 'finalized' || market.stage === 'settled'}
              className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 active:scale-95 hover:scale-[1.02] hover:shadow-lg ${status === 'success'
                ? 'bg-[#00d4aa] text-[#1a1a1b] hover:shadow-[#00d4aa]/20'
                : status === 'error'
                  ? 'bg-[#e01b24] text-white hover:shadow-[#e01b24]/20'
                  : outcome === 1
                    ? 'bg-gradient-to-r from-[#00d4aa] to-[#00b894] text-[#1a1a1b] hover:shadow-[#00d4aa]/20'
                    : 'bg-gradient-to-r from-[#e01b24] to-[#ff6b35] text-white hover:shadow-[#e01b24]/20'
                } disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none`}
            >
              {isTrading && <Loader2 className="w-5 h-5 animate-spin" />}
              {status === 'success' && <CheckCircle className="w-5 h-5" />}
              {status === 'error' && <AlertCircle className="w-5 h-5" />}
              {getButtonText()}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
