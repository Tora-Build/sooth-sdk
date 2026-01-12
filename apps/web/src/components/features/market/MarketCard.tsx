// MarketCard.tsx - Full AMM trading experience inline (V5 Launchpad style)
import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, TrendingUp, Zap, ArrowRight, BookOpen, Shield, Lock } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { useLaunchpadMarket } from '../../../hooks/useLaunchpadMarket';
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
  bBase?: bigint;
  graduationThreshold?: bigint;
}

export const MarketCard = ({ 
  address, 
  name, 
  symbol, 
  isGraduated, 
  deadline, 
  disableNavigation, 
  market: prefetchedMarket,
  bBase: propBBase,
  graduationThreshold: propGraduationThreshold
}: MarketCardProps) => {
  const { launchpad } = useLaunchpadMarket(
    (prefetchedMarket || propBBase) ? undefined : address
  );
  const hookBBase = launchpad?.initialBBase;
  const hookGraduationThreshold = launchpad?.graduationThreshold;
  const pureFloor = launchpad?.floorValue;
  const decimals = 18;
  const totalLockedProceeds = 0n;
  const adjudicator: string | undefined = undefined;
  const isSettled = false;
  const winningOutcome: number | null = null;
  const tStar: number | undefined = undefined;
  const { market: hookMarket } = useAmmMarketByAddress(prefetchedMarket ? undefined : address);
  
  const market = prefetchedMarket || hookMarket;
  const bBase = propBBase ?? hookBBase;
  const graduationThreshold = propGraduationThreshold ?? hookGraduationThreshold;

  const priceYes = market?.priceYes ?? 0.5;
  const priceNo = 1 - priceYes;

  const isExpired = deadline && Date.now() / 1000 > Number(deadline) && !isGraduated;

  const graduationProgress = bBase && graduationThreshold && graduationThreshold > 0n
    ? Math.min(100, Number((bBase * 100n) / graduationThreshold))
    : 0;

  // Use bParam from market object as fallback for liquidity display
  const effectiveB = bBase || (market?.bParam ? BigInt(market.bParam.toString()) : 0n);
  const liquidity = effectiveB ? Number(effectiveB) / 1e18 : 0;

  return (
    <Card className="group flex flex-col h-full p-5 hover:border-cyan-500/50 transition-all duration-300 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 pr-3">
          <Link
            to={`/trade/${address}`}
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
            {isSettled ? (
              <Badge className="text-xs bg-slate-500/20 text-slate-400 border-slate-500/50">
                ⚖️ Settled
              </Badge>
            ) : isGraduated ? (
              <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                ✓ Graduated
              </Badge>
            ) : isExpired ? (
              <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/50">
                Expired
              </Badge>
            ) : (
              <Badge className="text-xs bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
                ⚡ Bonding
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
                <span className="text-xs font-bold text-cyan-400 tabular-nums">
                  {graduationProgress.toFixed(0)}%
                </span>
              </div>
            </div>
          ) : isGraduated ? (
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
              <span className="text-lg">✓</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Inline Trading Panel */}
      <div className="pt-3 border-t border-slate-800">
        <AmmTradingPanel
          address={address}
          isGraduated={isGraduated}
          bParam={effectiveB}
          market={market}
        />
      </div>

      {/* Footer Stats & Navigation */}
      <div className="flex flex-col gap-3 pt-4 mt-4 border-t border-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-400" title="Liquidity Depth: LMSR parameter controlling price impact">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span className="font-mono">${(Number(effectiveB || 0n) / (10 ** 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400" title="Floor Equity: Guaranteed minimum LP value (worst-case)">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span className="font-mono">${(Number(pureFloor || 0n) / (10 ** (decimals || 18))).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400" title="Locked Proceeds: User funds in 24h cooling period">
              <Lock className="w-3 h-3 text-slate-400" />
              <span className="font-mono">${(Number(totalLockedProceeds || 0n) / (10 ** (decimals || 18))).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {!disableNavigation && (
            <Link
              to={`/trade/${address}`}
              className="text-xs font-bold text-cyan-400 hover:text-white flex items-center gap-1 transition-colors pl-2"
            >
              Details <ArrowRight size={10} />
            </Link>
          )}
        </div>
        
        {isSettled ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Shield className="w-3 h-3 text-slate-400" />
              <span>Winner: <span className={winningOutcome === 0 ? "text-emerald-400" : "text-rose-400"}>{winningOutcome === 0 ? 'YES' : 'NO'}</span></span>
            </div>
            {tStar && (
              <div className="text-xs text-slate-500 font-mono">
                T*: {new Date(tStar * 1000).toLocaleDateString()}
              </div>
            )}
          </div>
        ) : deadline && !isGraduated && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            <span>Deadline: {new Date(Number(deadline) * 1000).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </Card>
  );
};
