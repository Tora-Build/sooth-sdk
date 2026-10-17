/** Factory catalog contracts. Full chain, factory and bytes32 identity. */
export type FactoryAddress = `0x${string}`;
export type FactoryHash = `0x${string}`;
export const FACTORY_INTERFACE = 'sooth-factory-v7' as const;
/**
 * Interface labels this registry can decode, oldest first. A release whose
 * label is not here is served as unsupported, with its label; it is never
 * hidden and never treated as one of these.
 */
export const FACTORY_SUPPORTED_INTERFACES = [FACTORY_INTERFACE, 'sooth-factory-v7.1'] as const;
export type SupportedFactoryInterface = (typeof FACTORY_SUPPORTED_INTERFACES)[number];
/** An interface label as data. Compare it against `FACTORY_SUPPORTED_INTERFACES`, never against a literal. */
export type FactoryInterfaceLabel = string;

export function isSupportedFactoryInterface(label: unknown): label is SupportedFactoryInterface {
  return (
    typeof label === 'string' && (FACTORY_SUPPORTED_INTERFACES as readonly string[]).includes(label)
  );
}

export function factoryInterfaceLabel(value: unknown): FactoryInterfaceLabel {
  if (typeof value !== 'string' || !/^sooth-factory-[0-9A-Za-z.-]{1,32}$/.test(value)) {
    throw new Error('Factory interface label required');
  }
  return value;
}

export interface FactoryIdentity {
  chainId: number;
  factory: FactoryAddress;
  nodeId: FactoryHash;
}

export interface FactoryRelease {
  chainId: number;
  factory: FactoryAddress;
  releaseId: FactoryHash;
  interfaceVersion: SupportedFactoryInterface;
  sourceRevision: string;
  artifactRevision: string;
  sdkAbiHash: FactoryHash;
  releaseManifestHash: FactoryHash;
  startBlock: number;
}

export interface FactoryContracts {
  deployer: FactoryAddress;
  roles: FactoryAddress;
  marketFactory: FactoryAddress;
  amm: FactoryAddress;
  book: FactoryAddress;
  ammVault: FactoryAddress;
  bookVault: FactoryAddress;
  positionManager: FactoryAddress;
  truthImplementation: FactoryAddress;
}

export interface FactoryObservation {
  blockNumber: number;
  blockHash: FactoryHash;
  transactionHash: FactoryHash;
  logIndex: number;
}

export interface FactoryNodeRecord extends FactoryIdentity {
  protocol: 'sooth-factory';
  releaseId: FactoryHash;
  interfaceVersion: SupportedFactoryInterface;
  contracts: FactoryContracts;
  bookToken: { address: FactoryAddress; decimals: number };
  nodeAdmin: FactoryAddress;
  protocolAuthority: FactoryAddress;
  activation: FactoryObservation;
}

/** Off-chain metadata never replaces authenticated contract facts. */
export interface FactoryCatalogEntry {
  node: FactoryNodeRecord;
  metadata: { label?: string; listed: boolean; dataApiUrl?: string };
  status: {
    verification: 'pending' | 'verified' | 'failed';
    indexing: 'pending' | 'syncing' | 'ready' | 'unavailable';
    indexedBlock: number | null;
    indexedBlockHash: FactoryHash | null;
  };
}

export function factoryAddress(value: unknown): FactoryAddress {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value))
    throw new Error('Nonzero EVM address required');
  return value.toLowerCase() as FactoryAddress;
}

export function factoryHash(value: unknown): FactoryHash {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('Full bytes32 hash required');
  }
  return value.toLowerCase() as FactoryHash;
}

export function factoryChainId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Positive safe chain ID required');
  }
  return value;
}

export function factoryNodeKey(identity: FactoryIdentity): string {
  return `sooth-factory:${factoryChainId(identity.chainId)}:${factoryAddress(identity.factory)}:${factoryHash(identity.nodeId)}`;
}

export function factoryMarketKey(identity: FactoryIdentity, market: FactoryAddress): string {
  return `${factoryNodeKey(identity)}:${factoryAddress(market)}`;
}

export function factoryDataPath(identity: FactoryIdentity): string {
  return `/v2/chains/${factoryChainId(identity.chainId)}/factories/${factoryAddress(identity.factory)}/nodes/${factoryHash(identity.nodeId)}`;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Object required');
  return value as Record<string, unknown>;
}

/** A release seed the catalog cannot decode: kept with its label so a reader can show it as unsupported. */
export interface UnsupportedFactoryRelease {
  chainId: number;
  factory: FactoryAddress;
  releaseId: FactoryHash | null;
  interfaceVersion: FactoryInterfaceLabel;
  reason: string;
}
export type FactoryReleaseEntry =
  | { supported: true; release: FactoryRelease }
  | { supported: false; release: UnsupportedFactoryRelease };

/**
 * Non-throwing read of one release seed for catalog readers: a release with an
 * unknown label, or one that fails the strict parse, comes back as unsupported
 * with its label and the reason. Identity fields must still be valid.
 */
export function parseFactoryReleaseEntry(input: unknown): FactoryReleaseEntry {
  const v = record(input);
  const chainId = factoryChainId(v.chainId),
    factory = factoryAddress(v.factory);
  const interfaceVersion = factoryInterfaceLabel(v.interfaceVersion);
  let releaseId: FactoryHash | null = null;
  try {
    releaseId = factoryHash(v.releaseId);
  } catch {
    releaseId = null;
  }
  if (!isSupportedFactoryInterface(interfaceVersion)) {
    return {
      supported: false,
      release: {
        chainId,
        factory,
        releaseId,
        interfaceVersion,
        reason: `Unsupported Factory interface ${interfaceVersion}`,
      },
    };
  }
  try {
    return { supported: true, release: parseFactoryRelease(input) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Invalid release seed';
    return { supported: false, release: { chainId, factory, releaseId, interfaceVersion, reason } };
  }
}

/** Every seed of a release list, supported or not, in seed order. One bad entry cannot take the list down. */
export function parseFactoryReleaseSeeds(input: unknown): FactoryReleaseEntry[] {
  const v = record(input);
  if (!Array.isArray(v.releases)) throw new Error('releases array required');
  return v.releases.map(parseFactoryReleaseEntry);
}

/** Validate a trusted release seed at startup; this does not verify deployed bytecode. Strict: throws on labels this reader does not implement. */
export function parseFactoryRelease(input: unknown): FactoryRelease {
  const v = record(input);
  if (!isSupportedFactoryInterface(v.interfaceVersion))
    throw new Error('Unsupported Factory interface');
  for (const field of ['sourceRevision', 'artifactRevision'] as const) {
    if (typeof v[field] !== 'string' || !/^[0-9a-f]{40}$/.test(v[field])) {
      throw new Error(`Exact ${field} required`);
    }
  }
  if (typeof v.startBlock !== 'number' || !Number.isSafeInteger(v.startBlock) || v.startBlock < 0) {
    throw new Error('Explicit deployment start block required');
  }
  return {
    chainId: factoryChainId(v.chainId),
    factory: factoryAddress(v.factory),
    releaseId: factoryHash(v.releaseId),
    interfaceVersion: v.interfaceVersion,
    sourceRevision: v.sourceRevision as string,
    artifactRevision: v.artifactRevision as string,
    sdkAbiHash: factoryHash(v.sdkAbiHash),
    releaseManifestHash: factoryHash(v.releaseManifestHash),
    startBlock: v.startBlock,
  };
}
