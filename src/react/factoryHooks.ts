/** Factory hooks accept clients and accounts. Mobile does not need wagmi. */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import {
  factoryNodeKey,
  readFactoryMarketSnapshot,
  readFactoryPositions,
  readFactoryBookInventory,
  readFactoryBookOrders,
  readFactoryBookDepth,
  readFactoryQuote,
  discoverFactoryLpPositions,
  readFactoryEntitlements,
  fetchFactoryCatalogMarkets,
  fetchFactoryCatalogNodes,
  type FactoryNodeContext,
  type FactoryReadClient,
  type FactoryEventClient,
  type FactoryIdentity,
  type FactoryCatalogOptions,
  type FactoryScanOptions,
} from '../factory/factoryClient.js';
import { refreshAt, noteReceipt } from '../factory/factoryTrade.js';

export interface FactoryHookParams {
  context?: FactoryNodeContext | null;
  client?: FactoryReadClient | null;
  enabled?: boolean;
  refetchInterval?: number | false;
}
export interface FactoryMarketHookParams extends FactoryHookParams {
  market?: Address;
}
export interface FactoryAccountHookParams extends FactoryMarketHookParams {
  account?: Address;
}
export function factoryQueryKey(context: FactoryNodeContext | null | undefined, resource?: string) {
  return [
    'factory',
    context ? factoryNodeKey(context) : null,
    context?.release.releaseId.toLowerCase() ?? null,
    ...(resource ? [resource] : []),
  ] as const;
}
function useFactoryRead<T>(
  params: FactoryHookParams,
  resource: string,
  keys: readonly unknown[],
  ready: boolean,
  read: (input: {
    context: FactoryNodeContext;
    client: FactoryReadClient;
    blockNumber: bigint;
  }) => Promise<T>,
) {
  return useQuery({
    queryKey: [...factoryQueryKey(params.context, resource), ...keys],
    enabled: params.enabled !== false && Boolean(params.context && params.client) && ready,
    staleTime: 6_000,
    refetchInterval: params.refetchInterval ?? 15_000,
    queryFn: async () => {
      const { context, client } = params;
      if (!context || !client || !ready) throw new Error('Factory query inputs are unavailable');
      return refreshAt(
        context,
        async (blockNumber) => ({ number: blockNumber ?? (await client.getBlockNumber()) }),
        (block) => read({ context, client, blockNumber: block.number }),
      );
    },
  });
}
const lower = (value?: string) => value?.toLowerCase() ?? null;
export function useFactoryMarketSnapshot(params: FactoryMarketHookParams) {
  return useFactoryRead(params, 'market', [lower(params.market)], Boolean(params.market), (input) =>
    readFactoryMarketSnapshot({ ...input, market: params.market! }),
  );
}
export function useFactoryPositions(
  params: FactoryHookParams & { account?: Address; markets: readonly Address[] },
) {
  return useFactoryRead(
    params,
    'positions',
    [lower(params.account), params.markets.map(lower).sort()],
    Boolean(params.account),
    (input) =>
      readFactoryPositions({ ...input, account: params.account!, markets: params.markets }),
  );
}
export function useFactoryBookInventory(params: FactoryAccountHookParams) {
  return useFactoryRead(
    params,
    'book-inventory',
    [lower(params.market), lower(params.account)],
    Boolean(params.market && params.account),
    (input) =>
      readFactoryBookInventory({ ...input, market: params.market!, account: params.account! }),
  );
}
export function useFactoryBookOrders(
  params: Omit<FactoryAccountHookParams, 'client'> &
    FactoryScanOptions & { client?: FactoryEventClient | null },
) {
  return useFactoryRead(
    params,
    'book-orders',
    [
      lower(params.market),
      lower(params.account),
      String(params.fromBlock ?? ''),
      String(params.chunkSize ?? ''),
      params.maxChunks,
      params.maxItems,
    ],
    Boolean(params.market && params.account),
    (input) =>
      readFactoryBookOrders({
        ...input,
        client: params.client!,
        market: params.market!,
        account: params.account!,
        fromBlock: params.fromBlock,
        chunkSize: params.chunkSize,
        maxChunks: params.maxChunks,
        maxItems: params.maxItems,
      }),
  );
}
export function useFactoryBookDepth(
  params: FactoryMarketHookParams & { fromTick?: number; toTick?: number },
) {
  return useFactoryRead(
    params,
    'book-depth',
    [lower(params.market), params.fromTick ?? 1, params.toTick ?? 999],
    Boolean(params.market),
    (input) =>
      readFactoryBookDepth({
        ...input,
        market: params.market!,
        fromTick: params.fromTick,
        toTick: params.toTick,
      }),
  );
}
export function useFactoryQuote(
  params: FactoryMarketHookParams & { outcome: 0 | 1; deltaShares: bigint },
) {
  return useFactoryRead(
    params,
    'quote',
    [lower(params.market), params.outcome, String(params.deltaShares)],
    Boolean(params.market && params.deltaShares !== 0n),
    (input) =>
      readFactoryQuote({
        ...input,
        market: params.market!,
        outcome: params.outcome,
        deltaShares: params.deltaShares,
      }),
  );
}
const scanKeys = (params: FactoryScanOptions) => [
  String(params.fromBlock ?? ''),
  String(params.chunkSize ?? ''),
  params.maxChunks,
  params.maxItems,
];
const scanOptions = (params: FactoryScanOptions) => ({
  fromBlock: params.fromBlock,
  chunkSize: params.chunkSize,
  maxChunks: params.maxChunks,
  maxItems: params.maxItems,
});
export function useFactoryLpPositions(
  params: FactoryAccountHookParams & FactoryScanOptions & { maxPositions?: number },
) {
  return useFactoryRead(
    params,
    'lp-positions',
    [lower(params.market), lower(params.account), params.maxPositions, ...scanKeys(params)],
    Boolean(params.account),
    (input) =>
      discoverFactoryLpPositions({
        ...input,
        ...scanOptions(params),
        market: params.market,
        account: params.account!,
        maxPositions: params.maxPositions,
      }),
  );
}
export function useFactoryEntitlements(
  params: FactoryAccountHookParams & FactoryScanOptions & { maxPositions?: number },
) {
  return useFactoryRead(
    params,
    'entitlements',
    [lower(params.market), lower(params.account), params.maxPositions, ...scanKeys(params)],
    Boolean(params.market && params.account),
    (input) =>
      readFactoryEntitlements({
        ...input,
        ...scanOptions(params),
        maxPositions: params.maxPositions,
        market: params.market!,
        account: params.account!,
      }),
  );
}
export function useFactoryCatalogMarkets(params: {
  identity?: FactoryIdentity;
  options: FactoryCatalogOptions;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      'factory-catalog',
      params.options.baseUrl,
      params.options.source ?? 'registry',
      params.identity ? factoryNodeKey(params.identity) : null,
      params.options.overrides?.revision,
      params.options.maxPages,
      params.options.pageConsistency ?? 'strict',
      params.options.snapshotAttempts ?? 1,
    ],
    enabled: params.enabled !== false && Boolean(params.identity),
    refetchInterval: 15_000,
    queryFn: ({ signal }) => {
      if (!params.identity) throw new Error('Factory identity unavailable');
      return fetchFactoryCatalogMarkets(params.identity, { ...params.options, signal });
    },
  });
}
export function useFactoryCatalogNodes(params: {
  chainId: number;
  factory: Address;
  options: FactoryCatalogOptions;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      'factory-catalog-nodes',
      params.options.baseUrl,
      params.options.source ?? 'registry',
      params.chainId,
      lower(params.factory),
      params.options.overrides?.revision,
      params.options.maxPages,
      params.options.pageConsistency ?? 'strict',
      params.options.snapshotAttempts ?? 1,
    ],
    enabled: params.enabled !== false,
    refetchInterval: 15_000,
    queryFn: ({ signal }) =>
      fetchFactoryCatalogNodes(params.chainId, params.factory, { ...params.options, signal }),
  });
}
/** Call after a successful receipt. Refreshes only this exact node/release. */
export function useRefreshFactory(context?: FactoryNodeContext | null) {
  const queryClient = useQueryClient();
  return async (receiptBlock?: bigint) => {
    if (!context) return;
    if (receiptBlock !== undefined) noteReceipt(context, receiptBlock);
    await queryClient.invalidateQueries({ queryKey: factoryQueryKey(context) });
  };
}
