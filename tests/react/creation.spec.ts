import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { erc20Abi, type Address, type Hex } from 'viem';
import { verifyFactoryOperation, type FactoryNodeContext } from '../../src/factory/factoryClient.js';
import { readFactoryAdjudicatorBinding, type FactoryAdjudicatorBinding } from '../../src/factory/adjudicators.js';
import { buildFactoryTransaction } from '../../src/factory/factoryTransactions.js';
import { deriveNodeChildren } from '../../src/factory/factoryTrade/nodeChildren.js';
import { SUPPORTED_FACTORY_RELEASES } from '../../src/factory/releases.js';
import { planSoothCreation, readSoothCreationOptions, sendSoothCreation, type SoothCreationIntent } from '../../src/react/creation.js';
import { loadSoothPendingCreations, saveSoothPendingCreation } from '../../src/react/creationRecovery.js';
import { canPersistSoothPending, type SoothWalletAdapter } from '../../src/react/wallet.js';
import { formatSoothNodeReference } from '../../src/react/node.js';
import type { SoothResolvedNode } from '../../src/react/runtime.js';
import type * as FactoryClientModule from '../../src/factory/factoryClient.js';
import type * as AdjudicatorsModule from '../../src/factory/adjudicators.js';
import type * as FactoryTransactionsModule from '../../src/factory/factoryTransactions.js';

vi.mock('../../src/factory/factoryClient.js', async original => ({ ...await original<typeof FactoryClientModule>(), verifyFactoryOperation: vi.fn() }));
vi.mock('../../src/factory/adjudicators.js', async original => ({ ...await original<typeof AdjudicatorsModule>(), readFactoryAdjudicatorBinding: vi.fn() }));
vi.mock('../../src/factory/factoryTransactions.js', async original => ({ ...await original<typeof FactoryTransactionsModule>(), buildFactoryTransaction: vi.fn() }));
vi.mock('../../src/react/wallet.js', () => ({ canPersistSoothPending: vi.fn() }));
vi.mock('../../src/react/creationRecovery.js', () => ({ loadSoothPendingCreations: vi.fn(), saveSoothPendingCreation: vi.fn(), reconcileSoothCreation: vi.fn() }));
const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const account = address(4), token = address(5), adjudicator = address(6), resolver = address(7);
const context: FactoryNodeContext = {
  chainId: 46630, factory: address(1), nodeId: hash(1),
  release: { ...SUPPORTED_FACTORY_RELEASES[1], factory: address(1), startBlock: 1 },
  contracts: { ...deriveNodeChildren(address(2)), deployer: address(2) }, startBlock: 1n, blockNumber: 10n,
};
let node: SoothResolvedNode, wallet: SoothWalletAdapter, intent: SoothCreationIntent;
let values: Record<string, unknown>;
const read = vi.fn(async (_address: Address, _abi: unknown, name: string) => {
  if (!(name in values)) throw new Error(`Unexpected read ${name}`);
  return values[name];
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('navigator', { locks: { request: vi.fn(async (_name: string, _options: unknown, run: (lock: object | null) => Promise<unknown>) => run({})) } });
  values = { creationPaused: false, permissionlessCreation: true, nodeAdmin: address(8), allowedCreators: false,
    allowedTokens: true, decimals: 6, symbol: 'TEST', resolvers: [resolver], vetoPeriod: 60, earlyResolution: false,
    activeConfigVersion: 1, invalidationBuffer: 300n, balanceOf: 100_000_000n, allowance: 0n,
    configHash: hash(9), configByVersion: {} };
  read.mockImplementation(async (_address, _abi, name) => {
    if (!(name in values)) throw new Error(`Unexpected read ${name}`);
    return values[name];
  });
  node = { reference: { chainId: context.chainId, factory: context.factory, nodeId: context.nodeId, releaseId: context.release.releaseId }, context, endpoints: [],
    node: { state: { creation: { tokens: [token], adjudicators: [{ adjudicator, profileHash: hash(8) }] } } },
    client: { readContract: vi.fn(async ({ address: target, abi, functionName }: { address: Address; abi: unknown; functionName: string }) => read(target, abi, functionName)),
      getBlock: vi.fn().mockResolvedValue({ timestamp: 1_000n }), simulateContract: vi.fn().mockResolvedValue({}) },
  } as unknown as SoothResolvedNode;
  vi.mocked(verifyFactoryOperation, { partial: true }).mockResolvedValue({ context, read });
  vi.mocked(readFactoryAdjudicatorBinding).mockResolvedValue({ kind: 'manual', chainId: context.chainId, address: adjudicator,
    marketFactory: context.contracts.marketFactory, profileHash: hash(8), abiBundleHash: hash(7) });
  intent = { question: 'Will the event occur?', rules: 'Resolve YES if the event occurs before the deadline.', deadline: 10_000n,
    token, adjudicator, resolver, liquidity: '1', budget: '10', probability: '50', resolution: { kind: 'manual' } };
  wallet = { connect: vi.fn(), switchChain: vi.fn(), getSession: vi.fn().mockResolvedValue({ account, chainId: context.chainId }), sendTransaction: vi.fn().mockResolvedValue(hash(20)) };
  vi.mocked(canPersistSoothPending).mockReturnValue(true);
  vi.mocked(loadSoothPendingCreations).mockReturnValue([]);
  vi.mocked(saveSoothPendingCreation).mockReturnValue(true);
  vi.mocked(buildFactoryTransaction).mockResolvedValue({ chainId: context.chainId, account, address: token, abi: erc20Abi,
    functionName: 'approve', args: [context.contracts.marketFactory, 10_000_000n], to: token, data: '0x1234', value: 0n,
    verifiedBlockNumber: 10n, verifiedContext: context });
});
afterEach(() => vi.unstubAllGlobals());

describe('creation planning', () => {
  it.each(['0', '-1', '1e3', ' 1', '1.', '0.0000000000000000001'])('rejects invalid liquidity %s before reads', async liquidity => {
    await expect(planSoothCreation(node, account, { ...intent, liquidity })).rejects.toThrow();
    expect(verifyFactoryOperation).not.toHaveBeenCalled();
  });
  it.each([{ question: 'short' }, { rules: '' }, { question: 'A valid question\n§forged' }, { probability: '100' }, { probability: '0' }])('rejects malformed terms %j', async change => {
    await expect(planSoothCreation(node, account, { ...intent, ...change })).rejects.toThrow();
    expect(verifyFactoryOperation).not.toHaveBeenCalled();
  });
  it('enforces live creator permissions and pause state', async () => {
    values.permissionlessCreation = false;
    await expect(planSoothCreation(node, account, intent)).rejects.toThrow('not allowed');
    values.allowedCreators = true;
    expect((await planSoothCreation(node, account, intent)).account).toBe(account);
    values.creationPaused = true;
    await expect(planSoothCreation(node, account, intent)).rejects.toThrow('paused');
  });
  it('rejects unadmitted profiles, mismatched resolution fields, and unapproved resolvers', async () => {
    await expect(planSoothCreation(node, account, { ...intent, adjudicator: address(99) })).rejects.toThrow('not admitted');
    await expect(planSoothCreation(node, account, { ...intent, resolution: { kind: 'imd' } as SoothCreationIntent['resolution'] })).rejects.toThrow('do not match');
    await expect(planSoothCreation(node, account, { ...intent, resolver: address(99) })).rejects.toThrow('approved resolver');
  });
  it.each(['imd-v2', 'swarm-expert-sqf'] as const)('excludes unsupported %s profiles', async kind => {
    vi.mocked(readFactoryAdjudicatorBinding).mockResolvedValue({ kind, address: adjudicator, chainId: context.chainId,
      marketFactory: context.contracts.marketFactory, profileHash: hash(8), abiBundleHash: hash(7) } as FactoryAdjudicatorBinding);
    const options = await readSoothCreationOptions(node, account);
    expect(options.profiles).toEqual([]);
    expect(options.unavailable).toEqual([expect.objectContaining({ address: adjudicator, reason: expect.any(String) })]);
  });
  it('enforces exact collateral precision, balance, and submission time', async () => {
    await expect(planSoothCreation(node, account, { ...intent, budget: '1.0000001' })).rejects.toThrow('exact decimal');
    await expect(planSoothCreation(node, account, { ...intent, budget: '101' })).rejects.toThrow('balance');
    await expect(planSoothCreation(node, account, { ...intent, deadline: 1_120n })).rejects.toThrow('two minutes');
  });
  it('plans zero reset, finite budget approval, then creation after refreshed allowance', async () => {
    values.allowance = 1n;
    expect((await planSoothCreation(node, account, intent)).approveNative).toBe(0n);
    values.allowance = 0n;
    expect((await planSoothCreation(node, account, intent)).approveNative).toBe(10_000_000n);
    values.allowance = 10_000_000n;
    const preview = await planSoothCreation(node, account, intent);
    expect(preview.approveNative).toBeNull();
    expect(preview.params.maxInputNative).toBe(10_000_000n);
    expect(node.client.simulateContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'createMarket', args: [preview.params] }));
  });
});

describe('creation submission safety', () => {
  it.each([0n, 1n])('sends only the reviewed approval for allowance %s', async allowance => {
    values.allowance = allowance;
    const preview = await planSoothCreation(node, account, intent);
    const notified = vi.fn();
    await sendSoothCreation(node, wallet, preview, 'approveCreation', notified);
    expect(buildFactoryTransaction).toHaveBeenCalledWith(expect.objectContaining({ action: { kind: 'approveCreation', tokenA: token, amountNative: allowance ? 0n : 10_000_000n } }));
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
    expect(saveSoothPendingCreation).toHaveBeenCalledWith(expect.objectContaining({ node: preview.node, account, kind: 'approveCreation', hash: hash(20) }));
    expect(vi.mocked(saveSoothPendingCreation).mock.invocationCallOrder[0]).toBeLessThan(notified.mock.invocationCallOrder[0]!);
  });
  it('prevents concurrent sends and releases its guard after settlement', async () => {
    const preview = await planSoothCreation(node, account, intent);
    const { promise, resolve: release } = Promise.withResolvers<{ account: Address; chainId: number }>();
    vi.mocked(wallet.getSession).mockReturnValueOnce(promise);
    const first = sendSoothCreation(node, wallet, preview, 'approveCreation', vi.fn());
    await expect(sendSoothCreation(node, wallet, preview, 'approveCreation', vi.fn())).rejects.toThrow('already being submitted');
    release({ account, chainId: context.chainId });
    await first;
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
    await sendSoothCreation(node, wallet, preview, 'approveCreation', vi.fn());
    expect(wallet.sendTransaction).toHaveBeenCalledTimes(2);
  });
  it.each([1, 2, 3])('checks account and chain at session checkpoint %s', async checkpoint => {
    const preview = await planSoothCreation(node, account, intent);
    for (const changed of [{ account: address(99), chainId: context.chainId }, { account, chainId: 1 }]) {
      vi.mocked(wallet.getSession).mockReset().mockResolvedValue(changed);
      for (let i = 1; i < checkpoint; i++) vi.mocked(wallet.getSession).mockResolvedValueOnce({ account, chainId: context.chainId });
      await expect(sendSoothCreation(node, wallet, preview, 'approveCreation', vi.fn())).rejects.toThrow('account or chain changed');
    }
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
  it('blocks only this node/account pending records', async () => {
    const preview = await planSoothCreation(node, account, intent);
    const pending = { version: 1 as const, node: preview.node, account, chainId: context.chainId, hash: hash(30), to: token, data: '0x1234' as Hex, kind: 'approveCreation' as const, submittedAt: 1 };
    vi.mocked(loadSoothPendingCreations).mockReturnValue([pending]);
    await expect(sendSoothCreation(node, wallet, preview, 'approveCreation', vi.fn())).rejects.toThrow('Reconcile');
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
    vi.mocked(loadSoothPendingCreations).mockReturnValue([{ ...pending, account: address(99) }]);
    await sendSoothCreation(node, wallet, preview, 'approveCreation', vi.fn());
    expect(loadSoothPendingCreations).toHaveBeenCalledWith(formatSoothNodeReference(node.reference));
  });
  it('rejects changed node, changed approval, and missing cross-window lock', async () => {
    const preview = await planSoothCreation(node, account, intent);
    await expect(sendSoothCreation(node, wallet, { ...preview, node: 'other' }, 'approveCreation', vi.fn())).rejects.toThrow('node changed');
    values.allowance = 1n;
    await expect(sendSoothCreation(node, wallet, preview, 'approveCreation', vi.fn())).rejects.toThrow('approval changed');
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, run: (lock: null) => Promise<unknown>) => run(null) } });
    await expect(sendSoothCreation(node, wallet, preview, 'approveCreation', vi.fn())).rejects.toThrow('Another window');
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
});
