import { keccak256, toHex, type Abi, type Address, type Hex } from 'viem';
import { ManualAdjudicatorAbi } from './factoryAbi/ManualAdjudicator.js';
import { IMDAdjudicatorAbi, IMDTestnetAdjudicatorAbi } from './factoryAbi/IMDAdjudicator.js';
import { ZkTLSAdjudicatorAbi } from './factoryAbi/ZkTLSAdjudicator.js';
import { MarketFactoryAbi } from './factoryAbi/MarketFactory.js';
import {
  SwarmAdjudicatorAbi,
  SWARM_ADJUDICATOR_ABI_BUNDLE_HASH,
} from './factoryAbi/SwarmAdjudicator.js';

export type FactoryAdjudicatorKind =
  | 'manual'
  | 'zktls'
  | 'imd-v2'
  | 'imd'
  | 'imd-testnet'
  | 'swarm-expert-sqf';
/** Hashes of exact separately pinned artifacts in factoryAbi/bundles; never node sdkAbiHash. */
export const ADJUDICATOR_ABI_PINS = {
  manual: '0x3425d303fa006c283be9cb867e42570ce9d1a7187b2b4b85cf88df4c25506fd7',
  zktls: '0xdb67c3c4274d31792731196504cbe6483b96a8eb636b0a046fcfdc935d23d1f0',
  'imd-v2': '0xdb67c3c4274d31792731196504cbe6483b96a8eb636b0a046fcfdc935d23d1f0',
  imd: '0x57c58cb4fde645f2d0b4120875567f9a237d839aac635fe444e3ed35b00d5aa6',
  'imd-testnet': '0x57c58cb4fde645f2d0b4120875567f9a237d839aac635fe444e3ed35b00d5aa6',
  'swarm-expert-sqf': SWARM_ADJUDICATOR_ABI_BUNDLE_HASH,
} as const;
export const FACTORY_IMD_SEMANTIC_BINDING_ID = keccak256(toHex('SOOTH_IMD_SQF_CHUNKS_UTF8_512_V1'));
export interface FactoryAdjudicatorBinding {
  kind: FactoryAdjudicatorKind;
  chainId: number;
  address: Address;
  marketFactory: Address;
  profileHash: Hex;
  abiBundleHash: Hex;
  /** Required for the separately admitted testnet certificate domain. */
  certificateChainId?: bigint;
  certificateConsumer?: Address;
}
export type FactoryAdjudicatorCapability =
  | 'resolve'
  | 'attest'
  | 'dispute'
  | 'settle'
  | 'acceptMandate'
  | 'recordJudgment';
export interface FactoryAdjudicatorAdapter {
  kind: FactoryAdjudicatorKind;
  abi: Abi;
  capabilities: readonly FactoryAdjudicatorCapability[];
  adjudicatorTypes: readonly string[];
  requiresAttestation: boolean;
}
// The legacy IMD source has no semantic binding or testnet certificate-domain selectors.
const legacyImdAbi: Abi = IMDAdjudicatorAbi.filter(
  (entry) =>
    !('name' in entry) ||
    ![
      'semanticBindingId',
      'semanticBindings',
      'SemanticBindingConfigured',
      'InvalidSourceContext',
      'InvalidUTF8',
      'InvalidSQF',
      'EnvelopeTooLarge',
    ].includes(entry.name),
);
const adapters: Record<FactoryAdjudicatorKind, FactoryAdjudicatorAdapter> = {
  manual: {
    kind: 'manual',
    abi: ManualAdjudicatorAbi,
    capabilities: ['resolve', 'attest', 'dispute', 'settle'],
    adjudicatorTypes: ['base', 'manual'],
    requiresAttestation: false,
  },
  zktls: {
    kind: 'zktls',
    abi: ZkTLSAdjudicatorAbi,
    capabilities: ['resolve', 'attest', 'dispute', 'settle'],
    adjudicatorTypes: ['zktls-primus'],
    requiresAttestation: true,
  },
  'imd-v2': {
    kind: 'imd-v2',
    abi: legacyImdAbi,
    capabilities: ['resolve', 'attest', 'dispute', 'settle'],
    adjudicatorTypes: ['imd-v2'],
    requiresAttestation: true,
  },
  imd: {
    kind: 'imd',
    abi: IMDAdjudicatorAbi,
    capabilities: ['resolve', 'attest', 'dispute', 'settle'],
    adjudicatorTypes: ['imd-sqf'],
    requiresAttestation: true,
  },
  'imd-testnet': {
    kind: 'imd-testnet',
    abi: IMDTestnetAdjudicatorAbi,
    capabilities: ['resolve', 'attest', 'dispute', 'settle'],
    adjudicatorTypes: ['imd-sqf-testnet'],
    requiresAttestation: true,
  },
  'swarm-expert-sqf': {
    kind: 'swarm-expert-sqf',
    abi: SwarmAdjudicatorAbi,
    capabilities: ['acceptMandate', 'recordJudgment', 'resolve', 'dispute', 'settle'],
    adjudicatorTypes: ['swarm-expert-sqf'],
    requiresAttestation: false,
  },
};

/** Parse trusted build/application pins, not an untrusted catalog's capability claims. */
export function parseFactoryAdjudicatorBinding(value: unknown): FactoryAdjudicatorBinding {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Adjudicator binding must be an object');
  const record = value as Record<string, unknown>;
  if (typeof record.kind !== 'string' || !Object.hasOwn(adapters, record.kind))
    throw new Error('Unsupported adjudicator capability');
  const kind = record.kind as FactoryAdjudicatorKind;
  if (
    typeof record.chainId !== 'number' ||
    !Number.isSafeInteger(record.chainId) ||
    record.chainId <= 0
  )
    throw new Error('Invalid adjudicator chainId');
  for (const field of ['address', 'marketFactory'] as const) {
    if (
      typeof record[field] !== 'string' ||
      !/^0x[\da-f]{40}$/i.test(record[field]) ||
      /^0x0{40}$/i.test(record[field])
    )
      throw new Error(`Invalid adjudicator ${field}`);
  }
  for (const field of ['profileHash', 'abiBundleHash'] as const) {
    if (
      typeof record[field] !== 'string' ||
      !/^0x[\da-f]{64}$/i.test(record[field]) ||
      /^0x0{64}$/i.test(record[field])
    )
      throw new Error(`Invalid adjudicator ${field}`);
  }
  if ((record.abiBundleHash as string).toLowerCase() !== ADJUDICATOR_ABI_PINS[kind])
    throw new Error('Unsupported adjudicator ABI pin');
  const binding: FactoryAdjudicatorBinding = {
    kind,
    chainId: record.chainId,
    address: record.address as Address,
    marketFactory: record.marketFactory as Address,
    profileHash: record.profileHash as Hex,
    abiBundleHash: record.abiBundleHash as Hex,
  };
  if (kind === 'imd-testnet') {
    if (binding.chainId !== 46630) throw new Error('IMD testnet profile requires chain 46630');
    if (
      record.certificateChainId !== 11155111n &&
      record.certificateChainId !== '11155111' &&
      record.certificateChainId !== 11155111
    )
      throw new Error('Unsupported IMD certificate chain');
    if (
      typeof record.certificateConsumer !== 'string' ||
      !/^0x[\da-f]{40}$/i.test(record.certificateConsumer) ||
      /^0x0{40}$/i.test(record.certificateConsumer)
    )
      throw new Error('Invalid IMD certificate consumer');
    binding.certificateChainId = 11155111n;
    binding.certificateConsumer = record.certificateConsumer as Address;
  }
  return binding;
}

/** Select ABI only after validating the independent capability commitment. */
export function getFactoryAdjudicatorAdapter(
  binding: FactoryAdjudicatorBinding,
): FactoryAdjudicatorAdapter {
  return adapters[parseFactoryAdjudicatorBinding(binding).kind];
}

/** Independently recorded deployments: Factory oracle rollout and Alpha Manual profiles.
 * The retired Eastboard Manual predates resolver admission; ABI compatibility does
 * not grant it the newer creation policy. Existing markets retain its lifecycle.
 */
export const SUPPORTED_FACTORY_ADJUDICATORS: readonly FactoryAdjudicatorBinding[] = [
  {
    chainId: 46630,
    kind: 'imd-v2',
    address: '0x5543D7b33DCCB17697914Cd9c79D30016E26e435',
    marketFactory: '0xe66BdB17D1a909CfD6D4bB1319A729013FA01c0c',
    profileHash: '0x48054ed09b71dfb0c476ee03319ebe3fd291eec11e5ea798f9a7c566bcaa3249',
    abiBundleHash: ADJUDICATOR_ABI_PINS['imd-v2'],
  },
  {
    chainId: 46630,
    kind: 'zktls',
    address: '0x1a125D304b08ee5bA721168f0B9bc4737c2d4f7D',
    marketFactory: '0xe66BdB17D1a909CfD6D4bB1319A729013FA01c0c',
    profileHash: '0x7b2707f428cdac170a58d2175a0de14b2b86dc5c1725fa75e2722914bc84c356',
    abiBundleHash: ADJUDICATOR_ABI_PINS.zktls,
  },
  {
    chainId: 11155111,
    kind: 'imd-v2',
    address: '0xDD3d4Ba2a33B44830acBBFdf45672ba34e61d975',
    marketFactory: '0x9e4598a8C4Db4eC4249A4A25F08306391cFA46D1',
    profileHash: '0x8bc52a1c7bb1825b8a8c4d007cc68b186276bc458b6d1f2c24369ac91663a2ce',
    abiBundleHash: ADJUDICATOR_ABI_PINS['imd-v2'],
  },
  {
    chainId: 11155111,
    kind: 'zktls',
    address: '0x88FFDA7F417cAB517Fb7e0023D3EBCADD448eb78',
    marketFactory: '0x9e4598a8C4Db4eC4249A4A25F08306391cFA46D1',
    profileHash: '0x3c6d0b41ac484c7f93de6b5d22a8642ff5d49018423c1f85a8a5ae187b5be81b',
    abiBundleHash: ADJUDICATOR_ABI_PINS.zktls,
  },
  {
    chainId: 11155111,
    kind: 'manual',
    address: '0xEA8E510e5Bb22966033213f91C441dfD6DE266d0',
    marketFactory: '0xDC0Ee93dB3Ec590427F65b8D20105b65E842AF17',
    profileHash: '0xada3118761156baa919470d1e76316ee8b7a559170e0aeb67db946b4512505eb',
    abiBundleHash: ADJUDICATOR_ABI_PINS.manual,
  },
  {
    chainId: 11155111,
    kind: 'manual',
    address: '0xa8A874858a6Bb79d53c16dFE2b09dfBc1a33BC3c',
    marketFactory: '0xDC0Ee93dB3Ec590427F65b8D20105b65E842AF17',
    profileHash: '0xcf24a4805b4457963d83831d5b2b790d1f22715d4c2442dfd5e4902c44123a96',
    abiBundleHash: ADJUDICATOR_ABI_PINS.manual,
  },
  {
    chainId: 46630,
    kind: 'manual',
    address: '0xffc97e07f6ec326663060dd0342bfed12ffac010',
    marketFactory: '0x7c807cE75011de0f66Cce10C61bD1FBCF5B72C09',
    profileHash: '0xd9b47b4db27be6c66bdf292bf87ff4452d17f0287d4731fc9234bc0edd2ddb43',
    abiBundleHash: ADJUDICATOR_ABI_PINS.manual,
  },
];
export function resolveFactoryAdjudicatorBinding(
  input: Pick<FactoryAdjudicatorBinding, 'chainId' | 'address' | 'marketFactory' | 'profileHash'>,
): FactoryAdjudicatorBinding {
  const binding = SUPPORTED_FACTORY_ADJUDICATORS.find(
    (candidate) =>
      candidate.chainId === input.chainId &&
      candidate.address.toLowerCase() === input.address.toLowerCase() &&
      candidate.marketFactory.toLowerCase() === input.marketFactory.toLowerCase() &&
      candidate.profileHash.toLowerCase() === input.profileHash.toLowerCase(),
  );
  if (!binding)
    throw new Error('Unknown adjudicator profile; supply an independently pinned binding');
  return { ...binding };
}

export interface FactoryAdjudicatorReader {
  getChainId(): Promise<number>;
  getBlockNumber(): Promise<bigint>;
  readContract(input: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    blockNumber?: bigint;
  }): Promise<unknown>;
}
/**
 * Read every identity at one block. Admission is required for creation. Existing
 * markets may still use a retired profile: their caller verifies the market's
 * adjudicator/profile commitment and explicitly disables current admission here.
 */
export async function verifyFactoryAdjudicatorBinding(
  reader: FactoryAdjudicatorReader,
  input: FactoryAdjudicatorBinding,
  options: { blockNumber?: bigint; requireAdmission?: boolean } = {},
): Promise<
  FactoryAdjudicatorAdapter & { binding: FactoryAdjudicatorBinding; blockNumber: bigint }
> {
  const binding = parseFactoryAdjudicatorBinding(input);
  const adapter = adapters[binding.kind];
  if ((await reader.getChainId()) !== binding.chainId)
    throw new Error('Adjudicator chain mismatch');
  const blockNumber = options.blockNumber ?? (await reader.getBlockNumber());
  const read = (functionName: string) =>
    reader.readContract({ address: binding.address, abi: adapter.abi, functionName, blockNumber });
  const [factory, profileHash, frozen, type] = await Promise.all([
    read('marketFactory'),
    read('profileHash'),
    read('profileFrozen'),
    read('adjudicatorType'),
  ]);
  if (typeof factory !== 'string' || factory.toLowerCase() !== binding.marketFactory.toLowerCase())
    throw new Error('Adjudicator marketFactory mismatch');
  if (
    typeof profileHash !== 'string' ||
    profileHash.toLowerCase() !== binding.profileHash.toLowerCase() ||
    frozen !== true
  )
    throw new Error('Adjudicator frozen profile mismatch');
  if (typeof type !== 'string' || !adapter.adjudicatorTypes.includes(type))
    throw new Error('Unsupported on-chain adjudicator capability');
  if (options.requireAdmission !== false) {
    const admitted = await reader.readContract({
      address: binding.marketFactory,
      abi: MarketFactoryAbi,
      functionName: 'admittedProfileHash',
      args: [binding.address],
      blockNumber,
    });
    if (
      typeof admitted !== 'string' ||
      admitted.toLowerCase() !== binding.profileHash.toLowerCase()
    )
      throw new Error('Adjudicator profile is not admitted');
  }
  if (binding.kind === 'imd' || binding.kind === 'imd-testnet') {
    const semanticBinding = await read('semanticBindingId');
    if (
      typeof semanticBinding !== 'string' ||
      semanticBinding.toLowerCase() !== FACTORY_IMD_SEMANTIC_BINDING_ID
    )
      throw new Error('Unsupported IMD semantic binding');
  }
  if (binding.kind === 'imd-testnet') {
    const [chainId, consumer] = await Promise.all([
      read('certificateChainId'),
      read('certificateConsumer'),
    ]);
    if (
      chainId !== binding.certificateChainId ||
      typeof consumer !== 'string' ||
      consumer.toLowerCase() !== binding.certificateConsumer!.toLowerCase()
    )
      throw new Error('IMD certificate domain mismatch');
  }
  return { ...adapter, binding, blockNumber };
}

/**
 * Discover a capability only through a node's authenticated profile commitment.
 * This checks admission and the finite SDK interface set, not deployed bytecode
 * equivalence. Supply a verified node/market identity, never catalog-only values.
 * Retired market discovery requires its independently read immutable profileHash.
 */
export async function readFactoryAdjudicatorBinding(
  reader: FactoryAdjudicatorReader,
  input: { address: Address; marketFactory: Address; profileHash?: Hex; chainId?: number },
  options: { blockNumber?: bigint; requireAdmission?: boolean } = {},
): Promise<FactoryAdjudicatorBinding> {
  if (options.requireAdmission === false && input.profileHash === undefined)
    throw new Error('Retired adjudicator discovery requires the market profileHash');
  const chainId = await reader.getChainId();
  if (input.chainId !== undefined && input.chainId !== chainId)
    throw new Error('Adjudicator chain mismatch');
  const blockNumber = options.blockNumber ?? (await reader.getBlockNumber());
  // Only common discovery selectors are used before a supported type is known.
  const [type, profileHash] = await Promise.all(
    ['adjudicatorType', 'profileHash'].map((functionName) =>
      reader.readContract({
        address: input.address,
        abi: ManualAdjudicatorAbi,
        functionName,
        blockNumber,
      }),
    ),
  );
  let kind: FactoryAdjudicatorKind;
  switch (type) {
    case 'base':
    case 'manual':
      kind = 'manual';
      break;
    case 'zktls-primus':
      kind = 'zktls';
      break;
    case 'imd-v2':
      kind = 'imd-v2';
      break;
    case 'imd-sqf':
      kind = 'imd';
      break;
    case 'imd-sqf-testnet':
      kind = 'imd-testnet';
      break;
    case 'swarm-expert-sqf':
      kind = 'swarm-expert-sqf';
      break;
    default:
      throw new Error('Unsupported on-chain adjudicator capability');
  }
  if (
    input.profileHash !== undefined &&
    (typeof profileHash !== 'string' ||
      profileHash.toLowerCase() !== input.profileHash.toLowerCase())
  )
    throw new Error('Adjudicator market profile mismatch');
  let certificateChainId: unknown;
  let certificateConsumer: unknown;
  if (kind === 'imd-testnet') {
    [certificateChainId, certificateConsumer] = await Promise.all(
      ['certificateChainId', 'certificateConsumer'].map((functionName) =>
        reader.readContract({
          address: input.address,
          abi: IMDTestnetAdjudicatorAbi,
          functionName,
          blockNumber,
        }),
      ),
    );
  }
  const binding = parseFactoryAdjudicatorBinding({
    ...input,
    chainId,
    kind,
    profileHash,
    abiBundleHash: ADJUDICATOR_ABI_PINS[kind],
    certificateChainId,
    certificateConsumer,
  });
  await verifyFactoryAdjudicatorBinding(reader, binding, { ...options, blockNumber });
  return binding;
}
