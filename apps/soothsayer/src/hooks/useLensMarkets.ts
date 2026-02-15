/**
 * Lens Markets Hook
 * 
 * Fetches prediction market posts from Lens Protocol
 */

import { useQuery } from '@tanstack/react-query';
import { getProvider } from '../lib/providers';

export function useLensMarkets() {
  return useQuery({
    queryKey: ['lens-markets'],
    queryFn: async () => {
      const provider = getProvider('lens');
      return await provider.fetchMarkets();
    },
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // 1 minute
  });
}
