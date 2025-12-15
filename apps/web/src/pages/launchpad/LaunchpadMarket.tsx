// LaunchpadMarket.tsx - Redesigned market detail page for V5 Launchpad

import { useState } from 'react';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useLaunchpadMarket } from '../../hooks/v5/useLaunchpadMarket';
import { useLaunchpadMarkets } from '../../hooks/v5/useLaunchpadMarkets';
import { useAmmMarketByAddress } from '../../hooks/useAmmMarketByAddress';
import { useTraderVault } from '../../hooks/useTraderVault';
import { useLaunchpadTradeQuote } from '../../hooks/v5/useLaunchpadTradeQuote';
import { formatEther } from 'viem';
import { useAccount } from 'wagmi';

// Components
import { MarketHeader } from '../../components/features/launchpad/MarketHeader';
import { GraduationProgress } from '../../components/features/launchpad/GraduationProgress';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Info, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

export const LaunchpadMarket = () => {
    const { setView, activeMarketAddress } = useNavigationStore();
    const { address: userAddress } = useAccount();

    // Market data hooks
    const {
        isGraduated,
        graduationThreshold,
        bBase,
        deadline,
        creator,
        isLive,
        graduate,
        expire,
        claimRefund,
        isGraduatePending,
        isExpirePending,
        isRefundPending,
        feesAccrued
    } = useLaunchpadMarket(activeMarketAddress as `0x${string}`);

    // Get market name from launchpad markets
    const { markets: allLaunchpadMarkets } = useLaunchpadMarkets();
    const marketMeta = allLaunchpadMarkets?.find(m => m.address.toLowerCase() === activeMarketAddress?.toLowerCase());

    // Trading data
    const { market, isLoading: marketLoading } = useAmmMarketByAddress(
        activeMarketAddress as `0x${string}`,
        marketMeta ? { address: marketMeta.address, name: marketMeta.name, symbol: marketMeta.symbol, isGraduated: marketMeta.isGraduated, deadline: marketMeta.deadline } : undefined
    );
    const { executeAMMTrade } = useTraderVault();

    // Trade state
    const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
    const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(0);
    const [amount, setAmount] = useState('1');
    const [slippageBps, setSlippageBps] = useState(50);
    const [isPending, setIsPending] = useState(false);

    // Quote
    const sharesInput = tradeMode === 'buy' ? amount : `-${amount}`;
    const { quote, isLoading: quoteLoading } = useLaunchpadTradeQuote(
        activeMarketAddress as `0x${string}`,
        selectedOutcome,
        sharesInput,
        slippageBps,
        bBase || 0n
    );

    if (!activeMarketAddress) {
        return (
            <div className="p-6 max-w-7xl mx-auto text-center">
                <p className="text-slate-400">No market selected</p>
                <Button onClick={() => setView('dapp')} className="mt-4">Back to Markets</Button>
            </div>
        );
    }

    const isExpired = deadline && Date.now() / 1000 > deadline && !isGraduated;
    const isCreator = userAddress?.toLowerCase() === creator?.toLowerCase();
    const priceYes = market?.priceYes ?? 0.5;

    const handleTrade = async () => {
        if (!amount || parseFloat(amount) <= 0 || !quote) return;
        setIsPending(true);
        try {
            const limitParam = tradeMode === 'buy'
                ? quote.maxWithSlippage.toString()
                : (-quote.maxWithSlippage).toString();
            await executeAMMTrade(activeMarketAddress as `0x${string}`, selectedOutcome, sharesInput, limitParam);
            setAmount('1');
        } catch (err) {
            console.error('Trade failed:', err);
        } finally {
            setIsPending(false);
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <MarketHeader
                name={marketMeta?.name || market?.question || 'Loading...'}
                symbol={marketMeta?.symbol}
                address={activeMarketAddress}
                creator={creator || '0x...'}
                deadline={Number(deadline) || 0}
                isGraduated={isGraduated || false}
                isExpired={isExpired || false}
                isLive={isLive ?? true}
                onBack={() => setView('dapp')}
            />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Progress + Chart */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Graduation Progress */}
                    <GraduationProgress
                        bBase={bBase || 0n}
                        graduationThreshold={graduationThreshold || 0n}
                        isGraduated={isGraduated || false}
                        feesAccrued={feesAccrued}
                        onGraduate={graduate}
                        isGraduatePending={isGraduatePending}
                    />

                    {/* Probability Display */}
                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-heading font-semibold text-white">Market Probability</h3>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <Info size={14} />
                                <span>Based on current AMM state</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                                <div className="text-sm text-emerald-400 mb-1">YES Probability</div>
                                <div className="text-3xl font-bold text-emerald-400 font-mono">
                                    {(priceYes * 100).toFixed(1)}%
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    Price: {priceYes.toFixed(4)} USDC
                                </div>
                            </div>
                            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30">
                                <div className="text-sm text-rose-400 mb-1">NO Probability</div>
                                <div className="text-3xl font-bold text-rose-400 font-mono">
                                    {((1 - priceYes) * 100).toFixed(1)}%
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    Price: {(1 - priceYes).toFixed(4)} USDC
                                </div>
                            </div>
                        </div>

                        {/* Probability Bar */}
                        <div className="mt-4 h-3 bg-slate-800 rounded-full overflow-hidden flex">
                            <div
                                className="bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                                style={{ width: `${priceYes * 100}%` }}
                            />
                            <div
                                className="bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-500"
                                style={{ width: `${(1 - priceYes) * 100}%` }}
                            />
                        </div>
                    </Card>

                    {/* Chart Placeholder */}
                    <Card className="p-6">
                        <h3 className="font-heading font-semibold text-white mb-4">Price History</h3>
                        <div className="h-48 flex items-center justify-center bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
                            <p className="text-slate-500 text-sm">Chart coming soon...</p>
                        </div>
                    </Card>

                    {/* Expired Actions */}
                    {isExpired && isCreator && (
                        <Card className="p-6 border-red-500/30 bg-red-500/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-heading font-semibold text-red-400">Market Expired</h3>
                                    <p className="text-sm text-slate-400 mt-1">
                                        Your initial deposit + earned fees can be claimed.
                                    </p>
                                </div>
                                <Button
                                    onClick={claimRefund}
                                    disabled={isRefundPending}
                                    className="bg-red-600 hover:bg-red-500"
                                >
                                    {isRefundPending ? 'Claiming...' : 'Claim Refund'}
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Right Column: Trading Panel */}
                <div className="lg:col-span-4">
                    <Card className="p-6 sticky top-6">
                        <h3 className="font-heading font-semibold text-white mb-4">Trade</h3>

                        {/* Buy/Sell Toggle */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <button
                                onClick={() => setTradeMode('buy')}
                                className={`py-3 rounded-lg font-bold transition-all ${tradeMode === 'buy'
                                        ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                                        : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                            >
                                Buy
                            </button>
                            <button
                                onClick={() => setTradeMode('sell')}
                                className={`py-3 rounded-lg font-bold transition-all ${tradeMode === 'sell'
                                        ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400'
                                        : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                            >
                                Sell
                            </button>
                        </div>

                        {/* YES/NO Toggle */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <button
                                onClick={() => setSelectedOutcome(0)}
                                className={`py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${selectedOutcome === 0
                                        ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                                        : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                            >
                                <TrendingUp size={16} />
                                YES
                            </button>
                            <button
                                onClick={() => setSelectedOutcome(1)}
                                className={`py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${selectedOutcome === 1
                                        ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400'
                                        : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                            >
                                <TrendingDown size={16} />
                                NO
                            </button>
                        </div>

                        {/* Amount Input */}
                        <div className="mb-4">
                            <label className="text-xs text-slate-500 mb-1 block">Shares</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                                placeholder="1"
                                min="0.01"
                                step="0.1"
                            />
                        </div>

                        {/* Quote Summary */}
                        <div className="p-4 bg-slate-800/50 rounded-lg space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Est. Cost</span>
                                <span className="font-mono text-white">
                                    {quote ? formatCurrency(quote.expectedCost) : '--'}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Fee</span>
                                <span className="font-mono text-slate-400">
                                    {quote ? formatCurrency(quote.fee) : '--'}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm border-t border-slate-700 pt-2">
                                <span className="text-slate-300 font-medium">
                                    {tradeMode === 'buy' ? 'Max Total' : 'Min Received'}
                                </span>
                                <span className="font-mono font-bold text-white">
                                    {quote ? formatCurrency(quote.maxWithSlippage) : '--'}
                                </span>
                            </div>
                        </div>

                        {/* Trade Button */}
                        <Button
                            onClick={handleTrade}
                            disabled={isPending || !quote || parseFloat(amount) <= 0}
                            className={`w-full py-4 font-bold ${selectedOutcome === 0
                                    ? 'bg-emerald-600 hover:bg-emerald-500'
                                    : 'bg-rose-600 hover:bg-rose-500'
                                }`}
                        >
                            {isPending ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 size={18} className="animate-spin" />
                                    Processing...
                                </span>
                            ) : (
                                `${tradeMode === 'buy' ? 'Buy' : 'Sell'} ${selectedOutcome === 0 ? 'YES' : 'NO'}`
                            )}
                        </Button>

                        {/* Slippage */}
                        <div className="mt-3 text-center text-xs text-slate-500">
                            Slippage tolerance: {(slippageBps / 100).toFixed(1)}%
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
