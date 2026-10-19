import {
  createPublicClient,
  defineChain,
  erc20Abi,
  http,
  keccak256,
  stringToHex,
  type Address,
  type PublicClient,
} from 'viem';
import {
  assertMarketBinding,
  verifyFactoryNode,
  factoryReadClient,
  readFactoryMarketSnapshot,
  readFactoryPositions,
  readFactoryBookInventory,
  type FactoryMarketSnapshot,
  type FactoryNodeContext,
} from '../factory/factoryClient.js';
import {
  factoryEventClient,
  readFactoryBookOrders,
  readFactoryConsumerEntitlements,
  type FactoryBookOrder,
} from '../factory/factoryPortfolio.js';
import {
  fetchFactoryCatalogMarkets,
  fetchFactoryCatalogNodes,
  type FactoryCatalogSnapshot,
} from '../factory/factoryCatalog.js';
import type { FactoryIndexerOptions } from '../factory/factoryIndexer.js';
import { anchorEndpoints, type AnchorEndpoint } from '../factory/factoryTrade/anchorClient.js';
import { TruthMarketAbi } from '../factory/factoryAbi/index.js';
import type {
  FactoryCatalogMarket,
  FactoryCatalogNode,
  FactoryRelease,
} from '../factory/schema.js';
import { parseSQFSafe } from '../lib/sqf.js';
import { freshReceiptBlock } from '../factory/factoryTrade/afterReceipt.js';
import { describeSoothError } from './errors.js';
import {
  formatSoothMarketReference,
  parseSoothMarketReference,
  renderSoothEmbedSnippet,
  type SoothMarketReference,
} from './embed.js';
import { parseSoothNodeReference, type SoothNodeReference } from './node.js';

export interface SoothChainConfiguration {
  id: number;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  /** Independent trusted endpoints selected by the application build, never the catalog or iframe messages. */
  rpcUrls: readonly string[];
}
export interface SoothRuntimeConfiguration {
  releases: readonly FactoryRelease[];
  chains: readonly SoothChainConfiguration[];
  catalogUrl: string;
  canonicalOrigin: string;
  /** Trusted read-only indexer for charts and depth. Display data only; never feeds signing. */
  indexerUrl?: string;
}
export interface SoothResolvedMarket {
  reference: SoothMarketReference;
  context: FactoryNodeContext;
  client: PublicClient;
  endpoints: readonly AnchorEndpoint[];
  catalog: FactoryCatalogSnapshot<FactoryCatalogMarket>;
  record: FactoryCatalogMarket;
  question: string;
  rules: string;
  canonicalUrl: string;
  refreshCatalog(): Promise<FactoryCatalogSnapshot<FactoryCatalogMarket>>;
  /** Null when the application configured no indexer. */
  indexer: FactoryIndexerOptions | null;
}
export interface SoothResolvedNode {
  reference: SoothNodeReference;
  context: FactoryNodeContext;
  client: PublicClient;
  endpoints: readonly AnchorEndpoint[];
  node: FactoryCatalogNode;
  catalog: FactoryCatalogSnapshot<FactoryCatalogMarket>;
  refreshCatalog(): Promise<FactoryCatalogSnapshot<FactoryCatalogMarket>>;
  /** Null when the application configured no indexer. */
  indexer: FactoryIndexerOptions | null;
}
export interface SoothRuntime {
  resolve(market: string | SoothMarketReference): Promise<SoothResolvedMarket>;
  resolveNode(node: string | SoothNodeReference): Promise<SoothResolvedNode>;
}
/** Application-owned trusted configuration; no Alpha package or production RPC dependency. */
export function createSoothRuntime(configuration: SoothRuntimeConfiguration): SoothRuntime {
  const releases = configuration.releases.map((release) => ({ ...release }));
  const chains = configuration.chains.map((chain) => ({ ...chain, rpcUrls: [...chain.rpcUrls] }));
  const catalogUrl = new URL(configuration.catalogUrl).href;
  const canonicalOrigin = new URL(configuration.canonicalOrigin).origin;
  const indexerUrl =
    configuration.indexerUrl === undefined ? null : new URL(configuration.indexerUrl).href;
  const resolveNode = async (
    reference: SoothNodeReference,
    market?: Address,
  ): Promise<SoothResolvedNode> => {
    const release = releases.find(
      (item) =>
        item.chainId === reference.chainId &&
        item.factory.toLowerCase() === reference.factory &&
        item.releaseId.toLowerCase() === reference.releaseId,
    );
    if (!release) throw new Error('This node release is not supported by this application');
    const config = chains.find((item) => item.id === reference.chainId);
    if (!config || config.rpcUrls.length < 2)
      throw new Error('Independent trusted RPC endpoints are required for this chain');
    const chain = defineChain({
      id: config.id,
      name: config.name,
      nativeCurrency: config.nativeCurrency,
      rpcUrls: { default: { http: [...config.rpcUrls] } },
    });
    // Concurrent display reads share one HTTP request; per-call block pins and errors are kept.
    // Quorum anchor reads stay unbatched (anchorClient.ts).
    const client = createPublicClient({
      chain,
      transport: http(config.rpcUrls[0], { batch: { batchSize: 50, wait: 16 } }),
    }) as PublicClient;
    const endpoints = anchorEndpoints(reference.chainId, config.rpcUrls);
    const [nodes, catalog] = await Promise.all([
      fetchFactoryCatalogNodes(reference.chainId, reference.factory, { baseUrl: catalogUrl }),
      fetchFactoryCatalogMarkets(reference, { baseUrl: catalogUrl }),
    ]);
    const node = nodes.items.find((item) => item.node.nodeId.toLowerCase() === reference.nodeId);
    if (
      !node ||
      !node.interface.supported ||
      node.node.releaseId.toLowerCase() !== reference.releaseId
    )
      throw new Error('Registry node does not match the selected supported release');
    const binding = { identity: reference, release, endpoints, catalog: node.node.contracts };
    const context = market
      ? await assertMarketBinding({ ...binding, market })
      : await verifyFactoryNode(binding);
    return {
      reference,
      context,
      client,
      endpoints,
      node,
      catalog,
      refreshCatalog: () => fetchFactoryCatalogMarkets(reference, { baseUrl: catalogUrl }),
      indexer: indexerUrl === null ? null : { baseUrl: indexerUrl },
    };
  };
  return {
    resolveNode: (node) => resolveNode(parseSoothNodeReference(node)),
    async resolve(market) {
      const reference = parseSoothMarketReference(market);
      const resolved = await resolveNode(parseSoothNodeReference(reference), reference.market);
      const { context, client, endpoints, catalog } = resolved;
      const record = catalog.items.find((item) => item.address.toLowerCase() === reference.market);
      if (!record) throw new Error('This market is not in the selected registry node');
      const questionHash = await client.readContract({
        address: reference.market,
        abi: TruthMarketAbi,
        functionName: 'questionHash',
        blockNumber: context.blockNumber,
      });
      if (keccak256(stringToHex(record.question)).toLowerCase() !== questionHash.toLowerCase())
        throw new Error('Registry question does not match the on-chain question hash');
      const terms = parseSQFSafe(record.question);
      const rules =
        Object.entries(terms.rule)
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
          .map(([key, value]) => (key === 'description' ? value : `${key}: ${value}`))
          .join('\n') || record.question;
      const canonicalUrl = new URL('/v1/market', canonicalOrigin);
      canonicalUrl.searchParams.set('market', formatSoothMarketReference(reference));
      return {
        reference,
        context,
        client,
        endpoints,
        catalog,
        record,
        question: terms.question || record.question,
        rules,
        canonicalUrl: canonicalUrl.href,
        refreshCatalog: resolved.refreshCatalog,
        indexer: resolved.indexer,
      };
    },
  };
}
export interface SoothMarketData {
  snapshot: FactoryMarketSnapshot;
  token: { address: Address; decimals: number; symbol: string };
  account?: {
    address: Address;
    balance: bigint;
    allowance: bigint;
    positions?: {
      blockNumber: bigint;
      positions: {
        market: Address;
        account: Address;
        yes: bigint;
        no: bigint;
        blockNumber: bigint;
      }[];
      complete: true;
    };
    inventory?: {
      blockNumber: bigint;
      account: Address;
      bookToken: Address;
      bookTokenDecimals: number;
      shareUnit: bigint;
      yesOwned: bigint;
      noOwned: bigint;
      yesReserved: bigint;
      noReserved: bigint;
      cashReserved: bigint;
      balance: bigint;
      allowance: bigint;
    };
    orders?: { blockNumber: bigint; orders: FactoryBookOrder[]; complete: boolean };
    ordersError?: string;
    entitlements: {
      blockNumber: bigint;
      floorWad: bigint | null;
      bookTimeoutRefundNative: bigint | null;
      bookDeferredNative: bigint | null;
    };
  };
}
export async function readSoothMarket(
  resolved: SoothResolvedMarket,
  account?: Address,
): Promise<SoothMarketData> {
  const { context, client, reference } = resolved;
  const reader = factoryReadClient(client);
  const head = await client.getBlockNumber({ cacheTime: 0 });
  const receiptFloor = freshReceiptBlock(context);
  const blockNumber = receiptFloor !== undefined && receiptFloor > head ? receiptFloor : head;
  const input = { context, client: reader, market: reference.market, blockNumber };
  const snapshot = await readFactoryMarketSnapshot(input);
  const token = reference.venue === 'amm' ? snapshot.tokenA : snapshot.bookToken;
  const decimals = reference.venue === 'amm' ? snapshot.tokenADecimals : snapshot.bookTokenDecimals;
  let symbol: string;
  try {
    symbol = await client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'symbol',
      blockNumber,
    });
  } catch {
    symbol = `${token.slice(0, 6)}…${token.slice(-4)}`;
  }
  if (!account)
    return { snapshot, token: { address: token, decimals, symbol }, account: undefined };
  const spender = reference.venue === 'amm' ? context.contracts.amm : context.contracts.book;
  let ordersError: string | undefined;
  const [balance, allowance, positions, inventory, orders, entitlements] = await Promise.all([
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account],
      blockNumber,
    }),
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account, spender],
      blockNumber,
    }),
    reference.venue === 'amm'
      ? readFactoryPositions({ ...input, markets: [reference.market], account })
      : undefined,
    reference.venue === 'book' ? readFactoryBookInventory({ ...input, account }) : undefined,
    reference.venue === 'book'
      ? readFactoryBookOrders({
          ...input,
          client: factoryEventClient(client),
          account,
          marketCreation: resolved.record.creation,
        }).catch((error) => {
          ordersError = describeSoothError(error);
          return undefined;
        })
      : undefined,
    readFactoryConsumerEntitlements({ ...input, account, venue: reference.venue }),
  ]);
  return {
    snapshot,
    token: { address: token, decimals, symbol },
    account: {
      address: account,
      balance,
      allowance,
      positions,
      inventory,
      orders,
      ordersError,
      entitlements,
    },
  };
}
export async function generateSoothEmbed(
  options: Omit<Parameters<typeof renderSoothEmbedSnippet>[0], 'title'> & {
    title?: string;
    runtime: SoothRuntime;
  },
): Promise<string> {
  const resolved = await options.runtime.resolve(options.market);
  return renderSoothEmbedSnippet({
    ...options,
    market: resolved.reference,
    title: options.title || resolved.question,
  });
}
