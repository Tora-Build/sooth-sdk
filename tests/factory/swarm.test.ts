import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { decodeAbiParameters, decodeFunctionData, encodeAbiParameters, keccak256, parseAbiParameters, type Address, type Hex } from 'viem';
import { ADJUDICATOR_ABI_PINS, getFactoryAdjudicatorAdapter, readFactoryAdjudicatorBinding, SUPPORTED_FACTORY_ADJUDICATORS, verifyFactoryAdjudicatorBinding, type FactoryAdjudicatorBinding, type FactoryAdjudicatorReader } from '../../src/factory/adjudicators.js';
import { SwarmAdjudicatorAbi } from '../../src/factory/factoryAbi/SwarmAdjudicator.js';
import { getSwarmJudgmentDigest, getSwarmMandateId, hashSwarmJobId, hashSwarmReport, hashSwarmSQF, prepareSwarmAcceptance, prepareSwarmCreationConfig, prepareSwarmJudgment, type SwarmJudgmentInput, type SwarmMandateInput } from '../../src/factory/swarm.js';

const adjudicator = '0x1111111111111111111111111111111111111111' as Address;
const relay = '0x2222222222222222222222222222222222222222' as Address;
const creator = '0x3333333333333333333333333333333333333333' as Address;
const market = '0x4444444444444444444444444444444444444444' as Address;
const other = '0x5555555555555555555555555555555555555555' as Address;
const profileHash = `0x${'66'.repeat(32)}` as Hex;
const otherHash = `0x${'77'.repeat(32)}` as Hex;
const binding: FactoryAdjudicatorBinding = {
  kind: 'swarm-expert-sqf', chainId: 31337, address: adjudicator,
  marketFactory: other, profileHash, abiBundleHash: ADJUDICATOR_ABI_PINS['swarm-expert-sqf'],
};
const sqf = '§question\nWill the exhibition be judged a success? 🎨\n§rule\nConsider expert reviews and public reception.\n';
const uuid = '2a7594d2-92d3-4ffa-b40b-ebc8a29d5c1d';
const report = new TextEncoder().encode('Accepted. Research may use qualitative evidence.\r\n');
const request = { binding, relay, creator, sqf, deadline: 200n, now: 100n, jobId: uuid, report };

function reader(overrides: Record<string, unknown> = {}): FactoryAdjudicatorReader {
  const values: Record<string, unknown> = {
    marketFactory: binding.marketFactory, profileHash, profileFrozen: true,
    adjudicatorType: 'swarm-expert-sqf', admittedProfileHash: profileHash, ...overrides,
  };
  return {
    getChainId: async () => binding.chainId,
    getBlockNumber: async () => 123n,
    readContract: vi.fn(async call => {
      if (!Object.hasOwn(values, call.functionName)) throw new Error(`Unexpected read ${call.functionName}`);
      return values[call.functionName];
    }),
  };
}

describe('exact swarm commitments', () => {
  it('retains the full SQF and hashes exact UTF-8 rather than parsed or normalized text', () => {
    const accepted = prepareSwarmAcceptance(request);
    const config = prepareSwarmCreationConfig(sqf, accepted.mandate);
    const [selectedRelay, deadline, typeConfig] = decodeAbiParameters(parseAbiParameters('address, uint64, bytes'), config.adjudicatorConfig);
    const [question, mandateId] = decodeAbiParameters(parseAbiParameters('string, bytes32'), typeConfig);
    expect(selectedRelay.toLowerCase()).toBe(relay);
    expect(deadline).toBe(200n);
    expect(question).toBe(sqf);
    expect(config.question).toBe(sqf);
    expect(config.questionHash).toBe(keccak256(new TextEncoder().encode(sqf)));
    expect(mandateId).toBe(accepted.mandateId);
    expect(config.creator).toBe(creator);
    expect(hashSwarmSQF(sqf.trim())).not.toBe(config.questionHash);
    expect(() => prepareSwarmCreationConfig(sqf + ' ', accepted.mandate)).toThrow(/SQF/);
    expect(hashSwarmSQF('\ufeff' + sqf)).not.toBe(config.questionHash);
    expect(() => hashSwarmSQF('\ud800')).toThrow(/lossless UTF-8/);
    expect(() => hashSwarmSQF('')).toThrow(/empty/);
    expect(() => hashSwarmSQF(' \n\t ')).toThrow(/empty/);
  });

  it('uses SHA256 of original report bytes and exact UUID text', () => {
    expect(hashSwarmJobId(uuid)).toBe(`0x${createHash('sha256').update(uuid, 'utf8').digest('hex')}`);
    expect(hashSwarmReport(report)).toBe(`0x${createHash('sha256').update(report).digest('hex')}`);
    expect(() => hashSwarmJobId(uuid.toUpperCase())).toThrow(/lowercase UUID/);
    expect(hashSwarmReport(new TextEncoder().encode(new TextDecoder().decode(report).trim()))).not.toBe(hashSwarmReport(report));
    expect(() => hashSwarmJobId('not-a-job')).toThrow(/UUID/);
  });

  it('matches the mandate Solidity abi.encode field order and exposes creator calldata', () => {
    const result = prepareSwarmAcceptance(request);
    const m = result.mandate;
    expect(result.mandateId).toBe(keccak256(encodeAbiParameters(
      parseAbiParameters('uint256,address,address,address,bytes32,uint64,bytes32,bytes32'),
      [31337n, adjudicator, relay, creator, hashSwarmSQF(sqf), 200n, m.jobId, m.reportHash],
    )));
    const call = decodeFunctionData({ abi: SwarmAdjudicatorAbi, data: result.call.data });
    expect(call.functionName).toBe('acceptMandate');
    expect(call.args).toEqual([creator, m.sqfHash, 200n, m.jobId, m.reportHash]);
  });

  it.each([
    { chainId: 1n }, { adjudicator: other }, { relay: other }, { creator: other },
    { sqfHash: otherHash }, { deadline: 201n }, { jobId: otherHash }, { reportHash: otherHash },
  ] satisfies Partial<SwarmMandateInput>[] )('binds each acceptance identity field: %o', change => {
    const accepted = prepareSwarmAcceptance(request);
    expect(getSwarmMandateId({ ...accepted.mandate, ...change })).not.toBe(accepted.mandateId);
  });

  it.each([0n, 99n, 100n, (1n << 64n) - 1n, 1n << 64n])('refuses nonfuture or unbounded acceptance deadline %s', deadline => {
    expect(() => prepareSwarmAcceptance({ ...request, deadline })).toThrow(/deadline/);
  });

  it('binds record and resolve to one judgment with explicit NO/YES/INVALID values', () => {
    const accepted = prepareSwarmAcceptance(request);
    for (const outcome of [0, 1, 2] as const) {
      const result = prepareSwarmJudgment({ binding, market, mandateId: accepted.mandateId, outcome, jobId: uuid, report });
      expect(result.digest).toBe(keccak256(encodeAbiParameters(
        parseAbiParameters('uint256,address,address,bytes32,uint8,bytes32,bytes32'),
        [31337n, adjudicator, market, accepted.mandateId, outcome, result.judgment.jobId, result.judgment.reportHash],
      )));
      expect(decodeFunctionData({ abi: SwarmAdjudicatorAbi, data: result.recordCall.data })).toMatchObject({
        functionName: 'recordJudgment', args: [market, outcome, result.judgment.jobId, result.judgment.reportHash],
      });
      expect(decodeFunctionData({ abi: SwarmAdjudicatorAbi, data: result.resolveCall.data })).toMatchObject({
        functionName: 'resolve', args: [market, outcome, result.digest],
      });
      expect(() => getSwarmJudgmentDigest({ ...result.judgment, outcome: 3 as 0 })).toThrow(/outcome/);
    }
  });

  it.each([
    { chainId: 1n }, { adjudicator: other }, { market: other }, { mandateId: otherHash },
    { outcome: 2 }, { jobId: otherHash }, { reportHash: otherHash },
  ] satisfies Partial<SwarmJudgmentInput>[] )('binds each judgment identity field: %o', change => {
    const accepted = prepareSwarmAcceptance(request);
    const result = prepareSwarmJudgment({ binding, market, mandateId: accepted.mandateId, outcome: 1, jobId: uuid, report });
    expect(getSwarmJudgmentDigest({ ...result.judgment, ...change })).not.toBe(result.digest);
  });
});

describe('swarm profile capability discovery', () => {
  it('pins the independently archived static ABI without claiming deployments', () => {
    const bytes = readFileSync(new URL('../../src/factory/factoryAbi/bundles/swarm.json', import.meta.url));
    expect(keccak256(bytes)).toBe(ADJUDICATOR_ABI_PINS['swarm-expert-sqf']);
    expect(JSON.parse(bytes.toString('utf8')).contracts.SwarmAdjudicator).toEqual(SwarmAdjudicatorAbi);
    expect(SUPPORTED_FACTORY_ADJUDICATORS.some(item => item.kind === 'swarm-expert-sqf')).toBe(false);
  });

  it('discovers an admitted frozen custom deployment and its relay capabilities', async () => {
    const source = reader();
    const discovered = await readFactoryAdjudicatorBinding(source, { address: adjudicator, marketFactory: other, profileHash });
    expect(discovered).toEqual(binding);
    const adapter = getFactoryAdjudicatorAdapter(discovered);
    expect(adapter.requiresAttestation).toBe(false);
    expect(adapter.capabilities).toEqual(['acceptMandate', 'recordJudgment', 'resolve', 'dispute', 'settle']);
    for (const [call] of vi.mocked(source.readContract).mock.calls) expect(call.blockNumber).toBe(123n);
  });

  it.each([
    ['profileFrozen', false], ['marketFactory', creator], ['profileHash', otherHash],
    ['admittedProfileHash', otherHash], ['adjudicatorType', 'imd-sqf'],
  ])('rejects substituted profile identity %s', async (field, value) => {
    await expect(verifyFactoryAdjudicatorBinding(reader({ [field]: value }), binding)).rejects.toThrow();
  });

  it('rejects other profiles and independently wrong ABI pins in offline preparations', () => {
    expect(() => prepareSwarmAcceptance({ ...request, binding: { ...binding, kind: 'manual', abiBundleHash: ADJUDICATOR_ABI_PINS.manual } })).toThrow(/swarm-expert-sqf/);
    expect(() => prepareSwarmAcceptance({ ...request, binding: { ...binding, abiBundleHash: ADJUDICATOR_ABI_PINS.manual } })).toThrow(/ABI pin/);
  });
});
