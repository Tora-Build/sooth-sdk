import React from 'react';
import { Card } from '../ui/Card';
import { Activity, ArrowUpRight, ArrowDownLeft, Shield, CheckCircle } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { useActivityStore, ActivityItem } from '../../store/useActivityStore';
import { useChainStore } from '../../store/useChainStore';
import { getChainById } from '../../lib/chains';
import { useContent } from '../../hooks/useContent';

export const ActivityLog: React.FC = () => {
  const { t } = useContent();
  const { mode } = useMarketStore();
  const { activities } = useActivityStore();
  const { selectedChainId } = useChainStore();
  const [filter, setFilter] = React.useState<'all' | 'trade' | 'liquidity' | 'settle'>('all');
  
  const chain = getChainById(selectedChainId);
  const explorerUrl = chain?.explorerUrl || 'https://sepolia.basescan.org';

  const allActivities = activities.filter(item => 
    item.mode === mode && (item.mode === 'demo' || item.chainId === undefined || item.chainId === selectedChainId)
  );

  const displayActivities = allActivities.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'settle') return item.type === 'settle' || item.type === 'dispute';
    return item.type === filter;
  });

  const FilterButton = ({ label, value }: { label: string, value: typeof filter }) => (
    <button
      onClick={() => setFilter(value)}
      className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
        filter === value 
          ? 'bg-indigo-500 text-white' 
          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-indigo-400" />
          <h3 className="font-heading font-semibold text-white">{t('activity.title')}</h3>
        </div>
        <div className="flex gap-1">
          <FilterButton label={t('activity.filterAll')} value="all" />
          <FilterButton label={t('activity.filterTrade')} value="trade" />
          <FilterButton label={t('activity.filterLP')} value="liquidity" />
          <FilterButton label={t('activity.filterSettle')} value="settle" />
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {displayActivities.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-4">
            {filter === 'all' ? t('activity.noActivity') : t('activity.noActivityFilter')}
          </div>
        ) : (
          displayActivities.map((item) => (
            <div key={item.id} className="flex gap-3 items-start group animate-fade-in">
              <div className={`mt-1 w-2 h-2 rounded-full ${
                item.type === 'trade' ? 'bg-emerald-400' :
                item.type === 'settle' ? 'bg-indigo-400' :
                item.type === 'dispute' ? 'bg-rose-400' : 'bg-amber-400'
              }`} />
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-medium text-slate-200 truncate pr-2">{item.description}</p>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{item.time}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{item.market}</p>
                {item.hash && (
                  <a 
                    href={`${explorerUrl}/tx/${item.hash}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-400/60 hover:text-indigo-400 transition-colors"
                  >
                    {t('activity.viewTx')}
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
