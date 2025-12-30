import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Info, TrendingUp, TrendingDown, Wallet, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useLaunchpadTradeQuote } from "../../../hooks/v8/useLaunchpadTradeQuote";
import { useLaunchpadSwap } from "../../../hooks/v8/useLaunchpadSwap";
import { useLaunchpadMarket } from "../../../hooks/v8/useLaunchpadMarket";
import { useAccount } from 'wagmi';
import { useAmmMarket as useAmmMarketByAddress } from "../../../hooks/v8";
// DEPRECATED: This component is currently using V6.x logic.
// Please use SimpleTradingPanel for V8.1 Modular Markets.
import { formatUnits } from 'viem';
import uiContent from '../../../config/ui-content.json';
import { useChainStore } from '../../../store/useChainStore';

interface AmmTradingPanelProps {
    address: `0x${string}`;
    isGraduated: boolean;
    bParam?: bigint;
    market?: any; // Allow passing pre-fetched market data to prevent duplicate hooks
    onTradeSuccess?: () => void;
}

const SLIPPAGE_OPTIONS = [10, 50, 100, 200]; // 0.1%, 0.5%, 1%, 2%

export const AmmTradingPanel: React.FC<AmmTradingPanelProps> = ({
    address,
    isGraduated,
    bParam,
    market: prefetchedMarket,
    onTradeSuccess
}) => {
    const { isConnected } = useAccount();
    const { selectedChainId } = useChainStore();
    const t = uiContent.trading;
    const c = uiContent.common;
    // V6.1: Use direct swap (bypasses TraderVault, reduces to 2 TX max)
    const { swap, usdcBalance, isPending: isSwapPending, decimals, isLoading: swapLoading } = useLaunchpadSwap(address);

    // Determine trade mode and outcome
    const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
    const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(0);
    const [amount, setAmount] = useState('10');
    // Debounced amount used for quoting to reduce RPC spam (especially on MegaETH).
    const [quoteAmount, setQuoteAmount] = useState('10');
    const [slippageBps, setSlippageBps] = useState(100); // 1% default
    const [showSlippageSelector, setShowSlippageSelector] = useState(false);
    const [isPending, setIsPending] = useState(false);

    // Fetch market data for balances/shares check only if not prefetched
    const { market: hookMarket } = useAmmMarketByAddress(prefetchedMarket ? undefined : address);
    const market = prefetchedMarket || hookMarket;

    // Increment/Decrement refs
    const incrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const decrementIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Quote
    useEffect(() => {
        const chainIdNum = Number(selectedChainId);
        const debounceMs = chainIdNum === 4326 ? 600 : 150;
        const t = setTimeout(() => setQuoteAmount(amount), debounceMs);
        return () => clearTimeout(t);
    }, [amount, selectedChainId]);

    const sharesInput = tradeMode === 'buy' ? quoteAmount : `-${quoteAmount}`;
    const { quote, isLoading: isQuoteLoading } = useLaunchpadTradeQuote(
        address,
        selectedOutcome,
        sharesInput,
        slippageBps,
        decimals,
        market ? { qYes: market.qYes, qNo: market.qNo, b: market.bParam || bParam } : undefined
    );

    // User's shares for sell mode (AMM IS WALLET ONLY)
    const userYesShares = market?.userYesWallet || 0;
    const userNoShares = market?.userNoWallet || 0;
    const maxSellAmount = selectedOutcome === 0 ? userYesShares : userNoShares;
    const canSell = maxSellAmount > 0;

    // Amount parsing
    const amountNum = parseFloat(amount) || 0;

    // Cost per share calculation
    const costPerShare = quote && amountNum > 0 && Math.abs(quote.inputAmount) === amountNum
        ? quote.totalCost / amountNum
        : null;

    // Handlers
    const handleIncrement = () => {
        setAmount(prev => {
            const newVal = parseFloat(prev || '1') + 1;
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
            // V6.1: Direct swap - maxCost in USDC
            const maxCostUsdc = quote.maxWithSlippage.toFixed(decimals);

            const success = await swap(selectedOutcome, sharesInput, maxCostUsdc);
            if (success) {
                setAmount('10');
                onTradeSuccess?.();
            }
        } catch (err) {
            console.error('Trade failed:', err);
        } finally {
            setIsPending(false);
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

    // Check if sell amount exceeds holdings
    const exceedsHoldings = tradeMode === 'sell' && amountNum > maxSellAmount;

    // Check if buy amount exceeds balance
    const usdcBalanceNum = parseFloat(formatUnits(usdcBalance, decimals));
    const insufficientBalance = !isQuoteLoading && tradeMode === 'buy' && quote && usdcBalanceNum < quote.maxWithSlippage;

    // LP Health Check (for info)
    const { isUnderwater } = useLaunchpadMarket(address);

    // Helper for Connect Wallet
    const handleConnect = () => {
        const connectBtn = document.querySelector('appkit-button') as HTMLElement;
        connectBtn?.click();
    };

    return (
        <div className="space-y-3">
            {/* Buy/Sell Toggle */}
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={() => setTradeMode('buy')}
                    className={`py-2 rounded-lg font-bold text-sm transition-all ${tradeMode === 'buy'
                        ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                        : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                >
                    {t.buy}
                </button>
                <button
                    onClick={() => setTradeMode('sell')}
                    className={`py-2 rounded-lg font-bold text-sm transition-all ${tradeMode === 'sell'
                        ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400'
                        : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                >
                    {t.sell}
                </button>
            </div>

            {/* Outcome Selection */}
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={() => setSelectedOutcome(0)}
                    className={`p-2 rounded-lg border-2 text-center transition-all ${selectedOutcome === 0
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-700/50 bg-emerald-500/5 hover:border-emerald-500/50'
                        }`}
                >
                    <div className="text-[10px] text-emerald-400 uppercase tracking-wider mb-0.5 font-bold">{c.yes}</div>
                    <div className="text-sm font-medium text-white tabular-nums flex items-center justify-center gap-1">
                        {((market?.priceYes ?? 0.5) * 100).toFixed(1)}%
                        {quote && amountNum > 0 && Math.abs(quote.inputAmount) === amountNum && (
                            <>
                                <span className="text-slate-500 text-[10px]">→</span>
                                <span className="text-emerald-400">{(quote.newPriceYes * 100).toFixed(1)}%</span>
                            </>
                        )}
                    </div>
                </button>
                <button
                    onClick={() => setSelectedOutcome(1)}
                    className={`p-2 rounded-lg border-2 text-center transition-all ${selectedOutcome === 1
                        ? 'border-rose-500 bg-rose-500/10'
                        : 'border-slate-700/50 bg-rose-500/5 hover:border-rose-500/50'
                        }`}
                >
                    <div className="text-[10px] text-rose-400 uppercase tracking-wider mb-0.5 font-bold">{c.no}</div>
                    <div className="text-sm font-medium text-white tabular-nums flex items-center justify-center gap-1">
                        {((1 - (market?.priceYes ?? 0.5)) * 100).toFixed(1)}%
                        {quote && amountNum > 0 && Math.abs(quote.inputAmount) === amountNum && (
                            <>
                                <span className="text-slate-500 text-[10px]">→</span>
                                <span className="text-rose-400">{(quote.newPriceNo * 100).toFixed(1)}%</span>
                            </>
                        )}
                    </div>
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
                            Bal: {formatCurrency(parseFloat(formatUnits(usdcBalance || 0n, decimals || 18)))}
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
                        className={`w-full bg-slate-900/50 border rounded-lg px-12 py-2 text-sm text-white text-center focus:outline-none transition-colors ${exceedsHoldings
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
                        className={`py-1 text-[10px] font-mono rounded transition-all ${amount === String(val)
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
                    <span className="text-slate-500">Price (Net)</span>
                    <span className="font-mono text-white">
                        {costPerShare !== null ? formatCurrency(costPerShare - (quote?.fee || 0) / (amountNum || 1)) : '--'}
                    </span>
                </div>
                {quote && quote.priceImpact > 0 && (
                    <div className="flex justify-between">
                        <span className="text-slate-500">Price Impact</span>
                        <span className={`font-mono ${quote.priceImpact > 5 ? 'text-rose-400 font-bold' : quote.priceImpact > 2 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {quote.priceImpact.toFixed(2)}%
                        </span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-slate-500">
                        Fee <span className={`${isGraduated ? 'text-emerald-400' : 'text-cyan-400'}`}>
                            ({isGraduated ? '1%' : '5%'})
                        </span>
                    </span>
                    <span className="font-mono text-slate-400">
                        {quote && Math.abs(quote.inputAmount) === amountNum ? formatCurrency(quote.fee) : '--'}
                    </span>
                </div>
                <div className="flex justify-between border-t border-slate-700/50 pt-1">
                    <span className="text-slate-400 font-medium">{tradeMode === 'buy' ? 'Total Cost' : 'Min Received'}</span>
                    <span className="font-mono font-bold text-white">
                        {quote && Math.abs(quote.inputAmount) === amountNum ? formatCurrency(quote.maxWithSlippage) : '--'}
                    </span>
                </div>
                {quote && quote.nextFloor > 0 && (
                    <div className="flex justify-between pt-1 opacity-60">
                        <span className="text-[10px] text-slate-500">Projected LP Floor</span>
                        <span className="text-[10px] font-mono text-emerald-400/80">
                            ${quote.nextFloor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                )}
            </div>

            {/* Underwater Warning */}
            {isUnderwater && (
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 flex items-start gap-2">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>Pool is underwater. LP Floor is currently $0.00.</span>
                </div>
            )}

            {/* Slippage & Info */}
            <div className="flex items-center justify-between">
                <div className="relative">
                    <button
                        onClick={() => setShowSlippageSelector(!showSlippageSelector)}
                        className="text-[10px] text-slate-500 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                    >
                        <Info size={10} />
                        Slippage: <span className="text-slate-300">{(slippageBps / 100).toFixed(1)}%</span>
                    </button>
                    {showSlippageSelector && (
                        <div className="absolute bottom-full left-0 mb-2 bg-slate-900 border border-slate-700 rounded-lg p-1 grid grid-cols-2 gap-1 w-32 shadow-xl z-20">
                            {SLIPPAGE_OPTIONS.map(bps => (
                                <button
                                    key={bps}
                                    onClick={() => {
                                        setSlippageBps(bps);
                                        setShowSlippageSelector(false);
                                    }}
                                    className={`py-1 text-[10px] font-mono rounded ${slippageBps === bps
                                        ? 'bg-cyan-500 text-black font-bold'
                                        : 'text-slate-300 hover:bg-slate-800'
                                        }`}
                                >
                                    {(bps / 100).toFixed(1)}%
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Price Impact Warning */}
            {quote && quote.priceImpact > 5 && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 flex items-start gap-2">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>High price impact: {quote.priceImpact.toFixed(2)}%. This trade moves the market price significantly.</span>
                </div>
            )}

            {/* Trade Button */}
            {tradeMode === 'sell' && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-400/80">
                    <Clock size={12} />
                    <span>Proceeds will be locked for 24h before they can be withdrawn.</span>
                </div>
            )}

            {!isConnected ? (
                <Button
                    onClick={handleConnect}
                    className="w-full py-2 text-sm bg-indigo-600 hover:bg-indigo-500"
                >
                    <Wallet size={16} className="mr-2" />
                    Connect Wallet
                </Button>
            ) : (
                <Button
                    onClick={handleTrade}
                    disabled={
                        isPending ||
                        isSwapPending ||
                        swapLoading ||
                        isQuoteLoading ||
                        !quote ||
                        parseFloat(amount) <= 0 ||
                        exceedsHoldings ||
                        insufficientBalance ||
                        (tradeMode === 'sell' && !canSell)
                    }
                    className={`w-full py-2 text-sm font-bold shadow-lg ${selectedOutcome === 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
                        : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20'
                        } ${(exceedsHoldings || insufficientBalance || swapLoading || isQuoteLoading || (tradeMode === 'sell' && !canSell)) ? 'opacity-50' : ''}`}
                >
                    {isPending || isSwapPending ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            Processing...
                        </span>
                    ) : swapLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            Initializing...
                        </span>
                    ) : isQuoteLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            Quoting...
                        </span>
                    ) : tradeMode === 'sell' && !canSell ? (
                        `No ${selectedOutcome === 0 ? 'YES' : 'NO'} shares`
                    ) : exceedsHoldings ? (
                        'Insufficient shares'
                    ) : insufficientBalance ? (
                        'Insufficient USDC'
                    ) : (
                        `${tradeMode === 'buy' ? 'Buy' : 'Sell'} ${selectedOutcome === 0 ? 'YES' : 'NO'}`
                    )}
                </Button>
            )}
        </div>
    );
};
