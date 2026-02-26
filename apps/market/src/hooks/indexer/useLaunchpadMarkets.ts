import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http, parseAbi } from 'viem';
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
  'function deadline() view returns (uint64)',
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
      const [creator, , , , creatorDeposit, , , , isGraduated, createdAt] = state;

      if (!isGraduated) return null;

      const [question, deadline, isSettled, isFinalized] = await Promise.all([
        client.readContract({ address: addr, abi: TRUTH_MARKET_ABI, functionName: 'question' }).catch(() => addr.slice(2, 10).toUpperCase()),
        client.readContract({ address: addr, abi: TRUTH_MARKET_ABI, functionName: 'deadline' }).catch(() => 0n),
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
        createdAt: createdAt.toString(),
        deadline: (deadline as bigint).toString(),
        soothBookAddress: instance.soothBook,
      } as LaunchpadMarket;
    })
  );

  return results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter((m): m is LaunchpadMarket => m !== null);
}

export function useLaunchpadMarkets(options?: { nodeId?: string }) {
  const nodeId = options?.nodeId;
  const query = useQuery({
    queryKey: ['launchpad-markets', nodeId ?? 'all-chains'],
    queryFn: async () => {
      const allInstances = getIndexedInstances();
      const instances = nodeId 
        ? allInstances.filter(i => i.id === nodeId)
        : allInstances;
      const results = await Promise.allSettled(
        instances.map(async (instance) => {
          const markets = await fetchMarketsOnChain(instance).catch(() => []);
          return { instance, markets };
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
