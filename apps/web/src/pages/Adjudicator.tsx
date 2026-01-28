/**
 * Adjudicator Page - Settlement Dashboard for Adjudicators
 *
 * Active settlement interface for market adjudicators.
 * Features: Ready to settle, Pending finalization, Settlement history
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Gavel, Clock, CheckCircle, XCircle, AlertTriangle,
  Eye, ExternalLink, Filter, RefreshCw
} from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useTruthMarketDirect } from '../hooks';
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

type Tab = 'ready' | 'pending' | 'history';

// Market row for adjudicator's markets
interface AdjudicatorMarketRowProps {
  market: MarketConfig;
  userAddress?: string;
  tab: Tab;
}

const AdjudicatorMarketRow: React.FC<AdjudicatorMarketRowProps> = ({ market, userAddress, tab }) => {
  const { market: truthMarket, isLoading } = useTruthMarketDirect(market.contractAddress as `0x${string}`);
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);

  // Check if user is the adjudicator for this market
  const isAdjudicator = userAddress?.toLowerCase() === truthMarket?.adjudicator?.toLowerCase();
  const isSettled = truthMarket?.isSettled ?? false;
  const deadline = truthMarket?.deadline ?? 0;
  const now = Date.now() / 1000;
  const isPastDeadline = deadline > 0 && now > deadline;

  // Filter based on tab
  if (tab === 'ready' && (isSettled || !isPastDeadline || !isAdjudicator)) return null;
  if (tab === 'pending' && (!isSettled || !isAdjudicator)) return null;
  if (tab === 'history' && !isSettled) return null;

  if (isLoading) {
    return (
      <tr className="border-b border-slate-800">
        <td colSpan={6} className="py-3 px-4">
          <div className="h-4 bg-slate-700/50 rounded animate-pulse w-full" />
        </td>
      </tr>
    );
  }

  const winningOutcome = truthMarket?.winningOutcome;
  const outcomeLabel = winningOutcome === 1 ? 'YES' : winningOutcome === 0 ? 'NO' : winningOutcome === 2 ? 'INVALID' : '—';

  // Time calculations
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
            <Button
              size="xs"
              variant="primary"
              disabled={selectedOutcome === null}
              className="whitespace-nowrap"
            >
              <Gavel className="w-3 h-3 mr-1" />
              Settle
            </Button>
          </div>
        ) : tab === 'pending' ? (
          <div className="flex items-center gap-2">
            <Button size="xs" variant="secondary" className="text-rose-400 border-rose-500/50">
              <XCircle className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          </div>
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

export const Adjudicator = () => {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const [activeTab, setActiveTab] = useState<Tab>('ready');

  // Filter markets for current chain
  const allMarkets = useMemo(() => {
    return marketsConfig.markets.filter((m: MarketConfig) =>
      m.version?.startsWith('v') && m.chainId === chainId
    );
  }, [chainId]);

  const tabs = [
    { id: 'ready' as Tab, label: 'Ready to Settle', icon: AlertTriangle, color: 'text-amber-400' },
    { id: 'pending' as Tab, label: 'Pending Finalization', icon: Clock, color: 'text-cyan-400' },
    { id: 'history' as Tab, label: 'Settlement History', icon: CheckCircle, color: 'text-slate-400' },
  ];

  if (!isConnected) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Card className="max-w-md text-center p-8">
          <Gavel className="w-12 h-12 mx-auto text-amber-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
          <p className="text-slate-400 mb-6">
            Connect your wallet to access the adjudicator dashboard.
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
          <div className="flex items-center gap-3 mb-1">
            <Gavel className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-bold text-white">Adjudicator Dashboard</h1>
          </div>
          <p className="text-slate-400 text-sm">Settle markets and manage pending resolutions</p>
        </div>

        {/* Stats Bar */}
        <Card className="mb-6 bg-gradient-to-r from-amber-500/10 to-slate-900 border-amber-500/20">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-amber-400" />
                <span className="text-white font-medium">Adjudicator</span>
                <Badge variant="outline" className="text-amber-400 border-amber-500/50">
                  {allMarkets.length} assigned
                </Badge>
              </div>
              <div className="w-px h-6 bg-slate-700" />
              <div className="text-sm text-slate-400">
                Address: <span className="font-mono text-white">{userAddress?.slice(0, 6)}...{userAddress?.slice(-4)}</span>
              </div>
            </div>
            <Button variant="secondary" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === tab.id
                  ? 'border-amber-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : ''}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-medium">Market</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">
                    {activeTab === 'ready' ? 'Deadline' : activeTab === 'pending' ? 'Veto Window' : 'Settled'}
                  </th>
                  <th className="py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {allMarkets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 px-4 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Gavel className="w-10 h-10 text-slate-600" />
                        <p className="text-slate-500">No markets assigned on this chain</p>
                        <p className="text-xs text-slate-600">Markets you adjudicate will appear here</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  allMarkets.map((market: MarketConfig) => (
                    <AdjudicatorMarketRow
                      key={market.contractAddress}
                      market={market}
                      userAddress={userAddress}
                      tab={activeTab}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Help Section */}
        <div className="mt-8 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
          <h3 className="font-bold text-white mb-2 flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-400" />
            Adjudicator Guide
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-400">
            <div>
              <p className="font-medium text-amber-400 mb-1">Ready to Settle</p>
              <p className="text-xs">Markets past their deadline awaiting your settlement decision.</p>
            </div>
            <div>
              <p className="font-medium text-cyan-400 mb-1">Pending Finalization</p>
              <p className="text-xs">Your settlements in the veto window. Guardian may intervene.</p>
            </div>
            <div>
              <p className="font-medium text-slate-300 mb-1">Settlement History</p>
              <p className="text-xs">Completed settlements with outcome and timestamp.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Adjudicator;
