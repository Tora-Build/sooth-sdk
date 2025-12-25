// MarketCard.tsx - V8 Market Card with graduation progress
import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Zap, ArrowRight, Shield } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { useTruthMarket, useLaunchpadMarket, useAmmMarket } from '../../../hooks/v8';
import { SimpleTradingPanel } from './SimpleTradingPanel';

interface MarketCardProps {
  address: `0x${string}`;
  name: string;
  symbol: string;
  deadline?: number;
  disableNavigation?: boolean;
}

export const MarketCard = ({
  address,
  name,
  symbol,
  deadline,
  disableNavigation
}: MarketCardProps) => {
  const { market } = useTruthMarket(address);
  const { launchpad } = useLaunchpadMarket(address);
  const { amm } = useAmmMarket(address);

  const isGraduated = launchpad?.isGraduated ?? false;
  const isSettled = market?.isSettled ?? false;
  const isExpired = market?.isExpired ?? false;
  const graduationProgress = launchpad?.graduationProgress ?? 0;
  const bBase = launchpad?.currentBBase ?? 0n;

  const liquidity = Number(bBase) / 1e18;

  return (
    <Card data-testid="market-card" className="group flex flex-col h-full p-5 hover:border-cyan-500/50 transition-all duration-300 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 pr-3">
          <Link
            to={`/trade/${address}`}
            className={`block transition-colors ${disableNavigation ? 'pointer-events-none' : 'group-hover:text-cyan-400'}`}
          >
            <h3 className="font-bold text-white text-lg leading-tight line-clamp-2">
              {name}
            </h3>
          </Link>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="font-mono text-xs text-slate-500">{symbol}</span>
            {isSettled ? (
              <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/50">
                ⚖️ Settled
              </Badge>
            ) : isGraduated ? (
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

      {/* Trading Panel */}
      <div className="pt-3 border-t border-slate-800">
        <SimpleTradingPanel 
          address={address}
          isGraduated={isGraduated}
          isSettled={isSettled}
        />
      </div>

      {/* Footer Stats & Navigation */}
      <div className="flex flex-col gap-3 pt-4 mt-4 border-t border-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-[10px] text-slate-400" title="Liquidity Depth">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span className="font-mono">${liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400" title="Current Fee">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span className="font-mono">{((Number(launchpad?.currentFeeBps ?? 0n) / 100)).toFixed(1)}%</span>
            </div>
          </div>

          {!disableNavigation && (
            <Link
              to={`/trade/${address}`}
              className="text-[10px] font-bold text-cyan-400 hover:text-white flex items-center gap-1 transition-colors pl-2"
            >
              Details <ArrowRight size={10} />
            </Link>
          )}
        </div>

        {isSettled && market?.winningOutcome !== undefined ? (
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Shield className="w-3 h-3 text-amber-400" />
            <span>Winner: <span className={market.winningOutcome === 1 ? "text-emerald-400" : "text-rose-400"}>{market.winningOutcome === 1 ? 'YES' : 'NO'}</span></span>
          </div>
        ) : deadline && !isGraduated && (
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Clock className="w-3 h-3" />
            <span>Deadline: {new Date(Number(deadline) * 1000).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </Card>
  );
};
