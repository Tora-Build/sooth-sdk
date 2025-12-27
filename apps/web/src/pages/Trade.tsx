/**
 * Trade Page - AMM Trader Interface
 * 
 * Simple, approachable trading for retail users expressing opinions or hedging risk.
 * Features: Quick trade buttons, large probability display, educational tooltips
 */
import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, TrendingUp, Zap, Clock, ChevronRight, GraduationCap } from 'lucide-react';
import { useChainStore } from '../store/useChainStore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SimpleTradingPanel } from '../components/features/v8';
import { MarketStats } from '../components/features/v8/MarketStats';
import { LPHolders } from '../components/features/v8/LPHolders';
import { useAmmMarketDirect, useTruthMarketDirect, useLaunchpadMarketDirect } from '../hooks/v8';
import marketsConfig from '../config/markets.json';
import uiContent from '../config/ui-content.json';

const { trade: content } = uiContent;

// Market card for the selector
interface MarketItemProps {
  market: typeof marketsConfig.markets[0];
  isSelected: boolean;
  onSelect: () => void;
}

const MarketItem: React.FC<MarketItemProps> = ({ market, isSelected, onSelect }) => {
  const { amm, isLoading: isAmmLoading } = useAmmMarketDirect(market.contractAddress as `0x${string}`);
  const { launchpad, isLoading: isLaunchpadLoading } = useLaunchpadMarketDirect(market.contractAddress as `0x${string}`);
  const probability = amm?.yesProbability ?? 0.5;
  const probabilityPercent = (probability * 100).toFixed(0);
  const isGraduated = launchpad?.isGraduated ?? false;
  const graduationProgress = launchpad?.graduationProgress ?? 0;

  return (
    <button
      onClick={onSelect}
      className={`card-lift w-full p-3 rounded-lg text-left focus-ring relative overflow-hidden transition-all duration-200 ${isSelected
        ? 'bg-indigo-600/20 border-indigo-500 border shadow-lg shadow-indigo-500/10'
        : 'bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
        }`}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Graduation Progress Ring */}
        <div className="flex-shrink-0">
          {isGraduated ? (
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-emerald-400" />
            </div>
          ) : (
            <div className="relative w-9 h-9">
              <svg className="w-9 h-9 transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-700" />
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${graduationProgress * 0.88} 88`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[8px] font-bold text-cyan-400 tabular-nums">
                  {graduationProgress.toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Market Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`font-medium truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
              {market.symbol}
            </p>
            {isGraduated && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest leading-none">
                <Zap className="w-2 h-2 fill-current" />
                PRO
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 truncate leading-tight">{market.name}</p>
        </div>

        {/* Probability & Chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-lg font-bold tabular-nums leading-none ${probability > 0.5 ? 'text-emerald-400' : probability < 0.5 ? 'text-rose-400' : 'text-slate-400'
            }`}>
            {isAmmLoading ? <span className="skeleton w-8 h-5 inline-block" /> : `${probabilityPercent}%`}
          </span>
          <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-indigo-400 translate-x-0.5' : 'text-slate-600'}`} />
        </div>
      </div>
    </button>
  );
};

export const Trade = () => {
  const { marketId } = useParams<{ marketId?: string }>();
  const navigate = useNavigate();
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);

  const [searchQuery, setSearchQuery] = useState('');

  // Filter V8 markets for current chain
  const v8Markets = useMemo(() => {
    return marketsConfig.markets.filter(m =>
      m.version.startsWith('v8') && m.chainId === chainId
    );
  }, [chainId]);

  // Find selected market or default to first
  const selectedMarket = useMemo(() => {
    if (marketId) {
      return v8Markets.find(m => m.contractAddress.toLowerCase() === marketId.toLowerCase());
    }
    return v8Markets[0];
  }, [marketId, v8Markets]);

  // Filter markets by search
  const filteredMarkets = useMemo(() => {
    if (!searchQuery) return v8Markets;
    const query = searchQuery.toLowerCase();
    return v8Markets.filter(
      m => m.name.toLowerCase().includes(query) ||
        m.symbol.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query)
    );
  }, [searchQuery, v8Markets]);

  // Get market data
  const { market: truth } = useTruthMarketDirect(selectedMarket?.contractAddress as `0x${string}`);
  const { launchpad, isLoading: isLoadingLaunchpad } = useLaunchpadMarketDirect(selectedMarket?.contractAddress as `0x${string}`);

  const handleSelectMarket = (market: typeof v8Markets[0]) => {
    navigate(`/trade/${market.contractAddress}`);
  };

  const categories = ['Crypto', 'AI', 'Politics', 'Sports', 'Other'];

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">{content.header.title}</h1>
          <p className="text-slate-400 text-sm">{content.header.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Market Selector */}
          <div className="lg:col-span-3 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={content.selector.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-10 py-2 text-sm"
              />
            </div>

            {/* Categories - TODO: implement category filtering */}
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  className="quick-trade-btn text-xs"
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Trending Label */}
            <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider">
              <Zap className="w-3 h-3" />
              <span>{content.selector.trending}</span>
            </div>

            {/* Market List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar py-1 -my-1">
              {filteredMarkets.length > 0 ? (
                filteredMarkets.map(market => (
                  <MarketItem
                    key={market.id}
                    market={market}
                    isSelected={selectedMarket?.id === market.id}
                    onSelect={() => handleSelectMarket(market)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">{content.selector.noMarkets}</p>
                </div>
              )}
            </div>
          </div>

          {/* Center Column: Trading Panel */}
          <div className="lg:col-span-5 space-y-4">
            {selectedMarket ? (
              <>
                {/* Market Header */}
                <Card className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-white">{selectedMarket.name}</h2>
                      <p className="text-sm text-slate-400 mt-1">{selectedMarket.description}</p>
                      {selectedMarket.deadline && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>{content.panel.deadline}: {new Date(selectedMarket.deadline * 1000).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={launchpad?.isGraduated ? 'success' : 'warning'} className={launchpad?.isGraduated ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-amber-500/20 text-amber-400 border-amber-500/50'}>
                        {launchpad?.isGraduated ? (
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5" />
                            {content.panel.graduated}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            {content.panel.preGrad}
                          </span>
                        )}
                      </Badge>
                      {launchpad?.isGraduated && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider animate-pulse">
                          <Zap className="w-2.5 h-2.5" />
                          TickBook Live
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Trading Panel */}
                <SimpleTradingPanel
                  address={selectedMarket.contractAddress as `0x${string}`}
                  isGraduated={launchpad?.isGraduated}
                  isSettled={truth?.isSettled ?? false}
                />

                {/* Quick Links */}
                {launchpad?.isGraduated && (
                  <div className="flex items-center justify-end text-sm">
                    <Link
                      to={`/pro/${selectedMarket.contractAddress}`}
                      className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" />
                      {content.panel.goPro}
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <Card className="p-8 text-center">
                <TrendingUp className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400">{content.panel.selectToStart}</p>
              </Card>
            )}
          </div>

          {/* Right Column: LP & Stats */}
          <div className="lg:col-span-4 space-y-4">
            {/* Market Details & Stats */}
            {!isLoadingLaunchpad && selectedMarket && (
              <>
                <LPHolders marketAddress={selectedMarket.contractAddress as `0x${string}`} />
                <MarketStats marketAddress={selectedMarket.contractAddress as `0x${string}`} />
              </>
            )}

            {/* Educational Link */}
            <div className="text-center">
              <Link
                to="/about"
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {content.education}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Trade;

