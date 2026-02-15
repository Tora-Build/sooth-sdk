import { useQuery } from '@tanstack/react-query';
import { MonadProvider } from '../lib/providers/monad';

export type { Market } from '../lib/providers/types';

const monadProvider = new MonadProvider();

/**
 * Fetch markets from Monad chain via indexer or RPC
 */
export function useMarkets() {
  return useQuery({
    queryKey: ['markets', 'monad'],
    queryFn: async () => {
      return await monadProvider.fetchMarkets();
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
