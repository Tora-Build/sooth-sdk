/**
 * AMMStatsCard - Displays AMM market statistics per V8_AMM_TRADING_SPEC.md
 * 
 * Shows: Liquidity, YES/NO quantities, current price, fee rate, graduation status
 */
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { TrendingUp, TrendingDown, Droplets, BarChart3, Percent, GraduationCap } from 'lucide-react';
import { useLaunchpadMarketDirect, useAmmMarketDirect } from '../../hooks';

interface AMMStatsCardProps {
  address: `0x${string}`;
}

// Format WAD values to display format
const formatWad = (value: bigint, decimals: number = 2): string => {
  const num = Number(value) / 1e18;
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

// Format WAD amounts to USD (18 decimals)
const formatWadUSD = (value: bigint): string => {
  const num = Number(value) / 1e18;
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}k`;
  }
  return `$${num.toFixed(2)}`;
};

// Format percentage from WAD
const formatPercent = (value: bigint): string => {
  const pct = Number(value) / 1e18 * 100;
  return `${pct.toFixed(1)}%`;
};

export const AMMStatsCard = ({ address }: AMMStatsCardProps) => {
  const { launchpad, isLoading: launchpadLoading } = useLaunchpadMarketDirect(address);
  const { amm, isLoading: ammLoading } = useAmmMarketDirect(address);

  const isLoading = launchpadLoading || ammLoading;

  if (isLoading) {
    return (
      <Card>
        <div className="p-4 animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-1/3 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-slate-700 rounded w-1/2" />
                <div className="h-5 bg-slate-700 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const currentBBase = launchpad?.currentBBase ?? 0n;
  const qYes = amm?.qYes ?? 0n;
  const qNo = amm?.qNo ?? 0n;
  const yesPrice = amm?.yesPrice ?? 500000000000000000n; // 0.5
  const totalPositions = qYes + qNo;
  const isGraduated = launchpad?.isGraduated ?? false;
  const currentFeeBps = launchpad?.currentFeeBps ?? 500n;
  const feePercent = Number(currentFeeBps) / 100;

  return (
    <Card>
      <div className="p-4 space-y-4">
        {/* Header with Graduation Badge */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            AMM Stats
          </h3>
          {isGraduated ? (
            <Badge variant="success" className="flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              Graduated (1% fee)
            </Badge>
          ) : (
            <Badge variant="warning" className="flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              Bonding ({feePercent}% fee)
            </Badge>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Liquidity */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              Liquidity Depth (b)
            </div>
            <div className="text-lg font-bold text-cyan-400">
              {formatWad(currentBBase)}
            </div>
          </div>

          {/* YES Quantity */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              YES Quantity
            </div>
            <div className="text-lg font-bold text-emerald-400">
              {formatWad(qYes, 0)}
            </div>
          </div>

          {/* NO Quantity */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              NO Quantity
            </div>
            <div className="text-lg font-bold text-rose-400">
              {formatWad(qNo, 0)}
            </div>
          </div>

          {/* Current Price */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Percent className="w-3.5 h-3.5 text-purple-400" />
              Current Price
            </div>
            <div className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {formatPercent(yesPrice)}
            </div>
          </div>

          {/* Total Positions */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
              Total Positions
            </div>
            <div className="text-lg font-bold text-white">
              {formatWad(totalPositions, 0)}
            </div>
          </div>

          {/* Current Fee */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="text-xs">💰</span>
              Current Fee
            </div>
            <div className={`text-lg font-bold ${isGraduated ? 'text-emerald-400' : 'text-orange-400'}`}>
              {feePercent}%
            </div>
          </div>
        </div>

        {/* Probability Bar */}
        <div className="pt-2">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>YES {formatPercent(yesPrice)}</span>
            <span>NO {formatPercent(amm?.noPrice ?? 500000000000000000n)}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${Number(yesPrice) / 1e16}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

