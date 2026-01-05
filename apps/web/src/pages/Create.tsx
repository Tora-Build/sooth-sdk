/**
 * Create Page - Creator + Adjudicator Dashboard
 * 
 * Unified dashboard for market creators and adjudicators to manage market lifecycle.
 * Features: My Markets, Pending Settlements, Create New Market wizard
 */
import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusCircle, Coins, Scale, GraduationCap, Clock,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  ExternalLink, ChevronRight, Calendar, DollarSign, Loader2
} from 'lucide-react';
import { useAccount, useChainId, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useReadContract, useConfig } from 'wagmi';
import { maxUint256 } from 'viem';
import { deployContract } from 'wagmi/actions';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { InfoTooltip } from '../components/ui/Tooltip';
import { CreatorDashboard } from '../components/features/CreatorDashboard';
import { SettlementPanel } from '../components/features/SettlementPanel';
import { GraduationProgress } from '../components/features/launchpad/GraduationProgress';
import { useTruthMarketDirect, useLaunchpadMarketDirect, useAmmMarketDirect } from '../hooks';
import { useDeployments } from '../hooks/useDeployments';
import { ABIS, ERC20_ABI } from '../config/abis';
import { TRUTH_MARKET_BYTECODE } from '../config/bytecode';
import marketsConfigRaw from '../config/markets.json';
import uiContent from '../config/ui-content.json';
import { MarketConfig, MarketsConfigJson } from '../types';

const marketsConfig = marketsConfigRaw as MarketsConfigJson;
import toast from 'react-hot-toast';

const { create: content } = uiContent;

// Tabs
type Tab = 'markets' | 'settlements' | 'create';

interface CreatorMarketCardProps {
  market: MarketConfig;
  userAddress?: string;
  isCreator: boolean;
  isAdjudicator: boolean;
}

const CreatorMarketCard: React.FC<CreatorMarketCardProps> = ({ market, userAddress, isCreator, isAdjudicator }) => {
  const { market: truthMarket, isLoading: truthLoading } = useTruthMarketDirect(market.contractAddress as `0x${string}`);
  const { launchpad, isLoading: launchpadLoading } = useLaunchpadMarketDirect(market.contractAddress as `0x${string}`);
  const { amm } = useAmmMarketDirect(market.contractAddress as `0x${string}`);

  const isLoading = truthLoading || launchpadLoading;

  if (!isCreator && !isAdjudicator) return null;

  const isGraduated = launchpad?.isGraduated ?? false;
  const graduationProgress = launchpad?.graduationProgress ?? 0;
  const feesAccrued = Number(launchpad?.feesAccrued ?? 0n) / 1e18;
  const lpTokens = Number(launchpad?.lpSupply ?? 0n) / 1e18;
  const isSettled = truthMarket?.isSettled ?? false;
  const isLive = truthMarket?.isLive ?? true;

  // Status
  let status: 'live' | 'graduated' | 'settling' | 'settled' = 'live';
  let statusColor = 'bg-emerald-500';
  if (isSettled) {
    status = 'settled';
    statusColor = 'bg-slate-500';
  } else if (!isLive) {
    status = 'settling';
    statusColor = 'bg-amber-500';
  } else if (isGraduated) {
    status = 'graduated';
    statusColor = 'bg-indigo-500';
  }

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <div className="p-4 space-y-3">
          <div className="h-5 bg-slate-700 rounded w-3/4" />
          <div className="h-4 bg-slate-700 rounded w-1/2" />
          <div className="h-8 bg-slate-700 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="hover:border-slate-600 transition-colors">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white">{market.symbol}</h3>
              {isCreator && (
                <Badge variant="outline" className="text-purple-400 border-purple-400/30">
                  Creator
                </Badge>
              )}
              {isAdjudicator && (
                <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                  Adjudicator
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">{market.name}</p>
          </div>
          <Badge className={`${statusColor} text-white capitalize`}>
            {status}
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-slate-800/50 rounded-lg p-2">
            <p className="text-[10px] text-slate-500 uppercase">LP Tokens</p>
            <p className="text-sm font-mono text-white">{lpTokens.toFixed(0)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2">
            <p className="text-[10px] text-slate-500 uppercase">Fees</p>
            <p className="text-sm font-mono text-emerald-400">${feesAccrued.toFixed(2)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2">
            <p className="text-[10px] text-slate-500 uppercase">Price</p>
            <p className="text-sm font-mono text-white">
              {((amm?.yesProbability ?? 0.5) * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Graduation Progress */}
        {!isSettled && (
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Graduation</span>
              <span>{isGraduated ? '100' : graduationProgress.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
                style={{ width: `${isGraduated ? 100 : Math.min(100, graduationProgress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Link to={`/trade/${market.contractAddress}`} className="flex-1">
            <Button variant="secondary" size="sm" className="w-full">
              View Market
            </Button>
          </Link>
          <Link to={`/create`} className="flex-1">
            <Button variant="primary" size="sm" className="w-full">
              Manage
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
};

// Settlement card for adjudicator view
interface SettlementCardProps {
  market: MarketConfig;
  userAddress?: string;
}

const SettlementCard: React.FC<SettlementCardProps> = ({ market, userAddress }) => {
  const { market: truthMarket, isLoading } = useTruthMarketDirect(market.contractAddress as `0x${string}`);
  const { amm } = useAmmMarketDirect(market.contractAddress as `0x${string}`);

  const isAdjudicator = userAddress?.toLowerCase() === truthMarket?.adjudicator?.toLowerCase();
  const isSettled = truthMarket?.isSettled ?? false;
  const isLive = truthMarket?.isLive ?? true;
  const deadline = truthMarket?.deadline;

  // Only show if user is adjudicator and market needs settlement
  if (!isAdjudicator || isSettled) return null;

  const deadlinePassed = deadline ? Date.now() / 1000 > Number(deadline) : false;
  const yesPrice = amm?.yesProbability ?? 0.5;
  const noPrice = amm?.noProbability ?? 0.5;

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <div className="p-4 space-y-3">
          <div className="h-5 bg-slate-700 rounded w-3/4" />
          <div className="h-4 bg-slate-700 rounded w-1/2" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50 transition-colors">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-white">{market.name}</h3>
            <p className="text-sm text-slate-400 mt-1">{market.description}</p>
          </div>
          <Badge variant={deadlinePassed ? 'warning' : 'default'}>
            {deadlinePassed ? 'Awaiting Settlement' : 'Live'}
          </Badge>
        </div>

        {/* Deadline */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-slate-500" />
          <span className="text-slate-400">
            Deadline: {deadline ? new Date(Number(deadline) * 1000).toLocaleString() : 'N/A'}
          </span>
          {deadlinePassed && (
            <Badge variant="warning" className="text-xs">
              Passed {Math.floor((Date.now() / 1000 - Number(deadline)) / 86400)} days ago
            </Badge>
          )}
        </div>

        {/* Current Price */}
        <div className="flex gap-4">
          <div className="flex-1 p-2 rounded-lg bg-emerald-500/10 text-center">
            <p className="text-xs text-emerald-400">YES</p>
            <p className="text-lg font-bold text-emerald-400">{(yesPrice * 100).toFixed(1)}%</p>
          </div>
          <div className="flex-1 p-2 rounded-lg bg-rose-500/10 text-center">
            <p className="text-xs text-rose-400">NO</p>
            <p className="text-lg font-bold text-rose-400">{(noPrice * 100).toFixed(1)}%</p>
          </div>
        </div>

        {/* Settle Button */}
        <Link to={`/create`}>
          <Button variant="primary" className="w-full bg-blue-600 hover:bg-blue-500">
            <Scale className="w-4 h-4 mr-2" />
            Settle Outcome
          </Button>
        </Link>
      </div>
    </Card>
  );
};

// Market Creation Wizard Step
interface WizardStepProps {
  step: number;
  currentStep: number;
  title: string;
  children: React.ReactNode;
}

const WizardStep: React.FC<WizardStepProps> = ({ step, currentStep, title, children }) => {
  if (step !== currentStep) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      <h3 className="text-lg font-bold text-white">{title}</h3>
      {children}
    </div>
  );
};

export const Create = () => {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const config = useConfig();
  const navigate = useNavigate();
  const deployments = useDeployments();

  const [activeTab, setActiveTab] = useState<Tab>('markets');
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    question: '',
    deadline: '',
    liquidity: '1000',
    adjudicator: '',
    guardian: '',
  });

  // Deployment state
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedMarketAddress, setDeployedMarketAddress] = useState<`0x${string}` | null>(null);
  const [deploymentStep, setDeploymentStep] = useState<'idle' | 'approve' | 'deploying' | 'creating' | 'done' | 'error'>('idle');

  // Contract addresses
  const launchpadEngineAddress = deployments?.contracts?.LaunchpadEngine as `0x${string}`;
  const usdcAddress = deployments?.contracts?.MockUSDC as `0x${string}`;

  // USDC allowance check
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress && launchpadEngineAddress ? [userAddress, launchpadEngineAddress] : undefined,
    query: { enabled: !!userAddress && !!launchpadEngineAddress && !!usdcAddress }
  });

  // Approve USDC
  const { writeContract: writeApprove, data: approveTxHash, isPending: isApprovePending } = useWriteContract();
  const { isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });

  // Create market
  const { writeContract: writeCreate, data: createTxHash, isPending: isCreatePending } = useWriteContract();
  const { isSuccess: isCreateConfirmed } = useWaitForTransactionReceipt({ hash: createTxHash });

  // Calculate deposit based on liquidity (b)
  const depositAmount = Math.floor(parseInt(wizardData.liquidity) * 0.693);
  const depositAmountWei = BigInt(depositAmount) * 10n ** 18n;
  const isApproved = typeof allowance === 'bigint' && allowance >= depositAmountWei;

  // Handle deploy market
  const handleDeployMarket = useCallback(async () => {
    if (!wizardData.question || !wizardData.deadline || !launchpadEngineAddress) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsDeploying(true);

      // Step 1: Check/request approval if needed
      if (!isApproved) {
        setDeploymentStep('approve');
        writeApprove({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [launchpadEngineAddress, maxUint256]
        });
        toast('Approving USDC...');
        return; // Will continue after approval confirmed
      }

      // Step 2: Deploy TruthMarket
      setDeploymentStep('deploying');
      toast('Deploying TruthMarket contract...');

      const deadline = Math.floor(new Date(wizardData.deadline).getTime() / 1000);
      const adjudicatorAddr = (wizardData.adjudicator || userAddress!) as `0x${string}`;
      const guardianAddr = (wizardData.guardian || userAddress!) as `0x${string}`;

      const truthMarketAddr = await deployContract(config, {
        abi: ABIS.TruthMarket,
        bytecode: TRUTH_MARKET_BYTECODE as `0x${string}`,
        args: [wizardData.question, BigInt(deadline), adjudicatorAddr, guardianAddr],
      });

      toast.success(`TruthMarket deployed: ${truthMarketAddr.slice(0, 10)}...`);

      // Step 3: Create in LaunchpadEngine
      setDeploymentStep('creating');
      toast('Initializing in LaunchpadEngine...');

      const liquidityWei = BigInt(wizardData.liquidity) * 10n ** 18n;
      writeCreate({
        address: launchpadEngineAddress,
        abi: ABIS.LaunchpadEngine,
        functionName: 'createMarket',
        args: [truthMarketAddr, liquidityWei, wizardData.question.slice(0, 50), wizardData.question.slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '')],
      });

      setDeployedMarketAddress(truthMarketAddr);

    } catch (err: any) {
      console.error('Deployment failed:', err);
      toast.error(err.message || 'Deployment failed');
      setDeploymentStep('error');
      setIsDeploying(false);
    }
  }, [wizardData, launchpadEngineAddress, usdcAddress, userAddress, isApproved, config, writeApprove, writeCreate]);

  // Continue deployment after approval
  const handleContinueAfterApproval = useCallback(async () => {
    await refetchAllowance();
    setDeploymentStep('idle');
    handleDeployMarket();
  }, [refetchAllowance, handleDeployMarket]);

  // Handle successful create
  if (isCreateConfirmed && deployedMarketAddress && deploymentStep === 'creating') {
    setDeploymentStep('done');
    setIsDeploying(false);
    toast.success('Market created successfully!');
  }

  // Filter V8 markets for current chain
  const v8Markets = useMemo(() => {
    return marketsConfig.markets.filter(m =>
      m.version?.startsWith('v') && m.chainId === chainId
    );
  }, [chainId]);

  // Batch fetch roles for all markets
  const { data: rolesData, isLoading: rolesLoading } = useReadContracts({
    contracts: v8Markets.flatMap(m => [
      {
        address: m.contractAddress as `0x${string}`,
        abi: ABIS.TruthMarket,
        functionName: 'creator',
      },
      {
        address: m.contractAddress as `0x${string}`,
        abi: ABIS.TruthMarket,
        functionName: 'adjudicator',
      },
    ]),
    query: {
      enabled: !!userAddress && v8Markets.length > 0,
    }
  });

  // Process roles data
  const marketRoles = useMemo(() => {
    if (!rolesData || !userAddress) return [];

    return v8Markets.map((m, i) => {
      const creator = rolesData[i * 2]?.result as string;
      const adjudicator = rolesData[i * 2 + 1]?.result as string;

      const isCreator = creator?.toLowerCase() === userAddress.toLowerCase();
      const isAdjudicator = adjudicator?.toLowerCase() === userAddress.toLowerCase();

      return {
        ...m,
        isCreator,
        isAdjudicator,
        hasRole: isCreator || isAdjudicator
      };
    });
  }, [v8Markets, rolesData, userAddress]);

  // Filter markets where user is creator or adjudicator
  const userMarkets = useMemo(() => {
    return marketRoles.filter(m => m.hasRole);
  }, [marketRoles]);

  // Count user's roles
  const roleCount = useMemo(() => {
    let creator = 0;
    let adjudicator = 0;
    marketRoles.forEach(m => {
      if (m.isCreator) creator++;
      if (m.isAdjudicator) adjudicator++;
    });
    return { creator, adjudicator };
  }, [marketRoles]);

  const tabs = [
    { id: 'markets' as Tab, label: 'My Markets', icon: Coins },
    { id: 'settlements' as Tab, label: 'Pending Settlements', icon: Scale },
    { id: 'create' as Tab, label: '+ Create New', icon: PlusCircle },
  ];

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md text-center p-8">
          <Coins className="w-12 h-12 mx-auto text-purple-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{content.connectWallet.title}</h2>
          <p className="text-slate-400 mb-6">
            {content.connectWallet.description}
          </p>
          <Button variant="primary">Connect Wallet</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">{content.header.title}</h1>
          <p className="text-slate-400 text-sm">{content.header.subtitle}</p>
        </div>

        {/* Role Indicator */}
        <Card className="mb-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">{content.roles.creator}</span>
                <Badge variant="outline" className="text-purple-400">
                  {roleCount.creator} markets
                </Badge>
              </div>
              <div className="w-px h-6 bg-slate-700" />
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-400" />
                <span className="text-white font-medium">{content.roles.adjudicator}</span>
                <Badge variant="outline" className="text-blue-400">
                  {roleCount.adjudicator} markets
                </Badge>
              </div>
            </div>
            <InfoTooltip type="lpToken" position="left">
              <span className="text-xs text-slate-500 cursor-help">{content.roles.lpTooltip}</span>
            </InfoTooltip>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === tab.id
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{content.tabs[tab.id as keyof typeof content.tabs]}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'markets' && (
          <div className="space-y-4">
            {rolesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <Card key={i} className="animate-pulse">
                    <div className="p-4 space-y-3">
                      <div className="h-5 bg-slate-700 rounded w-3/4" />
                      <div className="h-4 bg-slate-700 rounded w-1/2" />
                      <div className="h-8 bg-slate-700 rounded" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : userMarkets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userMarkets.map(market => (
                  <CreatorMarketCard
                    key={market.id}
                    market={market}
                    userAddress={userAddress}
                    isCreator={market.isCreator}
                    isAdjudicator={market.isAdjudicator}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <Coins className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">{content.emptyMarkets.title}</h3>
                <p className="text-slate-400 mb-6">
                  {content.emptyMarkets.description}
                </p>
                <Button
                  variant="primary"
                  onClick={() => setActiveTab('create')}
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  {content.emptyMarkets.button}
                </Button>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'settlements' && (
          <div className="space-y-4">
            {rolesLoading ? (
              <Card className="animate-pulse p-4 h-32" />
            ) : userMarkets.some(m => m.isAdjudicator) ? (
              userMarkets.filter(m => m.isAdjudicator).map(market => (
                <SettlementCard
                  key={market.id}
                  market={market}
                  userAddress={userAddress}
                />
              ))
            ) : (
              <Card className="p-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">{content.emptySettlements.title}</h3>
                <p className="text-slate-400">
                  {content.emptySettlements.description}
                </p>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <Card>
            <div className="p-6">
              {/* Progress Steps */}
              <div className="flex items-center justify-between mb-8">
                {[1, 2, 3, 4].map(step => (
                  <div key={step} className="flex items-center">
                    <div className={`progress-step ${step < wizardStep ? 'completed' :
                        step === wizardStep ? 'current' : 'pending'
                      }`} />
                    {step < 4 && (
                      <div className={`w-16 h-0.5 ${step < wizardStep ? 'bg-indigo-500' : 'bg-slate-700'
                        }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Step 1: Question */}
              <WizardStep step={1} currentStep={wizardStep} title={content.wizard.steps.q}>
                <p className="text-slate-400 text-sm mb-4">
                  {content.wizard.q.description}
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{content.wizard.q.label}</label>
                    <input
                      type="text"
                      placeholder={content.wizard.q.placeholder}
                      value={wizardData.question}
                      onChange={(e) => setWizardData(prev => ({ ...prev, question: e.target.value }))}
                      className="input-field"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {wizardData.question.length}/200 characters
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      {content.wizard.q.deadline}
                    </label>
                    <input
                      type="datetime-local"
                      value={wizardData.deadline}
                      onChange={(e) => setWizardData(prev => ({ ...prev, deadline: e.target.value }))}
                      className="input-field"
                      min={new Date(Date.now() + 86400000).toISOString().slice(0, 16)}
                    />
                  </div>
                </div>
              </WizardStep>

              {/* Step 2: Liquidity */}
              <WizardStep step={2} currentStep={wizardStep} title={content.wizard.steps.l}>
                <p className="text-slate-400 text-sm mb-4">
                  {content.wizard.l.description}
                </p>

                {/* Fixed tier buttons - deposit amounts with b shown as secondary */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { b: '100', tier: 'Micro' },
                    { b: '1000', tier: 'Starter' },
                    { b: '10000', tier: 'Premium' },
                  ].map(({ b, tier }) => {
                    const deposit = Math.floor(parseInt(b) * 0.693);
                    const isSelected = wizardData.liquidity === b;
                    return (
                      <button
                        key={b}
                        onClick={() => setWizardData(prev => ({ ...prev, liquidity: b }))}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${isSelected
                            ? 'border-indigo-500 bg-indigo-500/20'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                          }`}
                      >
                        <DollarSign className={`w-6 h-6 mx-auto mb-2 ${isSelected ? 'text-indigo-400' : 'text-slate-500'
                          }`} />
                        <p className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-slate-400'
                          }`}>
                          ${deposit.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {tier}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Custom deposit input - user enters deposit, we calculate b */}
                <div className="p-4 rounded-xl border-2 border-slate-700 bg-slate-800/30">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm whitespace-nowrap">Custom deposit:</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                      <input
                        type="number"
                        value={Math.floor(parseInt(wizardData.liquidity || '0') * 0.693) || ''}
                        onChange={(e) => {
                          // Convert deposit to b: b = deposit / ln(2)
                          const deposit = parseInt(e.target.value) || 0;
                          const b = Math.ceil(deposit / 0.693);
                          setWizardData(prev => ({ ...prev, liquidity: String(b || 100) }));
                        }}
                        placeholder="Enter deposit"
                        min="7"
                        max="700000"
                        className="w-full pl-7 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <span className="text-slate-500 text-sm whitespace-nowrap">
                      → b = ${parseInt(wizardData.liquidity || '0').toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400 inline mr-2" />
                  <span className="text-amber-200">
                    Deposit = Max loss: <strong>${Math.floor(parseInt(wizardData.liquidity || '0') * 0.693).toLocaleString()}</strong>
                    <span className="text-slate-400 ml-2">• Liquidity depth (b): ${parseInt(wizardData.liquidity || '0').toLocaleString()}</span>
                  </span>
                </div>
              </WizardStep>

              {/* Step 3: Roles */}
              <WizardStep step={3} currentStep={wizardStep} title={content.wizard.steps.r}>
                <p className="text-slate-400 text-sm mb-4">
                  {content.wizard.r.description}
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      <Scale className="w-4 h-4 inline mr-1" />
                      {content.wizard.r.adjLabel}
                    </label>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={wizardData.adjudicator}
                      onChange={(e) => setWizardData(prev => ({ ...prev, adjudicator: e.target.value }))}
                      className="input-field font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {content.wizard.r.adjDesc}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      {content.wizard.r.guardLabel}
                    </label>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={wizardData.guardian}
                      onChange={(e) => setWizardData(prev => ({ ...prev, guardian: e.target.value }))}
                      className="input-field font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {content.wizard.r.guardDesc}
                    </p>
                  </div>
                </div>
              </WizardStep>

              {/* Step 4: Review */}
              <WizardStep step={4} currentStep={wizardStep} title={content.wizard.steps.review}>
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Question</span>
                    <span className="text-white text-right max-w-xs truncate">{wizardData.question || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Deadline</span>
                    <span className="text-white">
                      {wizardData.deadline ? new Date(wizardData.deadline).toLocaleString() : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Deposit</span>
                    <span className="text-white">${Math.floor(parseInt(wizardData.liquidity) * 0.693).toLocaleString()} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Liquidity (b)</span>
                    <span className="text-slate-300">${parseInt(wizardData.liquidity).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Adjudicator</span>
                    <span className="text-white font-mono text-sm">
                      {wizardData.adjudicator ? `${wizardData.adjudicator.slice(0, 6)}...${wizardData.adjudicator.slice(-4)}` : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Guardian</span>
                    <span className="text-white font-mono text-sm">
                      {wizardData.guardian ? `${wizardData.guardian.slice(0, 6)}...${wizardData.guardian.slice(-4)}` : 'Not set'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-200">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  {content.wizard.review.transactionDesc}
                </div>

                {/* Validation warnings */}
                {(!wizardData.question || !wizardData.deadline || !launchpadEngineAddress || !usdcAddress) && (
                  <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    {!wizardData.question && <span className="block">• Question is required</span>}
                    {!wizardData.deadline && <span className="block">• Deadline is required</span>}
                    {!launchpadEngineAddress && <span className="block">• LaunchpadEngine not deployed on this chain</span>}
                    {!usdcAddress && <span className="block">• USDC not configured for this chain</span>}
                  </div>
                )}
              </WizardStep>

              {/* Navigation */}
              <div className="flex justify-between mt-8 pt-6 border-t border-slate-800">
                <Button
                  variant="secondary"
                  onClick={() => setWizardStep(prev => Math.max(1, prev - 1))}
                  disabled={wizardStep === 1}
                >
                  Back
                </Button>
                {wizardStep < 4 ? (
                  <Button
                    variant="primary"
                    onClick={() => setWizardStep(prev => prev + 1)}
                  >
                    Next: {wizardStep === 1 ? 'Set Liquidity' : wizardStep === 2 ? 'Assign Roles' : 'Review'}
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : deploymentStep === 'done' && deployedMarketAddress ? (
                  <Button
                    variant="primary"
                    onClick={() => navigate(`/trade/${deployedMarketAddress}`)}
                    className="bg-emerald-600 hover:bg-emerald-500"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    View Market
                  </Button>
                ) : isApproveConfirmed && deploymentStep === 'approve' ? (
                  <Button
                    variant="primary"
                    onClick={handleContinueAfterApproval}
                  >
                    <ChevronRight className="w-4 h-4 mr-2" />
                    Continue Deployment
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleDeployMarket}
                    disabled={isDeploying || !wizardData.question || !wizardData.deadline || !launchpadEngineAddress || !usdcAddress}
                  >
                    {isDeploying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {deploymentStep === 'approve' ? 'Approving USDC...' :
                          deploymentStep === 'deploying' ? 'Deploying TruthMarket...' :
                            deploymentStep === 'creating' ? 'Creating Market...' : 'Processing...'}
                      </>
                    ) : !isApproved ? (
                      <>
                        <DollarSign className="w-4 h-4 mr-2" />
                        Approve & Deploy (${depositAmount} USDC)
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Deploy Market (${depositAmount} USDC)
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Create;

