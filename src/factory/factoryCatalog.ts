/** Bounded catalog v2 adapter. Transport errors and partial pages never become []. */
import {
  parseFactoryCatalogMarket,
  parseFactoryCatalogNode,
  parseFactoryIndexedAt,
  type ComposeMarketInput,
  type ComposeNodeInput,
  type FactoryCatalogMarket,
  type FactoryCatalogNode,
  type FactoryCatalogOverrides,
  type FactoryCatalogPage,
  type FactoryIndexedAt,
  type FactoryRelease as RegistryRelease,
} from './schema.js';
import {
  factoryAddress,
  factoryHash,
  factoryMarketKey,
  factoryNodeKey,
  type FactoryIdentity,
  type FactoryNodeContext,
} from './factoryClient.js';
export type { FactoryCatalogMarket, FactoryCatalogNode, FactoryCatalogPage } from './schema.js';
/** Client receipt time survives React Query caching; the server cannot supply it. */
export type FactoryCatalogSnapshot<T> = FactoryCatalogPage<T> & { receivedAt: number };

export interface FactoryCatalogOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
  maxPages?: number;
  timeoutMs?: number;
  /** Registry lists may merge page snapshots, keeping the worst freshness and last page's indexed block. */
  pageConsistency?: 'strict' | 'merge-freshness';
  /** Total discovery attempts on a moved strict snapshot; defaults to one. Other failures are not retried. */
  snapshotAttempts?: number;
  /** Indexer mode requires caller-owned composition, editorial overrides and pinned releases. */
  source?: 'registry' | 'indexer';
  overrides?: FactoryCatalogOverrides;
  releases?: readonly RegistryRelease[];
  indexerAdapter?: {
    node(input: ComposeNodeInput): FactoryCatalogNode;
    market(input: ComposeMarketInput): FactoryCatalogMarket;
  };
}
export type FactoryCatalogErrorKind =
  | 'not_found'
  | 'unsupported_release'
  | 'unavailable'
  | 'bad_upstream'
  | 'invalid_request'
  | 'other';
export class FactoryCatalogError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly url: string,
    readonly kind: FactoryCatalogErrorKind = 'other',
    readonly retryAfterSeconds: number | null = null,
    readonly body: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = 'FactoryCatalogError';
  }
}

async function catalogError(response: Response, url: string): Promise<FactoryCatalogError> {
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      body = parsed as Record<string, unknown>;
  } catch {
    body = null;
  }
  const kinds = [
    'not_found',
    'unsupported_release',
    'unavailable',
    'bad_upstream',
    'invalid_request',
  ];
  const code = typeof body?.error === 'string' ? body.error : null;
  const kind: FactoryCatalogErrorKind =
    code && kinds.includes(code)
      ? (code as FactoryCatalogErrorKind)
      : response.status === 404
        ? 'not_found'
        : response.status === 503
          ? 'unavailable'
          : response.status === 502
            ? 'bad_upstream'
            : response.status === 501
              ? 'unsupported_release'
              : response.status === 400
                ? 'invalid_request'
                : 'other';
  const retry = Number(response.headers.get('retry-after'));
  const message =
    typeof body?.message === 'string'
      ? body.message
      : kind === 'not_found'
        ? 'Catalog not available: the registry has no such route or item'
        : kind === 'unavailable'
          ? 'Catalog not available: the registry holds no copy and the indexer did not answer'
          : kind === 'bad_upstream'
            ? 'The registry refused a record from the indexer that did not validate'
            : kind === 'unsupported_release'
              ? `Unsupported release${typeof body?.interfaceVersion === 'string' ? ` ${body.interfaceVersion}` : ''}`
              : `HTTP ${response.status}`;
  return new FactoryCatalogError(
    message,
    response.status,
    url,
    kind,
    Number.isFinite(retry) && retry > 0 ? retry : null,
    body,
  );
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Catalog object required');
  return value as Record<string, unknown>;
};
class CatalogSnapshotMovedError extends Error {}

async function readPages<T extends { key: string }>(
  path: string,
  options: FactoryCatalogOptions,
  parse: (item: unknown, indexed: FactoryIndexedAt) => T,
): Promise<FactoryCatalogSnapshot<T>> {
  const attempts = options.snapshotAttempts ?? 1;
  if (!Number.isSafeInteger(attempts) || attempts <= 0)
    throw new Error('Invalid catalog attempt bound');
  for (let attempt = 1; ; attempt++) {
    try {
      return await readSnapshot(path, options, parse);
    } catch (error) {
      if (
        !(error instanceof CatalogSnapshotMovedError) ||
        attempt >= attempts ||
        options.signal?.aborted
      )
        throw error;
    }
  }
}

async function readSnapshot<T extends { key: string }>(
  path: string,
  options: FactoryCatalogOptions,
  parse: (item: unknown, indexed: FactoryIndexedAt) => T,
): Promise<FactoryCatalogSnapshot<T>> {
  if (
    options.source === 'indexer' &&
    (!options.indexerAdapter || !options.overrides || !options.releases)
  )
    throw new Error('Indexer adapter requires caller composition, overrides and pinned releases');
  const mergeFreshness =
    options.source !== 'indexer' && options.pageConsistency === 'merge-freshness';
  const receivedAt = Date.now();
  const base = options.baseUrl.replace(/\/$/, '');
  const maxPages = options.maxPages ?? 100;
  if (!Number.isSafeInteger(maxPages) || maxPages <= 0)
    throw new Error('Invalid catalog page bound');
  const url = new URL(`${base}${path}`);
  url.searchParams.set('limit', '200');
  if (options.source !== 'indexer') url.searchParams.set('listing', 'all');
  const items: T[] = [];
  const seen = new Set<string>();
  const identities = new Set<string>();
  let first: FactoryCatalogPage<T> | undefined;
  for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) controller.abort();
    const timer = setTimeout(abort, options.timeoutMs ?? 12_000);
    let data: Record<string, unknown>;
    try {
      const response = await (options.fetch ?? globalThis.fetch)(url.toString(), {
        signal: controller.signal,
      });
      if (!response.ok) throw await catalogError(response, url.toString());
      data = record(await response.json());
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
    if (!Array.isArray(data.items) || data.items.length > 200)
      throw new FactoryCatalogError('Catalog has invalid or oversized items', null, url.toString());
    const indexed = parseFactoryIndexedAt(data.indexed);
    let page: FactoryCatalogPage<T>;
    if (options.source === 'indexer') {
      // Request success says nothing about editorial seed freshness or head age.
      // Without registry cache metadata, use the observed block's age conservatively.
      page = {
        catalogRevision: `indexer:${indexed.blockHash}`,
        facts: { source: 'live', ageSeconds: Math.max(0, receivedAt / 1000 - indexed.timestamp) },
        overrides: {
          source: 'unavailable',
          revision: options.overrides!.revision,
          ageSeconds: null,
        },
        indexed,
        items: [],
        next: null,
      };
    } else {
      const facts = record(data.facts);
      const overrides = record(data.overrides);
      if (
        typeof data.catalogRevision !== 'string' ||
        !['live', 'last-known-good'].includes(String(facts.source)) ||
        typeof facts.ageSeconds !== 'number' ||
        !Number.isFinite(facts.ageSeconds) ||
        facts.ageSeconds < 0 ||
        !['live', 'last-known-good', 'unavailable'].includes(String(overrides.source))
      )
        throw new Error('Invalid catalog freshness');
      page = {
        catalogRevision: data.catalogRevision,
        facts: facts as unknown as FactoryCatalogPage<T>['facts'],
        overrides: overrides as unknown as FactoryCatalogPage<T>['overrides'],
        indexed,
        items: [],
        next: null,
      };
    }
    if (
      first &&
      !mergeFreshness &&
      (first.indexed?.blockHash !== indexed.blockHash ||
        first.indexed.blockNumber !== indexed.blockNumber ||
        first.indexed.timestamp !== indexed.timestamp ||
        first.catalogRevision !== page.catalogRevision ||
        first.overrides.revision !== page.overrides.revision)
    )
      throw new CatalogSnapshotMovedError('Catalog snapshot moved between pages; retry discovery');
    if (!first) first = page;
    else {
      if (page.facts.source === 'last-known-good') first.facts.source = 'last-known-good';
      first.facts.ageSeconds = Math.max(first.facts.ageSeconds, page.facts.ageSeconds);
      const rank = { live: 0, 'last-known-good': 1, unavailable: 2 };
      const ages = [first.overrides.ageSeconds, page.overrides.ageSeconds];
      if (mergeFreshness) {
        first.catalogRevision = page.catalogRevision;
        first.indexed = page.indexed;
        first.overrides = {
          ...(rank[page.overrides.source] >= rank[first.overrides.source]
            ? page.overrides
            : first.overrides),
          ageSeconds: Math.max(first.overrides.ageSeconds ?? 0, page.overrides.ageSeconds ?? 0),
        };
      } else {
        first.overrides = {
          ...first.overrides,
          source:
            rank[page.overrides.source] > rank[first.overrides.source]
              ? page.overrides.source
              : first.overrides.source,
          ageSeconds: ages.every(
            (age) => typeof age === 'number' && Number.isFinite(age) && age >= 0,
          )
            ? Math.max(...(ages as number[]))
            : null,
        };
      }
    }
    for (const raw of data.items) {
      const item = parse(raw, indexed);
      if (identities.has(item.key)) throw new Error('Duplicate catalog identity');
      identities.add(item.key);
      items.push(item);
    }
    if (data.next === null) return { ...first, receivedAt, items, next: null };
    if (typeof data.next !== 'string' || !data.next || seen.has(data.next))
      throw new Error('Invalid or repeated catalog cursor');
    seen.add(data.next);
    url.searchParams.set('cursor', data.next);
  }
  throw new Error('Catalog discovery exceeds its page bound; list is incomplete');
}

function itemSnapshot(value: unknown, indexed: FactoryIndexedAt) {
  const item = parseFactoryIndexedAt(value);
  if (
    item.blockHash !== indexed.blockHash ||
    item.blockNumber !== indexed.blockNumber ||
    item.timestamp !== indexed.timestamp
  )
    throw new Error('Catalog item differs from the page snapshot');
  return item;
}

export function fetchFactoryCatalogNodes(
  chainId: number,
  factory: string,
  options: FactoryCatalogOptions,
): Promise<FactoryCatalogSnapshot<FactoryCatalogNode>> {
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error('Invalid chain ID');
  const address = factoryAddress(factory);
  return readPages(
    `/v2/chains/${chainId}/factories/${address}/nodes`,
    options,
    (value, indexed) => {
      const raw = record(value);
      const item = parseFactoryCatalogNode(
        options.source === 'indexer'
          ? options.indexerAdapter!.node({
              item: { node: raw.node, state: raw.state, status: raw.status },
              indexed,
              overrides: options.overrides!,
              releases: options.releases!,
            })
          : raw,
      );
      if (item.node.chainId !== chainId || item.node.factory !== address)
        throw new Error('Catalog node belongs to another chain or factory');
      itemSnapshot(item.indexed, indexed);
      return item;
    },
  );
}
export function fetchFactoryCatalogMarkets(
  identity: FactoryIdentity,
  options: FactoryCatalogOptions,
): Promise<FactoryCatalogSnapshot<FactoryCatalogMarket>> {
  const key = factoryNodeKey(identity);
  return readPages(
    `/v2/chains/${identity.chainId}/factories/${factoryAddress(identity.factory)}/nodes/${factoryHash(identity.nodeId)}/markets`,
    options,
    (value, indexed) => {
      const raw = record(value);
      if (options.source === 'indexer' && raw.nodeKey !== key)
        throw new Error('Catalog market belongs to another node');
      const item = parseFactoryCatalogMarket(
        options.source === 'indexer'
          ? options.indexerAdapter!.market({
              identity,
              item: raw,
              indexed,
              overrides: options.overrides!,
            })
          : raw,
      );
      if (factoryNodeKey(item.identity) !== key)
        throw new Error('Catalog market key does not bind its identity');
      itemSnapshot(item.indexed, indexed);
      return item;
    },
  );
}
export function createFactoryCatalogClient(options: FactoryCatalogOptions) {
  return {
    listNodes: (chainId: number, factory: string, signal?: AbortSignal) =>
      fetchFactoryCatalogNodes(chainId, factory, { ...options, signal }),
    listMarkets: (identity: FactoryIdentity, signal?: AbortSignal) =>
      fetchFactoryCatalogMarkets(identity, { ...options, signal }),
  };
}

/** Matches Market's 600-second moderation budget, including client-held time. */
export const FACTORY_CATALOG_EXPOSURE_DEFAULTS = { maxAgeSeconds: 600 } as const;
export interface FactoryCatalogExposurePolicy {
  /** Reverify this node immediately before preparing a new exposure. */
  context: FactoryNodeContext;
  /** Read from the freshly verified node's RPC, never from the catalog. */
  liveBlock: { number: bigint; timestamp: bigint };
  /** Milliseconds; injected only for deterministic clocks in tests. */
  now?: number;
  maxAgeSeconds?: number;
  /** No default chain-lag policy exists in the release. Opt in explicitly. */
  maxIndexedAgeSeconds?: number;
  maxLagBlocks?: number;
}

/** Only for new exposure. Never gate sells, cancellations, redemptions or claims. */
export function assertFactoryCatalogNewExposure(
  page: FactoryCatalogPage<FactoryCatalogMarket> & { receivedAt?: number },
  market: string,
  policy: FactoryCatalogExposurePolicy,
): FactoryCatalogMarket {
  const maxAgeSeconds = policy.maxAgeSeconds ?? FACTORY_CATALOG_EXPOSURE_DEFAULTS.maxAgeSeconds;
  for (const limit of [maxAgeSeconds, policy.maxIndexedAgeSeconds, policy.maxLagBlocks])
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0))
      throw new Error('Invalid catalog freshness policy');
  const now = policy.now ?? Date.now();
  if (
    !Number.isFinite(now) ||
    now < 0 ||
    typeof page.receivedAt !== 'number' ||
    !Number.isFinite(page.receivedAt) ||
    page.receivedAt < 0 ||
    page.receivedAt > now
  )
    throw new Error('Catalog client receipt time is unavailable or invalid');
  const clientAge = (now - page.receivedAt) / 1000;
  const age = (value: unknown) =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value + clientAge <= maxAgeSeconds;
  if (
    page.next !== null ||
    typeof page.catalogRevision !== 'string' ||
    !page.catalogRevision.trim()
  )
    throw new Error('Catalog discovery is incomplete');
  if (
    !['live', 'last-known-good'].includes(page.facts?.source) ||
    !age(page.facts.ageSeconds) ||
    !['live', 'last-known-good'].includes(page.overrides?.source) ||
    !age(page.overrides.ageSeconds) ||
    typeof page.overrides.revision !== 'string' ||
    !page.overrides.revision.trim()
  )
    throw new Error('Market policy is unavailable or stale. New exposure is blocked.');
  const indexed = parseFactoryIndexedAt(page.indexed);
  const { liveBlock, context } = policy;
  if (
    typeof liveBlock.number !== 'bigint' ||
    typeof liveBlock.timestamp !== 'bigint' ||
    liveBlock.timestamp < 0n ||
    liveBlock.number < context.blockNumber
  )
    throw new Error('Live chain head predates verified node binding');
  const indexedNumber = BigInt(indexed.blockNumber),
    indexedTimestamp = BigInt(indexed.timestamp);
  if (indexedNumber > liveBlock.number || indexedTimestamp > liveBlock.timestamp)
    throw new Error('Catalog indexed head is ahead of the verified live chain');
  if (
    (policy.maxLagBlocks !== undefined &&
      liveBlock.number - indexedNumber > BigInt(policy.maxLagBlocks)) ||
    (policy.maxIndexedAgeSeconds !== undefined &&
      liveBlock.timestamp - indexedTimestamp > BigInt(policy.maxIndexedAgeSeconds))
  )
    throw new Error('Catalog indexed head is stale. New exposure is blocked.');
  const key = factoryMarketKey(context, factoryAddress(market));
  const matches = page.items.filter((item) => item.key === key);
  if (matches.length !== 1)
    throw new Error('Market is absent or duplicated in the current catalog');
  const item = matches[0]!;
  if (
    factoryNodeKey(item.identity) !== factoryNodeKey(context) ||
    factoryAddress(item.address) !== factoryAddress(market)
  )
    throw new Error('Catalog market belongs to another identity');
  itemSnapshot(item.indexed, indexed);
  if (item.listing.state !== 'listed') throw new Error('Market is not listed for new exposure');
  if (
    [item.listings?.node, item.listings?.market].some(
      (listing) => listing && listing.state !== 'listed',
    )
  )
    throw new Error('Node or market policy blocks new exposure');
  return item;
}
