import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Clock, Zap, BookOpen } from 'lucide-react';
import { useLaunchpadMarket } from '../hooks/v5/useLaunchpadMarket';
import { useLaunchpadMarkets } from '../hooks/v5/useLaunchpadMarkets';
import { useAmmMarketByAddress } from '../hooks/useAmmMarketByAddress';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { OrderbookForm } from '../components/features/trader/OrderbookForm';
import { formatUnits } from 'viem';
import { useAccount, useReadContracts } from 'wagmi';
import { MarketCard } from '../components/features/market/MarketCard';
import { LAUNCHPAD_MARKET_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI } from '../config/abis';

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
    outcomeToken,
  } = useLaunchpadMarket(address as `0x${string}`);

  const { markets: allMarkets, isLoading: marketsLoading } = useLaunchpadMarkets();
  const marketMeta = allMarkets?.find(m => m.address.toLowerCase() === address?.toLowerCase());

  // Fallback: Fetch name/symbol directly from outcome token if not in markets list
  const { data: directTokenData } = useReadContracts({
    contracts: outcomeToken ? [
      { address: outcomeToken, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'name' },
      { address: outcomeToken, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'symbol' },
    ] : [],
    query: {
      enabled: !!outcomeToken && !marketMeta && !marketsLoading,
    },
  });

  const directName = directTokenData?.[0]?.result as string | undefined;
  const directSymbol = directTokenData?.[1]?.result as string | undefined;

  // Use marketMeta if available, otherwise use direct fetch, otherwise fallback
  const displayName = marketMeta?.name || directName || 'Loading...';
  const displaySymbol = marketMeta?.symbol || directSymbol || '???';

  const { market, isLoading: marketLoading } = useAmmMarketByAddress(
    address as `0x${string}`,
    marketMeta || (directName || directSymbol) ? {
      address: address as `0x${string}`,
      name: displayName,
      symbol: displaySymbol,
      isGraduated: isGraduated || false,
      deadline: deadline ? Number(deadline) : undefined,
    } : undefined
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

  // Calculate new prices after trade (for preview) - Simplified for now, just show current
  // In future we can bubble up state from TradingPanel if needed for the graphic
  const tradeQuotePreview = null;

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
              {displayName}
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
              <div className="p-6 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5">
                <div className="text-sm text-emerald-400 mb-1">YES</div>
                <div className="text-4xl font-bold text-white tabular-nums">
                  {(priceYes * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  ${priceYes.toFixed(4)} per share
                </div>
              </div>

              <div className="p-6 rounded-xl border-2 border-rose-500/30 bg-rose-500/5">
                <div className="text-sm text-rose-400 mb-1">NO</div>
                <div className="text-4xl font-bold text-white tabular-nums">
                  {(priceNo * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  ${priceNo.toFixed(4)} per share
                </div>
              </div>
            </div>

            {/* Probability Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">YES Probability</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-bold tabular-nums text-white">
                    {(priceYes * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-3 rounded-full overflow-hidden flex">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400"
                  style={{ width: `${priceYes * 100}%` }}
                />
                <div
                  className="bg-gradient-to-r from-rose-400 to-rose-500"
                  style={{ width: `${priceNo * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Liquidity: ${bParamNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span>qYes: {qYes.toFixed(0)} | qNo: {qNo.toFixed(0)}</span>
              </div>
            </div>
          </Card>

          {/* Orderbook Trading (Post-Graduation Only) */}
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

        {/* Right: Trading Panel (Using MarketCard Style) */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <MarketCard
              address={address as `0x${string}`}
              name={displayName}
              symbol={displaySymbol}
              isGraduated={isGraduated}
              deadline={marketMeta?.deadline ? Number(marketMeta.deadline) : (deadline ? Number(deadline) : undefined)}
              disableNavigation={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

