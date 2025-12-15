import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Clock, Users, TrendingUp, TrendingDown, Loader2, Zap, BookOpen } from 'lucide-react';
import { useLaunchpadMarket } from '../hooks/v5/useLaunchpadMarket';
import { useLaunchpadMarkets } from '../hooks/v5/useLaunchpadMarkets';
import { useAmmMarketByAddress } from '../hooks/useAmmMarketByAddress';
import { useTraderVault } from '../hooks/useTraderVault';
import { useLaunchpadTradeQuote } from '../hooks/v5/useLaunchpadTradeQuote';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { OrderbookForm } from '../components/features/trader/OrderbookForm';
import { formatEther, formatUnits } from 'viem';
import { useAccount } from 'wagmi';
import { getLMSRQuote } from '../utils/lmsr';

export const MarketDetail = () => {
  const { address } = useParams<{ address: string }>();
  const { address: userAddress } = useAccount();
  
  const {
    isGraduated,
    graduationThreshold,
    bBase,
    deadline,
    creator,
    isLive,
    graduate,
    isGraduatePending,
    feesAccrued,
  } = useLaunchpadMarket(address as `0x${string}`);
  
  const { markets: allMarkets } = useLaunchpadMarkets();
  const marketMeta = allMarkets?.find(m => m.address.toLowerCase() === address?.toLowerCase());
  
  const { market, isLoading: marketLoading } = useAmmMarketByAddress(
    address as `0x${string}`,
    marketMeta ? {
      address: marketMeta.address,
      name: marketMeta.name,
      symbol: marketMeta.symbol,
      isGraduated: marketMeta.isGraduated,
      deadline: marketMeta.deadline,
    } : undefined
  );
  
  const { executeAMMTrade } = useTraderVault();

  // Trade state
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(0);
  const [amount, setAmount] = useState('10');
  const [slippageBps] = useState(100);
  const [isPending, setIsPending] = useState(false);

  const sharesInput = tradeMode === 'buy' ? amount : `-${amount}`;
  const { quote } = useLaunchpadTradeQuote(
    address as `0x${string}`,
    selectedOutcome,
    sharesInput,
    slippageBps,
    bBase || 0n
  );

  if (!address) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Market not found</p>
        <Link to="/markets" className="text-cyan-400 hover:text-cyan-300 mt-4 inline-block">
          ← Back to Markets
        </Link>
      </div>
    );
  }

  const isExpired = deadline && Date.now() / 1000 > deadline && !isGraduated;
  const priceYes = market?.priceYes ?? 0.5;
  const priceNo = 1 - priceYes;
  const graduationProgress = bBase && graduationThreshold 
    ? Math.min(100, Number((bBase * 100n) / graduationThreshold))
    : 0;

  // LMSR parameters for display
  const bParamNum = market?.bParam ? parseFloat(formatUnits(BigInt(market.bParam.toString()), 18)) : 1000;
  const qYes = market?.qYes ? parseFloat(formatUnits(BigInt(market.qYes.toString()), 18)) : 0;
  const qNo = market?.qNo ? parseFloat(formatUnits(BigInt(market.qNo.toString()), 18)) : 0;

  // Calculate new prices after trade (for preview)
  const amountNum = parseFloat(amount) || 0;
  const tradeQuotePreview = amountNum > 0 && bParamNum > 0 
    ? getLMSRQuote(qYes, qNo, bParamNum, tradeMode === 'buy' ? amountNum : -amountNum, selectedOutcome)
    : null;

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0 || !quote) return;
    setIsPending(true);
    try {
      const limitParam = tradeMode === 'buy'
        ? quote.maxWithSlippage.toString()
        : (-quote.maxWithSlippage).toString();
      await executeAMMTrade(address as `0x${string}`, selectedOutcome, sharesInput, limitParam);
      setAmount('10');
    } catch (err) {
      console.error('Trade failed:', err);
    } finally {
      setIsPending(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/markets"
          className="p-2 rounded-lg border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/50 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">
              {marketMeta?.name || 'Loading...'}
            </h1>
            {isGraduated ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                🎓 Graduated
              </Badge>
            ) : isExpired ? (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
                ⏰ Expired
              </Badge>
            ) : (
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50 animate-pulse">
                🔥 Bonding
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <a
              href={`https://sepolia.basescan.org/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-cyan-400 transition-colors font-mono"
            >
              {address?.slice(0, 6)}...{address?.slice(-4)}
              <ExternalLink className="w-3 h-3" />
            </a>
            {deadline && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(Number(deadline) * 1000).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Market Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Graduation Progress */}
          {!isGraduated && (
            <Card className="p-6 border-cyan-500/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  Bonding Progress
                </h3>
                <span className="text-2xl font-bold text-cyan-400 tabular-nums">
                  {graduationProgress.toFixed(1)}%
                </span>
              </div>
              
              <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden mb-4">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-1000 ease-out"
                  style={{ width: `${graduationProgress}%` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">
                  ${bBase ? (Number(bBase) / 1e18).toLocaleString() : '0'} raised
                </span>
                <span className="text-slate-400">
                  ${graduationThreshold ? (Number(graduationThreshold) / 1e18).toLocaleString() : '0'} target
                </span>
              </div>

              {graduationProgress >= 100 && (
                <Button
                  onClick={graduate}
                  disabled={isGraduatePending}
                  className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-bold"
                >
                  {isGraduatePending ? 'Graduating...' : '🎓 Graduate Market'}
                </Button>
              )}
            </Card>
          )}

          {/* Probability Display */}
          <Card className="p-6">
            <h3 className="font-bold text-white mb-6">Market Probability</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className={`p-6 rounded-xl border-2 transition-all ${
                selectedOutcome === 0 
                  ? 'border-emerald-500 bg-emerald-500/10' 
                  : 'border-slate-700 hover:border-emerald-500/50'
              }`}>
                <div className="text-sm text-emerald-400 mb-1">YES</div>
                <div className="text-4xl font-bold text-white tabular-nums">
                  {(priceYes * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  ${priceYes.toFixed(4)} per share
                </div>
              </div>
              
              <div className={`p-6 rounded-xl border-2 transition-all ${
                selectedOutcome === 1 
                  ? 'border-rose-500 bg-rose-500/10' 
                  : 'border-slate-700 hover:border-rose-500/50'
              }`}>
                <div className="text-sm text-rose-400 mb-1">NO</div>
                <div className="text-4xl font-bold text-white tabular-nums">
                  {(priceNo * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  ${priceNo.toFixed(4)} per share
                </div>
              </div>
            </div>

            {/* Probability Bar with Transition Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">YES Probability</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={`font-bold tabular-nums ${tradeQuotePreview ? 'text-slate-400' : 'text-white'}`}>
                    {(priceYes * 100).toFixed(1)}%
                  </span>
                  {tradeQuotePreview && (
                    <>
                      <span className="text-slate-600">→</span>
                      <span className={`font-bold tabular-nums ${
                        tradeQuotePreview.newPriceYes > priceYes ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {(tradeQuotePreview.newPriceYes * 100).toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="h-3 rounded-full overflow-hidden flex">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${(tradeQuotePreview?.newPriceYes ?? priceYes) * 100}%` }}
                />
                <div
                  className="bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-500"
                  style={{ width: `${(tradeQuotePreview?.newPriceNo ?? priceNo) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Liquidity: ${bParamNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span>qYes: {qYes.toFixed(0)} | qNo: {qNo.toFixed(0)}</span>
              </div>
            </div>
          </Card>

          {/* Orderbook Trading for Graduated Markets */}
          {isGraduated && address && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  Orderbook Trading
                </h3>
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                  Limit Orders
                </Badge>
              </div>
              <OrderbookForm marketId={address} />
            </Card>
          )}
        </div>

        {/* Right: Trading Panel */}
        <div className="lg:col-span-1">
          <Card className="p-6 sticky top-24 border-slate-700">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              Trade
            </h3>

            {/* Buy/Sell Toggle */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setTradeMode('buy')}
                className={`py-3 rounded-lg font-bold transition-all ${
                  tradeMode === 'buy'
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                    : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeMode('sell')}
                className={`py-3 rounded-lg font-bold transition-all ${
                  tradeMode === 'sell'
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
                className={`py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                  selectedOutcome === 0
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                    : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <TrendingUp size={16} />
                YES
              </button>
              <button
                onClick={() => setSelectedOutcome(1)}
                className={`py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                  selectedOutcome === 1
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
              <label className="text-xs text-slate-500 mb-2 block">Amount (shares)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="10"
                min="1"
              />
            </div>

            {/* Quick Amounts */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[10, 50, 100, 500].map(val => (
                <button
                  key={val}
                  onClick={() => setAmount(String(val))}
                  className={`py-2 text-xs font-mono rounded-lg transition-all ${
                    amount === String(val)
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>

            {/* Quote Summary */}
            <div className="p-4 bg-slate-800/50 rounded-lg space-y-2 mb-4 border border-slate-700">
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
            {!userAddress ? (
              <Button
                onClick={() => {
                  // Trigger wallet connect modal
                  const connectBtn = document.querySelector('appkit-button') as HTMLElement;
                  connectBtn?.click();
                }}
                className="w-full py-4 font-bold bg-cyan-600 hover:bg-cyan-500"
              >
                Connect Wallet to Trade
              </Button>
            ) : (
              <Button
                onClick={handleTrade}
                disabled={isPending || !quote || parseFloat(amount) <= 0}
                className={`w-full py-4 font-bold ${
                  selectedOutcome === 0
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
            )}

            <div className="mt-3 text-center text-xs text-slate-500 font-mono">
              slippage: {(slippageBps / 100).toFixed(1)}%
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

