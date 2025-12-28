/**
 * MarketHeader - Unified header for AMM and Pro pages
 * 
 * Features:
 * - One-liner intro
 * - Search input
 * - Category filters
 */
import { Search, Zap, BookOpen } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../../lib/utils';

interface MarketHeaderProps {
  title: string;
  subtitle: string;
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  categories: { id: string; label: string; count?: number }[];
  marketCount: number;
}

export const MarketHeader = ({
  title,
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

  return (
    <div className="space-y-6">
      {/* Title + One-liner */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{title}</h1>
          <p className="text-slate-400 mt-1">{subtitle}</p>
        </div>
        
        {/* Page Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-xl border border-slate-800">
          <Link
            to="/v8"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              !isProPage 
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
                  ? isProPage 
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                    : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
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
