/**
 * MarketInitializationPanel - Allows creators to initialize market liquidity per V8_OPERATOR_CONSOLE_SPEC.md
 * 
 * Features: Liquidity tier selection, deposit calculation, initialize button
 */
import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Droplets, DollarSign, AlertTriangle, CheckCircle, ArrowRight, Info } from 'lucide-react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { useLaunchpadMarketDirect, useTruthMarketDirect } from '../../hooks';
import { useDeployments } from '../../hooks/useDeployments';
import { ABIS, ERC20_ABI } from '../../config/abis';
import { parseUnits } from 'viem';
import toast from 'react-hot-toast';

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
    description: 'Small, experimental markets',
  },
  {
    index: 1,
    label: 'Standard',
    bValue: 1000,
    deposit: 693.15,
    description: 'Most markets',
    recommended: true,
  },
  {
    index: 2,
    label: 'Premium',
    bValue: 10000,
    deposit: 6931.47,
    description: 'High-volume markets',
  },
];

const formatUSD = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

export const MarketInitializationPanel = ({ address }: MarketInitializationPanelProps) => {
  const { address: userAddress } = useAccount();
  const { launchpad, isLoading: launchpadLoading } = useLaunchpadMarketDirect(address);
  const { market: truthMarket, isLoading: truthLoading } = useTruthMarketDirect(address);

  const [selectedTier, setSelectedTier] = useState(1);
  const [isApproving, setIsApproving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const { writeContractAsync } = useWriteContract();
  const { config: deployments } = useDeployments();
  const publicClient = usePublicClient();

  const isLoading = launchpadLoading || truthLoading;
  const isCreator = userAddress?.toLowerCase() === truthMarket?.creator?.toLowerCase();
  const isInitialized = launchpad && launchpad.initialBBase > 0n;

  const tier = LIQUIDITY_TIERS[selectedTier];
  const preGradFee = Number(launchpad?.preGradFeeBps ?? 500n) / 100;
  const graduationMultiplier = Number(launchpad?.graduationMultiplier ?? 2n);
  const graduationThreshold = tier.bValue * graduationMultiplier;

  if (!isCreator || isInitialized) return null;

  const handleApprove = async () => {
    if (isApproving || !deployments.contracts.MockUSDC || !deployments.contracts.LaunchpadEngine) return;
    setIsApproving(true);
    const toastId = toast.loading('Approving USDC...');
    try {
      const depositWad = parseUnits(tier.deposit.toString(), 18);
      const hash = await writeContractAsync({
        address: deployments.contracts.MockUSDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [deployments.contracts.LaunchpadEngine as `0x${string}`, depositWad * 2n],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      setIsApproved(true);
      toast.success('Approved!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Approval failed', { id: toastId });
    } finally { setIsApproving(false); }
  };

  const handleInitialize = async () => {
    if (isInitializing || !deployments.contracts.LaunchpadEngine) return;
    setIsInitializing(true);
    const toastId = toast.loading('Initializing market...');
    try {
      const bWad = parseUnits(tier.bValue.toString(), 18);
      const hash = await writeContractAsync({
        address: deployments.contracts.LaunchpadEngine as `0x${string}`,
        abi: ABIS.LaunchpadEngine,
        functionName: 'createMarket',
        args: [address, bWad, truthMarket?.question || "Sooth Market", "SOOTH"],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      toast.success('Market initialized!', { id: toastId });
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error(err.message || 'Initialization failed', { id: toastId });
    } finally { setIsInitializing(false); }
  };

  if (isLoading) return <Card className="p-6 animate-pulse h-40 bg-slate-800/50" />;

  return (
    <Card className="border-cyan-500/30 bg-cyan-500/5 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Droplets className="w-6 h-6 text-cyan-400" />
        <div>
          <h3 className="text-xl font-bold text-white">Initialize Market Liquidity</h3>
          <p className="text-slate-400 text-sm">Select a liquidity tier to fund your market</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {LIQUIDITY_TIERS.map((t) => (
          <button
            key={t.index}
            onClick={() => setSelectedTier(t.index)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${selectedTier === t.index ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-slate-800/50'
              }`}
          >
            <div className="font-bold text-white">{t.label}</div>
            <div className="text-cyan-400 text-sm font-mono">${t.bValue}</div>
          </button>
        ))}
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Required Deposit</span>
          <span className="text-cyan-400 font-mono font-bold">{formatUSD(tier.deposit)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Graduation Target</span>
          <span className="text-white font-mono">{formatUSD(graduationThreshold)}</span>
        </div>
      </div>

      <div className="flex gap-3">
        {!isApproved ? (
          <Button variant="secondary" className="flex-1" onClick={handleApprove} disabled={isApproving}>
            {isApproving ? 'Approving...' : `Approve ${formatUSD(tier.deposit)} USDC`}
          </Button>
        ) : (
          <Button variant="primary" className="flex-1" onClick={handleInitialize} disabled={isInitializing}>
            {isInitializing ? 'Initializing...' : 'Initialize Market'}
          </Button>
        )}
      </div>
    </Card>
  );
};
