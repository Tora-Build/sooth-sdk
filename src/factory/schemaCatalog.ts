/**
 * Factory catalog v2: nodes and markets as the Factory indexer serves them,
 * composed with off-chain metadata and moderation.
 *
 * Three sources, three owners:
 * - Facts (identity, contracts, activation, state) come from the indexer and
 *   carry the block they were read at. Nothing here may overwrite them.
 * - Metadata (label, branding, endpoints) and moderation (listing state) are
 *   editorial. Services own their documents and composition policy.
 * - The composed item is what the registry Worker serves under `/v2`.
 *
 * Identity validation is defined in `schemaIdentity.ts`.
 */
import {
  type FactoryAddress,
  type FactoryHash,
  type FactoryIdentity,
  type FactoryNodeRecord,
  type FactoryObservation,
  type FactoryRelease,
  type FactoryInterfaceLabel,
  factoryInterfaceLabel,
  parseFactoryRelease,
  isSupportedFactoryInterface,
  factoryAddress,
  factoryChainId,
  factoryHash,
  factoryMarketKey,
  factoryNodeKey,
} from './schemaIdentity.js';

export const FACTORY_CATALOG_SCHEMA = 1 as const;

// ── Moderation ─────────────────────────────────────────────────────────────

export const FACTORY_LISTING_STATES = ['listed', 'unlisted', 'disabled'] as const;
/**
 * - `listed`: shown to the public.
 * - `unlisted`: not shown by default; still reachable by its full identity.
 * - `disabled`: apps hide it and stop new trades through their UI. This is
 *   off-chain only: it changes nothing on chain, and exits and claims of
 *   existing positions must stay reachable. A disabled item is still served
 *   with all of its facts so a consumer can keep that path open.
 */
export type FactoryListingState = (typeof FACTORY_LISTING_STATES)[number];

export interface FactoryListing {
  state: FactoryListingState;
  /** Shown to users of a disabled or unlisted item. Null when none was given. */
  reason: string | null;
  /**
   * Who set it: a role or service name such as `admin`, `ops` or `seed`.
   * The catalog is public, so Admin must not write a personal email here.
   */
  actor: string | null;
  /** ISO-8601 time of the decision; null for a seed. */
  at: string | null;
}

export const FACTORY_LISTING_SOURCES = ['market', 'node', 'default'] as const;
/** Where an effective listing came from: the item's own entry, its node's, or the default. */
export type FactoryListingSource = (typeof FACTORY_LISTING_SOURCES)[number];
export interface FactoryEffectiveListing extends FactoryListing {
  source: FactoryListingSource;
}

/** The stored entries behind a market's effective listing, as Admin wrote them. */
export interface FactoryStoredListings {
  market: FactoryListing | null;
  node: FactoryListing | null;
}

// ── Metadata ───────────────────────────────────────────────────────────────

export interface FactoryNodeMetadata {
  label: string | null;
  description: string | null;
  branding: { iconUrl: string | null; color: string | null };
  endpoints: {
    appUrl: string | null;
    dataApiUrl: string | null;
    explorerUrl: string | null;
  };
}

export const EMPTY_NODE_METADATA: FactoryNodeMetadata = {
  label: null,
  description: null,
  branding: { iconUrl: null, color: null },
  endpoints: { appUrl: null, dataApiUrl: null, explorerUrl: null },
};

// ── Overrides document ─────────────────────────────────────────────────────

export interface FactoryNodeOverride extends FactoryIdentity {
  metadata: FactoryNodeMetadata;
  /** Null keeps the base listing (seed, then default). */
  listing: FactoryListing | null;
}

export interface FactoryMarketOverride extends FactoryIdentity {
  market: FactoryAddress;
  listing: FactoryListing;
}

/**
 * Editorial state for Factory nodes and markets, keyed by full identity.
 * Admin writes it; the registry Worker reads it and merges it over the seed
 * bundled in this package (`factory-catalog.json`).
 */
export interface FactoryCatalogOverrides {
  schemaVersion: typeof FACTORY_CATALOG_SCHEMA;
  /** Opaque. Must change on every write. */
  revision: string;
  updatedAt: string | null;
  nodes: FactoryNodeOverride[];
  markets: FactoryMarketOverride[];
}

// ── Facts copied from the indexer ──────────────────────────────────────────

/** The block a response's facts are consistent with. */
export interface FactoryIndexedAt {
  blockNumber: number;
  blockHash: FactoryHash;
  timestamp: number;
}

export const FACTORY_VERIFICATION_STATES = ['pending', 'verified', 'failed'] as const;
export const FACTORY_INDEXING_STATES = ['pending', 'syncing', 'ready', 'unavailable'] as const;
export interface FactoryCatalogStatus {
  verification: (typeof FACTORY_VERIFICATION_STATES)[number];
  indexing: (typeof FACTORY_INDEXING_STATES)[number];
}

/** One published fee configuration version of a venue. `terms` are the venue's own fields, passed through. */
export interface FactoryFeeConfigVersion {
  version: number;
  configHash: FactoryHash;
  publishedBlock: number | null;
  terms: Record<string, unknown>;
}
export interface FactoryVenueFees {
  activeVersion: number | null;
  versions: FactoryFeeConfigVersion[];
}

/** The subset of the indexer's node state a catalog consumer reads. Other keys pass through.
 * `fees` is optional: an older indexer release may not serve it. */
export interface FactoryNodeState {
  roles: {
    nodeAdmin: FactoryAddress | null;
    pendingNodeAdmin: FactoryAddress | null;
    protocolAuthority: FactoryAddress | null;
    pendingProtocolAuthority: FactoryAddress | null;
  };
  creation: {
    paused: boolean;
    permissionless: boolean;
    invalidationBuffer: string | null;
    tokens: FactoryAddress[];
    creators: FactoryAddress[];
    adjudicators: Array<{
      adjudicator: FactoryAddress;
      profileHash: FactoryHash;
    }>;
  };
  updatedBlock: number | null;
  fees?: { amm: FactoryVenueFees; book: FactoryVenueFees };
  [key: string]: unknown;
}

export const FACTORY_MARKET_PHASES = ['live', 'resolving', 'attested', 'settled'] as const;
export type FactoryMarketPhase = (typeof FACTORY_MARKET_PHASES)[number];
export const FACTORY_ADJUDICATOR_PHASES = [
  'idle',
  'active',
  'resolved',
  'attested',
  'settled',
  'disputed',
] as const;
export type FactoryAdjudicatorPhase = (typeof FACTORY_ADJUDICATOR_PHASES)[number];

/** `IAdjudicator.getMarketState` as the adjudicator answered at `readBlock`. Not authenticated. */
export interface FactoryAdjudicatorState {
  phase: FactoryAdjudicatorPhase;
  proposedOutcome: 0 | 1 | 2 | null;
  vetoEndsAt: string | null;
  resolver: FactoryAddress | null;
  dataHash: FactoryHash | null;
  readBlock: number;
}

/** Per-venue fee registration and finalization, as the indexer serves it. */
export interface FactoryMarketVenue {
  configVersion: number | null;
  configHash: FactoryHash | null;
  resolutionRecipient: FactoryAddress | null;
  finalizedAs: 'adjudicated' | 'invalidated' | null;
}

/** The `createMarket` call behind a market, as the indexer recovered it. Not authenticated here. */
export interface FactoryMarketCreationCall {
  blockTimestamp: number | null;
  to: FactoryAddress | null;
  input: `0x${string}` | null;
  embedded: boolean;
}

/** The subset of the indexer's market state a catalog consumer reads. Other keys pass through.
 * Fields an older indexer release may not serve are optional and read as undefined when absent. */
export interface FactoryMarketState {
  phase: FactoryMarketPhase;
  /** 0 NO, 1 YES, 2 INVALID. Proposed while resolving or attested, final once settled. */
  outcome: 0 | 1 | 2 | null;
  settlementKind: 'adjudicated' | 'invalidated' | null;
  termsHash: FactoryHash | null;
  profileHash: FactoryHash | null;
  bBase: string | null;
  adjudicator: FactoryAdjudicatorState | null;
  updatedBlock: number | null;
  /** Seconds after the deadline when anyone may invalidate; frozen at creation. */
  invalidationBuffer?: string | null;
  /** Stays true after a veto: liquidity never reopens once a resolution was proposed. */
  resolutionAttempted?: boolean;
  /** The node's permissionless switch as it stood when this market was created. */
  permissionlessAtCreation?: boolean | null;
  creationCall?: FactoryMarketCreationCall | null;
  amm?: FactoryMarketVenue;
  book?: FactoryMarketVenue;
  [key: string]: unknown;
}

/** A market as the indexer discovered it, before composition. */
export interface FactoryMarketRecord {
  address: FactoryAddress;
  creator: FactoryAddress;
  tokenA: FactoryAddress;
  tokenADecimals: number;
  lpPositionId: string;
  question: string;
  startTime: string;
  deadline: string;
  adjudicator: FactoryAddress;
  creation: FactoryObservation;
  state: FactoryMarketState;
  /** As of the indexed block; null when the indexer had no block clock. */
  tradingOpen: boolean | null;
  liquidityOpen: boolean | null;
  canSettle: boolean | null;
}

// ── Composed catalog items ─────────────────────────────────────────────────

/** A node record whose interface label is data: a node of a release this registry cannot decode still has an identity. */
export type FactoryCatalogNodeRecord = Omit<FactoryNodeRecord, 'interfaceVersion'> & {
  interfaceVersion: FactoryInterfaceLabel;
};

export interface FactoryCatalogNode {
  /** `factoryNodeKey(node)`: the cache and route key. */
  key: string;
  node: FactoryCatalogNodeRecord;
  /** The node's interface label and whether this registry decodes it. Unsupported is shown, never hidden. */
  interface: { label: FactoryInterfaceLabel; supported: boolean };
  /** The pinned release the node reports, when this registry knows and supports it. */
  release: FactoryRelease | null;
  state: FactoryNodeState | null;
  indexed: FactoryIndexedAt;
  status: FactoryCatalogStatus;
  metadata: FactoryNodeMetadata;
  listing: FactoryEffectiveListing;
}

export interface FactoryCatalogMarket extends FactoryMarketRecord {
  /** `factoryMarketKey(identity, address)`. */
  key: string;
  identity: FactoryIdentity;
  indexed: FactoryIndexedAt;
  /** Effective: the stricter of the market's own entry and its node's (disabled > unlisted > listed). */
  listing: FactoryEffectiveListing;
  /** Both stored entries, so Admin and the apps can say why the effective state is what it is. */
  listings: FactoryStoredListings;
}

export const FACTORY_CATALOG_SOURCES = ['live', 'last-known-good'] as const;
export const FACTORY_OVERRIDES_SOURCES = ['live', 'last-known-good', 'unavailable'] as const;
/**
 * Where the editorial state came from. `unavailable` means Admin did not
 * answer and the Worker held no copy: items then carry only the seed's
 * listings, and a consumer must not read that as "nothing is disabled".
 */
export interface FactoryOverridesStatus {
  source: (typeof FACTORY_OVERRIDES_SOURCES)[number];
  revision: string | null;
  ageSeconds: number | null;
}
/**
 * One page of catalog v2. `source` is `last-known-good` when the indexer did
 * not answer and the Worker replayed its last composed page; `ageSeconds` then
 * says how old it is. An outage is never an empty list.
 */
export interface FactoryCatalogPage<T> {
  catalogRevision: string;
  facts: { source: (typeof FACTORY_CATALOG_SOURCES)[number]; ageSeconds: number };
  overrides: FactoryOverridesStatus;
  indexed: FactoryIndexedAt | null;
  items: T[];
  next: string | null;
}

// ── Validation ─────────────────────────────────────────────────────────────

export const MAX_LISTING_REASON_LENGTH = 500;
const MAX_LABEL_LENGTH = 80;
const MAX_TEXT_LENGTH = 1000;

function record(value: unknown, what = 'Object'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${what} required`);
  return value as Record<string, unknown>;
}

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const text = value.trim();
  if (text.length === 0) return null;
  if (text.length > max) throw new Error(`${field} longer than ${max} characters`);
  return text;
}

function optionalUrl(value: unknown, field: string): string | null {
  const text = optionalText(value, field, MAX_TEXT_LENGTH);
  if (text === null) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${field} must be an absolute URL`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error(`${field} must be http(s)`);
  return text;
}

function optionalIsoTime(value: unknown, field: string): string | null {
  const text = optionalText(value, field, 64);
  if (text === null) return null;
  if (Number.isNaN(Date.parse(text))) throw new Error(`${field} must be an ISO-8601 time`);
  return text;
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`${field} must be one of ${allowed.join(', ')}`);
  }
  return value;
}

function nullableAddress(value: unknown): FactoryAddress | null {
  return value === null || value === undefined ? null : factoryAddress(value);
}
function nullableHash(value: unknown): FactoryHash | null {
  return value === null || value === undefined ? null : factoryHash(value);
}
function nullableBlock(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`${field} must be a block number`);
  return value;
}
function decimalString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    throw new Error(`${field} must be a decimal string`);
  return value;
}

export function parseFactoryIdentity(input: unknown): FactoryIdentity {
  const v = record(input, 'Identity');
  return {
    chainId: factoryChainId(v.chainId),
    factory: factoryAddress(v.factory),
    nodeId: factoryHash(v.nodeId),
  };
}

/** A role, handle or service name. The catalog is public, so an email address is refused; the error never repeats the value. */
function actorName(value: unknown): string | null {
  const text = optionalText(value, 'listing.actor', 200);
  if (text !== null && text.includes('@')) {
    throw new Error('listing.actor must be a role or service name, not an email address');
  }
  return text;
}

export function parseFactoryListing(input: unknown): FactoryListing {
  const v = record(input, 'Listing');
  return {
    state: oneOf(v.state, FACTORY_LISTING_STATES, 'listing.state'),
    reason: optionalText(v.reason, 'listing.reason', MAX_LISTING_REASON_LENGTH),
    actor: actorName(v.actor),
    at: optionalIsoTime(v.at, 'listing.at'),
  };
}

/** Missing fields become null, so a partial edit from Admin is a valid document. */
export function parseFactoryNodeMetadata(input: unknown): FactoryNodeMetadata {
  const v = input === undefined || input === null ? {} : record(input, 'Metadata');
  const branding =
    v.branding === undefined || v.branding === null ? {} : record(v.branding, 'metadata.branding');
  const endpoints =
    v.endpoints === undefined || v.endpoints === null
      ? {}
      : record(v.endpoints, 'metadata.endpoints');
  const color = optionalText(branding.color, 'metadata.branding.color', 32);
  if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color))
    throw new Error('metadata.branding.color must be #rrggbb');
  return {
    label: optionalText(v.label, 'metadata.label', MAX_LABEL_LENGTH),
    description: optionalText(v.description, 'metadata.description', MAX_TEXT_LENGTH),
    branding: {
      iconUrl: optionalUrl(branding.iconUrl, 'metadata.branding.iconUrl'),
      color,
    },
    endpoints: {
      appUrl: optionalUrl(endpoints.appUrl, 'metadata.endpoints.appUrl'),
      dataApiUrl: optionalUrl(endpoints.dataApiUrl, 'metadata.endpoints.dataApiUrl'),
      explorerUrl: optionalUrl(endpoints.explorerUrl, 'metadata.endpoints.explorerUrl'),
    },
  };
}

export function parseFactoryNodeOverride(input: unknown): FactoryNodeOverride {
  const v = record(input, 'Node override');
  return {
    ...parseFactoryIdentity(v),
    metadata: parseFactoryNodeMetadata(v.metadata),
    listing: v.listing === undefined || v.listing === null ? null : parseFactoryListing(v.listing),
  };
}

export function parseFactoryMarketOverride(input: unknown): FactoryMarketOverride {
  const v = record(input, 'Market override');
  return {
    ...parseFactoryIdentity(v),
    market: factoryAddress(v.market),
    listing: parseFactoryListing(v.listing),
  };
}

/** Validate an overrides document. Duplicate keys are an error: the last write must be explicit. */
export function parseFactoryCatalogOverrides(input: unknown): FactoryCatalogOverrides {
  const v = record(input, 'Overrides document');
  if (v.schemaVersion !== FACTORY_CATALOG_SCHEMA)
    throw new Error(`Unsupported overrides schema ${String(v.schemaVersion)}`);
  const revision = optionalText(v.revision, 'revision', 200);
  if (revision === null) throw new Error('revision required');
  if (!Array.isArray(v.nodes) || !Array.isArray(v.markets))
    throw new Error('nodes and markets arrays required');
  const nodes = v.nodes.map(parseFactoryNodeOverride);
  const markets = v.markets.map(parseFactoryMarketOverride);
  const seen = new Set<string>();
  for (const node of nodes) {
    const key = factoryNodeKey(node);
    if (seen.has(key)) throw new Error(`Duplicate node override ${key}`);
    seen.add(key);
  }
  for (const market of markets) {
    const key = factoryMarketKey(market, market.market);
    if (seen.has(key)) throw new Error(`Duplicate market override ${key}`);
    seen.add(key);
  }
  return {
    schemaVersion: FACTORY_CATALOG_SCHEMA,
    revision,
    updatedAt: optionalIsoTime(v.updatedAt, 'updatedAt'),
    nodes,
    markets,
  };
}

export function parseFactoryIndexedAt(input: unknown): FactoryIndexedAt {
  const v = record(input, 'Indexed block');
  const blockNumber = nullableBlock(v.blockNumber, 'indexed.blockNumber');
  const timestamp = nullableBlock(v.timestamp, 'indexed.timestamp');
  if (blockNumber === null || timestamp === null)
    throw new Error('indexed.blockNumber and indexed.timestamp required');
  return { blockNumber, blockHash: factoryHash(v.blockHash), timestamp };
}

function parseObservation(input: unknown, field: string): FactoryObservation {
  const v = record(input, field);
  const blockNumber = nullableBlock(v.blockNumber, `${field}.blockNumber`);
  if (blockNumber === null) throw new Error(`${field}.blockNumber required`);
  if (typeof v.logIndex !== 'number' || !Number.isSafeInteger(v.logIndex) || v.logIndex < 0)
    throw new Error(`${field}.logIndex required`);
  return {
    blockNumber,
    blockHash: factoryHash(v.blockHash),
    transactionHash: factoryHash(v.transactionHash),
    logIndex: v.logIndex,
  };
}

/** Validate a node record as the indexer serves it. Strict: the label must be in the supported interface list. */
export function parseFactoryNodeRecord(input: unknown): FactoryNodeRecord {
  const node = parseFactoryCatalogNodeRecord(input);
  if (!isSupportedFactoryInterface(node.interfaceVersion))
    throw new Error(`Unsupported Factory interface ${node.interfaceVersion}`);
  return { ...node, interfaceVersion: node.interfaceVersion };
}

/** Validate a node record for the catalog. Any well-formed interface label is kept as data; see `isSupportedFactoryInterface`. */
export function parseFactoryCatalogNodeRecord(input: unknown): FactoryCatalogNodeRecord {
  const v = record(input, 'Node record');
  if (v.protocol !== 'sooth-factory') throw new Error('protocol must be sooth-factory');
  const interfaceVersion = factoryInterfaceLabel(v.interfaceVersion);
  const contracts = record(v.contracts, 'node.contracts');
  const names = [
    'deployer',
    'roles',
    'marketFactory',
    'amm',
    'book',
    'ammVault',
    'bookVault',
    'positionManager',
    'truthImplementation',
  ] as const;
  const parsed = {} as FactoryNodeRecord['contracts'];
  for (const name of names) {
    try {
      parsed[name] = factoryAddress(contracts[name]);
    } catch {
      throw new Error(`node.contracts.${name} required`);
    }
  }
  const bookToken = record(v.bookToken, 'node.bookToken');
  if (
    typeof bookToken.decimals !== 'number' ||
    !Number.isInteger(bookToken.decimals) ||
    bookToken.decimals < 0 ||
    bookToken.decimals > 36
  ) {
    throw new Error('node.bookToken.decimals required');
  }
  return {
    ...parseFactoryIdentity(v),
    protocol: 'sooth-factory',
    releaseId: factoryHash(v.releaseId),
    interfaceVersion,
    contracts: parsed,
    bookToken: {
      address: factoryAddress(bookToken.address),
      decimals: bookToken.decimals,
    },
    nodeAdmin: factoryAddress(v.nodeAdmin),
    protocolAuthority: factoryAddress(v.protocolAuthority),
    activation: parseObservation(v.activation, 'node.activation'),
  };
}

export function parseFactoryNodeState(input: unknown): FactoryNodeState | null {
  if (input === null || input === undefined) return null;
  const v = record(input, 'Node state');
  const roles = record(v.roles, 'state.roles'),
    creation = record(v.creation, 'state.creation');
  if (typeof creation.paused !== 'boolean' || typeof creation.permissionless !== 'boolean')
    throw new Error('state.creation flags required');
  const list = (value: unknown, field: string) => {
    if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
    return value.map(factoryAddress);
  };
  if (!Array.isArray(creation.adjudicators))
    throw new Error('state.creation.adjudicators must be an array');
  return {
    ...v,
    roles: {
      nodeAdmin: nullableAddress(roles.nodeAdmin),
      pendingNodeAdmin: nullableAddress(roles.pendingNodeAdmin),
      protocolAuthority: nullableAddress(roles.protocolAuthority),
      pendingProtocolAuthority: nullableAddress(roles.pendingProtocolAuthority),
    },
    creation: {
      paused: creation.paused,
      permissionless: creation.permissionless,
      invalidationBuffer:
        creation.invalidationBuffer === null || creation.invalidationBuffer === undefined
          ? null
          : decimalString(creation.invalidationBuffer, 'state.creation.invalidationBuffer'),
      tokens: list(creation.tokens, 'state.creation.tokens'),
      creators: list(creation.creators, 'state.creation.creators'),
      adjudicators: creation.adjudicators.map((entry: unknown) => {
        const a = record(entry, 'state.creation.adjudicators[]');
        return {
          adjudicator: factoryAddress(a.adjudicator),
          profileHash: factoryHash(a.profileHash),
        };
      }),
    },
    updatedBlock: nullableBlock(v.updatedBlock, 'state.updatedBlock'),
    ...(v.fees === undefined ? {} : { fees: parseNodeFees(v.fees) }),
  };
}

function parseVenueFees(input: unknown, field: string): FactoryVenueFees {
  const v = record(input, field);
  if (!Array.isArray(v.versions)) throw new Error(`${field}.versions must be an array`);
  const versions = v.versions.map((entry: unknown, i: number): FactoryFeeConfigVersion => {
    const e = record(entry, `${field}.versions[${i}]`);
    if (typeof e.version !== 'number' || !Number.isInteger(e.version) || e.version < 0) {
      throw new Error(`${field}.versions[${i}].version must be a version number`);
    }
    const terms =
      e.terms === undefined || e.terms === null
        ? {}
        : record(e.terms, `${field}.versions[${i}].terms`);
    return {
      version: e.version,
      configHash: factoryHash(e.configHash),
      publishedBlock: nullableBlock(e.publishedBlock, `${field}.versions[${i}].publishedBlock`),
      terms,
    };
  });
  if (
    v.activeVersion !== null &&
    v.activeVersion !== undefined &&
    (typeof v.activeVersion !== 'number' || !Number.isInteger(v.activeVersion))
  ) {
    throw new Error(`${field}.activeVersion must be a version number`);
  }
  return { activeVersion: (v.activeVersion as number | null | undefined) ?? null, versions };
}

export function parseNodeFees(input: unknown): { amm: FactoryVenueFees; book: FactoryVenueFees } {
  const v = record(input, 'state.fees');
  return {
    amm: parseVenueFees(v.amm, 'state.fees.amm'),
    book: parseVenueFees(v.book, 'state.fees.book'),
  };
}

function parseOutcome(value: unknown, field: string): 0 | 1 | 2 | null {
  if (value === null || value === undefined) return null;
  if (value !== 0 && value !== 1 && value !== 2) throw new Error(`${field} must be 0, 1 or 2`);
  return value;
}

export function parseFactoryAdjudicatorState(input: unknown): FactoryAdjudicatorState | null {
  if (input === null || input === undefined) return null;
  const v = record(input, 'Adjudicator state');
  const readBlock = nullableBlock(v.readBlock, 'adjudicator.readBlock');
  if (readBlock === null) throw new Error('adjudicator.readBlock required');
  return {
    phase: oneOf(v.phase, FACTORY_ADJUDICATOR_PHASES, 'adjudicator.phase'),
    proposedOutcome: parseOutcome(v.proposedOutcome, 'adjudicator.proposedOutcome'),
    vetoEndsAt:
      v.vetoEndsAt === null || v.vetoEndsAt === undefined
        ? null
        : decimalString(v.vetoEndsAt, 'adjudicator.vetoEndsAt'),
    resolver: nullableAddress(v.resolver),
    dataHash: nullableHash(v.dataHash),
    readBlock,
  };
}

export function parseFactoryMarketState(input: unknown): FactoryMarketState {
  const v = record(input, 'Market state');
  const settlementKind =
    v.settlementKind === null || v.settlementKind === undefined
      ? null
      : oneOf(v.settlementKind, ['adjudicated', 'invalidated'] as const, 'state.settlementKind');
  return {
    ...v,
    phase: oneOf(v.phase, FACTORY_MARKET_PHASES, 'state.phase'),
    outcome: parseOutcome(v.outcome, 'state.outcome'),
    settlementKind,
    termsHash: nullableHash(v.termsHash),
    profileHash: nullableHash(v.profileHash),
    bBase: v.bBase === null || v.bBase === undefined ? null : decimalString(v.bBase, 'state.bBase'),
    adjudicator: parseFactoryAdjudicatorState(v.adjudicator),
    updatedBlock: nullableBlock(v.updatedBlock, 'state.updatedBlock'),
    ...(v.invalidationBuffer === undefined
      ? {}
      : {
          invalidationBuffer:
            v.invalidationBuffer === null
              ? null
              : decimalString(v.invalidationBuffer, 'state.invalidationBuffer'),
        }),
    ...(v.resolutionAttempted === undefined
      ? {}
      : {
          resolutionAttempted: requiredBoolean(v.resolutionAttempted, 'state.resolutionAttempted'),
        }),
    ...(v.permissionlessAtCreation === undefined
      ? {}
      : {
          permissionlessAtCreation: nullableBoolean(
            v.permissionlessAtCreation,
            'state.permissionlessAtCreation',
          ),
        }),
    ...(v.creationCall === undefined ? {} : { creationCall: parseCreationCall(v.creationCall) }),
    ...(v.amm === undefined ? {} : { amm: parseMarketVenue(v.amm, 'state.amm') }),
    ...(v.book === undefined ? {} : { book: parseMarketVenue(v.book, 'state.book') }),
  };
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean`);
  return value;
}

export function parseMarketVenue(input: unknown, field: string): FactoryMarketVenue {
  const v = record(input, field);
  if (
    v.configVersion !== null &&
    v.configVersion !== undefined &&
    (typeof v.configVersion !== 'number' ||
      !Number.isInteger(v.configVersion) ||
      v.configVersion < 0)
  ) {
    throw new Error(`${field}.configVersion must be a version number`);
  }
  const finalizedAs =
    v.finalizedAs === null || v.finalizedAs === undefined
      ? null
      : oneOf(v.finalizedAs, ['adjudicated', 'invalidated'] as const, `${field}.finalizedAs`);
  return {
    configVersion: (v.configVersion as number | null | undefined) ?? null,
    configHash: nullableHash(v.configHash),
    resolutionRecipient: nullableAddress(v.resolutionRecipient),
    finalizedAs,
  };
}

export function parseCreationCall(input: unknown): FactoryMarketCreationCall | null {
  if (input === null || input === undefined) return null;
  const v = record(input, 'state.creationCall');
  if (
    v.input !== null &&
    v.input !== undefined &&
    (typeof v.input !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(v.input))
  ) {
    throw new Error('state.creationCall.input must be hex calldata');
  }
  return {
    blockTimestamp: nullableBlock(v.blockTimestamp, 'state.creationCall.blockTimestamp'),
    to: nullableAddress(v.to),
    input: (v.input as `0x${string}` | null | undefined) ?? null,
    embedded: v.embedded === true,
  };
}

function nullableBoolean(value: unknown, field: string): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean`);
  return value;
}

/** Validate a market item as the indexer serves it. */
export function parseFactoryMarketRecord(input: unknown): FactoryMarketRecord {
  const v = record(input, 'Market record');
  if (typeof v.question !== 'string') throw new Error('market.question required');
  if (
    typeof v.tokenADecimals !== 'number' ||
    !Number.isInteger(v.tokenADecimals) ||
    v.tokenADecimals < 0 ||
    v.tokenADecimals > 36
  ) {
    throw new Error('market.tokenADecimals required');
  }
  return {
    address: factoryAddress(v.address),
    creator: factoryAddress(v.creator),
    tokenA: factoryAddress(v.tokenA),
    tokenADecimals: v.tokenADecimals,
    lpPositionId: decimalString(v.lpPositionId, 'market.lpPositionId'),
    question: v.question,
    startTime: decimalString(v.startTime, 'market.startTime'),
    deadline: decimalString(v.deadline, 'market.deadline'),
    adjudicator: factoryAddress(v.adjudicator),
    creation: parseObservation(v.creation, 'market.creation'),
    state: parseFactoryMarketState(v.state),
    tradingOpen: nullableBoolean(v.tradingOpen, 'market.tradingOpen'),
    liquidityOpen: nullableBoolean(v.liquidityOpen, 'market.liquidityOpen'),
    canSettle: nullableBoolean(v.canSettle, 'market.canSettle'),
  };
}

// ── Composition ────────────────────────────────────────────────────────────

/** One item of the indexer's node list: `{ node, state, status }`. */
export interface IndexerNodeItem {
  node: unknown;
  state?: unknown;
  status?: unknown;
}

export interface ComposeNodeInput {
  item: IndexerNodeItem;
  indexed: FactoryIndexedAt;
  overrides: FactoryCatalogOverrides;
  releases?: readonly FactoryRelease[];
}

export interface ComposeMarketInput {
  identity: FactoryIdentity;
  item: unknown;
  indexed: FactoryIndexedAt;
  overrides: FactoryCatalogOverrides;
}

/** Read the service's decision without computing editorial policy. */
export function parseFactoryEffectiveListing(input: unknown): FactoryEffectiveListing {
  const v = record(input, 'Effective listing');
  return {
    ...parseFactoryListing(v),
    source: oneOf(v.source, FACTORY_LISTING_SOURCES, 'listing.source'),
  };
}

/** Validate the composed catalog wire record, including its release binding. */
export function parseFactoryCatalogNode(input: unknown): FactoryCatalogNode {
  const v = record(input, 'Catalog node');
  const node = parseFactoryCatalogNodeRecord(v.node);
  const key = factoryNodeKey(node);
  if (v.key !== key) throw new Error('Catalog node key does not bind its identity');
  const supported = isSupportedFactoryInterface(node.interfaceVersion);
  const advertised = record(v.interface, 'Catalog interface');
  if (advertised.label !== node.interfaceVersion || advertised.supported !== supported)
    throw new Error('Catalog interface differs from the node interface');
  const release = v.release === null ? null : parseFactoryRelease(v.release);
  if (
    release &&
    (!supported ||
      release.chainId !== node.chainId ||
      release.factory !== node.factory ||
      release.releaseId !== node.releaseId ||
      release.interfaceVersion !== node.interfaceVersion)
  )
    throw new Error('Catalog release does not bind its node');
  const status = record(v.status, 'Catalog status');
  return {
    key,
    node,
    interface: { label: node.interfaceVersion, supported },
    release,
    state: parseFactoryNodeState(v.state),
    indexed: parseFactoryIndexedAt(v.indexed),
    status: {
      verification: oneOf(status.verification, FACTORY_VERIFICATION_STATES, 'status.verification'),
      indexing: oneOf(status.indexing, FACTORY_INDEXING_STATES, 'status.indexing'),
    },
    metadata: parseFactoryNodeMetadata(v.metadata),
    listing: parseFactoryEffectiveListing(v.listing),
  };
}

/** Validate the effective and stored listings exactly as the service served them. */
export function parseFactoryCatalogMarket(input: unknown): FactoryCatalogMarket {
  const v = record(input, 'Catalog market');
  const market = parseFactoryMarketRecord(v);
  const identity = parseFactoryIdentity(v.identity);
  const key = factoryMarketKey(identity, market.address);
  if (v.key !== key) throw new Error('Catalog market key does not bind its identity');
  const listings = record(v.listings, 'Stored listings');
  return {
    ...market,
    key,
    identity,
    indexed: parseFactoryIndexedAt(v.indexed),
    listing: parseFactoryEffectiveListing(v.listing),
    listings: {
      market: listings.market === null ? null : parseFactoryListing(listings.market),
      node: listings.node === null ? null : parseFactoryListing(listings.node),
    },
  };
}
