// LaunchpadMarketCard.tsx - Market card for V5 Launchpad markets
// Reuses AmmMarketCard styling with dynamic market address support

import React, { useState, useRef } from 'react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { useAmmMarketByAddress, DynamicMarketData } from '../../../hooks/useAmmMarketByAddress';
import { useTraderVault } from '../../../hooks/useTraderVault';
import { useLaunchpadTradeQuote } from '../../../hooks/v5/useLaunchpadTradeQuote';
import { TrendingUp, Info, Rocket } from 'lucide-react';
import { useContent } from '../../../hooks/useContent';
import { useNavigationStore } from '../../../store/useNavigationStore';

interface LaunchpadMarketCardProps {
    marketAddress: `0x${string}`;
    marketMeta?: DynamicMarketData;
}

export const LaunchpadMarketCard: React.FC<LaunchpadMarketCardProps> = ({ marketAddress, marketMeta }) => {
    const { t } = useContent();
    const { setView } = useNavigationStore();
    const { market, isLoading } = useAmmMarketByAddress(marketAddress, marketMeta);
    const { executeAMMTrade, approveUSDC, allowance } = useTraderVault();

    const [amount, setAmount] = useState('1');
    const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(0);
    const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
    const [slippageBps, setSlippageBps] = useState(50);
    const [showSlippageSelector, setShowSlippageSelector] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const incrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const decrementIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Quote
    const sharesInput = tradeMode === 'buy' ? amount : `-${amount}`;
    const { quote, isLoading: quoteLoading } = useLaunchpadTradeQuote(
        marketAddress,
        selectedOutcome,
        sharesInput,
        slippageBps,
        market?.bParam || 0n
    );

    const hasValidAmount = quote && parseFloat(amount) > 0;

    if (isLoading || !market) {
        return (
            <Card variant="interactive" className="flex flex-col h-full animate-pulse">
                <div className="h-6 bg-slate-700 rounded w-3/4 mb-4" />
                <div className="h-4 bg-slate-700 rounded w-1/2 mb-2" />
                <div className="flex-1 bg-slate-700/50 rounded" />
            </Card>
        );
    }

    // Max sellable shares for the selected outcome
    const maxSellAmount = selectedOutcome === 0 ? market.userYesShares : market.userNoShares;
    const canSell = maxSellAmount > 0;

    const handleTrade = async () => {
        if (!amount || parseFloat(amount) <= 0 || !quote) return;

        // Validation for sells
        if (tradeMode === 'sell') {
            if (!canSell) return;
            if (parseFloat(amount) > maxSellAmount) return;
        }

        setIsPending(true);
        try {
            const limitParam = tradeMode === 'buy'
                ? quote.maxWithSlippage.toString()
                : (-quote.maxWithSlippage).toString();

            await executeAMMTrade(marketAddress, selectedOutcome, sharesInput, limitParam);
            setAmount('1');
        } catch (err) {
            console.error('Trade failed:', err);
        } finally {
            setIsPending(false);
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

    // Increment/Decrement handlers
    const handleIncrement = () => {
        setAmount(prev => String(parseFloat(prev || '1') + 1));
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

    const virtualLiquidity = Number(market.bParam) / 1e18;
    const priceYes = market.priceYes ?? 0.5;

    return (
        <Card variant="interactive" className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <h3 className="font-heading font-semibold text-xl text-white mb-2 line-clamp-2 flex-1">
                            {marketMeta?.name || market.question}
                        </h3>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 border-blue-500/30 text-blue-400">
                                <Rocket size={10} className="mr-1" />
                                Launchpad
                            </Badge>
                            {marketMeta?.isGraduated ? (
                                <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-400">
                                    🎓 Graduated
                                </Badge>
                            ) : (
                                <Badge variant="live" className="text-[10px]">
                                    🔥 Bonding
                                </Badge>
                            )}
                        </div>
                        <button
                            onClick={() => setView('launchpad-market', marketAddress)}
                            className="ml-2 h-6 px-2 text-[10px] gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center"
                        >
                            <TrendingUp size={12} />
                            <span>Details</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mini Progress Bar - Only for bonding markets */}
            {!marketMeta?.isGraduated && (
                <div className="mb-4 px-0.5">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-slate-500">Bonding Progress</span>
                        <span className="text-[10px] font-mono text-blue-400">
                            ${virtualLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                            style={{ width: `${Math.min(50, 100)}%` }} // TODO: Calculate from graduation threshold
                        />
                    </div>
                </div>
            )}

            {/* Buy/Sell + YES/NO Toggles */}
            <div className="mb-4 space-y-2 relative">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setTradeMode('buy')}
                        className={`h-11 rounded-xl border-2 font-bold text-white transition-all duration-200 hover:scale-[1.02] ${tradeMode === 'buy'
                            ? 'border-emerald-500 bg-emerald-500/15 shadow-glow-emerald'
                            : 'border-slate-700 hover:border-emerald-500/40 hover:bg-emerald-500/5'
                            }`}
                    >{t('trading.buy')}</button>
                    <button
                        onClick={() => setTradeMode('sell')}
                        className={`h-11 rounded-xl border-2 font-bold text-white transition-all duration-200 hover:scale-[1.02] ${tradeMode === 'sell'
                            ? 'border-rose-500 bg-rose-500/15 shadow-glow-rose'
                            : 'border-slate-700 hover:border-rose-500/40 hover:bg-rose-500/5'
                            }`}
                    >{t('trading.sell')}</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setSelectedOutcome(0)}
                        className={`h-11 rounded-xl border-2 font-bold text-white transition-all duration-200 hover:scale-[1.02] ${selectedOutcome === 0
                            ? 'border-emerald-500 bg-emerald-500/15 shadow-glow-emerald'
                            : 'border-slate-700 hover:border-emerald-500/40 hover:bg-emerald-500/5'
                            }`}
                    >{t('trading.yes')}</button>
                    <button
                        onClick={() => setSelectedOutcome(1)}
                        className={`h-11 rounded-xl border-2 font-bold text-white transition-all duration-200 hover:scale-[1.02] ${selectedOutcome === 1
                            ? 'border-rose-500 bg-rose-500/15 shadow-glow-rose'
                            : 'border-slate-700 hover:border-rose-500/40 hover:bg-rose-500/5'
                            }`}
                    >{t('trading.no')}</button>
                </div>
            </div>

            {/* Quote Preview */}
            <div className="mb-4 space-y-3">
                {/* Market Info Bar */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <div>
                        <div className="text-xs text-slate-500">{t('trading.yesPrice')}</div>
                        <div className="text-lg font-bold text-white font-mono">
                            {(hasValidAmount && quote ? (selectedOutcome === 0 ? quote.newPriceYes : quote.newPriceNo) : priceYes).toFixed(2)} {t('common.usdc')}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-500">{t('trading.liquidity')}</div>
                        <div className="text-sm font-mono text-blue-400">
                            ${virtualLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>
                </div>

                {/* Probability Bar */}
                <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-400">{t('trading.yesProb')}</span>
                        <div className="flex items-baseline gap-2 font-mono">
                            <span className={`text-xl font-bold tabular-nums ${hasValidAmount ? 'text-slate-300' : 'text-white'}`}>
                                {(priceYes * 100).toFixed(1)}%
                            </span>

                            {hasValidAmount && quote && (
                                <>
                                    <span className="text-slate-600 text-sm">→</span>
                                    <span className={`text-xl font-bold tabular-nums ${quote.newPriceYes >= priceYes ? 'text-emerald-400' : 'text-rose-400'
                                        }`}>
                                        {(quote.newPriceYes * 100).toFixed(1)}%
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                            style={{ width: `${(hasValidAmount && quote ? quote.newPriceYes : priceYes) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Order Summary */}
                <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Est. Cost</span>
                        <span className="font-mono text-white">
                            {quote ? formatCurrency(quote.expectedCost) : '--'}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Fee</span>
                        <span className="font-mono text-slate-400">
                            {quote ? formatCurrency(quote.fee) : '--'}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-slate-800 pt-1.5">
                        <span className="text-slate-400 font-medium">{tradeMode === 'buy' ? 'Max Total' : 'Min Received'}</span>
                        <span className="font-mono font-bold text-white">
                            {quote ? formatCurrency(quote.maxWithSlippage) : '--'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick Trade */}
            <div className="mt-auto space-y-3">
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-500">{t('trading.shares')}</label>
                        {tradeMode === 'sell' && (
                            <span className="text-xs text-slate-500">
                                {t('portfolio.max')}: {(selectedOutcome === 0 ? market.userYesShares : market.userNoShares).toFixed(2)}
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
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-12 py-2 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
                            placeholder="1"
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
                </div>

                {/* Slippage Selector */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-500">{t('trading.slippage')}</label>
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
                                    className={`px-2 py-1 rounded text-xs transition-colors ${slippageBps === bps
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
                        !amount ||
                        parseFloat(amount) <= 0 ||
                        !quote ||
                        (tradeMode === 'sell' && !canSell) ||
                        (tradeMode === 'sell' && parseFloat(amount) > maxSellAmount)
                    }
                    className={`w-full ${selectedOutcome === 0
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                        }`}
                >
                    {isPending
                        ? t('common.loading')
                        : tradeMode === 'sell' && !canSell
                            ? 'No shares to sell'
                            : `${tradeMode === 'buy' ? t('trading.buy') : t('trading.sell')} ${selectedOutcome === 0 ? t('trading.yes') : t('trading.no')}`
                    }
                </Button>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-600 mt-2">
                ⚡ {t('trading.marketOrderNote')}
            </div>
        </Card>
    );
};
