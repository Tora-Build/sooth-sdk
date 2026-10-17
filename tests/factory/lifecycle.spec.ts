import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, encodeAbiParameters, encodeEventTopics, zeroAddress, zeroHash, type Address, type Hex, type TransactionReceipt } from 'viem';
import { SUPPORTED_FACTORY_RELEASES } from '../../src/factory/releases.js';
import { getFactoryAbis } from '../../src/factory/factoryAbi/index.js';
import { deriveNodeChildren } from '../../src/factory/factoryTrade/nodeChildren.js';
import { buildFactoryTransaction, decodeFactoryCreatedMarket, type FactoryCreationParams } from '../../src/factory/factoryTransactions.js';
import { buildFactoryNodeTransaction, readFactoryLiquidityQuote, type FactoryNodeRequest } from '../../src/factory/factoryLifecycle.js';
import type { BindingRead, FactoryNodeContext } from '../../src/factory/factoryClient.js';
import type * as FactoryClientModule from '../../src/factory/factoryClient.js';
import { ADJUDICATOR_ABI_PINS, type FactoryAdjudicatorBinding } from '../../src/factory/adjudicators.js';
import { prepareSwarmAcceptance, prepareSwarmCreationConfig } from '../../src/factory/swarm.js';

const state = vi.hoisted(() => ({ operation: vi.fn() }));
vi.mock('../../src/factory/factoryClient.js', async importOriginal => ({
  ...await importOriginal<typeof FactoryClientModule>(),
  verifyFactoryOperation: state.operation,
}));
const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const account = address(1);
const market = address(2);
const adjudicator = address(3);
const token = address(4);
const deployer = address(5);
const release = SUPPORTED_FACTORY_RELEASES[1];
const context: FactoryNodeContext = {
  chainId: release.chainId, factory: release.factory, nodeId: hash(1), release,
  contracts: { ...deriveNodeChildren(deployer), deployer }, startBlock: BigInt(release.startBlock), blockNumber: BigInt(release.startBlock + 10),
};
let calls: BindingRead[];
let answers: Record<string, unknown>;
beforeEach(() => {
  calls = [];
  answers = { allowedTokens: true, isLiquidityOpen: true, deadline: 1000n, quoteLiquidityWithState: [1_000_001n, 1_000_001n * 10n ** 12n, 5n * 10n ** 17n, hash(7)] };
  const reader = {
    getBlockNumber: async () => context.blockNumber,
    readContract: async (call: BindingRead) => {
      calls.push(call);
      const answer = answers[call.functionName];
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  state.operation.mockResolvedValue({ context, reader, read: (address: Address, abi: readonly unknown[], functionName: string, args: readonly unknown[] = []) => reader.readContract({ address, abi, functionName, args, blockNumber: context.blockNumber }), marketBinding: { market, adjudicator } });
});

describe('creation and node authority requests', () => {
  it('approves finite native creation funding to MarketFactory without requiring a market', async () => {
    const request = await buildFactoryTransaction({ context, endpoints: [], account, action: { kind: 'approveCreation', tokenA: token, amountNative: 1_000_001n } });
    expect(request.address).toBe(token);
    expect(request.args).toEqual([context.contracts.marketFactory, 1_000_001n]);
    expect(calls.at(-1)).toMatchObject({ account, blockNumber: context.blockNumber, functionName: 'approve' });
  });
  it('rejects unlimited creation approvals and nonadmitted tokens', async () => {
    await expect(buildFactoryTransaction({ context, endpoints: [], account, action: { kind: 'approveCreation', tokenA: token, amountNative: (1n << 256n) - 1n } })).rejects.toThrow('finite');
    answers.allowedTokens = false;
    await expect(buildFactoryTransaction({ context, endpoints: [], account, action: { kind: 'approveCreation', tokenA: token, amountNative: 1n } })).rejects.toThrow('not admitted');
  });
  it('simulates role acceptance with the caller and propagates actual authority guards', async () => {
    answers.acceptNodeAdmin = new Error('Unauthorized');
    await expect(buildFactoryTransaction({ context, endpoints: [], account, action: { kind: 'acceptNodeAdmin' } })).rejects.toThrow('Unauthorized');
    expect(calls.at(-1)).toMatchObject({ address: context.contracts.roles, functionName: 'acceptNodeAdmin', account });
  });
  it('prepares bounded expired-head maintenance and preserves its market', async () => {
    const request = await buildFactoryTransaction({ context, endpoints: [], account, market, action: { kind: 'advanceHead', side: 1, tick: 500, maxSteps: 32n } });
    expect(request.args).toEqual([market, 1, 500, 32n]);
    expect(request.address).toBe(context.contracts.book);
    answers.advanceHead = new Error('MarketNotLive');
    await expect(buildFactoryTransaction({ context, endpoints: [], account, market, action: { kind: 'advanceHead', side: 1, tick: 500, maxSteps: 32n } })).rejects.toThrow('MarketNotLive');
  });
  it('refuses a changed creation fee commitment before simulation', async () => {
    Object.assign(answers, { creationPaused: false, admittedProfileHash: hash(2), invalidationBuffer: 3600n, activeConfigVersion: 2, configHash: hash(3) });
    const params: FactoryCreationParams = { question: 'Question?', startTime: 0n, deadline: 1000n, adjudicator, tokenA: token, bBase: 10n ** 18n, initialProbabilityWad: 5n * 10n ** 17n, adjudicatorConfig: '0x', maxInputNative: 1_000_000n, quoteDeadline: 500n, expectedAmmVersion: 1, expectedBookVersion: 1, expectedAmmHash: hash(3), expectedBookHash: hash(3), resolutionTermsHash: hash(4), expectedProfileHash: hash(2), expectedInvalidationBuffer: 3600n };
    await expect(buildFactoryTransaction({ context, endpoints: [], account, action: { kind: 'createMarket', params } })).rejects.toThrow('fee configuration changed');
    expect(calls.some(call => call.functionName === 'createMarket')).toBe(false);
  });
});

describe('state-bound liquidity', () => {
  const endpoints = ['https://liquidity-a.example', 'https://liquidity-b.example'].map(url => ({
    url,
    reader: {
      getChainId: async () => context.chainId,
      getBlockNumber: async () => context.blockNumber,
      readContract: async (call: BindingRead) => {
        calls.push(call);
        const contracts = context.contracts;
        const binding: Record<string, unknown> = {
          nodeDeployer: deployer, releaseId: release.releaseId,
          marketFactory: contracts.marketFactory, ammEngine: contracts.amm,
          orderEngine: contracts.book, positionManager: contracts.positionManager,
          engine: contracts.amm, vault: contracts.ammVault, roles: contracts.roles,
          feeVault: call.address.toLowerCase() === contracts.amm.toLowerCase() ? contracts.ammVault : contracts.bookVault,
          adjudicator,
        };
        const answer = call.functionName in binding ? binding[call.functionName] : answers[call.functionName];
        if (answer instanceof Error) throw answer;
        if (answer === undefined) throw new Error(`Unexpected liquidity read: ${call.functionName}`);
        return answer;
      },
    },
  }));
  it('keeps native funding separate from WAD receipts and binds state at one block', async () => {
    const quote = await readFactoryLiquidityQuote({ context, endpoints, market, additionalB: 10n ** 18n, deadline: 900n, slippageBps: 100 });
    expect(quote.limits.maxTokenIn).toBe(1_010_002n);
    expect(quote.limits.minLpOut).toBe(1_000_001n * 10n ** 12n * 99n / 100n);
    expect(quote.limits.expectedStateHash).toBe(hash(7));
    expect(calls.every(call => call.blockNumber === context.blockNumber)).toBe(true);
  });
  it('refuses liquidity closed by resolution and deadlines beyond the market', async () => {
    answers.isLiquidityOpen = false;
    await expect(readFactoryLiquidityQuote({ context, endpoints, market, additionalB: 1n, deadline: 900n })).rejects.toThrow('closed');
    answers.isLiquidityOpen = true;
    await expect(readFactoryLiquidityQuote({ context, endpoints, market, additionalB: 1n, deadline: 1001n })).rejects.toThrow('deadline');
  });
});

function creationReceipt(): TransactionReceipt {
  const { MarketFactoryAbi } = getFactoryAbis(release);
  const event = MarketFactoryAbi.find(item => item.type === 'event' && item.name === 'MarketCreated');
  if (!event || event.type !== 'event') throw new Error('Missing creation event');
  const transactionHash = hash(10);
  const blockHash = hash(11);
  const topics = encodeEventTopics({ abi: MarketFactoryAbi, eventName: 'MarketCreated', args: { market, creator: account } });
  const data = encodeAbiParameters(event.inputs.filter(input => !input.indexed), ['Question?', 1n, 1000n, token, 6, 10n ** 18n, adjudicator, 1n, 0n]);
  return { status: 'success', from: account, to: context.contracts.marketFactory, transactionHash, transactionIndex: 0, blockHash, blockNumber: context.blockNumber, logs: [{ address: context.contracts.marketFactory, topics, data, transactionHash, transactionIndex: 0, blockHash, blockNumber: context.blockNumber, logIndex: 0, removed: false }] } as TransactionReceipt;
}
describe('authoritative creation receipt', () => {
  it('returns the emitted address for exact factory/account/receipt identity', () => {
    expect(decodeFactoryCreatedMarket({ receipt: creationReceipt(), context, account })).toBe(market);
  });
  it('rejects foreign emitters, duplicate creation events, stale log hashes and account mismatch', () => {
    const receipt = creationReceipt();
    expect(() => decodeFactoryCreatedMarket({ receipt: { ...receipt, logs: [{ ...receipt.logs[0]!, address: address(99) }] }, context })).toThrow('exactly one');
    expect(() => decodeFactoryCreatedMarket({ receipt: { ...receipt, logs: [...receipt.logs, ...receipt.logs] }, context })).toThrow('exactly one');
    expect(() => decodeFactoryCreatedMarket({ receipt: { ...receipt, logs: [{ ...receipt.logs[0]!, blockHash: hash(99) }] }, context })).toThrow('identity');
    expect(() => decodeFactoryCreatedMarket({ receipt, context, account: address(99) })).toThrow('account');
  });
});

describe('staged node activation', () => {
  const request: FactoryNodeRequest = { releaseId: release.releaseId, userSalt: hash(1), requester: account, nodeAdmin: account, bookToken: token, ammSurplusRecipient: account, expiry: 1000n, expectedBookPolicyVersion: 1, expectedBookPolicyHash: hash(2), ammConfig: { feeBps: 10, capitalBps: 2500, lpBps: 2500, resolutionBps: 2500, operatorBps: 2500, operatorRecipient: account } };
  function endpoints(prepared: boolean, rejectCompletion = false) {
    const readContract = async (call: BindingRead) => {
      calls.push(call);
      const results: Record<string, unknown> = {
        registry: address(20), nodeId: hash(1), requestHash: hash(2), predictNode: [deployer, {}],
        pendingDeployer: prepared ? deployer : zeroAddress, nodeDeployer: zeroAddress,
        pendingRequestHash: prepared ? hash(2) : zeroHash, factory: release.factory,
        releaseId: release.releaseId, committedRequestHash: hash(2), prepared, activated: false,
        validateActiveBookPolicy: {}, validateBookPolicy: {}, beginNode: [hash(1), deployer], completeNode: [hash(1), {}],
      };
      if (rejectCompletion && call.functionName === 'completeNode') throw new Error('Unauthorized');
      if (!(call.functionName in results)) throw new Error(`Unexpected ${call.functionName}`);
      return results[call.functionName];
    };
    return [1, 2].map(n => ({ url: `https://rpc${n}.example`, reader: { getChainId: async () => release.chainId, getBlockNumber: async () => context.blockNumber, readContract } }));
  }
  it('prepares through the public factory beginNode and simulates consent', async () => {
    const tx = await buildFactoryNodeTransaction({ release, endpoints: endpoints(false), account, action: { kind: 'prepareNode', request } });
    expect(tx.to).toBe(release.factory.toLowerCase());
    expect(decodeFunctionData({ abi: tx.abi, data: tx.data }).functionName).toBe('beginNode');
    expect(calls.filter(call => call.functionName === 'beginNode').every(call => call.account === account)).toBe(true);
  });
  it('activates only by completing the bound prepared request and propagates guards', async () => {
    const tx = await buildFactoryNodeTransaction({ release, endpoints: endpoints(true), account, action: { kind: 'activateNode', request } });
    expect(decodeFunctionData({ abi: tx.abi, data: tx.data }).functionName).toBe('completeNode');
    await expect(buildFactoryNodeTransaction({ release, endpoints: endpoints(false), account, action: { kind: 'activateNode', request } })).rejects.toThrow('not pending');
    await expect(buildFactoryNodeTransaction({ release, endpoints: endpoints(true, true), account, action: { kind: 'activateNode', request } })).rejects.toThrow();
  });
});

describe('independent adjudicator dispatch', () => {
  const binding = (kind: FactoryAdjudicatorBinding['kind']): FactoryAdjudicatorBinding => ({ kind, chainId: release.chainId, address: adjudicator, marketFactory: context.contracts.marketFactory, profileHash: hash(9), abiBundleHash: ADJUDICATOR_ABI_PINS[kind] });
  it('refuses unknown profiles instead of routing them through Manual', async () => {
    answers.profileHash = hash(9);
    await expect(buildFactoryTransaction({ context, endpoints: [], account, market, action: { kind: 'settle' } })).rejects.toThrow();
    expect(calls.some(call => call.functionName === 'settle')).toBe(false);
  });
  it('prepares optional Manual attestation with empty proof and propagates contract guards', async () => {
    Object.assign(answers, { profileHash: hash(9), marketFactory: context.contracts.marketFactory, profileFrozen: true, adjudicatorType: 'manual' });
    const input = { context, endpoints: [], account, market, adjudicatorBinding: binding('manual'), action: { kind: 'attest' as const, proof: '0x' as Hex } };
    const tx = await buildFactoryTransaction(input);
    expect(tx.address).toBe(adjudicator);
    expect(tx.args).toEqual([market, '0x']);
    expect(calls.at(-1)).toMatchObject({ functionName: 'attest', account, blockNumber: context.blockNumber });
    answers.attest = new Error('Attestation deadline passed');
    await expect(buildFactoryTransaction(input)).rejects.toThrow('Attestation deadline passed');
  });
  it.each([['zktls', 'zktls-primus'], ['imd-v2', 'imd-v2']] as const)('attests through the independently admitted %s ABI', async (kind, adjudicatorType) => {
    Object.assign(answers, { profileHash: hash(9), marketFactory: context.contracts.marketFactory, profileFrozen: true, adjudicatorType });
    const tx = await buildFactoryTransaction({ context, endpoints: [], account, market, adjudicatorBinding: binding(kind), action: { kind: 'attest', proof: '0x1234' } });
    expect(tx.address).toBe(adjudicator);
    expect(tx.args).toEqual([market, '0x1234']);
    expect(calls.at(-1)).toMatchObject({ functionName: 'attest', account });
    expect(calls.some(call => call.functionName === 'admittedProfileHash')).toBe(false);
  });
  it('checks admission before accepting a creator-bound mandate without an existing market', async () => {
    Object.assign(answers, { profileHash: hash(9), admittedProfileHash: hash(9), marketFactory: context.contracts.marketFactory, profileFrozen: true, adjudicatorType: 'swarm-expert-sqf' });
    const action = { kind: 'acceptMandate' as const, adjudicator, creator: account, sqfHash: hash(20), deadline: 1000n, jobId: hash(21), reportHash: hash(22) };
    const tx = await buildFactoryTransaction({ context, endpoints: [], account, action });
    expect(tx.args).toEqual([account, hash(20), 1000n, hash(21), hash(22)]);
    expect(calls.at(-1)).toMatchObject({ address: adjudicator, functionName: 'acceptMandate', account });
    expect(state.operation.mock.calls.at(-1)?.[0].market).toBeUndefined();
    answers.admittedProfileHash = hash(99);
    await expect(buildFactoryTransaction({ context, endpoints: [], account, adjudicatorBinding: binding('swarm-expert-sqf'), action })).rejects.toThrow('not admitted');
    answers.admittedProfileHash = hash(9);
    answers.acceptMandate = new Error('ResolverNotApproved');
    await expect(buildFactoryTransaction({ context, endpoints: [], account, action })).rejects.toThrow('ResolverNotApproved');
  });
  it('preserves the exact accepted SQF in creation and propagates the mandate-consumption guard', async () => {
    Object.assign(answers, { creationPaused: false, admittedProfileHash: hash(9), invalidationBuffer: 3600n, activeConfigVersion: 1, configHash: hash(3), profileHash: hash(9), marketFactory: context.contracts.marketFactory, profileFrozen: true, adjudicatorType: 'swarm-expert-sqf' });
    const sqf = '§question\nWas the project successful?\n§rule\nUse expert judgment.\n';
    const accepted = prepareSwarmAcceptance({ binding: binding('swarm-expert-sqf'), creator: account, relay: account, sqf, deadline: 1000n, now: 1n, jobId: '2a7594d2-92d3-4ffa-b40b-ebc8a29d5c1d', report: new TextEncoder().encode('ACCEPT') });
    const config = prepareSwarmCreationConfig(sqf, accepted.mandate);
    const params: FactoryCreationParams = { question: config.question, startTime: 0n, deadline: config.deadline, adjudicator, tokenA: token, bBase: 10n ** 18n, initialProbabilityWad: 5n * 10n ** 17n, adjudicatorConfig: config.adjudicatorConfig, maxInputNative: 1_000_000n, quoteDeadline: 500n, expectedAmmVersion: 1, expectedBookVersion: 1, expectedAmmHash: hash(3), expectedBookHash: hash(3), resolutionTermsHash: hash(4), expectedProfileHash: hash(9), expectedInvalidationBuffer: 3600n };
    const tx = await buildFactoryTransaction({ context, endpoints: [], account, action: { kind: 'createMarket', params } });
    expect(tx.args).toEqual([params]);
    answers.createMarket = new Error('MandateAlreadyBound');
    await expect(buildFactoryTransaction({ context, endpoints: [], account, action: { kind: 'createMarket', params } })).rejects.toThrow('MandateAlreadyBound');
  });
  it('records judgment on a retired market profile while propagating deadline and replay guards', async () => {
    Object.assign(answers, { profileHash: hash(9), marketFactory: context.contracts.marketFactory, profileFrozen: true, adjudicatorType: 'swarm-expert-sqf', admittedProfileHash: zeroHash });
    const action = { kind: 'recordJudgment' as const, outcome: 1 as const, jobId: hash(21), reportHash: hash(22) };
    const tx = await buildFactoryTransaction({ context, endpoints: [], account, market, action });
    expect(tx.args).toEqual([market, 1, hash(21), hash(22)]);
    expect(calls.some(call => call.functionName === 'admittedProfileHash')).toBe(false);
    answers.recordJudgment = new Error('ResolutionTooEarly');
    await expect(buildFactoryTransaction({ context, endpoints: [], account, market, action })).rejects.toThrow('ResolutionTooEarly');
    answers.recordJudgment = new Error('JobAlreadyUsed');
    await expect(buildFactoryTransaction({ context, endpoints: [], account, market, action })).rejects.toThrow('JobAlreadyUsed');
    await expect(buildFactoryTransaction({ context, endpoints: [], account, market, action: { kind: 'attest', proof: '0x' } })).rejects.toThrow('does not support');
  });
  it('creates with the exact bounded tuple only after frozen profile verification and simulation', async () => {
    Object.assign(answers, { creationPaused: false, admittedProfileHash: hash(9), invalidationBuffer: 3600n, activeConfigVersion: 1, configHash: hash(3), profileHash: hash(9), marketFactory: context.contracts.marketFactory, profileFrozen: true, adjudicatorType: 'manual' });
    const params: FactoryCreationParams = { question: 'Question?', startTime: 0n, deadline: 1000n, adjudicator, tokenA: token, bBase: 10n ** 18n, initialProbabilityWad: 5n * 10n ** 17n, adjudicatorConfig: '0x', maxInputNative: 1_000_000n, quoteDeadline: 500n, expectedAmmVersion: 1, expectedBookVersion: 1, expectedAmmHash: hash(3), expectedBookHash: hash(3), resolutionTermsHash: hash(4), expectedProfileHash: hash(9), expectedInvalidationBuffer: 3600n };
    const tx = await buildFactoryTransaction({ context, endpoints: [], account, adjudicatorBinding: binding('manual'), action: { kind: 'createMarket', params } });
    expect(tx.args).toEqual([params]);
    expect(tx.address).toBe(context.contracts.marketFactory);
    expect(calls.at(-1)).toMatchObject({ functionName: 'createMarket', account, blockNumber: context.blockNumber });
    answers.createMarket = new Error('ResolverNotApproved');
    await expect(buildFactoryTransaction({ context, endpoints: [], account, adjudicatorBinding: binding('manual'), action: { kind: 'createMarket', params } })).rejects.toThrow('ResolverNotApproved');
  });
});

describe('fresh admitted profile discovery', () => {
  it.each(['manual', 'zktls-primus', 'imd-v2', 'swarm-expert-sqf'])('settles a dynamically deployed %s profile through the finite adapter table', async adjudicatorType => {
    Object.assign(answers, { profileHash: hash(9), marketFactory: context.contracts.marketFactory, profileFrozen: true, adjudicatorType });
    const tx = await buildFactoryTransaction({ context, endpoints: [], account, market, action: { kind: 'settle' } });
    expect(tx.address).toBe(adjudicator);
    expect(tx.functionName).toBe('settle');
    expect(calls.at(-1)).toMatchObject({ account, functionName: 'settle', args: [market] });
  });
});
