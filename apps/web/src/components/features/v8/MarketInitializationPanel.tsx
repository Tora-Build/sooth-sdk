/**
 * MarketInitializationPanel - Allows creators to initialize market liquidity per V8_OPERATOR_CONSOLE_SPEC.md
 * 
 * Features: Liquidity tier selection, deposit calculation, initialize button
 */
import { useState } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Droplets, DollarSign, AlertTriangle, CheckCircle, ArrowRight, Info } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useLaunchpadMarketDirect, useTruthMarketDirect } from '../../../hooks/v8';

interface MarketInitializationPanelProps {
  address: `0x${string}`;
}

// Liquidity tiers per spec
const LIQUIDITY_TIERS = [
  { 
    index: 0, 
    label: 'Starter', 
    bValue: 100, 
    deposit: 69.31, 
    maxLoss: 69.31,
    description: 'Small, experimental markets',
  },
  { 
    index: 1, 
    label: 'Standard', 
    bValue: 1000, 
    deposit: 693.15, 
    maxLoss: 693.15,
    description: 'Most markets',
    recommended: true,
  },
  { 
    index: 2, 
    label: 'Premium', 
    bValue: 10000, 
    deposit: 6931.47, 
    maxLoss: 6931.47,
    description: 'High-volume markets',
  },
  { 
    index: 3, 
    label: 'Enterprise', 
    bValue: 100000, 
    deposit: 69314.72, 
    maxLoss: 69314.72,
    description: 'Institutional markets',
  },
];

// ln(2) ≈ 0.693147
const LN2 = 0.693147;

const formatUSD = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const MarketInitializationPanel = ({ address }: MarketInitializationPanelProps) => {
  const { address: userAddress, isConnected } = useAccount();
  const { launchpad, isLoading: launchpadLoading } = useLaunchpadMarketDirect(address);
  const { market: truthMarket, isLoading: truthLoading } = useTruthMarketDirect(address);
  
  const [selectedTier, setSelectedTier] = useState(1); // Default to Standard
  const [isApproving, setIsApproving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const isLoading = launchpadLoading || truthLoading;
  const isCreator = userAddress?.toLowerCase() === truthMarket?.creator?.toLowerCase();
  const isInitialized = launchpad && launchpad.initialBBase > 0n;
  
  // Don't show if not creator or already initialized
  if (!isCreator || isInitialized) {
    return null;
  }

  const tier = LIQUIDITY_TIERS[selectedTier];
  const preGradFee = Number(launchpad?.preGradFeeBps ?? 500n) / 100;
  const postGradFee = Number(launchpad?.postGradFeeBps ?? 100n) / 100;
  const lpYieldShare = 30; // 30% per spec
  const graduationMultiplier = Number(launchpad?.graduationMultiplier ?? 2n);
  const graduationThreshold = tier.bValue * graduationMultiplier;

  const handleApprove = async () => {
    setIsApproving(true);
    // TODO: Implement USDC approval to LaunchpadEngine
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulated delay
    setIsApproved(true);
    setIsApproving(false);
  };

  const handleInitialize = async () => {
    setIsInitializing(true);
    // TODO: Implement LaunchpadEngine.initializeMarket(market, b)
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulated delay
    setIsInitializing(false);
  };

  if (isLoading) {
    return (
      <Card>
        <div className="p-6 animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3" />
          <div className="h-24 bg-slate-700 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-cyan-500/30 bg-cyan-500/5">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/20">
            <Droplets className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Initialize Market Liquidity</h3>
            <p className="text-slate-400 text-sm">Select a liquidity tier to fund your market</p>
          </div>
        </div>

        {/* Tier Selection */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400">Select Liquidity Tier</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {LIQUIDITY_TIERS.map((t) => (
              <button
                key={t.index}
                onClick={() => setSelectedTier(t.index)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                  selectedTier === t.index
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                {t.recommended && (
                  <Badge variant="success" className="absolute top-2 right-2 text-[10px]">
                    Recommended
                  </Badge>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-white">{t.label}</span>
                  <span className="text-cyan-400 font-mono">(${t.bValue.toLocaleString()})</span>
                </div>
                <div className="text-sm text-slate-400 space-y-1">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    <span>Deposit: {formatUSD(t.deposit)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Max Loss: {formatUSD(t.maxLoss)}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">Best for: {t.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Deposit Summary */}
        <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400" />
            Deposit Summary
          </h4>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Liquidity Parameter (b)</p>
              <p className="font-mono text-white">{formatUSD(tier.bValue)}</p>
            </div>
            <div>
              <p className="text-slate-500">Required Deposit</p>
              <p className="font-mono text-cyan-400 font-bold">{formatUSD(tier.deposit)}</p>
            </div>
            <div>
              <p className="text-slate-500">Liquidity Leverage</p>
              <p className="font-mono text-white">{(tier.bValue / tier.deposit).toFixed(2)}×</p>
            </div>
            <div>
              <p className="text-slate-500">Max Loss</p>
              <p className="font-mono text-rose-400">{formatUSD(tier.maxLoss)}</p>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-3 mt-3">
            <p className="text-slate-500 text-sm mb-2">Your Potential Earnings</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Pre-Grad Fee</p>
                <p className="text-orange-400">{preGradFee}%</p>
              </div>
              <div>
                <p className="text-slate-500">Post-Grad Fee</p>
                <p className="text-emerald-400">{postGradFee}%</p>
              </div>
              <div>
                <p className="text-slate-500">LP Share</p>
                <p className="text-purple-400">{lpYieldShare}%</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-slate-500">Graduation Target</p>
              <p className="font-mono text-white">
                {formatUSD(graduationThreshold)} 
                <span className="text-slate-500 text-xs ml-1">({graduationMultiplier}× bBase)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-amber-200 font-medium">Risk Notice</p>
            <p className="text-amber-200/70 text-xs mt-0.5">
              If all traders pick the same outcome, you could lose your entire deposit ({formatUSD(tier.deposit)}).
              Fee earnings help offset this risk.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isApproved ? (
            <Button 
              variant="secondary"
              className="flex-1"
              onClick={handleApprove}
              disabled={isApproving}
            >
              {isApproving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Approving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Approve {formatUSD(tier.deposit)} USDC
                </span>
              )}
            </Button>
          ) : (
            <Button 
              variant="primary"
              className="flex-1"
              onClick={handleInitialize}
              disabled={isInitializing}
            >
              {isInitializing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Initializing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  Initialize Market
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

