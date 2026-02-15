import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Drawer } from 'vaul';
import { PhoneFrameContainerContext } from './PhoneFrame';
import { Loader2, CheckCircle, ExternalLink, Coins, Minus, Plus, BookOpen, Layers, ArrowRightLeft } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useUSDCBalance } from '../hooks';
import { useHaptics } from '../hooks/useHaptics';
import { parseTextWithLinks } from '../lib/utils';
import { getMoltbookLink } from '../lib/moltbookLinks';
import { useOrderBook, SOOTHBOOK_ADDRESS, SOOTHBOOK_ABI, MOCK_USDC_ADDRESS } from '../hooks/useSoothBook';
import { parseUnits, erc20Abi } from 'viem';
import { OrderBook } from './OrderBook';
import type { Market } from '../hooks/useMarkets';

type Outcome = 0 | 1;
type Tab = 'order' | 'mint' | 'merge';

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
  const haptics = useHaptics();

  const [outcome, setOutcome] = useState<Outcome>(initialOutcome);
  const [amount, setAmount] = useState('10');
  const [tick, setTick] = useState('500');
  const [tab, setTab] = useState<Tab>('order');

  // SoothBook market key — use market address as key for now
  const marketKey = '0x79a7bc6308ae7267ddd3776d02ad1446f41d1e3ed74ed41b5184fc53cc8bd5b5' as `0x${string}`;

  const { data: orderbook } = useOrderBook(marketKey);

  // Allowance check
  const { data: allowance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, SOOTHBOOK_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, data: txHash, isPending, reset: resetTx } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    setOutcome(initialOutcome);
  }, [initialOutcome]);

  useEffect(() => {
    if (isOpen) {
      resetTx();
      setAmount('10');
      setTab('order');
    }
  }, [isOpen, resetTx]);

  useEffect(() => {
    if (isSuccess) {
      setTimeout(resetTx, 2000);
    }
  }, [isSuccess, resetTx]);

  const tickNum = Math.min(999, Math.max(1, parseInt(tick || '500')));
  const price = tickNum / 1000;
  const parsedAmount = parseUnits(amount || '0', 18);
  const cost = Number(amount || 0) * price;
  const needsApproval = allowance !== undefined && allowance < parsedAmount;
  const isTrading = isPending || isConfirming;

  const handleApprove = useCallback(() => {
    writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [SOOTHBOOK_ADDRESS, parsedAmount * 2n],
    });
  }, [writeContract, parsedAmount]);

  const handleSubmit = useCallback(() => {
    if (!isConnected) {
      openWallet();
      return;
    }

    if (tab === 'order') {
      const fn = outcome === 1 ? 'buyYes' : 'buyNo';
      writeContract({
        address: SOOTHBOOK_ADDRESS,
        abi: SOOTHBOOK_ABI,
        functionName: fn,
        args: [marketKey, tickNum, BigInt(parsedAmount), false, parsedAmount],
      });
    } else if (tab === 'mint') {
      writeContract({
        address: SOOTHBOOK_ADDRESS,
        abi: SOOTHBOOK_ABI,
        functionName: 'mint',
        args: [marketKey, parsedAmount],
      });
    } else if (tab === 'merge') {
      writeContract({
        address: SOOTHBOOK_ADDRESS,
        abi: SOOTHBOOK_ABI,
        functionName: 'merge',
        args: [marketKey, parsedAmount],
      });
    }
  }, [isConnected, openWallet, tab, outcome, writeContract, marketKey, tickNum, parsedAmount]);

  const handleClose = () => {
    haptics.light();
    onClose();
  };

  const handleFaucetClick = () => {
    haptics.light();
    onClose();
    onNavigateToProfile();
  };

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
    if (needsApproval) return 'Approve USDC';
    if (isPending) return 'Confirming...';
    if (isConfirming) return 'Waiting...';
    if (isSuccess) return '✓ Trade Successful!';
    if (tab === 'mint') return 'Mint Tokens';
    if (tab === 'merge') return 'Merge Tokens';
    return `Place ${outcome === 1 ? 'YES' : 'NO'} Order`;
  };

  const phoneFrameRef = useContext(PhoneFrameContainerContext);
  const inPhoneFrame = !!phoneFrameRef?.current;

  const yesPrice = orderbook ? (orderbook.yesPrice * 100).toFixed(1) : '--';
  const noPrice = orderbook ? (orderbook.noPrice * 100).toFixed(1) : '--';

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && handleClose()} shouldScaleBackground={false} modal={!inPhoneFrame}>
      <Drawer.Portal container={inPhoneFrame ? phoneFrameRef.current! : undefined}>
        <Drawer.Overlay className={`${inPhoneFrame ? 'absolute' : 'fixed'} inset-0 bg-black/60 backdrop-blur-sm z-[60]`} />
        <Drawer.Content
          className={`${inPhoneFrame ? 'absolute' : 'fixed'} bottom-0 left-0 right-0 z-[70] bg-[#1a1a1b] rounded-t-[32px] outline-none border-t border-[#333] max-h-[90%] flex flex-col`}
          aria-describedby={undefined}
        >
          <div className="mx-auto w-12 h-1.5 rounded-full bg-[#333] mt-3 mb-2 shrink-0" />

          <div className="sticky top-0 bg-[#1a1a1b] z-10 px-6 py-3 border-b border-[#333] shrink-0">
            <Drawer.Title className="text-base font-bold text-white truncate w-full">
              {parseTextWithLinks(market.question)}
              {getMoltbookLink(market.address) && (
                <a
                  href={getMoltbookLink(market.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-2 text-xs text-[#836ef9] hover:text-[#9d8bfa] align-middle"
                >
                  <img src="https://moltbook.com/moltbook-mascot.png" alt="" className="w-3.5 h-3.5 inline" />
                  Discuss
                </a>
              )}
            </Drawer.Title>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Tab selector */}
            <div className="flex gap-1 bg-[#111] rounded-xl p-1">
              {([
                { id: 'order' as Tab, label: 'Order', icon: BookOpen },
                { id: 'mint' as Tab, label: 'Mint', icon: Layers },
                { id: 'merge' as Tab, label: 'Merge', icon: ArrowRightLeft },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { haptics.light(); setTab(id); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    tab === id
                      ? 'text-white bg-[#2d2d2e]'
                      : 'text-[#555]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

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

            {tab === 'order' && (
              <>
                {/* YES/NO selector */}
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
                      Buy Yes
                    </div>
                    <div className={`text-2xl font-bold tabular-nums font-mono ${outcome === 1 ? 'text-white' : 'text-[#888]'}`}>
                      {yesPrice}¢
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
                      Buy No
                    </div>
                    <div className={`text-2xl font-bold tabular-nums font-mono ${outcome === 0 ? 'text-white' : 'text-[#888]'}`}>
                      {noPrice}¢
                    </div>
                  </button>
                </div>

                {/* Price slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-[#555] uppercase tracking-wider">
                      Limit Price
                    </span>
                    <span className="text-sm font-mono font-bold text-white">{(price * 100).toFixed(1)}¢</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={999}
                    value={tickNum}
                    onChange={(e) => setTick(e.target.value)}
                    disabled={isTrading}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-[#2d2d2e] accent-[#00d4aa]"
                  />
                  <div className="flex justify-between text-[10px] text-[#444] font-mono mt-1">
                    <span>0.1¢</span>
                    <span>99.9¢</span>
                  </div>
                </div>

                {/* Shares */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#888] text-sm font-medium">Shares</span>
                    <span className="text-[#00d4aa] text-xs font-mono font-bold">≈ ${cost.toFixed(2)}</span>
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

                {/* Order Book (compact) */}
                {orderbook && (
                  <OrderBook
                    yesBids={orderbook.yesBids}
                    noBids={orderbook.noBids}
                  />
                )}

                {/* Order summary */}
                <div className="bg-[#2d2d2e] rounded-2xl border border-[#444] overflow-hidden">
                  <div className="bg-[#1a1a1b] px-4 py-2 border-b border-[#444]">
                    <span className="text-[#888] text-xs font-bold uppercase tracking-wide">Order Summary</span>
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
                      <span className="text-[#888]">Price</span>
                      <span className="text-white font-mono">{(price * 100).toFixed(1)}¢ (tick {tickNum})</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#888]">Max Cost</span>
                      <span className="text-white font-mono">{cost.toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#888]">If Correct</span>
                      <span className="text-[#00d4aa] font-mono font-bold">
                        +{(Number(amount || 0) - cost).toFixed(2)} USDC
                      </span>
                    </div>
                    <div className="h-px bg-[#444] my-0.5" />
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">Total</span>
                      <span className="text-white font-bold font-mono text-xl">${cost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === 'mint' && (
              <div className="space-y-4">
                <p className="text-sm text-[#888]">
                  Deposit USDC to mint equal YES + NO tokens. 1 USDC = 1 YES + 1 NO.
                </p>
                <div className="flex items-center bg-[#2d2d2e] rounded-2xl border border-[#444] overflow-hidden select-none">
                  <button
                    onMouseDown={() => startHold(false)}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={() => startHold(false)}
                    onTouchEnd={stopHold}
                    disabled={isTrading || parseInt(amount || '0') <= 1}
                    className="px-5 py-3 text-[#888] hover:text-white hover:bg-[#444] disabled:opacity-30 transition-all"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isTrading}
                    className="flex-1 py-3 bg-transparent text-white text-2xl font-bold font-mono text-center focus:outline-none min-w-0"
                    placeholder="0"
                  />
                  <button
                    onMouseDown={() => startHold(true)}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={() => startHold(true)}
                    onTouchEnd={stopHold}
                    disabled={isTrading}
                    className="px-5 py-3 text-[#888] hover:text-white hover:bg-[#444] disabled:opacity-30 transition-all"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
                <div className="bg-[#2d2d2e] rounded-2xl p-4 text-sm text-[#888]">
                  You'll receive <span className="text-[#00d4aa] font-bold">{amount || '0'} YES</span> + <span className="text-[#e01b24] font-bold">{amount || '0'} NO</span> tokens
                </div>
              </div>
            )}

            {tab === 'merge' && (
              <div className="space-y-4">
                <p className="text-sm text-[#888]">
                  Burn equal YES + NO tokens to redeem USDC.
                </p>
                <div className="flex items-center bg-[#2d2d2e] rounded-2xl border border-[#444] overflow-hidden select-none">
                  <button
                    onMouseDown={() => startHold(false)}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={() => startHold(false)}
                    onTouchEnd={stopHold}
                    disabled={isTrading || parseInt(amount || '0') <= 1}
                    className="px-5 py-3 text-[#888] hover:text-white hover:bg-[#444] disabled:opacity-30 transition-all"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isTrading}
                    className="flex-1 py-3 bg-transparent text-white text-2xl font-bold font-mono text-center focus:outline-none min-w-0"
                    placeholder="0"
                  />
                  <button
                    onMouseDown={() => startHold(true)}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={() => startHold(true)}
                    onTouchEnd={stopHold}
                    disabled={isTrading}
                    className="px-5 py-3 text-[#888] hover:text-white hover:bg-[#444] disabled:opacity-30 transition-all"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
                <div className="bg-[#2d2d2e] rounded-2xl p-4 text-sm text-[#888]">
                  Burns <span className="text-[#00d4aa] font-bold">{amount || '0'} YES</span> + <span className="text-[#e01b24] font-bold">{amount || '0'} NO</span> → receive <span className="text-white font-bold">{amount || '0'} USDC</span>
                </div>
              </div>
            )}

            <a
              href={`https://sepolia.basescan.org/address/${SOOTHBOOK_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#555] hover:text-[#00d4aa] transition-colors"
            >
              View Contract <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="p-4 bg-[#1a1a1b] border-t border-[#333] shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <button
              onClick={needsApproval ? handleApprove : handleSubmit}
              disabled={isTrading || !amount || Number(amount) <= 0}
              className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 active:scale-95 hover:scale-[1.02] hover:shadow-lg ${isSuccess
                ? 'bg-[#00d4aa] text-[#1a1a1b] hover:shadow-[#00d4aa]/20'
                : outcome === 1 || tab !== 'order'
                  ? 'bg-gradient-to-r from-[#00d4aa] to-[#00b894] text-[#1a1a1b] hover:shadow-[#00d4aa]/20'
                  : 'bg-gradient-to-r from-[#e01b24] to-[#ff6b35] text-white hover:shadow-[#e01b24]/20'
              } disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none`}
            >
              {isTrading && <Loader2 className="w-5 h-5 animate-spin" />}
              {isSuccess && <CheckCircle className="w-5 h-5" />}
              {getButtonText()}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
