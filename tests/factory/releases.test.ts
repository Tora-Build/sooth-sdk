import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { encodeFunctionData, keccak256, type Address, type Hex } from 'viem';
import { assertSupportedFactoryRelease, SUPPORTED_FACTORY_RELEASES } from '../../src/factory/releases.js';
import { getFactoryAbis, ManualAdjudicatorAbi } from '../../src/factory/factoryAbi/index.js';
import { ADJUDICATOR_ABI_PINS, FACTORY_IMD_SEMANTIC_BINDING_ID, getFactoryAdjudicatorAdapter, parseFactoryAdjudicatorBinding, readFactoryAdjudicatorBinding, resolveFactoryAdjudicatorBinding, SUPPORTED_FACTORY_ADJUDICATORS, verifyFactoryAdjudicatorBinding, type FactoryAdjudicatorBinding, type FactoryAdjudicatorReader } from '../../src/factory/adjudicators.js';

const address = '0x1111111111111111111111111111111111111111' as Address;
const marketFactory = '0x2222222222222222222222222222222222222222' as Address;
const profileHash = `0x${'33'.repeat(32)}` as Hex;
const wrongHash = `0x${'44'.repeat(32)}` as Hex;
const manual: FactoryAdjudicatorBinding = { kind: 'manual', chainId: 31337, address, marketFactory, profileHash, abiBundleHash: ADJUDICATOR_ABI_PINS.manual };

function profileReader(binding: FactoryAdjudicatorBinding, overrides: Record<string, unknown> = {}): FactoryAdjudicatorReader {
  const values: Record<string, unknown> = {
    marketFactory: binding.marketFactory, profileHash: binding.profileHash, profileFrozen: true,
    adjudicatorType: binding.kind === 'manual' ? 'base' : binding.kind === 'imd-testnet' ? 'imd-sqf-testnet' : 'imd-sqf',
    admittedProfileHash: binding.profileHash, semanticBindingId: FACTORY_IMD_SEMANTIC_BINDING_ID,
    certificateChainId: binding.certificateChainId, certificateConsumer: binding.certificateConsumer,
    ...overrides,
  };
  return { getChainId: async () => binding.chainId, getBlockNumber: async () => 123n,
    readContract: vi.fn(async call => {
      if (!Object.hasOwn(values, call.functionName)) throw new Error(`Unexpected read ${call.functionName}`);
      return values[call.functionName];
    }) };
}

describe('exact supported Factory artifacts', () => {
  it.each([['v7', 0], ['v7_1', 1]] as const)('binds every exported %s ABI to the exact committed bundle bytes', (name, index) => {
    const release = SUPPORTED_FACTORY_RELEASES[index];
    const bytes = readFileSync(new URL(`../../src/factory/factoryAbi/bundles/${name}.json`, import.meta.url));
    const bundle = JSON.parse(bytes.toString('utf8'));
    expect(keccak256(bytes)).toBe(release.sdkAbiHash);
    expect(bundle.interfaceVersion).toBe(release.interfaceVersion);
    const abis = getFactoryAbis(release);
    for (const [contract, abi] of Object.entries(bundle.contracts)) expect(abis[`${contract}Abi` as keyof typeof abis]).toEqual(abi);
  });
  it('exposes v7.1 maintenance only from the v7.1 artifact', () => {
    const old = getFactoryAbis('sooth-factory-v7').OrderEngineAbi;
    const next = getFactoryAbis('sooth-factory-v7.1').OrderEngineAbi;
    expect(old.some(entry => 'name' in entry && String(entry.name) === 'MAX_DEAD_SKIPS')).toBe(false);
    expect(encodeFunctionData({ abi: next, functionName: 'MAX_DEAD_SKIPS' })).toMatch(/^0x[\da-f]{8}$/);
  });
  it('refuses newer labels and conflicting release/hash commitments', () => {
    const [v7, v71] = SUPPORTED_FACTORY_RELEASES;
    expect(() => getFactoryAbis({ interfaceVersion: 'sooth-factory-v7.2' })).toThrow(/Unsupported/);
    expect(() => getFactoryAbis({ ...v7, releaseId: v71.releaseId })).toThrow(/Unsupported/);
    expect(() => getFactoryAbis({ ...v7, sdkAbiHash: v71.sdkAbiHash })).toThrow(/sdkAbiHash/);
    expect(() => assertSupportedFactoryRelease({ releaseId: wrongHash })).toThrow(/Unsupported/);
    expect(() => assertSupportedFactoryRelease({ sdkAbiHash: v7.sdkAbiHash })).toThrow(/pin required/);
  });
  it('requires an explicit release commitment for local deployment selection', () => {
    const release = SUPPORTED_FACTORY_RELEASES[0];
    expect(() => getFactoryAbis({ interfaceVersion: release.interfaceVersion, chainId: 31337, factory: address })).toThrow(/releaseId/);
    expect(getFactoryAbis({ ...release, chainId: 31337, factory: address })).toBe(getFactoryAbis(release));
    expect(() => getFactoryAbis({ ...release, chainId: 0 })).toThrow(/chainId/);
  });
  it('pins adjudicator source archives independently from node artifacts', () => {
    for (const [file, expected] of [['adjudicator', ADJUDICATOR_ABI_PINS.manual], ['oracle-sources', ADJUDICATOR_ABI_PINS.zktls], ['imd-sources', ADJUDICATOR_ABI_PINS.imd]]) {
      const bytes = readFileSync(new URL(`../../src/factory/factoryAbi/bundles/${file}.json`, import.meta.url));
      expect(keccak256(bytes)).toBe(expected);
      expect(SUPPORTED_FACTORY_RELEASES.some(release => release.sdkAbiHash === expected)).toBe(false);
      if (file === 'adjudicator') expect(JSON.parse(bytes.toString('utf8')).contracts.ManualAdjudicator).toEqual(ManualAdjudicatorAbi);
    }
  });
});

describe('independently admitted adjudicator profiles', () => {
  it('refuses a node ABI hash, unknown profile kind, or absent profile pin', () => {
    expect(() => parseFactoryAdjudicatorBinding({ ...manual, abiBundleHash: SUPPORTED_FACTORY_RELEASES[0].sdkAbiHash })).toThrow(/ABI pin/);
    expect(() => parseFactoryAdjudicatorBinding({ ...manual, kind: 'future' })).toThrow(/Unsupported/);
    expect(() => parseFactoryAdjudicatorBinding({ ...manual, profileHash: undefined })).toThrow(/profileHash/);
    expect(() => getFactoryAdjudicatorAdapter({ ...manual, kind: '__proto__' as 'manual' })).toThrow(/Unsupported/);
  });
  it('never treats an admitted IMD v2 deployment as Manual', () => {
    const binding = resolveFactoryAdjudicatorBinding(SUPPORTED_FACTORY_ADJUDICATORS[0]!);
    expect(binding.kind).toBe('imd-v2');
    expect(getFactoryAdjudicatorAdapter(binding).requiresAttestation).toBe(true);
    expect(() => resolveFactoryAdjudicatorBinding({ ...binding, profileHash: wrongHash })).toThrow(/Unknown/);
    expect(() => resolveFactoryAdjudicatorBinding({ ...binding, chainId: 31337 })).toThrow(/Unknown/);
  });
  it('verifies a custom frozen manual profile with optional attestation at one block', async () => {
    const reader = profileReader(manual);
    const result = await verifyFactoryAdjudicatorBinding(reader, manual);
    expect(result.capabilities).toEqual(['resolve', 'attest', 'dispute', 'settle']);
    expect(result.requiresAttestation).toBe(false);
    expect(result.blockNumber).toBe(123n);
    for (const [call] of vi.mocked(reader.readContract).mock.calls) expect(call.blockNumber).toBe(123n);
  });
  it.each([
    ['marketFactory', address], ['profileHash', wrongHash], ['profileFrozen', false],
    ['adjudicatorType', 'zktls-primus'], ['admittedProfileHash', wrongHash],
  ])('rejects a substituted %s', async (field, value) => {
    await expect(verifyFactoryAdjudicatorBinding(profileReader(manual, { [field]: value }), manual)).rejects.toThrow();
  });
  it('rejects the wrong chain before reading a profile', async () => {
    const reader = profileReader(manual);
    reader.getChainId = async () => 1;
    await expect(verifyFactoryAdjudicatorBinding(reader, manual)).rejects.toThrow(/chain mismatch/);
    expect(reader.readContract).not.toHaveBeenCalled();
  });
  it('allows retired profiles only through an explicit existing-market path', async () => {
    const reader = profileReader(manual, { admittedProfileHash: wrongHash });
    await expect(verifyFactoryAdjudicatorBinding(reader, manual)).rejects.toThrow(/not admitted/);
    await expect(verifyFactoryAdjudicatorBinding(reader, manual, { requireAdmission: false, blockNumber: 200n })).resolves.toMatchObject({ blockNumber: 200n });
  });
  it('refuses an IMD profile without the exact SQF semantic binding', async () => {
    const binding: FactoryAdjudicatorBinding = { ...manual, kind: 'imd', abiBundleHash: ADJUDICATOR_ABI_PINS.imd };
    await expect(verifyFactoryAdjudicatorBinding(profileReader(binding, { semanticBindingId: wrongHash }), binding)).rejects.toThrow(/semantic binding/);
  });
  it('pins the testnet certificate chain and consumer separately', async () => {
    const binding = parseFactoryAdjudicatorBinding({ ...manual, chainId: 46630, kind: 'imd-testnet', abiBundleHash: ADJUDICATOR_ABI_PINS['imd-testnet'], certificateChainId: '11155111', certificateConsumer: address });
    await expect(verifyFactoryAdjudicatorBinding(profileReader(binding), binding)).resolves.toMatchObject({ kind: 'imd-testnet' });
    await expect(verifyFactoryAdjudicatorBinding(profileReader(binding, { certificateConsumer: marketFactory }), binding)).rejects.toThrow(/certificate domain/);
    expect(() => parseFactoryAdjudicatorBinding({ ...binding, certificateChainId: '1' })).toThrow(/certificate chain/);
  });
});

describe('admitted profile capability discovery', () => {
  it('adapts a new admitted manual deployment without an address allowlist', async () => {
    await expect(readFactoryAdjudicatorBinding(profileReader(manual), { address, marketFactory, profileHash })).resolves.toEqual(manual);
  });
  it('refuses an arbitrary type even when the node admits its hash', async () => {
    await expect(readFactoryAdjudicatorBinding(profileReader(manual, { adjudicatorType: 'future-oracle' }), { address, marketFactory })).rejects.toThrow(/Unsupported/);
  });
  it('requires a market commitment for retired profiles', async () => {
    await expect(readFactoryAdjudicatorBinding(profileReader(manual), { address, marketFactory }, { requireAdmission: false })).rejects.toThrow(/profileHash/);
    await expect(readFactoryAdjudicatorBinding(profileReader(manual), { address, marketFactory, profileHash: wrongHash }, { requireAdmission: false })).rejects.toThrow(/profile mismatch/);
  });
  it('discovers and rechecks an admitted SQF testnet certificate domain', async () => {
    const binding: FactoryAdjudicatorBinding = { ...manual, kind: 'imd-testnet', chainId: 46630, abiBundleHash: ADJUDICATOR_ABI_PINS['imd-testnet'], certificateChainId: 11155111n, certificateConsumer: address };
    const reader = profileReader(binding);
    await expect(readFactoryAdjudicatorBinding(reader, { address, marketFactory, profileHash }, { blockNumber: 555n })).resolves.toEqual(binding);
    for (const [call] of vi.mocked(reader.readContract).mock.calls) expect(call.blockNumber).toBe(555n);
  });
});
