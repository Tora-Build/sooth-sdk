/**
 * CreatorDashboard - Shows creator's LP position, fees, and graduation progress per V8_OPERATOR_CONSOLE_SPEC.md
 */
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Coins, TrendingUp, TrendingDown, BarChart3, GraduationCap, Shield, AlertTriangle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useLaunchpadMarketDirect, useAmmMarketDirect, useTruthMarketDirect } from '../../../hooks/v8';

interface CreatorDashboardProps {
  address: `0x${string}`;
}

const formatUSD = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatWad = (value: bigint): number => Number(value) / 1e18;
const formatUSDC = (value: bigint): number => Number(value) / 1e6;

export const CreatorDashboard = ({ address }: CreatorDashboardProps) => {
  const { address: userAddress } = useAccount();
  const { launchpad, isLoading: launchpadLoading } = useLaunchpadMarketDirect(address);
  const { amm, isLoading: ammLoading } = useAmmMarketDirect(address);
  const { truthMarket, isLoading: truthLoading } = useTruthMarketDirect(address);

  const isLoading = launchpadLoading || ammLoading || truthLoading;
  const isCreator = userAddress?.toLowerCase() === truthMarket?.creator?.toLowerCase();
  const isInitialized = launchpad && launchpad.initialBBase > 0n;

  // Don't show if not creator or not initialized
  if (!isCreator || !isInitialized) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <div className="p-4 animate-pulse space-y-3">
              <div className="h-4 bg-slate-700 rounded w-1/4" />
              <div className="h-6 bg-slate-700 rounded w-1/2" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Extract data - LP values are in WAD (18 decimals), amounts are in USDC (6 decimals)
  const lpTokens = formatWad(launchpad?.lpSupply ?? 0n);
  const totalSupply = lpTokens; // In this case creator has all LP tokens
  const share = 100; // Creator's share percentage
  const creatorDeposit = formatWad(launchpad?.creatorDeposit ?? 0n);
  const currentBBase = formatWad(launchpad?.currentBBase ?? 0n);
  const feesAccrued = formatWad(launchpad?.feesAccrued ?? 0n);
  const graduationThreshold = formatWad(launchpad?.graduationThreshold ?? 0n);
  const graduationProgress = launchpad?.graduationProgress ?? 0;
  const isGraduated = launchpad?.isGraduated ?? false;
  
  // Calculate positions
  const qYes = formatWad(amm?.qYes ?? 0n);
  const qNo = formatWad(amm?.qNo ?? 0n);
  const imbalance = Math.abs(qYes - qNo);
  const totalPositions = qYes + qNo;
  const imbalancePercent = totalPositions > 0 ? (imbalance / totalPositions) * 100 : 0;
  
  // Risk calculation
  const maxLoss = creatorDeposit;
  const currentExposure = Math.max(qYes, qNo) * 0.5; // Simplified exposure
  const safetyBuffer = maxLoss - currentExposure;
  const safetyPercent = maxLoss > 0 ? (safetyBuffer / maxLoss) * 100 : 100;
  
  // Risk level
  const riskLevel = safetyPercent > 50 ? 'low' : safetyPercent > 20 ? 'medium' : 'high';
  const riskConfig = {
    low: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: '🟢 Low' },
    medium: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: '🟡 Medium' },
    high: { color: 'text-rose-400', bg: 'bg-rose-500/20', label: '🔴 High' },
  };

  // Estimate PnL
  const honestFloor = creatorDeposit + (feesAccrued * 0.3); // 30% of fees to LP
  const unrealizedPnL = honestFloor - creatorDeposit;
  const pnlPercent = creatorDeposit > 0 ? (unrealizedPnL / creatorDeposit) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* LP Position Card */}
      <Card className="border-purple-500/30 bg-purple-500/5">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-white">Your LP Position</h3>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500">LP Tokens</p>
              <p className="font-mono text-lg text-white">{lpTokens.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Supply</p>
              <p className="font-mono text-lg text-white">{totalSupply.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Your Share</p>
              <p className="font-mono text-lg text-purple-400">{share.toFixed(1)}%</p>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-3 space-y-2">
            <p className="text-xs text-slate-500">Position Value</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500">Honest Floor</p>
                <p className="font-mono text-emerald-400">{formatUSD(honestFloor)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Initial Deposit</p>
                <p className="font-mono text-slate-300">{formatUSD(creatorDeposit)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Unrealized PnL</p>
                <p className={`font-mono ${unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {unrealizedPnL >= 0 ? '+' : ''}{formatUSD(unrealizedPnL)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Fees Earned Card */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white">Fees Earned</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Total Fees Collected</p>
              <p className="font-mono text-xl text-emerald-400">{formatUSD(feesAccrued)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Your Share ({share.toFixed(0)}%)</p>
              <p className="font-mono text-xl text-white">{formatUSD(feesAccrued * (share / 100))}</p>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-3">
            <p className="text-xs text-slate-500 mb-2">Fee Distribution</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-800/50 rounded p-2 text-center">
                <p className="text-xs text-slate-500">bBase Growth</p>
                <p className="text-sm text-cyan-400">50%</p>
              </div>
              <div className="flex-1 bg-slate-800/50 rounded p-2 text-center">
                <p className="text-xs text-slate-500">LP Yield</p>
                <p className="text-sm text-purple-400">30%</p>
              </div>
              <div className="flex-1 bg-slate-800/50 rounded p-2 text-center">
                <p className="text-xs text-slate-500">Protocol</p>
                <p className="text-sm text-slate-400">20%</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Graduation Progress Card */}
      <Card className={`border-${isGraduated ? 'emerald' : 'amber'}-500/30 bg-${isGraduated ? 'emerald' : 'amber'}-500/5`}>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">Graduation Progress</h3>
            </div>
            <Badge variant={isGraduated ? 'success' : 'warning'}>
              {isGraduated ? 'Graduated 🎓' : `Pre-Graduation`}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{graduationProgress.toFixed(0)}% Complete</span>
              <span>{formatUSD(feesAccrued)} / {formatUSD(graduationThreshold)}</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden bg-slate-700">
              <div 
                className={`h-full transition-all duration-500 ${
                  isGraduated 
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' 
                    : graduationProgress > 75 
                    ? 'bg-gradient-to-r from-amber-600 to-emerald-400'
                    : 'bg-gradient-to-r from-amber-600 to-amber-400'
                }`}
                style={{ width: `${Math.min(100, graduationProgress)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Current Fee Rate</p>
              <p className={`font-mono text-lg ${isGraduated ? 'text-emerald-400' : 'text-orange-400'}`}>
                {isGraduated ? '1.0%' : '5.0%'} 
                <span className="text-xs text-slate-500 ml-1">{isGraduated ? '(Post-Grad)' : '(Pre-Grad)'}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Remaining to Graduate</p>
              <p className="font-mono text-lg text-white">
                {formatUSD(Math.max(0, graduationThreshold - feesAccrued))}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Risk Metrics Card */}
      <Card className={`${riskConfig[riskLevel].bg} border-slate-700`}>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-white">Risk Metrics</h3>
            </div>
            <Badge variant={riskLevel === 'low' ? 'success' : riskLevel === 'medium' ? 'warning' : 'danger'}>
              {riskConfig[riskLevel].label}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500">Max Loss Exposure</p>
              <p className="font-mono text-rose-400">{formatUSD(maxLoss)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Current Exposure</p>
              <p className="font-mono text-amber-400">{formatUSD(currentExposure)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Safety Buffer</p>
              <p className="font-mono text-emerald-400">{formatUSD(safetyBuffer)} ({safetyPercent.toFixed(0)}%)</p>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-3">
            <p className="text-xs text-slate-500 mb-2">Market Imbalance</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-slate-400">YES:</span>
                <span className="font-mono text-sm text-emerald-400">{qYes.toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-rose-400" />
                <span className="text-xs text-slate-400">NO:</span>
                <span className="font-mono text-sm text-rose-400">{qNo.toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-slate-400">Imbalance:</span>
                <span className="font-mono text-sm text-amber-400">{imbalancePercent.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

