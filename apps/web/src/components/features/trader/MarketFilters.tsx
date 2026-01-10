import React from 'react';
import { ArrowUpDown, Filter } from 'lucide-react';

export type SortOption = 'name' | 'priceYes' | 'priceNo' | 'recent' | 'id' | 'status';
export type FilterOption = 'all' | 'trading' | 'cooldown' | 'settled';

interface MarketFiltersProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  filterBy: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
}

export const MarketFilters: React.FC<MarketFiltersProps> = ({
  sortBy,
  onSortChange,
  filterBy,
  onFilterChange,
}) => {
  return (
    <div className="flex items-center gap-3">
      {/* Sort Dropdown */}
      <div className="relative">
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="appearance-none bg-slate-900/50 border border-slate-800 rounded-lg pl-9 pr-8 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
        >
          <option value="name">Name</option>
          <option value="id">ID</option>
          <option value="status">Status</option>
          <option value="priceYes">YES Price</option>
          <option value="priceNo">NO Price</option>
          <option value="recent">Recent</option>
        </select>
        <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Filter Dropdown */}
      <div className="relative">
        <select
          value={filterBy}
          onChange={(e) => onFilterChange(e.target.value as FilterOption)}
          className="appearance-none bg-slate-900/50 border border-slate-800 rounded-lg pl-9 pr-8 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
        >
          <option value="all">All Markets</option>
          <option value="trading">Trading</option>
          <option value="cooldown">Cooldown</option>
          <option value="settled">Settled</option>
        </select>
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};
