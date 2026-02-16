import { Market } from '../types';
import { SortOption, FilterOption } from '../components/features/trader/MarketFilters';

export function searchMarkets(markets: Market[], query: string): Market[] {
  if (!query.trim()) return markets;
  
  const lowerQuery = query.toLowerCase();
  return markets.filter(market => 
    (market.question ?? '').toLowerCase().includes(lowerQuery) ||
    market.name.toLowerCase().includes(lowerQuery)
  );
}

export function filterMarkets(markets: Market[], filter: FilterOption): Market[] {
  if (filter === 'all') return markets;
  return markets.filter(market => market.status === filter);
}

export function sortMarkets(markets: Market[], sortBy: SortOption): Market[] {
  const sorted = [...markets];
  
  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'id':
      return sorted.sort((a, b) => (a.id_numeric || 999) - (b.id_numeric || 999));
    case 'status':
      const statusOrder: Record<string, number> = { 'trading': 0, 'cooldown': 1, 'settled': 2 };
      return sorted.sort((a, b) => {
        const orderA = statusOrder[a.status] ?? 99;
        const orderB = statusOrder[b.status] ?? 99;
        return orderA - orderB;
      });
    case 'priceYes':
      return sorted.sort((a, b) => (b.priceYes || 0) - (a.priceYes || 0));
    case 'priceNo':
      return sorted.sort((a, b) => (b.priceNo || 0) - (a.priceNo || 0));
    case 'recent':
      // For now, maintain original order (could add timestamp later)
      return sorted;
    default:
      return sorted;
  }
}
