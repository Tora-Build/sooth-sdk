import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useMarketStore } from '../../../store/useMarketStore';
import { cn } from '../../../lib/utils';
import { Badge } from '../../ui/Badge';

interface MarketSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export const MarketSelector: React.FC<MarketSelectorProps> = ({ selectedId, onSelect }) => {
  const { markets, mode } = useMarketStore();
  const [isOpen, setIsOpen] = React.useState(false);
  
  // Filter markets based on current mode
  const filteredMarkets = markets.filter(m => m.mode === mode);
  
  const selectedMarket = filteredMarkets.find(m => m.id === selectedId);

  return (
    <div className="relative z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full md:w-[400px] p-3 bg-slate-900/50 border border-slate-800 rounded-xl hover:bg-slate-900 transition-colors"
      >
        <div className="flex flex-col items-start text-left">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Active Market</span>
          <span className="font-medium text-slate-200 truncate max-w-[300px]">{selectedMarket?.question}</span>
        </div>
        <ChevronDown className={cn("text-slate-500 transition-transform", isOpen && "rotate-180")} size={20} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 p-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl animate-fade-in">
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {filteredMarkets.map(market => (
              <button
                key={market.id}
                onClick={() => {
                  onSelect(market.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full p-3 rounded-lg text-left transition-colors flex items-center justify-between group",
                  selectedId === market.id ? "bg-indigo-500/10 border border-indigo-500/20" : "hover:bg-slate-800"
                )}
              >
                <div className="flex flex-col">
                  <span className={cn("text-sm font-medium", selectedId === market.id ? "text-indigo-300" : "text-slate-300 group-hover:text-white")}>
                    {market.question}
                  </span>
                  <span className="text-xs text-slate-500">Vol: $12.4k • Ends Dec 31</span>
                </div>
                {market.status === 'trading' && <Badge variant="success" className="scale-90">Live</Badge>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
