import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useActivityStore, ActivityItem } from '../../store/useActivityStore';
import { useMarketStore } from '../../store/useMarketStore';
import { useChainStore } from '../../store/useChainStore';
import { getChainById } from '../../lib/chains';
import { ExternalLink, ShoppingCart, Coins, Landmark, AlertCircle, History, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';

export const ActivityLog: React.FC = () => {
  const { activities } = useActivityStore();
  const { mode } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const [filter, setFilter] = useState<'all' | 'trade' | 'liquidity' | 'settle'>('all');

  const chain = getChainById(selectedChainId);
  const explorerUrl = chain?.explorerUrl || 'https://sepolia.basescan.org';

  // Filter logic
  const filteredActivities = activities.filter(item => {
    // Filter by mode and chain
    const matchesMode = item.mode === mode;
    const matchesChain = mode === 'demo' || !item.chainId || item.chainId === selectedChainId;
    
    if (!matchesMode || !matchesChain) return false;

    // Filter by type
    if (filter === 'all') return true;
    if (filter === 'trade') return item.type === 'trade';
    if (filter === 'liquidity') return ['liquidity', 'deposit', 'withdraw', 'claim'].includes(item.type);
    if (filter === 'settle') return ['settle', 'dispute'].includes(item.type);
    
    return true;
  });

  const getTypeIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'trade': return <ShoppingCart size={14} className="text-emerald-400" />;
      case 'liquidity':
      case 'deposit':
      case 'withdraw':
      case 'claim': return <Coins size={14} className="text-amber-400" />;
      case 'settle': return <Landmark size={14} className="text-indigo-400" />;
      case 'dispute': return <AlertCircle size={14} className="text-rose-400" />;
      default: return <History size={14} className="text-slate-400" />;
    }
  };

  const getTypeColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'trade': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'liquidity':
      case 'deposit':
      case 'withdraw':
      case 'claim': return 'bg-amber-500/10 border-amber-500/20';
      case 'settle': return 'bg-indigo-500/10 border-indigo-500/20';
      case 'dispute': return 'bg-rose-500/10 border-rose-500/20';
      default: return 'bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <Card className="flex flex-col border-slate-800/50 bg-slate-900/40 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={18} className="text-indigo-400" />
          <h3 className="font-bold text-white text-sm">Activity Log</h3>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-950/50 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
              filter === 'all' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
            )}
          >
            ALL
          </button>
          <button
            onClick={() => setFilter('trade')}
            className={cn(
              "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
              filter === 'trade' ? "bg-emerald-500/20 text-emerald-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
            )}
          >
            TRADE
          </button>
          <button
            onClick={() => setFilter('liquidity')}
            className={cn(
              "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
              filter === 'liquidity' ? "bg-amber-500/20 text-amber-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
            )}
          >
            LP
          </button>
          <button
            onClick={() => setFilter('settle')}
            className={cn(
              "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
              filter === 'settle' ? "bg-indigo-500/20 text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
            )}
          >
            SETTLE
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto max-h-[400px] scrollbar-hide">
        {filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
              <Filter size={20} className="text-slate-600" />
            </div>
            <p className="text-slate-500 text-xs font-mono">
              {activities.length === 0 ? "// no_activity_found" : "// no_matches_for_filter"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/30">
            {filteredActivities.map((item) => (
              <div key={item.id} className="p-4 hover:bg-slate-800/20 transition-colors group">
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg border", getTypeColor(item.type))}>
                    {getTypeIcon(item.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-slate-500 font-mono truncate mr-2">
                        {item.market}
                      </span>
                      <span className="text-[10px] text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-200 font-medium line-clamp-2">
                      {item.description}
                    </p>
                    
                    {item.hash && (
                      <div className="mt-2 flex items-center justify-between">
                        <a
                          href={`${explorerUrl}/tx/${item.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                        >
                          View Transaction <ExternalLink size={8} />
                        </a>
                        <span className="text-[9px] text-slate-700 font-mono">
                          {item.hash.slice(0, 10)}...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-950/30 border-t border-slate-800/50 text-center">
        <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest">
          End of Log
        </p>
      </div>
    </Card>
  );
};
