/**
 * Gov Page - Guardian + Governance Dashboard
 * 
 * Oversight and governance controls for guardians and protocol owners.
 * Features: Veto queue, Finalized markets audit, Protocol settings
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Clock, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, TrendingDown, Settings, Eye, ExternalLink,
  Filter, Download
} from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { InfoTooltip } from '../components/ui/Tooltip';
import { useTruthMarketDirect, useLaunchpadMarketDirect } from '../hooks';
import marketsConfigRaw from '../config/markets.json';
import { MarketConfig, MarketsConfigJson } from '../types';

const marketsConfig = marketsConfigRaw as MarketsConfigJson;

type Tab = 'veto' | 'finalized' | 'settings';

// Countdown timer component
const CountdownTimer: React.FC<{ deadline: number }> = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useState(() => {
    const update = () => {
      const now = Date.now() / 1000;
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);

      setIsUrgent(diff < 300); // 5 minutes

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        const seconds = Math.floor(diff % 60);
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  });

  return (
    <span className={isUrgent ? 'countdown-urgent' : 'text-slate-400'}>
      {timeLeft}
    </span>
  );
};

// Veto card for pending settlements
interface VetoCardProps {
  market: MarketConfig;
  userAddress?: string;
}

const VetoCard: React.FC<VetoCardProps> = ({ market, userAddress }) => {
  const { market: truthMarket, isLoading } = useTruthMarketDirect(market.contractAddress as `0x${string}`);

  const isGuardian = userAddress?.toLowerCase() === truthMarket?.guardian?.toLowerCase();
  const isSettled = truthMarket?.isSettled ?? false;
  const winningOutcome = truthMarket?.winningOutcome ?? 0;
  const adjudicator = truthMarket?.adjudicator;

  // Only show if user is guardian and market is in veto window
  if (!isGuardian || !isSettled) return null;

  // Mock veto window (24h from settlement)
  const vetoDeadline = (truthMarket?.deadline || 0) + 86400; // +24h
  const now = Date.now() / 1000;
  const vetoProgress = Math.min(100, ((now - (vetoDeadline - 86400)) / 86400) * 100);
  const timeRemaining = vetoDeadline - now;

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
    <Card className="border-slate-500/30 bg-slate-500/5">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-white">{market.name}</h3>
            <p className="text-sm text-slate-400 mt-1">{market.description}</p>
          </div>
        </div>

        {/* Settlement Info */}
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Settled Outcome:</span>
            <span className={`font-bold ${winningOutcome === 1 ? 'text-emerald-400' :
                winningOutcome === 2 ? 'text-rose-400' : 'text-slate-400'
              }`}>
              {winningOutcome === 1 ? 'YES' : winningOutcome === 2 ? 'NO' : 'INVALID'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Settled by:</span>
            <span className="font-mono text-xs text-slate-300">
              {adjudicator?.slice(0, 6)}...{adjudicator?.slice(-4)}
            </span>
          </div>
        </div>

        {/* Veto Window Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="flex items-center gap-2 text-slate-400">
              <Clock className="w-4 h-4" />
              Veto Window
            </span>
            <CountdownTimer deadline={vetoDeadline} />
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-slate-600 to-slate-400 transition-all"
              style={{ width: `${vetoProgress}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link to={`/gov`} className="flex-1">
            <Button variant="secondary" className="w-full border-rose-500/50 text-rose-400 hover:bg-rose-500/20">
              <XCircle className="w-4 h-4 mr-2" />
              Veto
            </Button>
          </Link>
          <Link to={`/gov`} className="flex-1">
            <Button variant="primary" className="w-full">
              <CheckCircle className="w-4 h-4 mr-2" />
              Finalize
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
};

// Finalized market row - fetches real data from contracts
interface FinalizedRowProps {
  market: MarketConfig;
}

const FinalizedRow: React.FC<FinalizedRowProps> = ({ market }) => {
  const { market: truthMarket, isLoading } = useTruthMarketDirect(market.contractAddress as `0x${string}`);

  // Only render if market is settled
  if (isLoading) {
    return (
      <tr className="border-b border-slate-800">
        <td colSpan={6} className="py-3 px-4">
          <div className="h-4 bg-slate-700/50 rounded animate-pulse w-full" />
        </td>
      </tr>
    );
  }

  // Don't render if not settled
  if (!truthMarket?.isSettled) {
    return null;
  }

  // Map outcome: 0 = NO, 1 = YES, 2+ = INVALID (per V8 contract)
  const outcomeLabel = truthMarket.winningOutcome === 1 ? 'YES' :
    truthMarket.winningOutcome === 0 ? 'NO' : 'INVALID';

  // tStar is the settlement timestamp
  const tStar = truthMarket.tStar;
  const finalizedDate = tStar ? new Date(tStar * 1000) : new Date();

  // The adjudicator is who settled the market
  const settler = truthMarket.adjudicator || '0x0000000000000000000000000000000000000000';

  // Check if market was vetoed
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
        {isVetoed ? (
          <Badge variant="warning">Vetoed</Badge>
        ) : (
          <span className="text-slate-500">—</span>
        )}
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

export const Gov = () => {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const [activeTab, setActiveTab] = useState<Tab>('veto');

  // Filter V8 markets for current chain
  const v8Markets = useMemo(() => {
    return marketsConfig.markets.filter(m =>
      m.version?.startsWith('v') && m.chainId === chainId
    );
  }, [chainId]);

  // Protocol settings state (mock)
  const [settings, setSettings] = useState({
    preGradFee: '5',
    postGradFee: '1',
    liquidityShare: '50',
    lpShare: '30',
    protocolShare: '20',
    gradMultiplier: '2',
  });

  // Count guardian roles
  const guardianCount = useMemo(() => {
    // In production, would check on-chain
    return v8Markets.length > 0 ? 3 : 0;
  }, [v8Markets]);

  // All V8 markets - FinalizedRow handles filtering to settled ones
  const allMarkets = v8Markets;

  const tabs = [
    { id: 'veto' as Tab, label: 'Veto Queue', icon: Clock },
    { id: 'finalized' as Tab, label: 'Finalized', icon: CheckCircle },
    { id: 'settings' as Tab, label: 'Protocol Settings', icon: Settings },
  ];

  const totalShares = parseInt(settings.liquidityShare) + parseInt(settings.lpShare) + parseInt(settings.protocolShare);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md text-center p-8">
          <Shield className="w-12 h-12 mx-auto text-rose-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
          <p className="text-slate-400 mb-6">
            Connect your wallet to access governance controls.
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
          <h1 className="text-2xl font-bold text-white mb-1">Governance</h1>
          <p className="text-slate-400 text-sm">Guardian controls and protocol settings</p>
        </div>

        {/* Role Indicator */}
        <Card className="mb-6 bg-gradient-to-r from-rose-500/10 to-slate-900 border-rose-500/20">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-400" />
                <span className="text-white font-medium">Guardian</span>
                <Badge variant="outline" className="text-rose-400">
                  {guardianCount} markets
                </Badge>
              </div>
              <div className="w-px h-6 bg-slate-700" />
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" />
                <span className="text-white font-medium">Protocol Owner</span>
                <Badge variant="outline" className="text-slate-400">
                  Admin
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === tab.id
                  ? 'border-rose-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'veto' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Settlements Pending Finalization</h2>
              <Badge variant="warning">{guardianCount} pending</Badge>
            </div>

            {v8Markets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {v8Markets.map(market => (
                  <VetoCard
                    key={market.id}
                    market={market}
                    userAddress={userAddress}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">All Clear!</h3>
                <p className="text-slate-400">
                  No settlements are awaiting your review.
                </p>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'finalized' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Finalized Markets (Audit Trail)</h2>
                <Badge variant="outline" className="text-slate-400 border-slate-600">
                  {allMarkets.length} markets scanned
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
                <Button variant="secondary" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Info note */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-400">
              <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Only showing settled markets. Rows with no data indicate markets that are still live or pending.</span>
            </div>

            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-medium">Market</th>
                      <th className="py-3 px-4 font-medium">Outcome</th>
                      <th className="py-3 px-4 font-medium">Settled By</th>
                      <th className="py-3 px-4 font-medium">Finalized</th>
                      <th className="py-3 px-4 font-medium">Action</th>
                      <th className="py-3 px-4 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {allMarkets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 px-4 text-center text-slate-500">
                          No markets available on this chain
                        </td>
                      </tr>
                    ) : (
                      allMarkets.map((market) => (
                        <FinalizedRow
                          key={market.contractAddress}
                          market={market}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Protocol Settings</h2>
              <Badge variant="outline" className="text-slate-400 border-slate-500/30">
                Owner Only
              </Badge>
            </div>

            {/* Fee Configuration */}
            <Card>
              <div className="p-4 space-y-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  Fee Configuration
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Bonding Fee
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.preGradFee}
                        onChange={(e) => setSettings(s => ({ ...s, preGradFee: e.target.value }))}
                        className="input-field pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Current: 5%</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Post-Graduation Fee
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.postGradFee}
                        onChange={(e) => setSettings(s => ({ ...s, postGradFee: e.target.value }))}
                        className="input-field pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Current: 1%</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Fee Distribution */}
            <Card>
              <div className="p-4 space-y-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  Fee Distribution (Post-Graduation)
                  <InfoTooltip type="fee" position="right">
                    <span className="text-xs text-slate-500 cursor-help">?</span>
                  </InfoTooltip>
                </h3>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-cyan-400 mb-2">
                      Liquidity Growth
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.liquidityShare}
                        onChange={(e) => setSettings(s => ({ ...s, liquidityShare: e.target.value }))}
                        className="input-field pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-cyan-400 mb-2">
                      LP Yield
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.lpShare}
                        onChange={(e) => setSettings(s => ({ ...s, lpShare: e.target.value }))}
                        className="input-field pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Protocol Treasury
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.protocolShare}
                        onChange={(e) => setSettings(s => ({ ...s, protocolShare: e.target.value }))}
                        className="input-field pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                    </div>
                  </div>
                </div>

                {/* Total validation */}
                <div className={`p-3 rounded-lg ${totalShares === 100
                    ? 'bg-emerald-500/10 border border-emerald-500/30'
                    : 'bg-rose-500/10 border border-rose-500/30'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total</span>
                    <span className={`font-bold ${totalShares === 100 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                      {totalShares}% {totalShares === 100 ? '✓' : '(must equal 100%)'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Graduation Settings */}
            <Card>
              <div className="p-4 space-y-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  Graduation Settings
                  <InfoTooltip type="graduation" position="right">
                    <span className="text-xs text-slate-500 cursor-help">?</span>
                  </InfoTooltip>
                </h3>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Graduation Multiplier
                  </label>
                  <div className="relative w-48">
                    <input
                      type="number"
                      value={settings.gradMultiplier}
                      onChange={(e) => setSettings(s => ({ ...s, gradMultiplier: e.target.value }))}
                      className="input-field pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">× bBase</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Markets graduate when b reaches {settings.gradMultiplier}× initial deposit
                  </p>
                </div>
              </div>
            </Card>

            {/* Apply Button */}
            <div className="flex justify-end gap-4">
              <Button variant="secondary">
                Preview Changes
              </Button>
              <Button variant="primary" disabled={totalShares !== 100}>
                Apply Changes
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Gov;

