/**
 * MarketHeader - Unified header for AMM and Pro pages
 * 
 * Features:
 * - Title with expandable hint
 * - Search input
 * - Category filters
 */
import { useState } from 'react';
import { Search, Zap, BookOpen, HelpCircle, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../../lib/utils';

interface MarketHeaderProps {
  title: string;
  hint?: string;
  subtitle?: string; // deprecated, use hint
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  categories: { id: string; label: string; count?: number }[];
  marketCount: number;
}

export const MarketHeader = ({
  title,
  hint,
  subtitle,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
  marketCount,
}: MarketHeaderProps) => {
  const location = useLocation();
  const isProPage = location.pathname.startsWith('/pro');
  const isAmmPage = location.pathname.startsWith('/trade') || location.pathname === '/v8';
  const [showHint, setShowHint] = useState(false);

  const hintText = hint || subtitle;

  return (
    <div className="space-y-4">
      {/* Title + Toggle */}
      <div className="flex items-center justify-between gap-4">
        {/* Title with hint icon */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          {hintText && (
            <button
              onClick={() => setShowHint(!showHint)}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                showHint
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
              )}
            >
              {showHint ? <X className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Page Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-xl border border-slate-800">
          <Link
            to="/trade"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              isAmmPage
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <Zap className="w-4 h-4" />
            AMM
          </Link>
          <Link
            to="/pro"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              isProPage
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <BookOpen className="w-4 h-4" />
            Pro
          </Link>
        </div>
      </div>

      {/* Expandable Hint */}
      {showHint && hintText && (
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-sm text-slate-400 leading-relaxed">
          {hintText}
        </div>
      )}

      {/* Search + Categories + Count (all inline) */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Left side: Search + Count */}
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search markets..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-700 transition-colors"
            />
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            <span className="text-white font-medium">{marketCount}</span> market{marketCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Right side: Categories */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg border border-slate-800">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                category === cat.id
                  ? isAmmPage
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              {cat.label} {cat.count !== undefined && `(${cat.count})`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MarketHeader;
