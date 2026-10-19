import type { FactoryCatalogMarket } from '../../factory/schema.js';
import { parseSQFSafe } from '../../lib/sqf.js';
import type { SoothMarketSummary } from '../data.js';
import type { SoothStringKey } from '../ui/i18n.js';
import { tokenAmountToNumber } from '../ui/format.js';

export type SoothNodeFilter = 'open' | 'resolved' | 'all';
export type SoothNodeSort = 'ending' | 'newest' | 'liquidity';

/** Canonical category ids shared with the dApps; any other SQF category is shown verbatim. */
const KNOWN_CATEGORIES = [
  'sports',
  'tech',
  'finance',
  'cultures',
  'crypto',
  'politics',
  'weather',
] as const;
export const OTHER_CATEGORY = 'others';
const CATEGORY_LABELS: Readonly<Record<string, SoothStringKey>> = {
  sports: 'category.sports',
  tech: 'category.tech',
  finance: 'category.finance',
  cultures: 'category.cultures',
  crypto: 'category.crypto',
  politics: 'category.politics',
  weather: 'category.weather',
  [OTHER_CATEGORY]: 'category.others',
};

export interface SoothNodeEntry {
  item: FactoryCatalogMarket;
  question: string;
  /** Lowercase category id; `others` when the SQF names none. */
  category: string;
  /** The SQF category as written, for categories without a translated label. */
  categoryText: string;
}

export function nodeEntry(item: FactoryCatalogMarket): SoothNodeEntry {
  const parsed = parseSQFSafe(item.question);
  const written = parsed.category?.trim() ?? '';
  return {
    item,
    question: parsed.question.trim() || item.question,
    category: written ? written.toLowerCase() : OTHER_CATEGORY,
    categoryText: written,
  };
}

export function categoryLabel(
  entry: Pick<SoothNodeEntry, 'category' | 'categoryText'>,
  t: (key: SoothStringKey) => string,
): string {
  const key = CATEGORY_LABELS[entry.category];
  return key ? t(key) : entry.categoryText;
}

export function matchesFilter(item: FactoryCatalogMarket, filter: SoothNodeFilter): boolean {
  if (filter === 'all') return true;
  return filter === 'resolved' ? item.state.phase === 'settled' : item.tradingOpen === true;
}

export interface SoothNodeCategory {
  id: string;
  text: string;
  count: number;
}

/** Known categories first in the dApps' order, then other SQF categories, then `others`. */
export function nodeCategories(entries: readonly SoothNodeEntry[]): SoothNodeCategory[] {
  const counts = new Map<string, SoothNodeCategory>();
  for (const entry of entries) {
    const current = counts.get(entry.category);
    if (current) current.count++;
    else counts.set(entry.category, { id: entry.category, text: entry.categoryText, count: 1 });
  }
  const rank = (id: string) => {
    const known = (KNOWN_CATEGORIES as readonly string[]).indexOf(id);
    return known >= 0
      ? known
      : id === OTHER_CATEGORY
        ? KNOWN_CATEGORIES.length + 1
        : KNOWN_CATEGORIES.length;
  };
  return [...counts.values()].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

function deadlineOf(item: FactoryCatalogMarket): number {
  const value = Number(item.deadline);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Closing soon: upcoming deadlines first (nearest first), then past deadlines (latest first).
 * Newest: latest creation block first. Liquidity: largest live AMM collateral first; markets
 * without a summary yet keep their closing-soon order after them, so loading more summaries
 * only moves newly read markets up and never evicts a visible card.
 */
export function sortEntries(
  entries: readonly SoothNodeEntry[],
  sort: SoothNodeSort,
  summaries: ReadonlyMap<string, SoothMarketSummary>,
  now: number,
): SoothNodeEntry[] {
  const nowSeconds = now / 1000;
  const ending = (a: SoothNodeEntry, b: SoothNodeEntry) => {
    const left = deadlineOf(a.item);
    const right = deadlineOf(b.item);
    const leftOpen = left > nowSeconds;
    const rightOpen = right > nowSeconds;
    if (leftOpen !== rightOpen) return leftOpen ? -1 : 1;
    return (leftOpen ? left - right : right - left) || a.item.key.localeCompare(b.item.key);
  };
  const liquidity = (entry: SoothNodeEntry) => {
    const summary = summaries.get(entry.item.address.toLowerCase());
    if (!summary || summary.liquidityNative === null) return null;
    return tokenAmountToNumber(summary.liquidityNative, summary.tokenDecimals);
  };
  const compare =
    sort === 'newest'
      ? (a: SoothNodeEntry, b: SoothNodeEntry) =>
          b.item.creation.blockNumber - a.item.creation.blockNumber || ending(a, b)
      : sort === 'liquidity'
        ? (a: SoothNodeEntry, b: SoothNodeEntry) => {
            const left = liquidity(a);
            const right = liquidity(b);
            if (left === null || right === null)
              return left === right ? ending(a, b) : left === null ? 1 : -1;
            return right - left || ending(a, b);
          }
        : ending;
  return [...entries].sort(compare);
}
