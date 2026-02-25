import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http, parseAbi } from 'viem';
import { fetchFromIndexer } from './config';
import type { LaunchpadMarket } from '../../types';
import { getIndexedInstances, type SoothInstance } from '../../config/deployments';
import { getChain } from '@sooth/registry';
import { toViemChain } from '@sooth/registry/viem';

const LAUNCHPAD_V12_ABI = parseAbi([
  'function getMarkets() view returns (address[])',
  'function markets(address) view returns (address creator, address lpToken, uint256 bBase, uint256 bCurrent, uint256 creatorDeposit, uint256 feesAccrued, uint256 totalLPSupply, uint256 lpYieldPool, bool isGraduated, uint64 createdAt, uint64 graduatedAt)',
]);

const TRUTH_MARKET_ABI = parseAbi([
  'function question() view returns (string)',
  'function isSettled() view returns (bool)',
  'function isFinalized() view returns (bool)',
]);

async function fetchMarketsOnChain(instance: SoothInstance): Promise<LaunchpadMarket[]> {
  const chainMeta = getChain(instance.chainId);
  if (!chainMeta) return [];

  const viemChain = toViemChain(instance.chainId);
  const client = createPublicClient({
    chain: viemChain,
    transport: http(chainMeta.rpcUrls[0], { timeout: 15_000 }),
  });

  const addresses = await client.readContract({
    address: instance.launchpadEngine as `0x${string}`,
    abi: LAUNCHPAD_V12_ABI,
    functionName: 'getMarkets',
  }).catch(() => [] as readonly `0x${string}`[]);

  if (!addresses || addresses.length === 0) return [];

  const results = await Promise.allSettled(
    (addresses as `0x${string}`[]).map(async (addr) => {
      const state = await client.readContract({
        address: instance.launchpadEngine as `0x${string}`,
        abi: LAUNCHPAD_V12_ABI,
        functionName: 'markets',
        args: [addr],
      });

      // Destructure tuple by position: [creator, lpToken, bBase, bCurrent, creatorDeposit, feesAccrued, totalLPSupply, lpYieldPool, isGraduated, createdAt, graduatedAt]
      const [creator, , , , creatorDeposit, , , , isGraduated] = state;

      if (!isGraduated) return null;

      const [question, isSettled, isFinalized] = await Promise.all([
        client.readContract({ address: addr, abi: TRUTH_MARKET_ABI, functionName: 'question' }).catch(() => addr.slice(2, 10).toUpperCase()),
        client.readContract({ address: addr, abi: TRUTH_MARKET_ABI, functionName: 'isSettled' }).catch(() => false),
        client.readContract({ address: addr, abi: TRUTH_MARKET_ABI, functionName: 'isFinalized' }).catch(() => false),
      ]);

      return {
        address: addr,
        chainId: instance.chainId,
        network: instance.chainName,
        creator,
        isGraduated: true,
        isDismissed: false,
        deposit: creatorDeposit.toString(),
        isSettled: isSettled as boolean,
        isFinalized: isFinalized as boolean,
        question: question as string,
        soothBookAddress: instance.soothBook,
      } as LaunchpadMarket;
    })
  );

  return results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter((m): m is LaunchpadMarket => m !== null);
}

export function useLaunchpadMarkets() {
  const query = useQuery({
    queryKey: ['launchpad-markets', 'all-chains'],
    queryFn: async () => {
      const instances = getIndexedInstances();
      const results = await Promise.allSettled(
        instances.map(async (instance) => {
          const data = await fetchFromIndexer<any[]>(`/launchpad-markets/${instance.chainId}`);
          const graduated = (data ?? [])
            .filter((m: any) => m.isGraduated === true)
            .map((m: any) => ({
              ...m,
              chainId: instance.chainId,
              network: instance.chainName,
              soothBookAddress: instance.soothBook,
            }));

          // Fallback: indexer returned nothing — query on-chain
          if (graduated.length === 0) {
            const onChain = await fetchMarketsOnChain(instance).catch(() => []);
            return { instance, markets: onChain };
          }

          return { instance, markets: graduated as LaunchpadMarket[] };
        })
      );

      const markets: LaunchpadMarket[] = [];
      const chainErrors: Record<string, string> = {};

      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          markets.push(...result.value.markets);
        } else {
          chainErrors[instances[i].chainName] = result.reason?.message ?? 'RPC error';
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
