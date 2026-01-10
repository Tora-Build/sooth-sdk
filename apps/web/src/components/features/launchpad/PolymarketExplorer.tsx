import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  ExternalLink,
  Clock,
  Filter,
  ArrowUpDown,
  Check,
  Rocket,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

// ============================================================================
// Types
// ============================================================================

interface PolymarketTag {
  id: string;
  label: string;
  slug: string;
}

interface PolymarketMarket {
  id: string;
  question: string;
  outcomePrices: string[];
  outcomes: string[];
  description?: string;
  volume?: string;
  volumeNum?: number;
  volume24hr?: number;
  liquidity?: string;
  liquidityNum?: number;
}

interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  endDate: string;
  liquidity: string;
  volume: string;
  volume24hr: number;
  active: boolean;
  closed: boolean;
  image?: string;
  tags?: PolymarketTag[];
  markets?: PolymarketMarket[];
}

export interface NormalizedMarket {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  volume24h: number;
  liquidity: number;
  endDate: string;
  endDateTs: number;
  status: 'active' | 'closed' | 'pending';
  url: string;
  category: CategoryKey;
  categoryLabel: string;
  /** Resolution rules/criteria from Polymarket */
  description: string | null;
  rawData: PolymarketEvent;
}

// ============================================================================
// Categories Configuration
// ============================================================================

const CATEGORIES = {
  politics: { id: '2', label: 'Politics', color: 'blue' },
  sports: { id: '1', label: 'Sports', color: 'emerald' },
  crypto: { id: '21', label: 'Crypto', color: 'orange' },
  world: { id: '101970', label: 'World', color: 'violet' },
  popCulture: { id: '596', label: 'Pop Culture', color: 'pink' },
  economy: { id: '100328', label: 'Economy', color: 'amber' },
} as const;

type CategoryKey = keyof typeof CATEGORIES;

// Map Polymarket categories to Sooth categories
const CATEGORY_TO_SOOTH: Record<CategoryKey, string> = {
  politics: 'politics',
  sports: 'sports',
  crypto: 'crypto',
  world: 'custom',
  popCulture: 'custom',
  economy: 'custom',
};

const CATEGORY_COLORS: Record<string, string> = {
  blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30',
  orange: 'bg-orange-500/20 text-orange-300 border-orange-500/30 hover:bg-orange-500/30',
  violet: 'bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/30',
  pink: 'bg-pink-500/20 text-pink-300 border-pink-500/30 hover:bg-pink-500/30',
  amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30',
};

// ============================================================================
// Sort Options
// ============================================================================

type SortField = 'volume24h' | 'volume' | 'liquidity' | 'endDate' | 'marketsCount';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: { field: SortField; label: string; defaultDir: SortDirection }[] = [
  { field: 'volume24h', label: '24h Volume', defaultDir: 'desc' },
  { field: 'volume', label: 'Total Volume', defaultDir: 'desc' },
  { field: 'liquidity', label: 'Liquidity', defaultDir: 'desc' },
  { field: 'marketsCount', label: 'Markets', defaultDir: 'desc' },
  { field: 'endDate', label: 'End Date', defaultDir: 'asc' },
];

// ============================================================================
// API Functions
// ============================================================================

const POLYMARKET_API = '/api/polymarket';

function parseJsonArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function fetchEventsByCategory(
  categoryKey: CategoryKey,
  limit = 20
): Promise<NormalizedMarket[]> {
  const category = CATEGORIES[categoryKey];
  // Fetch events (not markets) - events have correct slugs for URLs
  const url = `${POLYMARKET_API}/events?tag_id=${category.id}&active=true&closed=false&order=volume24hr&ascending=false&limit=${limit + 10}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const rawEvents = await response.json();
  const now = Date.now();

  const events = rawEvents
    .map((e: Record<string, unknown>): NormalizedMarket | null => {
      const tags = (e.tags as PolymarketTag[]) || [];
      const markets = (e.markets as PolymarketMarket[]) || [];
      const endDate = e.endDate as string;
      const endDateTs = endDate ? new Date(endDate).getTime() : Infinity;

      // Filter out events that have ended
      if (endDateTs < now) {
        return null;
      }

      // Get YES/NO prices and description from first market in the event (if binary)
      let yesPrice = 50;
      let noPrice = 50;
      let description: string | null = null;
      if (markets.length > 0) {
        const firstMarket = markets[0];
        const outcomePrices = parseJsonArray(firstMarket.outcomePrices as unknown as string);
        yesPrice = parseFloat(outcomePrices[0] || '0.5') * 100;
        noPrice = parseFloat(outcomePrices[1] || '0.5') * 100;
        description = firstMarket.description || null;
      }

      const slug = e.slug as string;
      // Direct URL using event slug - this works!
      const eventUrl = `https://polymarket.com/event/${slug}`;

      return {
        id: e.id as string,
        question: e.title as string,
        yesPrice,
        noPrice,
        volume: parseFloat((e.volume as string) || '0'),
        volume24h: (e.volume24hr as number) || 0,
        liquidity: parseFloat((e.liquidity as string) || '0'),
        endDate,
        endDateTs,
        status: e.closed ? 'closed' : e.active ? 'active' : 'pending',
        url: eventUrl,
        category: categoryKey,
        categoryLabel: category.label,
        description,
        rawData: {
          id: e.id as string,
          title: e.title as string,
          slug,
          endDate,
          liquidity: e.liquidity as string,
          volume: e.volume as string,
          volume24hr: e.volume24hr as number,
          active: e.active as boolean,
          closed: e.closed as boolean,
          image: e.image as string,
          tags,
          markets,
        },
      };
    })
    .filter((e: NormalizedMarket | null): e is NormalizedMarket => e !== null)
    .slice(0, limit);

  return events;
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatVolume(value: number): string {
  if (value >= 1e6) {
    // For millions: show 1 decimal if < 10M, otherwise whole number
    const millions = value / 1e6;
    return millions >= 10 ? `$${Math.round(millions)}M` : `$${millions.toFixed(1)}M`;
  }
  if (value >= 1e3) {
    // For thousands: show 1 decimal if < 100K, otherwise whole
    const thousands = value / 1e3;
    return thousands >= 100 ? `$${Math.round(thousands)}K` : `$${thousands.toFixed(1)}K`;
  }
  return `$${Math.round(value)}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Open';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Ended';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `${diffDays}d`;
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)}w`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// Components
// ============================================================================

function CategoryBadge({
  categoryKey,
  selected,
  onClick,
  count,
}: {
  categoryKey: CategoryKey;
  selected: boolean;
  onClick: () => void;
  count: number;
}) {
  const category = CATEGORIES[categoryKey];

  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1',
        selected
          ? CATEGORY_COLORS[category.color]
          : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700/50'
      )}
    >
      {selected && <Check className="w-2.5 h-2.5" />}
      {category.label}
      <span className="opacity-60">({count})</span>
    </button>
  );
}

function SortDropdown({
  sortField,
  sortDir,
  onChange,
}: {
  sortField: SortField;
  sortDir: SortDirection;
  onChange: (field: SortField, dir: SortDirection) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentOption = SORT_OPTIONS.find((o) => o.field === sortField);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 transition-all"
      >
        <ArrowUpDown className="w-3 h-3" />
        {currentOption?.label}
        <span className="text-slate-500">{sortDir === 'desc' ? '↓' : '↑'}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[160px]">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.field}
                onClick={() => {
                  const newDir =
                    option.field === sortField
                      ? sortDir === 'desc'
                        ? 'asc'
                        : 'desc'
                      : option.defaultDir;
                  onChange(option.field, newDir);
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-xs hover:bg-slate-800 transition-colors flex items-center justify-between',
                  option.field === sortField ? 'text-cyan-400' : 'text-slate-300'
                )}
              >
                {option.label}
                {option.field === sortField && (
                  <span className="text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MarketCard({
  market,
  isSelected,
  onSelect,
  onUse,
  showUseButton,
}: {
  market: NormalizedMarket;
  isSelected: boolean;
  onSelect: (m: NormalizedMarket) => void;
  onUse?: (m: NormalizedMarket) => void;
  showUseButton: boolean;
}) {
  const category = CATEGORIES[market.category];
  const marketsCount = market.rawData.markets?.length || 0;

  return (
    <div
      className={cn(
        'p-3 rounded-xl border transition-all cursor-pointer',
        'bg-slate-900/50 hover:bg-slate-800/50',
        isSelected
          ? 'border-cyan-500/50 ring-1 ring-cyan-500/30'
          : 'border-slate-700/50 hover:border-slate-600'
      )}
      onClick={() => onSelect(market)}
    >
      <div className="flex items-start gap-2 mb-2">
        <span
          className={cn(
            'px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0',
            CATEGORY_COLORS[category.color]
          )}
        >
          {category.label}
        </span>
        <h3 className="text-xs font-medium text-white line-clamp-2 flex-1">
          {market.question}
        </h3>
      </div>

      <div className="flex items-center gap-3 text-[10px] flex-wrap">
        <div className="text-slate-400" title="24h Volume">
          <span className="text-slate-500">24h:</span>
          <span className="font-mono ml-0.5">{formatVolume(market.volume24h)}</span>
        </div>

        <div className="text-slate-400" title="Total Volume">
          <span className="text-slate-500">Vol:</span>
          <span className="font-mono ml-0.5">{formatVolume(market.volume)}</span>
        </div>

        <div className="text-slate-400" title="Liquidity">
          <span className="text-slate-500">Liq:</span>
          <span className="font-mono ml-0.5">{formatVolume(market.liquidity)}</span>
        </div>

        <div className="text-slate-500" title="End Date">
          <span>{formatDate(market.endDate)}</span>
        </div>

        {marketsCount > 0 && (
          <div
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded border",
              marketsCount > 1
                ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                : "bg-slate-700/30 text-slate-400 border-slate-600/30"
            )}
            title={`${marketsCount} market${marketsCount !== 1 ? 's' : ''} in this event`}
          >
            <span className="font-bold">{marketsCount}</span>
            <span className={marketsCount > 1 ? "text-violet-400" : "text-slate-500"}>mkt{marketsCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        {market.description && (
          <div className="flex items-center gap-1 text-slate-500" title="Has resolution rules">
            <FileText className="w-2.5 h-2.5" />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {showUseButton && onUse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUse(market);
              }}
              className="px-2 py-1 rounded-md bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-all flex items-center gap-1"
            >
              <Rocket className="w-2.5 h-2.5" />
              Use
            </button>
          )}
          <a
            href={market.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-slate-400 hover:text-white transition-colors"
            title="View on Polymarket"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Props
// ============================================================================

export interface PolymarketSelectData {
  question: string;
  category: string;
  /** ISO datetime string or null for open-ended */
  expiration: string | null;
  /** Days until expiration (for smart mode selection) */
  daysUntilExpiration: number | null;
  /** Polymarket liquidity in USD */
  liquidity: number;
  /** Polymarket 24h volume in USD */
  volume24h: number;
  /** Current YES probability (0-100) */
  yesPrice: number;
  /** Polymarket URL for reference */
  polymarketUrl: string;
  /** Resolution rules/criteria from Polymarket */
  description: string | null;
}

export interface PolymarketExplorerProps {
  /** Called when user clicks "Use This" button */
  onSelectMarket?: (data: PolymarketSelectData) => void;
  /** Compact mode for drawer view */
  compact?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export const PolymarketExplorer = ({ onSelectMarket, compact = false }: PolymarketExplorerProps) => {
  const [allMarkets, setAllMarkets] = useState<NormalizedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<NormalizedMarket | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<CategoryKey>>(
    new Set(Object.keys(CATEGORIES) as CategoryKey[])
  );

  // Sort
  const [sortField, setSortField] = useState<SortField>('volume24h');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  // Markets breakdown expanded state
  const [marketsExpanded, setMarketsExpanded] = useState(false);

  // Wrapper to reset expanded state when selecting a new market
  const handleSelectMarket = useCallback((market: NormalizedMarket) => {
    setSelectedMarket(market);
    setMarketsExpanded(false);
  }, []);

  const fetchAllMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const categoryKeys = Object.keys(CATEGORIES) as CategoryKey[];
      const results = await Promise.all(
        categoryKeys.map((key) => fetchEventsByCategory(key, 20))
      );

      // Flatten and dedupe by ID
      const marketMap = new Map<string, NormalizedMarket>();
      results.flat().forEach((m) => {
        if (!marketMap.has(m.id)) {
          marketMap.set(m.id, m);
        }
      });

      setAllMarkets(Array.from(marketMap.values()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllMarkets();
  }, [fetchAllMarkets]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryKey, number> = {} as Record<CategoryKey, number>;
    (Object.keys(CATEGORIES) as CategoryKey[]).forEach((key) => {
      counts[key] = allMarkets.filter((m) => m.category === key).length;
    });
    return counts;
  }, [allMarkets]);

  // Filter and sort markets
  const displayedMarkets = useMemo(() => {
    let markets = allMarkets;

    // Filter by category
    markets = markets.filter((m) => selectedCategories.has(m.category));

    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      markets = markets.filter((m) => m.question.toLowerCase().includes(term));
    }

    // Sort
    markets = [...markets].sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortField) {
        case 'volume24h':
          aVal = a.volume24h;
          bVal = b.volume24h;
          break;
        case 'volume':
          aVal = a.volume;
          bVal = b.volume;
          break;
        case 'liquidity':
          aVal = a.liquidity;
          bVal = b.liquidity;
          break;
        case 'marketsCount':
          aVal = a.rawData.markets?.length || 0;
          bVal = b.rawData.markets?.length || 0;
          break;
        case 'endDate':
          aVal = a.endDateTs;
          bVal = b.endDateTs;
          break;
        default:
          aVal = a.volume24h;
          bVal = b.volume24h;
      }

      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return markets;
  }, [allMarkets, selectedCategories, searchTerm, sortField, sortDir]);

  const toggleCategory = (key: CategoryKey) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) {
          next.delete(key);
        }
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllCategories = () => {
    setSelectedCategories(new Set(Object.keys(CATEGORIES) as CategoryKey[]));
  };

  const handleUseMarket = (market: NormalizedMarket) => {
    if (!onSelectMarket) return;

    // Convert to ISO datetime-local format for the input
    let expiration: string | null = null;
    let daysUntilExpiration: number | null = null;

    if (market.endDate) {
      const date = new Date(market.endDate);
      // Format: YYYY-MM-DDTHH:mm
      expiration = date.toISOString().slice(0, 16);
      daysUntilExpiration = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }

    onSelectMarket({
      question: market.question,
      category: CATEGORY_TO_SOOTH[market.category],
      expiration,
      daysUntilExpiration,
      liquidity: market.liquidity,
      volume24h: market.volume24h,
      yesPrice: market.yesPrice,
      polymarketUrl: market.url,
      description: market.description,
    });
  };

  // Helper: format time remaining with precision
  const formatTimeRemaining = (endDateTs: number): { text: string; urgent: boolean } => {
    const now = Date.now();
    const diff = endDateTs - now;
    if (diff <= 0) return { text: 'Ended', urgent: true };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 30) {
      const months = Math.floor(days / 30);
      return { text: `${months} month${months > 1 ? 's' : ''}`, urgent: false };
    }
    if (days > 7) {
      const weeks = Math.floor(days / 7);
      return { text: `${weeks} week${weeks > 1 ? 's' : ''}`, urgent: false };
    }
    if (days > 0) {
      return { text: `${days}d ${hours}h`, urgent: days <= 3 };
    }
    if (hours > 0) {
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return { text: `${hours}h ${mins}m`, urgent: true };
    }
    const mins = Math.floor(diff / (1000 * 60));
    return { text: `${mins} minutes`, urgent: true };
  };

  // Helper: calculate activity level
  const getActivityLevel = (volume24h: number, liquidity: number): { label: string; color: string } => {
    if (liquidity === 0) return { label: 'New', color: 'text-slate-400' };
    const ratio = volume24h / liquidity;
    if (ratio > 0.5) return { label: 'Very High', color: 'text-emerald-400' };
    if (ratio > 0.2) return { label: 'High', color: 'text-cyan-400' };
    if (ratio > 0.05) return { label: 'Moderate', color: 'text-amber-400' };
    return { label: 'Low', color: 'text-slate-400' };
  };

  // Side panel content for selected market
  const MarketDetailsPanel = () => {
    if (!selectedMarket) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
            <Search className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-sm text-slate-400 mb-1">Select a market</p>
          <p className="text-xs text-slate-500">Click any market to see details</p>
        </div>
      );
    }

    const timeRemaining = selectedMarket.endDateTs !== Infinity
      ? formatTimeRemaining(selectedMarket.endDateTs)
      : null;
    const activity = getActivityLevel(selectedMarket.volume24h, selectedMarket.liquidity);
    const numMarkets = selectedMarket.rawData.markets?.length || 0;
    const tags = selectedMarket.rawData.tags || [];

    return (
      <div className="space-y-4">
        {/* Event Image */}
        {selectedMarket.rawData.image && (
          <div className="relative h-32 rounded-t-xl overflow-hidden">
            <img
              src={selectedMarket.rawData.image}
              alt={selectedMarket.question}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
            {/* Time Badge */}
            {timeRemaining && (
              <div className={cn(
                'absolute top-2 right-2 px-2 py-1 rounded-md text-[10px] font-bold backdrop-blur-sm',
                timeRemaining.urgent
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-slate-800/80 text-slate-300 border border-slate-700/50'
              )}>
                <Clock className="w-3 h-3 inline mr-1" />
                {timeRemaining.text}
              </div>
            )}
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Title */}
          <h3 className="font-bold text-white text-base leading-snug">{selectedMarket.question}</h3>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 5).map((tag) => (
                <span
                  key={tag.id}
                  className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800/50 text-slate-400 border border-slate-700/50"
                >
                  {tag.label}
                </span>
              ))}
              {tags.length > 5 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] text-slate-500">
                  +{tags.length - 5} more
                </span>
              )}
            </div>
          )}

          {/* Time remaining (if no image) */}
          {!selectedMarket.rawData.image && timeRemaining && (
            <div className={cn(
              'flex items-center justify-between p-2 rounded-lg',
              timeRemaining.urgent ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-slate-800/30'
            )}>
              <span className="text-xs text-slate-400">Time Remaining</span>
              <span className={cn(
                'text-sm font-mono font-bold',
                timeRemaining.urgent ? 'text-rose-400' : 'text-white'
              )}>
                {timeRemaining.text}
              </span>
            </div>
          )}

          {/* Stats Grid - 3 columns */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">24h Vol</div>
              <div className="text-xs text-white font-mono font-bold">{formatVolume(selectedMarket.volume24h)}</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">Total Vol</div>
              <div className="text-xs text-white font-mono font-bold">{formatVolume(selectedMarket.volume)}</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">Liquidity</div>
              <div className="text-xs text-white font-mono font-bold">{formatVolume(selectedMarket.liquidity)}</div>
            </div>
          </div>

          {/* Activity & Category Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">Activity</div>
              <div className={cn('text-xs font-bold', activity.color)}>{activity.label}</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">Category</div>
              <div className="text-xs text-white font-medium">{selectedMarket.categoryLabel}</div>
            </div>
          </div>

          {/* Markets breakdown - collapsible for all events */}
          {numMarkets > 0 && (
            <div className={cn(
              "rounded-lg border overflow-hidden",
              numMarkets > 1
                ? "bg-violet-500/10 border-violet-500/20"
                : "bg-slate-800/30 border-slate-700/30"
            )}>
              <button
                onClick={() => setMarketsExpanded(!marketsExpanded)}
                className="w-full flex items-center justify-between p-2 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    numMarkets > 1 ? "bg-violet-500/20" : "bg-slate-700/50"
                  )}>
                    <span className={cn(
                      "text-xs font-bold",
                      numMarkets > 1 ? "text-violet-300" : "text-slate-400"
                    )}>{numMarkets}</span>
                  </div>
                  <span className={cn(
                    "text-xs",
                    numMarkets > 1 ? "text-violet-300" : "text-slate-400"
                  )}>
                    {numMarkets === 1 ? 'Market' : `${numMarkets} markets`}
                  </span>
                </div>
                {marketsExpanded
                  ? <ChevronUp className={cn("w-4 h-4", numMarkets > 1 ? "text-violet-400" : "text-slate-400")} />
                  : <ChevronDown className={cn("w-4 h-4", numMarkets > 1 ? "text-violet-400" : "text-slate-400")} />
                }
              </button>

              {/* Expanded market breakdown - for all events */}
              {marketsExpanded && selectedMarket.rawData.markets && (
                <div className={cn(
                  "border-t p-2 space-y-2",
                  numMarkets > 1 ? "border-violet-500/20" : "border-slate-700/30"
                )}>
                  {selectedMarket.rawData.markets.map((mkt, idx) => {
                    const prices = parseJsonArray(mkt.outcomePrices as unknown as string);
                    const yesPrice = parseFloat(prices[0] || '0.5') * 100;
                    const vol = mkt.volumeNum || parseFloat(mkt.volume || '0');
                    const liq = mkt.liquidityNum || parseFloat(mkt.liquidity || '0');

                    return (
                      <div
                        key={mkt.id || idx}
                        className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/30"
                      >
                        <div className="text-[10px] text-slate-300 mb-1.5 line-clamp-2">
                          {mkt.question}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* YES probability mini bar */}
                          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${yesPrice}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-emerald-400 w-10 text-right">
                            {yesPrice.toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-400">
                          <span title="Total Volume"><span className="text-slate-500">Vol:</span> {formatVolume(vol)}</span>
                          <span title="Liquidity"><span className="text-slate-500">Liq:</span> {formatVolume(liq)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* End Date Details */}
          {selectedMarket.endDate && (
            <div className="p-2 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Resolves</span>
                <span className="text-xs text-white font-mono">
                  {new Date(selectedMarket.endDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Resolution Rules */}
          {selectedMarket.description && (
            <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Resolution Rules
              </div>
              <div className="text-xs text-slate-300 leading-relaxed break-words">
                {selectedMarket.description}
              </div>
            </div>
          )}

          {/* Action Link */}
          <a
            href={selectedMarket.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all text-sm font-medium"
          >
            View on Polymarket
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  };

  // Compact mode layout (for drawer)
  if (compact) {
    return (
      <div className="space-y-4">
        {/* Search & Sort Row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <SortDropdown
            sortField={sortField}
            sortDir={sortDir}
            onChange={(field, dir) => {
              setSortField(field);
              setSortDir(dir);
            }}
          />
          <button
            onClick={fetchAllMarkets}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="w-3 h-3 text-slate-500" />
          <button
            onClick={selectAllCategories}
            className={cn(
              'px-2 py-1 rounded-lg text-[10px] font-medium border transition-all',
              selectedCategories.size === Object.keys(CATEGORIES).length
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700/50'
            )}
          >
            All
          </button>
          {(Object.keys(CATEGORIES) as CategoryKey[]).map((key) => (
            <CategoryBadge
              key={key}
              categoryKey={key}
              selected={selectedCategories.has(key)}
              onClick={() => toggleCategory(key)}
              count={categoryCounts[key]}
            />
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="text-xs text-slate-400">
          {displayedMarkets.length} event{displayedMarkets.length !== 1 ? 's' : ''}
          {searchTerm && ` matching "${searchTerm}"`}
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />
            </div>
          ) : displayedMarkets.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No events found. Try adjusting filters.
            </div>
          ) : (
            displayedMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                isSelected={selectedMarket?.id === market.id}
                onSelect={handleSelectMarket}
                onUse={handleUseMarket}
                showUseButton={!!onSelectMarket}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // Full page layout with side panel
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white mb-2">Polymarket Explorer</h1>
        <p className="text-slate-400">
          Browse {allMarkets.length} events across{' '}
          {Object.keys(CATEGORIES).length} categories
        </p>
      </div>

      {/* Two-Column Layout - 55/45 split for wider side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        {/* Left Column - Market List */}
        <div className="space-y-4">
          {/* Search & Sort Row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search markets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <SortDropdown
              sortField={sortField}
              sortDir={sortDir}
              onChange={(field, dir) => {
                setSortField(field);
                setSortDir(dir);
              }}
            />
            <button
              onClick={fetchAllMarkets}
              disabled={loading}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-all"
            >
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="w-3 h-3 text-slate-500" />
            <button
              onClick={selectAllCategories}
              className={cn(
                'px-2 py-1 rounded-lg text-[10px] font-medium border transition-all',
                selectedCategories.size === Object.keys(CATEGORIES).length
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700/50'
              )}
            >
              All
            </button>
            {(Object.keys(CATEGORIES) as CategoryKey[]).map((key) => (
              <CategoryBadge
                key={key}
                categoryKey={key}
                selected={selectedCategories.has(key)}
                onClick={() => toggleCategory(key)}
                count={categoryCounts[key]}
              />
            ))}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="text-xs text-slate-400">
            {displayedMarkets.length} event{displayedMarkets.length !== 1 ? 's' : ''}
            {searchTerm && ` matching "${searchTerm}"`}
          </div>

          {/* Event List */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />
              </div>
            ) : displayedMarkets.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No events found. Try adjusting filters.
              </div>
            ) : (
              displayedMarkets.map((market) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  isSelected={selectedMarket?.id === market.id}
                  onSelect={handleSelectMarket}
                  onUse={handleUseMarket}
                  showUseButton={!!onSelectMarket}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 text-[10px] text-slate-500">
            Data Source: Polymarket Gamma API — Top 20 events per category by 24h volume
          </div>
        </div>

        {/* Right Column - Details Side Panel */}
        <div>
          <div className="rounded-xl bg-slate-900/50 border border-slate-700/50 min-h-[300px] overflow-hidden">
            <MarketDetailsPanel />
          </div>
        </div>
      </div>
    </div>
  );
};
