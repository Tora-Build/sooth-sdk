// MarketCard.tsx - Full AMM trading experience inline (V5 Launchpad style)
import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, TrendingUp, Zap, ArrowRight, BookOpen } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { useLaunchpadMarket } from '../../../hooks/v5/useLaunchpadMarket';
import { useAmmMarketByAddress } from '../../../hooks/useAmmMarketByAddress';
import { AmmTradingPanel } from './AmmTradingPanel';

interface MarketCardProps {
  address: `0x${string}`;
  name: string;
  symbol: string;
  isGraduated: boolean;
  deadline?: number;
  disableNavigation?: boolean;
  market?: any; // Optional pre-fetched market data
}

export const MarketCard = ({ address, name, symbol, isGraduated, deadline, disableNavigation, market: prefetchedMarket }: MarketCardProps) => {
  const { bBase, graduationThreshold } = useLaunchpadMarket(prefetchedMarket ? undefined : address);
  const { market: hookMarket } = useAmmMarketByAddress(prefetchedMarket ? undefined : address);
  const market = prefetchedMarket || hookMarket;

  const priceYes = market?.priceYes ?? 0.5;
  const priceNo = 1 - priceYes;

  const isExpired = deadline && Date.now() / 1000 > Number(deadline) && !isGraduated;

  const graduationProgress = bBase && graduationThreshold && graduationThreshold > 0n
    ? Math.min(100, Number((bBase * 100n) / graduationThreshold))
    : 0;

  const liquidity = bBase ? Number(bBase) / 1e18 : 0;

  return (
    <Card className="group flex flex-col h-full p-5 hover:border-cyan-500/50 transition-all duration-300 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 pr-3">
          <Link
            to={`/market/${address}`}
            className={`block transition-colors ${disableNavigation ? 'pointer-events-none' : 'group-hover:text-cyan-400'}`}
          >
            {name ? (
              <h3 className="font-bold text-white text-lg leading-tight line-clamp-2">
                {name}
              </h3>
            ) : (
              <div className="h-6 w-3/4 bg-slate-700/50 rounded" />
            )}
          </Link>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {symbol ? (
              <span className="font-mono text-xs text-slate-500">{symbol}</span>
            ) : (
              <div className="h-4 w-12 bg-slate-700/30 rounded" />
            )}
            {isGraduated ? (
              <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                🎓 Graduated
              </Badge>
            ) : isExpired ? (
              <Badge className="text-[10px] bg-red-500/20 text-red-400 border-red-500/50">
                ⏰ Expired
              </Badge>
            ) : (
              <Badge className="text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
                🔥 Bonding
              </Badge>
            )}
          </div>
        </div>

        {/* Top-right: Graduation Progress */}
        <div className="flex-shrink-0">
          {!isGraduated && !isExpired ? (
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-800" />
                <circle
                  cx="28" cy="28" r="24"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${graduationProgress * 1.51} 151`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-cyan-400 tabular-nums">
                  {graduationProgress.toFixed(0)}%
                </span>
              </div>
            </div>
          ) : isGraduated ? (
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
              <span className="text-lg">🎓</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Inline Trading Panel */}
      <div className="pt-3 border-t border-slate-800">
        <AmmTradingPanel
          address={address}
          isGraduated={isGraduated}
          bParam={bBase || 0n}
          market={market}
        />
      </div>

      {/* Footer Stats & Navigation */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Zap className="w-3 h-3 text-cyan-400" />
            <span className="font-mono">${liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          {deadline && !isGraduated && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              <span>{new Date(Number(deadline) * 1000).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {!disableNavigation && (
          <Link
            to={`/market/${address}`}
            className="text-xs font-bold text-cyan-400 hover:text-white flex items-center gap-1 transition-colors pl-2"
          >
            Details {isGraduated && '& Orders'} <ArrowRight size={12} />
          </Link>
        )}
      </div>
    </Card>
  );
};
