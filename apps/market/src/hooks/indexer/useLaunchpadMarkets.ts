import { useQuery } from '@tanstack/react-query';
import { createPublicClient, fallback, http, parseAbi } from 'viem';
import type { LaunchpadMarket } from '../../types';
import { getIndexedInstances, type SoothInstance } from '../../config/deployments';
import { getChain } from '@sooth/registry';
import { toViemChain } from '@sooth/registry/viem';

// Private RPC env vars (same as wagmi.ts) — prioritised over public fallbacks
const PRIVATE_RPC: Record<number, string | undefined> = {
  84532: import.meta.env.VITE_BASE_SEPOLIA_RPC_URL,
  10143: import.meta.env.VITE_MONAD_TESTNET_RPC_URL,
  37111: import.meta.env.VITE_LENS_TESTNET_RPC_URL,
};

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
  const privateUrl = PRIVATE_RPC[instance.chainId];
  const publicUrl = chainMeta.rpcUrls[0];
  const httpOpts = { timeout: 15_000 };
  const transport = privateUrl && privateUrl !== publicUrl
    ? fallback([http(privateUrl, httpOpts), http(publicUrl, httpOpts)])
    : http(publicUrl, httpOpts);
  const client = createPublicClient({ chain: viemChain, transport });

  const addresses = await client.readContract({
    address: instance.launchpadEngine as `0x${string}`,
    abi: LAUNCHPAD_V12_ABI,
    functionName: 'getMarkets',
  }).catch(() => [] as readonly `0x${string}`[]);

  if (!addresses || addresses.length === 0) return [];

  const addrs = addresses as `0x${string}`[];

  // Batch: fetch market state for all addresses in one multicall
  const marketStateCalls = addrs.map((addr) => ({
    address: instance.launchpadEngine as `0x${string}`,
    abi: LAUNCHPAD_V12_ABI,
    functionName: 'markets' as const,
    args: [addr] as const,
  }));

  const stateResults = await client.multicall({ contracts: marketStateCalls }).catch(() =>
    addrs.map(() => ({ status: 'failure' as const, error: new Error('multicall failed'), result: undefined }))
  );

  // Filter to graduated markets only before making more calls
  const graduatedAddrs: Array<{ addr: `0x${string}`; state: any }> = [];
  for (let i = 0; i < addrs.length; i++) {
    const r = stateResults[i];
    if (r.status !== 'success' || !r.result) continue;
    const state = r.result as any;
    // isGraduated is at index 8
    if (state[8]) {
      graduatedAddrs.push({ addr: addrs[i], state });
    }
  }

  if (graduatedAddrs.length === 0) return [];

  // Batch: fetch question + deadline + isSettled + isFinalized for all graduated markets
  const detailCalls = graduatedAddrs.flatMap(({ addr }) => [
    { address: addr, abi: TRUTH_MARKET_ABI, functionName: 'question' as const },
    { address: addr, abi: TRUTH_MARKET_ABI, functionName: 'deadline' as const },
    { address: addr, abi: TRUTH_MARKET_ABI, functionName: 'isSettled' as const },
    { address: addr, abi: TRUTH_MARKET_ABI, functionName: 'isFinalized' as const },
  ]);

  const detailResults = await client.multicall({ contracts: detailCalls }).catch(() =>
    detailCalls.map(() => ({ status: 'failure' as const, error: new Error('multicall failed'), result: undefined }))
  );

  return graduatedAddrs.map(({ addr, state }, idx) => {
    const base = idx * 4;
    const question = detailResults[base]?.status === 'success'
      ? (detailResults[base].result as string)
      : addr.slice(2, 10).toUpperCase();
    const deadline = detailResults[base + 1]?.status === 'success'
      ? (detailResults[base + 1].result as bigint)
      : 0n;
    const isSettled = detailResults[base + 2]?.status === 'success'
      ? (detailResults[base + 2].result as boolean)
      : false;
    const isFinalized = detailResults[base + 3]?.status === 'success'
      ? (detailResults[base + 3].result as boolean)
      : false;

    const [creator, , , , creatorDeposit, , , , , createdAt] = state;

    return {
      address: addr,
      chainId: instance.chainId,
      network: instance.chainName,
      creator,
      isGraduated: true,
      isDismissed: false,
      deposit: creatorDeposit.toString(),
      isSettled,
      isFinalized,
      question,
      createdAt: createdAt.toString(),
      deadline: deadline.toString(),
      soothBookAddress: instance.soothBook,
    } as LaunchpadMarket;
  });
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
    staleTime: 30_000,
    refetchInterval: 60_000,
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
