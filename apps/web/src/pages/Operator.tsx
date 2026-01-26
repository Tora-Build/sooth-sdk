/**
 * Operator Page - Unified Dashboard for Protocol Operators
 *
 * Combines Adjudicator, Guardian, and Owner roles into a single interface.
 * Features: Role-based sidebar navigation, settlement, veto, protocol settings
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Gavel, Shield, Settings, Clock, CheckCircle, XCircle, AlertTriangle,
  Eye, RefreshCw, Filter, Download, Info, BookOpen
} from 'lucide-react';
import { useAccount, useChainId, useReadContracts, useReadContract } from 'wagmi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useTruthMarketDirect } from '../hooks';
import { useDeployments } from '../hooks/useDeployments';
import { ABIS } from '../config/abis';
import marketsConfigRaw from '../config/markets.json';

interface MarketConfig {
  id: string;
  name: string;
  symbol: string;
  description?: string;
  contractAddress: string;
  chainId: number;
  version?: string;
}

interface MarketsConfigJson {
  markets: MarketConfig[];
}

const marketsConfig = marketsConfigRaw as MarketsConfigJson;

type Section = 'adjudicator' | 'guardian' | 'owner';
type AdjudicatorTab = 'ready' | 'pending' | 'history';

// ============================================
// Educational Content
// ============================================

const RoleEducation: React.FC<{ role: Section }> = ({ role }) => {
  const content = {
    adjudicator: {
      title: 'What is an Adjudicator?',
      description: 'Adjudicators are trusted entities responsible for determining the outcome of prediction markets. When a market reaches its deadline, the adjudicator submits the final result (YES, NO, or INVALID).',
      responsibilities: [
        'Monitor markets assigned to you for deadline expiry',
        'Research and verify the actual outcome of events',
        'Submit settlement transactions with the correct outcome',
        'Respond promptly to avoid delayed payouts for traders',
      ],
      warning: 'Incorrect settlements can be vetoed by the Guardian during the finalization window.',
    },
    guardian: {
      title: 'What is a Guardian?',
      description: 'The Guardian is a protocol-level oversight role that can veto incorrect or malicious settlements. This provides a safety net against adjudicator errors or attacks.',
      responsibilities: [
        'Review all settlements during the veto window (24h)',
        'Veto clearly incorrect outcomes to protect traders',
        'Monitor for suspicious settlement patterns',
        'Coordinate with adjudicators on disputed outcomes',
      ],
      warning: 'Use veto power sparingly and only for clear errors. Markets cannot finalize until the veto window expires.',
    },
    owner: {
      title: 'What is a Protocol Owner?',
      description: 'The Protocol Owner has administrative control over protocol parameters. This role is typically held by a multisig or DAO to ensure decentralized governance.',
      responsibilities: [
        'Configure fee parameters (bonding fee, trading fee)',
        'Set fee distribution ratios (liquidity, LP yield, treasury)',
        'Adjust graduation multiplier for market maturity',
        'Emergency pause the protocol if critical issues arise',
      ],
      warning: 'Changes to protocol parameters affect all markets. Test on testnet before applying to mainnet.',
    },
  };

  const c = content[role];

  return (
    <Card className="mt-8 bg-slate-800/30 border-slate-700">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-slate-400" />
          <h3 className="font-bold text-white">{c.title}</h3>
        </div>
        <p className="text-sm text-slate-400">{c.description}</p>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Responsibilities</p>
          <ul className="space-y-1.5">
            {c.responsibilities.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300">{c.warning}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};

// ============================================
// Adjudicator Components
// ============================================

interface AdjudicatorMarketRowProps {
  market: MarketConfig;
  userAddress?: string;
  tab: AdjudicatorTab;
}

const AdjudicatorMarketRow: React.FC<AdjudicatorMarketRowProps> = ({ market, userAddress, tab }) => {
  const { market: truthMarket, isLoading } = useTruthMarketDirect(market.contractAddress as `0x${string}`);
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);

  const isAdjudicator = userAddress?.toLowerCase() === truthMarket?.adjudicator?.toLowerCase();
  const isSettled = truthMarket?.isSettled ?? false;
  const deadline = truthMarket?.deadline ?? 0;
  const now = Date.now() / 1000;
  const isPastDeadline = deadline > 0 && now > deadline;

  if (tab === 'ready' && (isSettled || !isPastDeadline || !isAdjudicator)) return null;
  if (tab === 'pending' && (!isSettled || !isAdjudicator)) return null;
  if (tab === 'history' && !isSettled) return null;

  if (isLoading) {
    return (
      <tr className="border-b border-slate-800">
        <td colSpan={4} className="py-3 px-4">
          <div className="h-4 bg-slate-700/50 rounded animate-pulse w-full" />
        </td>
      </tr>
    );
  }

  const winningOutcome = truthMarket?.winningOutcome;
  const outcomeLabel = winningOutcome === 1 ? 'YES' : winningOutcome === 0 ? 'NO' : winningOutcome === 2 ? 'INVALID' : '—';
  const timeToDeadline = deadline - now;
  const daysLeft = Math.floor(timeToDeadline / 86400);
  const hoursLeft = Math.floor((timeToDeadline % 86400) / 3600);

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
      <td className="py-4 px-4">
        <div>
          <Link to={`/trade/${market.contractAddress}`} className="font-medium text-white hover:text-cyan-400 transition-colors">
            {market.symbol}
          </Link>
          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{market.name}</p>
        </div>
      </td>
      <td className="py-4 px-4">
        {tab === 'ready' ? (
          <Badge variant="warning" className="animate-pulse">
            <Clock className="w-3 h-3 mr-1" />
            Ready
          </Badge>
        ) : tab === 'pending' ? (
          <Badge variant="outline" className="text-amber-400 border-amber-500/50">
            <RefreshCw className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        ) : (
          <Badge variant={outcomeLabel === 'YES' ? 'success' : outcomeLabel === 'NO' ? 'warning' : 'default'}>
            {outcomeLabel}
          </Badge>
        )}
      </td>
      <td className="py-4 px-4 text-sm text-slate-400">
        {tab === 'ready' ? (
          isPastDeadline ? (
            <span className="text-rose-400">{Math.abs(daysLeft)}d {Math.abs(hoursLeft)}h overdue</span>
          ) : (
            <span>{daysLeft}d {hoursLeft}h left</span>
          )
        ) : tab === 'pending' ? (
          <span className="text-amber-400">In veto window</span>
        ) : (
          new Date((truthMarket?.tStar || 0) * 1000).toLocaleDateString()
        )}
      </td>
      <td className="py-4 px-4">
        {tab === 'ready' ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedOutcome ?? ''}
              onChange={(e) => setSelectedOutcome(e.target.value ? parseInt(e.target.value) : null)}
              className="input-field text-xs py-1 px-2 w-24"
            >
              <option value="">Select...</option>
              <option value="1">YES</option>
              <option value="0">NO</option>
              <option value="2">INVALID</option>
            </select>
            <Button size="xs" variant="primary" disabled={selectedOutcome === null}>
              <Gavel className="w-3 h-3 mr-1" />
              Settle
            </Button>
          </div>
        ) : tab === 'pending' ? (
          <Button size="xs" variant="secondary" className="text-rose-400 border-rose-500/50">
            <XCircle className="w-3 h-3 mr-1" />
            Cancel
          </Button>
        ) : (
          <Link to={`/trade/${market.contractAddress}`}>
            <Button size="xs" variant="ghost">
              <Eye className="w-3 h-3 mr-1" />
              View
            </Button>
          </Link>
        )}
      </td>
    </tr>
  );
};

// ============================================
// Guardian Components
// ============================================

interface FinalizedRowProps {
  market: MarketConfig;
}

const FinalizedRow: React.FC<FinalizedRowProps> = ({ market }) => {
  const { market: truthMarket, isLoading } = useTruthMarketDirect(market.contractAddress as `0x${string}`);

  if (isLoading) {
    return (
      <tr className="border-b border-slate-800">
        <td colSpan={6} className="py-3 px-4">
          <div className="h-4 bg-slate-700/50 rounded animate-pulse w-full" />
        </td>
      </tr>
    );
  }

  if (!truthMarket?.isSettled) return null;

  const outcomeLabel = truthMarket.winningOutcome === 1 ? 'YES' :
    truthMarket.winningOutcome === 0 ? 'NO' : 'INVALID';
  const tStar = truthMarket.tStar;
  const finalizedDate = tStar ? new Date(tStar * 1000) : new Date();
  const settler = truthMarket.adjudicator || '0x0000000000000000000000000000000000000000';
  const isVetoed = truthMarket.isVetoed;

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
      <td className="py-3 px-4">
        <Link to={`/trade/${market.contractAddress}`} className="hover:text-white transition-colors">
          {market.symbol}
        </Link>
      </td>
      <td className="py-3 px-4">
        <Badge variant={outcomeLabel === 'YES' ? 'success' : outcomeLabel === 'NO' ? 'warning' : 'default'}>
          {outcomeLabel}
        </Badge>
      </td>
      <td className="py-3 px-4 font-mono text-xs text-slate-400">
        {settler.slice(0, 6)}...{settler.slice(-4)}
      </td>
      <td className="py-3 px-4 text-slate-400 text-sm">
        {finalizedDate.toLocaleDateString()}
      </td>
      <td className="py-3 px-4">
        {isVetoed ? <Badge variant="warning">Vetoed</Badge> : <span className="text-slate-500">—</span>}
      </td>
      <td className="py-3 px-4">
        <Link to={`/trade/${market.contractAddress}`}>
          <Button size="xs" variant="ghost">
            <Eye className="w-3 h-3" />
          </Button>
        </Link>
      </td>
    </tr>
  );
};

// ============================================
// Main Component
// ============================================

export const Operator = () => {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const deployments = useDeployments();
  const [activeSection, setActiveSection] = useState<Section>('adjudicator');
  const [adjudicatorTab, setAdjudicatorTab] = useState<AdjudicatorTab>('ready');

  // Contract addresses
  const launchpadEngineAddress = deployments?.contracts?.LaunchpadEngine as `0x${string}` | undefined;
  const protocolConfigAddress = deployments?.contracts?.ProtocolConfig as `0x${string}` | undefined;

  // Filter markets for current chain
  const allMarkets = useMemo(() => {
    return marketsConfig.markets.filter((m: MarketConfig) =>
      m.version?.startsWith('v') && m.chainId === chainId
    );
  }, [chainId]);

  // Batch fetch adjudicator addresses for all markets
  const { data: adjudicatorData } = useReadContracts({
    contracts: allMarkets.map(m => ({
      address: m.contractAddress as `0x${string}`,
      abi: ABIS.TruthMarket,
      functionName: 'adjudicator',
    })),
    query: { enabled: allMarkets.length > 0 }
  });

  // Check if user is adjudicator for any market
  const isAdjudicatorForAny = useMemo(() => {
    if (!userAddress || !adjudicatorData) return false;
    return adjudicatorData.some(result =>
      result.status === 'success' &&
      (result.result as string)?.toLowerCase() === userAddress.toLowerCase()
    );
  }, [userAddress, adjudicatorData]);

  // Count how many markets user is adjudicator for
  const adjudicatorMarketCount = useMemo(() => {
    if (!userAddress || !adjudicatorData) return 0;
    return adjudicatorData.filter(result =>
      result.status === 'success' &&
      (result.result as string)?.toLowerCase() === userAddress.toLowerCase()
    ).length;
  }, [userAddress, adjudicatorData]);

  // Check if user is protocol owner
  const { data: ownerAddress } = useReadContract({
    address: launchpadEngineAddress,
    abi: ABIS.LaunchpadEngine,
    functionName: 'owner',
    query: { enabled: !!launchpadEngineAddress }
  });

  const isOwner = userAddress?.toLowerCase() === (ownerAddress as string)?.toLowerCase();

  // Check if user is guardian (via ProtocolConfig)
  const { data: guardianAddress } = useReadContract({
    address: protocolConfigAddress,
    abi: [{ name: 'guardian', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
    functionName: 'guardian',
    query: { enabled: !!protocolConfigAddress }
  });

  const isGuardian = userAddress?.toLowerCase() === (guardianAddress as string)?.toLowerCase();

  // Protocol settings state
  const [settings, setSettings] = useState({
    preGradFee: '5',
    postGradFee: '1',
    liquidityShare: '50',
    lpShare: '30',
    protocolShare: '20',
    gradMultiplier: '2',
    isPaused: false,
    trialPeriodDays: '7',
  });

  const totalShares = parseInt(settings.liquidityShare) + parseInt(settings.lpShare) + parseInt(settings.protocolShare);

  const sections: { id: Section; label: string; icon: typeof Gavel; color: 'amber' | 'rose' | 'cyan' }[] = [
    { id: 'adjudicator', label: 'Adjudicator', icon: Gavel, color: 'amber' },
    { id: 'guardian', label: 'Guardian', icon: Shield, color: 'rose' },
    { id: 'owner', label: 'Owner', icon: Settings, color: 'cyan' },
  ];

  const adjudicatorTabs = [
    { id: 'ready' as AdjudicatorTab, label: 'Ready to Settle', icon: AlertTriangle },
    { id: 'pending' as AdjudicatorTab, label: 'Pending', icon: Clock },
    { id: 'history' as AdjudicatorTab, label: 'History', icon: CheckCircle },
  ];

  // Get active status for each role
  const getRoleActive = (role: Section): boolean => {
    switch (role) {
      case 'adjudicator': return isAdjudicatorForAny;
      case 'guardian': return isGuardian;
      case 'owner': return isOwner;
      default: return false;
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Card className="max-w-md text-center p-8">
          <Settings className="w-12 h-12 mx-auto text-cyan-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
          <p className="text-slate-400 mb-6">
            Connect your wallet to access operator controls.
          </p>
          <Button variant="primary">Connect Wallet</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Operator Console</h1>
        </div>

        {/* Section Switcher - Pill Style with Role Indicators */}
        <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl mb-6 w-fit">
          {sections.map(section => {
            const isActive = activeSection === section.id;
            const hasRole = getRoleActive(section.id);
            const colorClasses = {
              amber: isActive ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : '',
              rose: isActive ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : '',
              cyan: isActive ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : '',
            };
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  isActive
                    ? `${colorClasses[section.color]} border-current`
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <section.icon className="w-4 h-4" />
                <span className="font-medium">{section.label}</span>
                {/* Active role indicator - green dot */}
                {hasRole && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-lg shadow-emerald-500/50" />
                )}
              </button>
            );
          })}
        </div>

        {/* ============================================ */}
        {/* ADJUDICATOR SECTION */}
        {/* ============================================ */}
        {activeSection === 'adjudicator' && (
          <div className="space-y-6">
            {/* Stats Bar with Active Role Indicator */}
            <Card className={`bg-gradient-to-r from-amber-500/10 to-slate-900 ${isAdjudicatorForAny ? 'border-emerald-500/50' : 'border-amber-500/20'}`}>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Gavel className="w-5 h-5 text-amber-400" />
                  <span className="text-white font-medium">Settlement Authority</span>
                  {isAdjudicatorForAny ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active · {adjudicatorMarketCount} market{adjudicatorMarketCount !== 1 ? 's' : ''}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 border-slate-600">
                      Not assigned
                    </Badge>
                  )}
                </div>
                <Button variant="secondary" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </Card>

            {/* Not Active Warning */}
            {!isAdjudicatorForAny && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <Info className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <p className="text-sm text-slate-300">You are not an adjudicator for any markets on this chain.</p>
                  <p className="text-xs text-slate-500 mt-0.5">Create a market or be assigned as adjudicator to see pending settlements.</p>
                </div>
              </div>
            )}

            {/* Sub-tabs */}
            <div className="flex gap-2">
              {adjudicatorTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setAdjudicatorTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    adjudicatorTab === tab.id
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Markets Table */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-medium">Market</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium">
                        {adjudicatorTab === 'ready' ? 'Deadline' : adjudicatorTab === 'pending' ? 'Veto Window' : 'Settled'}
                      </th>
                      <th className="py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {allMarkets.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 px-4 text-center">
                          <Gavel className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                          <p className="text-slate-500">No markets on this chain</p>
                        </td>
                      </tr>
                    ) : (
                      allMarkets.map((market: MarketConfig) => (
                        <AdjudicatorMarketRow
                          key={market.contractAddress}
                          market={market}
                          userAddress={userAddress}
                          tab={adjudicatorTab}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Educational Content */}
            <RoleEducation role="adjudicator" />
          </div>
        )}

        {/* ============================================ */}
        {/* GUARDIAN SECTION */}
        {/* ============================================ */}
        {activeSection === 'guardian' && (
          <div className="space-y-6">
            {/* Stats Bar with Active Role Indicator */}
            <Card className={`bg-gradient-to-r from-rose-500/10 to-slate-900 ${isGuardian ? 'border-emerald-500/50' : 'border-rose-500/20'}`}>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Shield className="w-5 h-5 text-rose-400" />
                  <span className="text-white font-medium">Veto Authority</span>
                  {isGuardian ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active Guardian
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 border-slate-600">
                      Not guardian
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            {/* Not Active Warning */}
            {!isGuardian && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <Info className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <p className="text-sm text-slate-300">You are not the protocol guardian.</p>
                  <p className="text-xs text-slate-500 mt-0.5">The guardian role is assigned at the protocol level via ProtocolConfig.</p>
                </div>
              </div>
            )}

            {/* Finalized Markets Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Finalized Markets (Audit Trail)</h2>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-slate-500 border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 font-medium">Market</th>
                        <th className="py-3 px-4 font-medium">Outcome</th>
                        <th className="py-3 px-4 font-medium">Settled By</th>
                        <th className="py-3 px-4 font-medium">Date</th>
                        <th className="py-3 px-4 font-medium">Action</th>
                        <th className="py-3 px-4 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {allMarkets.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 px-4 text-center text-slate-500">
                            No markets on this chain
                          </td>
                        </tr>
                      ) : (
                        allMarkets.map((market) => (
                          <FinalizedRow key={market.contractAddress} market={market} />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Educational Content */}
            <RoleEducation role="guardian" />
          </div>
        )}

        {/* ============================================ */}
        {/* OWNER SECTION */}
        {/* ============================================ */}
        {activeSection === 'owner' && (
          <div className="space-y-6">
            {/* Stats Bar with Active Role Indicator */}
            <Card className={`bg-gradient-to-r from-cyan-500/10 to-slate-900 ${isOwner ? 'border-emerald-500/50' : 'border-cyan-500/20'}`}>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Settings className="w-5 h-5 text-cyan-400" />
                  <span className="text-white font-medium">Protocol Owner</span>
                  {isOwner ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active Owner
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 border-slate-600">
                      Not owner
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            {/* Not Active Warning */}
            {!isOwner && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <Info className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <p className="text-sm text-slate-300">You are not the protocol owner.</p>
                  <p className="text-xs text-slate-500 mt-0.5">Only the LaunchpadEngine owner can modify protocol settings.</p>
                </div>
              </div>
            )}

            {/* Fee Configuration */}
            <Card className={!isOwner ? 'opacity-60 pointer-events-none' : ''}>
              <div className="p-4 space-y-4">
                <h3 className="font-bold text-white">Fee Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Bonding Fee</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.preGradFee}
                        onChange={(e) => setSettings(s => ({ ...s, preGradFee: e.target.value }))}
                        className="input-field pr-8"
                        disabled={!isOwner}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Post-Graduation Fee</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.postGradFee}
                        onChange={(e) => setSettings(s => ({ ...s, postGradFee: e.target.value }))}
                        className="input-field pr-8"
                        disabled={!isOwner}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Fee Distribution */}
            <Card className={!isOwner ? 'opacity-60 pointer-events-none' : ''}>
              <div className="p-4 space-y-4">
                <h3 className="font-bold text-white">Fee Distribution (Post-Graduation)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-cyan-400 mb-2">Liquidity Growth</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.liquidityShare}
                        onChange={(e) => setSettings(s => ({ ...s, liquidityShare: e.target.value }))}
                        className="input-field pr-8"
                        disabled={!isOwner}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-cyan-400 mb-2">LP Yield</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.lpShare}
                        onChange={(e) => setSettings(s => ({ ...s, lpShare: e.target.value }))}
                        className="input-field pr-8"
                        disabled={!isOwner}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Protocol Treasury</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.protocolShare}
                        onChange={(e) => setSettings(s => ({ ...s, protocolShare: e.target.value }))}
                        className="input-field pr-8"
                        disabled={!isOwner}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                    </div>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${totalShares === 100
                    ? 'bg-emerald-500/10 border border-emerald-500/30'
                    : 'bg-rose-500/10 border border-rose-500/30'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total</span>
                    <span className={`font-bold ${totalShares === 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {totalShares}% {totalShares === 100 ? '✓' : '(must equal 100%)'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Protocol Status */}
            <Card className={`${!isOwner ? 'opacity-60 pointer-events-none' : ''} ${settings.isPaused ? 'border-rose-500/50 bg-rose-500/5' : ''}`}>
              <div className="p-4 space-y-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${settings.isPaused ? 'text-rose-400' : 'text-slate-400'}`} />
                  Protocol Status
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm text-slate-400">Pause Protocol</label>
                    <p className="text-xs text-slate-500 mt-1">Emergency stop all trading</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, isPaused: !s.isPaused }))}
                    disabled={!isOwner}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      settings.isPaused ? 'bg-rose-500' : 'bg-slate-700'
                    }`}
                  >
                    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.isPaused ? 'translate-x-7' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
                {settings.isPaused && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
                    Protocol is PAUSED. All trading is halted.
                  </div>
                )}
              </div>
            </Card>

            {/* Trial Period */}
            <Card className={!isOwner ? 'opacity-60 pointer-events-none' : ''}>
              <div className="p-4 space-y-4">
                <h3 className="font-bold text-white">Trial Period Settings</h3>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Duration</label>
                  <div className="relative w-48">
                    <input
                      type="number"
                      value={settings.trialPeriodDays}
                      onChange={(e) => setSettings(s => ({ ...s, trialPeriodDays: e.target.value }))}
                      className="input-field pr-12"
                      disabled={!isOwner}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">days</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    New markets can be dismissed within this period
                  </p>
                </div>
              </div>
            </Card>

            {/* Apply Button */}
            {isOwner && (
              <div className="flex justify-end gap-4">
                <Button variant="secondary">Preview Changes</Button>
                <Button variant="primary" disabled={totalShares !== 100}>Apply Changes</Button>
              </div>
            )}

            {/* Educational Content */}
            <RoleEducation role="owner" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Operator;
