import { useState, useMemo } from 'react';
import { Drawer } from 'vaul';
import { Search, X, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Market } from '../hooks/useMarkets';

interface SearchSheetProps {
  markets: Market[];
}

export function SearchSheet({ markets }: SearchSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const filteredMarkets = useMemo(() => {
    if (!query.trim()) return markets.slice(0, 5);
    const lower = query.toLowerCase();
    return markets.filter((m) => m.question.toLowerCase().includes(lower)).slice(0, 10);
  }, [markets, query]);

  const handleSelect = (market: Market) => {
    setOpen(false);
    setQuery('');
    navigate(`/trade/${market.address}`);
  };

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button className="fixed bottom-24 right-5 z-50 w-12 h-12 rounded-full glass glass-border flex items-center justify-center transition-all active:scale-90">
          <Search className="w-5 h-5 text-white" />
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 glass rounded-t-3xl outline-none max-h-[85vh] flex flex-col border-t border-white/5">
          <div className="p-5 border-b border-white/5">
            <div className="mx-auto w-10 h-1 rounded-full bg-white/20 mb-5" />
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search markets..."
                className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-black/50 border border-white/10 text-white placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-colors"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/10"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!query && (
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-text-secondary text-sm font-medium">Hot</span>
              </div>
            )}

            {filteredMarkets.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-muted">No markets found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMarkets.map((market) => {
                  const yesPercent = Math.round((market.yesProbability ?? 0.5) * 100);
                  return (
                    <button
                      key={market.address}
                      onClick={() => handleSelect(market)}
                      className="w-full p-4 rounded-2xl bg-black/30 border border-white/5 text-left transition-all active:scale-[0.98] active:bg-white/5"
                    >
                      <p className="text-white font-medium line-clamp-2 mb-3 leading-snug">
                        {market.question}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-yes text-sm font-bold tabular-nums">
                            {yesPercent}¢
                          </span>
                          <span className="text-text-muted text-xs">YES</span>
                        </div>
                        <span className="text-text-muted text-xs uppercase tracking-wide">
                          {market.stage}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
