import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockNotFoundError, TransactionReceiptNotFoundError, encodeFunctionData, erc20Abi, type Address, type Hash, type TransactionReceipt } from 'viem';
import { assertMarketBinding } from '../../src/factory/factoryClient.js';
import { decodeFactoryCreatedMarket } from '../../src/factory/factoryTransactions.js';
import { FactoryTransactionIdentityError } from '../../src/factory/factoryReceipt.js';
import { formatSoothNodeReference } from '../../src/react/node.js';
import { loadSoothPendingCreations, saveSoothPendingCreation, removeSoothPendingCreation, reconcileSoothCreation, type SoothPendingCreation } from '../../src/react/creationRecovery.js';
import type { SoothResolvedNode } from '../../src/react/runtime.js';
import type * as FactoryClientModule from '../../src/factory/factoryClient.js';
import type * as FactoryTransactionsModule from '../../src/factory/factoryTransactions.js';
vi.mock('../../src/factory/factoryClient.js', async original => ({ ...await original<typeof FactoryClientModule>(), assertMarketBinding: vi.fn() }));
vi.mock('../../src/factory/factoryTransactions.js', async original => ({ ...await original<typeof FactoryTransactionsModule>(), decodeFactoryCreatedMarket: vi.fn() }));
const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hash;
const account = address(4), to = address(5), txHash = hash(20), blockHash = hash(10);
const spender = address(6);
const approvalData = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, 100n] });
const reference = { chainId: 1, factory: address(1), nodeId: hash(1), releaseId: hash(2) };
const NODE = formatSoothNodeReference(reference);
const OTHER_NODE = formatSoothNodeReference({ ...reference, nodeId: hash(3) });
class MemoryStorage implements Storage {
  readonly entries = new Map<string, string>();
  get length() { return this.entries.size; }
  clear() { this.entries.clear(); }
  getItem(key: string) { return this.entries.get(key) ?? null; }
  key(index: number) { return [...this.entries.keys()][index] ?? null; }
  removeItem(key: string) { this.entries.delete(key); }
  setItem(key: string, value: string) { this.entries.set(key, value); }
}
function pending(overrides: Partial<SoothPendingCreation> = {}): SoothPendingCreation {
  return { version: 1, node: NODE, chainId: 1, account, to, hash: txHash, data: '0xabcd', kind: 'createMarket', submittedAt: 1, ...overrides };
}
let storage: MemoryStorage;
beforeEach(() => {
  vi.resetAllMocks();
  storage = new MemoryStorage();
  vi.stubGlobal('window', { localStorage: storage });
  vi.mocked(decodeFactoryCreatedMarket).mockReturnValue(address(9));
});
afterEach(() => {
  for (const node of [NODE, OTHER_NODE]) for (const record of loadSoothPendingCreations(node)) removeSoothPendingCreation(node, record.hash);
  vi.unstubAllGlobals();
});
function fixture() {
  const receipt: TransactionReceipt = { blockHash, blockNumber: 10n, contractAddress: null, cumulativeGasUsed: 21_000n, effectiveGasPrice: 1n,
    from: account, gasUsed: 21_000n, logs: [], logsBloom: `0x${'00'.repeat(256)}`, status: 'success', to, transactionHash: txHash, transactionIndex: 0, type: 'eip1559' };
  const transaction = { hash: txHash, from: account, to: to as Address | null, input: '0xabcd', chainId: 1, value: 0n, blockHash, blockNumber: 10n };
  const block = { hash: blockHash as Hash | null, number: 10n as bigint | null };
  const client = { getChainId: vi.fn().mockResolvedValue(1), getTransactionReceipt: vi.fn().mockResolvedValue(receipt),
    getTransaction: vi.fn().mockResolvedValue(transaction), getBlock: vi.fn().mockResolvedValue(block) };
  const node = { reference, context: { release: {}, contracts: { marketFactory: spender } }, endpoints: [], client } as unknown as SoothResolvedNode;
  return { node, client, receipt, transaction, block };
}
describe('creation pending storage', () => {
  it('scopes records to nodes and retains separate account records', () => {
    const own = pending(), otherAccount = pending({ hash: hash(21), account: address(7) }), otherNode = pending({ node: OTHER_NODE, hash: hash(22) });
    for (const record of [own, otherAccount, otherNode]) expect(saveSoothPendingCreation(record)).toBe(true);
    expect(loadSoothPendingCreations(NODE)).toEqual([own, otherAccount]);
    expect(loadSoothPendingCreations(OTHER_NODE)).toEqual([otherNode]);
    removeSoothPendingCreation(NODE, own.hash);
    expect(loadSoothPendingCreations(NODE)).toEqual([otherAccount]);
    expect(loadSoothPendingCreations(OTHER_NODE)).toEqual([otherNode]);
  });
  it('survives failed durable writes and deduplicates after persistence recovers', () => {
    const set = vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(saveSoothPendingCreation(pending())).toBe(false);
    expect(loadSoothPendingCreations(NODE)).toEqual([pending()]);
    set.mockRestore();
    expect(saveSoothPendingCreation(pending())).toBe(true);
    expect(loadSoothPendingCreations(NODE)).toEqual([pending()]);
  });
  it('ignores malformed and foreign records while preserving them on removal', () => {
    const key = `sooth:creation:pending:v1:${NODE}`;
    const invalid = { ...pending(), chainId: 2 }, foreign = pending({ node: OTHER_NODE });
    storage.setItem(key, JSON.stringify([invalid, foreign, pending()]));
    expect(loadSoothPendingCreations(NODE)).toEqual([pending()]);
    removeSoothPendingCreation(NODE, txHash);
    expect(JSON.parse(storage.getItem(key)!)).toEqual([invalid, foreign]);
  });
  it.each([{ chainId: 2 }, { data: '0xabc' }, { submittedAt: -1 }, { hash: '0x12' }])('rejects malformed recovery identity %j', change => {
    expect(() => saveSoothPendingCreation({ ...pending(), ...change } as SoothPendingCreation)).toThrow();
    expect(loadSoothPendingCreations(NODE)).toEqual([]);
  });
});
describe('canonical creation recovery', () => {
  it('confirms the exact transaction and binds the emitted market before returning it', async () => {
    const f = fixture();
    saveSoothPendingCreation(pending());
    expect(await reconcileSoothCreation(f.node, pending())).toEqual({ status: 'confirmed', receipt: f.receipt, market: address(9) });
    expect(decodeFactoryCreatedMarket).toHaveBeenCalledWith({ context: f.node.context, receipt: f.receipt, account });
    expect(assertMarketBinding).toHaveBeenCalledWith(expect.objectContaining({ identity: reference, market: address(9) }));
    expect(loadSoothPendingCreations(NODE)).toEqual([pending()]);
    removeSoothPendingCreation(NODE, txHash);
    expect(loadSoothPendingCreations(NODE)).toEqual([]);
  });
  it.each(['approveCreation', 'createMarket'] as const)('returns failed for canonical reverted %s without decoding', async kind => {
    const f = fixture();
    f.receipt.status = 'reverted';
    const data = kind === 'approveCreation' ? approvalData : '0xabcd';
    f.transaction.input = data;
    expect(await reconcileSoothCreation(f.node, pending({ kind, data }))).toEqual({ status: 'failed', receipt: f.receipt });
    expect(decodeFactoryCreatedMarket).not.toHaveBeenCalled();
  });
  it('confirms approval without treating it as a created market', async () => {
    const f = fixture();
    f.transaction.input = approvalData;
    expect(await reconcileSoothCreation(f.node, pending({ kind: 'approveCreation', data: approvalData }))).toEqual({ status: 'confirmed', receipt: f.receipt });
    expect(decodeFactoryCreatedMarket).not.toHaveBeenCalled();
    expect(assertMarketBinding).not.toHaveBeenCalled();
  });
  it('accepts a wallet-edited positive approval while retaining exact token and spender identity', async () => {
    const f = fixture();
    const record = pending({ kind: 'approveCreation', data: approvalData });
    f.transaction.input = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, 50n] });
    expect(await reconcileSoothCreation(f.node, record)).toEqual({ status: 'confirmed', receipt: f.receipt });
    f.transaction.to = address(99);
    await expect(reconcileSoothCreation(f.node, record)).rejects.toBeInstanceOf(FactoryTransactionIdentityError);
    f.transaction.to = to;
    f.transaction.input = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [address(99), 50n] });
    await expect(reconcileSoothCreation(f.node, record)).rejects.toBeInstanceOf(FactoryTransactionIdentityError);
  });
  it('rejects edited reset amounts and recovery records naming another spender', async () => {
    const f = fixture();
    const reset = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, 0n] });
    f.transaction.input = approvalData;
    await expect(reconcileSoothCreation(f.node, pending({ kind: 'approveCreation', data: reset }))).rejects.toBeInstanceOf(FactoryTransactionIdentityError);
    f.transaction.input = reset;
    expect(await reconcileSoothCreation(f.node, pending({ kind: 'approveCreation', data: reset }))).toMatchObject({ status: 'confirmed' });
    const foreign = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [address(99), 100n] });
    f.transaction.input = foreign;
    await expect(reconcileSoothCreation(f.node, pending({ kind: 'approveCreation', data: foreign }))).rejects.toThrow('spender does not match');
  });
  it.each(['account', 'recipient', 'calldata', 'value', 'chain', 'transaction hash', 'receipt hash', 'canonical block', 'block number'] as const)('rejects %s mismatches and preserves recovery records', async mismatch => {
    const f = fixture();
    if (mismatch === 'account') f.transaction.from = address(99);
    if (mismatch === 'recipient') f.transaction.to = address(99);
    if (mismatch === 'calldata') f.transaction.input = '0xabce';
    if (mismatch === 'value') f.transaction.value = 1n;
    if (mismatch === 'chain') f.transaction.chainId = 2;
    if (mismatch === 'transaction hash') f.transaction.hash = hash(99);
    if (mismatch === 'receipt hash') f.receipt.transactionHash = hash(99);
    if (mismatch === 'canonical block') f.block.hash = hash(99);
    if (mismatch === 'block number') f.block.number = 11n;
    saveSoothPendingCreation(pending());
    await expect(reconcileSoothCreation(f.node, pending())).rejects.toBeInstanceOf(FactoryTransactionIdentityError);
    expect(loadSoothPendingCreations(NODE)).toEqual([pending()]);
    expect(decodeFactoryCreatedMarket).not.toHaveBeenCalled();
  });
  it('keeps missing receipt or canonical block pending and recovers on a later read', async () => {
    const f = fixture();
    f.client.getTransactionReceipt.mockRejectedValueOnce(new TransactionReceiptNotFoundError({ hash: txHash }));
    expect(await reconcileSoothCreation(f.node, pending())).toEqual({ status: 'pending' });
    f.client.getBlock.mockRejectedValueOnce(new BlockNotFoundError({ blockNumber: 10n }));
    expect(await reconcileSoothCreation(f.node, pending())).toEqual({ status: 'pending' });
    expect(await reconcileSoothCreation(f.node, pending())).toMatchObject({ status: 'confirmed', market: address(9) });
  });
  it('rejects node and RPC chain mismatches before fetching transactions', async () => {
    const f = fixture();
    await expect(reconcileSoothCreation(f.node, pending({ node: OTHER_NODE }))).rejects.toThrow('another node');
    f.client.getChainId.mockResolvedValue(2);
    await expect(reconcileSoothCreation(f.node, pending())).rejects.toThrow('chain mismatch');
    expect(f.client.getTransactionReceipt).not.toHaveBeenCalled();
  });
  it('propagates RPC and market binding failures without declaring confirmation', async () => {
    const f = fixture(), unavailable = new Error('RPC unavailable');
    f.client.getTransaction.mockRejectedValueOnce(unavailable);
    await expect(reconcileSoothCreation(f.node, pending())).rejects.toBe(unavailable);
    vi.mocked(assertMarketBinding).mockRejectedValueOnce(new Error('Market belongs to another node'));
    await expect(reconcileSoothCreation(f.node, pending())).rejects.toThrow('another node');
  });
});
