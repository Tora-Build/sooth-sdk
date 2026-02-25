import { useQuery } from '@tanstack/react-query';
import { fetchFromIndexer } from './config';
import type { LaunchpadMarket } from '../../types';
import { INSTANCES } from '../../config/deployments';

export function useLaunchpadMarkets() {
  const query = useQuery({
    queryKey: ['launchpad-markets', 'all-chains'],
    queryFn: async () => {
      const results = await Promise.allSettled(
        INSTANCES.map(async (instance) => {
          const data = await fetchFromIndexer<any[]>(`/launchpad-markets/${instance.chainId}`);
          if (!data) return { instance, markets: [] };
          // Filter to graduated only (bonding filtered out)
          const graduated = data
            .filter((m: any) => m.isGraduated === true)
            .map((m: any) => ({
              ...m,
              network: instance.chainName,
              soothBookAddress: instance.soothBook,
            }));
          return { instance, markets: graduated as LaunchpadMarket[] };
        })
      );

      const markets: LaunchpadMarket[] = [];
      const chainErrors: Record<string, string> = {};

      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          markets.push(...result.value.markets);
        } else {
          chainErrors[INSTANCES[i].chainName] = result.reason?.message ?? 'RPC error';
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
