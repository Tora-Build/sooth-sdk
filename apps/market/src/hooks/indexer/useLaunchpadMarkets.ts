import { useQuery } from '@tanstack/react-query';
import { fetchFromIndexer } from './config';

interface LaunchpadMarketRaw {
  address: string;
  chainId: number;
  creator: string;
  isGraduated: boolean;
  deposit: string;
  isSettled: boolean;
  isFinalized: boolean;
  yesProbability?: number;
  yesReserves?: string;
  noReserves?: string;
}

interface LaunchpadMarket extends LaunchpadMarketRaw {}

const CHAIN_ID = 84532;

export function useLaunchpadMarkets() {
  const query = useQuery({
    queryKey: ['launchpad-markets', CHAIN_ID],
    queryFn: async () => {
      const data = await fetchFromIndexer<LaunchpadMarketRaw[]>(
        `/launchpad-markets/${CHAIN_ID}`
      );
      if (!data) return [];
      return data.filter((m) => m.isGraduated === true) as LaunchpadMarket[];

    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });

  return {
    markets: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
