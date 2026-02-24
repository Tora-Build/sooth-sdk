import { useQuery } from '@tanstack/react-query';
import { fetchFromIndexer } from './config';
import type { LaunchpadMarket } from '../../types';

const CHAINS = [
  { id: 84532, name: 'Base Sepolia' },
  { id: 10143, name: 'Monad Testnet' },
];

export function useLaunchpadMarkets() {
  const query = useQuery({
    queryKey: ['launchpad-markets', 'all-chains'],
    queryFn: async () => {
      const results = await Promise.allSettled(
        CHAINS.map(async (chain) => {
          const data = await fetchFromIndexer<any[]>(`/launchpad-markets/${chain.id}`);
          if (!data) return { chain, markets: [] };
          // Filter to graduated only (bonding filtered out)
          const graduated = data
            .filter((m: any) => m.isGraduated === true)
            .map((m: any) => ({ ...m, network: chain.name }));
          return { chain, markets: graduated as LaunchpadMarket[] };
        })
      );

      const markets: LaunchpadMarket[] = [];
      const chainErrors: Record<string, string> = {};

      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          markets.push(...result.value.markets);
        } else {
          chainErrors[CHAINS[i].name] = result.reason?.message ?? 'RPC error';
        }
      });

      return { markets, chainErrors };
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });

  return {
    markets: query.data?.markets ?? [],
    chainErrors: query.data?.chainErrors ?? {},
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
